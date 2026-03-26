"""LLM summary wrapper with deterministic fallback behavior."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .summaries import (
    DeterministicSummaryProvider,
    ModelReasoningSummary,
    OptimizationSummaryProvider,
    StorylineSummary,
    ViewpointSummary,
)


class FallbackSummaryProvider:
    """Use a primary summary provider, but fall back to deterministic text when it fails."""

    def __init__(
        self,
        primary: OptimizationSummaryProvider,
        fallback: OptimizationSummaryProvider | None = None,
    ) -> None:
        self.primary = primary
        self.fallback = fallback or DeterministicSummaryProvider()

    @property
    def model(self) -> str:
        return getattr(self.primary, "model", "fallback")

    def extract_claims(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.primary.extract_claims(payload)  # type: ignore[attr-defined]

    def summarize_viewpoint(self, payload: Mapping[str, Any]) -> ViewpointSummary:
        try:
            return self.primary.summarize_viewpoint(payload)
        except Exception:
            return self.fallback.summarize_viewpoint(payload)

    def summarize_viewpoints_batch(self, payloads: dict[str, dict[str, Any]]) -> dict[str, ViewpointSummary]:
        summaries: dict[str, ViewpointSummary] = {}
        if hasattr(self.primary, "summarize_viewpoints_batch"):
            try:
                summaries.update(self.primary.summarize_viewpoints_batch(payloads))  # type: ignore[attr-defined]
            except Exception:
                summaries = {}
        for key, payload in payloads.items():
            summaries.setdefault(key, self.fallback.summarize_viewpoint(payload))
        return summaries

    def summarize_storyline(self, payload: Mapping[str, Any]) -> StorylineSummary:
        try:
            return self.primary.summarize_storyline(payload)
        except Exception:
            return self.fallback.summarize_storyline(payload)

    def summarize_storylines_batch(self, payloads: dict[str, dict[str, Any]]) -> dict[str, StorylineSummary]:
        summaries: dict[str, StorylineSummary] = {}
        if hasattr(self.primary, "summarize_storylines_batch"):
            try:
                summaries.update(self.primary.summarize_storylines_batch(payloads))  # type: ignore[attr-defined]
            except Exception:
                summaries = {}
        for key, payload in payloads.items():
            summaries.setdefault(key, self.fallback.summarize_storyline(payload))
        return summaries

    def summarize_model_reasoning(self, payload: Mapping[str, Any]) -> ModelReasoningSummary:
        try:
            return self.primary.summarize_model_reasoning(payload)
        except Exception:
            return self.fallback.summarize_model_reasoning(payload)

    def summarize_model_reasoning_batch(
        self,
        payloads: dict[str, dict[str, Any]],
    ) -> dict[str, ModelReasoningSummary]:
        summaries: dict[str, ModelReasoningSummary] = {}
        if hasattr(self.primary, "summarize_model_reasoning_batch"):
            try:
                summaries.update(self.primary.summarize_model_reasoning_batch(payloads))  # type: ignore[attr-defined]
            except Exception:
                summaries = {}
        for key, payload in payloads.items():
            summaries.setdefault(key, self.fallback.summarize_model_reasoning(payload))
        return summaries

    def summarize_case_title(self, payload: Mapping[str, Any]) -> str:
        try:
            return self.primary.summarize_case_title(payload)
        except Exception:
            return self.fallback.summarize_case_title(payload)

    def summarize_cluster_label(self, payload: Mapping[str, Any]) -> str:
        try:
            return self.primary.summarize_cluster_label(payload)
        except Exception:
            return self.fallback.summarize_cluster_label(payload)
