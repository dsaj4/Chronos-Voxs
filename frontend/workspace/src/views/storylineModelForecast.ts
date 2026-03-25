import {
  computeFitQuality,
  MODEL_DEFAULT_PARAMS,
  runModel,
  type FitQuality,
  type ModelParams
} from "../forecast/modelCalculations";
import {
  getPublishedReasoningForSeries,
  getStorylineForecastSeries
} from "../forecast/seriesModels";
import type { ForecastModelId, PublishedBundle } from "../loader/publishedTypes";

export interface StorylineForecastChartPoint {
  label: string;
  bucketIndex: number;
  actual: number | null;
  fitted: number | null;
  forecast: number | null;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  delta: number;
  isForecast: boolean;
}

export interface StorylineForecastViewModel {
  storylineId: string;
  storylineTitle: string;
  modelId: ForecastModelId;
  modelLabel: string;
  chartPoints: StorylineForecastChartPoint[];
  fitQuality: FitQuality | null;
  splitLabel: string | null;
  qualityLabel: string;
  qualityColor: string;
  reasoningText: string;
  confidenceNote: string | null;
  comparisonSummary: string | null;
}

function formatBucketLabel(bucketStart: string, granularity: PublishedBundle["meta"]["bucket_granularity"]) {
  if (!bucketStart) {
    return "-";
  }

  if (granularity === "hour") {
    return bucketStart.replace("T", " ").slice(5, 13);
  }

  if (granularity === "week") {
    return `W ${bucketStart.slice(5)}`;
  }

  return bucketStart.slice(5);
}

function getQualityLabel(grade: FitQuality["grade"]) {
  switch (grade) {
    case "excellent":
      return "\u62df\u5408\u6781\u4f73";
    case "good":
      return "\u62df\u5408\u826f\u597d";
    case "fair":
      return "\u62df\u5408\u4e00\u822c";
    default:
      return "\u62df\u5408\u504f\u5f31";
  }
}

function getQualityColor(grade: FitQuality["grade"]) {
  switch (grade) {
    case "excellent":
      return "var(--cv-reinforce)";
    case "good":
      return "var(--cv-focus)";
    case "fair":
      return "var(--cv-forecast)";
    default:
      return "var(--cv-conflict)";
  }
}

function areParamsEqual(left: ModelParams, right: ModelParams) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const leftRecord = left as unknown as Record<string, number>;
  const rightRecord = right as unknown as Record<string, number>;

  for (const key of keys) {
    if (Math.abs((leftRecord[key] ?? 0) - (rightRecord[key] ?? 0)) > 0.0001) {
      return false;
    }
  }

  return true;
}

export function createStorylineForecastViewModel(
  bundle: PublishedBundle,
  storylineId: string | null,
  modelId: ForecastModelId,
  params: ModelParams,
  forecastHorizon = 7
): StorylineForecastViewModel | null {
  const resolvedStorylineId = storylineId ?? bundle.stream.storylines[0]?.storyline_id ?? null;

  if (!resolvedStorylineId) {
    return null;
  }

  const storyline =
    bundle.stream.storylines.find((item) => item.storyline_id === resolvedStorylineId) ?? null;
  const snapshots = bundle.stream.storyline_snapshots
    .filter((snapshot) => snapshot.storyline_id === resolvedStorylineId)
    .sort((left, right) => left.bucket_index - right.bucket_index);

  if (!storyline || snapshots.length === 0) {
    return null;
  }

  const historicalData = snapshots.map((snapshot) => ({
    bucket_index: snapshot.bucket_index,
    heat_index: snapshot.storyline_heat_index
  }));
  const publishedSeries = getStorylineForecastSeries(bundle, resolvedStorylineId, modelId);
  const reasoning = getPublishedReasoningForSeries(bundle, resolvedStorylineId, modelId);
  const shouldUsePublishedSeries =
    publishedSeries !== null && areParamsEqual(params, MODEL_DEFAULT_PARAMS[modelId]);
  const modelResult = shouldUsePublishedSeries
    ? null
    : runModel({
        modelId,
        params,
        historicalData,
        forecastHorizon
      });
  const fitQuality = shouldUsePublishedSeries
    ? computeFitQuality(
        historicalData.map((point) => point.heat_index),
        publishedSeries.historical_points.map((point) => point.value)
      )
    : modelResult?.fitQuality ?? null;
  const chartPoints: StorylineForecastChartPoint[] = [];

  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];
    const publishedHistoricalPoint = publishedSeries?.historical_points[index] ?? null;
    const fittedValue = shouldUsePublishedSeries
      ? publishedHistoricalPoint?.value ?? snapshot.storyline_heat_index
      : modelResult?.historical[index]?.value ?? null;
    const forecastAnchorValue =
      index === snapshots.length - 1
        ? shouldUsePublishedSeries
          ? publishedHistoricalPoint?.value ?? snapshot.storyline_heat_index
          : modelResult?.historical[index]?.value ?? snapshot.storyline_heat_index
        : null;
    chartPoints.push({
      label: formatBucketLabel(snapshot.bucket_start, snapshot.bucket_granularity),
      bucketIndex: snapshot.bucket_index,
      actual: snapshot.storyline_heat_index,
      fitted: fittedValue,
      forecast: forecastAnchorValue,
      confidenceLow: forecastAnchorValue,
      confidenceHigh: forecastAnchorValue,
      delta: index === 0 ? 0 : snapshot.storyline_heat_index - snapshots[index - 1].storyline_heat_index,
      isForecast: false
    });
  }

  const forecastPoints = shouldUsePublishedSeries
    ? publishedSeries.forecast_points.map((point, index) => ({
        t: point.bucket_index,
        value: point.value,
        lower: point.confidence_low,
        upper: point.confidence_high,
        delta:
          index === 0
            ? point.value - (publishedSeries.historical_points.at(-1)?.value ?? point.value)
            : point.value - publishedSeries.forecast_points[index - 1]!.value,
        bucketStart: point.bucket_start,
        bucketGranularity: point.bucket_granularity
      }))
    : modelResult?.forecast.map((point) => ({
        ...point,
        bucketStart: "",
        bucketGranularity: bundle.meta.bucket_granularity
      })) ?? [];

  for (let index = 0; index < forecastPoints.length; index += 1) {
    const point = forecastPoints[index];
    chartPoints.push({
      label:
        shouldUsePublishedSeries && point.bucketStart
          ? formatBucketLabel(point.bucketStart, point.bucketGranularity)
          : `\u9884\u6d4b${index + 1}`,
      bucketIndex: point.t,
      actual: null,
      fitted: null,
      forecast: point.value,
      confidenceLow: point.lower ?? null,
      confidenceHigh: point.upper ?? null,
      delta: point.delta,
      isForecast: true
    });
  }

  return {
    storylineId: storyline.storyline_id,
    storylineTitle: storyline.title,
    modelId,
    modelLabel:
      bundle.meta.available_models.find((item) => item.id === modelId)?.label ??
      publishedSeries?.model_label ??
      modelId,
    chartPoints,
    fitQuality,
    splitLabel: chartPoints[snapshots.length - 1]?.label ?? null,
    qualityLabel: getQualityLabel((fitQuality ?? { grade: "poor" }).grade),
    qualityColor: getQualityColor((fitQuality ?? { grade: "poor" }).grade),
    reasoningText:
      reasoning?.explanation ??
      publishedSeries?.explanation ??
      "No published forecast explanation is available for this storyline.",
    confidenceNote: reasoning?.confidence_note ?? null,
    comparisonSummary: reasoning?.comparison_summary ?? null
  };
}
