import React, { useState, useEffect, useRef } from 'react';

// Step 1 で分離した定数をインポート
import { APP_STATUS } from '../constants/appStatus';
import { STRUCTURING_STEPS, OUTLINE_STEPS } from '../constants/steps';

// --- アイコンコンポーネント (App.jsx から移動) ---
// (注: SendIcon は ChatPanel.jsx で使用しますが、アイコン集約のためここで定義・exportします)

export const SettingsIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-white transition-colors"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>);
export const UploadCloudIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></svg>);
export const SendIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>);


// --- UI コンポーネント (App.jsx から移動) ---

export const AppHeader = ({ onSettingsClick, onDownloadLog }) => (
  <header className="flex-shrink-0 h-14 bg-black/25 flex items-center px-6 justify-between border-b border-white/10 z-10">
    <h1 className="text-lg font-semibold">スライド作成ジェネレーター</h1>
    <div className="flex items-center space-x-2">
      <button 
        onClick={onDownloadLog} 
        title="デバッグログをクリップボードにコピー"
        className="p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-white transition-colors">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
      </button>
      <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-white/10 transition-colors">
        <SettingsIcon />
      </button>
    </div>
  </header>
);

/**
 * 汎用的な進捗トラッカー (App.jsx から移動)
 * (FileUploadPanel と GenerationProgressTracker の両方から使用される)
 */
export const ProcessingTracker = ({ title, steps, currentStepKey, totalWaitTime }) => {
  const currentStepIndex = steps.findIndex(step => step.key === currentStepKey);

  const [remainingTime, setRemainingTime] = useState(Math.ceil(totalWaitTime / 1000));

  useEffect(() => {
    if (totalWaitTime > 0) {
      const initialSeconds = Math.ceil(totalWaitTime / 1000);
      setRemainingTime(initialSeconds);

      const interval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setRemainingTime(0);
    }
  }, [totalWaitTime]); 

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-lg p-4">
      <p className="font-semibold text-sm flex items-center mb-3">
        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
        {title}
        {remainingTime > 0 && (
          <span className="ml-auto text-xs text-gray-400">
            (残り約 {remainingTime} 秒)
          </span>
        )}
      </p>
      <div className="ml-6 pl-4 border-l-2 border-indigo-500 space-y-2">
        {steps.map((step, stepIndex) => (
          <p 
            key={step.key} 
            className={`text-xs flex items-center transition-colors ${
              stepIndex <= currentStepIndex ? 'text-gray-200' : 'text-gray-500'
            }`}
          >
            {stepIndex < currentStepIndex ? 
              <span className="text-green-400 mr-2">✓</span> : 
              stepIndex === currentStepIndex ? 
              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></span> : 
              <span className="mr-2">○</span>
            }
            {step.text}
          </p>
        ))}
      </div>
    </div>
  );
};

export const FileUploadPanel = ({ isProcessing, processingStatus, fileName, handleDragOver, handleDrop, onFileSelect, appStatus, thinkingState, totalWaitTime }) => (
  <div
    className={`w-full h-full bg-white/5 rounded-xl flex flex-col items-center justify-center p-6 border-2 border-dashed ${isProcessing ? 'border-indigo-500' : 'border-white/20 hover:border-indigo-500'} transition-colors`}
    onDragOver={handleDragOver}
    onDrop={handleDrop}
  >
    {isProcessing ? (
      <div className="text-center w-full max-w-md px-4">
        {appStatus === APP_STATUS.STRUCTURING ? (
          <ProcessingTracker
            title="テキストを構造化中..."
            steps={STRUCTURING_STEPS}
            currentStepKey={thinkingState}
            totalWaitTime={totalWaitTime}
          />
        ) : appStatus === APP_STATUS.GENERATING_OUTLINE ? (
          <ProcessingTracker
            title="構成案を生成中..."
            steps={OUTLINE_STEPS}
            currentStepKey={thinkingState}
            totalWaitTime={totalWaitTime}
          />
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-lg font-semibold">{processingStatus}</p>
          </>
        )}
        <p className="mt-4 text-sm text-gray-400">{fileName}</p>
      </div>
    ) : appStatus !== APP_STATUS.INITIAL ? (
       <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 mx-auto"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p className="mt-4 text-lg font-semibold">処理進行中</p>
          <p className="mt-1 text-sm text-gray-400">{fileName}</p>
          <p className="mt-4 text-xs text-gray-500">コントロールパネルで操作を続けてください。</p>
      </div>
    ) : (
      <div className="text-center">
        <UploadCloudIcon />
        <p className="mt-4 text-lg font-semibold">ドキュメントをドラッグ＆ドロップ</p>
        <p className="mt-1 text-xs text-gray-400">または</p>
        <button
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-medium transition-colors"
          onClick={() => document.getElementById('file-upload').click()}
        >
          ファイルを選択
        </button>
        <input type="file" id="file-upload" className="hidden" accept=".pdf,.txt,.md" onChange={(e) => onFileSelect(e.target.files[0])} />
        <p className="mt-4 text-xs text-gray-500">対応形式: PDF, TXT, MD</p>
      </div>
    )}
  </div>
);


/**
 * スライドプレビューのラッパーコンポーネント (App.jsx から移動)
 */
const SlidePreviewItem = ({ htmlContent, containerWidth }) => {
  const baseWidth = 1280;
  const baseHeight = 720;
  const scale = containerWidth > 0 ? (containerWidth - 16) / baseWidth : 1;
  const scaledHeight = baseHeight * scale;

  return (
    <div 
      className="relative w-full rounded-lg overflow-hidden shadow-lg border border-white/10"
      style={{ height: `${scaledHeight}px` }}
    >
      <iframe
        key={htmlContent} 
        srcDoc={htmlContent}
        width={baseWidth}
        height={baseHeight}
        className="border-none"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left', 
        }}
        sandbox="allow-same-origin allow-scripts" 
        title="Slide Preview Item"
      />
    </div>
  );
};

/**
 * プレビューパネル本体 (App.jsx から移動)
 */
export const PreviewPanel = ({ generatedSlides, htmlContent, isLoading, loadingSlideTitle }) => {
  const containerRef = useRef(null);
  const scrollEndRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width } = entries[0].contentRect;
        setContainerWidth(width);
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generatedSlides, htmlContent, isLoading]); 

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black/10 rounded-xl flex flex-col p-4 border border-white/10 overflow-y-auto"
    >
      <div className="space-y-4">
        {generatedSlides.map((slideHtml, index) => (
          <SlidePreviewItem 
            key={index}
            htmlContent={slideHtml}
            containerWidth={containerWidth}
          />
        ))}

        {htmlContent && !isLoading && (
          <SlidePreviewItem 
            htmlContent={htmlContent}
            containerWidth={containerWidth}
          />
        )}

        {isLoading && (
          <div 
            className="w-full flex flex-col items-center justify-center bg-white/5 rounded-lg border border-dashed border-indigo-500"
            style={{ height: `${720 * ((containerWidth - 16) / 1280)}px` }}
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="mt-4 text-lg font-semibold">
                {loadingSlideTitle || 'スライドを生成中...'}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                HTMLコードを組み立て中...
              </p>
            </div>
          </div>
        )}
      </div>

      <div ref={scrollEndRef} />
    </div>
  );
};

// --- モーダルコンポーネント (App.jsx から移動) ---

export const ApiKeyModal = ({ isOpen, tempApiKey, setTempApiKey, handleSave }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#2a2a2e] border border-white/10 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Gemini APIキーを入力</h2>
        <p className="text-gray-400 text-sm mb-6">Google AI StudioでAPIキーを取得し、以下に貼り付けてください。キーはあなたのブラウザのローカルストレージにのみ保存されます。</p>
        <input type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="APIキーを入力..." className="w-full bg-gray-900/50 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <div className="flex justify-end mt-6">
          <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md font-medium transition-colors">保存</button>
        </div>
      </div>
    </div>
  );
};

export const CodeEditorModal = ({ isOpen, html, setHtml, onSave, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#2a2a2e] border border-white/10 rounded-lg shadow-xl p-6 w-full max-w-4xl h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4 flex-shrink-0">HTMLソースコードを編集</h2>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="w-full flex-grow bg-gray-900/50 border border-white/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-mono"
          placeholder="HTMLコード..."
        />
        <div className="flex justify-end mt-4 flex-shrink-0 space-x-2">
          <button onClick={onCancel} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-medium transition-colors">キャンセル</button>
          <button onClick={onSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md font-medium transition-colors">変更を適用</button>
        </div>
      </div>
    </div>
  );
};

export const OutlineModifyModal = ({ isOpen, mode, index, value, onChange, onSave, onCancel }) => {
  if (!isOpen) return null;

  const title = mode === 'all'
    ? '構成案全体をAIで修正'
    : `スライド ${index + 1} をAIで修正`;

  const description = mode === 'all'
    ? '構成案全体（全スライドの順序、タイトル、内容）に対する修正指示を具体的に入力してください。'
    : `このスライド（${index + 1}）に対する修正指示（例：「タイトルを～にして」「箇条書きを3つに要約して」）を入力してください。`;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#2a2a2e] border border-white/10 rounded-lg shadow-xl p-6 w-full max-w-2xl flex flex-col">
        <h2 className="text-xl font-bold mb-4 flex-shrink-0">{title}</h2>
        <p className="text-sm text-gray-400 mb-4">{description}</p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-40 bg-gray-900/50 border border-white/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-mono"
          placeholder="修正指示を入力..."
        />
        <div className="flex justify-end mt-4 flex-shrink-0 space-x-2">
          <button onClick={onCancel} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-medium transition-colors">キャンセル</button>
          <button onClick={onSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md font-medium transition-colors">修正を実行</button>
        </div>
      </div>
    </div>
  );
};