from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "backend" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.ingest import IngestFilesystemStore, IngestPipeline  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the real MediaCrawler manifest -> workspace pipeline.")
    parser.add_argument("--manifest", required=True, help="Path to a crawl result manifest JSON file.")
    parser.add_argument("--store-root", default=str(ROOT / "artifacts" / "ingest"), help="Filesystem ingest store root.")
    parser.add_argument(
        "--public-root",
        default=str(ROOT / "frontend" / "workspace" / "public" / "ingest"),
        help="Public artifact root used by the frontend workspace.",
    )
    parser.add_argument("--output", default="", help="Optional path to write the result JSON.")
    parser.add_argument("--language", default="undetermined", help="Language label for the normalized batch.")
    parser.add_argument("--bundle-uri", default="", help="Optional public bundle URI override.")
    parser.add_argument(
        "--disable-llm",
        action="store_true",
        help="Force deterministic summaries instead of the default LLM-with-fallback path.",
    )
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    os.environ.setdefault("DASHSCOPE_TIMEOUT_SECONDS", "10")
    os.environ.setdefault("DASHSCOPE_MAX_RETRIES", "0")
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    store = IngestFilesystemStore(Path(args.store_root), public_root=Path(args.public_root))
    pipeline = IngestPipeline(store, use_llm=not args.disable_llm)
    result = pipeline.bridge_manifest_file_to_workspace(
        manifest_path,
        language=args.language,
        bundle_uri=args.bundle_uri or None,
    )

    output_payload = {
        "task_id": result["manifest"]["task_id"],
        "dataset_id": result["normalized_batch"]["dataset_id"],
        "analysis_id": result["analysis_job"]["analysis_id"],
        "workspace_id": result["workspace_session"]["workspace_id"],
        "bundle_uri": result["workspace_session"]["bundle_uri"],
        "workspace_session_uri": result["workspace_session_uri"],
        "analysis_job": result["analysis_job"],
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
