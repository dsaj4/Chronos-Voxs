import { describe, expect, it } from "vitest";
import {
  createDefaultCameraStateByView,
  focusReducer,
  type WorkspaceFocusAction,
  type WorkspaceFocusState
} from "./focusState";

describe("focusReducer", () => {
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
