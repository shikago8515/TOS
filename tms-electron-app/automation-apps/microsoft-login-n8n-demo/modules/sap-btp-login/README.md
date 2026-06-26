# SAP BTP Login Automation

Frontend entry:

- `microsoft-login-n8n`
- `/#/web-automation/scenarios/microsoft-login-n8n`

Executor route:

- `POST /api/run-login-file`
- `POST /run-login-file`

Boundary:

- This module preserves the existing Microsoft Login / SAP BTP local-file workflow.
- It owns the direct Excel route that used to live directly in `server.mjs`.
- `server.mjs` now only registers this module route and passes shared executor dependencies.

Expected workbook:

- `Case Number`
- `PO`
- `Decision`

The legacy n8n row endpoint, `POST /api/run-login`, remains in `server.mjs` for compatibility.
