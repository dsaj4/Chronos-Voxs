"""JSON schema validation helpers for claim extraction outputs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


_ROOT = Path(__file__).resolve().parents[4]
_SCHEMA_PATH = _ROOT / "shared" / "schemas" / "claim-extraction-output.schema.json"
_SCHEMA_CACHE: dict[str, Any] | None = None


def load_claim_extraction_schema() -> dict[str, Any]:
    global _SCHEMA_CACHE
    if _SCHEMA_CACHE is None:
        with _SCHEMA_PATH.open("r", encoding="utf-8") as handle:
            _SCHEMA_CACHE = json.load(handle)
    return _SCHEMA_CACHE


def validate_claim_extraction_output(payload: dict[str, Any]) -> list[str]:
    schema = load_claim_extraction_schema()
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.absolute_path))
    return [f"{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}" for error in errors]


def ensure_valid_claim_extraction_output(payload: dict[str, Any]) -> None:
    errors = validate_claim_extraction_output(payload)
    if errors:
        raise ValueError("Invalid claim extraction output:\n" + "\n".join(errors))
