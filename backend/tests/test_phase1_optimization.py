from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.optimization import (  # noqa: E402
    OptimizationConfig,
    assemble_analysis_state,
    build_synthetic_raw_comments,
    diagnose_bundle,
    run_phase1_optimization,
)
from chronos_vox.publish import build_forecast_bundle  # noqa: E402


FIXTURES = ROOT.parent / "shared" / "fixtures"
SCHEMAS = ROOT.parent / "shared" / "schemas"


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate(schema_name: str, payload: dict[str, object]) -> list[str]:
    schema = load_json(SCHEMAS / schema_name)
    validator = Draft202012Validator(schema)
    return [
        f"{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
        for error in sorted(validator.iter_errors(payload), key=lambda error: list(error.absolute_path))
    ]


def test_synthetic_comment_generation_is_stable_and_spans_five_daily_buckets() -> None:
    config = OptimizationConfig()
    first = build_synthetic_raw_comments(config)
    second = build_synthetic_raw_comments(config)

    assert first == second
    assert len(first) == 26
    assert {comment["metadata"]["synthetic_bucket_index"] for comment in first} == {0, 1, 2, 3, 4}


def test_deterministic_phase1_bundle_is_schema_valid_and_diagnostic_green() -> None:
    config = OptimizationConfig()
    raw_comments = build_synthetic_raw_comments(config)

    analysis_state = assemble_analysis_state(config=config, raw_comments=raw_comments)
    bundle = build_forecast_bundle(analysis_state, fixture_id="phase1-simulated-det-v1")
    diagnostics = diagnose_bundle(
        track_id="deterministic",
        config=config,
        analysis_state=analysis_state,
        bundle=bundle,
    )

    assert validate("analysis-state.schema.json", analysis_state) == []
    assert validate("forecast-bundle.schema.json", bundle) == []
    assert diagnostics.status == "passed"
    assert diagnostics.structure_passed is True
    assert diagnostics.readability_passed is True
    assert diagnostics.frontend_passed is True


def test_phase1_optimization_reports_blocked_without_llm_provider() -> None:
    result = run_phase1_optimization(config=OptimizationConfig())

    assert result.status == "blocked"
    assert result.track_results[0].track_id == "deterministic"
    assert result.track_results[0].status == "passed"
    assert result.track_results[1].track_id == "llm"
    assert result.track_results[1].status == "blocked"
    assert result.track_results[1].blocked_reason


def test_publish_bundle_covers_every_forecast_pair_and_particle_bucket() -> None:
    analysis_state = load_json(FIXTURES / "golden-analysis-state.ai-agent-practicalization.json")
    bundle = build_forecast_bundle(
        analysis_state,
        fixture_id="golden-ai-agent-practicalization-v1",
        default_model_id="bass_diffusion",
    )

    forecast_pairs = {
        (series["storyline_id"], series["model_id"])
        for series in bundle["stream"]["forecast_series"]
    }
    reasoning_pairs = {
        (reasoning["storyline_id"], reasoning["model_id"])
        for reasoning in bundle["reasoning"]["model_reasoning"]
    }
    particle_bucket_pairs = {
        (particle["storyline_id"], particle["bucket_index"])
        for particle in bundle["particle_field"]["particles"]
    }
    cluster_bucket_pairs = {
        (cluster["storyline_id"], cluster["bucket_index"])
        for cluster in bundle["particle_field"]["evidence_clusters"]
    }

    assert bundle["meta"]["case_title"] == "AI Agent Practicalization"
    assert reasoning_pairs == forecast_pairs
    assert particle_bucket_pairs.issubset(cluster_bucket_pairs)
    assert all(
        cluster["representative_comment_id"] in cluster["comment_ids"]
        for cluster in bundle["particle_field"]["evidence_clusters"]
    )
    assert all(
        "evidence cluster" not in cluster["label"].lower()
        for cluster in bundle["particle_field"]["evidence_clusters"]
    )
