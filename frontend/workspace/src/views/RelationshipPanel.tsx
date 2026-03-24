import { formatBucketStart } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import { getRelationTypeTone } from "../presentation/workspaceChrome";
import type { ScopedRelationshipState } from "../state/focusSelectors";

interface RelationshipPanelProps {
  bundle: PublishedBundle;
  scope: ScopedRelationshipState;
  onNodeSelect: (input: { viewpointId: string; bucketIndex: number }) => void;
}

function getRelationLabel(relationType: string | null): string {
  return getRelationTypeTone(relationType).label;
}

function getRelationToneClass(relationType: string | null): string {
  switch (relationType) {
    case "reinforces":
      return "relationship-tone--reinforces";
    case "constrains":
      return "relationship-tone--constrains";
    case "depends_on":
      return "relationship-tone--depends";
    case "competes_with":
      return "relationship-tone--competes";
    case "qualifies":
      return "relationship-tone--qualifies";
    default:
      return "relationship-tone--current";
  }
}

export function RelationshipPanel({ bundle, scope, onNodeSelect }: RelationshipPanelProps) {
  const storyline =
    scope.storylineId === null
      ? null
      : bundle.stream.storylines.find((item) => item.storyline_id === scope.storylineId) ?? null;
  const displayViewpoint =
    scope.displayViewpointId === null
      ? null
      : bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === scope.displayViewpointId) ?? null;

  if (!storyline || !scope.lanes.length || !scope.timelineBuckets.length) {
    return <div className="empty-state">{`\u5173\u7cfb\u89c6\u56fe\u5f53\u524d\u6ca1\u6709\u53ef\u6e32\u67d3\u7684\u65f6\u95f4-\u89c2\u70b9\u6f14\u5316\u56fe\u3002`}</div>;
  }

  const columns = `260px repeat(${scope.timelineBuckets.length}, minmax(104px, 1fr))`;

  return (
    <section className="panel relationship-panel relationship-panel--signal">
      <div className="relationship-panel__header">
        <div>
          <p className="eyebrow">{`\u5173\u7cfb\u89c6\u56fe`}</p>
          <h2>{`\u65f6\u95f4-\u89c2\u70b9\u6f14\u5316\u56fe`}</h2>
          <p className="muted">
            {displayViewpoint
              ? `${displayViewpoint.title} ${`\u662f\u5f53\u524d\u4e3b\u821e\u53f0\u89c2\u70b9\u3002\u5c40\u90e8\u5207\u6876\u6216\u5207\u70b9\u4e0d\u4f1a\u7834\u574f\u5168\u5c40\u5171\u4eab\u7126\u70b9\u3002`}`
              : `\u5f53\u524d\u89c2\u70b9\u4e0d\u53ef\u7528\u3002`}
          </p>
        </div>
        <div className="relationship-panel__summary">
          {scope.resolvedBucketIndex !== null ? (
            <span className="workspace-model">{`\u6876 ${scope.resolvedBucketIndex}`}</span>
          ) : null}
          <span className="tone-pill tone-pill--focus">{`${scope.lanes.length} ${`\u6761\u6cf3\u9053`}`}</span>
          <span className="tone-pill tone-pill--muted">{`${scope.externalAnchors.length} ${`\u4e2a\u5916\u90e8\u951a\u70b9`}`}</span>
        </div>
      </div>

      {scope.fallbackMessage ? <p className="detail-panel__note">{scope.fallbackMessage}</p> : null}

      <div className="panel__meta">
        <span className="pill">{storyline.title}</span>
        {displayViewpoint ? <span className="pill">{`${`\u5f53\u524d\u89c2\u70b9`} ${displayViewpoint.title}`}</span> : null}
        {scope.resolvedBucketStart ? (
          <span className="pill">
            {formatBucketStart(scope.resolvedBucketStart, bundle.meta.bucket_granularity)}
          </span>
        ) : null}
      </div>

      <div className="relationship-stage">
        <div className="relationship-stage__timeline" style={{ gridTemplateColumns: columns }}>
          <div className="relationship-stage__stub">
            <span>{`\u89c2\u70b9\u6cf3\u9053`}</span>
            <strong>{`\u65f6\u95f4 / \u89c2\u70b9 \u5173\u7cfb\u821e\u53f0`}</strong>
          </div>
          {scope.timelineBuckets.map((bucket) => (
            <div
              key={bucket.bucketIndex}
              className={`relationship-stage__bucket ${bucket.isActiveBucket ? "relationship-stage__bucket--active" : ""}`}
            >
              <strong>{formatBucketStart(bucket.bucketStart, bundle.meta.bucket_granularity)}</strong>
              <span>{`Heat ${bucket.storylineHeatIndex}`}</span>
              <span className="relationship-stage__bucket-meta">
                {bucket.hasDisplayViewpoint
                  ? `\u5f53\u524d\u89c2\u70b9\u5728\u573a`
                  : bucket.hasRequestedViewpoint
                    ? `\u8bf7\u6c42\u89c2\u70b9\u5728\u573a`
                    : `\u89c2\u70b9\u7f3a\u5e2d`}
              </span>
            </div>
          ))}
        </div>

        <div className="relationship-stage__lanes">
          {scope.lanes.map((lane) => {
            const toneClass = getRelationToneClass(lane.isCurrent ? null : lane.relationTypeHint);
            return (
              <div
                key={lane.viewpointId}
                className={`relationship-lane ${lane.isCurrent ? "relationship-lane--current" : "relationship-lane--peer"}`}
              >
                <div className="relationship-lane__label">
                  <div className="relationship-lane__label-top">
                    <strong>{lane.title}</strong>
                    <span className={`tone-pill ${lane.isCurrent ? "tone-pill--focus" : "tone-pill--muted"}`}>
                      {lane.isCurrent ? `\u5f53\u524d\u4e3b\u89d2` : getRelationLabel(lane.relationTypeHint)}
                    </span>
                  </div>
                  <span>{lane.isCurrent ? `\u5f53\u524d\u89c2\u70b9\u8f68\u8ff9` : `${lane.topicTag} / ${`\u540c\u4e3b\u7ebf\u5173\u8054`}`}</span>
                  <div className="relationship-lane__label-meta">
                    <span>{`Score ${lane.score}`}</span>
                    <span>{lane.isPeer ? `\u5bf9\u5f53\u524d\u89c2\u70b9\u53ef\u89c1` : `\u5168\u5c40\u9ad8\u5149`}</span>
                  </div>
                </div>
                <div className="relationship-lane__track" style={{ gridTemplateColumns: `repeat(${scope.timelineBuckets.length}, minmax(104px, 1fr))` }}>
                  {lane.points.map((point, index) => {
                    const nextPoint = lane.points[index + 1] ?? null;
                    return (
                      <div key={`${lane.viewpointId}-${point.bucketIndex}`} className="relationship-cell">
                        {nextPoint ? (
                          <span
                            className={`relationship-cell__connector ${toneClass} ${
                              point.hasSnapshot && nextPoint.hasSnapshot
                                ? "relationship-cell__connector--solid"
                                : "relationship-cell__connector--faded"
                            }`}
                          />
                        ) : null}
                        {point.hasSnapshot ? (
                          <button
                            type="button"
                            className={`relationship-node ${toneClass} ${
                              point.isActiveBucket ? "relationship-node--active" : ""
                            } ${point.isCurrentViewpoint ? "relationship-node--current" : "relationship-node--peer"}`}
                            onClick={() => onNodeSelect({ viewpointId: lane.viewpointId, bucketIndex: point.bucketIndex })}
                          >
                            <span className="relationship-node__eyebrow">{`T${point.bucketIndex}`}</span>
                            <span className="relationship-node__value">{point.heatIndex ?? "-"}</span>
                            <span className="relationship-node__meta">{`${point.supportCount ?? 0} ${`\u652f\u6301`}`}</span>
                          </button>
                        ) : (
                          <div className="relationship-node relationship-node--ghost">
                            <span className="relationship-node__eyebrow">{`T${point.bucketIndex}`}</span>
                            <span className="relationship-node__meta">{`\u7f3a\u5e2d`}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {scope.externalAnchors.length ? (
          <div className="relationship-stage__anchors">
            {scope.externalAnchors.map((anchor) => {
              const toneClass = getRelationToneClass(anchor.relationType);
              const tone = getRelationTypeTone(anchor.relationType);
              return (
                <div key={anchor.id} className={`relationship-anchor ${toneClass}`}>
                  <span className="relationship-anchor__kind">
                    {anchor.kind === "storyline" ? `\u5916\u90e8\u4e3b\u7ebf` : `\u5916\u90e8\u89c2\u70b9`}
                  </span>
                  <strong>{anchor.label}</strong>
                  <span className={`tone-pill tone-pill--${tone.tone}`}>{tone.label}</span>
                  <span className="muted">
                    {`${anchor.direction === "incoming" ? `\u5f71\u54cd\u6d41\u5165` : `\u5f71\u54cd\u6d41\u51fa`} / Weight ${anchor.weight.toFixed(2)}`}
                  </span>
                  <p className="relationship-anchor__summary">{anchor.summary}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="relationship-panel__legend">
        <span className="relationship-legend__item relationship-tone--current">{`\u4e3b\u89d2\u8f68\u8ff9`}</span>
        <span className="relationship-legend__item relationship-tone--reinforces">{`\u589e\u5f3a`}</span>
        <span className="relationship-legend__item relationship-tone--constrains">{`\u538b\u5236`}</span>
        <span className="relationship-legend__item relationship-tone--depends">{`\u4f9d\u8d56`}</span>
        <span className="relationship-legend__item relationship-tone--competes">{`\u7ade\u4e89`}</span>
        <span className="relationship-legend__item relationship-tone--qualifies">{`\u9650\u5b9a`}</span>
      </div>
    </section>
  );
}
