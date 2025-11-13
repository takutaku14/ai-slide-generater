import { PROMPTS } from "../constants/prompts.js";
// callGeminiApi は useAppLogic から渡す必要がありますが、
// ここでは暫定的に import されることを想定して記述します。
// 実際には useAppLogic.js でこの関数に callGeminiApi を束縛（bind）するか、引数で渡します。

/**
 * Lucide アイコンを CDN から SVG 文字列として取得する
 * @param {string} iconName - Lucide のアイコン名 (例: 'check-circle')
 * @returns {Promise<string>} SVG文字列 (失敗時は空文字列)
 */
export const fetchIconSvg = async (iconName) => {
  // Lucideアイコン名（半角英小文字、数字、ハイフンのみ）の正規表現
  const isValidIconName = /^[a-z0-9-]+$/;

  // AIが不正な値（日本語、スペース、空文字など）を指定した場合のフォールバック
  if (!iconName || !isValidIconName.test(iconName)) {
    console.warn(
      `[WARN] Invalid icon name received: "${iconName}". Using default 'circle'.`
    );
    iconName = "circle"; // 強制的に 'circle' にする
  }

  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${iconName}.svg`
    );
    if (!response.ok) {
      console.warn(
        `[WARN] Failed to fetch icon: ${iconName}. Server responded with ${response.status}.`
      );
      return null; // "circle" をフェッチせず、null を返して失敗を通知
    }
    return await response.text();
  } catch (error) {
    console.error(`[ERROR] Fetching icon ${iconName}:`, error);
    return null; // ネットワークエラー時も null を返す
  }
};

/**
 * 【NEW】アイコン指示を処理し、SVG文字列を取得する
 * - 英語名でも404なら再翻訳を試みる
 * @param {object} point - スライドのポイントオブジェクト (title, summary, icon_description を含む)
 * @param {Function} callGeminiApiCallback - 実行可能な callGeminiApi 関数
 * @returns {Promise<string>} SVG文字列
 */
export const getIconSvg = async (point, callGeminiApiCallback) => {
  // Lucideアイコン名（半角英小文字、数字、ハイフンのみ）の正規表現
  const isValidIconName = /^[a-z0-9-]+$/;
  let iconName = (point.icon_description || "").trim();

  // AIが再翻訳を試みるための「概念」を定義
  // (指示が日本語の場合はそれ自体を、英語の場合はスライドのタイトルや要約を概念とする)
  let conceptForRetry = iconName;

  let svgContent = null; // SVGコンテンツを保持する変数

  // --- 1. 翻訳 (必要な場合) ---
  if (!isValidIconName.test(iconName)) {
    // 英語名でない（＝日本語指示）の場合
    console.warn(
      `[WARN] Invalid icon name: "${iconName}". Translating via AI...`
    );
    const prompt = PROMPTS.findIconName(iconName);
    const translatedNameResult = await callGeminiApiCallback(
      prompt,
      "gemini-2.5-flash-lite",
      "Icon Translation"
    );

    if (translatedNameResult && !translatedNameResult.error) {
      iconName = translatedNameResult.trim().toLowerCase();
      console.log(
        `[INFO] AI translation: "${point.icon_description}" -> "${iconName}"`
      );
    } else {
      console.error(
        `[ERROR] Icon translation failed for: "${point.icon_description}"`
      );
      iconName = "circle"; // 翻訳自体が失敗したら 'circle' に
    }
  } else {
    // 英語名が最初から指定されていた場合
    // 再翻訳の際は、この英語名ではなく「スライドのタイトル」を概念として使う
    conceptForRetry = `${point.title}: ${point.summary}`;
    console.log(
      `[INFO] Icon name is valid: "${iconName}". Attempting fetch...`
    );
  }

  // --- 2. 最初のフェッチ試行 ---
  // (日本語から翻訳された名前、または最初から英語だった名前でフェッチ)
  svgContent = await fetchIconSvg(iconName);

  // --- 3. 再翻訳ロジック (フェッチ失敗時 = 404) ---
  // (英語ハルシネーションでも、日本語からの翻訳ミスでも、ここで捕捉される)
  if (svgContent === null) {
    console.warn(
      `[WARN] Retrying translation. (Failed attempt: "${iconName}")`
    );

    // 失敗した名前をAIに伝え、再翻訳を試みる
    // (conceptForRetry には「日本語指示」または「スライドのタイトル」が入っている)
    const retryPrompt = PROMPTS.findIconNameRetry(conceptForRetry, iconName);
    const retryNameResult = await callGeminiApiCallback(
      retryPrompt,
      "gemini-2.5-flash-lite",
      "Icon Translation Retry"
    );

    let newIconName = "circle"; // デフォルトは 'circle'
    if (retryNameResult && !retryNameResult.error) {
      newIconName = retryNameResult.trim().toLowerCase();
      console.log(
        `[INFO] AI retry translation: "${conceptForRetry}" -> "${newIconName}"`
      );
    } else {
      console.error(`[ERROR] Icon retry translation failed.`);
    }

    // 再度フェッチ (これが最後の試行)
    svgContent = await fetchIconSvg(newIconName);
  }

  // --- 4. 最終フォールバック ---
  if (svgContent === null) {
    console.log(`[INFO] Final fallback: fetching 'circle'.`);
    svgContent = await fetchIconSvg("circle");
  }

  return svgContent || ""; // 最終的に 'circle' すら失敗したら空文字
};
