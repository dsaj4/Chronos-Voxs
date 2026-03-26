"""Phase-1 synthetic analysis assembly."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping
from copy import deepcopy
from datetime import date, timedelta
import json
import math
from typing import Any
import unicodedata

from ..claims import ClaimExtractionCache, ClaimExtractionRequest, build_claim_extraction_payload, extract_claims
from ..claims.models import ClaimCandidateSpan as ExtractionClaimCandidateSpan
from ..contracts.models import Claim, ClaimCandidateSpan, ForecastPoint, NormalizedComment
from ..forecast import BassDiffusionAdapter, GompertzAdapter, forecast_series_with_adapter, storyline_heat_index
from ..normalize import normalize_raw_comments
from ..normalize.text import canonicalize_text, normalize_text, tokenize
from .models import OptimizationConfig
from .summaries import DeterministicSummaryProvider, OptimizationSummaryProvider


def _bucket_date(start_date: str, bucket_index: int) -> str:
    return (date.fromisoformat(start_date) + timedelta(days=bucket_index)).isoformat()


def _comment_bucket_index(comment: Mapping[str, Any], start_date: str) -> int:
    metadata = comment.get("metadata", {})
    if isinstance(metadata, Mapping) and metadata.get("synthetic_bucket_index") is not None:
        return max(0, int(metadata.get("synthetic_bucket_index", 0)))

    created_at = str(comment.get("created_at", "")).strip()[:10]
    if not created_at:
        return 0
    try:
        return max(0, (date.fromisoformat(created_at) - date.fromisoformat(start_date)).days)
    except ValueError:
        return 0


def _as_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _serialize_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True, default=str)


def _estimate_token_count(serialized_char_count: int) -> int:
    if serialized_char_count <= 0:
        return 0
    # Conservative heuristic for mixed Chinese prose + JSON wrappers.
    return max(1, math.ceil(serialized_char_count * 0.75))


def _normalized_alignment_view(text: str) -> tuple[str, list[int]]:
    normalized_chars: list[str] = []
    index_map: list[int] = []
    for index, ch in enumerate(unicodedata.normalize("NFKC", canonicalize_text(text))):
        category = unicodedata.category(ch)
        if category[0] in {"P", "S"} or ch.isspace():
            continue
        normalized_chars.append(ch.lower())
        index_map.append(index)
    return "".join(normalized_chars), index_map


def _align_evidence_offsets(span_text: str, claim_text: str) -> tuple[int, int]:
    canonical_span = canonicalize_text(span_text)
    canonical_claim = canonicalize_text(claim_text)
    if not canonical_span:
        return 0, 0
    if not canonical_claim:
        return 0, len(canonical_span)

    exact_index = canonical_span.find(canonical_claim)
    if exact_index >= 0:
        return exact_index, exact_index + len(canonical_claim)

    normalized_span, span_index_map = _normalized_alignment_view(canonical_span)
    normalized_claim = normalize_text(canonical_claim).replace(" ", "")
    if normalized_claim:
        normalized_index = normalized_span.find(normalized_claim)
        if normalized_index >= 0:
            start = span_index_map[normalized_index]
            end = span_index_map[normalized_index + len(normalized_claim) - 1] + 1
            return start, end

    return 0, len(canonical_span)


def _cluster_key(comment: Mapping[str, Any]) -> str | None:
    normalized_text = canonicalize_text(comment.get("normalized_text", "")).lower()
    topic_tags = set(comment.get("topic_tags", []))
    noise_flags = set(comment.get("noise_flags", []))
    has_relevant_topic = bool(
        topic_tags.intersection(
            {
                "ai_agent_practicalization",
                "system_integration",
                "cost_operations",
                "workflow_automation",
                "process_design",
            }
        )
    )

    if "too_short" in noise_flags or "boilerplate" in noise_flags:
        return None
    if not has_relevant_topic and not any(
        token in normalized_text
        for token in (
            "crm",
            "webhook",
            "api",
            "integration",
            "deploy",
            "maintenance",
            "permission",
            "log",
            "ops",
            "cost",
            "workflow",
            "sop",
        )
    ):
        return None
    if "system_integration" in topic_tags or any(
        token in normalized_text for token in ("crm", "工单", "webhook", "api", "integration", "集成", "审批流")
    ):
        return "integration_roi"
    if "cost_operations" in topic_tags or any(
        token in normalized_text
        for token in ("deploy", "maintenance", "permission", "log", "ops", "cost", "维护", "权限", "日志", "预算", "运维", "成本")
    ):
        return "deployment_friction"
    if topic_tags.intersection({"workflow_automation", "process_design"}) or any(
        token in normalized_text
        for token in ("sop", "semi", "workflow", "automation", "半自动", "流程", "自动替代", "放权")
    ):
        return "pragmatic_adoption"
    return None


def _cluster_to_storyline(cluster_key: str) -> str:
    if cluster_key == "deployment_friction":
        return "friction_storyline"
    return "adoption_storyline"


def _claim_text(cluster_key: str, evidence_text: str) -> str:
    if cluster_key == "integration_roi":
        return "当 Agent 接入 CRM、工单和 API 节点时，效率收益会更直观。"
    if cluster_key == "deployment_friction":
        return "deploy、权限与维护成本仍然是当前 Agent 扩张的主要阻力。"
    if "全自动" in evidence_text:
        return "Agent 更适合先接住半自动流程，而不是一步到位追求全自动替代。"
    return "Agent 的首个稳定价值来自重复流程的半自动接管。"


def _relation_rationale(relation_type: str) -> str:
    if relation_type == "reinforces":
        return "系统集成收益会放大务实落地路线的可信度。"
    return "部署与运维摩擦会直接压制落地扩张速度。"


def _signal_strength(comment: Mapping[str, Any]) -> float:
    base = _as_float(comment.get("quality_score", 0.0))
    bonus = 0.04 if comment.get("source_class") == "practitioner" else 0.0
    return round(min(0.99, base + bonus), 2)


def build_claim_candidate_spans(
    normalized_comments: Iterable[NormalizedComment],
    config: OptimizationConfig,
) -> list[ClaimCandidateSpan]:
    accepted_by_dedupe: dict[str, Mapping[str, Any]] = {}
    normalized_comment_list = [dict(comment) for comment in normalized_comments]

    for comment in normalized_comment_list:
        dedupe_key = str(comment["dedupe_key"])
        previous = accepted_by_dedupe.get(dedupe_key)
        if previous is None or _as_float(comment["quality_score"]) > _as_float(previous["quality_score"]):
            accepted_by_dedupe[dedupe_key] = comment

    spans: list[ClaimCandidateSpan] = []
    for comment in normalized_comment_list:
        cluster_key = _cluster_key(comment)
        if cluster_key is None:
            continue
        if accepted_by_dedupe[comment["dedupe_key"]]["comment_id"] != comment["comment_id"]:
            continue
        if _as_float(comment["quality_score"]) < config.minimum_quality_score:
            continue
        candidate_score = round(min(0.98, _as_float(comment["quality_score"]) + 0.05), 2)
        if candidate_score < config.minimum_candidate_score:
            continue
        spans.append(
            {
                "span_id": f"span_{comment['comment_id']}",
                "comment_id": comment["comment_id"],
                "text": comment["canonical_text"],
                "start_char": 0,
                "end_char": len(comment["canonical_text"]),
                "heuristic_labels": [cluster_key, "synthetic"],
                "candidate_score": candidate_score,
                "metadata": {
                    "generator": "synthetic-heuristic-v1",
                    "cluster_key": cluster_key,
                },
            }
        )
    return spans


def build_claims(
    spans: Iterable[ClaimCandidateSpan],
    normalized_by_id: Mapping[str, NormalizedComment],
    *,
    start_date: str,
) -> list[Claim]:
    claims: list[Claim] = []
    for index, span in enumerate(spans, start=1):
        comment = normalized_by_id[span["comment_id"]]
        cluster_key = str(span.get("metadata", {}).get("cluster_key", "pragmatic_adoption"))
        claims.append(
            {
                "claim_id": f"claim_{index:03d}",
                "comment_id": span["comment_id"],
                "span_id": span["span_id"],
                "text": _claim_text(cluster_key, span["text"]),
                "evidence_text": span["text"],
                "evidence_start": span["start_char"],
                "evidence_end": span["end_char"],
                "created_at": "2026-03-24T12:00:00Z",
                "extractor": {
                    "provider": "synthetic_stub",
                    "model": "deterministic-v1",
                    "prompt_version": "claims.synthetic.v1",
                    "run_id": "run_claims_synthetic_001",
                },
                "extractor_confidence": round(span["candidate_score"], 2),
                "stance": "observe" if cluster_key == "deployment_friction" else "support",
                "topic_tags": list(comment["topic_tags"]),
                "source_class": comment["source_class"],
                "signal_strength": _signal_strength(comment),
                "llm_audit_id": "audit_claims_synthetic_001",
                "metadata": {
                    "cluster_key": cluster_key,
                    "bucket_index": _comment_bucket_index(comment, start_date),
                },
            }
        )
    return claims


def _pack_claim_candidate_batches(
    spans: Iterable[ClaimCandidateSpan],
    *,
    char_limit: int,
) -> list[list[ClaimCandidateSpan]]:
    batches: list[list[ClaimCandidateSpan]] = []
    current_batch: list[ClaimCandidateSpan] = []
    current_chars = 0

    for span in spans:
        span_chars = len(
            _serialize_json(
                {
                    "span_id": span["span_id"],
                    "comment_id": span["comment_id"],
                    "text": span["text"],
                }
            )
        )
        if current_batch and current_chars + span_chars > char_limit:
            batches.append(current_batch)
            current_batch = []
            current_chars = 0
        current_batch.append(span)
        current_chars += span_chars

    if current_batch:
        batches.append(current_batch)
    return batches


def _as_extraction_span(span: ClaimCandidateSpan) -> ExtractionClaimCandidateSpan:
    return ExtractionClaimCandidateSpan(
        span_id=span["span_id"],
        comment_id=span["comment_id"],
        text=span["text"],
        start_char=int(span["start_char"]),
        end_char=int(span["end_char"]),
        heuristic_labels=tuple(span.get("heuristic_labels", [])),
        candidate_score=float(span.get("candidate_score", 0.0)),
        metadata=dict(span.get("metadata", {})),
    )


def _materialize_claims_from_extraction(
    *,
    extracted_claims: Iterable[dict[str, Any]],
    batch_spans: list[ClaimCandidateSpan],
    normalized_by_id: Mapping[str, NormalizedComment],
    provider_name: str,
    model_name: str,
    prompt_version: str,
    claim_index_start: int,
    audit_id: str | None,
    batch_index: int,
    start_date: str,
) -> list[Claim]:
    spans_by_id = {span["span_id"]: span for span in batch_spans}
    spans_by_comment_id = {span["comment_id"]: span for span in batch_spans}
    realized: list[Claim] = []

    for offset, extracted in enumerate(extracted_claims):
        selected_span = spans_by_id.get(str(extracted.get("span_id", "")).strip())
        if selected_span is None:
            selected_span = spans_by_comment_id.get(str(extracted.get("comment_id", "")).strip())
        if selected_span is None:
            selected_span = batch_spans[min(offset, len(batch_spans) - 1)]

        comment = normalized_by_id[selected_span["comment_id"]]
        cluster_key = str(selected_span.get("metadata", {}).get("cluster_key", "pragmatic_adoption"))
        claim_text = str(extracted.get("text", "")).strip() or _claim_text(cluster_key, selected_span["text"])
        evidence_start, evidence_end = _align_evidence_offsets(selected_span["text"], claim_text)
        topic_tags = [str(tag) for tag in extracted.get("topic_tags", []) if str(tag)] or list(comment["topic_tags"])
        extractor_confidence = max(0.0, min(1.0, float(extracted.get("extractor_confidence", selected_span["candidate_score"]))))
        realized.append(
            {
                "claim_id": f"claim_{claim_index_start + offset:03d}",
                "comment_id": selected_span["comment_id"],
                "span_id": selected_span["span_id"],
                "text": claim_text,
                "evidence_text": selected_span["text"],
                "evidence_start": evidence_start,
                "evidence_end": evidence_end,
                "created_at": "2026-03-24T12:00:00Z",
                "extractor": {
                    "provider": provider_name,
                    "model": model_name,
                    "prompt_version": prompt_version,
                    "run_id": f"run_claims_batch_{batch_index:03d}",
                },
                "extractor_confidence": round(extractor_confidence, 2),
                "stance": str(extracted.get("stance", "observe")),
                "topic_tags": topic_tags,
                "source_class": comment["source_class"],
                "signal_strength": round(min(0.99, (_signal_strength(comment) + extractor_confidence) / 2), 2),
                "llm_audit_id": audit_id or f"audit_claims_batch_{batch_index:03d}",
                "metadata": {
                    "cluster_key": cluster_key,
                    "bucket_index": _comment_bucket_index(comment, start_date),
                    "batch_index": batch_index,
                },
            }
        )
    return realized


def build_claims_with_optional_llm(
    *,
    spans: list[ClaimCandidateSpan],
    normalized_by_id: Mapping[str, NormalizedComment],
    config: OptimizationConfig,
    provider: OptimizationSummaryProvider,
) -> tuple[list[Claim], list[dict[str, Any]], dict[str, int]]:
    if not hasattr(provider, "extract_claims"):
        return build_claims(spans, normalized_by_id, start_date=config.start_date), [], {
            "claim_batch_count": 0,
            "claim_serialized_char_count": 0,
            "claim_estimated_input_tokens": 0,
            "claim_estimated_output_tokens": 0,
            "claim_retry_count": 0,
            "claim_fallback_batch_count": 0,
        }

    provider_name = provider.__class__.__name__
    model_name = getattr(provider, "model", "unknown")
    cache = getattr(provider, "_claim_extraction_cache", None)
    if not isinstance(cache, ClaimExtractionCache):
        cache = ClaimExtractionCache()
        setattr(provider, "_claim_extraction_cache", cache)
    all_claims: list[Claim] = []
    audit_entries: list[dict[str, Any]] = []
    metrics = {
        "claim_batch_count": 0,
        "claim_serialized_char_count": 0,
        "claim_estimated_input_tokens": 0,
        "claim_estimated_output_tokens": 0,
        "claim_retry_count": 0,
        "claim_fallback_batch_count": 0,
    }
    next_claim_index = 1
    batches = _pack_claim_candidate_batches(spans, char_limit=config.claim_batch_char_limit)
    if config.claim_cost_metrics_enabled:
        metrics["claim_batch_count"] = len(batches)

    for batch_index, batch_spans in enumerate(batches, start=1):
        request = ClaimExtractionRequest(
            spans=tuple(_as_extraction_span(span) for span in batch_spans),
            case_id=config.case_id,
            prompt_version=config.claim_prompt_version,
            provider=provider_name,
            model=model_name,
        )
        request_payload = build_claim_extraction_payload(request)
        if config.claim_cost_metrics_enabled:
            serialized_request = _serialize_json(request_payload)
            metrics["claim_serialized_char_count"] += len(serialized_request)
            metrics["claim_estimated_input_tokens"] += _estimate_token_count(len(serialized_request))
        outcome = extract_claims(request, provider, cache=cache)  # type: ignore[arg-type]
        audit_entries.extend(outcome.audit_entries)
        if config.claim_cost_metrics_enabled:
            metrics["claim_retry_count"] += sum(1 for entry in outcome.audit_entries if entry.get("status") == "retry")

        if outcome.status == "success" and outcome.claims:
            audit_id = outcome.audit_entries[-1]["audit_id"] if outcome.audit_entries else None
            realized = _materialize_claims_from_extraction(
                extracted_claims=outcome.claims,
                batch_spans=batch_spans,
                normalized_by_id=normalized_by_id,
                provider_name=provider_name,
                model_name=model_name,
                prompt_version=config.claim_prompt_version,
                claim_index_start=next_claim_index,
                audit_id=audit_id,
                batch_index=batch_index,
                start_date=config.start_date,
            )
        else:
            fallback_claims = build_claims(batch_spans, normalized_by_id, start_date=config.start_date)
            if config.claim_cost_metrics_enabled:
                metrics["claim_fallback_batch_count"] += 1
            for fallback_claim in fallback_claims:
                fallback_claim["extractor"] = {
                    "provider": f"{provider_name}_fallback",
                    "model": model_name,
                    "prompt_version": config.claim_prompt_version,
                    "run_id": f"run_claims_batch_{batch_index:03d}_fallback",
                }
                fallback_claim["llm_audit_id"] = outcome.audit_entries[-1]["audit_id"] if outcome.audit_entries else f"audit_claims_batch_{batch_index:03d}_fallback"
                fallback_claim["metadata"]["batch_index"] = batch_index
            realized = fallback_claims
        if config.claim_cost_metrics_enabled:
            metrics["claim_estimated_output_tokens"] += _estimate_token_count(len(_serialize_json({"claims": realized})))

        for offset, claim in enumerate(realized, start=0):
            claim["claim_id"] = f"claim_{next_claim_index + offset:03d}"
        next_claim_index += len(realized)
        all_claims.extend(realized)

    return all_claims, audit_entries, metrics


def _keywords_from_comments(comments: Iterable[NormalizedComment]) -> list[str]:
    counts: dict[str, int] = defaultdict(int)
    for comment in comments:
        for token in tokenize(comment["normalized_text"]):
            if len(token) <= 1:
                continue
            if token in {"agent", "the", "and"}:
                continue
            counts[token] += 1
    return [token for token, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:5]]


def _viewpoint_bucket_heat(
    *,
    bucket_count: int,
    support_count: int,
    average_quality: float,
    bucket_index: int,
) -> float:
    return storyline_heat_index(
        volume_component=min(bucket_count / 4.0, 1.0),
        support_component=min(support_count / 4.0, 1.0),
        source_quality_component=min(average_quality, 1.0),
        recency_component=min(1.0, 0.45 + (bucket_index * 0.14)),
    )


def _build_viewpoints(
    *,
    claims: list[Claim],
    normalized_by_id: Mapping[str, NormalizedComment],
    summary_provider: OptimizationSummaryProvider,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    grouped_claims: dict[str, list[Claim]] = defaultdict(list)
    for claim in claims:
        grouped_claims[str(claim["metadata"]["cluster_key"])].append(claim)

    cluster_to_viewpoint_id = {
        "pragmatic_adoption": "vp_001",
        "integration_roi": "vp_002",
        "deployment_friction": "vp_003",
    }
    viewpoints: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    batch_payloads: dict[str, dict[str, Any]] = {}

    for cluster_key, viewpoint_id in cluster_to_viewpoint_id.items():
        cluster_claims = grouped_claims.get(cluster_key, [])
        if not cluster_claims:
            continue
        comment_ids = [claim["comment_id"] for claim in cluster_claims]
        comments = [normalized_by_id[comment_id] for comment_id in comment_ids]
        batch_payloads[viewpoint_id] = {
            "cluster_key": cluster_key,
            "support_count": len(cluster_claims),
            "keywords": _keywords_from_comments(comments),
            "comments": comments,
        }

    batch_summaries = (
        summary_provider.summarize_viewpoints_batch(batch_payloads)
        if hasattr(summary_provider, "summarize_viewpoints_batch") and batch_payloads
        else {}
    )

    for cluster_key, viewpoint_id in cluster_to_viewpoint_id.items():
        cluster_claims = grouped_claims.get(cluster_key, [])
        if not cluster_claims:
            continue
        comment_ids = [claim["comment_id"] for claim in cluster_claims]
        comments = [normalized_by_id[comment_id] for comment_id in comment_ids]
        summary = batch_summaries.get(viewpoint_id) or summary_provider.summarize_viewpoint(batch_payloads[viewpoint_id])
        viewpoints.append(
            {
                "viewpoint_id": viewpoint_id,
                "topic_tag": cluster_key,
                "viewpoint_label": summary.viewpoint_label,
                "title": summary.title,
                "claim_statement": summary.claim_statement,
                "summary": summary.summary,
                "summary_source": "llm",
                "summary_grounding_score": round(summary.summary_grounding_score, 2),
                "claim_ids": [claim["claim_id"] for claim in cluster_claims],
                "comment_ids": comment_ids,
                "representative_claim_ids": [claim["claim_id"] for claim in cluster_claims[:2]],
                "evidence_comment_ids": list(dict.fromkeys(comment_ids)),
                "support_count": len(cluster_claims),
                "unique_comment_count": len(set(comment_ids)),
                "keywords": _keywords_from_comments(comments),
                "metadata": {
                    "cluster_key": cluster_key,
                    "storyline_key": _cluster_to_storyline(cluster_key),
                },
            }
        )

        grouped_by_bucket: dict[int, list[Claim]] = defaultdict(list)
        for claim in cluster_claims:
            grouped_by_bucket[int(claim["metadata"]["bucket_index"])].append(claim)
        for bucket_index, bucket_claims in sorted(grouped_by_bucket.items()):
            bucket_comments = [normalized_by_id[claim["comment_id"]] for claim in bucket_claims]
            snapshots.append(
                {
                    "snapshot_id": f"vp_snap_{viewpoint_id}_{bucket_index}",
                    "viewpoint_id": viewpoint_id,
                    "bucket_index": bucket_index,
                    "bucket_start": bucket_comments[0]["created_at"][:10],
                    "bucket_granularity": "day",
                    "support_count": len(bucket_claims),
                    "unique_comment_count": len({claim["comment_id"] for claim in bucket_claims}),
                    "heat_index": _viewpoint_bucket_heat(
                        bucket_count=len(bucket_claims),
                        support_count=len(bucket_claims),
                        average_quality=sum(_as_float(comment["quality_score"]) for comment in bucket_comments)
                        / max(len(bucket_comments), 1),
                        bucket_index=bucket_index,
                    ),
                    "representative_claim_ids": [claim["claim_id"] for claim in bucket_claims[:2]],
                    "metadata": {"cluster_key": cluster_key},
                }
            )

    relations.extend(
        [
            {
                "relation_id": "vp_rel_001",
                "source_viewpoint_id": "vp_002",
                "target_viewpoint_id": "vp_001",
                "relation_type": "reinforces",
                "weight": 0.81,
                "evidence_claim_ids": [claim["claim_id"] for claim in grouped_claims.get("integration_roi", [])[:2]],
                "rationale": _relation_rationale("reinforces"),
                "metadata": {},
            },
            {
                "relation_id": "vp_rel_002",
                "source_viewpoint_id": "vp_003",
                "target_viewpoint_id": "vp_001",
                "relation_type": "constrains",
                "weight": 0.74,
                "evidence_claim_ids": [claim["claim_id"] for claim in grouped_claims.get("deployment_friction", [])[:2]],
                "rationale": _relation_rationale("constrains"),
                "metadata": {},
            },
            {
                "relation_id": "vp_rel_003",
                "source_viewpoint_id": "vp_003",
                "target_viewpoint_id": "vp_002",
                "relation_type": "constrains",
                "weight": 0.69,
                "evidence_claim_ids": [claim["claim_id"] for claim in grouped_claims.get("deployment_friction", [])[:2]],
                "rationale": _relation_rationale("constrains"),
                "metadata": {},
            },
        ]
    )

    return viewpoints, snapshots, relations


def _build_storylines(
    *,
    viewpoints: list[dict[str, Any]],
    viewpoint_snapshots: list[dict[str, Any]],
    normalized_by_id: Mapping[str, NormalizedComment],
    summary_provider: OptimizationSummaryProvider,
    start_date: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    storyline_to_viewpoint_ids = {"adoption_storyline": ["vp_001", "vp_002"], "friction_storyline": ["vp_003"]}
    storyline_to_id = {"adoption_storyline": "st_001", "friction_storyline": "st_002"}
    storylines: list[dict[str, Any]] = []
    memberships: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = [
        {
            "relation_id": "st_rel_001",
            "source_storyline_id": "st_002",
            "target_storyline_id": "st_001",
            "relation_type": "constrains",
            "weight": 0.78,
            "evidence_viewpoint_ids": ["vp_003"],
            "rationale": "部署与维护摩擦持续压制落地主线的扩张速度。",
            "metadata": {},
        }
    ]

    snapshots_by_viewpoint_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for snapshot in viewpoint_snapshots:
        snapshots_by_viewpoint_id[snapshot["viewpoint_id"]].append(snapshot)

    viewpoint_by_id = {viewpoint["viewpoint_id"]: viewpoint for viewpoint in viewpoints}
    batch_payloads: dict[str, dict[str, Any]] = {}

    for storyline_key, viewpoint_ids in storyline_to_viewpoint_ids.items():
        storyline_id = storyline_to_id[storyline_key]
        included_viewpoints = [viewpoint_by_id[viewpoint_id] for viewpoint_id in viewpoint_ids if viewpoint_id in viewpoint_by_id]
        if not included_viewpoints:
            continue
        support_count = sum(viewpoint["support_count"] for viewpoint in included_viewpoints)
        comment_ids = list(dict.fromkeys(comment_id for viewpoint in included_viewpoints for comment_id in viewpoint["comment_ids"]))
        comments = [normalized_by_id[comment_id] for comment_id in comment_ids]
        batch_payloads[storyline_id] = {
            "storyline_key": storyline_key,
            "support_count": support_count,
            "viewpoint_count": len(included_viewpoints),
            "comments": comments,
        }

    batch_summaries = (
        summary_provider.summarize_storylines_batch(batch_payloads)
        if hasattr(summary_provider, "summarize_storylines_batch") and batch_payloads
        else {}
    )

    for storyline_key, viewpoint_ids in storyline_to_viewpoint_ids.items():
        storyline_id = storyline_to_id[storyline_key]
        included_viewpoints = [viewpoint_by_id[viewpoint_id] for viewpoint_id in viewpoint_ids if viewpoint_id in viewpoint_by_id]
        if not included_viewpoints:
            continue
        support_count = sum(viewpoint["support_count"] for viewpoint in included_viewpoints)
        comment_ids = list(dict.fromkeys(comment_id for viewpoint in included_viewpoints for comment_id in viewpoint["comment_ids"]))
        comments = [normalized_by_id[comment_id] for comment_id in comment_ids]
        storyline_summary = batch_summaries.get(storyline_id) or summary_provider.summarize_storyline(batch_payloads[storyline_id])
        storylines.append(
            {
                "storyline_id": storyline_id,
                "topic_tag": "ai_agent_practicalization",
                "storyline_label": storyline_summary.storyline_label,
                "title": storyline_summary.title,
                "summary": storyline_summary.summary,
                "summary_source": "llm",
                "logic_status": storyline_summary.logic_status,
                "evidence_posture": storyline_summary.evidence_posture,
                "support_count": support_count,
                "viewpoint_count": len(included_viewpoints),
                "comment_count": len(comment_ids),
                "keywords": _keywords_from_comments(comments),
                "display_rank": 1 if storyline_id == "st_001" else 2,
                "display_tier": "primary" if storyline_id == "st_001" else "secondary",
                "metadata": {"storyline_key": storyline_key},
            }
        )

        for viewpoint_index, viewpoint_id in enumerate(viewpoint_ids):
            if viewpoint_id not in viewpoint_by_id:
                continue
            memberships.append(
                {
                    "membership_id": f"stm_{storyline_id}_{viewpoint_id}",
                    "storyline_id": storyline_id,
                    "viewpoint_id": viewpoint_id,
                    "role": "core" if viewpoint_index == 0 else "supporting",
                    "weight": 0.92 if viewpoint_index == 0 else 0.84,
                    "start_bucket_index": min(snapshot["bucket_index"] for snapshot in snapshots_by_viewpoint_id.get(viewpoint_id, [])),
                    "end_bucket_index": None,
                    "metadata": {},
                }
            )

        bucket_indexes = sorted(
            {
                snapshot["bucket_index"]
                for viewpoint_id in viewpoint_ids
                for snapshot in snapshots_by_viewpoint_id.get(viewpoint_id, [])
            }
        )
        for bucket_index in bucket_indexes:
            bucket_snapshots = [
                snapshot
                for viewpoint_id in viewpoint_ids
                for snapshot in snapshots_by_viewpoint_id.get(viewpoint_id, [])
                if snapshot["bucket_index"] == bucket_index
            ]
            viewpoint_ids_in_bucket = [snapshot["viewpoint_id"] for snapshot in bucket_snapshots]
            bucket_comment_ids = list(
                dict.fromkeys(
                    comment_id
                    for viewpoint_id in viewpoint_ids_in_bucket
                    for comment_id in viewpoint_by_id[viewpoint_id]["comment_ids"]
                    if _comment_bucket_index(normalized_by_id[comment_id], start_date) == bucket_index
                )
            )
            bucket_comments = [normalized_by_id[comment_id] for comment_id in bucket_comment_ids]
            average_quality = sum(_as_float(comment["quality_score"]) for comment in bucket_comments) / max(len(bucket_comments), 1)
            snapshots.append(
                {
                    "snapshot_id": f"st_snap_{storyline_id}_{bucket_index}",
                    "storyline_id": storyline_id,
                    "bucket_index": bucket_index,
                    "bucket_start": _bucket_date(start_date, bucket_index),
                    "bucket_granularity": "day",
                    "support_count": sum(snapshot["support_count"] for snapshot in bucket_snapshots),
                    "comment_count": len(bucket_comment_ids),
                    "viewpoint_ids": viewpoint_ids_in_bucket,
                    "storyline_heat_index": storyline_heat_index(
                        volume_component=min(len(bucket_comment_ids) / 5.0, 1.0),
                        support_component=min(sum(snapshot["support_count"] for snapshot in bucket_snapshots) / 6.0, 1.0),
                        source_quality_component=min(average_quality, 1.0),
                        recency_component=min(1.0, 0.45 + (bucket_index * 0.14)),
                    ),
                    "top_viewpoint_ids": viewpoint_ids_in_bucket[:2],
                    "metadata": {"storyline_key": storyline_key},
                }
            )

    return storylines, memberships, snapshots, relations


def _build_storyline_forecasts(
    *,
    storylines: list[dict[str, Any]],
    storyline_snapshots: list[dict[str, Any]],
    summary_provider: OptimizationSummaryProvider,
) -> list[dict[str, Any]]:
    forecasts: list[dict[str, Any]] = []
    adapters = [BassDiffusionAdapter(), GompertzAdapter()]
    snapshots_by_storyline: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for snapshot in storyline_snapshots:
        snapshots_by_storyline[snapshot["storyline_id"]].append(snapshot)

    batch_payloads: dict[str, dict[str, Any]] = {}
    for storyline in storylines:
        for adapter in adapters:
            batch_payloads[f"{storyline['storyline_id']}__{adapter.model_id}"] = {
                "model_id": adapter.model_id,
                "storyline_label": storyline["storyline_label"],
                "storyline_title": storyline["title"],
            }
    batch_reasoning = (
        summary_provider.summarize_model_reasoning_batch(batch_payloads)
        if hasattr(summary_provider, "summarize_model_reasoning_batch") and batch_payloads
        else {}
    )

    for storyline in storylines:
        historical_points: list[ForecastPoint] = [
            {
                "bucket_index": snapshot["bucket_index"],
                "bucket_start": snapshot["bucket_start"],
                "bucket_granularity": snapshot["bucket_granularity"],  # type: ignore[typeddict-item]
                "value": snapshot["storyline_heat_index"],
                "confidence_low": snapshot["storyline_heat_index"],
                "confidence_high": snapshot["storyline_heat_index"],
                "confidence_score": 1.0,
                "is_forecast": False,
            }
            for snapshot in sorted(snapshots_by_storyline.get(storyline["storyline_id"], []), key=lambda item: item["bucket_index"])
        ]
        for adapter in adapters:
            forecast_output = forecast_series_with_adapter(historical_points, adapter, horizon=2)
            batch_key = f"{storyline['storyline_id']}__{adapter.model_id}"
            reasoning = batch_reasoning.get(batch_key) or summary_provider.summarize_model_reasoning(batch_payloads[batch_key])
            forecasts.append(
                {
                    "storyline_id": storyline["storyline_id"],
                    "model_id": adapter.model_id,
                    "model_label": adapter.model_label,
                    "target_metric": "storylineHeatIndex",
                    "historical_points": deepcopy(forecast_output["historical_points"]),
                    "forecast_points": deepcopy(forecast_output["forecast_points"]),
                    "explanation": reasoning.explanation,
                    "metadata": {
                        "assumptions": list(reasoning.assumptions),
                        "confidence_note": reasoning.confidence_note,
                        "comparison_summary": reasoning.comparison_summary,
                    },
                }
            )
    return forecasts


def assemble_analysis_state(
    *,
    config: OptimizationConfig,
    raw_comments: Iterable[dict[str, Any]],
    summary_provider: OptimizationSummaryProvider | None = None,
    prompt_version: str | None = None,
) -> dict[str, Any]:
    provider = summary_provider or DeterministicSummaryProvider()
    raw_comment_list = [dict(comment) for comment in raw_comments]
    normalized_comments = normalize_raw_comments(raw_comment_list)
    return assemble_analysis_state_from_normalized_comments(
        config=config,
        raw_comments=raw_comment_list,
        normalized_comments=normalized_comments,
        summary_provider=provider,
        prompt_version=prompt_version,
    )


def assemble_analysis_state_from_normalized_comments(
    *,
    config: OptimizationConfig,
    raw_comments: Iterable[dict[str, Any]],
    normalized_comments: Iterable[NormalizedComment],
    summary_provider: OptimizationSummaryProvider | None = None,
    prompt_version: str | None = None,
) -> dict[str, Any]:
    provider = summary_provider or DeterministicSummaryProvider()
    raw_comment_list = [dict(comment) for comment in raw_comments]
    normalized_comment_list = [dict(comment) for comment in normalized_comments]
    normalized_by_id = {comment["comment_id"]: comment for comment in normalized_comment_list}
    spans = build_claim_candidate_spans(normalized_comment_list, config)
    claims, llm_audit_log, claim_metrics = build_claims_with_optional_llm(
        spans=spans,
        normalized_by_id=normalized_by_id,
        config=config,
        provider=provider,
    )
    viewpoints, viewpoint_snapshots, viewpoint_relations = _build_viewpoints(
        claims=claims,
        normalized_by_id=normalized_by_id,
        summary_provider=provider,
    )
    storylines, storyline_memberships, storyline_snapshots, storyline_relations = _build_storylines(
        viewpoints=viewpoints,
        viewpoint_snapshots=viewpoint_snapshots,
        normalized_by_id=normalized_by_id,
        summary_provider=provider,
        start_date=config.start_date,
    )
    storyline_forecasts = _build_storyline_forecasts(
        storylines=storylines,
        storyline_snapshots=storyline_snapshots,
        summary_provider=provider,
    )
    return {
        "analysis_id": f"analysis_{config.case_id}",
        "case_id": config.case_id,
        "contract_version": "2026-03-24.v1",
        "bucket_granularity": "day",
        "generated_at": "2026-03-24T12:30:00Z",
        "raw_comments": raw_comment_list,
        "normalized_comments": normalized_comment_list,
        "claim_candidate_spans": spans,
        "claims": claims,
        "viewpoints": viewpoints,
        "viewpoint_snapshots": viewpoint_snapshots,
        "viewpoint_relations": viewpoint_relations,
        "storylines": storylines,
        "storyline_memberships": storyline_memberships,
        "storyline_snapshots": storyline_snapshots,
        "storyline_relations": storyline_relations,
        "storyline_forecasts": storyline_forecasts,
        "llm_audit_log": llm_audit_log,
        "diagnostics": {
            "raw_comment_count": len(raw_comment_list),
            "normalized_comment_count": len(normalized_comment_list),
            "candidate_span_count": len(spans),
            "accepted_claim_count": len(claims),
            "rejected_candidate_count": len(normalized_comment_list) - len(spans),
            "llm_cache_hits": sum(1 for entry in llm_audit_log if entry.get("cache_hit")),
            **claim_metrics,
        },
    }
