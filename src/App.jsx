import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenerativeAI } from '@google/generative-ai';
import JSZip from 'jszip';

// pdf.js のワーカーを設定
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- SVG Icons ---

/** 設定アイコンを表示するコンポーネント */
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-white transition-colors">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

/** ファイルアップロードアイコンを表示するコンポーネント */
const UploadCloudIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" />
  </svg>
);

/** 送信アイコンを表示するコンポーネント */
const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
    </svg>
);

// --- UI Components ---

/**
 * アプリケーションのヘッダーを表示するコンポーネント
 * @param {{ onSettingsClick: () => void }} props
 */
const AppHeader = ({ onSettingsClick }) => (
  <header className="flex-shrink-0 h-14 bg-black/25 flex items-center px-6 justify-between border-b border-white/10 z-10">
    <h1 className="text-lg font-semibold">スライド作成ジェネレーター</h1>
    <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-white/10 transition-colors">
      <SettingsIcon />
    </button>
  </header>
);

/**
 * ファイルのアップロードUIと処理状態を表示するコンポーネント
 * @param {{
 * isProcessing: boolean;
 * processingStatus: string;
 * fileName: string;
 * handleDragOver: (e: React.DragEvent) => void;
 * handleDrop: (e: React.DragEvent) => void;
 * onFileSelect: (file: File) => void;
 * appStatus: string;
 * }} props
 */
const FileUploadPanel = ({ isProcessing, processingStatus, fileName, handleDragOver, handleDrop, onFileSelect, appStatus }) => (
  <div
    className={`w-1/3 bg-white/5 rounded-xl flex flex-col items-center justify-center p-6 border-2 border-dashed ${isProcessing ? 'border-indigo-500' : 'border-white/20 hover:border-indigo-500'} transition-colors`}
    onDragOver={handleDragOver}
    onDrop={handleDrop}
  >
    {isProcessing ? (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-lg font-semibold">{processingStatus}</p>
        <p className="mt-1 text-sm text-gray-400">{fileName}</p>
      </div>
    ) : appStatus !== 'initial' ? (
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
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.txt,.md"
          onChange={(e) => onFileSelect(e.target.files[0])}
        />
        <p className="mt-4 text-xs text-gray-500">対応形式: PDF, TXT, MD</p>
      </div>
    )}
  </div>
);

/**
 * ユーザーとの対話（メッセージ表示、入力）を行うコントロールパネルコンポーネント
 * @param {{
 * messages: { type: 'system' | 'user'; text: string }[];
 * userInput: string;
 * setUserInput: (value: string) => void;
 * handleSendMessage: () => void;
 * chatEndRef: React.RefObject<HTMLDivElement>;
 * appStatus: string;
 * structuredMarkdown: string;
 * setStructuredMarkdown: (value: string) => void;
 * onApproval: () => void;
 * onAgendaChoice: (choice: boolean) => void;
 * onStartGeneration: () => void;
 * onPreview: () => void;
 * onApproveAndNext: () => void;
 * onDownloadZip: () => void;
 * }} props
 */
const ChatPanel = ({ messages, userInput, setUserInput, handleSendMessage, chatEndRef, appStatus, structuredMarkdown, setStructuredMarkdown, onApproval, onAgendaChoice, onStartGeneration, onPreview, onApproveAndNext, onDownloadZip }) => (
  <div className="w-2/3 bg-white/5 rounded-xl flex flex-col border border-white/10 overflow-hidden">
    {/* Chat Messages */}
    <div className="flex-grow p-6 overflow-y-auto space-y-4">
      {messages.map((msg, index) => (
        <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`px-4 py-2 rounded-lg max-w-2xl ${msg.type === 'user' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
          </div>
        </div>
      ))}

      {/* Markdown編集エリア */}
      {appStatus === 'structured' && (
        <div className="bg-black/20 p-4 rounded-lg">
           <p className="text-sm text-gray-300 mb-2">
             以下に構造化されたテキスト案を表示します。内容を確認し、必要であれば直接編集してください。
           </p>
          <textarea
            value={structuredMarkdown}
            onChange={(e) => setStructuredMarkdown(e.target.value)}
            className="w-full h-64 bg-gray-900/50 border border-white/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-mono"
          />
           <div className="flex justify-end mt-4">
            <button
              onClick={onApproval}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors"
            >
              内容を承認して次へ進む
            </button>
          </div>
        </div>
      )}

      {/* アジェンダ選択肢UI */}
      {appStatus === 'creating_outline' && (
        <div className="bg-black/20 p-4 rounded-lg flex justify-center items-center space-x-4">
            <p className="text-sm text-gray-300">アジェンダページを挿入しますか？</p>
            <button
                onClick={() => onAgendaChoice(true)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors"
            >
                はい
            </button>
            <button
                onClick={() => onAgendaChoice(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors"
            >
                いいえ
            </button>
        </div>
      )}

      {/* スライド生成開始ボタン */}
      {appStatus === 'outline_created' && (
        <div className="bg-black/20 p-4 rounded-lg flex justify-center">
            <button
                onClick={onStartGeneration}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors"
            >
                構成案を承認し、スライド生成を開始する
            </button>
        </div>
      )}

      {/* ZIPダウンロードボタン */}
      {appStatus === 'all_slides_generated' && (
        <div className="bg-black/20 p-4 rounded-lg flex justify-center">
            <button
                onClick={onDownloadZip}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors"
            >
                ZIPファイルをダウンロード
            </button>
        </div>
      )}


      <div ref={chatEndRef} />
    </div>

    {/* User Input */}
    <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/20">
      <div className="relative">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="修正指示などを入力..."
          className="w-full bg-gray-900/50 border border-white/20 rounded-lg py-3 pl-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
          disabled={appStatus !== 'slide_generated'}
        />
        <button
          onClick={handleSendMessage}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors disabled:opacity-50"
          disabled={appStatus !== 'slide_generated' || !userInput.trim()}
        >
          <SendIcon />
        </button>
      </div>
       <div className="flex justify-end mt-4 space-x-2">
            <button
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                disabled={appStatus !== 'slide_generated'}
                onClick={onPreview}
            >
                プレビュー
            </button>
            <button
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                disabled={appStatus !== 'slide_generated'}
                onClick={onApproveAndNext}
            >
                承認して次へ
            </button>
        </div>
    </div>
  </div>
);

/**
 * APIキーの入力を求めるモーダルウィンドウ
 * @param {{
 * isOpen: boolean;
 * tempApiKey: string;
 * setTempApiKey: (key: string) => void;
 * handleSave: () => void;
 * handleClose: () => void;
 * }} props
 */
const ApiKeyModal = ({ isOpen, tempApiKey, setTempApiKey, handleSave, handleClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#2a2a2e] border border-white/10 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Gemini APIキーを入力</h2>
        <p className="text-gray-400 text-sm mb-6">
          Google AI StudioでAPIキーを取得し、以下に貼り付けてください。キーはあなたのブラウザのローカルストレージにのみ保存されます。
        </p>
        <input
          type="password"
          value={tempApiKey}
          onChange={(e) => setTempApiKey(e.target.value)}
          placeholder="APIキーを入力..."
          className="w-full bg-gray-900/50 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md font-medium transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};


/**
 * アプリケーションのメインコンポーネント。
 * 全体のStateと主要なロジックを管理します。
 */
export default function App() {
  // --- State Management ---
  // APIキー関連のState
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  // アプリケーションの進行状況と対話内容のState
  const [appStatus, setAppStatus] = useState('initial');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');

  // ファイルとコンテンツ関連のState
  const [fileName, setFileName] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [structuredMarkdown, setStructuredMarkdown] = useState('');
  const [slideOutline, setSlideOutline] = useState([]); // スライド構成案を保持
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // スライド生成サイクルのState
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0); // 現在生成中のスライド番号
  const [generatedSlides, setGeneratedSlides] = useState([]); // 生成済みスライドHTMLを保持
  const [currentSlideHtml, setCurrentSlideHtml] = useState(''); // 現在プレビュー中のスライドHTML

  // チャットウィンドウを自動スクロールするためのRef
  const chatEndRef = useRef(null);

  // --- Effects ---
  /**
   * コンポーネントのマウント時に実行されるEffect。
   * ローカルストレージからAPIキーを読み込み、存在しない場合はモーダルを表示する。
   */
  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setMessages([{ type: 'system', text: 'ようこそ！スライドの元になるドキュメントをアップロードしてください。' }]);
    } else {
      setIsApiKeyModalOpen(true);
      setMessages([{ type: 'system', text: 'まず、Gemini APIキーを設定してください。' }]);
    }
  }, []);

  /**
   * messages Stateが更新されるたびに実行されるEffect。
   * チャットの表示領域を最下部にスクロールする。
   */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // --- Handlers ---
  /**
   * APIキーモーダルで「保存」ボタンがクリックされたときの処理。
   * 入力されたキーをローカルストレージに保存する。
   */
  const handleApiKeySave = () => {
    if (tempApiKey) {
      localStorage.setItem('gemini_api_key', tempApiKey);
      setApiKey(tempApiKey);
      setIsApiKeyModalOpen(false);
       setMessages([{ type: 'system', text: 'APIキーが保存されました。スライドの元になるドキュメントをアップロードしてください。' }]);
    }
  };

  /** ファイルがドラッグされたときのイベントハンドラ */
  const handleDragOver = (e) => e.preventDefault();

  /** ファイルがドロップされたときのイベントハンドラ */
  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /**
   * ファイルが選択された（ドロップまたは選択ボタン）際のメイン処理関数。
   * ファイル形式を検証し、テキスト抽出処理を開始する。
   * @param {File} file ユーザーが選択したファイル
   */
  const handleFileSelect = async (file) => {
    if (!file) return;

    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[ERROR] Step 1.1: Unsupported file format.', { type: file.type });
      setMessages(prev => [...prev, { type: 'system', text: `サポートされていないファイル形式です: ${file.type}\n(PDF, TXT, MDのみ)` }]);
      return;
    }

    console.log('[INFO] Step 1.1: File selected.', { name: file.name, size: file.size, type: file.type });
    setFileName(file.name);
    setIsProcessing(true);
    setProcessingStatus('ファイルのテキストを抽出中...');
    setMessages(prev => [...prev, { type: 'system', text: `${file.name} をアップロードしました。`}]);

    console.log('[INFO] Step 1.2: Starting text extraction from file.');
    let text = '';
    try {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const typedarray = new Uint8Array(e.target.result);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          let textContent = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textData = await page.getTextContent();
            textContent += textData.items.map(s => s.str).join(' ');
          }
          text = textContent;
          onTextExtracted(text);
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          text = e.target.result;
          onTextExtracted(text);
        };
        reader.readAsText(file);
      }
    } catch (error) {
        console.error('[ERROR] Step 1.2: Failed to extract text.', error);
        setMessages(prev => [...prev, { type: 'system', text: 'テキストの抽出中にエラーが発生しました。' }]);
        setIsProcessing(false);
        setFileName('');
    }
  };

  /**
   * テキスト抽出が正常に完了した後に呼び出されるコールバック関数。
   * 抽出されたテキストをStateに保存し、構造化APIを呼び出す。
   * @param {string} text 抽出されたテキスト
   */
  const onTextExtracted = (text) => {
    console.log('[INFO] Step 1.2: Text extraction completed.', { length: text.length });
    setMessages(prev => [...prev, { type: 'system', text: `テキストの抽出が完了しました。（${text.length}文字）\n次に、内容を構造化します。` }]);
    setExtractedText(text);
    structureText(text);
  };

  /**
   * 抽出されたテキストをGemini APIに送信してMarkdown形式に構造化する関数。
   * @param {string} text 構造化するプレーンテキスト
   */
  const structureText = async (text) => {
    setAppStatus('structuring');
    setIsProcessing(true);
    setProcessingStatus('Gemini APIでテキストを構造化中...');

    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'system', text: 'APIキーが設定されていません。設定画面からAPIキーを入力してください。' }]);
      setIsProcessing(false);
      return;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      const prompt = `### 指示\nあなたは、与えられたテキストをクリーンアップし、論理構造を解析する専門家です。以下のテキストに含まれる、PDF抽出時に発生しがちな単語間の不自然なスペース（例：「ドキュメント」が「ドキュ メント」となっている箇所）を修正し、自然な文章にしてください。
その上で、内容を論理的に整理し、見出し、リスト、段落が明確に分かるMarkdown形式に再構成してください。元のテキストに含まれる重要な情報は一切省略しないでください。\n\n### テキスト\n${text}`;

      console.log('[INFO] Step 1.3: Sending text to Gemini API for structuring.');
      console.debug('[DEBUG] Step 1.3: Prompt for structuring text:', prompt);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const markdown = await response.text();

      console.log('[INFO] Step 1.3: Received structured markdown from API.');
      setStructuredMarkdown(markdown);
      setAppStatus('structured');
      setMessages(prev => [...prev, { type: 'system', text: 'テキストの構造化が完了しました。' }]);

    } catch (error) {
      console.error('[FATAL] API Error:', error);
      setMessages(prev => [...prev, { type: 'system', text: `APIエラーが発生しました: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * ユーザーが構造化されたMarkdownを承認したときの処理。
   * アジェンダ挿入の選択肢を提示する。
   */
  const handleMarkdownApproval = () => {
    console.log('[INFO] Step 1.5: User approved the structured markdown.');
    setAppStatus('creating_outline');
    setMessages(prev => [...prev, { type: 'system', text: '内容が承認されました。スライドにアジェンダ（目次）ページを挿入しますか？' }]);
  };

  /**
   * アジェンダの選択を受け取り、構成案の生成を開始する関数
   * @param {boolean} includeAgenda アジェンダを挿入するかどうか
   */
  const handleAgendaChoice = async (includeAgenda) => {
    console.log('[INFO] Step 1.7: User selection for agenda slide:', includeAgenda);
    setMessages(prev => [...prev, { type: 'user', text: includeAgenda ? 'はい' : 'いいえ' }]);

    setAppStatus('generating_outline');
    setIsProcessing(true);
    setProcessingStatus('Gemini APIで構成案を生成中...');

    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'system', text: 'APIキーが設定されていません。' }]);
      setIsProcessing(false);
      return;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      const agendaCondition = includeAgenda
        ? '- 2枚目は「アジェンダ」ページとし、3枚目以降の内容の目次を生成してください。'
        : '';

      // アジェンダの有無に応じて、出力形式の例を動的に変更
      const outputFormatExample = includeAgenda
        ? `[
  {"title": "(ここにタイトルページのタイトル)", "summary": "(ここにタイトルページの簡単な説明や発表者名など)"},
  {"title": "アジェンダ", "summary": "(3枚目以降のタイトルリスト)"},
  {"title": "(3枚目のタイトル)", "summary": "(3枚目の内容の要約)"}
]`
        : `[
  {"title": "(ここにタイトルページのタイトル)", "summary": "(ここにタイトルページの簡単な説明や発表者名など)"},
  {"title": "(2枚目のタイトル)", "summary": "(2枚目の内容の要約)"},
  {"title": "(3枚目のタイトル)", "summary": "(3枚目の内容の要約)"}
]`;

      const prompt = `### 指示
あなたはプロのプレゼンテーション構成作家です。以下のMarkdownテキストを分析し、プレゼンテーションの構成案を作成してください。構成案は、各スライドの「タイトル」と「そのスライドで説明する内容の要約」をJSONのリスト形式で出力してください。

### 条件
- 1枚目は必ず「タイトルページ」とします。タイトルはMarkdownの内容から最も適切と思われるものを設定してください。
${agendaCondition}
- 3枚目以降は、Markdownの論理構造に従って内容を分割し、各スライドのタイトルと要約を作成してください。
- 全体で8〜12枚程度のスライド構成になるように調整してください。

### 出力形式(JSON)
${outputFormatExample}

### Markdownテキスト
${structuredMarkdown}`;

      console.log('[INFO] Step 1.8: Sending markdown to Gemini API for slide outline generation.');
      console.debug('[DEBUG] Step 1.8: Prompt for outline generation:', prompt);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let jsonText = response.text();

      // Clean up the JSON response
      jsonText = jsonText.replace(/^```json\s*|```\s*$/g, '');

      const outline = JSON.parse(jsonText);

      console.log('[INFO] Step 1.8: Received slide outline from API.');
      setSlideOutline(outline);
      setAppStatus('outline_created');

      const outlineText = "構成案が生成されました。\n\n" + outline.map((slide, index) => `${index + 1}. ${slide.title}`).join('\n');
      setMessages(prev => [...prev, { type: 'system', text: outlineText }]);

    } catch (error) {
      console.error('[FATAL] API Error:', error);
      setMessages(prev => [...prev, { type: 'system', text: `構成案の生成中にAPIエラーが発生しました: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 構成案が承認され、スライド生成サイクルを開始する関数
   */
  const handleStartGeneration = () => {
    const firstSlide = slideOutline[0];
    console.log(`[INFO] Step 2.1: Starting generation for slide 1: ${firstSlide.title}`);
    setAppStatus('generating_slides');
    setMessages(prev => [...prev, { type: 'system', text: `構成案が承認されました。\n\n**ステップ2: スライド生成**\n1枚目「${firstSlide.title}」の生成を開始します。` }]);

    generateSlide(currentSlideIndex);
  };

  /**
   * 指定されたインデックスのスライドHTMLを生成するAPI通信関数
   * @param {number} slideIndex 生成するスライドのインデックス
   */
  const generateSlide = async (slideIndex) => {
    setIsProcessing(true);
    const currentSlide = slideOutline[slideIndex];
    setProcessingStatus(`${slideIndex + 1}枚目のスライド「${currentSlide.title}」を生成中...`);

    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'system', text: 'APIキーが設定されていません。' }]);
      setIsProcessing(false);
      return;
    }

    const visualHint = "内容に応じて、インフォグラフィック、図、グラフ、アイコンなどを効果的に使用してください。";

    const prompt = `### あなたの役割
あなたは、モダンで視覚的に分かりやすいプレゼンテーションスライドを作成するプロのデザイナー兼HTMLコーダーです。

### 指示
以下の情報に基づき、プレゼンテーションの**${slideIndex + 1}枚目**のスライドを**単一のHTMLファイル**として生成してください。

### 思考プロセス
1. 以下の「今回生成するスライドの情報」を深く理解します。
2. 内容を最も効果的に伝えるための視覚的なレイアウト（インフォグラフィック、図、グラフ、アイコンなどを含む）を考案します。
3. 考案したレイアウトを、以下の「HTML生成の厳格なルール」に従って、単一のHTMLファイルとしてコーディングします。

### プレゼンテーション全体の構成案
${JSON.stringify(slideOutline, null, 2)}

### 今回生成するスライドの情報
- スライド番号: ${slideIndex + 1}
- スライドタイトル: ${currentSlide.title}
- スライドの内容(要約): ${currentSlide.summary}

### 視覚的表現のヒント
${visualHint}

### HTML生成の厳格なルール
- **最重要:** 生成するコンテンツはHTMLコードのみです。解説や前置きは一切不要です。\`<!DOCTYPE html>\`から\`</html>\`までを出力してください。
- CSSは\`<style>\`タグ内に、JSは\`<script>\`タグ内に記述してください。ただし、**アニメーション、ページ遷移、ホバーエフェクトなどの動的要素は一切含めないでください。**
- スライドのサイズは厳密に幅1280px、高さ720pxとします。\`<body>\`タグに直接スタイルを適用するか、全体をラップする\`<div style="width: 1280px; height: 720px; overflow: hidden;">\`を作成してください。
- 全ての要素(テキスト、図、画像など)はこの1280×720pxの領域内に完全に収めてください。
- テキストは単語の途中で不自然に改行されないように、CSSの\`word-break: keep-all;\`や\`overflow-wrap: break-word;\`を適切に使用してください。
- 使用するフォントは、\`@import\`で読み込めるWebフォント（例: Google Fontsの'Inter'や'Noto Sans JP'）を指定してください。
- アイコンを使用する場合は、\`<svg>\`タグを直接HTMLに埋め込んでください。外部画像ファイル(\`<img>\`タグ)は使用しないでください。
`;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

      console.log(`[INFO] Step 2.1: Starting generation for slide ${slideIndex + 1}: ${currentSlide.title}`);
      console.debug('[DEBUG] Step 2.1: Prompt for HTML generation:', prompt);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let htmlContent = response.text();

      htmlContent = htmlContent.replace(/^```html\s*|```\s*$/g, '').trim();

      console.log(`[INFO] Step 2.1: Received HTML for slide ${slideIndex + 1}.`);
      setCurrentSlideHtml(htmlContent);
      setAppStatus('slide_generated');
      setMessages(prev => [...prev, { type: 'system', text: `スライド「${currentSlide.title}」が生成されました。\nプレビューで確認し、問題なければ承認して次のスライドに進んでください。`}]);

    } catch (error) {
      console.error('[FATAL] API Error:', error);
      setMessages(prev => [...prev, { type: 'system', text: `スライド生成中にAPIエラーが発生しました: ${error.message}` }]);
      setAppStatus('outline_created'); // エラー時は構成案承認画面に戻す
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * ユーザーからの修正指示に基づき、現在のスライドを修正するAPI通信関数
   * @param {string} modificationRequest ユーザーが入力した修正指示
   */
  const modifySlide = async (modificationRequest) => {
    setIsProcessing(true);
    setProcessingStatus(`スライド ${currentSlideIndex + 1} を修正中...`);

    console.log(`[INFO] Step 2.2: User requested modification for slide ${currentSlideIndex + 1}.`);
    console.debug('[DEBUG] Step 2.2: User modification request:', modificationRequest);

    const prompt = `### あなたの役割
あなたは、既存のHTMLコードをユーザーの指示に基づいて精密に修正するHTMLコーダーです。

### 指示
添付されたHTMLコードを、以下の「ユーザーからの修正指示」に基づいて修正してください。

### 厳格なルール
- **最重要:** 指示された箇所以外のデザイン、レイアウト、テキストは**絶対に、いかなる理由があっても変更しないでください。**
- 変更は最小限に留めてください。
- 出力は修正後の完全なHTMLコードのみとし、解説などは一切含めないでください。

### ユーザーからの修正指示
${modificationRequest}

### 修正対象のHTMLコード
\`\`\`html
${currentSlideHtml}
\`\`\`
`;
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        console.log('[INFO] Step 2.2: Sending request to Gemini API for HTML modification.');
        console.debug('[DEBUG] Step 2.2: Prompt for HTML modification:', prompt);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let modifiedHtml = response.text();

        modifiedHtml = modifiedHtml.replace(/^```html\s*|```\s*$/g, '').trim();

        console.log(`[INFO] Step 2.2: Received modified HTML for slide ${currentSlideIndex + 1}.`);
        setCurrentSlideHtml(modifiedHtml);
        setMessages(prev => [...prev, { type: 'system', text: 'スライドが修正されました。再度プレビューで確認してください。' }]);

    } catch (error) {
        console.error('[FATAL] API Error:', error);
        setMessages(prev => [...prev, { type: 'system', text: `スライドの修正中にAPIエラーが発生しました: ${error.message}` }]);
    } finally {
        setIsProcessing(false);
    }
  };

  /**
   * 現在生成されているスライドを新しいタブでプレビューする関数
   */
  const handlePreview = () => {
    if (!currentSlideHtml) return;
    const blob = new Blob([currentSlideHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  /**
   * 現在のスライドを承認し、次のスライド生成に進む関数
   */
  const handleApproveAndNext = () => {
    console.log(`[INFO] Step 2.7: User approved slide ${currentSlideIndex + 1}. HTML saved.`);
    setGeneratedSlides(prev => [...prev, currentSlideHtml]);
    setCurrentSlideHtml('');

    const nextIndex = currentSlideIndex + 1;

    if (nextIndex < slideOutline.length) {
      setCurrentSlideIndex(nextIndex);
      const nextSlide = slideOutline[nextIndex];
      setMessages(prev => [...prev, { type: 'system', text: `スライド ${currentSlideIndex} を承認しました。\n\n次のスライド「${nextSlide.title}」の生成を開始します。`}]);
      generateSlide(nextIndex);
    } else {
      // 最終スライドを保存してから完了画面へ
      setAppStatus('all_slides_generated');
      console.log('[INFO] Step 3: All slides validated and stored.');
      setMessages(prev => [...prev, { type: 'system', text: "全てのステップが完了しました！\n\n下のボタンから、生成された全スライドをZIPファイルとしてダウンロードできます。"}]);
    }
  };

  /**
   * 生成された全スライドをZIPファイルとしてダウンロードする関数
   */
  const handleDownloadZip = async () => {
    console.log('[INFO] Step 4: Starting ZIP file generation.');
    setIsProcessing(true);
    setProcessingStatus('ZIPファイルを生成中...');
    
    try {
      const zip = new JSZip();
      // NOTE: `generatedSlides` には最後のスライドが含まれていないため、
      // `all_slides_generated` ステータスになる前の最後のスライド `currentSlideHtml` を追加する必要がある。
      // ただし、現在のロジックでは handleApproveAndNext で最後のスライドが `generatedSlides` に追加された *後* に
      // `all_slides_generated` に遷移するため、このままで正しい。
      const finalSlides = [...generatedSlides];
      if (appStatus === 'all_slides_generated' && currentSlideIndex === slideOutline.length - 1 && currentSlideHtml) {
           // この条件は通常発生しないはずだが、念のため
      }

      finalSlides.forEach((html, index) => {
        zip.file(`s${index + 1}.html`, html);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'slides.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      console.log('[INFO] Step 4: slides.zip has been successfully created and downloaded.');

    } catch (error) {
      console.error('[ERROR] Step 4: Failed to generate ZIP file.', error);
      setMessages(prev => [...prev, { type: 'system', text: `ZIPファイルの生成中にエラーが発生しました: ${error.message}`}]);
    } finally {
      setIsProcessing(false);
    }
  };


  /** 送信ボタンがクリックされたときの処理 */
  const handleSendMessage = () => {
    if (!userInput.trim() || appStatus !== 'slide_generated') return;
    
    setMessages(prev => [...prev, { type: 'user', text: userInput }]);
    modifySlide(userInput);
    setUserInput('');
  };

  // --- Render ---
  return (
    <div className="bg-[#1e1e1e] h-screen w-screen flex flex-col font-sans text-white">
      <AppHeader onSettingsClick={() => setIsApiKeyModalOpen(true)} />

      <main className="flex-grow flex p-6 gap-6 overflow-hidden">
        <FileUploadPanel
          isProcessing={isProcessing}
          processingStatus={processingStatus}
          fileName={fileName}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          onFileSelect={handleFileSelect}
          appStatus={appStatus}
        />
        <ChatPanel
          messages={messages}
          userInput={userInput}
          setUserInput={setUserInput}
          handleSendMessage={handleSendMessage}
          chatEndRef={chatEndRef}
          appStatus={appStatus}
          structuredMarkdown={structuredMarkdown}
          setStructuredMarkdown={setStructuredMarkdown}
          onApproval={handleMarkdownApproval}
  
          onAgendaChoice={handleAgendaChoice}
          onStartGeneration={handleStartGeneration}
          onPreview={handlePreview}
          onApproveAndNext={handleApproveAndNext}
          onDownloadZip={handleDownloadZip}
        />
      </main>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        tempApiKey={tempApiKey}
        setTempApiKey={setTempApiKey}
        handleSave={handleApiKeySave}
        handleClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}