import { formatBucketStart } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import type { ScopedEvidenceState } from "../state/focusSelectors";

interface EvidencePanelProps {
  bundle: PublishedBundle;
  scope: ScopedEvidenceState;
  onBucketSelect: (bucketIndex: number) => void;
  onEvidenceFocus: (input: { viewpointId: string | null; bucketIndex: number; impact: string }) => void;
}

interface EvidenceBucketSummary {
  bucketIndex: number;
  bucketStart: string;
  particleCount: number;
  clusterCount: number;
  isActiveBucket: boolean;
}

interface EvidenceClusterEntry {
  id: string;
  label: string;
  viewpointId: string | null;
  viewpointTitle: string;
  bucketIndex: number;
  bucketStart: string;
  commentCount: number;
  particleCount: number;
  avgSignal: number;
  representativeCommentId: string | null;
  leadExcerpt: string | null;
  orbitLeft: number;
  orbitTop: number;
  isActiveViewpoint: boolean;
}

interface EvidenceParticleNode {
  particleId: string;
  viewpointId: string;
  viewpointTitle: string;
  bucketIndex: number;
  commentId: string;
  excerpt: string;
  signalStrength: number;
  left: number;
  top: number;
  size: number;
  isActiveViewpoint: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getBucketSummaries(bundle: PublishedBundle, storylineId: string, resolvedBucketIndex: number | null) {
  const storylineSnapshots = bundle.stream.storyline_snapshots
    .filter((snapshot) => snapshot.storyline_id === storylineId)
    .sort((left, right) => left.bucket_index - right.bucket_index);
  const storylineParticles = bundle.particle_field.particles.filter((particle) => particle.storyline_id === storylineId);
  const storylineClusters = bundle.particle_field.evidence_clusters.filter((cluster) => cluster.storyline_id === storylineId);
  const bucketStartByIndex = new Map<number, string>();

  for (const snapshot of storylineSnapshots) {
    bucketStartByIndex.set(snapshot.bucket_index, snapshot.bucket_start);
  }
  for (const particle of storylineParticles) {
    bucketStartByIndex.set(particle.bucket_index, particle.bucket_start);
  }
  for (const cluster of storylineClusters) {
    bucketStartByIndex.set(cluster.bucket_index, cluster.bucket_start);
  }

  return [...bucketStartByIndex.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([bucketIndex, bucketStart]): EvidenceBucketSummary => ({
      bucketIndex,
      bucketStart,
      particleCount: storylineParticles.filter((particle) => particle.bucket_index === bucketIndex).length,
      clusterCount: storylineClusters.filter((cluster) => cluster.bucket_index === bucketIndex).length,
      isActiveBucket: bucketIndex === resolvedBucketIndex
    }));
}

function getClusterEntries(bundle: PublishedBundle, scope: ScopedEvidenceState): EvidenceClusterEntry[] {
  const viewpointById = new Map(
    bundle.neural_map.viewpoints.map((viewpoint) => [viewpoint.viewpoint_id, viewpoint])
  );

  const rawClusters =
    scope.evidenceClusters.length > 0
      ? scope.evidenceClusters.map((cluster) => ({
          id: cluster.cluster_id,
          label: cluster.label,
          viewpointId: cluster.viewpoint_id,
          bucketIndex: cluster.bucket_index,
          bucketStart: cluster.bucket_start,
          commentCount: cluster.comment_ids.length,
          representativeCommentId: cluster.representative_comment_id
        }))
      : [...new Set(scope.particles.map((particle) => particle.viewpoint_id))].map((viewpointId, index) => {
          const particles = scope.particles.filter((particle) => particle.viewpoint_id === viewpointId);
          return {
            id: `derived-${viewpointId}-${index}`,
            label: viewpointById.get(viewpointId)?.title ?? viewpointId,
            viewpointId,
            bucketIndex: particles[0]?.bucket_index ?? scope.resolvedBucketIndex ?? 0,
            bucketStart: particles[0]?.bucket_start ?? scope.resolvedBucketStart ?? "",
            commentCount: particles.length,
            representativeCommentId: particles[0]?.comment_id ?? null
          };
        });

  const clusterCount = Math.max(rawClusters.length, 1);

  return rawClusters.map((cluster, index) => {
    const clusterParticles = scope.particles.filter((particle) => particle.viewpoint_id === cluster.viewpointId);
    const leadParticle =
      [...clusterParticles].sort((left, right) => right.signal_strength - left.signal_strength)[0] ?? null;
    const angle = clusterCount === 1 ? 0 : (-Math.PI / 2) + (index / clusterCount) * Math.PI * 2;
    const orbitRadiusX = clusterCount === 1 ? 0 : 28;
    const orbitRadiusY = clusterCount === 1 ? 0 : 22;

    return {
      ...cluster,
      viewpointTitle: cluster.viewpointId
        ? viewpointById.get(cluster.viewpointId)?.title ?? cluster.viewpointId
        : "\u8bc1\u636e\u7c07",
      particleCount: clusterParticles.length,
      avgSignal:
        clusterParticles.length > 0
          ? clusterParticles.reduce((sum, particle) => sum + particle.signal_strength, 0) / clusterParticles.length
          : 0,
      leadExcerpt: leadParticle?.excerpt ?? null,
      orbitLeft: clamp(50 + Math.cos(angle) * orbitRadiusX, 18, 82),
      orbitTop: clamp(50 + Math.sin(angle) * orbitRadiusY, 18, 82),
      isActiveViewpoint: cluster.viewpointId === scope.resolvedViewpointId
    };
  });
}

function getParticleNodes(clusterEntries: EvidenceClusterEntry[], scope: ScopedEvidenceState): EvidenceParticleNode[] {
  return clusterEntries.flatMap((cluster, clusterIndex) => {
    const clusterParticles = scope.particles
      .filter((particle) => particle.viewpoint_id === cluster.viewpointId)
      .sort((left, right) => right.signal_strength - left.signal_strength);

    return clusterParticles.map((particle, particleIndex) => {
      const angle =
        (particleIndex / Math.max(clusterParticles.length, 1)) * Math.PI * 2 + clusterIndex * 0.72 + 0.4;
      const offset = 5 + particle.signal_strength * 4 + (particleIndex % 2 === 0 ? 1 : 2.5);
      return {
        particleId: particle.particle_id,
        viewpointId: particle.viewpoint_id,
        viewpointTitle: cluster.viewpointTitle,
        bucketIndex: particle.bucket_index,
        commentId: particle.comment_id,
        excerpt: particle.excerpt,
        signalStrength: particle.signal_strength,
        left: clamp(cluster.orbitLeft + Math.cos(angle) * offset, 8, 92),
        top: clamp(cluster.orbitTop + Math.sin(angle) * offset * 0.78, 12, 88),
        size: 10 + particle.signal_strength * 12 + (particle.viewpoint_id === scope.resolvedViewpointId ? 4 : 0),
        isActiveViewpoint: particle.viewpoint_id === scope.resolvedViewpointId
      };
    });
  });
}

export function EvidencePanel({ bundle, scope, onBucketSelect, onEvidenceFocus }: EvidencePanelProps) {
  const storyline =
    scope.storylineId === null
      ? null
      : bundle.stream.storylines.find((item) => item.storyline_id === scope.storylineId) ?? null;
  const resolvedViewpoint =
    scope.resolvedViewpointId === null
      ? null
      : bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === scope.resolvedViewpointId) ?? null;

  if (!storyline || (!scope.particles.length && !scope.evidenceClusters.length)) {
    return <div className="empty-state">{`\u8bc1\u636e\u89c6\u56fe\u5f53\u524d\u6ca1\u6709\u53ef\u6e32\u67d3\u7684\u5207\u7247\u3002`}</div>;
  }

  const bucketSummaries = getBucketSummaries(bundle, storyline.storyline_id, scope.resolvedBucketIndex);
  const clusterEntries = getClusterEntries(bundle, scope);
  const particleNodes = getParticleNodes(clusterEntries, scope);
  const leadParticles = [...scope.particles]
    .sort((left, right) => right.signal_strength - left.signal_strength)
    .slice(0, 6);

  return (
    <section className="panel evidence-panel evidence-panel--signal">
      <div className="evidence-stage__header">
        <div>
          <p className="eyebrow">{`\u8bc1\u636e\u89c6\u56fe`}</p>
          <h2>{`\u65f6\u95f4-\u8bc1\u636e\u661f\u56fe`}</h2>
          <p className="muted">
            {resolvedViewpoint
              ? `${resolvedViewpoint.title} ${`\u4f5c\u4e3a\u5f53\u524d\u89c6\u89d2\u951a\u70b9\u3002\u53ef\u4ee5\u5728\u821e\u53f0\u5185\u5c40\u90e8\u5207\u6876\u3001\u5207\u70b9\u6216\u8ddf\u8fdb\u5230\u5177\u4f53\u8bc1\u636e\u3002`}`
              : `\u5f53\u524d\u5207\u7247\u6309\u4e3b\u7ebf\u8bc1\u636e\u805a\u5408\u663e\u793a\u3002`}
          </p>
        </div>
        <div className="evidence-stage__summary">
          {scope.resolvedBucketIndex !== null ? (
            <span className="workspace-model">{`\u6876 ${scope.resolvedBucketIndex}`}</span>
          ) : null}
          <span className="tone-pill tone-pill--focus">{`${clusterEntries.length} ${`\u4e2a\u7c07`}`}</span>
          <span className="tone-pill tone-pill--forecast">{`${scope.particles.length} ${`\u4e2a\u7c92\u5b50`}`}</span>
        </div>
      </div>

      {scope.fallbackMessage ? <p className="detail-panel__note">{scope.fallbackMessage}</p> : null}

      <div className="panel__meta">
        <span className="pill">{storyline.title}</span>
        {resolvedViewpoint ? <span className="pill">{`${`\u89c6\u70b9`} ${resolvedViewpoint.title}`}</span> : null}
        {scope.resolvedBucketStart ? (
          <span className="pill">{formatBucketStart(scope.resolvedBucketStart, bundle.meta.bucket_granularity)}</span>
        ) : null}
      </div>

      <div className="evidence-stage">
        <div className="evidence-stage__buckets">
          {bucketSummaries.map((bucket) => (
            <button
              key={bucket.bucketIndex}
              type="button"
              className={`evidence-bucket ${bucket.isActiveBucket ? "evidence-bucket--active" : ""}`}
              onClick={() => onBucketSelect(bucket.bucketIndex)}
            >
              <span className="evidence-bucket__eyebrow">{`T${bucket.bucketIndex}`}</span>
              <strong>{formatBucketStart(bucket.bucketStart, bundle.meta.bucket_granularity)}</strong>
              <span className="evidence-bucket__meta">
                {`${bucket.clusterCount} ${`\u7c07`} / ${bucket.particleCount} ${`\u7c92\u5b50`}`}
              </span>
            </button>
          ))}
        </div>

        <div className="evidence-stage__constellation">
          <div className="evidence-stage__center">
            <span className="evidence-stage__center-label">{`\u5f53\u524d\u5207\u7247`}</span>
            <strong>{resolvedViewpoint?.title ?? storyline.title}</strong>
            <p className="evidence-stage__center-summary">
              {scope.resolvedBucketStart
                ? formatBucketStart(scope.resolvedBucketStart, bundle.meta.bucket_granularity)
                : `\u6682\u65e0\u65f6\u95f4\u6863`}
            </p>
            <div className="evidence-stage__center-metrics">
              <span>{`${clusterEntries.length} ${`\u4e2a\u7c07`}`}</span>
              <span>{`${scope.particles.length} ${`\u6761\u8bc1\u636e`}`}</span>
            </div>
          </div>

          {clusterEntries.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              className={`evidence-cluster ${cluster.isActiveViewpoint ? "evidence-cluster--active" : ""}`}
              style={{ left: `${cluster.orbitLeft}%`, top: `${cluster.orbitTop}%` }}
              onClick={() =>
                onEvidenceFocus({
                  viewpointId: cluster.viewpointId,
                  bucketIndex: cluster.bucketIndex,
                  impact: `${`\u5df2\u805a\u7126\u8bc1\u636e\u7c07`} ${cluster.label} / ${`\u6876`} ${cluster.bucketIndex}`
                })
              }
            >
              <span className="evidence-cluster__eyebrow">{cluster.viewpointTitle}</span>
              <strong>{cluster.label}</strong>
              <span className="evidence-cluster__meta">
                {`${cluster.commentCount} ${`\u6761\u8bc4\u8bba`} / Signal ${cluster.avgSignal.toFixed(2)}`}
              </span>
            </button>
          ))}

          {particleNodes.map((particle) => (
            <button
              key={particle.particleId}
              type="button"
              className={`evidence-particle ${particle.isActiveViewpoint ? "evidence-particle--active" : ""}`}
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`
              }}
              title={particle.excerpt}
              aria-label={`${particle.viewpointTitle} / ${particle.commentId}`}
              onClick={() =>
                onEvidenceFocus({
                  viewpointId: particle.viewpointId,
                  bucketIndex: particle.bucketIndex,
                  impact: `${`\u5df2\u5b9a\u4f4d\u8bc1\u636e\u7c92\u5b50`} ${particle.commentId} / ${`\u6876`} ${particle.bucketIndex}`
                })
              }
            >
              <span className="evidence-particle__core" aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="evidence-stage__clusters">
          {clusterEntries.map((cluster) => (
            <button
              key={`card-${cluster.id}`}
              type="button"
              className={`evidence-cluster-card ${cluster.isActiveViewpoint ? "evidence-cluster-card--active" : ""}`}
              onClick={() =>
                onEvidenceFocus({
                  viewpointId: cluster.viewpointId,
                  bucketIndex: cluster.bucketIndex,
                  impact: `${`\u5df2\u5207\u6362\u5230\u8bc1\u636e\u89c6\u89d2`} ${cluster.viewpointTitle} / ${`\u6876`} ${cluster.bucketIndex}`
                })
              }
            >
              <div className="evidence-cluster-card__head">
                <span className="evidence-cluster-card__label">{cluster.label}</span>
                <span className={`tone-pill ${cluster.isActiveViewpoint ? "tone-pill--focus" : "tone-pill--muted"}`}>
                  {cluster.viewpointTitle}
                </span>
              </div>
              <p className="evidence-cluster-card__summary">
                {cluster.leadExcerpt ?? `\u8fd9\u4e2a\u7c07\u6682\u65e0\u53ef\u9884\u89c8\u6458\u5f55\u3002`}
              </p>
              <div className="evidence-cluster-card__meta">
                <span>{`${cluster.particleCount} ${`\u6761\u8bc1\u636e`}`}</span>
                <span>{`Signal ${cluster.avgSignal.toFixed(2)}`}</span>
                {cluster.representativeCommentId ? <span>{cluster.representativeCommentId}</span> : null}
              </div>
            </button>
          ))}
        </div>

        <div className="evidence-stage__feed">
          {leadParticles.map((particle) => {
            const viewpointTitle =
              bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === particle.viewpoint_id)?.title ??
              particle.viewpoint_id;
            return (
              <button
                key={`feed-${particle.particle_id}`}
                type="button"
                className={`evidence-feed__item ${
                  particle.viewpoint_id === scope.resolvedViewpointId ? "evidence-feed__item--active" : ""
                }`}
                onClick={() =>
                  onEvidenceFocus({
                    viewpointId: particle.viewpoint_id,
                    bucketIndex: particle.bucket_index,
                    impact: `${`\u5df2\u8ffd\u8e2a\u8bc1\u636e`} ${particle.comment_id} / ${viewpointTitle}`
                  })
                }
              >
                <div className="evidence-feed__header">
                  <strong>{viewpointTitle}</strong>
                  <span>{`Signal ${particle.signal_strength.toFixed(2)}`}</span>
                </div>
                <p className="evidence-feed__excerpt">{particle.excerpt}</p>
                <div className="evidence-feed__meta">
                  <span>{particle.comment_id}</span>
                  <span>{particle.claim_id}</span>
                  <span>{`T${particle.bucket_index}`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
