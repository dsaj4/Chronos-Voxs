import { formatBucketStart, getPublishedReasoningForSeries, getPublishedTraceability } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import type { ScopedEvidenceState, ScopedRelationshipState } from "../state/focusSelectors";
import type { WorkspaceFocusState } from "../state/focusState";

interface DetailPanelProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  relationshipScope: ScopedRelationshipState;
  evidenceScope: ScopedEvidenceState;
  impactSummary: string;
}

function formatRelationLabel(relationType: string): string {
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
      return relationType;
  }
}

export function DetailPanel({
  bundle,
  focus,
  relationshipScope,
  evidenceScope,
  impactSummary
}: DetailPanelProps) {
  const activeStorylineId = focus.activeStorylineIds[0] ?? null;
  const effectiveBucketIndex =
    focus.activePrimaryView === "relationships"
      ? relationshipScope.resolvedBucketIndex ?? focus.activeBucketIndex
      : focus.activePrimaryView === "evidence"
        ? evidenceScope.resolvedBucketIndex ?? focus.activeBucketIndex
        : focus.activeBucketIndex;
  const effectiveViewpointId =
    focus.activePrimaryView === "relationships"
      ? relationshipScope.displayViewpointId ?? focus.activeViewpointId
      : focus.activePrimaryView === "evidence"
        ? evidenceScope.resolvedViewpointId ?? focus.activeViewpointId
        : focus.activeViewpointId;

  const storyline =
    bundle.stream.storylines.find((item) => item.storyline_id === activeStorylineId) ??
    bundle.stream.storylines[0] ??
    null;
  const viewpoint =
    effectiveViewpointId === null
      ? null
      : bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === effectiveViewpointId) ?? null;
  const bucketSnapshot =
    storyline && effectiveBucketIndex !== null
      ? bundle.stream.storyline_snapshots.find(
          (snapshot) =>
            snapshot.storyline_id === storyline.storyline_id && snapshot.bucket_index === effectiveBucketIndex
        ) ?? null
      : null;
  const model = bundle.meta.available_models.find((item) => item.id === focus.selectedModelId) ?? null;
  const reasoning =
    storyline ? getPublishedReasoningForSeries(bundle, storyline.storyline_id, focus.selectedModelId) : null;
  const traceability = storyline ? getPublishedTraceability(bundle, storyline.storyline_id) : null;
  const fallbackNote =
    focus.activePrimaryView === "relationships"
      ? relationshipScope.fallbackMessage
      : focus.activePrimaryView === "evidence"
        ? evidenceScope.fallbackMessage
        : null;

  return (
    <section className="panel detail-panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{`\u7edf\u4e00\u8be6\u60c5`}</p>
          <h3>{`\u5f53\u524d\u7126\u70b9`}</h3>
        </div>
        {model ? <span className="pill">{model.label}</span> : null}
      </div>
      <p className="muted">{impactSummary}</p>
      {fallbackNote ? <p className="detail-panel__note">{fallbackNote}</p> : null}

      <div className="detail-panel__grid">
        {viewpoint ? (
          <div className="mini-card">
            <p className="eyebrow">{`\u5f53\u524d\u89c2\u70b9`}</p>
            <strong>{viewpoint.title}</strong>
            <p>{viewpoint.summary}</p>
            <p className="muted">{viewpoint.claim_statement}</p>
          </div>
        ) : null}

        {storyline ? (
          <div className="mini-card">
            <p className="eyebrow">{`\u5f53\u524d\u4e3b\u7ebf`}</p>
            <strong>{storyline.title}</strong>
            <p>{storyline.summary}</p>
            <p className="muted">
              {`${storyline.support_count} ${`\u652f\u6301`} / ${storyline.viewpoint_count} ${`\u89c2\u70b9`} / ${storyline.comment_count} ${`\u8bc4\u8bba`}`}
            </p>
          </div>
        ) : null}

        {bucketSnapshot ? (
          <div className="mini-card">
            <p className="eyebrow">{`\u5f53\u524d\u65f6\u95f4\u6876`}</p>
            <strong>
              {`${formatBucketStart(bucketSnapshot.bucket_start, bucketSnapshot.bucket_granularity)} / ${`\u6876`} ${bucketSnapshot.bucket_index}`}
            </strong>
            <p className="muted">
              {`${bucketSnapshot.support_count} ${`\u652f\u6301`} / ${bucketSnapshot.comment_count} ${`\u8bc4\u8bba`}`}
            </p>
          </div>
        ) : null}

        {(reasoning || model) ? (
          <div className="mini-card">
            <p className="eyebrow">{`\u6a21\u578b\u53cd\u9988`}</p>
            <strong>{model?.label ?? `\u672a\u9009\u6a21\u578b`}</strong>
            <p>{reasoning?.explanation ?? `\u5f53\u524d\u4e3b\u7ebf\u6682\u65e0\u8be5\u6a21\u578b\u89e3\u91ca\u3002`}</p>
            {reasoning ? <p className="muted">{reasoning.comparison_summary}</p> : null}
          </div>
        ) : null}

        {focus.activePrimaryView === "relationships" ? (
          <div className="mini-card">
            <p className="eyebrow">{`\u5173\u7cfb\u7126\u70b9`}</p>
            <p className="muted">
              {`${relationshipScope.lanes.length} ${`\u6761\u6cf3\u9053`} / ${relationshipScope.externalAnchors.length} ${`\u4e2a\u5916\u90e8\u951a\u70b9`}`}
            </p>
            <p>
              {relationshipScope.requestedViewpointId &&
              relationshipScope.displayViewpointId &&
              relationshipScope.requestedViewpointId !== relationshipScope.displayViewpointId
                ? `\u5f53\u524d\u6876\u5185\u5df2\u5c40\u90e8\u5207\u5230\u4e3b\u5bfc\u89c2\u70b9\uff0c\u5c1a\u672a\u5199\u56de\u5168\u5c40\u3002`
                : `\u5f53\u524d\u89c2\u70b9\u4ecd\u5360\u636e\u5173\u7cfb\u4e3b\u821e\u53f0\u3002`}
            </p>
          </div>
        ) : null}

        {focus.activePrimaryView === "relationships" && relationshipScope.externalAnchors.length ? (
          <div className="mini-card">
            <p className="eyebrow">{`\u5916\u90e8\u5f71\u54cd`}</p>
            <ul className="compact-list compact-list--tight">
              {relationshipScope.externalAnchors.slice(0, 3).map((anchor) => (
                <li key={anchor.id}>
                  <strong>{anchor.label}</strong>
                  <div className="muted">
                    {`${anchor.direction === "incoming" ? `\u6d41\u5165` : `\u6d41\u51fa`} / ${formatRelationLabel(anchor.relationType)}`}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {traceability ? (
          <div className="mini-card">
            <p className="eyebrow">{`\u8ffd\u6eaf`}</p>
            <p className="muted">
              {`${traceability.viewpoint_ids.length} ${`\u89c2\u70b9`} / ${traceability.claim_ids.length} Claims / ${traceability.comment_ids.length} ${`\u8bc4\u8bba`}`}
            </p>
            <p>{traceability.viewpoint_ids.join(" / ")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
