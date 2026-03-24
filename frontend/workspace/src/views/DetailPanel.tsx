import { useEffect, useState, type ReactNode } from "react";
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

type DetailSectionKey =
  | "viewpoint"
  | "storyline"
  | "bucket"
  | "model"
  | "anchors"
  | "traceability"
  | "formula";

type DetailSectionState = Record<DetailSectionKey, boolean>;

function createDefaultOpenSections(view: WorkspaceFocusState["activePrimaryView"]): DetailSectionState {
  switch (view) {
    case "relationships":
    case "evidence":
      return {
        viewpoint: true,
        storyline: false,
        bucket: true,
        model: false,
        anchors: false,
        traceability: false,
        formula: false
      };
    case "storylines":
    default:
      return {
        viewpoint: true,
        storyline: true,
        bucket: false,
        model: false,
        anchors: false,
        traceability: false,
        formula: false
      };
  }
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
  value: ReactNode;
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

function AccordionSection({
  title,
  summary,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`detail-panel__section ${isOpen ? "detail-panel__section--open" : ""}`}>
      <button
        type="button"
        className="detail-panel__section-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="detail-panel__section-copy">
          <SectionTitle>{title}</SectionTitle>
          <p className="detail-panel__section-summary">{summary}</p>
        </div>
        <span className="detail-panel__section-state">{isOpen ? "\u6536\u8d77" : "\u5c55\u5f00"}</span>
      </button>
      {isOpen ? <div className="detail-panel__section-body">{children}</div> : null}
    </div>
  );
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

  const [openSections, setOpenSections] = useState<DetailSectionState>(() =>
    createDefaultOpenSections(focus.activePrimaryView)
  );

  useEffect(() => {
    setOpenSections(createDefaultOpenSections(focus.activePrimaryView));
  }, [focus.activePrimaryView, activeStorylineId]);

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

  function toggleSection(section: DetailSectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section]
    }));
  }

  const viewpointSummary = viewpoint
    ? `${viewpoint.support_count} ${"\u652f\u6301"} / ${viewpoint.unique_comment_count} ${"\u8bc4\u8bba"}`
    : "\u6682\u65e0\u89c2\u70b9\u7126\u70b9";
  const storylineSummary = storyline
    ? `${storyline.support_count} ${"\u652f\u6301"} / ${storyline.viewpoint_count} ${"\u89c2\u70b9"}`
    : "\u6682\u65e0\u4e3b\u7ebf\u7126\u70b9";
  const bucketSummary = bucketSnapshot
    ? `${formatBucketStart(bucketSnapshot.bucket_start, bucketSnapshot.bucket_granularity)} / T${bucketSnapshot.bucket_index}`
    : "\u6682\u65e0\u65f6\u95f4\u6863";
  const modelSummary = model
    ? `${model.label} / ${getModelCategoryLabel(model.category)}`
    : "\u6682\u65e0\u6a21\u578b";
  const anchorSummary = relationshipAnchors.length
    ? `${relationshipAnchors.length} ${"\u4e2a\u5916\u90e8\u951a\u70b9"}`
    : "\u6682\u65e0\u5916\u90e8\u951a\u70b9";
  const traceabilitySummary = traceability
    ? `${traceability.viewpoint_ids.length} ${"\u89c2\u70b9"} / ${traceability.claim_ids.length} claims / ${traceability.comment_ids.length} ${"\u8bc4\u8bba"}`
    : "\u6682\u65e0\u8ffd\u6eaf\u8bb0\u5f55";
  const formulaSummary = `${heatWeights.length} ${"\u4e2a\u6743\u91cd\u9879"}`;

  return (
    <section className="panel detail-panel detail-panel--signal">
      <div className="detail-panel__header">
        <div>
          <p className="eyebrow">{`\u7edf\u4e00\u8be6\u60c5`}</p>
          <h3>{`\u5f53\u524d\u7126\u70b9`}</h3>
        </div>
        {model ? (
          <span className="workspace-model">
            {`${model.label} / ${getModelCategoryLabel(model.category)}`}
          </span>
        ) : null}
      </div>

      <p className="detail-panel__impact">{impactSummary}</p>
      {fallbackNote ? <p className="detail-panel__note">{fallbackNote}</p> : null}

      <div className="detail-panel__focus-strip">
        <div className="detail-panel__focus-item">
          <span className="detail-panel__focus-label">{`\u89c2\u70b9`}</span>
          <strong className="detail-panel__focus-value">
            {viewpoint?.title ?? `\u6682\u65e0\u89c2\u70b9`}
          </strong>
        </div>
        <div className="detail-panel__focus-item">
          <span className="detail-panel__focus-label">{`\u4e3b\u7ebf`}</span>
          <strong className="detail-panel__focus-value">
            {storyline?.title ?? `\u6682\u65e0\u4e3b\u7ebf`}
          </strong>
        </div>
        <div className="detail-panel__focus-item">
          <span className="detail-panel__focus-label">{`\u65f6\u95f4\u6863`}</span>
          <strong className="detail-panel__focus-value">{bucketSummary}</strong>
        </div>
      </div>

      <div className="detail-panel__body">
        <AccordionSection
          title={`\u5f53\u524d\u89c2\u70b9`}
          summary={viewpointSummary}
          isOpen={openSections.viewpoint}
          onToggle={() => toggleSection("viewpoint")}
        >
          {viewpoint ? (
            <div className="detail-card detail-card--focus">
              <strong className="detail-card__title">{viewpoint.title}</strong>
              <p className="detail-card__summary">{viewpoint.summary}</p>
              <p className="detail-card__caption">{viewpoint.claim_statement}</p>
              <InfoRow label={`\u652f\u6301\u6570`} value={viewpoint.support_count} />
              <InfoRow label={`\u8bc4\u8bba\u6570`} value={viewpoint.unique_comment_count} />
              <InfoRow label={`\u6458\u8981\u624e\u5b9e\u5ea6`} value={viewpoint.summary_grounding_score.toFixed(2)} accent />
            </div>
          ) : (
            <EmptyState message={`\u5f53\u524d\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u89c2\u70b9\u7126\u70b9\u3002`} />
          )}
        </AccordionSection>

        <AccordionSection
          title={`\u5f53\u524d\u4e3b\u7ebf`}
          summary={storylineSummary}
          isOpen={openSections.storyline}
          onToggle={() => toggleSection("storyline")}
        >
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
                <InfoRow label={`\u652f\u6301`} value={storyline.support_count} />
                <InfoRow label={`\u89c2\u70b9`} value={storyline.viewpoint_count} />
                <InfoRow label={`\u8bc4\u8bba`} value={storyline.comment_count} />
              </div>
            </div>
          ) : (
            <EmptyState message={`\u5f53\u524d\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u4e3b\u7ebf\u7126\u70b9\u3002`} />
          )}
        </AccordionSection>

        <AccordionSection
          title={`\u5f53\u524d\u65f6\u95f4\u6863`}
          summary={bucketSummary}
          isOpen={openSections.bucket}
          onToggle={() => toggleSection("bucket")}
        >
          {bucketSnapshot ? (
            <div className="detail-card">
              <InfoRow
                label={`\u65f6\u95f4`}
                value={formatBucketStart(bucketSnapshot.bucket_start, bucketSnapshot.bucket_granularity)}
                accent
              />
              <InfoRow label={`\u6863\u5e8f\u53f7`} value={`T${bucketSnapshot.bucket_index}`} />
              <InfoRow label={`\u652f\u6301\u6570`} value={bucketSnapshot.support_count} />
              <InfoRow label={`\u8bc4\u8bba\u6570`} value={bucketSnapshot.comment_count} />
              <InfoRow label={`\u70ed\u5ea6\u6307\u6570`} value={bucketSnapshot.storyline_heat_index.toFixed(3)} accent />
              <InfoRow label={`\u4e3b\u5bfc\u89c2\u70b9\u6570`} value={bucketSnapshot.top_viewpoint_ids.length} />
            </div>
          ) : (
            <EmptyState message={`\u5f53\u524d\u65f6\u95f4\u6863\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u5feb\u7167\u3002`} />
          )}
        </AccordionSection>

        <AccordionSection
          title={`\u9884\u6d4b\u6a21\u578b`}
          summary={modelSummary}
          isOpen={openSections.model}
          onToggle={() => toggleSection("model")}
        >
          <div className="detail-panel__model-switcher" role="radiogroup" aria-label={`\u9884\u6d4b\u6a21\u578b`}>
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
            <EmptyState message={`\u5f53\u524d\u4e3b\u7ebf\u8fd8\u6ca1\u6709\u8fd9\u4e2a\u6a21\u578b\u7684\u89e3\u91ca\u4fe1\u606f\u3002`} />
          )}
        </AccordionSection>

        {relationshipAnchors.length ? (
          <AccordionSection
            title={`\u5173\u7cfb\u5916\u90e8\u951a\u70b9`}
            summary={anchorSummary}
            isOpen={openSections.anchors}
            onToggle={() => toggleSection("anchors")}
          >
            <div className="detail-panel__anchor-list">
              {relationshipAnchors.map((anchor) => {
                const tone = getRelationTypeTone(anchor.relationType);
                return (
                  <div key={anchor.id} className="detail-card detail-card--compact">
                    <div className="detail-card__badges">
                      <span className={`tone-pill tone-pill--${tone.tone}`}>{tone.label}</span>
                      <span className="tone-pill tone-pill--muted">
                        {anchor.direction === "incoming" ? "\u6d41\u5165" : "\u6d41\u51fa"}
                      </span>
                    </div>
                    <strong className="detail-card__title">{anchor.label}</strong>
                    <p className="detail-card__caption">{anchor.summary}</p>
                    <InfoRow label={`\u6743\u91cd`} value={anchor.weight.toFixed(2)} accent />
                  </div>
                );
              })}
            </div>
          </AccordionSection>
        ) : null}

        <AccordionSection
          title={`\u8ffd\u6eaf`}
          summary={traceabilitySummary}
          isOpen={openSections.traceability}
          onToggle={() => toggleSection("traceability")}
        >
          {traceability ? (
            <div className="detail-card">
              <InfoRow label={`\u89c2\u70b9`} value={traceability.viewpoint_ids.length} />
              <InfoRow label="Claims" value={traceability.claim_ids.length} />
              <InfoRow label={`\u8bc4\u8bba`} value={traceability.comment_ids.length} />
              <p className="detail-card__caption">
                {traceability.viewpoint_ids.length
                  ? traceability.viewpoint_ids.join(" / ")
                  : `\u5f53\u524d\u4e3b\u7ebf\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u89c2\u70b9\u8ffd\u6eaf\u3002`}
              </p>
            </div>
          ) : (
            <EmptyState message={`\u5f53\u524d\u4e3b\u7ebf\u6ca1\u6709\u8ffd\u6eaf\u8bb0\u5f55\u3002`} />
          )}
        </AccordionSection>

        <AccordionSection
          title={`\u70ed\u5ea6\u516c\u5f0f`}
          summary={formulaSummary}
          isOpen={openSections.formula}
          onToggle={() => toggleSection("formula")}
        >
          <div className="detail-card detail-card--compact">
            <p className="detail-card__caption">{bundle.reasoning.heat_index_formula.description}</p>
            <div className="detail-panel__weights">
              {heatWeights.map(([key, value]) => (
                <InfoRow key={key} label={key} value={value} accent />
              ))}
            </div>
          </div>
        </AccordionSection>
      </div>
    </section>
  );
}
