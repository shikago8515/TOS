# Ticket Owner Statistics Automation

Frontend entry:

- `ticket-owner-statistics`
- `/#/web-automation/scenarios/ticket-owner-statistics`

Executor route:

- `POST /api/run-ticket-owner-statistics`
- `POST /run-ticket-owner-statistics`

Boundary:

- Reuses the Microsoft / SAP BTP credential panel and visible local Playwright executor.
- Does not require an input Excel workbook. Excel is the output artifact.
- Owns SAP BTP Task Center collection and `Ticket ownership.xlsx` generation.
- Optional lookup workbooks can enrich fields that are not available in the browser page:
  `Release / Unrelease` resolves `PO Number -> Factory`; `Factory Price` resolves `PO/Factory/Working Number -> Merch`.

Workflow:

1. Log in to Microsoft / SAP BTP.
2. Open Task Center and record the Task Center request traffic.
3. In Task Type, select every option except `Initiate Cancellation Request`, then click `Go`.
4. Prefer visible browser detail pages, then use request/OData fallbacks where useful.
5. Resolve fields with the PPT A/B/C rules:
   - A: `Provide Feedback`.
   - B: `Review Main Ticket Resolution`; leave detail-only fields blank until a live B page is available.
   - C: `Review Sub-Ticket Resolution`; use optional lookup workbooks when provided.
6. Generate `Ticket ownership.xlsx`.

Current live-test finding:

- The Task Center request API exposes useful candidates such as `Case Number`, `Task Type`, `Request`, and `PO Number`.
- A `Provide Feedback` page exposes Case Number, Task Type, Request, PO Number, Factory, and Working Number from SAPUI5 SmartField controls.
- `Working Number`, `Factory`, and `Merch` are no longer hard-fail fields. If a browser page or optional lookup workbook cannot provide them, they remain blank and the row carries warnings in JSON diagnostics.
- The next production step is to capture a live B-page sample and add its exact selectors.

Output columns:

- `Case Number`
- `Task Type`
- `Request`
- `PO Number`
- `Working Number`
- `Factory`
- `Merch`

Files:

- `index.mjs`: module definition and route handler factory.
- `workflow.mjs`: login handoff, collection, and artifact orchestration.
- `request-first.mjs`: Task Center request recorder and request-response field extraction.
- `task-center-page.mjs`: SAP BTP Task Center browser operations.
- `ticket-fields.mjs`: A/B/C classification and field extraction.
- `excel-lookups.mjs`: optional Release / Unrelease and Factory Price workbook lookup rules.
- `artifacts.mjs`: `Ticket ownership.xlsx` and JSON artifact generation.

Expected request body:

```json
{
  "username": "user@example.com",
  "password": "<resolved by TOS backend>",
  "token": "<executor token>",
  "headless": false,
  "releaseLookupFileName": "Release.xlsx",
  "releaseLookupFileBase64": "<optional base64 workbook>",
  "factoryPriceFileName": "Factory Price.xlsx",
  "factoryPriceFileBase64": "<optional base64 workbook>"
}
```
