import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenerativeAI } from '@google/generative-ai';
import JSZip from 'jszip';
import { THEMES } from './templates'; // ★★★ この行を追加 ★★★

// pdf.js のワーカーを設定
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- 定数定義 ---

/** アプリケーションの状態を管理する定数 */
const APP_STATUS = {
  INITIAL: 'initial',
  STRUCTURING: 'structuring',
  STRUCTURED: 'structured',
  SELECTING_THEME: 'selecting_theme',
  CREATING_OUTLINE: 'creating_outline',
  SELECTING_SECTION_HEADERS: 'selecting_section_headers',
  GENERATING_OUTLINE: 'generating_outline',
  OUTLINE_CREATED: 'outline_created',
  GENERATING_SLIDES: 'generating_slides',
  SLIDE_GENERATED: 'slide_generated',
  ALL_SLIDES_GENERATED: 'all_slides_generated',
};

/** Gemini APIに送信するプロンプトを一元管理 */
const PROMPTS = {
  structureText: (text) => `### 指示
あなたは、与えられたテキストをクリーンアップし、論理構造を解析する専門家です。以下のテキストに含まれる、PDF抽出時に発生しがちな単語間の不自然なスペース（例：「ドキュメント」が「ドキュ メント」となっている箇所）を修正し、自然な文章にしてください。
その上で、内容を論理的に整理し、見出し、リスト、段落が明確に分かるMarkdown形式に再構成してください。元のテキストに含まれる重要な情報は一切省略しないでください。

### テキスト
${text}`,

  createOutline: (markdown, includeAgenda, useSectionHeaders) => {
    const agendaCondition = includeAgenda
      ? '- 2枚目は必ず"アジェンダ"ページとし、`template`は`agenda`を選択してください。`summary`には3枚目以降のタイトルを改行区切りでリストアップしてください。'
      : '- **アジェンダページは絶対に作成しないでください。**';
    const sectionHeaderCondition = useSectionHeaders
      ? '- Markdownの主要な見出し（章やセクション）の前に、`template`が`section_header`のスライドを自動で挿入してください。'
      : '- `section_header`テンプレートは使用しないでください。';

    return `### 指示
あなたはプロのプレゼンテーション構成作家です。以下のMarkdownテキストを分析し、最も効果的なプレゼンテーションの構成案をJSON形式で作成してください。

### 利用可能なテンプレート
- \`title_slide\`: 表紙
- \`agenda\`: 目次
- \`section_header\`: 章の区切り
- \`content_basic\`: **箇条書き**（番号なし・あり両方）のための最も標準的なテンプレート。
- \`content_with_diagram\`: 文章と図解（インフォグラフィック）。
- \`three_points\`: 3つの要点を横並びで表示。
- \`vertical_steps\`: 時系列やステップ。
- \`comparison\`: **2つの項目（メリット/デメリット、A案/B案など）を比較・対比**するための専用テンプレート。
- \`summary_or_thankyou\`: 最後のまとめ、または「ご聴取ありがとうございました」用。

### 条件
- 1枚目は必ず\`template\`が\`title_slide\`のタイトルページとしてください。タイトルはMarkdownの内容から最も適切と思われるものを自動で設定してください。
- **最重要**: \`summary\`や各項目の説明は、**プレゼンテーションでそのまま使える簡潔な言葉**で記述し、必要に応じて箇条書き（- や 1.）を使用してください。

- **箇条書き（番号付き/なし）が中心のスライド**を作成する場合は、\`content_basic\` テンプレートを最優先で使用してください。
  - \`content_basic\` を選択した場合、**\`summary\`キーは絶対に空（""）**にし、代わりに **\`items\`キー** で「箇条書きの各項目（文字列）」の配列を生成してください。
  - 例: \`"title": "主な特長", "summary": "", "template": "content_basic", "items": ["高速処理", "高い安全性", "簡単な操作性"]\`

- **2つの項目を比較・対比**している場合は、\`comparison\` テンプレートを最優先で使用してください。
  - \`comparison\` を選択した場合、\`summary\`は空にし、代わりに\`columns\`というキーで2要素の配列を生成してください。
  - 各要素は \`{ "title": "(カラム1のタイトル)", "items": ["(カラム1の箇条書き1)", "(カラム1の箇条書き2)"] }\` の形式です。

- 3つの項目を並列に紹介する場合は \`three_points\` の使用を優先してください。
  - \`three_points\` の場合、\`summary\`は空にし、代わりに\`points\`というキーで3要素の配列を生成してください。
  - 各要素は \`{ "title": "...", "summary": "...", "icon_description": "..." }\` の形式です。

- 時系列やステップを示す場合は \`vertical_steps\` を選択してください。
  - \`vertical_steps\` の場合、\`summary\`は空にし、代わりに\`items\`というキーで要素の配列を生成してください。
  - 各要素は \`{ "title": "...", "description": "..." }\` の形式です。

- \`content_with_diagram\` テンプレートを選択した場合、**スライドの本文を必ず \`summary\` キーに記述**してください。インフォグラフィックが必要な場合は、\`infographic\` オブジェクトを別途生成してください。

${agendaCondition}
${sectionHeaderCondition}

- 最後のスライドは \`summary_or_thankyou\` とし、タイトルを「まとめ」または「ご清聴ありがとうございました」に設定してください。

### 出力形式(JSON)の例
- **最重要**: 出力はJSON配列の文字列のみとし、前後に\`\`\`jsonや説明文を含めないでください。
[
  { "title": "タイトルページ", "summary": "発表者名", "template": "title_slide" },
  {
    "title": "システムの概要",
    "summary": "このシステムは、最新のAI技術を活用して業務効率を劇的に向上させます。\\n主な特徴は以下の3点です。\\n1. 高速処理\\n2. 高い安全性\\n3. 簡単な操作性",
    "template": "content_with_diagram",
    "infographic": {
      "needed": true,
      "description": "中央に脳のアイコンを配置し、そこから「スピード」「セキュリティ」「使いやすさ」を示す3つのアイコンへ線が伸びている図"
    }
  },
  {
    "title": "3つのプラン",
    "summary": "",
    "template": "three_points",
    "points": [
      { "title": "ベーシックプラン", "summary": "個人利用に最適。", "icon_description": "一人の人物のシルエットアイコン" },
      { "title": "プロプラン", "summary": "チームでの利用に最適。", "icon_description": "複数の人物のシルエットアイコン" },
      { "title": "エンタープライズプラン", "summary": "大規模組織向け。", "icon_description": "近代的なオフィスのビルアイコン" }
    ]
  },
  {
    "title": "プロジェクトの3ステップ",
    "summary": "",
    "template": "vertical_steps",
    "items": [
      { "title": "ステップ1：計画", "description": "目標設定とリソースの割り当て。" },
      { "title": "ステップ2：実行", "description": "計画に基づきタスクを遂行。" },
      { "title": "ステップ3：評価", "description": "結果を分析し、次の計画へ反映。" }
    ]
  },
  {
    "title": "主な特長",
    "summary": "",
    "template": "content_basic",
    "items": [
      "独自のアルゴリズムによる高速処理",
      "最新の暗号化技術による高い安全性",
      "直感的なUIによる簡単な操作性"
    ]
  },
  {
    "title": "A案とB案の比較",
    "summary": "",
    "template": "comparison",
    "columns": [
      { "title": "A案 (現行)", "items": ["コストが低い", "導入が容易"] },
      { "title": "B案 (新規)", "items": ["パフォーマンスが高い", "拡張性に優れる", "長期的なコスト削減"] }
    ]
  },
  { "title": "ご清聴ありがとうございました", "summary": "", "template": "summary_or_thankyou" }
]

### Markdownテキスト
${markdown}`;
  },

  generateInfographic: (description) => `### あなたの役割
あなたは、与えられた指示に基づき、情報を視覚的に表現するためのSVG（スケーラブル・ベクター・グラフィックス）コードを生成する専門家です。

### 指示
以下の「インフォグラフィックの詳細説明」を読み、その内容を表現するSVGコードを生成してください。

### 厳格なルール
- **最重要:** あなたの応答は\`<svg\`で始まり、\`</svg>\`で終わる必要があります。これ以外のXML宣言、コードブロック、解説、テキストは絶対に含めないでください。
- **【超重要】SVG内に\`<text>\`タグやその他のテキスト要素を一切含めないでください。アイコンや図形のみで内容を表現してください。**
- SVGのサイズは、親要素に合わせて柔軟に拡縮されるように、\`width="100%"\` \`height="100%"\` \`viewBox="0 0 100 100"\` のように設定してください（viewBoxの値は内容に応じて調整可）。
- SVG内の配色は、モダンで分かりやすいカラーパレット（例：#38bdf8, #818cf8, #e2e8f0 など）を使用してください。背景が暗いことを想定してください。

### インフォグラフィックの詳細説明
${description}`,

  modifySlide: (modificationRequest, currentSlideHtml) => `### あなたの役割
あなたは、ユーザーの指示を100%忠実に、かつ正確にHTMLコードへ反映させる精密なコーディングアシスタントです。

### 指示
「修正対象のHTMLコード」を「ユーザーからの修正指示」に基づき修正し、その結果を厳格なJSON形式で出力してください。

### 思考プロセス
1. 「修正対象のHTMLコード」と「ユーザーからの修正指示」を完全に理解します。
2. 指示に従ってHTMLコードを修正します。
3. 実際に行った変更点を日本語の箇条書きで簡潔にまとめます。
4. 修正後の完全なHTMLコードと、まとめた変更点の両方を、指定されたJSON形式で出力します。

### 出力形式 (JSON)
- **最重要**: 出力は必ず以下の構造を持つJSONオブジェクトの文字列のみとしてください。前後に説明や\`\`\`jsonを含めないでください。
\`\`\`json
{
  "html": "(ここに修正後の完全なHTMLコードを文字列として挿入)",
  "changes": "(ここに実際に行った変更点の箇条書きを文字列として挿入。例: ・ヘッダーの文言を変更しました。\\n・背景色を#e0f7faに変更しました。)"
}
\`\`\`

### ユーザーからの修正指示
${modificationRequest}

### 修正対象のHTMLコード
\`\`\`html
${currentSlideHtml}
\`\`\`
`
};


// --- アイコンコンポーネント ---
const SettingsIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-white transition-colors"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>);
const UploadCloudIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></svg>);
const SendIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>);

// --- UI コンポーネント ---
const AppHeader = ({ onSettingsClick }) => (
  <header className="flex-shrink-0 h-14 bg-black/25 flex items-center px-6 justify-between border-b border-white/10 z-10">
    <h1 className="text-lg font-semibold">スライド作成ジェネレーター</h1>
    <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-white/10 transition-colors">
      <SettingsIcon />
    </button>
  </header>
);

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

const MessageList = ({ messages }) => (
  <div className="flex-grow p-6 overflow-y-auto space-y-4">
    {messages.map((msg, index) => (
      <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`px-4 py-2 rounded-lg max-w-2xl ${msg.type === 'user' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
        </div>
      </div>
    ))}
  </div>
);

const MarkdownEditor = ({ markdown, setMarkdown, onApprove }) => (
  <div className="bg-black/20 p-4 rounded-lg">
    <p className="text-sm text-gray-300 mb-2">以下に構造化されたテキスト案を表示します。内容を確認し、必要であれば直接編集してください。</p>
    <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} className="w-full h-64 bg-gray-900/50 border border-white/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-mono" />
    <div className="flex justify-end mt-4">
      <button onClick={onApprove} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors">内容を承認して次へ進む</button>
    </div>
  </div>
);

const ThemeSelector = ({ selectedTheme, selectedDesign, onThemeSelect, onDesignSelect, onApprove }) => (
  <div className="bg-black/20 p-4 rounded-lg space-y-4">
    <div className="flex justify-center items-center space-x-4">
      <p className="text-sm text-gray-300">1. プレゼンテーションのテーマを選択:</p>
      {Object.entries(THEMES).map(([themeKey, themeValue]) => (
        <button
          key={themeKey}
          onClick={() => onThemeSelect(themeKey)}
          className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${selectedTheme === themeKey ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {themeValue.name}
        </button>
      ))}
    </div>
    <div className="flex justify-center items-center space-x-4 border-t border-white/10 pt-4">
       <p className="text-sm text-gray-300">2. デザインを選択:</p>
       <button
          onClick={() => onDesignSelect('dark')}
          className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${selectedDesign === 'dark' ? 'bg-gray-800 ring-2 ring-indigo-400' : 'bg-gray-800 hover:bg-gray-700'}`}
        >
          ダーク
        </button>
        <button
          onClick={() => onDesignSelect('light')}
          className={`px-6 py-2 text-black text-sm font-medium rounded-md transition-colors ${selectedDesign === 'light' ? 'bg-gray-200 ring-2 ring-indigo-400' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          ライト
        </button>
    </div>
    <div className="flex justify-end pt-2">
       <button onClick={onApprove} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors">決定して次へ</button>
    </div>
  </div>
);

const AgendaSelector = ({ onSelect }) => (
  <div className="bg-black/20 p-4 rounded-lg flex justify-center items-center space-x-4">
    <p className="text-sm text-gray-300">アジェンダページを挿入しますか？</p>
    <button onClick={() => onSelect(true)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors">はい</button>
    <button onClick={() => onSelect(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors">いいえ</button>
  </div>
);

const SectionHeaderSelector = ({ onSelect }) => (
  <div className="bg-black/20 p-4 rounded-lg flex justify-center items-center space-x-4">
    <p className="text-sm text-gray-300">主要なセクションの前に区切りスライドを自動挿入しますか？</p>
    <button onClick={() => onSelect(true)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors">はい</button>
    <button onClick={() => onSelect(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors">いいえ</button>
  </div>
);

const OutlineEditor = ({ outline, onChange, onInsert, onDelete, onStart, selectedTheme }) => {
  const handlePointChange = (slideIndex, pointIndex, field, value) => {
    const newOutline = [...outline];
    const newPoints = [...(newOutline[slideIndex].points || [])];
    newPoints[pointIndex] = { ...newPoints[pointIndex], [field]: value };
    onChange(slideIndex, 'points', newPoints);
  };
  
  const handleItemChange = (slideIndex, itemIndex, field, value) => {
    const newOutline = [...outline];
    const newItems = [...(newOutline[slideIndex].items || [])];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    onChange(slideIndex, 'items', newItems);
  };

  // ★★★ ここからが修正点 (comparison テンプレート対応) ★★★
  const handleColumnChange = (slideIndex, colIndex, field, value) => {
    const newOutline = [...outline];
    const newColumns = [...(newOutline[slideIndex].columns || [{}, {}])];
    newColumns[colIndex] = { ...newColumns[colIndex], [field]: value };
    onChange(slideIndex, 'columns', newColumns);
  };

  const handleColumnItemChange = (slideIndex, colIndex, itemIndex, value) => {
    const newOutline = [...outline];
    const newColumns = [...(newOutline[slideIndex].columns || [{}, {}])];
    const newItems = [...(newColumns[colIndex].items || [])];
    newItems[itemIndex] = value;
    newColumns[colIndex] = { ...newColumns[colIndex], items: newItems };
    onChange(slideIndex, 'columns', newColumns);
  };

  const handleAddColumnItem = (slideIndex, colIndex) => {
    const newOutline = [...outline];
    const newColumns = [...(newOutline[slideIndex].columns || [{}, {}])];
    const newItems = [...(newColumns[colIndex].items || []), "新しい項目"];
    newColumns[colIndex] = { ...newColumns[colIndex], items: newItems };
    onChange(slideIndex, 'columns', newColumns);
  };
  // ★★★ ここまでが修正点 ★★★

  const availableTemplates = THEMES[selectedTheme]?.templates ? Object.keys(THEMES[selectedTheme].templates) : [];

  return (
    <div className="bg-black/20 p-4 rounded-lg space-y-4">
      <p className="text-sm text-gray-300 mb-2 font-semibold">構成案が生成されました。内容を編集し、スライドの追加や削除ができます。</p>
      <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
        {outline.map((slide, index) => (
          <div key={index} className="bg-gray-900/50 border border-white/10 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">スライド {index + 1} - タイトル</label>
                <input type="text" value={slide.title} onChange={(e) => onChange(index, 'title', e.target.value)} className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">レイアウトテンプレート</label>
                <select value={slide.template || ''} onChange={(e) => onChange(index, 'template', e.target.value)} className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {availableTemplates.map(templateName => (
                    <option key={templateName} value={templateName}>{templateName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ★★★ 'two_points', 'four_points' を削除し、'three_points' のみに ★★★ */}
            {['three_points'].includes(slide.template) ? (
              <div className="space-y-3 mt-3">
                {slide.points?.map((point, pointIndex) => (
                  <div key={pointIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                    <label className="text-xs font-bold text-gray-400 mb-2 block">ポイント {pointIndex + 1} - タイトル</label>
                    <input type="text" value={point.title} onChange={(e) => handlePointChange(index, pointIndex, 'title', e.target.value)} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">ポイント {pointIndex + 1} - 内容</label>
                    <textarea value={point.summary} onChange={(e) => handlePointChange(index, pointIndex, 'summary', e.target.value)} rows={2} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                    <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">ポイント {pointIndex + 1} - アイコン指示</label>
                    <textarea value={point.icon_description} onChange={(e) => handlePointChange(index, pointIndex, 'icon_description', e.target.value)} rows={2} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  </div>
                ))}
              </div>
            // ★★★ 'icon_list' を削除し、'content_basic' を追加 ★★★
            ) : ['vertical_steps', 'content_basic'].includes(slide.template) ? (
              <div className="space-y-3 mt-3">
                {slide.template === 'content_basic' ? (
                  // ★★★ content_basic 用のUI (文字列配列) ★★★
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-2 block">箇条書き項目 (1行に1項目)</label>
                    <textarea 
                      value={Array.isArray(slide.items) ? slide.items.join('\n') : ''} 
                      onChange={(e) => onChange(index, 'items', e.target.value.split('\n'))} 
                      rows={5} 
                      className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  </div>
                ) : (
                  // vertical_steps 用のUI (従来のまま)
                  slide.items?.map((item, itemIndex) => (
                    <div key={itemIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                      <label className="text-xs font-bold text-gray-400 mb-2 block">項目 {itemIndex + 1} - タイトル</label>
                      <input type="text" value={item.title} onChange={(e) => handleItemChange(index, itemIndex, 'title', e.target.value)} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">項目 {itemIndex + 1} - 説明</label>
                      <textarea value={item.description} onChange={(e) => handleItemChange(index, itemIndex, 'description', e.target.value)} rows={2} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                    </div>
                  ))
                )}
              </div>
            // ★★★ ここからが修正点 (comparison テンプレート用UI) ★★★
            ) : slide.template === 'comparison' ? (
              <div className="grid grid-cols-2 gap-4 mt-3">
                {[0, 1].map(colIndex => (
                  <div key={colIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                    <label className="text-xs font-bold text-gray-400 mb-2 block">カラム {colIndex + 1} - タイトル</label>
                    <input 
                      type="text" 
                      value={slide.columns?.[colIndex]?.title || ''} 
                      onChange={(e) => handleColumnChange(index, colIndex, 'title', e.target.value)} 
                      className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                    <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">カラム {colIndex + 1} - 箇条書き項目</label>
                    {slide.columns?.[colIndex]?.items?.map((item, itemIndex) => (
                      <input
                        key={itemIndex}
                        type="text"
                        value={item}
                        onChange={(e) => handleColumnItemChange(index, colIndex, itemIndex, e.target.value)}
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-1"
                      />
                    ))}
                    <button onClick={() => handleAddColumnItem(index, colIndex)} className="mt-2 text-xs px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded">項目を追加</button>
                  </div>
                ))}
              </div>
            // ★★★ ここまでが修正点 ★★★
            ) : (
              <div>
                <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">スライド {index + 1} - 要約（またはコンテンツ）</label>
                <textarea value={slide.summary} onChange={(e) => onChange(index, 'summary', e.target.value)} rows={3} className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                {slide.infographic?.needed && (
                   <div>
                      <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">インフォグラフィック詳細指示</label>
                      <textarea value={slide.infographic.description} onChange={(e) => onChange(index, 'infographic', { ...slide.infographic, description: e.target.value })} rows={3} className="w-full bg-indigo-900/30 border border-indigo-500/50 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                   </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2 mt-3">
              <button onClick={() => onInsert(index)} className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-xs font-medium rounded-md transition-colors">この下にスライドを挿入</button>
              <button onClick={() => onDelete(index)} className="px-3 py-1 bg-red-700 hover:bg-red-600 text-xs font-medium rounded-md transition-colors disabled:opacity-50" disabled={outline.length <= 1}>このスライドを削除</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center pt-2">
        <button onClick={onStart} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors" disabled={outline.length === 0}>構成案を承認し、スライド生成を開始する</button>
      </div>
    </div>
  );
};

const DownloadButton = ({ onDownload }) => (
    <div className="bg-black/20 p-4 rounded-lg flex justify-center">
        <button onClick={onDownload} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors">ZIPファイルをダウンロード</button>
    </div>
);

const UserInput = ({ value, onChange, onSend, disabled }) => (
    <div className="relative">
        <input type="text" value={value} onChange={onChange} onKeyPress={(e) => e.key === 'Enter' && onSend()} placeholder="修正指示などを入力..." className="w-full bg-gray-900/50 border border-white/20 rounded-lg py-3 pl-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" disabled={disabled} />
        <button onClick={onSend} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors disabled:opacity-50" disabled={disabled || !value.trim()}> <SendIcon /> </button>
    </div>
);

const GenerationControls = ({ onPreview, onApprove, onEditCode, disabled }) => (
    <div className="flex justify-end mt-4 space-x-2">
        <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" disabled={disabled} onClick={onPreview}>プレビュー</button>
        <button className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" disabled={disabled} onClick={onEditCode}>ソースコードを編集</button>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" disabled={disabled} onClick={onApprove}>承認して次へ</button>
    </div>
);

const GenerationProgressTracker = ({ outline, currentIndex, thinkingState }) => {
  const thinkingSteps = [ { key: 'analyzing', text: 'スライドの内容を分析中...' }, { key: 'designing', text: 'インフォグラフィックをデザイン中...' }, { key: 'coding', text: 'HTMLコードを組み立て中...' } ];
  const currentStepIndex = thinkingSteps.findIndex(step => step.key === thinkingState);

  return (
    <div className="bg-black/20 p-4 rounded-lg space-y-3">
      <p className="text-sm text-gray-300 mb-2 font-semibold">スライド生成中...</p>
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
        {outline.map((slide, index) => {
          const isDone = index < currentIndex;
          const isInProgress = index === currentIndex;

          return (
            <div key={index} className={`border border-white/10 rounded-lg p-3 transition-all duration-300 ${isInProgress ? 'bg-indigo-900/50' : 'bg-gray-900/50'}`}>
              <p className="font-semibold text-sm flex items-center">
                {isDone ? <span className="text-green-400 mr-2">✅</span> : isInProgress ? <span className="animate-pulse mr-2">⏳</span> : <span className="text-gray-500 mr-2">📄</span>}
                {index + 1}. {slide.title}
                {isDone && <span className="ml-auto text-xs text-green-400 font-medium">完了</span>}
                {isInProgress && <span className="ml-auto text-xs text-indigo-300 font-medium">生成中</span>}
              </p>

              {isInProgress && (
                <div className="mt-3 ml-6 pl-4 border-l-2 border-indigo-500 space-y-2">
                  {thinkingSteps.map((step, stepIndex) => (
                    <p key={step.key} className={`text-xs flex items-center transition-colors ${stepIndex <= currentStepIndex ? 'text-gray-200' : 'text-gray-500'}`}>
                      {stepIndex < currentStepIndex ? <span className="text-green-400 mr-2">✓</span> : stepIndex === currentStepIndex ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></span> : <span className="mr-2">○</span>}
                      {step.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ChatPanel = ({ chatState }) => (
  <div className="w-2/3 bg-white/5 rounded-xl flex flex-col border border-white/10 overflow-hidden">
    <div className="flex-grow p-6 overflow-y-auto space-y-4">
      <MessageList messages={chatState.messages} />
      
      {chatState.apiErrorStep && (
        <div className="bg-black/20 p-4 rounded-lg flex justify-center">
          <button onClick={chatState.handleRetry} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors">
            再試行
          </button>
        </div>
      )}

      {chatState.appStatus === APP_STATUS.STRUCTURED && <MarkdownEditor markdown={chatState.structuredMarkdown} setMarkdown={chatState.setStructuredMarkdown} onApprove={chatState.handleMarkdownApproval} />}
      {chatState.appStatus === APP_STATUS.SELECTING_THEME && <ThemeSelector 
        selectedTheme={chatState.selectedTheme} 
        selectedDesign={chatState.design} 
        onThemeSelect={chatState.handleThemeSelection} 
        onDesignSelect={chatState.handleDesignSelection} 
        onApprove={chatState.handleThemeApproval} />}
      {chatState.appStatus === APP_STATUS.CREATING_OUTLINE && <AgendaSelector onSelect={chatState.handleAgendaChoice} />}
      {chatState.appStatus === APP_STATUS.SELECTING_SECTION_HEADERS && <SectionHeaderSelector onSelect={chatState.handleSectionHeaderChoice} />}
      {chatState.appStatus === APP_STATUS.OUTLINE_CREATED && <OutlineEditor outline={chatState.slideOutline} onChange={chatState.handleOutlineChange} onInsert={chatState.handleInsertSlide} onDelete={chatState.handleDeleteSlide} onStart={chatState.handleStartGeneration} selectedTheme={chatState.selectedTheme}/>}
      
      {(chatState.appStatus === APP_STATUS.GENERATING_SLIDES || chatState.appStatus === APP_STATUS.SLIDE_GENERATED) &&
        <GenerationProgressTracker
          outline={chatState.slideOutline}
          currentIndex={chatState.currentSlideIndex}
          thinkingState={chatState.thinkingState}
        />
      }

      {chatState.appStatus === APP_STATUS.ALL_SLIDES_GENERATED && <DownloadButton onDownload={chatState.handleDownloadZip} />}

      <div ref={chatState.chatEndRef} />
    </div>

    <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/20">
      <UserInput value={chatState.userInput} onChange={(e) => chatState.setUserInput(e.target.value)} onSend={chatState.handleSendMessage} disabled={chatState.appStatus !== APP_STATUS.SLIDE_GENERATED} />
      <GenerationControls onPreview={chatState.handlePreview} onApprove={chatState.handleApproveAndNext} onEditCode={chatState.handleOpenCodeEditor} disabled={chatState.appStatus !== APP_STATUS.SLIDE_GENERATED} />
    </div>
  </div>
);

const ApiKeyModal = ({ isOpen, tempApiKey, setTempApiKey, handleSave }) => {
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

const CodeEditorModal = ({ isOpen, html, setHtml, onSave, onCancel }) => {
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


/**
 * アプリケーションのメインコンポーネント。
 * 全体のStateと主要なロジックを管理します。
 */
export default function App() {
  // --- State Management ---
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  const [appStatus, setAppStatus] = useState(APP_STATUS.INITIAL);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');

  const [fileName, setFileName] = useState('');
  const [structuredMarkdown, setStructuredMarkdown] = useState('');
  const [slideOutline, setSlideOutline] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const [apiErrorStep, setApiErrorStep] = useState(null);
  
  const [selectedTheme, setSelectedTheme] = useState('standard');
  const [design, setDesign] = useState('dark');
  
  const [includeAgenda, setIncludeAgenda] = useState(false);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [generatedSlides, setGeneratedSlides] = useState([]);
  const [currentSlideHtml, setCurrentSlideHtml] = useState('');

  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [editableHtml, setEditableHtml] = useState('');

  const [thinkingState, setThinkingState] = useState(null);

  const chatEndRef = useRef(null);

  // --- Effects ---
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingState]);


  // --- Helper Functions ---
  const callGeminiApi = async (prompt, modelName, actionName) => {
    if (!apiKey) {
      setMessages(prev => [...prev, { type: 'system', text: 'APIキーが設定されていません。' }]);
      return null;
    }
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      console.log(`[INFO] Calling Gemini API for: ${actionName} using ${modelName}`);
      console.debug(`[DEBUG] Prompt for ${actionName}:`, prompt);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = await response.text();
      
      text = text.replace(/^```(json|html|svg)?\s*|```\s*$/g, '').trim();
      text = text.replace(/^xml\s*/, '');
      
      console.log(`[INFO] Received response for: ${actionName}`);
      return text;
    } catch (error) {
      console.error(`[FATAL] API Error during ${actionName}:`, error);
      // ▼▼▼ 修正点: UIへのメッセージ表示を削除し、エラー内容を呼び出し元に返す ▼▼▼
      return { error: `APIエラーが発生しました: ${error.message}` }; 
    }
  };

  // --- Handlers ---
  const handleApiKeySave = () => {
    if (tempApiKey) {
      localStorage.setItem('gemini_api_key', tempApiKey);
      setApiKey(tempApiKey);
      setIsApiKeyModalOpen(false);
      setMessages([{ type: 'system', text: 'APIキーが保存されました。スライドの元になるドキュメントをアップロードしてください。' }]);
    }
  };

  const handleRetry = () => {
    if (apiErrorStep === 'structure') {
      // テキスト抽出は完了しているので、再度構造化処理を呼び出す
      // onTextExtracted は内部でテキストを引数に取るため、ここでは直接呼び出さず、
      // ユーザーに再アップロードを促すか、抽出済みテキストをStateに持つ必要がある。
      // 今回はシンプルにするため、再度Markdown承認ステップから開始させる。
      setMessages(prev => [...prev, { type: 'system', text: '再試行します。内容を再度承認してください。' }]);
      setApiErrorStep(null);
      setAppStatus(APP_STATUS.STRUCTURED);
    } else if (apiErrorStep === 'outline') {
      // アジェンダ選択とセクションヘッダー選択は完了しているため、再度構成案生成を呼び出す
      const lastChoice = messages.slice().reverse().find(m => m.text.includes('セクションヘッダー'))?.text.includes('はい');
      handleSectionHeaderChoice(lastChoice);
    }
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!allowedTypes.includes(file.type)) {
      setMessages(prev => [...prev, { type: 'system', text: `サポートされていないファイル形式です: ${file.type}` }]);
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setProcessingStatus('テキストを抽出中...');
    setMessages(prev => [...prev, { type: 'system', text: `${file.name} をアップロードしました。`}]);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        const typedarray = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textData = await page.getTextContent();
          text += textData.items.map(s => s.str).join(' ');
        }
      } else {
        text = await file.text();
      }
      onTextExtracted(text);
    } catch (error) {
        setMessages(prev => [...prev, { type: 'system', text: 'テキスト抽出中にエラーが発生しました。' }]);
        setIsProcessing(false);
        setFileName('');
    }
  };

  const onTextExtracted = async (text) => {
    setMessages(prev => [...prev, { type: 'system', text: `テキスト抽出完了(${text.length}文字)。内容を構造化します。` }]);
    setAppStatus(APP_STATUS.STRUCTURING);
    setProcessingStatus('テキストを構造化中...');
    setApiErrorStep(null); // 再試行の前にエラー状態をリセット
    
    const result = await callGeminiApi(PROMPTS.structureText(text), 'gemini-2.5-flash-lite', 'テキスト構造化');
    
    setIsProcessing(false);
    if (result && !result.error) {
      setStructuredMarkdown(result);
      setAppStatus(APP_STATUS.STRUCTURED);
      setMessages(prev => [...prev, { type: 'system', text: 'テキストの構造化が完了しました。' }]);
    } else {
      // エラーハンドリング
      setApiErrorStep('structure');
      setMessages(prev => [...prev, { type: 'system', text: result ? result.error : '予期せぬエラーが発生しました。' }]);
    }
  };

  const handleMarkdownApproval = () => {
    setAppStatus(APP_STATUS.SELECTING_THEME);
    setMessages(prev => [...prev, { type: 'system', text: '内容が承認されました。次に、プレゼンテーションのテーマを選択してください。' }]);
  };

  const handleThemeSelection = (themeKey) => {
    setSelectedTheme(themeKey);
  };
  
  const handleDesignSelection = (design) => {
    setDesign(design);
  };
  
  const handleThemeApproval = () => {
    setAppStatus(APP_STATUS.CREATING_OUTLINE);
    const themeName = THEMES[selectedTheme]?.name || '選択されたテーマ';
    const designName = design === 'dark' ? 'ダーク' : 'ライト';
    setMessages(prev => [
      ...prev,
      { type: 'user', text: `${themeName}テーマ (${designName}) を選択` },
      { type: 'system', text: 'テーマを承知しました。次に、アジェンダページを挿入しますか？' }
    ]);
  }

  const handleAgendaChoice = (choice) => {
    setIncludeAgenda(choice);
    setAppStatus(APP_STATUS.SELECTING_SECTION_HEADERS);
    setMessages(prev => [
      ...prev,
      { type: 'user', text: `アジェンダ: ${choice ? 'はい' : 'いいえ'}` },
      { type: 'system', text: '主要なセクションの前に区切りスライドを自動挿入しますか？' }
    ]);
  };
  
  const handleSectionHeaderChoice = async (useSectionHeaders) => {
    setMessages(prev => [...prev, { type: 'user', text: `セクションヘッダー: ${useSectionHeaders ? 'はい' : 'いいえ'}` }]);
    setAppStatus(APP_STATUS.GENERATING_OUTLINE);
    setIsProcessing(true);
    setProcessingStatus('構成案を生成中...');
    setApiErrorStep(null); // 再試行の前にエラー状態をリセット

    const prompt = PROMPTS.createOutline(structuredMarkdown, includeAgenda, useSectionHeaders);
    const result = await callGeminiApi(prompt, 'gemini-2.5-flash-lite', '構成案生成');
    
    setIsProcessing(false);
    if (result && !result.error) {
      try {
        const outline = JSON.parse(result);
        setSlideOutline(outline);
        setAppStatus(APP_STATUS.OUTLINE_CREATED);
        setMessages(prev => [...prev, { type: 'system', text: "構成案を生成しました。内容を確認・編集してください。" }]);
      } catch (error) {
        setApiErrorStep('outline');
        setMessages(prev => [...prev, { type: 'system', text: `構成案の解析に失敗しました。AIの応答形式が不正です: ${error.message}` }]);
      }
    } else {
      // エラーハンドリング
      setApiErrorStep('outline');
      setMessages(prev => [...prev, { type: 'system', text: result ? result.error : '予期せぬエラーが発生しました。' }]);
    }
  };

  const handleOutlineChange = (index, field, value) => {
    const newOutline = [...slideOutline];
    if (field === 'infographic') {
      newOutline[index].infographic = value;
    } else if (field === 'points') {
      newOutline[index].points = value;
    } else {
      newOutline[index][field] = value;
    }
    setSlideOutline(newOutline);
  };

  const handleDeleteSlide = (indexToDelete) => {
    setSlideOutline(prev => prev.filter((_, index) => index !== indexToDelete));
  };

  const handleInsertSlide = (indexToInsertAfter) => {
    const newSlide = { 
      title: '新しいスライド', 
      summary: 'ここに内容の要約を入力',
      template: 'content_left_infographic_right',
      infographic: { needed: false, description: '' }
    };
    const newOutline = [ ...slideOutline.slice(0, indexToInsertAfter + 1), newSlide, ...slideOutline.slice(indexToInsertAfter + 1) ];
    setSlideOutline(newOutline);
  };

  const handleStartGeneration = () => {
    if (slideOutline.length === 0) return;
    setMessages(prev => [...prev.filter(m => m.type !== 'system'), { type: 'system', text: `構成案承認済。\n**ステップ2: スライド生成**\n全${slideOutline.length}枚のスライド生成を開始します。` }]);
    generateSlide(0);
  };

  const generateSlide = async (slideIndex) => {
    setAppStatus(APP_STATUS.GENERATING_SLIDES);
    const currentSlide = slideOutline[slideIndex];
    
    setIsProcessing(true);
    setProcessingStatus(`${slideIndex + 1}/${slideOutline.length}枚目を生成中...`);

    let finalHtml = '';
    
    try {
      setThinkingState('analyzing');
      await new Promise(resolve => setTimeout(resolve, 800));

      const template = THEMES[selectedTheme].templates[currentSlide.template];
      if (!template) throw new Error(`テンプレート「${currentSlide.template}」がテーマ「${selectedTheme}」に見つかりません。`);

      const replacements = {
        '{theme_class}': `theme-${design}`, // デザイン(dark/light)をクラスとして適用
        '{title}': currentSlide.title || '',
        '{summary}': currentSlide.summary || '',
        '{content}': currentSlide.summary || '',
        '{infographic_svg}': '',
        '{agenda_items_html}': '',
        '{items_html}': '',
      };

      if (currentSlide.infographic?.needed) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const svgPrompt = PROMPTS.generateInfographic(currentSlide.infographic.description);
        const infographicSvg = await callGeminiApi(svgPrompt, 'gemini-2.5-flash-lite', `SVG for Slide ${slideIndex + 1}`);
        if (!infographicSvg) throw new Error("インフォグラフィックSVGの生成に失敗しました。");
        replacements['{infographic_svg}'] = infographicSvg;
      }
      
      // ★★★ 'two_points', 'four_points' を削除し、'three_points' のみに ★★★
      if (['three_points'].includes(currentSlide.template) && Array.isArray(currentSlide.points)) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));

        const iconPromises = currentSlide.points.map(point => {
          const svgPrompt = PROMPTS.generateInfographic(point.icon_description);
          return callGeminiApi(svgPrompt, 'gemini-2.5-flash-lite', `Icon SVG for ${point.title}`);
        });
        const iconSvgs = await Promise.all(iconPromises);
        
        currentSlide.points.forEach((point, i) => {
            replacements[`{point_${i + 1}_title}`] = point.title || '';
            replacements[`{point_${i + 1}_summary}`] = point.summary || '';
            replacements[`{icon_${i + 1}_svg}`] = iconSvgs[i] || ``;
        });
      }

      

      if (currentSlide.template === 'agenda') {
        // ★★★ 修正点 ★★★
        // .replace() を追加し、各項目の先頭にある "1. " 形式の番号を強制的に削除
        const agendaItems = currentSlide.summary.split('\n').map(item => {
          const cleanItem = item.replace(/^\s*\d+\.\s*/, '');
          return `<li>${cleanItem}</li>`;
        }).join('');
        // ★★★ ここまで ★★★
        replacements['{agenda_items_html}'] = agendaItems;
      }
      
      // ★★★ 'icon_list' を削除し、'content_basic' を追加 ★★★
      if (['vertical_steps', 'content_basic'].includes(currentSlide.template) && Array.isArray(currentSlide.items)) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));

        let itemsHtml = '';
        if(currentSlide.template === 'vertical_steps') {
          itemsHtml = currentSlide.items.map((item, i) => `
            <div class="step">
              <div class="step-marker">${i + 1}</div>
              <h2>${item.title || ''}</h2>
              <p>${item.description || ''}</p>
            </div>
          `).join('');
        // ★★★ 'content_basic' 用のロジック (文字列配列から <li> を生成) ★★★
        } else if (currentSlide.template === 'content_basic') {
          itemsHtml = currentSlide.items.map(item => `<li>${item || ''}</li>`).join('');
        }
        replacements['{items_html}'] = itemsHtml;
      }

      // ★★★ ここからが修正点 (comparison テンプレート用ロジック) ★★★
      if (currentSlide.template === 'comparison' && Array.isArray(currentSlide.columns)) {
        if (currentSlide.columns[0]) {
          replacements['{col_1_title}'] = currentSlide.columns[0].title || '';
          replacements['{col_1_items_html}'] = Array.isArray(currentSlide.columns[0].items)
            ? currentSlide.columns[0].items.map(item => `<li>${item || ''}</li>`).join('')
            : '';
        }
        if (currentSlide.columns[1]) {
          replacements['{col_2_title}'] = currentSlide.columns[1].title || '';
          replacements['{col_2_items_html}'] = Array.isArray(currentSlide.columns[1].items)
            ? currentSlide.columns[1].items.map(item => `<li>${item || ''}</li>`).join('')
            : '';
        }
      }
      // ★★★ ここまでが修正点 ★★★

      setThinkingState('coding');
      await new Promise(resolve => setTimeout(resolve, 800));

      finalHtml = Object.entries(replacements).reduce((acc, [key, value]) => {
          const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          return acc.replace(regex, value);
      }, template);

      setMessages(prev => [...prev, { type: 'system', text: `スライド「${currentSlide.title}」が生成されました。\nプレビューで確認し、承認してください。`}]);

    } catch (error) {
        console.error("Slide generation failed:", error);
        finalHtml = '';
        setMessages(prev => [...prev, { type: 'system', text: `スライド生成に失敗しました: ${error.message}。「承認して次へ」ボタンで再試行できます。`}]);
    } finally {
        setThinkingState(null);
        setIsProcessing(false);
        setCurrentSlideHtml(finalHtml);
        setAppStatus(APP_STATUS.SLIDE_GENERATED);
    }
  };

  const modifySlide = async (modificationRequest) => {
    setIsProcessing(true);
    setProcessingStatus(`スライド ${currentSlideIndex + 1} を修正中...`);

    const prompt = PROMPTS.modifySlide(modificationRequest, currentSlideHtml);
    const jsonResponse = await callGeminiApi(prompt, 'gemini-2.5-flash-lite', `スライド${currentSlideIndex + 1}修正`);

    setIsProcessing(false);
    if (jsonResponse) {
        try {
            const result = JSON.parse(jsonResponse);
            if (result.html && result.changes) {
                setCurrentSlideHtml(result.html);
                const changesMessage = `スライドを修正しました。\n\n**変更点:**\n${result.changes}`;
                setMessages(prev => [...prev, { type: 'system', text: changesMessage }]);
            } else {
                 throw new Error("Invalid JSON structure from API.");
            }
        } catch (error) {
            console.error("Failed to parse JSON response for slide modification:", error);
            setMessages(prev => [...prev, { type: 'system', text: `スライドの修正結果を解析できませんでした。内容が予期せぬ形式です。` }]);
        }
    }
  };

  const handlePreview = () => {
    if (!currentSlideHtml) return;
    const blob = new Blob([currentSlideHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleApproveAndNext = () => {
    if (!currentSlideHtml) {
      setMessages(prev => [...prev, { type: 'system', text: `スライド生成を再試行します。` }]);
      generateSlide(currentSlideIndex);
      return;
    }

    const newGeneratedSlides = [...generatedSlides, currentSlideHtml];
    setGeneratedSlides(newGeneratedSlides);
    setCurrentSlideHtml('');

    const nextIndex = currentSlideIndex + 1;
    if (nextIndex < slideOutline.length) {
      setCurrentSlideIndex(nextIndex);
      const nextSlide = slideOutline[nextIndex];
      setMessages(prev => [...prev.filter(m => m.type !== 'system'), { type: 'system', text: `スライド ${currentSlideIndex + 1} を承認しました。\n次のスライド「${nextSlide.title}」の生成を開始します。`}]);
      generateSlide(nextIndex);
    } else {
      setAppStatus(APP_STATUS.ALL_SLIDES_GENERATED);
      setMessages(prev => [...prev, { type: 'system', text: "全てのステップが完了しました！\n下のボタンからZIPファイルをダウンロードできます。"}]);
    }
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    setProcessingStatus('ZIPファイルを生成中...');
    try {
      const zip = new JSZip();
      generatedSlides.forEach((html, index) => {
        zip.file(`s${index + 1}.html`, html);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'slides.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setMessages(prev => [...prev, { type: 'system', text: `ZIPファイル生成中にエラーが発生しました: ${error.message}`}]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = () => {
    if (!userInput.trim() || appStatus !== APP_STATUS.SLIDE_GENERATED) return;
    setMessages(prev => [...prev, { type: 'user', text: userInput }]);
    modifySlide(userInput);
    setUserInput('');
  };

  const handleOpenCodeEditor = () => {
    setEditableHtml(currentSlideHtml);
    setIsCodeEditorOpen(true);
  };

  const handleApplyCodeChanges = () => {
    setCurrentSlideHtml(editableHtml);
    setIsCodeEditorOpen(false);
    setMessages(prev => [...prev, { type: 'system', text: '手動での変更が適用されました。プレビューで確認してください。' }]);
  };

  const handleCancelCodeEdit = () => {
    setIsCodeEditorOpen(false);
    setEditableHtml('');
  };

  // --- Render ---
  return (
    <div className="bg-[#1e1e1e] h-screen w-screen flex flex-col font-sans text-white">
      <AppHeader onSettingsClick={() => setIsApiKeyModalOpen(true)} />

      <main className="flex-grow flex p-6 gap-6 overflow-hidden">
        <FileUploadPanel isProcessing={isProcessing} processingStatus={processingStatus} fileName={fileName} handleDragOver={handleDragOver} handleDrop={handleDrop} onFileSelect={handleFileSelect} appStatus={appStatus} />
        <ChatPanel chatState={{
            messages, userInput, setUserInput, handleSendMessage, chatEndRef, appStatus,
            apiErrorStep, handleRetry,
            structuredMarkdown, setStructuredMarkdown, handleMarkdownApproval, 
            selectedTheme, design, handleThemeSelection, handleDesignSelection, handleThemeApproval, // 修正箇所
            handleAgendaChoice, handleSectionHeaderChoice,
            slideOutline, handleOutlineChange, handleInsertSlide, handleDeleteSlide, handleStartGeneration,
            currentSlideIndex, thinkingState,
            handlePreview, handleApproveAndNext, handleDownloadZip, handleOpenCodeEditor
        }} />
      </main>

      <ApiKeyModal isOpen={isApiKeyModalOpen} tempApiKey={tempApiKey} setTempApiKey={setTempApiKey} handleSave={handleApiKeySave} />
      <CodeEditorModal
        isOpen={isCodeEditorOpen}
        html={editableHtml}
        setHtml={setEditableHtml}
        onSave={handleApplyCodeChanges}
        onCancel={handleCancelCodeEdit}
      />
    </div>
  );
}