import React, { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
// marked は math_basic テンプレートの処理に必要
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";

// Step 1 で分離した定数とユーティリティをインポート
import { APP_STATUS } from "../constants/appStatus.js";
import { PROMPTS } from "../constants/prompts.js";
import {
  STRUCTURING_STEPS,
  OUTLINE_STEPS,
  SLIDE_GENERATION_STEPS,
  CONTEXT_TRANSLATIONS,
} from "../constants/steps.js";
import { callGeminiApi } from "../utils/geminiApi.js";
import {
  sanitizeNewlines,
  sanitizeHighlightedNumbers,
  sanitizeSvg,
} from "../utils/sanitizers.js";
import { getIconSvg, fetchIconSvg } from "../utils/iconUtils.js";
import { parseMarkdownAndVerifyBold } from "../utils/markdownParser.js";
import { THEMES } from "../templates/index.js"; // templates/index.js を参照

// pdf.js のワーカーを設定 (App.jsx から移動)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export const useAppLogic = () => {
  // --- State Management (App.jsx から移動) ---
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  const [appStatus, setAppStatus] = useState(APP_STATUS.INITIAL);
  const [messages, setMessages] = useState([]);
  const [debugLog, setDebugLog] = useState([]);
  const [userInput, setUserInput] = useState("");

  const [fileName, setFileName] = useState("");
  const [originalExtractedText, setOriginalExtractedText] = useState("");
  const [structuredMarkdown, setStructuredMarkdown] = useState("");
  const [slideOutline, setSlideOutline] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");

  const [apiErrorStep, setApiErrorStep] = useState(null);

  const [selectedTheme, setSelectedTheme] = useState("standard");
  const [design, setDesign] = useState("dark");

  const [includeAgenda, setIncludeAgenda] = useState(false);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [generatedSlides, setGeneratedSlides] = useState([]);
  const [currentSlideHtml, setCurrentSlideHtml] = useState("");

  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [editableHtml, setEditableHtml] = useState("");

  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modificationInput, setModificationInput] = useState("");
  const [modifyModalTarget, setModifyModalTarget] = useState({
    index: null,
    mode: "single",
  });

  const [approvedOutlineSnapshot, setApprovedOutlineSnapshot] = useState([]);

  const [documentContext, setDocumentContext] = useState(null);

  const [thinkingState, setThinkingState] = useState(null);

  const [currentTotalWaitTime, setCurrentTotalWaitTime] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [scrollToIndex, setScrollToIndex] = useState(null);

  const chatEndRef = useRef(null); // Ref もこちらで管理

  // --- Effects (App.jsx から移動) ---
  useEffect(() => {
    const storedApiKey = localStorage.getItem("gemini_api_key");
    if (storedApiKey) {
      setApiKey(storedApiKey);
      const text =
        "ようこそ！スライドの元になるドキュメントをアップロードしてください。";
      setMessages([
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
    } else {
      setIsApiKeyModalOpen(true);
      const text = "まず、Gemini APIキーを設定してください。";
      setMessages([
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
    }
  }, []); // 空の依存配列で初回実行

  // ログ追加時に初回ログも追加する
  useEffect(() => {
    if (messages.length > 0 && debugLog.length === 0) {
      const initialMessage = messages[0];
      const type = initialMessage.text.includes("ようこそ")
        ? "UI_SYSTEM"
        : "UI_SYSTEM_WARN";
      addLogEntry(type, "useEffect (Initial)", initialMessage.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]); // messages が変更されたら実行

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingState]);

  // --- Helper Functions (App.jsx から移動) ---

  /**
   * デバッグログに新しいエントリを追加する
   */
  const addLogEntry = useCallback((type, context, data) => {
    const newEntry = {
      timestamp: new Date().toISOString(),
      type,
      context,
      data: data,
    };
    setDebugLog((prevLog) => [...prevLog, newEntry]);
  }, []); // 依存関係なし (関数型更新のため)

  /**
   * utils/geminiApi.js の callGeminiApi をラップする
   * (useAppLogic 内の状態 apiKey, addLogEntry, setMessages を自動的に渡すため)
   */
  const callGeminiApiWrapper = useCallback(
    async (prompt, modelName, actionName) => {
      return callGeminiApi(
        apiKey,
        addLogEntry,
        setMessages,
        prompt,
        modelName,
        actionName
      );
    },
    [apiKey, addLogEntry]
  ); // setMessages は関数型更新を使うため依存配列から削除可能だが、念のため残す

  /**
   * utils/iconUtils.js の getIconSvg をラップする
   * (callGeminiApiWrapper をコールバックとして渡すため)
   */
  const getIconSvgWrapper = useCallback(
    async (point) => {
      return getIconSvg(point, callGeminiApiWrapper);
    },
    [callGeminiApiWrapper]
  ); // 依存するコールバックを明記

  // --- Handlers (App.jsx から移動) ---
  const handleApiKeySave = () => {
    if (tempApiKey) {
      localStorage.setItem("gemini_api_key", tempApiKey);
      setApiKey(tempApiKey);
      setIsApiKeyModalOpen(false);
      const text =
        "APIキーが保存されました。スライドの元になるドキュメントをアップロードしてください。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleApiKeySave", text);
    }
  };

  const handleRetry = () => {
    if (apiErrorStep === "structure") {
      const text = "再試行します。内容を再度承認してください。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_INFO", "handleRetry: structure", text);
      setApiErrorStep(null);
      setAppStatus(APP_STATUS.STRUCTURED);
    } else if (apiErrorStep === "outline") {
      const lastChoice = messages
        .slice()
        .reverse()
        .find((m) => m.text.includes("セクションヘッダー"))
        ?.text.includes("はい");
      handleSectionHeaderChoice(lastChoice);
    }
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    const allowedTypes = ["application/pdf", "text/plain", "text/markdown"];
    if (!allowedTypes.includes(file.type)) {
      const text = `サポートされていないファイル形式です: ${file.type}`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "handleFileSelect", text);
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setProcessingStatus("テキストを抽出中...");
    const text = `${file.name} をアップロードしました。`;
    setMessages((prev) => [
      ...prev,
      { type: "system", text, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM", "handleFileSelect", text);

    try {
      let extractedText = "";
      if (file.type === "application/pdf") {
        const typedarray = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textData = await page.getTextContent();
          extractedText += textData.items.map((s) => s.str).join(" ");
        }
      } else {
        extractedText = await file.text();
      }
      addLogEntry(
        "SYSTEM_EVENT",
        "handleFileSelect",
        `Text extraction complete. Length: ${extractedText.length}`
      );
      onTextExtracted(extractedText); // onTextExtracted はこのファイル内で定義されている
    } catch (error) {
      const text = "テキスト抽出中にエラーが発生しました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry(
        "UI_SYSTEM_ERROR",
        "handleFileSelect",
        `${text} ${error.message}`
      );
      setIsProcessing(false);
      setFileName("");
    }
  };

  const onTextExtracted = async (text) => {
    const msg1 = `テキスト抽出完了(${text.length}文字)。内容を構造化します。`;
    setMessages((prev) => [
      ...prev,
      { type: "system", text: msg1, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM", "onTextExtracted", msg1);

    setAppStatus(APP_STATUS.STRUCTURING);
    setProcessingStatus("テキストを構造化中...");
    setApiErrorStep(null);

    setOriginalExtractedText(text);

    const calculatedWaitTime = Math.max(
      4000,
      Math.min(180000, text.length * 1.8)
    );
    setCurrentTotalWaitTime(calculatedWaitTime);

    const stepWaitTime = calculatedWaitTime / 4;

    // ★ callGeminiApiWrapper を使用
    const contextPrompt = PROMPTS.analyzeContext(text);
    const contextApiPromise = callGeminiApiWrapper(
      contextPrompt,
      "gemini-2.5-flash-lite",
      "文脈分析"
    );

    const structurePrompt = PROMPTS.structureText(text);
    const structureApiPromise = callGeminiApiWrapper(
      structurePrompt,
      "gemini-2.5-flash-lite",
      "テキスト構造化"
    );

    const dummyProgressPromise = (async () => {
      try {
        setThinkingState(STRUCTURING_STEPS[0].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
        setThinkingState(STRUCTURING_STEPS[1].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
        setThinkingState(STRUCTURING_STEPS[2].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
        setThinkingState(STRUCTURING_STEPS[3].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
      } catch (e) {
        console.error("Dummy progress failed", e);
      }
    })();

    try {
      const [contextResult, structureResult] = await Promise.all([
        contextApiPromise,
        structureApiPromise,
        dummyProgressPromise,
      ]);

      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0);

      let hasError = false;

      if (contextResult && !contextResult.error) {
        try {
          const parsedContext = JSON.parse(contextResult);
          setDocumentContext(parsedContext);
          console.log("[INFO] Document Context Analyzed:", parsedContext);

          const purposeJp =
            CONTEXT_TRANSLATIONS.purpose[parsedContext.purpose] ||
            parsedContext.purpose;
          const audienceJp =
            CONTEXT_TRANSLATIONS.audience[parsedContext.audience] ||
            parsedContext.audience;

          const text = `文脈分析が完了しました。\n- **目的**: ${purposeJp}\n- **対象者**: ${audienceJp}`;
          setMessages((prev) => [
            ...prev,
            { type: "system", text, timestamp: new Date().toISOString() },
          ]);
          addLogEntry("UI_SYSTEM", "onTextExtracted (Context)", text);
        } catch (e) {
          console.error("[FATAL] Failed to parse document context JSON:", e);
          const text = "文脈分析の結果解析に失敗しました。";
          setMessages((prev) => [
            ...prev,
            { type: "system", text, timestamp: new Date().toISOString() },
          ]);
          addLogEntry(
            "UI_SYSTEM_ERROR",
            "onTextExtracted (Context Parse)",
            `${text} ${e.message}`
          );
          hasError = true;
        }
      } else {
        const text = contextResult
          ? contextResult.error
          : "文脈分析中に予期せぬエラーが発生しました。";
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM_ERROR", "onTextExtracted (Context API)", text);
        hasError = true;
      }

      if (structureResult && !structureResult.error) {
        setStructuredMarkdown(structureResult);
        setAppStatus(APP_STATUS.STRUCTURED);
        const text = "テキストの構造化が完了しました。";
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM", "onTextExtracted (Structure)", text);
      } else {
        setApiErrorStep("structure");
        const text = structureResult
          ? structureResult.error
          : "予期せぬエラーが発生しました。";
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM_ERROR", "onTextExtracted (Structure API)", text);
      }

      if (hasError) {
        setApiErrorStep("structure");
        setAppStatus(APP_STATUS.INITIAL);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("[FATAL] Error during structuring:", error);
      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0);
      setApiErrorStep("structure");
      const text = `予期せぬエラーが発生しました: ${error.message}`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_FATAL", "onTextExtracted (Catch)", text);
    }
  };

  const handleRegenerateStructure = async () => {
    if (!originalExtractedText) {
      const text = "エラー: 元のテキストが見つかりません。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "handleRegenerateStructure", text);
      return;
    }

    if (
      !window.confirm(
        "現在の編集内容は破棄されますが、テキストの構造化をAIに再実行させますか？"
      )
    ) {
      return;
    }

    const text1 = "テキストの再構造化を実行します...";
    setMessages((prev) => [
      ...prev,
      { type: "system", text: text1, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM", "handleRegenerateStructure", text1);

    setAppStatus(APP_STATUS.STRUCTURING);
    setIsProcessing(true);
    setProcessingStatus("テキストを再構造化中...");
    setApiErrorStep(null);

    // ★ callGeminiApiWrapper を使用
    const result = await callGeminiApiWrapper(
      PROMPTS.structureText(originalExtractedText),
      "gemini-2.5-flash-lite",
      "テキスト再構造化"
    );

    setIsProcessing(false);

    if (result && !result.error) {
      setStructuredMarkdown(result);
      setAppStatus(APP_STATUS.STRUCTURED);
      const text = "テキストの再構造化が完了しました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleRegenerateStructure", text);
    } else {
      setApiErrorStep("structure");
      setAppStatus(APP_STATUS.STRUCTURED);
      const text = result ? result.error : "予期せぬエラーが発生しました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "handleRegenerateStructure", text);
    }
  };

  const handleMarkdownApproval = () => {
    setAppStatus(APP_STATUS.SELECTING_THEME);
    const text =
      "内容が承認されました。次に、プレゼンテーションのテーマを選択してください。";
    setMessages((prev) => [
      ...prev,
      { type: "system", text, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM", "handleMarkdownApproval", text);
  };

  const handleThemeSelection = (themeKey) => {
    setSelectedTheme(themeKey);
  };

  const handleDesignSelection = (design) => {
    setDesign(design);
  };

  const handleThemeApproval = () => {
    setAppStatus(APP_STATUS.CREATING_OUTLINE);
    const themeName = THEMES[selectedTheme]?.name || "選択されたテーマ";
    const designName = design === "dark" ? "ダーク" : "ライト";

    const userText = `${themeName}テーマ (${designName}) を選択`;
    const systemText =
      "テーマを承知しました。次に、アジェンダページを挿入しますか？";

    setMessages((prev) => [
      ...prev,
      { type: "user", text: userText, timestamp: new Date().toISOString() },
      { type: "system", text: systemText, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_USER", "handleThemeApproval", userText);
    addLogEntry("UI_SYSTEM", "handleThemeApproval", systemText);
  };

  const handleAgendaChoice = (choice) => {
    setIncludeAgenda(choice);
    setAppStatus(APP_STATUS.SELECTING_SECTION_HEADERS);

    const userText = `アジェンダ: ${choice ? "はい" : "いいえ"}`;
    const systemText =
      "主要なセクションの前に区切りスライドを自動挿入しますか？";

    setMessages((prev) => [
      ...prev,
      { type: "user", text: userText, timestamp: new Date().toISOString() },
      { type: "system", text: systemText, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_USER", "handleAgendaChoice", userText);
    addLogEntry("UI_SYSTEM", "handleAgendaChoice", systemText);
  };

  const handleSectionHeaderChoice = async (useSectionHeaders) => {
    const userText = `セクションヘダー: ${useSectionHeaders ? "はい" : "いえ"}`;
    setMessages((prev) => [
      ...prev,
      { type: "user", text: userText, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_USER", "handleSectionHeaderChoice", userText);

    setAppStatus(APP_STATUS.GENERATING_OUTLINE);
    setIsProcessing(true);
    setProcessingStatus("構成案を生成中...");
    setApiErrorStep(null);

    const calculatedWaitTime = Math.max(
      5000,
      Math.min(180000, structuredMarkdown.length * 1.4)
    );
    setCurrentTotalWaitTime(calculatedWaitTime);
    const stepWaitTime = calculatedWaitTime / 5;

    // ★ callGeminiApiWrapper を使用
    const prompt = PROMPTS.createOutline(
      structuredMarkdown,
      includeAgenda,
      useSectionHeaders,
      documentContext
    );
    const apiPromise = callGeminiApiWrapper(
      prompt,
      "gemini-2.5-flash-lite",
      "構成案生成"
    );

    const dummyProgressPromise = (async () => {
      try {
        setThinkingState(OUTLINE_STEPS[0].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
        setThinkingState(OUTLINE_STEPS[1].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
        setThinkingState(OUTLINE_STEPS[2].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
        setThinkingState(OUTLINE_STEPS[3].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
        setThinkingState(OUTLINE_STEPS[4].key);
        await new Promise((resolve) => setTimeout(resolve, stepWaitTime));
      } catch (e) {
        console.error("Dummy progress failed", e);
      }
    })();

    try {
      const [result] = await Promise.all([apiPromise, dummyProgressPromise]);

      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0);

      if (result && !result.error) {
        let outline;
        try {
          outline = JSON.parse(result);
        } catch (error) {
          if (error.message.includes("escaped character")) {
            console.warn(
              "[WARN] JSON parse failed. Retrying with backslash fix..."
            );
            try {
              const fixedResult = result.replace(/\\/g, "\\\\");
              outline = JSON.parse(fixedResult);
              const text =
                "【自動修正】AIの応答形式(エスケープ文字)を修正しました。";
              setMessages((prev) => [
                ...prev,
                { type: "system", text, timestamp: new Date().toISOString() },
              ]);
              addLogEntry(
                "SYSTEM_AUTO_FIX",
                "handleSectionHeaderChoice (Parse)",
                text
              );
            } catch (fixError) {
              console.error("[FATAL] Backslash fix failed.", fixError);
              setApiErrorStep("outline");
              const text = `構成案の解析に失敗しました。AIの応答形式が不正です: ${error.message}`;
              setMessages((prev) => [
                ...prev,
                { type: "system", text, timestamp: new Date().toISOString() },
              ]);
              addLogEntry(
                "UI_SYSTEM_ERROR",
                "handleSectionHeaderChoice (Parse Fix 1)",
                text
              );
              return;
            }
          } else if (error.message.includes("Bad control character")) {
            console.warn(
              "[WARN] JSON parse failed due to bad control character. Retrying with newline/tab fix..."
            );
            try {
              const fixedResult = result.replace(/[\n\r\t]/g, " ");
              outline = JSON.parse(fixedResult);
              const text =
                "【自動修正】AIの応答形式(制御文字)を修正しました。改行が失われた可能性があります。";
              setMessages((prev) => [
                ...prev,
                { type: "system", text, timestamp: new Date().toISOString() },
              ]);
              addLogEntry(
                "SYSTEM_AUTO_FIX",
                "handleSectionHeaderChoice (Parse)",
                text
              );
            } catch (fixError) {
              console.error("[FATAL] Control character fix failed.", fixError);
              setApiErrorStep("outline");
              const text = `構成案の解析に失敗しました。AIの応答形式が不正です: ${error.message}`;
              setMessages((prev) => [
                ...prev,
                { type: "system", text, timestamp: new Date().toISOString() },
              ]);
              addLogEntry(
                "UI_SYSTEM_ERROR",
                "handleSectionHeaderChoice (Parse Fix 2)",
                text
              );
              return;
            }
          } else {
            setApiErrorStep("outline");
            const text = `構成案の解析に失敗しました。AIの応答形式が不正です: ${error.message}`;
            setMessages((prev) => [
              ...prev,
              { type: "system", text, timestamp: new Date().toISOString() },
            ]);
            addLogEntry(
              "UI_SYSTEM_ERROR",
              "handleSectionHeaderChoice (Parse)",
              text
            );
            return;
          }
        }

        // --- サニタイズ処理 ---
        const sanitizedOutline = outline.map((slide) => {
          const newSlide = { ...slide };
          if (newSlide.template === "content_basic") {
            if (
              (!newSlide.items ||
                (Array.isArray(newSlide.items) &&
                  newSlide.items.length === 0)) &&
              newSlide.summary &&
              typeof newSlide.summary === "string" &&
              newSlide.summary.trim().length > 0
            ) {
              const potentialItems = newSlide.summary.includes("\n")
                ? newSlide.summary.split("\n")
                : newSlide.summary.split(" ");
              newSlide.items = potentialItems
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            }
            newSlide.summary = "";
          } else if (
            ["three_points", "comparison", "vertical_steps"].includes(
              newSlide.template
            )
          ) {
            newSlide.summary = "";
          } else if (
            newSlide.template === "table_basic" ||
            newSlide.template === "highlighted_number"
          ) {
            if (typeof newSlide.summary !== "string") {
              newSlide.summary = "";
            }
          } else if (
            [
              "content_with_diagram",
              "title_slide",
              "agenda",
              "summary_or_thankyou",
            ].includes(newSlide.template)
          ) {
            if (
              (!newSlide.summary ||
                (typeof newSlide.summary === "string" &&
                  newSlide.summary.trim().length === 0)) &&
              newSlide.items &&
              Array.isArray(newSlide.items) &&
              newSlide.items.length > 0
            ) {
              const separator = newSlide.items.some((item) =>
                item.includes("\n")
              )
                ? "\n"
                : " ";
              newSlide.summary = newSlide.items.join(separator);
            }
            newSlide.items = null;
            newSlide.points = null;
            newSlide.columns = null;
            newSlide.table = null;
            if (typeof newSlide.summary !== "string") {
              newSlide.summary = "";
            }
          } else if (newSlide.template === "section_header") {
            newSlide.summary = "";
            newSlide.items = null;
            newSlide.points = null;
            newSlide.columns = null;
            newSlide.table = null;
          }
          return newSlide;
        });

        // ★ utils/sanitizers.js の関数を使用
        const newlineFixedOutline = sanitizeNewlines(sanitizedOutline);
        const {
          sanitizedOutline: guardedOutline,
          notification: guardNotification,
        } = sanitizeHighlightedNumbers(newlineFixedOutline);

        let finalOutline = [...guardedOutline];

        // --- ルールチェックと強制修正ロジック ---
        const agendaMaxItems = 6;
        let hasAgenda =
          finalOutline.length > 1 && finalOutline[1].template === "agenda";

        if (includeAgenda) {
          if (hasAgenda) {
            const targetAgenda = finalOutline[1];
            const items = (targetAgenda.summary || "").includes("\n")
              ? (targetAgenda.summary || "")
                  .split("\n")
                  .filter((item) => item.trim().length > 0)
              : (targetAgenda.summary || "")
                  .split(" ")
                  .filter((item) => item.trim().length > 0);

            if (items.length > agendaMaxItems) {
              const totalParts = Math.ceil(items.length / agendaMaxItems);
              const newAgendaSlides = [];
              const baseTitle = (targetAgenda.title || "アジェンダ").replace(
                /\s*\(\d+\/\d+\)\s*$/,
                ""
              );
              for (let i = 0; i < totalParts; i++) {
                const partItems = items.slice(
                  i * agendaMaxItems,
                  (i + 1) * agendaMaxItems
                );
                newAgendaSlides.push({
                  ...targetAgenda,
                  title: `${baseTitle} (${i + 1}/${totalParts})`,
                  summary: partItems.join("\n"),
                  items: null,
                  points: null,
                  columns: null,
                  table: null,
                  // ★ 追加: 開始番号を保存
                  agenda_start_number: i * agendaMaxItems,
                });
              }
              finalOutline.splice(1, 1, ...newAgendaSlides);
              const text =
                "【自動修正】アジェンダの項目数が多いため、スライドを自動的に分割しました。";
              setMessages((prev) => [
                ...prev,
                { type: "system", text, timestamp: new Date().toISOString() },
              ]);
              addLogEntry(
                "SYSTEM_AUTO_FIX",
                "handleSectionHeaderChoice (Agenda Split)",
                text
              );
            }
          }
          hasAgenda =
            finalOutline.length > 1 && finalOutline[1].template === "agenda";
          if (!hasAgenda) {
            const agendaItems = finalOutline
              .slice(1)
              .map((slide) => slide.title || "")
              .filter((title) => title.length > 0);
            const newAgendaItems =
              agendaItems.length > 0 ? agendaItems : ["(目次がありません)"];
            const totalParts = Math.ceil(
              newAgendaItems.length / agendaMaxItems
            );
            const newAgendaSlides = [];

            if (
              newAgendaItems.length === 0 ||
              (newAgendaItems.length === 1 &&
                newAgendaItems[0] === "(目次がありません)")
            ) {
              newAgendaSlides.push({
                title: "アジェンダ",
                summary: "(目次がありません)",
                template: "agenda",
                items: null,
                points: null,
                columns: null,
                table: null,
                agenda_start_number: 0, // ★ 追加
              });
            } else {
              for (let i = 0; i < totalParts; i++) {
                const partItems = newAgendaItems.slice(
                  i * agendaMaxItems,
                  (i + 1) * agendaMaxItems
                );
                newAgendaSlides.push({
                  title: `アジェンダ${
                    totalParts > 1 ? ` (${i + 1}/${totalParts})` : ""
                  }`,
                  summary: partItems.join("\n"),
                  template: "agenda",
                  items: null,
                  points: null,
                  columns: null,
                  table: null,
                  agenda_start_number: i * agendaMaxItems, // ★ 追加
                });
              }
            }
            finalOutline.splice(1, 0, ...newAgendaSlides);
            const text =
              "【自動修正】AIがアジェンダを生成しなかったため、2枚目に自動挿入しました。";
            setMessages((prev) => [
              ...prev,
              { type: "system", text, timestamp: new Date().toISOString() },
            ]);
            addLogEntry(
              "SYSTEM_AUTO_FIX",
              "handleSectionHeaderChoice (Agenda Add)",
              text
            );
          }
        } else {
          if (hasAgenda) {
            finalOutline.splice(1, 1);
            const text =
              "【自動修正】AIが不要なアジェンダを生成したため、2枚目から削除しました。";
            setMessages((prev) => [
              ...prev,
              { type: "system", text, timestamp: new Date().toISOString() },
            ]);
            addLogEntry(
              "SYSTEM_AUTO_FIX",
              "handleSectionHeaderChoice (Agenda Remove)",
              text
            );
          }
          finalOutline = finalOutline.filter(
            (slide, index) => index === 0 || slide.template !== "agenda"
          );
        }

        const maxTableRows = 7;
        let tableSplitOccurred = false;
        finalOutline = finalOutline.flatMap((slide) => {
          if (
            slide.template === "table_basic" &&
            slide.table &&
            Array.isArray(slide.table.rows) &&
            slide.table.rows.length > maxTableRows
          ) {
            tableSplitOccurred = true;
            const originalHeaders = slide.table.headers || [];
            const originalRows = slide.table.rows;
            const totalParts = Math.ceil(originalRows.length / maxTableRows);
            const baseTitle = (slide.title || "表").replace(
              /\s*\(\d+\/\d+\)\s*$/,
              ""
            );
            const newTableSlides = [];
            for (let i = 0; i < totalParts; i++) {
              const partRows = originalRows.slice(
                i * maxTableRows,
                (i + 1) * maxTableRows
              );
              newTableSlides.push({
                ...slide,
                title: `${baseTitle} (${i + 1}/${totalParts})`,
                table: {
                  headers: originalHeaders,
                  rows: partRows,
                },
                summary: "",
                items: null,
                points: null,
                columns: null,
              });
            }
            return newTableSlides;
          } else {
            return [slide];
          }
        });
        if (tableSplitOccurred) {
          const text =
            "【自動修正】表の行数が多いため、スライドを自動的に分割しました。";
          setMessages((prev) => [
            ...prev,
            { type: "system", text, timestamp: new Date().toISOString() },
          ]);
          addLogEntry(
            "SYSTEM_AUTO_FIX",
            "handleSectionHeaderChoice (Table Split)",
            text
          );
        }

        const hasSectionHeaders = finalOutline.some(
          (slide) => slide.template === "section_header"
        );
        if (useSectionHeaders) {
          if (!hasSectionHeaders) {
            const text =
              "【警告】セクションヘッダーの自動挿入（はい）を選択しましたが、AIが構成案に含めなかった可能性があります。構成案を確認してください。";
            setMessages((prev) => [
              ...prev,
              { type: "system", text, timestamp: new Date().toISOString() },
            ]);
            addLogEntry(
              "UI_SYSTEM_WARN",
              "handleSectionHeaderChoice (Section Header)",
              text
            );
          }
        } else {
          if (hasSectionHeaders) {
            finalOutline = finalOutline.filter(
              (slide, index) =>
                index === 0 || slide.template !== "section_header"
            );
            const text =
              "【自動修正】AIが不要なセクションヘダーを生成したため、構成案から削除しました。";
            setMessages((prev) => [
              ...prev,
              { type: "system", text, timestamp: new Date().toISOString() },
            ]);
            addLogEntry(
              "SYSTEM_AUTO_FIX",
              "handleSectionHeaderChoice (Section Header)",
              text
            );
          }
        }

        setSlideOutline(finalOutline);
        setAppStatus(APP_STATUS.OUTLINE_CREATED);

        if (guardNotification) {
          setMessages((prev) => [
            ...prev,
            {
              type: "system",
              text,
              guardNotification,
              timestamp: new Date().toISOString(),
            },
          ]);
          addLogEntry(
            "SYSTEM_AUTO_FIX",
            "handleSectionHeaderChoice (Guardrail)",
            guardNotification
          );
        }

        const text = "構成案を生成しました。内容を確認・編集してください。";
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM", "handleSectionHeaderChoice (Success)", text);
      } else {
        setApiErrorStep("outline");
        const text = result ? result.error : "予期せずエラーが発生しました。";
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM_ERROR", "handleSectionHeaderChoice (API)", text);
      }
    } catch (error) {
      console.error("[FATAL] Error during outline progress simulation:", error);
      setThinkingState(null);
      setIsProcessing(false);
      setCurrentTotalWaitTime(0);
      setApiErrorStep("outline");
      const text = `予期せぬエラーが発生しました: ${error.message}`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_FATAL", "handleSectionHeaderChoice (Catch)", text);
    }
  };

  const handleOutlineChange = (index, field, value) => {
    const newOutline = [...slideOutline];
    if (field === "infographic") {
      newOutline[index].infographic = value;
    } else if (field === "points") {
      newOutline[index].points = value;
    } else {
      newOutline[index][field] = value;
    }
    setSlideOutline(newOutline);
  };

  const handleDeleteSlide = (indexToDelete) => {
    setSlideOutline((prev) =>
      prev.filter((_, index) => index !== indexToDelete)
    );
  };

  const handleInsertSlide = (indexToInsertAfter) => {
    const newSlide = {
      title: "新しいスライド",
      summary: "ここに内容の要約を入力",
      template: "content_basic", // デフォルトを content_basic に変更 (infographic 不要なため)
    };
    const newOutline = [
      ...slideOutline.slice(0, indexToInsertAfter + 1),
      newSlide,
      ...slideOutline.slice(indexToInsertAfter + 1),
    ];
    setSlideOutline(newOutline);
  };

  const handleRegenerateOutline = () => {
    if (
      window.confirm(
        "現在の構成案を破棄し、最初から再生成します。よろしいですか？"
      )
    ) {
      const text = "構成案の再生成をリクエストしました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleRegenerateOutline", text);

      const lastChoiceText = messages
        .slice()
        .reverse()
        .find(
          (m) => m.type === "user" && m.text.includes("セクションヘッダー:")
        )?.text;
      const useSectionHeaders = lastChoiceText
        ? lastChoiceText.includes("はい")
        : false;

      handleSectionHeaderChoice(useSectionHeaders);
    }
  };

  const handleRegenerateSlideContent = async (slideIndex) => {
    setIsProcessing(true);
    setProcessingStatus("スライド内容を再生成中...");

    const targetSlide = slideOutline[slideIndex];
    const { title, template: newTemplateName } = targetSlide;

    const originalData = { ...targetSlide };
    delete originalData.title;
    delete originalData.template;
    if (newTemplateName !== "content_with_diagram") {
      delete originalData.infographic;
    }

    // (利用可能テンプレートの定義 - 簡略化)
    const availableTemplates = [
      {
        name: "content_basic",
        description: "`items` (文字列配列) が必要。`summary`は空にする。",
      },
      // ... (他のテンプレート定義) ...
    ];

    const prompt = PROMPTS.regenerateSlideContent(
      title,
      Object.keys(originalData).length > 0
        ? JSON.stringify(originalData)
        : "{}",
      newTemplateName,
      availableTemplates
    );

    // ★ callGeminiApiWrapper を使用
    const result = await callGeminiApiWrapper(
      prompt,
      "gemini-2.5-flash-lite",
      `スライド${slideIndex + 1}内容再生成`
    );

    if (result && !result.error) {
      try {
        const newContent = JSON.parse(result);

        setSlideOutline((prevOutline) => {
          const newOutline = [...prevOutline];
          const updatedSlide = { ...newOutline[slideIndex] };

          if (newTemplateName !== "content_basic") updatedSlide.items = null;
          if (newTemplateName !== "three_points") updatedSlide.points = null;
          if (newTemplateName !== "comparison") updatedSlide.columns = null;
          if (newTemplateName !== "table_basic") updatedSlide.table = null;

          Object.assign(updatedSlide, newContent);

          if (
            [
              "content_basic",
              "three_points",
              "comparison",
              "vertical_steps",
              "section_header",
              "table_basic",
            ].includes(newTemplateName)
          ) {
            updatedSlide.summary = "";
          }
          if (newTemplateName !== "math_basic") {
            updatedSlide.formula = null;
          }
          if (newTemplateName !== "content_with_diagram") {
            if (!newContent.infographic) {
              updatedSlide.infographic = null;
            }
          }

          newOutline[slideIndex] = updatedSlide;
          return newOutline;
        });

        const text = `スライド ${
          slideIndex + 1
        } の内容を ${newTemplateName} 形式で再生成しました。`;
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM", "handleRegenerateSlideContent", text);
      } catch (error) {
        const text = `内容の解析に失敗しました: ${error.message}`;
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry(
          "UI_SYSTEM_ERROR",
          "handleRegenerateSlideContent (Parse)",
          text
        );
      }
    } else {
      const text = result
        ? result.error
        : "内容の再生成中にエラーが発生しました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry(
        "UI_SYSTEM_ERROR",
        "handleRegenerateSlideContent (API)",
        text
      );
    }

    setIsProcessing(false);
  };

  const handleOpenModifyModal = (index) => {
    setModifyModalTarget({ index: index, mode: "single" });
    setModificationInput("");
    setIsModifyModalOpen(true);
  };

  const handleOpenModifyAllModal = () => {
    setModifyModalTarget({ index: null, mode: "all" });
    setModificationInput("");
    setIsModifyModalOpen(true);
  };

  const handleCloseModifyModal = () => {
    setIsModifyModalOpen(false);
    setModificationInput("");
  };

  const handleSubmitModification = async () => {
    const { index, mode } = modifyModalTarget;

    if (!modificationInput.trim()) {
      handleCloseModifyModal();
      return;
    }

    setIsProcessing(true);
    setApiErrorStep(null);
    let resultJson = null;

    // ★ callGeminiApiWrapper を使用
    if (mode === "all") {
      setProcessingStatus("構成案全体を修正中...");
      const prompt = PROMPTS.modifyFullOutline(
        JSON.stringify(slideOutline, null, 2),
        modificationInput
      );
      resultJson = await callGeminiApiWrapper(
        prompt,
        "gemini-2.5-flash-lite",
        "構成案全体修正"
      );
    } else if (mode === "single" && index !== null) {
      setProcessingStatus(`スライド ${index + 1} を修正中...`);
      const prompt = PROMPTS.modifySingleSlideOutline(
        JSON.stringify(slideOutline[index], null, 2),
        modificationInput
      );
      resultJson = await callGeminiApiWrapper(
        prompt,
        "gemini-2.5-flash-lite",
        `スライド${index + 1}修正`
      );
    }

    if (resultJson && !resultJson.error) {
      try {
        const parsedResult = JSON.parse(resultJson);
        let text = "";
        if (mode === "all") {
          setSlideOutline(parsedResult);
          text = "構成案全体を修正しました。";
        } else if (mode === "single" && index !== null) {
          setSlideOutline((prevOutline) => {
            const newOutline = [...prevOutline];
            newOutline[index] = parsedResult;
            return newOutline;
          });
          text = `スライド ${index + 1} を修正しました。`;
        }
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM", "handleSubmitModification", text);
      } catch (error) {
        const text = `修正結果の解析に失敗しました: ${error.message}`;
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry(
          "UI_SYSTEM_ERROR",
          "handleSubmitModification (Parse)",
          text
        );
      }
    } else {
      const text = resultJson
        ? resultJson.error
        : "修正中にエラーが発生しました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "handleSubmitModification (API)", text);
    }

    setIsProcessing(false);
    handleCloseModifyModal();
  };

  const handleReturnToOutline = () => {
    if (
      window.confirm(
        "現在のスライドプレビューを破棄し、構成案の編集画面に戻ります。\nこれまでに承認したスライドは保持されます。\n\nよろしいですか？"
      )
    ) {
      setCurrentSlideHtml("");
      setAppStatus(APP_STATUS.OUTLINE_CREATED);
      setScrollToIndex(currentSlideIndex);

      const text =
        "構成案の編集に戻りました。編集完了後、「構成案を承認し、スライド生成を開始する」ボタンを押してください。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleReturnToOutline", text);
    }
  };

  const handleStartGeneration = () => {
    const newOutline = slideOutline;
    const currentGeneratedCount = generatedSlides.length;

    let restartIndex = currentGeneratedCount;

    for (let i = 0; i < currentGeneratedCount; i++) {
      const oldSlideJSON = approvedOutlineSnapshot[i]
        ? JSON.stringify(approvedOutlineSnapshot[i])
        : null;
      const newSlideJSON = newOutline[i] ? JSON.stringify(newOutline[i]) : null;

      if (oldSlideJSON !== newSlideJSON) {
        restartIndex = i;
        break;
      }
    }

    if (restartIndex < currentGeneratedCount) {
      const text = `[INFO] スライド ${
        restartIndex + 1
      } の構成案に変更が検出されたため、${
        restartIndex + 1
      } 枚目以降のスライドを再生成します。`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("SYSTEM_EVENT", "handleStartGeneration (Diff)", text);

      setGeneratedSlides((prevSlides) => prevSlides.slice(0, restartIndex));
    }

    setApprovedOutlineSnapshot([...newOutline]);
    setCurrentSlideIndex(restartIndex);

    if (restartIndex < newOutline.length) {
      const text = `構成案承認済。\n**ステップ2: スライド生成**\n（スライド ${
        restartIndex + 1
      } から）生成を再開します。`;
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "system"),
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleStartGeneration", text);
      generateSlide(restartIndex); // generateSlide はこのファイル内で定義されている
    } else {
      setAppStatus(APP_STATUS.ALL_SLIDES_GENERATED);
      const text =
        "構成案の編集が完了し、全てのスライドが承認済みです。\nZIPファイルをダウンロードできます。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleStartGeneration (All Done)", text);
    }
  };

  const generateSlide = async (slideIndex) => {
    setAppStatus(APP_STATUS.GENERATING_SLIDES);
    const currentSlide = slideOutline[slideIndex];

    setIsProcessing(true);
    setProcessingStatus(
      `${slideIndex + 1}/${slideOutline.length}枚目を生成中...`
    );

    let finalHtml = "";

    try {
      setThinkingState("analyzing");
      await new Promise((resolve) => setTimeout(resolve, 800));

      const template = THEMES[selectedTheme].templates[currentSlide.template];
      if (!template)
        throw new Error(
          `テンプレート「${currentSlide.template}」がテーマ「${selectedTheme}」に見つかりません。`
        );

      // ログ出力用のヘルパー関数
      const parseAndLog = (rawMarkdown, options) => {
        const { parsedHtml, expectedBoldItems, failedItems } =
          parseMarkdownAndVerifyBold(rawMarkdown, options);
        const logContext = `Slide ${slideIndex + 1} (${
          options.context || "Unknown"
        })`;
        if (expectedBoldItems.length > 0) {
          if (failedItems.length === 0) {
            const successMsg = `[SUCCESS] Bold conversion OK. Items: [${expectedBoldItems.join(
              ", "
            )}]`;
            console.log(successMsg);
            addLogEntry("DEBUG_SUCCESS", logContext, successMsg);
          } else {
            const errorContext = {
              message: `[FAILED] Bold conversion error. Failed items: [${failedItems.join(
                ", "
              )}]`,
              failedItems: failedItems,
              expectedItems: expectedBoldItems,
              rawInput: rawMarkdown,
            };
            const errorMsgForConsole = `[FAILED] Bold conversion error. Failed items: [${failedItems.join(
              ", "
            )}]. Fallback applied.`;
            console.warn(errorMsgForConsole, errorContext);
            addLogEntry("DEBUG_WARN", logContext, errorContext);
          }
        }
        return parsedHtml;
      };

      const replacements = {
        "{theme_class}": `theme-${design}`,
        "{title}": currentSlide.title || "",
        "{summary}": parseAndLog(currentSlide.summary || "", {
          isInline: true,
          breaks: true,
          context: "summary",
        }),
        "{content}": parseAndLog(currentSlide.summary || "", {
          isInline: false,
          breaks: true,
          context: "content (from summary)",
        }),
        "{number}": currentSlide.number || "",
        "{description}": parseAndLog(currentSlide.description || "", {
          isInline: true,
          breaks: true,
          context: "description",
        }),
        "{content_title}": parseAndLog(currentSlide.content_title || "", {
          isInline: true,
          breaks: true,
          context: "content_title",
        }),
        "{formula}": "",
        "{infographic_svg}": "",
        "{agenda_items_html}": "",
        "{agenda_start_number}": String(currentSlide.agenda_start_number || 0),
        "{items_html}": "",
        "{comparison_columns_html}": "",
        "{table_html}": "",
        "{chart_data_json}": "{}",
      };

      if (currentSlide.infographic?.needed) {
        setThinkingState("designing");
        await new Promise((resolve) => setTimeout(resolve, 800));

        const svgPrompt = PROMPTS.generateInfographic(
          currentSlide.infographic.description,
          design
        );

        const infographicSvgResult = await callGeminiApiWrapper(
          svgPrompt,
          "gemini-2.5-flash-lite",
          `SVG for Slide ${slideIndex + 1}`
        );

        if (!infographicSvgResult || infographicSvgResult.error) {
          const errorMessage =
            infographicSvgResult?.error ||
            "インフォグラフィックSVGの生成に失敗しました。";
          console.error(errorMessage);
          throw new Error(errorMessage);
        }

        const sanitizedSvg = sanitizeSvg(infographicSvgResult);
        replacements["{infographic_svg}"] = sanitizedSvg;
      }

      if (
        ["three_points"].includes(currentSlide.template) &&
        Array.isArray(currentSlide.points)
      ) {
        setThinkingState("designing");
        await new Promise((resolve) => setTimeout(resolve, 800));

        const iconPromises = currentSlide.points.map((point) => {
          return getIconSvgWrapper(point);
        });

        const iconSvgs = await Promise.all(iconPromises);

        currentSlide.points.forEach((point, i) => {
          // ★ 修正: parseAndLog を使って Markdown を HTML に変換
          replacements[`{point_${i + 1}_title}`] = parseAndLog(
            point.title || "",
            {
              isInline: true,
              breaks: true,
              context: `point_${i + 1}_title`,
            }
          );
          replacements[`{point_${i + 1}_summary}`] = parseAndLog(
            point.summary || "",
            {
              isInline: true,
              breaks: true,
              context: `point_${i + 1}_summary`,
            }
          );
          replacements[`{icon_${i + 1}_svg}`] = iconSvgs[i] || ``;
        });
      }

      if (currentSlide.template === "agenda") {
        const agendaItems = currentSlide.summary
          .split("\n")
          .map((item, i) => {
            const textOnly = item.replace(/^\s*\d+\.\s*/, "");
            return `<li>${parseAndLog(textOnly || "", {
              isInline: true,
              breaks: true,
              context: `agenda_item_${i + 1}`,
            })}</li>`;
          })
          .join("");
        replacements["{agenda_items_html}"] = agendaItems;
      }

      if (currentSlide.template === "math_basic" && currentSlide.formula) {
        setThinkingState("designing");
        await new Promise((resolve) => setTimeout(resolve, 800));

        const markedWithKatex = new Marked();
        markedWithKatex.use(
          markedKatex({
            throwOnError: false,
          })
        );

        const formulaString = currentSlide.formula || "";
        const cleanedFormula = formulaString.replace(/\n/g, " ");

        replacements["{formula}"] = markedWithKatex.parse(cleanedFormula, {
          breaks: false,
        });
      }

      if (
        ["vertical_steps", "content_basic"].includes(currentSlide.template) &&
        Array.isArray(currentSlide.items)
      ) {
        setThinkingState("designing");
        await new Promise((resolve) => setTimeout(resolve, 800));

        let itemsHtml = "";
        if (currentSlide.template === "vertical_steps") {
          itemsHtml = currentSlide.items
            .map((item, i) => {
              // ★ 修正: parseAndLog を使用
              const cleanTitle = parseAndLog(item.title || "", {
                isInline: true,
                breaks: true,
                context: `step_${i + 1}_title`,
              });
              return `
                <div class="step">
                  <div class="step-marker">${i + 1}</div>
                  <h2>${cleanTitle}</h2>
                  <p>${parseAndLog(item.description || "", {
                    isInline: true,
                    breaks: true,
                    context: `step_${i + 1}_description`,
                  })}</p> 
                </div>
              `;
            })
            .join("");
        }
        replacements["{items_html}"] = itemsHtml;
      }

      if (
        currentSlide.template === "comparison" &&
        Array.isArray(currentSlide.columns)
      ) {
        const columnsHtml = currentSlide.columns
          .map((column, i) => {
            // ★ 修正: parseAndLog を使用
            const title = parseAndLog(column.title || "", {
              isInline: true,
              breaks: true,
              context: `column_${i + 1}_title`,
            });
            const itemsHtml = Array.isArray(column.items)
              ? column.items
                  .map((item, j) => {
                    return `<li>${parseAndLog(item || "", {
                      isInline: true,
                      breaks: true,
                      context: `column_${i + 1}_item_${j + 1}`,
                    })}</li>`;
                  })
                  .join("")
              : "";
            return `
                <div class="column">
                    <h2>${title}</h2>
                    <ul>${itemsHtml}</ul>
                </div>
            `;
          })
          .join("");
        replacements["{comparison_columns_html}"] = columnsHtml;
      }

      if (currentSlide.template === "table_basic" && currentSlide.table) {
        setThinkingState("designing");
        await new Promise((resolve) => setTimeout(resolve, 800));
        let tableHtml = "<thead><tr>";
        if (Array.isArray(currentSlide.table.headers)) {
          tableHtml += currentSlide.table.headers
            .map((header, i) => {
              return `<th>${parseAndLog(header || "", {
                isInline: true,
                breaks: true,
                context: `table_header_${i + 1}`,
              })}</th>`;
            })
            .join("");
        }
        tableHtml += "</tr></thead>";
        tableHtml += "<tbody>";
        if (Array.isArray(currentSlide.table.rows)) {
          tableHtml += currentSlide.table.rows
            .map((row, i) => {
              let rowHtml = "<tr>";
              rowHtml += row
                .map((cell, j) => {
                  return `<td>${parseAndLog(cell || "", {
                    isInline: true,
                    breaks: true,
                    context: `table_row_${i + 1}_cell_${j + 1}`,
                  })}</td>`;
                })
                .join("");
              rowHtml += "</tr>";
              return rowHtml;
            })
            .join("");
        }
        tableHtml += "</tbody>";
        replacements["{table_html}"] = tableHtml;
      }

      if (currentSlide.template === "bar_chart" && currentSlide.chart_data) {
        setThinkingState("designing");
        await new Promise((resolve) => setTimeout(resolve, 800));
        const logContext = `Slide ${slideIndex + 1} (bar_chart)`;
        const data = currentSlide.chart_data;
        const startMsg = "[START] bar_chart processing started.";
        console.log(startMsg, { context: logContext, receivedData: data });
        addLogEntry("DEBUG_INFO", logContext, {
          message: startMsg,
          receivedData: data,
        });
        const isValid =
          data &&
          Array.isArray(data.labels) &&
          Array.isArray(data.datasets) &&
          data.datasets.length > 0 &&
          data.datasets[0] &&
          Array.isArray(data.datasets[0].data);
        if (!isValid) {
          const errorMsg =
            "[FAILED] Invalid chart_data structure received from AI.";
          console.error(errorMsg, { context: logContext, receivedData: data });
          addLogEntry("DEBUG_ERROR", logContext, {
            message: errorMsg,
            receivedData: data,
          });
          replacements["{chart_data_json}"] = "{}";
        } else {
          const validMsgData = {
            message: "[VALID] chart_data structure is valid.",
            labelsCount: data.labels.length,
            datasetsCount: data.datasets.length,
            firstDatasetDataCount: data.datasets[0].data.length,
          };
          console.log(validMsgData.message, {
            context: logContext,
            details: validMsgData,
          });
          addLogEntry("DEBUG_INFO", logContext, validMsgData);
          try {
            const dataString = JSON.stringify(data)
              .replace(/</g, "\\u003c")
              .replace(/>/g, "\\u003e");
            replacements["{chart_data_json}"] = dataString;
            const successMsgData = {
              message: "[SUCCESS] JSON.stringify successful.",
              stringLength: dataString.length,
              preview: dataString.substring(0, 100) + "...",
            };
            console.log(successMsgData.message, {
              context: logContext,
              details: successMsgData,
            });
            addLogEntry("DEBUG_SUCCESS", logContext, successMsgData);
          } catch (error) {
            const errorMsg = `[FAILED] JSON.stringify failed. ${error.message}`;
            console.error(errorMsg, {
              context: logContext,
              error: error,
              receivedData: data,
            });
            addLogEntry("DEBUG_ERROR", logContext, {
              message: errorMsg,
              error: error,
              receivedData: data,
            });
          }
        }
      }

      setThinkingState("coding");
      await new Promise((resolve) => setTimeout(resolve, 800));

      finalHtml = Object.entries(replacements).reduce((acc, [key, value]) => {
        const regex = new RegExp(
          key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g"
        );
        return acc.replace(regex, value);
      }, template);

      const text = `スライド「${currentSlide.title}」が生成されました。\nプレビューで確認し、承認してください。`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "generateSlide", text);
    } catch (error) {
      console.error("Slide generation failed:", error);
      finalHtml = "";
      const text = `スライド生成に失敗しました: ${error.message}。「承認して次へ」ボタンで再試行できます。`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "generateSlide (Catch)", text);
    } finally {
      setThinkingState(null);
      setIsProcessing(false);
      setCurrentSlideHtml(finalHtml);
      setAppStatus(APP_STATUS.SLIDE_GENERATED);
    }
  };

  const modifySlide = async (modificationRequest) => {
    setIsProcessing(true);
    setProcessingStatus(`スライド ${currentSlideIndex + 1} を修正中...`);

    // ★ callGeminiApiWrapper を使用
    const prompt = PROMPTS.modifySlide(modificationRequest, currentSlideHtml);
    const jsonResponse = await callGeminiApiWrapper(
      prompt,
      "gemini-2.5-flash-lite",
      `スライド${currentSlideIndex + 1}修正`
    );

    setIsProcessing(false);
    if (jsonResponse) {
      try {
        const result = JSON.parse(jsonResponse);
        if (result.html && result.changes) {
          setCurrentSlideHtml(result.html);
          const changesMessage = `スライドを修正しました。\n\n**変更点:**\n${result.changes}`;
          setMessages((prev) => [
            ...prev,
            {
              type: "system",
              text: changesMessage,
              timestamp: new Date().toISOString(),
            },
          ]);
          addLogEntry("UI_SYSTEM", "modifySlide", changesMessage);
        } else {
          throw new Error("Invalid JSON structure from API.");
        }
      } catch (error) {
        console.error(
          "Failed to parse JSON response for slide modification:",
          error
        );
        const text = `スライドの修正結果を解析できませんでした。内容が予期せぬ形式です。`;
        setMessages((prev) => [
          ...prev,
          { type: "system", text, timestamp: new Date().toISOString() },
        ]);
        addLogEntry("UI_SYSTEM_ERROR", "modifySlide (Parse)", text);
      }
    }
  };

  const handlePreview = () => {
    if (!currentSlideHtml) return;
    const blob = new Blob([currentSlideHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleApproveAndNext = () => {
    if (!currentSlideHtml) {
      const text = `スライド生成を再試行します。`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_INFO", "handleApproveAndNext (Retry)", text);
      generateSlide(currentSlideIndex);
      return;
    }

    const newGeneratedSlides = [...generatedSlides, currentSlideHtml];
    setGeneratedSlides(newGeneratedSlides);
    setCurrentSlideHtml("");

    const nextIndex = currentSlideIndex + 1;
    if (nextIndex < slideOutline.length) {
      setCurrentSlideIndex(nextIndex);
      const nextSlide = slideOutline[nextIndex];
      const text = `スライド ${
        currentSlideIndex + 1
      } を承認しました。\n次のスライド「${
        nextSlide.title
      }」の生成を開始します。`;
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "system"),
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleApproveAndNext", text);
      generateSlide(nextIndex);
    } else {
      setAppStatus(APP_STATUS.ALL_SLIDES_GENERATED);
      const text =
        "全てのステップが完了しました！\n下のボタンからZIPファイルをダウンロードできます。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleApproveAndNext (All Done)", text);
    }
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    setProcessingStatus("ZIPファイルを生成中...");
    addLogEntry("SYSTEM_EVENT", "handleDownloadZip", "ZIP generation started.");
    try {
      const zip = new JSZip();
      generatedSlides.forEach((html, index) => {
        zip.file(`s${index + 1}.html`, html);
      });
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "slides.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addLogEntry(
        "SYSTEM_EVENT",
        "handleDownloadZip",
        "ZIP generation success."
      );
    } catch (error) {
      const text = `ZIPファイル生成中にエラーが発生しました: ${error.message}`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "handleDownloadZip", text);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (generatedSlides.length === 0) {
      const text = "PDF化するスライドがありません。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_WARN", "handleDownloadPdf", text);
      return;
    }

    const BACKEND_URL = import.meta.env.VITE_PDF_BACKEND_URL;

    if (!BACKEND_URL || BACKEND_URL.includes("your-cloud-run-service-url")) {
      const text =
        "エラー: PDFバックエンドURL(VITE_PDF_BACKEND_URL)が設定されていません。 .envファイルを確認してください。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "handleDownloadPdf", text);
      return;
    }

    setIsGeneratingPdf(true);
    setProcessingStatus("PDFを生成中... (最大1〜2分かかります)");
    const text = "バックエンドにPDF生成をリクエストしました...";
    setMessages((prev) => [
      ...prev,
      { type: "system", text, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM", "handleDownloadPdf", text);

    console.log("[INFO] PDFバックエンドへのリクエストURL:", BACKEND_URL);
    addLogEntry(
      "SYSTEM_EVENT",
      "handleDownloadPdf",
      `Requesting PDF from: ${BACKEND_URL}`
    );

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ htmls: generatedSlides }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF生成に失敗しました: ${errorText}`);
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "merged_slides.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const text = "PDFのダウンロードが完了しました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleDownloadPdf", text);
    } catch (error) {
      console.error("PDF Download failed:", error);
      const text = `PDF生成エラー: ${error.message}`;
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_ERROR", "handleDownloadPdf", text);
    } finally {
      setIsGeneratingPdf(false);
      setProcessingStatus("");
    }
  };

  const handleDownloadChatLog = async () => {
    if (debugLog.length === 0) {
      const text = "ログはまだありません。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM_WARN", "handleDownloadChatLog", text);
      return;
    }

    addLogEntry("SYSTEM_EVENT", "handleDownloadChatLog", "Log copy triggered.");

    let logContent = "--- スライド作成ジェネレーター デバッグログ ---\n\n";

    debugLog.forEach((entry) => {
      logContent += "========================================\n";
      logContent += `[Timestamp]: ${entry.timestamp}\n`;
      logContent += `[Type]:      ${entry.type}\n`;
      logContent += `[Context]:   ${entry.context}\n`;
      logContent += "---------------- Data --------------------\n";

      if (typeof entry.data === "object") {
        try {
          logContent += JSON.stringify(entry.data, null, 2);
        } catch (e) {
          logContent += "[Error] Failed to stringify object data.";
        }
      } else {
        logContent += String(entry.data);
      }
      logContent += "\n========================================\n\n";
    });

    try {
      await navigator.clipboard.writeText(logContent);
      const text = "デバッグログをクリップボードにコピーしました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry("UI_SYSTEM", "handleDownloadChatLog (Success)", text);
    } catch (err) {
      console.error("Failed to copy log to clipboard:", err);
      const text = "クリップボードへのコピーに失敗しました。";
      setMessages((prev) => [
        ...prev,
        { type: "system", text, timestamp: new Date().toISOString() },
      ]);
      addLogEntry(
        "UI_SYSTEM_ERROR",
        "handleDownloadChatLog (Error)",
        err.message
      );
    }
  };

  const handleRegenerateCurrentSlide = () => {
    if (appStatus !== APP_STATUS.SLIDE_GENERATED) return;

    const slideTitle = slideOutline[currentSlideIndex]?.title || "";
    const text = `スライド「${slideTitle}」を再生成します。`;
    setMessages((prev) => [
      ...prev,
      { type: "system", text, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM", "handleRegenerateCurrentSlide", text);

    setCurrentSlideHtml("");
    generateSlide(currentSlideIndex);
  };

  const handleSendMessage = () => {
    if (!userInput.trim() || appStatus !== APP_STATUS.SLIDE_GENERATED) return;
    setMessages((prev) => [
      ...prev,
      { type: "user", text: userInput, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_USER", "handleSendMessage (Modify Slide)", userInput);
    modifySlide(userInput);
    setUserInput("");
  };

  const handleOpenCodeEditor = () => {
    setEditableHtml(currentSlideHtml);
    setIsCodeEditorOpen(true);
  };

  const handleApplyCodeChanges = () => {
    setCurrentSlideHtml(editableHtml);
    setIsCodeEditorOpen(false);
    const text = "手動での変更が適用されました。プレビューで確認してください。";
    setMessages((prev) => [
      ...prev,
      { type: "system", text, timestamp: new Date().toISOString() },
    ]);
    addLogEntry("UI_SYSTEM", "handleApplyCodeChanges", text);
  };

  const handleCancelCodeEdit = () => {
    setIsCodeEditorOpen(false);
    setEditableHtml("");
  };

  // --- Return (App.jsx に渡す値) ---
  return {
    // 状態 (State)
    apiKey,
    isApiKeyModalOpen,
    tempApiKey,
    appStatus,
    messages,
    debugLog,
    userInput,
    fileName,
    originalExtractedText,
    structuredMarkdown,
    slideOutline,
    isProcessing,
    processingStatus,
    apiErrorStep,
    selectedTheme,
    design,
    includeAgenda,
    currentSlideIndex,
    generatedSlides,
    currentSlideHtml,
    isCodeEditorOpen,
    editableHtml,
    isModifyModalOpen,
    modificationInput,
    modifyModalTarget,
    approvedOutlineSnapshot,
    documentContext,
    thinkingState,
    currentTotalWaitTime,
    isGeneratingPdf,
    scrollToIndex,

    // 参照 (Ref)
    chatEndRef,

    // ハンドラ (Functions)
    setApiKey,
    setIsApiKeyModalOpen,
    setTempApiKey,
    setAppStatus,
    setMessages,
    setDebugLog,
    setUserInput,
    setFileName,
    setOriginalExtractedText,
    setStructuredMarkdown,
    setSlideOutline,
    setIsProcessing,
    setProcessingStatus,
    setApiErrorStep,
    setSelectedTheme,
    setDesign,
    setIncludeAgenda,
    setCurrentSlideIndex,
    setGeneratedSlides,
    setCurrentSlideHtml,
    setIsCodeEditorOpen,
    setEditableHtml,
    setIsModifyModalOpen,
    setModificationInput,
    setModifyModalTarget,
    setApprovedOutlineSnapshot,
    setDocumentContext,
    setThinkingState,
    setCurrentTotalWaitTime,
    setIsGeneratingPdf,
    setScrollToIndex,

    addLogEntry,
    handleApiKeySave,
    handleRetry,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    onTextExtracted,
    handleRegenerateStructure,
    handleMarkdownApproval,
    handleThemeSelection,
    handleDesignSelection,
    handleThemeApproval,
    handleAgendaChoice,
    handleSectionHeaderChoice,
    handleOutlineChange,
    handleDeleteSlide,
    handleInsertSlide,
    handleRegenerateOutline,
    handleRegenerateSlideContent,
    handleOpenModifyModal,
    handleOpenModifyAllModal,
    handleCloseModifyModal,
    handleSubmitModification,
    handleReturnToOutline,
    handleStartGeneration,
    generateSlide,
    modifySlide,
    handlePreview,
    handleApproveAndNext,
    handleDownloadZip,
    handleDownloadPdf,
    handleDownloadChatLog,
    handleRegenerateCurrentSlide,
    handleSendMessage,
    handleOpenCodeEditor,
    handleApplyCodeChanges,
    handleCancelCodeEdit,
  };
};
