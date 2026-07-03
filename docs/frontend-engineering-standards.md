# Frontend Engineering Standards

These rules apply to the TOS frontend rebuild. The goal is to keep the current
product UI while replacing recovered bundled assets with maintainable source.
`AGENTS.md` defines the mandatory AI execution rules; this document explains
the frontend-specific implementation standard.

## Source Ownership

- `tms-electron-app/recovered-frontend` is the fallback reference baseline.
- `tms-frontend/src` is the rebuild workspace.
- Do not redesign pages while rebuilding them.
- Keep Electron packaging wired to `tms-frontend/dist` after parity checks pass.
- Do not merge AI-generated frontend changes directly to `main`.

## Structure

- `src/app`: app bootstrap, routing, app shell.
- `src/domain`: module catalog, route metadata, business constants.
- `src/features/<feature>`: feature pages, feature components, feature API.
- `src/shared/api`: HTTP and Electron bridge clients.
- `src/shared/ui`: reusable UI components.
- `src/shared/styles`: reset, tokens, Element Plus overrides.
- `src/types`: shared TypeScript declarations.

## Naming

- Vue components use `PascalCase.vue`.
- Pages use `<FeatureName>Page.vue`.
- Composables use `useThing.ts`.
- API files use `<feature>Api.ts`.
- Props interfaces use `<ComponentName>Props`.
- Emits types use `<ComponentName>Emits`.
- Domain ids use stable kebab-case strings matching routes and backend modules.

## Props And State

- Props must be typed with `defineProps<T>()`.
- Optional props must use explicit defaults with `withDefaults`.
- Emits must be typed with `defineEmits<T>()` when payloads are involved.
- Avoid untyped `ref({})`, `reactive({})`, and broad `Record<string, any>`;
  model page state with named interfaces or narrow union types.
- Components should not fetch data unless data ownership is local to that
  component.
- Keep form state local to pages or feature composables.
- Use a store only for cross-route state, cached registries, or app-wide session
  state.
- Do not add global mutable singletons for page-specific state.
- UI state must cover loading, empty, error, disabled, and success/result states
  when those states are reachable from the workflow.

## API Access

- Components must not call `fetch` directly.
- Backend calls go through `src/shared/api` or a feature API module.
- Electron bridge calls go through a typed wrapper over `window.electronAPI`.
- Request and response shapes must be typed.
- File upload APIs must expose progress handling consistently.
- Direct local executor calls are allowed only for explicitly whitelisted
  automation executor/launcher boundaries, and the whitelist must be locked by
  `scripts/engineering/frontend-direct-fetch-boundary.test.mjs`.
- API modules should normalize backend errors into user-facing messages without
  leaking internal paths, stack traces, tokens, or server-only URLs.

## Component Boundaries

- Pages own business fields, button text, request parameter mapping, result
  summary conversion, and process-history module ids.
- Shared upload, precheck, result, diagnostics, process history, and file-list
  behavior belongs in `src/shared/ui` or `src/shared/process`.
- Do not create a page-local duplicate of an existing shared component unless
  the business behavior is materially different and the reason is documented in
  the change summary.
- When sidebar navigation and route names already express a subprocess, do not
  add a large in-content process switcher.
- Keep feature-specific helpers near the feature; promote to `shared` only when
  at least two real consumers need the same behavior.

## Automation Helper Versioning

- Every automation-helper capability change must be covered by a Conventional Commit so `semantic-release` can bump the shared product version in `app-version.json`, `tms-electron-app/package.json`, and `tms-backend/app_version.py` before release.
- Installer artifacts must include the version in the filename, for example `TOS-Desktop-Setup.<version>.exe`, `TOS-Desktop-Full-Setup.<version>.exe`, and `TOS-Automation-Helper-Setup.<version>.exe`.
- Browser pages that depend on local helper endpoints must compare the local helper version from `127.0.0.1:3210/health` with the expected frontend version.
- If the local helper version is missing or behind, the page must show a user-facing update dialog with current version, expected version, and a download action.
- Missing local helper routes or missing helper entry files must be treated as update-required errors, not as generic launch failures.
- Release upload scripts must keep a stable latest download object for compatibility and also upload a versioned archive/object for traceability.

## Styles

- Global CSS is limited to reset, design tokens, and approved Element Plus
  overrides.
- Component styles are scoped by default.
- Page-specific layout styles stay with the page or feature.
- No broad selectors such as `div`, `button`, or `.el-*` outside shared style
  files.
- Do not create a new visual language; match the recovered TOS UI.
- Excel-processing pages should reuse the shared page shell, upload section,
  precheck panel, result summary, process history, and `jane-page.scss` layout
  styles instead of defining a parallel local layout.

## AI Change Intake

Before accepting generated code:

- Check that the route and module id already exist in the catalog, or add them
  deliberately.
- Check that component names and props follow this standard.
- Check that no page duplicates an existing upload, process-result, module-card,
  log, or diagnostics component.
- Check that Excel-processing pages keep only business differences in the page:
  fields, button text, API parameter mapping, result-summary conversion, and
  history module ids.
- Check that pages do not add large in-content process switchers when sidebar
  navigation and route names already express the subprocess.
- Check that no new raw API call bypasses the shared API layer.
- Check that reachable loading, empty, error, disabled, and success/result
  states render without overflowing or hiding controls.
- Run the closest real checks for the scope: usually `npm run lint`,
  `npm run typecheck`, relevant `vitest`, and `npm run build` only when the
  change needs build-output confidence.

## Merge Gate

A frontend PR must include:

- Scope statement: route or feature changed.
- Parity note: what recovered UI behavior was matched.
- Validation result from the closest real command.
- Typecheck result when TypeScript code changed.
- Manual browser or Electron smoke result when the change is user-facing.
