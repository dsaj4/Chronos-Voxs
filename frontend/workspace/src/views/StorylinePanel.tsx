import type { ForecastModelId, PublishedBundle, PublishedStoryline } from "../loader/publishedTypes";
import { ForecastSeriesTable } from "../components/ForecastSeriesTable";
import { ModelSwitcher } from "../components/ModelSwitcher";
import { formatBucketStart, getPublishedForecastSummary, getPublishedReasoningForSeries, getPublishedTraceability } from "../forecast/seriesModels";
import { StatusPill } from "../components/StatusPill";

interface StorylinePanelProps {
  bundle: PublishedBundle;
  storyline: PublishedStoryline | null;
  selectedModelId: ForecastModelId;
  onModelChange: (modelId: ForecastModelId) => void;
}

export function StorylinePanel({ bundle, storyline, selectedModelId, onModelChange }: StorylinePanelProps) {
  if (!storyline) {
    return <div className="empty-state">请选择一条主线查看预测序列。</div>;
  }

  const reasoning = getPublishedReasoningForSeries(bundle, storyline.storyline_id, selectedModelId);
  const traceability = getPublishedTraceability(bundle, storyline.storyline_id);
  const latestSnapshot = getPublishedForecastSummary(bundle, storyline.storyline_id);
  const availableModels = bundle.meta.available_models;
  const activeStorylineId = storyline.storyline_id;

  return (
    <section className="panel panel--storyline">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">主线视图</p>
          <h2>{storyline.title}</h2>
        </div>
        <StatusPill label="显示顺位" value={`#${storyline.display_rank}`} />
      </div>
      <p className="lead">{storyline.summary}</p>
      <div className="panel__meta">
        <StatusPill label="逻辑状态" value={storyline.logic_status} />
        <StatusPill label="证据姿态" value={storyline.evidence_posture} />
        <StatusPill label="主题" value={storyline.topic_tag} />
      </div>
      <div className="panel__section">
        <div className="panel__section-header">
          <h3>预测模型</h3>
          <span className="muted">切换模型只会改变未来段展示，不改历史段。</span>
        </div>
        <ModelSwitcher models={availableModels} selectedModelId={selectedModelId} onSelect={onModelChange} />
      </div>
      <div className="panel__section">
        <div className="panel__section-header">
          <h3>已发布预测</h3>
          {latestSnapshot ? (
            <span className="pill">
              {formatBucketStart(latestSnapshot.bucket_start, latestSnapshot.bucket_granularity)} · 桶 {latestSnapshot.bucket_index}
            </span>
          ) : null}
        </div>
        <ForecastSeriesTable
          series={
            bundle.stream.forecast_series.find(
              (series) => series.storyline_id === activeStorylineId && series.model_id === selectedModelId
            ) ?? null
          }
        />
      </div>
      <div className="panel__section panel__section--grid">
        <div className="mini-card">
          <p className="eyebrow">模型说明</p>
          <p>{reasoning?.explanation ?? "当前模型暂无已发布说明。"}</p>
          {reasoning ? <p className="muted">{reasoning.confidence_note}</p> : null}
        </div>
        <div className="mini-card">
          <p className="eyebrow">追溯</p>
          <p className="muted">
            {traceability
              ? `${traceability.viewpoint_ids.length} 个观点 · ${traceability.claim_ids.length} 条 Claim · ${traceability.comment_ids.length} 条评论`
              : "当前主线暂无追溯记录。"}
          </p>
          {traceability ? <p>{traceability.viewpoint_ids.join(", ")}</p> : null}
        </div>
      </div>
    </section>
  );
}
