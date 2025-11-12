// ==UserScript==
// @name         ChatGPT Prompt UI Launcher (UI: Normal/Force + RouteB Bridge)
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      1.4.0
// @description  ChatGPTランチャー（🌐通常／🛠️強制）＋ 自動入力・自動送信ブリッジ。ドラッグ移動、四隅吸着、折りたたみ、サイト別ON/OFF、クリップボード、safe-area・z-index最適化、DOM差し替え自動復帰。
// @author       scarecrowx913x
// @match        *://*/*
// @match        https://chatgpt.com/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;

  // =============================
  // RouteB Bridge（外部→ChatGPTへ自動入力／自動送信）
  // =============================
  const BRIDGE_PREFIX = 'cgpt_launcher_payload_';
  const AUTOSEND_KEY  = 'cgpt_launcher_autosend_v1';
  const DEFAULT_AUTOSEND = false;

  // ---- GM wrappers（TM/VM両対応） ----
  async function gmGet(key, def = null) {
    try {
      const v = (typeof GM_getValue === 'function') ? GM_getValue(key, def) : def;
      return (v && typeof v.then === 'function') ? await v : v;
    } catch { return def; }
  }
  async function gmSet(key, val) {
    try { const r = (typeof GM_setValue === 'function') ? GM_setValue(key, val) : null; if (r && typeof r.then === 'function') await r; } catch {}
  }
  async function gmDel(key) {
    try { const r = (typeof GM_deleteValue === 'function') ? GM_deleteValue(key) : null; if (r && typeof r.then === 'function') await r; } catch {}
  }

  function genToken() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function getAutoSend() { try { return !!GM_getValue(AUTOSEND_KEY, DEFAULT_AUTOSEND); } catch { return DEFAULT_AUTOSEND; } }
  function setAutoSend(v) { try { GM_setValue(AUTOSEND_KEY, !!v); } catch {} }
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function getHashParam(name){
    const h = new URL(location.href).hash.replace(/^#/, '');
    if (!h) return null;
    const p = new URLSearchParams(h.includes('=') ? h : `launcher=${h}`);
    return p.get(name);
  }
  function setHashParam(name, value){
    const url = new URL(location.href);
    const p = new URLSearchParams(url.hash.replace(/^#/, ''));
    p.set(name, value);
    url.hash = p.toString();
    history.replaceState(null, '', url.toString());
  }

  function findPromptInput() {
    const sels = [
      'textarea[data-testid="prompt-textarea"]',
      'form textarea',
      'textarea[placeholder]',
      'div[contenteditable="true"]'
    ];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  async function fillInput(el, text) {
    const val = String(text);
    const setNative = (node, value) => {
      const proto = (node instanceof HTMLTextAreaElement) ? HTMLTextAreaElement.prototype
                  : (node instanceof HTMLInputElement) ? HTMLInputElement.prototype
                  : null;
      const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
      const setter = desc && desc.set;
      if (setter) setter.call(node, value);
      else node.value = value;
      try {
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      } catch {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.focus();
      setNative(el, val);
      return;
    }
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
      el.focus();
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, val);
      } catch {
        el.textContent = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    try { el.textContent = val; } catch {}
  }

  async function clickSendButton() {
    const sels = [
      'button[aria-label*="送信"]',
      'button[aria-label*="Send"]',
      'button[data-testid*="send"]',
      'button[type="submit"]',
      'form button:not([disabled])'
    ];
    for (let i = 0; i < 200; i++) { // 20秒まで待機
      for (const sel of sels) {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      await sleep(100);
    }
    return false;
  }
  function tryEnter(el){
    try {
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    } catch {}
  }

  async function applyPromptToChatGPTUI(text, { autoSend }) {
    let inputEl = null;
    for (let i = 0; i < 300; i++) { // 最大30秒待機
      inputEl = findPromptInput();
      if (inputEl) break;
      await sleep(100);
    }
    if (!inputEl) return;
    await fillInput(inputEl, String(text));
    if (autoSend) {
      const sent = await clickSendButton();
      if (!sent) tryEnter(inputEl);
    }
  }

  async function receiveAndApplyPromptIfAny() {
    if (!/chatgpt\.com$/i.test(location.hostname)) return;
    const token = getHashParam('launcher');
    if (!token) return;
    const key = BRIDGE_PREFIX + token;
    const payloadStr = await gmGet(key, null);
    if (!payloadStr) return;

    let applied = false;
    try {
      const payload = JSON.parse(payloadStr);
      if (!payload || !payload.prompt) return;
      await applyPromptToChatGPTUI(payload.prompt, { autoSend: !!payload.autoSend });
      applied = true;
    } finally {
      if (applied) {
        await gmDel(key);                  // ✅ 成功後に削除
        setHashParam('launcher_applied', '1');
      }
    }
  }

  function installReceiverWatchdog() {
    let tried = 0, maxTries = 300; // 最大30秒監視
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      const input = findPromptInput();
      if (input) {
        await receiveAndApplyPromptIfAny();
        clearInterval(loop);
      } else if (++tried >= maxTries) {
        clearInterval(loop);
      }
    };
    const loop = setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick, { once: true });
  }

  function sendPromptToChatGPT(prompt, opts = {}) {
    const autoSend = (opts.autoSend !== undefined) ? !!opts.autoSend : getAutoSend();
    const token = genToken();
    const content = (prompt || '').toString();
    const MAX_LEN = 12000; // 安全上限
    const payload = {
      prompt: content.length > MAX_LEN ? content.slice(0, MAX_LEN) + '\n\n[...truncated...]' : content,
      autoSend,
      from: location.href,
      ts: Date.now()
    };
    gmSet(BRIDGE_PREFIX + token, JSON.stringify(payload));
    const target = `https://chatgpt.com/#launcher=${encodeURIComponent(token)}`;
    try { GM_openInTab(target, { active: true, insert: true }); }
    catch { window.open(target, '_blank', 'noopener'); }
  }

  // 受信側（chatgpt.com）はUI描画せず、受信＋適用のみ
  if (/chatgpt\.com$/i.test(location.hostname)) {
    installReceiverWatchdog();
    receiveAndApplyPromptIfAny();
    return;
  }

  // =============================
  // UI（⚙️ + 🌐通常 + 🛠️強制）
  // =============================

  // ---------- Keys / Const ----------
  const STYLE_ID  = 'cgpt-ui-style';
  const STATE_KEY = 'cgpt_ui_state_v2';          // { mode:'corner'|'free', corner:'bottom-left', x,y, collapsed:true|false, __initialized_v122_toggle?:true }
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
    GM_registerMenuCommand(`ChatGPT自動送信: ${getAutoSend() ? 'ON' : 'OFF'}`, () => {
      const now = getAutoSend();
      setAutoSend(!now);
      showToast(`自動送信を ${!now ? 'ON' : 'OFF'} にしました`, 1800);
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
  const state = loadJSON(STATE_KEY, { mode:'corner', corner:'bottom-left', x:24, y:24, collapsed:true });
  if (state.__initialized_v122_toggle !== true) {
    state.collapsed = true;
    state.__initialized_v122_toggle = true;
    saveState();
  }

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

  const btnNormal = document.createElement('button');
  btnNormal.type = 'button';
  btnNormal.textContent = ' 🌐通常';
  btnNormal.className = 'chatgpt-btn';
  btnNormal.addEventListener('click', async () => {
    const url = window.location.href;
    const prompt = buildUrlPrompt(url);
    try { await copyText(prompt); } catch {}
    sendPromptToChatGPT(prompt, { autoSend: getAutoSend() });
    showToast('🚀 ChatGPTを開いたよ（通常：自動投入／またはコピー済み）');
  });

  const btnForce = document.createElement('button');
  btnForce.type = 'button';
  btnForce.textContent = ' 🛠️強制';
  btnForce.className = 'chatgpt-btn';
  btnForce.addEventListener('click', async () => {
    const url = window.location.href;
    const prompt = buildHybridPrompt(url);
    try { await copyText(prompt); } catch {}
    sendPromptToChatGPT(prompt, { autoSend: getAutoSend() });
    showToast('🚀 ChatGPTを開いたよ（強制：自動投入／またはコピー済み）');
  });

  container.appendChild(btnGear);
  container.appendChild(btnNormal);
  container.appendChild(btnForce);
  document.body.appendChild(container);

  applyCollapsed(state.collapsed);
  applyPositionFromState();

  // DOM差し替えで消える場合の自動復帰
  new MutationObserver(() => {
    if (!document.getElementById('chatgpt-ui-launcher')) {
      document.body.appendChild(container);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- Drag / Long-press / Click ----------
  let pressTimer=null, longPressed=false, dragging=false, startX=0, startY=0, startLeft=0, startTop=0, pointerId=null;
  const captureOpts = { capture: true };

  btnGear.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    pointerId = e.pointerId;
    try { btnGear.setPointerCapture(pointerId); } catch {}
    btnGear.classList.add('dragging');
    longPressed = false; dragging = false;

    const rect = container.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startLeft = rect.left; startTop = rect.top;

    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { longPressed = true; openMenuAt(e.clientX, e.clientY); }, LONGPRESS_MS);

    window.addEventListener('pointermove', onMove, captureOpts);
    window.addEventListener('pointerup', onUp, captureOpts);
    window.addEventListener('pointercancel', onCancel, captureOpts);
    window.addEventListener('blur', onCancel, captureOpts);
  });

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
      const {vw, vh, pad} = viewport();
      const nx = clamp(startLeft + dx, pad, vw - container.offsetWidth - pad);
      const ny = clamp(startTop + dy,  pad, vh - container.offsetHeight - pad);
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

  function onCancel(){ endDrag(); }
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
    btnNormal.style.display = collapsed ? 'none' : '';
    btnForce.style.display  = collapsed ? 'none'  : '';
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
    const rectW = 240, rectH = 190;
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

    const b4 = document.createElement('button');
    b4.textContent = `ChatGPT自動送信: ${getAutoSend() ? 'ON' : 'OFF'}`;
    b4.addEventListener('click', () => {
      const now = getAutoSend();
      setAutoSend(!now);
      b4.textContent = `ChatGPT自動送信: ${!now ? 'ON' : 'OFF'}`;
      showToast(`自動送信を ${!now ? 'ON' : 'OFF'} にしました`, 1800);
    });

    pop.appendChild(b1); pop.appendChild(b2); pop.appendChild(b3); pop.appendChild(b4);

    setTimeout(() => {
      const onDoc = (ev) => { if (!pop.contains(ev.target)) { closePopups(); document.removeEventListener('mousedown', onDoc, true); } };
      document.addEventListener('mousedown', onDoc, true);
    }, 0);
  }
  function closePopups(){ document.querySelectorAll('.cgpt-pop').forEach(n=>n.remove()); }

  // ---------- Prompt Builders ----------
  function getPageTextSnippet(limit = 3500) {
    try {
      let t = (document.body && document.body.innerText) ? document.body.innerText : '';
      t = t.replace(/\u00a0/g, ' ')
           .replace(/[\t ]+\n/g, '\n')
           .replace(/\n{3,}/g, '\n\n');
      return t.slice(0, limit);
    } catch { return ''; }
  }
  function buildUrlPrompt(url) {
    return `Please visit and analyze the following page:
${url}
If you cannot reliably access this URL (e.g. due to login, local network, or VPN), clearly say so and ask me to paste the relevant content.

Summarize the key points in Japanese using clear headers and bullet points.`;
  }
  function buildHybridPrompt(url) {
    const title = document.title || '';
    const snippet = getPageTextSnippet(3500);
    return `[Target URL]
${url}

[Page Title]
${title}

[Page Content Snippet]
${snippet}

If you can also directly access the URL with your browsing tools, you may use it as additional context. If not, rely solely on the content snippet above.

Summarize the key points in Japanese using clear headers and bullet points.`;
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
