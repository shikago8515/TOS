# Frontend Engineering Standards

These rules apply to the TOS frontend rebuild. The goal is to keep the current
product UI while replacing recovered bundled assets with maintainable source.

## Source Ownership

- `tms-electron-app/recovered-frontend` is the current runtime baseline.
- `tms-frontend/src` is the rebuild workspace.
- Do not redesign pages while rebuilding them.
- Do not wire rebuilt pages into Electron packaging until parity checks pass.
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
- Components should not fetch data unless data ownership is local to that
  component.
- Keep form state local to pages or feature composables.
- Use a store only for cross-route state, cached registries, or app-wide session
  state.
- Do not add global mutable singletons for page-specific state.

## API Access

- Components must not call `fetch` directly.
- Backend calls go through `src/shared/api` or a feature API module.
- Electron bridge calls go through a typed wrapper over `window.electronAPI`.
- Request and response shapes must be typed.
- File upload APIs must expose progress handling consistently.

## Styles

- Global CSS is limited to reset, design tokens, and approved Element Plus
  overrides.
- Component styles are scoped by default.
- Page-specific layout styles stay with the page or feature.
- No broad selectors such as `div`, `button`, or `.el-*` outside shared style
  files.
- Do not create a new visual language; match the recovered TOS UI.

## AI Change Intake

Before accepting generated code:

- Check that the route and module id already exist in the catalog, or add them
  deliberately.
- Check that component names and props follow this standard.
- Check that no page duplicates an existing upload, process-result, module-card,
  log, or diagnostics component.
- Check that no new raw API call bypasses the shared API layer.
- Run typecheck, lint, build, and route parity checks before merge.

## Merge Gate

A frontend PR must include:

- Scope statement: route or feature changed.
- Parity note: what recovered UI behavior was matched.
- Build result.
- Typecheck result.
- Manual smoke result against Electron when applicable.
