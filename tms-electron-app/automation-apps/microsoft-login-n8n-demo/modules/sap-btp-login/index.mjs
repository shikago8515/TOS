import { createLocalWorkbookRouteHandler } from "../../shared/local-file-runner.mjs";

export const moduleDefinition = {
  id: "sap-btp-login",
  title: "Microsoft Login / SAP BTP",
  frontendEntryId: "microsoft-login-n8n",
  routePaths: [
    "/run-login-file",
    "/api/run-login-file",
  ],
};

export function createSapBtpLoginHandler(deps) {
  if (typeof deps?.runLogin !== "function") {
    throw new Error("sap-btp-login module dependency is missing: runLogin");
  }

  return createLocalWorkbookRouteHandler(deps, {
    moduleDefinition,
    runWorkflow: async ({ rows, runOptions }) => deps.runLogin(rows, runOptions),
    buildLastRun: ({ result, startedAt }) => ({
      startedAt,
      finishedAt: result.generatedAt,
      loginSuccess: result.loginSuccess,
      uploadedRowCount: result.uploadedRowCount,
      finalUrl: result.finalUrl,
      searchedCaseCount: result.taskCenter?.searchedCaseCount ?? 0,
      moduleId: moduleDefinition.id,
    }),
  });
}
