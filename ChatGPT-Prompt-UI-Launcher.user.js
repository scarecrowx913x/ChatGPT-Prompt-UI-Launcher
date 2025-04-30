// ==UserScript==
// @name         ChatGPT Prompt UI Launcher
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      0.8.1
// @description  モーダルで「開く or コピー」を直感的に選べる🎀
// @author       junx913x
// @match        *://*/*
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
  'use strict';
  if (window.top !== window.self) return;
  if (document.getElementById('chatgpt-ui-launcher')) return;

  // --- 共通スタイル & モーダル用CSS ---
  const style = document.createElement("style");
  style.textContent = `
    /* ボタン周り */
    .chatgpt-btn { background-color: #10a37f; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .chatgpt-btn:hover { background-color: #0e8f70; }

    /* モーダルオーバーレイ */
    .cgpt-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    }
    /* モーダル本体 */
    .cgpt-modal {
      background: #fff; padding: 20px; border-radius: 8px;
      text-align: center; max-width: 300px; width: 80%;
    }
    /* モーダル内ボタン */
    .cgpt-modal-btn {
      margin: 8px; padding: 8px 16px; border: none; border-radius: 4px;
      cursor: pointer; font-size: 14px; font-weight: bold;
    }
    .cgpt-modal-btn.open { background: #10a37f; color: #fff; }
    .cgpt-modal-btn.copy { background: #ccc; color: #333; }
  `;
  document.head.appendChild(style);

  // --- モーダル表示＆選択処理 ---
  function showActionModal(promptText) {
    // overlay作成
    const overlay = document.createElement('div');
    overlay.className = 'cgpt-modal-overlay';
    // modal作成
    const modal = document.createElement('div');
    modal.className = 'cgpt-modal';
    modal.innerHTML = `<p>どうする？</p>`;
    // ボタン作成
    const btnOpen = document.createElement('button');
    btnOpen.textContent = 'ChatGPTを開く 🌐';
    btnOpen.className = 'cgpt-modal-btn open';
    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'プロンプトだけコピー 📋';
    btnCopy.className = 'cgpt-modal-btn copy';

    modal.appendChild(btnOpen);
    modal.appendChild(btnCopy);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ボタンイベント
    btnOpen.addEventListener('click', () => {
      cleanup();
      GM_setClipboard(promptText);
      window.open('https://chat.openai.com/chat', '_blank');
      alert('🚀 ChatGPTを開いたよ！');
    });
    btnCopy.addEventListener('click', () => {
      cleanup();
      GM_setClipboard(promptText);
      alert('📋 プロンプトをコピーしたよ！');
    });

    function cleanup() {
      document.body.removeChild(overlay);
    }
  }

  // --- 汎用アクション関数 ---
  function handleAction(promptText) {
    showActionModal(promptText);
  }

  // --- UIコンテナ & ボタン追加 ---
  const container = document.createElement("div");
  container.id = "chatgpt-ui-launcher";
  container.style = "position: fixed; bottom: 20px; left: 20px; z-index:9999; display:flex; flex-direction:column; gap:6px;";

  // 要約ボタン
  const btnSummary = document.createElement("button");
  btnSummary.textContent = "📘要約";
  btnSummary.className = "chatgpt-btn";
  btnSummary.onclick = () => {
    const url = window.location.href;
    const promptText = `Please visit and analyze the following page: ${url}\nSummarize the key points in Japanese using headers and bullet points.`;
    handleAction(promptText);
  };

  // 解説ボタン
  const btnExplain = document.createElement("button");
  btnExplain.textContent = "🔍️解説";
  btnExplain.className = "chatgpt-btn";
  btnExplain.onclick = () => {
    const url = window.location.href;
    const promptText = `Please visit and analyze the following page: ${url}\n1. First, explain the key concepts in this page using simple Japanese words.\n2. At the end of your explanation, provide a table of contents listing the main topics you covered.\n3. Then ask the user which topic they would like more detailed information on.\n4. After the user selects a topic, provide a detailed explanation for that topic.`;
    handleAction(promptText);
  };

  container.appendChild(btnSummary);
  container.appendChild(btnExplain);
  document.body.appendChild(container);
})();
