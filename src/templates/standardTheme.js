// src/templates/standardTheme.js

// 分かりやすさのため、オブジェクト名を SLIDE_TEMPLATES から standardTemplates に変更します。
export const standardTemplates = {
  title_slide: `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1280, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700;900&display=swap');
        :root {
            --bg-color-dark: #0f172a; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #f8fafc; --text-color-light: #0f172a; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; overflow: hidden; box-sizing: border-box; padding: 60px; background: var(--bg-color); color: var(--text-color); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
        h1 { font-size: 84px; font-weight: 900; margin: 0; line-height: 1.2; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 span { color: var(--accent-color); }
        p { font-size: 28px; margin: 20px 0 0; color: var(--sub-text-color); font-weight: 700; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1;
            --bg-color-light: #ffffff; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        ol { padding-left: 50px; }
        li { font-size: 32px; color: var(--sub-text-color); line-height: 1.8; margin-bottom: 15px; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@900&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8;
            --bg-color-light: #e2e8f0; --text-color-light: #1e293b; --accent-color-light: #0284c7;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 60px; background: var(--bg-color); display: flex; flex-direction: column; justify-content: center; }
        h1 { font-size: 96px; font-weight: 900; color: var(--text-color); margin: 0; line-height: 1.1; border-left: 10px solid var(--accent-color); padding-left: 40px; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #f1f5f9; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 80px; background: var(--bg-color); display: flex; flex-direction: column; justify-content: center; align-items: center; }
        blockquote { margin: 0; padding: 0; border-left: 8px solid var(--accent-color); padding-left: 40px; }
        p { font-size: 48px; font-weight: 700; color: var(--text-color); margin: 0; }
        footer { font-size: 24px; color: var(--sub-text-color); margin-top: 30px; align-self: flex-end; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1;
            --bg-color-light: #ffffff; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 30px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .slide-body { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; flex-grow: 1; }
        .content { font-size: 22px; line-height: 1.8; color: var(--sub-text-color); white-space: pre-wrap; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1; --card-bg-color-dark: rgba(15, 23, 42, 0.5);
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569; --card-bg-color-light: #ffffff;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); --card-bg-color: var(--card-bg-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: flex; justify-content: space-around; gap: 40px; align-items: stretch; }
        .point { background: var(--card-bg-color); border-radius: 12px; padding: 30px; flex: 1; border-top: 4px solid var(--accent-color); display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .point-icon { height: 150px; width: 100%; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1; --card-bg-color-dark: rgba(15, 23, 42, 0.5);
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569; --card-bg-color-light: #ffffff;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); --card-bg-color: var(--card-bg-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: flex; justify-content: space-around; gap: 30px; align-items: stretch; }
        .point { background: var(--card-bg-color); border-radius: 12px; padding: 25px; flex: 1; border-top: 4px solid var(--accent-color); display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .point-icon { height: 140px; width: 100%; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; }
        h2 { font-size: 26px; color: var(--text-color); margin: 0 0 15px; font-weight: 700; }
        p { font-size: 18px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #cbd5e1; --card-bg-color-dark: rgba(15, 23, 42, 0.5);
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569; --card-bg-color-light: #ffffff;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); --card-bg-color: var(--card-bg-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); --card-bg-color: var(--card-bg-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 30px; }
        h1 { font-size: 40px; margin: 0; color: var(--text-color); font-weight: 700; }
        .points-container { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 25px; flex-grow: 1; }
        .point { background: var(--card-bg-color); border-radius: 12px; padding: 20px; border-top: 4px solid var(--accent-color); display: flex; flex-direction: column; align-items: center; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .point-icon { height: 80px; width: 100%; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; }
        h2 { font-size: 22px; color: var(--text-color); margin: 0 0 10px; font-weight: 700; }
        p { font-size: 16px; line-height: 1.6; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .steps-container { position: relative; padding-left: 60px; }
        .timeline { position: absolute; left: 20px; top: 15px; bottom: 15px; width: 4px; background-color: var(--accent-color); opacity: 0.3; }
        .step { position: relative; margin-bottom: 25px; }
        .step-marker { position: absolute; left: -42px; top: 5px; width: 24px; height: 24px; background-color: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-color); font-weight: 700; font-size: 14px; }
        h2 { font-size: 28px; color: var(--text-color); margin: 0 0 8px; font-weight: 700; }
        p { font-size: 20px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        :root {
            --bg-color-dark: #1e293b; --text-color-dark: #e2e8f0; --accent-color-dark: #38bdf8; --sub-text-color-dark: #94a3b8;
            --bg-color-light: #f1f5f9; --text-color-light: #1e293b; --accent-color-light: #0284c7; --sub-text-color-light: #475569;
        }
        body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
        body.theme-dark { --bg-color: var(--bg-color-dark); --text-color: var(--text-color-dark); --accent-color: var(--accent-color-dark); --sub-text-color: var(--sub-text-color-dark); }
        body.theme-light { --bg-color: var(--bg-color-light); --text-color: var(--text-color-light); --accent-color: var(--accent-color-light); --sub-text-color: var(--sub-text-color-light); }
        .slide-container { width: 1280px; height: 720px; box-sizing: border-box; padding: 40px; background: var(--bg-color); display: flex; flex-direction: column; }
        .slide-header { border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; margin-bottom: 40px; }
        h1 { font-size: 42px; margin: 0; color: var(--text-color); font-weight: 700; }
        .list-container { display: flex; flex-direction: column; gap: 30px; }
        .list-item { display: flex; align-items: flex-start; gap: 25px; }
        .item-icon { flex-shrink: 0; width: 64px; height: 64px; color: var(--accent-color); }
        .item-content h2 { font-size: 26px; color: var(--text-color); margin: 0 0 8px; font-weight: 700; }
        .item-content p { font-size: 20px; line-height: 1.7; color: var(--sub-text-color); margin: 0; white-space: pre-wrap; }
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
