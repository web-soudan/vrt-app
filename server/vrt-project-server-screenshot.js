const { chromium } = require('playwright');

/**
 * 指定したURLのスクリーンショットを撮影する
 * @param {string} url - スクリーンショットを撮影するURL
 * @param {string} outputPath - スクリーンショットの保存先パス
 * @param {number} delaySeconds - ページロード後の待機時間（秒）
 * @returns {Promise<void>}
 */
async function takeScreenshot(url, outputPath, delaySeconds = 0) {
  let browser = null;
  
  try {
    // ブラウザの起動
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    
    // URLの読み込み
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000, // 60秒のタイムアウト
    });
    
    // 指定された遅延時間だけ待機
    if (delaySeconds > 0) {
      await page.waitForTimeout(delaySeconds * 1000);
    }
    
    // スクリーンショットの撮影
    await page.screenshot({
      path: outputPath,
      fullPage: true, // ページ全体を撮影
    });
    
    console.log(`Screenshot saved to ${outputPath}`);
  } catch (error) {
    console.error('Error taking screenshot:', error);
    throw error;
  } finally {
    // ブラウザを閉じる
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  takeScreenshot,
};