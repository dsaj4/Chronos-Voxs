from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "backend" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.ingest import IngestFilesystemStore, IngestPipeline  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bridge a crawl result manifest into Chronos-Vox ingest artifacts.")
    parser.add_argument("--manifest", required=True, help="Path to a crawl result manifest JSON file.")
    parser.add_argument("--store-root", default=str(ROOT / "artifacts" / "ingest"), help="Filesystem ingest store root.")
    parser.add_argument("--normalized-batch-uri", default="", help="Optional output URI for the normalized batch JSON.")
    parser.add_argument("--bundle-uri", default="", help="Optional bundle URI to seed the workspace session.")
    parser.add_argument("--language", default="undetermined", help="Language label for the normalized batch.")
    parser.add_argument("--output", default="", help="Optional path to write the bridge result JSON.")
    parser.add_argument("--comment-count", type=int, default=None, help="Override the normalized comment count.")
    parser.add_argument(
        "--platform-breakdown-json",
        default="",
        help="Optional JSON string for platform breakdown, for example '{\"bili\": 120}'.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.manifest)
    store = IngestFilesystemStore(Path(args.store_root))
    pipeline = IngestPipeline(store)
    manifest = load_json(manifest_path)
    platform_breakdown = json.loads(args.platform_breakdown_json) if args.platform_breakdown_json else None

    result = pipeline.bridge_manifest_to_workspace(
        manifest,
        normalized_batch_file_uri=args.normalized_batch_uri or None,
        normalized_comment_count=args.comment_count,
        language=args.language,
        platform_breakdown=platform_breakdown,
        bundle_uri=args.bundle_uri or None,
    )

    output_payload = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output_payload, encoding="utf-8")
    else:
        print(output_payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

