"""Ingest bridge contracts for crawl-to-analysis handoff."""

from __future__ import annotations

from typing import Literal, NotRequired, TypedDict


IngestTaskStatus = Literal["待启动", "抓取中", "抓取完成", "清洗中", "分析中", "可查看", "失败"]


class TimeRange(TypedDict):
    start_at: str
    end_at: str


class CrawlTaskRequest(TypedDict):
    keyword: str
    platforms: list[str]
    time_range: TimeRange
    source: NotRequired[str]
    task_id: NotRequired[str]
    requested_at: NotRequired[str]
    latest_message: NotRequired[str]


class CrawlTask(TypedDict):
    task_id: str
    keyword: str
    platforms: list[str]
    time_range: TimeRange
    requested_at: str
    status: IngestTaskStatus
    source: str
    latest_message: str
    result_manifest_uri: NotRequired[str]


class CrawlTaskStatus(TypedDict):
    task_id: str
    status: IngestTaskStatus
    progress_percent: int
    current_stage: str
    current_platform: str
    estimated_comment_count: int
    updated_at: str
    error_code: NotRequired[str]
    error_message: NotRequired[str]


class CrawlResultManifest(TypedDict):
    task_id: str
    dataset_id: str
    keyword: str
    platforms: list[str]
    time_range: TimeRange
    raw_record_count: int
    output_files: list[str]
    schema_version: str
    created_at: str


class NormalizedCommentBatch(TypedDict):
    dataset_id: str
    batch_id: str
    schema_version: str
    comment_count: int
    platform_breakdown: dict[str, int]
    language: str
    file_uri: str


class AnalysisJob(TypedDict):
    analysis_id: str
    dataset_id: str
    status: IngestTaskStatus
    artifact_manifest_uri: str
    started_at: str
    completed_at: NotRequired[str]
    error_message: NotRequired[str]


class WorkspaceSession(TypedDict):
    workspace_id: str
    analysis_id: str
    bundle_uri: str
    default_primary_view: str
    created_at: str
