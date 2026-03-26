from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "backend" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.crawl import BilibiliLiveCrawlConfig, run_bilibili_live_crawl_to_workspace  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a live MediaCrawler Bilibili crawl and bridge it into Chronos-Vox.")
    parser.add_argument("--keyword", required=True, help="Bilibili search keyword.")
    parser.add_argument("--start-day", required=True, help="Start day in YYYY-MM-DD.")
    parser.add_argument("--end-day", required=True, help="End day in YYYY-MM-DD.")
    parser.add_argument(
        "--mediacrawler-root",
        default=str(ROOT / "artifacts" / "_inspect" / "MediaCrawler"),
        help="Path to the local MediaCrawler checkout.",
    )
    parser.add_argument(
        "--run-root",
        default=str(ROOT / "artifacts" / "live_crawl_runs"),
        help="Base directory for MediaCrawler outputs and generated manifest files.",
    )
    parser.add_argument("--login-type", default="qrcode", help="MediaCrawler login type.")
    parser.add_argument("--notes-limit", type=int, default=20, help="Maximum notes to accept for the keyword.")
    parser.add_argument("--max-notes-per-day", type=int, default=5, help="Daily note limit for the time-range search.")
    parser.add_argument("--max-comments-per-note", type=int, default=20, help="Maximum first-level comments per video.")
    parser.add_argument("--max-concurrency", type=int, default=1, help="MediaCrawler concurrency.")
    parser.add_argument("--headless", action="store_true", help="Run the crawler headless.")
    parser.add_argument("--disable-cdp", action="store_true", help="Disable CDP mode and use standard Playwright.")
    parser.add_argument("--enable-sub-comments", action="store_true", help="Also crawl second-level comments.")
    parser.add_argument("--enable-llm", action="store_true", help="Use the LLM summary path after ingest.")
    parser.add_argument("--output", default="", help="Optional path to write the result JSON.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    run_id = f"bili_{args.keyword}_{args.start_day}_{args.end_day}".replace(" ", "_").replace(":", "_")
    run_root = Path(args.run_root).resolve() / run_id
    config = BilibiliLiveCrawlConfig(
        mediacrawler_root=Path(args.mediacrawler_root).resolve(),
        keyword=args.keyword,
        start_day=args.start_day,
        end_day=args.end_day,
        output_root=run_root,
        login_type=args.login_type,
        notes_limit=args.notes_limit,
        max_notes_per_day=args.max_notes_per_day,
        max_comments_per_note=args.max_comments_per_note,
        max_concurrency=args.max_concurrency,
        headless=args.headless,
        enable_cdp_mode=not args.disable_cdp,
        enable_sub_comments=args.enable_sub_comments,
        use_llm=args.enable_llm,
    )
    result = run_bilibili_live_crawl_to_workspace(config)
    bridge = result["bridge"]
    output_payload = {
        "crawl": result["crawl"],
        "task_id": bridge["manifest"]["task_id"],
        "dataset_id": bridge["normalized_batch"]["dataset_id"],
        "analysis_id": bridge["analysis_job"]["analysis_id"],
        "workspace_id": bridge["workspace_session"]["workspace_id"],
        "bundle_uri": bridge["workspace_session"]["bundle_uri"],
        "workspace_session_uri": bridge["workspace_session_uri"],
    }
    serialized = json.dumps(output_payload, ensure_ascii=False, indent=2)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized, encoding="utf-8")
    else:
        print(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
