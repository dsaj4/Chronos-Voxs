from __future__ import annotations

import json
from pathlib import Path

from chronos_vox.crawl.bilibili_live import (
    BilibiliLiveCrawlConfig,
    build_crawl_result_manifest,
    discover_output_files,
    write_bootstrap_script,
)


def test_write_bootstrap_script_injects_bilibili_runtime_overrides(tmp_path: Path) -> None:
    media_root = tmp_path / "MediaCrawler"
    media_root.mkdir()
    bootstrap_path = tmp_path / "bootstrap.py"
    config = BilibiliLiveCrawlConfig(
        mediacrawler_root=media_root,
        keyword="ai agent",
        start_day="2025-03-10",
        end_day="2025-03-11",
        output_root=tmp_path / "run-output",
    )

    written = write_bootstrap_script(config, bootstrap_path)
    source = written.read_text(encoding="utf-8")

    assert written == bootstrap_path
    assert 'config.PLATFORM = "bili"' in source
    assert 'config.KEYWORDS = "ai agent"' in source
    assert 'config.START_DAY = "2025-03-10"' in source
    assert 'config.END_DAY = "2025-03-11"' in source
    assert 'config.BILI_SEARCH_MODE = "daily_limit_in_time_range"' in source
    assert str((tmp_path / "run-output").resolve()).replace("\\", "\\\\") in source


def test_discover_output_files_returns_bilibili_comments_and_contents(tmp_path: Path) -> None:
    output_root = tmp_path / "run-output" / "bili" / "jsonl"
    output_root.mkdir(parents=True)
    comments = output_root / "search_comments_20260326.jsonl"
    contents = output_root / "search_contents_20260326.jsonl"
    comments.write_text('{"comment_id":"9001","video_id":"1","content":"hello","create_time":1}\n', encoding="utf-8")
    contents.write_text('{"video_id":"1","title":"video"}\n', encoding="utf-8")

    discovered = discover_output_files(tmp_path / "run-output", crawler_type="search")

    assert discovered == [contents.resolve(), comments.resolve()]


def test_build_crawl_result_manifest_counts_comment_rows_only(tmp_path: Path) -> None:
    comments = tmp_path / "search_comments_20260326.jsonl"
    contents = tmp_path / "search_contents_20260326.jsonl"
    comments.write_text(
        "\n".join(
            [
                json.dumps({"comment_id": "9001", "video_id": "1", "content": "hello", "create_time": 1}),
                json.dumps({"comment_id": "9002", "video_id": "1", "content": "world", "create_time": 2}),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    contents.write_text(json.dumps({"video_id": "1", "title": "video"}) + "\n", encoding="utf-8")

    manifest = build_crawl_result_manifest(
        keyword="ai agent",
        start_day="2025-03-10",
        end_day="2025-03-11",
        output_files=[contents, comments],
        created_at="2026-03-26T16:00:00+08:00",
        task_id="task_bili_live_ai_agent_001",
    )

    assert manifest["task_id"] == "task_bili_live_ai_agent_001"
    assert manifest["dataset_id"] == "dataset_task_bili_live_ai_agent_001"
    assert manifest["platforms"] == ["bili"]
    assert manifest["raw_record_count"] == 2
    assert manifest["output_files"] == [str(contents.resolve()), str(comments.resolve())]
