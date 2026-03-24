import type { PublishedBundle } from "../loader/publishedTypes";

export function createPublishedBundleFixture(): PublishedBundle {
  return {
    meta: {
      case_id: "fixture_case",
      case_title: "Fixture Case",
      topic_tag: "fixture_topic",
      contract_version: "2026-03-24.v1",
      fixture_id: "fixture-bundle-v1",
      generated_at: "2026-03-24T12:30:00Z",
      bucket_granularity: "day",
      analysis_window_start: "2026-03-10",
      analysis_window_end: "2026-03-12",
      source_platforms: ["bilibili"],
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
          storyline_label: "主线一",
          title: "主线一标题",
          summary: "主线一摘要",
          summary_source: "llm",
          logic_status: "stable",
          evidence_posture: "grounded",
          support_count: 5,
          viewpoint_count: 2,
          comment_count: 4,
          keywords: ["workflow"],
          display_rank: 1,
          display_tier: "primary",
          metadata: {}
        },
        {
          storyline_id: "st_002",
          topic_tag: "fixture_topic",
          storyline_label: "主线二",
          title: "主线二标题",
          summary: "主线二摘要",
          summary_source: "llm",
          logic_status: "emerging",
          evidence_posture: "mixed",
          support_count: 1,
          viewpoint_count: 1,
          comment_count: 1,
          keywords: ["cost"],
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
          support_count: 1,
          comment_count: 1,
          viewpoint_ids: ["vp_001"],
          storyline_heat_index: 41,
          top_viewpoint_ids: ["vp_001"],
          metadata: {}
        },
        {
          snapshot_id: "st_snap_002",
          storyline_id: "st_001",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          bucket_granularity: "day",
          support_count: 4,
          comment_count: 3,
          viewpoint_ids: ["vp_001", "vp_003"],
          storyline_heat_index: 68,
          top_viewpoint_ids: ["vp_001", "vp_003"],
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
          storyline_heat_index: 10,
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
          storyline_heat_index: 13,
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
          storyline_heat_index: 53,
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
          historical_points: [
            {
              bucket_index: 0,
              bucket_start: "2026-03-10",
              bucket_granularity: "day",
              value: 41,
              confidence_low: 41,
              confidence_high: 41,
              confidence_score: 1,
              is_forecast: false
            }
          ],
          forecast_points: [],
          explanation: "fixture",
          metadata: {}
        },
        {
          storyline_id: "st_002",
          model_id: "gompertz",
          model_label: "Gompertz",
          target_metric: "storylineHeatIndex",
          historical_points: [
            {
              bucket_index: 2,
              bucket_start: "2026-03-12",
              bucket_granularity: "day",
              value: 53,
              confidence_low: 53,
              confidence_high: 53,
              confidence_score: 1,
              is_forecast: false
            }
          ],
          forecast_points: [],
          explanation: "fixture",
          metadata: {}
        }
      ]
    },
    neural_map: {
      viewpoints: [
        {
          viewpoint_id: "vp_001",
          topic_tag: "workflow",
          viewpoint_label: "观点一",
          title: "观点一标题",
          claim_statement: "观点一主张",
          summary: "观点一摘要",
          summary_source: "llm",
          summary_grounding_score: 0.8,
          claim_ids: ["claim_001"],
          comment_ids: ["norm_001", "norm_002"],
          representative_claim_ids: ["claim_001"],
          evidence_comment_ids: ["norm_001", "norm_002"],
          support_count: 2,
          unique_comment_count: 2,
          keywords: ["workflow"],
          metadata: {}
        },
        {
          viewpoint_id: "vp_002",
          topic_tag: "cost",
          viewpoint_label: "观点二",
          title: "观点二标题",
          claim_statement: "观点二主张",
          summary: "观点二摘要",
          summary_source: "llm",
          summary_grounding_score: 0.89,
          claim_ids: ["claim_002"],
          comment_ids: ["norm_003"],
          representative_claim_ids: ["claim_002"],
          evidence_comment_ids: ["norm_003"],
          support_count: 1,
          unique_comment_count: 1,
          keywords: ["cost"],
          metadata: {}
        },
        {
          viewpoint_id: "vp_003",
          topic_tag: "workflow",
          viewpoint_label: "观点三",
          title: "观点三标题",
          claim_statement: "观点三主张",
          summary: "观点三摘要",
          summary_source: "llm",
          summary_grounding_score: 0.95,
          claim_ids: ["claim_003"],
          comment_ids: ["norm_004", "norm_005"],
          representative_claim_ids: ["claim_003"],
          evidence_comment_ids: ["norm_004", "norm_005"],
          support_count: 3,
          unique_comment_count: 2,
          keywords: ["workflow", "integration"],
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
          support_count: 1,
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
          representative_claim_ids: ["claim_001"],
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
          heat_index: 72,
          representative_claim_ids: ["claim_003"],
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
          heat_index: 53,
          representative_claim_ids: ["claim_002"],
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
          evidence_claim_ids: ["claim_003"],
          rationale: "fixture",
          metadata: {}
        },
        {
          relation_id: "vp_rel_002",
          source_viewpoint_id: "vp_002",
          target_viewpoint_id: "vp_003",
          relation_type: "constrains",
          weight: 0.66,
          evidence_claim_ids: ["claim_002"],
          rationale: "fixture",
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
          rationale: "fixture",
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
          signal_strength: 0.7,
          excerpt: "观点一证据"
        },
        {
          particle_id: "particle_002",
          storyline_id: "st_001",
          viewpoint_id: "vp_001",
          claim_id: "claim_001",
          comment_id: "norm_002",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          signal_strength: 0.81,
          excerpt: "观点一强化"
        },
        {
          particle_id: "particle_003",
          storyline_id: "st_001",
          viewpoint_id: "vp_003",
          claim_id: "claim_003",
          comment_id: "norm_004",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          signal_strength: 0.96,
          excerpt: "观点三证据"
        },
        {
          particle_id: "particle_004",
          storyline_id: "st_002",
          viewpoint_id: "vp_002",
          claim_id: "claim_002",
          comment_id: "norm_003",
          bucket_index: 2,
          bucket_start: "2026-03-12",
          signal_strength: 0.84,
          excerpt: "观点二证据"
        }
      ],
      evidence_clusters: [
        {
          cluster_id: "cluster_001",
          storyline_id: "st_001",
          viewpoint_id: "vp_001",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          label: "观点一簇",
          comment_ids: ["norm_001", "norm_002"],
          representative_comment_id: "norm_002"
        },
        {
          cluster_id: "cluster_002",
          storyline_id: "st_001",
          viewpoint_id: "vp_003",
          bucket_index: 1,
          bucket_start: "2026-03-11",
          label: "观点三簇",
          comment_ids: ["norm_004", "norm_005"],
          representative_comment_id: "norm_004"
        },
        {
          cluster_id: "cluster_003",
          storyline_id: "st_002",
          viewpoint_id: "vp_002",
          bucket_index: 2,
          bucket_start: "2026-03-12",
          label: "观点二簇",
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
          volume_component: 0.45
        },
        description: "fixture"
      },
      model_reasoning: [
        {
          storyline_id: "st_001",
          model_id: "bass_diffusion",
          assumptions: ["fixture"],
          explanation: "fixture",
          confidence_note: "fixture",
          comparison_summary: "fixture"
        }
      ],
      traceability: [
        {
          storyline_id: "st_001",
          viewpoint_ids: ["vp_001", "vp_003"],
          claim_ids: ["claim_001", "claim_003"],
          comment_ids: ["norm_001", "norm_002", "norm_004", "norm_005"]
        },
        {
          storyline_id: "st_002",
          viewpoint_ids: ["vp_002"],
          claim_ids: ["claim_002"],
          comment_ids: ["norm_003"]
        }
      ]
    }
  };
}
