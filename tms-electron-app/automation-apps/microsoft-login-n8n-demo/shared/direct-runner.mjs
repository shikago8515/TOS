export function createDirectRouteHandler(deps, options) {
  assertDeps(deps);
  assertOptions(options);

  return async function handleDirectRun(req, res) {
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

    const runOptions = deps.normalizeRunOptions(body);
    const startedAt = new Date().toISOString();

    deps.setActiveRun({
      startedAt,
      browser: runOptions.browser,
      inputMode: "browser-export",
      moduleId: options.moduleDefinition.id,
    });

    try {
      const result = await options.runWorkflow({
        body,
        runOptions,
        startedAt,
      });
      result.moduleId = options.moduleDefinition.id;
      result.inputMode = "browser-export";

      deps.setLastRun(options.buildLastRun({
        result,
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
    "getActiveRun",
    "normalizeRunOptions",
    "readJsonBody",
    "sendJson",
    "setActiveRun",
    "setLastRun",
  ];

  for (const name of required) {
    if (typeof deps?.[name] !== "function") {
      throw new Error(`direct route dependency is missing: ${name}`);
    }
  }
}

function assertOptions(options) {
  if (!options?.moduleDefinition?.id) {
    throw new Error("direct route requires a module definition id.");
  }
  if (typeof options.runWorkflow !== "function") {
    throw new Error("direct route requires a runWorkflow function.");
  }
  if (typeof options.buildLastRun !== "function") {
    throw new Error("direct route requires a buildLastRun function.");
  }
}
