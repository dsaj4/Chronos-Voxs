import type { PublishedStorylineForecastSeries } from "../loader/publishedTypes";
import { formatBucketStart } from "../forecast/seriesModels";

interface ForecastSeriesTableProps {
  series: PublishedStorylineForecastSeries | null;
}

export function ForecastSeriesTable({ series }: ForecastSeriesTableProps) {
  if (!series) {
    return <div className="empty-state">当前主线没有可展示的预测序列。</div>;
  }

  const allPoints = [...series.historical_points, ...series.forecast_points];

  return (
    <div className="forecast-table">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">预测序列</p>
          <h3>{series.model_label}</h3>
        </div>
        <span className="pill">{series.target_metric}</span>
      </div>
      <p className="muted">{series.explanation}</p>
      <div className="forecast-table__rows">
        {allPoints.map((point) => (
          <div key={`${series.model_id}-${point.bucket_index}-${point.bucket_start}`} className={`forecast-row ${point.is_forecast ? "forecast-row--future" : ""}`}>
            <div>
              <strong>{formatBucketStart(point.bucket_start, point.bucket_granularity)}</strong>
              <div className="muted">桶 {point.bucket_index}</div>
            </div>
            <div className="forecast-row__value">
              <strong>{point.value}</strong>
              <span className="muted">
                {point.confidence_low} - {point.confidence_high}
              </span>
            </div>
            <div className="forecast-row__confidence">{Math.round(point.confidence_score * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
