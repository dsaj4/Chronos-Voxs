"""File-system backed bridge from crawl manifests into runnable analysis jobs."""

from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from hashlib import sha256
import re
from pathlib import Path
from typing import Any

from ..normalize import normalize_raw_comments
from ..runtime import run_analysis_from_batch
from .filesystem import IngestFilesystemStore
from .mediacrawler_adapter import MediaCrawlerRawRecordAdapter
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

STATUS_PENDING: IngestTaskStatus = "待启动"
STATUS_CRAWLING: IngestTaskStatus = "抓取中"
STATUS_CRAWLED: IngestTaskStatus = "抓取完成"
STATUS_NORMALIZING: IngestTaskStatus = "清洗中"
STATUS_ANALYZING: IngestTaskStatus = "分析中"
STATUS_READY: IngestTaskStatus = "可查看"
STATUS_FAILED: IngestTaskStatus = "失败"


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
    def __init__(
        self,
        store: IngestFilesystemStore | None = None,
        *,
        record_adapter: MediaCrawlerRawRecordAdapter | None = None,
        use_llm: bool = True,
    ) -> None:
        self.store = store or IngestFilesystemStore()
        self.record_adapter = record_adapter or MediaCrawlerRawRecordAdapter()
        self.use_llm = use_llm

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        IngestFilesystemStore._write_json(path, payload)

    @staticmethod
    def _platform_breakdown_from_comments(raw_comments: list[dict[str, Any]]) -> dict[str, int]:
        breakdown: dict[str, int] = {}
        for comment in raw_comments:
            platform = canonicalize_text(comment.get("platform"))
            if not platform:
                continue
            breakdown[platform] = breakdown.get(platform, 0) + 1
        return breakdown

    @staticmethod
    def _dominant_language(normalized_comments: list[dict[str, Any]]) -> str:
        counts: dict[str, int] = {}
        for comment in normalized_comments:
            language = canonicalize_text(comment.get("language"))
            if not language:
                continue
            counts[language] = counts.get(language, 0) + 1
        if not counts:
            return "undetermined"
        return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]

    @staticmethod
    def _public_bundle_uri(workspace_id: str) -> str:
        return f"/ingest/bundles/{workspace_id}.json"

    @staticmethod
    def _public_workspace_uri(workspace_id: str) -> str:
        return f"/ingest/workspaces/{workspace_id}.json"

    def _resolve_public_bundle_path(self, workspace_id: str, bundle_uri: str | None) -> Path:
        if bundle_uri and bundle_uri.startswith("/"):
            return (self.store.public_root.parent / bundle_uri.lstrip("/")).resolve()
        return self.store.public_bundle_path(workspace_id)

    def _load_batch_payload(self, batch: Mapping[str, Any]) -> dict[str, Any]:
        file_uri = canonicalize_text(batch.get("file_uri"))
        if not file_uri:
            raise FileNotFoundError(f"normalized batch file is missing for {batch.get('dataset_id', '')}")
        path = Path(file_uri)
        if not path.exists():
            raise FileNotFoundError(f"normalized batch payload not found: {path}")
        return json.loads(path.read_text(encoding="utf-8"))

    def _persist_workspace_session(self, session: WorkspaceSession) -> WorkspaceSession:
        self.store.save_workspace_session(session)
        self.store.save_public_workspace_session(session)
        return session

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
            "status": STATUS_PENDING,
            "source": canonicalize_text(request.get("source")) or DEFAULT_SOURCE,
            "latest_message": canonicalize_text(request.get("latest_message")) or "task created",
            "result_manifest_uri": "",
        }
        self.store.save_task(task)
        self.store.save_status(self._task_status(task, progress_percent=0, current_stage=STATUS_PENDING))
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
                    "time_range": ensure_time_range(manifest["time_range"]),
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
            status=STATUS_CRAWLED,
            progress_percent=50,
            current_stage=STATUS_CRAWLED,
            current_platform=manifest["platforms"][0] if manifest["platforms"] else "",
            estimated_comment_count=manifest["raw_record_count"],
            latest_message=f"crawl result manifest registered for {manifest['dataset_id']}",
            result_manifest_uri=str(self.store.manifest_path(manifest["task_id"]).resolve()),
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
        manifest_path: Path | None = None,
        file_uri: str | None = None,
        comment_count: int | None = None,
        platform_breakdown: dict[str, int] | None = None,
        language: str = "undetermined",
    ) -> NormalizedCommentBatch:
        dataset_id = manifest["dataset_id"]
        existing = self.store.load_normalized_batch(dataset_id)
        if existing and Path(existing["file_uri"]).exists():
            return existing  # type: ignore[return-value]

        raw_comments = self.record_adapter.load_raw_comments(manifest, manifest_path=manifest_path)
        normalized_comments = normalize_raw_comments(raw_comments)
        batch_file_path = Path(file_uri) if file_uri else self.store.normalized_batch_payload_path(dataset_id)
        payload = {
            "dataset_id": dataset_id,
            "batch_id": f"batch_{slugify(dataset_id)}",
            "schema_version": DEFAULT_SCHEMA_VERSION,
            "created_at": now_iso(),
            "manifest": dict(manifest),
            "raw_comments": raw_comments,
            "normalized_comments": normalized_comments,
        }
        self._write_json(batch_file_path.resolve(), payload)
        batch: NormalizedCommentBatch = {
            "dataset_id": dataset_id,
            "batch_id": f"batch_{slugify(dataset_id)}",
            "schema_version": DEFAULT_SCHEMA_VERSION,
            "comment_count": comment_count if comment_count is not None else len(normalized_comments),
            "platform_breakdown": platform_breakdown
            if platform_breakdown is not None
            else (self._platform_breakdown_from_comments(raw_comments) or build_platform_breakdown(manifest["platforms"], len(raw_comments))),
            "language": language if language != "undetermined" else self._dominant_language(normalized_comments),
            "file_uri": str(batch_file_path.resolve()),
        }
        self.store.save_normalized_batch(batch)
        self.set_task_status(
            manifest["task_id"],
            status=STATUS_NORMALIZING,
            progress_percent=70,
            current_stage=STATUS_NORMALIZING,
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
        workspace_id = build_workspace_id(analysis_id)
        existing = self.store.load_analysis_job(analysis_id)
        if existing:
            artifact = self.store.load_analysis_artifact(analysis_id)
            if (
                existing.get("status") == STATUS_READY
                and artifact is not None
                and self.store.analysis_state_path(analysis_id).exists()
                and self.store.published_bundle_path(workspace_id).exists()
            ):
                return existing  # type: ignore[return-value]
            analysis_job = existing  # type: ignore[assignment]
        else:
            analysis_job = {
                "analysis_id": analysis_id,
                "dataset_id": dataset_id,
                "status": STATUS_ANALYZING,
                "artifact_manifest_uri": str(self.store.analysis_artifact_path(analysis_id).resolve()),
                "started_at": now_iso(),
            }
            self.store.save_analysis_job(analysis_job)
            self.set_task_status(
                self._dataset_to_task_id(dataset_id),
                status=STATUS_ANALYZING,
                progress_percent=85,
                current_stage=STATUS_ANALYZING,
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
        batch = self.store.load_normalized_batch(analysis_job["dataset_id"]) or batch_placeholder(analysis_job["dataset_id"])
        batch_payload = self._load_batch_payload(batch)
        public_bundle_uri = bundle_uri or self._public_bundle_uri(workspace_id)
        public_bundle_path = self._resolve_public_bundle_path(workspace_id, public_bundle_uri)
        runtime_result = run_analysis_from_batch(
            batch_payload=batch_payload,
            analysis_state_path=self.store.analysis_state_path(analysis_job["analysis_id"]),
            bundle_path=self.store.published_bundle_path(workspace_id),
            bundle_uri=public_bundle_uri,
            use_llm=self.use_llm,
        )
        self._write_json(public_bundle_path, runtime_result["bundle"])
        session = self.get_or_create_workspace_session(
            workspace_id,
            analysis_id=analysis_job["analysis_id"],
            bundle_uri=public_bundle_uri,
        )
        artifact_payload = {
            "analysis_id": analysis_job["analysis_id"],
            "dataset_id": analysis_job["dataset_id"],
            "workspace_id": session["workspace_id"],
            "bundle_uri": session["bundle_uri"],
            "workspace_session_uri": self._public_workspace_uri(workspace_id),
            "analysis_state_uri": runtime_result["analysis_state_path"],
            "normalized_batch_file_uri": canonicalize_text(batch.get("file_uri")),
            "bundle_path": runtime_result["bundle_path"],
            "created_at": now_iso(),
        }
        self.store.save_analysis_artifact(artifact_payload)
        analysis_job["status"] = STATUS_READY
        analysis_job["completed_at"] = now_iso()
        analysis_job["artifact_manifest_uri"] = str(self.store.analysis_artifact_path(analysis_job["analysis_id"]).resolve())
        self.store.save_analysis_job(analysis_job)
        self.set_task_status(
            self._dataset_to_task_id(analysis_job["dataset_id"]),
            status=STATUS_READY,
            progress_percent=100,
            current_stage=STATUS_READY,
            current_platform=self._batch_primary_platform(batch),
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
        session: WorkspaceSession = dict(existing) if existing else {
            "workspace_id": workspace_id,
            "analysis_id": analysis_id,
            "bundle_uri": bundle_uri or self._public_bundle_uri(workspace_id),
            "default_primary_view": default_primary_view,
            "created_at": now_iso(),
        }
        session["analysis_id"] = analysis_id
        session["bundle_uri"] = bundle_uri or session.get("bundle_uri", self._public_bundle_uri(workspace_id))
        session["default_primary_view"] = default_primary_view
        return self._persist_workspace_session(session)

    def get_workspace_session(self, workspace_id: str) -> WorkspaceSession:
        session = self.store.load_workspace_session(workspace_id)
        if session is None:
            raise KeyError(f"workspace session not found: {workspace_id}")
        return session  # type: ignore[return-value]

    def bridge_manifest_to_workspace(
        self,
        manifest: CrawlResultManifest,
        *,
        manifest_path: Path | None = None,
        normalized_batch_file_uri: str | None = None,
        normalized_comment_count: int | None = None,
        language: str = "undetermined",
        platform_breakdown: dict[str, int] | None = None,
        bundle_uri: str | None = None,
    ) -> dict[str, Any]:
        self.register_crawl_result_manifest(manifest)
        batch = self.materialize_normalized_comment_batch(
            manifest,
            manifest_path=manifest_path,
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
            "workspace_session_uri": self._public_workspace_uri(workspace_id),
        }

    def bridge_manifest_file_to_workspace(
        self,
        manifest_path: Path,
        *,
        normalized_batch_file_uri: str | None = None,
        normalized_comment_count: int | None = None,
        language: str = "undetermined",
        platform_breakdown: dict[str, int] | None = None,
        bundle_uri: str | None = None,
    ) -> dict[str, Any]:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        return self.bridge_manifest_to_workspace(
            manifest,
            manifest_path=manifest_path,
            normalized_batch_file_uri=normalized_batch_file_uri,
            normalized_comment_count=normalized_comment_count,
            language=language,
            platform_breakdown=platform_breakdown,
            bundle_uri=bundle_uri,
        )

    def _dataset_to_task_id(self, dataset_id: str) -> str:
        if dataset_id.startswith("dataset_"):
            return dataset_id.removeprefix("dataset_")
        return dataset_id

    @staticmethod
    def _batch_comment_count(batch: Mapping[str, Any]) -> int:
        return int(batch.get("comment_count", 0) or 0)

    def _batch_comment_count_by_dataset(self, dataset_id: str) -> int:
        batch = self.store.load_normalized_batch(dataset_id)
        if not batch:
            return 0
        return self._batch_comment_count(batch)

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
