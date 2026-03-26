import type {
  PublishedBundle,
  PublishedStorylineForecastSeries,
  PublishedWorkspaceSession,
  WorkspaceBootstrap
} from "./publishedTypes";

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

function ensureWorkspaceSessionShape(value: unknown): asserts value is PublishedWorkspaceSession {
  if (!isRecord(value)) {
    throw new Error("Workspace session payload is not an object.");
  }
  for (const key of ["workspace_id", "analysis_id", "bundle_uri", "default_primary_view", "created_at"]) {
    if (typeof value[key] !== "string" || !value[key]) {
      throw new Error(`Workspace session is missing ${key}.`);
    }
  }
}

export function resolvePublishedBundleUrl(
  locationSearch = typeof window !== "undefined" ? window.location.search : "",
  defaultUrl = DEFAULT_BUNDLE_URL
): string {
  if (!locationSearch) {
    return defaultUrl;
  }

  const params = new URLSearchParams(locationSearch);
  const override = params.get("bundle")?.trim();
  return override || defaultUrl;
}

export function resolveWorkspaceSessionUrl(
  locationSearch = typeof window !== "undefined" ? window.location.search : ""
): string | null {
  if (!locationSearch) {
    return null;
  }

  const params = new URLSearchParams(locationSearch);
  const workspace = params.get("workspace")?.trim();
  return workspace || null;
}

export async function loadWorkspaceSession(url: string): Promise<PublishedWorkspaceSession> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load workspace session from ${url}: ${response.status} ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  ensureWorkspaceSessionShape(payload);
  return payload;
}

export async function loadPublishedBundle(
  url?: string,
  locationSearch = typeof window !== "undefined" ? window.location.search : ""
): Promise<PublishedBundle> {
  const workspaceUrl = !url ? resolveWorkspaceSessionUrl(locationSearch) : null;
  const resolvedUrl = workspaceUrl
    ? (await loadWorkspaceSession(workspaceUrl)).bundle_uri
    : (url ?? resolvePublishedBundleUrl(locationSearch));
  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to load published bundle from ${resolvedUrl}: ${response.status} ${response.statusText}`
    );
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
