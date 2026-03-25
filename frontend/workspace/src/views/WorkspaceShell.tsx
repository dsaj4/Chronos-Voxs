import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { StatusThumbnails } from "../components/StatusThumbnails";
import type { PublishedBundle, ForecastModelId } from "../loader/publishedTypes";
import { getPrimaryViewLabel } from "../presentation/workspaceChrome";
import {
  getPrimaryActiveStorylineId,
  getScopedEvidenceState,
  getScopedRelationshipState,
  type ScopedEvidenceState,
  type ScopedRelationshipState
} from "../state/focusSelectors";
import type { WorkspaceFocusState, PrimaryViewKey } from "../state/focusState";
import { DetailPanel } from "./DetailPanel";
import { EvidencePanel } from "./EvidencePanel";
import { RelationshipPanel } from "./RelationshipPanel";
import { StorylineForecastRail } from "./StorylineForecastRail";
import { createStorylineForecastViewModel } from "./storylineModelForecast";

const StorylinePanel = lazy(async () => {
  const module = await import("./StorylinePanel");
  return { default: module.StorylinePanel };
});

// Temporary product switch: keep the relationship implementation in place,
// but hide it from the current frontend chrome.
const SHOW_RELATIONSHIP_PANEL = false;

interface WorkspaceShellProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  onPrimaryViewChange: (view: PrimaryViewKey) => void;
  onStorylineSelect: (storylineId: string) => void;
  onModelChange: (modelId: ForecastModelId) => void;
  onModelParamsChange: (modelId: ForecastModelId, params: WorkspaceFocusState["modelParamsById"][ForecastModelId]) => void;
  onApplyModelParams: () => void;
  onResetModelParams: () => void;
  onSaveModelPreset: (name: string) => void;
  onDeleteModelPreset: (presetId: string) => void;
  onLoadModelPreset: (presetId: string) => void;
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
  evidenceScope: ScopedEvidenceState,
  selectedModelLabel: string,
  storylineForecastOpen: boolean
): string {
  const visibleEvidenceClusterCount =
    evidenceScope.evidenceClusters.length > 0
      ? evidenceScope.evidenceClusters.length
      : new Set(evidenceScope.particles.map((particle) => particle.viewpoint_id)).size;

  if (activeView === "relationships") {
    return relationshipScope.resolvedBucketIndex !== null
      ? `\u5173\u7cfb\u89c6\u56fe\u805a\u7126 ${relationshipViewpointTitle} / \u6876 ${relationshipScope.resolvedBucketIndex}`
      : `\u5173\u7cfb\u89c6\u56fe\u7b49\u5f85\u7126\u70b9`;
  }

  if (activeView === "evidence") {
    return evidenceScope.resolvedBucketIndex !== null
      ? `\u8bc1\u636e\u89c6\u56fe\u805a\u7126 \u6876 ${evidenceScope.resolvedBucketIndex} / ${visibleEvidenceClusterCount} \u7c07`
      : `\u8bc1\u636e\u89c6\u56fe\u6682\u65e0\u5207\u7247`;
  }

  if (storylineForecastOpen) {
    return storylineTitle
      ? `\u6a21\u578b\u9884\u6d4b / ${selectedModelLabel} / ${storylineTitle}`
      : `\u6a21\u578b\u9884\u6d4b\u5f85\u542f\u52a8`;
  }

  return storylineTitle
    ? `\u4e3b\u7ebf\u89c6\u56fe\u805a\u7126 ${storylineTitle}`
    : `\u4e3b\u7ebf\u89c6\u56fe\u7b49\u5f85\u7126\u70b9`;
}

export function WorkspaceShell({
  bundle,
  focus,
  onPrimaryViewChange,
  onStorylineSelect,
  onModelChange,
  onModelParamsChange,
  onApplyModelParams,
  onResetModelParams,
  onSaveModelPreset,
  onDeleteModelPreset,
  onLoadModelPreset
}: WorkspaceShellProps) {
  const [localOverride, setLocalOverride] = useState<LocalFocusOverride | null>(null);
  const [storylineForecastOpen, setStorylineForecastOpen] = useState(false);
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

  const visiblePrimaryView =
    !SHOW_RELATIONSHIP_PANEL && effectiveFocus.activePrimaryView === "relationships"
      ? "storylines"
      : effectiveFocus.activePrimaryView;
  const visibleFocus = useMemo<WorkspaceFocusState>(
    () =>
      visiblePrimaryView === effectiveFocus.activePrimaryView
        ? effectiveFocus
        : {
            ...effectiveFocus,
            activePrimaryView: visiblePrimaryView
          },
    [effectiveFocus, visiblePrimaryView]
  );
  const availablePrimaryViews: Array<{ id: PrimaryViewKey; label: string }> = SHOW_RELATIONSHIP_PANEL
    ? [
        { id: "storylines", label: `\u4e3b\u7ebf` },
        { id: "relationships", label: `\u5173\u7cfb` },
        { id: "evidence", label: `\u8bc1\u636e` }
      ]
    : [
        { id: "storylines", label: `\u4e3b\u7ebf` },
        { id: "evidence", label: `\u8bc1\u636e` }
      ];

  const activeStorylineId = getPrimaryActiveStorylineId(visibleFocus);
  const selectedStoryline =
    bundle.stream.storylines.find((storyline) => storyline.storyline_id === activeStorylineId) ??
    bundle.stream.storylines[0] ??
    null;
  const relationshipScope = getScopedRelationshipState(bundle, visibleFocus);
  const evidenceScope = getScopedEvidenceState(bundle, visibleFocus);
  const relationshipViewpointTitle =
    relationshipScope.displayViewpointId === null
      ? `\u65e0\u7126\u70b9`
      : bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === relationshipScope.displayViewpointId)?.title ??
        relationshipScope.displayViewpointId;
  const selectedModelLabel =
    bundle.meta.available_models.find((item) => item.id === visibleFocus.selectedModelId)?.label ??
    visibleFocus.selectedModelId;
  const forecastModel = useMemo(
    () =>
      createStorylineForecastViewModel(
        bundle,
        activeStorylineId,
        visibleFocus.selectedModelId,
        visibleFocus.modelParamsById[visibleFocus.selectedModelId]
      ),
    [activeStorylineId, bundle, visibleFocus.modelParamsById, visibleFocus.selectedModelId]
  );
  const impactSummary =
    localOverride && localOverride.sourceView === visibleFocus.activePrimaryView
      ? localOverride.impact
      : getWorkspaceImpactSummary(
          visibleFocus.activePrimaryView,
          selectedStoryline?.title ?? null,
          relationshipViewpointTitle,
          relationshipScope,
          evidenceScope,
          selectedModelLabel,
          storylineForecastOpen
        );
  const showForecastRail = visibleFocus.activePrimaryView === "storylines" && storylineForecastOpen;

  return (
    <div className="workspace-shell">
      <header className="workspace-topnav">
        <div className="workspace-topnav__identity">
          <div className="workspace-topnav__brand">
            <span className="workspace-brand__mark" aria-hidden="true" />
            <span className="workspace-topnav__brand-label">{`CHRONOS-VOX`}</span>
          </div>
          <span className="workspace-topnav__divider" aria-hidden="true" />
          <div className="workspace-topnav__meta">
            <span className="workspace-topnav__tag">{bundle.meta.topic_tag}</span>
            <span className="workspace-topnav__case">{bundle.meta.case_title}</span>
          </div>
        </div>

        <nav className="workspace-tabs" aria-label="Primary views">
          {availablePrimaryViews.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`cv-view-tab ${visibleFocus.activePrimaryView === item.id ? "cv-view-tab--active" : ""}`}
              onClick={() => onPrimaryViewChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="workspace-topnav__impact">
          <span>{`${getPrimaryViewLabel(visibleFocus.activePrimaryView)}\u89c6\u56fe / ${impactSummary}`}</span>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="left-column workspace-stage-shell">
          <div className="workspace-stage-shell__overlay" aria-hidden="true" />
          <div className="workspace-stage-shell__content">
            {visibleFocus.activePrimaryView === "storylines" ? (
              <Suspense fallback={<div className="loading-state">{`\u4e3b\u7ebf\u821e\u53f0\u6b63\u5728\u52a0\u8f7d\u2026`}</div>}>
                <StorylinePanel
                  bundle={bundle}
                  activeStorylineId={activeStorylineId}
                  forecastOpen={storylineForecastOpen}
                  forecastModel={forecastModel}
                  selectedModelLabel={selectedModelLabel}
                  onForecastOpenChange={setStorylineForecastOpen}
                  onStorylineSelect={(storylineId) => {
                    setLocalOverride(null);
                    onStorylineSelect(storylineId);
                  }}
                />
              </Suspense>
            ) : SHOW_RELATIONSHIP_PANEL && visibleFocus.activePrimaryView === "relationships" ? (
              <RelationshipPanel
                bundle={bundle}
                scope={relationshipScope}
                storylines={bundle.stream.storylines}
                activeStorylineId={activeStorylineId}
                onStorylineSelect={(storylineId) => {
                  setLocalOverride(null);
                  onStorylineSelect(storylineId);
                }}
                onNodeSelect={({ viewpointId, bucketIndex }) => {
                  const viewpointTitle =
                    bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === viewpointId)?.title ??
                    viewpointId;
                  setLocalOverride({
                    storylineId: relationshipScope.storylineId,
                    viewpointId,
                    bucketIndex,
                    impact: `\u5df2\u9501\u5b9a\u5173\u7cfb\u8282\u70b9 ${viewpointTitle} / \u6876 ${bucketIndex}`,
                    sourceView: "relationships"
                  });
                }}
              />
            ) : (
              <EvidencePanel
                bundle={bundle}
                scope={evidenceScope}
                storylines={bundle.stream.storylines}
                activeStorylineId={activeStorylineId}
                onStorylineSelect={(storylineId) => {
                  setLocalOverride(null);
                  onStorylineSelect(storylineId);
                }}
                onBucketSelect={(bucketIndex) => {
                  setLocalOverride({
                    storylineId: evidenceScope.storylineId,
                    viewpointId: visibleFocus.activeViewpointId,
                    bucketIndex,
                    impact: `\u5df2\u9501\u5b9a\u8bc1\u636e\u65f6\u95f4\u6876 ${bucketIndex}`,
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
          </div>
        </section>

        <aside className="right-column workspace-detail-column">
          {showForecastRail ? (
            <StorylineForecastRail
              bundle={bundle}
              focus={visibleFocus}
              model={forecastModel}
              onModelChange={onModelChange}
              onModelParamsChange={onModelParamsChange}
              onApplyModelParams={onApplyModelParams}
              onResetModelParams={onResetModelParams}
              onSaveModelPreset={onSaveModelPreset}
              onDeleteModelPreset={onDeleteModelPreset}
              onLoadModelPreset={onLoadModelPreset}
            />
          ) : (
            <DetailPanel
              bundle={bundle}
              focus={visibleFocus}
              relationshipScope={relationshipScope}
              evidenceScope={evidenceScope}
              impactSummary={impactSummary}
              onModelChange={onModelChange}
            />
          )}
        </aside>
      </main>

      <StatusThumbnails
        bundle={bundle}
        focus={visibleFocus}
        relationshipScope={relationshipScope}
        evidenceScope={evidenceScope}
        showRelationshipView={SHOW_RELATIONSHIP_PANEL}
        onPrimaryViewChange={onPrimaryViewChange}
      />
    </div>
  );
}
