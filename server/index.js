const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { takeScreenshot } = require('./screenshot');
const { generateDiff } = require('./diff');

// ディレクトリの作成
const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ディレクトリ内の画像ファイルを削除する関数
const cleanupDirectory = (dir) => {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      // PNGファイルのみを削除
      if (file.toLowerCase().endsWith('.png')) {
        fs.unlinkSync(path.join(dir, file));
      }
    });
    return files.length;
  }
  return 0;
};

// ディレクトリの初期化
const isElectron = process.env.ELECTRON_APP === 'true' || process.versions.electron;
const baseDir = isElectron && process.resourcesPath ? 
  path.join(process.resourcesPath, 'server') : 
  __dirname;

const screenshotsDir = path.join(baseDir, 'screenshots');
const diffsDir = path.join(baseDir, 'diffs');
const uploadsDir = path.join(baseDir, 'uploads');

ensureDirExists(screenshotsDir);
ensureDirExists(diffsDir);
ensureDirExists(uploadsDir);

console.log('Server environment:', { 
  isElectron, 
  baseDir, 
  screenshotsDir, 
  diffsDir, 
  uploadsDir,
  resourcesPath: process.resourcesPath 
});

// アプリケーションの設定
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// 画像クリーンアップエンドポイント
app.post('/api/cleanup', (req, res) => {
  try {
    // 各ディレクトリの不要な画像を削除
    const screenshotsCount = cleanupDirectory(screenshotsDir);
    const diffsCount = cleanupDirectory(diffsDir);
    const uploadsCount = cleanupDirectory(uploadsDir);
    
    console.log(`クリーンアップ完了: スクリーンショット ${screenshotsCount}件、差分 ${diffsCount}件、アップロード ${uploadsCount}件を削除しました`);
    
    res.json({
      success: true,
      message: `クリーンアップが完了しました。合計 ${screenshotsCount + diffsCount + uploadsCount} ファイルを削除しました。`,
      deleted: {
        screenshots: screenshotsCount,
        diffs: diffsCount,
        uploads: uploadsCount
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: `クリーンアップ中にエラーが発生しました: ${error.message}`
    });
  }
});

// スクリーンショットの取得エンドポイント
app.post('/api/screenshot', async (req, res) => {
  try {
    const { url, delay = 0 } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'URLが必要です' });
    }
    
    // スクリーンショットの保存先ファイル名を生成
    const filename = `${uuidv4()}.png`;
    const screenshotPath = path.join(screenshotsDir, filename);
    
    // スクリーンショットを撮影
    console.log('Taking screenshot:', { url, screenshotPath, delay });
    await takeScreenshot(url, screenshotPath, delay);
    
    console.log('Screenshot saved:', { 
      screenshotPath, 
      exists: fs.existsSync(screenshotPath) 
    });
    
    // 静的ファイルとして提供するためにuploadsディレクトリにコピー
    const publicPath = path.join(uploadsDir, filename);
    fs.copyFileSync(screenshotPath, publicPath);
    
    console.log('Screenshot copied to uploads:', { 
      publicPath, 
      exists: fs.existsSync(publicPath) 
    });
    
    res.json({
      success: true,
      screenshotPath: filename,
      screenshotUrl: `/uploads/${filename}`
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({
      success: false,
      message: `スクリーンショットの取得に失敗しました: ${error.message}`
    });
  }
});

// 差分検出エンドポイント
app.post('/api/diff', async (req, res) => {
  try {
    const { img1, img2, threshold = 0.1 } = req.body;
    
    console.log('Diff request:', { img1, img2, threshold });
    console.log('Screenshots directory:', screenshotsDir);
    
    if (!img1 || !img2) {
      return res.status(400).json({ message: '2つの画像が必要です' });
    }
    
    const img1Path = path.join(screenshotsDir, img1);
    const img2Path = path.join(screenshotsDir, img2);
    
    console.log('Image paths:', { img1Path, img2Path });
    console.log('Files exist:', { 
      img1Exists: fs.existsSync(img1Path), 
      img2Exists: fs.existsSync(img2Path) 
    });
    
    // スクリーンショットディレクトリの内容を確認
    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      console.log('Files in screenshots directory:', files);
    } else {
      console.log('Screenshots directory does not exist:', screenshotsDir);
    }
    
    // 画像ファイルの存在確認
    if (!fs.existsSync(img1Path) || !fs.existsSync(img2Path)) {
      return res.status(404).json({ 
        message: '画像ファイルが見つかりません',
        details: {
          img1Path,
          img2Path,
          img1Exists: fs.existsSync(img1Path),
          img2Exists: fs.existsSync(img2Path),
          screenshotsDir
        }
      });
    }
    
    // 差分画像の保存先ファイル名を生成
    const diffFilename = `diff-${uuidv4()}.png`;
    const diffPath = path.join(diffsDir, diffFilename);
    
    // 差分を生成
    const diffResult = await generateDiff(img1Path, img2Path, diffPath, threshold);
    
    // 静的ファイルとして提供するためにuploadsディレクトリにコピー
    const publicPath = path.join(uploadsDir, diffFilename);
    fs.copyFileSync(diffPath, publicPath);
    
    res.json({
      success: true,
      diffUrl: `/uploads/${diffFilename}`,
      diffPercentage: diffResult.diffPercentage
    });
  } catch (error) {
    console.error('Diff error:', error);
    res.status(500).json({
      success: false,
      message: `差分検出に失敗しました: ${error.message}`
    });
  }
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// クライアントビルドを提供（本番環境用）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// サーバーの起動
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
