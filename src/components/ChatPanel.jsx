import React, { useState, useEffect, useRef } from 'react';

// Step 1 で分離した定数をインポート
import { APP_STATUS } from '../constants/appStatus';
import { SLIDE_GENERATION_STEPS } from '../constants/steps';

// Step 3 で作成したファイルからインポート
import { ProcessingTracker, SendIcon } from './CommonComponents';

// テンプレート（THEMES）は OutlineEditor で使用するためインポート
import { THEMES } from '../templates';

// --- 内部コンポーネント (App.jsx から移動) ---
// (注: これらのコンポーネントは ChatPanel.jsx 内部でのみ使用されるため、export しません)

const MessageList = ({ messages }) => (
  <div className="flex-grow p-6 overflow-y-auto space-y-4">
    {messages.map((msg, index) => (
      <div key={index} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`px-4 py-2 rounded-lg max-w-2xl ${msg.type === 'user' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
        </div>
      </div>
    ))}
  </div>
);

const MarkdownEditor = ({ markdown, setMarkdown, onApprove, onRegenerate }) => (
  <div className="bg-black/20 p-4 rounded-lg">
    <p className="text-sm text-gray-300 mb-2">以下に構造化されたテキスト案を表示します。内容を確認し、必要であれば直接編集してください。</p>
    <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} className="w-full h-64 bg-gray-900/50 border border-white/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-mono" />
    <div className="flex justify-between items-center mt-4"> 
      <button 
        onClick={onRegenerate} 
        className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors"
      >
        AIで再生成
      </button>
      <button 
        onClick={onApprove} 
        className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors"
      >
        内容を承認して次へ進む
      </button>
    </div>
  </div>
);

const ThemeSelector = ({ selectedTheme, selectedDesign, onThemeSelect, onDesignSelect, onApprove }) => (
  <div className="bg-black/20 p-4 rounded-lg space-y-4">
    <div className="flex justify-center items-center space-x-4">
      <p className="text-sm text-gray-300">1. プレゼンテーションのテーマを選択:</p>
      {Object.entries(THEMES).map(([themeKey, themeValue]) => (
        <button
          key={themeKey}
          onClick={() => onThemeSelect(themeKey)}
          className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${selectedTheme === themeKey ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {themeValue.name}
        </button>
      ))}
    </div>
    <div className="flex justify-center items-center space-x-4 border-t border-white/10 pt-4">
       <p className="text-sm text-gray-300">2. デザインを選択:</p>
       <button
          onClick={() => onDesignSelect('dark')}
          className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${selectedDesign === 'dark' ? 'bg-gray-800 ring-2 ring-indigo-400' : 'bg-gray-800 hover:bg-gray-700'}`}
        >
          ダーク
        </button>
        <button
          onClick={() => onDesignSelect('light')}
          className={`px-6 py-2 text-black text-sm font-medium rounded-md transition-colors ${selectedDesign === 'light' ? 'bg-gray-200 ring-2 ring-indigo-400' : 'bg-gray-200 hover:bg-gray-300'}`}
        >
          ライト
        </button>
    </div>
    <div className="flex justify-end pt-2">
       <button onClick={onApprove} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors">決定して次へ</button>
    </div>
  </div>
);

const AgendaSelector = ({ onSelect }) => (
  <div className="bg-black/20 p-4 rounded-lg flex justify-center items-center space-x-4">
    <p className="text-sm text-gray-300">アジェンダページを挿入しますか？</p>
    <button onClick={() => onSelect(true)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors">はい</button>
    <button onClick={() => onSelect(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors">いいえ</button>
  </div>
);

const SectionHeaderSelector = ({ onSelect }) => (
  <div className="bg-black/20 p-4 rounded-lg flex justify-center items-center space-x-4">
    <p className="text-sm text-gray-300">主要なセクションの前に区切りスライドを自動挿入しますか？</p>
    <button onClick={() => onSelect(true)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors">はい</button>
    <button onClick={() => onSelect(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors">いいえ</button>
  </div>
);

const OutlineEditor = ({ outline, onChange, onInsert, onDelete, onStart, selectedTheme, onRegenerate, onRegenerateContent, onModifySlide, onModifyAll, scrollToIndex, onScrollComplete }) => {
  // (★注: scrollToIndex と onScrollComplete のロジックは、
  // このコンポーネントの内部 (useEffect) で処理する必要があります)
  const outlineContainerRef = useRef(null);
  
  useEffect(() => {
    if (scrollToIndex !== null && outlineContainerRef.current) {
      const slideElement = outlineContainerRef.current.children[scrollToIndex];
      if (slideElement) {
        slideElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // スクロールアニメーション後にフォーカスを当てる (任意)
        setTimeout(() => {
          const input = slideElement.querySelector('input[type="text"]');
          if(input) input.focus();
          onScrollComplete(); // スクロール完了を通知
        }, 500); // スクロール時間(500ms)
      } else {
        onScrollComplete(); // 要素がない場合もリセット
      }
    }
  }, [scrollToIndex, onScrollComplete]);

  // (以下、OutlineEditorの残りのロジック: handleTableChange, handlePointChange など)
  // ... (App.jsx から OutlineEditor の全ロジックをここに貼り付け) ...
  const handleTableChange = (slideIndex, field, value) => {
    const newOutline = [...outline];
    const newTable = { ...(newOutline[slideIndex].table || { headers: [], rows: [] }) };
    if (field === 'headers') {
      newTable.headers = value.split(',').map(h => h.trim());
    }
    onChange(slideIndex, 'table', newTable);
  };
  const handleTableRowsChange = (slideIndex, value) => {
    const newOutline = [...outline];
    const newTable = { ...(newOutline[slideIndex].table || { headers: [], rows: [] }) };
    newTable.rows = value.split('\n').map(row => row.split(',').map(cell => cell.trim()));
    onChange(slideIndex, 'table', newTable);
  };
  const handlePointChange = (slideIndex, pointIndex, field, value) => {
    const newOutline = [...outline];
    const newPoints = [...(newOutline[slideIndex].points || [])];
    newPoints[pointIndex] = { ...newPoints[pointIndex], [field]: value };
    onChange(slideIndex, 'points', newPoints);
  };
  const handleItemChange = (slideIndex, itemIndex, field, value) => {
    const newOutline = [...outline];
    const newItems = [...(newOutline[slideIndex].items || [])];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    onChange(slideIndex, 'items', newItems);
  };
  const handleColumnChange = (slideIndex, colIndex, field, value) => {
    const newOutline = [...outline];
    const newColumns = [...(newOutline[slideIndex].columns || [{}, {}])];
    newColumns[colIndex] = { ...newColumns[colIndex], [field]: value };
    onChange(slideIndex, 'columns', newColumns);
  };
  const handleColumnItemChange = (slideIndex, colIndex, itemIndex, value) => {
    const newOutline = [...outline];
    const newColumns = [...(newOutline[slideIndex].columns || [{}, {}])];
    const newItems = [...(newColumns[colIndex].items || [])];
    newItems[itemIndex] = value;
    newColumns[colIndex] = { ...newColumns[colIndex], items: newItems };
    onChange(slideIndex, 'columns', newColumns);
  };
  const handleAddColumnItem = (slideIndex, colIndex) => {
    const newOutline = [...outline];
    const currentColumns = newOutline[slideIndex].columns || [{}, {}]; 
    const newColumns = [...currentColumns];
    if (!newColumns[colIndex]) {
        newColumns[colIndex] = { title: "", items: [] };
    }
    const newItems = [...(newColumns[colIndex].items || []), "新しい項目"];
    newColumns[colIndex] = { ...newColumns[colIndex], items: newItems };
    onChange(slideIndex, 'columns', newColumns);
  };
  const handleAddColumn = (slideIndex) => {
      const newOutline = [...outline];
      const currentColumns = newOutline[slideIndex].columns || [];
      if (currentColumns.length >= 4) {
          alert('比較項目は最大4つまでです。');
          return;
      }
      const newColumns = [...currentColumns, { title: "新しいカラム", items: ["新しい項目"] }];
      onChange(slideIndex, 'columns', newColumns);
  };
  const handleRemoveColumn = (slideIndex, colIndexToRemove) => {
      const newOutline = [...outline];
      const currentColumns = newOutline[slideIndex].columns || [];
      if (currentColumns.length <= 2) {
          alert('比較項目は最低2つ必要です。');
          return;
      }
      const newColumns = currentColumns.filter((_, index) => index !== colIndexToRemove);
      onChange(slideIndex, 'columns', newColumns);
  };

  const availableTemplates = THEMES[selectedTheme]?.templates ? Object.keys(THEMES[selectedTheme].templates) : [];

  return (
    <div className="bg-black/20 p-4 rounded-lg space-y-4">
      <p className="text-sm text-gray-300 mb-2 font-semibold">構成案が生成されました。内容を編集し、スライドの追加や削除ができます。</p>
      {/* ★ ref をコンテナに設定 */}
      <div ref={outlineContainerRef} className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
        {outline.map((slide, index) => (
          // (App.jsx から OutlineEditor の <div key={index}... 以下のJSXをすべてここに貼り付け)
          <div key={index} className="bg-gray-900/50 border border-white/10 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">スライド {index + 1} - タイトル</label>
                <input type="text" value={slide.title} onChange={(e) => onChange(index, 'title', e.target.value)} className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">レイアウトテンプレート</label>
                <div className="flex items-center space-x-2">
                  <select 
                    value={slide.template || ''} 
                    onChange={(e) => onChange(index, 'template', e.target.value)} 
                    className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableTemplates.map(templateName => (
                      <option key={templateName} value={templateName}>{templateName}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => onRegenerateContent(index)}
                    title="現在のスライド情報（タイトルなど）を基に、選択中のテンプレートに合わせてAIで内容を再生成します。"
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors flex-shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* --- 各テンプレートの編集UI --- */}
            {['three_points'].includes(slide.template) ? (
              <div className="space-y-3 mt-3">
                {slide.points?.map((point, pointIndex) => (
                  <div key={pointIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                    <label className="text-xs font-bold text-gray-400 mb-2 block">ポイント {pointIndex + 1} - タイトル</label>
                    <input type="text" value={point.title} onChange={(e) => handlePointChange(index, pointIndex, 'title', e.target.value)} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">ポイント {pointIndex + 1} - 内容</label>
                    <textarea value={point.summary} onChange={(e) => handlePointChange(index, pointIndex, 'summary', e.target.value)} rows={2} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                    <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">ポイント {pointIndex + 1} - アイコン指示</label>
                    <textarea value={point.icon_description} onChange={(e) => handlePointChange(index, pointIndex, 'icon_description', e.target.value)} rows={2} className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  </div>
                ))}
              </div>
            ) : ['vertical_steps', 'content_basic'].includes(slide.template) ? (
              <div className="space-y-3 mt-3">
                {slide.template === 'content_basic' ? (
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-2 block">箇条書き項目 (1行に1項目)</label>
                    <textarea 
                      value={Array.isArray(slide.items) ? slide.items.join('\n') : ''} 
                      onChange={(e) => onChange(index, 'items', e.target.value.split('\n'))} 
                      rows={5} 
                      className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  </div>
                ) : (
                  slide.items?.map((item, itemIndex) => (
                    <div key={itemIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                      <label className="text-xs font-bold text-gray-400 mb-2 block">項目 {itemIndex + 1} - タイトル</label>
                      <input 
                        type="text" 
                        value={item.title || ''} 
                        onChange={(e) => handleItemChange(index, itemIndex, 'title', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      />
                      <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">項目 {itemIndex + 1} - 説明</label>
                      <textarea 
                        value={item.description || item.summary || ''} 
                        onChange={(e) => handleItemChange(index, itemIndex, 'description', e.target.value)} 
                        rows={2} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                      />
                    </div>
                  ))
                )}
              </div>
            ) : slide.template === 'comparison' ? (
              <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                      {slide.columns?.map((col, colIndex) => (
                          <div key={colIndex} className="bg-gray-800/50 p-3 rounded-md border border-white/10 relative">
                              {slide.columns.length > 2 && (
                                  <button 
                                      onClick={() => handleRemoveColumn(index, colIndex)}
                                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-700 hover:bg-red-600 rounded-full text-white text-xs font-bold flex items-center justify-center"
                                      title="このカラムを削除"
                                  >
                                      ×
                                  </button>
                              )}
                          
                              <label className="text-xs font-bold text-gray-400 mb-2 block">カラム {colIndex + 1} - タイトル</label>
                              <input 
                                  type="text" 
                                  value={col.title || ''} 
                                  onChange={(e) => handleColumnChange(index, colIndex, 'title', e.target.value)} 
                                  className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                              />
                              <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">カラム {colIndex + 1} - 箇条書き項目</label>
                              
                              {col.items?.map((item, itemIndex) => (
                                  <input
                                      key={itemIndex}
                                      type="text"
                                      value={item}
                                      onChange={(e) => handleColumnItemChange(index, colIndex, itemIndex, e.target.value)}
                                      className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-1"
                                      placeholder="例: **価格**：10,000円"
                                  />
                              ))}
                              <button onClick={() => handleAddColumnItem(index, colIndex)} className="mt-2 text-xs px-2 py-1 bg-sky-700 hover:bg-sky-600 rounded">項目を追加</button>
                          </div>
                      ))}
                  </div>
                  {(slide.columns?.length || 0) < 4 && (
                      <div className="text-center">
                          <button 
                              onClick={() => handleAddColumn(index)}
                              className="mt-2 text-sm px-4 py-2 bg-green-700 hover:bg-green-600 rounded"
                          >
                              比較カラムを追加 (最大4)
                          </button>
                      </div>
                  )}
              </div>
            ) : slide.template === 'table_basic' ? (
                <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  <label className="text-xs font-bold text-gray-400 mb-2 block">テーブルヘッダー (カンマ区切り)</label>
                  <input
                    type="text"
                    value={Array.isArray(slide.table?.headers) ? slide.table.headers.join(', ') : ''}
                    onChange={(e) => handleTableChange(index, 'headers', e.target.value)}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">テーブル行 (1行に1レコード、セルはカンマ区切り)</label>
                  <textarea
                    value={Array.isArray(slide.table?.rows) ? slide.table.rows.map(row => row.join(', ')).join('\n') : ''}
                    onChange={(e) => handleTableRowsChange(index, e.target.value)}
                    rows={5}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <div>
                    <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">表の解説文 (Summary)</label>
                    <textarea 
                      value={slide.summary || ''} 
                      onChange={(e) => onChange(index, 'summary', e.target.value)} 
                      rows={3} 
                      className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                      placeholder="表の補足説明や解説文をMarkdown形式で入力..."
                    />
                  </div>
                </div>
              </div>
          ) : slide.template === 'bar_chart' ? (
              <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  <label className="text-xs font-bold text-gray-400 mb-2 block">
                    グラフデータセット名 (例: 進捗率 (%))
                  </label>
                  <input
                    type="text"
                    value={slide.chart_data?.datasets?.[0]?.label || ''}
                    onChange={(e) => {
                      const newChartData = { ...(slide.chart_data || {}) };
                      if (!newChartData.datasets) newChartData.datasets = [{}];
                      newChartData.datasets[0] = { ...newChartData.datasets[0], label: e.target.value };
                      onChange(index, 'chart_data', newChartData);
                    }}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">
                    X軸 ラベル (カンマ区切り)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(slide.chart_data?.labels) ? slide.chart_data.labels.join(', ') : ''}
                    onChange={(e) => {
                      const newChartData = { ...(slide.chart_data || {}) };
                      newChartData.labels = e.target.value.split(',').map(s => s.trim());
                      onChange(index, 'chart_data', newChartData);
                    }}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="例: カテゴリA, カテゴリB, カテゴリC"
                  />
                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">
                    Y軸 データ (カンマ区切り、数値のみ)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(slide.chart_data?.datasets?.[0]?.data) ? slide.chart_data.datasets[0].data.join(', ') : ''}
                    onChange={(e) => {
                      const newChartData = { ...(slide.chart_data || {}) };
                      if (!newChartData.datasets) newChartData.datasets = [{}];
                      const dataAsNumbers = e.target.value.split(',').map(s => parseFloat(s.trim()) || 0);
                      newChartData.datasets[0] = { ...newChartData.datasets[0], data: dataAsNumbers };
                      onChange(index, 'chart_data', newChartData);
                    }}
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="例: 75, 50, 90"
                  />
                </div>
              </div>  
          ) : slide.template === 'math_basic' ? (
              <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  <label className="text-xs font-bold text-gray-400 mb-2 block">解説文 (Summary)</label>
                  <textarea 
                    value={slide.summary || ''} 
                    onChange={(e) => onChange(index, 'summary', e.target.value)} 
                    rows={4} 
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                    placeholder="数式の解説文をMarkdown形式で入力..."
                  />
                  <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">数式 (Formula) - KaTeX形式</label>
                  <textarea 
                    value={slide.formula || ''} 
                    onChange={(e) => onChange(index, 'formula', e.target.value)} 
                    rows={3} 
                    className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                    placeholder="例: $$ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} $$"
                  />
                </div>
              </div>
            ) : slide.template === 'highlighted_number' ? (
              <div className="space-y-3 mt-3">
                <div className="bg-gray-800/50 p-3 rounded-md border border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-2 block">左: 強調する数値 (Number)</label>
                      <input 
                        type="text" 
                        value={slide.number || ''} 
                        onChange={(e) => onChange(index, 'number', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="例: 98%"
                      />
                      <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">左: 数値の説明 (Description)</label>
                      <input 
                        type="text" 
                        value={slide.description || ''} 
                        onChange={(e) => onChange(index, 'description', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="例: 売上達成率"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-2 block">右: 見出し (Content Title)</label>
                      <input 
                        type="text" 
                        value={slide.content_title || ''} 
                        onChange={(e) => onChange(index, 'content_title', e.target.value)} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="例: 単一の重要数値"
                      />
                      <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">右: 補足説明文 (Summary)</label>
                      <textarea 
                        value={slide.summary || ''} 
                        onChange={(e) => onChange(index, 'summary', e.target.value)} 
                        rows={3} 
                        className="w-full bg-gray-700/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                        placeholder="右側の補足説明文..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : slide.template === 'quote' ? (
              <div>
                <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">引用文・キラーフレーズ (Summary)</label>
                <textarea 
                  value={slide.summary || ''} 
                  onChange={(e) => onChange(index, 'summary', e.target.value)} 
                  rows={3} 
                  className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                  placeholder="例: 「我々の最適解は、Aプランである」"
                />
                <label className="text-xs font-bold text-gray-400 mt-2 mb-2 block">補足文 (Description)</label>
                <input 
                  type="text" 
                  value={slide.description || ''} 
                  onChange={(e) => onChange(index, 'description', e.target.value)} 
                  className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="例: − キラーフレーズの補足説明"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">スライド {index + 1} - 要約（またはコンテンツ）</label>
                <textarea value={slide.summary} onChange={(e) => onChange(index, 'summary', e.target.value)} rows={3} className="w-full bg-gray-800/60 border border-white/20 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                {slide.infographic?.needed && (
                   <div>
                      <label className="text-xs font-bold text-gray-400 mt-3 mb-2 block">インフォグラフィック詳細指示</label>
                      <textarea value={slide.infographic.description} onChange={(e) => onChange(index, 'infographic', { ...slide.infographic, description: e.target.value })} rows={3} className="w-full bg-indigo-900/30 border border-indigo-500/50 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                   </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-white/10">
              <button 
                onClick={() => onModifySlide(index)}
                title="このスライドについてAIに修正指示を出す"
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium rounded-md transition-colors"
              >
                AIで修正
              </button>
              <button onClick={() => onInsert(index)} className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-xs font-medium rounded-md transition-colors">この下にスライドを挿入</button>
              <button onClick={() => onDelete(index)} className="px-3 py-1 bg-red-700 hover:bg-red-600 text-xs font-medium rounded-md transition-colors disabled:opacity-50" disabled={outline.length <= 1}>このスライドを削除</button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex flex-col items-center pt-2 space-y-3">
        <button 
            onClick={onModifyAll}
            className="w-full max-w-md px-6 py-2 bg-indigo-700 hover:bg-indigo-600 text-sm font-medium rounded-md transition-colors"
          >
            構成案全体をAIで修正...
        </button>
        <div className="flex justify-center space-x-4">
          <button 
            onClick={onRegenerate} 
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors"
          >
            構成案を再生成
          </button>
          <button 
            onClick={onStart} 
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors" 
            disabled={outline.length === 0}
          >
            構成案を承認し、スライド生成を開始する
          </button>
        </div>
      </div>
    </div>
  );
};

const GenerationProgressTracker = ({ outline, currentIndex, thinkingState }) => {
  const activeSlideRef = useRef(null);

  useEffect(() => {
    if (activeSlideRef.current) {
      activeSlideRef.current.scrollIntoView({
        behavior: 'smooth', 
        block: 'nearest',   
      });
    }
  }, [currentIndex]); 

  return (
    <div className="bg-black/20 p-4 rounded-lg space-y-3">
      <p className="text-sm text-gray-300 mb-2 font-semibold">スライド生成中...</p>
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
        {outline.map((slide, index) => {
          const isDone = index < currentIndex;
          const isInProgress = index === currentIndex;

          return (
            <div 
              key={index}
              ref={isInProgress ? activeSlideRef : null} 
              className={`border border-white/10 rounded-lg p-3 transition-all duration-300 ${isInProgress ? 'bg-indigo-900/50' : 'bg-gray-900/50'}`}
            >
              <p className="font-semibold text-sm flex items-center">
                {isDone ? <span className="text-green-400 mr-2">✅</span> : isInProgress ? <span className="animate-pulse mr-2">⏳</span> : <span className="text-gray-500 mr-2">📄</span>}
                {index + 1}. {slide.title}
                {isDone && <span className="ml-auto text-xs text-green-400 font-medium">完了</span>}
                {isInProgress && <span className="ml-auto text-xs text-indigo-300 font-medium">生成中</span>}
              </p>

              {isInProgress && (
                <div className="mt-3">
                  <ProcessingTracker
                    title="スライドを生成中..."
                    steps={SLIDE_GENERATION_STEPS}
                    currentStepKey={thinkingState}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DownloadButton = ({ onDownload, onDownloadPdf, isGeneratingPdf }) => (
    <div className="bg-black/20 p-4 rounded-lg flex justify-center space-x-4">
        <button 
          onClick={onDownload} 
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-md transition-colors"
        >
          ZIPファイルをダウンロード
        </button>
        <button 
          onClick={onDownloadPdf} 
          className={`px-6 py-2 bg-green-700 hover:bg-green-600 text-sm font-medium rounded-md transition-colors ${isGeneratingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? 'PDFを生成中...' : 'PDFをダウンロード'}
        </button>
    </div>
);

const UserInput = ({ value, onChange, onSend, disabled }) => (
    <div className="relative">
        <input type="text" value={value} onChange={onChange} onKeyPress={(e) => e.key === 'Enter' && onSend()} placeholder="修正指示などを入力..." className="w-full bg-gray-900/50 border border-white/20 rounded-lg py-3 pl-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" disabled={disabled} />
        <button onClick={onSend} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors disabled:opacity-50" disabled={disabled || !value.trim()}> <SendIcon /> </button>
    </div>
);

const GenerationControls = ({ onPreview, onApprove, onEditCode, onRegenerate, onReturnToOutline, disabled }) => ( 
    <div className="flex justify-end mt-4 space-x-2">
        <button 
          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50 hidden" 
          disabled={disabled} 
          onClick={onPreview}
        >
          プレビュー
        </button>
        <button 
          className="px-4 py-2 bg-sky-800 hover:bg-sky-700 text-sm font-medium rounded-md transition-colors disabled:opacity-50" 
          disabled={disabled} 
          onClick={onReturnToOutline} 
          title="現在のプレビューを破棄し、構成案の編集画面に戻ります。"
        >
          構成案を修正
        </button>
        <button 
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" 
          disabled={disabled} 
          onClick={onRegenerate}
        >
          再生成
        </button>
        <button className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" disabled={disabled} onClick={onEditCode}>ソースコードを編集</button>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-md transition-colors disabled:opacity-50" disabled={disabled} onClick={onApprove}>承認して次へ</button>
    </div>
);


// --- メインの ChatPanel コンポーネント (App.jsx から移動) ---

export const ChatPanel = ({ chatState }) => (
  <div className="w-full h-full bg-white/5 rounded-xl flex flex-col border border-white/10 overflow-hidden">
    <div className="flex-grow p-6 overflow-y-auto space-y-4">
      <MessageList messages={chatState.messages} />
      
      {chatState.apiErrorStep && (
        <div className="bg-black/20 p-4 rounded-lg flex justify-center">
          <button onClick={chatState.handleRetry} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-sm font-medium rounded-md transition-colors">
            再試行
          </button>
        </div>
      )}

      {chatState.appStatus === APP_STATUS.STRUCTURED && <MarkdownEditor 
        markdown={chatState.structuredMarkdown} 
        setMarkdown={chatState.setStructuredMarkdown} 
        onApprove={chatState.handleMarkdownApproval} 
        onRegenerate={chatState.handleRegenerateStructure}
      />}
      {chatState.appStatus === APP_STATUS.SELECTING_THEME && <ThemeSelector 
        selectedTheme={chatState.selectedTheme} 
        selectedDesign={chatState.design} 
        onThemeSelect={chatState.handleThemeSelection} 
        onDesignSelect={chatState.handleDesignSelection} 
        onApprove={chatState.handleThemeApproval} />}
      {chatState.appStatus === APP_STATUS.CREATING_OUTLINE && <AgendaSelector onSelect={chatState.handleAgendaChoice} />}
      {chatState.appStatus === APP_STATUS.SELECTING_SECTION_HEADERS && <SectionHeaderSelector onSelect={chatState.handleSectionHeaderChoice} />}
      
      {chatState.appStatus === APP_STATUS.OUTLINE_CREATED && <OutlineEditor 
        outline={chatState.slideOutline} 
        onChange={chatState.handleOutlineChange} 
        onInsert={chatState.handleInsertSlide} 
        onDelete={chatState.handleDeleteSlide} 
        onStart={chatState.handleStartGeneration} 
        selectedTheme={chatState.selectedTheme}
        onRegenerate={chatState.handleRegenerateOutline} 
        onRegenerateContent={chatState.handleRegenerateSlideContent}
        onModifySlide={chatState.handleOpenModifyModal}
        onModifyAll={chatState.handleOpenModifyAllModal}
        scrollToIndex={chatState.scrollToIndex}
        onScrollComplete={() => chatState.setScrollToIndex(null)}
      />}

      {(chatState.appStatus === APP_STATUS.GENERATING_SLIDES || chatState.appStatus === APP_STATUS.SLIDE_GENERATED) &&
        <GenerationProgressTracker
          outline={chatState.slideOutline}
          currentIndex={chatState.currentSlideIndex}
          thinkingState={chatState.thinkingState}
        />
      }

      {chatState.appStatus === APP_STATUS.ALL_SLIDES_GENERATED && <DownloadButton 
        onDownload={chatState.handleDownloadZip} 
        onDownloadPdf={chatState.handleDownloadPdf}
        isGeneratingPdf={chatState.isGeneratingPdf}
      />}

      <div ref={chatState.chatEndRef} />
    </div>

    <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/20">
      <UserInput value={chatState.userInput} onChange={(e) => chatState.setUserInput(e.target.value)} onSend={chatState.handleSendMessage} disabled={chatState.appStatus !== APP_STATUS.SLIDE_GENERATED} />
      <GenerationControls 
        onPreview={chatState.handlePreview} 
        onApprove={chatState.handleApproveAndNext} 
        onEditCode={chatState.handleOpenCodeEditor} 
        onRegenerate={chatState.handleRegenerateCurrentSlide}
        onReturnToOutline={chatState.handleReturnToOutline} 
        disabled={chatState.appStatus !== APP_STATUS.SLIDE_GENERATED} 
      />
    </div>
  </div>
);