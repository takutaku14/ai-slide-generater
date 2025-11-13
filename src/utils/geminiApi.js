import { GoogleGenerativeAI } from "@google/generative-ai";

export const callGeminiApi = async (
  apiKey,
  addLogEntry,
  setMessages,
  prompt,
  modelName,
  actionName
) => {
  if (!apiKey) {
    // ▼▼▼ ログ記録（UIメッセージ） ▼▼▼
    const text = "APIキーが設定されていません。";
    setMessages((prev) => [
      ...prev,
      { type: "system", text, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM_ERROR", "callGeminiApi", text);
    // ▲▲▲ ログ記録 ▲▲▲
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    console.log(
      `[INFO] Calling Gemini API for: ${actionName} using ${modelName}`
    );
    console.debug(`[DEBUG] Prompt for ${actionName}:`, prompt);

    // ▼▼▼ ログ記録（APIリクエスト） ▼▼▼
    addLogEntry("API_REQUEST", actionName, {
      model: modelName,
      prompt: prompt,
    });
    // ▲▲▲ ログ記録 ▲▲▲

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = await response.text();

    text = text.replace(/^```(json|html|svg)?\s*|```\s*$/g, "").trim();
    text = text.replace(/^xml\s*/, "");

    console.log(`[INFO] Received response for: ${actionName}`);

    // ▼▼▼ ログ記録（APIレスポンス成功） ▼▼▼
    addLogEntry("API_RESPONSE_SUCCESS", actionName, text);
    // ▲▲▲ ログ記録 ▲▲▲

    return text;
  } catch (error) {
    console.error(`[FATAL] API Error during ${actionName}:`, error);

    // ▼▼▼ ログ記録（APIレスポンスエラー） ▼▼▼
    addLogEntry("API_ERROR", actionName, error.message);
    // ▲▲▲ ログ記録 ▲▲▲

    return { error: `APIエラーが発生しました: ${error.message}` };
  }
};
