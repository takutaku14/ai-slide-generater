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
            font-size: 22px; 
            line-height: 1.7; /* ★修正: 基準となる行間を 1.7 に設定 */
            color: var(--sub-text-color); 
            /* white-space: pre-wrap; */ /* ★削除: markedがpタグを生成するため不要 */
            font-weight: 400; 
            display: flex; 
            flex-direction: column; 
            justify-content: flex-start;
            /* ★追加: はみ出し防止 */
            height: 100%;
            overflow: hidden;
        }

        /* ▼▼▼ 修正（ここから追加） ▼▼▼ */
        /* marked.parse() が生成するタグのスタイルリセット */
        .content p {
            margin: 0 0 16px 0; /* 段落下のマージンを16pxに固定 */
            line-height: 1.7;
        }
        .content p:last-child {
            margin-bottom: 0; /* 最後の要素の余白を削除 */
        }
        .content ul {
            margin: 0 0 16px 0; /* 箇条書きブロックのマージン */
            padding-left: 1.5em; /* 箇条書きのインデント */
            list-style-type: none; /* デフォルトの黒丸を削除 */
        }
        .content li {
            margin: 0 0 12px 0; /* 項目間のマージン */
            line-height: 1.7;
            position: relative;
            padding-left: 0.5em;
        }
        .content li::before {
            content: '●'; /* content_basic と同じカスタムビュレット */
            color: var(--accent-color);
            font-size: 0.8em;
            position: absolute;
            left: -1.2em;
            top: 0.15em;
        }
        .content strong {
            font-weight: 700;
            color: var(--text-color); /* AIが強調した部分を目立たせる */
        }
        /* ▲▲▲ 修正（ここまで） ▲▲▲ */
        
        #infographic-slot { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
        #infographic-slot svg {
            width: 100%; /* max-width から変更 */
            height: 100%; /* max-height から変更 */
            object-fit: contain; /* アスペクト比を維持 */
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
        .point-icon svg {
            width: 80px;  /* SVGの幅を80pxに指定 */
            height: 80px; /* SVGの高さを80pxに指定 */
        }
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
            /* ▼▼▼ 修正 ▼▼▼ (カード背景色を追加) */
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1; --card-bg-color-dark: #334155;
            --bg-color-light: #F8FAFC; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569; --card-bg-color-light: #FFFFFF;
            /* ▲▲▲ 修正 ▲▲▲ */
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); --card-bg-color: var(--card-bg-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px 80px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        
        /* ▼▼▼ 修正 ▼▼▼ (Grid から Flex に変更) */
        .slide-body { 
            display: flex; /* grid から変更 */
            gap: 30px; /* 50px から変更 (4カラム時に備える) */
            flex-grow: 1; 
            align-items: stretch; /* 追加 */
        }
        .column { 
            padding: 20px; /* 0 から変更 */
            flex: 1; /* カラムが均等に広がるように */
            display: flex; 
            flex-direction: column; /* カラム内を縦に並べる */
            
            /* カードデザインを追加 */
            background: var(--card-bg-color);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            border-top: 4px solid var(--accent-color);
        }
        .column h2 { 
            font-size: 24px; /* 28px から変更 (4カラム時に備える) */
            color: var(--text-color); 
            margin: 0 0 20px; 
            font-weight: 700; 
            text-align: center; 
        }
        .column ul { 
            padding-left: 20px; /* 30px から変更 */
            margin: 0; 
            flex-grow: 1; /* リストが残りの高さを埋めるように */
        }
        .column li { 
            font-size: 18px; /* 20px から変更 */
            color: var(--sub-text-color); 
            line-height: 1.7; /* 1.8 から変更 */
            margin-bottom: 10px; /* 12px から変更 */
            font-weight: 400; 
            white-space: pre-wrap; 
        }
        /* ▲▲▲ 修正 ▲▲▲ */
        .column li::marker { color: var(--accent-color); font-size: 1.2em; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="slide-body">
            {comparison_columns_html}
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
            padding: 8px;
            font-size: 16px; 
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

  // 11. 数式 + 解説 (上下分割)
  math_basic: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        /* KaTeX CSS (数式表示に必須) */
        @import url('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css');

        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1;
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { 
            width: 1280px; height: 720px; box-sizing: border-box; 
            padding: 60px 80px; 
            background: var(--bg-color); 
            display: flex; flex-direction: column; 
        }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 30px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        
        /* 解説文エリア */
        .content { 
            font-size: 22px; 
            line-height: 1.7;
            color: var(--sub-text-color); 
            font-weight: 400; 
            height: 40%; /* 高さを制限 */
            overflow: auto; /* 内容が多い場合はスクロール */
            padding-bottom: 20px;
        }
        /* marked.parse() が生成するタグのスタイル */
        .content p { margin: 0 0 16px 0; line-height: 1.7; }
        .content ul { margin: 0 0 16px 0; padding-left: 1.5em; }
        .content li { margin: 0 0 12px 0; line-height: 1.7; }

        .content strong {
            font-weight: 700;
            color: var(--text-color); /* AIが強調した部分を目立たせる */
        }
        .content a { /* リンク（もしあれば） */
            color: var(--accent-color);
            text-decoration: none;
        }

        /* 数式エリア */
        .formula-container {
            flex-grow: 1; /* 残りの高さをすべて使用 */
            display: flex;
            align-items: top; /* 垂直方向中央揃え */
            justify-content: center; /* 水平方向中央揃え */
            overflow: hidden;
            
            /* KaTeX のデフォルトフォントサイズを上書き */
            font-size: 28px; /* 数式の基本サイズを大きく */
            color: var(--text-color); /* 数式の色をテキストカラーに合わせる */
        }
        
        /* KaTeXが生成するkatex-displayクラス（ブロック数式）のスタイル */
        .formula-container .katex-display {
            margin: 0; /* 中央揃えのためマージンをリセット */
        }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        
        <div class="content">{content}</div> <div class="formula-container">
            {formula}
        </div>
    </div>
</body>
</html>`,

  // 12. 引用 (キラーフレーズ)
  quote: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1;
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { 
            width: 1280px; height: 720px; box-sizing: border-box; 
            padding: 60px 80px; 
            background: var(--bg-color); 
            display: flex; flex-direction: column; 
        }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 30px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        
        .quote-container {
            flex-grow: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        blockquote {
            margin: 0;
            padding: 0 40px;
            font-size: 52px; /* ★フォントを大きく */
            font-weight: 700; /* 700 (Bold) または 900 (Black) */
            line-height: 1.6;
            color: var(--accent-color); /* ★アクセントカラーで強調 */
            white-space: pre-wrap;
        }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        
        <div class="quote-container">
            <blockquote>{summary}</blockquote>
        </div>
    </div>
</body>
</html>`,

  // 13. 重要数値
  highlighted_number: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1;
            --bg-color-light: #FFFFFF; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { 
            width: 1280px; height: 720px; box-sizing: border-box; 
            padding: 60px 80px; 
            background: var(--bg-color); 
            display: flex; flex-direction: column; 
        }
        .slide-header { border-bottom: 3px solid var(--accent-color); padding-bottom: 20px; margin-bottom: 30px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        
        .number-container {
            flex-grow: 1;
            display: flex;
            flex-direction: column; /* 縦積み */
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .number {
            font-size: 180px; /* ★巨大なフォント */
            font-weight: 900; /* Black */
            line-height: 1.1;
            color: var(--accent-color); /* ★アクセントカラーで強調 */
            margin: 0;
        }
        .description {
            font-size: 32px; /* 説明文 */
            font-weight: 700; /* Bold */
            line-height: 1.5;
            color: var(--text-color);
            margin: 10px 0 0;
        }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        
        <div class="number-container">
            <div class="number">{number}</div>
            <p class="description">{description}</p>
        </div>
    </div>
</body>
</html>`,
};
