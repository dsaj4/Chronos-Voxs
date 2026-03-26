"""Launch a local MediaCrawler Bilibili run and bridge its outputs into Chronos-Vox."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any

from ..ingest import IngestFilesystemStore, IngestPipeline
from ..ingest.models import CrawlResultManifest
from ..ingest.service import build_dataset_id, build_task_id, canonicalize_text


DEFAULT_MANIFEST_SCHEMA_VERSION = "chronos-vox.crawl-result-manifest.v1"


@dataclass(frozen=True)
class BilibiliLiveCrawlConfig:
    mediacrawler_root: Path
    keyword: str
    start_day: str
    end_day: str
    output_root: Path
    login_type: str = "qrcode"
    crawler_type: str = "search"
    search_mode: str = "daily_limit_in_time_range"
    save_data_option: str = "jsonl"
    notes_limit: int = 20
    max_notes_per_day: int = 5
    max_comments_per_note: int = 20
    max_concurrency: int = 1
    headless: bool = False
    enable_cdp_mode: bool = True
    enable_comments: bool = True
    enable_sub_comments: bool = False
    auto_close_browser: bool = True
    use_llm: bool = False


def _bool_literal(value: bool) -> str:
    return "True" if value else "False"


def write_bootstrap_script(config: BilibiliLiveCrawlConfig, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    root_literal = json.dumps(str(config.mediacrawler_root.resolve()), ensure_ascii=False)
    keyword_literal = json.dumps(config.keyword, ensure_ascii=False)
    login_type_literal = json.dumps(config.login_type, ensure_ascii=False)
    crawler_type_literal = json.dumps(config.crawler_type, ensure_ascii=False)
    save_data_option_literal = json.dumps(config.save_data_option, ensure_ascii=False)
    output_root_literal = json.dumps(str(config.output_root.resolve()), ensure_ascii=False)
    start_day_literal = json.dumps(config.start_day, ensure_ascii=False)
    end_day_literal = json.dumps(config.end_day, ensure_ascii=False)
    search_mode_literal = json.dumps(config.search_mode, ensure_ascii=False)
    source = f"""from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path({root_literal})
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import config

config.PLATFORM = "bili"
config.KEYWORDS = {keyword_literal}
config.LOGIN_TYPE = {login_type_literal}
config.CRAWLER_TYPE = {crawler_type_literal}
config.SAVE_DATA_OPTION = {save_data_option_literal}
config.SAVE_DATA_PATH = {output_root_literal}
config.START_DAY = {start_day_literal}
config.END_DAY = {end_day_literal}
config.BILI_SEARCH_MODE = {search_mode_literal}
config.CRAWLER_MAX_NOTES_COUNT = {config.notes_limit}
config.MAX_NOTES_PER_DAY = {config.max_notes_per_day}
config.CRAWLER_MAX_COMMENTS_COUNT_SINGLENOTES = {config.max_comments_per_note}
config.MAX_CONCURRENCY_NUM = {config.max_concurrency}
config.HEADLESS = {_bool_literal(config.headless)}
config.CDP_HEADLESS = {_bool_literal(config.headless)}
config.ENABLE_CDP_MODE = {_bool_literal(config.enable_cdp_mode)}
config.ENABLE_GET_COMMENTS = {_bool_literal(config.enable_comments)}
config.ENABLE_GET_SUB_COMMENTS = {_bool_literal(config.enable_sub_comments)}
config.AUTO_CLOSE_BROWSER = {_bool_literal(config.auto_close_browser)}

import main as mediacrawler_main


async def _run() -> None:
    try:
        await mediacrawler_main.main()
    finally:
        await mediacrawler_main.async_cleanup()


if __name__ == "__main__":
    asyncio.run(_run())
"""
    path.write_text(source, encoding="utf-8")
    return path


def _output_sort_key(path: Path) -> tuple[int, str]:
    stem = path.stem.lower()
    if "contents" in stem:
        return (0, stem)
    if "comments" in stem:
        return (1, stem)
    return (2, stem)


def discover_output_files(output_root: Path, *, crawler_type: str = "search") -> list[Path]:
    jsonl_dir = output_root.resolve() / "bili" / "jsonl"
    if not jsonl_dir.exists():
        return []
    candidates = [path.resolve() for path in jsonl_dir.glob(f"{crawler_type}_*.jsonl") if path.is_file()]
    return sorted(candidates, key=_output_sort_key)


def _count_jsonl_rows(path: Path) -> int:
    count = 0
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                count += 1
    return count


def _looks_like_comment_file(path: Path) -> bool:
    if "comments" in path.stem.lower():
        return True
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                stripped = line.strip()
                if not stripped:
                    continue
                payload = json.loads(stripped)
                return isinstance(payload, dict) and "comment_id" in payload
    except (OSError, json.JSONDecodeError):
        return False
    return False


def build_crawl_result_manifest(
    *,
    keyword: str,
    start_day: str,
    end_day: str,
    output_files: list[Path],
    created_at: str | None = None,
    task_id: str | None = None,
) -> CrawlResultManifest:
    created_at_value = created_at or datetime.now().astimezone().isoformat(timespec="seconds")
    time_range = {"start_at": start_day, "end_at": end_day}
    task_id_value = task_id or build_task_id(keyword, ["bili"], time_range, created_at_value)
    comment_count = sum(_count_jsonl_rows(path) for path in output_files if _looks_like_comment_file(path))
    manifest: CrawlResultManifest = {
        "task_id": task_id_value,
        "dataset_id": build_dataset_id(task_id_value),
        "keyword": canonicalize_text(keyword),
        "platforms": ["bili"],
        "time_range": time_range,
        "raw_record_count": comment_count,
        "output_files": [str(path.resolve()) for path in output_files],
        "schema_version": DEFAULT_MANIFEST_SCHEMA_VERSION,
        "created_at": created_at_value,
    }
    return manifest


def _resolve_runner_command(mediacrawler_root: Path, bootstrap_path: Path) -> list[str]:
    if shutil.which("uv"):
        return ["uv", "run", "python", str(bootstrap_path)]
    local_python = mediacrawler_root / ".venv" / "Scripts" / "python.exe"
    if local_python.exists():
        return [str(local_python), str(bootstrap_path)]
    return [sys.executable, str(bootstrap_path)]


def run_bilibili_live_crawl(config: BilibiliLiveCrawlConfig) -> dict[str, Any]:
    mediacrawler_root = config.mediacrawler_root.resolve()
    if not (mediacrawler_root / "main.py").exists():
        raise FileNotFoundError(f"MediaCrawler root does not look runnable: {mediacrawler_root}")

    output_root = config.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    bootstrap_path = write_bootstrap_script(config, output_root / "run_mediacrawler_bili.py")
    command = _resolve_runner_command(mediacrawler_root, bootstrap_path)
    subprocess.run(command, cwd=mediacrawler_root, check=True)

    output_files = discover_output_files(output_root, crawler_type=config.crawler_type)
    if not output_files:
        raise FileNotFoundError(f"No MediaCrawler JSONL outputs found under {output_root}")

    manifest = build_crawl_result_manifest(
        keyword=config.keyword,
        start_day=config.start_day,
        end_day=config.end_day,
        output_files=output_files,
    )
    manifest_path = output_root / "crawl_result_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "command": command,
        "bootstrap_path": str(bootstrap_path),
        "output_root": str(output_root),
        "output_files": [str(path) for path in output_files],
        "manifest": manifest,
        "manifest_path": str(manifest_path),
    }


def run_bilibili_live_crawl_to_workspace(
    config: BilibiliLiveCrawlConfig,
    *,
    store_root: Path | None = None,
    public_root: Path | None = None,
    bundle_uri: str | None = None,
) -> dict[str, Any]:
    crawl_result = run_bilibili_live_crawl(config)
    store = IngestFilesystemStore(root=store_root, public_root=public_root)
    pipeline = IngestPipeline(store, use_llm=config.use_llm)
    bridge_result = pipeline.bridge_manifest_file_to_workspace(Path(crawl_result["manifest_path"]), bundle_uri=bundle_uri)
    return {
        "crawl": crawl_result,
        "bridge": bridge_result,
    }
