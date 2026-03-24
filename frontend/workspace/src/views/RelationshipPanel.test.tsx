import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getScopedRelationshipState } from "../state/focusSelectors";
import type { WorkspaceFocusState } from "../state/focusState";
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
    ...overrides
  };
}

describe("RelationshipPanel", () => {
  it("renders a time-viewpoint evolution stage with lanes and external anchors", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedRelationshipState(bundle, createFocus({}));

    const markup = renderToStaticMarkup(
      <RelationshipPanel bundle={bundle} scope={scope} onNodeSelect={() => undefined} />
    );

    expect(markup).toContain("relationship-stage");
    expect(markup).toContain("relationship-stage__timeline");
    expect(markup).toContain("relationship-lane");
    expect(markup).toContain("relationship-node");
    expect(markup).toContain("relationship-anchor");
  });
});
