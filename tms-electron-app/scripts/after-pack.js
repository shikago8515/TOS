const {
  syncAutomationApps,
  verifyAutomationApps,
  syncBackendRuntime,
  verifyBackendRuntime,
} = require('./run-pack-default')
const { verifyRendererPackage } = require('./verify-renderer-package')

exports.default = async function afterPack(context) {
  const appOutDir = context?.appOutDir
  if (!appOutDir) {
    throw new Error('electron-builder afterPack context is missing appOutDir')
  }

  // electron-builder 的 extraResources 偶尔会漏掉运行时文件，打包后再做一次完整覆盖和校验。
  syncAutomationApps(appOutDir)
  verifyAutomationApps(appOutDir)
  syncBackendRuntime(appOutDir)
  verifyBackendRuntime(appOutDir)
  verifyRendererPackage(appOutDir)
}
