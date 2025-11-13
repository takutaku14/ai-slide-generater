import { marked, Marked } from "marked";
import markedKatex from "marked-katex-extension";

// (注: このファイルは addLogEntry や currentSlideIndex に依存すべきではないため、
// ログ出力機能は useAppLogic.js 側に残し、ここでは純粋なパース機能のみを提供します)

/**
 * AIが生成したMarkdown文字列をサニタイズする
 */
const sanitizeMarkdown = (text) => {
  if (typeof text !== "string" || !text) {
    return { cleanedText: "", boldedItems: [] };
  }
  let cleaned = text;
  cleaned = cleaned.replace(/\\+([*_~`$])/g, "$1");
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
 * Markdownをパースし、HTML文字列と、期待される太字の検証結果を返す
 * @param {string} rawMarkdown - サニタイズ前のMarkdownテキスト
 * @param {object} options - { isInline: boolean, breaks: boolean }
 * @returns {object} - { parsedHtml: string, expectedBoldItems: string[], failedItems: string[] }
 */
export const parseMarkdownAndVerifyBold = (rawMarkdown, options) => {
  const { isInline = false, breaks = false } = options;

  const { cleanedText, boldedItems: expectedBoldItems } = sanitizeMarkdown(
    rawMarkdown || ""
  );

  const parser = isInline
    ? (text) => marked.parseInline(text)
    : (text) => marked.parse(text, { breaks });

  let parsedHtml = parser(cleanedText);
  const failedItems = [];

  if (expectedBoldItems.length > 0) {
    let allConverted = true;

    for (const item of expectedBoldItems) {
      const decodedHtml = parsedHtml
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");

      if (!decodedHtml.includes(`<strong>${item}</strong>`)) {
        allConverted = false;
        failedItems.push(item);
      }
    }

    // 失敗した項目があれば、フォールバック（強制置換）処理
    if (!allConverted) {
      let fallbackHtml = parsedHtml;
      const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      };
      for (const itemToFix of failedItems) {
        const regexNoSpace = new RegExp(escapeRegExp(`**${itemToFix}**`), "g");
        fallbackHtml = fallbackHtml.replace(
          regexNoSpace,
          `<strong>${itemToFix}</strong>`
        );
        const regexWithSpace = new RegExp(
          escapeRegExp(`** ${itemToFix} **`),
          "g"
        );
        fallbackHtml = fallbackHtml.replace(
          regexWithSpace,
          `<strong>${itemToFix}</strong>`
        );
      }
      parsedHtml = fallbackHtml; // 置換後のHTMLを採用
    }
  }

  return { parsedHtml, expectedBoldItems, failedItems };
};
