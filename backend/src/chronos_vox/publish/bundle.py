"""Publish helpers for shaping analysis-state-like objects into forecast bundles."""

from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Any, Iterable, Mapping

from ..contracts.models import ForecastModelId
from ..forecast.adapters import HEAT_INDEX_FORMULA
from ..storylines.baseline import build_storyline_consumption_shape
from ..viewpoints.baseline import build_viewpoint_consumption_shape


def _as_list(value: object) -> list[dict[str, Any]]:
    if not value:
        return []
    if isinstance(value, list):
        return [dict(item) for item in value]
    return [dict(item) for item in value]  # type: ignore[arg-type]


def _copy_points(points: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(point) for point in points]


def _available_models() -> list[dict[str, Any]]:
    return [
        {
            "id": "bass_diffusion",
            "label": "Bass Diffusion",
            "category": "diffusion",
            "description": "Diffusion-oriented model.",
        },
        {
            "id": "gompertz",
            "label": "Gompertz",
            "category": "saturation",
            "description": "Saturation-oriented model.",
        },
    ]


def _index_by_id(items: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    return {item[key]: item for item in items}


def _storyline_to_viewpoint_ids(state_like: Mapping[str, Any]) -> dict[str, list[str]]:
    memberships = sorted(
        _as_list(state_like.get("storyline_memberships")),
        key=lambda item: (
            item.get("storyline_id", ""),
            item.get("start_bucket_index", 0),
            item.get("viewpoint_id", ""),
            item.get("membership_id", ""),
        ),
    )
    grouped: dict[str, list[str]] = defaultdict(list)
    for membership in memberships:
        grouped[membership["storyline_id"]].append(membership["viewpoint_id"])
    return dict(grouped)


def _viewpoint_to_storyline_id(state_like: Mapping[str, Any]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for storyline_id, viewpoint_ids in _storyline_to_viewpoint_ids(state_like).items():
        for viewpoint_id in viewpoint_ids:
            mapping[viewpoint_id] = storyline_id
    return mapping


def _traceability(state_like: Mapping[str, Any]) -> list[dict[str, Any]]:
    viewpoints = _index_by_id(_as_list(state_like.get("viewpoints")), "viewpoint_id")
    traceability: list[dict[str, Any]] = []
    for storyline_id, viewpoint_ids in _storyline_to_viewpoint_ids(state_like).items():
        claim_ids: list[str] = []
        comment_ids: list[str] = []
        for viewpoint_id in viewpoint_ids:
            viewpoint = viewpoints.get(viewpoint_id)
            if viewpoint is None:
                continue
            claim_ids.extend(viewpoint.get("claim_ids", []))
            comment_ids.extend(viewpoint.get("comment_ids", []))
        traceability.append(
            {
                "storyline_id": storyline_id,
                "viewpoint_ids": viewpoint_ids,
                "claim_ids": list(dict.fromkeys(claim_ids)),
                "comment_ids": list(dict.fromkeys(comment_ids)),
            }
        )
    return traceability


def _model_reasoning(state_like: Mapping[str, Any]) -> list[dict[str, Any]]:
    storylines = sorted(
        _as_list(state_like.get("storylines")),
        key=lambda item: (item.get("display_rank", 0), item.get("storyline_id", "")),
    )
    reasoning: list[dict[str, Any]] = []
    for storyline in storylines:
        model_id = "bass_diffusion" if storyline.get("logic_status") == "stable" else "gompertz"
        if model_id == "bass_diffusion":
            assumptions = ["adoption feedback remains positive", "integration signals keep spreading"]
            comparison = "Bass remains more optimistic than Gompertz on momentum."
        else:
            assumptions = ["friction remains present", "evidence volume is thin"]
            comparison = "Gompertz is more conservative than Bass on growth."
        reasoning.append(
            {
                "storyline_id": storyline["storyline_id"],
                "model_id": model_id,
                "assumptions": assumptions,
                "explanation": storyline.get("summary", ""),
                "confidence_note": "Confidence is moderate and declines across forecast buckets.",
                "comparison_summary": comparison,
            }
        )
    return reasoning


def _particle_field(state_like: Mapping[str, Any]) -> dict[str, list[dict[str, Any]]]:
    comments = _index_by_id(_as_list(state_like.get("normalized_comments")), "comment_id")
    claims = sorted(_as_list(state_like.get("claims")), key=lambda item: item.get("claim_id", ""))
    viewpoints = _index_by_id(_as_list(state_like.get("viewpoints")), "viewpoint_id")
    storyline_lookup = _viewpoint_to_storyline_id(state_like)
    snapshots = _as_list(state_like.get("storyline_snapshots"))

    particles: list[dict[str, Any]] = []
    for claim in claims:
        viewpoint_id = next(
            (
                viewpoint["viewpoint_id"]
                for viewpoint in viewpoints.values()
                if claim["claim_id"] in viewpoint.get("claim_ids", [])
            ),
            None,
        )
        if viewpoint_id is None:
            continue
        storyline_id = storyline_lookup.get(viewpoint_id)
        if storyline_id is None:
            continue
        comment = comments.get(claim["comment_id"], {})
        matched_snapshot_index = next(
            (
                snapshot["bucket_index"]
                for snapshot in snapshots
                if snapshot.get("storyline_id") == storyline_id
                and viewpoint_id in snapshot.get("viewpoint_ids", [])
            ),
            0,
        )
        particles.append(
            {
                "particle_id": f"particle_{claim['claim_id']}",
                "storyline_id": storyline_id,
                "viewpoint_id": viewpoint_id,
                "claim_id": claim["claim_id"],
                "comment_id": claim["comment_id"],
                "bucket_index": matched_snapshot_index,
                "bucket_start": comment.get("created_at", "")[:10],
                "signal_strength": float(claim.get("signal_strength", 0.0)),
                "excerpt": comment.get("canonical_text", claim.get("evidence_text", "")),
            }
        )

    particles_by_storyline: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for particle in particles:
        particles_by_storyline[particle["storyline_id"]].append(particle)

    evidence_clusters: list[dict[str, Any]] = []
    storylines = sorted(
        _as_list(state_like.get("storylines")),
        key=lambda item: (item.get("display_rank", 0), item.get("storyline_id", "")),
    )
    for storyline in storylines:
        storyline_id = storyline["storyline_id"]
        storyline_snapshots = [
            snapshot
            for snapshot in snapshots
            if snapshot.get("storyline_id") == storyline_id and snapshot.get("viewpoint_ids")
        ]
        if not storyline_snapshots:
            continue
        snapshot = max(storyline_snapshots, key=lambda item: item.get("bucket_index", 0))
        viewpoint_ids = list(snapshot.get("viewpoint_ids", []))
        comment_ids = sorted(
            {
                particle["comment_id"]
                for particle in particles_by_storyline.get(storyline_id, [])
                if particle["viewpoint_id"] in viewpoint_ids
            }
        )
        if not comment_ids:
            continue
        representative_comment_id = next(
            (
                particle["comment_id"]
                for particle in particles_by_storyline.get(storyline_id, [])
                if particle["viewpoint_id"] in viewpoint_ids
            ),
            comment_ids[0],
        )
        viewpoint = viewpoints.get(viewpoint_ids[0], {})
        evidence_clusters.append(
            {
                "cluster_id": f"cluster_{storyline_id}_{snapshot['bucket_index']}",
                "storyline_id": storyline_id,
                "viewpoint_id": viewpoint_ids[0],
                "bucket_index": snapshot["bucket_index"],
                "bucket_start": snapshot["bucket_start"],
                "label": f"{viewpoint.get('viewpoint_label', 'evidence')} / evidence cluster",
                "comment_ids": comment_ids,
                "representative_comment_id": representative_comment_id,
            }
        )

    return {"particles": particles, "evidence_clusters": evidence_clusters}


def _analysis_window(state_like: Mapping[str, Any]) -> tuple[str, str]:
    snapshots = _as_list(state_like.get("storyline_snapshots"))
    if snapshots:
        starts = sorted(snapshot.get("bucket_start", "") for snapshot in snapshots if snapshot.get("bucket_start"))
        if starts:
            return starts[0], starts[-1]
    comments = _as_list(state_like.get("normalized_comments"))
    if comments:
        starts = sorted(comment.get("created_at", "")[:10] for comment in comments if comment.get("created_at"))
        if starts:
            return starts[0], starts[-1]
    return "", "" 


def _source_platforms(state_like: Mapping[str, Any]) -> list[str]:
    platforms = {comment.get("platform", "") for comment in _as_list(state_like.get("raw_comments"))}
    return sorted(platform for platform in platforms if platform)


def _default_case_title(state_like: Mapping[str, Any]) -> str:
    case_id = str(state_like.get("case_id", "case"))
    return case_id.replace("_", " ").title()


def _bundle_meta(
    state_like: Mapping[str, Any],
    *,
    fixture_id: str | None,
    default_model_id: ForecastModelId,
) -> dict[str, Any]:
    analysis_start, analysis_end = _analysis_window(state_like)
    return {
        "case_id": state_like.get("case_id", ""),
        "case_title": _default_case_title(state_like),
        "topic_tag": next(
            (
                storyline.get("topic_tag", "")
                for storyline in _as_list(state_like.get("storylines"))
                if storyline.get("topic_tag")
            ),
            state_like.get("case_id", ""),
        ),
        "contract_version": state_like.get("contract_version", "2026-03-24.v1"),
        "fixture_id": fixture_id or f"analysis-{state_like.get('case_id', 'case')}-published-v1",
        "generated_at": state_like.get("generated_at", ""),
        "bucket_granularity": state_like.get("bucket_granularity", "day"),
        "analysis_window_start": analysis_start,
        "analysis_window_end": analysis_end,
        "source_platforms": _source_platforms(state_like),
        "default_model_id": default_model_id,
        "available_models": _available_models(),
    }


def build_forecast_bundle(
    analysis_state_like: Mapping[str, Any],
    *,
    fixture_id: str | None = None,
    default_model_id: ForecastModelId = "bass_diffusion",
) -> dict[str, Any]:
    """Shape an analysis-state-like object into a ForecastBundle-like mapping."""

    state_like = deepcopy(dict(analysis_state_like))
    viewpoint_shape = build_viewpoint_consumption_shape(state_like)
    storyline_shape = build_storyline_consumption_shape(state_like)
    forecast_series = [
        dict(series)
        for series in sorted(
            _as_list(state_like.get("storyline_forecasts")),
            key=lambda item: (item.get("storyline_id", ""), item.get("model_id", "")),
        )
    ]
    return {
        "meta": _bundle_meta(state_like, fixture_id=fixture_id, default_model_id=default_model_id),
        "stream": {
            "storylines": storyline_shape["storylines"],
            "storyline_snapshots": storyline_shape["storyline_snapshots"],
            "forecast_series": [
                {
                    **series,
                    "historical_points": _copy_points(series.get("historical_points", [])),
                    "forecast_points": _copy_points(series.get("forecast_points", [])),
                }
                for series in forecast_series
            ],
        },
        "neural_map": {
            "viewpoints": viewpoint_shape["viewpoints"],
            "viewpoint_snapshots": viewpoint_shape["viewpoint_snapshots"],
            "viewpoint_relations": viewpoint_shape["viewpoint_relations"],
            "storyline_relations": storyline_shape["storyline_relations"],
        },
        "particle_field": _particle_field(state_like),
        "reasoning": {
            "heat_index_formula": dict(HEAT_INDEX_FORMULA),
            "model_reasoning": _model_reasoning(state_like),
            "traceability": _traceability(state_like),
        },
    }
