import { createDirectRouteHandler } from "../../shared/direct-runner.mjs";
import { createTicketOwnerLookupPostProcessHandler } from "./post-process.mjs";
import { runTicketOwnerStatisticsWorkflow } from "./workflow.mjs";

export const moduleDefinition = {
  id: "ticket-owner-statistics",
  title: "统计 ticket 归属 自动化",
  frontendEntryId: "ticket-owner-statistics",
  routePaths: [
    "/run-ticket-owner-statistics",
    "/api/run-ticket-owner-statistics",
    "/run-ticket-owner-statistics-lookup",
    "/api/run-ticket-owner-statistics-lookup",
  ],
};

export function createTicketOwnerStatisticsHandler(deps) {
  if (typeof deps?.runLogin !== "function") {
    throw new Error("ticket-owner-statistics module dependency is missing: runLogin");
  }

  const runHandler = createDirectRouteHandler(deps, {
    moduleDefinition,
    runWorkflow: (context) => runTicketOwnerStatisticsWorkflow(deps, {
      ...context,
      moduleDefinition,
    }),
    buildLastRun: ({ result, startedAt }) => ({
      startedAt,
      finishedAt: result.generatedAt,
      loginSuccess: result.loginSuccess,
      finalUrl: result.finalUrl,
      moduleId: moduleDefinition.id,
      generatedRowCount: result.ticketOwnerStatistics?.rowCount ?? 0,
      failedTicketCount: result.ticketOwnerStatistics?.failedTicketCount ?? 0,
      resultExcelPath: result.artifacts?.resultExcelPath || "",
    }),
  });
  const lookupHandler = createTicketOwnerLookupPostProcessHandler(deps, moduleDefinition);

  return async function handleTicketOwnerStatisticsRoute(req, res) {
    const requestPath = String(req.url || "/").split("?")[0];
    if (requestPath.endsWith("/run-ticket-owner-statistics-lookup")
      || requestPath.endsWith("/api/run-ticket-owner-statistics-lookup")) {
      await lookupHandler(req, res);
      return;
    }

    await runHandler(req, res);
  };
}
