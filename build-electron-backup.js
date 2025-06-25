#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Electronアプリのビルドスクリプト
 * 1. Reactクライアントのビルド
 * 2. サーバーの準備
 * 3. Electronのビルド
 */

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: isWin,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildClient() {
  console.log('🔨 Building React client...');
  process.chdir(path.join(__dirname, 'client'));
  await runCommand('npm', ['run', 'build']);
  console.log('✅ Client build completed');
}

async function prepareElectronPackage() {
  console.log('📦 Preparing Electron package.json...');
  
  const electronPackage = {
    name: 'vrt-app',
    version: '1.0.0',
    description: 'Visual Regression Testing Application',
    main: 'electron/main.js',
    author: 'VRT Team',
    license: 'MIT',
    scripts: {
      'electron': 'electron .',
      'electron-dev': 'electron . --dev',
      'build-mac': 'electron-builder --mac',
      'build-win': 'electron-builder --win',
      'build-linux': 'electron-builder --linux',
      'build-all': 'electron-builder --mac --win --linux'
    },
    devDependencies: {
      'electron': '^27.0.0',
      'electron-builder': '^24.6.4'
    },
    build: {
      appId: 'com.vrt.app',
      productName: 'VRT App',
      directories: {
        output: 'dist'
      },
      files: [
        'electron/**/*',
        'client/build/**/*',
        'server/**/*',
        '!server/node_modules/**/*',
        '!server/screenshots/**/*',
        '!server/uploads/**/*',
        '!server/diffs/**/*'
      ],
      mac: {
        target: [
          {
            target: 'dmg',
            arch: ['arm64', 'x64']
          },
          {
            target: 'zip',
            arch: ['arm64', 'x64']
          }
        ],
        icon: 'electron/assets/icon.icns'
      },
      win: {
        target: [
          {
            target: 'nsis',
            arch: ['x64', 'ia32']
          },
          {
            target: 'zip',
            arch: ['x64', 'ia32']
          }
        ],
        icon: 'electron/assets/icon.ico'
      },
      linux: {
        target: [
          {
            target: 'AppImage',
            arch: ['x64']
          },
          {
            target: 'deb',
            arch: ['x64']
          }
        ],
        icon: 'electron/assets/icon.png'
      },
      publish: null
    }
  };

  process.chdir(__dirname);
  fs.writeFileSync('package.json', JSON.stringify(electronPackage, null, 2));
  console.log('✅ Electron package.json created');
}

async function createElectronMain() {
  console.log('⚡ Creating Electron main process...');
  
  const electronDir = path.join(__dirname, 'electron');
  if (!fs.existsSync(electronDir)) {
    fs.mkdirSync(electronDir, { recursive: true });
  }

  const mainJs = `const { app, BrowserWindow, Menu } = require('electron');
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

  // メニューの設定
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

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

function startServer() {
  if (!isDev) {
    console.log('Starting server process...');
    serverProcess = fork(path.join(__dirname, '../server/index.js'), {
      silent: false
    });

    serverProcess.on('error', (error) => {
      console.error('Server process error:', error);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
    });
  }
}

app.whenReady().then(() => {
  startServer();
  
  // サーバー起動を待ってからウィンドウを作成
  setTimeout(createWindow, isDev ? 0 : 2000);

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
`;

  fs.writeFileSync(path.join(electronDir, 'main.js'), mainJs);

  const preloadJs = `// Preload script for Electron security
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ここに必要なAPIを追加
});
`;

  fs.writeFileSync(path.join(electronDir, 'preload.js'), preloadJs);

  // アイコンディレクトリの作成
  const assetsDir = path.join(electronDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('✅ Electron main process files created');
}

async function installElectronDependencies() {
  console.log('📦 Installing Electron dependencies...');
  process.chdir(__dirname);
  
  try {
    await runCommand('npm', ['install']);
    console.log('✅ Electron dependencies installed');
  } catch (error) {
    console.error('Failed to install dependencies:', error.message);
    throw error;
  }
}

async function buildElectron(platform = 'current') {
  console.log(`🚀 Building Electron app for ${platform}...`);
  process.chdir(__dirname);

  let buildArgs = [];
  
  switch (platform) {
    case 'mac':
      buildArgs = ['run', 'build-mac'];
      break;
    case 'win':
      buildArgs = ['run', 'build-win'];
      break;
    case 'linux':
      buildArgs = ['run', 'build-linux'];
      break;
    case 'all':
      buildArgs = ['run', 'build-all'];
      break;
    default:
      if (isMac) {
        buildArgs = ['run', 'build-mac'];
      } else if (isWin) {
        buildArgs = ['run', 'build-win'];
      } else {
        buildArgs = ['run', 'build-linux'];
      }
  }

  await runCommand('npm', buildArgs);
  console.log('✅ Electron build completed');
}

async function main() {
  try {
    const platform = process.argv[2] || 'current';
    
    console.log('🎯 Starting VRT Electron build process...');
    
    // 1. Reactクライアントのビルド
    await buildClient();
    
    // 2. Electronパッケージファイルの準備
    await prepareElectronPackage();
    
    // 3. Electronメインプロセスファイルの作成
    await createElectronMain();
    
    // 4. Electron依存関係のインストール
    await installElectronDependencies();
    
    // 5. Electronアプリのビルド
    await buildElectron(platform);
    
    console.log('🎉 Build process completed successfully!');
    console.log('📁 Built files are in the "dist" directory');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };