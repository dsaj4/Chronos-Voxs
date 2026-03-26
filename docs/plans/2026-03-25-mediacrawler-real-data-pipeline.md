# MediaCrawler Real Data Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 接入 MediaCrawler 真实抓取结果，让 Chronos-Vox 从 manifest 和原始评论文件出发，稳定产出真实 `ForecastBundle` 并能在前端工作台打开。

**Architecture:** 继续沿用现有 filesystem-backed ingest bridge，不直接耦合 MediaCrawler 内部实现。主链路固定为 `CrawlResultManifest -> raw crawl records -> NormalizedCommentBatch(JSON) -> AnalysisState -> ForecastBundle -> WorkspaceSession -> frontend/workspace`。前端继续只消费 published bundle，不直接理解爬虫格式。

**Tech Stack:** Python backend, filesystem JSON artifacts, existing normalize/publish pipeline, Vite/React frontend workspace, MediaCrawler manifest handoff.

---

### Task 1: Freeze the Real MediaCrawler Input Contract

**Files:**
- Create: `shared/schemas/crawl-record-batch.schema.json`
- Create: `shared/fixtures/sample-mediacrawler-manifest.ai.json`
- Create: `shared/fixtures/sample-mediacrawler-records.ai.json`
- Modify: `docs/adr/0002-mediacrawler-filesystem-ingest-bridge.md`
- Test: `backend/tests/test_ingest_integration.py`

**Step 1: Write the failing test**

Add a new ingest integration test that loads a real-looking MediaCrawler manifest plus one referenced records file and asserts the pipeline can discover the file and count raw records.

**Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: FAIL because no crawl-record batch schema/fixture loader exists yet.

**Step 3: Write minimal implementation**

- Define the minimum crawl record schema that Chronos-Vox cares about:
  - `platform`
  - `source_item_id`
  - `source_comment_id`
  - `text`
  - `created_at`
  - optional author / URL / engagement metadata
- Update ADR 0002 to explicitly say `output_files` must point to JSON files that satisfy this schema.

**Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: PASS for the new fixture-based contract test.

**Step 5: Commit**

```bash
git add shared/schemas/crawl-record-batch.schema.json shared/fixtures/sample-mediacrawler-manifest.ai.json shared/fixtures/sample-mediacrawler-records.ai.json docs/adr/0002-mediacrawler-filesystem-ingest-bridge.md backend/tests/test_ingest_integration.py
git commit -m "feat: freeze mediacrawler record input contract"
```

### Task 2: Build the MediaCrawler Raw-Record Adapter

**Files:**
- Create: `backend/src/chronos_vox/ingest/mediacrawler_adapter.py`
- Modify: `backend/src/chronos_vox/ingest/__init__.py`
- Test: `backend/tests/test_ingest_integration.py`

**Step 1: Write the failing test**

Add tests for:
- loading all `manifest.output_files`
- flattening MediaCrawler records into Chronos-Vox `RawComment`
- mapping platform names
- preserving source IDs and metadata

**Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: FAIL because no adapter exists.

**Step 3: Write minimal implementation**

Implement a `MediaCrawlerRawRecordAdapter` with:
- `load_manifest_output_files(manifest, root_hint=None)`
- `to_raw_comments(records, manifest)`
- safe handling for missing optional fields
- stable `raw_comment_id` generation when source IDs are incomplete

**Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: PASS for adapter parsing and mapping.

**Step 5: Commit**

```bash
git add backend/src/chronos_vox/ingest/mediacrawler_adapter.py backend/src/chronos_vox/ingest/__init__.py backend/tests/test_ingest_integration.py
git commit -m "feat: add mediacrawler raw record adapter"
```

### Task 3: Materialize a Real NormalizedCommentBatch File

**Files:**
- Modify: `backend/src/chronos_vox/ingest/service.py`
- Modify: `backend/src/chronos_vox/ingest/filesystem.py`
- Modify: `scripts/ingest_crawl_result_manifest.py`
- Test: `backend/tests/test_ingest_integration.py`

**Step 1: Write the failing test**

Add a test that `bridge_manifest_to_workspace(...)` can take a manifest with raw record files and produce a real normalized batch JSON file containing normalized comments, not just metadata.

**Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: FAIL because `materialize_normalized_comment_batch(...)` currently only writes batch metadata.

**Step 3: Write minimal implementation**

- Extend `materialize_normalized_comment_batch(...)` to optionally:
  - load raw records via the new adapter
  - call existing `normalize_raw_comments(...)`
  - write a JSON payload to `normalized_batches/<dataset_id>.json`
- Keep the current metadata object, but make `file_uri` point to the actual normalized comments file.

**Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: PASS and the stored normalized batch file contains real normalized comments.

**Step 5: Commit**

```bash
git add backend/src/chronos_vox/ingest/service.py backend/src/chronos_vox/ingest/filesystem.py scripts/ingest_crawl_result_manifest.py backend/tests/test_ingest_integration.py
git commit -m "feat: materialize normalized comment batch from manifest outputs"
```

### Task 4: Add a Real Analysis Runner for Normalized Batches

**Files:**
- Create: `backend/src/chronos_vox/runtime/run_analysis.py`
- Modify: `backend/src/chronos_vox/__init__.py`
- Test: `backend/tests/test_publish_bundle.py`
- Test: `backend/tests/test_ingest_integration.py`

**Step 1: Write the failing test**

Add a test that takes a normalized batch file path, runs the real analysis path, and gets back a schema-valid `AnalysisState` and `ForecastBundle`.

**Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py backend\tests\test_publish_bundle.py -q`

Expected: FAIL because there is no runtime entrypoint from normalized batch to bundle.

**Step 3: Write minimal implementation**

Implement a runtime function with this boundary:
- input: `dataset_id`, normalized comments file path, case metadata
- output: `analysis_state`, `bundle`, saved artifact paths

For phase 1 of real data:
- reuse existing normalize/claims/viewpoints/storylines/publish modules where possible
- do not add a database or queue
- ensure published bundle still satisfies the current frontend contract, especially the forecast phase fields the latest frontend commit depends on

**Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py backend\tests\test_publish_bundle.py -q`

Expected: PASS with schema-valid artifacts.

**Step 5: Commit**

```bash
git add backend/src/chronos_vox/runtime/run_analysis.py backend/src/chronos_vox/__init__.py backend/tests/test_ingest_integration.py backend/tests/test_publish_bundle.py
git commit -m "feat: add runtime analysis entrypoint for normalized batches"
```

### Task 5: Wire IngestPipeline to Produce Real Bundles and Workspace Sessions

**Files:**
- Modify: `backend/src/chronos_vox/ingest/service.py`
- Modify: `backend/src/chronos_vox/ingest/filesystem.py`
- Test: `backend/tests/test_ingest_integration.py`

**Step 1: Write the failing test**

Add an end-to-end ingest test that:
- bridges a real manifest
- materializes normalized comments
- runs analysis
- writes analysis artifact metadata
- creates a workspace session whose `bundle_uri` points to a real generated bundle

**Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: FAIL because `finalize_analysis_job(...)` currently only writes placeholder artifact metadata.

**Step 3: Write minimal implementation**

- Make `start_analysis_job(...)` or `finalize_analysis_job(...)` call the new runtime analysis entrypoint
- write the real bundle JSON under ingest-owned artifacts, for example:
  - `artifacts/ingest/bundles/<workspace_id>.json`
- persist bundle URI into:
  - analysis artifact manifest
  - workspace session
- ensure idempotency if the same manifest is bridged again

**Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: PASS and `workspace_session.bundle_uri` resolves to a real bundle file.

**Step 5: Commit**

```bash
git add backend/src/chronos_vox/ingest/service.py backend/src/chronos_vox/ingest/filesystem.py backend/tests/test_ingest_integration.py
git commit -m "feat: wire ingest pipeline to real analysis artifacts"
```

### Task 6: Add a Single Real-Flow CLI for Local End-to-End Runs

**Files:**
- Create: `scripts/run_real_mediacrawler_flow.py`
- Modify: `scripts/ingest_crawl_result_manifest.py`
- Test: `backend/tests/test_ingest_integration.py`

**Step 1: Write the failing test**

Add a test for a script-level function that:
- accepts a manifest path
- resolves record files
- writes normalized batch + analysis artifacts + bundle
- returns `workspace_id` and `bundle_uri`

**Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: FAIL because there is no one-command real flow runner.

**Step 3: Write minimal implementation**

Create a CLI that wraps the full chain:
- `manifest -> normalized batch -> analysis -> bundle -> workspace session`

Required output:
- `task_id`
- `dataset_id`
- `analysis_id`
- `workspace_id`
- `bundle_uri`

**Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ingest_integration.py -q`

Expected: PASS and the script function returns the full ID chain.

**Step 5: Commit**

```bash
git add scripts/run_real_mediacrawler_flow.py scripts/ingest_crawl_result_manifest.py backend/tests/test_ingest_integration.py
git commit -m "feat: add one-command real mediacrawler flow runner"
```

### Task 7: Teach the Frontend Workspace to Open Real Workspace Sessions

**Files:**
- Create: `frontend/workspace/public/ingest/.gitkeep`
- Modify: `frontend/workspace/src/loader/bundleLoader.ts`
- Modify: `frontend/workspace/src/app/WorkspaceApp.tsx`
- Modify: `frontend/workspace/src/loader/publishedTypes.ts`
- Test: `frontend/workspace/src/loader/bundleLoader.test.ts`

**Step 1: Write the failing test**

Add a loader test that:
- accepts a `workspace` query parameter or manifest path
- resolves a workspace session JSON
- loads its `bundle_uri`

**Step 2: Run test to verify it fails**

Run: `C:\nvm4w\nodejs\npm.cmd test`

Expected: FAIL because the frontend only knows direct `bundle=` overrides today.

**Step 3: Write minimal implementation**

- Preserve `bundle=` override for direct debugging
- Add a second path for `workspace=`:
  - load workspace session JSON
  - resolve its `bundle_uri`
  - load the published bundle
- Keep the frontend as a published-bundle consumer; do not let it parse raw MediaCrawler records

**Step 4: Run test to verify it passes**

Run: `C:\nvm4w\nodejs\npm.cmd test`

Expected: PASS for workspace-session-based loading.

**Step 5: Commit**

```bash
git add frontend/workspace/public/ingest/.gitkeep frontend/workspace/src/loader/bundleLoader.ts frontend/workspace/src/app/WorkspaceApp.tsx frontend/workspace/src/loader/publishedTypes.ts frontend/workspace/src/loader/bundleLoader.test.ts
git commit -m "feat: allow workspace app to load ingest workspace sessions"
```

### Task 8: Prove the Real Flow End-to-End

**Files:**
- Modify: `backend/tests/test_ingest_integration.py`
- Modify: `frontend/workspace/src/loader/bundleLoader.test.ts`
- Modify: `frontend/workspace/README.md`
- Create: `docs/plans/2026-03-25-mediacrawler-real-data-runbook.md`

**Step 1: Write the failing test**

Add one end-to-end backend test and one frontend loader test that together prove:
- a sample MediaCrawler manifest can produce a real bundle
- the workspace can open that bundle from the generated workspace session

**Step 2: Run test to verify it fails**

Run:
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`
- `C:\nvm4w\nodejs\npm.cmd test`

Expected: FAIL until the full chain is wired.

**Step 3: Write minimal implementation**

- finish any missing glue
- write a short runbook with exact commands for local real-data flow
- include a note that the latest frontend stream chart now distinguishes historical and forecast phases, so real bundles must always provide a valid forecast series per storyline

**Step 4: Run test to verify it passes**

Run:
- `.\.venv\Scripts\python.exe -m pytest backend\tests -q`
- `.\.venv\Scripts\python.exe scripts\validate_shared_contracts.py`
- `C:\nvm4w\nodejs\npm.cmd test`
- `C:\nvm4w\nodejs\npm.cmd run build`

Expected: all PASS, and a manual load of the generated workspace succeeds.

**Step 5: Commit**

```bash
git add backend/tests/test_ingest_integration.py frontend/workspace/src/loader/bundleLoader.test.ts frontend/workspace/README.md docs/plans/2026-03-25-mediacrawler-real-data-runbook.md
git commit -m "feat: validate end-to-end mediacrawler real data flow"
```

## Scope Notes

- First landing should target the existing filesystem bridge, not a live queue/service API.
- Reuse the current `normalize -> claims -> viewpoints -> storylines -> publish bundle` path before introducing any new orchestration layer.
- The latest frontend commit `14714a2 feat(frontend): distinguish stream forecast phase` raises the bar for real bundle correctness: every real storyline bundle must preserve historical points and forecast points cleanly so the stream chart can split the two phases without fallback.
- Keep the frontend consuming published bundles only. Raw crawl files and ingest metadata should stay in backend/scripts land.

## Recommended Milestone Order

1. Real manifest + raw record adapter
2. Real normalized batch file materialization
3. Real analysis runner + bundle generation
4. IngestPipeline end-to-end handoff
5. Frontend workspace-session loading
6. Manual real-flow runbook and acceptance pass
