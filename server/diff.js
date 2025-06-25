const fs = require('fs');
const { createCanvas, Image } = require('canvas');
const pixelmatch = require('pixelmatch');

/**
 * 2つの画像の差分を検出し、差分画像を生成する
 * @param {string} img1Path - 1つ目の画像ファイルパス
 * @param {string} img2Path - 2つ目の画像ファイルパス
 * @param {string} diffOutputPath - 差分画像の出力先パス
 * @param {number} threshold - 差分検出のしきい値（0.0〜1.0）
 * @returns {Object} - 差分検出結果を含むオブジェクト
 */
async function generateDiff(img1Path, img2Path, diffOutputPath, threshold = 0.1) {
  // 画像の読み込み
  const img1 = await loadImage(img1Path);
  const img2 = await loadImage(img2Path);
  
  // 最大の寸法を取得（両方の画像を同じサイズにリサイズするため）
  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);
  
  // 1つ目の画像を配置（元の縦横比を保持）
  const canvas1 = createCanvas(width, height);
  const ctx1 = canvas1.getContext('2d');
  ctx1.fillStyle = '#ffffff'; // 白背景で埋める
  ctx1.fillRect(0, 0, width, height);
  ctx1.drawImage(img1, 0, 0, img1.width, img1.height);
  const img1Data = ctx1.getImageData(0, 0, width, height);
  
  // 2つ目の画像を配置（元の縦横比を保持）
  const canvas2 = createCanvas(width, height);
  const ctx2 = canvas2.getContext('2d');
  ctx2.fillStyle = '#ffffff'; // 白背景で埋める
  ctx2.fillRect(0, 0, width, height);
  ctx2.drawImage(img2, 0, 0, img2.width, img2.height);
  const img2Data = ctx2.getImageData(0, 0, width, height);
  
  // 差分画像用のキャンバス
  const diffCanvas = createCanvas(width, height);
  const diffCtx = diffCanvas.getContext('2d');
  const diffData = diffCtx.createImageData(width, height);
  
  // pixelmatchを使用して差分を検出
  const diffPixels = pixelmatch(
    img1Data.data,
    img2Data.data,
    diffData.data,
    width,
    height,
    {
      threshold,
      alpha: 0.3,
      diffColor: [255, 0, 0], // 差分の色（赤）
      diffColorAlt: [0, 255, 0], // 代替差分の色（緑）
      aaColor: [0, 0, 255], // アンチエイリアス時の色（青）
    }
  );
  
  // 差分画像の描画
  diffCtx.putImageData(diffData, 0, 0);
  
  // 差分画像の保存
  const out = fs.createWriteStream(diffOutputPath);
  const stream = diffCanvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve, reject) => {
    out.on('finish', () => {
      // 差分率を計算
      const totalPixels = width * height;
      const diffPercentage = diffPixels / totalPixels;
      
      resolve({
        diffPixels,
        totalPixels,
        diffPercentage,
        width,
        height,
      });
    });
    out.on('error', reject);
  });
}

/**
 * 画像ファイルを読み込む
 * @param {string} path - 画像ファイルのパス
 * @returns {Promise<Image>} - Image オブジェクト
 */
function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${err}`));
    
    // ファイルからバイナリデータを読み込み
    const data = fs.readFileSync(path);
    img.src = data;
  });
}

module.exports = {
  generateDiff,
};
  