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

Known routes from the recovered bundle:

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

## Phases

1. Baseline lock

   Keep `recovered-frontend` packaged by default. Capture route catalog,
   navigation labels, Electron bridge APIs, and backend endpoints.

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

4. Packaging switch

   Switch Electron packaging from `recovered-frontend` to `tms-frontend/dist`
   only after all production routes pass parity.

5. Cleanup

   Archive the recovered bundle as reference material after source parity is
   complete.

## Do Not Do

- Do not generate a new app shell with a different navigation model.
- Do not merge the old `codex/frontend-shell` branch into `main`.
- Do not replace current business workflows with placeholder pages.
- Do not modify the minified bundle for long-term feature work unless it is an
  emergency hotfix.
