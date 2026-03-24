"""Deterministic viewpoint grouping logic."""

from .baseline import (
    build_viewpoint_consumption_shape,
    group_viewpoint_relations_by_source_id,
    group_viewpoint_snapshots_by_viewpoint_id,
    group_viewpoints_by_topic_tag,
    index_viewpoints_by_id,
    sort_viewpoints,
)

__all__ = [
    "build_viewpoint_consumption_shape",
    "group_viewpoint_relations_by_source_id",
    "group_viewpoint_snapshots_by_viewpoint_id",
    "group_viewpoints_by_topic_tag",
    "index_viewpoints_by_id",
    "sort_viewpoints",
]
