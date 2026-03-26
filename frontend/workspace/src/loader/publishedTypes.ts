export type ForecastModelId = "bass_diffusion" | "gompertz";

export interface PublishedModelDefinition {
  id: ForecastModelId;
  label: string;
  category: "diffusion" | "saturation";
  description: string;
}

export interface PublishedForecastPoint {
  bucket_index: number;
  bucket_start: string;
  bucket_granularity: "hour" | "day" | "week";
  value: number;
  confidence_low: number;
  confidence_high: number;
  confidence_score: number;
  is_forecast: boolean;
}

export interface PublishedStorylineForecastSeries {
  storyline_id: string;
  model_id: ForecastModelId;
  model_label: string;
  target_metric: "storylineHeatIndex";
  historical_points: PublishedForecastPoint[];
  forecast_points: PublishedForecastPoint[];
  explanation: string;
  metadata: Record<string, unknown>;
}

export interface PublishedStoryline {
  storyline_id: string;
  topic_tag: string;
  storyline_label: string;
  title: string;
  summary: string;
  summary_source: "llm";
  logic_status: "stable" | "emerging" | "contested";
  evidence_posture: "grounded" | "mixed" | "thin";
  support_count: number;
  viewpoint_count: number;
  comment_count: number;
  keywords: string[];
  display_rank: number;
  display_tier: "primary" | "secondary";
  metadata: Record<string, unknown>;
}

export interface PublishedViewpoint {
  viewpoint_id: string;
  topic_tag: string;
  viewpoint_label: string;
  title: string;
  claim_statement: string;
  summary: string;
  summary_source: "llm";
  summary_grounding_score: number;
  claim_ids: string[];
  comment_ids: string[];
  representative_claim_ids: string[];
  evidence_comment_ids: string[];
  support_count: number;
  unique_comment_count: number;
  keywords: string[];
  metadata: Record<string, unknown>;
}

export interface PublishedBundle {
  meta: {
    case_id: string;
    case_title: string;
    topic_tag: string;
    contract_version: string;
    fixture_id: string;
    generated_at: string;
    bucket_granularity: "hour" | "day" | "week";
    analysis_window_start: string;
    analysis_window_end: string;
    source_platforms: string[];
    default_model_id: ForecastModelId;
    available_models: PublishedModelDefinition[];
  };
  stream: {
    storylines: PublishedStoryline[];
    storyline_snapshots: Array<{
      snapshot_id: string;
      storyline_id: string;
      bucket_index: number;
      bucket_start: string;
      bucket_granularity: "hour" | "day" | "week";
      support_count: number;
      comment_count: number;
      viewpoint_ids: string[];
      storyline_heat_index: number;
      top_viewpoint_ids: string[];
      metadata: Record<string, unknown>;
    }>;
    forecast_series: PublishedStorylineForecastSeries[];
  };
  neural_map: {
    viewpoints: PublishedViewpoint[];
    viewpoint_snapshots: Array<{
      snapshot_id: string;
      viewpoint_id: string;
      bucket_index: number;
      bucket_start: string;
      bucket_granularity: "hour" | "day" | "week";
      support_count: number;
      unique_comment_count: number;
      heat_index: number;
      representative_claim_ids: string[];
      metadata: Record<string, unknown>;
    }>;
    viewpoint_relations: Array<{
      relation_id: string;
      source_viewpoint_id: string;
      target_viewpoint_id: string;
      relation_type: "reinforces" | "competes_with" | "constrains" | "depends_on" | "qualifies";
      weight: number;
      evidence_claim_ids: string[];
      rationale: string;
      metadata: Record<string, unknown>;
    }>;
    storyline_relations: Array<{
      relation_id: string;
      source_storyline_id: string;
      target_storyline_id: string;
      relation_type: "reinforces" | "competes_with" | "constrains" | "depends_on" | "qualifies";
      weight: number;
      evidence_viewpoint_ids: string[];
      rationale: string;
      metadata: Record<string, unknown>;
    }>;
  };
  particle_field: {
    particles: Array<{
      particle_id: string;
      storyline_id: string;
      viewpoint_id: string;
      claim_id: string;
      comment_id: string;
      bucket_index: number;
      bucket_start: string;
      signal_strength: number;
      excerpt: string;
    }>;
    evidence_clusters: Array<{
      cluster_id: string;
      storyline_id: string;
      viewpoint_id: string;
      bucket_index: number;
      bucket_start: string;
      label: string;
      comment_ids: string[];
      representative_comment_id: string;
    }>;
  };
  reasoning: {
    heat_index_formula: {
      version: string;
      target_metric: "storylineHeatIndex";
      weights: Record<string, number>;
      description: string;
    };
    model_reasoning: Array<{
      storyline_id: string;
      model_id: ForecastModelId;
      assumptions: string[];
      explanation: string;
      confidence_note: string;
      comparison_summary: string;
    }>;
    traceability: Array<{
      storyline_id: string;
      viewpoint_ids: string[];
      claim_ids: string[];
      comment_ids: string[];
    }>;
  };
}

export interface PublishedWorkspaceSession {
  workspace_id: string;
  analysis_id: string;
  bundle_uri: string;
  default_primary_view: string;
  created_at: string;
}

export interface WorkspaceBootstrap {
  bundle: PublishedBundle;
  storylineIndex: Map<string, PublishedStoryline>;
  forecastIndex: Map<string, PublishedStorylineForecastSeries[]>;
  viewpointIndex: Map<string, PublishedViewpoint>;
}
