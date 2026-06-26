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
- Keeps `Factory` and `Merch` columns blank until a reliable browser source is confirmed.

Workflow:

1. Log in to Microsoft / SAP BTP.
2. Open Task Center and record the Task Center request traffic.
3. In Task Type, select every option except `Initiate Cancellation Request`, then click `Go`.
4. Prefer request-first extraction from `task-center-service/v1/tasks` style responses.
5. If request responses do not contain every required field, fall back to visible-browser ticket diagnostics.
6. Resolve fields with the PPT A/B/C rules:
   - A: `Provide Feedback`.
   - B: `Review Main Ticket Resolution` with a direct Working Number.
   - C: `Review Sub-Ticket Resolution`, or Review Main without a direct Working Number, using PO Number to look for Working Number in Release / Unrelease content.
7. Generate `Ticket ownership.xlsx`.

Current live-test finding:

- The Task Center request API exposes useful candidates such as `Case Number`, `Task Type`, `Request`, and `PO Number`.
- The tested `Object Status` Provide Feedback tickets did not expose `Working Number` in the Task Center API or visible My Inbox detail body.
- `Working Number` is still treated as required. Rows without it are written to failed-ticket diagnostics instead of being silently exported as successful rows.
- The next production step is to locate the Release / Unrelease request endpoint that can resolve `Working Number` from `PO Number`.

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
- `artifacts.mjs`: `Ticket ownership.xlsx` and JSON artifact generation.

Expected request body:

```json
{
  "username": "user@example.com",
  "password": "<resolved by TOS backend>",
  "token": "<executor token>",
  "headless": false
}
```
