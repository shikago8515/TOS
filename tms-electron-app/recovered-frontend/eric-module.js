(function () {
  'use strict';

  var ROUTE = '/eric';
  var API_BASE = 'http://127.0.0.1:8000/api/eric';
  var state = {
    file: null,
    processing: false,
    success: null,
    message: '',
    logs: [],
    outputFile: '',
    rowCount: '-'
  };

  function routePath() {
    var hashPath = String(window.location.hash || '').replace(/^#/, '').split('?')[0];
    var browserPath = String(window.location.pathname || '').split('?')[0];
    var path = hashPath || browserPath || '';
    if (path.charAt(0) !== '/') path = '/' + path;
    return path.toLowerCase().replace(/\/$/, '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureStyle() {
    if (document.getElementById('tos-eric-module-style')) return;
    var style = document.createElement('style');
    style.id = 'tos-eric-module-style';
    style.textContent = [
      '.tos-eric-nav { cursor: pointer; }',
      '.tos-eric-nav strong { display: inline-flex; align-items: center; gap: 6px; }',
      '.tos-eric-test-tag {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  height: 18px;',
      '  padding: 0 6px;',
      '  border: 1px solid rgba(245, 158, 11, .35);',
      '  border-radius: 999px;',
      '  color: #facc15;',
      '  background: rgba(245, 158, 11, .12);',
      '  font-size: 11px;',
      '  font-weight: 800;',
      '}',
      '.tos-eric-page { padding: 32px; }',
      '.tos-eric-panel {',
      '  display: grid;',
      '  gap: 22px;',
      '  width: 100%;',
      '  max-width: 1480px;',
      '  margin: 0 auto;',
      '}',
      '.tos-eric-card {',
      '  border: 1px solid #e2e8f0;',
      '  border-radius: 8px;',
      '  background: #fff;',
      '  padding: 24px;',
      '  box-shadow: 0 18px 44px rgba(15, 23, 42, .06);',
      '}',
      '.tos-eric-header {',
      '  display: flex;',
      '  align-items: flex-start;',
      '  justify-content: space-between;',
      '  gap: 18px;',
      '}',
      '.tos-eric-kicker { margin: 0 0 8px; color: #64748b; font-size: 13px; font-weight: 800; }',
      '.tos-eric-title { margin: 0; color: #0f172a; font-size: 28px; line-height: 1.25; letter-spacing: 0; }',
      '.tos-eric-desc { margin: 10px 0 0; color: #64748b; font-size: 15px; line-height: 1.65; }',
      '.tos-eric-stage {',
      '  align-self: flex-start;',
      '  border: 1px solid #fed7aa;',
      '  border-radius: 999px;',
      '  color: #ea580c;',
      '  background: #fff7ed;',
      '  padding: 6px 12px;',
      '  font-size: 13px;',
      '  font-weight: 800;',
      '  white-space: nowrap;',
      '}',
      '.tos-eric-alert {',
      '  border: 1px solid #fed7aa;',
      '  border-radius: 8px;',
      '  color: #c2410c;',
      '  background: #fff7ed;',
      '  padding: 13px 16px;',
      '  font-size: 14px;',
      '}',
      '.tos-eric-upload-grid { display: grid; grid-template-columns: minmax(280px, 480px) 1fr; gap: 18px; }',
      '.tos-eric-upload {',
      '  display: grid;',
      '  place-items: center;',
      '  min-height: 176px;',
      '  border: 2px dashed #93c5fd;',
      '  border-radius: 8px;',
      '  background: #eff6ff;',
      '  color: #1d4ed8;',
      '  cursor: pointer;',
      '  width: 100%;',
      '  font: inherit;',
      '  text-align: center;',
      '  transition: border-color .16s ease, background .16s ease;',
      '}',
      '.tos-eric-upload:hover { border-color: #2563eb; background: #dbeafe; }',
      '.tos-eric-upload.dragging { border-color: #2563eb; background: #dbeafe; }',
      '.tos-eric-upload strong { display: block; color: #0f172a; font-size: 17px; margin-bottom: 8px; }',
      '.tos-eric-upload span { display: block; color: #64748b; font-size: 13px; }',
      '.tos-eric-file {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  gap: 12px;',
      '  border: 1px solid #e2e8f0;',
      '  border-radius: 8px;',
      '  padding: 13px 14px;',
      '  color: #334155;',
      '  background: #f8fafc;',
      '}',
      '.tos-eric-file strong { display: block; color: #0f172a; font-size: 14px; margin-bottom: 3px; }',
      '.tos-eric-file span { color: #64748b; font-size: 12px; }',
      '.tos-eric-remove {',
      '  border: 0;',
      '  color: #94a3b8;',
      '  background: transparent;',
      '  cursor: pointer;',
      '  font-size: 22px;',
      '  line-height: 1;',
      '}',
      '.tos-eric-steps {',
      '  display: grid;',
      '  grid-template-columns: repeat(3, minmax(0, 1fr));',
      '  gap: 12px;',
      '}',
      '.tos-eric-step { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc; }',
      '.tos-eric-step span { color: #2563eb; font-size: 12px; font-weight: 900; }',
      '.tos-eric-step strong { display: block; margin: 7px 0 4px; color: #0f172a; font-size: 14px; }',
      '.tos-eric-step p { margin: 0; color: #64748b; font-size: 12px; line-height: 1.5; }',
      '.tos-eric-actions { display: flex; justify-content: center; gap: 14px; }',
      '.tos-eric-btn {',
      '  min-height: 40px;',
      '  border: 1px solid #cbd5e1;',
      '  border-radius: 6px;',
      '  background: #fff;',
      '  color: #334155;',
      '  padding: 0 18px;',
      '  font-size: 14px;',
      '  font-weight: 800;',
      '  cursor: pointer;',
      '}',
      '.tos-eric-btn.primary { border-color: #2563eb; background: #409eff; color: #fff; }',
      '.tos-eric-btn:disabled { cursor: not-allowed; opacity: .55; }',
      '.tos-eric-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }',
      '.tos-eric-stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 16px; background: #f8fafc; }',
      '.tos-eric-stat span { display: block; color: #64748b; font-size: 13px; font-weight: 800; }',
      '.tos-eric-stat strong { display: block; margin-top: 8px; color: #0f172a; font-size: 24px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.tos-eric-message {',
      '  border-radius: 8px;',
      '  padding: 13px 16px;',
      '  font-size: 14px;',
      '  color: #1e40af;',
      '  background: #eff6ff;',
      '}',
      '.tos-eric-message.error { color: #dc2626; background: #fef2f2; }',
      '.tos-eric-message.success { color: #15803d; background: #f0fdf4; }',
      '.tos-eric-log { display: grid; gap: 7px; max-height: 260px; overflow: auto; }',
      '.tos-eric-log div { border-bottom: 1px solid #e2e8f0; padding-bottom: 7px; color: #475569; font-size: 12px; line-height: 1.45; }',
      '@media (max-width: 900px) {',
      '  .tos-eric-page { padding: 18px; }',
      '  .tos-eric-header, .tos-eric-upload-grid { grid-template-columns: 1fr; display: grid; }',
      '  .tos-eric-steps, .tos-eric-summary { grid-template-columns: 1fr; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureNav() {
    updateNavActive();
  }

  function updateNavActive() {
    var active = routePath() === ROUTE;
    var item = document.querySelector('.tos-eric-nav');
    if (item) item.classList.toggle('active', active);
  }

  function setTopbar() {
    var title = document.querySelector('.page-title');
    var subtitle = document.querySelector('.page-subtitle');
    if (title) title.textContent = 'Excel \u5904\u7406 / Excel\u6570\u636e\u5904\u7406\u6574\u5408\u5de5\u5177-Eric';
    if (subtitle) subtitle.textContent = 'Eric \u6d4b\u8bd5\u7248\uff1a\u62c6\u5206 PO \u533a\u5757\u5e76\u751f\u6210 Final_Data';
    document.title = 'Eric\u6570\u636e\u5904\u7406 - TOS\u96c6\u6210\u5de5\u5177';
  }

  function restoreContent() {
    var page = document.getElementById('tos-eric-page');
    if (page) page.remove();
    var content = document.querySelector('.content-area');
    if (content) {
      Array.prototype.forEach.call(content.children, function (child) {
        child.style.display = '';
      });
    }
  }

  function renderPage() {
    var content = document.querySelector('.content-area');
    if (!content) return;

    Array.prototype.forEach.call(content.children, function (child) {
      if (child.id !== 'tos-eric-page') child.style.display = 'none';
    });

    var page = document.getElementById('tos-eric-page');
    if (!page) {
      page = document.createElement('div');
      page.id = 'tos-eric-page';
      page.className = 'tos-eric-page';
      content.appendChild(page);
    }

    page.innerHTML = [
      '<div class="tos-eric-panel">',
      '<section class="tos-eric-card">',
      '<div class="tos-eric-header">',
      '<div>',
      '<p class="tos-eric-kicker">Excel \u5904\u7406</p>',
      '<h2 class="tos-eric-title">Excel\u6570\u636e\u5904\u7406\u6574\u5408\u5de5\u5177-Eric</h2>',
      '<p class="tos-eric-desc">\u5c06 PO Number1 / Article Number1 \u8f85\u52a9\u5217\u586b\u5145\u3001PO \u533a\u5757\u62c6\u5206\u548c\u5c3a\u7801\u5217\u9006\u900f\u89c6\u6574\u5408\u5230 Final_Data \u5de5\u4f5c\u8868\u3002</p>',
      '</div>',
      '<span class="tos-eric-stage">\u6d4b\u8bd5\u7248 v0.1.2-alpha.1</span>',
      '</div>',
      '</section>',
      '<div class="tos-eric-alert">\u6d4b\u8bd5\u9636\u6bb5\uff1a\u8bf7\u7528 Eric \u73b0\u6709\u6837\u4f8b\u6587\u4ef6\u8bd5\u8dd1\uff0c\u8bb0\u5f55\u5931\u8d25\u6837\u4f8b\u548c\u671f\u671b\u8f93\u51fa\u540e\u518d\u8f6c\u6b63\u5f0f\u6a21\u5757\u3002</div>',
      '<section class="tos-eric-card">',
      '<div class="tos-eric-upload-grid">',
      '<div>',
      '<button class="tos-eric-upload" type="button" data-eric-pick>',
      '<span>',
      '<strong>' + (state.file ? '\u5df2\u9009\u62e9\u6587\u4ef6' : '\u70b9\u51fb\u4e0a\u4f20 Excel') + '</strong>',
      '<span>\u652f\u6301 .xlsx / .xlsm</span>',
      '</span>',
      '</button>',
      '<input id="tos-eric-file" type="file" accept=".xlsx,.xlsm" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">',
      state.file ? '<div class="tos-eric-file"><div><strong>' + escapeHtml(state.file.name) + '</strong><span>' + Math.max(1, Math.round(state.file.size / 1024)) + ' KB</span></div><button class="tos-eric-remove" type="button" data-eric-remove>&times;</button></div>' : '',
      '</div>',
      '<div class="tos-eric-steps">',
      '<div class="tos-eric-step"><span>01</span><strong>\u8f85\u52a9\u5217</strong><p>\u63d2\u5165 PO Number1 \u548c Article Number1\uff0c\u5e76\u5411\u4e0b\u586b\u5145 PO Number1 \u7a7a\u503c\u3002</p></div>',
      '<div class="tos-eric-step"><span>02</span><strong>\u62c6\u5206 Sheet</strong><p>\u6309 PO Number \u6807\u9898\u884c\u5206\u5272\u4e1a\u52a1\u6570\u636e\u5757\u3002</p></div>',
      '<div class="tos-eric-step"><span>03</span><strong>Final_Data</strong><p>\u5c06\u5c3a\u7801\u5217\u8f6c\u6210 Size / Quantity \u660e\u7ec6\u884c\u3002</p></div>',
      '</div>',
      '</div>',
      '<div class="tos-eric-actions">',
      '<button class="tos-eric-btn primary" type="button" data-eric-run ' + (!state.file || state.processing ? 'disabled' : '') + '>' + (state.processing ? '\u5904\u7406\u4e2d...' : '\u5f00\u59cb\u5904\u7406') + '</button>',
      '<button class="tos-eric-btn" type="button" data-eric-reset>\u91cd\u7f6e</button>',
      state.outputFile ? '<button class="tos-eric-btn" type="button" data-eric-download>\u4e0b\u8f7d\u7ed3\u679c</button>' : '',
      '</div>',
      '</section>',
      '<section class="tos-eric-card">',
      '<div class="tos-eric-summary">',
      '<div class="tos-eric-stat"><span>\u6e90\u6587\u4ef6</span><strong>' + (state.file ? '1' : '0') + '</strong></div>',
      '<div class="tos-eric-stat"><span>\u5904\u7406\u72b6\u6001</span><strong>' + (state.processing ? '\u5904\u7406\u4e2d' : state.success === true ? '\u6210\u529f' : state.success === false ? '\u5931\u8d25' : '\u5f85\u5904\u7406') + '</strong></div>',
      '<div class="tos-eric-stat"><span>Final_Data \u884c\u6570</span><strong>' + escapeHtml(state.rowCount) + '</strong></div>',
      '<div class="tos-eric-stat"><span>\u7ed3\u679c\u6587\u4ef6</span><strong>' + (state.outputFile ? '\u5df2\u751f\u6210' : '\u672a\u751f\u6210') + '</strong></div>',
      '</div>',
      state.message ? '<div class="tos-eric-message ' + (state.success === true ? 'success' : state.success === false ? 'error' : '') + '">' + escapeHtml(state.message) + '</div>' : '',
      '<div class="tos-eric-log">' + (state.logs.length ? state.logs.map(function (line) { return '<div>' + escapeHtml(line) + '</div>'; }).join('') : '<div>\u5904\u7406\u8bb0\u5f55\u4f1a\u663e\u793a\u5728\u8fd9\u91cc\u3002</div>') + '</div>',
      '</section>',
      '</div>'
    ].join('');

    bindPageEvents(page);
  }

  function bindPageEvents(page) {
    var input = page.querySelector('#tos-eric-file');
    var picker = page.querySelector('[data-eric-pick]');
    if (picker && input) {
      picker.addEventListener('click', function () {
        input.value = '';
        input.click();
      });
      picker.addEventListener('dragover', function (event) {
        event.preventDefault();
        picker.classList.add('dragging');
      });
      picker.addEventListener('dragleave', function () {
        picker.classList.remove('dragging');
      });
      picker.addEventListener('drop', function (event) {
        event.preventDefault();
        picker.classList.remove('dragging');
        var files = event.dataTransfer && event.dataTransfer.files;
        setSelectedFile(files && files[0] ? files[0] : null);
      });
    }
    if (input) {
      input.addEventListener('change', function (event) {
        setSelectedFile(event.target.files && event.target.files[0] ? event.target.files[0] : null);
      });
    }
    var remove = page.querySelector('[data-eric-remove]');
    if (remove) {
      remove.addEventListener('click', function () {
        state.file = null;
        state.message = '';
        state.success = null;
        state.outputFile = '';
        state.rowCount = '-';
        state.logs = [];
        renderPage();
      });
    }
    var reset = page.querySelector('[data-eric-reset]');
    if (reset) {
      reset.addEventListener('click', function () {
        state.file = null;
        state.processing = false;
        state.success = null;
        state.message = '';
        state.logs = [];
        state.outputFile = '';
        state.rowCount = '-';
        renderPage();
      });
    }
    var run = page.querySelector('[data-eric-run]');
    if (run) run.addEventListener('click', processFile);
    var download = page.querySelector('[data-eric-download]');
    if (download) {
      download.addEventListener('click', function () {
        if (state.outputFile) {
          window.open(API_BASE + '/download/' + encodeURIComponent(state.outputFile), '_blank');
        }
      });
    }
  }

  function setSelectedFile(file) {
    if (file && !/\.(xlsx|xlsm)$/i.test(file.name || '')) {
      state.file = null;
      state.success = false;
      state.message = '\u8bf7\u9009\u62e9 .xlsx / .xlsm Excel \u6587\u4ef6';
      state.outputFile = '';
      state.rowCount = '-';
      state.logs = [state.message];
      renderPage();
      return;
    }
    state.file = file;
    state.message = '';
    state.success = null;
    state.outputFile = '';
    state.rowCount = '-';
    state.logs = [];
    renderPage();
  }

  async function processFile() {
    if (!state.file || state.processing) return;
    state.processing = true;
    state.success = null;
    state.message = '';
    state.logs = [];
    state.outputFile = '';
    state.rowCount = '-';
    renderPage();

    try {
      var formData = new FormData();
      formData.append('excel_file', state.file);
      var response = await fetch(API_BASE + '/process', {
        method: 'POST',
        body: formData
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || '\u5904\u7406\u8bf7\u6c42\u5931\u8d25');
      }
      state.success = !!payload.success;
      state.message = payload.message || (payload.success ? '\u5904\u7406\u5b8c\u6210' : '\u5904\u7406\u5931\u8d25');
      state.logs = Array.isArray(payload.logs) ? payload.logs : [];
      state.outputFile = payload.output_file || '';
      state.rowCount = payload.row_count == null ? '-' : String(payload.row_count);
    } catch (error) {
      state.success = false;
      state.message = error && error.message ? error.message : '\u5904\u7406\u5931\u8d25';
      state.logs = [state.message];
    } finally {
      state.processing = false;
      renderPage();
    }
  }

  function sync() {
    ensureStyle();
    ensureNav();
    updateNavActive();
    if (routePath() === ROUTE) {
      setTopbar();
      renderPage();
    } else {
      restoreContent();
    }
  }

  function schedule() {
    window.clearTimeout(schedule.timer);
    schedule.timer = window.setTimeout(sync, 120);
  }

  function start() {
    schedule();
    window.addEventListener('hashchange', schedule);
    window.addEventListener('popstate', schedule);
    var observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
