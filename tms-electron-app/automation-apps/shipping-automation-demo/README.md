# Shipping Automation Demo

Direct local executor for the `shipping自动化` scene.

## Endpoints

- `GET http://127.0.0.1:3003/health`
- `POST http://127.0.0.1:3003/api/open-shipment-scan`
- `POST http://127.0.0.1:3003/api/run-shipping-file`

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
