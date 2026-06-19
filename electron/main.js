const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { fork, spawn } = require('child_process');

const isDev = process.argv.includes('--dev');

let mainWindow;
let serverProcess;
let sessionDir = null;
// dev はプロキシ経由の固定ポート、本番はサーバーから通知された動的ポートを使用
let apiPort = isDev ? 5002 : null;

function createWindow() {
  // server-ready 通知とフォールバックの二重生成を防止
  if (mainWindow) {
    return;
  }
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
    // 動的ポートをクエリ文字列でレンダラーへ渡す
    const loadOptions = apiPort ? { search: 'apiPort=' + apiPort } : {};
    mainWindow.loadFile(path.join(__dirname, '../client/build/index.html'), loadOptions);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let serverStarted = false;

function checkServerHealth() {
  const http = require('http');
  return new Promise((resolve) => {
    if (!apiPort) {
      resolve(false);
      return;
    }
    const req = http.get('http://localhost:' + apiPort + '/health', (res) => {
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

      // 複数起動に対応するため、本番では動的ポート(0)とインスタンス固有の
      // 作業ディレクトリを使用し、インスタンス間の競合・干渉を防止する
      const serverEnv = { ...process.env, ELECTRON_APP: 'true' };
      if (isDev) {
        serverEnv.PORT = '5002';
      } else {
        serverEnv.PORT = '0';
        sessionDir = path.join(os.tmpdir(), 'vrt-app-' + process.pid + '-' + Date.now());
        serverEnv.VRT_SESSION_DIR = sessionDir;
      }

      serverProcess = fork(serverPath, {
        silent: false,
        cwd: serverCwd,
        env: serverEnv
      });

      serverProcess.on('message', (msg) => {
        if (msg && msg.type === 'server-ready' && msg.port) {
          apiPort = msg.port;
          console.log('Server ready on port ' + apiPort);
          createWindow();
        }
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

// アプリの新しいインスタンスを別プロセスとして起動する
// （macOS はダブルクリックでは単一インスタンスにフォーカスするため、
//  明示的に新規インスタンスを立ち上げる手段を提供する）
function launchNewInstance() {
  if (process.platform === 'darwin' && app.isPackaged) {
    // .app バンドルのパスを取得し、open -n で新規インスタンスを強制起動
    // exe: <bundle>/Contents/MacOS/<name> → 3つ上が .app バンドル
    const appBundle = path.resolve(app.getPath('exe'), '..', '..', '..');
    spawn('open', ['-n', appBundle], { detached: true, stdio: 'ignore' }).unref();
  } else if (app.isPackaged) {
    // Windows / Linux: 実行ファイルを直接起動
    spawn(process.execPath, [], { detached: true, stdio: 'ignore' }).unref();
  } else {
    // 開発時: electron にプロジェクトディレクトリを渡して起動
    const args = [path.resolve(__dirname, '..')];
    if (isDev) {
      args.push('--dev');
    }
    spawn(process.execPath, args, { detached: true, stdio: 'ignore' }).unref();
  }
}

ipcMain.handle('launch-new-instance', () => {
  try {
    launchNewInstance();
    return { success: true };
  } catch (error) {
    console.error('Failed to launch new instance:', error);
    return { success: false, message: error.message };
  }
});

app.whenReady().then(() => {
  // サーバーを最初に起動
  startServer();

  // 本番はサーバーの server-ready 通知でウィンドウを生成するが、
  // 通知が届かない場合に備えてフォールバックでも生成する
  setTimeout(() => {
    createWindow();
  }, isDev ? 0 : 8000);

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
  // インスタンス固有の一時ディレクトリを破棄
  if (sessionDir) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up session dir:', error);
    }
  }
});
