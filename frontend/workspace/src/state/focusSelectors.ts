import type { PublishedBundle, PublishedViewpoint } from "../loader/publishedTypes";
import type { WorkspaceFocusState } from "./focusState";

type PublishedStorylineSnapshot = PublishedBundle["stream"]["storyline_snapshots"][number];
type PublishedViewpointSnapshot = PublishedBundle["neural_map"]["viewpoint_snapshots"][number];
type PublishedViewpointRelation = PublishedBundle["neural_map"]["viewpoint_relations"][number];
type PublishedStorylineRelation = PublishedBundle["neural_map"]["storyline_relations"][number];
type PublishedEvidenceParticle = PublishedBundle["particle_field"]["particles"][number];
type PublishedEvidenceCluster = PublishedBundle["particle_field"]["evidence_clusters"][number];

export interface ResolvedStorylineFocus {
  storylineId: string;
  storylineIds: string[];
  viewpointId: string | null;
  bucketIndex: number | null;
  bucketStart: string | null;
  message: string;
}

export interface RelationshipTimelineBucket {
  bucketIndex: number;
  bucketStart: string;
  storylineHeatIndex: number;
  isActiveBucket: boolean;
  hasDisplayViewpoint: boolean;
  hasRequestedViewpoint: boolean;
}

export interface RelationshipLanePoint {
  bucketIndex: number;
  bucketStart: string;
  hasSnapshot: boolean;
  supportCount: number | null;
  heatIndex: number | null;
  isActiveBucket: boolean;
  isCurrentViewpoint: boolean;
  relationWeight: number | null;
}

export interface RelationshipLane {
  viewpointId: string;
  title: string;
  topicTag: string;
  isCurrent: boolean;
  isPeer: boolean;
  isExternalAnchor: boolean;
  relationTypeHint: PublishedViewpointRelation["relation_type"] | null;
  score: number;
  points: RelationshipLanePoint[];
}

export interface RelationshipAnchor {
  id: string;
  label: string;
  kind: "viewpoint" | "storyline";
  direction: "incoming" | "outgoing";
  relationType: string;
  weight: number;
  summary: string;
}

export interface ScopedRelationshipState {
  storylineId: string | null;
  requestedBucketIndex: number | null;
  resolvedBucketIndex: number | null;
  resolvedBucketStart: string | null;
  requestedViewpointId: string | null;
  displayViewpointId: string | null;
  highlightedViewpointId: string | null;
  viewpointIdsInScope: string[];
  viewpointRelations: PublishedViewpointRelation[];
  storylineRelations: PublishedStorylineRelation[];
  timelineBuckets: RelationshipTimelineBucket[];
  lanes: RelationshipLane[];
  externalAnchors: RelationshipAnchor[];
  didFallback: boolean;
  fallbackMessage: string | null;
}

export interface ScopedEvidenceState {
  storylineId: string | null;
  requestedBucketIndex: number | null;
  resolvedBucketIndex: number | null;
  resolvedBucketStart: string | null;
  resolvedViewpointId: string | null;
  particles: PublishedEvidenceParticle[];
  evidenceClusters: PublishedEvidenceCluster[];
  didFallback: boolean;
  fallbackMessage: string | null;
}

export function getPrimaryActiveStorylineId(focus: Pick<WorkspaceFocusState, "activeStorylineIds">): string | null {
  return focus.activeStorylineIds[0] ?? null;
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((value): value is string => Boolean(value)))];
}

function getStorylineSnapshots(bundle: PublishedBundle, storylineId: string): PublishedStorylineSnapshot[] {
  return [...bundle.stream.storyline_snapshots]
    .filter((snapshot) => snapshot.storyline_id === storylineId)
    .sort((left, right) => left.bucket_index - right.bucket_index);
}

function getViewpoint(bundle: PublishedBundle, viewpointId: string): PublishedViewpoint | undefined {
  return bundle.neural_map.viewpoints.find((viewpoint) => viewpoint.viewpoint_id === viewpointId);
}

function getViewpointSnapshot(
  bundle: PublishedBundle,
  viewpointId: string,
  bucketIndex: number
): PublishedViewpointSnapshot | null {
  return (
    bundle.neural_map.viewpoint_snapshots.find(
      (snapshot) => snapshot.viewpoint_id === viewpointId && snapshot.bucket_index === bucketIndex
    ) ?? null
  );
}

function getViewpointSnapshotSupport(
  bundle: PublishedBundle,
  viewpointId: string,
  bucketIndex: number | null
): number {
  if (bucketIndex === null) {
    return -1;
  }
  return getViewpointSnapshot(bundle, viewpointId, bucketIndex)?.support_count ?? -1;
}

function getViewpointRelation(
  bundle: PublishedBundle,
  leftViewpointId: string | null,
  rightViewpointId: string
): PublishedViewpointRelation | null {
  if (!leftViewpointId) {
    return null;
  }
  return (
    bundle.neural_map.viewpoint_relations.find(
      (relation) =>
        (relation.source_viewpoint_id === leftViewpointId && relation.target_viewpoint_id === rightViewpointId) ||
        (relation.source_viewpoint_id === rightViewpointId && relation.target_viewpoint_id === leftViewpointId)
    ) ?? null
  );
}

function getViewpointRelationWeight(
  bundle: PublishedBundle,
  leftViewpointId: string | null,
  rightViewpointId: string
): number {
  return getViewpointRelation(bundle, leftViewpointId, rightViewpointId)?.weight ?? 0;
}

function rankViewpointIds(
  bundle: PublishedBundle,
  viewpointIds: string[],
  bucketIndex: number | null,
  anchorViewpointId: string | null
): string[] {
  return uniqueIds(viewpointIds).sort((leftId, rightId) => {
    const left = getViewpoint(bundle, leftId);
    const right = getViewpoint(bundle, rightId);
    const relationDelta =
      getViewpointRelationWeight(bundle, anchorViewpointId, rightId) -
      getViewpointRelationWeight(bundle, anchorViewpointId, leftId);
    if (relationDelta !== 0) {
      return relationDelta;
    }
    const bucketSupportDelta =
      getViewpointSnapshotSupport(bundle, rightId, bucketIndex) -
      getViewpointSnapshotSupport(bundle, leftId, bucketIndex);
    if (bucketSupportDelta !== 0) {
      return bucketSupportDelta;
    }
    const supportDelta = (right?.support_count ?? -1) - (left?.support_count ?? -1);
    if (supportDelta !== 0) {
      return supportDelta;
    }
    const groundingDelta = (right?.summary_grounding_score ?? -1) - (left?.summary_grounding_score ?? -1);
    if (groundingDelta !== 0) {
      return groundingDelta;
    }
    return leftId.localeCompare(rightId);
  });
}

function getSnapshotCandidateViewpointIds(
  bundle: PublishedBundle,
  snapshot: PublishedStorylineSnapshot | null
): string[] {
  if (!snapshot) {
    return [];
  }
  return rankViewpointIds(
    bundle,
    [...snapshot.top_viewpoint_ids, ...snapshot.viewpoint_ids],
    snapshot.bucket_index,
    null
  );
}

function getRequestedStorylineSnapshot(
  snapshots: PublishedStorylineSnapshot[],
  requestedBucketIndex: number | null
): PublishedStorylineSnapshot | null {
  if (!snapshots.length) {
    return null;
  }
  if (requestedBucketIndex === null) {
    return snapshots.at(-1) ?? null;
  }
  return snapshots.find((snapshot) => snapshot.bucket_index === requestedBucketIndex) ?? null;
}

function findNearestSnapshot(
  snapshots: PublishedStorylineSnapshot[],
  requestedBucketIndex: number | null,
  predicate: (snapshot: PublishedStorylineSnapshot) => boolean
): PublishedStorylineSnapshot | null {
  if (!snapshots.length) {
    return null;
  }

  const referenceBucketIndex = requestedBucketIndex ?? snapshots.at(-1)?.bucket_index ?? null;
  const eligible = snapshots.filter(predicate);
  if (!eligible.length) {
    return null;
  }

  return [...eligible].sort((left, right) => {
    const leftDistance = Math.abs((referenceBucketIndex ?? left.bucket_index) - left.bucket_index);
    const rightDistance = Math.abs((referenceBucketIndex ?? right.bucket_index) - right.bucket_index);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return right.bucket_index - left.bucket_index;
  })[0];
}

function getStorylineTitle(bundle: PublishedBundle, storylineId: string): string {
  return (
    bundle.stream.storylines.find((storyline) => storyline.storyline_id === storylineId)?.title ?? storylineId
  );
}

function getTraceabilityViewpointIds(bundle: PublishedBundle, storylineId: string): string[] {
  return bundle.reasoning.traceability.find((entry) => entry.storyline_id === storylineId)?.viewpoint_ids ?? [];
}

function getStorylineViewpointUniverse(bundle: PublishedBundle, storylineId: string): string[] {
  const snapshots = getStorylineSnapshots(bundle, storylineId);
  return uniqueIds([
    ...snapshots.flatMap((snapshot) => [...snapshot.viewpoint_ids, ...snapshot.top_viewpoint_ids]),
    ...getTraceabilityViewpointIds(bundle, storylineId)
  ]);
}

function getLanePoints(
  bundle: PublishedBundle,
  bucketSnapshots: PublishedStorylineSnapshot[],
  viewpointId: string,
  activeBucketIndex: number | null,
  displayViewpointId: string | null
): RelationshipLanePoint[] {
  return bucketSnapshots.map((bucketSnapshot) => {
    const viewpointSnapshot = getViewpointSnapshot(bundle, viewpointId, bucketSnapshot.bucket_index);
    return {
      bucketIndex: bucketSnapshot.bucket_index,
      bucketStart: bucketSnapshot.bucket_start,
      hasSnapshot: Boolean(viewpointSnapshot),
      supportCount: viewpointSnapshot?.support_count ?? null,
      heatIndex: viewpointSnapshot?.heat_index ?? null,
      isActiveBucket: bucketSnapshot.bucket_index === activeBucketIndex,
      isCurrentViewpoint: viewpointId === displayViewpointId,
      relationWeight:
        viewpointId === displayViewpointId
          ? 1
          : getViewpointRelationWeight(bundle, displayViewpointId, viewpointId) || null
    };
  });
}

function buildExternalAnchors(
  bundle: PublishedBundle,
  storylineId: string,
  laneViewpointIds: string[],
  displayViewpointId: string | null,
  storylineViewpointIds: string[]
): RelationshipAnchor[] {
  const anchors: RelationshipAnchor[] = [];
  const seenIds = new Set<string>();

  for (const relation of bundle.neural_map.viewpoint_relations) {
    const sourceInLane = laneViewpointIds.includes(relation.source_viewpoint_id);
    const targetInLane = laneViewpointIds.includes(relation.target_viewpoint_id);
    if (sourceInLane === targetInLane) {
      continue;
    }

    const externalViewpointId = sourceInLane ? relation.target_viewpoint_id : relation.source_viewpoint_id;
    if (storylineViewpointIds.includes(externalViewpointId) || seenIds.has(externalViewpointId)) {
      continue;
    }

    const viewpoint = getViewpoint(bundle, externalViewpointId);
    anchors.push({
      id: externalViewpointId,
      label: viewpoint?.title ?? externalViewpointId,
      kind: "viewpoint",
      direction:
        displayViewpointId && relation.source_viewpoint_id === displayViewpointId ? "outgoing" : "incoming",
      relationType: relation.relation_type,
      weight: relation.weight,
      summary: relation.rationale
    });
    seenIds.add(externalViewpointId);
  }

  for (const relation of bundle.neural_map.storyline_relations) {
    if (relation.source_storyline_id !== storylineId && relation.target_storyline_id !== storylineId) {
      continue;
    }

    const externalStorylineId =
      relation.source_storyline_id === storylineId ? relation.target_storyline_id : relation.source_storyline_id;
    const anchorId = `storyline:${externalStorylineId}`;
    if (seenIds.has(anchorId)) {
      continue;
    }

    anchors.push({
      id: anchorId,
      label: getStorylineTitle(bundle, externalStorylineId),
      kind: "storyline",
      direction: relation.source_storyline_id === storylineId ? "outgoing" : "incoming",
      relationType: relation.relation_type,
      weight: relation.weight,
      summary: relation.rationale
    });
    seenIds.add(anchorId);
  }

  return anchors
    .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label))
    .slice(0, 6);
}

function getNearestEvidenceBucket(bucketIndexes: number[], requestedBucketIndex: number | null): number | null {
  if (!bucketIndexes.length) {
    return null;
  }

  const referenceBucketIndex = requestedBucketIndex ?? bucketIndexes.at(-1) ?? null;
  return [...bucketIndexes].sort((left, right) => {
    const leftDistance = Math.abs((referenceBucketIndex ?? left) - left);
    const rightDistance = Math.abs((referenceBucketIndex ?? right) - right);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return right - left;
  })[0] ?? null;
}

export function resolveFocusForStoryline(bundle: PublishedBundle, storylineId: string): ResolvedStorylineFocus {
  const snapshots = getStorylineSnapshots(bundle, storylineId);
  const latestFocusedSnapshot =
    [...snapshots]
      .sort((left, right) => right.bucket_index - left.bucket_index)
      .find((snapshot) => getSnapshotCandidateViewpointIds(bundle, snapshot).length > 0) ??
    snapshots.at(-1) ??
    null;

  const viewpointId =
    getSnapshotCandidateViewpointIds(bundle, latestFocusedSnapshot)[0] ??
    getTraceabilityViewpointIds(bundle, storylineId)[0] ??
    null;

  return {
    storylineId,
    storylineIds: [storylineId],
    viewpointId,
    bucketIndex: latestFocusedSnapshot?.bucket_index ?? null,
    bucketStart: latestFocusedSnapshot?.bucket_start ?? null,
    message: viewpointId
      ? `\u5df2\u805a\u7126 ${getStorylineTitle(bundle, storylineId)} \u7684\u6700\u65b0\u4e3b\u5bfc\u89c2\u70b9`
      : `\u5df2\u805a\u7126 ${getStorylineTitle(bundle, storylineId)}`
  };
}

export function getScopedRelationshipState(
  bundle: PublishedBundle,
  focus: WorkspaceFocusState
): ScopedRelationshipState {
  const storylineId = getPrimaryActiveStorylineId(focus);
  if (!storylineId) {
    return {
      storylineId: null,
      requestedBucketIndex: null,
      resolvedBucketIndex: null,
      resolvedBucketStart: null,
      requestedViewpointId: null,
      displayViewpointId: null,
      highlightedViewpointId: null,
      viewpointIdsInScope: [],
      viewpointRelations: [],
      storylineRelations: [],
      timelineBuckets: [],
      lanes: [],
      externalAnchors: [],
      didFallback: false,
      fallbackMessage: null
    };
  }

  const snapshots = getStorylineSnapshots(bundle, storylineId);
  const requestedSnapshot = getRequestedStorylineSnapshot(snapshots, focus.activeBucketIndex);
  const resolvedSnapshot =
    (requestedSnapshot && getSnapshotCandidateViewpointIds(bundle, requestedSnapshot).length > 0
      ? requestedSnapshot
      : findNearestSnapshot(
          snapshots,
          focus.activeBucketIndex,
          (snapshot) => getSnapshotCandidateViewpointIds(bundle, snapshot).length > 0
        )) ??
    requestedSnapshot ??
    snapshots.at(-1) ??
    null;

  const storylineViewpointIds = getStorylineViewpointUniverse(bundle, storylineId);
  const requestedViewpointId = focus.activeViewpointId;
  const candidateViewpointIds = getSnapshotCandidateViewpointIds(bundle, resolvedSnapshot);
  const displayViewpointId =
    (requestedViewpointId && candidateViewpointIds.includes(requestedViewpointId) ? requestedViewpointId : null) ??
    candidateViewpointIds[0] ??
    rankViewpointIds(bundle, storylineViewpointIds, resolvedSnapshot?.bucket_index ?? null, requestedViewpointId)[0] ??
    null;

  const peerViewpointIds = rankViewpointIds(
    bundle,
    storylineViewpointIds.filter((viewpointId) => viewpointId !== displayViewpointId),
    resolvedSnapshot?.bucket_index ?? null,
    displayViewpointId
  ).slice(0, 4);

  const laneViewpointIds = uniqueIds([displayViewpointId, ...peerViewpointIds]);
  const viewpointRelations = bundle.neural_map.viewpoint_relations
    .filter(
      (relation) =>
        laneViewpointIds.includes(relation.source_viewpoint_id) &&
        laneViewpointIds.includes(relation.target_viewpoint_id)
    )
    .sort((left, right) => {
      const leftPriority =
        displayViewpointId &&
        (left.source_viewpoint_id === displayViewpointId || left.target_viewpoint_id === displayViewpointId)
          ? 1
          : 0;
      const rightPriority =
        displayViewpointId &&
        (right.source_viewpoint_id === displayViewpointId || right.target_viewpoint_id === displayViewpointId)
          ? 1
          : 0;
      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }
      return right.weight - left.weight;
    });

  const storylineRelations = bundle.neural_map.storyline_relations
    .filter(
      (relation) => relation.source_storyline_id === storylineId || relation.target_storyline_id === storylineId
    )
    .sort((left, right) => right.weight - left.weight);

  const timelineBuckets = snapshots.map((snapshot) => ({
    bucketIndex: snapshot.bucket_index,
    bucketStart: snapshot.bucket_start,
    storylineHeatIndex: snapshot.storyline_heat_index,
    isActiveBucket: snapshot.bucket_index === (resolvedSnapshot?.bucket_index ?? null),
    hasDisplayViewpoint:
      displayViewpointId !== null &&
      Boolean(getViewpointSnapshot(bundle, displayViewpointId, snapshot.bucket_index)),
    hasRequestedViewpoint:
      requestedViewpointId !== null &&
      Boolean(getViewpointSnapshot(bundle, requestedViewpointId, snapshot.bucket_index))
  }));

  const lanes: RelationshipLane[] = laneViewpointIds.map((viewpointId, laneIndex) => {
    const viewpoint = getViewpoint(bundle, viewpointId);
    const directRelation = getViewpointRelation(bundle, displayViewpointId, viewpointId);
    return {
      viewpointId,
      title: viewpoint?.title ?? viewpointId,
      topicTag: viewpoint?.topic_tag ?? bundle.meta.topic_tag,
      isCurrent: laneIndex === 0,
      isPeer: laneIndex > 0,
      isExternalAnchor: false,
      relationTypeHint: laneIndex === 0 ? null : directRelation?.relation_type ?? null,
      score: viewpoint?.support_count ?? 0,
      points: getLanePoints(
        bundle,
        snapshots,
        viewpointId,
        resolvedSnapshot?.bucket_index ?? null,
        displayViewpointId
      )
    };
  });

  const didBucketFallback =
    requestedSnapshot !== null &&
    resolvedSnapshot !== null &&
    requestedSnapshot.bucket_index !== resolvedSnapshot.bucket_index;
  const didViewpointFallback =
    requestedViewpointId !== null &&
    displayViewpointId !== null &&
    requestedViewpointId !== displayViewpointId &&
    resolvedSnapshot !== null;

  const fallbackMessages: string[] = [];
  if (didBucketFallback && resolvedSnapshot) {
    fallbackMessages.push(
      `\u5f53\u524d\u65f6\u95f4\u6876\u6ca1\u6709\u53ef\u7528\u5173\u7cfb\u4e0a\u4e0b\u6587\uff0c\u5df2\u5207\u5230\u6700\u8fd1\u53ef\u8bfb\u65f6\u95f4\u6876 ${resolvedSnapshot.bucket_index}`
    );
  }
  if (didViewpointFallback && displayViewpointId) {
    const displayViewpointTitle = getViewpoint(bundle, displayViewpointId)?.title ?? displayViewpointId;
    fallbackMessages.push(
      `\u5f53\u524d\u89c2\u70b9\u7f3a\u5e2d\u8be5\u6876\uff0c\u56fe\u5185\u4e34\u65f6\u5207\u5230\u6700\u5f3a\u89c2\u70b9 ${displayViewpointTitle}`
    );
  }

  return {
    storylineId,
    requestedBucketIndex: focus.activeBucketIndex,
    resolvedBucketIndex: resolvedSnapshot?.bucket_index ?? null,
    resolvedBucketStart: resolvedSnapshot?.bucket_start ?? null,
    requestedViewpointId,
    displayViewpointId,
    highlightedViewpointId: displayViewpointId,
    viewpointIdsInScope: laneViewpointIds,
    viewpointRelations,
    storylineRelations,
    timelineBuckets,
    lanes,
    externalAnchors: buildExternalAnchors(
      bundle,
      storylineId,
      laneViewpointIds,
      displayViewpointId,
      storylineViewpointIds
    ),
    didFallback: didBucketFallback || didViewpointFallback,
    fallbackMessage: fallbackMessages.length ? fallbackMessages.join(" / ") : null
  };
}

export function getScopedEvidenceState(bundle: PublishedBundle, focus: WorkspaceFocusState): ScopedEvidenceState {
  const storylineId = getPrimaryActiveStorylineId(focus);
  if (!storylineId) {
    return {
      storylineId: null,
      requestedBucketIndex: null,
      resolvedBucketIndex: null,
      resolvedBucketStart: null,
      resolvedViewpointId: null,
      particles: [],
      evidenceClusters: [],
      didFallback: false,
      fallbackMessage: null
    };
  }

  const storylineParticles = bundle.particle_field.particles.filter((particle) => particle.storyline_id === storylineId);
  const storylineClusters = bundle.particle_field.evidence_clusters.filter(
    (cluster) => cluster.storyline_id === storylineId
  );

  const filterEvidenceAtBucket = (bucketIndex: number, viewpointId: string | null) => {
    const particles = storylineParticles.filter(
      (particle) =>
        particle.bucket_index === bucketIndex && (!viewpointId || particle.viewpoint_id === viewpointId)
    );
    const evidenceClusters = storylineClusters.filter(
      (cluster) =>
        cluster.bucket_index === bucketIndex && (!viewpointId || cluster.viewpoint_id === viewpointId)
    );
    return { particles, evidenceClusters };
  };

  const requestedBucketIndex =
    focus.activeBucketIndex ??
    [...storylineClusters, ...storylineParticles]
      .sort((left, right) => left.bucket_index - right.bucket_index)
      .at(-1)?.bucket_index ??
    null;

  const requestedScopedEvidence =
    requestedBucketIndex === null
      ? { particles: [] as PublishedEvidenceParticle[], evidenceClusters: [] as PublishedEvidenceCluster[] }
      : filterEvidenceAtBucket(requestedBucketIndex, focus.activeViewpointId);

  const viewpointBucketIndexes = uniqueIds([
    ...storylineParticles
      .filter((particle) => !focus.activeViewpointId || particle.viewpoint_id === focus.activeViewpointId)
      .map((particle) => String(particle.bucket_index)),
    ...storylineClusters
      .filter((cluster) => !focus.activeViewpointId || cluster.viewpoint_id === focus.activeViewpointId)
      .map((cluster) => String(cluster.bucket_index))
  ]).map((value) => Number(value));

  const storylineBucketIndexes = uniqueIds([
    ...storylineParticles.map((particle) => String(particle.bucket_index)),
    ...storylineClusters.map((cluster) => String(cluster.bucket_index))
  ]).map((value) => Number(value));

  let resolvedBucketIndex = requestedBucketIndex;
  let resolvedViewpointId = focus.activeViewpointId;
  let didFallback = false;
  let fallbackMessage: string | null = null;
  let scopedEvidence = requestedScopedEvidence;

  if (!scopedEvidence.particles.length && !scopedEvidence.evidenceClusters.length) {
    const nearestViewpointBucket =
      focus.activeViewpointId !== null
        ? getNearestEvidenceBucket(viewpointBucketIndexes, requestedBucketIndex)
        : null;

    if (nearestViewpointBucket !== null) {
      resolvedBucketIndex = nearestViewpointBucket;
      scopedEvidence = filterEvidenceAtBucket(nearestViewpointBucket, focus.activeViewpointId);
      didFallback = requestedBucketIndex !== nearestViewpointBucket;
      fallbackMessage =
        didFallback && focus.activeViewpointId
          ? `\u5f53\u524d\u65f6\u95f4\u6876\u6ca1\u6709\u8be5\u89c2\u70b9\u8bc1\u636e\uff0c\u5df2\u56de\u9000\u5230\u6700\u8fd1\u6709\u8bc1\u636e\u7684\u65f6\u95f4\u6876 ${nearestViewpointBucket}`
          : null;
    } else {
      const nearestStorylineBucket = getNearestEvidenceBucket(storylineBucketIndexes, requestedBucketIndex);
      if (nearestStorylineBucket !== null) {
        resolvedBucketIndex = nearestStorylineBucket;
        scopedEvidence = filterEvidenceAtBucket(nearestStorylineBucket, null);
        resolvedViewpointId =
          rankViewpointIds(
            bundle,
            [
              ...scopedEvidence.evidenceClusters.map((cluster) => cluster.viewpoint_id),
              ...scopedEvidence.particles.map((particle) => particle.viewpoint_id)
            ],
            nearestStorylineBucket,
            focus.activeViewpointId
          )[0] ?? null;
        didFallback = requestedBucketIndex !== nearestStorylineBucket;
        fallbackMessage = didFallback
          ? `\u5f53\u524d\u65f6\u95f4\u6876\u6ca1\u6709\u8bc1\u636e\uff0c\u5df2\u56de\u9000\u5230\u6700\u8fd1\u6709\u8bc1\u636e\u7684\u65f6\u95f4\u6876 ${nearestStorylineBucket}`
          : null;
      }
    }
  }

  const resolvedBucketStart =
    scopedEvidence.evidenceClusters[0]?.bucket_start ??
    scopedEvidence.particles[0]?.bucket_start ??
    null;

  return {
    storylineId,
    requestedBucketIndex,
    resolvedBucketIndex,
    resolvedBucketStart,
    resolvedViewpointId:
      resolvedViewpointId ??
      rankViewpointIds(
        bundle,
        [
          ...scopedEvidence.evidenceClusters.map((cluster) => cluster.viewpoint_id),
          ...scopedEvidence.particles.map((particle) => particle.viewpoint_id)
        ],
        resolvedBucketIndex,
        focus.activeViewpointId
      )[0] ??
      null,
    particles: scopedEvidence.particles,
    evidenceClusters: scopedEvidence.evidenceClusters,
    didFallback,
    fallbackMessage
  };
}
