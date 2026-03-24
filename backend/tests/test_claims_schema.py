from __future__ import annotations

import pytest

from chronos_vox.claims.schema import ensure_valid_claim_extraction_output, validate_claim_extraction_output


def test_claim_extraction_schema_accepts_valid_payload() -> None:
    payload = {
        "claims": [
            {
                "text": "AI agent should start with workflow automation.",
                "evidence_start": 0,
                "evidence_end": 42,
                "stance": "support",
                "topic_tags": ["ai_agent_practicalization"],
                "extractor_confidence": 0.93,
            }
        ]
    }

    assert validate_claim_extraction_output(payload) == []
    ensure_valid_claim_extraction_output(payload)


def test_claim_extraction_schema_rejects_missing_claims() -> None:
    payload = {"claims": [{"text": "missing fields"}]}

    errors = validate_claim_extraction_output(payload)

    assert errors
    assert any("evidence_start" in error for error in errors)
    with pytest.raises(ValueError, match="Invalid claim extraction output"):
        ensure_valid_claim_extraction_output(payload)
