"""Deterministic synthetic comment generation for phase-1 optimization."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta
from typing import Any

from ..contracts.models import RawComment
from .models import OptimizationConfig


def _bucket_date(start_date: str, offset: int) -> str:
    parsed = date.fromisoformat(start_date)
    return (parsed + timedelta(days=offset)).isoformat()


def _raw_comment(
    index: int,
    *,
    config: OptimizationConfig,
    bucket_index: int,
    platform: str,
    author_handle: str,
    source_item_id: str,
    text: str,
    like_count: int,
    reply_count: int,
    share_count: int,
) -> RawComment:
    bucket_date = _bucket_date(config.start_date, bucket_index)
    stamp = f"{bucket_date}T0{bucket_index % 3 + 8}:00:00Z"
    return {
        "raw_comment_id": f"raw_{index:03d}",
        "platform": platform,  # type: ignore[typeddict-item]
        "source_item_id": source_item_id,
        "source_comment_id": f"cmt_{index:03d}",
        "author_handle": author_handle,
        "text": text,
        "created_at": stamp,
        "collected_at": "2026-03-24T09:30:00Z",
        "engagement": {
            "like_count": like_count,
            "reply_count": reply_count,
            "share_count": share_count,
        },
        "metadata": {
            "source_url": f"https://example.com/{platform}/{source_item_id}#cmt_{index:03d}",
            "synthetic_bucket_index": bucket_index,
        },
    }


def build_synthetic_raw_comments(config: OptimizationConfig) -> list[RawComment]:
    """Return a deterministic single-topic, high-variance synthetic comment corpus."""

    seeds: list[dict[str, Any]] = [
        {"bucket_index": 0, "platform": "bilibili", "author_handle": "ops_builder", "source_item_id": "video_agent_001", "text": "真正能落地的 Agent 不是全自动替代，而是先把重复 SOP 半自动化。", "like_count": 46, "reply_count": 7, "share_count": 3},
        {"bucket_index": 0, "platform": "zhihu", "author_handle": "crm_admin", "source_item_id": "answer_agent_010", "text": "Agent 接 CRM 后，线索分发和工单回写终于不用人工抄表了。", "like_count": 39, "reply_count": 6, "share_count": 2},
        {"bucket_index": 0, "platform": "weibo", "author_handle": "student_user", "source_item_id": "post_agent_101", "text": "这个视频节奏不错。", "like_count": 12, "reply_count": 1, "share_count": 0},
        {"bucket_index": 0, "platform": "xiaohongshu", "author_handle": "vendor_official", "source_item_id": "post_agent_220", "text": "官方企业版 3 天上线 Agent，扫码私信领取 deploy 方案。", "like_count": 14, "reply_count": 2, "share_count": 1},
        {"bucket_index": 0, "platform": "bilibili", "author_handle": "ops_builder", "source_item_id": "video_agent_001", "text": "Agent 真正有用的是接住重复流程，不是幻想一夜全自动。", "like_count": 41, "reply_count": 5, "share_count": 2},
        {"bucket_index": 1, "platform": "bilibili", "author_handle": "infra_watch", "source_item_id": "video_agent_001", "text": "Agent 接工单系统和 API 以后，值班同学少了很多复制粘贴。", "like_count": 55, "reply_count": 8, "share_count": 3},
        {"bucket_index": 1, "platform": "zhihu", "author_handle": "product_builder", "source_item_id": "answer_agent_010", "text": "如果先把 webhook、CRM、审批流串起来，Agent 的 ROI 会比聊天助手更快体现。", "like_count": 63, "reply_count": 10, "share_count": 5},
        {"bucket_index": 1, "platform": "weibo", "author_handle": "ops_builder", "source_item_id": "post_agent_102", "text": "Agent 接 CRM 后，线索分发和工单回写终于不用人工抄表了。", "like_count": 23, "reply_count": 3, "share_count": 1},
        {"bucket_index": 1, "platform": "xiaohongshu", "author_handle": "nice_user", "source_item_id": "post_agent_221", "text": "666", "like_count": 4, "reply_count": 0, "share_count": 0},
        {"bucket_index": 1, "platform": "bilibili", "author_handle": "review_analyst", "source_item_id": "video_agent_009", "text": "行业里已经很明显了，集成型 Agent 比孤立 demo 更容易形成稳定价值。", "like_count": 31, "reply_count": 4, "share_count": 1},
        {"bucket_index": 2, "platform": "xiaohongshu", "author_handle": "infra_ops", "source_item_id": "post_agent_014", "text": "模型效果够用了，真正卡住 Agent 扩张的是 deploy 成本和维护值班。", "like_count": 48, "reply_count": 7, "share_count": 2},
        {"bucket_index": 2, "platform": "zhihu", "author_handle": "cost_watch", "source_item_id": "answer_agent_011", "text": "Agent 上线后不是结束，日志、权限、告警、回滚这些运维活才刚开始。", "like_count": 44, "reply_count": 8, "share_count": 2},
        {"bucket_index": 2, "platform": "weibo", "author_handle": "buyer_feedback", "source_item_id": "post_agent_103", "text": "预算一算才发现，Agent 真贵。", "like_count": 19, "reply_count": 2, "share_count": 0},
        {"bucket_index": 2, "platform": "bilibili", "author_handle": "ops_builder", "source_item_id": "video_agent_011", "text": "如果没有统一权限和审计，Agent 接再多系统也会被风控卡住。", "like_count": 29, "reply_count": 5, "share_count": 2},
        {"bucket_index": 2, "platform": "xiaohongshu", "author_handle": "vendor_sale", "source_item_id": "post_agent_222", "text": "私信送你企业 Agent 报价单。", "like_count": 6, "reply_count": 1, "share_count": 0},
        {"bucket_index": 3, "platform": "bilibili", "author_handle": "ops_builder", "source_item_id": "video_agent_012", "text": "成熟团队会先让 Agent 接审批流和工单，再慢慢放权，不会一步到位。", "like_count": 52, "reply_count": 9, "share_count": 4},
        {"bucket_index": 3, "platform": "zhihu", "author_handle": "crm_admin", "source_item_id": "answer_agent_012", "text": "我们把 Agent 接进 CRM、知识库、工单系统以后，客服首响时间真的降下来了。", "like_count": 61, "reply_count": 10, "share_count": 5},
        {"bucket_index": 3, "platform": "weibo", "author_handle": "media_report", "source_item_id": "post_agent_104", "text": "报道里都在吹 Agent，但真正的运维成本经常没人展开讲。", "like_count": 27, "reply_count": 4, "share_count": 1},
        {"bucket_index": 3, "platform": "xiaohongshu", "author_handle": "ops_builder", "source_item_id": "post_agent_223", "text": "Agent 接 CRM 后，线索分发和工单回写终于不用人工抄表了。", "like_count": 18, "reply_count": 3, "share_count": 0},
        {"bucket_index": 3, "platform": "bilibili", "author_handle": "passerby", "source_item_id": "video_agent_012", "text": "路过。", "like_count": 2, "reply_count": 0, "share_count": 0},
        {"bucket_index": 4, "platform": "zhihu", "author_handle": "product_builder", "source_item_id": "answer_agent_013", "text": "现在比较稳的打法就是 Agent 先嵌进流程，再逐步扩到更多系统节点。", "like_count": 58, "reply_count": 9, "share_count": 3},
        {"bucket_index": 4, "platform": "bilibili", "author_handle": "infra_watch", "source_item_id": "video_agent_013", "text": "只要 deploy、权限、日志这三件事不收敛，Agent 扩张速度就会被持续拉慢。", "like_count": 47, "reply_count": 8, "share_count": 2},
        {"bucket_index": 4, "platform": "xiaohongshu", "author_handle": "customer_feedback", "source_item_id": "post_agent_224", "text": "作为使用方我最直观的感受就是，接系统的 Agent 比纯聊天靠谱很多。", "like_count": 33, "reply_count": 5, "share_count": 1},
        {"bucket_index": 4, "platform": "weibo", "author_handle": "vendor_official", "source_item_id": "post_agent_105", "text": "官方直播回放已上线，欢迎预约 Agent 私有化 deploy 方案。", "like_count": 7, "reply_count": 1, "share_count": 0},
        {"bucket_index": 4, "platform": "zhihu", "author_handle": "ops_builder", "source_item_id": "answer_agent_014", "text": "真正能落地的 Agent 不是全自动替代，而是先把重复 SOP 半自动化。", "like_count": 37, "reply_count": 6, "share_count": 2},
        {"bucket_index": 4, "platform": "bilibili", "author_handle": "ops_builder", "source_item_id": "video_agent_013", "text": "我更认同先做半自动，再把 Agent 接 CRM 和审批流，不然运维会炸。", "like_count": 49, "reply_count": 8, "share_count": 3},
    ]

    return [
        _raw_comment(index, config=config, **seed)
        for index, seed in enumerate(seeds, start=1)
    ]


def bucket_dates(config: OptimizationConfig) -> list[str]:
    return [_bucket_date(config.start_date, index) for index in range(config.bucket_count)]


def iter_bucket_indexes(comments: Iterable[RawComment]) -> list[int]:
    bucket_indexes = {
        int(comment.get("metadata", {}).get("synthetic_bucket_index", 0))  # type: ignore[union-attr]
        for comment in comments
    }
    return sorted(bucket_indexes)
