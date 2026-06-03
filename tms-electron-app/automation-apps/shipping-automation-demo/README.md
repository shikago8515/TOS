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

The workbook must include a `PO No` column. The executor selects `Remove/Change Equipment ID` in the Shipment Scan dialog, then enters the parsed PO values into the `poNum` field.
