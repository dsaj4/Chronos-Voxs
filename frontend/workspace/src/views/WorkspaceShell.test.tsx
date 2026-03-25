import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultModelParamsById, type WorkspaceFocusState } from "../state/focusState";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import { WorkspaceShell } from "./WorkspaceShell";

function createFocus(overrides: Partial<WorkspaceFocusState>): WorkspaceFocusState {
  return {
    activePrimaryView: "relationships",
    activeStorylineIds: ["st_001"],
    activeViewpointId: "vp_003",
    activeBucketIndex: 1,
    selectedModelId: "bass_diffusion",
    lastInteractionImpact: "fixture",
    cameraStateByView: {
      storylines: { panX: 0, panY: 0, zoom: 1 },
      relationships: { panX: 0, panY: 0, zoom: 1 },
      evidence: { panX: 0, panY: 0, zoom: 1 }
    },
    modelParamsById: createDefaultModelParamsById(),
    appliedModelParamsById: null,
    savedModelPresets: [],
    ...overrides
  };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("WorkspaceShell", () => {
  it("hides the relationship entry points and falls back to a visible stage", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceShell
        bundle={createPublishedBundleFixture()}
        focus={createFocus({})}
        onPrimaryViewChange={() => undefined}
        onStorylineSelect={() => undefined}
        onModelChange={() => undefined}
        onModelParamsChange={() => undefined}
        onApplyModelParams={() => undefined}
        onResetModelParams={() => undefined}
        onSaveModelPreset={() => undefined}
        onDeleteModelPreset={() => undefined}
        onLoadModelPreset={() => undefined}
      />
    );

    expect(countOccurrences(markup, 'class="cv-view-tab')).toBe(2);
    expect(countOccurrences(markup, 'class="workspace-thumbnails__button"')).toBe(1);
    expect(markup).not.toContain("relationship-stage");
    expect(markup).toContain("loading-state");
  });
});
