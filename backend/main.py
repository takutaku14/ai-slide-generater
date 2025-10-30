import asyncio
import os
import glob
import tempfile
from playwright.async_api import async_playwright
from PyPDF2 import PdfMerger
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware  # CORS（オリジン間リソース共有）のために必要
from pydantic import BaseModel
from typing import List

# --- App.jsx から受け取るJSONの型を定義 ---


class HtmlList(BaseModel):
    htmls: List[str]


# --- FastAPIアプリケーションの初期化 ---
app = FastAPI()

# --- CORSミドルウェアの設定 ---
# フロントエンドのReactアプリが動作するドメインを許可します
# (開発中は "*" で全て許可しても良いですが、本番環境では React アプリのURLに限定してください)
origins = [
    "http://localhost:3000",  # Vite/React開発サーバー
    "http://localhost:5173",  # Vite/React開発サーバー (Vite 5+)
    # "https://your-react-app-domain.com", # 本番のフロントエンドURL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ★本番環境では上記 origins リストを使用してください
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 添付された html2pdf_improved.py の関数をコピー ---


async def convert_html_to_pdf(html_file_path, pdf_file_path):
    """
    指定されたHTMLファイルを16:9のレイアウトを維持したままPDFに変換します。
    """
    async with async_playwright() as p:
        # ★ Cloud Run (Linux) で動作させるため、'chromium' を明示
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto(f'file://{os.path.abspath(html_file_path)}')
        await page.set_viewport_size({"width": 1280, "height": 720})

        await page.pdf(
            path=pdf_file_path,
            width='1280px',
            height='720px',
            print_background=True,
            margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}
        )
        await browser.close()
        print(f"'{html_file_path}' を '{pdf_file_path}' に正常に変換しました。")

# --- PDF生成APIエンドポイント ---


@app.post("/generate-pdf")
async def generate_pdf(data: HtmlList):
    """
    フロントエンドからHTML文字列のリストを受け取り、PDFを生成して返します。
    """
    # Cloud Run が書き込み可能な一時ディレクトリで作業します
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_pdf_paths = []
        conversion_tasks = []

        # 1. 受け取ったHTMLを一時ファイル (s1.html, s2.html...) に書き出す
        for i, html_content in enumerate(data.htmls):
            html_file_path = os.path.join(temp_dir, f"s{i+1}.html")
            pdf_file_path = os.path.join(temp_dir, f"slide_{i+1}.pdf")

            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_content)

            temp_pdf_paths.append(pdf_file_path)
            # PDF変換タスクを作成
            task = convert_html_to_pdf(html_file_path, pdf_file_path)
            conversion_tasks.append(task)

        # 2. すべてのHTML-to-PDF変換を並行して実行
        await asyncio.gather(*conversion_tasks)
        print("すべての中間PDFが生成されました。")

        # 3. 生成されたPDFを一つに結合
        merger = PdfMerger()
        for pdf_path in temp_pdf_paths:
            merger.append(pdf_path)

        output_pdf_path = os.path.join(temp_dir, "merged_slides.pdf")
        merger.write(output_pdf_path)
        merger.close()
        print(f"'{output_pdf_path}' に結合されました。")

        # 4. 結合したPDFを読み込んでフロントエンドに返す
        with open(output_pdf_path, "rb") as f:
            pdf_bytes = f.read()

        # 5. FastAPIのResponseとしてPDFバイナリを返す
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=merged_slides.pdf"
            }
        )
