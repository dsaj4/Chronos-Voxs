"""File-system backed bridge from crawl manifests into analysis jobs."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from hashlib import sha256
import re
from pathlib import Path
from typing import Any

from .filesystem import IngestFilesystemStore
from .models import (
    AnalysisJob,
    CrawlResultManifest,
    CrawlTask,
    CrawlTaskRequest,
    CrawlTaskStatus,
    IngestTaskStatus,
    NormalizedCommentBatch,
    TimeRange,
    WorkspaceSession,
)


DEFAULT_SOURCE = "MediaCrawler"
DEFAULT_SCHEMA_VERSION = "chronos-vox.ingest.v1"
DEFAULT_WORKSPACE_VIEW = "storylines"


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def canonicalize_text(value: object) -> str:
    return str(value or "").strip()


def slugify(value: object) -> str:
    cleaned = canonicalize_text(value).lower()
    cleaned = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "item"


def short_hash(*parts: object, length: int = 10) -> str:
    payload = "|".join(canonicalize_text(part).lower() for part in parts)
    digest = sha256(payload.encode("utf-8")).hexdigest()
    return digest[:length]


def build_task_id(keyword: str, platforms: list[str], time_range: TimeRange, requested_at: str | None) -> str:
    fingerprint = short_hash(keyword, ",".join(platforms), time_range["start_at"], time_range["end_at"], requested_at or "")
    return f"task_{slugify(keyword)}_{fingerprint}"


def build_dataset_id(task_id: str) -> str:
    return f"dataset_{slugify(task_id)}"


def build_analysis_id(dataset_id: str) -> str:
    return f"analysis_{slugify(dataset_id)}"


def build_workspace_id(analysis_id: str) -> str:
    return f"workspace_{slugify(analysis_id)}"


def build_platform_breakdown(platforms: list[str], comment_count: int) -> dict[str, int]:
    if not platforms:
        return {}
    if len(platforms) == 1:
        return {platforms[0]: comment_count}

    base_share = comment_count // len(platforms)
    remainder = comment_count % len(platforms)
    breakdown: dict[str, int] = {}
    for index, platform in enumerate(platforms):
        breakdown[platform] = base_share + (1 if index < remainder else 0)
    return breakdown


def _platforms(value: object) -> list[str]:
    if isinstance(value, list):
        return [canonicalize_text(item) for item in value if canonicalize_text(item)]
    return []


def _time_range(value: object) -> TimeRange:
    if isinstance(value, Mapping):
        return {
            "start_at": canonicalize_text(value.get("start_at")),
            "end_at": canonicalize_text(value.get("end_at")),
        }
    return {"start_at": "", "end_at": ""}


class IngestPipeline:
    def __init__(self, store: IngestFilesystemStore | None = None) -> None:
        self.store = store or IngestFilesystemStore()

    def create_crawl_task(self, request: CrawlTaskRequest) -> CrawlTask:
        task_id = canonicalize_text(request.get("task_id")) or build_task_id(
            request["keyword"],
            _platforms(request.get("platforms", [])),
            _time_range(request["time_range"]),
            canonicalize_text(request.get("requested_at")) or None,
        )
        existing = self.store.load_task(task_id)
        if existing:
            return existing  # type: ignore[return-value]

        requested_at = canonicalize_text(request.get("requested_at")) or now_iso()
        task: CrawlTask = {
            "task_id": task_id,
            "keyword": canonicalize_text(request["keyword"]),
            "platforms": _platforms(request.get("platforms", [])),
            "time_range": _time_range(request["time_range"]),
            "requested_at": requested_at,
            "status": "待启动",
            "source": canonicalize_text(request.get("source")) or DEFAULT_SOURCE,
            "latest_message": canonicalize_text(request.get("latest_message")) or "task created",
            "result_manifest_uri": "",
        }
        self.store.save_task(task)
        self.store.save_status(self._task_status(task, progress_percent=0, current_stage="待启动"))
        return task

    def _task_status(
        self,
        task: CrawlTask,
        *,
        progress_percent: int,
        current_stage: str,
        current_platform: str | None = None,
        estimated_comment_count: int = 0,
        updated_at: str | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> CrawlTaskStatus:
        status: CrawlTaskStatus = {
            "task_id": task["task_id"],
            "status": task["status"],
            "progress_percent": progress_percent,
            "current_stage": current_stage,
            "current_platform": current_platform or (task["platforms"][0] if task["platforms"] else ""),
            "estimated_comment_count": estimated_comment_count,
            "updated_at": updated_at or now_iso(),
        }
        if error_code:
            status["error_code"] = error_code
        if error_message:
            status["error_message"] = error_message
        return status

    def set_task_status(
        self,
        task_id: str,
        *,
        status: IngestTaskStatus,
        progress_percent: int,
        current_stage: str,
        current_platform: str | None = None,
        estimated_comment_count: int = 0,
        error_code: str | None = None,
        error_message: str | None = None,
        latest_message: str | None = None,
        result_manifest_uri: str | None = None,
    ) -> CrawlTask:
        task = self.get_crawl_task(task_id)
        task["status"] = status
        if latest_message is not None:
            task["latest_message"] = latest_message
        if result_manifest_uri is not None:
            task["result_manifest_uri"] = result_manifest_uri
        self.store.save_task(task)
        self.store.save_status(
            self._task_status(
                task,
                progress_percent=progress_percent,
                current_stage=current_stage,
                current_platform=current_platform,
                estimated_comment_count=estimated_comment_count,
                error_code=error_code,
                error_message=error_message,
            )
        )
        return task

    def get_crawl_task(self, task_id: str) -> CrawlTask:
        task = self.store.load_task(task_id)
        if task is None:
            raise KeyError(f"crawl task not found: {task_id}")
        return task  # type: ignore[return-value]

    def get_crawl_task_status(self, task_id: str) -> CrawlTaskStatus:
        status = self.store.load_status(task_id)
        if status is not None:
            return status  # type: ignore[return-value]
        task = self.get_crawl_task(task_id)
        return self._task_status(task, progress_percent=0, current_stage=task["status"])

    def register_crawl_result_manifest(self, manifest: CrawlResultManifest) -> CrawlResultManifest:
        if self.store.load_task(manifest["task_id"]) is None:
            self.create_crawl_task(
                {
                    "task_id": manifest["task_id"],
                    "keyword": manifest["keyword"],
                    "platforms": list(manifest["platforms"]),
                    "time_range": {
                        "start_at": manifest["time_range"]["start_at"],
                        "end_at": manifest["time_range"]["end_at"],
                    },
                    "requested_at": manifest["created_at"],
                    "source": DEFAULT_SOURCE,
                    "latest_message": f"crawl result manifest imported for {manifest['dataset_id']}",
                }
            )
        existing = self.store.load_manifest(manifest["task_id"])
        if existing:
            return existing  # type: ignore[return-value]

        self.store.save_manifest(manifest)
        self.set_task_status(
            manifest["task_id"],
            status="抓取完成",
            progress_percent=50,
            current_stage="抓取完成",
            current_platform=manifest["platforms"][0] if manifest["platforms"] else "",
            estimated_comment_count=manifest["raw_record_count"],
            latest_message=f"crawl result manifest registered for {manifest['dataset_id']}",
            result_manifest_uri=str(self.store.manifest_path(manifest["task_id"])),
        )
        return manifest

    def get_crawl_result_manifest(self, task_id: str) -> CrawlResultManifest:
        manifest = self.store.load_manifest(task_id)
        if manifest is None:
            raise KeyError(f"crawl result manifest not found: {task_id}")
        return manifest  # type: ignore[return-value]

    def materialize_normalized_comment_batch(
        self,
        manifest: CrawlResultManifest,
        *,
        file_uri: str | None = None,
        comment_count: int | None = None,
        platform_breakdown: dict[str, int] | None = None,
        language: str = "undetermined",
    ) -> NormalizedCommentBatch:
        dataset_id = manifest["dataset_id"]
        existing = self.store.load_normalized_batch(dataset_id)
        if existing:
            return existing  # type: ignore[return-value]

        batch_file_path = Path(file_uri) if file_uri else self.store.normalized_batch_path(dataset_id)
        batch: NormalizedCommentBatch = {
            "dataset_id": dataset_id,
            "batch_id": f"batch_{slugify(dataset_id)}",
            "schema_version": DEFAULT_SCHEMA_VERSION,
            "comment_count": comment_count if comment_count is not None else manifest["raw_record_count"],
            "platform_breakdown": platform_breakdown
            if platform_breakdown is not None
            else build_platform_breakdown(manifest["platforms"], manifest["raw_record_count"]),
            "language": language,
            "file_uri": str(batch_file_path.resolve()),
        }
        self.store.save_normalized_batch(batch)
        self.set_task_status(
            manifest["task_id"],
            status="清洗中",
            progress_percent=70,
            current_stage="清洗中",
            current_platform=manifest["platforms"][0] if manifest["platforms"] else "",
            estimated_comment_count=batch["comment_count"],
            latest_message=f"normalized batch materialized for {dataset_id}",
        )
        return batch

    def start_analysis_job(
        self,
        batch: NormalizedCommentBatch,
        *,
        bundle_uri: str | None = None,
        auto_finalize: bool = True,
    ) -> AnalysisJob:
        dataset_id = batch["dataset_id"]
        analysis_id = build_analysis_id(dataset_id)
        existing = self.store.load_analysis_job(analysis_id)
        if existing:
            return existing  # type: ignore[return-value]

        artifact_manifest_uri = str(self.store.analysis_artifact_path(analysis_id).resolve())
        analysis_job: AnalysisJob = {
            "analysis_id": analysis_id,
            "dataset_id": dataset_id,
            "status": "分析中",
            "artifact_manifest_uri": artifact_manifest_uri,
            "started_at": now_iso(),
        }
        self.store.save_analysis_job(analysis_job)
        self.set_task_status(
            self._dataset_to_task_id(dataset_id),
            status="分析中",
            progress_percent=85,
            current_stage="分析中",
            current_platform=self._batch_primary_platform(batch),
            estimated_comment_count=self._batch_comment_count(batch),
            latest_message=f"analysis job started for {dataset_id}",
        )

        if auto_finalize:
            analysis_job = self.finalize_analysis_job(
                analysis_job,
                bundle_uri=bundle_uri,
            )
        return analysis_job

    def finalize_analysis_job(
        self,
        analysis_job: AnalysisJob,
        *,
        bundle_uri: str | None = None,
    ) -> AnalysisJob:
        workspace_id = build_workspace_id(analysis_job["analysis_id"])
        session = self.get_or_create_workspace_session(
            workspace_id,
            analysis_id=analysis_job["analysis_id"],
            bundle_uri=bundle_uri,
        )
        artifact_payload = {
            "analysis_id": analysis_job["analysis_id"],
            "dataset_id": analysis_job["dataset_id"],
            "workspace_id": session["workspace_id"],
            "bundle_uri": session["bundle_uri"],
            "created_at": now_iso(),
        }
        self.store.save_analysis_artifact(artifact_payload)
        analysis_job["status"] = "可查看"
        analysis_job["completed_at"] = now_iso()
        analysis_job["artifact_manifest_uri"] = str(self.store.analysis_artifact_path(analysis_job["analysis_id"]).resolve())
        self.store.save_analysis_job(analysis_job)
        self.set_task_status(
            self._dataset_to_task_id(analysis_job["dataset_id"]),
            status="可查看",
            progress_percent=100,
            current_stage="可查看",
            current_platform=self._batch_primary_platform(
                self.store.load_normalized_batch(analysis_job["dataset_id"]) or batch_placeholder(analysis_job["dataset_id"])
            ),
            estimated_comment_count=self._batch_comment_count_by_dataset(analysis_job["dataset_id"]),
            latest_message=f"workspace ready for {analysis_job['analysis_id']}",
        )
        return analysis_job

    def get_analysis_job_status(self, analysis_id: str) -> AnalysisJob:
        analysis_job = self.store.load_analysis_job(analysis_id)
        if analysis_job is None:
            raise KeyError(f"analysis job not found: {analysis_id}")
        return analysis_job  # type: ignore[return-value]

    def get_or_create_workspace_session(
        self,
        workspace_id: str,
        *,
        analysis_id: str,
        bundle_uri: str | None = None,
        default_primary_view: str = DEFAULT_WORKSPACE_VIEW,
    ) -> WorkspaceSession:
        existing = self.store.load_workspace_session(workspace_id)
        if existing:
            return existing  # type: ignore[return-value]

        session: WorkspaceSession = {
            "workspace_id": workspace_id,
            "analysis_id": analysis_id,
            "bundle_uri": bundle_uri or str(self.store.root / "bundles" / f"{workspace_id}.json"),
            "default_primary_view": default_primary_view,
            "created_at": now_iso(),
        }
        self.store.save_workspace_session(session)
        return session

    def get_workspace_session(self, workspace_id: str) -> WorkspaceSession:
        session = self.store.load_workspace_session(workspace_id)
        if session is None:
            raise KeyError(f"workspace session not found: {workspace_id}")
        return session  # type: ignore[return-value]

    def bridge_manifest_to_workspace(
        self,
        manifest: CrawlResultManifest,
        *,
        normalized_batch_file_uri: str | None = None,
        normalized_comment_count: int | None = None,
        language: str = "undetermined",
        platform_breakdown: dict[str, int] | None = None,
        bundle_uri: str | None = None,
    ) -> dict[str, Any]:
        self.register_crawl_result_manifest(manifest)
        batch = self.materialize_normalized_comment_batch(
            manifest,
            file_uri=normalized_batch_file_uri,
            comment_count=normalized_comment_count,
            platform_breakdown=platform_breakdown,
            language=language,
        )
        analysis_job = self.start_analysis_job(batch, bundle_uri=bundle_uri)
        workspace_id = build_workspace_id(analysis_job["analysis_id"])
        workspace = self.get_workspace_session(workspace_id)
        return {
            "manifest": self.get_crawl_result_manifest(manifest["task_id"]),
            "normalized_batch": batch,
            "analysis_job": analysis_job,
            "workspace_session": workspace,
        }

    def _dataset_to_task_id(self, dataset_id: str) -> str:
        if dataset_id.startswith("dataset_"):
            return dataset_id.removeprefix("dataset_")
        return dataset_id

    @staticmethod
    def _batch_comment_count(batch: NormalizedCommentBatch) -> int:
        return int(batch.get("comment_count", 0) or 0)

    def _batch_comment_count_by_dataset(self, dataset_id: str) -> int:
        batch = self.store.load_normalized_batch(dataset_id)
        if not batch:
            return 0
        return self._batch_comment_count(batch)  # type: ignore[arg-type]

    @staticmethod
    def _batch_primary_platform(batch: Mapping[str, Any]) -> str:
        breakdown = batch.get("platform_breakdown")
        if isinstance(breakdown, Mapping):
            for platform in breakdown:
                return canonicalize_text(platform)
        return ""


def batch_placeholder(dataset_id: str) -> dict[str, Any]:
    return {
        "dataset_id": dataset_id,
        "batch_id": f"batch_{slugify(dataset_id)}",
        "schema_version": DEFAULT_SCHEMA_VERSION,
        "comment_count": 0,
        "platform_breakdown": {},
        "language": "undetermined",
        "file_uri": "",
    }


def ensure_time_range(value: Mapping[str, object]) -> TimeRange:
    return {
        "start_at": canonicalize_text(value.get("start_at")),
        "end_at": canonicalize_text(value.get("end_at")),
    }
