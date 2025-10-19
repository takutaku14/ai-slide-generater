import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenerativeAI } from '@google/generative-ai';
import JSZip from 'jszip';

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
  SELECTING_THEME: 'selecting_theme', // New status
  CREATING_OUTLINE: 'creating_outline',
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

  createOutline: (markdown, includeAgenda) => {
    const agendaCondition = includeAgenda
      ? '- 2枚目は必ず"アジェンダ"ページとし、`template`は`title_slide`を選択してください。`summary`には3枚目以降のタイトルリストを記述します。'
      : '';
    
    return `### 指示
あなたはプロのプレゼンテーション構成作家です。以下のMarkdownテキストを分析し、最も効果的なプレゼンテーションの構成案をJSON形式で作成してください。

### 利用可能なテンプレート
- \`title_slide\`: タイトルとサブタイトルのみ。
- \`section_header\`: 章の区切りを示す大きなタイトル。
- \`quote\`: 強調したいメッセージや引用。
- \`content_left_infographic_right\`: 左に文章、右に図解。
- \`three_points\`: 3つの要点をアイコン付きで表示。

### 条件
- 1枚目は必ず"タイトルページ"とし、\`template\`は\`title_slide\`を選択してください。
${agendaCondition}
- 話題の区切りには\`section_header\`を効果的に使用してください。
- 3枚目以降は、Markdownの論理構造に従って内容を分割し、各スライドに最適な\`template\`を選択してください。
- \`content_left_infographic_right\`を選択した場合、\`infographic\`オブジェクトに図解の詳細な説明を記述してください。
- **\`three_points\`を選択した場合、\`summary\`は空にし、代わりに\`points\`というキーで3つの要素を持つ配列を生成してください。**
  - 各要素は\`{ "title": "...", "summary": "...", "icon_description": "..." }\`という形式のオブジェクトです。
  - \`icon_description\`には、そのポイントを象徴する**アイコンの具体的な説明**を記述してください。（例：「成長を示す上向き矢印のアイコン」）
- 全体で8〜12枚程度のスライド構成になるように調整してください。

### 出力形式(JSON)
- **最重要**: 出力はJSON配列の文字列のみとし、前後に\`\`\`jsonや説明文を含めないでください。
[
  { "title": "タイトルページ", "summary": "発表者名など", "template": "title_slide" },
  { "title": "第一章：概要", "summary": "", "template": "section_header" },
  {
    "title": "3つの主要技術",
    "summary": "",
    "template": "three_points",
    "points": [
      { "title": "技術A", "summary": "技術Aの簡単な説明。", "icon_description": "歯車のアイコン" },
      { "title": "技術B", "summary": "技術Bの簡単な説明。", "icon_description": "電球のアイコン" },
      { "title": "技術C", "summary": "技術Cの簡単な説明。", "icon_description": "ネットワーク接続を示すアイコン" }
    ]
  }
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

// --- スライドテンプレート (CSS変数でテーマ対応) ---
const SLIDE_TEMPLATES = {
  title_slide: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700;900&display=swap');
        :root {
            --bg-color-dark: #0f172a; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #f8fafc; --text-color-light: #0f172a; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; overflow: hidden; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
        h1 { font-size: 84px; font-weight: 900; margin: 0; line-height: 1.2; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 span { color: var(--accent-color); }
        p { font-size: 28px; margin: 20px 0 0; color: var(--sub-text-color); font-weight: 700; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <h1>{title}</h1>
        <p>{summary}</p>
    </div>
</body>
</html>`,

  section_header: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@900&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8;
            --bg-color-light: #e2e8f0; --text-color-light: #1e293b; --accent-color-light: #0284c7;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); display: flex; flex-direction: column; justify-content: center; }
        h1 { font-size: 96px; font-weight: 900; color: var(--text-color); margin: 0; line-height: 1.1; border-left: 10px solid var(--accent-color); padding-left: 40px; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <h1>{title}</h1>
    </div>
</body>
</html>`,

  quote: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 80px; background: var(--bg-color); display: flex; flex-direction: column; justify-content: center; align-items: center; }
        blockquote { margin: 0; padding: 0; border-left: 8px solid var(--accent-color); padding-left: 40px; }
        p { font-size: 48px; font-weight: 700; color: var(--text-color); margin: 0; }
        footer { font-size: 24px; color: var(--sub-text-color); margin-top: 30px; align-self: flex-end; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <blockquote>
            <p>“{title}”</p>
        </blockquote>
        <footer>{summary}</footer>
    </div>
</body>
</html>`,

  content_left_infographic_right: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1;
            --bg-color-light: #ffffff; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 30px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .slide-body { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; flex-grow: 1; }
        .content { font-size: 22px; line-height: 1.8; color: var(--sub-text-color); }
        #infographic-slot { display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="slide-body">
            <div class="content">{content}</div>
            <div id="infographic-slot">{infographic_svg}</div>
        </div>
    </div>
</body>
</html>`,

  three_points: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1; --card-bg-color-dark: rgba(15, 23, 42, 0.5);
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569; --card-bg-color-light: #ffffff;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); --card-bg-color: var(--card-bg-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: flex; justify-content: space-around; gap: 30px; align-items: stretch; }
        .point { background: var(--card-bg-color); border-radius: 12px; padding: 25px; flex: 1; border-top: 4px solid var(--accent-color); display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .point-icon { height: 140px; width: 100%; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; }
        h2 { font-size: 26px; color: var(--text-color); margin: 0 0 15px; font-weight: 700; }
        p { font-size: 18px; line-height: 1.7; color: var(--sub-text-color); margin: 0; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="points-container">
            <div class="point">
                <div class="point-icon">{icon_1_svg}</div>
                <h2>{point_1_title}</h2>
                <p>{point_1_summary}</p>
            </div>
            <div class="point">
                <div class="point-icon">{icon_2_svg}</div>
                <h2>{point_2_title}</h2>
                <p>{point_2_summary}</p>
            </div>
            <div class="point">
                <div class="point-icon">{icon_3_svg}</div>
                <h2>{point_3_title}</h2>
                <p>{point_3_summary}</p>
            </div>
        </div>
    </div>
</body>
</html>`,
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

const ThemeSelector = ({ onSelect }) => (
  <div className="bg-black/20 p-4 rounded-lg flex justify-center items-center space-x-4">
    <p className="text-sm text-gray-300">プレゼンテーションのテーマを選択してください:</p>
    <button onClick={() => onSelect('dark')} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-md transition-colors">ダーク</button>
    <button onClick={() => onSelect('light')} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-black text-sm font-medium rounded-md transition-colors">ライト</button>
  </div>
);

const AgendaSelector = ({ onSelect }) => (
  <div className="bg-black/20 p-4 rounded-lg flex justify-center items-center space-x-4">
    <p className="text-sm text-gray-300">アジェンダページを挿入しますか？</p>
    <button onClick={() => onSelect(true)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors">はい</button>
    <button onClick={() => onSelect(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors">いいえ</button>
  </div>
);

const OutlineEditor = ({ outline, onChange, onInsert, onDelete, onStart }) => (
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
                {Object.keys(SLIDE_TEMPLATES).map(templateName => (
                  <option key={templateName} value={templateName}>{templateName}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">スライド {index + 1} - 要約（またはコンテンツ）</label>
          <textarea value={slide.summary} onChange={(e) => onChange(index, 'summary', e.target.value)} rows={3} className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
          
          {slide.infographic?.needed && (
             <div>
                <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">インフォグラフィック詳細指示</label>
                <textarea value={slide.infographic.description} onChange={(e) => onChange(index, 'infographic', { ...slide.infographic, description: e.target.value })} rows={3} className="w-full bg-indigo-900/30 border border-indigo-500/50 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
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
      
      {chatState.appStatus === APP_STATUS.STRUCTURED && <MarkdownEditor markdown={chatState.structuredMarkdown} setMarkdown={chatState.setStructuredMarkdown} onApprove={chatState.handleMarkdownApproval} />}
      {chatState.appStatus === APP_STATUS.SELECTING_THEME && <ThemeSelector onSelect={chatState.handleThemeSelection} />}
      {chatState.appStatus === APP_STATUS.CREATING_OUTLINE && <AgendaSelector onSelect={chatState.handleAgendaChoice} />}
      {chatState.appStatus === APP_STATUS.OUTLINE_CREATED && <OutlineEditor outline={chatState.slideOutline} onChange={chatState.handleOutlineChange} onInsert={chatState.handleInsertSlide} onDelete={chatState.handleDeleteSlide} onStart={chatState.handleStartGeneration} />}
      
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
  
  const [theme, setTheme] = useState('dark');

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
      setMessages(prev => [...prev, { type: 'system', text: `${actionName}中にAPIエラーが発生しました: ${error.message}` }]);
      return null;
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
    
    const markdown = await callGeminiApi(PROMPTS.structureText(text), 'gemini-2.5-flash-lite', 'テキスト構造化');
    
    setIsProcessing(false);
    if (markdown) {
      setStructuredMarkdown(markdown);
      setAppStatus(APP_STATUS.STRUCTURED);
      setMessages(prev => [...prev, { type: 'system', text: 'テキストの構造化が完了しました。' }]);
    }
  };

  const handleMarkdownApproval = () => {
    setAppStatus(APP_STATUS.SELECTING_THEME);
    setMessages(prev => [...prev, { type: 'system', text: '内容が承認されました。次に、プレゼンテーションのテーマを選択してください。' }]);
  };

  const handleThemeSelection = (selectedTheme) => {
    setTheme(selectedTheme);
    setAppStatus(APP_STATUS.CREATING_OUTLINE);
    setMessages(prev => [
      ...prev,
      { type: 'user', text: `${selectedTheme === 'dark' ? 'ダーク' : 'ライト'}テーマを選択` },
      { type: 'system', text: 'テーマを承知しました。次に、アジェンダページを挿入しますか？' }
    ]);
  };

  const handleAgendaChoice = async (includeAgenda) => {
    setMessages(prev => [...prev, { type: 'user', text: includeAgenda ? 'はい' : 'いいえ' }]);
    setAppStatus(APP_STATUS.GENERATING_OUTLINE);
    setIsProcessing(true);
    setProcessingStatus('構成案を生成中...');

    const prompt = PROMPTS.createOutline(structuredMarkdown, includeAgenda);
    const jsonText = await callGeminiApi(prompt, 'gemini-2.5-flash-lite', '構成案生成');
    
    setIsProcessing(false);
    if (jsonText) {
      try {
        const outline = JSON.parse(jsonText);
        setSlideOutline(outline);
        setAppStatus(APP_STATUS.OUTLINE_CREATED);
        setMessages(prev => [...prev, { type: 'system', text: "構成案を生成しました。内容を確認・編集してください。" }]);
      } catch (error) {
        setMessages(prev => [...prev, { type: 'system', text: `構成案の解析に失敗しました。形式が不正です: ${error.message}` }]);
      }
    }
  };

  const handleOutlineChange = (index, field, value) => {
    const newOutline = [...slideOutline];
    if (field === 'infographic') {
      newOutline[index].infographic = value;
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

      const template = SLIDE_TEMPLATES[currentSlide.template];
      if (!template) throw new Error(`テンプレート「${currentSlide.template}」が見つかりません。`);

      const replacements = {
        '{theme_class}': `theme-${theme}`,
        '{title}': currentSlide.title,
        '{summary}': currentSlide.summary,
        '{content}': currentSlide.summary,
        '{infographic_svg}': '',
      };

      if (currentSlide.infographic?.needed) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const svgPrompt = PROMPTS.generateInfographic(currentSlide.infographic.description);
        const infographicSvg = await callGeminiApi(svgPrompt, 'gemini-2.5-flash-lite', `SVG for Slide ${slideIndex + 1}`);
        if (!infographicSvg) throw new Error("インフォグラフィックSVGの生成に失敗しました。");
        replacements['{infographic_svg}'] = infographicSvg;
      }
      
      if (currentSlide.template === 'three_points' && Array.isArray(currentSlide.points)) {
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

      setThinkingState('coding');
      await new Promise(resolve => setTimeout(resolve, 800));

      finalHtml = Object.entries(replacements).reduce((acc, [key, value]) => {
          return acc.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
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
            structuredMarkdown, setStructuredMarkdown, handleMarkdownApproval, handleThemeSelection, handleAgendaChoice,
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