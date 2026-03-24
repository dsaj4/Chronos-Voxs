import type { PublishedBundle } from "../loader/publishedTypes";
import type { PrimaryViewKey, WorkspaceFocusState } from "../state/focusState";
import { getPrimaryActiveStorylineId, getScopedEvidenceState, getScopedRelationshipState } from "../state/focusSelectors";
import { DetailPanel } from "./DetailPanel";
import { EvidencePanel } from "./EvidencePanel";
import { RelationshipPanel } from "./RelationshipPanel";
import { StorylineList } from "../components/StorylineList";
import { StorylinePanel } from "./StorylinePanel";
import { ViewStatusCard } from "../components/ViewStatusCard";
import { formatBucketStart, getPublishedForecastSummary } from "../forecast/seriesModels";

interface WorkspaceShellProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  onPrimaryViewChange: (view: PrimaryViewKey) => void;
  onStorylineSelect: (storylineId: string) => void;
  onModelChange: (modelId: WorkspaceFocusState["selectedModelId"]) => void;
}

export function WorkspaceShell({
  bundle,
  focus,
  onPrimaryViewChange,
  onStorylineSelect,
  onModelChange
}: WorkspaceShellProps) {
  const activeStorylineId = getPrimaryActiveStorylineId(focus);
  const selectedStoryline =
    bundle.stream.storylines.find((storyline) => storyline.storyline_id === activeStorylineId) ??
    bundle.stream.storylines[0] ??
    null;
  const relationshipScope = getScopedRelationshipState(bundle, focus);
  const evidenceScope = getScopedEvidenceState(bundle, focus);
  const activeForecastSummary =
    selectedStoryline ? getPublishedForecastSummary(bundle, selectedStoryline.storyline_id) : null;
  const activeModelLabel =
    bundle.meta.available_models.find((model) => model.id === focus.selectedModelId)?.label ?? focus.selectedModelId;

  return (
    <div className="workspace-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Chronos-Vox 分析工作台</p>
          <h1>{bundle.meta.case_title}</h1>
          <p className="muted">
            发布 bundle {bundle.meta.fixture_id} · 契约 {bundle.meta.contract_version}
          </p>
        </div>
        <div className="topbar__meta">
          <div className="pill-row">
            {bundle.meta.available_models.map((model) => (
              <button
                key={model.id}
                type="button"
                className={`pill ${model.id === focus.selectedModelId ? "pill--active" : ""}`}
                onClick={() => onModelChange(model.id)}
              >
                {model.label}
              </button>
            ))}
          </div>
          <p className="muted">{focus.lastInteractionImpact}</p>
        </div>
      </header>
      <nav className="view-tabs" aria-label="Primary views">
        {[
          { id: "storylines", label: "主线" },
          { id: "relationships", label: "关系" },
          { id: "evidence", label: "证据" }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab ${focus.activePrimaryView === item.id ? "tab--active" : ""}`}
            onClick={() => onPrimaryViewChange(item.id as PrimaryViewKey)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="workspace-grid">
        <section className="left-column">
          <div className="panel">
            <div className="panel__heading">
              <div>
                <p className="eyebrow">主线列表</p>
                <h3>已发布主线</h3>
              </div>
              <span className="muted">选择一条主线，工作台会同步主线、观点与时间桶焦点。</span>
            </div>
            <StorylineList
              storylines={bundle.stream.storylines}
              activeStorylineId={activeStorylineId}
              onSelect={onStorylineSelect}
            />
          </div>
          {focus.activePrimaryView === "storylines" ? (
            <StorylinePanel
              bundle={bundle}
              storyline={selectedStoryline}
              selectedModelId={focus.selectedModelId}
              onModelChange={onModelChange}
            />
          ) : focus.activePrimaryView === "relationships" ? (
            <RelationshipPanel bundle={bundle} focus={focus} scope={relationshipScope} />
          ) : (
            <EvidencePanel bundle={bundle} scope={evidenceScope} />
          )}
        </section>
        <aside className="right-column">
          <DetailPanel
            bundle={bundle}
            focus={focus}
            relationshipScope={relationshipScope}
            evidenceScope={evidenceScope}
          />
          <div className="preview-rail">
            <ViewStatusCard
              label="主线"
              summary={selectedStoryline ? selectedStoryline.title : "未选主线"}
              detail={
                activeForecastSummary
                  ? `${activeModelLabel} · ${formatBucketStart(
                      activeForecastSummary.bucket_start,
                      activeForecastSummary.bucket_granularity
                    )}`
                  : `当前模型 ${activeModelLabel}`
              }
              isActive={focus.activePrimaryView === "storylines"}
              onSelect={() => onPrimaryViewChange("storylines")}
            />
            <ViewStatusCard
              label="关系"
              summary={`${relationshipScope.viewpointRelations.length} 条观点关系 / ${relationshipScope.storylineRelations.length} 条主线关系`}
              detail={
                relationshipScope.fallbackMessage ??
                (relationshipScope.resolvedBucketIndex !== null
                  ? `聚焦桶 ${relationshipScope.resolvedBucketIndex}`
                  : "当前无关系上下文")
              }
              isActive={focus.activePrimaryView === "relationships"}
              onSelect={() => onPrimaryViewChange("relationships")}
            />
            <ViewStatusCard
              label="证据"
              summary={`${evidenceScope.evidenceClusters.length} 个证据簇 / ${evidenceScope.particles.length} 个粒子`}
              detail={
                evidenceScope.fallbackMessage ??
                (evidenceScope.resolvedBucketIndex !== null
                  ? `聚焦桶 ${evidenceScope.resolvedBucketIndex}`
                  : "当前无证据")
              }
              isActive={focus.activePrimaryView === "evidence"}
              onSelect={() => onPrimaryViewChange("evidence")}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
