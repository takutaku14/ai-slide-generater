import io
import os
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from playwright.sync_api import sync_playwright # ★非同期(async_api)から同期(sync_api)に変更
from PyPDF2 import PdfMerger

app = Flask(__name__)

# -----------------------------------------------------------------------------
# CORS設定
# -----------------------------------------------------------------------------
# App.jsx (例: localhost:5173) からのリクエストを許可します。
# 開発中はCORS(app) で全てのオリジンを許可するのが簡単です。
CORS(app, resources={r"/generate-pdf": {"origins": "*"}})

# -----------------------------------------------------------------------------
# Playwright PDF変換ロジック (html2pdf2.py から流用)
# -----------------------------------------------------------------------------
def convert_html_to_pdf(html_file_path, pdf_file_path, page):
    """
    指定されたHTMLファイルをPDFに変換します。 (同期版)
    """
    # HTMLファイルをURLとして正しく読み込む
    page.goto(f'file://{os.path.abspath(html_file_path)}')
    
    # 16:9のアスペクト比を維持
    page.set_viewport_size({"width": 1280, "height": 720})

    # PDFを生成
    page.pdf(
        path=pdf_file_path,
        width='1280px',
        height='720px',
        print_background=True,
        margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}
    )
    print(f"  Converted '{html_file_path}' -> '{pdf_file_path}'")

# -----------------------------------------------------------------------------
# メインのAPIエンドポイント
# -----------------------------------------------------------------------------
@app.route('/generate-pdf', methods=['POST'])
def handle_generate_pdf():
    """
    POSTリクエストを受け取り、HTMLの配列からPDFを生成して返します。
    """
    # 1. フロントエンドからJSONデータを取得
    try:
        data = request.get_json()
        html_strings = data.get('htmls')
        if not html_strings or not isinstance(html_strings, list):
            return jsonify({"error": "Invalid payload. 'htmls' array is required."}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to parse request JSON: {str(e)}"}), 400

    print(f"Received request to generate PDF for {len(html_strings)} slides.")

    # 2. Playwright (同期) を起動
    with sync_playwright() as p:
        browser = None
        try:
            browser = p.chromium.launch()
            page = browser.new_page() # ページは再利用する

            # 3. 一時ディレクトリを作成 (HTMLと中間PDFの保存用)
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_pdf_paths = []

                # 4. HTML文字列を一時HTMLファイルに書き出し、PDFに変換
                for i, html_content in enumerate(html_strings):
                    temp_html_path = os.path.join(temp_dir, f's{i+1}.html')
                    temp_pdf_path = os.path.join(temp_dir, f'slide_{i}.pdf')
                    
                    # HTML文字列をファイルに書き込む
                    with open(temp_html_path, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    
                    # PDFに変換
                    convert_html_to_pdf(temp_html_path, temp_pdf_path, page)
                    temp_pdf_paths.append(temp_pdf_path)

                print("All slides converted. Merging PDFs...")

                # 5. 中間PDFをPyPDF2で結合
                merger = PdfMerger()
                for pdf_path in temp_pdf_paths:
                    merger.append(pdf_path)

                # 6. 結合したPDFをファイルではなく、メモリ上のバッファに書き込む
                pdf_buffer = io.BytesIO()
                merger.write(pdf_buffer)
                merger.close()
                pdf_buffer.seek(0) # バッファの先頭にポインタを戻す

                print("PDF merged. Sending file response to client.")

                # 7. Flaskのsend_fileを使って、バッファの内容をPDFファイルとして返す
                return send_file(
                    pdf_buffer,
                    as_attachment=True,       # ダウンロードさせる
                    download_name='merged_slides.pdf', # ファイル名
                    mimetype='application/pdf'  # MIMEタイプ
                )

        except Exception as e:
            print(f"[ERROR] PDF generation failed: {str(e)}")
            return jsonify({"error": f"An error occurred during PDF generation: {str(e)}"}), 500
        finally:
            if browser:
                browser.close()

# -----------------------------------------------------------------------------
# サーバーの起動
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    # .env.development で指定した 'http://localhost:5001' に合わせる
    print("Starting local PDF generation server on http://localhost:5001 ...")
    app.run(debug=True, port=5001)