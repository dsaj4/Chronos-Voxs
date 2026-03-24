"""Claim candidate generation, extraction, validation, and caching."""

from .audit import create_llm_audit_entry, stable_input_hash
from .cache import ClaimExtractionCache
from .models import (
    ClaimCandidateSpan,
    ClaimExtractionFailure,
    ClaimExtractionOutcome,
    ClaimExtractionRequest,
    ClaimExtractionRetryPlan,
)
from .pipeline import (
    build_claim_extraction_failure,
    build_claim_extraction_payload,
    extract_claims,
    normalize_claim_output,
    select_claim_candidate_spans,
)
from .schema import ensure_valid_claim_extraction_output, validate_claim_extraction_output

__all__ = [
    "ClaimCandidateSpan",
    "ClaimExtractionCache",
    "ClaimExtractionFailure",
    "ClaimExtractionOutcome",
    "ClaimExtractionRequest",
    "ClaimExtractionRetryPlan",
    "build_claim_extraction_failure",
    "build_claim_extraction_payload",
    "create_llm_audit_entry",
    "ensure_valid_claim_extraction_output",
    "extract_claims",
    "normalize_claim_output",
    "select_claim_candidate_spans",
    "stable_input_hash",
    "validate_claim_extraction_output",
]
