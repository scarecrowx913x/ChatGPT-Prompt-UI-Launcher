// ==UserScript==
// @name         ChatGPT-Prompt-UI-Launcher
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      0.9.0
// @description  オーバーレイ＆ESC＆フォールバック実装。選択テキスト/ダークテーマ/高z-index対応🎀
// @author       junx913x
// @match        *://*/*
// @run-at       document-end
// @noframes
// @grant        GM_setClipboard
// @grant        GM_openInTab
// ==/UserScript==
(function() {
  'use strict';
  if (window.top !== window.self) return;
  if (document.getElementById('chatgpt-ui-launcher')) return;

  const CHATGPT_URLS = ['https://chat.openai.com/','https://chatgpt.com/'];

  function copyToClipboard(text) {
    try {
      if (typeof GM_setClipboard === 'function') { GM_setClipboard(text); return Promise.resolve(); }
      throw new Error();
    } catch(_) {
      if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
      return new Promise((res, rej) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); res();
        } catch(e){ rej(e); }
      });
    }
  }
  function openChatGPT() {
    const u = CHATGPT_URLS[0];
    try {
      if (typeof GM_openInTab === 'function') GM_openInTab(u, {active:true,setParent:true});
      else window.open(u, '_blank', 'noopener');
    } catch(_) { window.location.href = u; }
  }

  const style = document.createElement("style");
  style.textContent = `
    :root{--cgpt-bg:#fff;--cgpt-fg:#111;--cgpt-ol:rgba(0,0,0,.5);--cgpt-ac:#10a37f;--cgpt-ac2:#0e8f70;--cgpt-m:#eee;--cgpt-mf:#333;--cgpt-z:2147483647}
    @media (prefers-color-scheme: dark){
      :root{--cgpt-bg:#1f1f1f;--cgpt-fg:#eaeaea;--cgpt-m:#2a2a2a;--cgpt-mf:#ddd}
    }
    .chatgpt-btn{background:var(--cgpt-ac);color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.2)}
    .chatgpt-btn:hover{background:var(--cgpt-ac2)}
    .cgpt-modal-overlay{position:fixed;inset:0;background:var(--cgpt-ol);display:flex;align-items:center;justify-content:center;z-index:var(--cgpt-z)}
    .cgpt-modal{position:relative;background:var(--cgpt-bg);color:var(--cgpt-fg);padding:20px;border-radius:8px;text-align:center;max-width:320px;width:90%;box-shadow:0 4px 12px rgba(0,0,0,.3)}
    .cgpt-modal-close{position:absolute;top:8px;right:8px;background:transparent;border:none;font-size:18px;cursor:pointer;color:#888}
    .cgpt-modal-close:hover{color:#fff}
    .cgpt-modal-btn{margin:12px 8px 0;padding:10px 16px;border:none;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold}
    .cgpt-modal-btn.open{background:var(--cgpt-ac);color:#fff}
    .cgpt-modal-btn.copy{background:var(--cgpt-m);color:var(--cgpt-mf)}
    #chatgpt-ui-launcher{position:fixed;bottom:20px;left:20px;z-index:var(--cgpt-z);display:flex;flex-direction:column;gap:6px}
    .cgpt-toast{position:fixed;bottom:20px;right:20px;z-index:var(--cgpt-z);background:var(--cgpt-bg);color:var(--cgpt-fg);padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.3)}
  `;
  document.head.appendChild(style);

  function toast(msg){
    const t=document.createElement('div'); t.className='cgpt-toast'; t.textContent=msg;
    document.body.appendChild(t); setTimeout(()=>t.remove(), 2400);
  }

  let openerButton=null;
  function showActionModal(promptText) {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    const overlay = document.createElement('div'); overlay.className='cgpt-modal-overlay';
    const modal = document.createElement('div'); modal.className='cgpt-modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');

    const btnClose=document.createElement('button'); btnClose.className='cgpt-modal-close'; btnClose.textContent='✕'; modal.appendChild(btnClose);
    const title=document.createElement('p'); title.textContent='どうする？'; modal.appendChild(title);

    const btnOpen=document.createElement('button'); btnOpen.textContent='ChatGPTを開く 🌐'; btnOpen.className='cgpt-modal-btn open'; modal.appendChild(btnOpen);
    const btnCopy=document.createElement('button'); btnCopy.textContent='プロンプトだけコピー 📋'; btnCopy.className='cgpt-modal-btn copy'; modal.appendChild(btnCopy);

    overlay.appendChild(modal); document.body.appendChild(overlay);

    const focusables = []; setTimeout(()=>{ focusables.push(...modal.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')); focusables[0]?.focus(); },0);

    function closeModal(){ overlay.remove(); document.documentElement.style.overflow = prevOverflow || ''; openerButton?.focus?.(); }
    btnClose.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); closeModal(); }
      if (e.key === 'Tab' && focusables.length) {
        const i=focusables.indexOf(document.activeElement); const dir=e.shiftKey?-1:1; const next=(i+dir+focusables.length)%focusables.length;
        focusables[next].focus(); e.preventDefault();
      }
    }, {capture:true});

    btnOpen.addEventListener('click', async () => {
      closeModal();
      await copyToClipboard(promptText).catch(()=>{});
      openChatGPT();
      toast('🚀 ChatGPTを開いたよ！');
    });
    btnCopy.addEventListener('click', async () => {
      closeModal();
      await copyToClipboard(promptText).then(()=>toast('📋 コピーしたよ！')).catch(()=>toast('⚠️ コピー失敗…'));
    });
  }

  function handleAction(promptText, btn){ openerButton = btn || null; showActionModal(promptText); }

  function buildContextualPrompt(tpl){
    const url=location.href, title=document.title||'';
    const sel=(window.getSelection?.().toString()||'').trim();
    return tpl.replace('{URL}',url).replace('{TITLE}',title).replace('{SELECTION}', sel ? `\n[Selection]\n${sel}\n` : '');
  }

  const container = document.createElement("div");
  container.id = "chatgpt-ui-launcher";
  const btnSummary = document.createElement("button");
  btnSummary.textContent = " 📘要約"; btnSummary.className="chatgpt-btn";
  btnSummary.onclick = (e) => {
    const promptText = buildContextualPrompt(
`Please analyze:
Title: {TITLE}
URL: {URL}
{SELECTION}
Summarize the key points in Japanese using headers and bullet points.`);
    handleAction(promptText, e.currentTarget);
  };
  const btnExplain = document.createElement("button");
  btnExplain.textContent = " 🔍️解説"; btnExplain.className="chatgpt-btn";
  btnExplain.onclick = (e) => {
    const promptText = buildContextualPrompt(
`Please analyze:
Title: {TITLE}
URL: {URL}
{SELECTION}
1) Explain key concepts in simple Japanese.
2) Provide a table of contents.
3) Ask which topic to dive deeper.
4) After user chooses, provide a deep explanation.`);
    handleAction(promptText, e.currentTarget);
  };
  container.appendChild(btnSummary); container.appendChild(btnExplain);
  document.body.appendChild(container);

  // Hotkeys: Alt+Shift+S/E
  window.addEventListener('keydown', (e)=>{
    if (e.altKey && e.shiftKey && !e.repeat){
      if (e.key.toLowerCase()==='s'){ btnSummary.click(); }
      if (e.key.toLowerCase()==='e'){ btnExplain.click(); }
    }
  });
})();
