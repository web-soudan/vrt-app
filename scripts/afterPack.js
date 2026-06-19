const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const resourcesPath = path.join(appOutDir, packager.platform.buildResourcesDir);
  const serverPath = path.join(resourcesPath, 'server');
  
  console.log('Installing Playwright browsers for packaged app...');
  
  try {
    // サーバーディレクトリでPlaywrightブラウザをインストール
    const originalCwd = process.cwd();
    process.chdir(serverPath);
    
    // Playwrightブラウザをインストール
    execSync('npx playwright install chromium', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: path.join(resourcesPath, 'playwright-browsers')
      }
    });
    
    process.chdir(originalCwd);
    console.log('Playwright browsers installed successfully');
  } catch (error) {
    console.error('Failed to install Playwright browsers:', error);
    // エラーでもビルドを続行
  }
};