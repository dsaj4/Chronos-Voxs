"""Forecast adapters and storyline heat-index helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from math import exp
from typing import Any, Mapping, Protocol, Sequence, runtime_checkable

from ..contracts.models import ForecastModelId, ForecastPoint


HEAT_INDEX_WEIGHTS = {
    "volume_component": 0.45,
    "support_component": 0.25,
    "source_quality_component": 0.20,
    "recency_component": 0.10,
}

HEAT_INDEX_FORMULA = {
    "version": "2026-03-24.v1",
    "target_metric": "storylineHeatIndex",
    "weights": dict(HEAT_INDEX_WEIGHTS),
    "description": (
        "storylineHeatIndex is a normalized 0-100 score derived from volume, "
        "support strength, source quality, and recency."
    ),
}


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def storyline_heat_index(
    volume_component: float,
    support_component: float,
    source_quality_component: float,
    recency_component: float,
    *,
    precision: int = 2,
) -> float:
    score = 100.0 * (
        HEAT_INDEX_WEIGHTS["volume_component"] * volume_component
        + HEAT_INDEX_WEIGHTS["support_component"] * support_component
        + HEAT_INDEX_WEIGHTS["source_quality_component"] * source_quality_component
        + HEAT_INDEX_WEIGHTS["recency_component"] * recency_component
    )
    return round(clamp(score), precision)


def _parse_bucket_start_datetime(bucket_start: str) -> datetime:
    if "T" in bucket_start:
        return datetime.fromisoformat(bucket_start)
    return datetime.fromisoformat(f"{bucket_start}T00:00:00")


def _parse_bucket_start_date(bucket_start: str) -> date:
    if "T" in bucket_start:
        return _parse_bucket_start_datetime(bucket_start).date()
    return date.fromisoformat(bucket_start)


def bucket_start_after(bucket_start: str, bucket_granularity: str, step_count: int) -> str:
    if bucket_granularity == "hour":
        stamp = _parse_bucket_start_datetime(bucket_start)
        return (stamp + timedelta(hours=step_count)).replace(microsecond=0).isoformat()
    parsed_date = _parse_bucket_start_date(bucket_start)
    if bucket_granularity == "week":
        return (parsed_date + timedelta(days=7 * step_count)).isoformat()
    return (parsed_date + timedelta(days=step_count)).isoformat()


def _average_positive_delta(values: Sequence[float]) -> float:
    deltas = [current - previous for previous, current in zip(values, values[1:])]
    positives = [delta for delta in deltas if delta > 0]
    if not positives:
        return 0.0
    return sum(positives) / len(positives)


def _copy_points(points: Sequence[ForecastPoint]) -> list[ForecastPoint]:
    return [dict(point) for point in points]


@runtime_checkable
class ForecastAdapter(Protocol):
    model_id: ForecastModelId
    model_label: str

    def fit(self, historical_points: Sequence[ForecastPoint]) -> dict[str, Any]:
        ...

    def forecast(self, fit_state: Mapping[str, Any], horizon: int) -> list[ForecastPoint]:
        ...

    def explain(self, fit_state: Mapping[str, Any], forecast_points: Sequence[ForecastPoint]) -> str:
        ...


@dataclass(frozen=True)
class _ForecastFitState:
    model_id: ForecastModelId
    model_label: str
    bucket_granularity: str
    historical_points: tuple[ForecastPoint, ...]
    last_bucket_index: int
    last_bucket_start: str
    last_value: float
    trend: float
    carrying_capacity: float
    maturity: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "model_id": self.model_id,
            "model_label": self.model_label,
            "bucket_granularity": self.bucket_granularity,
            "historical_points": _copy_points(self.historical_points),
            "last_bucket_index": self.last_bucket_index,
            "last_bucket_start": self.last_bucket_start,
            "last_value": self.last_value,
            "trend": self.trend,
            "carrying_capacity": self.carrying_capacity,
            "maturity": self.maturity,
        }


class BassDiffusionAdapter:
    model_id = "bass_diffusion"
    model_label = "Bass Diffusion"

    def fit(self, historical_points: Sequence[ForecastPoint]) -> dict[str, Any]:
        points = tuple(dict(point) for point in historical_points)
        if not points:
            raise ValueError("bass diffusion requires at least one historical point")
        last = points[-1]
        values = [float(point["value"]) for point in points]
        trend = max(0.02, min(0.25, _average_positive_delta(values) / 100.0 or 0.05))
        carrying_capacity = min(100.0, max(values) + max(10.0, trend * 120.0))
        maturity = min(0.9, max(0.2, values[-1] / max(carrying_capacity, 1.0)))
        return _ForecastFitState(
            model_id=self.model_id,
            model_label=self.model_label,
            bucket_granularity=last["bucket_granularity"],
            historical_points=points,
            last_bucket_index=last["bucket_index"],
            last_bucket_start=last["bucket_start"],
            last_value=float(last["value"]),
            trend=trend,
            carrying_capacity=carrying_capacity,
            maturity=maturity,
        ).as_dict()

    def forecast(self, fit_state: Mapping[str, Any], horizon: int) -> list[ForecastPoint]:
        last_value = float(fit_state["last_value"])
        carrying_capacity = float(fit_state["carrying_capacity"])
        trend = float(fit_state["trend"])
        last_bucket_index = int(fit_state["last_bucket_index"])
        last_bucket_start = str(fit_state["last_bucket_start"])
        granularity = str(fit_state["bucket_granularity"])

        forecast_points: list[ForecastPoint] = []
        current_value = last_value
        for step in range(1, horizon + 1):
            growth = (carrying_capacity - current_value) * trend
            current_value = clamp(current_value + growth)
            forecast_points.append(
                {
                    "bucket_index": last_bucket_index + step,
                    "bucket_start": bucket_start_after(last_bucket_start, granularity, step),
                    "bucket_granularity": granularity,  # type: ignore[typeddict-item]
                    "value": round(current_value, 2),
                    "confidence_low": round(clamp(current_value - 6.0 - step), 2),
                    "confidence_high": round(clamp(current_value + 6.0 + step), 2),
                    "confidence_score": round(clamp(0.86 - 0.09 * (step - 1), 0.4, 0.86), 2),
                    "is_forecast": True,
                }
            )
        return forecast_points

    def explain(self, fit_state: Mapping[str, Any], forecast_points: Sequence[ForecastPoint]) -> str:
        trend = float(fit_state["trend"])
        capacity = float(fit_state["carrying_capacity"])
        return (
            f"Bass Diffusion projects gradual spread with trend {trend:.3f} "
            f"and carrying capacity near {capacity:.1f} across {len(forecast_points)} forecast buckets."
        )


class GompertzAdapter:
    model_id = "gompertz"
    model_label = "Gompertz"

    def fit(self, historical_points: Sequence[ForecastPoint]) -> dict[str, Any]:
        points = tuple(dict(point) for point in historical_points)
        if not points:
            raise ValueError("gompertz requires at least one historical point")
        last = points[-1]
        values = [float(point["value"]) for point in points]
        trend = max(0.015, min(0.20, (values[-1] - values[0]) / max(len(values) - 1, 1) / 120.0 or 0.03))
        carrying_capacity = min(100.0, max(values) + max(8.0, trend * 140.0))
        maturity = min(0.95, max(0.15, values[-1] / max(carrying_capacity, 1.0)))
        return _ForecastFitState(
            model_id=self.model_id,
            model_label=self.model_label,
            bucket_granularity=last["bucket_granularity"],
            historical_points=points,
            last_bucket_index=last["bucket_index"],
            last_bucket_start=last["bucket_start"],
            last_value=float(last["value"]),
            trend=trend,
            carrying_capacity=carrying_capacity,
            maturity=maturity,
        ).as_dict()

    def forecast(self, fit_state: Mapping[str, Any], horizon: int) -> list[ForecastPoint]:
        last_value = float(fit_state["last_value"])
        carrying_capacity = float(fit_state["carrying_capacity"])
        trend = float(fit_state["trend"])
        last_bucket_index = int(fit_state["last_bucket_index"])
        last_bucket_start = str(fit_state["last_bucket_start"])
        granularity = str(fit_state["bucket_granularity"])
        maturity = float(fit_state["maturity"])

        forecast_points: list[ForecastPoint] = []
        for step in range(1, horizon + 1):
            decay = exp(-trend * step)
            raw_value = carrying_capacity * exp(-decay)
            blended_value = clamp((raw_value * 0.7) + (last_value * 0.3) * (1.0 - min(0.6, maturity / 2.0)))
            forecast_points.append(
                {
                    "bucket_index": last_bucket_index + step,
                    "bucket_start": bucket_start_after(last_bucket_start, granularity, step),
                    "bucket_granularity": granularity,  # type: ignore[typeddict-item]
                    "value": round(blended_value, 2),
                    "confidence_low": round(clamp(blended_value - 5.0 - step), 2),
                    "confidence_high": round(clamp(blended_value + 5.0 + step), 2),
                    "confidence_score": round(clamp(0.84 - 0.1 * (step - 1), 0.35, 0.84), 2),
                    "is_forecast": True,
                }
            )
        return forecast_points

    def explain(self, fit_state: Mapping[str, Any], forecast_points: Sequence[ForecastPoint]) -> str:
        trend = float(fit_state["trend"])
        capacity = float(fit_state["carrying_capacity"])
        return (
            f"Gompertz projects a slower approach to saturation with trend {trend:.3f} "
            f"and carrying capacity near {capacity:.1f} across {len(forecast_points)} forecast buckets."
        )


def forecast_series_with_adapter(
    historical_points: Sequence[ForecastPoint],
    adapter: ForecastAdapter,
    horizon: int = 2,
) -> dict[str, Any]:
    """Produce forecast points without mutating the supplied historical points."""

    fit_state = adapter.fit(historical_points)
    forecast_points = adapter.forecast(fit_state, horizon)
    return {
        "historical_points": _copy_points(historical_points),
        "forecast_points": forecast_points,
        "explanation": adapter.explain(fit_state, forecast_points),
        "fit_state": fit_state,
    }
