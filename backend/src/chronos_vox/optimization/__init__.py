"""Synthetic optimization helpers for phase-1 data tuning."""

from .models import (
    OptimizationConfig,
    OptimizationIssue,
    OptimizationIterationResult,
    OptimizationReport,
    SummaryTrackResult,
)
from .diagnostics import diagnose_bundle, format_report_markdown
from .pipeline import assemble_analysis_state, build_claim_candidate_spans, build_claims
from .runner import run_phase1_optimization
from .summaries import DeterministicSummaryProvider, LlmSummaryTrack
from .synthetic import build_synthetic_raw_comments

__all__ = [
    "DeterministicSummaryProvider",
    "LlmSummaryTrack",
    "OptimizationConfig",
    "OptimizationIssue",
    "OptimizationIterationResult",
    "OptimizationReport",
    "SummaryTrackResult",
    "assemble_analysis_state",
    "build_claim_candidate_spans",
    "build_claims",
    "build_synthetic_raw_comments",
    "diagnose_bundle",
    "format_report_markdown",
    "run_phase1_optimization",
]
