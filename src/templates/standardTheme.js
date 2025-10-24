// src/templates/businessFriendlyTheme.js

/**
 * businessFriendlyTemplates
 * * 日本のビジネスシーン向けに最適化された、クリーンで伝わりやすいデザイン。
 * 配色: 白/ごく薄いグレー背景、濃いグレーテキスト、落ち着いた青アクセント
 * フォント: Noto Sans JP
 * レイアウト: 左揃え基調、十分な余白、図解の活用を意識
 */
export const standardTemplates = {
  // 1. 表紙
  title_slide: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');
        :root {
            --bg-color-dark: #0f172a; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #F8FAFC; --text-color-light: #1E293B; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { 
            width: 1280px; height: 720px; box-sizing: border-box; 
            padding: 80px; 
            background: var(--bg-color); color: var(--text-color); 
            display: flex; flex-direction: column; 
            justify-content: center; align-items: flex-start; /* 左揃え */
            text-align: left; 
        }
        h1 { font-size: 80px; font-weight: 900; margin: 0; line-height: 1.3; }
        p { font-size: 28px; margin: 24px 0 0; color: var(--sub-text-color); font-weight: 400; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <h1>{title}</h1>
        <p>{summary}</p>
    </div>
</body>
</html>`,

  // 2. アジェンダ
  agenda: `
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
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        ol { padding-left: 50px; margin: 0; }
        li { font-size: 32px; color: var(--sub-text-color); line-height: 2.0; /* 行間を広めに */ margin-bottom: 15px; font-weight: 400; }
        li::marker { color: var(--accent-color); font-weight: 700; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <ol>{agenda_items_html}</ol>
    </div>
</body>
</html>`,

  // 3. 章見出し
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
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); }
        .slide-container { 
            width: 1280px; height: 720px; box-sizing: border-box; 
            padding: 80px; 
            background: var(--bg-color); 
            display: flex; flex-direction: column; 
            justify-content: center; align-items: flex-start; /* 左揃え */
        }
        h1 { 
            font-size: 96px; font-weight: 900; color: var(--text-color); 
            margin: 0; line-height: 1.2; 
            border-left: 10px solid var(--accent-color); /* アクセントの縦線 */
            padding-left: 40px; 
        }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <h1>{title}</h1>
    </div>
</body>
</html>`,

  // 4. 基本コンテンツ (見出し + 箇条書き)
  content_basic: `
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
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .slide-body { padding-left: 20px; overflow: hidden; /* ★追加: 万が一はみ出た場合にレイアウト崩れを防ぐ */}
        ul { 
            padding-left: 0; /* ★修正: 標準インデントをリセット */
            margin: 0; 
            list-style-type: none; /* ★修正: 標準マーカーを削除 */
        }
        li { 
            font-size: 22px; /* ★修正: 24px -> 22px に変更 */
            color: var(--sub-text-color); 
            line-height: 1.7; /* ★修正: 1.8 -> 1.7 に変更 */
            margin-bottom: 12px; /* ★修正: 15px -> 12px に変更 */
            font-weight: 400; 
            white-space: pre-wrap;
            position: relative;
            padding-left: 1.5em;
        }
        li[data-level="0"]::before { /* ★修正: li::before から変更 (レベル0を明示) */
            content: '●';
            color: var(--accent-color);
            font-size: 0.8em;
            position: absolute;
            left: 0.2em;
            top: 0.15em;
        }
        li[data-level="1"]::before {
            content: '○';
            color: var(--accent-color); /* ★追加: 念のため色を指定 */
            font-size: 0.7em;
            position: absolute; /* ★追加: 念のため指定 */
            left: 0.25em;
            top: 0.2em;
        }
        li[data-level="2"]::before,
        li[data-level="3"]::before,
        li[data-level="4"]::before {
            content: '■';
            color: var(--accent-color); /* ★追加: 念のため色を指定 */
            font-size: 0.6em;
            position: absolute; /* ★追加: 念のため指定 */
            left: 0.3em;
            top: 0.3em;
        }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="slide-body">
            <ul>{items_html}</ul>
        </div>
    </div>
</body>
</html>`,

  // 5. 図解スライド (コンテンツ + 図解エリア)
  content_with_diagram: `
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
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 30px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .slide-body { display: grid; grid-template-columns: 40% 60%; gap: 40px; flex-grow: 1; align-items: center; }
        .content { 
                    font-size: 22px; line-height: 1.8; color: var(--sub-text-color); white-space: pre-wrap; font-weight: 400; 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: flex-start; 
                }
        #infographic-slot { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }

        /* ▼▼▼ SVGがはみ出さないように、この4行を追加 ▼▼▼ */
        #infographic-slot svg {
            max-width: 100%;
            max-height: 100%;
        }
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

  // 6. 複数ポイント強調 (3点)
  // (points を代表して three_points を定義)
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
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1; --card-bg-color-dark: #334155;
            --bg-color-light: #F8FAFC; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569; --card-bg-color-light: #FFFFFF;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); --card-bg-color: var(--card-bg-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: flex; justify-content: space-around; gap: 30px; align-items: stretch; }
        .point { 
            background: var(--card-bg-color); 
            border-radius: 8px; 
            padding: 25px; flex: 1; 
            border-top: 4px solid var(--accent-color); 
            display: flex; flex-direction: column; align-items: center; text-align: center; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.05); /* 薄い影 */
        }
        .point-icon { height: 120px; width: 100%; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; color: var(--accent-color); }
        h2 { font-size: 26px; color: var(--text-color); margin: 0 0 15px; font-weight: 700; }
        p { font-size: 18px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; font-weight: 400; }
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

  // 7. 時系列・プロセス
  vertical_steps: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .steps-container { position: relative; padding-left: 80px; }
        .timeline { position: absolute; left: 30px; top: 15px; bottom: 15px; width: 4px; background-color: var(--accent-color); opacity: 0.3; }
        .step { position: relative; margin-bottom: 25px; }
        .step-marker { position: absolute; left: -52px; top: 5px; width: 24px; height: 24px; background-color: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-color-light); font-weight: 700; font-size: 14px; }
        body.theme-dark .step-marker { color: var(--bg-color-dark); }
        h2 { font-size: 28px; color: var(--text-color); margin: 0 0 8px; font-weight: 700; }
        p { font-size: 20px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; font-weight: 400; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="steps-container">
            <div class="timeline"></div>
            {items_html}
        </div>
    </div>
</body>
</html>`,

  // 8. 比較スライド
  comparison: `
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
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .slide-body { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; flex-grow: 1; }
        .column { padding: 0; }
        .column h2 { font-size: 28px; color: var(--text-color); margin: 0 0 20px; font-weight: 700; text-align: center; }
        .column ul { padding-left: 30px; margin: 0; }
        .column li { font-size: 20px; color: var(--sub-text-color); line-height: 1.8; margin-bottom: 12px; font-weight: 400; white-space: pre-wrap; }
        .column li::marker { color: var(--accent-color); font-size: 1.2em; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="slide-body">
            <div class="column">
                <h2>{col_1_title}</h2>
                <ul>{col_1_items_html}</ul>
            </div>
            <div class="column">
                <h2>{col_2_title}</h2>
                <ul>{col_2_items_html}</ul>
            </div>
        </div>
    </div>
</body>
</html>`,

  // 9. 結び
  summary_or_thankyou: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;900&display=swap');
        :root {
            --bg-color-dark: #0f172a; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #F8FAFC; --text-color-light: #1E293B; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { 
            width: 1280px; height: 720px; box-sizing: border-box; 
            padding: 80px; 
            background: var(--bg-color); color: var(--text-color); 
            display: flex; flex-direction: column; 
            justify-content: center; align-items: center; /* 中央揃え */
            text-align: center; 
        }
        h1 { font-size: 72px; font-weight: 900; margin: 0; line-height: 1.3; color: var(--accent-color); }
        p { font-size: 24px; margin: 24px 0 0; color: var(--sub-text-color); font-weight: 400; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <h1>{title}</h1>
        <p>{summary}</p>
    </div>
</body>
</html>`,

  // 既存の standardTheme から、イルシル風のテーマに
  // 合わないものを削除、またはコメントアウト

  // quote: `...` (コンセプトに合わないため削除)
  // two_points: `...` (three_pointsに統合)
  // four_points: `...` (three_pointsに統合)
  // icon_list: `...` (content_basic や points で代替可能)

  // 10. 表（テーブル）
  table_basic: `
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
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 30px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        
        .table-container { 
            width: 100%; 
            height: calc(100% - 100px); /* ヘッダーの高さを引いた分 */
            overflow: hidden; /* スクロールバーはなし */
        }
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed; /* 列幅を固定し、はみ出しを防ぐ */
        }
        th, td {
            border: 1px solid var(--sub-text-color);
            padding: 10px;
            font-size: 18px;
            color: var(--sub-text-color);
            word-wrap: break-word; /* セル内でテキストを改行 */
            text-align: left;
        }
        th {
            background-color: var(--accent-color);
            color: var(--bg-color-light);
            font-weight: 700;
        }
        body.theme-dark th { color: var(--bg-color-dark); }
        tr:nth-child(even) { 
            background-color: rgba(128, 128, 128, 0.1);
        }
        body.theme-light tr:nth-child(even) {
             background-color: #f8f9fa;
        }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="table-container">
            <table>
                {table_html}
            </table>
        </div>
    </div>
</body>
</html>`,
};
