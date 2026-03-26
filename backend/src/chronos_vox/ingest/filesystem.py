"""Filesystem-backed persistence for ingest bridge artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


class IngestFilesystemStore:
    def __init__(self, root: Path | None = None, public_root: Path | None = None) -> None:
        self.root = (root or (_repo_root() / "artifacts" / "ingest")).resolve()
        self.public_root = (public_root or (_repo_root() / "frontend" / "workspace" / "public" / "ingest")).resolve()
        self.tasks_dir = self.root / "crawl_tasks"
        self.status_dir = self.root / "crawl_status"
        self.manifests_dir = self.root / "crawl_manifests"
        self.normalized_batches_dir = self.root / "normalized_batches"
        self.normalized_batch_payloads_dir = self.root / "normalized_batch_payloads"
        self.analysis_jobs_dir = self.root / "analysis_jobs"
        self.analysis_artifacts_dir = self.root / "analysis_artifacts"
        self.analysis_states_dir = self.root / "analysis_states"
        self.published_bundles_dir = self.root / "published_bundles"
        self.workspace_sessions_dir = self.root / "workspace_sessions"
        self.public_bundles_dir = self.public_root / "bundles"
        self.public_workspace_sessions_dir = self.public_root / "workspaces"
        self._ensure_layout()

    def _ensure_layout(self) -> None:
        for directory in (
            self.tasks_dir,
            self.status_dir,
            self.manifests_dir,
            self.normalized_batches_dir,
            self.normalized_batch_payloads_dir,
            self.analysis_jobs_dir,
            self.analysis_artifacts_dir,
            self.analysis_states_dir,
            self.published_bundles_dir,
            self.workspace_sessions_dir,
            self.public_bundles_dir,
            self.public_workspace_sessions_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _json_path(directory: Path, object_id: str) -> Path:
        safe_id = object_id.replace("/", "_").replace("\\", "_")
        return directory / f"{safe_id}.json"

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_path.replace(path)

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def task_path(self, task_id: str) -> Path:
        return self._json_path(self.tasks_dir, task_id)

    def status_path(self, task_id: str) -> Path:
        return self._json_path(self.status_dir, task_id)

    def manifest_path(self, task_id: str) -> Path:
        return self._json_path(self.manifests_dir, task_id)

    def normalized_batch_path(self, dataset_id: str) -> Path:
        return self._json_path(self.normalized_batches_dir, dataset_id)

    def normalized_batch_payload_path(self, dataset_id: str) -> Path:
        return self._json_path(self.normalized_batch_payloads_dir, dataset_id)

    def analysis_job_path(self, analysis_id: str) -> Path:
        return self._json_path(self.analysis_jobs_dir, analysis_id)

    def analysis_artifact_path(self, analysis_id: str) -> Path:
        return self._json_path(self.analysis_artifacts_dir, analysis_id)

    def analysis_state_path(self, analysis_id: str) -> Path:
        return self._json_path(self.analysis_states_dir, analysis_id)

    def published_bundle_path(self, workspace_id: str) -> Path:
        return self._json_path(self.published_bundles_dir, workspace_id)

    def workspace_session_path(self, workspace_id: str) -> Path:
        return self._json_path(self.workspace_sessions_dir, workspace_id)

    def public_bundle_path(self, workspace_id: str) -> Path:
        return self._json_path(self.public_bundles_dir, workspace_id)

    def public_workspace_session_path(self, workspace_id: str) -> Path:
        return self._json_path(self.public_workspace_sessions_dir, workspace_id)

    def save_task(self, task: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.task_path(str(task["task_id"])), task)
        return task

    def load_task(self, task_id: str) -> dict[str, Any] | None:
        return self._read_json(self.task_path(task_id))

    def save_status(self, status: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.status_path(str(status["task_id"])), status)
        return status

    def load_status(self, task_id: str) -> dict[str, Any] | None:
        return self._read_json(self.status_path(task_id))

    def save_manifest(self, manifest: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.manifest_path(str(manifest["task_id"])), manifest)
        return manifest

    def load_manifest(self, task_id: str) -> dict[str, Any] | None:
        return self._read_json(self.manifest_path(task_id))

    def save_normalized_batch(self, batch: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.normalized_batch_path(str(batch["dataset_id"])), batch)
        return batch

    def load_normalized_batch(self, dataset_id: str) -> dict[str, Any] | None:
        return self._read_json(self.normalized_batch_path(dataset_id))

    def save_normalized_batch_payload(self, dataset_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.normalized_batch_payload_path(dataset_id), payload)
        return payload

    def load_normalized_batch_payload(self, dataset_id: str) -> dict[str, Any] | None:
        return self._read_json(self.normalized_batch_payload_path(dataset_id))

    def save_analysis_job(self, analysis_job: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.analysis_job_path(str(analysis_job["analysis_id"])), analysis_job)
        return analysis_job

    def load_analysis_job(self, analysis_id: str) -> dict[str, Any] | None:
        return self._read_json(self.analysis_job_path(analysis_id))

    def save_analysis_artifact(self, artifact: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.analysis_artifact_path(str(artifact["analysis_id"])), artifact)
        return artifact

    def load_analysis_artifact(self, analysis_id: str) -> dict[str, Any] | None:
        return self._read_json(self.analysis_artifact_path(analysis_id))

    def save_analysis_state(self, analysis_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.analysis_state_path(analysis_id), payload)
        return payload

    def load_analysis_state(self, analysis_id: str) -> dict[str, Any] | None:
        return self._read_json(self.analysis_state_path(analysis_id))

    def save_published_bundle(self, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.published_bundle_path(workspace_id), payload)
        return payload

    def load_published_bundle(self, workspace_id: str) -> dict[str, Any] | None:
        return self._read_json(self.published_bundle_path(workspace_id))

    def save_workspace_session(self, session: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.workspace_session_path(str(session["workspace_id"])), session)
        return session

    def load_workspace_session(self, workspace_id: str) -> dict[str, Any] | None:
        return self._read_json(self.workspace_session_path(workspace_id))

    def save_public_workspace_session(self, session: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.public_workspace_session_path(str(session["workspace_id"])), session)
        return session

    def save_public_bundle(self, workspace_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._write_json(self.public_bundle_path(workspace_id), payload)
        return payload
