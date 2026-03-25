import { describe, expect, it } from "vitest";
import { DEFAULT_BASS_PARAMS } from "../forecast/modelCalculations";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import {
  createDefaultCameraStateByView,
  createDefaultModelParamsById,
  createInitialFocusState,
  focusReducer,
  type WorkspaceFocusAction,
  type WorkspaceFocusState
} from "./focusState";

describe("focusReducer", () => {
  it("creates an initial focus state from the primary storyline latest bucket", () => {
    const bundle = createPublishedBundleFixture();

    const state = createInitialFocusState(bundle);

    expect(state.activeStorylineIds).toEqual(["st_001"]);
    expect(state.activeViewpointId).toBe("vp_003");
    expect(state.activeBucketIndex).toBe(1);
    expect(state.selectedModelId).toBe("bass_diffusion");
    expect(state.modelParamsById.bass_diffusion).toEqual(DEFAULT_BASS_PARAMS);
    expect(state.appliedModelParamsById).toBeNull();
  });

  it("replaces stale viewpoint and bucket state when storyline focus changes", () => {
    const initialState: WorkspaceFocusState = {
      activePrimaryView: "storylines",
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_001",
      activeBucketIndex: 0,
      selectedModelId: "bass_diffusion",
      lastInteractionImpact: "before",
      cameraStateByView: createDefaultCameraStateByView(),
      modelParamsById: createDefaultModelParamsById(),
      appliedModelParamsById: null,
      savedModelPresets: []
    };
    const action: WorkspaceFocusAction = {
      type: "set_storyline_focus",
      storylineIds: ["st_002"],
      viewpointId: "vp_002",
      bucketIndex: 2,
      message: "after"
    };

    const nextState = focusReducer(initialState, action);

    expect(nextState.activeStorylineIds).toEqual(["st_002"]);
    expect(nextState.activeViewpointId).toBe("vp_002");
    expect(nextState.activeBucketIndex).toBe(2);
    expect(nextState.lastInteractionImpact).toBe("after");
    expect(nextState.selectedModelId).toBe("bass_diffusion");
  });

  it("applies and resets editable model params", () => {
    const initialState: WorkspaceFocusState = {
      activePrimaryView: "storylines",
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_003",
      activeBucketIndex: 1,
      selectedModelId: "bass_diffusion",
      lastInteractionImpact: "before",
      cameraStateByView: createDefaultCameraStateByView(),
      modelParamsById: createDefaultModelParamsById(),
      appliedModelParamsById: null,
      savedModelPresets: []
    };

    const changedState = focusReducer(initialState, {
      type: "set_model_params",
      modelId: "bass_diffusion",
      params: { p: 0.04, q: 0.42, m: 1.01 }
    });
    const appliedState = focusReducer(changedState, { type: "apply_model_params" });
    const resetState = focusReducer(appliedState, { type: "reset_model_params" });

    expect(changedState.modelParamsById.bass_diffusion.p).toBe(0.04);
    expect(appliedState.appliedModelParamsById?.bass_diffusion.q).toBe(0.42);
    expect(resetState.modelParamsById).toEqual(createDefaultModelParamsById());
    expect(resetState.appliedModelParamsById).toBeNull();
  });

  it("saves and loads model presets", () => {
    const initialState: WorkspaceFocusState = {
      activePrimaryView: "storylines",
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_003",
      activeBucketIndex: 1,
      selectedModelId: "gompertz",
      lastInteractionImpact: "before",
      cameraStateByView: createDefaultCameraStateByView(),
      modelParamsById: {
        ...createDefaultModelParamsById(),
        gompertz: { a: 1.08, b: 3.1, c: 0.29 }
      },
      appliedModelParamsById: null,
      savedModelPresets: []
    };

    const savedState = focusReducer(initialState, {
      type: "save_model_preset",
      name: "gentle-plateau"
    });
    const presetId = savedState.savedModelPresets[0]?.id ?? "";
    const loadedState = focusReducer(savedState, {
      type: "load_model_preset",
      id: presetId
    });

    expect(savedState.savedModelPresets).toHaveLength(1);
    expect(loadedState.selectedModelId).toBe("gompertz");
    expect(loadedState.modelParamsById.gompertz.b).toBe(3.1);
  });
});
