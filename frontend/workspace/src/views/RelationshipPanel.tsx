import { formatBucketStart } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import type { ScopedRelationshipState } from "../state/focusSelectors";

interface RelationshipPanelProps {
  bundle: PublishedBundle;
  scope: ScopedRelationshipState;
  onNodeSelect: (input: { viewpointId: string; bucketIndex: number }) => void;
}

function getRelationLabel(relationType: string | null): string {
  switch (relationType) {
    case "reinforces":
      return "\u589e\u5f3a";
    case "constrains":
      return "\u538b\u5236";
    case "depends_on":
      return "\u4f9d\u8d56";
    case "competes_with":
      return "\u7ade\u4e89";
    case "qualifies":
      return "\u9650\u5b9a";
    default:
      return "\u4e3b\u7ebf";
  }
}

function getRelationTone(relationType: string | null): string {
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

  return (
    <section className="panel relationship-panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{`\u5173\u7cfb\u89c6\u56fe`}</p>
          <h2>{`\u65f6\u95f4-\u89c2\u70b9\u6f14\u5316\u56fe`}</h2>
        </div>
        {scope.resolvedBucketIndex !== null ? (
          <span className="pill">{`\u6876 ${scope.resolvedBucketIndex}`}</span>
        ) : null}
      </div>
      <p className="lead">
        {displayViewpoint
          ? `${displayViewpoint.title} ${`\u662f\u5f53\u524d\u4e3b\u89d2\u8272\u3002\u6a21\u578b\u5207\u6362\u53ea\u66f4\u65b0\u8bf4\u660e\uff0c\u4e0d\u91cd\u6392\u5173\u7cfb\u7ed3\u6784\u3002`}`
          : `\u5f53\u524d\u89c2\u70b9\u4e0d\u53ef\u7528\u3002`}
      </p>
      {scope.fallbackMessage ? <p className="detail-panel__note">{scope.fallbackMessage}</p> : null}
      <div className="panel__meta">
        <span className="pill">{storyline.title}</span>
        {displayViewpoint ? <span className="pill">{`\u5f53\u524d\u89c2\u70b9 ${displayViewpoint.title}`}</span> : null}
        {scope.resolvedBucketStart ? (
          <span className="pill">
            {formatBucketStart(scope.resolvedBucketStart, bundle.meta.bucket_granularity)}
          </span>
        ) : null}
      </div>

      <div className="relationship-stage">
        <div
          className="relationship-stage__timeline"
          style={{
            gridTemplateColumns: `220px repeat(${scope.timelineBuckets.length}, minmax(92px, 1fr))`
          }}
        >
          <div className="relationship-stage__stub">
            <span>{`\u89c2\u70b9\u6cf3\u9053`}</span>
          </div>
          {scope.timelineBuckets.map((bucket) => (
            <div
              key={bucket.bucketIndex}
              className={`relationship-stage__bucket ${bucket.isActiveBucket ? "relationship-stage__bucket--active" : ""}`}
            >
              <strong>{formatBucketStart(bucket.bucketStart, bundle.meta.bucket_granularity)}</strong>
              <span>{`\u70ed\u5ea6 ${bucket.storylineHeatIndex}`}</span>
            </div>
          ))}
        </div>

        <div className="relationship-stage__lanes">
          {scope.lanes.map((lane) => (
            <div
              key={lane.viewpointId}
              className={`relationship-lane ${lane.isCurrent ? "relationship-lane--current" : "relationship-lane--peer"}`}
            >
              <div className="relationship-lane__label">
                <strong>{lane.title}</strong>
                <span>
                  {lane.isCurrent
                    ? `\u5f53\u524d\u89c2\u70b9`
                    : `${`\u540c\u4e3b\u7ebf`} / ${getRelationLabel(lane.relationTypeHint)}`}
                </span>
              </div>
              <div
                className="relationship-lane__track"
                style={{
                  gridTemplateColumns: `repeat(${scope.timelineBuckets.length}, minmax(92px, 1fr))`
                }}
              >
                {lane.points.map((point, index) => {
                  const nextPoint = lane.points[index + 1] ?? null;
                  const connectorClass = getRelationTone(lane.isCurrent ? null : lane.relationTypeHint);
                  return (
                    <div key={`${lane.viewpointId}-${point.bucketIndex}`} className="relationship-cell">
                      {nextPoint ? (
                        <span
                          className={`relationship-cell__connector ${connectorClass} ${
                            point.hasSnapshot && nextPoint.hasSnapshot
                              ? "relationship-cell__connector--solid"
                              : "relationship-cell__connector--faded"
                          }`}
                        />
                      ) : null}
                      {point.hasSnapshot ? (
                        <button
                          type="button"
                          className={`relationship-node ${connectorClass} ${
                            point.isActiveBucket ? "relationship-node--active" : ""
                          } ${point.isCurrentViewpoint ? "relationship-node--current" : "relationship-node--peer"}`}
                          onClick={() => onNodeSelect({ viewpointId: lane.viewpointId, bucketIndex: point.bucketIndex })}
                        >
                          <span className="relationship-node__value">{point.heatIndex ?? "-"}</span>
                          <span className="relationship-node__meta">{`${point.supportCount ?? 0} ${`\u652f\u6301`}`}</span>
                        </button>
                      ) : (
                        <div className="relationship-node relationship-node--ghost">
                          <span className="relationship-node__meta">{`\u7f3a\u5e2d`}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {scope.externalAnchors.length ? (
          <div className="relationship-stage__anchors">
            {scope.externalAnchors.map((anchor) => (
              <div key={anchor.id} className={`relationship-anchor ${getRelationTone(anchor.relationType)}`}>
                <span className="relationship-anchor__kind">
                  {anchor.kind === "storyline" ? `\u5916\u90e8\u4e3b\u7ebf` : `\u5916\u90e8\u89c2\u70b9`}
                </span>
                <strong>{anchor.label}</strong>
                <span className="muted">
                  {`${anchor.direction === "incoming" ? `\u5f71\u54cd\u6d41\u5165` : `\u5f71\u54cd\u6d41\u51fa`} / ${getRelationLabel(anchor.relationType)}`}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relationship-panel__legend">
        <span className="relationship-legend__item relationship-tone--current">{`\u4e3b\u7ebf\u5b9e\u7ebf`}</span>
        <span className="relationship-legend__item relationship-tone--reinforces">{`\u589e\u5f3a`}</span>
        <span className="relationship-legend__item relationship-tone--constrains">{`\u538b\u5236`}</span>
        <span className="relationship-legend__item relationship-tone--depends">{`\u4f9d\u8d56`}</span>
        <span className="relationship-legend__item relationship-tone--competes">{`\u7ade\u4e89`}</span>
        <span className="relationship-legend__item relationship-tone--qualifies">{`\u9650\u5b9a`}</span>
      </div>
    </section>
  );
}
