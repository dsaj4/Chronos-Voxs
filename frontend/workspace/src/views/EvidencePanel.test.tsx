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
  it("renders a particle-field evidence stage with buckets, canvas, and cluster strip", () => {
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
    expect(markup).toContain("evidence-stage__field");
    expect(markup).toContain("<canvas");
    expect(markup).toContain("evidence-stage__cluster-strip");
    expect(markup).toContain("evidence-stage__cluster-chip");
  });

  it("falls back to the nearest evidence bucket when the requested slice is empty", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedEvidenceState(
      bundle,
      createFocus({ activeBucketIndex: 0, activeViewpointId: "vp_003" })
    );

    expect(scope.resolvedBucketIndex).toBe(1);
    expect(scope.fallbackMessage).toContain("\u6700\u8fd1\u6709\u8bc1\u636e\u7684\u65f6\u95f4\u6876");
  });

  it("renders a single-cluster single-particle slice without collapsing the stage", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedEvidenceState(
      bundle,
      createFocus({
        activeStorylineIds: ["st_002"],
        activeViewpointId: "vp_002",
        activeBucketIndex: 2
      })
    );

    const markup = renderToStaticMarkup(
      <EvidencePanel
        bundle={bundle}
        scope={scope}
        onBucketSelect={() => undefined}
        onEvidenceFocus={() => undefined}
      />
    );

    expect(scope.evidenceClusters).toHaveLength(1);
    expect(scope.particles).toHaveLength(1);
    expect(markup).toContain("evidence-stage__field");
    expect(markup).toContain("evidence-stage__cluster-chip");
  });
});
