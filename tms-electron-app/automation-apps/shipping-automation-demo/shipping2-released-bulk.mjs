const PO_HEADER_ALIASES = new Set([
  "po",
  "pono",
  "po#",
  "ponumber",
  "purchaseorder",
  "purchaseorderno",
  "purchaseordernumber",
]);

const UPDATE_VALUE_ALIASES = new Set([
  "releasedqty",
  "releasedquantity",
  "releaseqty",
  "releasequantity",
  "qty",
  "quantity",
  "status",
  "releasedstatus",
]);

export function createShipping2ReleasedBulkAutomation({
  config,
  log,
  forceClickLocator,
  xlsx,
  assertWorkbookPayload,
  resolveWorksheetName,
}) {
  if (!xlsx || !assertWorkbookPayload || !resolveWorksheetName) {
    throw new Error("Shipping2 Released Bulk automation dependencies are incomplete.");
  }

  function extractShipping2ReleasedBulkRowsFromWorkbookPayload(body) {
    const workbookBuffer = assertWorkbookPayload(body);

    let workbook;
    try {
      workbook = xlsx.read(workbookBuffer, { type: "buffer" });
    } catch (error) {
      const parseError = new Error(`Failed to parse uploaded workbook: ${error.message || error}`);
      parseError.statusCode = 400;
      throw parseError;
    }

    const sheetName = resolveWorksheetName(workbook, body?.sheetName);
    if (!sheetName) {
      const error = new Error("Uploaded workbook does not contain any worksheet.");
      error.statusCode = 400;
      throw error;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerInfo = resolveHeaderInfo(rows);
    const releasedBulkRows = [];

    for (let rowIndex = headerInfo.firstDataRowIndex; rowIndex < rows.length; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const poNo = normalizeCellValue(row[headerInfo.poColumnIndex]);
      if (!poNo || PO_HEADER_ALIASES.has(normalizeHeaderName(poNo))) {
        continue;
      }

      releasedBulkRows.push({
        rowIndex: rowIndex + 1,
        poNo,
        updateValue: headerInfo.updateColumnIndex >= 0
          ? normalizeCellValue(row[headerInfo.updateColumnIndex])
          : "",
        originalRow: row,
      });
    }

    if (releasedBulkRows.length === 0) {
      const error = new Error("Uploaded workbook must contain at least one Released Bulk PO number.");
      error.statusCode = 400;
      throw error;
    }

    return releasedBulkRows;
  }

  async function processShipping2ReleasedBulkWorksheet(page, releasedBulkRows) {
    const targetRows = Array.isArray(releasedBulkRows)
      ? releasedBulkRows.filter((row) => normalizeCellValue(row?.poNo))
      : [];

    if (targetRows.length === 0) {
      return buildReleasedBulkResult([], {
        attempted: false,
        ok: true,
        message: "No Released Bulk rows were provided.",
      });
    }

    await page.locator("body").waitFor({
      state: "visible",
      timeout: config.navigationTimeoutMs,
    });
    await page.waitForTimeout(Math.min(Number(config.postLoginWaitMs || 0), 1500));

    let rowResults = await updateReleasedBulkRowsInPage(page, targetRows);
    let saveResult = {
      attempted: false,
      ok: true,
      message: "No rows required saving.",
    };

    if (rowResults.some((row) => row.ok)) {
      saveResult = await saveReleasedBulkWorksheet(page);
      if (!saveResult.ok) {
        rowResults = rowResults.map((row) => row.ok
          ? { ...row, ok: false, error: saveResult.message }
          : row);
      }
    }

    return buildReleasedBulkResult(rowResults, saveResult);
  }

  function formatReleasedBulkSaveDecisionMessage(saveResult) {
    if (!saveResult?.attempted) {
      return saveResult?.message || "No save action was attempted.";
    }

    return saveResult.ok
      ? saveResult.message || "Worksheet save action completed."
      : saveResult.message || "Worksheet save action failed.";
  }

  async function updateReleasedBulkRowsInPage(page, targetRows) {
    return page.evaluate((rows) => {
      const normalize = (value) => String(value ?? "").trim();
      const normalizeForMatch = (value) => normalize(value).replace(/\s+/g, "").toLowerCase();
      const dispatchValueEvents = (element) => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const domRows = Array.from(document.querySelectorAll(
        "tr.x-grid3-row, div.x-grid3-row, tbody tr, [role='row']",
      ));

      return rows.map((target) => {
        const poNo = normalize(target.poNo);
        const normalizedPoNo = normalizeForMatch(poNo);
        const matchedRow = domRows.find((row) => normalizeForMatch(row.textContent).includes(normalizedPoNo));
        if (!matchedRow) {
          return {
            rowIndex: target.rowIndex,
            poNo,
            ok: false,
            error: "PO number was not found in the Released Bulk worksheet.",
          };
        }

        const checkbox = matchedRow.querySelector("input[type='checkbox']:not([disabled])");
        if (checkbox) {
          checkbox.checked = true;
          dispatchValueEvents(checkbox);
          return {
            rowIndex: target.rowIndex,
            poNo,
            ok: true,
            action: "checked",
          };
        }

        const editable = matchedRow.querySelector(
          "input:not([type='hidden']):not([type='checkbox']):not([disabled]), textarea:not([disabled]), select:not([disabled])",
        );
        const updateValue = normalize(target.updateValue);
        if (editable && updateValue) {
          editable.value = updateValue;
          dispatchValueEvents(editable);
          return {
            rowIndex: target.rowIndex,
            poNo,
            ok: true,
            action: "updated",
            updateValue,
          };
        }

        return {
          rowIndex: target.rowIndex,
          poNo,
          ok: false,
          error: "Matched row does not expose an editable Released Bulk control.",
        };
      });
    }, targetRows);
  }

  async function saveReleasedBulkWorksheet(page) {
    const saveLocators = [
      page.getByRole("button", { name: /^save$/i }).first(),
      page.locator("button.x-btn-text").filter({ hasText: /^Save$/i }).first(),
      page.locator("a, button, span").filter({ hasText: /^Save$/i }).first(),
    ];
    let lastError = null;

    for (const locator of saveLocators) {
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      try {
        if (typeof forceClickLocator === "function") {
          await forceClickLocator(locator, "Released Bulk Save");
        } else {
          await locator.click({ force: true });
        }
        await page.waitForTimeout(Math.min(Number(config.postLoginWaitMs || 0), 1500));
        log?.("Released Bulk worksheet save clicked.");
        return {
          attempted: true,
          ok: true,
          message: "Worksheet save action completed.",
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      attempted: true,
      ok: false,
      message: lastError?.message || "Released Bulk Save button was not found.",
    };
  }

  return {
    extractShipping2ReleasedBulkRowsFromWorkbookPayload,
    processShipping2ReleasedBulkWorksheet,
    formatReleasedBulkSaveDecisionMessage,
  };
}

function buildReleasedBulkResult(rowResults, saveResult) {
  const normalizedRows = Array.isArray(rowResults) ? rowResults : [];
  return {
    filterApplied: normalizedRows.length > 0,
    saved: Boolean(saveResult?.attempted && saveResult?.ok),
    saveResult,
    rowResults: normalizedRows,
    updatedRowCount: normalizedRows.filter((row) => row.ok).length,
    failedRowCount: normalizedRows.filter((row) => !row.ok).length,
  };
}

function resolveHeaderInfo(rows) {
  const scanLimit = Math.min(Array.isArray(rows) ? rows.length : 0, 20);
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const headerNames = row.map((cell) => normalizeHeaderName(cell));
    const poColumnIndex = headerNames.findIndex((name) => PO_HEADER_ALIASES.has(name));
    if (poColumnIndex >= 0) {
      return {
        firstDataRowIndex: rowIndex + 1,
        poColumnIndex,
        updateColumnIndex: headerNames.findIndex((name) => UPDATE_VALUE_ALIASES.has(name)),
      };
    }
  }

  return {
    firstDataRowIndex: 0,
    poColumnIndex: 0,
    updateColumnIndex: -1,
  };
}

function normalizeCellValue(value) {
  return String(value ?? "").trim();
}

function normalizeHeaderName(value) {
  return normalizeCellValue(value).toLowerCase().replace(/[^a-z0-9#]/g, "");
}
