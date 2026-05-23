# tms-frontend

This directory is the long-term source rebuild workspace for the current TOS
frontend.

The active packaged UI is still preserved in:

`../tms-electron-app/recovered-frontend`

That recovered bundle is the visual and behavior baseline. Rebuild work in this
directory must match the current UI before Electron packaging is switched over to
use it.

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
- Electron packaging still copies `../tms-electron-app/recovered-frontend` by
  default; `npm run pack:source` in `../tms-electron-app` creates a separate
  source-frontend smoke package.

Migration rule:

Do not replace the recovered UI with a new design. Rebuild one route at a time,
compare against the recovered UI, then wire the rebuilt route into packaging only
after parity is verified.
