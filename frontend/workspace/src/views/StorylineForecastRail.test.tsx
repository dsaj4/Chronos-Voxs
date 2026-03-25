import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createDefaultCameraStateByView,
  createDefaultModelParamsById,
  type WorkspaceFocusState
} from "../state/focusState";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import { createStorylineForecastViewModel } from "./storylineModelForecast";
import { StorylineForecastRail } from "./StorylineForecastRail";

function createFocus(overrides: Partial<WorkspaceFocusState>): WorkspaceFocusState {
  return {
    activePrimaryView: "storylines",
    activeStorylineIds: ["st_001"],
    activeViewpointId: "vp_003",
    activeBucketIndex: 1,
    selectedModelId: "bass_diffusion",
    lastInteractionImpact: "fixture",
    cameraStateByView: createDefaultCameraStateByView(),
    modelParamsById: createDefaultModelParamsById(),
    appliedModelParamsById: null,
    savedModelPresets: [],
    ...overrides
  };
}

describe("StorylineForecastRail", () => {
  it("renders the right-side forecast rail inside the detail slot footprint", () => {
    const bundle = createPublishedBundleFixture();
    const focus = createFocus({});
    const model = createStorylineForecastViewModel(
      bundle,
      "st_001",
      focus.selectedModelId,
      focus.modelParamsById[focus.selectedModelId]
    );

    const markup = renderToStaticMarkup(
      <StorylineForecastRail
        bundle={bundle}
        focus={focus}
        model={model}
        onModelChange={() => undefined}
        onModelParamsChange={() => undefined}
        onApplyModelParams={() => undefined}
        onResetModelParams={() => undefined}
        onSaveModelPreset={() => undefined}
        onDeleteModelPreset={() => undefined}
        onLoadModelPreset={() => undefined}
      />
    );

    expect(markup).toContain("forecast-rail");
    expect(markup).toContain("预测控制");
    expect(markup).toContain("Bass Diffusion");
    expect(markup).toContain("Gompertz");
    expect(markup).toContain("应用到当前预测");
    expect(markup).toContain("预测解读");
  });
});
