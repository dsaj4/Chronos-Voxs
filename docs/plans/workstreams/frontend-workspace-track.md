# Frontend Workspace Track

Task:
Implement the workspace shell, bundle loader, shared focus state, and forecast consumption against the frozen golden bundle.

Write scope:
- `frontend/workspace/src/app/`
- `frontend/workspace/src/views/`
- `frontend/workspace/src/components/`
- `frontend/workspace/src/loader/`
- `frontend/workspace/src/forecast/`
- `frontend/workspace/src/state/`
- `frontend/workspace/public/`

Non-goals:
- backend normalization
- backend extraction
- backend grouping logic
- loader-side reconstruction of semantic objects
- changing the frozen bundle contract without approval

Contracts touched:
- none expected in the first pass

Fixture touched:
- none; consume the frozen golden bundle as-is

Required outputs:
- bundle loader that maps published data only
- shared focus state model
- storyline-first workspace shell
- model switching based on published storyline series
- minimal placeholder views for relationship and evidence panels

Verification required:
- frontend code uses the frozen bundle shape directly
- no loader-side semantic reconstruction is introduced
- model switching affects only forecast display logic
- view switching preserves focus state

Risks:
- recreating viewpoints or storylines in the loader
- coupling UI state to fixture-specific shortcuts
- bypassing published reasoning payloads

Acceptance:
- the workspace can load the golden forecast bundle and render a coherent baseline shell
- focus state and model switching align with the frozen bundle contract
