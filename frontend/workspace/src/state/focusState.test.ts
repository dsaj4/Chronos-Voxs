import { describe, expect, it } from "vitest";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import {
  createInitialFocusState,
  createDefaultCameraStateByView,
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
  });

  it("replaces stale viewpoint and bucket state when storyline focus changes", () => {
    const initialState: WorkspaceFocusState = {
      activePrimaryView: "storylines",
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_001",
      activeBucketIndex: 0,
      selectedModelId: "bass_diffusion",
      lastInteractionImpact: "before",
      cameraStateByView: createDefaultCameraStateByView()
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
});
