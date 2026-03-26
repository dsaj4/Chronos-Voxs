from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.optimization.dashscope_provider import (  # noqa: E402
    DashScopeConfig,
    DashScopeSummaryProvider,
    _extract_json_object,
)
from chronos_vox.optimization.env import load_local_env_files  # noqa: E402
from chronos_vox.optimization.runner import build_llm_summary_track_from_env  # noqa: E402


def test_extract_json_object_accepts_markdown_wrapped_json() -> None:
    payload = """```json
    {"title":"主线标题","summary":"一段中文摘要"}
    ```"""
    assert _extract_json_object(payload) == {"title": "主线标题", "summary": "一段中文摘要"}


def test_load_local_env_files_reads_dashscope_local(monkeypatch, tmp_path: Path) -> None:
    env_file = tmp_path / ".env.dashscope.local"
    env_file.write_text("DASHSCOPE_API_KEY=test-key\nDASHSCOPE_MODEL=qwen3.5-plus\n", encoding="utf-8")
    monkeypatch.setattr("chronos_vox.optimization.env._repo_root", lambda: tmp_path)
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    monkeypatch.delenv("DASHSCOPE_MODEL", raising=False)

    load_local_env_files()

    assert build_llm_summary_track_from_env().is_configured is True


def test_dashscope_provider_builds_openai_compatible_request(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "case_title": "AI Agent 实战落地调优样本",
                                    },
                                    ensure_ascii=False,
                                )
                            }
                        }
                    ]
                },
                ensure_ascii=False,
            ).encode("utf-8")

    def fake_urlopen(req, timeout):  # type: ignore[no-untyped-def]
        captured["url"] = req.full_url
        captured["auth"] = req.headers.get("Authorization")
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("chronos_vox.optimization.dashscope_provider.request.urlopen", fake_urlopen)

    provider = DashScopeSummaryProvider(
        DashScopeConfig(
            api_key="secret",
            model="qwen3.5-plus",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            timeout_seconds=30,
        )
    )

    title = provider.summarize_case_title({"topic_tag": "ai_agent_practicalization"})

    assert title == "AI Agent 实战落地调优样本"
    assert captured["url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    assert captured["auth"] == "Bearer secret"
    assert captured["body"]["model"] == "qwen3.5-plus"
    assert captured["body"]["response_format"] == {"type": "json_object"}
    assert captured["timeout"] == 30
