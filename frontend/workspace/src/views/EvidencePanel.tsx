import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { StorylineSwitchHeader } from "../components/StorylineSwitchHeader";
import { formatBucketStart } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import { STREAM_COLORS } from "../presentation/workspaceChrome";
import type { ScopedEvidenceState } from "../state/focusSelectors";

type PublishedStoryline = PublishedBundle["stream"]["storylines"][number];
type PublishedEvidenceParticle = PublishedBundle["particle_field"]["particles"][number];

interface EvidencePanelProps {
  bundle: PublishedBundle;
  scope: ScopedEvidenceState;
  onBucketSelect: (bucketIndex: number) => void;
  onEvidenceFocus: (input: {
    storylineId?: string | null;
    viewpointId: string | null;
    bucketIndex: number;
    impact: string;
  }) => void;
  storylines?: PublishedBundle["stream"]["storylines"];
  activeStorylineId?: string | null;
  activeStorylineIds?: string[];
  onStorylineSelect?: (storylineId: string) => void;
}

interface EvidenceBucketSummary {
  bucketIndex: number;
  bucketStart: string;
  particleCount: number;
  clusterCount: number;
  storylineCount: number;
  isActiveBucket: boolean;
}

interface EvidenceClusterVisual {
  id: string;
  storylineId: string;
  storylineTitle: string;
  label: string;
  viewpointId: string | null;
  viewpointTitle: string;
  bucketIndex: number;
  bucketStart: string;
  commentCount: number;
  particleCount: number;
  avgSignal: number;
  accentColor: string;
  fillColor: string;
  isAnchorViewpoint: boolean;
}

interface EvidenceParticleVisual {
  particleId: string;
  clusterId: string;
  storylineId: string;
  storylineTitle: string;
  viewpointId: string;
  viewpointTitle: string;
  bucketIndex: number;
  commentId: string;
  excerpt: string;
  signalStrength: number;
  size: number;
  accentColor: string;
  fillColor: string;
  isHighlighted: boolean;
}

interface ClusterCanvasLayout {
  id: string;
  label: string;
  accentColor: string;
  particleCount: number;
  cx: number;
  cy: number;
  boundaryRadius: number;
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

function sortStorylines(storylines: PublishedStoryline[]): PublishedStoryline[] {
  return [...storylines].sort((left, right) => left.display_rank - right.display_rank);
}

function resolveSelectedStorylineIds({
  availableStorylines,
  activeStorylineIds,
  activeStorylineId,
  scopeStorylineId
}: {
  availableStorylines: PublishedStoryline[];
  activeStorylineIds?: string[];
  activeStorylineId?: string | null;
  scopeStorylineId: string | null;
}): string[] {
  const availableIdSet = new Set(availableStorylines.map((storyline) => storyline.storyline_id));
  const requestedIds =
    activeStorylineIds && activeStorylineIds.length > 0
      ? activeStorylineIds
      : activeStorylineId
        ? [activeStorylineId]
        : scopeStorylineId
          ? [scopeStorylineId]
          : [];

  const selectedIds = [...new Set(requestedIds)].filter((storylineId) => availableIdSet.has(storylineId));
  if (selectedIds.length > 0) {
    return sortStorylines(availableStorylines)
      .map((storyline) => storyline.storyline_id)
      .filter((storylineId) => selectedIds.includes(storylineId));
  }

  return availableStorylines[0] ? [availableStorylines[0].storyline_id] : [];
}

function getStorylineColorMap(storylines: PublishedStoryline[]) {
  return new Map(
    sortStorylines(storylines).map((storyline, index) => [
      storyline.storyline_id,
      STREAM_COLORS[index % STREAM_COLORS.length]
    ])
  );
}

function getBucketResolution(
  bundle: PublishedBundle,
  storylineIds: string[],
  requestedBucketIndex: number | null
): { resolvedBucketIndex: number | null; fallbackMessage: string | null } {
  const selectedStorylineIds = new Set(storylineIds);
  const bucketIndices = [
    ...new Set(
      [
        ...bundle.particle_field.particles
          .filter((particle) => selectedStorylineIds.has(particle.storyline_id))
          .map((particle) => particle.bucket_index),
        ...bundle.particle_field.evidence_clusters
          .filter((cluster) => selectedStorylineIds.has(cluster.storyline_id))
          .map((cluster) => cluster.bucket_index)
      ]
    )
  ].sort((left, right) => left - right);

  if (bucketIndices.length === 0) {
    return { resolvedBucketIndex: null, fallbackMessage: null };
  }

  if (requestedBucketIndex === null) {
    return { resolvedBucketIndex: bucketIndices.at(-1) ?? null, fallbackMessage: null };
  }

  if (bucketIndices.includes(requestedBucketIndex)) {
    return { resolvedBucketIndex: requestedBucketIndex, fallbackMessage: null };
  }

  const resolvedBucketIndex =
    [...bucketIndices].sort((left, right) => {
      const leftDistance = Math.abs(left - requestedBucketIndex);
      const rightDistance = Math.abs(right - requestedBucketIndex);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return right - left;
    })[0] ?? null;

  return {
    resolvedBucketIndex,
    fallbackMessage:
      resolvedBucketIndex === null
        ? null
        : `当前请求桶 T${requestedBucketIndex} 没有证据，已回退到最近可见桶 T${resolvedBucketIndex}。`
  };
}

function getBucketSummaries(
  bundle: PublishedBundle,
  storylineIds: string[],
  resolvedBucketIndex: number | null
): EvidenceBucketSummary[] {
  const selectedStorylineIds = new Set(storylineIds);
  const summaryByBucket = new Map<
    number,
    { bucketStart: string; particleCount: number; clusterCount: number; storylineIds: Set<string> }
  >();

  for (const particle of bundle.particle_field.particles) {
    if (!selectedStorylineIds.has(particle.storyline_id)) {
      continue;
    }

    const current =
      summaryByBucket.get(particle.bucket_index) ??
      {
        bucketStart: particle.bucket_start,
        particleCount: 0,
        clusterCount: 0,
        storylineIds: new Set<string>()
      };
    current.bucketStart = particle.bucket_start;
    current.particleCount += 1;
    current.storylineIds.add(particle.storyline_id);
    summaryByBucket.set(particle.bucket_index, current);
  }

  for (const cluster of bundle.particle_field.evidence_clusters) {
    if (!selectedStorylineIds.has(cluster.storyline_id)) {
      continue;
    }

    const current =
      summaryByBucket.get(cluster.bucket_index) ??
      {
        bucketStart: cluster.bucket_start,
        particleCount: 0,
        clusterCount: 0,
        storylineIds: new Set<string>()
      };
    current.bucketStart = cluster.bucket_start;
    current.clusterCount += 1;
    current.storylineIds.add(cluster.storyline_id);
    summaryByBucket.set(cluster.bucket_index, current);
  }

  return [...summaryByBucket.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([bucketIndex, summary]) => ({
      bucketIndex,
      bucketStart: summary.bucketStart,
      particleCount: summary.particleCount,
      clusterCount: summary.clusterCount,
      storylineCount: summary.storylineIds.size,
      isActiveBucket: bucketIndex === resolvedBucketIndex
    }));
}

function getClusterVisuals(
  bundle: PublishedBundle,
  availableStorylines: PublishedStoryline[],
  storylineIds: string[],
  resolvedBucketIndex: number | null,
  activeViewpointId: string | null,
  anchorStorylineId: string | null
): { clusters: EvidenceClusterVisual[]; particles: PublishedEvidenceParticle[] } {
  if (resolvedBucketIndex === null) {
    return { clusters: [], particles: [] };
  }

  const selectedStorylineIds = new Set(storylineIds);
  const storylineById = new Map(availableStorylines.map((storyline) => [storyline.storyline_id, storyline]));
  const viewpointById = new Map(bundle.neural_map.viewpoints.map((viewpoint) => [viewpoint.viewpoint_id, viewpoint]));
  const storylineColorMap = getStorylineColorMap(availableStorylines);
  const bucketParticles = bundle.particle_field.particles.filter(
    (particle) => selectedStorylineIds.has(particle.storyline_id) && particle.bucket_index === resolvedBucketIndex
  );
  const bucketClusters = bundle.particle_field.evidence_clusters.filter(
    (cluster) => selectedStorylineIds.has(cluster.storyline_id) && cluster.bucket_index === resolvedBucketIndex
  );

  const rawClusters: Array<{
    id: string;
    storylineId: string;
    storylineTitle: string;
    label: string;
    viewpointId: string | null;
    viewpointTitle: string;
    bucketIndex: number;
    bucketStart: string;
    commentCount: number;
  }> =
    bucketClusters.length > 0
      ? bucketClusters.map((cluster) => ({
          id: cluster.cluster_id,
          storylineId: cluster.storyline_id,
          storylineTitle: storylineById.get(cluster.storyline_id)?.title ?? cluster.storyline_id,
          label: cluster.label,
          viewpointId: cluster.viewpoint_id,
          viewpointTitle: viewpointById.get(cluster.viewpoint_id)?.title ?? cluster.viewpoint_id,
          bucketIndex: cluster.bucket_index,
          bucketStart: cluster.bucket_start,
          commentCount: cluster.comment_ids.length
        }))
      : [...new Set(bucketParticles.map((particle) => `${particle.storyline_id}::${particle.viewpoint_id}`))].map(
          (key, index) => {
            const [storylineId, viewpointId] = key.split("::");
            const groupedParticles = bucketParticles.filter(
              (particle) =>
                particle.storyline_id === storylineId &&
                particle.viewpoint_id === viewpointId
            );

            return {
              id: `derived-${storylineId}-${viewpointId}-${resolvedBucketIndex}-${index}`,
              storylineId,
              storylineTitle: storylineById.get(storylineId)?.title ?? storylineId,
              label: viewpointById.get(viewpointId)?.title ?? viewpointId,
              viewpointId,
              viewpointTitle: viewpointById.get(viewpointId)?.title ?? viewpointId,
              bucketIndex: groupedParticles[0]?.bucket_index ?? resolvedBucketIndex,
              bucketStart: groupedParticles[0]?.bucket_start ?? "",
              commentCount: groupedParticles.length
            };
          }
        );

  const clusters = rawClusters
    .map((cluster) => {
      const clusterParticles = bucketParticles.filter(
        (particle) =>
          particle.storyline_id === cluster.storylineId &&
          particle.viewpoint_id === cluster.viewpointId
      );
      const color = storylineColorMap.get(cluster.storylineId) ?? STREAM_COLORS[0];

      return {
        ...cluster,
        particleCount: clusterParticles.length,
        avgSignal:
          clusterParticles.length > 0
            ? clusterParticles.reduce((sum, particle) => sum + particle.signal_strength, 0) / clusterParticles.length
            : 0,
        accentColor: color.stroke,
        fillColor: color.fill,
        isAnchorViewpoint:
          cluster.viewpointId === activeViewpointId && cluster.storylineId === anchorStorylineId
      };
    })
    .sort((left, right) => {
      const leftRank = storylineById.get(left.storylineId)?.display_rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = storylineById.get(right.storylineId)?.display_rank ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      if (right.particleCount !== left.particleCount) {
        return right.particleCount - left.particleCount;
      }
      return left.label.localeCompare(right.label);
    });

  return { clusters, particles: bucketParticles };
}

function getParticleVisuals(
  clusters: EvidenceClusterVisual[],
  particles: PublishedEvidenceParticle[],
  activeViewpointId: string | null,
  anchorStorylineId: string | null,
  selectedClusterIds: string[]
): EvidenceParticleVisual[] {
  const clusterByKey = new Map(
    clusters.map((cluster) => [`${cluster.storylineId}::${cluster.viewpointId ?? ""}`, cluster])
  );
  const selectedClusterIdSet = new Set(selectedClusterIds);

  return particles
    .map((particle) => {
      const cluster =
        clusterByKey.get(`${particle.storyline_id}::${particle.viewpoint_id}`) ??
        clusters.find((item) => item.storylineId === particle.storyline_id) ??
        (clusters[0] ??
          ({
            id: `derived-${particle.storyline_id}-${particle.viewpoint_id}`,
            storylineId: particle.storyline_id,
            storylineTitle: particle.storyline_id,
            viewpointTitle: particle.viewpoint_id,
            accentColor: STREAM_COLORS[0].stroke,
            fillColor: STREAM_COLORS[0].fill
          } as Pick<
            EvidenceClusterVisual,
            "id" | "storylineId" | "storylineTitle" | "viewpointTitle" | "accentColor" | "fillColor"
          >));
      const isHighlighted =
        selectedClusterIdSet.size > 0
          ? selectedClusterIdSet.has(cluster.id)
          : particle.viewpoint_id === activeViewpointId && particle.storyline_id === anchorStorylineId;

      return {
        particleId: particle.particle_id,
        clusterId: cluster.id,
        storylineId: particle.storyline_id,
        storylineTitle: cluster.storylineTitle,
        viewpointId: particle.viewpoint_id,
        viewpointTitle: cluster.viewpointTitle,
        bucketIndex: particle.bucket_index,
        commentId: particle.comment_id,
        excerpt: particle.excerpt,
        signalStrength: particle.signal_strength,
        size: 3 + particle.signal_strength * 5 + (isHighlighted ? 1.5 : 0),
        accentColor: cluster.accentColor,
        fillColor: cluster.fillColor,
        isHighlighted
      };
    })
    .filter((particle) => selectedClusterIdSet.size === 0 || selectedClusterIdSet.has(particle.clusterId));
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
    const angle = clusterCount === 1 ? 0 : (index / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const boundaryRadius = Math.max(clusterCount === 1 ? 78 : 58, 36 + Math.sqrt(cluster.particleCount) * 18);
    return {
      id: cluster.id,
      label: cluster.label,
      accentColor: cluster.accentColor,
      particleCount: cluster.particleCount,
      cx: clusterCount === 1 ? width / 2 : width / 2 + Math.cos(angle) * orbitRadius,
      cy: clusterCount === 1 ? height / 2 : height / 2 + Math.sin(angle) * orbitRadius * 0.82,
      boundaryRadius
    };
  });

  const layoutByClusterId = new Map(clusterLayouts.map((layout) => [layout.id, layout]));

  const particleLayouts = particles.map((particle, index) => {
    const clusterLayout = layoutByClusterId.get(particle.clusterId);
    const baseX = clusterLayout?.cx ?? width / 2;
    const baseY = clusterLayout?.cy ?? height / 2;
    const spread = Math.max(22, (clusterLayout?.boundaryRadius ?? (clusterCount === 1 ? 78 : 58)) - 18);
    const angle = ((index % 12) / 12) * Math.PI * 2;
    const distanceFactor = 0.26 + Math.random() * 0.54;

    return {
      id: particle.particleId,
      clusterId: particle.clusterId,
      x: baseX + Math.cos(angle) * spread * distanceFactor,
      y: baseY + Math.sin(angle) * spread * distanceFactor,
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
  onParticleClick
}: {
  clusters: EvidenceClusterVisual[];
  particles: EvidenceParticleVisual[];
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
        context.setLineDash([7, 7]);
        context.arc(clusterLayout.cx, clusterLayout.cy, clusterLayout.boundaryRadius, 0, Math.PI * 2);
        context.strokeStyle = `${clusterLayout.accentColor}32`;
        context.lineWidth = 1;
        context.stroke();
        context.setLineDash([]);

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

      const clusterLayoutById = new Map(clusterLayouts.map((layout) => [layout.id, layout]));
      for (const particleLayout of particleLayouts) {
        const clusterLayout = clusterLayoutById.get(particleLayout.clusterId);
        if (clusterLayout) {
          const attractionX = clusterLayout.cx - particleLayout.x;
          const attractionY = clusterLayout.cy - particleLayout.y;
          particleLayout.vx += attractionX * 0.0008;
          particleLayout.vy += attractionY * 0.0008;
        }

        const speed = Math.hypot(particleLayout.vx, particleLayout.vy);
        if (speed > 0.72) {
          particleLayout.vx = (particleLayout.vx / speed) * 0.72;
          particleLayout.vy = (particleLayout.vy / speed) * 0.72;
        }

        particleLayout.x += particleLayout.vx;
        particleLayout.y += particleLayout.vy;

        if (clusterLayout) {
          const offsetX = particleLayout.x - clusterLayout.cx;
          const offsetY = particleLayout.y - clusterLayout.cy;
          const offsetDistance = Math.hypot(offsetX, offsetY) || 1;
          const maxDistance = Math.max(18, clusterLayout.boundaryRadius - particleLayout.radius - 4);

          if (offsetDistance > maxDistance) {
            const normalX = offsetX / offsetDistance;
            const normalY = offsetY / offsetDistance;
            const radialVelocity = particleLayout.vx * normalX + particleLayout.vy * normalY;

            particleLayout.x = clusterLayout.cx + normalX * maxDistance;
            particleLayout.y = clusterLayout.cy + normalY * maxDistance;
            particleLayout.vx -= radialVelocity * 1.8 * normalX;
            particleLayout.vy -= radialVelocity * 1.8 * normalY;
            particleLayout.vx -= normalX * 0.04;
            particleLayout.vy -= normalY * 0.04;
          }
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
          const minDistance = left.radius + right.radius + 2;

          if (distance < minDistance) {
            const safeDistance = distance || 0.001;
            const normalX = (left.x - right.x) / safeDistance;
            const normalY = (left.y - right.y) / safeDistance;
            const overlap = (minDistance - safeDistance) / 2;

            left.x += normalX * overlap;
            left.y += normalY * overlap;
            right.x -= normalX * overlap;
            right.y -= normalY * overlap;
            left.vx += normalX * 0.03;
            left.vy += normalY * 0.03;
            right.vx -= normalX * 0.03;
            right.vy -= normalY * 0.03;
          }

          if (distance > 88) {
            continue;
          }

          const clusterLayout = clusterLayoutById.get(left.clusterId);
          context.save();
          context.beginPath();
          context.moveTo(left.x, left.y);
          context.lineTo(right.x, right.y);
          context.globalAlpha = 0.05 * (1 - distance / 88);
          context.strokeStyle = clusterLayout?.accentColor ?? "#56CCF2";
          context.lineWidth = 0.8;
          context.stroke();
          context.restore();
        }
      }

      for (const particleLayout of particleLayouts) {
        const isHighlighted = particleLayout.particle.isHighlighted;

        if (isHighlighted) {
          const halo = context.createRadialGradient(
            particleLayout.x,
            particleLayout.y,
            0,
            particleLayout.x,
            particleLayout.y,
            particleLayout.radius * 4.4
          );
          halo.addColorStop(0, `${particleLayout.particle.accentColor}4a`);
          halo.addColorStop(1, `${particleLayout.particle.accentColor}00`);
          context.beginPath();
          context.arc(particleLayout.x, particleLayout.y, particleLayout.radius * 4.4, 0, Math.PI * 2);
          context.fillStyle = halo;
          context.fill();
        }

        context.beginPath();
        context.arc(particleLayout.x, particleLayout.y, particleLayout.radius, 0, Math.PI * 2);
        context.fillStyle = isHighlighted
          ? particleLayout.particle.accentColor
          : `${particleLayout.particle.accentColor}88`;
        context.fill();

        context.beginPath();
        context.arc(particleLayout.x, particleLayout.y, Math.max(1.5, particleLayout.radius * 0.42), 0, Math.PI * 2);
        context.fillStyle = isHighlighted ? "#F2C94C" : "rgba(220, 233, 249, 0.68)";
        context.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [clusters, particles]);

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

export function EvidencePanel({
  bundle,
  scope,
  onBucketSelect,
  onEvidenceFocus,
  storylines,
  activeStorylineId,
  activeStorylineIds,
  onStorylineSelect
}: EvidencePanelProps) {
  const availableStorylines = useMemo(
    () => sortStorylines(storylines ?? bundle.stream.storylines),
    [bundle.stream.storylines, storylines]
  );
  const seededStorylineIds = useMemo(
    () =>
      resolveSelectedStorylineIds({
        availableStorylines,
        activeStorylineIds,
        activeStorylineId,
        scopeStorylineId: scope.storylineId
      }),
    [activeStorylineId, activeStorylineIds, availableStorylines, scope.storylineId]
  );
  const seedKey = seededStorylineIds.join("::");
  const [selectedStorylineIds, setSelectedStorylineIds] = useState<string[]>(seededStorylineIds);
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);
  const anchorStorylineId = activeStorylineId ?? scope.storylineId ?? selectedStorylineIds[0] ?? null;

  useEffect(() => {
    setSelectedStorylineIds(seededStorylineIds);
    setSelectedClusterIds([]);
  }, [seedKey, seededStorylineIds]);

  const { resolvedBucketIndex, fallbackMessage } = useMemo(
    () => getBucketResolution(bundle, selectedStorylineIds, scope.requestedBucketIndex),
    [bundle, scope.requestedBucketIndex, selectedStorylineIds]
  );
  const bucketSummaries = useMemo(
    () => getBucketSummaries(bundle, selectedStorylineIds, resolvedBucketIndex),
    [bundle, resolvedBucketIndex, selectedStorylineIds]
  );
  const { clusters: allClusters, particles: bucketParticles } = useMemo(
    () =>
      getClusterVisuals(
        bundle,
        availableStorylines,
        selectedStorylineIds,
        resolvedBucketIndex,
        scope.resolvedViewpointId,
        anchorStorylineId
      ),
    [
      anchorStorylineId,
      availableStorylines,
      bundle,
      resolvedBucketIndex,
      scope.resolvedViewpointId,
      selectedStorylineIds
    ]
  );

  useEffect(() => {
    setSelectedClusterIds((current) => current.filter((clusterId) => allClusters.some((cluster) => cluster.id === clusterId)));
  }, [allClusters]);

  const particles = useMemo(
    () =>
      getParticleVisuals(
        allClusters,
        bucketParticles,
        scope.resolvedViewpointId,
        anchorStorylineId,
        selectedClusterIds
      ),
    [allClusters, anchorStorylineId, bucketParticles, scope.resolvedViewpointId, selectedClusterIds]
  );
  const visibleClusterIds = useMemo(() => new Set(particles.map((particle) => particle.clusterId)), [particles]);
  const visibleClusters = useMemo(
    () =>
      selectedClusterIds.length > 0
        ? allClusters.filter((cluster) => visibleClusterIds.has(cluster.id))
        : allClusters,
    [allClusters, selectedClusterIds.length, visibleClusterIds]
  );
  const resolvedViewpoint =
    selectedClusterIds.length > 0
      ? null
      : scope.resolvedViewpointId === null
        ? null
        : bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === scope.resolvedViewpointId) ?? null;

  const handleStorylineToggle = useCallback(
    (storylineId: string) => {
      setSelectedClusterIds([]);
      setSelectedStorylineIds((current) => {
        if (current.includes(storylineId)) {
          return current.length === 1 ? current : current.filter((id) => id !== storylineId);
        }

        const nextIds = new Set([...current, storylineId]);
        return availableStorylines
          .map((storyline) => storyline.storyline_id)
          .filter((id) => nextIds.has(id));
      });
    },
    [availableStorylines]
  );

  const handleClusterToggle = useCallback(
    (cluster: EvidenceClusterVisual) => {
      let nextClusterIds: string[] = [];

      setSelectedClusterIds((current) => {
        nextClusterIds = current.includes(cluster.id)
          ? current.filter((clusterId) => clusterId !== cluster.id)
          : allClusters
              .map((item) => item.id)
              .filter((clusterId) => clusterId === cluster.id || current.includes(clusterId));
        return nextClusterIds;
      });

      const impact =
        nextClusterIds.length === 0
          ? `已清除证据簇筛选`
          : nextClusterIds.length === 1
            ? `已聚焦证据簇 ${cluster.label} / 桶 ${cluster.bucketIndex}`
            : `已叠加 ${nextClusterIds.length} 个证据簇 / 桶 ${cluster.bucketIndex}`;

      onEvidenceFocus({
        storylineId: cluster.storylineId,
        viewpointId: nextClusterIds.length === 0 ? null : cluster.viewpointId,
        bucketIndex: cluster.bucketIndex,
        impact
      });
    },
    [allClusters, onEvidenceFocus]
  );

  const handleParticleClick = useCallback(
    (particle: EvidenceParticleVisual) => {
      onEvidenceFocus({
        storylineId: particle.storylineId,
        viewpointId: particle.viewpointId,
        bucketIndex: particle.bucketIndex,
        impact: `已定位 ${particle.storylineTitle} / ${particle.viewpointTitle} / 桶 ${particle.bucketIndex}`
      });
    },
    [onEvidenceFocus]
  );

  if (selectedStorylineIds.length === 0 || (bucketSummaries.length === 0 && allClusters.length === 0 && particles.length === 0)) {
    return <div className="empty-state">{`证据视图当前没有可渲染的切片。`}</div>;
  }

  return (
    <section className="workspace-view evidence-panel evidence-panel--signal">
      <div className="workspace-view__header evidence-stage__header">
        <div className="workspace-view__intro">
          <p className="workspace-view__kicker">{`EVIDENCE FIELD`}</p>
          <h2>{`\u65f6\u95f4-\u8bc1\u636e\u7c92\u5b50\u573a`}</h2>
          <p className="workspace-view__description">
            {selectedClusterIds.length > 0
              ? `当前已叠加 ${selectedClusterIds.length} 个观点簇。`
              : resolvedViewpoint
                ? `${resolvedViewpoint.title}作为当前观点锚点。`
                : selectedStorylineIds.length > 1
                  ? `当前切片按 ${selectedStorylineIds.length} 条主线聚合显示。`
                  : `当前切片按主线证据聚合显示。`}
          </p>
        </div>
        <div className="workspace-view__controls">
          {storylines && onStorylineSelect ? (
            <StorylineSwitchHeader
              storylines={availableStorylines}
              activeStorylineId={anchorStorylineId}
              activeStorylineIds={selectedStorylineIds}
              onStorylineSelect={handleStorylineToggle}
              eyebrow={null}
              className="storyline-switcher--inline"
              selectionMode="multiple"
            />
          ) : null}
          <div className="evidence-stage__summary">
            {resolvedBucketIndex !== null ? (
              <span className="workspace-model">{`\u6876 ${resolvedBucketIndex}`}</span>
            ) : null}
            <span className="tone-pill tone-pill--focus">{`${selectedStorylineIds.length} 主线 / ${visibleClusters.length} 簇 / ${particles.length} 粒子`}</span>
          </div>
        </div>
      </div>

      {fallbackMessage ? <p className="detail-panel__note">{fallbackMessage}</p> : null}

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
              <span className="evidence-bucket__date">
                {formatBucketStart(bucket.bucketStart, bundle.meta.bucket_granularity)}
              </span>
              <span className="evidence-bucket__meta">
                {`${bucket.clusterCount} 簇 / ${bucket.particleCount} 粒子${
                  bucket.storylineCount > 1 ? ` / ${bucket.storylineCount} 主线` : ""
                }`}
              </span>
            </button>
          ))}
        </div>

        <div className="evidence-stage__field">
          <ParticleFieldCanvas
            clusters={visibleClusters}
            particles={particles}
            onParticleClick={handleParticleClick}
          />
        </div>

        <div className="evidence-stage__cluster-strip">
          {allClusters.map((cluster) => {
            const isSelected =
              selectedClusterIds.length > 0
                ? selectedClusterIds.includes(cluster.id)
                : cluster.isAnchorViewpoint;
            const clusterStyle = {
              "--cluster-accent": cluster.accentColor,
              "--cluster-fill": cluster.fillColor,
              borderColor: isSelected ? `${cluster.accentColor}55` : undefined,
              background: isSelected
                ? `linear-gradient(180deg, ${cluster.fillColor}24, rgba(10, 18, 28, 0.92))`
                : undefined
            } as CSSProperties;

            return (
              <button
                key={cluster.id}
                type="button"
                className={`evidence-stage__cluster-chip ${isSelected ? "evidence-stage__cluster-chip--active" : ""}`}
                style={clusterStyle}
                onClick={() => handleClusterToggle(cluster)}
              >
                <div className="evidence-stage__cluster-chip-head">
                  <span className="evidence-stage__cluster-chip-dot" style={{ background: cluster.accentColor }} />
                  <strong>{cluster.label}</strong>
                </div>
                <div className="evidence-stage__cluster-chip-meta">
                  <span className="evidence-stage__cluster-chip-storyline">{cluster.storylineTitle}</span>
                  <span>{cluster.viewpointTitle}</span>
                  <span>{`${cluster.commentCount} 条评论`}</span>
                  <span>{`Signal ${cluster.avgSignal.toFixed(2)}`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
