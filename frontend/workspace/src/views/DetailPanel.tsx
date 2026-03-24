import type { ReactNode } from "react";
import { formatBucketStart, getPublishedReasoningForSeries, getPublishedTraceability } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import {
  getEvidencePostureTone,
  getLogicStatusTone,
  getModelCategoryLabel,
  getRelationTypeTone
} from "../presentation/workspaceChrome";
import type { ScopedEvidenceState, ScopedRelationshipState } from "../state/focusSelectors";
import type { WorkspaceFocusState } from "../state/focusState";

interface DetailPanelProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  relationshipScope: ScopedRelationshipState;
  evidenceScope: ScopedEvidenceState;
  impactSummary: string;
  onModelChange: (modelId: WorkspaceFocusState["selectedModelId"]) => void;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="detail-panel__section-title">
      <span className="detail-panel__section-line" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent = false
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="detail-panel__info-row">
      <span className="detail-panel__info-label">{label}</span>
      <span className={`detail-panel__info-value ${accent ? "detail-panel__info-value--accent" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="detail-panel__empty">{message}</p>;
}

export function DetailPanel({
  bundle,
  focus,
  relationshipScope,
  evidenceScope,
  impactSummary,
  onModelChange
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
  const storylineLogicTone = storyline ? getLogicStatusTone(storyline.logic_status) : null;
  const storylineEvidenceTone = storyline ? getEvidencePostureTone(storyline.evidence_posture) : null;
  const relationshipAnchors =
    focus.activePrimaryView === "relationships" ? relationshipScope.externalAnchors.slice(0, 4) : [];
  const heatWeights = Object.entries(bundle.reasoning.heat_index_formula.weights);

  return (
    <section className="panel detail-panel detail-panel--signal">
      <div className="detail-panel__header">
        <div>
          <p className="eyebrow">统一详情</p>
          <h3>当前焦点</h3>
        </div>
        {model ? (
          <span className="workspace-model">
            {`${model.label} / ${getModelCategoryLabel(model.category)}`}
          </span>
        ) : null}
      </div>

      <p className="detail-panel__impact">{impactSummary}</p>
      {fallbackNote ? <p className="detail-panel__note">{fallbackNote}</p> : null}

      <div className="detail-panel__body">
        <div className="detail-panel__section">
          <SectionTitle>当前观点</SectionTitle>
          {viewpoint ? (
            <div className="detail-card detail-card--focus">
              <strong className="detail-card__title">{viewpoint.title}</strong>
              <p className="detail-card__summary">{viewpoint.summary}</p>
              <p className="detail-card__caption">{viewpoint.claim_statement}</p>
              <InfoRow label="支持数" value={viewpoint.support_count} />
              <InfoRow label="评论数" value={viewpoint.unique_comment_count} />
              <InfoRow label="摘要扎实度" value={viewpoint.summary_grounding_score.toFixed(2)} accent />
            </div>
          ) : (
            <EmptyState message="当前没有可展示的观点焦点。" />
          )}
        </div>

        <div className="detail-panel__section">
          <SectionTitle>当前主线</SectionTitle>
          {storyline ? (
            <div className="detail-card">
              <div className="detail-card__badges">
                {storylineLogicTone ? (
                  <span className={`tone-pill tone-pill--${storylineLogicTone.tone}`}>
                    {storylineLogicTone.label}
                  </span>
                ) : null}
                {storylineEvidenceTone ? (
                  <span className={`tone-pill tone-pill--${storylineEvidenceTone.tone}`}>
                    {storylineEvidenceTone.label}
                  </span>
                ) : null}
              </div>
              <strong className="detail-card__title">{storyline.title}</strong>
              <p className="detail-card__summary">{storyline.summary}</p>
              <div className="detail-card__metrics">
                <InfoRow label="支持" value={storyline.support_count} />
                <InfoRow label="观点" value={storyline.viewpoint_count} />
                <InfoRow label="评论" value={storyline.comment_count} />
              </div>
            </div>
          ) : (
            <EmptyState message="当前没有可展示的主线焦点。" />
          )}
        </div>

        <div className="detail-panel__section">
          <SectionTitle>当前时间桶</SectionTitle>
          {bucketSnapshot ? (
            <div className="detail-card">
              <InfoRow
                label="时间"
                value={formatBucketStart(bucketSnapshot.bucket_start, bucketSnapshot.bucket_granularity)}
                accent
              />
              <InfoRow label="桶序号" value={`T${bucketSnapshot.bucket_index}`} />
              <InfoRow label="支持数" value={bucketSnapshot.support_count} />
              <InfoRow label="评论数" value={bucketSnapshot.comment_count} />
              <InfoRow label="热度指数" value={bucketSnapshot.storyline_heat_index.toFixed(3)} accent />
              <InfoRow label="主导观点数" value={bucketSnapshot.top_viewpoint_ids.length} />
            </div>
          ) : (
            <EmptyState message="当前时间桶没有可展示的快照。" />
          )}
        </div>

        <div className="detail-panel__section">
          <SectionTitle>预测模型</SectionTitle>
          <div className="detail-panel__model-switcher" role="radiogroup" aria-label="预测模型">
            {bundle.meta.available_models.map((availableModel) => {
              const isActive = availableModel.id === focus.selectedModelId;
              return (
                <button
                  key={availableModel.id}
                  type="button"
                  className={`detail-panel__model-button ${isActive ? "detail-panel__model-button--active" : ""}`}
                  onClick={() => onModelChange(availableModel.id)}
                  aria-pressed={isActive}
                >
                  <span className="detail-panel__model-label">{availableModel.label}</span>
                  <span className="detail-panel__model-meta">
                    {getModelCategoryLabel(availableModel.category)}
                  </span>
                </button>
              );
            })}
          </div>
          {(reasoning || model) ? (
            <div className="detail-card detail-card--forecast">
              {reasoning ? <p className="detail-card__summary">{reasoning.explanation}</p> : null}
              {reasoning?.comparison_summary ? (
                <p className="detail-card__caption">{reasoning.comparison_summary}</p>
              ) : null}
              {reasoning?.confidence_note ? (
                <p className="detail-card__caption detail-card__caption--accent">{reasoning.confidence_note}</p>
              ) : null}
            </div>
          ) : (
            <EmptyState message="当前主线还没有这个模型的解释信息。" />
          )}
        </div>

        {relationshipAnchors.length ? (
          <div className="detail-panel__section">
            <SectionTitle>关系外部锚点</SectionTitle>
            <div className="detail-panel__anchor-list">
              {relationshipAnchors.map((anchor) => {
                const tone = getRelationTypeTone(anchor.relationType);
                return (
                  <div key={anchor.id} className="detail-card detail-card--compact">
                    <div className="detail-card__badges">
                      <span className={`tone-pill tone-pill--${tone.tone}`}>{tone.label}</span>
                      <span className="tone-pill tone-pill--muted">
                        {anchor.direction === "incoming" ? "流入" : "流出"}
                      </span>
                    </div>
                    <strong className="detail-card__title">{anchor.label}</strong>
                    <p className="detail-card__caption">{anchor.summary}</p>
                    <InfoRow label="权重" value={anchor.weight.toFixed(2)} accent />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="detail-panel__section">
          <SectionTitle>追溯</SectionTitle>
          {traceability ? (
            <div className="detail-card">
              <InfoRow label="观点" value={traceability.viewpoint_ids.length} />
              <InfoRow label="Claims" value={traceability.claim_ids.length} />
              <InfoRow label="评论" value={traceability.comment_ids.length} />
              <p className="detail-card__caption">
                {traceability.viewpoint_ids.length
                  ? traceability.viewpoint_ids.join(" / ")
                  : "当前主线没有可展示的观点追溯。"}
              </p>
            </div>
          ) : (
            <EmptyState message="当前主线没有追溯记录。" />
          )}
        </div>

        <div className="detail-panel__section">
          <SectionTitle>热度公式</SectionTitle>
          <div className="detail-card detail-card--compact">
            <p className="detail-card__caption">{bundle.reasoning.heat_index_formula.description}</p>
            <div className="detail-panel__weights">
              {heatWeights.map(([key, value]) => (
                <InfoRow key={key} label={key} value={value} accent />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
