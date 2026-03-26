from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from chronos_vox.ingest import IngestFilesystemStore, IngestPipeline, MediaCrawlerRawRecordAdapter
from chronos_vox.ingest.service import build_analysis_id, build_workspace_id


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
FIXTURES = REPO_ROOT / "shared" / "fixtures"
SCHEMAS = REPO_ROOT / "shared" / "schemas"


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_json(schema_name: str, payload: object) -> None:
    schema = load_json(SCHEMAS / schema_name)
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.absolute_path))
    assert not errors, "\n".join(
        f"{schema_name} validation error at {'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
        for error in errors
    )


def test_mediacrawler_adapter_reads_relative_jsonl_manifest() -> None:
    adapter = MediaCrawlerRawRecordAdapter()
    manifest_path = FIXTURES / "sample-mediacrawler-manifest.ai.json"
    manifest = load_json(manifest_path)

    raw_comments = adapter.load_raw_comments(manifest, manifest_path=manifest_path)

    assert len(raw_comments) == 8
    assert raw_comments[0]["platform"] == "bilibili"
    assert raw_comments[0]["metadata"]["ingest_source"] == "mediacrawler"
    assert raw_comments[0]["metadata"]["keyword"] == "ai agent"


def test_mediacrawler_adapter_reads_bilibili_store_shape_with_content_join() -> None:
    adapter = MediaCrawlerRawRecordAdapter()
    manifest_path = FIXTURES / "sample-mediacrawler-bili-real-manifest.ai.json"
    manifest = load_json(manifest_path)

    raw_comments = adapter.load_raw_comments(manifest, manifest_path=manifest_path)

    assert len(raw_comments) == 3
    assert raw_comments[0]["platform"] == "bilibili"
    assert raw_comments[0]["source_item_id"] == "345678901"
    assert raw_comments[0]["source_comment_id"] == "9001"
    assert raw_comments[0]["text"] == "先把工单接进去，再谈全自动。"
    assert raw_comments[0]["author_handle"] == "ops_user"
    assert raw_comments[0]["collected_at"] == "2026-03-26T10:00:00+08:00"
    assert raw_comments[0]["metadata"]["item_title"] == "AI Agent 实战拆解"
    assert raw_comments[0]["metadata"]["item_url"] == "https://www.bilibili.com/video/av345678901"
    assert raw_comments[0]["metadata"]["parent_comment_id"] == "0"
    assert raw_comments[0]["metadata"]["source_keyword"] == "ai agent"


def test_manifest_bridge_materializes_real_batch_analysis_and_workspace(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path / "ingest", public_root=tmp_path / "public" / "ingest")
    pipeline = IngestPipeline(store, use_llm=False)
    manifest_path = FIXTURES / "sample-mediacrawler-manifest.ai.json"

    result = pipeline.bridge_manifest_file_to_workspace(manifest_path)

    batch = result["normalized_batch"]
    analysis_job = result["analysis_job"]
    workspace = result["workspace_session"]
    workspace_id = workspace["workspace_id"]
    analysis_id = analysis_job["analysis_id"]

    assert batch["comment_count"] == 8
    assert Path(batch["file_uri"]).exists()
    payload = load_json(Path(batch["file_uri"]))
    assert len(payload["raw_comments"]) == 8
    assert len(payload["normalized_comments"]) == 8
    assert analysis_job["status"] == "可查看"
    assert workspace["bundle_uri"] == f"/ingest/bundles/{workspace_id}.json"
    assert result["workspace_session_uri"] == f"/ingest/workspaces/{workspace_id}.json"

    analysis_state_path = store.analysis_state_path(analysis_id)
    canonical_bundle_path = store.published_bundle_path(workspace_id)
    public_bundle_path = store.public_bundle_path(workspace_id)
    public_workspace_path = store.public_workspace_session_path(workspace_id)
    assert analysis_state_path.exists()
    assert canonical_bundle_path.exists()
    assert public_bundle_path.exists()
    assert public_workspace_path.exists()

    analysis_state = load_json(analysis_state_path)
    bundle = load_json(canonical_bundle_path)
    validate_json("analysis-state.schema.json", analysis_state)
    validate_json("forecast-bundle.schema.json", bundle)

    assert analysis_state["analysis_id"] == analysis_id
    assert bundle["meta"]["case_id"] == batch["dataset_id"]
    assert bundle["stream"]["forecast_series"]
    assert bundle["reasoning"]["model_reasoning"]
    assert len(bundle["stream"]["forecast_series"]) == len(bundle["reasoning"]["model_reasoning"])
    assert all(series["historical_points"] for series in bundle["stream"]["forecast_series"])
    assert all(series["forecast_points"] for series in bundle["stream"]["forecast_series"])

    artifact = store.load_analysis_artifact(analysis_id)
    assert artifact is not None
    assert artifact["bundle_uri"] == workspace["bundle_uri"]
    assert artifact["workspace_session_uri"] == result["workspace_session_uri"]
    assert Path(artifact["analysis_state_uri"]).exists()


def test_manifest_bridge_is_idempotent_after_real_outputs_exist(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path / "ingest", public_root=tmp_path / "public" / "ingest")
    pipeline = IngestPipeline(store, use_llm=False)
    manifest_path = FIXTURES / "sample-mediacrawler-manifest.ai.json"

    first = pipeline.bridge_manifest_file_to_workspace(manifest_path)
    second = pipeline.bridge_manifest_file_to_workspace(manifest_path)

    assert first["manifest"] == second["manifest"]
    assert first["normalized_batch"] == second["normalized_batch"]
    assert first["analysis_job"] == second["analysis_job"]
    assert first["workspace_session"] == second["workspace_session"]


def test_manifest_bridge_accepts_bilibili_store_shape_fixture(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path / "ingest", public_root=tmp_path / "public" / "ingest")
    pipeline = IngestPipeline(store, use_llm=False)
    manifest_path = FIXTURES / "sample-mediacrawler-bili-real-manifest.ai.json"

    result = pipeline.bridge_manifest_file_to_workspace(manifest_path)

    batch = result["normalized_batch"]
    payload = load_json(Path(batch["file_uri"]))
    workspace_id = result["workspace_session"]["workspace_id"]
    bundle = load_json(store.published_bundle_path(workspace_id))

    assert batch["comment_count"] == 3
    assert batch["platform_breakdown"] == {"bilibili": 3}
    assert len(payload["raw_comments"]) == 3
    assert payload["raw_comments"][0]["metadata"]["item_title"] == "AI Agent 实战拆解"
    assert result["workspace_session"]["bundle_uri"].startswith("/ingest/bundles/")
    assert bundle["stream"]["forecast_series"]
    assert bundle["reasoning"]["model_reasoning"]


def test_analysis_and_workspace_ids_follow_the_existing_chain(tmp_path: Path) -> None:
    store = IngestFilesystemStore(tmp_path / "ingest", public_root=tmp_path / "public" / "ingest")
    pipeline = IngestPipeline(store, use_llm=False)
    manifest_path = FIXTURES / "sample-mediacrawler-manifest.ai.json"

    result = pipeline.bridge_manifest_file_to_workspace(manifest_path)
    dataset_id = result["normalized_batch"]["dataset_id"]
    analysis_id = build_analysis_id(dataset_id)
    workspace_id = build_workspace_id(analysis_id)

    assert result["analysis_job"]["analysis_id"] == analysis_id
    assert result["workspace_session"]["workspace_id"] == workspace_id
