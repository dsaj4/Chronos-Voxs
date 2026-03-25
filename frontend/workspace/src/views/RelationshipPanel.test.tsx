import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getScopedRelationshipState } from "../state/focusSelectors";
import { createDefaultModelParamsById, type WorkspaceFocusState } from "../state/focusState";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import { RelationshipPanel } from "./RelationshipPanel";

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

describe("RelationshipPanel", () => {
  it("renders an SVG relationship stage with legend, nodes, and lane strip", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedRelationshipState(bundle, createFocus({}));

    const markup = renderToStaticMarkup(
      <RelationshipPanel bundle={bundle} scope={scope} onNodeSelect={() => undefined} />
    );

    expect(markup).toContain("relationship-stage");
    expect(markup).toContain("relationship-stage__legend");
    expect(markup).toContain("<svg");
    expect(markup).toContain("relationship-node");
    expect(markup).toContain("relationship-stage__lane-strip");
  });

  it("falls back to the nearest bucket with relationship context", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedRelationshipState(bundle, createFocus({ activeBucketIndex: 2 }));

    expect(scope.resolvedBucketIndex).toBe(1);
  });

  it("keeps the requested viewpoint as the primary lane when it exists in the bucket", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedRelationshipState(
      bundle,
      createFocus({ activeBucketIndex: 1, activeViewpointId: "vp_003" })
    );

    expect(scope.lanes[0]?.viewpointId).toBe("vp_003");
  });
});
