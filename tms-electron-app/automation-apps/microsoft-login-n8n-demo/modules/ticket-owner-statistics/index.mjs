import { createDirectRouteHandler } from "../../shared/direct-runner.mjs";
import { runTicketOwnerStatisticsWorkflow } from "./workflow.mjs";

export const moduleDefinition = {
  id: "ticket-owner-statistics",
  title: "统计 ticket 归属 自动化",
  frontendEntryId: "ticket-owner-statistics",
  routePaths: [
    "/run-ticket-owner-statistics",
    "/api/run-ticket-owner-statistics",
  ],
};

export function createTicketOwnerStatisticsHandler(deps) {
  if (typeof deps?.runLogin !== "function") {
    throw new Error("ticket-owner-statistics module dependency is missing: runLogin");
  }

  return createDirectRouteHandler(deps, {
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
}
