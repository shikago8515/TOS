# Frontend Rebuild Roadmap

The current packaged UI is preserved from the original app. The long-term work is
to rebuild that UI as maintainable Vue + TypeScript source without changing the
product experience.

## Baseline

Recovered runtime frontend:

`tms-electron-app/recovered-frontend`

Recovered entry files:

- `index.html`
- `excel-page-versions.js`
- `eric-module.js`
- `upload-layout-fix.css`
- `assets/index-COwNHm1K.js`
- `assets/index-eQdTsAfm.css`

Historical routes from the recovered bundle:

- `/` - 首页
- `/jessca` - 对账核对
- `/sophia-tina` - 报表合并
- `/jane` - 成品表生成
- `/eric` - Excel数据处理整合工具-Eric
- `/browser-plugins` - 浏览器插件（测试）
- `/web-automation` - 网页自动化（测试）
- `/adidas-materials` - adidas 材料收集器
- `/module-a` - 模块 A
- `/module-b` - 模块 B
- `/settings` - 系统设置

当前源码路由以 `tms-frontend/src/domain/moduleCatalog.ts` 和 `tms-frontend/src/app/router.ts` 为准。当前已接入的源码入口包括 `/jessca`、`/draft-packing-compare`、`/jason/pdf-reorder`、`/tms-finance-internal-reconciliation`、`/tms-finance-work-sales`、`/iplex/dual-table-compare`、`/jane-infornexus`、`/eric-infornexus`、`/web-automation/scenarios/shipping-automation`、`/web-automation/scenarios/xinlongtai-shipping-automation`、`/web-automation/scenarios/po-auto-download` 和 `/release-updates` 等。旧 `/browser-plugins` 与 `/jessica-infornexus` 只保留兼容重定向；`/module-a`、`/module-b` 不再是当前模块目录入口。

## Phases

1. Baseline lock - complete

   The recovered bundle was kept as the default while route catalog,
   navigation labels, Electron bridge APIs, and backend endpoints were captured.

2. Source skeleton

   Build the `tms-frontend/src` structure around the route and module catalog.
   Add typed Electron and backend API wrappers before rebuilding pages.

3. Page parity

   Rebuild one route at a time. For each route, compare:

   - route path and title
   - visible text
   - primary controls
   - file upload behavior
   - backend/Electron calls
   - responsive layout

4. Packaging switch - complete

   Electron packaging now builds and copies `tms-frontend/dist` by default.
   `recovered-frontend` remains available as a fallback reference through
   `TOS_FRONTEND_SOURCE=recovered`.

5. Cleanup

   Keep the recovered bundle as reference material until a longer production
   burn-in confirms the source frontend can fully replace it.

## Do Not Do

- Do not generate a new app shell with a different navigation model.
- Do not merge the old `codex/frontend-shell` branch into `main`.
- Do not replace current business workflows with placeholder pages.
- Do not modify the minified bundle for long-term feature work unless it is an
  emergency hotfix.
