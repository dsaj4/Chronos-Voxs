# Aggregation And Publish Track

Task:
Implement deterministic `Claim -> Viewpoint -> Storyline -> ForecastBundle` aggregation and publish scaffolding against the frozen fixtures.

Write scope:
- `backend/src/chronos_vox/viewpoints/`
- `backend/src/chronos_vox/storylines/`
- `backend/src/chronos_vox/forecast/`
- `backend/src/chronos_vox/publish/`
- `backend/tests/`

Non-goals:
- raw comment normalization
- LLM claim extraction implementation
- frontend interaction logic
- redefining shared bundle semantics without contract-owner approval

Contracts touched:
- none expected in the first pass

Fixture touched:
- none unless an actual contract inconsistency is discovered

Required outputs:
- deterministic grouping stubs or baseline heuristics for viewpoints
- storyline membership and relation builders
- `storylineHeatIndex` helper aligned with ADR 0001
- forecast adapter interface for `bass_diffusion` and `gompertz`
- publish helper that emits `ForecastBundle`

Verification required:
- fixture validation script still passes
- publish path can read the golden analysis-state fixture and emit a bundle shape compatible with the golden bundle
- historical points must remain untouched when forecast points are computed

Risks:
- letting summary text drive grouping identity
- changing heat-index semantics silently
- coupling publish logic too tightly to one fixture

Acceptance:
- code paths exist for grouping, heat-index calculation, forecasting, and bundle publishing
- bundle output remains compatible with the frozen frontend contract
