import type { PublishedBundle, PublishedViewpoint } from "../loader/publishedTypes";
import type { WorkspaceFocusState } from "./focusState";

type PublishedStorylineSnapshot = PublishedBundle["stream"]["storyline_snapshots"][number];
type PublishedViewpointRelation = PublishedBundle["neural_map"]["viewpoint_relations"][number];
type PublishedStorylineRelation = PublishedBundle["neural_map"]["storyline_relations"][number];
type PublishedEvidenceParticle = PublishedBundle["particle_field"]["particles"][number];
type PublishedEvidenceCluster = PublishedBundle["particle_field"]["evidence_clusters"][number];
type PublishedViewpointSnapshot = PublishedBundle["neural_map"]["viewpoint_snapshots"][number];
type PublishedStoryline = PublishedBundle["stream"]["storylines"][number];

export interface ResolvedStorylineFocus {
  storylineId: string;
  storylineIds: string[];
  viewpointId: string | null;
  bucketIndex: number | null;
  bucketStart: string | null;
  message: string;
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
  timelineBuckets: Array<{
    bucketIndex: number;
    bucketStart: string;
    storylineHeatIndex: number;
    isActiveBucket: boolean;
    hasDisplayViewpoint: boolean;
    hasRequestedViewpoint: boolean;
  }>;
  lanes: Array<{
    viewpointId: string;
    title: string;
    topicTag: string;
    isCurrent: boolean;
    isPeer: boolean;
    isExternalAnchor: boolean;
    relationTypeHint: PublishedViewpointRelation["relation_type"] | null;
    score: number;
    points: Array<{
      bucketIndex: number;
      bucketStart: string;
      hasSnapshot: boolean;
      supportCount: number | null;
      heatIndex: number | null;
      isActiveBucket: boolean;
      isCurrentViewpoint: boolean;
      relationWeight: number | null;
    }>;
  }>;
  externalAnchors: Array<{
    id: string;
    label: string;
    kind: "viewpoint" | "storyline";
    direction: "incoming" | "outgoing";
    relationType: string;
    weight: number;
    summary: string;
  }>;
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

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function getStorylineSnapshots(bundle: PublishedBundle, storylineId: string): PublishedStorylineSnapshot[] {
  return [...bundle.stream.storyline_snapshots]
    .filter((snapshot) => snapshot.storyline_id === storylineId)
    .sort((left, right) => left.bucket_index - right.bucket_index);
}

function getViewpoint(bundle: PublishedBundle, viewpointId: string): PublishedViewpoint | undefined {
  return bundle.neural_map.viewpoints.find((viewpoint) => viewpoint.viewpoint_id === viewpointId);
}

function getViewpointSnapshotSupport(bundle: PublishedBundle, viewpointId: string, bucketIndex: number | null): number {
  if (bucketIndex === null) {
    return -1;
  }
  return (
    bundle.neural_map.viewpoint_snapshots.find(
      (snapshot) => snapshot.viewpoint_id === viewpointId && snapshot.bucket_index === bucketIndex
    )?.support_count ?? -1
  );
}

function sortViewpointIdsByStrength(
  bundle: PublishedBundle,
  viewpointIds: string[],
  bucketIndex: number | null
): string[] {
  return uniqueIds(viewpointIds).sort((leftId, rightId) => {
    const left = getViewpoint(bundle, leftId);
    const right = getViewpoint(bundle, rightId);
    const bucketSupportDelta =
      getViewpointSnapshotSupport(bundle, rightId, bucketIndex) - getViewpointSnapshotSupport(bundle, leftId, bucketIndex);
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
  return sortViewpointIdsByStrength(
    bundle,
    [...snapshot.top_viewpoint_ids, ...snapshot.viewpoint_ids],
    snapshot.bucket_index
  );
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

function getStorylineTitle(bundle: PublishedBundle, storylineId: string): string {
  return (
    bundle.stream.storylines.find((storyline) => storyline.storyline_id === storylineId)?.title ?? storylineId
  );
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

function getViewpointSnapshotHeat(
  bundle: PublishedBundle,
  viewpointId: string,
  bucketIndex: number
): number {
  return getViewpointSnapshot(bundle, viewpointId, bucketIndex)?.heat_index ?? -1;
}

function getViewpointSnapshotSupportCount(
  bundle: PublishedBundle,
  viewpointId: string,
  bucketIndex: number
): number {
  return getViewpointSnapshot(bundle, viewpointId, bucketIndex)?.support_count ?? -1;
}

function getViewpointRelationWeight(
  bundle: PublishedBundle,
  sourceViewpointId: string,
  targetViewpointId: string
): number {
  const directRelation = bundle.neural_map.viewpoint_relations.find(
    (relation) =>
      (relation.source_viewpoint_id === sourceViewpointId && relation.target_viewpoint_id === targetViewpointId) ||
      (relation.source_viewpoint_id === targetViewpointId && relation.target_viewpoint_id === sourceViewpointId)
  );
  return directRelation?.weight ?? 0;
}

function getTimelineLaneScore(
  bundle: PublishedBundle,
  viewpointId: string,
  displayViewpointId: string | null,
  bucketIndex: number | null
): number {
  const viewpoint = getViewpoint(bundle, viewpointId);
  const snapshotSupport = bucketIndex === null ? -1 : getViewpointSnapshotSupport(bundle, viewpointId, bucketIndex);
  const totalSupport = viewpoint?.support_count ?? -1;
  const grounding = viewpoint?.summary_grounding_score ?? -1;
  const relationWeight =
    displayViewpointId && displayViewpointId !== viewpointId
      ? getViewpointRelationWeight(bundle, displayViewpointId, viewpointId)
      : 1;
  return relationWeight * 1000 + snapshotSupport * 100 + totalSupport * 10 + grounding;
}

function getLanePoints(
  bundle: PublishedBundle,
  viewpointId: string,
  bucketIndexes: number[],
  activeBucketIndex: number | null,
  displayViewpointId: string | null
): Array<{
  bucketIndex: number;
  bucketStart: string;
  hasSnapshot: boolean;
  supportCount: number | null;
  heatIndex: number | null;
  isActiveBucket: boolean;
  isCurrentViewpoint: boolean;
  relationWeight: number | null;
}> {
  return bucketIndexes.map((bucketIndex) => {
    const snapshot = getViewpointSnapshot(bundle, viewpointId, bucketIndex);
    return {
      bucketIndex,
      bucketStart:
        snapshot?.bucket_start ??
        bundle.stream.storyline_snapshots.find((item) => item.bucket_index === bucketIndex)?.bucket_start ??
        "",
      hasSnapshot: Boolean(snapshot),
      supportCount: snapshot?.support_count ?? null,
      heatIndex: snapshot?.heat_index ?? null,
      isActiveBucket: bucketIndex === activeBucketIndex,
      isCurrentViewpoint: displayViewpointId === viewpointId,
      relationWeight:
        displayViewpointId && displayViewpointId !== viewpointId
          ? getViewpointRelationWeight(bundle, displayViewpointId, viewpointId)
          : 1
    };
  });
}

function getExternalViewpointAnchors(
  bundle: PublishedBundle,
  storylineId: string,
  laneViewpointIds: string[],
  displayViewpointId: string | null
): ScopedRelationshipState["externalAnchors"] {
  const relatedViewpointIds = new Set<string>();
  for (const relation of bundle.neural_map.viewpoint_relations) {
    const involvesLane =
      laneViewpointIds.includes(relation.source_viewpoint_id) || laneViewpointIds.includes(relation.target_viewpoint_id);
    if (!involvesLane) {
      continue;
    }
    if (!laneViewpointIds.includes(relation.source_viewpoint_id)) {
      relatedViewpointIds.add(relation.source_viewpoint_id);
    }
    if (!laneViewpointIds.includes(relation.target_viewpoint_id)) {
      relatedViewpointIds.add(relation.target_viewpoint_id);
    }
  }

  const externalAnchors = [...relatedViewpointIds]
    .map((viewpointId) => {
      const viewpoint = getViewpoint(bundle, viewpointId);
      const directRelation = bundle.neural_map.viewpoint_relations.find(
        (relation) =>
          (relation.source_viewpoint_id === displayViewpointId && relation.target_viewpoint_id === viewpointId) ||
          (relation.source_viewpoint_id === viewpointId && relation.target_viewpoint_id === displayViewpointId)
      );
      return {
        id: viewpointId,
        label: viewpoint?.title ?? viewpointId,
        kind: "viewpoint" as const,
        direction:
          directRelation?.source_viewpoint_id === displayViewpointId ? ("outgoing" as const) : ("incoming" as const),
        relationType: directRelation?.relation_type ?? "qualifies",
        weight: directRelation?.weight ?? 0,
        summary: viewpoint?.summary ?? ""
      };
    })
    .sort((left, right) => right.weight - left.weight || left.label.localeCompare(right.label))
    .slice(0, 4);

  const storylineAnchors = bundle.neural_map.storyline_relations
    .filter(
      (relation) =>
        relation.source_storyline_id === storylineId || relation.target_storyline_id === storylineId
    )
    .map((relation) => {
      const otherStorylineId =
        relation.source_storyline_id === storylineId ? relation.target_storyline_id : relation.source_storyline_id;
      const storyline = bundle.stream.storylines.find((item) => item.storyline_id === otherStorylineId);
      return {
        id: relation.relation_id,
        label: storyline?.title ?? otherStorylineId,
        kind: "storyline" as const,
        direction: relation.source_storyline_id === storylineId ? ("outgoing" as const) : ("incoming" as const),
        relationType: relation.relation_type,
        weight: relation.weight,
        summary: relation.rationale
      };
    })
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 2);

  return [...externalAnchors, ...storylineAnchors];
}

function getNearestEvidenceBucket(
  bucketIndexes: number[],
  requestedBucketIndex: number | null
): number | null {
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

  const sortedViewpointIds = getSnapshotCandidateViewpointIds(bundle, latestFocusedSnapshot);
  const viewpointId =
    sortedViewpointIds[0] ??
    bundle.reasoning.traceability.find((entry) => entry.storyline_id === storylineId)?.viewpoint_ids[0] ??
    null;
  const bucketIndex = latestFocusedSnapshot?.bucket_index ?? null;
  const bucketStart = latestFocusedSnapshot?.bucket_start ?? null;
  const storylineTitle = getStorylineTitle(bundle, storylineId);

  return {
    storylineId,
    storylineIds: [storylineId],
    viewpointId,
    bucketIndex,
    bucketStart,
    message: viewpointId
      ? `已聚焦主线「${storylineTitle}」的最新强观点。`
      : `已聚焦主线「${storylineTitle}」。`
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
      : findNearestSnapshot(snapshots, focus.activeBucketIndex, (snapshot) => getSnapshotCandidateViewpointIds(bundle, snapshot).length > 0)) ??
    requestedSnapshot ??
    snapshots.at(-1) ??
    null;

  const viewpointIdsInScope = getSnapshotCandidateViewpointIds(bundle, resolvedSnapshot);
  const requestedViewpointId = focus.activeViewpointId;
  const displayViewpointId =
    requestedViewpointId && viewpointIdsInScope.includes(requestedViewpointId)
      ? requestedViewpointId
      : viewpointIdsInScope[0] ?? null;

  const viewpointRelations = bundle.neural_map.viewpoint_relations
    .filter(
      (relation) =>
        viewpointIdsInScope.includes(relation.source_viewpoint_id) ||
        viewpointIdsInScope.includes(relation.target_viewpoint_id)
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
      displayViewpointId !== null ? Boolean(getViewpointSnapshot(bundle, displayViewpointId, snapshot.bucket_index)) : false,
    hasRequestedViewpoint:
      requestedViewpointId !== null
        ? Boolean(getViewpointSnapshot(bundle, requestedViewpointId, snapshot.bucket_index))
        : false
  }));

  const laneViewpointIds = uniqueIds(
    [displayViewpointId, ...viewpointIdsInScope, ...viewpointRelations.flatMap((relation) => [relation.source_viewpoint_id, relation.target_viewpoint_id])].filter(
      (value): value is string => Boolean(value)
    )
  )
    .sort((left, right) => {
      if (left === displayViewpointId) {
        return -1;
      }
      if (right === displayViewpointId) {
        return 1;
      }
      return (
        getTimelineLaneScore(bundle, right, displayViewpointId, resolvedSnapshot?.bucket_index ?? null) -
        getTimelineLaneScore(bundle, left, displayViewpointId, resolvedSnapshot?.bucket_index ?? null)
      );
    })
    .slice(0, 5);

  const lanes = laneViewpointIds.map((viewpointId, index) => {
    const viewpoint = getViewpoint(bundle, viewpointId);
    const directRelation = displayViewpointId
      ? bundle.neural_map.viewpoint_relations.find(
          (relation) =>
            (relation.source_viewpoint_id === displayViewpointId && relation.target_viewpoint_id === viewpointId) ||
            (relation.source_viewpoint_id === viewpointId && relation.target_viewpoint_id === displayViewpointId)
        )
      : null;
    return {
      viewpointId,
      title: viewpoint?.title ?? viewpointId,
      topicTag: viewpoint?.topic_tag ?? bundle.meta.topic_tag,
      isCurrent: index === 0,
      isPeer: index > 0,
      isExternalAnchor: false,
      relationTypeHint: directRelation?.relation_type ?? null,
      score: getTimelineLaneScore(bundle, viewpointId, displayViewpointId, resolvedSnapshot?.bucket_index ?? null),
      points: getLanePoints(
        bundle,
        viewpointId,
        snapshots.map((snapshot) => snapshot.bucket_index),
        resolvedSnapshot?.bucket_index ?? null,
        displayViewpointId
      )
    };
  });

  const externalAnchors = getExternalViewpointAnchors(bundle, storylineId, laneViewpointIds, displayViewpointId);

  const didBucketFallback =
    requestedSnapshot !== null &&
    resolvedSnapshot !== null &&
    requestedSnapshot.bucket_index !== resolvedSnapshot.bucket_index;
  const didViewpointFallback =
    requestedViewpointId !== null &&
    displayViewpointId !== null &&
    requestedViewpointId !== displayViewpointId;

  return {
    storylineId,
    requestedBucketIndex: focus.activeBucketIndex,
    resolvedBucketIndex: resolvedSnapshot?.bucket_index ?? null,
    resolvedBucketStart: resolvedSnapshot?.bucket_start ?? null,
    requestedViewpointId,
    displayViewpointId,
    highlightedViewpointId: displayViewpointId,
    viewpointIdsInScope,
    viewpointRelations,
    storylineRelations,
    timelineBuckets,
    lanes,
    externalAnchors,
    didFallback: didBucketFallback || didViewpointFallback,
    fallbackMessage:
      didBucketFallback && resolvedSnapshot
        ? `当前时间桶没有关系上下文，已回退到最近有关系的时间桶 ${resolvedSnapshot.bucket_index}。`
        : didViewpointFallback && displayViewpointId
          ? `当前时间桶没有当前观点，已在本地切到该桶最强观点 ${displayViewpointId}。`
          : null
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
    [...storylineClusters, ...storylineParticles].sort((left, right) => left.bucket_index - right.bucket_index).at(-1)
      ?.bucket_index ??
    null;

  const requestedScopedEvidence =
    requestedBucketIndex === null
      ? { particles: [] as PublishedEvidenceParticle[], evidenceClusters: [] as PublishedEvidenceCluster[] }
      : filterEvidenceAtBucket(requestedBucketIndex, focus.activeViewpointId);

  const viewpointBucketIndexes = uniqueIds(
    [
      ...storylineParticles
        .filter((particle) => !focus.activeViewpointId || particle.viewpoint_id === focus.activeViewpointId)
        .map((particle) => String(particle.bucket_index)),
      ...storylineClusters
        .filter((cluster) => !focus.activeViewpointId || cluster.viewpoint_id === focus.activeViewpointId)
        .map((cluster) => String(cluster.bucket_index))
    ]
  ).map((value) => Number(value));

  const storylineBucketIndexes = uniqueIds(
    [
      ...storylineParticles.map((particle) => String(particle.bucket_index)),
      ...storylineClusters.map((cluster) => String(cluster.bucket_index))
    ]
  ).map((value) => Number(value));

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
          ? `当前时间桶没有该观点的证据，已回退到最近有证据的时间桶 ${nearestViewpointBucket}。`
          : null;
    } else {
      const nearestStorylineBucket = getNearestEvidenceBucket(storylineBucketIndexes, requestedBucketIndex);
      if (nearestStorylineBucket !== null) {
        resolvedBucketIndex = nearestStorylineBucket;
        scopedEvidence = filterEvidenceAtBucket(nearestStorylineBucket, null);
        resolvedViewpointId =
          sortViewpointIdsByStrength(
            bundle,
            [
              ...scopedEvidence.evidenceClusters.map((cluster) => cluster.viewpoint_id),
              ...scopedEvidence.particles.map((particle) => particle.viewpoint_id)
            ],
            nearestStorylineBucket
          )[0] ?? null;
        didFallback = requestedBucketIndex !== nearestStorylineBucket;
        fallbackMessage =
          didFallback && nearestStorylineBucket !== null
            ? `当前时间桶没有证据，已回退到最近有证据的时间桶 ${nearestStorylineBucket}。`
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
      sortViewpointIdsByStrength(
        bundle,
        [
          ...scopedEvidence.evidenceClusters.map((cluster) => cluster.viewpoint_id),
          ...scopedEvidence.particles.map((particle) => particle.viewpoint_id)
        ],
        resolvedBucketIndex
      )[0] ??
      null,
    particles: scopedEvidence.particles,
    evidenceClusters: scopedEvidence.evidenceClusters,
    didFallback,
    fallbackMessage
  };
}
