import type { PublishedBundle } from "../loader/publishedTypes";
import { formatBucketStart, getPublishedReasoningForSeries, getPublishedTraceability } from "../forecast/seriesModels";
import type { WorkspaceFocusState } from "../state/focusState";
import type { ScopedEvidenceState, ScopedRelationshipState } from "../state/focusSelectors";

interface DetailPanelProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  relationshipScope: ScopedRelationshipState;
  evidenceScope: ScopedEvidenceState;
}

export function DetailPanel({ bundle, focus, relationshipScope, evidenceScope }: DetailPanelProps) {
  const activeStorylineId = focus.activeStorylineIds[0] ?? null;
  const effectiveBucketIndex =
    focus.activePrimaryView === "relationships"
      ? relationshipScope.resolvedBucketIndex ?? focus.activeBucketIndex
      : focus.activePrimaryView === "evidence"
        ? evidenceScope.resolvedBucketIndex ?? focus.activeBucketIndex
        : focus.activeBucketIndex;
  const effectiveViewpointId =
    focus.activePrimaryView === "relationships"
      ? relationshipScope.highlightedViewpointId ?? focus.activeViewpointId
      : focus.activePrimaryView === "evidence"
        ? evidenceScope.resolvedViewpointId ?? focus.activeViewpointId
        : focus.activeViewpointId;

  const storyline =
    bundle.stream.storylines.find((item) => item.storyline_id === activeStorylineId) ?? bundle.stream.storylines[0] ?? null;
  const viewpoint =
    bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === effectiveViewpointId) ?? null;
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
          <p className="eyebrow">统一详情</p>
          <h3>当前焦点说明</h3>
        </div>
        {model ? <span className="pill">{model.label}</span> : null}
      </div>
      <p className="muted">{focus.lastInteractionImpact}</p>
      {fallbackNote ? <p className="detail-panel__note">{fallbackNote}</p> : null}
      <div className="detail-panel__grid">
        {viewpoint ? (
          <div className="mini-card">
            <p className="eyebrow">当前观点</p>
            <strong>{viewpoint.title}</strong>
            <p>{viewpoint.summary}</p>
            <p className="muted">{viewpoint.claim_statement}</p>
          </div>
        ) : null}
        {storyline ? (
          <div className="mini-card">
            <p className="eyebrow">当前主线</p>
            <strong>{storyline.title}</strong>
            <p>{storyline.summary}</p>
            <p className="muted">
              {storyline.support_count} 条支持 · {storyline.viewpoint_count} 个观点 · {storyline.comment_count} 条评论
            </p>
          </div>
        ) : null}
        {bucketSnapshot ? (
          <div className="mini-card">
            <p className="eyebrow">当前时间桶</p>
            <strong>
              {formatBucketStart(bucketSnapshot.bucket_start, bucketSnapshot.bucket_granularity)} · 桶 {bucketSnapshot.bucket_index}
            </strong>
            <p className="muted">
              {bucketSnapshot.support_count} 条支持 · {bucketSnapshot.comment_count} 条评论
            </p>
          </div>
        ) : null}
        {(reasoning || model) ? (
          <div className="mini-card">
            <p className="eyebrow">模型说明</p>
            <strong>{model?.label ?? "未选择模型"}</strong>
            <p>{reasoning?.explanation ?? "当前主线尚无该模型的说明。"}</p>
            {reasoning ? <p className="muted">{reasoning.confidence_note}</p> : null}
          </div>
        ) : null}
        {traceability ? (
          <div className="mini-card">
            <p className="eyebrow">追溯</p>
            <p className="muted">
              {traceability.viewpoint_ids.length} 个观点 · {traceability.claim_ids.length} 条 Claim · {traceability.comment_ids.length} 条评论
            </p>
            <p>{traceability.viewpoint_ids.join(" / ")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
