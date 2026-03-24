"""Injectable provider interfaces for claim extraction and summarization."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class ClaimExtractionProvider(Protocol):
    def extract_claims(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return a claim-extraction-shaped mapping without making network assumptions."""


@runtime_checkable
class SummaryProvider(Protocol):
    def summarize_group(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Reserved for later grouping summaries; unused in claim extraction baseline."""
