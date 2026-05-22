const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let backendProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    title: 'TMS报表自动化工具'
  });

  // 检查是开发模式还是生产模式
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../tms-frontend/dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 新窗口打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendDir = path.join(__dirname, '../tms-backend');
    const pythonPath = 'python'; // 生产环境可能需要调整
    
    try {
      console.log('正在启动后端服务...');
      
      // 启动 Python 后端
      backendProcess = spawn(pythonPath, ['main.py'], {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });

      backendProcess.stdout.on('data', (data) => {
        console.log(`后端输出: ${data}`);
        // 简单检查是否启动成功
        if (data.toString().includes('Application startup complete') || 
            data.toString().includes('Uvicorn running on')) {
          resolve();
        }
      });

      backendProcess.stderr.on('data', (data) => {
        console.error(`后端错误: ${data}`);
      });

      backendProcess.on('close', (code) => {
        console.log(`后端进程退出, 代码: ${code}`);
        backendProcess = null;
      });

      // 超时检查
      setTimeout(() => {
        resolve(); // 假设启动成功
      }, 3000);

    } catch (error) {
      console.error('启动后端失败:', error);
      reject(error);
    }
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('正在停止后端服务...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('启动错误', '无法启动后端服务，请检查 Python 环境是否正确配置。');
    console.error(error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理器
ipcMain.handle('get-backend-url', () => {
  return 'http://localhost:8000';
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});
