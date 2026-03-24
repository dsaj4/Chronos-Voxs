# Backend

Offline data processing and semantic pipeline code lives here.

Target flow:

`RawComment -> NormalizedComment -> Claim -> Viewpoint -> Storyline -> ForecastBundle`

Rules:

- Deterministic preprocessing first
- LLM-backed claim extraction behind explicit module boundaries
- Deterministic grouping for viewpoint and storyline structure
- Publish a bundle for the frontend, not raw semantic reconstruction

## Ingest bridge

The `chronos_vox.ingest` package contains a lightweight filesystem-backed bridge for
`MediaCrawler -> Chronos-Vox` handoff. It works with stable JSON manifests and derives:

- `CrawlTask`
- `CrawlResultManifest`
- `NormalizedCommentBatch`
- `AnalysisJob`
- `WorkspaceSession`

If a manifest arrives before its task record exists locally, the bridge bootstraps the
missing crawl task from manifest metadata and then continues the handoff chain.

The intended local entry point is:

```powershell
python .\scripts\ingest_crawl_result_manifest.py --manifest <path-to-manifest.json>
```
