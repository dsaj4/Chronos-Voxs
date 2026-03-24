from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "shared" / "schemas"
FIXTURES = ROOT / "shared" / "fixtures"


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate(schema_name: str, fixture_name: str) -> None:
    schema_path = SCHEMAS / schema_name
    fixture_path = FIXTURES / fixture_name

    schema = load_json(schema_path)
    fixture = load_json(fixture_path)

    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(fixture), key=lambda error: list(error.absolute_path))

    if errors:
        messages = [f"{fixture_name} failed validation against {schema_name}:"]
        messages.extend(
            f"- {'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}"
            for error in errors
        )
        raise SystemExit("\n".join(messages))

    print(f"[ok] {fixture_name} matches {schema_name}")


def main() -> None:
    validate(
        "analysis-state.schema.json",
        "golden-analysis-state.ai-agent-practicalization.json",
    )
    validate(
        "forecast-bundle.schema.json",
        "golden-forecast-bundle.ai-agent-practicalization.json",
    )
    print("[done] shared contracts and golden fixtures are valid")


if __name__ == "__main__":
    main()
