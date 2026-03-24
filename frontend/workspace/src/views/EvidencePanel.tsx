import type { PublishedBundle } from "../loader/publishedTypes";
import { formatBucketStart } from "../forecast/seriesModels";
import type { ScopedEvidenceState } from "../state/focusSelectors";

interface EvidencePanelProps {
  bundle: PublishedBundle;
  scope: ScopedEvidenceState;
}

export function EvidencePanel({ bundle, scope }: EvidencePanelProps) {
  return (
    <section className="panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">证据视图</p>
          <h3>当前焦点的证据簇</h3>
        </div>
        {scope.resolvedBucketIndex !== null ? <span className="pill">桶 {scope.resolvedBucketIndex}</span> : null}
      </div>
      <p className="muted">
        {scope.fallbackMessage ?? "仅展示当前主线与当前时间桶的证据；如为空则回退到最近非空时间桶。"}
      </p>
      <div className="stack">
        <div className="mini-card">
          <strong>证据粒子</strong>
          <p className="muted">{scope.particles.length} 个粒子</p>
          {scope.particles.length ? (
            <ul className="compact-list">
              {scope.particles.map((particle) => (
                <li key={particle.particle_id}>
                  <strong>{formatBucketStart(particle.bucket_start, bundle.meta.bucket_granularity)}</strong>{" "}
                  {particle.signal_strength.toFixed(2)} {particle.excerpt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">当前焦点下没有粒子证据。</p>
          )}
        </div>
        <div className="mini-card">
          <strong>证据簇</strong>
          <p className="muted">{scope.evidenceClusters.length} 个证据簇</p>
          {scope.evidenceClusters.length ? (
            <ul className="compact-list">
              {scope.evidenceClusters.map((cluster) => (
                <li key={cluster.cluster_id}>
                  <strong>{cluster.label}</strong> {cluster.comment_ids.length} 条评论
                  <div className="muted">
                    代表评论 {cluster.representative_comment_id} ·{" "}
                    {formatBucketStart(cluster.bucket_start, bundle.meta.bucket_granularity)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">当前焦点下没有证据簇。</p>
          )}
        </div>
      </div>
    </section>
  );
}
