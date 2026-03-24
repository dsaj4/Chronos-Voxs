# Claim Extraction Track

Task:
Implement the replaceable `NormalizedComment -> Claim` module using candidate spans, schema-validated LLM outputs, audit logging, and fallback handling.

Write scope:
- `backend/src/chronos_vox/claims/`
- `backend/src/chronos_vox/llm/`
- `backend/tests/`
- `scripts/` only for claim-extraction-specific local helpers

Non-goals:
- deterministic normalization logic
- viewpoint grouping
- storyline grouping
- frontend rendering
- changing published bundle shape

Contracts touched:
- `shared/schemas/claim-extraction-output.schema.json` only if a real schema bug is found

Fixture touched:
- none for the first pass

Required outputs:
- candidate span selection interface
- LLM adapter interface for claim extraction
- schema validation against `claim-extraction-output.schema.json`
- audit record creation aligned with `LlmAuditEntry`
- retry, cache, and invalid-output isolation hooks

Verification required:
- fixture validation script still passes
- new tests cover:
  - valid LLM output
  - invalid LLM output
  - retry path
  - cache-hit path
  - low-confidence isolation

Risks:
- leaking prompt-specific logic into domain objects
- accepting invalid LLM payloads silently
- mixing grouping decisions into extraction code

Acceptance:
- extraction module can accept candidate spans and return contract-valid claim payloads plus audit entries
- invalid or partial model outputs are rejected or isolated cleanly
