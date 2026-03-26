"""Internal models for the phase-1 synthetic optimization loop."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


OptimizationStatus = Literal["passed", "failed", "blocked"]
SummaryTrackId = Literal["deterministic", "llm"]


@dataclass(frozen=True)
class OptimizationConfig:
    """Tunable knobs for the synthetic phase-1 loop."""

    case_id: str = "ai_agent_practicalization_simulated"
    topic_tag: str = "ai_agent_practicalization"
    start_date: str = "2026-03-10"
    bucket_count: int = 5
    max_iterations: int = 3
    minimum_quality_score: float = 0.45
    minimum_candidate_score: float = 0.55
    minimum_grounding_score: float = 0.75
    max_summary_similarity: float = 0.85
    title_min_length: int = 8
    title_max_length: int = 32
    summary_min_length: int = 18
    summary_max_length: int = 90
    prompt_version: str = "optimization.det.v1"
    llm_prompt_version: str = "optimization.llm.v1"
    claim_prompt_version: str = "claims.batch.v1"
    claim_batch_char_limit: int = 3000
    claim_alignment_strategy: Literal["exact_then_normalized_then_fallback"] = "exact_then_normalized_then_fallback"
    claim_cost_metrics_enabled: bool = True
    claim_batch_concurrency: int = 1
    representative_comment_strategy: Literal["highest_signal"] = "highest_signal"
    evidence_bucket_policy: Literal["per_particle_bucket"] = "per_particle_bucket"
    cluster_label_template: str = "{label}证据簇"
    dominant_language: str = "zh-CN"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class OptimizationIssue:
    code: str
    severity: Literal["error", "warning"]
    message: str
    field_path: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class OptimizationReport:
    track_id: SummaryTrackId
    status: OptimizationStatus
    structure_passed: bool
    readability_passed: bool
    frontend_passed: bool
    issues: tuple[OptimizationIssue, ...] = field(default_factory=tuple)
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["issues"] = [issue.to_dict() for issue in self.issues]
        return payload


@dataclass(frozen=True)
class SummaryTrackResult:
    track_id: SummaryTrackId
    status: OptimizationStatus
    analysis_state: dict[str, Any]
    bundle: dict[str, Any] | None
    diagnostics: OptimizationReport
    prompt_version: str
    blocked_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["diagnostics"] = self.diagnostics.to_dict()
        return payload


@dataclass(frozen=True)
class OptimizationIterationResult:
    iteration_index: int
    config: OptimizationConfig
    status: OptimizationStatus
    track_results: tuple[SummaryTrackResult, ...]
    selected_track_id: SummaryTrackId | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "iteration_index": self.iteration_index,
            "config": self.config.to_dict(),
            "status": self.status,
            "selected_track_id": self.selected_track_id,
            "track_results": [track.to_dict() for track in self.track_results],
        }
