"""Deterministic pipeline from RawComment-shaped dicts to NormalizedComment dicts."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from chronos_vox.contracts.models import NormalizedComment, RawComment

from .baseline import (
    build_comment_id,
    build_dedupe_key,
    build_topic_tags,
    map_source_class,
    quality_score,
)
from .text import (
    canonicalize_text,
    detect_language,
    has_url,
    looks_like_boilerplate,
    normalize_text,
    repeated_character_run,
    symbol_ratio,
)

NORMALIZER_VERSION = "deterministic-v1"


def _coerce_raw_comment(raw_comment: Mapping[str, object]) -> RawComment:
    required_fields = (
        "raw_comment_id",
        "platform",
        "source_item_id",
        "source_comment_id",
        "text",
        "created_at",
        "collected_at",
        "engagement",
        "metadata",
    )
    missing = [field for field in required_fields if field not in raw_comment]
    if missing:
        raise ValueError(f"raw_comment is missing required fields: {', '.join(missing)}")
    return raw_comment  # type: ignore[return-value]


def build_noise_flags(canonical_text: object, normalized_text: object) -> list[str]:
    flags: list[str] = []
    canonical = canonicalize_text(canonical_text)
    normalized = canonicalize_text(normalized_text)

    if not canonical or not normalized:
        flags.append("empty")
    if len(normalized) < 6:
        flags.append("too_short")
    if has_url(canonical):
        flags.append("contains_url")
    if repeated_character_run(canonical):
        flags.append("repeated_characters")
    if symbol_ratio(canonical) > 0.35:
        flags.append("high_symbol_ratio")
    if looks_like_boilerplate(canonical):
        flags.append("boilerplate")

    ordered_flags: list[str] = []
    for flag in flags:
        if flag not in ordered_flags:
            ordered_flags.append(flag)
    return ordered_flags


def normalize_raw_comment(raw_comment: Mapping[str, object]) -> NormalizedComment:
    """Normalize a raw comment-shaped mapping into the frozen contract shape."""

    raw = _coerce_raw_comment(raw_comment)
    canonical_text = canonicalize_text(raw["text"])
    normalized_text = normalize_text(canonical_text)
    noise_flags = build_noise_flags(canonical_text, normalized_text)
    topic_tags = build_topic_tags(raw, canonical_text, normalized_text)
    source_class = map_source_class(raw, canonical_text, normalized_text)
    quality = quality_score(raw, canonical_text, normalized_text, source_class, topic_tags, noise_flags)

    metadata: dict[str, Any] = dict(raw.get("metadata", {}))
    metadata["normalizer_version"] = NORMALIZER_VERSION

    return {
        "comment_id": build_comment_id(raw["raw_comment_id"]),
        "raw_comment_id": canonicalize_text(raw["raw_comment_id"]),
        "platform": raw["platform"],
        "source_item_id": canonicalize_text(raw["source_item_id"]),
        "source_comment_id": canonicalize_text(raw["source_comment_id"]),
        "canonical_text": canonical_text,
        "normalized_text": normalized_text,
        "language": detect_language(canonical_text),
        "source_class": source_class,
        "quality_score": quality,
        "noise_flags": noise_flags,
        "dedupe_key": build_dedupe_key(raw, topic_tags, normalized_text),
        "created_at": canonicalize_text(raw["created_at"]),
        "collected_at": canonicalize_text(raw["collected_at"]),
        "topic_tags": topic_tags,
        "metadata": metadata,
    }


def normalize_raw_comments(raw_comments: Iterable[Mapping[str, object]]) -> list[NormalizedComment]:
    """Normalize a batch of raw comments in input order."""

    return [normalize_raw_comment(raw_comment) for raw_comment in raw_comments]
