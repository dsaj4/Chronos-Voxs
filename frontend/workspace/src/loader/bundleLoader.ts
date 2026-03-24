import type { PublishedBundle, PublishedStorylineForecastSeries, WorkspaceBootstrap } from "./publishedTypes";

const DEFAULT_BUNDLE_URL = "/bundles/golden-forecast-bundle.ai-agent-practicalization.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureBundleShape(value: unknown): asserts value is PublishedBundle {
  if (!isRecord(value)) {
    throw new Error("Published bundle payload is not an object.");
  }
  for (const key of ["meta", "stream", "neural_map", "particle_field", "reasoning"]) {
    if (!isRecord(value[key])) {
      throw new Error(`Published bundle is missing ${key}.`);
    }
  }
}

export async function loadPublishedBundle(url = DEFAULT_BUNDLE_URL): Promise<PublishedBundle> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load published bundle from ${url}: ${response.status} ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  ensureBundleShape(payload);
  return payload;
}

export function createWorkspaceBootstrap(bundle: PublishedBundle): WorkspaceBootstrap {
  const storylineIndex = new Map(bundle.stream.storylines.map((storyline) => [storyline.storyline_id, storyline]));
  const viewpointIndex = new Map(bundle.neural_map.viewpoints.map((viewpoint) => [viewpoint.viewpoint_id, viewpoint]));
  const forecastIndex = new Map<string, PublishedStorylineForecastSeries[]>();

  for (const series of bundle.stream.forecast_series) {
    const existing = forecastIndex.get(series.storyline_id) ?? [];
    existing.push(series);
    forecastIndex.set(series.storyline_id, existing);
  }

  for (const seriesList of forecastIndex.values()) {
    seriesList.sort((left, right) => left.model_label.localeCompare(right.model_label));
  }

  return {
    bundle,
    storylineIndex,
    forecastIndex,
    viewpointIndex
  };
}
