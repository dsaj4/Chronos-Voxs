# Chronos-Vox Parallel Workstreams

## Goal

Turn the frozen contract baseline into four parallel implementation tracks with minimal overlap and explicit integration rules.

This document is the dispatcher view. Pair it with the per-track briefs in `docs/plans/workstreams/`.

## Frozen Baseline

Do not drift from these files unless the contract owner explicitly updates them:

- `AGENT.md`
- `docs/adr/0001-contract-freeze-and-golden-fixture.md`
- `shared/contracts/chronos-vox.ts`
- `backend/src/chronos_vox/contracts/models.py`
- `shared/schemas/*.schema.json`
- `shared/fixtures/golden-analysis-state.ai-agent-practicalization.json`
- `shared/fixtures/golden-forecast-bundle.ai-agent-practicalization.json`

## Workstreams

1. Normalization
2. Claim extraction
3. Aggregation and publish
4. Frontend workspace

## Ownership Rules

- Shared contracts and fixtures are single-owner.
- Each workstream should stay inside its write scope.
- If a workstream needs a contract change, stop feature work and update contracts first.
- Do not let two agents edit the same contract or fixture file at once.

## Dependency Order

- Normalization can start immediately.
- Claim extraction can start immediately using the frozen claim schema.
- Aggregation and publish can start immediately against the golden analysis-state fixture.
- Frontend workspace can start immediately against the golden forecast-bundle fixture.

## Integration Sequence

1. Keep each track green against the frozen fixtures.
2. Land deterministic normalization output helpers.
3. Land claim extraction module shape, audit shape, and validation hooks.
4. Land grouping and bundle publish helpers.
5. Land frontend loader and focus-state consumption.
6. Run shared fixture validation again before merging cross-track integration.

## Required Verification Before Merge

- `.\.venv\Scripts\python.exe .\scripts\validate_shared_contracts.py`
- any new track-local validation introduced by that workstream
- updated notes in the PR summary:
  - write scope
  - non-goals
  - contracts touched
  - fixture touched
  - risks

## Suggested Branch Naming

- `codex/normalize-*`
- `codex/claims-*`
- `codex/publish-*`
- `codex/frontend-*`

## Deliverables

- One small PR or change bundle per workstream-sized concern
- No silent contract drift
- All workstreams remain compatible with frozen fixtures until an explicit contract revision is accepted
