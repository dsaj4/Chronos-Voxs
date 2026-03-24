"""Simple in-memory cache helpers for claim extraction."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .audit import stable_input_hash


@dataclass
class ClaimExtractionCache:
    _store: dict[str, dict[str, Any]] = field(default_factory=dict)

    def get(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        return self._store.get(stable_input_hash(payload))

    def put(self, payload: dict[str, Any], result: dict[str, Any]) -> None:
        self._store[stable_input_hash(payload)] = result


def build_cache_record(status: str, claims: list[dict[str, Any]], audit_entry: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "status": status,
        "claims": claims,
        "audit_entry": audit_entry,
    }
