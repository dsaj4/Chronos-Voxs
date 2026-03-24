from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "backend" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from chronos_vox.optimization import OptimizationConfig, run_phase1_optimization


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the phase-1 synthetic optimization loop.")
    parser.add_argument(
        "--output-root",
        default=str(ROOT / "artifacts" / "optimization" / "simulated-phase1"),
        help="Directory used to persist per-iteration artifacts.",
    )
    parser.add_argument(
        "--publish-bundle",
        default="",
        help="Optional path for writing the best deterministic bundle for frontend inspection.",
    )
    parser.add_argument("--case-id", default="ai_agent_practicalization_simulated")
    parser.add_argument("--max-iterations", type=int, default=3)
    parser.add_argument("--minimum-grounding-score", type=float, default=0.75)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    config = OptimizationConfig(
        case_id=args.case_id,
        max_iterations=args.max_iterations,
        minimum_grounding_score=args.minimum_grounding_score,
    )
    publish_bundle_path = Path(args.publish_bundle) if args.publish_bundle else None
    result = run_phase1_optimization(
        config=config,
        output_root=Path(args.output_root),
        publish_bundle_path=publish_bundle_path,
    )

    print(f"[phase1] status={result.status} iteration={result.iteration_index}")
    for track in result.track_results:
        print(
            f"[track] {track.track_id} status={track.status} "
            f"issues={len(track.diagnostics.issues)} prompt={track.prompt_version}"
        )
        if track.blocked_reason:
            print(f"  blocked_reason={track.blocked_reason}")

    if result.status == "passed":
        return 0
    if result.status == "blocked":
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
