import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getScopedEvidenceState } from "../state/focusSelectors";
import { createDefaultModelParamsById, type WorkspaceFocusState } from "../state/focusState";
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
    modelParamsById: createDefaultModelParamsById(),
    appliedModelParamsById: null,
    savedModelPresets: [],
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

  it("supports rendering multi-storyline evidence selections with aggregate summary", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedEvidenceState(
      bundle,
      createFocus({ activeStorylineIds: ["st_001", "st_002"], activeBucketIndex: 1, activeViewpointId: null })
    );

    const markup = renderToStaticMarkup(
      <EvidencePanel
        bundle={bundle}
        scope={scope}
        storylines={bundle.stream.storylines}
        activeStorylineId="st_001"
        activeStorylineIds={["st_001", "st_002"]}
        onBucketSelect={() => undefined}
        onEvidenceFocus={() => undefined}
        onStorylineSelect={() => undefined}
      />
    );

    expect(markup).toContain("2 主线");
    expect(markup).toContain("evidence-stage__cluster-group");
    expect(markup).toContain("evidence-stage__field");
  });

  it("keeps the requested time bucket visible even when that bucket has no evidence", () => {
    const bundle = createPublishedBundleFixture();
    const scope = getScopedEvidenceState(
      bundle,
      createFocus({ activeStorylineIds: ["st_002"], activeBucketIndex: 0, activeViewpointId: "vp_002" })
    );

    const markup = renderToStaticMarkup(
      <EvidencePanel
        bundle={bundle}
        scope={scope}
        storylines={bundle.stream.storylines}
        activeStorylineId="st_002"
        activeStorylineIds={["st_002"]}
        onBucketSelect={() => undefined}
        onEvidenceFocus={() => undefined}
      />
    );

    expect(markup).toContain("桶 0");
    expect(markup).toContain("evidence-stage__field-empty");
    expect(markup).toContain("当前桶暂无簇");
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
