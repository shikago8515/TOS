import { runTicketOwnerStatisticsLangGraphWorkflow } from "./langgraph-workflow.mjs";

export async function runTicketOwnerStatisticsWorkflow(deps, context) {
  return runTicketOwnerStatisticsLangGraphWorkflow(deps, context);
}
