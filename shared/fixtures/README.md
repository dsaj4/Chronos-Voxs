# Golden Fixtures

These fixtures freeze the baseline shared contracts for Chronos-Vox.

Current fixture set:

- `golden-analysis-state.ai-agent-practicalization.json`
- `golden-forecast-bundle.ai-agent-practicalization.json`

The fixtures are intentionally small. They are not a scale test. They are the canonical shape used for:

- frontend loader development
- backend publishing logic
- schema validation
- onboarding parallel contributors

Use the validation script after any contract or fixture change:

```powershell
.\.venv\Scripts\python.exe .\scripts\validate_shared_contracts.py
```
