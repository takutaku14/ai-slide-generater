import React, { useState, useEffect, useRef } from 'react';

import { MathfieldElement } from 'mathlive';
import 'mathlive/static.css'; // MathLive のスタイルシート

import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenerativeAI } from '@google/generative-ai';
import JSZip from 'jszip';
import { THEMES } from './templates'; 
import { marked, Marked } from 'marked'; 
import markedKatex from 'marked-katex-extension';

// pdf.js のワーカーを設定
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// (Viteなどのモダン環境では、カスタム要素が自動登録されない場合があるため)
if (!customElements.get('math-field')) {
  customElements.define('math-field', MathfieldElement);
}

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

  analyzeContext: (text) => `### 指示
あなたは、与えられたドキュメントの「目的」と「対象者」を分析する専門家です。
以下のテキストを読み、「スライド生成AIの思考フレームワーク」に基づいて、この資料の主要な「目的」と「対象者」を推測し、指定されたJSON形式で出力してください。

### スライド生成AIの思考フレームワーク（抜粋）
1.  **目的 (Purpose)**
    * \`approval\`: 承認・合意形成（例：提案書、企画書）
    * \`information_sharing\`: 情報共有・記録（例：報告書、議事録）
    * \`education\`: 教育・理解促進（例：マニュアル、ガイドライン）
2.  **対象者 (Audience)**
    * \`expert\`: 専門家・担当者（専門用語が多い、データ中心）
    * \`manager\`: 経営層・マネージャー（ビジョン、戦略、KGIなど）
    * \`beginner\`: 一般・初心者（平易な言葉遣い、基礎的な内容）

### 思考プロセス
1.  テキスト全体をスキャンし、キーワード（例：「～提案書」「～報告書」）や文体、使用語彙レベルを分析します。
2.  上記フレームワークに基づき、「目的」と「対象者」をそれぞれ1つずつ特定します。
3.  特定した結果を、厳格なJSON形式で出力します。

### 出力形式 (JSON)
- **最重要**: 出力はJSONオブジェクトの文字列のみとし、前後に\`\`\`jsonや説明文を含めないでください。
{
  "purpose": "(approval, information_sharing, education のいずれか)",
  "audience": "(expert, manager, beginner のいずれか)"
}

### 分析対象のテキスト
${text}
`
,

  createOutline: (markdown, includeAgenda, useSectionHeaders, context) => { // ★ 引数は変更なし
    const agendaCondition = includeAgenda
      ? `- 2枚目は必ず"アジェンダ"ページとし、\`template\`は\`agenda\`を選択してください。\`summary\`には3枚目以降のタイトルを改行区切りでリストアップしてください。\n- **【アジェンダの分割ルール】**: アジェンダの項目（\`summary\`にリストアップする3枚目以降のタイトル）が**6個を超えた**場合、\`template\`が\`agenda\`のスライドを**複数枚に分割**してください。\n- 1枚目のタイトルは『**アジェンダ (1/2)**』、2枚目は『**アジェンダ (2/2)**』のように、必ず連番を付与してください。\n- 各アジェンダスライドには、最大6項目までのリストを配置してください。`
      : '- **アジェンダページは絶対に作成しないでください。**';
    const sectionHeaderCondition = useSectionHeaders
      ? '- Markdownの主要な見出し（章やセクション）の前に、`template`が`section_header`のスライドを自動で挿入してください。'
      : '- `section_header`テンプレートは使用しないでください。';

    // ▼▼▼ Phase 3 (Step 3.1) 修正 ▼▼▼
    const docContext = context || { purpose: 'information_sharing', audience: 'expert' };
    
    // AIに「思考フレームワーク」そのものを指示する
    const contextInstruction = `### 分析されたドキュメントの文脈
- **目的 (Purpose)**: \`${docContext.purpose}\`
- **対象者 (Audience)**: \`${docContext.audience}\`

### 文脈に基づくストーリーラインの再構築（最重要）
あなたは、元のMarkdownの順序に縛られる必要はありません。
以下の「思考フレームワーク」に基づき、分析した「目的」と「対象者」にとって**最も説得力のあるストーリーライン**に、Markdownの内容を**並べ替え（再構築）**てください。

#### 思考フレームワーク: ステップ3（抜粋）
1.  **目的が \`approval\` (承認・合意形成) の場合:**
    * **判断:** 元の順序を**破壊し、再構築**する。（説得力が重要）
    * **採用すべき型:** 「結論ファースト型」（[結論]→[根拠]→[具体策]→[結論]） または「問題解決型」（[背景・課題]→[原因]→[解決策]→[実行計画]） を適用してください。

2.  **目的が \`education\` (教育・理解促進) の場合:**
    * **判断:** 元の順序を**尊重する**ことを基本とするが、ステップが分かりにくい場合は再構築する。
    * **採用すべき型:** 「時系列型」（[過去]→[現在]→[未来]） や「ステップバイステップ型」 を適用してください。

3.  **目的が \`information_sharing\` (情報共有・記録) の場合:**
    * **判断:** 元の順序を**厳格に尊重する**。（元の順序が重要）
    * **採用すべき型:** 元のMarkdownの目次構成（時系列やトピック別）をそのまま維持してください。

4.  **対象者への最適化:**
    * 対象者が \`manager\` (経営層) の場合: 情報を大胆に要約し、**キラーフレーズ（結論）**やサマリーを優先的に抽出してください。
    * 対象者が \`expert\` (専門家) の場合: 詳細なデータや根拠をある程度残してください。
    * 対象者が \`beginner\` (初心者) の場合: 視覚的な比率を高めることを意識し、平易な言葉で要約してください。
`;
    // ▲▲▲ 修正ここまで ▲▲▲

    return `### 指示
あなたはプロのプレゼンテーション構成作家です。以下のMarkdownテキストと「文脈」を分析し、最も効果的なプレゼンテーションの構成案をJSON形式で作成してください。

${contextInstruction} // ★ 強化した指示を挿入

### 利用可能なテンプレート
- \`title_slide\`: 表紙
- \`agenda\`: 目次
- \`section_header\`: 章の区切り
- \`highlighted_number\`: **【NEW】単一の最重要数値**（KPI、達成率など）を左に、**解説文**を右に配置（2カラム）。
- \`table_basic\`: **表形式（テーブル）**。機能一覧、比較表、数値データなど。
- \`bar_chart\`: 複数の数値（割合、スコアなど）を視覚的に比較するための棒グラフ。
- \`comparison\`: **2〜4つの項目（メリット/デメリット、A案/B案/C案など）を比較・対比**するための専用テンプレート。
- \`three_points\`: 3つの要点を横並びで表示。
- \`vertical_steps\`: 時系列やステップ。
- \`math_basic\`: **単一の主要な数式**とその解説（上下分割）。
- \`quote\`: **【NEW】重要な結論、キラーフレーズ、引用文**を中央に表示。
- \`content_with_diagram\`: 文章と図解（インフォグラフィック）。
- \`content_basic\`: **単純な箇条書き**（番号なし・あり両方）のための最も標準的なテンプレート。
- \`summary_or_thankyou\`: 最後のまとめ、または「ご聴取ありがとうございました」用。

### テンプレート選択の思考プロセスと具体例
あなたはMarkdownの各セクションを分析する際、以下の優先順位と思考プロセスでテンプレートを厳格に選択してください。

1.  **[最優先] 単一の重要数値か？**: 内容が「売上達成率: 98%」「KPI: 150件」のように、**単一の最重要数値**をハイライトし、**その数値に関する補足説明文**（例：数値の意味、背景など）も記述されている場合は、必ず \`highlighted_number\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### 今期の最重要KPI
        今期の売上達成率は98%に達しました。これは目標をほぼ達成したことを示します。
        
        **達成の背景**
        - 新機能Aのリリースが貢献
        - マーケティング施策の成功
        \`\`\`
    * **出力テンプレート**: \`highlighted_number\`

2.  **[次点] 表形式か？**: 内容が機能一覧、数値データ、仕様比較など、明らかに表（テーブル）で表現するのが最適な場合は、必ず \`table_basic\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### 機能比較
        | 機能 | プランA | プランB |
        |---|---|---|
        | 基本機能 | 〇 | 〇 |
        | 高度な分析 | - | 〇 |
        \`\`\`
    * **出力テンプレート**: \`table_basic\`

3.  **[次点] 比較・対比か？**: 内容が **2〜4つの項目**（例：メリット/デメリット、A案/B案、従来/新規、プランA/B/C）を明確に比較・対比している場合は、必ず \`comparison\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### 従来システムとの比較
        **従来システム**
        - 課題1: コストが高い
        - 課題2: 手動作業が多い
        **新システム**
        - 解決策1: 50%のコスト削減
        - 解決策2: 自動化を実現
        \`\`\`
    * **出力テンプレート**: \`comparison\`

4.  **[次点] 複数数値の視覚的比較か？**: 内容が複数の項目とそれぞれの数値（例: カテゴリA: 75%, B: 50%）を比較しており、テキストや単純な箇条書きよりも**棒グラフ**で表現するのが直感的で最適だと判断した場合、必ず \`bar_chart\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### 各カテゴリの進捗
        - カテゴリA: 75%
        - カテゴリB: 50%
        - カテゴリC: 90%
        \`\`\`
    * **出力テンプレート**: \`bar_chart\`
    * **AIの判断**: \`table_basic\` や \`comparison\` よりも、添付画像のような視覚的なグラフが適していると判断した場合にこれを選択する。

5.  **[次点] 3つの要点か？**: 内容が3つの主要な特徴、ステップ、利点を並列で紹介している場合は、\`three_points\` の使用を優先します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### 3つのメリット
        1.  **コスト削減**: ...
        2.  **効率化**: ...
        3.  **セキュリティ向上**: ...
        \`\`\`
    * **出力テンプレート**: \`three_points\`

6.  **[次点] ステップか？**: 内容が時系列や手順を示している場合は、\`vertical_steps\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### 導入プロセス
        - ステップ1: ヒアリング
        - ステップ2: 設計
        - ステップ3: 開発
        \`\`\`
    * **出力テンプレート**: \`vertical_steps\`

7.  **[次点] 主要な数式か？**: 内容が**単一の主要な数式ブロック（$$...$$）**とその解説文で構成されている場合（数式が主題の場合）、必ず \`math_basic\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### 二次方程式の解
        二次方程式 $ax^2 + bx + c = 0$ の解は、以下の公式で与えられます。
        $$ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} $$
        この $b^2 - 4ac$ の部分を判別式と呼びます...
        \`\`\`
    * **出力テンプレート**: \`math_basic\`

8.  **[次点] 重要な引用か？**: 内容が本文中の「キラーフレーズ」や「重要な結論」、「...と述べた」のような引用文であると判断した場合、必ず \`quote\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        ...以上の分析から、我々はAプランが最適解であると結論付けた。このキラーフレーズは補足説明が必要である。
        \`\`\`
    * **出力テンプレート**: \`quote\`

9.  **[次点] 図解が必要か？**: 内容が抽象的な概念や関係性（例：システム構成図、相関関係）を含み、テキストだけでは伝わりにくい場合、**かつ上記の専用テンプレートに当てはまらない場合**は、\`content_with_diagram\` を選択します。
    * **入力例 (Markdown)**:
        \`\`\`markdown
        #### システム構成
        本システムは、ユーザー、アプリケーションサーバー、データベースの3層構造で構成されており...
        \`\`\`
    * **出力テンプレート**: \`content_with_diagram\`

10.  **[最終手段] 単純なリストか？**: 上記のいずれにも当てはまらない、単純な箇条書きや説明文の場合は、\`content_basic\` を選択します。

### 条件
- 1枚目は必ず\`template\`が\`title_slide\`のタイトルページとしてください。タイトルはMarkdownの内容から最も適切と思われるものを自動で設定してください。
- **【最重要・JSONエスケープルール】**: \`summary\`や\`description\`などのJSON文字列内にバックスラッシュ（\`\\\`）を含める場合は、必ず（\`\\\\\`）と二重にエスケープしてください。（例: \`"summary": "C:\\\\Windows"\`）
- **【文字数制限】**: スライドのタイトル（\`title\`キー）は、日本語で**27文字以内**の簡潔なものにしてください。長すぎて2行になるタイトルは避けてください。
- **最重要**: \`summary\`や各項目の説明は、**プレゼンテーションでそのまま使える簡潔な言葉**で記述し、必要に応じて箇条書き（- や 1.）を使用してください。

- **【強調ルール】**: \`summary\`, \`items\`, \`points\`, \`columns\`, \`table\`, \`description\`, \`content_title\` の各テキストを生成する際、**プレゼンテーションで特に重要となるキーワード、専門用語、またはキーとなる数値**は、必ずMarkdownの太字記法（\`**キーワード**\`）で囲んで積極的に強調してください。
- **【用語解説ルール】**: もし \`用語：その解説\` のような形式で記述する場合は、必ず \`**用語**：その解説\` のように、コロン（：）の前の用語部分を太字にしてください。

- **【▼▼▼ 修正（NEW） ▼▼▼】**
- **【Markdownエスケープ禁止ルール】**: \`summary\`, \`description\`, \`content_title\` などのキーにMarkdown（例: \`**強調**\`）を含める際、**絶対にバックスラッシュ（\`\\\`）でエスケープしないでください。**
  - **悪い例**: \`"summary": "これは \\\`**\\\`**強調\\\`**\\\`** です。"\`
  - **良い例**: \`"summary": "これは **強調** です。"\`

- **【数式表示ルール】**: もし内容に数式、変数、または計算式（例： \`y = ax + b\` や \`費用 - 収益\`）が含まれる場合は、**必ず KaTeX 形式**で記述してください。
  - **インライン数式**: 文中の数式は、シングルダラー（\`$\`）で囲んでください。（例: \`これは $y = ax + b$ の例です。\`）
  - **ブロック数式**: 独立した行の数式は、ダブルダラー（\`$$\`）で囲んでください。（例: \`$$ \sum_{i=1}^{n} x_i $$ \`）
  - **【最重要】日本語の変数名**: 数式内で日本語の用語（例：\`課税譲渡所得金額\`）を使用する場合は、必ず \`\text{...}\` コマンドで囲んでください。（例: \`$$ \text{課税譲渡所得金額} = \text{収入金額} - (\text{取得費} + \text{譲渡費用}) - \text{特別控除額} $$ \`）

- **上記の専用テンプレート（table_basic, comparison, three_points など）のいずれにも当てはまらない**、単純な箇条書き（番号付き/なし）が中心のスライドを作成する場合に**のみ**、\`content_basic\` テンプレートを使用してください。
  - \`content_basic\` を選択した場合、**\`summary\`キーは絶対に空（""）**にし、代わりに **\`items\`キー** で「箇条書きの各項目（文字列）」の配列を生成してください。
  - **【最重要】\`items\` の各項目（文字列）の先頭には、ハイフン（-）やアスタリスク（*）、数字（1.）などのリストマーカーを**絶対に**含めないでください。（CSSで自動付与されます）
  - もし箇条書きを**ネスト（インデント）**させたい場合は、項目の先頭に**半角スペース2個**を挿入してください。（例： \`"  これが子項目です"\`）
  - 孫項目は半角スペース4個（\`"    これが孫項目です"\`）のように表現してください。
  - **【行数制限】**: スライドの視認性を保つため、\`content_basic\` の \`items\` 配列は **最大7行（7項目）程度** に収めてください。
  - **【自動分割】**: もし元のデータがこのサイズに **要約しきれないほど多い場合**、無理に1枚に押し込めたり、情報を省略したりしないでください。
  - **【分割ルール】**: その場合、\`template\` が \`content_basic\` のスライドを **複数枚に分割** してください。（例：1枚目のタイトルを「**主な特長 (1/2)**」、2枚目のタイトルを「**主な特長 (2/2)**」のようにし、8行目以降の項目を2枚目に配置してください。）

- **2〜4つの項目を比較・対比**し、\`comparison\` テンプレートを使用する場合は、\`summary\`は空にし、代わりに\`columns\`というキーで **2〜4要素** の配列（\`{title: "...", items: [...]}\`）を生成してください。
  - **【最重要・比較項目ルール】**: \`items\` 配列の各文字列は、**\`"**項目名**\`：\`** \`内容\`"\` の形式（例：\`"**価格**：10,000円"\`）を**可能な限り使用してください。**
  - これにより、何（価格、機能など）を比較しているかが明確になります。

- **表形式（テーブル）が最適なデータ**（例：機能比較一覧、数値データ一覧など）を表現し、\`table_basic\` テンプレートを使用する場合は、
  - **\`summary\`キーには、その表に関する補足説明や解説文をMarkdown形式で記述してください。** 解説が不要な場合は空（""）にしてください。  - **【表の重要ルール】**: スライドの視認性を保つため、\`table_basic\` の表は **最大7行、5列程度** に収めてください。
  - **【最重要・高さ考慮】**: 上記の行数制限（7行）を守っていても、**各セルのテキスト量（文字数）が非常に多い**場合、テーブル全体の高さが1枚のスライドに収ままらなくなる可能性があります。
  - **AIは常にこの「高さ」を意識してください。** もし1つのセルが長くなりすぎる場合（例：50文字を超える長文など）は、**内容を簡潔に要約**するか、**そのセル内で改行（\\n）**を適切に使用してください。
  - それでも情報が多すぎて1枚に収まらない（高さが超える）とAIが判断した場合は、行数が7行以下であっても、\`template\` が \`table_basic\` のスライドを **複数枚に分割** してください。
    - （例：1枚目のタイトルを「**機能比較 (1/2)**」、2枚目のタイトルを「**機能比較 (2/2)**」のようにし、表の続きを2枚目に配置してください。この際、**ヘッダー行は両方のスライドに含めてください**。）

- **【bar_chart ルール】**
- **複数の数値（例：進捗率、スコア）を視覚的な棒グラフで比較**し、\`bar_chart\` テンプレートを使用する場合は、
  - **\`summary\`キーは絶対に空（""）**にしてください。
  - 代わりに **\`chart_data\`キー** で、**Chart.js と互換性のある厳格なデータオブジェクト**を生成してください。
  - **【AIの思考プロセス】**:
    1.  Markdownから「ラベル」（例: カテゴリA, B, C）と「データ」（例: 75, 50, 90）を抽出します。
    2.  \`labels\` キーに「ラベルの配列（文字列）」を設定します。
    3.  \`datasets\` キーに「単一要素の配列」を設定します。
    4.  その単一要素のオブジェクト内に \`label\` キー（データセット名、例: "進捗率"）と \`data\` キー（数値の配列）を設定します。
  - **【厳格な形式】**:
    \`\`\`json
    {
      "labels": ["カテゴリA", "カテゴリB", "カテゴリC"],
      "datasets": [
        {
          "label": "進捗率 (%)",
          "data": [75, 50, 90]
        }
      ]
    }
    \`\`\`

- **【▼▼▼ 修正点 ▼▼▼】**
- \`three_points\` テンプレートを使用する場合、
  - **\`summary\`キーは絶対に空（""）**にしてください。
  - 代わりに **\`points\`キー** で、**必ず3要素のオブジェクト配列**を生成してください。
  - 各オブジェクトには **\`title\`** (文字列), **\`summary\`** (文字列), **\`icon_description\`** (文字列) の3つのキーを**必ず含めてください**。
  
  - **【icon_description の超厳格ルール】**: \`icon_description\` キーには、**Lucide (lucide.dev) のアイコン名**（例: "check-circle", "braces", "database", "shield-check", "brain-cog"）を**単一の文字列**で指定してください。
  - **【禁止事項】**: **絶対に、説明文（例: "APIのアイコン"、"RAGの図"）や、日本語、スペースを含む文字列を指定しないでください。**
  - **【あなたの思考プロセス】**:
    1.  ポイントのタイトル（例: "API"）を理解します。
    2.  Lucideライブラリから最も関連性の高いアイコン名（例: "braces" や "code"）を1つだけ選びます。
    3.  その名前（"braces"）だけを \`icon_description\` キーに設定します。
  - （例: \`{"title": "API", "summary": "...", "icon_description": "braces"}\`）
- **【▲▲▲ 修正点ここまで ▲▲▲】**

- **【▼▼▼ 修正点 ▼▼▼】**
- **【vertical_steps ルール】**
- \`vertical_steps\` テンプレートを使用する場合、
  - **\`summary\`キーは絶対に空（""）**にしてください。
  - 代わりに **\`items\`キー** で、**オブジェクトの配列**を生成してください。
  - 各オブジェクトには **\`title\`** (文字列) と **\`description\`** (文字列、そのステップの簡潔な説明) の2つのキーを**必ず含めてください**。
  - （例: \`{"title": "ステップ1：申請", "description": "必要な書類を準備します。"}\`）
- **【▲▲▲ 修正点ここまで ▲▲▲】**

- **【▼▼▼ 修正点 ▼▼▼】**
- \`content_with_diagram\` テンプレートを選択した場合、
  - **スライドの本文を必ず \`summary\` キーに記述**してください。
  - 同時に、**必ず \`infographic\` キー** で \`{ "needed": true, "description": "AIが図解を生成するための詳細な指示..." }\` の形式のオブジェクトを生成してください。
  - AIへの指示（description）は、\`summary\`の内容を図解するために具体的に記述してください。
- **【▲▲▲ 修正点ここまで ▲▲▲】**

- **【math_basic ルール】**
- \`math_basic\` テンプレートを使用する場合、
  - **\`summary\`キーに数式の解説文**（Markdown形式）を必ず記述してください。**【文字数制限】解説文は、日本語で**200文字程度**の簡潔な内容に要約してください。**
  - **\`formula\`キーにKaTeX形式の単一の数式ブロック**（例: \`$$ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} $$\`）を必ず記述してください。
  - **【最重要・重複排除】\`summary\` キーの解説文には、\`formula\`キーに記述する数式（またはそのインライン版 $...$）を**含めないでください**。
  - （例：\`...以下の式で表されます。 $x=y$\` という文章は、\`...以下の式で表されます。\` のように、数式を省略して記述してください。）

- **【▼▼▼ 修正点（NEW） ▼▼▼】**
- **【quote ルール】**
- \`quote\` テンプレートを使用する場合、
  - **本文（引用文、キラーフレーズ）を必ず \`summary\` キーに記述**してください。
  - AIの判断で、引用文の**前後に日本語の引用符（「」）**を適切に付与してください。
  - **【NEW】** 引用文に対する**簡潔な補足文（解説文）**（例：出典、キラーフレーズの意図など）がある場合は、それを **\`description\` キー** に記述してください。
  - 補足文がない場合は \`description: ""\` としてください。
- **【highlighted_number ルール】**
- **【超厳格・numberルール】**: \`number\` キーには、**数値と単位（例: "98%", "150件", "3.14"）のみ**を格納してください。
- **【禁止事項】**: \`number\` キーに、\`description\`（例: "達成率"）や、補足的な日本語（例: "**削減**"）、Markdown（\`**\`）を**絶対​​に含めないでください**。
- \`description\` キー で、その数値の**簡潔な説明文**（例: "売上達成率", "運用コスト削減"）を必ず生成してください。
- **【AIの思考プロセス】**: もし元のテキストが「**30%削減**」のように数値と日本語がセットの場合、\`number: "30%"\` と \`description: "運用コスト削減"\` のように、**日本語は\`description\`キーに含めるか、\`summary\`キーの本文で説明**してください。
- **【NEW】\`content_title\` キー** で、右カラムに表示する**解説の見出し**（例: "数値の背景", "単一の重要数値"）を必ず生成してください。
- **【NEW】\`summary\` キー** で、右カラムに表示する**補足説明文**（Markdown形式可）を必ず生成してください。
- **【▲▲▲ 修正点ここまで ▲▲▲】**
${agendaCondition}
${sectionHeaderCondition}

- 最後のスライドは \`summary_or_thankyou\` とし、タイトルを「まとめ」または「ご清聴ありがとうございました」に設定してください。

### 出力形式(JSON)の例
- **最重要**: 出力はJSON配列の文字列のみとし、前後に\`\`\`jsonや説明文を含めないでください。
[
  { "title": "タイトルページ", "summary": "発表者名", "template": "title_slide" },
  { "title": "今期の最重要KPI", "template": "highlighted_number", "number": "98%", "description": "売上達成率", "content_title": "達成率の背景", "summary": "現在の達成率は**98%**に達しており、目標達成は確実です。\n- これは運用チームの努力によるものです。" },
  { "title": "我々の結論", "summary": "「我々の最適解は、Aプランである」", "template": "quote", "description": "− キラーフレーズや重要な結論の強調に使用。" },
  { "title": "システムの概要", "summary": "...", "template": "content_with_diagram", "infographic": { "needed": true, "description": "システム概要の構成図" } },
  { "title": "二次方程式の解", "summary": "この公式は...", "template": "math_basic", "formula": "$$ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} $$" },
  { 
    "title": "各カテゴリの進捗",
    "summary": "",
    "template": "bar_chart",
    "chart_data": {
      "labels": ["カテゴリA", "カテゴリB", "カテゴリC"],
      "datasets": [
        {
          "label": "進捗率 (%)",
          "data": [75, 50, 90],
          "backgroundColor": [ // (任意) AIが色を提案しても良い
            "rgba(54, 162, 235, 0.6)",
            "rgba(54, 162, 235, 0.6)",
            "rgba(54, 162, 235, 0.6)"
          ]
        }
      ]
    }
  }, 
  { 
    "title": "3つのプラン", 
    "summary": "", 
    "template": "three_points", 
    "points": [ 
      { "title": "プランA", "summary": "プランAの簡潔な説明...", "icon_description": "braces" }, 
      { "title": "プランB", "summary": "プランBの簡潔な説明...", "icon_description": "database" }, 
      { "title": "プランC", "summary": "プランCの簡潔な説明...", "icon_description": "shield-check" }
    ] 
  },
  
  { "title": "プロジェクトの3ステップ", "summary": "", "template": "vertical_steps", "items": [ {"title": "ステップ1", "description": "ステップ1の説明..."}, {"title": "ステップ2", "description": "ステップ2の説明..."} ] },
  { "title": "主な特長", "summary": "", "template": "content_basic", "items": [ "特長1", "特長2" ] },
  { 
    "title": "A案とB案とC案の比較", 
    "summary": "", 
    "template": "comparison", 
    "columns": [ 
      {"title": "A案", "items": ["**価格**：10万円", "**納期**：3週間"]}, 
      {"title": "B案", "items": ["**価格**：12万円", "**納期**：2週間"]},
      {"title": "C案", "items": ["**価格**：8万円", "**納期**：4週間"]}
    ] 
  },
  {
    "title": "機能比較表 (1/2)",
    "summary": "",
    "template": "table_basic",
    "table": {
      "headers": [ "機能名", "プランA", "プランB" ],
      "rows": [
        [ "基本機能", "〇", "〇" ],
        [ "高度な分析", "-", "〇" ],
        [ "専用サポート", "-", "-" ]
      ]
    }
  },
  { "title": "ご清聴ありがとうございました", "summary": "", "template": "summary_or_thankyou" }
]

### Markdownテキスト
${markdown}`;
  },

  generateInfographic: (description, theme) => { // ★ theme を引数に追加
    const themeInstructions = theme === 'light'
      ? '・背景は白（#FFFFFF）です。図形や線には濃い色（例: #1E293B, #0284c7）を使用してください。'
      : '・背景は濃いグレー（#1e293b）です。図形や線には明るい色（例: #e2e8f0, #38bdf8）を使用してください。';
  
    return `### あなたの役割
あなたは、与えられた指示に基づき、情報を視覚的に表現するためのSVG（スケーラブル・ベクター・グラフィックス）コードを生成する専門家です。

### 指示
以下の「インフォグラフィックの詳細説明」を読み、その内容を表現するSVGコードを生成してください。

### 厳格なルール
- **最重要:** あなたの応答は\`<svg\`で始まり、\`</svg>\`で終わる必要があります。これ以外のXML宣言、コードブロック、解説、テキストは絶対に含めないでください。
- **【超重要】SVG内に\`<text>\`タグやその他のテキスト要素を一切含めないでください。アイコンや図形のみで内容を表現してください。**

- **【サイズ指定の厳格なルール】**:
- SVGタグには \`width="100%"\` と \`height="100%"\` を**必ず指定してください**。
- \`viewBox="0 0 100 100"\` のように、viewBox属性を必ず指定してください（値は内容に応じて調整可）。
- **絶対に \`width\` や \`height\` にピクセル値（例: \`width="500px"\`）を指定しないでください。**

- **【配色ルールの厳格なルール】**:
${themeInstructions}
- **絶対に、SVG自体に背景色（例: \`<rect width="100%" height="100%" fill="...">\`）は含めないでください。** スライドの背景を透過させる必要があります。

### インフォグラフィックの詳細説明
${description}`;
  },

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
,
regenerateSlideContent: (slideTitle, originalDataJson, newTemplateName, availableTemplates) => {
    // 元データが空（{}）でないか確認
    const originalDataPrompt = (originalDataJson !== '{}' && originalDataJson)
      ? `### 元のスライド情報（JSON）
${originalDataJson}`
      : `### 元のスライド情報
元データはありません。タイトル「${slideTitle}」に基づいて内容を生成してください。`;

    return `### 指示
あなたはプロのプレゼンテーション構成作家です。
以下の「元のスライド情報」と「スライドタイトル」を分析し、「新しいテンプレート」の形式に最適なコンテンツを生成してください。

### スライドタイトル
${slideTitle}

${originalDataPrompt}

### 新しいテンプレート
${newTemplateName}

### 利用可能なテンプレートと必要なJSONキー
${availableTemplates.map(t => `- **${t.name}**: ${t.description}`).join('\n')}

### 厳格な出力条件
- **最重要**: 出力は、新しいテンプレート（${newTemplateName}）に必要なキー（例: \`items\`, \`points\`, \`columns\`, \`summary\`）のみを含むJSONオブジェクトの文字列としてください。
- 前後に\`\`\`jsonや説明文は絶対に含めないでください。
- 元の情報を活用し、新しいテンプレート形式で最も伝わりやすい内容を生成してください。

### 出力例
- ${newTemplateName} が "content_basic" の場合: \`{ "items": ["項目1", "項目2", "項目3"] }\`
- ${newTemplateName} が "three_points" の場合: \`{ "points": [ { "title": "...", "summary": "...", "icon_description": "..." }, ... ] }\`
- ${newTemplateName} が "comparison" の場合: \`{ "columns": [ { "title": "A案", "items": [...] }, { "title": "B案", "items": [...] } ] }\`
- ${newTemplateName} が "table_basic" の場合: \`{ "table": { "headers": ["H1", "H2"], "rows": [["R1C1", "R1C2"], ["R2C1", "R2C2"]] } }\`
- ${newTemplateName} が "math_basic" の場合: \`{ "summary": "数式の解説...", "formula": "$$ y = ax + b $$" }\` 
- ${newTemplateName} が "content_with_diagram" の場合: \`{ "summary": "ここにスライドの本文が入ります...", "infographic": { "needed": true, "description": "..." } }\`
`;
  }

  ,

  modifyFullOutline: (currentOutlineJson, instruction) => `### 指示
あなたはプロのプレゼンテーション構成作家です。
添付された「現在の構成案(JSON)」を、以下の「ユーザーからの修正指示」に基づき、厳密に修正してください。

### 厳格なルール
- **最重要:** 出力は、修正後の**完全なJSON配列の文字列のみ**としてください。前後に\`\`\`jsonや説明文は絶対に含めないでください。
- 指示された箇所以外は、**絶対に、いかなる理由があっても変更しないでください。**
- スライドの順序変更、追加、削除、内容の書き換えなど、指示を忠実に実行してください。

### ユーザーからの修正指示
${instruction}

### 現在の構成案(JSON)
${currentOutlineJson}
`,

  modifySingleSlideOutline: (currentSlideJson, instruction) => `### 指示
あなたはプロのプレゼンテーション構成作家です。
添付された「現在のスライド(JSON)」を、以下の「ユーザーからの修正指示」に基づき、厳密に修正してください。

### 厳格なルール
- **最重要:** 出力は、修正後の**単一のJSONオブジェクトの文字列のみ**としてください。前後に\`\`\`jsonや説明文は絶対に含めないでください。
- 指示された箇所以外（例：指示がないのに \`template\` を変えるなど）は、**絶対に、いかなる理由があっても変更しないでください。**
- スライドのタイトル、要約（summary）、箇条書き（items）など、指示された部分のみを修正してください。

### ユーザーからの修正指示
${instruction}

### 現在のスライド(JSON)
${currentSlideJson}
`
,

findIconName: (description) => `### 指示
あなたは、与えられた「概念」や「説明文」を、オープンソースの「Lucide (lucide.dev)」アイコンライブラリの**単一のアイコン名**にマッピングする専門家です。

### 厳格なルール
- **最重要**: あなたの応答は、Lucideのアイコン名（例: "braces", "shield-check", "database"）**そのもの**でなければなりません。
- 解説、前置き、引用符、JSON形式などは**一切不要**です。
- 関連するアイコンが複数ある場合でも、最も代表的だと思われるものを**1つだけ**選んでください。
- 存在しないアイコン名は返さないでください。

### 例
- 入力: "API、接続、歯車"
- 出力: braces
- 入力: "セキュリティ、盾、認証"
- 出力: shield-check
- 入力: "AI、チャットボット、根拠"
- 出力: brain-cog
- 入力: "存在しない概念"
- 出力: circle

### 変換対象の説明文
${description}`
,
  findIconNameRetry: (concept, wrongName) => `### 指示
あなたは、与えられた「概念」を「Lucide (lucide.dev)」の**正しいアイコン名**にマッピングする専門家です。

### 前回の失敗
前回のタスクで、あなたは「${concept}」という概念に対して「${wrongName}」という名前を返しましたが、そのアイコン名は**存在しません (404エラー)**でした。

### 厳格なルール
- **最重要**: 「${wrongName}」とは**異なる、別の正しいLucideアイコン名**を1つだけ返してください。
- 解説、前置き、引用符、JSON形式などは**一切不要**です。
- どうしても適切な名前が見つからない場合は "circle" と返してください。

### 変換対象の概念
${concept}`

};

/** 各API待機ステップの「思考プロセス」を定義 */
const STRUCTURING_STEPS = [
  { key: 'analyzing_context', text: 'ドキュメントの文脈（目的・対象者）を分析中...' },
  { key: 'cleaning', text: 'テキストをクリーンアップ中... (例: 「ドキュ メント」→「ドキュメント」)' },
  { key: 'analyzing', text: 'ドキュメントの論理構造を解析中... (見出し、段落の識別)' },
  { key: 'formatting', text: 'Markdown形式に再構成中...' }
];

const OUTLINE_STEPS = [
  { key: 'analyzing_doc', text: 'Markdownドキュメント全体を分析中...' },
  { key: 'selecting_templates', text: '各セクションに最適なテンプレートを選定中... (例: 表、比較、図解)' },
  { key: 'creating_title_agenda', text: 'タイトルとアジェンダページを作成中...' },
  { key: 'generating_content', text: '各スライドの内容（箇条書き、要約）を生成中...' },
  { key: 'formatting_json', text: '最終的な構成案（JSON）を組み立て中...' }
];

const SLIDE_GENERATION_STEPS = [
  { key: 'analyzing', text: 'スライドの内容を分析中...' },
  { key: 'designing', text: 'インフォグラフィック/レイアウトをデザイン中...' },
  { key: 'coding', text: 'HTMLコードを組み立て中...' }
];

/** 文脈分析の結果（キー）を日本語に翻訳するためのマップ */
const CONTEXT_TRANSLATIONS = {
  purpose: {
    'approval': '承認・合意形成',
    'information_sharing': '情報共有・記録',
    'education': '教育・理解促進'
  },
  audience: {
    'expert': '専門家・担当者',
    'manager': '経営層・マネージャー',
    'beginner': '一般・初心者'
  }
};

// --- アイコンコンポーネント ---
const SettingsIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-white transition-colors"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>);
const UploadCloudIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></svg>);
const SendIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>);


const MathLiveModal = ({ isOpen, initialValue, onSave, onCancel, onValueChange }) => {
  const mathfieldRef = useRef(null);
  const [previewHtml, setPreviewHtml] = useState('');
  
  // KaTeXパーサーのインスタンスを作成
  // (プレビュー機能のために必要)
  const markedWithKatex = new Marked();
  markedWithKatex.use(markedKatex({
    throwOnError: false
  }));

  // MathLive要素の初期化とイベントリスナーの設定
  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (!mathfield || !isOpen) return;

    // カスタマイズオプション (電卓のような仮想キーボードを有効化)
    mathfield.setOptions({
      virtualKeyboardMode: "onfocus", // フォーカス時にキーボード表示
      layouts: [
        "numeric", 
        "functions", 
        "symbols", 
        "alphabetic", 
        "greek"
      ],
    });

    // 'input' イベントをリッスンして React の state (tempMathFormula) に反映
    const handleInput = (e) => {
      const newKatexValue = e.target.value;
      if (onValueChange) {
        onValueChange(newKatexValue);
      }
      // ライブプレビューを更新
      setPreviewHtml(markedWithKatex.parse(`$$ ${newKatexValue} $$`, { breaks: false }));
    };

    mathfield.addEventListener('input', handleInput);

    // クリーンアップ
    return () => {
      mathfield.removeEventListener('input', handleInput);
    };
  }, [isOpen, onValueChange, markedWithKatex]); // isOpen時にも初期化

  // モーダルが開いたとき、または初期値が変わったときに
  // MathLive要素の値とプレビューを同期する
  useEffect(() => {
    if (isOpen) {
      const mathfield = mathfieldRef.current;
      const initialKatex = initialValue || '';
      
      if (mathfield && mathfield.value !== initialKatex) {
        mathfield.value = initialKatex;
      }
      // 初期プレビューを生成
      setPreviewHtml(markedWithKatex.parse(`$$ ${initialKatex} $$`, { breaks: false }));
    }
  }, [isOpen, initialValue, markedWithKatex]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#2a2a2e] border border-white/10 rounded-lg shadow-xl p-6 w-full max-w-3xl flex flex-col space-y-4">
        <h2 className="text-xl font-bold flex-shrink-0">ビジュアル数式エディタ</h2>
        
        {/* --- エディタ本体 --- */}
        <div>
          <label className="text-xs font-bold text-gray-400 mb-2 block">数式 (KaTeX)</label>
          <math-field 
            ref={mathfieldRef}
            style={{ 
              width: '100%', 
              border: '1px solid rgba(255, 255, 255, 0.2)', 
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem', // 少し大きく
              backgroundColor: 'rgba(55, 65, 81, 0.6)', // bg-gray-700/60 相当
              color: 'white',
              fontFamily: 'KaTeX_Main, "Times New Roman", serif', // 数式フォント
            }}
          >
            {initialValue || ''}
          </math-field>
        </div>

        {/* --- ライブプレビュー --- */}
        <div>
          <label className="text-xs font-bold text-gray-400 mb-2 block">ライブプレビュー</label>
          <div 
            className="w-full bg-gray-900/50 border border-white/20 rounded-md p-4 min-h-[100px] flex items-center justify-center"
            // KaTeXが生成する .katex スタイルを適用
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>

        {/* --- ボタン --- */}
        <div className="flex justify-end mt-4 flex-shrink-0 space-x-2">
          <button onClick={onCancel} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-medium transition-colors">キャンセル</button>
          <button onClick={onSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md font-medium transition-colors">保存して閉じる</button>
        </div>
      </div>
    </div>
  );
};

// --- UI コンポーネント ---
const AppHeader = ({ onSettingsClick, onDownloadLog }) => ( // ← onDownloadLog を追加
  <header className="flex-shrink-0 h-14 bg-black/25 flex items-center px-6 justify-between border-b border-white/10 z-10">
    <h1 className="text-lg font-semibold">スライド作成ジェネレーター</h1>
    <div className="flex items-center space-x-2">
      {/* ▼▼▼ ログボタンを追加 ▼▼▼ */}
      <button 
        onClick={onDownloadLog} 
        title="デバッグログを保存" 
        className="p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-white transition-colors">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
        </svg>
      </button>
      {/* ▲▲▲ ログボタンここまで ▲▲▲ */}
      <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-white/10 transition-colors">
        <SettingsIcon />
      </button>
    </div>
  </header>
);

const FileUploadPanel = ({ isProcessing, processingStatus, fileName, handleDragOver, handleDrop, onFileSelect, appStatus, thinkingState, totalWaitTime }) => (
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

const MarkdownEditor = ({ markdown, setMarkdown, onApprove, onRegenerate }) => ( // ★ onRegenerate を追加
  <div className="bg-black/20 p-4 rounded-lg">
    <p className="text-sm text-gray-300 mb-2">以下に構造化されたテキスト案を表示します。内容を確認し、必要であれば直接編集してください。</p>
    <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} className="w-full h-64 bg-gray-900/50 border border-white/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-mono" />
    <div className="flex justify-between items-center mt-4"> {/* ★ justify-end から justify-between に変更 */}
      <button 
        onClick={onRegenerate} 
        className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors"
      >
        AIで再生成
      </button>
      <button 
        onClick={onApprove} 
        className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors"
      >
        内容を承認して次へ進む
      </button>
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

const OutlineEditor = ({ outline, onChange, onInsert, onDelete, onStart, selectedTheme, onRegenerate, onRegenerateContent, onModifySlide, onModifyAll, handleOpenMathModal }) => {  const handleTableChange = (slideIndex, field, value) => {
    const newOutline = [...outline];
    const newTable = { ...(newOutline[slideIndex].table || { headers: [], rows: [] }) };
    if (field === 'headers') {
      newTable.headers = value.split(',').map(h => h.trim());
    }
    onChange(slideIndex, 'table', newTable);
  };

  const handleTableRowsChange = (slideIndex, value) => {
    const newOutline = [...outline];
    const newTable = { ...(newOutline[slideIndex].table || { headers: [], rows: [] }) };
    // テキストエリアの各行を配列に変換し、各行をカンマで区切ってセルの配列に変換
    newTable.rows = value.split('\n').map(row => row.split(',').map(cell => cell.trim()));
    onChange(slideIndex, 'table', newTable);
  };
  
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
    // "columns" が未定義の場合も考慮し、デフォルトの配列 [{}, {}] を使う
    const currentColumns = newOutline[slideIndex].columns || [{}, {}]; 
    const newColumns = [...currentColumns];
    
    // colIndex が範囲外の場合も安全に対処
    if (!newColumns[colIndex]) {
        newColumns[colIndex] = { title: "", items: [] };
    }

    const newItems = [...(newColumns[colIndex].items || []), "新しい項目"];
    newColumns[colIndex] = { ...newColumns[colIndex], items: newItems };
    onChange(slideIndex, 'columns', newColumns);
  };

  const handleAddColumn = (slideIndex) => {
      const newOutline = [...outline];
      const currentColumns = newOutline[slideIndex].columns || [];
      
      // 4項目を上限とする（UIの崩れ防止）
      if (currentColumns.length >= 4) {
          alert('比較項目は最大4つまでです。');
          return;
      }
      
      const newColumns = [...currentColumns, { title: "新しいカラム", items: ["新しい項目"] }];
      onChange(slideIndex, 'columns', newColumns);
  };

  const handleRemoveColumn = (slideIndex, colIndexToRemove) => {
      const newOutline = [...outline];
      const currentColumns = newOutline[slideIndex].columns || [];
      
      // 2項目を最小とする
      if (currentColumns.length <= 2) {
          alert('比較項目は最低2つ必要です。');
          return;
      }

      const newColumns = currentColumns.filter((_, index) => index !== colIndexToRemove);
      onChange(slideIndex, 'columns', newColumns);
  };

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
                <div className="flex items-center space-x-2">
                  <select 
                    value={slide.template || ''} 
                    onChange={(e) => onChange(index, 'template', e.target.value)} 
                    className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableTemplates.map(templateName => (
                      <option key={templateName} value={templateName}>{templateName}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => onRegenerateContent(index)}
                    title="現在のスライド情報（タイトルなど）を基に、選択中のテンプレートに合わせてAIで内容を再生成します。"
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors flex-shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* --- 各テンプレートの編集UI --- */}
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
            ) : ['vertical_steps', 'content_basic'].includes(slide.template) ? (
              <div className="space-y-3 mt-3">
                {slide.template === 'content_basic' ? (
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-2 block">箇条書き項目 (1行に1項目)</label>
                    <textarea 
                      value={Array.isArray(slide.items) ? slide.items.join('\n') : ''} 
                      onChange={(e) => onChange(index, 'items', e.target.value.split('\n'))} 
                      rows={5} 
                      className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  </div>
                ) : (
                  slide.items?.map((item, itemIndex) => (
                    <div key={itemIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                      <label className="text-xs font-bold text-gray-400 mb-2 block">項目 {itemIndex + 1} - タイトル</label>
                      <input 
                        type="text" 
                        value={item.title || ''} 
                        onChange={(e) => handleItemChange(index, itemIndex, 'title', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                      <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">項目 {itemIndex + 1} - 説明</label>
                      <textarea 
                        value={item.description || item.summary || ''} 
                        onChange={(e) => handleItemChange(index, itemIndex, 'description', e.target.value)} 
                        rows={2} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                      />
                    </div>
                  ))
                )}
              </div>
            ) : slide.template === 'comparison' ? (
              <div className="space-y-3 mt-3">
                  {/* ▼▼▼ grid-cols-2 を変更 ▼▼▼ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                      {slide.columns?.map((col, colIndex) => (
                          <div key={colIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10 relative">
                              {/* カラム削除ボタン (2つより多い場合のみ表示) */}
                              {slide.columns.length > 2 && (
                                  <button 
                                      onClick={() => handleRemoveColumn(index, colIndex)}
                                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-700 hover:bg-red-600 rounded-full text-white text-xs font-bold flex items-center justify-center"
                                      title="このカラムを削除"
                                  >
                                      ×
                                  </button>
                              )}
                          
                              <label className="text-xs font-bold text-gray-400 mb-2 block">カラム {colIndex + 1} - タイトル</label>
                              <input 
                                  type="text" 
                                  value={col.title || ''} 
                                  onChange={(e) => handleColumnChange(index, colIndex, 'title', e.target.value)} 
                                  className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                              />
                              <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">カラム {colIndex + 1} - 箇条書き項目</label>
                              
                              {col.items?.map((item, itemIndex) => (
                                  <input
                                      key={itemIndex}
                                      type="text"
                                      value={item}
                                      onChange={(e) => handleColumnItemChange(index, colIndex, itemIndex, e.target.value)}
                                      className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-1"
                                      placeholder="例: **価格**：10,000円"
                                  />
                              ))}
                              {/* ▼▼▼ 既存の項目追加ボタン ▼▼▼ */}
                              <button onClick={() => handleAddColumnItem(index, colIndex)} className="mt-2 text-xs px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded">項目を追加</button>
                          </div>
                      ))}
                  </div>
                  
                  {/* カラム追加ボタン (4つ未満の場合のみ表示) */}
                  {(slide.columns?.length || 0) < 4 && (
                      <div className="text-center">
                          <button 
                              onClick={() => handleAddColumn(index)}
                              className="mt-2 text-sm px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
                          >
                              比較カラムを追加 (最大4)
                          </button>
                      </div>
                  )}
              </div>
            ) : slide.template === 'table_basic' ? (
                <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  <label className="text-xs font-bold text-gray-400 mb-2 block">テーブルヘッダー (カンマ区切り)</label>
                  <input
                    type="text"
                    value={Array.isArray(slide.table?.headers) ? slide.table.headers.join(', ') : ''}
                    onChange={(e) => handleTableChange(index, 'headers', e.target.value)}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">テーブル行 (1行に1レコード、セルはカンマ区切り)</label>
                  <textarea
                    value={Array.isArray(slide.table?.rows) ? slide.table.rows.map(row => row.join(', ')).join('\n') : ''}
                    onChange={(e) => handleTableRowsChange(index, e.target.value)}
                    rows={5}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <div>
                    <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">表の解説文 (Summary)</label>
                    <textarea 
                      value={slide.summary || ''} 
                      onChange={(e) => onChange(index, 'summary', e.target.value)} 
                      rows={3} 
                      className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                      placeholder="表の補足説明や解説文をMarkdown形式で入力..."
                    />
                  </div>
                </div>
              </div>
          ) : slide.template === 'bar_chart' ? (
              <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  <label className="text-xs font-bold text-gray-400 mb-2 block">
                    グラフデータセット名 (例: 進捗率 (%))
                  </label>
                  <input
                    type="text"
                    value={slide.chart_data?.datasets?.[0]?.label || ''}
                    onChange={(e) => {
                      const newChartData = { ...(slide.chart_data || {}) };
                      if (!newChartData.datasets) newChartData.datasets = [{}];
                      newChartData.datasets[0] = { ...newChartData.datasets[0], label: e.target.value };
                      onChange(index, 'chart_data', newChartData);
                    }}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  
                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">
                    X軸 ラベル (カンマ区切り)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(slide.chart_data?.labels) ? slide.chart_data.labels.join(', ') : ''}
                    onChange={(e) => {
                      const newChartData = { ...(slide.chart_data || {}) };
                      newChartData.labels = e.target.value.split(',').map(s => s.trim());
                      onChange(index, 'chart_data', newChartData);
                    }}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="例: カテゴリA, カテゴリB, カテゴリC"
                  />

                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">
                    Y軸 データ (カンマ区切り、数値のみ)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(slide.chart_data?.datasets?.[0]?.data) ? slide.chart_data.datasets[0].data.join(', ') : ''}
                    onChange={(e) => {
                      const newChartData = { ...(slide.chart_data || {}) };
                      if (!newChartData.datasets) newChartData.datasets = [{}];
                      // 入力を数値(Number)の配列に変換
                      const dataAsNumbers = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
                      newChartData.datasets[0] = { ...newChartData.datasets[0], data: dataAsNumbers };
                      onChange(index, 'chart_data', newChartData);
                    }}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="例: 75, 50, 90"
                  />
                </div>
              </div>  
          ) : slide.template === 'math_basic' ? (
              <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  <label className="text-xs font-bold text-gray-400 mb-2 block">解説文 (Summary)</label>
                  <textarea 
                    value={slide.summary || ''} 
                    onChange={(e) => onChange(index, 'summary', e.target.value)} 
                    rows={4} 
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                    placeholder="数式の解説文をMarkdown形式で入力..."
                  />
                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">数式 (Formula)</label>
                  

                  <div 
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono min-h-[50px] cursor-pointer hover:bg-gray-700 transition-colors"
                    onClick={() => handleOpenMathModal(index)} // ★ モーダルを開く
                  >
                    {/* 現在の数式を簡易表示。空ならプロンプト表示 */}
                    {slide.formula ? (
                      <span className="text-gray-200">{slide.formula}</span>
                    ) : (
                      <span className="text-gray-400">クリックして数式を編集...</span>
                    )}
                  </div>
                </div>
              </div>
            ) : slide.template === 'highlighted_number' ? (
              <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  {/* ▼▼▼ 修正: グリッドレイアウトで左右に分ける ▼▼▼ */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-2 block">左: 強調する数値 (Number)</label>
                      <input 
                        type="text" 
                        value={slide.number || ''} 
                        onChange={(e) => onChange(index, 'number', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="例: 98%"
                      />
                      <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">左: 数値の説明 (Description)</label>
                      <input 
                        type="text" 
                        value={slide.description || ''} 
                        onChange={(e) => onChange(index, 'description', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="例: 売上達成率"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-2 block">右: 見出し (Content Title)</label>
                      <input 
                        type="text" 
                        value={slide.content_title || ''} 
                        onChange={(e) => onChange(index, 'content_title', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="例: 単一の重要数値"
                      />
                      <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">右: 補足説明文 (Summary)</label>
                      <textarea 
                        value={slide.summary || ''} 
                        onChange={(e) => onChange(index, 'summary', e.target.value)} 
                        rows={3} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                        placeholder="右側の補足説明文..."
                      />
                    </div>
                  </div>
                  {/* ▲▲▲ 修正ここまで ▲▲▲ */}
                </div>
              </div>
            ) : slide.template === 'quote' ? (
              <div>
                <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">引用文・キラーフレーズ (Summary)</label>
                <textarea 
                  value={slide.summary || ''} 
                  onChange={(e) => onChange(index, 'summary', e.target.value)} 
                  rows={3} 
                  className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                  placeholder="例: 「我々の最適解は、Aプランである」"
                />

                <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">補足文 (Description)</label>
                <input 
                  type="text" 
                  value={slide.description || ''} 
                  onChange={(e) => onChange(index, 'description', e.target.value)} 
                  className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="例: − キラーフレーズの補足説明"
                />
              </div>
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

            {/* --- スライド個別操作ボタン --- */}
            <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-white/10">
              <button 
                onClick={() => onModifySlide(index)}
                title="このスライドについてAIに修正指示を出す"
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium rounded-md transition-colors"
              >
                AIで修正
              </button>
              <button onClick={() => onInsert(index)} className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-xs font-medium rounded-md transition-colors">この下にスライドを挿入</button>
              <button onClick={() => onDelete(index)} className="px-3 py-1 bg-red-700 hover:bg-red-600 text-xs font-medium rounded-md transition-colors disabled:opacity-50" disabled={outline.length <= 1}>このスライドを削除</button>
            </div>
          </div>
        ))}
      </div>
      
      {/* --- 全体操作ボタン --- */}
      <div className="flex flex-col items-center pt-2 space-y-3">
        <button 
            onClick={onModifyAll}
            className="w-full max-w-md px-6 py-2 bg-indigo-700 hover:bg-indigo-600 text-sm font-medium rounded-md transition-colors"
          >
            構成案全体をAIで修正...
        </button>
        <div className="flex justify-center space-x-4">
          <button 
            onClick={onRegenerate} 
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors"
          >
            構成案を再生成
          </button>
          <button 
            onClick={onStart} 
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors" 
            disabled={outline.length === 0}
          >
            構成案を承認し、スライド生成を開始する
          </button>
        </div>
      </div>
    </div>
  );
};

const DownloadButton = ({ onDownload, onDownloadPdf, isGeneratingPdf }) => (
    <div className="bg-black/20 p-4 rounded-lg flex justify-center space-x-4">
        <button 
          onClick={onDownload} 
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors"
        >
          ZIPファイルをダウンロード
        </button>
        <button 
          onClick={onDownloadPdf} 
          className={`px-6 py-2 bg-green-700 hover:bg-green-600 text-sm font-medium rounded-md transition-colors ${isGeneratingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? 'PDFを生成中...' : 'PDFをダウンロード'}
        </button>
    </div>
);

const UserInput = ({ value, onChange, onSend, disabled }) => (
    <div className="relative">
        <input type="text" value={value} onChange={onChange} onKeyPress={(e) => e.key === 'Enter' && onSend()} placeholder="修正指示などを入力..." className="w-full bg-gray-900/50 border border-white/20 rounded-lg py-3 pl-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" disabled={disabled} />
        <button onClick={onSend} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors disabled:opacity-50" disabled={disabled || !value.trim()}> <SendIcon /> </button>
    </div>
);

const GenerationControls = ({ onPreview, onApprove, onEditCode, onRegenerate, onReturnToOutline, disabled }) => ( 
    <div className="flex justify-end mt-4 space-x-2">
        <button 
          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50 hidden" 
          disabled={disabled} 
          onClick={onPreview}
        >
          プレビュー
        </button>
        <button 
          className="px-4 py-2 bg-sky-800 hover:bg-sky-700 text-sm font-medium rounded-md transition-colors disabled:opacity-50" 
          disabled={disabled} 
          onClick={onReturnToOutline} 
          title="現在のプレビューを破棄し、構成案の編集画面に戻ります。"
        >
          構成案を修正
        </button>
        <button 
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" 
          disabled={disabled} 
          onClick={onRegenerate}
        >
          再生成
        </button>
        <button className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" disabled={disabled} onClick={onEditCode}>ソースコードを編集</button>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" disabled={disabled} onClick={onApprove}>承認して次へ</button>
    </div>
);

/**
 * 汎用的な進捗トラッカー
 * AIの「思考プロセス」のステップを表示するために使用 (カウントダウンタイマー機能付き)
 */
const ProcessingTracker = ({ title, steps, currentStepKey, totalWaitTime }) => {
  const currentStepIndex = steps.findIndex(step => step.key === currentStepKey);

  // [NEW] 残り時間管理
  const [remainingTime, setRemainingTime] = useState(Math.ceil(totalWaitTime / 1000));

  useEffect(() => {
    // totalWaitTime がセットされたら（0より大きい場合）、タイマーを開始
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

      // クリーンアップ
      return () => clearInterval(interval);
    } else {
      // 処理が完了したらタイマーを0に
      setRemainingTime(0);
    }
  }, [totalWaitTime]); // totalWaitTime が変わった時（＝新規処理開始時）にリセット

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-lg p-4">
      <p className="font-semibold text-sm flex items-center mb-3">
        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
        {title}
        {/* [NEW] 残り時間表示 (1秒以上ある場合のみ) */}
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

const GenerationProgressTracker = ({ outline, currentIndex, thinkingState }) => {
  // 1. アクティブなスライドへの参照を作成
  const activeSlideRef = useRef(null);


  // 2. currentIndex が変更されたら、アクティブな項目にスクロール
  useEffect(() => {
    if (activeSlideRef.current) {
      activeSlideRef.current.scrollIntoView({
        behavior: 'smooth', // スムーズスクロール
        block: 'nearest',    // ビューポートに収まるよう最小限のスクロール
      });
    }
  }, [currentIndex]); // currentIndex が変わるたびに実行

  return (
    <div className="bg-black/20 p-4 rounded-lg space-y-3">
      <p className="text-sm text-gray-300 mb-2 font-semibold">スライド生成中...</p>
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
        {outline.map((slide, index) => {
          const isDone = index < currentIndex;
          const isInProgress = index === currentIndex;

          return (
            // 3. 実行中の項目 (isInProgress) に ref を動的に割り当て
            <div 
              key={index}
              ref={isInProgress ? activeSlideRef : null} 
              className={`border border-white/10 rounded-lg p-3 transition-all duration-300 ${isInProgress ? 'bg-indigo-900/50' : 'bg-gray-900/50'}`}
            >
              <p className="font-semibold text-sm flex items-center">
                {isDone ? <span className="text-green-400 mr-2">✅</span> : isInProgress ? <span className="animate-pulse mr-2">⏳</span> : <span className="text-gray-500 mr-2">📄</span>}
                {index + 1}. {slide.title}
                {isDone && <span className="ml-auto text-xs text-green-400 font-medium">完了</span>}
                {isInProgress && <span className="ml-auto text-xs text-indigo-300 font-medium">生成中</span>}
              </p>

              {isInProgress && (
                <div className="mt-3">
                  <ProcessingTracker
                    title="スライドを生成中..."
                    steps={SLIDE_GENERATION_STEPS}
                    currentStepKey={thinkingState}
                  />
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
  <div className="w-full h-full bg-white/5 rounded-xl flex flex-col border border-white/10 overflow-hidden">
    <div className="flex-grow p-6 overflow-y-auto space-y-4">
      <MessageList messages={chatState.messages} />
      
      {chatState.apiErrorStep && (
        <div className="bg-black/20 p-4 rounded-lg flex justify-center">
          <button onClick={chatState.handleRetry} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors">
            再試行
          </button>
        </div>
      )}

      {chatState.appStatus === APP_STATUS.STRUCTURED && <MarkdownEditor 
        markdown={chatState.structuredMarkdown} 
        setMarkdown={chatState.setStructuredMarkdown} 
        onApprove={chatState.handleMarkdownApproval} 
        onRegenerate={chatState.handleRegenerateStructure} /* ★追加 */
      />}
      {chatState.appStatus === APP_STATUS.SELECTING_THEME && <ThemeSelector 
        selectedTheme={chatState.selectedTheme} 
        selectedDesign={chatState.design} 
        onThemeSelect={chatState.handleThemeSelection} 
        onDesignSelect={chatState.handleDesignSelection} 
        onApprove={chatState.handleThemeApproval} />}
      {chatState.appStatus === APP_STATUS.CREATING_OUTLINE && <AgendaSelector onSelect={chatState.handleAgendaChoice} />}
      {chatState.appStatus === APP_STATUS.SELECTING_SECTION_HEADERS && <SectionHeaderSelector onSelect={chatState.handleSectionHeaderChoice} />}
      
      {chatState.appStatus === APP_STATUS.OUTLINE_CREATED && <OutlineEditor 
        outline={chatState.slideOutline} 
        onChange={chatState.handleOutlineChange} 
        onInsert={chatState.handleInsertSlide} 
        onDelete={chatState.handleDeleteSlide} 
        onStart={chatState.handleStartGeneration} 
        selectedTheme={chatState.selectedTheme}
        onRegenerate={chatState.handleRegenerateOutline} 
        onRegenerateContent={chatState.handleRegenerateSlideContent}
        onModifySlide={chatState.handleOpenModifyModal}
        onModifyAll={chatState.handleOpenModifyAllModal}
        handleOpenMathModal={chatState.handleOpenMathModal}
      />}

      {(chatState.appStatus === APP_STATUS.GENERATING_SLIDES || chatState.appStatus === APP_STATUS.SLIDE_GENERATED) &&
        <GenerationProgressTracker
          outline={chatState.slideOutline}
          currentIndex={chatState.currentSlideIndex}
          thinkingState={chatState.thinkingState}
        />
      }

      {chatState.appStatus === APP_STATUS.ALL_SLIDES_GENERATED && <DownloadButton 
        onDownload={chatState.handleDownloadZip} 
        onDownloadPdf={chatState.handleDownloadPdf}
        isGeneratingPdf={chatState.isGeneratingPdf}
      />}

      <div ref={chatState.chatEndRef} />
    </div>

    <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/20">
      <UserInput value={chatState.userInput} onChange={(e) => chatState.setUserInput(e.target.value)} onSend={chatState.handleSendMessage} disabled={chatState.appStatus !== APP_STATUS.SLIDE_GENERATED} />
      <GenerationControls 
        onPreview={chatState.handlePreview} 
        onApprove={chatState.handleApproveAndNext} 
        onEditCode={chatState.handleOpenCodeEditor} 
        onRegenerate={chatState.handleRegenerateCurrentSlide}
        onReturnToOutline={chatState.handleReturnToOutline} 
        disabled={chatState.appStatus !== APP_STATUS.SLIDE_GENERATED} 
      />
    </div>
  </div>
);

/**
 * スライドプレビューのラッパーコンポーネント
 * 承認済みスライドと現在作業中のスライドを縦に並べて表示する
 */
const SlidePreviewItem = ({ htmlContent, containerWidth }) => {
  // スライドの基本サイズ
  const baseWidth = 1280;
  const baseHeight = 720;

  // コンテナ幅に基づいてスケールを計算 (padding分を考慮)
  const scale = containerWidth > 0 ? (containerWidth - 16) / baseWidth : 1;
  const scaledHeight = baseHeight * scale;

  // --- ▼▼▼ デバッグログを削除 ▼▼▼ ---
  // console.log('[DEBUG] SlidePreviewItem Rendering...', { ... });
  // --- ▲▲▲ デバッグログを削除 ▲▲▲ ---

  return (
    <div 
      className="relative w-full rounded-lg overflow-hidden shadow-lg border border-white/10"
      style={{ height: `${scaledHeight}px` }}
    >
      <iframe
        key={htmlContent} // HTMLが変更されたらiframeを強制的に再読み込み
        srcDoc={htmlContent}
        width={baseWidth}
        height={baseHeight}
        className="border-none"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left', // 左上基点で拡縮
        }}
        sandbox="allow-same-origin allow-scripts" // ★修正は維持
        title="Slide Preview Item"
      />
    </div>
  );
};

/**
 * プレビューパネル本体
 * 縦スクロールコンテナ
 */
const PreviewPanel = ({ generatedSlides, htmlContent, isLoading, loadingSlideTitle }) => {
  const containerRef = useRef(null);
  const scrollEndRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // コンテナの幅を監視し、スケーリング計算用に保持
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

  // スライドが追加または更新されたら、一番下にスクロール
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generatedSlides, htmlContent, isLoading]); // 依存配列にisLoadingも追加

  

  return (
    <div 
      ref={containerRef} 
      // ★修正: h-full, overflow-y-auto を追加
      className="w-full h-full bg-black/10 rounded-xl flex flex-col p-4 border border-white/10 overflow-y-auto"
    >
      {/* 承認済みのスライドをマッピング */}
      <div className="space-y-4">
        {generatedSlides.map((slideHtml, index) => (
          <SlidePreviewItem 
            key={index}
            htmlContent={slideHtml}
            containerWidth={containerWidth}
          />
        ))}

        {/* 現在プレビュー中のスライド (承認待ち) */}
        {htmlContent && !isLoading && (
          <SlidePreviewItem 
            htmlContent={htmlContent}
            containerWidth={containerWidth}
          />
        )}

        {/* 現在生成中のローディング表示 */}
        {isLoading && (
          <div 
            className="w-full flex flex-col items-center justify-center bg-white/5 rounded-lg border border-dashed border-indigo-500"
            // スケーリング後の高さに合わせる
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

      {/* 自動スクロール用のアンカー */}
      <div ref={scrollEndRef} />
    </div>
  );
};

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

const OutlineModifyModal = ({ isOpen, mode, index, value, onChange, onSave, onCancel }) => {
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
  const [debugLog, setDebugLog] = useState([]); // ★【NEW】デバッグログ専用ステート
  const [userInput, setUserInput] = useState('');

  const [fileName, setFileName] = useState('');
  const [originalExtractedText, setOriginalExtractedText] = useState(''); 
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

  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modificationInput, setModificationInput] = useState('');
  const [modifyModalTarget, setModifyModalTarget] = useState({ index: null, mode: 'single' });

  const [approvedOutlineSnapshot, setApprovedOutlineSnapshot] = useState([]);
  
  const [documentContext, setDocumentContext] = useState(null); // { purpose: '...', audience: '...' }

  const [thinkingState, setThinkingState] = useState(null);

  const [currentTotalWaitTime, setCurrentTotalWaitTime] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); 

  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [tempMathFormula, setTempMathFormula] = useState('');
  const [mathModalTargetIndex, setMathModalTargetIndex] = useState(null);

  const chatEndRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      const text = 'ようこそ！スライドの元になるドキュメントをアップロードしてください。';
      setMessages([{ type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'useEffect', text);
    } else {
      setIsApiKeyModalOpen(true);
      const text = 'まず、Gemini APIキーを設定してください。';
      setMessages([{ type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_WARN', 'useEffect', text);
    }


  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingState]);


  // --- Helper Functions ---

  /**
   * 【NEW】デバッグログに新しいエントリを追加する
   * @param {string} type - ログ種別 (例: 'UI_SYSTEM', 'API_REQUEST', 'API_RESPONSE_SUCCESS', 'API_ERROR')
   * @param {string} context - 処理のコンテキスト (例: 'callGeminiApi: structureText')
   * @param {any} data - ログに残したいデータ (文字列、オブジェクト、プロンプト全文など)
   */
  const addLogEntry = (type, context, data) => {
    const newEntry = {
      timestamp: new Date().toISOString(),
      type,
      context,
      data: data // 生のデータをそのまま保存
    };
    // UIの再レンダリングを避けるため、ステートフックの関数型更新を利用
    setDebugLog(prevLog => [...prevLog, newEntry]);
  };

  /**
   * 【NEW】AIが生成したデータ内のリテラル改行（\\n）を本物の改行（\n）に置換する
   * @param {any} data スキャン対象のデータ（オブジェクト、配列、文字列など）
   * @returns {any} 置換処理後のデータ
   */
  const sanitizeNewlines = (data) => {
    // 1. 文字列の場合: リテラル改行（\\n）を本物の改行（\n）に置換
    if (typeof data === 'string') {
      return data.replace(/\\n/g, '\n');
    }

    // 2. 配列の場合: 各要素に対して再帰的に処理
    if (Array.isArray(data)) {
      return data.map(sanitizeNewlines);
    }

    // 3. オブジェクトの場合: 各キーの値に対して再帰的に処理
    if (typeof data === 'object' && data !== null) {
      const newObj = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          newObj[key] = sanitizeNewlines(data[key]);
        }
      }
      return newObj;
    }

    // 4. それ以外（数値、nullなど）: そのまま返す
    return data;
  };
  
  const callGeminiApi = async (prompt, modelName, actionName) => {
    if (!apiKey) {
      // ▼▼▼ ログ記録（UIメッセージ） ▼▼▼
      const text = 'APIキーが設定されていません。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'callGeminiApi', text);
      // ▲▲▲ ログ記録 ▲▲▲
      return null;
    }
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      console.log(`[INFO] Calling Gemini API for: ${actionName} using ${modelName}`);
      console.debug(`[DEBUG] Prompt for ${actionName}:`, prompt);

      // ▼▼▼ ログ記録（APIリクエスト） ▼▼▼
      addLogEntry('API_REQUEST', actionName, { model: modelName, prompt: prompt });
      // ▲▲▲ ログ記録 ▲▲▲

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = await response.text();
      
      text = text.replace(/^```(json|html|svg)?\s*|```\s*$/g, '').trim();
      text = text.replace(/^xml\s*/, '');
      
      console.log(`[INFO] Received response for: ${actionName}`);

      // ▼▼▼ ログ記録（APIレスポンス成功） ▼▼▼
      addLogEntry('API_RESPONSE_SUCCESS', actionName, text);
      // ▲▲▲ ログ記録 ▲▲▲
      
      return text;
    } catch (error) {
      console.error(`[FATAL] API Error during ${actionName}:`, error);

      // ▼▼▼ ログ記録（APIレスポンスエラー） ▼▼▼
      addLogEntry('API_ERROR', actionName, error.message);
      // ▲▲▲ ログ記録 ▲▲▲

      return { error: `APIエラーが発生しました: ${error.message}` }; 
    }
  };

  /**
   * 【NEW】'highlighted_number' スライドの 'number' フィールドを自動修正（サニタイズ）する
   * AIが 'number' に日本語やMarkdownを含めた場合に、それらを 'description' に移動させる
   * @param {Array} outline - AIが生成したスライド構成案
   * @returns {Object} - { sanitizedOutline: Array, notification: string | null }
   */
  const sanitizeHighlightedNumbers = (outline) => {
    let notification = null; // 修正が発生した場合の通知メッセージ
    
    // Unicodeプロパティエスケープ (\p{...}) をサポートする正規表現
    // [\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}] で日本語の文字セットにマッチ
    const japaneseRegex = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+/gu;

    const sanitizedOutline = outline.map(slide => {
      // highlighted_number テンプレート以外はそのまま返す
      if (slide.template !== 'highlighted_number' || !slide.number || typeof slide.number !== 'string') {
        return slide;
      }

      let originalNumber = slide.number;
      let finalNumber = originalNumber;
      let extraTextFound = '';

      // 1. Markdown記法（*, _）を除去
      finalNumber = finalNumber.replace(/[*_]/g, '');

      // 2. 日本語のテキストを検索
      const matches = finalNumber.match(japaneseRegex);
      
      if (matches) {
        // マッチした日本語（例: "削減", "達成"）を extraTextFound に結合
        extraTextFound = matches.join('');
        // 元の文字列から日本語を除去
        finalNumber = finalNumber.replace(japaneseRegex, '').trim();
      }

      // 3. 修正が発生したかチェック
      // (例: "**30%削減**" -> "30%")
      if (originalNumber !== finalNumber) {
        const newSlide = { ...slide };
        
        // 4. 'number' フィールドをクリーンアップ後の値で上書き
        newSlide.number = finalNumber;
        
        // 5. 'description' フィールドに、抽出した日本語テキストを追記
        // (すでに追加済みでないかチェック)
        if (extraTextFound && newSlide.description && !newSlide.description.includes(extraTextFound)) {
          newSlide.description = newSlide.description + extraTextFound;
        } else if (extraTextFound && !newSlide.description) {
          // description が空だった場合は、そのままセット
          newSlide.description = extraTextFound;
        }

        // 修正が発生したことを記録
        notification = "【自動修正】'重要数値' スライドの 'number' フィールドから不要なテキスト（例: '削減'）を検出し、'description' フィールドに自動的に移動しました。";
        return newSlide;
      }

      // 修正がなければ元のスライドを返す
      return slide;
    });

    return { sanitizedOutline, notification };
  };

  /**
   * AIが生成したSVG文字列をサニタイズ（自動修正）する
   * - width/height を 100% に強制
   * - viewBox がなければデフォルトを追加
   * - 誤った背景色を透過に修正
   */
  const sanitizeSvg = (svgString) => {
    if (!svgString || typeof svgString !== 'string' || !svgString.startsWith('<svg')) {
      console.warn("[WARN] Invalid SVG string received:", svgString);
      return svgString; // SVGでないか、空の場合はそのまま返す
    }

    let sanitized = svgString;

    // 1. 既存の width/height 属性を削除 (ピクセル指定などを防ぐため)
    // <svg ... width="..." ...> -> <svg ... ...>
    sanitized = sanitized.replace(/<svg([^>]*?)width=".*?"/g, '<svg$1');
    sanitized = sanitized.replace(/<svg([^>]*?)height=".*?"/g, '<svg$1');

    // 2. viewBox が存在するかチェック
    const hasViewBox = /<svg([^>]*?)viewBox=".*?"/g.test(sanitized);

    if (hasViewBox) {
      // viewBox がある場合: width/height="100%" のみ挿入
      sanitized = sanitized.replace('<svg', '<svg width="100%" height="100%"');
    } else {
      // viewBox がない場合: width/height="100%" と デフォルトの viewBox を挿入
      console.warn('[WARN] SVG missing viewBox. Adding default "0 0 100 100".');
      sanitized = sanitized.replace('<svg', '<svg width="100%" height="100%" viewBox="0 0 100 100"');
    }

    // 3. (保険) AIが誤って <svg> タグ自体に背景色を指定した場合、透過させる
    sanitized = sanitized.replace(/<svg([^>]*?)fill="(#fff|#ffffff|#000|#000000)"/gi, '<svg$1fill="transparent"');
    
    // 4. (保険) AIが誤って <rect> で背景色を指定した場合、透過させる
    sanitized = sanitized.replace(/<rect([^>]*?)fill="(#fff|#ffffff|#000|#000000)"([^>]*?)width="100%"([^>]*?)height="100%"/gi, 
      '<rect$1fill="transparent"$3width="100%"$4height="100%"'
    );

    return sanitized;
  };

  /**
   * 【NEW】アイコン指示を処理し、SVG文字列を取得する
   * - 英語名でも404なら再翻訳を試みる
   * @param {object} point - スライドのポイントオブジェクト (title, summary, icon_description を含む)
   * @returns {Promise<string>} SVG文字列
   */
  const getIconSvg = async (point) => {
    // Lucideアイコン名（半角英小文字、数字、ハイフンのみ）の正規表現
    const isValidIconName = /^[a-z0-9-]+$/;
    let iconName = (point.icon_description || '').trim();
    
    // AIが再翻訳を試みるための「概念」を定義
    // (指示が日本語の場合はそれ自体を、英語の場合はスライドのタイトルや要約を概念とする)
    let conceptForRetry = iconName; 

    let svgContent = null; // SVGコンテンツを保持する変数

    // --- 1. 翻訳 (必要な場合) ---
    if (!isValidIconName.test(iconName)) {
      // 英語名でない（＝日本語指示）の場合
      console.warn(`[WARN] Invalid icon name: "${iconName}". Translating via AI...`);
      const prompt = PROMPTS.findIconName(iconName);
      const translatedNameResult = await callGeminiApi(prompt, 'gemini-2.5-flash-lite', 'Icon Translation');

      if (translatedNameResult && !translatedNameResult.error) {
        iconName = translatedNameResult.trim().toLowerCase();
        console.log(`[INFO] AI translation: "${point.icon_description}" -> "${iconName}"`);
      } else {
        console.error(`[ERROR] Icon translation failed for: "${point.icon_description}"`);
        iconName = 'circle'; // 翻訳自体が失敗したら 'circle' に
      }
    } else {
      // 英語名が最初から指定されていた場合
      // 再翻訳の際は、この英語名ではなく「スライドのタイトル」を概念として使う
      conceptForRetry = `${point.title}: ${point.summary}`;
      console.log(`[INFO] Icon name is valid: "${iconName}". Attempting fetch...`);
    }

    // --- 2. 最初のフェッチ試行 ---
    // (日本語から翻訳された名前、または最初から英語だった名前でフェッチ)
    svgContent = await fetchIconSvg(iconName);

    // --- 3. 再翻訳ロジック (フェッチ失敗時 = 404) ---
    // (英語ハルシネーションでも、日本語からの翻訳ミスでも、ここで捕捉される)
    if (svgContent === null) {
      console.warn(`[WARN] Retrying translation. (Failed attempt: "${iconName}")`);
      
      // 失敗した名前をAIに伝え、再翻訳を試みる
      // (conceptForRetry には「日本語指示」または「スライドのタイトル」が入っている)
      const retryPrompt = PROMPTS.findIconNameRetry(conceptForRetry, iconName);
      const retryNameResult = await callGeminiApi(retryPrompt, 'gemini-2.5-flash-lite', 'Icon Translation Retry');
      
      let newIconName = 'circle'; // デフォルトは 'circle'
      if (retryNameResult && !retryNameResult.error) {
        newIconName = retryNameResult.trim().toLowerCase();
        console.log(`[INFO] AI retry translation: "${conceptForRetry}" -> "${newIconName}"`);
      } else {
        console.error(`[ERROR] Icon retry translation failed.`);
      }

      // 再度フェッチ (これが最後の試行)
      svgContent = await fetchIconSvg(newIconName);
    }

    // --- 4. 最終フォールバック ---
    if (svgContent === null) {
      console.log(`[INFO] Final fallback: fetching 'circle'.`);
      svgContent = await fetchIconSvg('circle');
    }

    return svgContent || ''; // 最終的に 'circle' すら失敗したら空文字
  };

  /**
   * Lucide アイコンを CDN から SVG 文字列として取得する
   * @param {string} iconName - Lucide のアイコン名 (例: 'check-circle')
   * @returns {Promise<string>} SVG文字列 (失敗時は空文字列)
   */
  const fetchIconSvg = async (iconName) => {
    // Lucideアイコン名（半角英小文字、数字、ハイフンのみ）の正規表現
    const isValidIconName = /^[a-z0-9-]+$/; 

    // AIが不正な値（日本語、スペース、空文字など）を指定した場合のフォールバック
    if (!iconName || !isValidIconName.test(iconName)) {
        console.warn(`[WARN] Invalid icon name received: "${iconName}". Using default 'circle'.`);
        iconName = 'circle'; // 強制的に 'circle' にする
    }
    
    try {
      const response = await fetch(`https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg`);
      if (!response.ok) {
        console.warn(`[WARN] Failed to fetch icon: ${iconName}. Server responded with ${response.status}.`);
        return null; // "circle" をフェッチせず、null を返して失敗を通知
      }
      return await response.text();
    } catch (error) {
      console.error(`[ERROR] Fetching icon ${iconName}:`, error);
      return null; // ネットワークエラー時も null を返す
    }
  };

  // --- Handlers ---
  const handleApiKeySave = () => {
    if (tempApiKey) {
      localStorage.setItem('gemini_api_key', tempApiKey);
      setApiKey(tempApiKey);
      setIsApiKeyModalOpen(false);
      const text = 'APIキーが保存されました。スライドの元になるドキュメントをアップロードしてください。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleApiKeySave', text);
    }
  };

  const handleRetry = () => {
    if (apiErrorStep === 'structure') {
      // テキスト抽出は完了しているので、再度構造化処理を呼び出す
      // onTextExtracted は内部でテキストを引数に取るため、ここでは直接呼び出さず、
      // ユーザーに再アップロードを促すか、抽出済みテキストをStateに持つ必要がある。
      // 今回はシンプルにするため、再度Markdown承認ステップから開始させる。
      const text = '再試行します。内容を再度承認してください。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_INFO', 'handleRetry: structure', text);
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
      const text = `サポートされていないファイル形式です: ${file.type}`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleFileSelect', text);
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setProcessingStatus('テキストを抽出中...');
    const text = `${file.name} をアップロードしました。`;
    setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_SYSTEM', 'handleFileSelect', text);

    try {
      let extractedText = '';
      if (file.type === 'application/pdf') {
        const typedarray = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textData = await page.getTextContent();
          extractedText += textData.items.map(s => s.str).join(' ');
        }
      } else {
        extractedText = await file.text();
      }
      addLogEntry('SYSTEM_EVENT', 'handleFileSelect', `Text extraction complete. Length: ${extractedText.length}`);
      onTextExtracted(extractedText);
    } catch (error) {
        const text = 'テキスト抽出中にエラーが発生しました。';
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM_ERROR', 'handleFileSelect', `${text} ${error.message}`);
        setIsProcessing(false);
        setFileName('');
    }
  };

  const onTextExtracted = async (text) => {
    const msg1 = `テキスト抽出完了(${text.length}文字)。内容を構造化します。`;
    setMessages(prev => [...prev, { type: 'system', text: msg1, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_SYSTEM', 'onTextExtracted', msg1);
    
    setAppStatus(APP_STATUS.STRUCTURING);
    setProcessingStatus('テキストを構造化中...');
    setApiErrorStep(null); // 再試行の前にエラー状態をリセット
    
    setOriginalExtractedText(text); // ★生テキストを保存
    
    // 1. 待機時間を計算し、Stateにセット
    // (元のロジックを流用)
    const calculatedWaitTime = Math.max(4000, Math.min(180000, text.length * 1.8));
    setCurrentTotalWaitTime(calculatedWaitTime);
    
    // ★ 4ステップで分割 (元の 3 から 4 に変更)
    const stepWaitTime = calculatedWaitTime / 4; 

    // 2. APIコール (Promise) を2つ準備
    // ★ 2.1: 【NEW】 文脈分析API
    const contextPrompt = PROMPTS.analyzeContext(text);
    const contextApiPromise = callGeminiApi(contextPrompt, 'gemini-2.5-flash-lite', '文脈分析');

    // ★ 2.2: 【既存】 テキスト構造化API
    const structurePrompt = PROMPTS.structureText(text);
    const structureApiPromise = callGeminiApi(structurePrompt, 'gemini-2.5-flash-lite', 'テキスト構造化');
    
    // 3. ダミー進捗 (Promise)
    // ★ 4ステップ（analyzing_context を含む）に修正
    const dummyProgressPromise = (async () => {
      try {
        setThinkingState(STRUCTURING_STEPS[0].key); // analyzing_context
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));

        setThinkingState(STRUCTURING_STEPS[1].key); // cleaning
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));

        setThinkingState(STRUCTURING_STEPS[2].key); // analyzing
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));

        setThinkingState(STRUCTURING_STEPS[3].key); // formatting
        await new Promise(resolve => setTimeout(resolve, stepWaitTime)); 
      } catch (e) {
        console.error("Dummy progress failed", e);
      }
    })();

    try {
      // 4. 3つのPromise（API 2つ + ダミー進捗 1つ）すべての完了を待つ
      const [contextResult, structureResult] = await Promise.all([
        contextApiPromise, 
        structureApiPromise, 
        dummyProgressPromise
      ]);
      
      // 5. 両方完了したら後処理
      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0); // Stateリセット

      let hasError = false;

      // 6. 【NEW】 文脈分析APIの結果を処理
      if (contextResult && !contextResult.error) {
        try {
          const parsedContext = JSON.parse(contextResult);
          setDocumentContext(parsedContext); // ★ State に保存
          console.log('[INFO] Document Context Analyzed:', parsedContext);

          // ▼▼▼ ここから修正・追加 ▼▼▼
          // 翻訳マップを使って日本語の説明を取得
          const purposeJp = CONTEXT_TRANSLATIONS.purpose[parsedContext.purpose] || parsedContext.purpose;
          const audienceJp = CONTEXT_TRANSLATIONS.audience[parsedContext.audience] || parsedContext.audience;
          
          // チャットに分析結果を表示する
          const text = `文脈分析が完了しました。\n- **目的**: ${purposeJp}\n- **対象者**: ${audienceJp}`;
          setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
          addLogEntry('UI_SYSTEM', 'onTextExtracted (Context)', text);
          // ▲▲▲ 修正・追加ここまで ▲▲▲

        } catch (e) {
          console.error('[FATAL] Failed to parse document context JSON:', e);
          const text = '文脈分析の結果解析に失敗しました。';
          setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
          addLogEntry('UI_SYSTEM_ERROR', 'onTextExtracted (Context Parse)', `${text} ${e.message}`);
          hasError = true; // エラーフラグ
        }
      } else {
        // API自体がエラーを返した場合
        const text = contextResult ? contextResult.error : '文脈分析中に予期せぬエラーが発生しました。';
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM_ERROR', 'onTextExtracted (Context API)', text);
        hasError = true; // エラーフラグ
      }

      // 7. 【既存】 構造化APIの結果を処理
      if (structureResult && !structureResult.error) {
        setStructuredMarkdown(structureResult);
        setAppStatus(APP_STATUS.STRUCTURED);
        const text = 'テキストの構造化が完了しました。';
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM', 'onTextExtracted (Structure)', text);
      } else {
        // エラーハンドリング
        setApiErrorStep('structure');
        const text = structureResult ? structureResult.error : '予期せぬエラーが発生しました。';
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM_ERROR', 'onTextExtracted (Structure API)', text);
      }

      // どちらかでエラーがあった場合、Markdown承認ステップには進ませない
      if(hasError) {
         setApiErrorStep('structure'); // 共通のエラーステップに設定
         setAppStatus(APP_STATUS.INITIAL); // 初期状態に戻すか、エラー状態にする
         setIsProcessing(false);
      }

    } catch (error) {
      // APIエラー (callGeminiApiがthrowした場合) やその他の予期せぬエラー
      console.error("[FATAL] Error during structuring:", error);
      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0);
      setApiErrorStep('structure');
      const text = `予期せぬエラーが発生しました: ${error.message}`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_FATAL', 'onTextExtracted (Catch)', text);
    }
  };

  const handleRegenerateStructure = async () => {
    if (!originalExtractedText) {
      const text = 'エラー: 元のテキストが見つかりません。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleRegenerateStructure', text);
      return;
    }
    
    if (!window.confirm('現在の編集内容は破棄されますが、テキストの構造化をAIに再実行させますか？')) {
      return;
    }

    const text1 = 'テキストの再構造化を実行します...';
    setMessages(prev => [...prev, { type: 'system', text: text1, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_SYSTEM', 'handleRegenerateStructure', text1);
    
    setAppStatus(APP_STATUS.STRUCTURING);
    setIsProcessing(true); // ★ FileUploadPanel をローディング表示にする
    setProcessingStatus('テキストを再構造化中...');
    setApiErrorStep(null);

    // ★ originalExtractedText を使って再度APIを叩く
    const result = await callGeminiApi(PROMPTS.structureText(originalExtractedText), 'gemini-2.5-flash-lite', 'テキスト再構造化');
    
    setIsProcessing(false); // ★ローディング解除
    
    if (result && !result.error) {
      setStructuredMarkdown(result);
      setAppStatus(APP_STATUS.STRUCTURED); // ★ MarkdownEditor が表示されるステータスに戻す
      const text = 'テキストの再構造化が完了しました。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleRegenerateStructure', text);
    } else {
      // エラーハンドリング
      setApiErrorStep('structure');
      setAppStatus(APP_STATUS.STRUCTURED); // ★ エラー時も編集画面には戻す
      const text = result ? result.error : '予期せぬエラーが発生しました。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleRegenerateStructure', text);
    }
  };

  const handleMarkdownApproval = () => {
    setAppStatus(APP_STATUS.SELECTING_THEME);
    const text = '内容が承認されました。次に、プレゼンテーションのテーマを選択してください。';
    setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_SYSTEM', 'handleMarkdownApproval', text);
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
    
    const userText = `${themeName}テーマ (${designName}) を選択`;
    const systemText = 'テーマを承知しました。次に、アジェンダページを挿入しますか？';
    
    setMessages(prev => [
      ...prev,
      { type: 'user', text: userText, timestamp: new Date().toISOString() },
      { type: 'system', text: systemText, timestamp: new Date().toISOString() }
    ]);
    addLogEntry('UI_USER', 'handleThemeApproval', userText);
    addLogEntry('UI_SYSTEM', 'handleThemeApproval', systemText);
  }

  const handleAgendaChoice = (choice) => {
    setIncludeAgenda(choice);
    setAppStatus(APP_STATUS.SELECTING_SECTION_HEADERS);
    
    const userText = `アジェンダ: ${choice ? 'はい' : 'いいえ'}`;
    const systemText = '主要なセクションの前に区切りスライドを自動挿入しますか？';
    
    setMessages(prev => [
      ...prev,
      { type: 'user', text: userText, timestamp: new Date().toISOString() },
      { type: 'system', text: systemText, timestamp: new Date().toISOString() }
    ]);
    addLogEntry('UI_USER', 'handleAgendaChoice', userText);
    addLogEntry('UI_SYSTEM', 'handleAgendaChoice', systemText);
  };
  
  const handleSectionHeaderChoice = async (useSectionHeaders) => {
    const userText = `セクションヘダー: ${useSectionHeaders ? 'はい' : 'いえ'}`;
    setMessages(prev => [...prev, { type: 'user', text: userText, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_USER', 'handleSectionHeaderChoice', userText);
    
    setAppStatus(APP_STATUS.GENERATING_OUTLINE);
    setIsProcessing(true);
    setProcessingStatus('構成案を生成中...');
    setApiErrorStep(null);

    // 1. 待機時間を計算し、Stateにセット
    const calculatedWaitTime = Math.max(5000, Math.min(180000, structuredMarkdown.length * 1.4));    setCurrentTotalWaitTime(calculatedWaitTime);
    const stepWaitTime = calculatedWaitTime / 5; // 5ステップで分割

    // 2. APIコール (Promise)
    const prompt = PROMPTS.createOutline(structuredMarkdown, includeAgenda, useSectionHeaders, documentContext);
    const apiPromise = callGeminiApi(prompt, 'gemini-2.5-flash-lite', '構成案生成');

    // 3. ダミー進捗 (Promise)
    const dummyProgressPromise = (async () => {
      try {
        setThinkingState(OUTLINE_STEPS[0].key); // analyzing_doc
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));

        setThinkingState(OUTLINE_STEPS[1].key); // selecting_templates
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));

        setThinkingState(OUTLINE_STEPS[2].key); // creating_title_agenda
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));
        
        setThinkingState(OUTLINE_STEPS[3].key); // generating_content
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));
        
        setThinkingState(OUTLINE_STEPS[4].key); // formatting_json
        // 最後のステップの待機時間もきっちり待つ (要件2)
        await new Promise(resolve => setTimeout(resolve, stepWaitTime));
      } catch (e) {
        console.error("Dummy progress failed", e);
      }
    })();


    try {
      // 4. 両方の完了を待つ
      const [result] = await Promise.all([apiPromise, dummyProgressPromise]);

      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0); // Stateリセット
      
      if (result && !result.error) {
        // (ここから既存のJSONパース、サニタイズ、ルールチェックロジック)
        let outline;
        try {
          // 1. まず通常通りパースを試みる
          outline = JSON.parse(result);
          
        } catch (error) {
          // 2. パース失敗時
          // 報告された「Bad escaped character」エラーの場合
          if (error.message.includes('escaped character')) {
            console.warn('[WARN] JSON parse failed. Retrying with backslash fix...');
            try {
              // 3. バックスラッシュを強制的に二重エスケープして再試行
              const fixedResult = result.replace(/\\/g, '\\\\');
              outline = JSON.parse(fixedResult);
              // ユーザーに自動修正したことを通知
              const text = "【自動修正】AIの応答形式(エスケープ文字)を修正しました。";
              setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
              addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Parse)', text);
            } catch (fixError) {
               // 4. 修正してもパースに失敗した場合
               console.error('[FATAL] Backslash fix failed.', fixError);
               setApiErrorStep('outline');
               const text = `構成案の解析に失敗しました。AIの応答形式が不正です: ${error.message}`;
               setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
               addLogEntry('UI_SYSTEM_ERROR', 'handleSectionHeaderChoice (Parse Fix 1)', text);
               return; // ここで処理を中断
            }
          } 
          // ▼▼▼ 【NEW】「Bad control character」エラーの修復ロジック ▼▼▼
          else if (error.message.includes('Bad control character')) {
            console.warn('[WARN] JSON parse failed due to bad control character. Retrying with newline/tab fix...');
            try {
              // 3. 改行(\n), タブ(\t) などの制御文字を強制的に半角スペースに置換
              const fixedResult = result.replace(/[\n\r\t]/g, ' ');
              outline = JSON.parse(fixedResult);
              // ユーザーに自動修正したことを通知
              const text = "【自動修正】AIの応答形式(制御文字)を修正しました。改行が失われた可能性があります。";
              setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
              addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Parse)', text);
            } catch (fixError) {
               // 4. 修正してもパースに失敗した場合
               console.error('[FATAL] Control character fix failed.', fixError);
               setApiErrorStep('outline');
               const text = `構成案の解析に失敗しました。AIの応答形式が不正です: ${error.message}`;
               setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
               addLogEntry('UI_SYSTEM_ERROR', 'handleSectionHeaderChoice (Parse Fix 2)', text);
               return; // ここで処理を中断
            }
          } 
          // ▲▲▲ 修正ここまで ▲▲▲
          else {
             // 5. 上記以外のエラーの場合
             setApiErrorStep('outline');
             const text = `構成案の解析に失敗しました。AIの応答形式が不正です: ${error.message}`;
             setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
             addLogEntry('UI_SYSTEM_ERROR', 'handleSectionHeaderChoice (Parse)', text);
             return; // ここで処理を中断
          }
        }

        // --- パース成功時 (または修正成功時) の共通処理 ---

        // ▼▼▼ サニタイズ処理 (前回実装) ▼▼▼
        const sanitizedOutline = outline.map(slide => {
            const newSlide = { ...slide };

            // 1. 'content_basic' のサニタイズ (summary -> items)
            if (newSlide.template === 'content_basic') {
                if ((!newSlide.items || (Array.isArray(newSlide.items) && newSlide.items.length === 0)) && 
                    (newSlide.summary && typeof newSlide.summary === 'string' && newSlide.summary.trim().length > 0)) {
                    
                    // ▼▼▼ 修正: `Bad control character`対策で改行が失われている場合を考慮 ▼▼▼
                    // もし半角スペース区切りになっていたら、それを改行として扱う
                    // (ただし、summary が "item1 item2 item3" のようになることを想定)
                    const potentialItems = newSlide.summary.includes('\n')
                        ? newSlide.summary.split('\n')
                        : newSlide.summary.split(' '); // 改行がなければスペースで分割
                    
                    newSlide.items = potentialItems
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
                    // ▲▲▲ 修正ここまで ▲▲▲

                }
                newSlide.summary = ""; 
            }
            // 2. 構造化テンプレート (points, columns, table, steps) のサニタイズ
            
            // ▼▼▼ この 'else if' から 'table_basic' を削除 ▼▼▼
            else if (['three_points', 'comparison', 'vertical_steps'].includes(newSlide.template)) {
            // ▲▲▲ 修正点 ▲▲▲
                
                // ▼▼▼ 修正: highlighted_number をここから除外 ▼▼▼
                newSlide.summary = "";
            
            // ▼▼▼ この 'else if' に 'table_basic' を追加 ▼▼▼
            } else if (newSlide.template === 'table_basic' || newSlide.template === 'highlighted_number') {
                // table_basic と highlighted_number は summary を持つようになったため、summary が文字列であることを保証
                if (typeof newSlide.summary !== 'string') {
                    newSlide.summary = "";
                }
            }

            // 3. 'summary' ベースのテンプレートのサニタイズ (items -> summary)
            else if (['content_with_diagram', 'title_slide', 'agenda', 'summary_or_thankyou'].includes(newSlide.template)) {
                if ((!newSlide.summary || (typeof newSlide.summary === 'string' && newSlide.summary.trim().length === 0)) && 
                    (newSlide.items && Array.isArray(newSlide.items) && newSlide.items.length > 0)) {
                    
                    // ▼▼▼ 修正: こちらも同様に、半角スペース区切りを許容 ▼▼▼
                    const separator = newSlide.items.some(item => item.includes('\n')) ? '\n' : ' ';
                    newSlide.summary = newSlide.items.join(separator);
                    // ▲▲▲ 修正ここまで ▲▲▲
                }
                newSlide.items = null;
                newSlide.points = null;
                newSlide.columns = null;
                newSlide.table = null;
                if (typeof newSlide.summary !== 'string') {
                    newSlide.summary = "";
                }
            }
            // 4. コンテンツ不要のテンプレートのサニタイズ
            else if (newSlide.template === 'section_header') {
                newSlide.summary = "";
                newSlide.items = null;
                newSlide.points = null;
                newSlide.columns = null;
                newSlide.table = null;
            }

            return newSlide;
        });
        // ▲▲▲ サニタイズ処理ここまで ▲▲▲

        
        // ▼▼▼ 【NEW】リテラル改行コード（\\n）を本物の改行（\n）に置換する処理 ▼▼▼
        const newlineFixedOutline = sanitizeNewlines(sanitizedOutline);
        // ▲▲▲ 【NEW】ここまで ▲▲▲


        // ▼▼▼ 【NEW】highlighted_number ガードレール呼び出し ▼▼▼
        const { 
          sanitizedOutline: guardedOutline, 
          notification: guardNotification 
        } = sanitizeHighlightedNumbers(newlineFixedOutline);
        // ▲▲▲ 【NEW】ここまで ▲▲▲


        // ▼▼▼ ここからルールチェックと強制修正ロジック ▼▼▼
        let finalOutline = [...guardedOutline]; // ★修正: ガードレール適用済みのデータを使用

        // === 1. アジェンダのチェックと修正 ===
        const agendaMaxItems = 6;
        let hasAgenda = finalOutline.length > 1 && finalOutline[1].template === 'agenda';

        if (includeAgenda) {
          
          // ▼▼▼ 【NEW】アジェンダ分割ロジック ▼▼▼
          if (hasAgenda) {
            // 2枚目がアジェンダの場合、項目数チェックと分割を行う
            const targetAgenda = finalOutline[1];
            
            // ▼▼▼ 修正: `Bad control character`対策で改行が失われている場合を考慮 ▼▼▼
            // (summary が "item1 item2 item3" となっている可能性)
            const items = (targetAgenda.summary || '').includes('\n')
                ? (targetAgenda.summary || '').split('\n').filter(item => item.trim().length > 0)
                : (targetAgenda.summary || '').split(' ').filter(item => item.trim().length > 0);
            // ▲▲▲ 修正ここまで ▲▲▲

            if (items.length > agendaMaxItems) {
              // 1. 強制分割処理
              const totalParts = Math.ceil(items.length / agendaMaxItems);
              const newAgendaSlides = [];
              
              // AIがタイトルに(1/n)などを付けている可能性を考慮し、元のタイトルをベースにする
              const baseTitle = (targetAgenda.title || 'アジェンダ').replace(/\s*\(\d+\/\d+\)\s*$/, ''); // (1/2)などを削除

              for (let i = 0; i < totalParts; i++) {
                const partItems = items.slice(i * agendaMaxItems, (i + 1) * agendaMaxItems);
                newAgendaSlides.push({
                  ...targetAgenda, // 元スライドの情報をコピー (templateなど)
                  title: `${baseTitle} (${i + 1}/${totalParts})`,
                  
                  // ▼▼▼ 修正: agenda は改行区切りでなければならないため、join('\n') で結合 ▼▼▼
                  summary: partItems.join('\n'), 
                  // ▲▲▲ 修正ここまで ▲▲▲
                  
                  items: null, // アジェンダはsummaryのみ使用
                  points: null,
                  columns: null,
                  table: null,
                });
              }

              // 2. 元のアジェンダスライド(outline[1])を、分割したスライド群で置き換え
              finalOutline.splice(1, 1, ...newAgendaSlides);
              
              // 3. ユーザーに通知
              const text = "【自動修正】アジェンダの項目数が多いため、スライドを自動的に分割しました。";
              setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
              addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Agenda Split)', text);
            }
          }
          // ▲▲▲ アジェンダ分割ロジックここまで ▲▲▲

          // "はい" を選んだのに、無い場合 (分割チェック後も無い場合)
          // ※分割ロジックが実行された場合、hasAgendaはtrueなのでここは実行されない
          // ※分割ロジック実行後に hasAgenda を再評価する必要がある
          hasAgenda = finalOutline.length > 1 && finalOutline[1].template === 'agenda'; // ★再評価
          if (!hasAgenda) { 
              // 3枚目以降（インデックス1以降）のタイトルを収集して目次を作成
              const agendaItems = finalOutline
                  .slice(1) // 1枚目(title_slide)を除外
                  .map(slide => slide.title || '')
                  .filter(title => title.length > 0);

              // ★修正: 項目がない場合も考慮
              const newAgendaItems = (agendaItems.length > 0 ? agendaItems : ['（目次がありません）']);
              const totalParts = Math.ceil(newAgendaItems.length / agendaMaxItems);
              const newAgendaSlides = [];

              if (newAgendaItems.length === 0 || (newAgendaItems.length === 1 && newAgendaItems[0] === '（目次がありません）')) {
                // 項目がない場合は、空のアジェンダを1枚だけ作る
                 newAgendaSlides.push({
                    title: "アジェンダ",
                    summary: '（目次がありません）',
                    template: "agenda",
                    items: null, points: null, columns: null, table: null,
                });
              } else {
                // 項目がある場合は分割する
                for (let i = 0; i < totalParts; i++) {
                  const partItems = newAgendaItems.slice(i * agendaMaxItems, (i + 1) * agendaMaxItems);
                  newAgendaSlides.push({
                    title: `アジェンダ${totalParts > 1 ? ` (${i + 1}/${totalParts})` : ''}`, // 1枚の時は(1/1)を付けない
                    summary: partItems.join('\n'),
                    template: "agenda",
                    items: null, points: null, columns: null, table: null,
                  });
                }
              }

              // 2枚目（インデックス 1）に強制挿入
              finalOutline.splice(1, 0, ...newAgendaSlides);
              
              const text = "【自動修正】AIがアジェンダを生成しなかったため、2枚目に自動挿入しました。";
              setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
              addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Agenda Add)', text);
          }
        } else {
            // "いいえ" を選んだのに、有る場合
            if (hasAgenda) { // 2枚目がアジェンダだったら、という元のロジック
                // 2枚目のアジェンダを削除
                finalOutline.splice(1, 1);
                const text = "【自動修正】AIが不要なアジェンダを生成したため、2枚目から削除しました。";
                setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
                addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Agenda Remove)', text);
            }
            // 念のため、2枚目以外のアジェンダも削除（1枚目は除く）
            finalOutline = finalOutline.filter((slide, index) => index === 0 || slide.template !== 'agenda');
        }

        // === 2. 表 (table_basic) のチェックと修正 ===
        const maxTableRows = 7;
        let tableSplitOccurred = false;

        // flatMap を使って配列を走査し、必要に応じてスライドを置き換える
        // (アジェンダチェック後の finalOutline を更新する)
        finalOutline = finalOutline.flatMap(slide => {
          // 分割条件を満たしているかチェック
          if (slide.template === 'table_basic' &&
              slide.table &&
              Array.isArray(slide.table.rows) &&
              slide.table.rows.length > maxTableRows) 
          {
            tableSplitOccurred = true; // 分割が発生したことを記録
            
            const originalHeaders = slide.table.headers || [];
            const originalRows = slide.table.rows;
            const totalParts = Math.ceil(originalRows.length / maxTableRows);
            
            // AIがタイトルに(1/n)などを付けている可能性を考慮し、元のタイトルをベースにする
            const baseTitle = (slide.title || '表').replace(/\s*\(\d+\/\d+\)\s*$/, ''); // (1/2)などを削除

            const newTableSlides = [];

            for (let i = 0; i < totalParts; i++) {
              const partRows = originalRows.slice(i * maxTableRows, (i + 1) * maxTableRows);
              
              newTableSlides.push({
                ...slide, // 元スライドの情報をコピー (templateなど)
                title: `${baseTitle} (${i + 1}/${totalParts})`,
                table: {
                  headers: originalHeaders, // ヘッダーは全スライドで共通
                  rows: partRows
                },
                summary: "", // table_basic のルール
                items: null,
                points: null,
                columns: null,
              });
            }
            
            return newTableSlides; // 元の1枚の代わりに、分割したスライド配列を返す

          } else {
            // 条件外のスライドはそのまま返す
            return [slide]; 
          }
        });

        // ユーザーに通知
        if (tableSplitOccurred) {
          const text = "【自動修正】表の行数が多いため、スライドを自動的に分割しました。";
          setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
          addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Table Split)', text);
        }

        // === 3. セクションヘッダーのチェックと修正 ===
        const hasSectionHeaders = finalOutline.some(slide => slide.template === 'section_header');
        
        if (useSectionHeaders) {
            // "はい" を選んだのに、無い場合
            if (!hasSectionHeaders) {
                // 警告を出す
                const text = "【警告】セクションヘッダーの自動挿入（はい）を選択しましたが、AIが構成案に含めなかった可能性があります。構成案を確認してください。";
                setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
                addLogEntry('UI_SYSTEM_WARN', 'handleSectionHeaderChoice (Section Header)', text);
            }
        } else {
            // "いいえ" を選んだのに、有る場合
            if (hasSectionHeaders) {
                // 1枚目（title_slide）以外で、section_header を全て削除
                finalOutline = finalOutline.filter((slide, index) => index === 0 || slide.template !== 'section_header');
                const text = "【自動修正】AIが不要なセクションヘダーを生成したため、構成案から削除しました。";
                setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
                addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Section Header)', text);
            }
        }
        // ▲▲▲ ルールチェックここまで ▲▲▲

        setSlideOutline(finalOutline); // ← ルールチェック済みのデータをセット
        setAppStatus(APP_STATUS.OUTLINE_CREATED);

        // ▼▼▼ 【NEW】ガードレールの通知（もしあれば）を最後に追加 ▼▼▼
        if (guardNotification) {
          setMessages(prev => [...prev, { type: 'system', text: guardNotification, timestamp: new Date().toISOString() }]);
          addLogEntry('SYSTEM_AUTO_FIX', 'handleSectionHeaderChoice (Guardrail)', guardNotification);
        }
        // ▲▲▲ 【NEW】ここまで ▲▲▲

        // 構成案が生成されたことを示すメインのメッセージは最後に表示
        const text = "構成案を生成しました。内容を確認・編集してください。";
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM', 'handleSectionHeaderChoice (Success)', text);

      } else {
        // エラーハンドリング (callGeminiApi自体のエラー)
        setApiErrorStep('outline');
        const text = result ? result.error : '予期せずエラーが発生しました。';
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM_ERROR', 'handleSectionHeaderChoice (API)', text);
      }
    } catch (error) {
      // (JSONパースエラーなどは既存のロジックで捕捉されるため、ここではシミュレーション自体のエラーを捕捉)
      console.error("[FATAL] Error during outline progress simulation:", error);
      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0);
      setApiErrorStep('outline');
      const text = `予期せぬエラーが発生しました: ${error.message}`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_FATAL', 'handleSectionHeaderChoice (Catch)', text);
    }
    // [ここまで変更]
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

  const handleRegenerateOutline = () => {
    if (window.confirm('現在の構成案を破棄し、最初から再生成します。よろしいですか？')) {
      const text = '構成案の再生成をリクエストしました。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleRegenerateOutline', text);
      
      // メッセージ履歴からセクションヘッダーの最後の選択を取得
      const lastChoiceText = messages.slice().reverse().find(m => m.type === 'user' && m.text.includes('セクションヘッダー:'))?.text;
      const useSectionHeaders = lastChoiceText ? lastChoiceText.includes('はい') : false; // 見つからなければデフォルトで 'いいえ'
      
      // 構成案生成のトリガーとなる関数を再度呼び出す
      handleSectionHeaderChoice(useSectionHeaders);
    }
  };

  const handleRegenerateSlideContent = async (slideIndex) => {
    setIsProcessing(true);
    setProcessingStatus('スライド内容を再生成中...');
    
    const targetSlide = slideOutline[slideIndex];
    const { title, template: newTemplateName } = targetSlide;

    // 元データを準備（title, template, infographic 以外）
    const originalData = { ...targetSlide };
    delete originalData.title;
    delete originalData.template;
    // infographic はAIに再生成させるため、元データからは除外（ただし content_with_diagram の場合は description を活かす）
    if (newTemplateName !== 'content_with_diagram') {
         delete originalData.infographic;
    }

    // 利用可能なテンプレートの情報をAIに渡す
    const availableTemplates = [
      { name: 'content_basic', description: '`items` (文字列配列) が必要。`summary`は空にする。' },
      { name: 'three_points', description: '`points` (3要素のオブジェクト配列) が必要。`summary`は空にする。' },
      { name: 'vertical_steps', description: '`items` (オブジェクト配列) が必要。`summary`は空にする。' },
      { name: 'comparison', description: '`columns` (2要素のオブジェクト配列) が必要。`summary`は空にする。' },
      { name: 'table_basic', description: '`table` ({headers: [...], rows: [...]}) が必要。`summary`は空にする。' }, 
      { name: 'math_basic', description: '`summary` (解説文) と `formula` (KaTeX数式) が必要。' }, 
      { name: 'content_with_diagram', description: '`summary` (本文) が必要。必要なら `infographic` も生成。' },
      { name: 'agenda', description: '`summary` (改行区切りのリスト) が必要。' },
      { name: 'title_slide', description: '`summary` (サブタイトル) が必要。' },
      { name: 'section_header', description: 'コンテンツ不要。`summary`は空にする。' },
      { name: 'summary_or_thankyou', description: '`summary` (補足) が必要。' },
    ];
    
    const prompt = PROMPTS.regenerateSlideContent(
      title,
      Object.keys(originalData).length > 0 ? JSON.stringify(originalData) : '{}',
      newTemplateName,
      availableTemplates
    );

    const result = await callGeminiApi(prompt, 'gemini-2.5-flash-lite', `スライド${slideIndex + 1}内容再生成`);
    
    if (result && !result.error) {
      try {
        const newContent = JSON.parse(result);
        
        // 新しい内容でスライドを更新
        setSlideOutline(prevOutline => {
          const newOutline = [...prevOutline];
          const updatedSlide = { ...newOutline[slideIndex] };

          // 1. 他のテンプレートの主要データをリセット
          if (newTemplateName !== 'content_basic') updatedSlide.items = null;
          if (newTemplateName !== 'three_points') updatedSlide.points = null;
          if (newTemplateName !== 'comparison') updatedSlide.columns = null;
          if (newTemplateName !== 'table_basic') updatedSlide.table = null; 

          // 2. AIが生成した新しいデータをマージ
          Object.assign(updatedSlide, newContent);

          // 3. テンプレートのルールに基づき、不要なデータを最終クリーンアップ
          if (['content_basic', 'three_points', 'comparison', 'vertical_steps', 'section_header', 'table_basic'].includes(newTemplateName)) {
            updatedSlide.summary = ""; // これらのテンプレートは summary を持たない
          }
          if (newTemplateName !== 'math_basic') { // ★追加
             updatedSlide.formula = null;
          }
          if (newTemplateName !== 'content_with_diagram') {
             // content_with_diagram 以外は infographic をリセット（AIが生成した場合を除く）
             if (!newContent.infographic) {
                updatedSlide.infographic = null;
             }
          }

          newOutline[slideIndex] = updatedSlide;
          return newOutline;
        });

        const text = `スライド ${slideIndex + 1} の内容を ${newTemplateName} 形式で再生成しました。`;
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM', 'handleRegenerateSlideContent', text);
        
      } catch (error) {
        const text = `内容の解析に失敗しました: ${error.message}`;
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM_ERROR', 'handleRegenerateSlideContent (Parse)', text);
      }
    } else {
      const text = result ? result.error : '内容の再生成中にエラーが発生しました。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleRegenerateSlideContent (API)', text);
    }
    
    setIsProcessing(false);
  };

  const handleOpenModifyModal = (index) => {
    setModifyModalTarget({ index: index, mode: 'single' });
    setModificationInput('');
    setIsModifyModalOpen(true);
  };

  const handleOpenModifyAllModal = () => {
    setModifyModalTarget({ index: null, mode: 'all' });
    setModificationInput('');
    setIsModifyModalOpen(true);
  };

  const handleCloseModifyModal = () => {
    setIsModifyModalOpen(false);
    setModificationInput('');
  };

  /**
   * 数式モーダルを開くハンドラ
   */
  const handleOpenMathModal = (index) => {
    const currentFormula = slideOutline[index]?.formula || '';
    setMathModalTargetIndex(index);
    setTempMathFormula(currentFormula); // 現在の数式を一時Stateにセット
    setIsMathModalOpen(true);
  };

  /**
   * 数式モーダルを保存するハンドラ
   */
  const handleSaveMathModal = () => {
    if (mathModalTargetIndex !== null) {
      // 一時Stateの値を、slideOutline本体に反映
      handleOutlineChange(mathModalTargetIndex, 'formula', tempMathFormula);
    }
    // モーダルを閉じてStateをリセット
    setIsMathModalOpen(false);
    setMathModalTargetIndex(null);
    setTempMathFormula('');
  };

  /**
   * 数式モーダルをキャンセルするハンドラ
   */
  const handleCancelMathModal = () => {
    // 保存せずにモーダルを閉じてStateをリセット
    setIsMathModalOpen(false);
    setMathModalTargetIndex(null);
    setTempMathFormula('');
  };

  const handleSubmitModification = async () => {
    const { index, mode } = modifyModalTarget;

    if (!modificationInput.trim()) {
      handleCloseModifyModal();
      return;
    }

    setIsProcessing(true);
    setApiErrorStep(null);
    let resultJson = null;

    if (mode === 'all') {
      setProcessingStatus('構成案全体を修正中...');
      const prompt = PROMPTS.modifyFullOutline(JSON.stringify(slideOutline, null, 2), modificationInput);
      resultJson = await callGeminiApi(prompt, 'gemini-2.5-flash-lite', '構成案全体修正');
    } else if (mode === 'single' && index !== null) {
      setProcessingStatus(`スライド ${index + 1} を修正中...`);
      const prompt = PROMPTS.modifySingleSlideOutline(JSON.stringify(slideOutline[index], null, 2), modificationInput);
      resultJson = await callGeminiApi(prompt, 'gemini-2.5-flash-lite', `スライド${index + 1}修正`);
    }

    if (resultJson && !resultJson.error) {
      try {
        const parsedResult = JSON.parse(resultJson);
        let text = '';
        if (mode === 'all') {
          setSlideOutline(parsedResult);
          text = '構成案全体を修正しました。';
        } else if (mode === 'single' && index !== null) {
          setSlideOutline(prevOutline => {
            const newOutline = [...prevOutline];
            newOutline[index] = parsedResult;
            return newOutline;
          });
          text = `スライド ${index + 1} を修正しました。`;
        }
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM', 'handleSubmitModification', text);
      } catch (error) {
        const text = `修正結果の解析に失敗しました: ${error.message}`;
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM_ERROR', 'handleSubmitModification (Parse)', text);
      }
    } else {
      const text = resultJson ? resultJson.error : '修正中にエラーが発生しました。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleSubmitModification (API)', text);
    }
    
    setIsProcessing(false);
    handleCloseModifyModal();
  };

  const handleReturnToOutline = () => {
    if (window.confirm('現在のスライドプレビューを破棄し、構成案の編集画面に戻ります。\nこれまでに承認したスライドは保持されます。\n\nよろしいですか？')) {
      setCurrentSlideHtml(''); // 現在のプレビューを破棄
      setAppStatus(APP_STATUS.OUTLINE_CREATED); // 構成案編集モードに戻る
      const text = "構成案の編集に戻りました。編集完了後、「構成案を承認し、スライド生成を開始する」ボタンを押してください。";
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleReturnToOutline', text);
    }
  };

  const handleStartGeneration = () => {
    const newOutline = slideOutline; // ユーザーが編集した後の最新の構成案
    const currentGeneratedCount = generatedSlides.length; // 現在承認済みのスライド数

    let restartIndex = currentGeneratedCount; // デフォルトは「続きから」

    // --- 差分検出ロジック ---
    // 承認済みのスライド（0 〜 currentGeneratedCount-1）に変更がないかチェック
    for (let i = 0; i < currentGeneratedCount; i++) {
      // スナップショット（変更前）と最新の構成案（変更後）をJSON文字列で比較
      // (approvedOutlineSnapshot[i] が存在しないケースも考慮)
      const oldSlideJSON = approvedOutlineSnapshot[i] ? JSON.stringify(approvedOutlineSnapshot[i]) : null;
      const newSlideJSON = newOutline[i] ? JSON.stringify(newOutline[i]) : null;

      if (oldSlideJSON !== newSlideJSON) {
        // 変更を検出！
        restartIndex = i; // 最も早い変更箇所を記録
        break; // ループを抜ける
      }
    }

    // --- 巻き戻し処理 ---
    if (restartIndex < currentGeneratedCount) {
      // 過去のスライドに変更があった場合
      const text = `[INFO] スライド ${restartIndex + 1} の構成案に変更が検出されたため、${restartIndex + 1} 枚目以降のスライドを再生成します。`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('SYSTEM_EVENT', 'handleStartGeneration (Diff)', text);
      
      // 承認済みHTML配列を、変更箇所の直前まで巻き戻す
      setGeneratedSlides(prevSlides => prevSlides.slice(0, restartIndex));
    }
    
    // --- スナップショットの更新と生成再開 ---
    
    // 1. スナップショットを「最新の構成案」で丸ごと更新する
    //    (過去の変更も、未来の変更もすべてこれが「正」となる)
    setApprovedOutlineSnapshot([...newOutline]);
    
    // 2. Stateを更新
    setCurrentSlideIndex(restartIndex);
    // setAppStatus(APP_STATUS.GENERATING_SLIDES); // ← generateSlide内で設定されるため不要

    // 3. 生成を再開
    if (restartIndex < newOutline.length) {
      // 未生成のスライドがまだある場合
      const text = `構成案承認済。\n**ステップ2: スライド生成**\n（スライド ${restartIndex + 1} から）生成を再開します。`;
      setMessages(prev => [...prev.filter(m => m.type !== 'system'), { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleStartGeneration', text);
      generateSlide(restartIndex);
    } else {
      // 編集の結果、全スライドが承認済みになった（例：末尾を削除した）場合
      setAppStatus(APP_STATUS.ALL_SLIDES_GENERATED);
      const text = "構成案の編集が完了し、全てのスライドが承認済みです。\nZIPファイルをダウンロードできます。";
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleStartGeneration (All Done)', text);
    }
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

      // ▼▼▼ 【NEW】 KaTeXフォールバック処理 (Summary) ▼▼▼
      if (currentSlide.template === 'math_basic' && currentSlide.summary) {
        // summary内に $...$ や $$...$$ が含まれていないかチェック
        const katexRegex = /(\$\$[\s\S]*?\$\$|\$[^\n$]*?\$)/g;
        if (katexRegex.test(currentSlide.summary)) {
            const logContext = `Slide ${slideIndex + 1} (math_basic_summary_fix)`;
            const errorMsg = "[WARN] math_basic 'summary' contains KaTeX symbols. AI violated constraints. Stripping symbols...";
            console.warn(errorMsg, { context: logContext, originalSummary: currentSlide.summary });
            
            addLogEntry('DEBUG_WARN', logContext, {
                message: errorMsg,
                originalSummary: currentSlide.summary
            });
            
            // $...$ や $$...$$ のパターン全体を「 以下の数式 」に置換する
            currentSlide.summary = currentSlide.summary.replace(katexRegex, ' 以下の数式 '); 
        }
      }
      // ▲▲▲ KaTeXフォールバック処理ここまで ▲▲▲

      /**
       * AIが生成したMarkdown文字列をサニタイズする
       * 1. AIによる誤ったエスケープ（例: \**）を削除
       * 2. 太字対象の文字列（**...**の中身）を抽出して返す
       * @returns {{cleanedText: string, boldedItems: string[]}}
       */
      const sanitizeMarkdown = (text) => {
        if (typeof text !== 'string' || !text) {
          return { cleanedText: '', boldedItems: [] };
        }
        
        let cleaned = text;
        
        // 1. AIによる誤ったエスケープ（例: \** や \\**）を強制解除
        cleaned = cleaned.replace(/\\+([*_~`$])/g, '$1');
        
        // 2. 太字部分を抽出する
        // (スペース挿入ロジックは削除し、元の正規表現に戻す)
        const boldedItems = [];
        const boldMatches = cleaned.matchAll(/\*\*(.*?)\*\*/g); 
        for (const match of boldMatches) {
          if (match[1] && match[1].trim().length > 0) {
            boldedItems.push(match[1].trim());
          }
        }

        return { cleanedText: cleaned, boldedItems };
      };

      /**
       * Markdownをパースし、期待される太字がHTMLに反映されているか検証・ログ出力する
       * @param {string} rawMarkdown - サニタイズ前のMarkdownテキスト
       * @param {object} options - { isInline: boolean, breaks: boolean, context: string }
       * @returns {string} パース後のHTML文字列
       */
      const parseMarkdownAndVerifyBold = (rawMarkdown, options) => {
        const { isInline = false, breaks = false, context = 'Unknown' } = options;
        
        // 1. サニタイズ実行
        const { cleanedText, boldedItems: expectedBoldItems } = sanitizeMarkdown(rawMarkdown || '');
        
        // 2. marked.js でパース実行
        const parser = isInline
          ? (text) => marked.parseInline(text) // parseInline はオプションを受け取らない
          : (text) => marked.parse(text, { breaks }); // parse はオプションを受け取る
        
        let parsedHtml = parser(cleanedText); // ★ let に変更
        
        // 3. 検証 (期待される太字リストがある場合のみ)
        if (expectedBoldItems.length > 0) {
          let allConverted = true;
          const failedItems = [];

          for (const item of expectedBoldItems) {
            // HTMLエンティティ（例: ' -> &#39;）をデコードしてから比較
            const decodedHtml = parsedHtml
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&');
            
            // <strong>タグで囲まれているかチェック
            if (!decodedHtml.includes(`<strong>${item}</strong>`)) {
              allConverted = false;
              failedItems.push(item);
            }
          }

          // 4. ログ出力 と ★【NEW】フォールバック処理★
          const logContext = `Slide ${slideIndex + 1} (${context})`;

          if (allConverted) {
            // 成功時
            const successMsg = `[SUCCESS] Bold conversion OK. Items: [${expectedBoldItems.join(', ')}]`;
            console.log(successMsg);
            addLogEntry('DEBUG_SUCCESS', logContext, successMsg);
          } else {
            // 失敗時
            const errorContext = {
              message: `[FAILED] Bold conversion error. Failed items: [${failedItems.join(', ')}]`,
              failedItems: failedItems,
              expectedItems: expectedBoldItems,
              cleanedText: cleanedText,
              parsedHtmlBeforeFallback: parsedHtml, // ★修正前のHTMLを記録
              rawInput: rawMarkdown
            };
            const errorMsgForConsole = `[FAILED] Bold conversion error. Failed items: [${failedItems.join(', ')}]. Applying fallback...`;
            
            console.warn(errorMsgForConsole, errorContext); // ★ErrorからWarnに変更
            addLogEntry('DEBUG_WARN', logContext, errorContext); // ★ErrorからWarnに変更

            // --- ★【NEW】フォールバック（強制置換）処理 ---
            let fallbackHtml = parsedHtml;
            
            // 正規表現で使われる可能性のある文字をエスケープするヘルパー関数
            const escapeRegExp = (string) => {
              return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            };

            for (const itemToFix of failedItems) {
              // 失敗した項目（例: "98%"）の、生のMarkdown記法（例: "**98%**"）を検索
              // cleanedText ではなく fallbackHtml に対して置換を行う
              
              // 1. `**item**` の形式（スペースなし）
              const regexNoSpace = new RegExp(escapeRegExp(`**${itemToFix}**`), 'g');
              fallbackHtml = fallbackHtml.replace(regexNoSpace, `<strong>${itemToFix}</strong>`);
              
              // 2. `** item **` の形式（marked.jsが内部で追加したスペースの残骸）
              const regexWithSpace = new RegExp(escapeRegExp(`** ${itemToFix} **`), 'g');
              fallbackHtml = fallbackHtml.replace(regexWithSpace, `<strong>${itemToFix}</strong>`);
            }
            
            // 置換後のHTMLを最終結果として採用
            parsedHtml = fallbackHtml;
            // --- フォールバック処理ここまで ---
          }
        }
        
        // 5. パース結果（またはフォールバック後の結果）を返す
        return parsedHtml;
      };

      const replacements = {
        '{theme_class}': `theme-${design}`,
        '{title}': currentSlide.title || '',
        
        '{summary}': parseMarkdownAndVerifyBold(currentSlide.summary || '', {
          isInline: true,
          breaks: true,
          context: 'summary'
        }),
        '{content}': parseMarkdownAndVerifyBold(currentSlide.summary || '', {
          isInline: false,
          breaks: true,
          context: 'content (from summary)'
        }),
        
        '{number}': currentSlide.number || '', 
        
        '{description}': parseMarkdownAndVerifyBold(currentSlide.description || '', {
          isInline: true,
          breaks: true,
          context: 'description'
        }),
        '{content_title}': parseMarkdownAndVerifyBold(currentSlide.content_title || '', {
          isInline: true,
          breaks: true,
          context: 'content_title'
        }), 

        // --- 既存のプレースホルダー（初期値） ---
        '{formula}': '', 
        '{infographic_svg}': '',
        '{agenda_items_html}': '',
        '{items_html}': '',
        '{comparison_columns_html}': '',
        '{table_html}': '',
        '{chart_data_json}': '{}', 
      };
      
      if (currentSlide.infographic?.needed) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const svgPrompt = PROMPTS.generateInfographic(
          currentSlide.infographic.description,
          design 
        );
        
        const infographicSvgResult = await callGeminiApi(svgPrompt, 'gemini-2.5-flash-lite', `SVG for Slide ${slideIndex + 1}`);

        if (!infographicSvgResult || infographicSvgResult.error) {
          const errorMessage = infographicSvgResult?.error || "インフォグラフィックSVGの生成に失敗しました。";
          console.error(errorMessage);
          throw new Error(errorMessage); 
        }
        
        const sanitizedSvg = sanitizeSvg(infographicSvgResult);
        replacements['{infographic_svg}'] = sanitizedSvg;
      }

      if (['three_points'].includes(currentSlide.template) && Array.isArray(currentSlide.points)) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));

        const iconPromises = currentSlide.points.map(point => {
          return getIconSvg(point); 
        });

        const iconSvgs = await Promise.all(iconPromises);
        
        currentSlide.points.forEach((point, i) => {
            const { cleanedText: cleanPointTitle } = sanitizeMarkdown(point.title || '');
            
            replacements[`{point_${i + 1}_title}`] = cleanPointTitle;
            replacements[`{point_${i + 1}_summary}`] = parseMarkdownAndVerifyBold(point.summary || '', {
              isInline: true,
              breaks: true,
              context: `point_${i + 1}_summary`
            });
            replacements[`{icon_${i + 1}_svg}`] = iconSvgs[i] || ``;
        });
      }

      if (currentSlide.template === 'agenda') {
        const agendaItems = currentSlide.summary.split('\n').map((item, i) => {
          const textOnly = item.replace(/^\s*\d+\.\s*/, '');
          return `<li>${parseMarkdownAndVerifyBold(textOnly || '', {
            isInline: true,
            breaks: true,
            context: `agenda_item_${i + 1}`
          })}</li>`;
        }).join('');
        replacements['{agenda_items_html}'] = agendaItems;
      }

      // ▼▼▼ 【NEW】 KaTeXフォールバック処理 (Formula) ▼▼▼
      if (currentSlide.template === 'math_basic' && currentSlide.formula) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));

        // KaTeXパーサーのセットアップ
        const markedWithKatex = new Marked();
        markedWithKatex.use(markedKatex({
          throwOnError: false
        }));
        
        let formulaString = (currentSlide.formula || '');
        let extractedFormula = '';
        const logContext = `Slide ${slideIndex + 1} (math_basic_formula_fix)`;

        // 1. ブロック数式 ($$ ... $$) を最優先で探す
        const blockMatch = formulaString.match(/\$\$([\s\S]*?)\$\$/);
        
        if (blockMatch && blockMatch[1]) {
            extractedFormula = blockMatch[1].trim(); // 中身だけ抽出
            
            // もし $$ が2個より多い（＝複数ブロックやゴミがある）場合、警告
            if (formulaString.match(/\$\$/g).length > 2) { 
                const warnMsg = "[WARN] Multiple KaTeX blocks or extra text found in 'formula'. Using only the first block.";
                console.warn(warnMsg, { context: logContext, original: formulaString });
                addLogEntry('DEBUG_WARN', logContext, { message: warnMsg, original: formulaString });
            }
        } else {
            // 2. ブロックがない場合、インライン ($ ... $) を探す
            const inlineMatch = formulaString.match(/\$([^\n$]*?)\$/);
            if (inlineMatch && inlineMatch[1]) {
                extractedFormula = inlineMatch[1].trim(); // 中身だけ抽出
                const warnMsg = "[WARN] Only inline KaTeX ($...$) found in 'formula'. Upgrading to block formula ($$...$$).";
                console.warn(warnMsg, { context: logContext, original: formulaString });
                addLogEntry('DEBUG_WARN', logContext, { message: warnMsg, original: formulaString });
            } else {
                // 3. $ も $$ もない場合 (AIの完全なミス)
                //   （例: "y = x + 1" のようにデリミタを忘れた）
                extractedFormula = formulaString.replace(/\n/g, ' '); // 既存の改行除去のみ行う
                const warnMsg = "[WARN] No valid KaTeX delimiters ($ or $$) found in 'formula'. Attempting to render as is.";
                console.warn(warnMsg, { context: logContext, original: formulaString });
                addLogEntry('DEBUG_WARN', logContext, { message: warnMsg, original: formulaString });
            }
        }
        
        // 4. 抽出した数式を $$ でラップし直し、パースする
        //    (extractedFormula が空でも " $$  $$ " がパースされるだけなので安全)
        const finalFormulaBlock = `$$ ${extractedFormula} $$`;
        
        replacements['{formula}'] = markedWithKatex.parse(finalFormulaBlock, { breaks: false });
      }
      // ▲▲▲ KaTeXフォールバック処理ここまで ▲▲▲
      
      if (['vertical_steps', 'content_basic'].includes(currentSlide.template) && Array.isArray(currentSlide.items)) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));

        let itemsHtml = '';
        if(currentSlide.template === 'vertical_steps') {
          itemsHtml = currentSlide.items.map((item, i) => {
            const { cleanedText: cleanTitle } = sanitizeMarkdown(item.title || '');
            
            return `
              <div class="step">
                <div class="step-marker">${i + 1}</div>
                <h2>${cleanTitle}</h2>
                <p>${parseMarkdownAndVerifyBold(item.description || '', {
                  isInline: true,
                  breaks: true,
                  context: `step_${i + 1}_description`
                })}</p> 
              </div>
            `;
          }).join('');
        } else if (currentSlide.template === 'content_basic') {
          itemsHtml = currentSlide.items.map((item, i) => {
            const trimmedItem = item || '';
            const leadingSpaces = trimmedItem.match(/^(\s*)/)[0].length;
            
            let textContent = trimmedItem.trim();
            textContent = textContent.replace(/^([\*\-\・\●\■]|(\d+\.)|[a-z]\.)\s*/, ''); 
            
            const indentLevel = Math.floor(leadingSpaces / 2);
            const indentStyle = indentLevel > 0 ? `style="margin-left: ${indentLevel * 2}em;"` : '';
            
            return `<li data-level="${indentLevel}" ${indentStyle}>${parseMarkdownAndVerifyBold(textContent || '', {
              isInline: true,
              breaks: true,
              context: `item_${i + 1}`
            })}</li>`;
          }).join('');
        }
        replacements['{items_html}'] = itemsHtml;
      }

      if (currentSlide.template === 'comparison' && Array.isArray(currentSlide.columns)) {
        const columnsHtml = currentSlide.columns.map((column, i) => {
            const { cleanedText: title } = sanitizeMarkdown(column.title || '');
            
            const itemsHtml = Array.isArray(column.items)
                ? column.items.map((item, j) => {
                  return `<li>${parseMarkdownAndVerifyBold(item || '', {
                    isInline: true,
                    breaks: true,
                    context: `column_${i + 1}_item_${j + 1}`
                  })}</li>`
                }).join('')
                : '';
                
            return `
                <div class="column">
                    <h2>${title}</h2>
                    <ul>${itemsHtml}</ul>
                </div>
            `;
        }).join('');

        replacements['{comparison_columns_html}'] = columnsHtml;
      }

      if (currentSlide.template === 'table_basic' && currentSlide.table) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));

        let tableHtml = '<thead><tr>';
        if (Array.isArray(currentSlide.table.headers)) {
          tableHtml += currentSlide.table.headers.map((header, i) => {
            return `<th>${parseMarkdownAndVerifyBold(header || '', {
              isInline: true,
              breaks: true,
              context: `table_header_${i + 1}`
            })}</th>`
          }).join(''); 
        }
        tableHtml += '</tr></thead>';
        
        tableHtml += '<tbody>';
        if (Array.isArray(currentSlide.table.rows)) {
          tableHtml += currentSlide.table.rows.map((row, i) => {
            let rowHtml = '<tr>';
            rowHtml += row.map((cell, j) => {
              return `<td>${parseMarkdownAndVerifyBold(cell || '', {
                isInline: true,
                breaks: true,
                context: `table_row_${i + 1}_cell_${j + 1}`
              })}</td>`
            }).join(''); 
            rowHtml += '</tr>';
            return rowHtml;
          }).join('');
        }
        tableHtml += '</tbody>';
        
        replacements['{table_html}'] = tableHtml;
      }

      if (currentSlide.template === 'bar_chart' && currentSlide.chart_data) {
        setThinkingState('designing');
        await new Promise(resolve => setTimeout(resolve, 800));

        const logContext = `Slide ${slideIndex + 1} (bar_chart)`;
        const data = currentSlide.chart_data;

        // 1. 処理開始ログ (AIから渡された生データを記録)
        const startMsg = '[START] bar_chart processing started.';
        console.log(startMsg, { context: logContext, receivedData: data }); // ★ブラウザログ
        addLogEntry('DEBUG_INFO', logContext, {
          message: startMsg,
          receivedData: data
        });

        // 2. データ構造の検証
        const isValid = data && 
                        Array.isArray(data.labels) && 
                        Array.isArray(data.datasets) && 
                        data.datasets.length > 0 &&
                        data.datasets[0] && // 
                        Array.isArray(data.datasets[0].data);

        if (!isValid) {
          // 2a. データ構造が不正な場合のログ
          const errorMsg = '[FAILED] Invalid chart_data structure received from AI.';
          console.error(errorMsg, { context: logContext, receivedData: data }); // ★ブラウザログ
          addLogEntry('DEBUG_ERROR', logContext, {
            message: errorMsg,
            receivedData: data
          });
          // エラーだが処理は続行（空のグラフが表示される）
          replacements['{chart_data_json}'] = '{}';
        } else {
          // 2b. データ構造が有効な場合のログ
          const validMsgData = {
            message: '[VALID] chart_data structure is valid.',
            labelsCount: data.labels.length,
            datasetsCount: data.datasets.length,
            firstDatasetDataCount: data.datasets[0].data.length
          };
          console.log(validMsgData.message, { context: logContext, details: validMsgData }); // ★ブラウザログ
          addLogEntry('DEBUG_INFO', logContext, validMsgData);

          // 3. JSON文字列化の試行
          try {
            const dataString = JSON.stringify(data)
                                   .replace(/</g, '\\u003c')
                                   .replace(/>/g, '\\u003e');
                                   
            replacements['{chart_data_json}'] = dataString;

            // 3a. JSON文字列化 成功ログ
            const successMsgData = {
              message: '[SUCCESS] JSON.stringify successful.',
              stringLength: dataString.length,
              preview: dataString.substring(0, 100) + '...' // 文字列の冒頭を記録
            };
            console.log(successMsgData.message, { context: logContext, details: successMsgData }); // ★ブラウザログ
            addLogEntry('DEBUG_SUCCESS', logContext, successMsgData);
            
          } catch (error) {
            // 3b. JSON文字列化 失敗ログ
            const errorMsg = `[FAILED] JSON.stringify failed. ${error.message}`;
            console.error(errorMsg, { context: logContext, error: error, receivedData: data }); // ★ブラウザログ
            addLogEntry('DEBUG_ERROR', logContext, {
              message: errorMsg,
              error: error,
              receivedData: data
            });
            // プレースホルダーは初期値 '{}' のまま
          }
        }
      }

      setThinkingState('coding');
      await new Promise(resolve => setTimeout(resolve, 800));

      finalHtml = Object.entries(replacements).reduce((acc, [key, value]) => {
          const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          return acc.replace(regex, value);
      }, template);

      const text = `スライド「${currentSlide.title}」が生成されました。\nプレビューで確認し、承認してください。`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'generateSlide', text);

    } catch (error) {
        console.error("Slide generation failed:", error);
        finalHtml = '';
        const text = `スライド生成に失敗しました: ${error.message}。「承認して次へ」ボタンで再試行できます。`;
        setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
        addLogEntry('UI_SYSTEM_ERROR', 'generateSlide (Catch)', text);
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
                setMessages(prev => [...prev, { type: 'system', text: changesMessage, timestamp: new Date().toISOString() }]);
                addLogEntry('UI_SYSTEM', 'modifySlide', changesMessage);
            } else {
                 throw new Error("Invalid JSON structure from API.");
            }
        } catch (error) {
            console.error("Failed to parse JSON response for slide modification:", error);
            const text = `スライドの修正結果を解析できませんでした。内容が予期せぬ形式です。`;
            setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
            addLogEntry('UI_SYSTEM_ERROR', 'modifySlide (Parse)', text);
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
      const text = `スライド生成を再試行します。`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_INFO', 'handleApproveAndNext (Retry)', text);
      generateSlide(currentSlideIndex);
      return;
    }

    const newGeneratedSlides = [...generatedSlides, currentSlideHtml];
    setGeneratedSlides(newGeneratedSlides);
    setCurrentSlideHtml(''); // ★プレビューをクリアしてローディングに戻す

    const nextIndex = currentSlideIndex + 1;
    if (nextIndex < slideOutline.length) {
      setCurrentSlideIndex(nextIndex);
      const nextSlide = slideOutline[nextIndex];
      const text = `スライド ${currentSlideIndex + 1} を承認しました。\n次のスライド「${nextSlide.title}」の生成を開始します。`;
      setMessages(prev => [...prev.filter(m => m.type !== 'system'), { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleApproveAndNext', text);
      generateSlide(nextIndex);
    } else {
      setAppStatus(APP_STATUS.ALL_SLIDES_GENERATED);
      const text = "全てのステップが完了しました！\n下のボタンからZIPファイルをダウンロードできます。";
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleApproveAndNext (All Done)', text);
    }
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    setProcessingStatus('ZIPファイルを生成中...');
    addLogEntry('SYSTEM_EVENT', 'handleDownloadZip', 'ZIP generation started.');
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
      addLogEntry('SYSTEM_EVENT', 'handleDownloadZip', 'ZIP generation success.');
    } catch (error) {
      const text = `ZIPファイル生成中にエラーが発生しました: ${error.message}`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleDownloadZip', text);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (generatedSlides.length === 0) {
      const text = 'PDF化するスライドがありません。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_WARN', 'handleDownloadPdf', text);
      return;
    }
    
    // ★重要★ ここに、デプロイしたCloud RunのURLを設定してください
    const BACKEND_URL = 'https://slide-pdf-backend-306538767892.asia-northeast1.run.app/generate-pdf';
    
    if (BACKEND_URL.includes('your-cloud-run-service-url')) {
      const text = 'エラー: App.jsx の BACKEND_URL を設定してください。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleDownloadPdf', text);
      return;
    }

    setIsGeneratingPdf(true);
    setProcessingStatus('PDFを生成中... (最大1〜2分かかります)');
    const text = 'バックエンドにPDF生成をリクエストしました...';
    setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_SYSTEM', 'handleDownloadPdf', text);
    addLogEntry('SYSTEM_EVENT', 'handleDownloadPdf', `Requesting PDF from: ${BACKEND_URL}`);

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ htmls: generatedSlides })
      });

      if (!response.ok) {
        // APIからエラーが返ってきた場合
        const errorText = await response.text();
        throw new Error(`PDF生成に失敗しました: ${errorText}`);
      }

      // PDFデータ (Blob) を取得
      const blob = await response.blob();

      // ダウンロードリンクを生成してクリック
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'merged_slides.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const text = 'PDFのダウンロードが完了しました。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM', 'handleDownloadPdf', text);

    } catch (error) {
      console.error("PDF Download failed:", error);
      const text = `PDF生成エラー: ${error.message}`;
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      addLogEntry('UI_SYSTEM_ERROR', 'handleDownloadPdf', text);
    } finally {
      setIsGeneratingPdf(false);
      setProcessingStatus('');
    }
  };

  /**
   * 【NEW】デバッグログをTXTファイルとしてダウンロードする
   */
  const handleDownloadChatLog = () => {
    if (debugLog.length === 0) {
      const text = 'ログはまだありません。';
      setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
      // ログボタン押下自体はログに残す
      addLogEntry('UI_SYSTEM_WARN', 'handleDownloadChatLog', text);
      return;
    }
    
    addLogEntry('SYSTEM_EVENT', 'handleDownloadChatLog', 'Log download triggered.');

    let logContent = '--- スライド作成ジェネレーター デバッグログ ---\n\n';

    debugLog.forEach(entry => {
      logContent += '========================================\n';
      logContent += `[Timestamp]: ${entry.timestamp}\n`;
      logContent += `[Type]:      ${entry.type}\n`;
      logContent += `[Context]:   ${entry.context}\n`;
      logContent += '---------------- Data --------------------\n';
      
      // ★ご要望の「JSON等をそのまま」保存する処理
      if (typeof entry.data === 'object') {
        // オブジェクト（APIリクエストの prompt など）はJSON形式で保存
        try {
          logContent += JSON.stringify(entry.data, null, 2);
        } catch (e) {
          logContent += "[Error] Failed to stringify object data.";
        }
      } else {
        // 文字列（UIメッセージや生のJSON応答）はそのまま保存
        logContent += String(entry.data);
      }
      
      logContent += '\n========================================\n\n';
    });

    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // タイムスタンプに基づいたファイル名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `slide-generator-log-${timestamp}.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerateCurrentSlide = () => {
    // 承認待ち以外のステータスでは何もしない
    if (appStatus !== APP_STATUS.SLIDE_GENERATED) return;

    const slideTitle = slideOutline[currentSlideIndex]?.title || '';
    const text = `スライド「${slideTitle}」を再生成します。`;
    setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_SYSTEM', 'handleRegenerateCurrentSlide', text);
    
    // 現在のHTMLをクリアして、プレビューをローディング状態に戻す
    setCurrentSlideHtml(''); 
    
    // 現在のスライドインデックスを使って、generateSlide 関数を再度呼び出す
    generateSlide(currentSlideIndex);
  };


  const handleSendMessage = () => {
    if (!userInput.trim() || appStatus !== APP_STATUS.SLIDE_GENERATED) return;
    setMessages(prev => [...prev, { type: 'user', text: userInput, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_USER', 'handleSendMessage (Modify Slide)', userInput);
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
    const text = '手動での変更が適用されました。プレビューで確認してください。';
    setMessages(prev => [...prev, { type: 'system', text, timestamp: new Date().toISOString() }]);
    addLogEntry('UI_SYSTEM', 'handleApplyCodeChanges', text);
  };

  const handleCancelCodeEdit = () => {
    setIsCodeEditorOpen(false);
    setEditableHtml('');
  };

  // --- Render ---

  // 1. スライドを「新規生成」している状態
  const isGenerating = appStatus === APP_STATUS.GENERATING_SLIDES;
  // 2. スライドを「修正」している状態
  const isModifying = appStatus === APP_STATUS.SLIDE_GENERATED && isProcessing;
  
  // 1か2のどちらかであれば、プレビューパネルはローディング中
  const isPreviewLoading = isGenerating || isModifying;

  // ローディング中に表示するタイトルを定義
  const loadingTitle = isGenerating
    ? slideOutline[currentSlideIndex]?.title // 新規生成中のタイトル
    : isModifying
      ? `${slideOutline[currentSlideIndex]?.title} を修正中...` // 修正中のタイトル
      : ''; // それ以外

  return (
    <div className="bg-[#1e1e1e] h-screen w-screen flex flex-col font-sans text-white">
      {/* ▼▼▼ AppHeaderに関数を渡す ▼▼▼ */}
      <AppHeader 
        onSettingsClick={() => setIsApiKeyModalOpen(true)} 
        onDownloadLog={handleDownloadChatLog}
      />
      {/* ▲▲▲ 修正ここまで ▲▲▲ */}

      <main className="flex-grow flex p-6 gap-6 overflow-hidden">
        
        {/* 左側パネルのラッパー (幅を動的に変更) */}
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
          {appStatus === APP_STATUS.INITIAL || 
           appStatus === APP_STATUS.STRUCTURING || 
           appStatus === APP_STATUS.STRUCTURED || 
           appStatus === APP_STATUS.SELECTING_THEME || 
           appStatus === APP_STATUS.CREATING_OUTLINE || 
           appStatus === APP_STATUS.SELECTING_SECTION_HEADERS || 
           appStatus === APP_STATUS.GENERATING_OUTLINE || 
           appStatus === APP_STATUS.OUTLINE_CREATED ? (
            <FileUploadPanel 
              isProcessing={isProcessing} 
              processingStatus={processingStatus} 
              fileName={fileName} 
              handleDragOver={handleDragOver} 
              handleDrop={handleDrop} 
              onFileSelect={handleFileSelect} 
              appStatus={appStatus}
              thinkingState={thinkingState}
              totalWaitTime={currentTotalWaitTime}
            />
          ) : (
            <PreviewPanel 
              generatedSlides={generatedSlides}
              htmlContent={currentSlideHtml}
              // 以前の複雑なロジックから、新しい変数に置き換え
              isLoading={isPreviewLoading}
              // ローディングタイトルも新しい変数に置き換え
              loadingTitle={loadingTitle}
            />
          )}
        </div>
        
        {/* 右側パネル（ChatPanel）のラッパー (幅を動的に変更) */}
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

          <ChatPanel chatState={{
              messages, userInput, setUserInput, handleSendMessage, chatEndRef, appStatus,
              apiErrorStep, handleRetry,
              structuredMarkdown, setStructuredMarkdown, handleMarkdownApproval, 
              handleRegenerateStructure, // ★追加
              selectedTheme, design, handleThemeSelection, handleDesignSelection, handleThemeApproval,
              handleAgendaChoice, handleSectionHeaderChoice,

              slideOutline, handleOutlineChange, handleInsertSlide, handleDeleteSlide, handleStartGeneration, handleRegenerateOutline, handleRegenerateSlideContent, handleOpenModifyModal, handleOpenModifyAllModal,

              handleOpenMathModal: handleOpenMathModal,
              currentSlideIndex, thinkingState,
              handlePreview, 
              handleRegenerateCurrentSlide, 
              handleReturnToOutline, 
              handleApproveAndNext, handleDownloadZip, handleOpenCodeEditor,

              handleDownloadPdf,
              isGeneratingPdf
          }} />
        </div> 
      </main>

      <ApiKeyModal isOpen={isApiKeyModalOpen} tempApiKey={tempApiKey} setTempApiKey={setTempApiKey} handleSave={handleApiKeySave} />
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

      <MathLiveModal
        isOpen={isMathModalOpen}
        initialValue={tempMathFormula}
        onValueChange={setTempMathFormula} // 編集中の値を一時Stateに反映
        onSave={handleSaveMathModal}
        onCancel={handleCancelMathModal}
      />
    </div>
  );
}