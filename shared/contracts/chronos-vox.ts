export type ContractVersion = "2026-03-24.v1";
export type BucketGranularity = "hour" | "day" | "week";
export type Platform = "bilibili" | "xiaohongshu" | "zhihu" | "weibo" | "other";
export type SourceClass = "practitioner" | "consumer" | "media" | "vendor" | "unknown";
export type Stance = "support" | "oppose" | "mixed" | "observe";
export type RelationType =
  | "reinforces"
  | "competes_with"
  | "constrains"
  | "depends_on"
  | "qualifies";
export type MembershipRole = "core" | "supporting" | "emerging";
export type LogicStatus = "stable" | "emerging" | "contested";
export type EvidencePosture = "grounded" | "mixed" | "thin";
export type ForecastModelId = "bass_diffusion" | "gompertz";
export type AuditTaskKind = "claim_extraction" | "viewpoint_summary" | "storyline_summary";

export interface EngagementStats {
  like_count: number;
  reply_count: number;
  share_count: number;
}

export interface ModelDefinition {
  id: ForecastModelId;
  label: string;
  category: "diffusion" | "saturation";
  description: string;
}

export interface RawComment {
  raw_comment_id: string;
  platform: Platform;
  source_item_id: string;
  source_comment_id: string;
  author_handle?: string;
  text: string;
  created_at: string;
  collected_at: string;
  engagement: EngagementStats;
  metadata: Record<string, unknown>;
}

export interface NormalizedComment {
  comment_id: string;
  raw_comment_id: string;
  platform: Platform;
  source_item_id: string;
  source_comment_id: string;
  canonical_text: string;
  normalized_text: string;
  language: string;
  source_class: SourceClass;
  quality_score: number;
  noise_flags: string[];
  dedupe_key: string;
  created_at: string;
  collected_at: string;
  topic_tags: string[];
  metadata: Record<string, unknown>;
}

export interface ClaimCandidateSpan {
  span_id: string;
  comment_id: string;
  text: string;
  start_char: number;
  end_char: number;
  heuristic_labels: string[];
  candidate_score: number;
  metadata: Record<string, unknown>;
}

export interface ExtractorRef {
  provider: string;
  model: string;
  prompt_version: string;
  run_id: string;
}

export interface Claim {
  claim_id: string;
  comment_id: string;
  span_id: string;
  text: string;
  evidence_text: string;
  evidence_start: number;
  evidence_end: number;
  created_at: string;
  extractor: ExtractorRef;
  extractor_confidence: number;
  stance: Stance;
  topic_tags: string[];
  source_class: SourceClass;
  signal_strength: number;
  llm_audit_id: string;
  metadata: Record<string, unknown>;
}

export interface Viewpoint {
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

export interface ViewpointSnapshot {
  snapshot_id: string;
  viewpoint_id: string;
  bucket_index: number;
  bucket_start: string;
  bucket_granularity: BucketGranularity;
  support_count: number;
  unique_comment_count: number;
  heat_index: number;
  representative_claim_ids: string[];
  metadata: Record<string, unknown>;
}

export interface ViewpointRelation {
  relation_id: string;
  source_viewpoint_id: string;
  target_viewpoint_id: string;
  relation_type: RelationType;
  weight: number;
  evidence_claim_ids: string[];
  rationale: string;
  metadata: Record<string, unknown>;
}

export interface Storyline {
  storyline_id: string;
  topic_tag: string;
  storyline_label: string;
  title: string;
  summary: string;
  summary_source: "llm";
  logic_status: LogicStatus;
  evidence_posture: EvidencePosture;
  support_count: number;
  viewpoint_count: number;
  comment_count: number;
  keywords: string[];
  display_rank: number;
  display_tier: "primary" | "secondary";
  metadata: Record<string, unknown>;
}

export interface StorylineMembership {
  membership_id: string;
  storyline_id: string;
  viewpoint_id: string;
  role: MembershipRole;
  weight: number;
  start_bucket_index: number;
  end_bucket_index: number | null;
  metadata: Record<string, unknown>;
}

export interface StorylineSnapshot {
  snapshot_id: string;
  storyline_id: string;
  bucket_index: number;
  bucket_start: string;
  bucket_granularity: BucketGranularity;
  support_count: number;
  comment_count: number;
  viewpoint_ids: string[];
  storyline_heat_index: number;
  top_viewpoint_ids: string[];
  metadata: Record<string, unknown>;
}

export interface StorylineRelation {
  relation_id: string;
  source_storyline_id: string;
  target_storyline_id: string;
  relation_type: RelationType;
  weight: number;
  evidence_viewpoint_ids: string[];
  rationale: string;
  metadata: Record<string, unknown>;
}

export interface ForecastPoint {
  bucket_index: number;
  bucket_start: string;
  bucket_granularity: BucketGranularity;
  value: number;
  confidence_low: number;
  confidence_high: number;
  confidence_score: number;
  is_forecast: boolean;
}

export interface StorylineForecastSeries {
  storyline_id: string;
  model_id: ForecastModelId;
  model_label: string;
  target_metric: "storylineHeatIndex";
  historical_points: ForecastPoint[];
  forecast_points: ForecastPoint[];
  explanation: string;
  metadata: Record<string, unknown>;
}

export interface LlmAuditEntry {
  audit_id: string;
  task_kind: AuditTaskKind;
  provider: string;
  model: string;
  prompt_version: string;
  input_hash: string;
  status: "success" | "retry" | "fallback";
  cache_hit: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface AnalysisDiagnostics {
  raw_comment_count: number;
  normalized_comment_count: number;
  candidate_span_count: number;
  accepted_claim_count: number;
  rejected_candidate_count: number;
  llm_cache_hits: number;
}

export interface AnalysisState {
  analysis_id: string;
  case_id: string;
  contract_version: ContractVersion;
  bucket_granularity: BucketGranularity;
  generated_at: string;
  raw_comments: RawComment[];
  normalized_comments: NormalizedComment[];
  claim_candidate_spans: ClaimCandidateSpan[];
  claims: Claim[];
  viewpoints: Viewpoint[];
  viewpoint_snapshots: ViewpointSnapshot[];
  viewpoint_relations: ViewpointRelation[];
  storylines: Storyline[];
  storyline_memberships: StorylineMembership[];
  storyline_snapshots: StorylineSnapshot[];
  storyline_relations: StorylineRelation[];
  storyline_forecasts: StorylineForecastSeries[];
  llm_audit_log: LlmAuditEntry[];
  diagnostics: AnalysisDiagnostics;
}

export interface BundleMeta {
  case_id: string;
  case_title: string;
  topic_tag: string;
  contract_version: ContractVersion;
  fixture_id: string;
  generated_at: string;
  bucket_granularity: BucketGranularity;
  analysis_window_start: string;
  analysis_window_end: string;
  source_platforms: Platform[];
  default_model_id: ForecastModelId;
  available_models: ModelDefinition[];
}

export interface StreamPayload {
  storylines: Storyline[];
  storyline_snapshots: StorylineSnapshot[];
  forecast_series: StorylineForecastSeries[];
}

export interface EvidenceParticle {
  particle_id: string;
  storyline_id: string;
  viewpoint_id: string;
  claim_id: string;
  comment_id: string;
  bucket_index: number;
  bucket_start: string;
  signal_strength: number;
  excerpt: string;
}

export interface EvidenceCluster {
  cluster_id: string;
  storyline_id: string;
  viewpoint_id: string;
  bucket_index: number;
  bucket_start: string;
  label: string;
  comment_ids: string[];
  representative_comment_id: string;
}

export interface ParticleFieldPayload {
  particles: EvidenceParticle[];
  evidence_clusters: EvidenceCluster[];
}

export interface HeatIndexFormula {
  version: string;
  target_metric: "storylineHeatIndex";
  weights: {
    volume_component: number;
    support_component: number;
    source_quality_component: number;
    recency_component: number;
  };
  description: string;
}

export interface ModelReasoning {
  storyline_id: string;
  model_id: ForecastModelId;
  assumptions: string[];
  explanation: string;
  confidence_note: string;
  comparison_summary: string;
}

export interface TraceabilityRecord {
  storyline_id: string;
  viewpoint_ids: string[];
  claim_ids: string[];
  comment_ids: string[];
}

export interface ReasoningPayload {
  heat_index_formula: HeatIndexFormula;
  model_reasoning: ModelReasoning[];
  traceability: TraceabilityRecord[];
}

export interface ForecastBundle {
  meta: BundleMeta;
  stream: StreamPayload;
  neural_map: {
    viewpoints: Viewpoint[];
    viewpoint_snapshots: ViewpointSnapshot[];
    viewpoint_relations: ViewpointRelation[];
    storyline_relations: StorylineRelation[];
  };
  particle_field: ParticleFieldPayload;
  reasoning: ReasoningPayload;
}
