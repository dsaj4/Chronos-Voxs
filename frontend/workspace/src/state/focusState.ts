import type { ForecastModelId, PublishedBundle } from "../loader/publishedTypes";
import { resolveFocusForStoryline } from "./focusSelectors";

export type PrimaryViewKey = "storylines" | "relationships" | "evidence";

export interface ViewCameraState {
  panX: number;
  panY: number;
  zoom: number;
}

export type CameraStateByView = Record<PrimaryViewKey, ViewCameraState>;

export interface WorkspaceFocusState {
  activePrimaryView: PrimaryViewKey;
  activeStorylineIds: string[];
  activeViewpointId: string | null;
  activeBucketIndex: number | null;
  selectedModelId: ForecastModelId;
  lastInteractionImpact: string;
  cameraStateByView: CameraStateByView;
}

export type WorkspaceFocusAction =
  | { type: "set_primary_view"; view: PrimaryViewKey }
  | {
      type: "set_storyline_focus";
      storylineIds: string[];
      viewpointId: string | null;
      bucketIndex: number | null;
      message?: string;
    }
  | { type: "set_model"; modelId: ForecastModelId }
  | { type: "sync_focus"; storylineIds: string[]; viewpointId: string | null; bucketIndex: number | null; message?: string }
  | { type: "set_impact"; message: string };

export function createDefaultCameraStateByView(): CameraStateByView {
  return {
    storylines: { panX: 0, panY: 0, zoom: 1 },
    relationships: { panX: 0, panY: 0, zoom: 1 },
    evidence: { panX: 0, panY: 0, zoom: 1 }
  };
}

export function createInitialFocusState(bundle: PublishedBundle): WorkspaceFocusState {
  const primaryStoryline = bundle.stream.storylines.find((storyline) => storyline.display_tier === "primary") ?? bundle.stream.storylines[0] ?? null;
  const resolvedFocus = primaryStoryline ? resolveFocusForStoryline(bundle, primaryStoryline.storyline_id) : null;
  const selectedModelId = bundle.meta.default_model_id;

  return {
    activePrimaryView: "storylines",
    activeStorylineIds: resolvedFocus?.storylineIds ?? [],
    activeViewpointId: resolvedFocus?.viewpointId ?? bundle.neural_map.viewpoints[0]?.viewpoint_id ?? null,
    activeBucketIndex: resolvedFocus?.bucketIndex ?? null,
    selectedModelId,
    lastInteractionImpact: resolvedFocus?.message ?? "初始 bundle 已加载。",
    cameraStateByView: createDefaultCameraStateByView()
  };
}

export function focusReducer(state: WorkspaceFocusState, action: WorkspaceFocusAction): WorkspaceFocusState {
  switch (action.type) {
    case "set_primary_view":
      return {
        ...state,
        activePrimaryView: action.view,
        lastInteractionImpact: `已切换到${action.view === "storylines" ? "主线" : action.view === "relationships" ? "关系" : "证据"}视图。`
      };
    case "set_storyline_focus":
      return {
        ...state,
        activeStorylineIds: action.storylineIds,
        activeViewpointId: action.viewpointId,
        activeBucketIndex: action.bucketIndex,
        lastInteractionImpact: action.message ?? "已更新主线焦点。"
      };
    case "set_model":
      return {
        ...state,
        selectedModelId: action.modelId,
        lastInteractionImpact: `已切换预测模型到 ${action.modelId}。`
      };
    case "sync_focus":
      return {
        ...state,
        activeStorylineIds: action.storylineIds,
        activeViewpointId: action.viewpointId,
        activeBucketIndex: action.bucketIndex,
        lastInteractionImpact: action.message ?? "已从发布 bundle 同步焦点。"
      };
    case "set_impact":
      return {
        ...state,
        lastInteractionImpact: action.message
      };
    default:
      return state;
  }
}
