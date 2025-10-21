// src/templates/popTheme.js

// 「ポップ」テーマのテンプレートセット
export const popTemplates = {
  // ----------------------------------------
  // ルートCSS変数 (全テンプレート共通)
  // ----------------------------------------
  // :root {
  //     /* ポップテーマはライトモードを基調とします */
  //     --bg-color-light: #ffffff;
  //     --text-color-light: #333333;
  //     --accent-color-light: #00C4FF; /* ブライトシアン */
  //     --accent-color-2-light: #FF3D8B; /* ポップピンク */
  //     --accent-color-3-light: #FFD600; /* ビビッドイエロー */
  //     --sub-text-color-light: #555555;
  //     --card-bg-color-light: #f9f9f9;
  // }
  // body {
  //     margin: 0;
  //     font-family: 'Zen Maru Gothic', sans-serif;
  // }
  // body.theme-light, body.theme-dark { /* ダークモードもライトの配色を適用 */
  //     --bg-color: var(--bg-color-light);
  //     --text-color: var(--text-color-light);
  //     --accent-color: var(--accent-color-light);
  //     --accent-color-2: var(--accent-color-2-light);
  //     --accent-color-3: var(--accent-color-3-light);
  //     --sub-text-color: var(--sub-text-color-light);
  //     --card-bg-color: var(--card-bg-color-light);
  // }
  // .slide-container {
  //     width: 1280px;
  //     height: 720px;
  //     overflow: hidden;
  //     box-sizing: border-box;
  //     padding: 60px;
  //     background: var(--bg-color);
  //     color: var(--text-color);
  // }

  title_slide: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; overflow: hidden; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
        h1 { font-size: 100px; font-weight: 900; margin: 0; line-height: 1.3; color: var(--accent-color-2); text-shadow: 2px 2px 4px rgba(0,0,0,0.1); }
        p { font-size: 32px; margin: 20px 0 0; color: var(--sub-text-color); font-weight: 700; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <h1>{title}</h1>
        <p>{summary}</p>
    </div>
</body>
</html>`,

  agenda: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 4px dotted var(--accent-color-3); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 48px; margin: 0; color: var(--text-color); font-weight: 700; }
        ol { padding-left: 50px; }
        li { font-size: 34px; color: var(--sub-text-color); line-height: 1.8; margin-bottom: 15px; font-weight: 700; }
        li::marker { color: var(--accent-color); font-weight: 900; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <ol>{agenda_items_html}</ol>
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
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@900&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--accent-color-3); color: var(--text-color); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
        h1 { font-size: 110px; font-weight: 900; color: var(--text-color); margin: 0; line-height: 1.2; padding: 20px 40px; background: var(--bg-color); border-radius: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
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
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 80px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; justify-content: center; align-items: center; }
        blockquote { margin: 0; padding: 0; border-left: 10px solid var(--accent-color); padding-left: 40px; }
        p { font-size: 52px; font-weight: 700; color: var(--text-color); margin: 0; }
        footer { font-size: 28px; color: var(--text-color); margin-top: 30px; align-self: flex-end; font-weight: 700; padding: 10px 20px; background: var(--accent-color-3); border-radius: 10px; }
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
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 4px dotted var(--accent-color-3); padding-bottom: 15px; margin-bottom: 30px; }
        h1 { font-size: 48px; margin: 0; color: var(--text-color); font-weight: 700; }
        .slide-body { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; flex-grow: 1; }
        .content { font-size: 24px; line-height: 1.8; color: var(--sub-text-color); white-space: pre-wrap; font-weight: 400; }
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

  two_points: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 4px dotted var(--accent-color-3); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 48px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: flex; justify-content: space-around; gap: 40px; align-items: stretch; }
        .point { background: var(--card-bg-color); border-radius: 16px; padding: 30px; flex: 1; border-top: 8px solid var(--accent-color-2); display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .point-icon { height: 150px; width: 100%; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; }
        h2 { font-size: 30px; color: var(--text-color); margin: 0 0 15px; font-weight: 700; }
        p { font-size: 22px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 4px dotted var(--accent-color-3); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 48px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: flex; justify-content: space-around; gap: 30px; align-items: stretch; }
        .point { background: var(--card-bg-color); border-radius: 16px; padding: 25px; flex: 1; border-top: 8px solid var(--accent-color-2); display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .point-icon { height: 140px; width: 100%; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; }
        h2 { font-size: 28px; color: var(--text-color); margin: 0 0 15px; font-weight: 700; }
        p { font-size: 20px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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

  four_points: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 4px dotted var(--accent-color-3); padding-bottom: 15px; margin-bottom: 30px; }
        h1 { font-size: 44px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 25px; flex-grow: 1; }
        .point { background: var(--card-bg-color); border-radius: 16px; padding: 20px; border-top: 8px solid var(--accent-color-2); display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .point-icon { height: 80px; width: 100%; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; }
        h2 { font-size: 24px; color: var(--text-color); margin: 0 0 10px; font-weight: 700; }
        p { font-size: 18px; line-height: 1.6; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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
            <div class="point">
                <div class="point-icon">{icon_4_svg}</div>
                <h2>{point_4_title}</h2>
                <p>{point_4_summary}</p>
            </div>
        </div>
    </div>
</body>
</html>`,

  vertical_steps: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 4px dotted var(--accent-color-3); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 48px; margin: 0; color: var(--text-color); font-weight: 700; }
        .steps-container { position: relative; padding-left: 60px; }
        .timeline { position: absolute; left: 20px; top: 15px; bottom: 15px; width: 8px; background-color: var(--accent-color); opacity: 0.3; border-radius: 4px; }
        .step { position: relative; margin-bottom: 25px; }
        .step-marker { position: absolute; left: -48px; top: 0px; width: 36px; height: 36px; background-color: var(--accent-color-2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-color); font-weight: 700; font-size: 18px; border: 4px solid var(--bg-color); box-shadow: 0 0 0 4px var(--accent-color-2); }
        h2 { font-size: 30px; color: var(--text-color); margin: 0 0 8px; font-weight: 700; }
        p { font-size: 22px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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

  icon_list: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap');
        :root {
            --bg-color-light: #ffffff; --text-color-light: #333333; --accent-color-light: #00C4FF; --accent-color-2-light: #FF3D8B; --accent-color-3-light: #FFD600; --sub-text-color-light: #555555; --card-bg-color-light: #f9f9f9;
        }
        body { margin: 0; font-family: 'Zen Maru Gothic', sans-serif; }
        body.theme-light, body.theme-dark {
            --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --accent-color-2: var(--accent-color-2-light); --accent-color-3: var(--accent-color-3-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light);
        }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 4px dotted var(--accent-color-3); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 48px; margin: 0; color: var(--text-color); font-weight: 700; }
        .list-container { display: flex; flex-direction: column; gap: 30px; }
        .list-item { display: flex; align-items: center; gap: 25px; }
        .item-icon { flex-shrink: 0; width: 72px; height: 72px; color: var(--accent-color); background: var(--card-bg-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; }
        .item-icon svg { width: 48px; height: 48px; }
        .item-content h2 { font-size: 28px; color: var(--text-color); margin: 0 0 8px; font-weight: 700; }
        .item-content p { font-size: 22px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
    </style>
</head>
<body class="{theme_class}">
    <div class="slide-container">
        <div class="slide-header"><h1>{title}</h1></div>
        <div class="list-container">
            {items_html}
        </div>
    </div>
</body>
</html>`,
};
