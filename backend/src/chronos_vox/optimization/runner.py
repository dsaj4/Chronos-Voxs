"""Runner for the synthetic optimization loop."""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

from ..publish import build_forecast_bundle
from .dashscope_provider import DashScopeSummaryProvider
from .diagnostics import diagnose_bundle, format_report_markdown
from .models import (
    OptimizationConfig,
    OptimizationIssue,
    OptimizationIterationResult,
    OptimizationReport,
    OptimizationStatus,
    SummaryTrackResult,
)
from .pipeline import assemble_analysis_state
from .summaries import DeterministicSummaryProvider, LlmSummaryTrack
from .synthetic import build_synthetic_raw_comments


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def _write_text(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload, encoding="utf-8")


def _overall_status(track_results: list[SummaryTrackResult]) -> OptimizationStatus:
    statuses = {track.status for track in track_results}
    if statuses == {"passed"}:
        return "passed"
    if "failed" in statuses:
        return "failed"
    return "blocked"


def _tune_config(config: OptimizationConfig, previous: SummaryTrackResult | None) -> OptimizationConfig:
    if previous is None or previous.status != "failed":
        return config
    issue_codes = {issue.code for issue in previous.diagnostics.issues}
    tuned = config
    if "summary_similarity" in issue_codes:
        tuned = replace(tuned, prompt_version=f"{config.prompt_version}.diverse")
    if "storyline_grounding" in issue_codes or "viewpoint_grounding" in issue_codes:
        tuned = replace(tuned, minimum_grounding_score=max(0.7, config.minimum_grounding_score - 0.02))
    return tuned


def _failed_report(track_id: str, message: str) -> OptimizationReport:
    return OptimizationReport(
        track_id=track_id,  # type: ignore[arg-type]
        status="failed",
        structure_passed=False,
        readability_passed=False,
        frontend_passed=False,
        issues=(
            OptimizationIssue(
                code="llm_track_execution",
                severity="error",
                message=message,
                field_path="optimization.llm",
            ),
        ),
        metrics={},
    )


def _has_execution_failure(track_results: list[SummaryTrackResult]) -> bool:
    return any(
        any(issue.code == "llm_track_execution" for issue in track.diagnostics.issues)
        for track in track_results
    )


def persist_iteration_artifacts(
    *,
    output_root: Path,
    raw_comments: list[dict[str, Any]],
    iteration_result: OptimizationIterationResult,
) -> None:
    iteration_dir = output_root / f"iteration-{iteration_result.iteration_index:02d}"
    _write_json(iteration_dir / "raw_comments.json", {"raw_comments": raw_comments})
    _write_json(iteration_dir / "iteration.json", iteration_result.to_dict())
    for track in iteration_result.track_results:
        track_dir = iteration_dir / track.track_id
        _write_json(track_dir / "analysis_state.json", track.analysis_state)
        if track.bundle is not None:
            _write_json(track_dir / "bundle.json", track.bundle)
        _write_json(track_dir / "report.json", track.diagnostics.to_dict())
        _write_text(track_dir / "report.md", format_report_markdown(track.diagnostics))


def run_phase1_optimization(
    *,
    config: OptimizationConfig | None = None,
    llm_track: LlmSummaryTrack | None = None,
    output_root: Path | None = None,
    publish_bundle_path: Path | None = None,
) -> OptimizationIterationResult:
    active_config = config or OptimizationConfig()
    raw_comments = build_synthetic_raw_comments(active_config)
    llm_track = llm_track or build_llm_summary_track_from_env()
    previous_deterministic: SummaryTrackResult | None = None
    final_result: OptimizationIterationResult | None = None

    for iteration_index in range(1, active_config.max_iterations + 1):
        active_config = _tune_config(active_config, previous_deterministic)
        track_results: list[SummaryTrackResult] = []

        deterministic_state = assemble_analysis_state(
            config=active_config,
            raw_comments=raw_comments,
            summary_provider=DeterministicSummaryProvider(),
            prompt_version=active_config.prompt_version,
        )
        deterministic_bundle = build_forecast_bundle(
            deterministic_state,
            fixture_id=f"{active_config.case_id}-deterministic-v1",
            default_model_id="bass_diffusion",
        )
        deterministic_report = diagnose_bundle(
            track_id="deterministic",
            config=active_config,
            analysis_state=deterministic_state,
            bundle=deterministic_bundle,
        )
        deterministic_result = SummaryTrackResult(
            track_id="deterministic",
            status=deterministic_report.status,
            analysis_state=deterministic_state,
            bundle=deterministic_bundle,
            diagnostics=deterministic_report,
            prompt_version=active_config.prompt_version,
        )
        track_results.append(deterministic_result)
        previous_deterministic = deterministic_result

        if llm_track.is_configured:
            try:
                llm_state = assemble_analysis_state(
                    config=active_config,
                    raw_comments=raw_comments,
                    summary_provider=llm_track.provider,
                    prompt_version=active_config.llm_prompt_version,
                )
                llm_bundle = build_forecast_bundle(
                    llm_state,
                    fixture_id=f"{active_config.case_id}-llm-v1",
                    default_model_id="bass_diffusion",
                )
                llm_report = diagnose_bundle(
                    track_id="llm",
                    config=active_config,
                    analysis_state=llm_state,
                    bundle=llm_bundle,
                )
                track_results.append(
                    SummaryTrackResult(
                        track_id="llm",
                        status=llm_report.status,
                        analysis_state=llm_state,
                        bundle=llm_bundle,
                        diagnostics=llm_report,
                        prompt_version=active_config.llm_prompt_version,
                    )
                )
            except Exception as exc:
                track_results.append(
                    SummaryTrackResult(
                        track_id="llm",
                        status="failed",
                        analysis_state=deterministic_state,
                        bundle=None,
                        diagnostics=_failed_report("llm", str(exc)),
                        prompt_version=active_config.llm_prompt_version,
                        blocked_reason=str(exc),
                    )
                )
        else:
            blocked_report = diagnose_bundle(
                track_id="llm",
                config=active_config,
                analysis_state=deterministic_state,
                bundle=deterministic_bundle,
            )
            track_results.append(
                SummaryTrackResult(
                    track_id="llm",
                    status="blocked",
                    analysis_state=deterministic_state,
                    bundle=None,
                    diagnostics=replace(blocked_report, status="blocked"),
                    prompt_version=active_config.llm_prompt_version,
                    blocked_reason="未配置真实 LLM summary provider。",
                )
            )

        status = _overall_status(track_results)
        selected_track_id = next((track.track_id for track in track_results if track.status == "passed"), None)
        final_result = OptimizationIterationResult(
            iteration_index=iteration_index,
            config=active_config,
            status=status,
            track_results=tuple(track_results),
            selected_track_id=selected_track_id,
        )
        if output_root is not None:
            persist_iteration_artifacts(
                output_root=output_root,
                raw_comments=raw_comments,
                iteration_result=final_result,
            )
        if publish_bundle_path is not None and deterministic_result.bundle is not None:
            _write_json(publish_bundle_path, deterministic_result.bundle)
        if status != "failed" or _has_execution_failure(track_results):
            break

    if final_result is None:
        raise RuntimeError("optimization loop did not produce a result")
    return final_result


def build_llm_summary_track_from_env() -> LlmSummaryTrack:
    provider = DashScopeSummaryProvider.from_env()
    return LlmSummaryTrack(provider=provider)
