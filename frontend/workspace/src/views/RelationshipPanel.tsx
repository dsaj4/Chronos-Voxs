import { useCallback, useEffect, useMemo, useRef } from "react";
import { StorylineSwitchHeader } from "../components/StorylineSwitchHeader";
import { formatBucketStart } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import type { ScopedRelationshipState } from "../state/focusSelectors";

type RelationType = PublishedBundle["neural_map"]["viewpoint_relations"][number]["relation_type"];
type PublishedRelation = PublishedBundle["neural_map"]["viewpoint_relations"][number];

interface RelationshipPanelProps {
  bundle: PublishedBundle;
  scope: ScopedRelationshipState;
  onNodeSelect: (input: { viewpointId: string; bucketIndex: number }) => void;
  storylines?: PublishedBundle["stream"]["storylines"];
  activeStorylineId?: string | null;
  onStorylineSelect?: (storylineId: string) => void;
}

interface RelationStyle {
  color: string;
  dashArray?: string;
  label: string;
}

const RELATION_STYLE: Record<RelationType, RelationStyle> = {
  reinforces: { color: "#6FCF97", label: "\u589e\u5f3a" },
  competes_with: { color: "#EB5757", dashArray: "8 5", label: "\u7ade\u4e89" },
  constrains: { color: "#F2C94C", dashArray: "10 6", label: "\u538b\u5236" },
  depends_on: { color: "#56CCF2", dashArray: "4 4", label: "\u4f9d\u8d56" },
  qualifies: { color: "#CE93D8", dashArray: "14 6", label: "\u9650\u5b9a" }
};

const TIME_AXIS_HEIGHT = 38;
const LANE_HEIGHT = 68;
const LANE_GAP = 18;
const BUCKET_WIDTH = 92;
const NODE_RADIUS = 7;

function getRelationStyle(relationType: RelationType | null, isCurrent = false): RelationStyle {
  if (isCurrent || relationType === null) {
    return { color: "#56CCF2", label: "\u4e3b\u89d2\u8f68\u8ff9" };
  }
  return RELATION_STYLE[relationType];
}

function resolveRelationBucketIndex(
  relation: PublishedRelation,
  scope: ScopedRelationshipState
): number | null {
  const activeBucketIndex = scope.resolvedBucketIndex;
  const sourceLane = scope.lanes.find((lane) => lane.viewpointId === relation.source_viewpoint_id);
  const targetLane = scope.lanes.find((lane) => lane.viewpointId === relation.target_viewpoint_id);

  if (!sourceLane || !targetLane) {
    return null;
  }

  const sharedBucketIndexes = sourceLane.points
    .filter(
      (point) =>
        point.hasSnapshot &&
        targetLane.points.some(
          (candidate) => candidate.bucketIndex === point.bucketIndex && candidate.hasSnapshot
        )
    )
    .map((point) => point.bucketIndex);

  if (!sharedBucketIndexes.length) {
    return null;
  }

  if (activeBucketIndex !== null && sharedBucketIndexes.includes(activeBucketIndex)) {
    return activeBucketIndex;
  }

  return sharedBucketIndexes.at(-1) ?? null;
}

export function RelationshipPanel({
  bundle,
  scope,
  onNodeSelect,
  storylines,
  activeStorylineId,
  onStorylineSelect
}: RelationshipPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const storyline =
    scope.storylineId === null
      ? null
      : bundle.stream.storylines.find((item) => item.storyline_id === scope.storylineId) ?? null;
  const displayViewpoint =
    scope.displayViewpointId === null
      ? null
      : bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === scope.displayViewpointId) ?? null;

  const laneIndexById = useMemo(
    () => new Map(scope.lanes.map((lane, index) => [lane.viewpointId, index])),
    [scope.lanes]
  );
  const bucketOffsetByIndex = useMemo(
    () => new Map(scope.timelineBuckets.map((bucket, index) => [bucket.bucketIndex, index])),
    [scope.timelineBuckets]
  );

  const svgWidth = Math.max(scope.timelineBuckets.length * BUCKET_WIDTH + 120, 640);
  const svgHeight =
    TIME_AXIS_HEIGHT + scope.lanes.length * LANE_HEIGHT + Math.max(scope.lanes.length - 1, 0) * LANE_GAP + 28;

  const getX = useCallback(
    (bucketIndex: number) => 56 + (bucketOffsetByIndex.get(bucketIndex) ?? 0) * BUCKET_WIDTH,
    [bucketOffsetByIndex]
  );
  const getY = useCallback(
    (laneIndex: number) => TIME_AXIS_HEIGHT + laneIndex * (LANE_HEIGHT + LANE_GAP) + LANE_HEIGHT / 2,
    []
  );

  useEffect(() => {
    if (!viewportRef.current || scope.resolvedBucketIndex === null) {
      return;
    }

    const targetX = getX(scope.resolvedBucketIndex) - viewportRef.current.clientWidth / 2;
    viewportRef.current.scrollLeft = Math.max(0, targetX);
  }, [getX, scope.resolvedBucketIndex]);

  if (!storyline || !scope.lanes.length || !scope.timelineBuckets.length) {
    return <div className="empty-state">{`\u5173\u7cfb\u89c6\u56fe\u5f53\u524d\u6ca1\u6709\u53ef\u6e32\u67d3\u7684\u65f6\u95f4-\u89c2\u70b9\u6f14\u5316\u56fe\u3002`}</div>;
  }

  return (
    <section className="workspace-view relationship-panel relationship-panel--signal">
      <div className="workspace-view__header relationship-panel__header">
        <div className="workspace-view__intro">
          <p className="workspace-view__kicker">{`NEURAL MAP / SIGNAL`}</p>
          <h2>{`\u65f6\u95f4-\u89c2\u70b9\u6f14\u5316\u56fe`}</h2>
          <p className="workspace-view__description">
            {displayViewpoint
              ? `${displayViewpoint.title}${`\u4f5c\u4e3a\u5f53\u524d\u4e3b\u89c2\u70b9\u3002`}`
              : `\u5f53\u524d\u89c2\u70b9\u4e0d\u53ef\u7528\u3002`}
          </p>
        </div>
        <div className="workspace-view__controls">
          {storylines && onStorylineSelect ? (
            <StorylineSwitchHeader
              storylines={storylines}
              activeStorylineId={activeStorylineId ?? null}
              onStorylineSelect={onStorylineSelect}
              eyebrow={null}
              className="storyline-switcher--inline"
            />
          ) : null}
          <div className="relationship-panel__summary">
            {scope.resolvedBucketIndex !== null ? (
              <span className="workspace-model">{`\u6876 ${scope.resolvedBucketIndex}`}</span>
            ) : null}
            <span className="tone-pill tone-pill--focus">{`${scope.lanes.length} ${`\u6761\u6cf3\u9053`}`}</span>
          </div>
        </div>
      </div>

      {scope.fallbackMessage ? <p className="detail-panel__note">{scope.fallbackMessage}</p> : null}

      <div className="relationship-stage">
        <div className="relationship-stage__legend">
          {Object.entries(RELATION_STYLE).map(([relationType, style]) => (
            <div key={relationType} className="relationship-stage__legend-item">
              <svg width="20" height="10" aria-hidden="true">
                <line
                  x1="1"
                  y1="5"
                  x2="19"
                  y2="5"
                  stroke={style.color}
                  strokeWidth="1.8"
                  strokeDasharray={style.dashArray}
                  strokeLinecap="round"
                />
              </svg>
              <span>{style.label}</span>
            </div>
          ))}
        </div>

        <div className="relationship-stage__frame">
          <div className="relationship-stage__lane-pins" aria-hidden="true">
            {scope.lanes.map((lane, index) => {
              const tone = getRelationStyle(lane.relationTypeHint, lane.isCurrent);
              return (
                <div
                  key={`pin-${lane.viewpointId}`}
                  className="relationship-stage__lane-pin"
                  style={{ top: `${getY(index) - 11}px` }}
                >
                  <span
                    className={`relationship-stage__lane-dot ${
                      lane.isCurrent ? "relationship-stage__lane-dot--current" : ""
                    }`}
                    style={{ background: tone.color }}
                  />
                </div>
              );
            })}
          </div>

          <div ref={viewportRef} className="relationship-stage__viewport">
            <svg
              className="relationship-stage__svg"
              width={svgWidth}
              height={svgHeight}
              role="img"
              aria-label={"\u65f6\u95f4-\u89c2\u70b9\u6f14\u5316\u821e\u53f0"}
            >
              {scope.timelineBuckets.map((bucket) => {
                const x = getX(bucket.bucketIndex);
                return (
                  <g key={`bucket-${bucket.bucketIndex}`}>
                    <line
                      x1={x}
                      y1={TIME_AXIS_HEIGHT - 4}
                      x2={x}
                      y2={svgHeight - 8}
                      stroke={
                        bucket.isActiveBucket ? "rgba(86, 204, 242, 0.18)" : "rgba(86, 204, 242, 0.06)"
                      }
                      strokeWidth={bucket.isActiveBucket ? 1.6 : 1}
                    />
                    <text
                      className="relationship-stage__axis-label"
                      x={x}
                      y={TIME_AXIS_HEIGHT - 14}
                      textAnchor="middle"
                    >
                      {formatBucketStart(bucket.bucketStart, bundle.meta.bucket_granularity)}
                    </text>
                  </g>
                );
              })}

              {scope.lanes.map((lane, index) => {
                const y = getY(index);
                return (
                  <g key={`band-${lane.viewpointId}`}>
                    <rect
                      x={0}
                      y={y - LANE_HEIGHT / 2}
                      width={svgWidth}
                      height={LANE_HEIGHT}
                      fill={lane.isCurrent ? "rgba(86, 204, 242, 0.035)" : "rgba(8, 14, 21, 0.28)"}
                      rx={18}
                    />
                    <line
                      x1={18}
                      y1={y}
                      x2={svgWidth - 18}
                      y2={y}
                      stroke={lane.isCurrent ? "rgba(86, 204, 242, 0.18)" : "rgba(160, 184, 214, 0.08)"}
                      strokeDasharray={lane.isCurrent ? undefined : "3 6"}
                    />
                  </g>
                );
              })}

              {scope.viewpointRelations.map((relation) => {
                const sourceLaneIndex = laneIndexById.get(relation.source_viewpoint_id);
                const targetLaneIndex = laneIndexById.get(relation.target_viewpoint_id);
                const relationBucketIndex = resolveRelationBucketIndex(relation, scope);

                if (
                  sourceLaneIndex === undefined ||
                  targetLaneIndex === undefined ||
                  relationBucketIndex === null
                ) {
                  return null;
                }

                const style = RELATION_STYLE[relation.relation_type];
                const x = getX(relationBucketIndex);
                const sourceY = getY(sourceLaneIndex);
                const targetY = getY(targetLaneIndex);
                const bendX = x + 24;

                return (
                  <path
                    key={relation.relation_id}
                    className="relationship-stage__relation"
                    d={`M ${x} ${sourceY} C ${bendX} ${sourceY}, ${bendX} ${targetY}, ${x} ${targetY}`}
                    stroke={style.color}
                    strokeWidth={1 + relation.weight * 1.4}
                    strokeDasharray={style.dashArray}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.72}
                  />
                );
              })}

              {scope.lanes.map((lane, laneIndex) => {
                const visiblePoints = lane.points.filter((point) => point.hasSnapshot);
                if (!visiblePoints.length) {
                  return null;
                }

                const tone = getRelationStyle(lane.relationTypeHint, lane.isCurrent);
                const trackPath = visiblePoints
                  .map((point, pointIndex) => {
                    const x = getX(point.bucketIndex);
                    const y = getY(laneIndex);
                    return `${pointIndex === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ");

                return (
                  <g key={`lane-${lane.viewpointId}`}>
                    <path
                      d={trackPath}
                      stroke={tone.color}
                      strokeWidth={lane.isCurrent ? 2.4 : 1.4}
                      strokeOpacity={lane.isCurrent ? 1 : 0.42}
                      fill="none"
                      strokeLinecap="round"
                    />

                    {visiblePoints.map((point) => {
                      const cx = getX(point.bucketIndex);
                      const cy = getY(laneIndex);
                      const radius = point.isActiveBucket ? NODE_RADIUS + 2 : NODE_RADIUS;
                      const diamond = `${cx},${cy - radius} ${cx + radius},${cy} ${cx},${cy + radius} ${cx - radius},${cy}`;

                      return (
                        <g
                          key={`${lane.viewpointId}-${point.bucketIndex}`}
                          className="relationship-node"
                          onClick={() =>
                            onNodeSelect({ viewpointId: lane.viewpointId, bucketIndex: point.bucketIndex })
                          }
                          style={{ cursor: "pointer" }}
                        >
                          {point.isActiveBucket ? (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={radius + 5}
                              fill="rgba(86, 204, 242, 0.12)"
                              stroke="rgba(86, 204, 242, 0.24)"
                              strokeWidth={1}
                            />
                          ) : null}
                          <polygon
                            points={diamond}
                            fill={tone.color}
                            fillOpacity={lane.isCurrent ? 0.96 : 0.76}
                            stroke={point.isActiveBucket ? "rgba(245, 250, 255, 0.88)" : "rgba(7, 15, 25, 0.92)"}
                            strokeWidth={point.isActiveBucket ? 1.3 : 0.8}
                          />
                          <title>{`${lane.title} / T${point.bucketIndex} / Heat ${point.heatIndex ?? "-"}`}</title>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="relationship-stage__lane-strip">
          {scope.lanes.map((lane) => {
            const tone = getRelationStyle(lane.relationTypeHint, lane.isCurrent);

            return (
              <div
                key={`strip-${lane.viewpointId}`}
                className={`relationship-stage__lane-tag ${
                  lane.isCurrent ? "relationship-stage__lane-tag--current" : ""
                }`}
              >
                <div className="relationship-stage__lane-tag-head">
                  <span className="relationship-stage__lane-tag-dot" style={{ background: tone.color }} />
                  <strong>{lane.title}</strong>
                </div>
                <div className="relationship-stage__lane-tag-meta">
                  <span>{lane.isCurrent ? `\u5f53\u524d\u4e3b\u89d2` : tone.label}</span>
                  <span>{`Score ${lane.score}`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
