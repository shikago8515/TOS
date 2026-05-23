# tms-frontend

This directory is the long-term source rebuild workspace for the current TOS
frontend.

The recovered packaged UI is preserved for reference and fallback in:

`../tms-electron-app/recovered-frontend`

That recovered bundle remains the visual and behavior baseline. The default
Electron package now builds and copies `tms-frontend/dist`; set
`TOS_FRONTEND_SOURCE=recovered` only when an emergency fallback is needed.

Target stack:

- Vue 3
- TypeScript
- Vite
- Vue Router
- Element Plus
- shared API clients
- reusable upload, process, diagnostics, and module-card components

Current rebuild status:

- `/` has a first source-level equivalent page in `src/pages/home`.
- `/jessca` has a first source-level equivalent page in `src/pages/jessca`.
- `/sophia-tina` has a first source-level equivalent page in `src/pages/sophia-tina`.
- `/jane` has a first source-level equivalent page in `src/pages/jane`.
- `/eric` has a first source-level equivalent page in `src/pages/eric`.
- `/browser-plugins` has a first source-level equivalent page in `src/pages/browser-plugins`.
- `/web-automation` has a first source-level equivalent page in `src/pages/web-automation`.
- `/adidas-materials` has a first source-level equivalent page in `src/pages/adidas-materials`.
- Placeholder routes use the recovered "功能开发中" state through `src/pages/RoutePlaceholder.vue`.
- Shared homepage UI lives in `src/shared/ui`.
- Navigation and route titles come from `src/domain/moduleCatalog.ts`.
- Electron packaging copies `tms-frontend/dist` by default; `npm run
  pack:source` in `../tms-electron-app` still creates a separate
  source-frontend smoke package.

Migration rule:

Do not replace the recovered UI with a new design. Rebuild one route at a time,
compare future changes against the recovered UI, and keep the default Electron
package on `tms-frontend/dist` unless a production fallback is required.
