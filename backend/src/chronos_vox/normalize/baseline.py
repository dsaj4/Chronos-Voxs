"""Deterministic baselines for source-class, dedupe, and scoring."""

from __future__ import annotations

from collections.abc import Mapping
from hashlib import sha256
import math
import re

from chronos_vox.contracts.models import SourceClass

from .text import canonicalize_text, has_url, looks_like_boilerplate, repeated_character_run, symbol_ratio, tokenize

SOURCE_CLASS_KEYWORDS: tuple[tuple[SourceClass, tuple[str, ...]], ...] = (
    (
        "practitioner",
        (
            "ops",
            "builder",
            "engineer",
            "dev",
            "infra",
            "crm",
            "workshop",
            "product",
            "implementation",
            "deploy",
            "watch",
            "ops_",
        ),
    ),
    (
        "vendor",
        (
            "vendor",
            "official",
            "store",
            "sale",
            "support",
            "account",
            "brand",
            "service",
        ),
    ),
    (
        "media",
        (
            "media",
            "news",
            "report",
            "journal",
            "review",
            "analyst",
        ),
    ),
    (
        "consumer",
        (
            "user",
            "consumer",
            "buyer",
            "fan",
            "student",
            "customer",
            "experience",
            "feedback",
        ),
    ),
)

SOURCE_CLASS_TEXT_HINTS: tuple[tuple[SourceClass, tuple[str, ...]], ...] = (
    ("practitioner", ("落地", "流程", "工单", "系统", "部署", "维护", "提效", "自动化", "半自动化", "crm")),
    ("vendor", ("官方", "产品", "购买", "套餐", "报价", "客服", "售后")),
    ("media", ("报道", "观察", "评测", "分析", "新闻")),
    ("consumer", ("体验", "好用", "不好用", "买了", "用了", "感觉", "我觉得")),
)

TAG_KEYWORDS: dict[str, tuple[str, ...]] = {
    "ai_agent_practicalization": (
        "ai agent",
        "agent",
        "智能体",
        "自动化代理",
        "video_agent",
        "agent_",
    ),
    "workflow_automation": (
        "重复流程",
        "半自动化",
        "自动化",
        "工作流",
        "流程",
    ),
    "system_integration": (
        "crm",
        "工单",
        "系统",
        "接入",
        "打通",
        "integration",
        "api",
        "webhook",
    ),
    "cost_operations": (
        "成本",
        "部署",
        "维护",
        "运维",
        "算力",
        "预算",
        "费用",
    ),
}


def _slugify(value: object) -> str:
    cleaned = canonicalize_text(value).lower()
    cleaned = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "item"


def _short_hash(*parts: object, length: int = 8) -> str:
    payload = "|".join(canonicalize_text(part).lower() for part in parts)
    digest = sha256(payload.encode("utf-8")).hexdigest()
    return digest[:length]


def build_comment_id(raw_comment_id: object) -> str:
    raw_value = canonicalize_text(raw_comment_id)
    match = re.search(r"(\d+)$", raw_value)
    if match:
        return f"norm_{match.group(1)}"
    return f"norm_{_short_hash(raw_value, length=6)}"


def build_topic_tags(raw_comment: Mapping[str, object], canonical_text: object, normalized_text: object) -> list[str]:
    tags: list[str] = []
    raw_blob = " ".join(
        canonicalize_text(raw_comment.get(field, ""))
        for field in ("raw_comment_id", "source_item_id", "source_comment_id", "author_handle")
    )
    metadata = raw_comment.get("metadata")
    if isinstance(metadata, Mapping):
        raw_blob = f"{raw_blob} {canonicalize_text(metadata.get('source_url', ''))}"
    lowered_blob = raw_blob.lower()
    combined_text = f"{canonicalize_text(canonical_text)} {canonicalize_text(normalized_text)}".lower()

    if any(token in lowered_blob for token in ("agent", "ai_agent", "video_agent", "智能体")) or any(
        token in combined_text for token in ("agent", "ai agent", "智能体")
    ):
        tags.append("ai_agent_practicalization")

    for tag, keywords in TAG_KEYWORDS.items():
        if tag == "ai_agent_practicalization":
            continue
        if any(keyword.lower() in combined_text for keyword in keywords):
            tags.append(tag)

    if not tags:
        tags.append("other")

    return tags


def map_source_class(raw_comment: Mapping[str, object], canonical_text: object, normalized_text: object) -> SourceClass:
    author_handle = canonicalize_text(raw_comment.get("author_handle", "")).lower()
    source_blob = " ".join(
        [
            author_handle,
            canonicalize_text(raw_comment.get("source_item_id", "")).lower(),
            canonicalize_text(raw_comment.get("source_comment_id", "")).lower(),
        ]
    )
    metadata = raw_comment.get("metadata")
    if isinstance(metadata, Mapping):
        source_blob = f"{source_blob} {canonicalize_text(metadata.get('source_url', '')).lower()}"

    text_blob = f"{canonicalize_text(canonical_text).lower()} {canonicalize_text(normalized_text).lower()}"

    scores: dict[SourceClass, int] = {"practitioner": 0, "vendor": 0, "media": 0, "consumer": 0, "unknown": 0}
    for source_class, keywords in SOURCE_CLASS_KEYWORDS:
        scores[source_class] += sum(2 for keyword in keywords if keyword in source_blob)
    for source_class, keywords in SOURCE_CLASS_TEXT_HINTS:
        scores[source_class] += sum(1 for keyword in keywords if keyword in text_blob)

    if "official" in source_blob or "brand" in source_blob:
        scores["vendor"] += 2
    if "report" in source_blob or "news" in source_blob:
        scores["media"] += 2
    if "experience" in source_blob or "feedback" in source_blob:
        scores["consumer"] += 1

    best_class = max(scores.items(), key=lambda item: (item[1], item[0] == "practitioner", item[0]))[0]
    if scores[best_class] == 0:
        return "unknown"
    return best_class


def build_dedupe_key(raw_comment: Mapping[str, object], topic_tags: list[str], normalized_text: object) -> str:
    raw_comment_id = canonicalize_text(raw_comment.get("raw_comment_id", ""))
    suffix_match = re.search(r"(\d+)$", raw_comment_id)
    suffix = suffix_match.group(1) if suffix_match else _short_hash(raw_comment_id, normalized_text, length=6)

    anchor = topic_tags[0] if topic_tags else _slugify(raw_comment.get("source_item_id", "item"))
    if anchor == "ai_agent_practicalization":
        return f"dup_ai_agent_{suffix}"
    return f"dup_{_slugify(anchor)}_{suffix}"


def quality_score(
    raw_comment: Mapping[str, object],
    canonical_text: object,
    normalized_text: object,
    source_class: SourceClass,
    topic_tags: list[str],
    noise_flags: list[str],
) -> float:
    normalized = canonicalize_text(normalized_text)
    canonical = canonicalize_text(canonical_text)
    tokens = tokenize(normalized)

    engagement = raw_comment.get("engagement")
    likes = replies = shares = 0
    if isinstance(engagement, Mapping):
        likes = int(engagement.get("like_count", 0) or 0)
        replies = int(engagement.get("reply_count", 0) or 0)
        shares = int(engagement.get("share_count", 0) or 0)

    length_component = min(len(normalized) / 70.0, 1.0)
    token_component = min(len(tokens) / 18.0, 1.0)
    engagement_component = min(math.log1p(likes + (2 * replies) + (3 * shares)) / 5.0, 1.0)
    source_component = {
        "practitioner": 0.18,
        "consumer": 0.14,
        "vendor": 0.12,
        "media": 0.1,
        "unknown": 0.08,
    }[source_class]
    topic_component = min(len(topic_tags), 3) * 0.04
    coherence_component = (
        0.07
        if canonical and (any(token.isascii() for token in canonical) or any("\u4e00" <= ch <= "\u9fff" for ch in canonical))
        else 0.0
    )

    penalty = 0.0
    penalty += 0.12 * len(noise_flags)
    if has_url(canonical):
        penalty += 0.03
    if repeated_character_run(canonical):
        penalty += 0.05
    if symbol_ratio(canonical) > 0.35:
        penalty += 0.05
    if looks_like_boilerplate(canonical):
        penalty += 0.08

    score = 0.25
    score += 0.25 * length_component
    score += 0.15 * token_component
    score += 0.15 * engagement_component
    score += source_component
    score += topic_component
    score += coherence_component
    score -= penalty

    return round(max(0.0, min(score, 1.0)), 2)
