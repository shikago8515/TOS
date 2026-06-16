const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  startBackendServer: () => ipcRenderer.invoke('start-backend-server'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openManualDownload: () => ipcRenderer.invoke('open-manual-download'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update-status', listener);
    return () => {
      ipcRenderer.removeListener('update-status', listener);
    };
  },
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
  selectDirectory: (options) => ipcRenderer.invoke('select-directory', options),
  launchAdidasMaterialCollector: () => ipcRenderer.invoke('launch-adidas-material-collector')
});
