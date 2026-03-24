"""Claim extraction data structures."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


ClaimExtractionStatus = Literal["success", "retry", "fallback", "invalid"]


@dataclass(frozen=True)
class ClaimCandidateSpan:
    span_id: str
    comment_id: str
    text: str
    start_char: int
    end_char: int
    heuristic_labels: tuple[str, ...] = field(default_factory=tuple)
    candidate_score: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    def is_accepted(self, minimum_score: float = 0.6) -> bool:
        return (
            bool(self.text.strip())
            and self.end_char > self.start_char
            and len(self.text.strip()) >= 6
            and self.candidate_score >= minimum_score
        )


@dataclass(frozen=True)
class ClaimExtractionRequest:
    spans: tuple[ClaimCandidateSpan, ...]
    case_id: str | None = None
    prompt_version: str = "claims.v1"
    provider: str = "stub"
    model: str = "stub"


@dataclass(frozen=True)
class ClaimExtractionCacheEntry:
    input_hash: str
    status: ClaimExtractionStatus
    claims: tuple[dict[str, Any], ...]
    audit_entry: dict[str, Any] | None = None


@dataclass(frozen=True)
class ClaimExtractionRetryPlan:
    max_attempts: int = 2
    retry_invalid_output: bool = True
    retry_provider_error: bool = True


@dataclass(frozen=True)
class ClaimExtractionFailure:
    status: ClaimExtractionStatus
    error_message: str
    attempted_spans: tuple[str, ...] = field(default_factory=tuple)
    audit_entries: tuple[dict[str, Any], ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ClaimExtractionOutcome:
    claims: tuple[dict[str, Any], ...]
    audit_entries: tuple[dict[str, Any], ...]
    cache_hit: bool = False
    status: ClaimExtractionStatus = "success"
    error_message: str | None = None
    cached_entry: ClaimExtractionCacheEntry | None = None
