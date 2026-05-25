const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  startBackendServer: () => ipcRenderer.invoke('start-backend-server'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  recordDiagnosticEvent: (event) => ipcRenderer.invoke('record-diagnostic-event', event),
  exportDiagnosticsPackage: () => ipcRenderer.invoke('export-diagnostics-package'),
  getExternalModules: () => ipcRenderer.invoke('get-external-modules'),
  launchExternalModule: (moduleId) => ipcRenderer.invoke('launch-external-module', moduleId),
  getBrowserPlugins: () => ipcRenderer.invoke('get-browser-plugins'),
  launchBrowserPlugin: (pluginId) => ipcRenderer.invoke('launch-browser-plugin', pluginId),
  getAutomationApps: () => ipcRenderer.invoke('get-automation-apps'),
  launchAutomationApp: (appId) => ipcRenderer.invoke('launch-automation-app', appId),
  stopAutomationApp: (appId) => ipcRenderer.invoke('stop-automation-app', appId),
  launchAdidasMaterialCollector: () => ipcRenderer.invoke('launch-adidas-material-collector')
});
