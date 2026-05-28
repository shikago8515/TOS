# Legacy Packaging Archive

这些文件是历史恢复阶段留下的旧入口或旧别名，不再参与当前正式打包流程。

当前正式入口：

- `npm run build:win`: 生成正式 Windows NSIS 安装包。
- `npm run pack`: 生成本地 `win-unpacked` 测试包。
- `npm run pack:source`: 保留源码前端独立冒烟包。

归档原因：

- `build.ps1` 使用旧的手工复制流程，会清理 `dist`，且不覆盖当前后端 runtime、发布校验和更新元数据流程。
- `main.js` 是旧 Electron 主进程入口，`package.json` 当前入口是 `main-simple.js`。
- `scripts/pack-portable-release.js` 是旧 portable/独立包入口，当前不再生成或发布 `TOS_vx.x.x_Portable.exe`。
- `scripts/build-source-frontend.js`、`scripts/pack-unpacked.js`、`scripts/pack-source-unpacked.js` 是旧 wrapper，已被 `package.json` 中的 npm scripts 直接入口替代。

`package.json` 的 `build.files` 已排除 `archive/**/*`，避免这些历史文件进入安装包。
