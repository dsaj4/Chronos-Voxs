import { describe, expect, it } from "vitest";
import { createPublishedBundleFixture } from "../test/createPublishedBundleFixture";
import {
  getScopedEvidenceState,
  getScopedRelationshipState,
  resolveFocusForStoryline
} from "./focusSelectors";
import type { WorkspaceFocusState } from "./focusState";

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

  it("falls back relationship scope to the nearest non-empty bucket and keeps externals at the edge", () => {
    const bundle = createPublishedBundleFixture();
    const focus = createFocus({
      activeStorylineIds: ["st_002"],
      activeViewpointId: null,
      activeBucketIndex: 1
    });
    const before = structuredClone(focus);

    const scoped = getScopedRelationshipState(bundle, focus);

    expect(focus).toEqual(before);
    expect(scoped.storylineId).toBe("st_002");
    expect(scoped.requestedBucketIndex).toBe(1);
    expect(scoped.resolvedBucketIndex).toBe(2);
    expect(scoped.highlightedViewpointId).toBe("vp_002");
    expect(scoped.viewpointRelations).toHaveLength(0);
    expect(scoped.storylineRelations.map((relation) => relation.relation_id)).toEqual(["st_rel_001"]);
    expect(scoped.externalAnchors.map((anchor) => anchor.id)).toEqual(["vp_003", "storyline:st_001"]);
    expect(scoped.didFallback).toBe(true);
    expect(scoped.fallbackMessage).toBeTruthy();
  });

  it("locally switches to the strongest bucket viewpoint when the requested viewpoint is absent", () => {
    const bundle = createPublishedBundleFixture();
    bundle.stream.storyline_snapshots.push({
      snapshot_id: "st_snap_006",
      storyline_id: "st_001",
      bucket_index: 2,
      bucket_start: "2026-03-12",
      bucket_granularity: "day",
      support_count: 3,
      comment_count: 2,
      viewpoint_ids: ["vp_003"],
      storyline_heat_index: 74,
      top_viewpoint_ids: ["vp_003"],
      metadata: {}
    });
    bundle.neural_map.viewpoint_snapshots.push({
      snapshot_id: "vp_snap_005",
      viewpoint_id: "vp_003",
      bucket_index: 2,
      bucket_start: "2026-03-12",
      bucket_granularity: "day",
      support_count: 3,
      unique_comment_count: 2,
      heat_index: 75,
      representative_claim_ids: ["claim_003"],
      metadata: {}
    });

    const focus = createFocus({
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_001",
      activeBucketIndex: 2
    });

    const scoped = getScopedRelationshipState(bundle, focus);
    const activeBucket = scoped.timelineBuckets.find((bucket) => bucket.bucketIndex === 2);

    expect(scoped.requestedViewpointId).toBe("vp_001");
    expect(scoped.displayViewpointId).toBe("vp_003");
    expect(scoped.resolvedBucketIndex).toBe(2);
    expect(scoped.lanes[0]?.viewpointId).toBe("vp_003");
    expect(activeBucket?.hasRequestedViewpoint).toBe(false);
    expect(activeBucket?.hasDisplayViewpoint).toBe(true);
    expect(scoped.didFallback).toBe(true);
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

  it("keeps relationship and evidence scopes on the latest populated bucket without fallback", () => {
    const bundle = createPublishedBundleFixture();
    const focus = createFocus({
      activeStorylineIds: ["st_001"],
      activeViewpointId: "vp_003",
      activeBucketIndex: 1
    });

    const relationshipScope = getScopedRelationshipState(bundle, focus);
    const evidenceScope = getScopedEvidenceState(bundle, focus);

    expect(relationshipScope.didFallback).toBe(false);
    expect(relationshipScope.resolvedBucketIndex).toBe(1);
    expect(relationshipScope.displayViewpointId).toBe("vp_003");
    expect(relationshipScope.lanes[0]?.viewpointId).toBe("vp_003");
    expect(evidenceScope.didFallback).toBe(false);
    expect(evidenceScope.resolvedBucketIndex).toBe(1);
    expect(evidenceScope.resolvedViewpointId).toBe("vp_003");
    expect(evidenceScope.particles).toHaveLength(1);
    expect(evidenceScope.evidenceClusters).toHaveLength(1);
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
