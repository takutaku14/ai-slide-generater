// src/templates/index.js
import { standardTemplates } from "./standardTheme.js"; // これがイルシル風テーマを指す
import { popTemplates } from "./popTheme.js";

// import { modernTemplates } from './modernTheme.js'; // 将来のテーマ追加用のコメントアウト例
// import { creativeTemplates } from './creativeTheme.js'; // 将来のテーマ追加用のコメントアウト例

export const THEMES = {
  standard: {
    name: "スタンダード (ビジネス)", // UIで表示するテーマ名 (分かりやすく変更)
    templates: standardTemplates,
  },
  pop: {
    name: "ポップ",
    templates: popTemplates,
  },
  // modern: { // 将来のテーマ追加用のコメントアウト例
  //   name: 'モダン',
  //   templates: modernTemplates
  // },
  // creative: { // 将来のテーマ追加用のコメントアウト例
  //   name: 'クリエイティブ',
  //   templates: creativeTemplates
  // }
};
