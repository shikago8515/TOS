const form = document.getElementById("run-form");
const workflowSelect = document.getElementById("workflowId");
const statusPill = document.getElementById("status-pill");
const summary = document.getElementById("summary");
const businessResult = document.getElementById("business-result");
const submitButton = document.getElementById("submitButton");
const clearButton = document.getElementById("clearButton");
const targetUrlInput = document.getElementById("targetUrl");

function setStatus(label, state) {
  statusPill.textContent = label;
  statusPill.className = `pill ${state || ""}`.trim();
}

function renderBusinessResult(payload) {
  const result = payload.result || {};
  const parsedWorkbook = result.parsedWorkbook || {};
  const workflowResult = result.workflowResult || {};
  const runRows = Array.isArray(workflowResult.results) ? workflowResult.results : [];
  const previewRows = Array.isArray(parsedWorkbook.preview) ? parsedWorkbook.preview : [];
  const rows = runRows.length ? runRows : previewRows.map((item) => ({
    ...item,
    status: result.mode === "dry-run" ? "preview" : "pending"
  }));

  const failed = rows.filter((item) => item.status === "failed").length;
  const done = rows.filter((item) => item.status === "ok").length;
  const modeLabel = result.mode === "live" ? "正式运行" : "仅预览";
  const stateLabel = payload.ok === false ? "需要人工检查" : result.mode === "live" ? "运行完成" : "预览完成";

  businessResult.innerHTML = `
    <div class="business-cards">
      <div class="business-card">
        <span>当前状态</span>
        <strong>${escapeHtml(stateLabel)}</strong>
      </div>
      <div class="business-card">
        <span>模式</span>
        <strong>${escapeHtml(modeLabel)}</strong>
      </div>
      <div class="business-card">
        <span>总行数</span>
        <strong>${parsedWorkbook.totalRows || rows.length || 0}</strong>
      </div>
      <div class="business-card ${failed ? "danger" : "good"}">
        <span>失败</span>
        <strong>${failed}</strong>
      </div>
    </div>

    ${payload.error ? `<div class="business-alert">${escapeHtml(payload.error)}</div>` : ""}

    <div class="visual-note">
      正式运行时请看打开的 Edge 窗口：页面右上角会显示当前 PO、Task ID 和准备选择的决策，关键按钮会先蓝色高亮再点击。
    </div>

    <table class="business-table">
      <thead>
        <tr>
          <th>序号</th>
          <th>Case / PO</th>
          <th>决策</th>
          <th>备注</th>
          <th>结果</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((item, index) => renderRow(item, index)).join("") || `
          <tr><td colspan="5" class="muted-cell">没有可处理的数据。</td></tr>
        `}
      </tbody>
    </table>

    ${payload.screenshotUrl ? `
      <div class="screenshot-panel">
        <strong>失败截图</strong>
        <img src="${payload.screenshotUrl}" alt="失败截图" />
      </div>
    ` : ""}
  `;

  summary.textContent = formatTechnicalDetails(payload);
}

function renderRow(item, index) {
  const key = [item.caseNumber, item.poNumber || item.taskId].filter(Boolean).join(" / ") || "-";
  const status = statusText(item.status);
  return `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(key)}</td>
      <td>${escapeHtml(item.decision || "Accept")}</td>
      <td>${escapeHtml(item.comments || "")}</td>
      <td><span class="row-status ${status.className}">${status.label}</span></td>
    </tr>
  `;
}

function statusText(status) {
  if (status === "ok") {
    return { label: "完成", className: "ok" };
  }
  if (status === "failed") {
    return { label: "失败", className: "failed" };
  }
  if (status === "preview") {
    return { label: "预览", className: "preview" };
  }
  return { label: "待处理", className: "pending" };
}

function formatTechnicalDetails(payload) {
  const lines = [];
  const result = payload.result || {};
  const parsedWorkbook = result.parsedWorkbook || {};

  lines.push(`模式: ${result.mode || "unknown"}`);
  lines.push(`文件: ${parsedWorkbook.fileName || "-"}`);
  lines.push(`工作表: ${parsedWorkbook.sheetName || "-"}`);
  lines.push(`可执行行数: ${parsedWorkbook.totalRows || 0}`);

  if (payload.error) {
    lines.push("");
    lines.push(`错误: ${payload.error}`);
  }

  if (Array.isArray(payload.logs) && payload.logs.length) {
    lines.push("");
    lines.push("日志:");
    payload.logs.forEach((message) => {
      lines.push(`  - ${message}`);
    });
  }

  if (payload.screenshotPath) {
    lines.push("");
    lines.push(`失败截图: ${payload.screenshotPath}`);
  }

  return lines.join("\n");
}

async function loadWorkflows() {
  const response = await fetch("/api/workflows");
  const payload = await response.json();

  workflowSelect.innerHTML = payload.workflows
    .map(
      (workflow) => {
        const unavailable = workflow.available === false;
        const statusSuffix = unavailable && workflow.statusLabel ? `（${workflow.statusLabel}）` : "";
        return `<option value="${escapeHtml(workflow.id)}" data-url="${escapeHtml(workflow.startUrl)}" data-available="${unavailable ? "false" : "true"}" data-disabled-reason="${escapeHtml(workflow.disabledReason || "")}" ${unavailable ? "disabled" : ""}>${escapeHtml(`${workflow.name}${statusSuffix}`)}</option>`;
      }
    )
    .join("");

  workflowSelect.addEventListener("change", () => {
    const option = workflowSelect.selectedOptions[0];
    targetUrlInput.placeholder = option?.dataset.url || "使用流程默认网址";
  });

  workflowSelect.dispatchEvent(new Event("change"));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedOption = workflowSelect.selectedOptions[0];
  if (selectedOption?.dataset.available === "false") {
    const reason = selectedOption.dataset.disabledReason || "该流程尚未实现，暂不开放运行。";
    setStatus("未开放", "error");
    businessResult.innerHTML = `<p class="empty-state error-text">${escapeHtml(reason)}</p>`;
    summary.textContent = reason;
    return;
  }

  const excelFile = document.getElementById("excelFile").files[0];
  if (!excelFile) {
    setStatus("缺少文件", "error");
    businessResult.innerHTML = '<p class="empty-state error-text">请先选择一个 Excel 文件。</p>';
    summary.textContent = "缺少 Excel 文件。";
    return;
  }

  const body = new FormData();
  body.append("workflowId", workflowSelect.value);
  body.append("excelFile", excelFile);
  body.append("targetUrl", targetUrlInput.value.trim());
  body.append("dryRun", document.getElementById("dryRun").checked ? "true" : "false");

  submitButton.disabled = true;
  setStatus("运行中", "running");
  businessResult.innerHTML = `
    <div class="running-panel">
      <strong>正在运行</strong>
      <p>请看打开的 Edge 窗口确认自动化操作是否符合预期。</p>
    </div>
  `;
  summary.textContent = "正在处理。";

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      body
    });
    const payload = await response.json();

    renderBusinessResult(payload);

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "Unknown error");
    }

    setStatus("完成", "success");
  } catch {
    setStatus("失败", "error");
  } finally {
    submitButton.disabled = false;
  }
});

clearButton.addEventListener("click", () => {
  setStatus("待运行", "");
  businessResult.innerHTML = '<p class="empty-state">选择流程和 Excel 后开始。</p>';
  summary.textContent = "暂无技术日志。";
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

loadWorkflows().catch((error) => {
  setStatus("失败", "error");
  businessResult.innerHTML = `<p class="empty-state error-text">${escapeHtml(error.message)}</p>`;
  summary.textContent = error.message;
});
