import type { PublishedStoryline, PublishedBundle } from "../loader/publishedTypes";
import type { PrimaryViewKey } from "../state/focusState";

export interface ToneLabel {
  label: string;
  tone: "focus" | "reinforce" | "forecast" | "conflict" | "muted";
}

export interface StreamColor {
  fill: string;
  stroke: string;
  label: string;
}

export const STREAM_COLORS: StreamColor[] = [
  { fill: "#C0541A", stroke: "#E8703A", label: "#E8703A" },
  { fill: "#1A7A8A", stroke: "#56CCF2", label: "#56CCF2" },
  { fill: "#5B3A8A", stroke: "#9B6FD4", label: "#9B6FD4" },
  { fill: "#1A5C3A", stroke: "#6FCF97", label: "#6FCF97" }
];

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

export function getRelationTypeTone(relationType: string | null): ToneLabel {
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
      return { label: relationType ?? "主线", tone: "muted" };
  }
}

export function getModelCategoryLabel(
  category: PublishedBundle["meta"]["available_models"][number]["category"]
): string {
  return category === "diffusion" ? "扩散" : "饱和";
}
