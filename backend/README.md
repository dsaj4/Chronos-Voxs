# Backend

Offline data processing and semantic pipeline code lives here.

Target flow:

`RawComment -> NormalizedComment -> Claim -> Viewpoint -> Storyline -> ForecastBundle`

Rules:

- Deterministic preprocessing first
- LLM-backed claim extraction behind explicit module boundaries
- Deterministic grouping for viewpoint and storyline structure
- Publish a bundle for the frontend, not raw semantic reconstruction
