"""Environment helpers for optimization-time provider configuration."""

from __future__ import annotations

import os
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def load_local_env_files() -> None:
    """Load local `.env` files into the current process without overriding existing vars."""

    for path in (
        _repo_root() / ".env.dashscope.local",
        _repo_root() / ".env.local",
        _repo_root() / ".env",
    ):
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            normalized_key = key.strip().lstrip("\ufeff")
            os.environ.setdefault(normalized_key, value.strip().strip('"').strip("'"))
