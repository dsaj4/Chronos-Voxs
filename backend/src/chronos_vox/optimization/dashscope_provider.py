"""DashScope-backed summary provider for the optimization loop."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from http.client import RemoteDisconnected
from typing import Any
from urllib import error, request

from .env import load_local_env_files
from .summaries import ModelReasoningSummary, StorylineSummary, ViewpointSummary


DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"


def _extract_json_object(payload: str) -> dict[str, Any]:
    text = payload.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1]
        text = text.split("```", 1)[0]
    elif "```" in text:
        text = text.split("```", 1)[1]
        text = text.split("```", 1)[0]
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM response did not contain a JSON object")
    return json.loads(text[start : end + 1])


def _clip(value: str, maximum: int) -> str:
    return value if len(value) <= maximum else value[: maximum - 3].rstrip() + "..."


def _clean_text(value: object, maximum: int) -> str:
    return _clip(str(value or "").strip(), maximum)


def _clean_topic_tags(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


@dataclass(frozen=True)
class DashScopeConfig:
    api_key: str
    model: str
    base_url: str = DEFAULT_BASE_URL
    timeout_seconds: int = 25
    max_retries: int = 1


class DashScopeSummaryProvider:
    """Real LLM summary provider using DashScope's OpenAI-compatible endpoint."""

    def __init__(self, config: DashScopeConfig) -> None:
        self._config = config

    @classmethod
    def from_env(cls) -> "DashScopeSummaryProvider | None":
        load_local_env_files()
        api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
        model = os.getenv("DASHSCOPE_MODEL", "").strip() or os.getenv("QWEN_MODEL", "").strip() or "qwen3.5-plus"
        base_url = os.getenv("DASHSCOPE_BASE_URL", "").strip() or DEFAULT_BASE_URL
        timeout_seconds = int(os.getenv("DASHSCOPE_TIMEOUT_SECONDS", "25"))
        max_retries = int(os.getenv("DASHSCOPE_MAX_RETRIES", "1"))
        if not api_key:
            return None
        return cls(
            DashScopeConfig(
                api_key=api_key,
                model=model,
                base_url=base_url,
                timeout_seconds=timeout_seconds,
                max_retries=max_retries,
            )
        )

    @property
    def model(self) -> str:
        return self._config.model

    def _compact_payload(self, value: Any) -> Any:
        if isinstance(value, str):
            return _clip(value.strip(), 240)
        if isinstance(value, list):
            return [self._compact_payload(item) for item in value[:8]]
        if isinstance(value, dict):
            return {str(key): self._compact_payload(item) for key, item in value.items()}
        return value

    def _chat_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        body = {
            "model": self._config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "stream": False,
            "response_format": {"type": "json_object"},
        }
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        req = request.Request(
            self._config.base_url,
            data=payload,
            headers={
                "Authorization": f"Bearer {self._config.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        last_error: Exception | None = None
        for attempt in range(self._config.max_retries + 1):
            try:
                with request.urlopen(req, timeout=self._config.timeout_seconds) as response:
                    raw = json.loads(response.read().decode("utf-8"))
                break
            except error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"DashScope HTTP {exc.code}: {detail}") from exc
            except (error.URLError, TimeoutError, RemoteDisconnected) as exc:
                last_error = exc
                if attempt >= self._config.max_retries:
                    reason = getattr(exc, "reason", str(exc))
                    raise RuntimeError(f"DashScope request failed: {reason}") from exc
                time.sleep(1.5 * (attempt + 1))
        else:
            raise RuntimeError(f"DashScope request failed: {last_error}")

        try:
            content = raw["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Unexpected DashScope response shape: {raw}") from exc
        return _extract_json_object(content)

    def extract_claims(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = self._chat_json(
            system_prompt=(
                "You extract grounded claims from Chinese comment spans. "
                "Return strict JSON only. "
                "Each claim must stay close to the source text and must not invent new facts."
            ),
            user_prompt=(
                "Extract claims from the input spans.\n"
                "Return JSON only in this shape:\n"
                '{"claims":[{"span_id":"","comment_id":"","text":"","stance":"support","topic_tags":[""],"extractor_confidence":0.0}]}\n'
                "Rules:\n"
                "1. Copy span_id and comment_id exactly.\n"
                "2. Do not return evidence offsets.\n"
                "3. stance must be one of support/oppose/mixed/observe.\n"
                "4. If a span does not contain a valid claim, omit it.\n"
                f"Input:\n{json.dumps(self._compact_payload(payload), ensure_ascii=False, indent=2)}"
            ),
        )
        claims = result.get("claims", [])
        if not isinstance(claims, list):
            raise ValueError("DashScope claim extraction did not return a claims list")
        cleaned_claims: list[dict[str, Any]] = []
        for claim in claims:
            if not isinstance(claim, dict):
                continue
            cleaned_claims.append(
                {
                    "span_id": str(claim.get("span_id", "")).strip(),
                    "comment_id": str(claim.get("comment_id", "")).strip(),
                    "text": str(claim.get("text", "")).strip(),
                    "stance": str(claim.get("stance", "observe")).strip(),
                    "topic_tags": _clean_topic_tags(claim.get("topic_tags", [])),
                    "extractor_confidence": max(0.0, min(1.0, float(claim.get("extractor_confidence", 0.7)))),
                }
            )
        return {"claims": cleaned_claims}

    def summarize_viewpoint(self, payload: dict[str, Any]) -> ViewpointSummary:
        result = self._chat_json(
            system_prompt="Write concise grounded Chinese summaries for a viewpoint. Return strict JSON only.",
            user_prompt=(
                'Return JSON: {"viewpoint_label":"","title":"","claim_statement":"","summary":"","summary_grounding_score":0.0}\n'
                "Keep all fields concise and readable in Simplified Chinese.\n"
                f"Input:\n{json.dumps(self._compact_payload(payload), ensure_ascii=False, indent=2)}"
            ),
        )
        return ViewpointSummary(
            viewpoint_label=_clean_text(result.get("viewpoint_label"), 16),
            title=_clean_text(result.get("title"), 32),
            claim_statement=_clean_text(result.get("claim_statement"), 90),
            summary=_clean_text(result.get("summary"), 90),
            summary_grounding_score=max(0.0, min(1.0, float(result.get("summary_grounding_score", 0.8)))),
        )

    def summarize_viewpoints_batch(self, payloads: dict[str, dict[str, Any]]) -> dict[str, ViewpointSummary]:
        result = self._chat_json(
            system_prompt="Write concise grounded Chinese viewpoint summaries in batch. Return strict JSON only.",
            user_prompt=(
                'Return JSON like {"vp_xxx":{"viewpoint_label":"","title":"","claim_statement":"","summary":"","summary_grounding_score":0.0}}\n'
                f"Input:\n{json.dumps(self._compact_payload(payloads), ensure_ascii=False, indent=2)}"
            ),
        )
        summaries: dict[str, ViewpointSummary] = {}
        for key, item in result.items():
            if not isinstance(item, dict):
                continue
            summaries[key] = ViewpointSummary(
                viewpoint_label=_clean_text(item.get("viewpoint_label"), 16),
                title=_clean_text(item.get("title"), 32),
                claim_statement=_clean_text(item.get("claim_statement"), 90),
                summary=_clean_text(item.get("summary"), 90),
                summary_grounding_score=max(0.0, min(1.0, float(item.get("summary_grounding_score", 0.8)))),
            )
        return summaries

    def summarize_storyline(self, payload: dict[str, Any]) -> StorylineSummary:
        result = self._chat_json(
            system_prompt="Write concise grounded Chinese storyline summaries. Return strict JSON only.",
            user_prompt=(
                'Return JSON: {"storyline_label":"","title":"","summary":"","logic_status":"","evidence_posture":""}\n'
                "logic_status must be stable or emerging. evidence_posture must be grounded or mixed.\n"
                f"Input:\n{json.dumps(self._compact_payload(payload), ensure_ascii=False, indent=2)}"
            ),
        )
        logic_status = str(result.get("logic_status", "emerging")).strip()
        evidence_posture = str(result.get("evidence_posture", "grounded")).strip()
        return StorylineSummary(
            storyline_label=_clean_text(result.get("storyline_label"), 16),
            title=_clean_text(result.get("title"), 32),
            summary=_clean_text(result.get("summary"), 90),
            logic_status=logic_status if logic_status in {"stable", "emerging"} else "emerging",
            evidence_posture=evidence_posture if evidence_posture in {"grounded", "mixed"} else "grounded",
        )

    def summarize_storylines_batch(self, payloads: dict[str, dict[str, Any]]) -> dict[str, StorylineSummary]:
        result = self._chat_json(
            system_prompt="Write concise grounded Chinese storyline summaries in batch. Return strict JSON only.",
            user_prompt=(
                'Return JSON like {"st_xxx":{"storyline_label":"","title":"","summary":"","logic_status":"","evidence_posture":""}}\n'
                f"Input:\n{json.dumps(self._compact_payload(payloads), ensure_ascii=False, indent=2)}"
            ),
        )
        summaries: dict[str, StorylineSummary] = {}
        for key, item in result.items():
            if not isinstance(item, dict):
                continue
            logic_status = str(item.get("logic_status", "emerging")).strip()
            evidence_posture = str(item.get("evidence_posture", "grounded")).strip()
            summaries[key] = StorylineSummary(
                storyline_label=_clean_text(item.get("storyline_label"), 16),
                title=_clean_text(item.get("title"), 32),
                summary=_clean_text(item.get("summary"), 90),
                logic_status=logic_status if logic_status in {"stable", "emerging"} else "emerging",
                evidence_posture=evidence_posture if evidence_posture in {"grounded", "mixed"} else "grounded",
            )
        return summaries

    def summarize_model_reasoning(self, payload: dict[str, Any]) -> ModelReasoningSummary:
        result = self._chat_json(
            system_prompt="Write concise Chinese forecast reasoning. Return strict JSON only.",
            user_prompt=(
                'Return JSON: {"assumptions":["",""],"explanation":"","confidence_note":"","comparison_summary":""}\n'
                f"Input:\n{json.dumps(self._compact_payload(payload), ensure_ascii=False, indent=2)}"
            ),
        )
        assumptions = result.get("assumptions", [])
        if not isinstance(assumptions, list):
            assumptions = []
        cleaned_assumptions = tuple(_clean_text(item, 24) for item in assumptions[:2] if str(item).strip())
        if not cleaned_assumptions:
            cleaned_assumptions = ("扩散条件继续成立", "增长会逐步趋缓")
        return ModelReasoningSummary(
            assumptions=cleaned_assumptions,
            explanation=_clean_text(result.get("explanation"), 90),
            confidence_note=_clean_text(result.get("confidence_note"), 90),
            comparison_summary=_clean_text(result.get("comparison_summary"), 90),
        )

    def summarize_model_reasoning_batch(self, payloads: dict[str, dict[str, Any]]) -> dict[str, ModelReasoningSummary]:
        result = self._chat_json(
            system_prompt="Write concise Chinese forecast reasoning in batch. Return strict JSON only.",
            user_prompt=(
                'Return JSON like {"st_001__bass_diffusion":{"assumptions":["",""],"explanation":"","confidence_note":"","comparison_summary":""}}\n'
                f"Input:\n{json.dumps(self._compact_payload(payloads), ensure_ascii=False, indent=2)}"
            ),
        )
        summaries: dict[str, ModelReasoningSummary] = {}
        for key, item in result.items():
            if not isinstance(item, dict):
                continue
            assumptions = item.get("assumptions", [])
            if not isinstance(assumptions, list):
                assumptions = []
            cleaned_assumptions = tuple(_clean_text(value, 24) for value in assumptions[:2] if str(value).strip())
            if not cleaned_assumptions:
                cleaned_assumptions = ("扩散条件继续成立", "增长会逐步趋缓")
            summaries[key] = ModelReasoningSummary(
                assumptions=cleaned_assumptions,
                explanation=_clean_text(item.get("explanation"), 90),
                confidence_note=_clean_text(item.get("confidence_note"), 90),
                comparison_summary=_clean_text(item.get("comparison_summary"), 90),
            )
        return summaries

    def summarize_case_title(self, payload: dict[str, Any]) -> str:
        result = self._chat_json(
            system_prompt="Write a short professional Chinese case title. Return strict JSON only.",
            user_prompt=(
                'Return JSON: {"case_title":""}\n'
                f"Input:\n{json.dumps(self._compact_payload(payload), ensure_ascii=False, indent=2)}"
            ),
        )
        return _clean_text(result.get("case_title"), 32)

    def summarize_cluster_label(self, payload: dict[str, Any]) -> str:
        result = self._chat_json(
            system_prompt="Write a short Chinese evidence-cluster label. Return strict JSON only.",
            user_prompt=(
                'Return JSON: {"cluster_label":""}\n'
                f"Input:\n{json.dumps(self._compact_payload(payload), ensure_ascii=False, indent=2)}"
            ),
        )
        return _clean_text(result.get("cluster_label"), 18)
