import type { ReactNode } from "react";
import type { PublishedBundle } from "../loader/publishedTypes";
import type { ScopedEvidenceState, ScopedRelationshipState } from "../state/focusSelectors";
import type { PrimaryViewKey, WorkspaceFocusState } from "../state/focusState";

interface StatusThumbnailsProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  relationshipScope: ScopedRelationshipState;
  evidenceScope: ScopedEvidenceState;
  showRelationshipView?: boolean;
  onPrimaryViewChange: (view: PrimaryViewKey) => void;
}

function StorylineThumbnail({
  bundle,
  focus
}: {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
}) {
  const selectedModel =
    bundle.meta.available_models.find((model) => model.id === focus.selectedModelId) ??
    bundle.meta.available_models[0] ??
    null;
  const activeStorylineId = focus.activeStorylineIds[0] ?? bundle.stream.storylines[0]?.storyline_id ?? null;
  const activeStoryline =
    activeStorylineId === null
      ? null
      : bundle.stream.storylines.find((storyline) => storyline.storyline_id === activeStorylineId) ?? null;
  const snapshots =
    activeStorylineId === null
      ? []
      : bundle.stream.storyline_snapshots
          .filter((snapshot) => snapshot.storyline_id === activeStorylineId)
          .slice(-12);

  return (
    <div className="cv-thumbnail">
      <div className="cv-thumbnail__head">
        <span className="cv-thumbnail__label">{`\u4e3b\u7ebf`}</span>
        <span className="cv-thumbnail__tag">{selectedModel?.label ?? focus.selectedModelId}</span>
      </div>
      <div className="cv-thumbnail__summary">{activeStoryline?.title ?? `\u6682\u65e0\u4e3b\u7ebf`}</div>
      <div className="cv-thumbnail__bars" aria-hidden="true">
        {snapshots.map((snapshot) => (
          <span
            key={`${snapshot.storyline_id}-${snapshot.bucket_index}`}
            className="cv-thumbnail__bar"
            style={{ height: `${Math.max(2, snapshot.storyline_heat_index * 16)}px` }}
          />
        ))}
      </div>
      <div className="cv-thumbnail__meta">
        {`${bundle.meta.analysis_window_start} - ${bundle.meta.analysis_window_end}`}
      </div>
    </div>
  );
}

function RelationshipThumbnail({
  bundle,
  relationshipScope
}: {
  bundle: PublishedBundle;
  relationshipScope: ScopedRelationshipState;
}) {
  const viewpointTitle =
    relationshipScope.displayViewpointId === null
      ? `\u5f53\u524d\u6863\u4e3b\u89c2\u70b9`
      : bundle.neural_map.viewpoints.find(
          (viewpoint) => viewpoint.viewpoint_id === relationshipScope.displayViewpointId
        )?.title ?? relationshipScope.displayViewpointId;

  return (
    <div className="cv-thumbnail">
      <div className="cv-thumbnail__head">
        <span className="cv-thumbnail__label">{`\u5173\u7cfb`}</span>
        <span className="cv-thumbnail__meta">
          {`${bundle.neural_map.viewpoint_relations.length} ${`\u6761\u5173\u7cfb`}`}
        </span>
      </div>
      <div className="cv-thumbnail__summary">{viewpointTitle}</div>
      <div className="cv-thumbnail__legend">
        <span className="cv-thumbnail__legend-line cv-thumbnail__legend-line--reinforce" />
        <span className="cv-thumbnail__legend-text">{`\u589e\u5f3a`}</span>
        <span className="cv-thumbnail__legend-line cv-thumbnail__legend-line--conflict" />
        <span className="cv-thumbnail__legend-text">{`\u7ade\u4e89`}</span>
        <span className="cv-thumbnail__legend-line cv-thumbnail__legend-line--forecast" />
        <span className="cv-thumbnail__legend-text">{`\u538b\u5236`}</span>
      </div>
      <div className="cv-thumbnail__meta">
        {relationshipScope.resolvedBucketIndex !== null
          ? `${`\u65f6\u95f4\u70b9`} T${relationshipScope.resolvedBucketIndex}`
          : `\u5168\u65f6\u6bb5`}
      </div>
    </div>
  );
}

function EvidenceThumbnail({
  evidenceScope
}: {
  evidenceScope: ScopedEvidenceState;
}) {
  const visibleClusters =
    evidenceScope.evidenceClusters.length > 0
      ? evidenceScope.evidenceClusters.slice(0, 3).map((cluster) => cluster.label)
      : [...new Set(evidenceScope.particles.map((particle) => particle.viewpoint_id))].slice(0, 3);

  return (
    <div className="cv-thumbnail">
      <div className="cv-thumbnail__head">
        <span className="cv-thumbnail__label">{`\u8bc1\u636e`}</span>
        <span className="cv-thumbnail__meta">
          {`${evidenceScope.evidenceClusters.length || visibleClusters.length} ${`\u4e2a\u7c07`}`}
        </span>
      </div>
      <div className="cv-thumbnail__chips">
        {visibleClusters.length > 0 ? (
          visibleClusters.map((label) => (
            <span key={label} className="cv-thumbnail__chip">
              {label}
            </span>
          ))
        ) : (
          <span className="cv-thumbnail__meta">{`\u5f53\u524d\u65f6\u95f4\u70b9\u65e0\u8bc1\u636e`}</span>
        )}
      </div>
      <div className="cv-thumbnail__meta">
        {evidenceScope.resolvedBucketIndex !== null
          ? `${`\u65f6\u95f4\u70b9`} T${evidenceScope.resolvedBucketIndex}`
          : `\u6700\u65b0\u65f6\u95f4\u70b9`}
      </div>
    </div>
  );
}

export function StatusThumbnails({
  bundle,
  focus,
  relationshipScope,
  evidenceScope,
  showRelationshipView = true,
  onPrimaryViewChange
}: StatusThumbnailsProps) {
  const items: Array<{ view: PrimaryViewKey; content: ReactNode }> = showRelationshipView
    ? [
        {
          view: "storylines",
          content: <StorylineThumbnail bundle={bundle} focus={focus} />
        },
        {
          view: "relationships",
          content: <RelationshipThumbnail bundle={bundle} relationshipScope={relationshipScope} />
        },
        {
          view: "evidence",
          content: <EvidenceThumbnail evidenceScope={evidenceScope} />
        }
      ]
    : [
        {
          view: "storylines",
          content: <StorylineThumbnail bundle={bundle} focus={focus} />
        },
        {
          view: "evidence",
          content: <EvidenceThumbnail evidenceScope={evidenceScope} />
        }
      ];

  const inactiveItems = items.filter((item) => item.view !== focus.activePrimaryView);

  return (
    <div className="workspace-thumbnails">
      <span className="workspace-thumbnails__label">{`\u5176\u4ed6\u89c6\u56fe`}</span>
      {inactiveItems.map((item) => (
        <button
          key={item.view}
          type="button"
          className="workspace-thumbnails__button"
          onClick={() => onPrimaryViewChange(item.view)}
        >
          {item.content}
        </button>
      ))}
    </div>
  );
}
