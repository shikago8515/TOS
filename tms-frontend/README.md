# tms-frontend

`tms-frontend` 是 TOS 当前长期维护的前端源码工作区。恢复出的打包前端保留在：

```text
../tms-electron-app/recovered-frontend
```

该恢复包只作为视觉和行为基线。默认 Electron 打包使用本目录生成的 `dist`；只有紧急回退时才设置 `TOS_FRONTEND_SOURCE=recovered`。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- Sass
- Vitest

当前项目未配置 ESLint 或 Prettier，不要在交付说明中声称已运行这些命令。

## 命令

```powershell
npm run dev
npm run typecheck
npm run test
npm run build
npm run preview
```

当前端口：

- dev：`http://127.0.0.1:5174`
- preview：`http://127.0.0.1:4174`

## 源码约定

- 后端请求通过 `src/shared/api/backendClient.ts` 或页面级 API 模块封装。
- 导航和模块元数据来自 `src/domain/moduleCatalog.ts`。
- 路由定义来自 `src/app/routeCatalog.ts` 和 `src/app/router.ts`。
- 文件上传、进度、结果展示和处理历史优先复用 `src/shared/ui` 与 `src/shared/process`。
- 页面组件使用 Vue 3 Composition API 和 `<script setup>`。
- 组件样式默认 scoped；全局 CSS 仅用于 reset、design tokens 和项目级基础样式。

## 当前重建状态

已有源码级页面包括：

- `/`
- `/jessca`
- `/sophia-tina`
- `/jane`
- `/jane-bom-summary`
- `/jane-bom-compare`
- `/jane-outbound-compare`
- `/eric`
- `/browser-plugins`
- `/web-automation`
- `/infornexus`
- `/jane-sap`
- `/eric-infornexus`
- `/adidas-materials`
- `/settings`

`placeholder` 路由使用 `src/pages/RoutePlaceholder.vue`。

## 迁移规则

不要用全新设计替换恢复基线。新增或调整页面时，按一个路由一个路由迁移，对照恢复 UI 保持原产品体验，并运行最接近的真实检查命令。
