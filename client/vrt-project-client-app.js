import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('https://example.com');
  const [delay, setDelay] = useState(2);
  const [threshold, setThreshold] = useState(0.1);
  const [screenshot1, setScreenshot1] = useState(null);
  const [screenshot2, setScreenshot2] = useState(null);
  const [diffImage, setDiffImage] = useState(null);
  const [diffPercentage, setDiffPercentage] = useState(null);
  const [viewMode, setViewMode] = useState('diff');
  const [showDiffOverlay, setShowDiffOverlay] = useState(true);
  const [diffColor, setDiffColor] = useState('#ff0000');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // スクリーンショットを取得する関数
  const takeScreenshot = async (url, delay) => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const response = await axios.post('/api/screenshot', {
        url,
        delay
      });
      
      return response.data;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      setErrorMessage(error.response?.data?.message || 'スクリーンショット取得中にエラーが発生しました');
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // 1回目のスクリーンショット取得
  const handleTakeScreenshot1 = async () => {
    const result = await takeScreenshot(url, delay);
    if (result) {
      setScreenshot1(result.screenshotUrl);
      
      // 2回目のスクリーンショットがある場合は差分を計算
      if (screenshot2) {
        calculateDiff(result.screenshotPath, screenshot2.replace('/uploads/', ''));
      }
    }
  };
  
  // 2回目のスクリーンショット取得
  const handleTakeScreenshot2 = async () => {
    const result = await takeScreenshot(url, delay);
    if (result) {
      setScreenshot2(result.screenshotUrl);
      
      // 1回目のスクリーンショットがある場合は差分を計算
      if (screenshot1) {
        calculateDiff(screenshot1.replace('/uploads/', ''), result.screenshotPath);
      }
    }
  };
  
  // 差分を計算する関数
  const calculateDiff = async (img1Path, img2Path) => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const response = await axios.post('/api/diff', {
        img1: img1Path,
        img2: img2Path,
        threshold
      });
      
      setDiffImage(response.data.diffUrl);
      setDiffPercentage(response.data.diffPercentage);
    } catch (error) {
      console.error('Error calculating diff:', error);
      setErrorMessage(error.response?.data?.message || '差分計算中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  // クリアボタンのハンドラ
  const handleClear = () => {
    setScreenshot1(null);
    setScreenshot2(null);
    setDiffImage(null);
    setDiffPercentage(null);
  };
  
  // 比較ビューのレンダリング
  const renderComparisonView = () => {
    if (!screenshot1 || !screenshot2) {
      return <div className="text-center p-8">両方のスクリーンショットを取得すると、ここに比較結果が表示されます</div>;
    }
    
    switch (viewMode) {
      case 'diff':
        return (
          <div className="relative">
            {diffImage ? (
              <>
                <img src={diffImage} alt="差分" className="max-w-full" />
                {diffPercentage !== null && (
                  <div className="mt-2 text-center">
                    差分: {(diffPercentage * 100).toFixed(2)}%
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-8">差分計算中...</div>
            )}
          </div>
        );
      case 'side-by-side':
        return (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2 border border-gray-300">
              <div className="font-medium p-2 bg-gray-100">スクリーンショット1</div>
              <img src={screenshot1} alt="スクリーンショット1" className="max-w-full" />
            </div>
            <div className="w-full md:w-1/2 border border-gray-300">
              <div className="font-medium p-2 bg-gray-100">スクリーンショット2</div>
              <img src={screenshot2} alt="スクリーンショット2" className="max-w-full" />
            </div>
          </div>
        );
      case 'slider':
        return (
          <div className="relative border border-gray-300">
            <div className="w-full relative overflow-hidden" style={{ height: '600px' }}>
              <img src={screenshot1} alt="スクリーンショット1" className="absolute top-0 left-0 w-full h-full object-cover" />
              <div 
                className="absolute top-0 h-full overflow-hidden" 
                style={{ width: `${sliderPosition}%`, left: 0 }}
              >
                <img 
                  src={screenshot2} 
                  alt="スクリーンショット2" 
                  className="absolute top-0 left-0 w-full h-full object-cover" 
                  style={{ width: `${100 / (sliderPosition/100)}%` }}
                />
              </div>
              <div 
                className="absolute top-0 bottom-0 w-1 bg-blue-500 cursor-ew-resize z-10"
                style={{ left: `${sliderPosition}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-8">VRTテストアプリケーション</h1>
      
      {/* テスト設定セクション */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-bold mb-4">テスト設定</h2>
        
        <div className="mb-4">
          <label className="block mb-2">テストするURL:</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">スクリーンショット前の待機時間 (秒):</label>
          <input
            type="number"
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded"
            min="0"
            step="0.5"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">差分検出のしきい値 (0.0 ~ 1.0):</label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded"
            min="0"
            max="1"
            step="0.01"
          />
        </div>
        
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleTakeScreenshot1}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            1回目スクリーンショット取得
          </button>
          <button
            onClick={handleTakeScreenshot2}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            2回目スクリーンショット取得
          </button>
          <button
            onClick={handleClear}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            クリア
          </button>
        </div>
        
        {isLoading && <div className="mt-4 text-blue-500">処理中...</div>}
        {errorMessage && <div className="mt-4 text-red-500">{errorMessage}</div>}
      </div>
      
      {/* スクリーンショット表示エリア */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">1回目のスクリーンショット</h2>
          <div className="border border-gray-200 bg-gray-50 h-64 flex items-center justify-center overflow-hidden">
            {screenshot1 ? (
              <img src={screenshot1} alt="スクリーンショット1" className="max-w-full max-h-full" />
            ) : (
              <p className="text-gray-500">まだスクリーンショットはありません</p>
            )}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">2回目のスクリーンショット</h2>
          <div className="border border-gray-200 bg-gray-50 h-64 flex items-center justify-center overflow-hidden">
            {screenshot2 ? (
              <img src={screenshot2} alt="スクリーンショット2" className="max-w-full max-h-full" />
            ) : (
              <p className="text-gray-500">まだスクリーンショットはありません</p>
            )}
          </div>
        </div>
      </div>
      
      {/* 比較結果セクション */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">比較結果</h2>
        
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setViewMode('diff')}
              className={`px-4 py-2 rounded ${viewMode === 'diff' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              差分表示
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-4 py-2 rounded ${viewMode === 'side-by-side' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              横並び比較
            </button>
            <button
              onClick={() => setViewMode('slider')}
              className={`px-4 py-2 rounded ${viewMode === 'slider' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              スライダー比較
            </button>
          </div>
          
          {viewMode === 'diff' && (
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showDiffOverlay}
                  onChange={(e) => setShowDiffOverlay(e.target.checked)}
                  className="mr-2"
                />
                差分を強調表示
              </label>
              <div className="flex items-center">
                <input
                  type="color"
                  value={diffColor}
                  onChange={(e) => setDiffColor(e.target.value)}
                  className="p-1 border border-gray-300 rounded"
                />
                <span className="ml-2">差分の色</span>
              </div>
            </div>
          )}
          
          <div className="border border-gray-200 bg-gray-50 min-h-64">
            {renderComparisonView()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;