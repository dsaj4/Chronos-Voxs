"""LLM audit helpers for claim extraction."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def stable_input_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode(
        "utf-8"
    )
    return sha256(canonical).hexdigest()


def create_llm_audit_entry(
    *,
    task_kind: str,
    provider: str,
    model: str,
    prompt_version: str,
    input_hash: str,
    status: str = "success",
    cache_hit: bool = False,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "audit_id": f"audit_{task_kind}_{input_hash[:12]}",
        "task_kind": task_kind,
        "provider": provider,
        "model": model,
        "prompt_version": prompt_version,
        "input_hash": input_hash,
        "status": status,
        "cache_hit": cache_hit,
        "created_at": _utc_now(),
        "metadata": metadata or {},
    }
