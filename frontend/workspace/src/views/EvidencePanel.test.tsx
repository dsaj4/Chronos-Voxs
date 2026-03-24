import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getScopedEvidenceState } from "../state/focusSelectors";
import type { WorkspaceFocusState } from "../state/focusState";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import { EvidencePanel } from "./EvidencePanel";

function createFocus(overrides: Partial<WorkspaceFocusState>): WorkspaceFocusState {
  return {
    activePrimaryView: "evidence",
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
    ...overrides
  };
}

describe("EvidencePanel", () => {
  it("renders an interactive evidence stage with buckets, clusters, and particles", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedEvidenceState(bundle, createFocus({}));

    const markup = renderToStaticMarkup(
      <EvidencePanel
        bundle={bundle}
        scope={scope}
        onBucketSelect={() => undefined}
        onEvidenceFocus={() => undefined}
      />
    );

    expect(markup).toContain("evidence-stage");
    expect(markup).toContain("evidence-stage__constellation");
    expect(markup).toContain("evidence-cluster");
    expect(markup).toContain("evidence-particle");
    expect(markup).toContain("evidence-feed__item");
  });
});
