const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

async function ensurePlaywrightBrowsers() {
  try {
    // テスト用の軽量な起動を試行
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch (error) {
    console.log('Playwright browsers not found, installing...');
    try {
      // Playwrightブラウザを自動インストール
      execSync('npx playwright install chromium', { 
        stdio: 'inherit',
        timeout: 300000 // 5分のタイムアウト
      });
      return true;
    } catch (installError) {
      console.error('Failed to install Playwright browsers:', installError);
      return false;
    }
  }
}

/**
 * 画像の遅延読み込み（lazyload）を無効化し、全画像・全要素を強制的に表示させる
 * スクロール連動のフェードイン演出（jquery.inview / IntersectionObserver等）にも対応
 * @param {import('playwright').Page} page - 対象ページ
 */
async function forceLoadLazyImages(page) {
  // CSSトランジション・アニメーションを無効化
  // （inview系のフェードイン演出がクラス付与と同時に最終状態になるようにする）
  await page.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation-duration: 0s !important;
      animation-delay: 0s !important;
    }`,
  });

  // ネイティブのloading="lazy"をeagerに変更し、data-src系ライブラリの画像も読み込む
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach((el) => {
      el.setAttribute('loading', 'eager');
    });
    document.querySelectorAll('img[data-src], img[data-lazy-src], source[data-srcset]').forEach((el) => {
      if (el.dataset.src) el.setAttribute('src', el.dataset.src);
      if (el.dataset.lazySrc) el.setAttribute('src', el.dataset.lazySrc);
      if (el.dataset.srcset) el.setAttribute('srcset', el.dataset.srcset);
    });
  });

  // 1画面ずつゆっくりスクロールして、IntersectionObserverやjquery.inviewなどの
  // ポーリング型の遅延表示処理を確実に発火させる
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.floor(window.innerHeight * 0.75);
    let position = 0;
    // スクロール中にコンテンツが読み込まれて高さが伸びるケースに備えて毎回高さを再取得
    while (position < Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)) {
      window.scrollTo(0, position);
      position += step;
      await sleep(300);
    }
    // 最下部で一呼吸置いてから先頭に戻す
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(500);
    window.scrollTo(0, 0);
    await sleep(300);
  });

  // 発火した画像リクエストの完了を待つ
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

/**
 * ページ内のアニメーション・スライダーを停止する
 * CSSアニメーションだけでなく、タイマーやrequestAnimationFrameで動く
 * JS駆動のスライダー（Splide / Swiper / Slick 等）も汎用的に凍結する
 * @param {import('playwright').Page} page - 対象ページ
 */
async function stopAnimations(page) {
  // CSSアニメーション・トランジションを停止
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
    }`,
  });

  await page.evaluate(() => {
    // 動画を停止
    document.querySelectorAll('video').forEach((v) => {
      try { v.pause(); } catch (e) { /* ignore */ }
    });

    // 主要スライダーライブラリの自動再生を停止
    // Swiper
    document.querySelectorAll('.swiper').forEach((el) => {
      const swiper = el.swiper;
      if (swiper) {
        try {
          if (swiper.autoplay) swiper.autoplay.stop();
          if (swiper.slideTo) swiper.slideTo(0, 0);
        } catch (e) { /* ignore */ }
      }
    });
    // Slick (jQuery)
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.slick) {
      try { window.jQuery('.slick-initialized').slick('slickPause'); } catch (e) { /* ignore */ }
    }

    // タイマー駆動の自動再生（setInterval / setTimeout）を全停止
    const maxTimerId = window.setTimeout(() => {}, 0);
    for (let i = 0; i <= maxTimerId; i++) {
      window.clearTimeout(i);
      window.clearInterval(i);
    }

    // requestAnimationFrame駆動の無限アニメーション（Splideのauto-scroll等）を停止
    window.requestAnimationFrame = () => 0;

    // 主要スライダーのトラック位置を先頭にリセットして、撮影のたびに
    // 停止位置が変わらないようにする
    document.querySelectorAll('.splide__list, .swiper-wrapper, .slick-track').forEach((track) => {
      track.style.setProperty('transform', 'translateX(0)', 'important');
    });
  });

  // 停止後の描画が安定するまで少し待つ
  await page.waitForTimeout(300);
}

/**
 * 指定したURLのスクリーンショットを撮影する
 * @param {string} url - スクリーンショットを撮影するURL
 * @param {string} outputPath - スクリーンショットの保存先パス
 * @param {number} delaySeconds - ページロード後の待機時間（秒）
 * @param {boolean} disableLazyload - 画像の遅延読み込みを無効化して全画像を読み込むか
 * @param {boolean} disableAnimations - アニメーション・スライダーを停止するか
 * @returns {Promise<{ipAddress: string|null}>} 実際に接続したサーバーの情報
 */
async function takeScreenshot(url, outputPath, delaySeconds = 0, disableLazyload = false, disableAnimations = false) {
  // ブラウザの存在確認と自動インストール
  const browsersReady = await ensurePlaywrightBrowsers();
  if (!browsersReady) {
    throw new Error('Playwright browsers are not available and could not be installed automatically');
  }
  
  let browser = null;
  
  try {
    // ブラウザの起動
    browser = await chromium.launch({
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    
    // URLの読み込み
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000, // 60秒のタイムアウト
    });

    // 実際に接続したサーバーのIPアドレス（DNSラウンドロビンやLBで毎回変わり得る）
    let ipAddress = null;
    if (response) {
      const serverAddr = await response.serverAddr();
      if (serverAddr) {
        ipAddress = serverAddr.ipAddress;
      }
    }

    // 画像の遅延読み込みを無効化して全画像を読み込む
    if (disableLazyload) {
      await forceLoadLazyImages(page);
    }

    // アニメーション・スライダーを停止
    // （lazyload無効化のスクロール処理はタイマーを使うため、必ずその後に実行する）
    if (disableAnimations) {
      await stopAnimations(page);
    }

    // 指定された遅延時間だけ待機
    if (delaySeconds > 0) {
      await page.waitForTimeout(delaySeconds * 1000);
    }

    // スクリーンショットの撮影
    await page.screenshot({
      path: outputPath,
      fullPage: true, // ページ全体を撮影
    });

    console.log(`Screenshot saved to ${outputPath}`, { ipAddress });

    return { ipAddress };
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