# TMS Finance Page Parity Notes

This record constrains the source implementation for the TMS finance Excel
processing pages.

## Routes And Ownership

- `/tms-finance-internal-reconciliation`: internal reconciliation backfill.
- `/tms-finance-work-sales`: Work Sales extraction.
- Both routes use `tms-frontend/src/pages/tms-finance-internal-reconciliation/TmsFinanceInternalReconciliationPage.vue`.
- The active process is resolved from the route name through `tmsFinancePageModel.ts`.

## UI Contract

- The left sidebar submenu and route are the only process-switching entry points.
- Do not add a second large card-style process switcher inside the page content
  unless product requirements explicitly ask for it.
- The page should keep the same Excel processing structure as Jessca, Jane,
  Sophia/Tina, and Eric: title and stats, status toolbar, file upload,
  precheck panel, result notice, and process history.

## Reuse Boundary

- Reuse `ExcelProcessPageShell`, `ExcelUploadSection`, `ExcelResultNotice`,
  `FilePrecheckPanel`, `ProcessHistoryPanel`, `ResultSummary`,
  `shared/process`, and `shared/styles/jane-page.scss`.
- Keep finance-specific behavior in model/API modules: upload fields, button
  labels, progress labels, backend endpoint mapping, result summary conversion,
  and history module ids.
- Do not change backend APIs, upload field names, route schema, or Electron
  APIs for visual-only parity work.

## Verification

- `#/tms-finance-internal-reconciliation` shows internal reconciliation labels:
  `Sample/Bulk 来源文件`, `内销对账单`, and `开始回填`.
- `#/tms-finance-work-sales` shows Work Sales labels:
  `iPlix 导出 Excel`, `补充参考表`, and `开始提取`.
- Desktop and mobile checks must confirm no horizontal scrolling, no top-bar
  overlap, and no `.tms-finance-switcher` content block.
