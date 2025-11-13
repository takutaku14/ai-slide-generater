/** 各API待機ステップの「思考プロセス」を定義 */
export const STRUCTURING_STEPS = [
  {
    key: "analyzing_context",
    text: "ドキュメントの文脈（目的・対象者）を分析中...",
  },
  {
    key: "cleaning",
    text: "テキストをクリーンアップ中... (例: 「ドキュ メント」→「ドキュメント」)",
  },
  {
    key: "analyzing",
    text: "ドキュメントの論理構造を解析中... (見出し、段落の識別)",
  },
  { key: "formatting", text: "Markdown形式に再構成中..." },
];

export const OUTLINE_STEPS = [
  { key: "analyzing_doc", text: "Markdownドキュメント全体を分析中..." },
  {
    key: "selecting_templates",
    text: "各セクションに最適なテンプレートを選定中... (例: 表、比較、図解)",
  },
  {
    key: "creating_title_agenda",
    text: "タイトルとアジェンダページを作成中...",
  },
  {
    key: "generating_content",
    text: "各スライドの内容（箇条書き、要約）を生成中...",
  },
  { key: "formatting_json", text: "最終的な構成案（JSON）を組み立て中..." },
];

export const SLIDE_GENERATION_STEPS = [
  { key: "analyzing", text: "スライドの内容を分析中..." },
  { key: "designing", text: "インフォグラフィック/レイアウトをデザイン中..." },
  { key: "coding", text: "HTMLコードを組み立て中..." },
];

/** 文脈分析の結果（キー）を日本語に翻訳するためのマップ */
export const CONTEXT_TRANSLATIONS = {
  purpose: {
    approval: "承認・合意形成",
    information_sharing: "情報共有・記録",
    education: "教育・理解促進",
  },
  audience: {
    expert: "専門家・担当者",
    manager: "経営層・マネージャー",
    beginner: "一般・初心者",
  },
};
