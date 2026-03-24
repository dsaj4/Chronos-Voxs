"""Deterministic viewpoint grouping helpers.

These helpers intentionally consume already-grouped data when present.
They provide stable shapes for later workers without taking ownership of
claim extraction or semantic grouping decisions.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Mapping

from ..contracts.models import Viewpoint, ViewpointRelation, ViewpointSnapshot


def _as_list(value: object) -> list[dict[str, Any]]:
    if not value:
        return []
    if isinstance(value, list):
        return [dict(item) for item in value]
    return [dict(item) for item in value]  # type: ignore[arg-type]


def sort_viewpoints(viewpoints: list[Viewpoint] | tuple[Viewpoint, ...]) -> list[Viewpoint]:
    """Return a deterministic ordering for already-grouped viewpoints."""

    return sorted(
        (dict(viewpoint) for viewpoint in viewpoints),
        key=lambda viewpoint: (
            viewpoint.get("topic_tag", ""),
            -int(viewpoint.get("support_count", 0)),
            viewpoint.get("viewpoint_id", ""),
        ),
    )


def index_viewpoints_by_id(viewpoints: list[Viewpoint] | tuple[Viewpoint, ...]) -> dict[str, Viewpoint]:
    return {viewpoint["viewpoint_id"]: dict(viewpoint) for viewpoint in viewpoints}


def group_viewpoints_by_topic_tag(
    viewpoints: list[Viewpoint] | tuple[Viewpoint, ...],
) -> dict[str, list[Viewpoint]]:
    grouped: dict[str, list[Viewpoint]] = defaultdict(list)
    for viewpoint in sort_viewpoints(viewpoints):
        grouped[viewpoint["topic_tag"]].append(viewpoint)
    return dict(grouped)


def group_viewpoint_snapshots_by_viewpoint_id(
    snapshots: list[ViewpointSnapshot] | tuple[ViewpointSnapshot, ...],
) -> dict[str, list[ViewpointSnapshot]]:
    grouped: dict[str, list[ViewpointSnapshot]] = defaultdict(list)
    for snapshot in sorted(
        (dict(item) for item in snapshots),
        key=lambda item: (
            item.get("viewpoint_id", ""),
            item.get("bucket_index", 0),
            item.get("snapshot_id", ""),
        ),
    ):
        grouped[snapshot["viewpoint_id"]].append(snapshot)
    return dict(grouped)


def group_viewpoint_relations_by_source_id(
    relations: list[ViewpointRelation] | tuple[ViewpointRelation, ...],
) -> dict[str, list[ViewpointRelation]]:
    grouped: dict[str, list[ViewpointRelation]] = defaultdict(list)
    for relation in sorted(
        (dict(item) for item in relations),
        key=lambda item: (
            item.get("source_viewpoint_id", ""),
            item.get("target_viewpoint_id", ""),
            item.get("relation_id", ""),
        ),
    ):
        grouped[relation["source_viewpoint_id"]].append(relation)
    return dict(grouped)


def build_viewpoint_consumption_shape(state_like: Mapping[str, Any]) -> dict[str, Any]:
    """Return a stable, consumable shape for later publish helpers."""

    viewpoints = sort_viewpoints(_as_list(state_like.get("viewpoints")))
    snapshots = _as_list(state_like.get("viewpoint_snapshots"))
    relations = _as_list(state_like.get("viewpoint_relations"))

    return {
        "viewpoints": viewpoints,
        "viewpoints_by_id": index_viewpoints_by_id(viewpoints),
        "viewpoints_by_topic_tag": group_viewpoints_by_topic_tag(viewpoints),
        "viewpoint_snapshots": sorted(
            (dict(item) for item in snapshots),
            key=lambda item: (
                item.get("viewpoint_id", ""),
                item.get("bucket_index", 0),
                item.get("snapshot_id", ""),
            ),
        ),
        "viewpoint_snapshots_by_viewpoint_id": group_viewpoint_snapshots_by_viewpoint_id(snapshots),
        "viewpoint_relations": sorted(
            (dict(item) for item in relations),
            key=lambda item: (
                item.get("source_viewpoint_id", ""),
                item.get("target_viewpoint_id", ""),
                item.get("relation_id", ""),
            ),
        ),
        "viewpoint_relations_by_source_id": group_viewpoint_relations_by_source_id(relations),
    }
