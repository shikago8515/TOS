export function createLocalWorkbookRouteHandler(deps, options) {
  assertDeps(deps);
  assertOptions(options);

  return async function handleLocalWorkbookRun(req, res) {
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

    const rows = deps.extractRowsFromWorkbookPayload(body);
    const runOptions = deps.normalizeRunOptions(body);
    const inputFileName = deps.normalizeUploadFileName(body);
    const startedAt = new Date().toISOString();

    deps.setActiveRun({
      startedAt,
      totalRows: rows.length,
      browser: runOptions.browser,
      inputFileName,
      inputMode: "local-file",
      moduleId: options.moduleDefinition.id,
    });

    try {
      const result = await options.runWorkflow({
        body,
        inputFileName,
        rows,
        runOptions,
        startedAt,
      });
      result.moduleId = options.moduleDefinition.id;
      result.inputFileName = inputFileName;
      result.inputMode = "local-file";

      const artifactRows = typeof options.buildArtifactRows === "function"
        ? options.buildArtifactRows({ result, rows })
        : rows;
      result.artifacts = await deps.persistRunArtifacts(result, artifactRows);

      deps.setLastRun(options.buildLastRun({
        result,
        rows,
        startedAt,
      }));

      deps.sendJson(res, result.ok ? 200 : 500, result);
    } finally {
      deps.setActiveRun(null);
    }
  };
}

function assertDeps(deps) {
  const required = [
    "authorize",
    "extractRowsFromWorkbookPayload",
    "getActiveRun",
    "normalizeRunOptions",
    "normalizeUploadFileName",
    "persistRunArtifacts",
    "readJsonBody",
    "sendJson",
    "setActiveRun",
    "setLastRun",
  ];

  for (const name of required) {
    if (typeof deps?.[name] !== "function") {
      throw new Error(`local workbook route dependency is missing: ${name}`);
    }
  }
}

function assertOptions(options) {
  if (!options?.moduleDefinition?.id) {
    throw new Error("local workbook route requires a module definition id.");
  }
  if (typeof options.runWorkflow !== "function") {
    throw new Error("local workbook route requires a runWorkflow function.");
  }
  if (typeof options.buildLastRun !== "function") {
    throw new Error("local workbook route requires a buildLastRun function.");
  }
}
