from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.ingest import (
    IngestFilesystemStore,
    IngestPipeline,
    build_analysis_id,
    build_dataset_id,
    build_task_id,
    build_workspace_id,
)


def make_request() -> dict[str, object]:
    return {
        "task_id": "task_ai_bili_001",
        "keyword": "ai",
        "platforms": ["bili"],
        "time_range": {"start_at": "2026-03-10", "end_at": "2026-03-12"},
        "requested_at": "2026-03-24T12:00:00+08:00",
        "source": "MediaCrawler",
        "latest_message": "created",
    }


def make_request_for(task_id: str) -> dict[str, object]:
    request = make_request()
    request["task_id"] = task_id
    return request


def make_manifest(task_id: str) -> dict[str, object]:
    dataset_id = build_dataset_id(task_id)
    return {
        "task_id": task_id,
        "dataset_id": dataset_id,
        "keyword": "ai",
        "platforms": ["bili"],
        "time_range": {"start_at": "2026-03-10", "end_at": "2026-03-12"},
        "raw_record_count": 12,
        "output_files": ["E:/Project/chronos-vox-bili-crawler/artifacts/ai_crawl_data/day_2026-03-12.json"],
        "schema_version": "chronos-vox.crawl-result-manifest.v1",
        "created_at": "2026-03-24T12:30:00+08:00",
    }


def test_manifest_to_workspace_bridge_creates_the_full_chain(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path)
    pipeline = IngestPipeline(store)

    task = pipeline.create_crawl_task(make_request())
    assert task["task_id"] == "task_ai_bili_001"
    assert task["status"] == "待启动"

    running = pipeline.set_task_status(
        task["task_id"],
        status="抓取中",
        progress_percent=20,
        current_stage="抓取中",
        current_platform="bili",
        estimated_comment_count=12,
        latest_message="crawler started",
    )
    assert running["status"] == "抓取中"
    assert pipeline.get_crawl_task_status(task["task_id"])["current_stage"] == "抓取中"

    manifest = pipeline.register_crawl_result_manifest(make_manifest(task["task_id"]))
    assert manifest["dataset_id"] == build_dataset_id(task["task_id"])
    assert pipeline.get_crawl_result_manifest(task["task_id"]) == manifest

    batch = pipeline.materialize_normalized_comment_batch(
        manifest,
        comment_count=12,
        language="zh-CN",
        platform_breakdown={"bili": 12},
    )
    assert batch["dataset_id"] == build_dataset_id(task["task_id"])
    assert batch["batch_id"] == f"batch_{build_dataset_id(task['task_id'])}"
    assert batch["comment_count"] == 12

    analysis_job = pipeline.start_analysis_job(batch, bundle_uri="E:/Project/Cronos-Vox/artifacts/bundles/workspace.json")
    assert analysis_job["analysis_id"] == build_analysis_id(batch["dataset_id"])
    assert analysis_job["status"] == "可查看"

    workspace_id = build_workspace_id(analysis_job["analysis_id"])
    workspace = pipeline.get_workspace_session(workspace_id)
    assert workspace["workspace_id"] == workspace_id
    assert workspace["analysis_id"] == analysis_job["analysis_id"]
    assert workspace["default_primary_view"] == "storylines"

    stored_task = store.load_task(task["task_id"])
    assert stored_task is not None
    assert stored_task["status"] == "可查看"
    assert stored_task["result_manifest_uri"] == str(store.manifest_path(task["task_id"]))
    assert store.load_status(task["task_id"])["status"] == "可查看"
    assert store.load_manifest(task["task_id"]) == manifest
    assert store.load_normalized_batch(batch["dataset_id"]) == batch
    assert store.load_analysis_job(analysis_job["analysis_id"]) == analysis_job
    assert store.load_workspace_session(workspace_id) == workspace


def test_manifest_bridge_is_idempotent_for_the_same_task(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path)
    pipeline = IngestPipeline(store)

    manifest = make_manifest("task_ai_bili_002")
    pipeline.create_crawl_task(make_request_for(manifest["task_id"]))
    first = pipeline.bridge_manifest_to_workspace(
        manifest,
        normalized_comment_count=12,
        language="zh-CN",
    )
    second = pipeline.bridge_manifest_to_workspace(
        manifest,
        normalized_comment_count=12,
        language="zh-CN",
    )

    assert first["manifest"] == second["manifest"]
    assert first["normalized_batch"] == second["normalized_batch"]
    assert first["analysis_job"] == second["analysis_job"]
    assert first["workspace_session"] == second["workspace_session"]


def test_failed_task_status_is_persisted(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path)
    pipeline = IngestPipeline(store)

    task = pipeline.create_crawl_task(make_request())
    failed = pipeline.set_task_status(
        task["task_id"],
        status="失败",
        progress_percent=30,
        current_stage="抓取中",
        current_platform="bili",
        error_code="crawl_timeout",
        error_message="crawler timed out",
        latest_message="crawler failed",
    )

    assert failed["status"] == "失败"
    status = pipeline.get_crawl_task_status(task["task_id"])
    assert status["error_code"] == "crawl_timeout"
    assert status["error_message"] == "crawler timed out"


def test_empty_manifest_still_materializes_a_workspace(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path)
    pipeline = IngestPipeline(store)

    task = pipeline.create_crawl_task(make_request())
    manifest = make_manifest(task["task_id"])
    manifest["raw_record_count"] = 0
    manifest["output_files"] = []

    result = pipeline.bridge_manifest_to_workspace(
        manifest,
        normalized_comment_count=0,
        platform_breakdown={},
        language="undetermined",
    )

    assert result["manifest"]["raw_record_count"] == 0
    assert result["normalized_batch"]["comment_count"] == 0
    assert result["analysis_job"]["status"] == "可查看"
    assert result["workspace_session"]["analysis_id"] == result["analysis_job"]["analysis_id"]


def test_manifest_bridge_auto_seeds_missing_task(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path)
    pipeline = IngestPipeline(store)

    manifest = make_manifest("task_ai_bili_003")
    result = pipeline.bridge_manifest_to_workspace(
        manifest,
        normalized_comment_count=12,
        language="zh-CN",
    )

    seeded_task = store.load_task(manifest["task_id"])
    assert seeded_task is not None
    assert seeded_task["status"] == "可查看"
    assert result["manifest"]["task_id"] == manifest["task_id"]
    assert result["workspace_session"]["analysis_id"] == result["analysis_job"]["analysis_id"]
