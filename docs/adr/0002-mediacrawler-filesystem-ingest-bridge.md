# ADR 0002: Filesystem-backed MediaCrawler ingest bridge

Date: 2026-03-24

## Context

Chronos-Vox needs a stable way to consume external crawl outputs without coupling the
main repository to MediaCrawler internals. The integration document defines a one-way
handoff from crawl task to workspace session.

## Decision

We will use a filesystem-backed ingest bridge in the main repository.

- MediaCrawler exports a crawl result manifest as JSON.
- Chronos-Vox ingests that manifest and derives a normalized batch, analysis job, and workspace session.
- Identifiers follow the chain `task_id -> dataset_id -> analysis_id -> workspace_id`.
- The bridge persists its own local JSON artifacts under `artifacts/ingest/`.
- If the crawl task record is missing when a manifest arrives, the bridge seeds it from
  manifest metadata and then advances the status flow locally.

## Consequences

- The main repo can run and test the ingest flow without a queue, database, or deployed crawler.
- MediaCrawler remains an external service and can be replaced later without changing the bridge contract.
- The current implementation is intentionally local and deterministic; distributed orchestration stays out of scope.
