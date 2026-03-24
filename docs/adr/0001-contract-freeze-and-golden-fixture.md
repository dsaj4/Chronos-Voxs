# ADR 0001: Freeze Shared Contracts And Golden Fixture

## Status

Accepted

## Date

2026-03-24

## Context

Chronos-Vox is entering contract-first development with multiple workstreams:

- normalization
- claim extraction
- aggregation and publishing
- frontend workspace

Without frozen shared contracts and a golden fixture, these tracks will drift and create rework. The frontend may infer semantics differently from the backend, and claim extraction or grouping changes may silently break published data.

## Decision

We freeze the following as the parallel-development baseline:

1. Canonical semantic pipeline objects
2. Canonical published `ForecastBundle`
3. Canonical LLM output schemas for claim extraction and readable group summaries
4. A golden analysis-state fixture and a golden published bundle fixture
5. A documented `storylineHeatIndex` formula

## Contract Version

`2026-03-24.v1`

## Heat Index Definition

`storylineHeatIndex` is the only forecast target metric in the first implementation.

It is a normalized score from `0` to `100` and is computed from four weighted components:

- `volume_component`: normalized comment volume in the bucket, weight `0.45`
- `support_component`: normalized claim support strength in the bucket, weight `0.25`
- `source_quality_component`: normalized source quality in the bucket, weight `0.20`
- `recency_component`: normalized time-recency weight in the bucket, weight `0.10`

Formula:

```text
storylineHeatIndex =
  100 * (
    0.45 * volume_component +
    0.25 * support_component +
    0.20 * source_quality_component +
    0.10 * recency_component
  )
```

Rules:

- Historical values are fixed once published for a case build.
- Forecast models may change only future points.
- Frontend model switching must not rewrite historical points.

## LLM Boundary

LLMs are allowed to produce:

- `Claim` extraction outputs from approved candidate spans
- `Viewpoint` readable label, title, summary, and explanation
- `Storyline` readable label, title, summary, and explanation

LLMs are not the sole authority for:

- deterministic normalization
- structural grouping identity
- stable IDs
- bundle shape

## Consequences

Benefits:

- parallel work can start from a shared baseline
- frontend and backend align on the same fixture
- schema validation catches drift early

Tradeoffs:

- contract changes become slower and more explicit
- fixture maintenance is required whenever the shared shape changes

## Follow-up

- Keep shared schemas under `shared/schemas/`
- Keep typed mirrors under `shared/contracts/` and `backend/src/chronos_vox/contracts/`
- Keep golden fixtures under `shared/fixtures/`
- Any contract change after this ADR must update schemas, typed mirrors, and fixtures together
