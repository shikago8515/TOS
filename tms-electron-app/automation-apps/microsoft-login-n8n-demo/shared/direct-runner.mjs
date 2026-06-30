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
      progress: {
        phase: "starting",
        message: "正在启动自动化执行器",
        percent: 2,
        totalCount: 0,
        completedCount: 0,
        successCount: 0,
        failedCount: 0,
        attemptedCount: 0,
        diagnosticFailedCount: 0,
        activeCount: 0,
        pendingCount: 0,
        currentTickets: [],
        updatedAt: new Date().toISOString(),
      },
    });

    try {
      const result = await options.runWorkflow({
        body,
        runOptions,
        startedAt,
        reportProgress: (progress) => {
          if (typeof deps.updateActiveRun === "function") {
            deps.updateActiveRun({
              progress: normalizeProgress(progress),
            });
          }
        },
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

function normalizeProgress(progress) {
  const input = progress && typeof progress === "object" ? progress : {};
  return {
    phase: String(input.phase || "running"),
    message: String(input.message || "正在执行"),
    percent: clampPercent(input.percent),
    totalCount: toNonNegativeInteger(input.totalCount),
    completedCount: toNonNegativeInteger(input.completedCount),
    successCount: toNonNegativeInteger(input.successCount),
    failedCount: toNonNegativeInteger(input.failedCount),
    attemptedCount: toNonNegativeInteger(input.attemptedCount),
    diagnosticFailedCount: toNonNegativeInteger(input.diagnosticFailedCount),
    activeCount: toNonNegativeInteger(input.activeCount),
    pendingCount: toNonNegativeInteger(input.pendingCount),
    filteredTotalCount: toNonNegativeInteger(input.filteredTotalCount),
    taskCenterTotalCount: toNonNegativeInteger(input.taskCenterTotalCount),
    discoveredTaskCount: toNonNegativeInteger(input.discoveredTaskCount),
    plannedCount: toNonNegativeInteger(input.plannedCount),
    skippedCount: toNonNegativeInteger(input.skippedCount),
    concurrencyCount: toNonNegativeInteger(input.concurrencyCount),
    currentTickets: Array.isArray(input.currentTickets)
      ? input.currentTickets.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6)
      : [],
    updatedAt: new Date().toISOString(),
  };
}

function clampPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
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
