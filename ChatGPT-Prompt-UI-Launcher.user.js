// ==UserScript==
// @name         ChatGPT Prompt UI Launcher
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      1.2.1
// @description  ChatGPTランチャー（要約/解説、ドラッグ移動＆コーナー吸着、折りたたみ、サイト別表示ON/OFF、クリップボード対応、safe-area・z-index最適化）
// @author       junx913x
// @match        *://*/*
// @exclude      *://chatgpt.com/*
// @exclude      *://chat.openai.com/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  // ---------- Keys / Const ----------
  const STYLE_ID = 'cgpt-ui-style';
  const STATE_KEY = 'cgpt_ui_state_v2';          // {mode:'corner'|'free', corner:'bottom-left', x,y, collapsed:true|false}
  const HOST_KEY  = 'cgpt_ui_hostprefs_v1';      // { "<host>": { enabled: true|false } }
  const CHATGPT_URL = 'https://chatgpt.com/';
  const CORNERS = ['bottom-left','bottom-right','top-right','top-left'];
  const LONGPRESS_MS = 600;
  const DRAG_THRESHOLD_PX = 6;
  const SNAP_RADIUS_PX = 64;

  // ---------- Host prefs ----------
  const host = location.host;
  const prefs = loadJSON(HOST_KEY, {});
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(menuLabelForHost(enabled(host)), () => {
      setHostEnabled(host, !enabled(host));
      if (!enabled(host)) {
        const el = document.getElementById('chatgpt-ui-launcher');
        if (el) el.remove();
      } else {
        location.reload();
      }
    });
    GM_registerMenuCommand('位置と表示状態をリセット', () => {
      localStorage.removeItem(STATE_KEY);
      location.reload();
    });
  }
  if (!enabled(host)) return;

  // ---------- Style (once) ----------
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .chatgpt-btn{
        background-color:#10a37f;color:#fff;border:none;
        padding:6px 10px;border-radius:6px;cursor:pointer;
        font-size:clamp(11px,2vw,13px);font-weight:700;
        min-height:32px;line-height:1.1;user-select:none;
        box-shadow:0 1px 5px rgba(0,0,0,.18);touch-action:manipulation
      }
      .chatgpt-btn:hover{background-color:#0e8f70}
      .chatgpt-gear{
        background:transparent;border:none;color:inherit;width:28px;height:28px;
        display:flex;align-items:center;justify-content:center;
        font-size:20px;cursor:grab;line-height:1;padding:0;box-shadow:none;
        user-select:none;touch-action:none
      }
      .chatgpt-gear.dragging{cursor:grabbing}
      .cgpt-modal-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);z-index:2147483647}
      .cgpt-modal{position:relative;background:#fff;color:#111;padding:16px;border-radius:10px;text-align:center;width:min(92vw,340px);max-width:92vw;box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:14px}
      .cgpt-modal-close{position:absolute;top:8px;right:8px;background:transparent;border:none;color:#666;font-size:18px;cursor:pointer;line-height:1}
      .cgpt-modal-close:hover{color:#000}
      .cgpt-modal-btn{margin:10px 6px 0;padding:8px 12px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;min-height:34px}
      .cgpt-modal-btn.open{background:#10a37f;color:#fff}
      .cgpt-modal-btn.copy{background:#eee;color:#333}
      .cgpt-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));background:rgba(17,17,17,.92);color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;z-index:2147483647;box-shadow:0 6px 20px rgba(0,0,0,.35);pointer-events:none;opacity:0;transition:opacity .2s ease}
      .cgpt-toast.show{opacity:1}
      .cgpt-pop{position:fixed;z-index:2147483647;background:#fff;color:#111;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:8px;min-width:180px;font-size:13px}
      .cgpt-pop button{display:block;width:100%;text-align:left;background:#f6f6f6;border:none;border-radius:6px;padding:8px 10px;margin:4px 0;cursor:pointer}
      .cgpt-pop button:hover{background:#e9e9e9}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ---------- State ----------
  const state = loadJSON(STATE_KEY, { mode:'corner', corner:'bottom-left', x:24, y:24, collapsed:false });

  // ---------- UI ----------
  const container = document.createElement('div');
  container.id = 'chatgpt-ui-launcher';
  Object.assign(container.style, {
    position: 'fixed',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-start',
    zIndex: '2147483647',
    maxWidth: '90vw',
    touchAction: 'none',
    userSelect: 'none'
  });

  const btnGear = document.createElement('button');
  btnGear.type = 'button';
  btnGear.className = 'chatgpt-gear';
  btnGear.textContent = '⚙️';
  btnGear.title = 'クリック: 折りたたみ/展開・長押し: メニュー・ドラッグ: 位置移動';
  btnGear.setAttribute('aria-label','ランチャー設定');

  const btnSummary = document.createElement('button');
  btnSummary.type = 'button';
  btnSummary.textContent = ' 📘要約';
  btnSummary.className = 'chatgpt-btn';
  btnSummary.addEventListener('click', () => {
    const url = window.location.href;
    const promptText =
`Please visit and analyze the following page: ${url}
Summarize the key points in Japanese using headers and bullet points.`;
    showActionModal(promptText);
  });

  const btnExplain = document.createElement('button');
  btnExplain.type = 'button';
  btnExplain.textContent = ' 🔍️解説';
  btnExplain.className = 'chatgpt-btn';
  btnExplain.addEventListener('click', () => {
    const url = window.location.href;
    const promptText =
`Please visit and analyze the following page: ${url}
1. First, explain the key concepts on this page using simple Japanese words.
2. At the end of your explanation, provide a table of contents listing the main topics you covered.
3. Then ask the user which topic they would like more detailed information on.
4. After the user selects a topic, provide a detailed explanation for that topic.`;
    showActionModal(promptText);
  });

  container.appendChild(btnGear);
  container.appendChild(btnSummary);
  container.appendChild(btnExplain);
  document.body.appendChild(container);

  applyCollapsed(state.collapsed);
  applyPositionFromState();

  // ---------- Drag / Long-press / Click ----------
  let pressTimer=null, longPressed=false, dragging=false, moved=false;
  let startX=0, startY=0, startLeft=0, startTop=0, pointerId=null;

  const captureOpts = { capture: true };

  btnGear.addEventListener('pointerdown', (e) => {
    // 右クリック等は無視
    if (e.button !== 0) return;
    e.preventDefault();

    pointerId = e.pointerId;
    try { btnGear.setPointerCapture(pointerId); } catch {}
    btnGear.classList.add('dragging');
    longPressed = false; dragging = false; moved=false;

    const rect = container.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startLeft = rect.left; startTop = rect.top;

    // long press
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { longPressed = true; openMenuAt(e.clientX, e.clientY); }, LONGPRESS_MS);

    // グローバル監視（取り逃し防止）
    window.addEventListener('pointermove', onMove, captureOpts);
    window.addEventListener('pointerup', onUp, captureOpts);
    window.addEventListener('pointercancel', onCancel, captureOpts);
    window.addEventListener('blur', onCancel, captureOpts);
  });

  // Firefoxなどで pointer capture を失うケースの保険
  btnGear.addEventListener('lostpointercapture', endDrag, true);

  function onMove(e){
    if (pointerId !== e.pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragging && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
      dragging = true;
      clearTimeout(pressTimer);
    }
    if (dragging) {
      moved = true;
      const {vw, vh, pad} = viewport();
      let nx = clamp(startLeft + dx, pad, vw - container.offsetWidth - pad);
      let ny = clamp(startTop + dy,  pad, vh - container.offsetHeight - pad);
      setFreePosition(nx, ny);
    }
  }

  function onUp(e){
    if (pointerId !== e.pointerId) return;
    endDrag();
    if (dragging) {
      snapOrKeep();
      saveState();
      return;
    }
    if (!longPressed) {
      state.collapsed = !state.collapsed;
      saveState();
      applyCollapsed(state.collapsed);
    }
  }

  function onCancel(){
    endDrag();
  }

  function endDrag(){
    try { btnGear.releasePointerCapture(pointerId); } catch {}
    btnGear.classList.remove('dragging');
    clearTimeout(pressTimer);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
    window.removeEventListener('blur', onCancel, true);
    dragging = false; longPressed = false; pointerId = null;
  }

  // ---------- Collapse / Position ----------
  function applyCollapsed(collapsed){
    btnSummary.style.display = collapsed ? 'none' : '';
    btnExplain.style.display = collapsed ? 'none' : '';
  }

  function applyPositionFromState() {
    if (state.mode === 'corner') {
      applyCorner(container, state.corner);
    } else {
      setFreePosition(state.x, state.y);
    }
  }

  function applyCorner(el, pos) {
    const padL = 'max(12px, env(safe-area-inset-left))';
    const padR = 'max(12px, env(safe-area-inset-right))';
    const padB = 'max(12px, env(safe-area-inset-bottom))';
    const padT = 'max(12px, env(safe-area-inset-top))';
    el.style.left = el.style.top = el.style.right = el.style.bottom = 'auto';
    if (pos === 'bottom-left')  { el.style.bottom = padB; el.style.left  = padL; }
    if (pos === 'bottom-right') { el.style.bottom = padB; el.style.right = padR; }
    if (pos === 'top-left')     { el.style.top    = padT; el.style.left  = padL; }
    if (pos === 'top-right')    { el.style.top    = padT; el.style.right = padR; }
  }

  function setFreePosition(x, y) {
    state.mode = 'free';
    state.x = Math.round(x); state.y = Math.round(y);
    container.style.left = state.x + 'px';
    container.style.top  = state.y + 'px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  }

  function snapOrKeep() {
    const {vw, vh, pad} = viewport();
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const corners = {
      'top-left':     {x: pad,                    y: pad},
      'top-right':    {x: vw - rect.width - pad,  y: pad},
      'bottom-left':  {x: pad,                    y: vh - rect.height - pad},
      'bottom-right': {x: vw - rect.width - pad,  y: vh - rect.height - pad},
    };
    let best = null, bestd = Infinity;
    for (const [name, p] of Object.entries(corners)) {
      const dx = (p.x + rect.width/2) - cx;
      const dy = (p.y + rect.height/2) - cy;
      const d = Math.hypot(dx, dy);
      if (d < bestd) { bestd = d; best = name; }
    }
    if (bestd <= SNAP_RADIUS_PX) {
      state.mode = 'corner';
      state.corner = best;
      applyCorner(container, best);
    } else {
      const nx = clamp(rect.left, pad, vw - rect.width - pad);
      const ny = clamp(rect.top,  pad, vh - rect.height - pad);
      setFreePosition(nx, ny);
    }
  }

  function viewport() {
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const pad = 12;
    return {vw, vh, pad};
  }
  function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }

  // ---------- Long-press menu ----------
  function openMenuAt(x, y) {
    closePopups();
    const pop = document.createElement('div');
    pop.className = 'cgpt-pop';
    document.body.appendChild(pop);

    const {vw, vh} = viewport();
    const rectW = 220, rectH = 150;
    pop.style.left = Math.min(vw - rectW - 8, Math.max(8, x - 20)) + 'px';
    pop.style.top  = Math.min(vh - rectH - 8, Math.max(8, y + 8)) + 'px';

    const b1 = document.createElement('button');
    b1.textContent = '四隅に吸着（順送り）';
    b1.addEventListener('click', () => {
      const idx = CORNERS.indexOf(state.corner ?? 'bottom-left');
      state.mode = 'corner';
      state.corner = CORNERS[(idx + 1) % CORNERS.length];
      applyCorner(container, state.corner);
      saveState();
      showToast(`位置を変更: ${state.corner}`);
      closePopups();
    });

    const enabledNow = enabled(host);
    const b2 = document.createElement('button');
    b2.textContent = enabledNow ? 'このサイトで非表示にする' : 'このサイトで表示する';
    b2.addEventListener('click', () => {
      setHostEnabled(host, !enabledNow);
      showToast(enabledNow ? 'このサイトで非表示にしました（メニューから再有効化）' : 'このサイトで表示します');
      closePopups();
      if (enabledNow) container.remove();
    });

    const b3 = document.createElement('button');
    b3.textContent = state.collapsed ? '展開する' : '折りたたむ';
    b3.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      applyCollapsed(state.collapsed);
      saveState();
      closePopups();
    });

    pop.appendChild(b1); pop.appendChild(b2); pop.appendChild(b3);

    setTimeout(() => {
      const onDoc = (ev) => { if (!pop.contains(ev.target)) { closePopups(); document.removeEventListener('mousedown', onDoc, true); } };
      document.addEventListener('mousedown', onDoc, true);
    }, 0);
  }
  function closePopups(){ document.querySelectorAll('.cgpt-pop').forEach(n=>n.remove()); }

  // ---------- Modal ----------
  function showActionModal(promptText) {
    const overlay = document.createElement('div');
    overlay.className = 'cgpt-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'cgpt-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const btnClose = document.createElement('button');
    btnClose.className = 'cgpt-modal-close';
    btnClose.type = 'button';
    btnClose.textContent = '✕';
    modal.appendChild(btnClose);

    const title = document.createElement('p');
    title.textContent = 'どうする？';
    modal.appendChild(title);

    const btnOpen = document.createElement('button');
    btnOpen.type = 'button';
    btnOpen.textContent = 'ChatGPTを開く 🌐';
    btnOpen.className = 'cgpt-modal-btn open';
    modal.appendChild(btnOpen);

    const btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.textContent = 'プロンプトだけコピー 📋';
    btnCopy.className = 'cgpt-modal-btn copy';
    modal.appendChild(btnCopy);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const prev = document.activeElement;
    function closeModal() {
      overlay.remove();
      if (prev && prev.focus) prev.focus();
    }
    btnClose.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    setTimeout(() => btnOpen.focus(), 0);

    btnOpen.addEventListener('click', async () => {
      closeModal();
      await copyText(promptText);
      window.open(CHATGPT_URL, '_blank', 'noopener,noreferrer');
      showToast('🚀 ChatGPTを開いたよ（プロンプトはコピー済み）');
    });
    btnCopy.addEventListener('click', async () => {
      closeModal();
      const ok = await copyText(promptText);
      showToast(ok ? '📋 プロンプトをコピーしたよ' : '⚠️ コピーに失敗しました');
    });
  }

  // ---------- Utils ----------
  function showToast(message, ms = 1500) {
    const toast = document.createElement('div');
    toast.className = 'cgpt-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, ms);
  }

  async function copyText(text) {
    let copied = false;
    try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(text); copied = true; } } catch {}
    if (!copied && navigator.clipboard) {
      try { await navigator.clipboard.writeText(text); copied = true; } catch {}
    }
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        copied = document.execCommand('copy'); ta.remove();
      } catch {}
    }
    return copied;
  }

  function enabled(h){ return !prefs[h] || prefs[h].enabled !== false; }
  function setHostEnabled(h, en){
    prefs[h] = { enabled: !!en };
    saveJSON(HOST_KEY, prefs);
  }
  function menuLabelForHost(isEnabled){ return isEnabled ? 'このサイトで無効にする' : 'このサイトで有効にする'; }

  function saveState(){ saveJSON(STATE_KEY, state); }
  function loadJSON(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch{ return def; } }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
})();
