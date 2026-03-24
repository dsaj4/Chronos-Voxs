"""Diagnostics and pass/fail checks for synthetic phase-1 bundles."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from ..normalize.text import canonicalize_text, detect_language, tokenize
from .models import OptimizationConfig, OptimizationIssue, OptimizationReport, OptimizationStatus, SummaryTrackId


ROOT = Path(__file__).resolve().parents[4]
SCHEMAS = ROOT / "shared" / "schemas"
USER_FACING_PLACEHOLDERS = {"evidence cluster", "vp_", "st_", "claim_", "norm_"}
GROUNDING_KEYWORDS = (
    "agent",
    "crm",
    "工单",
    "api",
    "webhook",
    "审批流",
    "流程",
    "半自动",
    "全自动",
    "deploy",
    "维护",
    "权限",
    "日志",
    "成本",
    "运维",
    "roi",
)


def _load_schema(name: str) -> object:
    with (SCHEMAS / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _iter_errors(schema_name: str, payload: Mapping[str, Any]) -> list[str]:
    validator = Draft202012Validator(_load_schema(schema_name))
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.absolute_path))
    return [
        f"{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
        for error in errors
    ]


def _jaccard_similarity(left: str, right: str) -> float:
    left_tokens = set(tokenize(left))
    right_tokens = set(tokenize(right))
    if not left_tokens and not right_tokens:
        return 1.0
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def _keyword_overlap(summary: str, evidence_texts: Sequence[str]) -> float:
    summary_blob = canonicalize_text(summary).lower()
    evidence_blob = " ".join(canonicalize_text(evidence).lower() for evidence in evidence_texts)
    keywords = [keyword for keyword in GROUNDING_KEYWORDS if keyword in evidence_blob][:4]
    if not summary_blob or not keywords:
        return 0.0
    return sum(1 for keyword in keywords if keyword in summary_blob) / len(keywords)


def _has_placeholder_text(value: str) -> bool:
    lowered = canonicalize_text(value).lower()
    if not lowered:
        return True
    return any(token in lowered for token in USER_FACING_PLACEHOLDERS)


def diagnose_bundle(
    *,
    track_id: SummaryTrackId,
    config: OptimizationConfig,
    analysis_state: Mapping[str, Any],
    bundle: Mapping[str, Any],
) -> OptimizationReport:
    issues: list[OptimizationIssue] = []
    metrics: dict[str, Any] = {}

    for message in _iter_errors("analysis-state.schema.json", analysis_state):
        issues.append(
            OptimizationIssue(
                code="analysis_schema",
                severity="error",
                message=message,
                field_path="analysis_state",
            )
        )

    for message in _iter_errors("forecast-bundle.schema.json", bundle):
        issues.append(
            OptimizationIssue(
                code="bundle_schema",
                severity="error",
                message=message,
                field_path="bundle",
            )
        )

    forecast_pairs = {
        (series["storyline_id"], series["model_id"])
        for series in bundle.get("stream", {}).get("forecast_series", [])
    }
    reasoning_pairs = {
        (entry["storyline_id"], entry["model_id"])
        for entry in bundle.get("reasoning", {}).get("model_reasoning", [])
    }
    metrics["forecast_pair_count"] = len(forecast_pairs)
    metrics["reasoning_pair_count"] = len(reasoning_pairs)
    if forecast_pairs != reasoning_pairs:
        issues.append(
            OptimizationIssue(
                code="missing_reasoning_pairs",
                severity="error",
                message=f"model_reasoning 未覆盖全部 forecast_series 组合: {sorted(forecast_pairs - reasoning_pairs)}",
                field_path="reasoning.model_reasoning",
            )
        )

    particles = bundle.get("particle_field", {}).get("particles", [])
    clusters = bundle.get("particle_field", {}).get("evidence_clusters", [])
    particle_bucket_pairs = {(particle["storyline_id"], particle["bucket_index"]) for particle in particles}
    cluster_bucket_pairs = {(cluster["storyline_id"], cluster["bucket_index"]) for cluster in clusters}
    metrics["particle_bucket_pairs"] = len(particle_bucket_pairs)
    metrics["cluster_bucket_pairs"] = len(cluster_bucket_pairs)
    missing_cluster_pairs = sorted(pair for pair in particle_bucket_pairs if pair not in cluster_bucket_pairs)
    if missing_cluster_pairs:
        issues.append(
            OptimizationIssue(
                code="missing_cluster_pairs",
                severity="error",
                message=f"存在有粒子但无证据簇的时间桶: {missing_cluster_pairs}",
                field_path="particle_field.evidence_clusters",
            )
        )

    for cluster in clusters:
        representative_comment_id = cluster.get("representative_comment_id", "")
        if representative_comment_id not in cluster.get("comment_ids", []):
            issues.append(
                OptimizationIssue(
                    code="invalid_representative_comment",
                    severity="error",
                    message=f"{cluster.get('cluster_id')} 的 representative_comment_id 不在 comment_ids 中。",
                    field_path="particle_field.evidence_clusters",
                )
            )
        if _has_placeholder_text(str(cluster.get("label", ""))):
            issues.append(
                OptimizationIssue(
                    code="placeholder_cluster_label",
                    severity="error",
                    message=f"{cluster.get('cluster_id')} 的 cluster label 不可读。",
                    field_path="particle_field.evidence_clusters.label",
                )
            )

    storyline_source_texts: dict[str, list[str]] = defaultdict(list)
    viewpoint_source_texts: dict[str, list[str]] = defaultdict(list)
    comment_by_id = {
        comment["comment_id"]: comment["canonical_text"]
        for comment in analysis_state.get("normalized_comments", [])
    }
    for viewpoint in analysis_state.get("viewpoints", []):
        viewpoint_source_texts[viewpoint["viewpoint_id"]].extend(
            comment_by_id.get(comment_id, "")
            for comment_id in viewpoint.get("comment_ids", [])
        )
    for traceability in bundle.get("reasoning", {}).get("traceability", []):
        storyline_source_texts[traceability["storyline_id"]].extend(
            comment_by_id.get(comment_id, "")
            for comment_id in traceability.get("comment_ids", [])
        )

    user_facing_fields: list[tuple[str, str]] = []
    sibling_summaries: list[tuple[str, str]] = []
    for storyline in bundle.get("stream", {}).get("storylines", []):
        user_facing_fields.extend(
            [
                ("stream.storylines.title", storyline.get("title", "")),
                ("stream.storylines.summary", storyline.get("summary", "")),
            ]
        )
        sibling_summaries.append((storyline["storyline_id"], storyline.get("summary", "")))
        if not config.title_min_length <= len(storyline.get("title", "")) <= config.title_max_length:
            issues.append(
                OptimizationIssue(
                    code="storyline_title_length",
                    severity="error",
                    message=f"{storyline['storyline_id']} 的 title 长度超出约束。",
                    field_path="stream.storylines.title",
                )
            )
        if not config.summary_min_length <= len(storyline.get("summary", "")) <= config.summary_max_length:
            issues.append(
                OptimizationIssue(
                    code="storyline_summary_length",
                    severity="error",
                    message=f"{storyline['storyline_id']} 的 summary 长度超出约束。",
                    field_path="stream.storylines.summary",
                )
            )
        if detect_language(storyline.get("summary", "")) != config.dominant_language:
            issues.append(
                OptimizationIssue(
                    code="storyline_summary_language",
                    severity="error",
                    message=f"{storyline['storyline_id']} 的 summary 主语言不是 {config.dominant_language}。",
                    field_path="stream.storylines.summary",
                )
            )
        grounding = _keyword_overlap(storyline.get("summary", ""), storyline_source_texts[storyline["storyline_id"]])
        metrics[f"grounding.storyline.{storyline['storyline_id']}"] = round(grounding, 4)
        if grounding < config.minimum_grounding_score:
            issues.append(
                OptimizationIssue(
                    code="storyline_grounding",
                    severity="error",
                    message=f"{storyline['storyline_id']} 的 summary grounding 低于阈值。",
                    field_path="stream.storylines.summary",
                )
            )

    for viewpoint in bundle.get("neural_map", {}).get("viewpoints", []):
        user_facing_fields.extend(
            [
                ("neural_map.viewpoints.title", viewpoint.get("title", "")),
                ("neural_map.viewpoints.summary", viewpoint.get("summary", "")),
                ("neural_map.viewpoints.claim_statement", viewpoint.get("claim_statement", "")),
            ]
        )
        sibling_summaries.append((viewpoint["viewpoint_id"], viewpoint.get("summary", "")))
        if detect_language(viewpoint.get("summary", "")) != config.dominant_language:
            issues.append(
                OptimizationIssue(
                    code="viewpoint_summary_language",
                    severity="error",
                    message=f"{viewpoint['viewpoint_id']} 的 summary 主语言不是 {config.dominant_language}。",
                    field_path="neural_map.viewpoints.summary",
                )
            )
        grounding = _keyword_overlap(viewpoint.get("summary", ""), viewpoint_source_texts[viewpoint["viewpoint_id"]])
        metrics[f"grounding.viewpoint.{viewpoint['viewpoint_id']}"] = round(grounding, 4)
        if grounding < config.minimum_grounding_score:
            issues.append(
                OptimizationIssue(
                    code="viewpoint_grounding",
                    severity="error",
                    message=f"{viewpoint['viewpoint_id']} 的 summary grounding 低于阈值。",
                    field_path="neural_map.viewpoints.summary",
                )
            )

    for field_path, value in user_facing_fields:
        if _has_placeholder_text(value):
            issues.append(
                OptimizationIssue(
                    code="placeholder_text",
                    severity="error",
                    message=f"{field_path} 含占位词或空值。",
                    field_path=field_path,
                )
            )

    for reasoning in bundle.get("reasoning", {}).get("model_reasoning", []):
        for key in ("explanation", "confidence_note", "comparison_summary"):
            value = str(reasoning.get(key, ""))
            if _has_placeholder_text(value):
                issues.append(
                    OptimizationIssue(
                        code="placeholder_reasoning",
                        severity="error",
                        message=f"{reasoning['storyline_id']} / {reasoning['model_id']} 的 {key} 不可读。",
                        field_path=f"reasoning.model_reasoning.{key}",
                    )
                )
            if detect_language(value) != config.dominant_language:
                issues.append(
                    OptimizationIssue(
                        code="reasoning_language",
                        severity="error",
                        message=f"{reasoning['storyline_id']} / {reasoning['model_id']} 的 {key} 语言不一致。",
                        field_path=f"reasoning.model_reasoning.{key}",
                    )
                )

    for left_index, (left_id, left_summary) in enumerate(sibling_summaries):
        for right_id, right_summary in sibling_summaries[left_index + 1 :]:
            similarity = _jaccard_similarity(left_summary, right_summary)
            metrics[f"similarity.{left_id}.{right_id}"] = round(similarity, 4)
            if similarity >= config.max_summary_similarity:
                issues.append(
                    OptimizationIssue(
                        code="summary_similarity",
                        severity="error",
                        message=f"{left_id} 与 {right_id} 的 summary 过于相似 ({similarity:.2f})。",
                        field_path="summary",
                    )
                )

    latest_snapshot_by_storyline: dict[str, Mapping[str, Any]] = {}
    for snapshot in bundle.get("stream", {}).get("storyline_snapshots", []):
        storyline_id = snapshot["storyline_id"]
        current = latest_snapshot_by_storyline.get(storyline_id)
        if current is None or snapshot["bucket_index"] > int(current["bucket_index"]):
            latest_snapshot_by_storyline[storyline_id] = snapshot

    for storyline in bundle.get("stream", {}).get("storylines", []):
        latest_snapshot = latest_snapshot_by_storyline.get(storyline["storyline_id"])
        if latest_snapshot is None or not latest_snapshot.get("viewpoint_ids"):
            issues.append(
                OptimizationIssue(
                    code="latest_bucket_empty",
                    severity="error",
                    message=f"{storyline['storyline_id']} 的最新桶没有 viewpoint，前端会 fallback。",
                    field_path="stream.storyline_snapshots",
                )
            )
            continue
        latest_bucket = int(latest_snapshot["bucket_index"])
        cluster_count = sum(
            1
            for cluster in clusters
            if cluster["storyline_id"] == storyline["storyline_id"] and int(cluster["bucket_index"]) == latest_bucket
        )
        if cluster_count == 0:
            issues.append(
                OptimizationIssue(
                    code="latest_bucket_missing_cluster",
                    severity="error",
                    message=f"{storyline['storyline_id']} 的最新桶缺少 evidence cluster，前端证据视图会 fallback。",
                    field_path="particle_field.evidence_clusters",
                )
            )

    structure_passed = not any(issue.severity == "error" and issue.code in {"analysis_schema", "bundle_schema", "missing_reasoning_pairs", "missing_cluster_pairs", "invalid_representative_comment"} for issue in issues)
    readability_passed = not any(issue.severity == "error" and issue.code in {"placeholder_cluster_label", "storyline_title_length", "storyline_summary_length", "storyline_summary_language", "storyline_grounding", "viewpoint_summary_language", "viewpoint_grounding", "placeholder_text", "placeholder_reasoning", "reasoning_language", "summary_similarity"} for issue in issues)
    frontend_passed = not any(issue.severity == "error" and issue.code in {"latest_bucket_empty", "latest_bucket_missing_cluster", "missing_reasoning_pairs", "missing_cluster_pairs"} for issue in issues)

    if structure_passed and readability_passed and frontend_passed:
        status: OptimizationStatus = "passed"
    else:
        status = "failed"

    return OptimizationReport(
        track_id=track_id,
        status=status,
        structure_passed=structure_passed,
        readability_passed=readability_passed,
        frontend_passed=frontend_passed,
        issues=tuple(issues),
        metrics=metrics,
    )


def format_report_markdown(report: OptimizationReport) -> str:
    lines = [
        f"# {report.track_id} 诊断报告",
        "",
        f"- 总状态: `{report.status}`",
        f"- 结构通过: `{report.structure_passed}`",
        f"- 可读性通过: `{report.readability_passed}`",
        f"- 前端消费通过: `{report.frontend_passed}`",
        "",
        "## Issues",
    ]
    if not report.issues:
        lines.append("- 无")
    else:
        for issue in report.issues:
            lines.append(f"- [{issue.severity}] `{issue.code}` {issue.field_path}: {issue.message}")
    lines.extend(["", "## Metrics"])
    if not report.metrics:
        lines.append("- 无")
    else:
        for key in sorted(report.metrics):
            lines.append(f"- `{key}`: `{report.metrics[key]}`")
    return "\n".join(lines)
