const fs = require('fs');
const { PNG } = require('pngjs');
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
  const img1 = await readPNG(img1Path);
  const img2 = await readPNG(img2Path);

  // 最大の寸法を取得（両方の画像を同じサイズにリサイズするため）
  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  // 1つ目の画像を白背景のキャンバスに配置
  const canvas1 = new PNG({ width, height });
  canvas1.data.fill(255); // 白背景
  copyImageData(img1, canvas1, width);

  // 2つ目の画像を白背景のキャンバスに配置
  const canvas2 = new PNG({ width, height });
  canvas2.data.fill(255); // 白背景
  copyImageData(img2, canvas2, width);

  // 差分画像用のバッファ
  const diffPNG = new PNG({ width, height });

  // pixelmatchを使用して差分を検出
  const diffPixels = pixelmatch(
    canvas1.data,
    canvas2.data,
    diffPNG.data,
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

  // 差分画像の保存
  await savePNG(diffPNG, diffOutputPath);

  const totalPixels = width * height;
  const diffPercentage = diffPixels / totalPixels;

  return {
    diffPixels,
    totalPixels,
    diffPercentage,
    width,
    height,
  };
}

/**
 * PNG画像ファイルを読み込む
 * @param {string} filePath - 画像ファイルのパス
 * @returns {Promise<PNG>}
 */
function readPNG(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on('parsed', function() {
        resolve(this);
      })
      .on('error', reject);
  });
}

/**
 * 画像データをキャンバスにコピーする
 * @param {PNG} src - コピー元画像
 * @param {PNG} dst - コピー先キャンバス
 * @param {number} dstWidth - コピー先の幅
 */
function copyImageData(src, dst, dstWidth) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const srcIdx = (y * src.width + x) * 4;
      const dstIdx = (y * dstWidth + x) * 4;
      dst.data[dstIdx]     = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
}

/**
 * PNG画像をファイルに保存する
 * @param {PNG} png - 保存するPNG
 * @param {string} filePath - 保存先パス
 * @returns {Promise<void>}
 */
function savePNG(png, filePath) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(filePath);
    png.pack().pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

module.exports = {
  generateDiff,
};
