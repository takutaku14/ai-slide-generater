/**
 * 【NEW】AIが生成したデータ内のリテラル改行（\\n）を本物の改行（\n）に置換する
 * @param {any} data スキャン対象のデータ（オブジェクト、配列、文字列など）
 * @returns {any} 置換処理後のデータ
 */
export const sanitizeNewlines = (data) => {
  // 1. 文字列の場合: リテラル改行（\\n）を本物の改行（\n）に置換
  if (typeof data === "string") {
    return data.replace(/\\n/g, "\n");
  }

  // 2. 配列の場合: 各要素に対して再帰的に処理
  if (Array.isArray(data)) {
    return data.map(sanitizeNewlines);
  }

  // 3. オブジェクトの場合: 各キーの値に対して再帰的に処理
  if (typeof data === "object" && data !== null) {
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

/**
 * 【NEW】'highlighted_number' スライドの 'number' フィールドを自動修正（サニタイズ）する
 * AIが 'number' に日本語やMarkdownを含めた場合に、それらを 'description' に移動させる
 * @param {Array} outline - AIが生成したスライド構成案
 * @returns {Object} - { sanitizedOutline: Array, notification: string | null }
 */
export const sanitizeHighlightedNumbers = (outline) => {
  let notification = null; // 修正が発生した場合の通知メッセージ

  // Unicodeプロパティエスケープ (\p{...}) をサポートする正規表現
  // [\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}] で日本語の文字セットにマッチ
  const japaneseRegex =
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+/gu;

  const sanitizedOutline = outline.map((slide) => {
    // highlighted_number テンプレート以外はそのまま返す
    if (
      slide.template !== "highlighted_number" ||
      !slide.number ||
      typeof slide.number !== "string"
    ) {
      return slide;
    }

    let originalNumber = slide.number;
    let finalNumber = originalNumber;
    let extraTextFound = "";

    // 1. Markdown記法（*, _）を除去
    finalNumber = finalNumber.replace(/[*_]/g, "");

    // 2. 日本語のテキストを検索
    const matches = finalNumber.match(japaneseRegex);

    if (matches) {
      // マッチした日本語（例: "削減", "達成"）を extraTextFound に結合
      extraTextFound = matches.join("");
      // 元の文字列から日本語を除去
      finalNumber = finalNumber.replace(japaneseRegex, "").trim();
    }

    // 3. 修正が発生したかチェック
    // (例: "**30%削減**" -> "30%")
    if (originalNumber !== finalNumber) {
      const newSlide = { ...slide };

      // 4. 'number' フィールドをクリーンアップ後の値で上書き
      newSlide.number = finalNumber;

      // 5. 'description' フィールドに、抽出した日本語テキストを追記
      // (すでに追加済みでないかチェック)
      if (
        extraTextFound &&
        newSlide.description &&
        !newSlide.description.includes(extraTextFound)
      ) {
        newSlide.description = newSlide.description + extraTextFound;
      } else if (extraTextFound && !newSlide.description) {
        // description が空だった場合は、そのままセット
        newSlide.description = extraTextFound;
      }

      // 修正が発生したことを記録
      notification =
        "【自動修正】'重要数値' スライドの 'number' フィールドから不要なテキスト（例: '削減'）を検出し、'description' フィールドに自動的に移動しました。";
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
export const sanitizeSvg = (svgString) => {
  if (
    !svgString ||
    typeof svgString !== "string" ||
    !svgString.startsWith("<svg")
  ) {
    console.warn("[WARN] Invalid SVG string received:", svgString);
    return svgString; // SVGでないか、空の場合はそのまま返す
  }

  let sanitized = svgString;

  // 1. 既存の width/height 属性を削除 (ピクセル指定などを防ぐため)
  // <svg ... width="..." ...> -> <svg ... ...>
  sanitized = sanitized.replace(/<svg([^>]*?)width=".*?"/g, "<svg$1");
  sanitized = sanitized.replace(/<svg([^>]*?)height=".*?"/g, "<svg$1");

  // 2. viewBox が存在するかチェック
  const hasViewBox = /<svg([^>]*?)viewBox=".*?"/g.test(sanitized);

  if (hasViewBox) {
    // viewBox がある場合: width/height="100%" のみ挿入
    sanitized = sanitized.replace("<svg", '<svg width="100%" height="100%"');
  } else {
    // viewBox がない場合: width/height="100%" と デフォルトの viewBox を挿入
    console.warn('[WARN] SVG missing viewBox. Adding default "0 0 100 100".');
    sanitized = sanitized.replace(
      "<svg",
      '<svg width="100%" height="100%" viewBox="0 0 100 100"'
    );
  }

  // 3. (保険) AIが誤って <svg> タグ自体に背景色を指定した場合、透過させる
  sanitized = sanitized.replace(
    /<svg([^>]*?)fill="(#fff|#ffffff|#000|#000000)"/gi,
    '<svg$1fill="transparent"'
  );

  // 4. (保険) AIが誤って <rect> で背景色を指定した場合、透過させる
  sanitized = sanitized.replace(
    /<rect([^>]*?)fill="(#fff|#ffffff|#000|#000000)"([^>]*?)width="100%"([^>]*?)height="100%"/gi,
    '<rect$1fill="transparent"$3width="100%"$4height="100%"'
  );

  return sanitized;
};
