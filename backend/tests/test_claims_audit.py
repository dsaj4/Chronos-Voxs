from __future__ import annotations

from chronos_vox.claims.audit import create_llm_audit_entry, stable_input_hash


def test_stable_input_hash_is_order_insensitive_for_dicts() -> None:
    left = {"case_id": "case_1", "spans": [{"span_id": "span_1", "candidate_score": 0.9}]}
    right = {"spans": [{"candidate_score": 0.9, "span_id": "span_1"}], "case_id": "case_1"}

    assert stable_input_hash(left) == stable_input_hash(right)


def test_create_llm_audit_entry_populates_expected_metadata() -> None:
    audit = create_llm_audit_entry(
        task_kind="claim_extraction",
        provider="stub",
        model="stub-model",
        prompt_version="claims.v1",
        input_hash="abc123",
        status="retry",
        cache_hit=False,
        metadata={"span_count": 2},
    )

    assert audit["audit_id"].startswith("audit_claim_extraction_")
    assert audit["task_kind"] == "claim_extraction"
    assert audit["provider"] == "stub"
    assert audit["model"] == "stub-model"
    assert audit["input_hash"] == "abc123"
    assert audit["status"] == "retry"
    assert audit["cache_hit"] is False
    assert audit["metadata"] == {"span_count": 2}
    assert audit["created_at"].endswith("Z")
