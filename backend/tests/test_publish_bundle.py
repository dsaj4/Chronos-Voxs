from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.publish import build_forecast_bundle


FIXTURES = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


def load_fixture(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_publish_bundle_matches_basic_frozen_shape() -> None:
    analysis_state = load_fixture("golden-analysis-state.ai-agent-practicalization.json")
    original = deepcopy(analysis_state)

    bundle = build_forecast_bundle(
        analysis_state,
        fixture_id="golden-ai-agent-practicalization-v1",
        default_model_id="bass_diffusion",
    )

    assert analysis_state == original
    assert set(bundle.keys()) == {"meta", "stream", "neural_map", "particle_field", "reasoning"}
    assert set(bundle["stream"].keys()) == {"storylines", "storyline_snapshots", "forecast_series"}
    assert set(bundle["neural_map"].keys()) == {
        "viewpoints",
        "viewpoint_snapshots",
        "viewpoint_relations",
        "storyline_relations",
    }
    assert set(bundle["particle_field"].keys()) == {"particles", "evidence_clusters"}
    assert set(bundle["reasoning"].keys()) == {"heat_index_formula", "model_reasoning", "traceability"}

    assert bundle["meta"]["contract_version"] == "2026-03-24.v1"
    assert bundle["meta"]["fixture_id"] == "golden-ai-agent-practicalization-v1"
    assert bundle["reasoning"]["heat_index_formula"]["weights"] == {
        "volume_component": 0.45,
        "support_component": 0.25,
        "source_quality_component": 0.2,
        "recency_component": 0.1,
    }

    assert len(bundle["stream"]["storylines"]) == 2
    assert len(bundle["stream"]["storyline_snapshots"]) == 5
    assert len(bundle["stream"]["forecast_series"]) == 4
    assert len(bundle["neural_map"]["viewpoints"]) == 2
    assert len(bundle["particle_field"]["particles"]) == 3
    assert len(bundle["reasoning"]["traceability"]) == 2


def test_published_forecast_series_keep_historical_points_unchanged() -> None:
    analysis_state = load_fixture("golden-analysis-state.ai-agent-practicalization.json")
    bundle = build_forecast_bundle(analysis_state, fixture_id="golden-ai-agent-practicalization-v1")

    published_series = bundle["stream"]["forecast_series"]
    original_series = analysis_state["storyline_forecasts"]

    assert len(published_series) == len(original_series)
    for published, original in zip(published_series, original_series, strict=True):
        assert published["historical_points"] == original["historical_points"]
        assert published["forecast_points"] == original["forecast_points"]
        assert published["historical_points"] is not original["historical_points"]
