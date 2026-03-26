"""Run Chronos-Vox analysis from a materialized normalized comment batch."""

from __future__ import annotations

import json
from dataclasses import replace
from datetime import date
from pathlib import Path
import re
from typing import Any

from ..optimization import DashScopeSummaryProvider, DeterministicSummaryProvider, OptimizationConfig
from ..optimization.fallback_provider import FallbackSummaryProvider
from ..optimization.pipeline import assemble_analysis_state_from_normalized_comments
from ..publish import build_forecast_bundle


def canonicalize_text(value: object) -> str:
    return str(value or "").strip()


def slugify(value: object) -> str:
    cleaned = canonicalize_text(value).lower()
    cleaned = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "item"


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_normalized_batch_payload(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_runtime_config(batch_payload: dict[str, Any], base: OptimizationConfig | None = None) -> OptimizationConfig:
    config = base or OptimizationConfig()
    manifest = dict(batch_payload.get("manifest", {}))
    time_range = dict(manifest.get("time_range", {}))
    start_date = canonicalize_text(time_range.get("start_at")) or config.start_date
    end_date = canonicalize_text(time_range.get("end_at")) or start_date
    try:
        bucket_count = max(1, (date.fromisoformat(end_date) - date.fromisoformat(start_date)).days + 1)
    except ValueError:
        bucket_count = config.bucket_count

    dataset_id = canonicalize_text(batch_payload.get("dataset_id")) or config.case_id
    keyword = canonicalize_text(manifest.get("keyword")) or dataset_id
    topic_tag = slugify(keyword).replace("_", "-") or config.topic_tag
    return replace(
        config,
        case_id=dataset_id,
        topic_tag=topic_tag,
        start_date=start_date,
        bucket_count=bucket_count,
    )


def _build_summary_provider(use_llm: bool) -> Any:
    deterministic = DeterministicSummaryProvider()
    if not use_llm:
        return deterministic
    provider = DashScopeSummaryProvider.from_env()
    if provider is None:
        return deterministic
    return FallbackSummaryProvider(provider, deterministic)


def run_analysis_from_batch(
    *,
    batch_payload: dict[str, Any],
    analysis_state_path: Path,
    bundle_path: Path,
    bundle_uri: str | None = None,
    config: OptimizationConfig | None = None,
    use_llm: bool = True,
) -> dict[str, Any]:
    runtime_config = build_runtime_config(batch_payload, base=config)
    raw_comments = [dict(item) for item in batch_payload.get("raw_comments", [])]
    normalized_comments = [dict(item) for item in batch_payload.get("normalized_comments", [])]
    if not raw_comments or not normalized_comments:
        raise ValueError("normalized batch payload must include raw_comments and normalized_comments")

    summary_provider = _build_summary_provider(use_llm)
    analysis_state = assemble_analysis_state_from_normalized_comments(
        config=runtime_config,
        raw_comments=raw_comments,
        normalized_comments=normalized_comments,
        summary_provider=summary_provider,
        prompt_version=runtime_config.llm_prompt_version if use_llm else runtime_config.prompt_version,
    )
    analysis_state["analysis_id"] = canonicalize_text(batch_payload.get("analysis_id")) or analysis_state["analysis_id"]
    bundle = build_forecast_bundle(
        analysis_state,
        fixture_id=f"{runtime_config.case_id}-real-data-v1",
        default_model_id="bass_diffusion",
    )

    _write_json(analysis_state_path, analysis_state)
    _write_json(bundle_path, bundle)
    return {
        "analysis_state": analysis_state,
        "bundle": bundle,
        "analysis_state_path": str(analysis_state_path.resolve()),
        "bundle_path": str(bundle_path.resolve()),
        "bundle_uri": bundle_uri or str(bundle_path.resolve()),
        "provider": getattr(summary_provider, "model", "deterministic"),
    }
