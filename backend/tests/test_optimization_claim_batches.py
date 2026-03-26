from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.optimization.models import OptimizationConfig  # noqa: E402
from chronos_vox.optimization.pipeline import (  # noqa: E402
    _pack_claim_candidate_batches,
    assemble_analysis_state,
    build_claim_candidate_spans,
)
from chronos_vox.optimization.summaries import DeterministicSummaryProvider  # noqa: E402
from chronos_vox.optimization.synthetic import build_synthetic_raw_comments  # noqa: E402
from chronos_vox.normalize import normalize_raw_comments  # noqa: E402


class BatchedClaimProvider(DeterministicSummaryProvider):
    def __init__(self) -> None:
        self.payloads: list[dict[str, object]] = []
        self.model = "batched-claims-test"

    def extract_claims(self, payload: dict[str, object]) -> dict[str, object]:
        self.payloads.append(payload)
        claims = []
        for span in payload["spans"]:
            claims.append(
                {
                    "span_id": span["span_id"],
                    "comment_id": span["comment_id"],
                    "text": f"Batch claim for {span['comment_id']}",
                    "stance": "support",
                    "topic_tags": ["ai_agent_practicalization"],
                    "extractor_confidence": 0.88,
                }
            )
        return {"claims": claims}


def test_pack_claim_candidate_batches_respects_char_limit() -> None:
    config = OptimizationConfig(claim_batch_char_limit=120)
    normalized = normalize_raw_comments(build_synthetic_raw_comments(config))
    spans = build_claim_candidate_spans(normalized, config)

    batches = _pack_claim_candidate_batches(spans[:5], char_limit=120)

    assert len(batches) >= 2
    assert sum(len(batch) for batch in batches) == len(spans[:5])


def test_assemble_analysis_state_uses_batched_llm_claim_extraction() -> None:
    config = OptimizationConfig(claim_batch_char_limit=220)
    provider = BatchedClaimProvider()

    analysis_state = assemble_analysis_state(
        config=config,
        raw_comments=build_synthetic_raw_comments(config),
        summary_provider=provider,
        prompt_version=config.llm_prompt_version,
    )

    assert len(provider.payloads) >= 2
    assert sorted(provider.payloads[0]["spans"][0].keys()) == ["comment_id", "span_id", "text"]
    assert analysis_state["claims"]
    assert all(claim["extractor"]["provider"] == "BatchedClaimProvider" for claim in analysis_state["claims"])
    assert all(claim["evidence_start"] == 0 for claim in analysis_state["claims"])
    assert all(claim["evidence_end"] == len(claim["evidence_text"]) for claim in analysis_state["claims"])
    assert analysis_state["llm_audit_log"]
    assert analysis_state["diagnostics"]["accepted_claim_count"] == len(analysis_state["claims"])
    assert analysis_state["diagnostics"]["claim_batch_count"] >= 2
    assert analysis_state["diagnostics"]["claim_serialized_char_count"] > 0
    assert analysis_state["diagnostics"]["claim_estimated_input_tokens"] > 0
