import { describe, expect, it } from "vitest";
import type { WorkspaceFocusState } from "./focusState";
import {
  getScopedEvidenceState,
  getScopedRelationshipState,
  resolveFocusForStoryline
} from "./focusSelectors";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";

function createFocus(overrides: Partial<WorkspaceFocusState>): WorkspaceFocusState {
  return {
    activePrimaryView: "storylines",
    activeStorylineIds: ["st_001"],
    activeViewpointId: "vp_001",
    activeBucketIndex: 0,
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

describe("focusSelectors", () => {
  it("resolves the latest strongest viewpoint when switching storylines", () => {
    const bundle = createPublishedBundleFixture();

    const resolved = resolveFocusForStoryline(bundle, "st_001");

    expect(resolved.storylineIds).toEqual(["st_001"]);
    expect(resolved.bucketIndex).toBe(1);
    expect(resolved.bucketStart).toBe("2026-03-11");
    expect(resolved.viewpointId).toBe("vp_003");
  });

  it("falls back relationship scope to the nearest non-empty bucket", () => {
    const bundle = createPublishedBundleFixture();
    const focus = createFocus({
      activeStorylineIds: ["st_002"],
      activeViewpointId: null,
      activeBucketIndex: 1
    });

    const scoped = getScopedRelationshipState(bundle, focus);

    expect(scoped.storylineId).toBe("st_002");
    expect(scoped.requestedBucketIndex).toBe(1);
    expect(scoped.resolvedBucketIndex).toBe(2);
    expect(scoped.highlightedViewpointId).toBe("vp_002");
    expect(scoped.viewpointRelations.map((relation) => relation.relation_id)).toEqual(["vp_rel_002"]);
    expect(scoped.storylineRelations.map((relation) => relation.relation_id)).toEqual(["st_rel_001"]);
    expect(scoped.didFallback).toBe(true);
    expect(scoped.fallbackMessage).toBeTruthy();
  });

  it("falls back evidence scope to the nearest bucket for the active viewpoint", () => {
    const bundle = createPublishedBundleFixture();
    const focus = createFocus({
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_003",
      activeBucketIndex: 2
    });

    const scoped = getScopedEvidenceState(bundle, focus);

    expect(scoped.storylineId).toBe("st_001");
    expect(scoped.requestedBucketIndex).toBe(2);
    expect(scoped.resolvedBucketIndex).toBe(1);
    expect(scoped.resolvedViewpointId).toBe("vp_003");
    expect(scoped.didFallback).toBe(true);
    expect(scoped.particles).toHaveLength(1);
    expect(scoped.particles.every((particle) => particle.viewpoint_id === "vp_003")).toBe(true);
    expect(scoped.evidenceClusters).toHaveLength(1);
    expect(scoped.evidenceClusters.every((cluster) => cluster.viewpoint_id === "vp_003")).toBe(true);
  });

  it("falls back to storyline evidence when the active viewpoint has no evidence", () => {
    const bundle = createPublishedBundleFixture();
    const focus = createFocus({
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_missing",
      activeBucketIndex: 2
    });

    const scoped = getScopedEvidenceState(bundle, focus);

    expect(scoped.resolvedBucketIndex).toBe(1);
    expect(scoped.resolvedViewpointId).toBe("vp_003");
    expect(scoped.particles).toHaveLength(2);
    expect(scoped.evidenceClusters).toHaveLength(2);
    expect(scoped.didFallback).toBe(true);
  });
});
