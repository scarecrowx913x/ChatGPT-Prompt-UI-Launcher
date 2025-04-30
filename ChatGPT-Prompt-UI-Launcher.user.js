// ==UserScript==
// @name         ChatGPT Prompt UI Launcher (選択式バージョン)
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      0.7
// @description  URL要約＆解説 + 「開く or コピーだけ」選択フロー付き
// @author       junx913x (改良 by あなた)
// @match        *://*/*
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
  'use strict';
  if (window.top !== window.self) return;
  if (document.getElementById('chatgpt-ui-launcher')) return;

  // --- 共通スタイル ---
  const style = document.createElement("style");
  style.textContent = `
    .chatgpt-launcher { position: fixed; bottom: 20px; left: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 6px; }
    .chatgpt-btn { background-color: #10a37f; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .chatgpt-btn:hover { background-color: #0e8f70; }
  `;
  document.head.appendChild(style);

  // --- UIコンテナ ---
  const container = document.createElement("div");
  container.id = "chatgpt-ui-launcher";
  container.className = "chatgpt-launcher";

  // --- 汎用アクション関数 ---
  function handleAction(promptText, successMsg) {
    const choice = window.prompt(
      "どうする？\n1: ChatGPTを開く🌐\n2: プロンプトだけコピー📋",
      "1"
    );
    if (choice === "2") {
      GM_setClipboard(promptText);
      alert("📋 プロンプトだけコピーしたよ！");
    } else {
      GM_setClipboard(promptText);
      alert("🚀 プロンプトをコピーしてChatGPTを開くね！");
      window.open("https://chat.openai.com/chat", "_blank");
    }
  }

  // --- 要約ボタン ---
  const btnSummary = document.createElement("button");
  btnSummary.textContent = " 要約";
  btnSummary.className = "chatgpt-btn";
  btnSummary.onclick = () => {
    const url = window.location.href;
    const promptText = `Please visit and analyze the following page: ${url}\nSummarize the key points in Japanese using headers and bullet points.`;
    handleAction(promptText);
  };

  // --- 解説ボタン ---
  const btnExplain = document.createElement("button");
  btnExplain.textContent = " 解説";
  btnExplain.className = "chatgpt-btn";
  btnExplain.onclick = () => {
    const url = window.location.href;
    const promptText = `Please visit and analyze the following page: ${url}\n1. First, explain the key concepts in this page using simple Japanese words.\n2. At the end of your explanation, provide a table of contents listing the main topics you covered.\n3. Then ask the user which topic they would like more detailed information on.\n4. After the user selects a topic, provide a detailed explanation for that topic.`;
    handleAction(promptText);
  };

  // --- ページに追加 ---
  container.appendChild(btnSummary);
  container.appendChild(btnExplain);
  document.body.appendChild(container);
})();
