# TOS Source Workspace

This repository is the reconstructed source workspace for the TOS desktop tool.

The current source baseline was recovered from the packaged Electron `win-unpacked` build. The backend and Electron shell are recoverable source assets. The frontend application source was not present in the package, so `tms-frontend` must be rebuilt from the current product behavior and backend API contracts.

## Repository Layout

```text
tms-electron-app/  Electron desktop shell and packaging config
tms-backend/       FastAPI backend and Excel processing modules
tms-frontend/      Frontend rebuild workspace
docs/              Recovery notes and engineering standards
```

## Current Status

| Area | Status |
| --- | --- |
| Electron shell | Recovered from `resources/app.asar` |
| Backend | Recovered from `resources/backend` |
| Frontend | Source missing; rebuild required |
| GitHub remote | `https://github.com/shikago8515/TOS.git` |

## Next Work

1. Rebuild `tms-frontend` with Vue 3, TypeScript, and Vite.
2. Keep the FastAPI endpoints compatible while adding typed response schemas.
3. Add sample-driven regression tests for each Excel processing module.
4. Use feature branches and automated checks before merging to `main`.

See `docs/source-recovery-and-engineering-plan.md` for the full recovery assessment and engineering control plan.
