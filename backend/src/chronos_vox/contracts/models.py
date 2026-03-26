"""Typed contract mirrors for the Chronos-Vox semantic pipeline."""

from typing import Literal, NotRequired, TypedDict

ContractVersion = Literal["2026-03-24.v1"]
BucketGranularity = Literal["hour", "day", "week"]
Platform = Literal["bilibili", "xiaohongshu", "zhihu", "weibo", "other"]
SourceClass = Literal["practitioner", "consumer", "media", "vendor", "unknown"]
Stance = Literal["support", "oppose", "mixed", "observe"]
RelationType = Literal[
    "reinforces",
    "competes_with",
    "constrains",
    "depends_on",
    "qualifies",
]
MembershipRole = Literal["core", "supporting", "emerging"]
LogicStatus = Literal["stable", "emerging", "contested"]
EvidencePosture = Literal["grounded", "mixed", "thin"]
ForecastModelId = Literal["bass_diffusion", "gompertz"]
AuditTaskKind = Literal["claim_extraction", "viewpoint_summary", "storyline_summary"]


class EngagementStats(TypedDict):
    like_count: int
    reply_count: int
    share_count: int


class ModelDefinition(TypedDict):
    id: ForecastModelId
    label: str
    category: Literal["diffusion", "saturation"]
    description: str


class RawComment(TypedDict):
    raw_comment_id: str
    platform: Platform
    source_item_id: str
    source_comment_id: str
    text: str
    created_at: str
    collected_at: str
    engagement: EngagementStats
    metadata: dict[str, object]
    author_handle: NotRequired[str]


class NormalizedComment(TypedDict):
    comment_id: str
    raw_comment_id: str
    platform: Platform
    source_item_id: str
    source_comment_id: str
    canonical_text: str
    normalized_text: str
    language: str
    source_class: SourceClass
    quality_score: float
    noise_flags: list[str]
    dedupe_key: str
    created_at: str
    collected_at: str
    topic_tags: list[str]
    metadata: dict[str, object]


class ClaimCandidateSpan(TypedDict):
    span_id: str
    comment_id: str
    text: str
    start_char: int
    end_char: int
    heuristic_labels: list[str]
    candidate_score: float
    metadata: dict[str, object]


class ExtractorRef(TypedDict):
    provider: str
    model: str
    prompt_version: str
    run_id: str


class Claim(TypedDict):
    claim_id: str
    comment_id: str
    span_id: str
    text: str
    evidence_text: str
    evidence_start: int
    evidence_end: int
    created_at: str
    extractor: ExtractorRef
    extractor_confidence: float
    stance: Stance
    topic_tags: list[str]
    source_class: SourceClass
    signal_strength: float
    llm_audit_id: str
    metadata: dict[str, object]


class Viewpoint(TypedDict):
    viewpoint_id: str
    topic_tag: str
    viewpoint_label: str
    title: str
    claim_statement: str
    summary: str
    summary_source: Literal["llm"]
    summary_grounding_score: float
    claim_ids: list[str]
    comment_ids: list[str]
    representative_claim_ids: list[str]
    evidence_comment_ids: list[str]
    support_count: int
    unique_comment_count: int
    keywords: list[str]
    metadata: dict[str, object]


class ViewpointSnapshot(TypedDict):
    snapshot_id: str
    viewpoint_id: str
    bucket_index: int
    bucket_start: str
    bucket_granularity: BucketGranularity
    support_count: int
    unique_comment_count: int
    heat_index: float
    representative_claim_ids: list[str]
    metadata: dict[str, object]


class ViewpointRelation(TypedDict):
    relation_id: str
    source_viewpoint_id: str
    target_viewpoint_id: str
    relation_type: RelationType
    weight: float
    evidence_claim_ids: list[str]
    rationale: str
    metadata: dict[str, object]


class Storyline(TypedDict):
    storyline_id: str
    topic_tag: str
    storyline_label: str
    title: str
    summary: str
    summary_source: Literal["llm"]
    logic_status: LogicStatus
    evidence_posture: EvidencePosture
    support_count: int
    viewpoint_count: int
    comment_count: int
    keywords: list[str]
    display_rank: int
    display_tier: Literal["primary", "secondary"]
    metadata: dict[str, object]


class StorylineMembership(TypedDict):
    membership_id: str
    storyline_id: str
    viewpoint_id: str
    role: MembershipRole
    weight: float
    start_bucket_index: int
    end_bucket_index: int | None
    metadata: dict[str, object]


class StorylineSnapshot(TypedDict):
    snapshot_id: str
    storyline_id: str
    bucket_index: int
    bucket_start: str
    bucket_granularity: BucketGranularity
    support_count: int
    comment_count: int
    viewpoint_ids: list[str]
    storyline_heat_index: float
    top_viewpoint_ids: list[str]
    metadata: dict[str, object]


class StorylineRelation(TypedDict):
    relation_id: str
    source_storyline_id: str
    target_storyline_id: str
    relation_type: RelationType
    weight: float
    evidence_viewpoint_ids: list[str]
    rationale: str
    metadata: dict[str, object]


class ForecastPoint(TypedDict):
    bucket_index: int
    bucket_start: str
    bucket_granularity: BucketGranularity
    value: float
    confidence_low: float
    confidence_high: float
    confidence_score: float
    is_forecast: bool


class StorylineForecastSeries(TypedDict):
    storyline_id: str
    model_id: ForecastModelId
    model_label: str
    target_metric: Literal["storylineHeatIndex"]
    historical_points: list[ForecastPoint]
    forecast_points: list[ForecastPoint]
    explanation: str
    metadata: dict[str, object]


class LlmAuditEntry(TypedDict):
    audit_id: str
    task_kind: AuditTaskKind
    provider: str
    model: str
    prompt_version: str
    input_hash: str
    status: Literal["success", "retry", "fallback"]
    cache_hit: bool
    created_at: str
    metadata: dict[str, object]


class AnalysisDiagnostics(TypedDict):
    raw_comment_count: int
    normalized_comment_count: int
    candidate_span_count: int
    accepted_claim_count: int
    rejected_candidate_count: int
    llm_cache_hits: int
    claim_batch_count: NotRequired[int]
    claim_serialized_char_count: NotRequired[int]
    claim_estimated_input_tokens: NotRequired[int]
    claim_estimated_output_tokens: NotRequired[int]
    claim_retry_count: NotRequired[int]
    claim_fallback_batch_count: NotRequired[int]


class AnalysisState(TypedDict):
    analysis_id: str
    case_id: str
    contract_version: ContractVersion
    bucket_granularity: BucketGranularity
    generated_at: str
    raw_comments: list[RawComment]
    normalized_comments: list[NormalizedComment]
    claim_candidate_spans: list[ClaimCandidateSpan]
    claims: list[Claim]
    viewpoints: list[Viewpoint]
    viewpoint_snapshots: list[ViewpointSnapshot]
    viewpoint_relations: list[ViewpointRelation]
    storylines: list[Storyline]
    storyline_memberships: list[StorylineMembership]
    storyline_snapshots: list[StorylineSnapshot]
    storyline_relations: list[StorylineRelation]
    storyline_forecasts: list[StorylineForecastSeries]
    llm_audit_log: list[LlmAuditEntry]
    diagnostics: AnalysisDiagnostics
