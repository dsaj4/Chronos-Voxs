"""Deterministic storyline grouping helpers."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Mapping

from ..contracts.models import Storyline, StorylineMembership, StorylineRelation, StorylineSnapshot


def _as_list(value: object) -> list[dict[str, Any]]:
    if not value:
        return []
    if isinstance(value, list):
        return [dict(item) for item in value]
    return [dict(item) for item in value]  # type: ignore[arg-type]


def sort_storylines(storylines: list[Storyline] | tuple[Storyline, ...]) -> list[Storyline]:
    """Return a deterministic ordering for already-grouped storylines."""

    return sorted(
        (dict(storyline) for storyline in storylines),
        key=lambda storyline: (
            int(storyline.get("display_rank", 0)),
            storyline.get("topic_tag", ""),
            storyline.get("storyline_id", ""),
        ),
    )


def index_storylines_by_id(storylines: list[Storyline] | tuple[Storyline, ...]) -> dict[str, Storyline]:
    return {storyline["storyline_id"]: dict(storyline) for storyline in storylines}


def group_storyline_memberships_by_storyline_id(
    memberships: list[StorylineMembership] | tuple[StorylineMembership, ...],
) -> dict[str, list[StorylineMembership]]:
    grouped: dict[str, list[StorylineMembership]] = defaultdict(list)
    for membership in sorted(
        (dict(item) for item in memberships),
        key=lambda item: (
            item.get("storyline_id", ""),
            item.get("start_bucket_index", 0),
            item.get("viewpoint_id", ""),
            item.get("membership_id", ""),
        ),
    ):
        grouped[membership["storyline_id"]].append(membership)
    return dict(grouped)


def group_storyline_snapshots_by_storyline_id(
    snapshots: list[StorylineSnapshot] | tuple[StorylineSnapshot, ...],
) -> dict[str, list[StorylineSnapshot]]:
    grouped: dict[str, list[StorylineSnapshot]] = defaultdict(list)
    for snapshot in sorted(
        (dict(item) for item in snapshots),
        key=lambda item: (
            item.get("storyline_id", ""),
            item.get("bucket_index", 0),
            item.get("snapshot_id", ""),
        ),
    ):
        grouped[snapshot["storyline_id"]].append(snapshot)
    return dict(grouped)


def group_storyline_relations_by_source_id(
    relations: list[StorylineRelation] | tuple[StorylineRelation, ...],
) -> dict[str, list[StorylineRelation]]:
    grouped: dict[str, list[StorylineRelation]] = defaultdict(list)
    for relation in sorted(
        (dict(item) for item in relations),
        key=lambda item: (
            item.get("source_storyline_id", ""),
            item.get("target_storyline_id", ""),
            item.get("relation_id", ""),
        ),
    ):
        grouped[relation["source_storyline_id"]].append(relation)
    return dict(grouped)


def build_storyline_consumption_shape(state_like: Mapping[str, Any]) -> dict[str, Any]:
    """Return a stable, consumable shape for later publish helpers."""

    storylines = sort_storylines(_as_list(state_like.get("storylines")))
    memberships = _as_list(state_like.get("storyline_memberships"))
    snapshots = _as_list(state_like.get("storyline_snapshots"))
    relations = _as_list(state_like.get("storyline_relations"))

    return {
        "storylines": storylines,
        "storylines_by_id": index_storylines_by_id(storylines),
        "storyline_memberships": sorted(
            (dict(item) for item in memberships),
            key=lambda item: (
                item.get("storyline_id", ""),
                item.get("start_bucket_index", 0),
                item.get("viewpoint_id", ""),
                item.get("membership_id", ""),
            ),
        ),
        "storyline_memberships_by_storyline_id": group_storyline_memberships_by_storyline_id(memberships),
        "storyline_snapshots": sorted(
            (dict(item) for item in snapshots),
            key=lambda item: (
                item.get("storyline_id", ""),
                item.get("bucket_index", 0),
                item.get("snapshot_id", ""),
            ),
        ),
        "storyline_snapshots_by_storyline_id": group_storyline_snapshots_by_storyline_id(snapshots),
        "storyline_relations": sorted(
            (dict(item) for item in relations),
            key=lambda item: (
                item.get("source_storyline_id", ""),
                item.get("target_storyline_id", ""),
                item.get("relation_id", ""),
            ),
        ),
        "storyline_relations_by_source_id": group_storyline_relations_by_source_id(relations),
    }
