# 1. ベースイメージとしてPython 3.11 を使用
FROM python:3.11-slim

# 2. 作業ディレクトリを設定
WORKDIR /app

# 3. 必要なライブラリをインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. ★最重要★ Playwright と Chromium ブラウザ本体をインストール
RUN playwright install chromium

# 5. アプリケーションコードをコピー
COPY . .

# 6. アプリケーションの起動コマンド (Cloud Run は $PORT 環境変数でポートを指定します)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]