import React from 'react';

// Step 1 で分離した定数をインポート
import { APP_STATUS } from './constants/appStatus';

// Step 2 で作成したカスタムフックをインポート
import { useAppLogic } from './hooks/useAppLogic';

// Step 3 で作成したコンポーネントをインポート
import { 
  AppHeader, 
  FileUploadPanel, 
  PreviewPanel, 
  ApiKeyModal, 
  CodeEditorModal, 
  OutlineModifyModal 
} from './components/CommonComponents';

// Step 4 で作成したコンポーネントをインポート
import { ChatPanel } from './components/ChatPanel';

/**
 * アプリケーションのメインコンポーネント。
 * 全体のStateと主要なロジックは useAppLogic フックが管理します。
 * このコンポーネントは、レイアウトの定義と、フックからの状態・ハンドラを
 * 各UIコンポーネントに接続(props渡し)することに専念します。
 */
export default function App() {
  // === すべてのロジックと状態をフックから取得 ===
  const logic = useAppLogic();

  // === 必要な状態をロジックから分割代入 ===
  const {
    appStatus,
    isApiKeyModalOpen,
    tempApiKey,
    setTempApiKey,
    handleApiKeySave,
    isCodeEditorOpen,
    editableHtml,
    setEditableHtml,
    handleApplyCodeChanges,
    handleCancelCodeEdit,
    isModifyModalOpen,
    modifyModalTarget,
    modificationInput,
    setModificationInput,
    handleSubmitModification,
    handleCloseModifyModal,
  } = logic;


  // === プレビューパネルのローディング状態を計算 ===
  const isGenerating = appStatus === APP_STATUS.GENERATING_SLIDES;
  const isModifying = appStatus === APP_STATUS.SLIDE_GENERATED && logic.isProcessing;
  const isPreviewLoading = isGenerating || isModifying;

  const loadingTitle = isGenerating
    ? logic.slideOutline[logic.currentSlideIndex]?.title // 新規生成中のタイトル
    : isModifying
      ? `${logic.slideOutline[logic.currentSlideIndex]?.title} を修正中...` // 修正中のタイトル
      : ''; // それ以外


  // === JSX (レイアウト定義) ===
  return (
    <div className="bg-[#1e1e1e] h-screen w-screen flex flex-col font-sans text-white">
      
      {/* 1. ヘッダー (CommonComponents.jsx) */}
      <AppHeader 
        onSettingsClick={() => logic.setIsApiKeyModalOpen(true)} 
        onDownloadLog={logic.handleDownloadChatLog}
      />

      <main className="flex-grow flex p-6 gap-6 overflow-hidden">
        
        {/* 2. 左側パネル (幅を動的に変更) */}
        <div className={`transition-all duration-300 ease-in-out ${
           appStatus === APP_STATUS.INITIAL || 
           appStatus === APP_STATUS.STRUCTURING || 
           appStatus === APP_STATUS.STRUCTURED || 
           appStatus === APP_STATUS.SELECTING_THEME || 
           appStatus === APP_STATUS.CREATING_OUTLINE || 
           appStatus === APP_STATUS.SELECTING_SECTION_HEADERS || 
           appStatus === APP_STATUS.GENERATING_OUTLINE || 
           appStatus === APP_STATUS.OUTLINE_CREATED ? 'w-1/3' : 'w-1/2'
        }`}>
          
          {/* 初期〜構成案作成までは FileUploadPanel を表示 */}
          {(
           appStatus === APP_STATUS.INITIAL || 
           appStatus === APP_STATUS.STRUCTURING || 
           appStatus === APP_STATUS.STRUCTURED || 
           appStatus === APP_STATUS.SELECTING_THEME || 
           appStatus === APP_STATUS.CREATING_OUTLINE || 
           appStatus === APP_STATUS.SELECTING_SECTION_HEADERS || 
           appStatus === APP_STATUS.GENERATING_OUTLINE || 
           appStatus === APP_STATUS.OUTLINE_CREATED
          ) ? (
            <FileUploadPanel 
              isProcessing={logic.isProcessing} 
              processingStatus={logic.processingStatus} 
              fileName={logic.fileName} 
              handleDragOver={logic.handleDragOver} 
              handleDrop={logic.handleDrop} 
              onFileSelect={logic.handleFileSelect} 
              appStatus={appStatus}
              thinkingState={logic.thinkingState}
              totalWaitTime={logic.currentTotalWaitTime}
            />
          ) : (
            /* スライド生成開始後は PreviewPanel を表示 */
            <PreviewPanel 
              generatedSlides={logic.generatedSlides}
              htmlContent={logic.currentSlideHtml}
              isLoading={isPreviewLoading}
              loadingTitle={loadingTitle}
            />
          )}
        </div>
        
        {/* 3. 右側パネル（ChatPanel） (幅を動的に変更) */}
        <div className={`transition-all duration-300 ease-in-out ${
            appStatus === APP_STATUS.INITIAL || 
            appStatus === APP_STATUS.STRUCTURING || 
            appStatus === APP_STATUS.STRUCTURED || 
            appStatus === APP_STATUS.SELECTING_THEME || 
            appStatus === APP_STATUS.CREATING_OUTLINE || 
            appStatus === APP_STATUS.SELECTING_SECTION_HEADERS || 
            appStatus === APP_STATUS.GENERATING_OUTLINE || 
            appStatus === APP_STATUS.OUTLINE_CREATED ? 'w-2/3' : 'w-1/2'
          }`}>

          {/* ChatPanel には logic オブジェクトを 'chatState' prop として丸ごと渡す */}
          <ChatPanel chatState={logic} />
        </div> 
      </main>

      {/* 4. モーダル (CommonComponents.jsx) */}
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        tempApiKey={tempApiKey} 
        setTempApiKey={setTempApiKey} 
        handleSave={handleApiKeySave} 
      />
      <CodeEditorModal
        isOpen={isCodeEditorOpen}
        html={editableHtml}
        setHtml={setEditableHtml}
        onSave={handleApplyCodeChanges}
        onCancel={handleCancelCodeEdit}
      />
      <OutlineModifyModal
        isOpen={isModifyModalOpen}
        mode={modifyModalTarget.mode}
        index={modifyModalTarget.index}
        value={modificationInput}
        onChange={setModificationInput}
        onSave={handleSubmitModification}
        onCancel={handleCloseModifyModal}
      />
    </div>
  );
}