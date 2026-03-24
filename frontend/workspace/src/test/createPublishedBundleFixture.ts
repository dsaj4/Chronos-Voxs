import type { ForecastModelId, PublishedBundle, PublishedForecastPoint } from "../loader/publishedTypes";

function point(
  bucket_index: number,
  bucket_start: string,
  value: number,
  is_forecast: boolean,
  confidence_score = 1
): PublishedForecastPoint {
  return {
    bucket_index,
    bucket_start,
    bucket_granularity: "day",
    value,
    confidence_low: is_forecast ? Math.max(0, value - 6) : value,
    confidence_high: is_forecast ? Math.min(100, value + 6) : value,
    confidence_score,
    is_forecast
  };
}

function reasoning(storyline_id: string, model_id: ForecastModelId, explanation: string) {
  return {
    storyline_id,
    model_id,
    assumptions:
      model_id === "bass_diffusion"
        ? ["流程接入继续扩散", "系统集成节点继续增加"]
        : ["摩擦不会立刻消失", "增长会更快进入平台期"],
    explanation,
    confidence_note:
      model_id === "bass_diffusion"
        ? "当前证据较扎实，但越往后预测不确定性会逐步上升。"
        : "当前证据仍在收敛，未来桶的不确定性明显更高。",
    comparison_summary:
      model_id === "bass_diffusion"
        ? "Bass 相比 Gompertz 更乐观，认为扩散速度还没有触顶。"
        : "Gompertz 相比 Bass 更保守，认为热度会更早趋稳。"
  };
}

export function createPublishedBundleFixture(): PublishedBundle {
  return {
    meta: {
      case_id: "fixture_case",
      case_title: "AI Agent Fixture Case",
      topic_tag: "fixture_topic",
      contract_version: "2026-03-24.v1",
      fixture_id: "fixture-bundle-v2",
      generated_at: "2026-03-24T12:30:00Z",
      bucket_granularity: "day",
      analysis_window_start: "2026-03-10",
      analysis_window_end: "2026-03-12",
      source_platforms: ["bilibili", "zhihu"],
      default_model_id: "bass_diffusion",
      available_models: [
        {
          id: "bass_diffusion",
          label: "Bass Diffusion",
          category: "diffusion",
          description: "Diffusion-oriented model."
        },
        {
          id: "gompertz",
          label: "Gompertz",
          category: "saturation",
          description: "Saturation-oriented model."
        }
      ]
    },
    stream: {
      storylines: [
        {
          storyline_id: "st_001",
          topic_tag: "fixture_topic",
          storyline_label: "务实落地线",
          title: "AI Agent 正向工作流与系统集成落地收敛",
          summary: "Agent 正沿流程接入与系统集成加速落地，正向叙事正在收敛。",
          summary_source: "llm",
          logic_status: "stable",
          evidence_posture: "grounded",
          support_count: 5,
          viewpoint_count: 2,
          comment_count: 4,
          keywords: ["workflow", "integration"],
          display_rank: 1,
          display_tier: "primary",
          metadata: {}
        },
        {
          storyline_id: "st_002",
          topic_tag: "fixture_topic",
          storyline_label: "部署摩擦线",
          title: "成本与维护压力仍在压制 Agent 部署",
          summary: "deploy、权限与维护复杂度仍在持续压制 Agent 扩张。",
          summary_source: "llm",
          logic_status: "emerging",
          evidence_posture: "grounded",
          support_count: 1,
          viewpoint_count: 1,
          comment_count: 1,
          keywords: ["cost", "ops"],
          display_rank: 2,
          display_tier: "secondary",
          metadata: {}
        }
      ],
      storyline_snapshots: [
        {
          snapshot_id: "st_snap_001",
          storyline_id: "st_001",
          bucket_index: 0,
          bucket_start: "2026-03-10",
          bucket_granularity: "day",
          support_count: 2,
          comment_count: 1,
          viewpoint_ids: ["vp_001"],
          storyline_heat_index: 42,
          top_viewpoint_ids: ["vp_001"],
          metadata: {}
        },
        {
          snapshot_id: "st_snap_002",
          storyline_id: "st_001",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          bucket_granularity: "day",
          support_count: 5,
          comment_count: 3,
          viewpoint_ids: ["vp_001", "vp_003"],
          storyline_heat_index: 72,
          top_viewpoint_ids: ["vp_003", "vp_001"],
          metadata: {}
        },
        {
          snapshot_id: "st_snap_003",
          storyline_id: "st_002",
          bucket_index: 0,
          bucket_start: "2026-03-10",
          bucket_granularity: "day",
          support_count: 0,
          comment_count: 0,
          viewpoint_ids: [],
          storyline_heat_index: 11,
          top_viewpoint_ids: [],
          metadata: {}
        },
        {
          snapshot_id: "st_snap_004",
          storyline_id: "st_002",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          bucket_granularity: "day",
          support_count: 0,
          comment_count: 0,
          viewpoint_ids: [],
          storyline_heat_index: 16,
          top_viewpoint_ids: [],
          metadata: {}
        },
        {
          snapshot_id: "st_snap_005",
          storyline_id: "st_002",
          bucket_index: 2,
          bucket_start: "2026-03-12",
          bucket_granularity: "day",
          support_count: 1,
          comment_count: 1,
          viewpoint_ids: ["vp_002"],
          storyline_heat_index: 54,
          top_viewpoint_ids: ["vp_002"],
          metadata: {}
        }
      ],
      forecast_series: [
        {
          storyline_id: "st_001",
          model_id: "bass_diffusion",
          model_label: "Bass Diffusion",
          target_metric: "storylineHeatIndex",
          historical_points: [point(0, "2026-03-10", 42, false), point(1, "2026-03-11", 72, false)],
          forecast_points: [point(2, "2026-03-12", 79, true, 0.82), point(3, "2026-03-13", 84, true, 0.72)],
          explanation: "Bass 认为流程接入与系统集成还在继续扩散。",
          metadata: {}
        },
        {
          storyline_id: "st_001",
          model_id: "gompertz",
          model_label: "Gompertz",
          target_metric: "storylineHeatIndex",
          historical_points: [point(0, "2026-03-10", 42, false), point(1, "2026-03-11", 72, false)],
          forecast_points: [point(2, "2026-03-12", 76, true, 0.78), point(3, "2026-03-13", 79, true, 0.67)],
          explanation: "Gompertz 认为增长会更早进入平台期。",
          metadata: {}
        },
        {
          storyline_id: "st_002",
          model_id: "bass_diffusion",
          model_label: "Bass Diffusion",
          target_metric: "storylineHeatIndex",
          historical_points: [point(0, "2026-03-10", 11, false), point(1, "2026-03-11", 16, false), point(2, "2026-03-12", 54, false)],
          forecast_points: [point(3, "2026-03-13", 59, true, 0.68), point(4, "2026-03-14", 63, true, 0.59)],
          explanation: "Bass 认为部署摩擦仍会继续扩散。",
          metadata: {}
        },
        {
          storyline_id: "st_002",
          model_id: "gompertz",
          model_label: "Gompertz",
          target_metric: "storylineHeatIndex",
          historical_points: [point(0, "2026-03-10", 11, false), point(1, "2026-03-11", 16, false), point(2, "2026-03-12", 54, false)],
          forecast_points: [point(3, "2026-03-13", 57, true, 0.64), point(4, "2026-03-14", 60, true, 0.55)],
          explanation: "Gompertz 认为部署摩擦会更早趋稳。",
          metadata: {}
        }
      ]
    },
    neural_map: {
      viewpoints: [
        {
          viewpoint_id: "vp_001",
          topic_tag: "workflow",
          viewpoint_label: "流程落地打法",
          title: "先做半自动流程再逐步扩权",
          claim_statement: "Agent 的首个稳定价值来自半自动流程接管，而不是一步到位的全自动替代。",
          summary: "高质量评论把 Agent 的落地点集中在重复流程、审批流和半自动协同上。",
          summary_source: "llm",
          summary_grounding_score: 0.91,
          claim_ids: ["claim_001", "claim_002"],
          comment_ids: ["norm_001", "norm_002"],
          representative_claim_ids: ["claim_001", "claim_002"],
          evidence_comment_ids: ["norm_001", "norm_002"],
          support_count: 2,
          unique_comment_count: 2,
          keywords: ["workflow", "approval"],
          metadata: {}
        },
        {
          viewpoint_id: "vp_002",
          topic_tag: "cost",
          viewpoint_label: "成本与运维摩擦",
          title: "deploy 与维护复杂度正在拖慢扩张",
          claim_statement: "deploy、权限和维护成本仍然是当前 Agent 扩张的主要阻力。",
          summary: "部署、权限和维护值班压力让 Agent 扩张速度持续受限。",
          summary_source: "llm",
          summary_grounding_score: 0.88,
          claim_ids: ["claim_003"],
          comment_ids: ["norm_003"],
          representative_claim_ids: ["claim_003"],
          evidence_comment_ids: ["norm_003"],
          support_count: 1,
          unique_comment_count: 1,
          keywords: ["deploy", "ops"],
          metadata: {}
        },
        {
          viewpoint_id: "vp_003",
          topic_tag: "integration",
          viewpoint_label: "系统集成收益",
          title: "接 CRM 和工单后 ROI 最直观",
          claim_statement: "当 Agent 接入 CRM、工单和 API 节点时，效率收益会更直观。",
          summary: "证据集中在 CRM、工单和 API 集成后的效率改善与首响提速。",
          summary_source: "llm",
          summary_grounding_score: 0.93,
          claim_ids: ["claim_004"],
          comment_ids: ["norm_004", "norm_005"],
          representative_claim_ids: ["claim_004"],
          evidence_comment_ids: ["norm_004", "norm_005"],
          support_count: 3,
          unique_comment_count: 2,
          keywords: ["crm", "ticketing", "api"],
          metadata: {}
        }
      ],
      viewpoint_snapshots: [
        {
          snapshot_id: "vp_snap_001",
          viewpoint_id: "vp_001",
          bucket_index: 0,
          bucket_start: "2026-03-10",
          bucket_granularity: "day",
          support_count: 2,
          unique_comment_count: 1,
          heat_index: 42,
          representative_claim_ids: ["claim_001"],
          metadata: {}
        },
        {
          snapshot_id: "vp_snap_002",
          viewpoint_id: "vp_001",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          bucket_granularity: "day",
          support_count: 2,
          unique_comment_count: 2,
          heat_index: 61,
          representative_claim_ids: ["claim_002"],
          metadata: {}
        },
        {
          snapshot_id: "vp_snap_003",
          viewpoint_id: "vp_003",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          bucket_granularity: "day",
          support_count: 3,
          unique_comment_count: 2,
          heat_index: 75,
          representative_claim_ids: ["claim_004"],
          metadata: {}
        },
        {
          snapshot_id: "vp_snap_004",
          viewpoint_id: "vp_002",
          bucket_index: 2,
          bucket_start: "2026-03-12",
          bucket_granularity: "day",
          support_count: 1,
          unique_comment_count: 1,
          heat_index: 54,
          representative_claim_ids: ["claim_003"],
          metadata: {}
        }
      ],
      viewpoint_relations: [
        {
          relation_id: "vp_rel_001",
          source_viewpoint_id: "vp_003",
          target_viewpoint_id: "vp_001",
          relation_type: "reinforces",
          weight: 0.91,
          evidence_claim_ids: ["claim_004"],
          rationale: "系统集成收益会放大流程落地路线的可信度。",
          metadata: {}
        },
        {
          relation_id: "vp_rel_002",
          source_viewpoint_id: "vp_002",
          target_viewpoint_id: "vp_003",
          relation_type: "constrains",
          weight: 0.66,
          evidence_claim_ids: ["claim_003"],
          rationale: "部署与运维摩擦会直接压制集成扩张速度。",
          metadata: {}
        }
      ],
      storyline_relations: [
        {
          relation_id: "st_rel_001",
          source_storyline_id: "st_002",
          target_storyline_id: "st_001",
          relation_type: "constrains",
          weight: 0.64,
          evidence_viewpoint_ids: ["vp_002"],
          rationale: "部署摩擦持续压制务实落地线的扩张速度。",
          metadata: {}
        }
      ]
    },
    particle_field: {
      particles: [
        {
          particle_id: "particle_001",
          storyline_id: "st_001",
          viewpoint_id: "vp_001",
          claim_id: "claim_001",
          comment_id: "norm_001",
          bucket_index: 0,
          bucket_start: "2026-03-10",
          signal_strength: 0.74,
          excerpt: "先把重复 SOP 半自动化比全自动替代更实际。"
        },
        {
          particle_id: "particle_002",
          storyline_id: "st_001",
          viewpoint_id: "vp_001",
          claim_id: "claim_002",
          comment_id: "norm_002",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          signal_strength: 0.82,
          excerpt: "成熟团队会先让 Agent 接审批流和工单，再慢慢放权。"
        },
        {
          particle_id: "particle_003",
          storyline_id: "st_001",
          viewpoint_id: "vp_003",
          claim_id: "claim_004",
          comment_id: "norm_004",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          signal_strength: 0.93,
          excerpt: "把 Agent 接进 CRM、知识库、工单系统以后，客服首响时间真的降下来了。"
        },
        {
          particle_id: "particle_004",
          storyline_id: "st_002",
          viewpoint_id: "vp_002",
          claim_id: "claim_003",
          comment_id: "norm_003",
          bucket_index: 2,
          bucket_start: "2026-03-12",
          signal_strength: 0.86,
          excerpt: "只要 deploy、权限、日志不收敛，Agent 扩张速度就会被持续拉慢。"
        }
      ],
      evidence_clusters: [
        {
          cluster_id: "cluster_001",
          storyline_id: "st_001",
          viewpoint_id: "vp_001",
          bucket_index: 0,
          bucket_start: "2026-03-10",
          label: "流程落地证据簇",
          comment_ids: ["norm_001"],
          representative_comment_id: "norm_001"
        },
        {
          cluster_id: "cluster_002",
          storyline_id: "st_001",
          viewpoint_id: "vp_001",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          label: "流程落地证据簇",
          comment_ids: ["norm_001", "norm_002"],
          representative_comment_id: "norm_002"
        },
        {
          cluster_id: "cluster_003",
          storyline_id: "st_001",
          viewpoint_id: "vp_003",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          label: "系统集成证据簇",
          comment_ids: ["norm_004", "norm_005"],
          representative_comment_id: "norm_004"
        },
        {
          cluster_id: "cluster_004",
          storyline_id: "st_002",
          viewpoint_id: "vp_002",
          bucket_index: 2,
          bucket_start: "2026-03-12",
          label: "部署摩擦证据簇",
          comment_ids: ["norm_003"],
          representative_comment_id: "norm_003"
        }
      ]
    },
    reasoning: {
      heat_index_formula: {
        version: "2026-03-24.v1",
        target_metric: "storylineHeatIndex",
        weights: {
          volume_component: 0.45,
          support_component: 0.25,
          source_quality_component: 0.2,
          recency_component: 0.1
        },
        description: "storylineHeatIndex is a normalized 0-100 score derived from volume, support strength, source quality, and recency."
      },
      model_reasoning: [
        reasoning("st_001", "bass_diffusion", "Bass 视角下，流程接入与系统集成仍在继续扩散。"),
        reasoning("st_001", "gompertz", "Gompertz 视角下，落地主线会更早进入平台期。"),
        reasoning("st_002", "bass_diffusion", "Bass 视角下，部署摩擦仍会继续扩散到更多团队。"),
        reasoning("st_002", "gompertz", "Gompertz 视角下，部署摩擦会更早趋稳但短期仍在。")
      ],
      traceability: [
        {
          storyline_id: "st_001",
          viewpoint_ids: ["vp_001", "vp_003"],
          claim_ids: ["claim_001", "claim_002", "claim_004"],
          comment_ids: ["norm_001", "norm_002", "norm_004", "norm_005"]
        },
        {
          storyline_id: "st_002",
          viewpoint_ids: ["vp_002"],
          claim_ids: ["claim_003"],
          comment_ids: ["norm_003"]
        }
      ]
    }
  };
}
