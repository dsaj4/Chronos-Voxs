"""Summary-track builders for synthetic phase-1 optimization."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol


def _clip(value: str, maximum: int) -> str:
    if len(value) <= maximum:
        return value
    return f"{value[: maximum - 1]}…"


@dataclass(frozen=True)
class ViewpointSummary:
    viewpoint_label: str
    title: str
    claim_statement: str
    summary: str
    summary_grounding_score: float


@dataclass(frozen=True)
class StorylineSummary:
    storyline_label: str
    title: str
    summary: str
    logic_status: str
    evidence_posture: str


@dataclass(frozen=True)
class ModelReasoningSummary:
    assumptions: tuple[str, ...]
    explanation: str
    confidence_note: str
    comparison_summary: str


class OptimizationSummaryProvider(Protocol):
    def summarize_viewpoint(self, payload: Mapping[str, Any]) -> ViewpointSummary:
        ...

    def summarize_storyline(self, payload: Mapping[str, Any]) -> StorylineSummary:
        ...

    def summarize_model_reasoning(self, payload: Mapping[str, Any]) -> ModelReasoningSummary:
        ...

    def summarize_case_title(self, payload: Mapping[str, Any]) -> str:
        ...

    def summarize_cluster_label(self, payload: Mapping[str, Any]) -> str:
        ...


class DeterministicSummaryProvider:
    """Readable, reproducible text generation for synthetic optimization."""

    def summarize_viewpoint(self, payload: Mapping[str, Any]) -> ViewpointSummary:
        cluster_key = str(payload["cluster_key"])
        evidence_count = int(payload["support_count"])
        keywords = list(payload.get("keywords", []))
        if cluster_key == "pragmatic_adoption":
            return ViewpointSummary(
                viewpoint_label="务实落地打法",
                title="Agent 先接流程再扩权更容易落地",
                claim_statement="Agent 的首个稳定价值来自半自动流程接管，而不是一步到位的全自动替代。",
                summary=_clip(
                    f"样本里多条高质量评论都把 Agent 的落地点放在重复流程、审批流、半自动协同和避免全自动冒进上，支持数达到 {evidence_count}。",
                    86,
                ),
                summary_grounding_score=0.91,
            )
        if cluster_key == "integration_roi":
            return ViewpointSummary(
                viewpoint_label="系统集成收益",
                title="接 CRM 和工单后 Agent 的 ROI 最直观",
                claim_statement="当 Agent 接入 CRM、工单和 API 节点时，效率收益会比孤立聊天能力更清楚。",
                summary=_clip(
                    f"证据主要集中在 CRM、工单、webhook 和 API 集成后的效率改善，关键词包括 {'/'.join(keywords[:3])}。",
                    86,
                ),
                summary_grounding_score=0.93,
            )
        return ViewpointSummary(
            viewpoint_label="部署与运维摩擦",
            title="部署维护成本仍在拖慢 Agent 扩张",
            claim_statement="deploy、权限、日志和维护值班成本，仍然是当前 Agent 规模化的主要阻力。",
            summary=_clip(
                f"负向评论稳定指向 deploy 成本、维护值班和权限审计压力，这条摩擦线目前积累了 {evidence_count} 条有效支持。",
                86,
            ),
            summary_grounding_score=0.9,
        )

    def summarize_storyline(self, payload: Mapping[str, Any]) -> StorylineSummary:
        storyline_key = str(payload["storyline_key"])
        support_count = int(payload["support_count"])
        viewpoint_count = int(payload["viewpoint_count"])
        if storyline_key == "adoption_storyline":
            return StorylineSummary(
                storyline_label="务实落地线",
                title="Agent 正在沿流程接入与系统集成加速落地",
                summary=_clip(
                    f"当前主线由 {viewpoint_count} 个互相增强的观点构成，核心叙事是 Agent 先接流程，再接 CRM、工单和 API 节点完成系统集成并加速落地，累计支持 {support_count}。",
                    88,
                ),
                logic_status="stable",
                evidence_posture="grounded",
            )
        return StorylineSummary(
            storyline_label="部署摩擦线",
            title="部署与维护压力继续压制 Agent 扩张",
            summary=_clip(
                f"另一条主线持续强调 deploy、权限和维护复杂度对 Agent 扩张的压制，这条线当前有 {support_count} 条稳定支持。",
                88,
            ),
            logic_status="emerging",
            evidence_posture="grounded",
        )

    def summarize_model_reasoning(self, payload: Mapping[str, Any]) -> ModelReasoningSummary:
        model_id = str(payload["model_id"])
        storyline_label = str(payload["storyline_label"])
        storyline_title = str(payload["storyline_title"])
        if model_id == "bass_diffusion":
            return ModelReasoningSummary(
                assumptions=("流程接入继续扩散", "系统集成节点继续增加"),
                explanation=f"{storyline_title} 在 Bass 视角下仍处于扩散阶段，后续热度会沿相邻业务场景继续外溢。",
                confidence_note=f"{storyline_label} 的当前证据较扎实，但越往后预测不确定性越高。",
                comparison_summary="Bass 相比 Gompertz 更乐观，认为扩散速度还没有触顶。",
            )
        return ModelReasoningSummary(
            assumptions=("摩擦不会立刻消失", "后续增长会更快进入平台期"),
            explanation=f"{storyline_title} 在 Gompertz 视角下会更早进入放缓阶段，增长仍在但斜率会收敛。",
            confidence_note=f"{storyline_label} 的未来走势更容易受部署治理与预算收紧影响，置信度中等偏低。",
            comparison_summary="Gompertz 相比 Bass 更保守，认为热度会更早趋稳。",
        )

    def summarize_case_title(self, payload: Mapping[str, Any]) -> str:
        topic = str(payload.get("topic_tag", "ai_agent_practicalization"))
        if topic == "ai_agent_practicalization":
            return "AI Agent 实战落地调优样本"
        return "Chronos-Vox 模拟调优样本"

    def summarize_cluster_label(self, payload: Mapping[str, Any]) -> str:
        base_label = str(payload.get("storyline_label") or payload.get("viewpoint_label") or "证据")
        if base_label.endswith("证据簇"):
            return base_label
        return _clip(f"{base_label}证据簇", 18)


class LlmSummaryTrack:
    """Optional real-LLM summary track wrapper."""

    def __init__(self, provider: OptimizationSummaryProvider | None = None) -> None:
        self.provider = provider

    @property
    def is_configured(self) -> bool:
        return self.provider is not None
