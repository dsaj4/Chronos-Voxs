import { useCallback, useEffect, useMemo, useRef } from "react";
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

interface EvidenceClusterVisual {
  id: string;
  label: string;
  viewpointId: string | null;
  viewpointTitle: string;
  bucketIndex: number;
  bucketStart: string;
  commentCount: number;
  particleCount: number;
  avgSignal: number;
  accentColor: string;
  isActiveViewpoint: boolean;
}

interface EvidenceParticleVisual {
  particleId: string;
  clusterId: string;
  viewpointId: string;
  viewpointTitle: string;
  bucketIndex: number;
  commentId: string;
  excerpt: string;
  signalStrength: number;
  size: number;
  isActiveViewpoint: boolean;
}

interface ClusterCanvasLayout {
  id: string;
  label: string;
  accentColor: string;
  particleCount: number;
  cx: number;
  cy: number;
}

interface ParticleCanvasLayout {
  id: string;
  clusterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  particle: EvidenceParticleVisual;
}

const EVIDENCE_COLORS = ["#56CCF2", "#F2C94C", "#6FCF97", "#CE93D8"];

function getBucketSummaries(
  bundle: PublishedBundle,
  storylineId: string,
  resolvedBucketIndex: number | null
): EvidenceBucketSummary[] {
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
    .map(([bucketIndex, bucketStart]) => ({
      bucketIndex,
      bucketStart,
      particleCount: storylineParticles.filter((particle) => particle.bucket_index === bucketIndex).length,
      clusterCount: storylineClusters.filter((cluster) => cluster.bucket_index === bucketIndex).length,
      isActiveBucket: bucketIndex === resolvedBucketIndex
    }));
}

function getClusterVisuals(bundle: PublishedBundle, scope: ScopedEvidenceState): EvidenceClusterVisual[] {
  const viewpointById = new Map(
    bundle.neural_map.viewpoints.map((viewpoint) => [viewpoint.viewpoint_id, viewpoint])
  );

  const rawClusters =
    scope.evidenceClusters.length > 0
      ? scope.evidenceClusters.map((cluster) => ({
          id: cluster.cluster_id,
          label: cluster.label,
          viewpointId: cluster.viewpoint_id,
          viewpointTitle: viewpointById.get(cluster.viewpoint_id)?.title ?? cluster.viewpoint_id,
          bucketIndex: cluster.bucket_index,
          bucketStart: cluster.bucket_start,
          commentCount: cluster.comment_ids.length
        }))
      : [...new Set(scope.particles.map((particle) => particle.viewpoint_id))].map((viewpointId, index) => {
          const particles = scope.particles.filter((particle) => particle.viewpoint_id === viewpointId);
          return {
            id: `derived-${viewpointId}-${index}`,
            label: viewpointById.get(viewpointId)?.title ?? viewpointId,
            viewpointId,
            viewpointTitle: viewpointById.get(viewpointId)?.title ?? viewpointId,
            bucketIndex: particles[0]?.bucket_index ?? scope.resolvedBucketIndex ?? 0,
            bucketStart: particles[0]?.bucket_start ?? scope.resolvedBucketStart ?? "",
            commentCount: particles.length
          };
        });

  return rawClusters.map((cluster, index) => {
    const clusterParticles = scope.particles.filter((particle) => particle.viewpoint_id === cluster.viewpointId);

    return {
      ...cluster,
      particleCount: clusterParticles.length,
      avgSignal:
        clusterParticles.length > 0
          ? clusterParticles.reduce((sum, particle) => sum + particle.signal_strength, 0) / clusterParticles.length
          : 0,
      accentColor: EVIDENCE_COLORS[index % EVIDENCE_COLORS.length],
      isActiveViewpoint: cluster.viewpointId === scope.resolvedViewpointId
    };
  });
}

function getParticleVisuals(
  clusters: EvidenceClusterVisual[],
  scope: ScopedEvidenceState
): EvidenceParticleVisual[] {
  const clusterByViewpointId = new Map(
    clusters.map((cluster) => [cluster.viewpointId ?? `cluster:${cluster.id}`, cluster])
  );

  return scope.particles.map((particle) => {
    const cluster =
      clusterByViewpointId.get(particle.viewpoint_id) ??
      clusters[0] ??
      ({
        id: `derived-${particle.viewpoint_id}`,
        viewpointTitle: particle.viewpoint_id
      } as Pick<EvidenceClusterVisual, "id" | "viewpointTitle">);

    return {
      particleId: particle.particle_id,
      clusterId: cluster.id,
      viewpointId: particle.viewpoint_id,
      viewpointTitle: cluster.viewpointTitle,
      bucketIndex: particle.bucket_index,
      commentId: particle.comment_id,
      excerpt: particle.excerpt,
      signalStrength: particle.signal_strength,
      size: 3 + particle.signal_strength * 5 + (particle.viewpoint_id === scope.resolvedViewpointId ? 1.5 : 0),
      isActiveViewpoint: particle.viewpoint_id === scope.resolvedViewpointId
    };
  });
}

function createCanvasLayout(
  width: number,
  height: number,
  clusters: EvidenceClusterVisual[],
  particles: EvidenceParticleVisual[]
): { clusterLayouts: ClusterCanvasLayout[]; particleLayouts: ParticleCanvasLayout[] } {
  const clusterCount = Math.max(clusters.length, 1);
  const orbitRadius = Math.min(width, height) * 0.28;

  const clusterLayouts = clusters.map((cluster, index) => {
    const angle = clusterCount === 1 ? -Math.PI / 2 : (index / clusterCount) * Math.PI * 2 - Math.PI / 2;
    return {
      id: cluster.id,
      label: cluster.label,
      accentColor: cluster.accentColor,
      particleCount: cluster.particleCount,
      cx: width / 2 + Math.cos(angle) * orbitRadius,
      cy: height / 2 + Math.sin(angle) * orbitRadius * 0.82
    };
  });

  const layoutByClusterId = new Map(clusterLayouts.map((layout) => [layout.id, layout]));

  const particleLayouts = particles.map((particle, index) => {
    const clusterLayout = layoutByClusterId.get(particle.clusterId);
    const baseX = clusterLayout?.cx ?? width / 2;
    const baseY = clusterLayout?.cy ?? height / 2;
    const spread = clusterCount === 1 ? 56 : 40;
    const angle = ((index % 12) / 12) * Math.PI * 2;

    return {
      id: particle.particleId,
      clusterId: particle.clusterId,
      x: baseX + Math.cos(angle) * spread * (0.35 + Math.random() * 0.65),
      y: baseY + Math.sin(angle) * spread * (0.35 + Math.random() * 0.65),
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      radius: particle.size,
      particle
    };
  });

  return { clusterLayouts, particleLayouts };
}

function ParticleFieldCanvas({
  clusters,
  particles,
  activeViewpointId,
  onParticleClick
}: {
  clusters: EvidenceClusterVisual[];
  particles: EvidenceParticleVisual[];
  activeViewpointId: string | null;
  onParticleClick: (particle: EvidenceParticleVisual) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const clusterLayoutsRef = useRef<ClusterCanvasLayout[]>([]);
  const particleLayoutsRef = useRef<ParticleCanvasLayout[]>([]);

  const initializeLayout = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const width = canvas.width || 0;
    const height = canvas.height || 0;
    if (width === 0 || height === 0) {
      return;
    }

    const layout = createCanvasLayout(width, height, clusters, particles);
    clusterLayoutsRef.current = layout.clusterLayouts;
    particleLayoutsRef.current = layout.particleLayouts;
  }, [clusters, particles]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const resize = () => {
      canvas.width = Math.max(1, Math.floor(container.clientWidth));
      canvas.height = Math.max(1, Math.floor(container.clientHeight));
      initializeLayout();
    };

    resize();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      resize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [initializeLayout]);

  useEffect(() => {
    initializeLayout();
  }, [initializeLayout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let cancelled = false;

    const draw = () => {
      if (cancelled) {
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const clusterLayouts = clusterLayoutsRef.current;
      const particleLayouts = particleLayoutsRef.current;

      context.clearRect(0, 0, width, height);

      context.save();
      context.globalAlpha = 0.42;
      for (const clusterLayout of clusterLayouts) {
        context.beginPath();
        context.arc(clusterLayout.cx, clusterLayout.cy, 18, 0, Math.PI * 2);
        context.strokeStyle = `${clusterLayout.accentColor}66`;
        context.lineWidth = 1.2;
        context.stroke();

        context.fillStyle = clusterLayout.accentColor;
        context.font = '11px "Noto Sans SC", sans-serif';
        context.textAlign = "center";
        context.fillText(clusterLayout.label, clusterLayout.cx, clusterLayout.cy + 30);

        context.fillStyle = "rgba(145, 161, 187, 0.8)";
        context.font = '10px "JetBrains Mono", monospace';
        context.fillText(`${clusterLayout.particleCount} pts`, clusterLayout.cx, clusterLayout.cy + 44);
      }
      context.restore();

      for (const particleLayout of particleLayouts) {
        particleLayout.x += particleLayout.vx;
        particleLayout.y += particleLayout.vy;

        if (particleLayout.x < 18 || particleLayout.x > width - 18) {
          particleLayout.vx *= -1;
        }
        if (particleLayout.y < 18 || particleLayout.y > height - 18) {
          particleLayout.vy *= -1;
        }

        if (Math.random() < 0.015) {
          particleLayout.vx += (Math.random() - 0.5) * 0.06;
          particleLayout.vy += (Math.random() - 0.5) * 0.06;
        }
      }

      for (let index = 0; index < particleLayouts.length; index += 1) {
        const left = particleLayouts[index];

        for (let nextIndex = index + 1; nextIndex < particleLayouts.length; nextIndex += 1) {
          const right = particleLayouts[nextIndex];
          if (left.clusterId !== right.clusterId) {
            continue;
          }

          const distance = Math.hypot(left.x - right.x, left.y - right.y);
          if (distance > 88) {
            continue;
          }

          context.beginPath();
          context.moveTo(left.x, left.y);
          context.lineTo(right.x, right.y);
          context.strokeStyle = `rgba(86, 204, 242, ${0.05 * (1 - distance / 88)})`;
          context.lineWidth = 0.8;
          context.stroke();
        }
      }

      for (const particleLayout of particleLayouts) {
        const isActiveParticle =
          particleLayout.particle.isActiveViewpoint || particleLayout.particle.viewpointId === activeViewpointId;

        if (isActiveParticle) {
          const halo = context.createRadialGradient(
            particleLayout.x,
            particleLayout.y,
            0,
            particleLayout.x,
            particleLayout.y,
            particleLayout.radius * 4.4
          );
          halo.addColorStop(0, "rgba(86, 204, 242, 0.28)");
          halo.addColorStop(1, "rgba(86, 204, 242, 0)");
          context.beginPath();
          context.arc(particleLayout.x, particleLayout.y, particleLayout.radius * 4.4, 0, Math.PI * 2);
          context.fillStyle = halo;
          context.fill();
        }

        context.beginPath();
        context.arc(particleLayout.x, particleLayout.y, particleLayout.radius, 0, Math.PI * 2);
        context.fillStyle = isActiveParticle ? "#56CCF2" : "rgba(58, 74, 92, 0.92)";
        context.fill();

        context.beginPath();
        context.arc(particleLayout.x, particleLayout.y, Math.max(1.5, particleLayout.radius * 0.42), 0, Math.PI * 2);
        context.fillStyle = isActiveParticle ? "#F2C94C" : "rgba(220, 233, 249, 0.68)";
        context.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [activeViewpointId, clusters, particles]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      let nearest: ParticleCanvasLayout | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const particleLayout of particleLayoutsRef.current) {
        const distance = Math.hypot(particleLayout.x - x, particleLayout.y - y);
        const threshold = Math.max(14, particleLayout.radius + 8);

        if (distance <= threshold && distance < nearestDistance) {
          nearest = particleLayout;
          nearestDistance = distance;
        }
      }

      if (nearest) {
        onParticleClick(nearest.particle);
      }
    },
    [onParticleClick]
  );

  return (
    <div ref={containerRef} className="evidence-stage__canvas-shell">
      <canvas
        ref={canvasRef}
        className="evidence-stage__canvas"
        onClick={handleClick}
        aria-label={"\u8bc1\u636e\u7c92\u5b50\u573a"}
      />
    </div>
  );
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

  const bucketSummaries = useMemo(
    () =>
      storyline ? getBucketSummaries(bundle, storyline.storyline_id, scope.resolvedBucketIndex) : [],
    [bundle, scope.resolvedBucketIndex, storyline]
  );
  const clusters = useMemo(() => getClusterVisuals(bundle, scope), [bundle, scope]);
  const particles = useMemo(() => getParticleVisuals(clusters, scope), [clusters, scope]);

  const handleParticleClick = useCallback(
    (particle: EvidenceParticleVisual) => {
      onEvidenceFocus({
        viewpointId: particle.viewpointId,
        bucketIndex: particle.bucketIndex,
        impact: `${`\u5df2\u5b9a\u4f4d\u8bc1\u636e\u7c92\u5b50`} ${particle.commentId} / ${`\u6876`} ${particle.bucketIndex}`
      });
    },
    [onEvidenceFocus]
  );

  if (!storyline || (!scope.particles.length && !scope.evidenceClusters.length)) {
    return <div className="empty-state">{`\u8bc1\u636e\u89c6\u56fe\u5f53\u524d\u6ca1\u6709\u53ef\u6e32\u67d3\u7684\u5207\u7247\u3002`}</div>;
  }

  return (
    <section className="panel evidence-panel evidence-panel--signal">
      <div className="evidence-stage__header">
        <div>
          <p className="eyebrow">{`\u8bc1\u636e\u89c6\u56fe`}</p>
          <h2>{`\u65f6\u95f4-\u8bc1\u636e\u7c92\u5b50\u573a`}</h2>
          <p className="muted">
            {resolvedViewpoint
              ? `${resolvedViewpoint.title}${`\u4f5c\u4e3a\u5f53\u524d\u89c6\u89d2\u951a\u70b9\u3002\u53ef\u5728\u6b64\u76f4\u63a5\u8ddf\u8fdb\u5230\u5bf9\u5e94\u8bc4\u8bba\u7c92\u5b50\u3002`}`
              : `\u5f53\u524d\u5207\u7247\u6309\u4e3b\u7ebf\u8bc1\u636e\u805a\u5408\u663e\u793a\u3002`}
          </p>
        </div>
        <div className="evidence-stage__summary">
          {scope.resolvedBucketIndex !== null ? (
            <span className="workspace-model">{`\u6876 ${scope.resolvedBucketIndex}`}</span>
          ) : null}
          <span className="tone-pill tone-pill--focus">{`${clusters.length} ${`\u4e2a\u7c07`}`}</span>
          <span className="tone-pill tone-pill--forecast">{`${particles.length} ${`\u4e2a\u7c92\u5b50`}`}</span>
        </div>
      </div>

      {scope.fallbackMessage ? <p className="detail-panel__note">{scope.fallbackMessage}</p> : null}

      <div className="panel__meta">
        <span className="pill">{storyline.title}</span>
        {resolvedViewpoint ? <span className="pill">{`${`\u89c2\u70b9`} ${resolvedViewpoint.title}`}</span> : null}
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

        <div className="evidence-stage__field">
          <ParticleFieldCanvas
            clusters={clusters}
            particles={particles}
            activeViewpointId={scope.resolvedViewpointId}
            onParticleClick={handleParticleClick}
          />
        </div>

        <div className="evidence-stage__cluster-strip">
          {clusters.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              className={`evidence-stage__cluster-chip ${
                cluster.isActiveViewpoint ? "evidence-stage__cluster-chip--active" : ""
              }`}
              onClick={() =>
                onEvidenceFocus({
                  viewpointId: cluster.viewpointId,
                  bucketIndex: cluster.bucketIndex,
                  impact: `${`\u5df2\u805a\u7126\u8bc1\u636e\u7c07`} ${cluster.label} / ${`\u6876`} ${cluster.bucketIndex}`
                })
              }
            >
              <div className="evidence-stage__cluster-chip-head">
                <span className="evidence-stage__cluster-chip-dot" style={{ background: cluster.accentColor }} />
                <strong>{cluster.label}</strong>
              </div>
              <div className="evidence-stage__cluster-chip-meta">
                <span>{cluster.viewpointTitle}</span>
                <span>{`${cluster.commentCount} ${`\u6761\u8bc4\u8bba`}`}</span>
                <span>{`Signal ${cluster.avgSignal.toFixed(2)}`}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
