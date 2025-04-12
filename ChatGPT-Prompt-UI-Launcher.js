// ==UserScript==
// @name         ChatGPT Prompt UI Launcher (URL要約＆解説＋詳細確認)
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      1.3
// @description  URLをブラウズして要約 or 解説＋詳細確認までできるUIボタン✨
// @author       junx913x
// @supportURL    https://github.com/junx913x/chatgpt-ui-launcher
// @match        *://*/*
// @grant        GM_setClipboard
// ==/UserScript==


(function () {
    // ボタン用スタイル設定
    const style = document.createElement("style");
    style.textContent = `
    .chatgpt-launcher {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .chatgpt-btn {
        background-color: #10a37f;
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: bold;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .chatgpt-btn:hover {
        background-color: #0e8f70;
    }
    `;
    document.head.appendChild(style);

    // UIコンテナ作成
    const container = document.createElement("div");
    container.className = "chatgpt-launcher";

    // 🔍 要約ボタン
    const btnSummary = document.createElement("button");
    btnSummary.textContent = "🔍 要約";
    btnSummary.className = "chatgpt-btn";
    btnSummary.onclick = () => {
        const tabURL = window.location.href;
        const prompt = `Please visit and analyze the following page:
${tabURL}

Summarize the key points in Japanese using headers and bullet points.`;
        GM_setClipboard(prompt);
        alert("✅ 要約プロンプトをコピーしたよ〜！ChatGPTに貼って送信してね♪");
        window.open("https://chat.openai.com/chat", "_blank");
    };

    // 💬 解説ボタン（詳細確認フロー付き）
    const btnExplain = document.createElement("button");
    btnExplain.textContent = "💬 解説";
    btnExplain.className = "chatgpt-btn";
    btnExplain.onclick = () => {
        const tabURL = window.location.href;
        const prompt = `Please visit and analyze the following page:
${tabURL}

1. First, explain the key concepts in this page using simple Japanese words.
2. At the end of your explanation, provide a table of contents listing the main topics you covered.
3. Then ask the user which topic they would like more detailed information on.
4. After the user selects a topic, provide a detailed explanation for that topic.`;
        GM_setClipboard(prompt);
        alert("✅ 解説プロンプトをコピーしたよ〜！ChatGPTに貼って送信してね♪");
        window.open("https://chat.openai.com/chat", "_blank");
    };

    // ボタン追加
    container.appendChild(btnSummary);
    container.appendChild(btnExplain);
    document.body.appendChild(container);
})();
