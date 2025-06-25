const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

const isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../client/build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let serverStarted = false;

function checkServerHealth() {
  const http = require('http');
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5002/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startServer() {
  if (!serverStarted) {
    console.log('Starting server process...');
    const serverPath = isDev ? 
      path.join(__dirname, '../server/index.js') : 
      path.join(process.resourcesPath, 'server/index.js');
    console.log('Server path:', serverPath);
    console.log('isDev:', isDev);
    
    try {
      const serverCwd = isDev ? 
        path.join(__dirname, '../server') : 
        path.join(process.resourcesPath, 'server');
      
      serverProcess = fork(serverPath, {
        silent: false,
        cwd: serverCwd,
        env: { ...process.env, PORT: '5002', ELECTRON_APP: 'true' }
      });

      serverProcess.on('error', (error) => {
        console.error('Server process error:', error);
        serverStarted = false;
      });

      serverProcess.on('exit', (code) => {
        console.log('Server process exited with code ' + code);
        serverStarted = false;
        if (code !== 0) {
          console.log('Server failed to start, running in client-only mode');
        }
      });

      serverProcess.on('spawn', () => {
        console.log('Server process spawned successfully');
        serverStarted = true;
        // サーバーヘルスチェック
        setTimeout(async () => {
          const isHealthy = await checkServerHealth();
          console.log('Server health check:', isHealthy ? 'OK' : 'Failed');
          if (!isHealthy) {
            console.log('Retrying server health check in 5 seconds...');
            setTimeout(async () => {
              const retryHealthy = await checkServerHealth();
              console.log('Retry health check:', retryHealthy ? 'OK' : 'Failed');
            }, 5000);
          }
        }, 2000);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      serverStarted = false;
    }
  }
}

app.whenReady().then(() => {
  // サーバーを最初に起動
  startServer();
  
  // サーバー起動後にウィンドウを表示
  setTimeout(() => {
    createWindow();
  }, isDev ? 0 : 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    console.log('Terminating server process...');
    serverProcess.kill();
  }
});