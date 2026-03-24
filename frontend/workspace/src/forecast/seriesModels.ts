import type {
  ForecastModelId,
  PublishedBundle,
  PublishedForecastPoint,
  PublishedStorylineForecastSeries
} from "../loader/publishedTypes";

export interface StorylineForecastSelection {
  storylineId: string;
  selectedModelId: ForecastModelId;
  availableModels: PublishedStorylineForecastSeries[];
  activeSeries: PublishedStorylineForecastSeries | null;
  comparisonSeries: PublishedStorylineForecastSeries | null;
  combinedPoints: PublishedForecastPoint[];
  reasonText: string;
}

export function formatBucketStart(
  bucketStart: string,
  bucketGranularity: PublishedForecastPoint["bucket_granularity"]
): string {
  if (!bucketStart) {
    return "未定义";
  }
  if (bucketGranularity !== "hour") {
    return bucketStart;
  }
  return bucketStart.replace("T", " ").replace(/:\d{2}(?:\.\d+)?$/, "");
}

export function getStorylineForecastSeries(
  bundle: PublishedBundle,
  storylineId: string,
  modelId: ForecastModelId
): PublishedStorylineForecastSeries | null {
  return bundle.stream.forecast_series.find((series) => series.storyline_id === storylineId && series.model_id === modelId) ?? null;
}

export function getAvailableStorylineForecastSeries(
  bundle: PublishedBundle,
  storylineId: string
): PublishedStorylineForecastSeries[] {
  return bundle.stream.forecast_series.filter((series) => series.storyline_id === storylineId);
}

export function createStorylineForecastSelection(
  bundle: PublishedBundle,
  storylineId: string | null,
  modelId: ForecastModelId
): StorylineForecastSelection {
  const fallbackStorylineId = storylineId ?? bundle.stream.storylines[0]?.storyline_id ?? "";
  const availableModels = getAvailableStorylineForecastSeries(bundle, fallbackStorylineId);
  const activeSeries = getStorylineForecastSeries(bundle, fallbackStorylineId, modelId) ?? availableModels[0] ?? null;
  const comparisonSeries = availableModels.find((series) => series.model_id !== activeSeries?.model_id) ?? null;

  return {
    storylineId: fallbackStorylineId,
    selectedModelId: activeSeries?.model_id ?? modelId,
    availableModels,
    activeSeries,
    comparisonSeries,
    combinedPoints: activeSeries ? [...activeSeries.historical_points, ...activeSeries.forecast_points] : [],
    reasonText: activeSeries?.explanation ?? "No published forecast series is available for the selected storyline."
  };
}

export function getPublishedReasoningForSeries(bundle: PublishedBundle, storylineId: string, modelId: ForecastModelId) {
  return (
    bundle.reasoning.model_reasoning.find(
      (entry) => entry.storyline_id === storylineId && entry.model_id === modelId
    ) ?? null
  );
}

export function getPublishedTraceability(bundle: PublishedBundle, storylineId: string) {
  return bundle.reasoning.traceability.find((entry) => entry.storyline_id === storylineId) ?? null;
}

export function getPublishedForecastSummary(bundle: PublishedBundle, storylineId: string) {
  const snapshots = bundle.stream.storyline_snapshots
    .filter((snapshot) => snapshot.storyline_id === storylineId)
    .sort((left, right) => left.bucket_index - right.bucket_index);
  return snapshots.at(-1) ?? null;
}
