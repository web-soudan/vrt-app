#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getMacConfig } = require('./build-electron-configs');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log('Running: ' + command + ' ' + args.join(' '));
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: isWin,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error('Command failed with exit code ' + code));
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

async function prepareElectronPackage(withDist = false) {
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
      'electron-builder': '^24.6.4',
      'electron-rebuild': '^3.2.9'
    },
    build: {
      appId: 'com.vrt.app',
      productName: 'VRT App',
      directories: {
        output: 'dist',
        app: '.'
      },
      files: [
        'electron/**/*',
        'client/build/**/*',
        '!server/**/*',
        '!server/screenshots/**/*',
        '!server/uploads/**/*',
        '!server/diffs/**/*'
      ],
      extraResources: [
        {
          from: 'server',
          to: 'server',
          filter: ['**/*', '!screenshots/**/*', '!uploads/**/*', '!diffs/**/*']
        }
      ],
      mac: getMacConfig(withDist),
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

  const mainJsLines = [
    "const { app, BrowserWindow, Menu } = require('electron');",
    "const path = require('path');",
    "const { fork } = require('child_process');",
    "",
    "let mainWindow;",
    "let serverProcess;",
    "",
    "const isDev = process.argv.includes('--dev');",
    "",
    "function createWindow() {",
    "  mainWindow = new BrowserWindow({",
    "    width: 1200,",
    "    height: 800,",
    "    webPreferences: {",
    "      nodeIntegration: false,",
    "      contextIsolation: true,",
    "      enableRemoteModule: false,",
    "      preload: path.join(__dirname, 'preload.js')",
    "    },",
    "    icon: path.join(__dirname, 'assets', 'icon.png')",
    "  });",
    "",
    "  if (isDev) {",
    "    mainWindow.loadURL('http://localhost:3000');",
    "    mainWindow.webContents.openDevTools();",
    "  } else {",
    "    mainWindow.loadFile(path.join(__dirname, '../client/build/index.html'));",
    "  }",
    "",
    "  mainWindow.on('closed', () => {",
    "    mainWindow = null;",
    "  });",
    "}",
    "",
    "let serverStarted = false;",
    "",
    "function checkServerHealth() {",
    "  const http = require('http');",
    "  return new Promise((resolve) => {",
    "    const req = http.get('http://localhost:5002/health', (res) => {",
    "      resolve(res.statusCode === 200);",
    "    });",
    "    req.on('error', () => resolve(false));",
    "    req.setTimeout(1000, () => {",
    "      req.destroy();",
    "      resolve(false);",
    "    });",
    "  });",
    "}",
    "",
    "function startServer() {",
    "  if (!serverStarted) {",
    "    console.log('Starting server process...');",
    "    const serverPath = isDev ? ",
    "      path.join(__dirname, '../server/index.js') : ",
    "      path.join(process.resourcesPath, 'server/index.js');",
    "    console.log('Server path:', serverPath);",
    "    console.log('isDev:', isDev);",
    "    ",
    "    try {",
    "      const serverCwd = isDev ? ",
    "        path.join(__dirname, '../server') : ",
    "        path.join(process.resourcesPath, 'server');",
    "      ",
    "      serverProcess = fork(serverPath, {",
    "        silent: false,",
    "        cwd: serverCwd,",
    "        env: { ...process.env, PORT: '5002', ELECTRON_APP: 'true' }",
    "      });",
    "",
    "      serverProcess.on('error', (error) => {",
    "        console.error('Server process error:', error);",
    "        serverStarted = false;",
    "      });",
    "",
    "      serverProcess.on('exit', (code) => {",
    "        console.log('Server process exited with code ' + code);",
    "        serverStarted = false;",
    "        if (code !== 0) {",
    "          console.log('Server failed to start, running in client-only mode');",
    "        }",
    "      });",
    "",
    "      serverProcess.on('spawn', () => {",
    "        console.log('Server process spawned successfully');",
    "        serverStarted = true;",
    "        // サーバーヘルスチェック",
    "        setTimeout(async () => {",
    "          const isHealthy = await checkServerHealth();",
    "          console.log('Server health check:', isHealthy ? 'OK' : 'Failed');",
    "          if (!isHealthy) {",
    "            console.log('Retrying server health check in 5 seconds...');",
    "            setTimeout(async () => {",
    "              const retryHealthy = await checkServerHealth();",
    "              console.log('Retry health check:', retryHealthy ? 'OK' : 'Failed');",
    "            }, 5000);",
    "          }",
    "        }, 2000);",
    "      });",
    "    } catch (error) {",
    "      console.error('Failed to start server:', error);",
    "      serverStarted = false;",
    "    }",
    "  }",
    "}",
    "",
    "app.whenReady().then(() => {",
    "  // サーバーを最初に起動",
    "  startServer();",
    "  ",
    "  // サーバー起動後にウィンドウを表示",
    "  setTimeout(() => {",
    "    createWindow();",
    "  }, isDev ? 0 : 3000);",
    "",
    "  app.on('activate', () => {",
    "    if (BrowserWindow.getAllWindows().length === 0) {",
    "      createWindow();",
    "    }",
    "  });",
    "});",
    "",
    "app.on('window-all-closed', () => {",
    "  if (process.platform !== 'darwin') {",
    "    app.quit();",
    "  }",
    "});",
    "",
    "app.on('before-quit', () => {",
    "  if (serverProcess) {",
    "    console.log('Terminating server process...');",
    "    serverProcess.kill();",
    "  }",
    "});"
  ];

  fs.writeFileSync(path.join(electronDir, 'main.js'), mainJsLines.join('\n'));

  const preloadJsLines = [
    "const { contextBridge } = require('electron');",
    "",
    "contextBridge.exposeInMainWorld('electronAPI', {",
    "  // APIs can be added here",
    "});"
  ];

  fs.writeFileSync(path.join(electronDir, 'preload.js'), preloadJsLines.join('\n'));

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
    
    // サーバー依存関係をElectronのNode.jsバージョンでリビルド
    console.log('🔧 Rebuilding server dependencies for Electron...');
    await runCommand('npx', ['electron-rebuild', '--module-dir', 'server']);
    console.log('✅ Server dependencies rebuilt with electron-rebuild');
  } catch (error) {
    console.error('Failed to install dependencies:', error.message);
    throw error;
  }
}

async function buildElectron(platform, withDist = false) {
  console.log('🚀 Building Electron app for ' + platform + '...');
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
    const withDist = process.argv.includes('--dist') || process.argv.includes('-d');
    
    console.log('🎯 Starting VRT Electron build process...');
    if (withDist) {
      console.log('📦 Distribution packages (DMG/ZIP) will be created');
    } else {
      console.log('📁 Creating app directory only (use --dist for DMG/ZIP)');
    }
    
    await buildClient();
    await prepareElectronPackage(withDist);
    await createElectronMain();
    await installElectronDependencies();
    await buildElectron(platform, withDist);
    
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