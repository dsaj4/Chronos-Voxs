"""Claim extraction baseline pipeline."""

from __future__ import annotations

from typing import Any

from .audit import create_llm_audit_entry, stable_input_hash
from .cache import ClaimExtractionCache, build_cache_record
from .models import (
    ClaimCandidateSpan,
    ClaimExtractionFailure,
    ClaimExtractionOutcome,
    ClaimExtractionRequest,
    ClaimExtractionRetryPlan,
)
from .schema import ensure_valid_claim_extraction_output
from ..llm.providers import ClaimExtractionProvider


def select_claim_candidate_spans(
    spans: list[ClaimCandidateSpan] | tuple[ClaimCandidateSpan, ...],
    minimum_score: float = 0.6,
) -> tuple[ClaimCandidateSpan, ...]:
    return tuple(span for span in spans if span.is_accepted(minimum_score))


def build_claim_extraction_payload(request: ClaimExtractionRequest) -> dict[str, Any]:
    accepted_spans = select_claim_candidate_spans(request.spans)
    return {
        "spans": [
            {
                "span_id": span.span_id,
                "comment_id": span.comment_id,
                "text": span.text,
            }
            for span in accepted_spans
        ]
    }


def normalize_claim_output(payload: dict[str, Any]) -> list[dict[str, Any]]:
    claims = payload.get("claims", [])
    if not isinstance(claims, list):
        raise ValueError("claim extraction payload must contain a claims list")
    return claims


def build_claim_extraction_failure(
    *,
    status: str,
    error_message: str,
    spans: tuple[ClaimCandidateSpan, ...],
    audit_entries: tuple[dict[str, Any], ...] = (),
) -> ClaimExtractionOutcome:
    failure = ClaimExtractionFailure(
        status=status,
        error_message=error_message,
        attempted_spans=tuple(span.span_id for span in spans),
        audit_entries=audit_entries,
    )
    return ClaimExtractionOutcome(
        claims=(),
        audit_entries=failure.audit_entries,
        cache_hit=False,
        status=failure.status,
        error_message=failure.error_message,
    )


def extract_claims(
    request: ClaimExtractionRequest,
    provider: ClaimExtractionProvider,
    cache: ClaimExtractionCache | None = None,
    retry_plan: ClaimExtractionRetryPlan | None = None,
) -> ClaimExtractionOutcome:
    retry_plan = retry_plan or ClaimExtractionRetryPlan()
    accepted_spans = select_claim_candidate_spans(request.spans)
    if not accepted_spans:
        return build_claim_extraction_failure(
            status="invalid",
            error_message="no accepted candidate spans available for extraction",
            spans=accepted_spans,
        )

    payload = build_claim_extraction_payload(request)
    cache_payload = {
        "payload": payload,
        "case_id": request.case_id,
        "prompt_version": request.prompt_version,
        "provider": request.provider,
        "model": request.model,
    }
    input_hash = stable_input_hash(cache_payload)

    if cache is not None:
        cached = cache.get(cache_payload)
        if cached is not None:
            claims = tuple(normalize_claim_output(cached))
            audit_entry = cached.get("audit_entry")
            cached_audit_entry = None
            if audit_entry is not None:
                cached_audit_entry = {**audit_entry, "cache_hit": True}
            return ClaimExtractionOutcome(
                claims=claims,
                audit_entries=(cached_audit_entry,) if cached_audit_entry else (),
                cache_hit=True,
                status=cached.get("status", "success"),
                cached_entry=None,
            )

    audit_entries: list[dict[str, Any]] = []
    last_error_message = "claim extraction failed"

    for attempt_index in range(1, retry_plan.max_attempts + 1):
        is_last_attempt = attempt_index >= retry_plan.max_attempts
        try:
            raw_output = provider.extract_claims(payload)
            ensure_valid_claim_extraction_output(raw_output)
            claims = tuple(normalize_claim_output(raw_output))
            audit_entry = create_llm_audit_entry(
                task_kind="claim_extraction",
                provider=request.provider,
                model=request.model,
                prompt_version=request.prompt_version,
                input_hash=input_hash,
                status="success",
                cache_hit=False,
                metadata={"span_count": len(accepted_spans), "attempt_index": attempt_index},
            )
            cache_record = build_cache_record("success", list(claims), audit_entry)
            if cache is not None:
                cache.put(cache_payload, cache_record)

            return ClaimExtractionOutcome(
                claims=claims,
                audit_entries=tuple([*audit_entries, audit_entry]),
                cache_hit=False,
                status="success",
            )
        except Exception as exc:  # noqa: BLE001 - adapter boundary should isolate provider failures
            last_error_message = str(exc)
            status = "fallback" if is_last_attempt else "retry"
            audit_entry = create_llm_audit_entry(
                task_kind="claim_extraction",
                provider=request.provider,
                model=request.model,
                prompt_version=request.prompt_version,
                input_hash=input_hash,
                status=status,
                cache_hit=False,
                metadata={
                    "span_count": len(accepted_spans),
                    "attempt_index": attempt_index,
                    "error": last_error_message,
                },
            )
            audit_entries.append(audit_entry)
            if is_last_attempt:
                break
            if isinstance(exc, ValueError) and not retry_plan.retry_invalid_output:
                break
            if not isinstance(exc, ValueError) and not retry_plan.retry_provider_error:
                break

    return build_claim_extraction_failure(
        status="invalid",
        error_message=last_error_message,
        spans=accepted_spans,
        audit_entries=tuple(audit_entries),
    )
