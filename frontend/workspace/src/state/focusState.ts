import {
  DEFAULT_BASS_PARAMS,
  DEFAULT_GOMPERTZ_PARAMS,
  type BassParams,
  type GompertzParams
} from "../forecast/modelCalculations";
import type { ForecastModelId, PublishedBundle } from "../loader/publishedTypes";
import { resolveFocusForStoryline } from "./focusSelectors";

export type PrimaryViewKey = "storylines" | "relationships" | "evidence";

export interface ViewCameraState {
  panX: number;
  panY: number;
  zoom: number;
}

export type CameraStateByView = Record<PrimaryViewKey, ViewCameraState>;

export interface ModelParamsById {
  bass_diffusion: BassParams;
  gompertz: GompertzParams;
}

export interface SavedModelPreset {
  id: string;
  name: string;
  modelId: ForecastModelId;
  params: BassParams | GompertzParams;
  createdAt: number;
}

export interface WorkspaceFocusState {
  activePrimaryView: PrimaryViewKey;
  activeStorylineIds: string[];
  activeViewpointId: string | null;
  activeBucketIndex: number | null;
  selectedModelId: ForecastModelId;
  lastInteractionImpact: string;
  cameraStateByView: CameraStateByView;
  modelParamsById: ModelParamsById;
  appliedModelParamsById: ModelParamsById | null;
  savedModelPresets: SavedModelPreset[];
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
  | {
      type: "sync_focus";
      storylineIds: string[];
      viewpointId: string | null;
      bucketIndex: number | null;
      message?: string;
    }
  | { type: "set_impact"; message: string }
  | { type: "set_model_params"; modelId: ForecastModelId; params: BassParams | GompertzParams }
  | { type: "apply_model_params" }
  | { type: "reset_model_params" }
  | { type: "save_model_preset"; name: string }
  | { type: "delete_model_preset"; id: string }
  | { type: "load_model_preset"; id: string };

export function createDefaultCameraStateByView(): CameraStateByView {
  return {
    storylines: { panX: 0, panY: 0, zoom: 1 },
    relationships: { panX: 0, panY: 0, zoom: 1 },
    evidence: { panX: 0, panY: 0, zoom: 1 }
  };
}

export function createDefaultModelParamsById(): ModelParamsById {
  return {
    bass_diffusion: { ...DEFAULT_BASS_PARAMS },
    gompertz: { ...DEFAULT_GOMPERTZ_PARAMS }
  };
}

export function createInitialFocusState(bundle: PublishedBundle): WorkspaceFocusState {
  const primaryStoryline =
    bundle.stream.storylines.find((storyline) => storyline.display_tier === "primary") ??
    bundle.stream.storylines[0] ??
    null;
  const resolvedFocus = primaryStoryline ? resolveFocusForStoryline(bundle, primaryStoryline.storyline_id) : null;

  return {
    activePrimaryView: "storylines",
    activeStorylineIds: resolvedFocus?.storylineIds ?? [],
    activeViewpointId: resolvedFocus?.viewpointId ?? bundle.neural_map.viewpoints[0]?.viewpoint_id ?? null,
    activeBucketIndex: resolvedFocus?.bucketIndex ?? null,
    selectedModelId: bundle.meta.default_model_id,
    lastInteractionImpact: resolvedFocus?.message ?? "\u521d\u59cb bundle \u5df2\u52a0\u8f7d\u3002",
    cameraStateByView: createDefaultCameraStateByView(),
    modelParamsById: createDefaultModelParamsById(),
    appliedModelParamsById: null,
    savedModelPresets: []
  };
}

function createViewLabel(view: PrimaryViewKey) {
  if (view === "storylines") {
    return "\u4e3b\u7ebf";
  }
  if (view === "relationships") {
    return "\u5173\u7cfb";
  }
  return "\u8bc1\u636e";
}

function createModelLabel(modelId: ForecastModelId) {
  return modelId === "bass_diffusion" ? "Bass Diffusion" : "Gompertz";
}

export function focusReducer(state: WorkspaceFocusState, action: WorkspaceFocusAction): WorkspaceFocusState {
  switch (action.type) {
    case "set_primary_view":
      return {
        ...state,
        activePrimaryView: action.view,
        lastInteractionImpact: `\u5df2\u5207\u6362\u5230${createViewLabel(action.view)}\u89c6\u56fe\u3002`
      };
    case "set_storyline_focus":
      return {
        ...state,
        activeStorylineIds: action.storylineIds,
        activeViewpointId: action.viewpointId,
        activeBucketIndex: action.bucketIndex,
        lastInteractionImpact: action.message ?? "\u5df2\u66f4\u65b0\u4e3b\u7ebf\u7126\u70b9\u3002"
      };
    case "set_model":
      return {
        ...state,
        selectedModelId: action.modelId,
        lastInteractionImpact: `\u5df2\u5207\u6362\u9884\u6d4b\u6a21\u578b\u5230 ${createModelLabel(action.modelId)}\u3002`
      };
    case "sync_focus":
      return {
        ...state,
        activeStorylineIds: action.storylineIds,
        activeViewpointId: action.viewpointId,
        activeBucketIndex: action.bucketIndex,
        lastInteractionImpact: action.message ?? "\u5df2\u4ece\u53d1\u5e03 bundle \u540c\u6b65\u7126\u70b9\u3002"
      };
    case "set_impact":
      return {
        ...state,
        lastInteractionImpact: action.message
      };
    case "set_model_params": {
      const key = action.modelId;
      return {
        ...state,
        modelParamsById: {
          ...state.modelParamsById,
          [key]: { ...action.params }
        }
      };
    }
    case "apply_model_params":
      return {
        ...state,
        appliedModelParamsById: {
          bass_diffusion: { ...state.modelParamsById.bass_diffusion },
          gompertz: { ...state.modelParamsById.gompertz }
        },
        lastInteractionImpact: "\u5f53\u524d\u6a21\u578b\u53c2\u6570\u5df2\u5e94\u7528\u5230\u9884\u6d4b\u9762\u677f\u3002"
      };
    case "reset_model_params":
      return {
        ...state,
        modelParamsById: createDefaultModelParamsById(),
        appliedModelParamsById: null,
        lastInteractionImpact: "\u5df2\u6062\u590d\u9ed8\u8ba4\u6a21\u578b\u53c2\u6570\u3002"
      };
    case "save_model_preset": {
      const modelId = state.selectedModelId;
      const preset: SavedModelPreset = {
        id: `preset-${Date.now()}`,
        name: action.name,
        modelId,
        params: { ...state.modelParamsById[modelId] },
        createdAt: Date.now()
      };
      return {
        ...state,
        savedModelPresets: [...state.savedModelPresets, preset].slice(-5),
        lastInteractionImpact: `\u5df2\u4fdd\u5b58\u53c2\u6570\u9884\u8bbe ${action.name}\u3002`
      };
    }
    case "delete_model_preset":
      return {
        ...state,
        savedModelPresets: state.savedModelPresets.filter((preset) => preset.id !== action.id)
      };
    case "load_model_preset": {
      const preset = state.savedModelPresets.find((item) => item.id === action.id);
      if (!preset) {
        return state;
      }

      return {
        ...state,
        selectedModelId: preset.modelId,
        modelParamsById: {
          ...state.modelParamsById,
          [preset.modelId]: { ...preset.params }
        },
        lastInteractionImpact: `\u5df2\u52a0\u8f7d\u53c2\u6570\u9884\u8bbe ${preset.name}\u3002`
      };
    }
    default:
      return state;
  }
}
