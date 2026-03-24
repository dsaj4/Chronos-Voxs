from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from chronos_vox.normalize import normalize_raw_comment, normalize_raw_comments


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "shared"
    / "fixtures"
    / "golden-analysis-state.ai-agent-practicalization.json"
)


def load_golden_state() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8-sig"))


def test_normalize_raw_comments_is_deterministic_and_preserves_contract_shape() -> None:
    state = load_golden_state()
    raw_comments = state["raw_comments"]

    first_pass = normalize_raw_comments(raw_comments)
    second_pass = normalize_raw_comments(raw_comments)

    assert first_pass == second_pass
    assert len(first_pass) == len(raw_comments)

    expected_keys = {
        "comment_id",
        "raw_comment_id",
        "platform",
        "source_item_id",
        "source_comment_id",
        "canonical_text",
        "normalized_text",
        "language",
        "source_class",
        "quality_score",
        "noise_flags",
        "dedupe_key",
        "created_at",
        "collected_at",
        "topic_tags",
        "metadata",
    }

    for actual, source in zip(first_pass, raw_comments, strict=True):
        assert set(actual) == expected_keys
        assert actual["raw_comment_id"] == source["raw_comment_id"]
        assert actual["canonical_text"] == source["text"].strip()
        assert actual["comment_id"].startswith("norm_")
        assert actual["dedupe_key"].startswith("dup_")
        assert isinstance(actual["quality_score"], float)
        assert 0.0 <= actual["quality_score"] <= 1.0
        assert actual["metadata"]["normalizer_version"] == "deterministic-v1"


def test_golden_fixture_comments_match_expected_normalization_baseline() -> None:
    state = load_golden_state()
    normalized = normalize_raw_comments(state["raw_comments"])

    expected = state["normalized_comments"]
    assert [item["source_class"] for item in normalized] == [item["source_class"] for item in expected]
    assert [item["topic_tags"] for item in normalized] == [item["topic_tags"] for item in expected]
    assert [item["normalized_text"] for item in normalized] == [item["normalized_text"] for item in expected]
    assert [item["language"] for item in normalized] == [item["language"] for item in expected]

    for actual, golden in zip(normalized, expected, strict=True):
        assert actual["comment_id"] == golden["comment_id"]
        assert actual["raw_comment_id"] == golden["raw_comment_id"]
        assert actual["dedupe_key"] == golden["dedupe_key"]
        assert actual["canonical_text"] == golden["canonical_text"]
        assert actual["metadata"]["normalizer_version"] == golden["metadata"]["normalizer_version"]


def test_normalize_single_comment_remains_stable_across_calls() -> None:
    state = load_golden_state()
    raw_comment = state["raw_comments"][0]

    first = normalize_raw_comment(raw_comment)
    second = normalize_raw_comment(raw_comment)

    assert first == second
    assert first["noise_flags"] == []
    assert first["language"] == "zh-CN"
