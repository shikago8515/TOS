# Microsoft Login n8n Demo

This folder contains a dedicated Excel upload + n8n + Windows-visible Playwright demo for Microsoft login automation.

Files:

- `demo-upload.html`
  Local upload page for `.xlsx` or `.xls` files.
- `n8n-webhook-microsoft-login-demo.json`
  n8n workflow template.
- `executor.config.json`
  Non-secret runtime config for the Windows login executor.
- `server.mjs`
  Windows-visible Playwright login executor.
- `start-ms-login-executor.ps1`
  Starts the executor.
- `stop-ms-login-executor.ps1`
  Stops the executor.

Workflow path:

- `http://127.0.0.1:5678/webhook/microsoft-login-excel-demo`

Executor endpoints:

- `GET http://127.0.0.1:3002/health`
- `POST http://127.0.0.1:3002/run-login`

Flow:

1. Upload an Excel file in `demo-upload.html`.
2. The file is sent to the local n8n webhook.
3. n8n extracts rows from Excel.
4. n8n sends the rows to the Windows Playwright executor.
5. The executor opens a visible Edge browser and performs Microsoft login.

Notes:

- Credentials are managed by the TOS backend database. The executor receives credentials per run and does not read or write `executor.secret.local.json`.
- If n8n also runs directly on the same Windows host, keep the HTTP Request node pointed at `http://127.0.0.1:3002/run-login`.
- If n8n runs inside Docker, change that node to `http://host.docker.internal:3002/run-login`.

Current behavior:

- The uploaded Excel rows are passed through and counted.
- The executor currently focuses on logging in first.
- After login is stable, the next step can be filling business forms with Excel row data inside the logged-in application.
- If n8n is hosted on a remote server, the HTTP Request node in the workflow must point to a Windows agent address the server can actually reach.
