# Frontend Workspace

This directory hosts the Chronos-Vox analyst workspace.

Rules:

- Consume published bundles only
- Keep a shared focus model across views
- Do not reconstruct semantic entities in the loader
- Run real-time forecasting only on published storyline series

Local setup:

```powershell
cd frontend/workspace
npm install
npm run dev
```

The workspace loads the frozen golden bundle from `public/bundles/` so the app can run without touching shared fixtures at runtime.
