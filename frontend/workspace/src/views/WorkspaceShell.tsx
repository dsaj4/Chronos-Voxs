import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { StorylineSwitchHeader } from "../components/StorylineSwitchHeader";
import { ViewStatusCard } from "../components/ViewStatusCard";
import { formatBucketStart, getPublishedForecastSummary } from "../forecast/seriesModels";
import type { PublishedBundle } from "../loader/publishedTypes";
import {
  getEvidencePostureTone,
  getLogicStatusTone,
  getModelCategoryLabel,
  getPrimaryViewLabel
} from "../presentation/workspaceChrome";
import {
  getPrimaryActiveStorylineId,
  getScopedEvidenceState,
  getScopedRelationshipState,
  type ScopedEvidenceState,
  type ScopedRelationshipState
} from "../state/focusSelectors";
import type { PrimaryViewKey, WorkspaceFocusState } from "../state/focusState";
import { DetailPanel } from "./DetailPanel";
import { EvidencePanel } from "./EvidencePanel";
import { RelationshipPanel } from "./RelationshipPanel";

const StorylinePanel = lazy(async () => {
  const module = await import("./StorylinePanel");
  return { default: module.StorylinePanel };
});

interface WorkspaceShellProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  onPrimaryViewChange: (view: PrimaryViewKey) => void;
  onStorylineSelect: (storylineId: string) => void;
  onModelChange: (modelId: WorkspaceFocusState["selectedModelId"]) => void;
}

interface LocalFocusOverride {
  storylineId: string | null;
  viewpointId: string | null;
  bucketIndex: number | null;
  impact: string;
  sourceView: PrimaryViewKey;
}

function getWorkspaceImpactSummary(
  activeView: PrimaryViewKey,
  storylineTitle: string | null,
  relationshipViewpointTitle: string,
  relationshipScope: ScopedRelationshipState,
  evidenceScope: ScopedEvidenceState
): string {
  const visibleEvidenceClusterCount =
    evidenceScope.evidenceClusters.length > 0
      ? evidenceScope.evidenceClusters.length
      : new Set(evidenceScope.particles.map((particle) => particle.viewpoint_id)).size;

  if (activeView === "relationships") {
    return relationshipScope.resolvedBucketIndex !== null
      ? `${`\u5173\u7cfb\u89c6\u56fe\u805a\u7126`} ${relationshipViewpointTitle} / ${`\u6876`} ${relationshipScope.resolvedBucketIndex}`
      : `\u5173\u7cfb\u89c6\u56fe\u7b49\u5f85\u7126\u70b9`;
  }

  if (activeView === "evidence") {
    return evidenceScope.resolvedBucketIndex !== null
      ? `${`\u8bc1\u636e\u89c6\u56fe\u805a\u7126`} ${`\u6876`} ${evidenceScope.resolvedBucketIndex} / ${visibleEvidenceClusterCount} ${`\u7c07`}`
      : `\u8bc1\u636e\u89c6\u56fe\u6682\u65e0\u5207\u7247`;
  }

  return storylineTitle
    ? `${`\u4e3b\u7ebf\u89c6\u56fe\u805a\u7126`} ${storylineTitle}`
    : `\u4e3b\u7ebf\u89c6\u56fe\u7b49\u5f85\u7126\u70b9`;
}

export function WorkspaceShell({
  bundle,
  focus,
  onPrimaryViewChange,
  onStorylineSelect,
  onModelChange
}: WorkspaceShellProps) {
  const [localOverride, setLocalOverride] = useState<LocalFocusOverride | null>(null);
  const externalFocusKey = `${focus.activeStorylineIds.join(",")}::${focus.activeViewpointId ?? ""}::${focus.activeBucketIndex ?? ""}`;

  useEffect(() => {
    setLocalOverride(null);
  }, [externalFocusKey]);

  const effectiveFocus = useMemo<WorkspaceFocusState>(() => {
    if (!localOverride) {
      return focus;
    }

    return {
      ...focus,
      activeStorylineIds: localOverride.storylineId ? [localOverride.storylineId] : focus.activeStorylineIds,
      activeViewpointId: localOverride.viewpointId,
      activeBucketIndex: localOverride.bucketIndex,
      lastInteractionImpact: localOverride.impact
    };
  }, [focus, localOverride]);

  const activeStorylineId = getPrimaryActiveStorylineId(effectiveFocus);
  const selectedStoryline =
    bundle.stream.storylines.find((storyline) => storyline.storyline_id === activeStorylineId) ??
    bundle.stream.storylines[0] ??
    null;
  const relationshipScope = getScopedRelationshipState(bundle, effectiveFocus);
  const evidenceScope = getScopedEvidenceState(bundle, effectiveFocus);
  const visibleEvidenceClusterCount =
    evidenceScope.evidenceClusters.length > 0
      ? evidenceScope.evidenceClusters.length
      : new Set(evidenceScope.particles.map((particle) => particle.viewpoint_id)).size;
  const activeForecastSummary =
    selectedStoryline ? getPublishedForecastSummary(bundle, selectedStoryline.storyline_id) : null;
  const activeModel =
    bundle.meta.available_models.find((model) => model.id === effectiveFocus.selectedModelId) ?? null;
  const activeModelLabel = activeModel?.label ?? effectiveFocus.selectedModelId;
  const relationshipViewpointTitle =
    relationshipScope.displayViewpointId === null
      ? `\u65e0\u7126\u70b9`
      : bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === relationshipScope.displayViewpointId)?.title ??
        relationshipScope.displayViewpointId;
  const impactSummary =
    localOverride && localOverride.sourceView === effectiveFocus.activePrimaryView
      ? localOverride.impact
      : getWorkspaceImpactSummary(
          effectiveFocus.activePrimaryView,
          selectedStoryline?.title ?? null,
          relationshipViewpointTitle,
          relationshipScope,
          evidenceScope
        );
  const storylineLogicTone = selectedStoryline ? getLogicStatusTone(selectedStoryline.logic_status) : null;
  const storylineEvidenceTone = selectedStoryline
    ? getEvidencePostureTone(selectedStoryline.evidence_posture)
    : null;

  return (
    <div className="workspace-shell">
      <header className="topbar workspace-header">
        <div className="workspace-header__identity">
          <div className="workspace-brand">
            <span className="workspace-brand__mark" aria-hidden="true" />
            <div className="workspace-brand__copy">
              <p className="eyebrow">{`Chronos-Vox \u5206\u6790\u5de5\u4f5c\u53f0`}</p>
              <h1>{bundle.meta.case_title}</h1>
              <p className="muted">
                {`${bundle.meta.topic_tag} / ${`\u53d1\u5e03`} bundle ${bundle.meta.fixture_id} / ${`\u5408\u7ea6`} ${bundle.meta.contract_version}`}
              </p>
            </div>
          </div>
          {selectedStoryline ? (
            <div className="workspace-headline">
              {storylineLogicTone ? (
                <span className={`tone-pill tone-pill--${storylineLogicTone.tone}`}>{storylineLogicTone.label}</span>
              ) : null}
              {storylineEvidenceTone ? (
                <span className={`tone-pill tone-pill--${storylineEvidenceTone.tone}`}>
                  {storylineEvidenceTone.label}
                </span>
              ) : null}
              <span className="workspace-headline__title">{selectedStoryline.title}</span>
            </div>
          ) : null}
        </div>
        <nav className="view-tabs workspace-tabs" aria-label="Primary views">
          {[
            { id: "storylines", label: `\u4e3b\u7ebf` },
            { id: "relationships", label: `\u5173\u7cfb` },
            { id: "evidence", label: `\u8bc1\u636e` }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${effectiveFocus.activePrimaryView === item.id ? "tab--active" : ""}`}
              onClick={() => onPrimaryViewChange(item.id as PrimaryViewKey)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar__meta workspace-header__meta">
          {activeModel ? (
            <span className="workspace-model">
              {`${activeModel.label} / ${getModelCategoryLabel(activeModel.category)}`}
            </span>
          ) : null}
          <p className="workspace-impact">
            {`${getPrimaryViewLabel(effectiveFocus.activePrimaryView)}${`\u89c6\u56fe`} · ${impactSummary}`}
          </p>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="left-column">
          {effectiveFocus.activePrimaryView === "storylines" ? (
            <Suspense fallback={<div className="panel loading-state">{`\u4e3b\u7ebf\u821e\u53f0\u6b63\u5728\u52a0\u8f7d\u2026`}</div>}>
              <StorylinePanel
                bundle={bundle}
                activeStorylineId={activeStorylineId}
                onStorylineSelect={(storylineId) => {
                  setLocalOverride(null);
                  onStorylineSelect(storylineId);
                }}
              />
            </Suspense>
          ) : (
            <>
              <StorylineSwitchHeader
                storylines={bundle.stream.storylines}
                activeStorylineId={activeStorylineId}
                onStorylineSelect={(storylineId) => {
                  setLocalOverride(null);
                  onStorylineSelect(storylineId);
                }}
                title={selectedStoryline?.title ?? bundle.meta.case_title}
              />

              {effectiveFocus.activePrimaryView === "relationships" ? (
                <RelationshipPanel
                  bundle={bundle}
                  scope={relationshipScope}
                  onNodeSelect={({ viewpointId, bucketIndex }) => {
                    const viewpointTitle =
                      bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === viewpointId)?.title ??
                      viewpointId;
                    setLocalOverride({
                      storylineId: relationshipScope.storylineId,
                      viewpointId,
                      bucketIndex,
                      impact: `${`\u5df2\u9501\u5b9a\u5173\u7cfb\u8282\u70b9`} ${viewpointTitle} / ${`\u6876`} ${bucketIndex}`,
                      sourceView: "relationships"
                    });
                  }}
                />
              ) : (
                <EvidencePanel
                  bundle={bundle}
                  scope={evidenceScope}
                  onBucketSelect={(bucketIndex) => {
                    setLocalOverride({
                      storylineId: evidenceScope.storylineId,
                      viewpointId: effectiveFocus.activeViewpointId,
                      bucketIndex,
                      impact: `${`\u5df2\u9501\u5b9a\u8bc1\u636e\u65f6\u95f4\u6876`} ${bucketIndex}`,
                      sourceView: "evidence"
                    });
                  }}
                  onEvidenceFocus={({ viewpointId, bucketIndex, impact }) => {
                    setLocalOverride({
                      storylineId: evidenceScope.storylineId,
                      viewpointId,
                      bucketIndex,
                      impact,
                      sourceView: "evidence"
                    });
                  }}
                />
              )}
            </>
          )}
        </section>

        <aside className="right-column">
          <DetailPanel
            bundle={bundle}
            focus={effectiveFocus}
            relationshipScope={relationshipScope}
            evidenceScope={evidenceScope}
            impactSummary={impactSummary}
            onModelChange={onModelChange}
          />
          <div className="preview-rail">
            <ViewStatusCard
              label={`\u4e3b\u7ebf`}
              summary={selectedStoryline ? selectedStoryline.title : `\u672a\u9009\u4e3b\u7ebf`}
              detail={
                activeForecastSummary
                  ? `${activeModelLabel} / ${formatBucketStart(
                      activeForecastSummary.bucket_start,
                      activeForecastSummary.bucket_granularity
                    )}`
                  : `${`\u5f53\u524d\u6a21\u578b`} ${activeModelLabel}`
              }
              isActive={effectiveFocus.activePrimaryView === "storylines"}
              onSelect={() => onPrimaryViewChange("storylines")}
            />
            <ViewStatusCard
              label={`\u5173\u7cfb`}
              summary={relationshipViewpointTitle}
              detail={
                relationshipScope.resolvedBucketIndex !== null
                  ? `${`\u6876`} ${relationshipScope.resolvedBucketIndex} / ${relationshipScope.lanes.length} ${`\u6761\u6cf3\u9053`}`
                  : `\u5f53\u524d\u6ca1\u6709\u5173\u7cfb\u4e0a\u4e0b\u6587`
              }
              isActive={effectiveFocus.activePrimaryView === "relationships"}
              onSelect={() => onPrimaryViewChange("relationships")}
            />
            <ViewStatusCard
              label={`\u8bc1\u636e`}
              summary={`${visibleEvidenceClusterCount} ${`\u4e2a\u7c07`} / ${evidenceScope.particles.length} ${`\u4e2a\u7c92\u5b50`}`}
              detail={
                evidenceScope.resolvedBucketIndex !== null
                  ? `${`\u6876`} ${evidenceScope.resolvedBucketIndex}`
                  : `\u5f53\u524d\u6ca1\u6709\u8bc1\u636e\u5207\u7247`
              }
              isActive={effectiveFocus.activePrimaryView === "evidence"}
              onSelect={() => onPrimaryViewChange("evidence")}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
