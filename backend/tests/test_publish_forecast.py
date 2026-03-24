from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.forecast import (
    BassDiffusionAdapter,
    GompertzAdapter,
    bucket_start_after,
    forecast_series_with_adapter,
    storyline_heat_index,
)


FIXTURES = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


def load_fixture(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_storyline_heat_index_uses_adr_weights() -> None:
    assert storyline_heat_index(1.0, 1.0, 1.0, 1.0) == 100.0
    assert storyline_heat_index(0.0, 0.0, 0.0, 0.0) == 0.0


def test_bass_diffusion_adapter_preserves_historical_points() -> None:
    bundle = load_fixture("golden-forecast-bundle.ai-agent-practicalization.json")
    historical_points = bundle["stream"]["forecast_series"][0]["historical_points"]
    original = json.loads(json.dumps(historical_points))

    result = forecast_series_with_adapter(historical_points, BassDiffusionAdapter(), horizon=2)

    assert historical_points == original
    assert result["historical_points"] == original
    assert result["historical_points"] is not historical_points
    assert all(point["is_forecast"] for point in result["forecast_points"])
    assert result["forecast_points"][0]["bucket_index"] > historical_points[-1]["bucket_index"]


def test_gompertz_adapter_preserves_historical_points() -> None:
    bundle = load_fixture("golden-forecast-bundle.ai-agent-practicalization.json")
    historical_points = bundle["stream"]["forecast_series"][1]["historical_points"]
    original = json.loads(json.dumps(historical_points))

    result = forecast_series_with_adapter(historical_points, GompertzAdapter(), horizon=2)

    assert historical_points == original
    assert result["historical_points"] == original
    assert result["historical_points"] is not historical_points
    assert all(point["is_forecast"] for point in result["forecast_points"])
    assert result["forecast_points"][0]["bucket_index"] > historical_points[-1]["bucket_index"]


def test_hourly_bucket_start_after_preserves_datetime_precision() -> None:
    assert bucket_start_after("2026-03-24T08:00:00", "hour", 1) == "2026-03-24T09:00:00"
    assert bucket_start_after("2026-03-24T23:00:00", "hour", 2) == "2026-03-25T01:00:00"
