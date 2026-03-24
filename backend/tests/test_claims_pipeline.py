from __future__ import annotations

from dataclasses import dataclass

from chronos_vox.claims import (
    ClaimCandidateSpan,
    ClaimExtractionCache,
    ClaimExtractionRequest,
    ClaimExtractionRetryPlan,
    extract_claims,
    select_claim_candidate_spans,
)


def _valid_claim_output() -> dict[str, object]:
    return {
        "claims": [
            {
                "text": "AI agents should begin with workflow automation.",
                "evidence_start": 0,
                "evidence_end": 52,
                "stance": "support",
                "topic_tags": ["ai_agent_practicalization", "workflow_automation"],
                "extractor_confidence": 0.94,
            }
        ]
    }


@dataclass
class StubProvider:
    outputs: list[dict[str, object]]
    calls: int = 0

    def extract_claims(self, payload: dict[str, object]) -> dict[str, object]:
        del payload
        self.calls += 1
        if not self.outputs:
            return {"claims": []}
        return self.outputs.pop(0)


def _accepted_span() -> ClaimCandidateSpan:
    return ClaimCandidateSpan(
        span_id="span_1",
        comment_id="comment_1",
        text="AI agent should start with workflow automation.",
        start_char=0,
        end_char=52,
        heuristic_labels=("assertion", "workflow"),
        candidate_score=0.91,
        metadata={"source": "unit-test"},
    )


def _rejected_span() -> ClaimCandidateSpan:
    return ClaimCandidateSpan(
        span_id="span_2",
        comment_id="comment_2",
        text="too short",
        start_char=10,
        end_char=10,
        heuristic_labels=("noise",),
        candidate_score=0.2,
        metadata={"source": "unit-test"},
    )


def test_select_claim_candidate_spans_filters_low_confidence_spans() -> None:
    spans = (_accepted_span(), _rejected_span())

    selected = select_claim_candidate_spans(spans)

    assert [span.span_id for span in selected] == ["span_1"]


def test_extract_claims_accepts_valid_output_and_populates_audit() -> None:
    provider = StubProvider(outputs=[_valid_claim_output()])
    request = ClaimExtractionRequest(spans=(_accepted_span(),), case_id="case_1", provider="stub", model="stub-model")

    outcome = extract_claims(request, provider)

    assert outcome.status == "success"
    assert outcome.cache_hit is False
    assert provider.calls == 1
    assert len(outcome.claims) == 1
    assert outcome.claims[0]["text"] == "AI agents should begin with workflow automation."
    assert len(outcome.audit_entries) == 1
    assert outcome.audit_entries[0]["status"] == "success"
    assert outcome.audit_entries[0]["metadata"]["span_count"] == 1


def test_extract_claims_uses_cache_on_second_run() -> None:
    cache = ClaimExtractionCache()
    provider = StubProvider(outputs=[_valid_claim_output()])
    request = ClaimExtractionRequest(spans=(_accepted_span(),), case_id="case_1", provider="stub", model="stub-model")

    first = extract_claims(request, provider, cache=cache)
    second = extract_claims(request, provider, cache=cache)

    assert first.status == "success"
    assert second.status == "success"
    assert second.cache_hit is True
    assert provider.calls == 1
    assert second.claims == first.claims
    assert second.audit_entries[0]["status"] == "success"


def test_extract_claims_retries_once_before_succeeding() -> None:
    provider = StubProvider(
        outputs=[
            {"claims": [{"text": "broken"}]},
            _valid_claim_output(),
        ]
    )
    request = ClaimExtractionRequest(spans=(_accepted_span(),), case_id="case_1", provider="stub", model="stub-model")

    outcome = extract_claims(request, provider, retry_plan=ClaimExtractionRetryPlan(max_attempts=2))

    assert outcome.status == "success"
    assert provider.calls == 2
    assert len(outcome.audit_entries) == 2
    assert outcome.audit_entries[0]["status"] == "retry"
    assert outcome.audit_entries[1]["status"] == "success"


def test_extract_claims_isolates_low_confidence_spans_without_provider_call() -> None:
    provider = StubProvider(outputs=[_valid_claim_output()])
    request = ClaimExtractionRequest(spans=(_rejected_span(),), case_id="case_1", provider="stub", model="stub-model")

    outcome = extract_claims(request, provider)

    assert outcome.status == "invalid"
    assert "no accepted candidate spans" in outcome.error_message
    assert provider.calls == 0
    assert outcome.claims == ()
    assert outcome.audit_entries == ()


def test_extract_claims_returns_invalid_result_for_bad_provider_output() -> None:
    provider = StubProvider(outputs=[{"not_claims": []}])
    request = ClaimExtractionRequest(spans=(_accepted_span(),), case_id="case_1", provider="stub", model="stub-model")

    outcome = extract_claims(request, provider, retry_plan=ClaimExtractionRetryPlan(max_attempts=1))

    assert outcome.status == "invalid"
    assert provider.calls == 1
    assert outcome.claims == ()
    assert outcome.audit_entries[0]["status"] == "fallback"
