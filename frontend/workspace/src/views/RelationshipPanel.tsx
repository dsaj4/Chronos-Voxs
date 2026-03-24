import type { PublishedBundle } from "../loader/publishedTypes";
import { formatBucketStart } from "../forecast/seriesModels";
import type { WorkspaceFocusState } from "../state/focusState";
import type { ScopedRelationshipState } from "../state/focusSelectors";

interface RelationshipPanelProps {
  bundle: PublishedBundle;
  focus: WorkspaceFocusState;
  scope: ScopedRelationshipState;
}

export function RelationshipPanel({ bundle, focus, scope }: RelationshipPanelProps) {
  const storyline =
    bundle.stream.storylines.find((item) => item.storyline_id === scope.storylineId) ?? null;
  const highlightedViewpoint =
    bundle.neural_map.viewpoints.find((item) => item.viewpoint_id === scope.highlightedViewpointId) ?? null;
  const relationCount = scope.viewpointRelations.length + scope.storylineRelations.length;

  return (
    <section className="panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">关系视图</p>
          <h3>当前主线的关系上下文</h3>
        </div>
        {scope.resolvedBucketIndex !== null ? <span className="pill">桶 {scope.resolvedBucketIndex}</span> : null}
      </div>
      <p className="muted">
        {scope.fallbackMessage ??
          "仅展示当前主线与当前时间桶相关的关系；如果该桶为空，则回退到最近的非空时间桶。"}
      </p>
      <div className="panel__meta">
        {storyline ? <span className="pill">{storyline.title}</span> : null}
        {highlightedViewpoint ? <span className="pill">焦点观点：{highlightedViewpoint.title}</span> : null}
        {scope.resolvedBucketStart ? (
          <span className="pill">
            {formatBucketStart(scope.resolvedBucketStart, bundle.meta.bucket_granularity)}
          </span>
        ) : null}
        <span className="pill">{relationCount} 条关系</span>
        <span className="pill">模型 {focus.selectedModelId}</span>
      </div>
      <div className="stack">
        <div className="mini-card">
          <strong>观点关系</strong>
          <p className="muted">{scope.viewpointRelations.length} 条与当前时间桶直接相关</p>
          {scope.viewpointRelations.length ? (
            <ul className="compact-list">
              {scope.viewpointRelations.map((relation) => (
                <li key={relation.relation_id}>
                  <strong>
                    {relation.source_viewpoint_id === scope.highlightedViewpointId
                      ? "当前观点"
                      : relation.source_viewpoint_id}
                  </strong>{" "}
                  {relation.relation_type}{" "}
                  <strong>
                    {relation.target_viewpoint_id === scope.highlightedViewpointId
                      ? "当前观点"
                      : relation.target_viewpoint_id}
                  </strong>
                  <div className="muted">{relation.rationale}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">当前时间桶没有可展示的观点关系。</p>
          )}
        </div>
        <div className="mini-card">
          <strong>主线关系</strong>
          <p className="muted">{scope.storylineRelations.length} 条与当前主线相关</p>
          {scope.storylineRelations.length ? (
            <ul className="compact-list">
              {scope.storylineRelations.map((relation) => (
                <li key={relation.relation_id}>
                  <strong>
                    {relation.source_storyline_id === scope.storylineId
                      ? storyline?.title ?? relation.source_storyline_id
                      : relation.source_storyline_id}
                  </strong>{" "}
                  {relation.relation_type}{" "}
                  <strong>
                    {relation.target_storyline_id === scope.storylineId
                      ? storyline?.title ?? relation.target_storyline_id
                      : relation.target_storyline_id}
                  </strong>
                  <div className="muted">{relation.rationale}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">当前主线暂无额外的主线关系说明。</p>
          )}
        </div>
      </div>
    </section>
  );
}
