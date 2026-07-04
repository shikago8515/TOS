import { persistTicketOwnerStatisticsArtifacts } from "./artifacts.mjs";
import {
  buildTicketOwnerExcelLookups,
  enrichTicketOwnerRowsWithExcelLookups,
} from "./excel-lookups.mjs";
import { TICKET_OWNER_COLUMNS, toTicketOwnerWorkbookRows } from "./ticket-fields.mjs";

export function createTicketOwnerLookupPostProcessHandler(deps, moduleDefinition) {
  return async function handleTicketOwnerLookupPostProcess(req, res) {
    const body = await deps.readJsonBody(req);
    deps.authorize(req, body);

    const activeRun = deps.getActiveRun();
    if (activeRun) {
      deps.sendJson(res, 409, {
        ok: false,
        message: "Executor is busy with another run.",
        activeRun,
      });
      return;
    }

    const startedAt = new Date().toISOString();
    deps.setActiveRun({
      startedAt,
      browser: "none",
      inputMode: "ticket-owner-lookup-post-process",
      moduleId: moduleDefinition.id,
      progress: buildProgress("starting", "Reading collected Ticket ownership file...", 5),
    });

    try {
      const sourceRows = readSourceTicketRows(deps, body);
      deps.updateActiveRun?.({
        progress: buildProgress(
          "lookup",
          `Matching ${sourceRows.length} Ticket ownership rows with auxiliary Excel files...`,
          35,
          sourceRows.length,
        ),
      });

      const lookups = buildTicketOwnerExcelLookups(deps.xlsx, body);
      const normalizedRows = toTicketOwnerWorkbookRows(sourceRows);
      const enrichedRows = enrichTicketOwnerRowsWithExcelLookups(normalizedRows, lookups);
      const changedRowCount = countChangedRows(normalizedRows, enrichedRows);

      deps.updateActiveRun?.({
        progress: buildProgress(
          "artifact",
          "Writing completed Ticket ownership Excel...",
          82,
          enrichedRows.length,
          enrichedRows.length,
        ),
      });

      const result = {
        ok: true,
        generatedAt: new Date().toISOString(),
        finalUrl: "ticket-owner-lookup-post-process://completed",
        loginSuccess: false,
        uploadedRowCount: sourceRows.length,
        ticketOwnerStatistics: {
          rowCount: enrichedRows.length,
          failedTicketCount: 0,
          changedRowCount,
          lookupSummary: lookups.summary,
        },
        sourceFileName: String(body.sourceFileName || body.fileName || "").trim(),
        rows: enrichedRows,
        message: `Completed ${enrichedRows.length} Ticket ownership rows; enriched ${changedRowCount} rows.`,
      };
      result.artifacts = await persistTicketOwnerStatisticsArtifacts(deps, result);

      deps.setLastRun?.({
        startedAt,
        finishedAt: result.generatedAt,
        loginSuccess: false,
        finalUrl: result.finalUrl,
        moduleId: moduleDefinition.id,
        inputMode: "ticket-owner-lookup-post-process",
        generatedRowCount: result.ticketOwnerStatistics.rowCount,
        changedRowCount,
        resultExcelPath: result.artifacts?.resultExcelPath || "",
      });

      deps.sendJson(res, 200, result);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);
      deps.sendJson(res, statusCode, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      deps.setActiveRun(null);
    }
  };
}

function buildProgress(phase, message, percent, totalCount = 0, completedCount = 0) {
  return {
    phase,
    message,
    percent,
    totalCount,
    completedCount,
    successCount: completedCount,
    failedCount: 0,
    attemptedCount: completedCount,
    diagnosticFailedCount: 0,
    activeCount: completedCount < totalCount ? 1 : 0,
    pendingCount: Math.max(totalCount - completedCount, 0),
    currentTickets: [],
    updatedAt: new Date().toISOString(),
  };
}

function readSourceTicketRows(deps, body) {
  const fileName = String(body.sourceFileName || body.fileName || "").trim();
  const fileBase64 = String(body.sourceFileBase64 || body.fileBase64 || "").trim();
  if (!fileBase64) {
    throwRequestError("Please upload the collected Ticket ownership Excel first.", 400);
  }

  if (/\.json$/i.test(fileName)) {
    const rawText = Buffer.from(stripDataUrlPrefix(fileBase64), "base64").toString("utf8");
    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      throwRequestError(`Failed to parse Ticket ownership JSON: ${error.message || error}`, 400);
    }
    return normalizeSourceRows(extractRowsFromJsonPayload(payload));
  }

  return normalizeSourceRows(deps.extractRowsFromWorkbookPayload({
    fileName,
    fileBase64,
    sheetName: body.sheetName,
  }));
}

function extractRowsFromJsonPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }
  if (Array.isArray(payload?.ticketOwnerStatistics?.rows)) {
    return payload.ticketOwnerStatistics.rows;
  }
  if (Array.isArray(payload?.data?.rows)) {
    return payload.data.rows;
  }
  throwRequestError("Ticket ownership JSON does not contain rows.", 400);
}

function normalizeSourceRows(rows) {
  const normalizedRows = toTicketOwnerWorkbookRows(rows);
  if (!normalizedRows.length) {
    throwRequestError("The collected result file does not contain matchable rows.", 400);
  }

  const hasAnyTicketColumn = normalizedRows.some((row) => (
    TICKET_OWNER_COLUMNS.some((column) => String(row[column] || "").trim())
  ));
  if (!hasAnyTicketColumn) {
    throwRequestError("The collected result file does not look like a Ticket ownership workbook.", 400);
  }
  return normalizedRows;
}

function countChangedRows(beforeRows, afterRows) {
  let changed = 0;
  for (let index = 0; index < afterRows.length; index += 1) {
    const before = beforeRows[index] || {};
    const after = afterRows[index] || {};
    if (TICKET_OWNER_COLUMNS.some((column) => String(before[column] || "") !== String(after[column] || ""))) {
      changed += 1;
    }
  }
  return changed;
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:[^,]+,/i, "");
}

function throwRequestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}
