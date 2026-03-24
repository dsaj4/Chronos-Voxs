# Normalization Track

Task:
Implement deterministic preprocessing from `RawComment` to `NormalizedComment`.

Write scope:
- `backend/src/chronos_vox/normalize/`
- `backend/src/chronos_vox/ingest/` if needed for helper types
- `backend/tests/`
- `scripts/` only for normalization-specific local helpers

Non-goals:
- claim extraction
- viewpoint grouping
- storyline construction
- frontend loader behavior
- changing shared contracts unless absolutely necessary

Contracts touched:
- should be none for the first pass

Fixture touched:
- none unless a contract bug is discovered

Required outputs:
- deterministic text normalization helpers
- source-class mapping helpers
- quality scoring stub or deterministic baseline
- dedupe key generation
- noise-flag generation

Verification required:
- fixture validation script still passes
- new normalization tests pass
- same input must yield the same normalized output twice in a row

Risks:
- overfitting normalization logic to one platform
- hiding semantic choices in heuristics without documenting them
- accidentally introducing nondeterministic timestamps or IDs

Acceptance:
- a small set of raw comments can be transformed into valid `NormalizedComment` objects matching the frozen contract
- normalization behavior is documented and test-covered
