// src/templates/index.js
import { standardTemplates } from "./standardTheme.js";
// import { modernTemplates } from './modernTheme.js'; // 将来のテーマ追加用のコメントアウト例
// import { creativeTemplates } from './creativeTheme.js'; // 将来のテーマ追加用のコメントアウト例

export const THEMES = {
  standard: {
    name: "スタンダード", // UIで表示するテーマ名
    templates: standardTemplates,
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
