import type { PublishedStoryline, PublishedBundle } from "../loader/publishedTypes";
import type { PrimaryViewKey } from "../state/focusState";

export interface ToneLabel {
  label: string;
  tone: "focus" | "reinforce" | "forecast" | "conflict" | "muted";
}

export function getPrimaryViewLabel(view: PrimaryViewKey): string {
  switch (view) {
    case "storylines":
      return "主线";
    case "relationships":
      return "关系";
    case "evidence":
      return "证据";
    default:
      return view;
  }
}

export function getLogicStatusTone(status: PublishedStoryline["logic_status"]): ToneLabel {
  switch (status) {
    case "stable":
      return { label: "稳定", tone: "reinforce" };
    case "emerging":
      return { label: "涌现", tone: "forecast" };
    case "contested":
      return { label: "争议", tone: "conflict" };
    default:
      return { label: status, tone: "muted" };
  }
}

export function getEvidencePostureTone(
  posture: PublishedStoryline["evidence_posture"]
): ToneLabel {
  switch (posture) {
    case "grounded":
      return { label: "扎实证据", tone: "reinforce" };
    case "mixed":
      return { label: "混合证据", tone: "forecast" };
    case "thin":
      return { label: "证据偏薄", tone: "muted" };
    default:
      return { label: posture, tone: "muted" };
  }
}

export function getRelationTypeTone(relationType: string): ToneLabel {
  switch (relationType) {
    case "reinforces":
      return { label: "增强", tone: "reinforce" };
    case "constrains":
      return { label: "压制", tone: "forecast" };
    case "depends_on":
      return { label: "依赖", tone: "focus" };
    case "competes_with":
      return { label: "竞争", tone: "conflict" };
    case "qualifies":
      return { label: "限定", tone: "muted" };
    default:
      return { label: relationType, tone: "muted" };
  }
}

export function getModelCategoryLabel(
  category: PublishedBundle["meta"]["available_models"][number]["category"]
): string {
  return category === "diffusion" ? "扩散" : "饱和";
}
