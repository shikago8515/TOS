(function () {
  'use strict';

  var APP_VERSION = 'v0.9.6-beta.1';
  var OWNER_TEXT = 'DG\u8fd0\u8425\u90e8';
  var LABEL_APP = '\u5e94\u7528';
  var LABEL_MODULE = '\u6a21\u5757';

  // Pre-release module versions. Update the matching entry on every module change.
  var MODULE_PAGE_VERSIONS = {
    '/jessca': {
      module: 'Jessca',
      version: 'v0.9.0-beta.1',
      status: 'Beta'
    },
    '/sophia-tina': {
      module: 'Sophia & Tina',
      version: 'v0.9.0-beta.1',
      status: 'Beta'
    },
    '/jane': {
      module: 'Jane',
      version: 'v0.9.1-beta.1',
      status: 'Beta'
    },
    '/eric': {
      module: 'Eric',
      version: 'v0.1.2-alpha.1',
      status: 'Alpha'
    },
    '/browser-plugins': {
      module: '\u6d4f\u89c8\u5668\u63d2\u4ef6',
      version: 'v0.4.1-alpha.1',
      status: 'Alpha'
    },
    '/infornexus': {
      module: '\u6d4f\u89c8\u5668\u63d2\u4ef6',
      version: 'v0.4.1-alpha.1',
      status: 'Alpha'
    },
    '/web-automation': {
      module: '\u7f51\u9875\u81ea\u52a8\u5316',
      version: 'v0.5.0-alpha.1',
      status: 'Alpha'
    },
    '/adidas-materials': {
      module: 'adidas \u6750\u6599',
      version: 'v0.9.1-beta.1',
      status: 'Beta'
    }
  };

  window.__TOS_APP_VERSION__ = APP_VERSION;
  window.__TOS_MODULE_PAGE_VERSIONS__ = MODULE_PAGE_VERSIONS;

  function routePath() {
    var hashPath = String(window.location.hash || '').replace(/^#/, '').split('?')[0];
    var browserPath = String(window.location.pathname || '').split('?')[0];
    var path = hashPath || browserPath || '';
    if (path.charAt(0) !== '/') path = '/' + path;
    return path.toLowerCase().replace(/\/$/, '');
  }

  function currentModuleConfig() {
    var path = routePath();
    return MODULE_PAGE_VERSIONS[path] || null;
  }

  function ensureStyle() {
    if (document.getElementById('tos-module-version-style')) return;
    var style = document.createElement('style');
    style.id = 'tos-module-version-style';
    style.textContent = [
      '.tos-page-version-bar, .tos-module-version-badge { display: none !important; }',
      '.sidebar-footer { padding: 13px 14px !important; }',
      '.sidebar-footer .version-info { width: 100%; }',
      '.tos-version-panel {',
      '  display: grid;',
      '  gap: 5px;',
      '  width: 100%;',
      '  color: #94a3b8;',
      '  font-size: 12px;',
      '  line-height: 1.35;',
      '  letter-spacing: 0;',
      '}',
      '.tos-version-line {',
      '  display: grid;',
      '  grid-template-columns: 38px minmax(0, 1fr);',
      '  align-items: center;',
      '  gap: 7px;',
      '  min-width: 0;',
      '}',
      '.tos-version-label {',
      '  color: #64748b;',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '}',
      '.tos-version-value {',
      '  color: #cbd5e1;',
      '  font-size: 12px;',
      '  font-weight: 800;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.tos-version-module .tos-version-value { color: #93c5fd; }',
      '.tos-version-status {',
      '  color: #facc15;',
      '  font-size: 11px;',
      '  font-weight: 800;',
      '}',
      '.tos-version-owner {',
      '  color: #64748b;',
      '  font-size: 11px;',
      '  margin-top: 2px;',
      '  text-align: center;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildFooterHtml(moduleConfig) {
    var moduleLine = '';
    if (moduleConfig) {
      moduleLine = [
        '<div class="tos-version-line tos-version-module">',
        '<span class="tos-version-label">',
        escapeHtml(LABEL_MODULE),
        '</span>',
        '<span class="tos-version-value" title="',
        escapeHtml(moduleConfig.module + ' ' + moduleConfig.version + ' ' + moduleConfig.status),
        '">',
        escapeHtml(moduleConfig.module),
        ' ',
        escapeHtml(moduleConfig.version),
        ' <span class="tos-version-status">',
        escapeHtml(moduleConfig.status),
        '</span></span>',
        '</div>'
      ].join('');
    }

    return [
      '<div class="tos-version-panel">',
      '<div class="tos-version-line">',
      '<span class="tos-version-label">',
      escapeHtml(LABEL_APP),
      '</span>',
      '<span class="tos-version-value" title="',
      escapeHtml(APP_VERSION),
      '">',
      escapeHtml(APP_VERSION),
      '</span>',
      '</div>',
      moduleLine,
      '<div class="tos-version-owner">',
      escapeHtml(OWNER_TEXT),
      '</div>',
      '</div>'
    ].join('');
  }

  function updateSidebarVersion() {
    ensureStyle();

    document.querySelectorAll('.tos-module-version-badge').forEach(function (badge) {
      badge.remove();
    });

    var footer = document.querySelector('.sidebar-footer .version-info') || document.querySelector('.sidebar-footer');
    if (!footer) return;

    var html = buildFooterHtml(currentModuleConfig());
    if (footer.innerHTML !== html) {
      footer.innerHTML = html;
    }
  }

  function scheduleUpdate() {
    window.clearTimeout(scheduleUpdate.timer);
    scheduleUpdate.timer = window.setTimeout(updateSidebarVersion, 80);
  }

  function start() {
    scheduleUpdate();
    window.addEventListener('hashchange', scheduleUpdate);
    window.addEventListener('popstate', scheduleUpdate);

    var observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
