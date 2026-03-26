"""Synthetic optimization helpers for phase-1 data tuning."""

from .dashscope_provider import DashScopeSummaryProvider
from .fallback_provider import FallbackSummaryProvider
from .models import (
    OptimizationConfig,
    OptimizationIssue,
    OptimizationIterationResult,
    OptimizationReport,
    SummaryTrackResult,
)
from .diagnostics import diagnose_bundle, format_report_markdown
from .env import load_local_env_files
from .pipeline import (
    assemble_analysis_state,
    assemble_analysis_state_from_normalized_comments,
    build_claim_candidate_spans,
    build_claims,
)
from .runner import build_llm_summary_track_from_env, run_phase1_optimization
from .summaries import DeterministicSummaryProvider, LlmSummaryTrack
from .synthetic import build_synthetic_raw_comments

__all__ = [
    "DashScopeSummaryProvider",
    "DeterministicSummaryProvider",
    "FallbackSummaryProvider",
    "LlmSummaryTrack",
    "OptimizationConfig",
    "OptimizationIssue",
    "OptimizationIterationResult",
    "OptimizationReport",
    "SummaryTrackResult",
    "assemble_analysis_state",
    "assemble_analysis_state_from_normalized_comments",
    "build_llm_summary_track_from_env",
    "build_claim_candidate_spans",
    "build_claims",
    "build_synthetic_raw_comments",
    "diagnose_bundle",
    "format_report_markdown",
    "load_local_env_files",
    "run_phase1_optimization",
]
