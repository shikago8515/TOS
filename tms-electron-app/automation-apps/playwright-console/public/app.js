const localRunForm = document.getElementById('local-run-form');
const n8nUploadForm = document.getElementById('n8n-upload-form');
const workflowSelect = document.getElementById('workflowId');
const statusPill = document.getElementById('status-pill');
const businessResult = document.getElementById('business-result');
const summary = document.getElementById('summary');
const runtimeSummary = document.getElementById('runtime-summary');
const webhookStatus = document.getElementById('webhook-status');
const webhookRawResponse = document.getElementById('webhook-raw-response');
const targetUrlInput = document.getElementById('targetUrl');
const webhookUrlInput = document.getElementById('webhookUrl');
const localRunButton = document.getElementById('localRunButton');
const webhookRunButton = document.getElementById('webhookRunButton');
const clearButton = document.getElementById('clearButton');
const refreshRuntimeButton = document.getElementById('refreshRuntimeButton');

webhookUrlInput.addEventListener('input', () => {
  webhookUrlInput.dataset.touched = 'true';
});

localRunForm.addEventListener('submit', handleLocalRunSubmit);
n8nUploadForm.addEventListener('submit', handleWebhookSubmit);
clearButton.addEventListener('click', resetLocalPanels);
refreshRuntimeButton.addEventListener('click', () => {
  refreshRuntime().catch(handleRuntimeFailure);
});

workflowSelect.addEventListener('change', () => {
  const option = workflowSelect.selectedOptions[0];
  targetUrlInput.placeholder = option?.dataset.url || '为空时使用流程默认地址';
});

loadInitialState().catch((error) => {
  setStatus('加载失败', 'error');
  businessResult.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  summary.textContent = error.message;
});

async function loadInitialState() {
  await Promise.all([loadWorkflows(), refreshRuntime()]);
}

async function loadWorkflows() {
  const payload = await fetchJson('/api/workflows');
  workflowSelect.innerHTML = payload.workflows
    .map((workflow) => {
      const disabled = workflow.available === false;
      const suffix = disabled && workflow.statusLabel
        ? `（${workflow.statusLabel}）`
        : '';
      return `
        <option
          value="${escapeHtml(workflow.id)}"
          data-url="${escapeHtml(workflow.startUrl || '')}"
          data-available="${disabled ? 'false' : 'true'}"
          data-disabled-reason="${escapeHtml(workflow.disabledReason || '')}"
          ${disabled ? 'disabled' : ''}
        >
          ${escapeHtml(`${workflow.name}${suffix}`)}
        </option>
      `;
    })
    .join('');

  workflowSelect.dispatchEvent(new Event('change'));
}

async function refreshRuntime() {
  const payload = await fetchJson('/api/runtime');
  renderRuntimeSummary(payload);

  if (!webhookUrlInput.dataset.touched && !webhookUrlInput.value.trim()) {
    webhookUrlInput.value = payload.n8n?.webhookUrl || '';
  }
}

function renderRuntimeSummary(payload) {
  const n8n = payload.n8n || {};
  const n8nLabel = !n8n.enabled
    ? '已关闭'
    : n8n.reachable
      ? '已连通'
      : '未连通';

  runtimeSummary.innerHTML = `
    <div class="runtime-grid">
      <div class="runtime-card">
        <span>n8n 状态</span>
        <strong>${escapeHtml(n8nLabel)}</strong>
        <code>${escapeHtml(n8n.checkedUrl || n8n.baseUrl || '-')}</code>
      </div>
      <div class="runtime-card">
        <span>默认 Webhook</span>
        <strong>${escapeHtml(n8n.webhookUrl || '-')}</strong>
        ${n8n.openUrl ? `<a class="link" href="${escapeHtml(n8n.openUrl)}" target="_blank" rel="noreferrer">打开 n8n</a>` : ''}
      </div>
      <div class="runtime-card">
        <span>运行数据目录</span>
        <code>${escapeHtml(payload.dataDir || '-')}</code>
      </div>
      <div class="runtime-card">
        <span>本地覆盖配置</span>
        <code>${escapeHtml(payload.localConfigPath || '-')}</code>
      </div>
    </div>
    <div class="runtime-actions">
      <a class="button-link secondary" href="${escapeHtml(toFileUrl(payload.defaultConfigPath))}" target="_blank" rel="noreferrer">查看默认配置</a>
      <a class="button-link secondary" href="${escapeHtml(toFileUrl(payload.localConfigPath))}" target="_blank" rel="noreferrer">查看本地覆盖配置</a>
    </div>
    ${renderLastRuns(payload)}
  `;
}

function renderLastRuns(payload) {
  const localRun = payload.lastLocalRun;
  const webhookRun = payload.lastWebhookRun;

  if (!localRun && !webhookRun) {
    return '<p class="empty-state" style="margin-top: 14px;">还没有历史运行记录。</p>';
  }

  return `
    <div class="runtime-grid" style="margin-top: 14px;">
      <div class="runtime-card">
        <span>最近本地运行</span>
        <strong>${escapeHtml(localRun ? `${localRun.workflowId} · ${localRun.ok ? '成功' : '失败'}` : '暂无')}</strong>
        <code>${escapeHtml(localRun?.completedAt || '-')}</code>
      </div>
      <div class="runtime-card">
        <span>最近 n8n 上传</span>
        <strong>${escapeHtml(webhookRun ? `${webhookRun.ok ? '成功' : '失败'} · HTTP ${webhookRun.statusCode || '-'}` : '暂无')}</strong>
        <code>${escapeHtml(webhookRun?.completedAt || '-')}</code>
      </div>
    </div>
  `;
}

async function handleLocalRunSubmit(event) {
  event.preventDefault();

  const selectedOption = workflowSelect.selectedOptions[0];
  if (selectedOption?.dataset.available === 'false') {
    const reason = selectedOption.dataset.disabledReason || '该流程尚未开放。';
    setStatus('不可用', 'error');
    businessResult.innerHTML = `<p class="empty-state">${escapeHtml(reason)}</p>`;
    summary.textContent = reason;
    return;
  }

  const excelFile = document.getElementById('excelFile').files[0];
  if (!excelFile) {
    setStatus('缺少文件', 'error');
    businessResult.innerHTML = '<p class="empty-state">请先选择一个 Excel 文件。</p>';
    summary.textContent = '缺少 Excel 文件。';
    return;
  }

  const body = new FormData();
  body.append('workflowId', workflowSelect.value);
  body.append('excelFile', excelFile);
  body.append('targetUrl', targetUrlInput.value.trim());
  body.append('dryRun', document.getElementById('dryRun').checked ? 'true' : 'false');

  localRunButton.disabled = true;
  setStatus('运行中', 'running');
  businessResult.innerHTML = `
    <div class="running-panel">
      <strong>正在执行</strong>
      <p>请留意本机弹出的浏览器窗口，必要时可人工接管登录或页面确认。</p>
    </div>
  `;
  summary.textContent = '正在处理...';

  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      body
    });
    const payload = await response.json();
    renderLocalRunResult(payload);
    setStatus(response.ok && payload.ok !== false ? '完成' : '失败', response.ok && payload.ok !== false ? 'success' : 'error');
  } catch (error) {
    setStatus('失败', 'error');
    businessResult.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    summary.textContent = error.message;
  } finally {
    localRunButton.disabled = false;
    refreshRuntime().catch(handleRuntimeFailure);
  }
}

async function handleWebhookSubmit(event) {
  event.preventDefault();

  const excelFile = document.getElementById('webhookExcelFile').files[0];
  if (!excelFile) {
    webhookStatus.className = 'status-block error';
    webhookStatus.textContent = '请先选择要上传到 n8n 的 Excel 文件。';
    return;
  }

  if (!webhookUrlInput.value.trim()) {
    webhookStatus.className = 'status-block error';
    webhookStatus.textContent = 'Webhook URL 不能为空。';
    return;
  }

  const body = new FormData();
  body.append('file', excelFile);
  body.append('webhookUrl', webhookUrlInput.value.trim());

  webhookRunButton.disabled = true;
  webhookStatus.className = 'status-block';
  webhookStatus.textContent = '正在上传到 n8n 并等待回包...';
  webhookRawResponse.textContent = '{}';

  try {
    const response = await fetch('/api/n8n/upload', {
      method: 'POST',
      body
    });
    const payload = await response.json();

    webhookStatus.className = `status-block ${response.ok && payload.ok ? 'ok' : 'error'}`;
    webhookStatus.textContent = response.ok && payload.ok
      ? `n8n 上传完成，HTTP ${payload.statusCode || 200}。`
      : (payload.error || payload.message || `n8n 返回 HTTP ${payload.statusCode || response.status}。`);

    webhookRawResponse.textContent = payload.rawResponse
      || JSON.stringify(payload.jsonResponse || payload, null, 2);
  } catch (error) {
    webhookStatus.className = 'status-block error';
    webhookStatus.textContent = `上传失败: ${error.message}`;
    webhookRawResponse.textContent = JSON.stringify({ error: error.message }, null, 2);
  } finally {
    webhookRunButton.disabled = false;
    refreshRuntime().catch(handleRuntimeFailure);
  }
}

function renderLocalRunResult(payload) {
  const result = payload.result || {};
  const parsedWorkbook = result.parsedWorkbook || {};
  const workflowResult = result.workflowResult || {};
  const rows = Array.isArray(workflowResult.results) && workflowResult.results.length
    ? workflowResult.results
    : (Array.isArray(parsedWorkbook.preview) ? parsedWorkbook.preview.map((item) => ({
        ...item,
        status: result.mode === 'dry-run' ? 'preview' : 'pending'
      })) : []);
  const failed = rows.filter((item) => item.status === 'failed').length;
  const completed = rows.filter((item) => item.status === 'ok').length;
  const artifacts = payload.artifacts || null;

  businessResult.innerHTML = `
    <div class="business-cards">
      <div class="business-card">
        <span>运行状态</span>
        <strong>${escapeHtml(payload.ok === false ? '需要人工检查' : result.mode === 'live' ? '执行完成' : '预览完成')}</strong>
      </div>
      <div class="business-card">
        <span>执行模式</span>
        <strong>${escapeHtml(result.mode === 'live' ? '本地可见浏览器' : '仅预览')}</strong>
      </div>
      <div class="business-card">
        <span>总行数</span>
        <strong>${parsedWorkbook.totalRows || rows.length || 0}</strong>
      </div>
      <div class="business-card ${failed ? 'danger' : 'good'}">
        <span>失败行</span>
        <strong>${failed || artifacts?.failedRowCount || 0}</strong>
      </div>
    </div>

    ${payload.error ? `<div class="business-alert">${escapeHtml(payload.error)}</div>` : ''}
    <div class="visual-note">
      本地直跑会直接在当前电脑打开可见浏览器；如果走 n8n 上传，这里仍然保留失败补单文件和技术日志。
    </div>

    ${renderArtifacts(artifacts)}

    <table class="business-table">
      <thead>
        <tr>
          <th>源行</th>
          <th>Case / PO / Task</th>
          <th>Decision</th>
          <th>备注</th>
          <th>结果</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(renderRow).join('') || '<tr><td colspan="5" class="muted-cell">没有可展示的数据。</td></tr>'}
      </tbody>
    </table>

    ${payload.screenshotUrl ? `
      <div class="screenshot-panel">
        <strong>失败截图</strong>
        <img src="${payload.screenshotUrl}" alt="失败截图" />
      </div>
    ` : ''}
  `;

  summary.textContent = formatTechnicalDetails(payload, completed);
}

function renderArtifacts(artifacts) {
  if (!artifacts) {
    return '';
  }

  const files = artifacts.files || {};
  return `
    <div class="artifact-grid">
      <div class="artifact-card">
        <span>运行产物</span>
        <strong>${escapeHtml(artifacts.runId || '-')}</strong>
        <div class="artifact-links">
          ${renderFileLink(files.resultJson, '结果 JSON')}
          ${renderFileLink(files.manifest, '运行清单')}
        </div>
      </div>
      <div class="artifact-card">
        <span>失败补单</span>
        <strong>${escapeHtml(String(artifacts.failedRowCount || 0))} 行</strong>
        <div class="artifact-links">
          ${renderFileLink(files.failedJson, '失败 JSON')}
          ${renderFileLink(files.failedCsv, '失败 CSV')}
          ${renderFileLink(files.failedXlsx, '失败 XLSX')}
        </div>
      </div>
    </div>
  `;
}

function renderFileLink(file, label) {
  if (!file?.url) {
    return '';
  }

  return `<a class="button-link secondary" href="${escapeHtml(file.url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderRow(item) {
  const key = [item.caseNumber, item.poNumber, item.taskId].filter(Boolean).join(' / ') || '-';
  const status = getRowStatus(item.status);
  return `
    <tr>
      <td>${escapeHtml(item.sourceRow || '-')}</td>
      <td>${escapeHtml(key)}</td>
      <td>${escapeHtml(item.decision || 'Accept')}</td>
      <td>${escapeHtml(item.comments || '')}</td>
      <td><span class="row-status ${status.className}">${escapeHtml(status.label)}</span></td>
    </tr>
  `;
}

function getRowStatus(status) {
  if (status === 'ok') {
    return { label: '完成', className: 'ok' };
  }
  if (status === 'failed') {
    return { label: '失败', className: 'failed' };
  }
  if (status === 'preview') {
    return { label: '预览', className: 'preview' };
  }
  return { label: '待处理', className: 'pending' };
}

function formatTechnicalDetails(payload, completed) {
  const lines = [];
  const result = payload.result || {};
  const parsedWorkbook = result.parsedWorkbook || {};

  lines.push(`模式: ${result.mode || 'unknown'}`);
  lines.push(`文件: ${parsedWorkbook.fileName || '-'}`);
  lines.push(`工作表: ${parsedWorkbook.sheetName || '-'}`);
  lines.push(`可执行行数: ${parsedWorkbook.totalRows || 0}`);
  lines.push(`已完成: ${completed}`);
  lines.push(`失败清单: ${payload.artifacts?.failedRowCount || 0}`);

  if (payload.summaryWebhook) {
    lines.push('');
    lines.push(`结果回传: ${payload.summaryWebhook.sent ? '已发送' : payload.summaryWebhook.skipped ? '未配置' : '发送失败'}`);
    if (payload.summaryWebhook.error) {
      lines.push(`回传错误: ${payload.summaryWebhook.error}`);
    }
  }

  if (payload.error) {
    lines.push('');
    lines.push(`错误: ${payload.error}`);
  }

  if (Array.isArray(payload.logs) && payload.logs.length) {
    lines.push('');
    lines.push('日志:');
    payload.logs.forEach((message) => {
      lines.push(`  - ${message}`);
    });
  }

  if (payload.screenshotPath) {
    lines.push('');
    lines.push(`失败截图: ${payload.screenshotPath}`);
  }

  return lines.join('\n');
}

function resetLocalPanels() {
  setStatus('待运行', '');
  businessResult.innerHTML = '<p class="empty-state">选择流程并上传 Excel 后开始执行。</p>';
  summary.textContent = '暂无技术日志。';
}

function setStatus(label, state) {
  statusPill.textContent = label;
  statusPill.className = `pill ${state || ''}`.trim();
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
  }
  return payload;
}

function handleRuntimeFailure(error) {
  runtimeSummary.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toFileUrl(filePath) {
  if (!filePath) {
    return '#';
  }
  return `file:///${String(filePath).replace(/\\/g, '/')}`;
}
