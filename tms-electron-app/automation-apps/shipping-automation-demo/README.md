# Shipping Automation Demo

Direct local executor for the `shipping自动化` scene.

## Endpoints

- `GET http://127.0.0.1:3003/health`
- `POST http://127.0.0.1:3003/api/open-shipment-scan`
- `POST http://127.0.0.1:3003/api/run-shipping-file`
- `POST http://127.0.0.1:3003/api/run-po-auto-download-file`

## Request payload

```json
{
  "token": "local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f",
  "username": "your-user-id",
  "password": "your-password"
}
```

The executor logs into Infor Nexus, opens `Applications -> Print-Scan-Ship`, and then opens `Shipment Scan`.

`/api/run-shipping-file` accepts the same credentials plus:

```json
{
  "fileName": "shipping.xlsx",
  "fileBase64": "<base64 workbook>"
}
```

The workbook must include `PO No` and `change equipment ID` columns. For each parsed row, the executor:

1. Opens `Shipment Scan`
2. Selects `Remove/Change Equipment ID`
3. Enters the row `PO No`
4. Clicks `OK`
5. Selects the loaded shipment rows
6. Clicks `Change Equipment ID`
7. Enters the row `change equipment ID`
8. Clicks `OK`
9. Reopens `Shipment Scan` for the next Excel row
10. Opens `Create Shipment` once per unique `change equipment ID`, clears `PO Numbers`, sets `Browse Days` to `601`, fills `Equipment Number`, and clicks `OK`

If any PO row fails, the executor writes both JSON and Excel failure reports into `run-artifacts`, including the failed step and raw error reason for each PO.

## PO Auto Download

The `PO 自动下载` scene is implemented as an independent frontend page under `tms-frontend/src/pages/po-auto-download/` and an independent executor module under `po-auto-download/`.

The Excel template is served by the TOS backend from MinIO through `/api/system/config/po-auto-download/template/download`. The default object is `tos-templates/po-auto-download/po-auto-download-template.xls`, and the browser download filename is still `PO 自动下载模板.XLS`; do not place this template in the frontend public directory.

The frontend sends workbook bytes and a local download directory:

```json
{
  "token": "local-shipping-automation-72fd26f0f3b54db49c619bbda2be0f8f",
  "username": "your-user-id",
  "password": "your-password",
  "fileName": "po-list.xlsx",
  "fileBase64": "<base64 workbook>",
  "downloadDirectory": "D:\\Downloads\\InforNexus\\PO",
  "downloadMode": "request-first"
}
```

The executor parses the workbook with its own `INVOICE NUMBER` and `STATUS` column parser and uses a request-first flow before any browser click automation. Only rows with `STATUS = active` or `STATUS = new` are downloaded; other rows are recorded as skipped failures and the batch continues.

1. `GET https://network.infornexus.com/`
2. `POST https://network.infornexus.com/en/trade/login.jsp` with form credentials
3. read `userToken`, `JSESSIONID`, `sToken` and related cookies
4. `GET https://network.infornexus.com/en/trade/InvoicesView.jsp`
5. `POST https://network.infornexus.com/en/trade/InProgressInvoices` with `InProgressInvoicePageManagerinvoiceFilterInvoice` from the Excel `Invoice Number` value, falling back to `PO No`
6. parse the `PageResolver?pageResolverType=InvoicePageResolver&originType=Shipment&originKey=...&destination=CommercialInvoice` URL from the search result
7. open the PageResolver invoice page and parse the `/dyncon/?producer=PlatformTemplateProducer&topicName=ADIDAS_FINANCIAL_INVOICE_PDF&...&renderType=PDF&type=CommercialInvoice&isHuman=true` URL
8. create a run folder under the selected parent directory named `TC Invoice YYYY-MM-DD` (`-1`, `-2`, etc. when duplicated)
9. download the PDF and save it as `TC Invoice {INVOICE NUMBER}.pdf` in that run folder

Infor legacy HTML can return invoice links as `PageResolver?...` relative to `/en/trade/`; the parser normalizes those links before matching so the request chain can continue from the search result to the invoice page.

While the batch is running, the executor writes live counters to `activeRun.progress` in `/api/health`, including phase, active total, completed count, downloaded count, failed count and currently processing invoice numbers. The TOS frontend polls this payload so users can see progress instead of waiting on a silent request.

The selected run folder is kept clean for users and contains downloaded PDF files only. Diagnostic HTML pages and result JSON are not written to that folder unless `poAutoDownload.saveDiagnostics` or request `saveDiagnostics` is explicitly enabled for troubleshooting.

Login credentials are stored in the server backend database through `/api/automation/credentials/{automation_id}`. The `po-auto-download` page supports multiple saved account profiles through `account_key`; the frontend account combobox filters saved profiles by account key or username and resolves the selected profile before running.

Latest local verification: `PO 自动下载模板.XLS` completed 13/13 downloadable Invoice PDF rows into `D:\TOS-Shipping-test\TC Invoice 2026-06-16-1`.
