// ==UserScript==
// @name         ChatGPT Prompt UI Launcher (UI: Normal/Force + RouteB/RouteC Bridge)
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      1.7.5
// @description  ChatGPTランチャー（🌐通常／🛠️強制）＋ 自動入力・自動送信。Route-C(window.name)優先→Route-B(GMストレージ)へフォールバック。ドラッグ移動、四隅吸着、折りたたみ、サイト別ON/OFF、DOM置換耐性、貼付自己修復、ログイン/遅延耐性強化。
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

  // ===== Double-injection guard =====
  if (window.__cgpt_ui_launcher_active__) return;
  window.__cgpt_ui_launcher_active__ = true;

  // =============================
  // Bridges & Storage
  // =============================
  const BRIDGE_PREFIX = 'cgpt_launcher_payload_';
  const QUEUE_KEY     = 'cgpt_launcher_queue_v1';
  const AUTOSEND_KEY  = 'cgpt_launcher_autosend_v1';
  const CONFIRM_ONCE_KEY = 'cgpt_launcher_confirm_once_v1';
  const DEFAULT_AUTOSEND = false;

  // ---- GM wrappers ----
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

  // ---- Queue (for Route-B fallback / login redirects) ----
  async function queueRead(){ return (await gmGet(QUEUE_KEY, [])) || []; }
  async function queueWrite(a){ await gmSet(QUEUE_KEY, a); }
  async function queuePush(tok){ const q=await queueRead(); q.push(tok); await queueWrite(q); }
  async function queueRemove(tok){
    const q=await queueRead(); const i=q.indexOf(tok); if(i>=0){ q.splice(i,1); await queueWrite(q); }
  }

  // ---- URL hash helpers ----
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

  // =============================
  // Sender: Route-C (window.name) → Route-B fallback
  // =============================
  function encodePayload(obj){
    // safe b64 for unicode
    const s = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(s)));
  }
  function decodePayload(b64){
    const s = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(s);
  }

  function sendPromptToChatGPT(prompt, opts = {}) {
    const autoSend = (opts.autoSend !== undefined) ? !!opts.autoSend : getAutoSend();
    const content = (prompt || '').toString();
    const MAX_LEN = 12000; // overall safety
    const token = genToken();
    const payload = {
      token,
      prompt: content.length > MAX_LEN ? content.slice(0, MAX_LEN) + '\n\n[...truncated...]' : content,
      autoSend,
      from: location.href,
      ts: Date.now()
    };

    // Route-C/Route-Bの二重タブ化を避けるため、まずRoute-B情報を準備する。
    gmSet(BRIDGE_PREFIX + token, JSON.stringify(payload));
    queuePush(token);
    gmSet(LAST_SENT_TS_KEY, payload.ts);
    gmSet(LAST_SENT_TOKEN_KEY, token);
    const routeBTarget = `https://chatgpt.com/#launcher=${encodeURIComponent(token)}`;

    // --- Route-C: window.name bridge (preferred; robust on mobile) ---
    // about:blankを経由すると遷移失敗時に空タブが残りやすいため、直接chatgpt.comを開く。
    try {
      const w = window.open('https://chatgpt.com/#from=wn', '_blank');
      if (w) {
        try { w.name = 'CGPTL|' + encodePayload(payload); } catch {}
        try { w.opener = null; } catch {}
        return;
      }
    } catch {}

    // --- Route-B fallback: popup handle unavailable ---
    try { GM_openInTab(routeBTarget, { active: true, insert: true }); }
    catch { window.open(routeBTarget, '_blank', 'noopener'); }
  }


  // =============================
  // Receiver on chatgpt.com
  // =============================
  function findPromptInput() {
    // まず “本命” を最優先で探す（ChatGPT側の実装揺れに対応）
    const sels = [
      'textarea#prompt-textarea',
      'textarea[data-testid="prompt-textarea"]',
      'textarea[aria-label*="Message" i]',
      'textarea[placeholder*="Message" i]',
      'div[contenteditable="true"][data-lexical-editor]',
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"][data-placeholder]',
    ];

    for (const sel of sels) {
      const nodes = document.querySelectorAll(sel);
      for (const el of nodes) {
        const editable = !el.matches('[disabled],[aria-disabled="true"]');
        if (editable && isElementVisible(el)) return el;
      }
    }

    // 最終手段：見えてる textarea / contenteditable を総当り
    const all = document.querySelectorAll('textarea, div[contenteditable="true"], [role="textbox"][contenteditable="true"]');
    for (const el of all) {
      const editable = !el.matches('[disabled],[aria-disabled="true"]');
      if (editable && isElementVisible(el)) return el;
    }

    return null;
  }

  function normalizeForCompare(s) {
    return String(s || '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\r\n\t ]+/g, ' ')
      .trim();
  }

  function readInputValue(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value || '';
    }
    return el.innerText || el.textContent || '';
  }

  function isElementVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity || 1) === 0) return false;
    const rects = el.getClientRects();
    return !!(rects && rects.length > 0);
  }

  async function waitForStableComposer(ms = 6000) {
    const until = Date.now() + ms;
    let stableCount = 0;
    let lastEl = null;

    while (Date.now() < until) {
      const el = findPromptInput();
      const visible = isElementVisible(el);
      const editable = !!(el && !el.matches('[disabled],[aria-disabled="true"]'));
      const changed = el !== lastEl;

      if (visible && editable && !changed) {
        stableCount += 1;
        if (stableCount >= 4) return el; // ~800ms stable
      } else if (visible && editable) {
        stableCount = 1;
      } else {
        stableCount = 0;
      }

      lastEl = el;
      await sleep(200);
    }
    return findPromptInput();
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

      // Strategy 1: synthetic paste (closest to real user behavior)
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', val);
        const pasteEv = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        el.dispatchEvent(pasteEv);
        if (verifyFilled(el, val)) return;
      } catch {}

      // Strategy 2: beforeinput/input for editors that ignore execCommand
      try {
        const beforeEv = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          data: val
        });
        el.dispatchEvent(beforeEv);
      } catch {}

      try {
        const sel = window.getSelection && window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        const ok = document.execCommand('insertText', false, val);
        if (!ok) throw new Error('insertText returned false');
        if (verifyFilled(el, val)) return;
      } catch {
        el.textContent = val;
        try {
          const sel = window.getSelection && window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch {}
        try {
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
        } catch {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (verifyFilled(el, val)) return;
      }

      // Strategy 3: final fallback for lexical-style editors
      try {
        const p = document.createElement('p');
        p.textContent = val;
        el.replaceChildren(p);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: val }));
      } catch {}
      return;
    }
    try { el.textContent = val; } catch {}
  }

  function verifyFilled(el, text) {
    const target = normalizeForCompare(text);
    const actual = normalizeForCompare(readInputValue(el));
    if (!target) return true;
    if (!actual) return false;

    const head = target.slice(0, 24);
    return actual.startsWith(head) || actual.includes(head);
  }

  async function clickSendButton() {
    const sels = [
      'button[aria-label*="送信"]',
      'button[aria-label*="Send"]',
      'button[data-testid*="send"]',
      'button[type="submit"]',
      'form button:not([disabled])'
    ];
    for (let i = 0; i < 200; i++) { // up to 20s
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

  async function waitForComposerReady(totalMs = 30000) {
    const deadline = Date.now() + totalMs;
    while (Date.now() < deadline) {
      const el = await waitForStableComposer(3000);
      if (el && el.isConnected) return el;
      await sleep(200);
    }
    return null;
  }

  async function applyPromptToChatGPTUI(text, { autoSend }) {
    const deadline = Date.now() + 30000; // up to 30s
    let inputEl = null, ok = false;

    while (Date.now() < deadline) {
      inputEl = await waitForStableComposer(3000);
      if (inputEl && inputEl.isConnected) {
        const payloadText = String(text);

        await fillInput(inputEl, payloadText);

        // 初期化/再マウントで消えるケースを避けるため、少し長めに保持確認
        await sleep(120);
        const stableCheck1 = verifyFilled(inputEl, payloadText);
        await sleep(260);
        const liveEl = findPromptInput();
        const stableCheck2 = liveEl && verifyFilled(liveEl, payloadText);

        // remount復旧: 要素が差し替わった場合に1回だけ再投入
        if (!stableCheck2 && liveEl && liveEl !== inputEl) {
          await fillInput(liveEl, payloadText);
          await sleep(150);
        }
        const stableCheck3 = liveEl && verifyFilled(liveEl, payloadText);

        ok = !!((stableCheck1 && stableCheck2) || stableCheck3);
        if (ok) {
          inputEl = liveEl || inputEl;
          break;
        }
      }
      await sleep(320);
    }
    if (!ok || !inputEl) return 'failed';

    if (autoSend) {
      const sent = await clickSendButton();
      if (!sent) tryEnter(inputEl);
    }
    return 'applied';
  }


  const MAX_PAYLOAD_AGE_MS = 2 * 60 * 1000;
  const FORCE_DISABLE_AUTOSEND = true;
  const SESSION_TOKEN_KEY = 'cgpt_launcher_session_token_v1';
  const LAST_SENT_TS_KEY = 'cgpt_launcher_last_sent_ts_v1';
  const LAST_SENT_TOKEN_KEY = 'cgpt_launcher_last_sent_token_v1';

  async function receiveAndApplyPromptIfAny() {

    if (!/chatgpt\.com$/i.test(location.hostname)) return false;

    // ---- Route-C: window.name first ----
    try {
      if (typeof window.name === 'string' && window.name.startsWith('CGPTL|')) {
        const b64 = window.name.slice(6);
        const payload = decodePayload(b64);
        const latestTs = await gmGet(LAST_SENT_TS_KEY, 0);
        if (latestTs && payload?.ts && payload.ts < latestTs) {
          window.name = '';
          return false;
        }
        const tooOld = payload?.ts && (Date.now() - payload.ts > MAX_PAYLOAD_AGE_MS);
        if (tooOld) {
          window.name = '';
          return false;
        }
        if (payload && payload.prompt) {
          const composer = await waitForComposerReady(30000);
          if (!composer) return false;

          const result = await applyPromptToChatGPTUI(payload.prompt, {
            autoSend: FORCE_DISABLE_AUTOSEND ? false : !!payload.autoSend
          });
          if (result === 'applied') {
            window.name = ''; // clear only after success
            if (payload?.token) {
              await gmDel(BRIDGE_PREFIX + payload.token);
              await queueRemove(payload.token);
              const lastToken = await gmGet(LAST_SENT_TOKEN_KEY, null);
              if (lastToken === payload.token) {
                await gmDel(LAST_SENT_TOKEN_KEY);
                await gmDel(LAST_SENT_TS_KEY);
              }
            }
            setHashParam('launcher_applied', '1');
            return true;
          }
          return false;
        }
      }
    } catch {}

    // ---- Route-B: GM storage + #token (session-scoped) ----
    let token = getHashParam('launcher');
    if (token) {
      try { sessionStorage.setItem(SESSION_TOKEN_KEY, token); } catch {}
    } else {
      try { token = sessionStorage.getItem(SESSION_TOKEN_KEY) || null; } catch {}
    }
    if (!token) return false;

    const key = BRIDGE_PREFIX + token;
    const payloadStr = await gmGet(key, null);
    if (!payloadStr) return false;

    let applied = false;
    let shouldDiscard = false;
    let payload = null;
    try {
      payload = JSON.parse(payloadStr);
      if (!payload || !payload.prompt) return false;

      const composer = await waitForComposerReady(30000);
      if (!composer) return false;

      const tooOld = payload?.ts && (Date.now() - payload.ts > MAX_PAYLOAD_AGE_MS);
      if (tooOld) { shouldDiscard = true; return false; }

      const result = await applyPromptToChatGPTUI(payload.prompt, {
        autoSend: FORCE_DISABLE_AUTOSEND ? false : !!payload.autoSend
      });
      applied = (result === 'applied');
      return applied;
    } finally {
      if (applied || shouldDiscard) {
        await gmDel(key);
        await queueRemove(token);
        try { sessionStorage.removeItem(SESSION_TOKEN_KEY); } catch {}
        if (payload?.token) {
          const lastToken = await gmGet(LAST_SENT_TOKEN_KEY, null);
          if (lastToken === payload.token) {
            await gmDel(LAST_SENT_TOKEN_KEY);
            await gmDel(LAST_SENT_TS_KEY);
          }
        }
        setHashParam('launcher_applied', '1');
      }
    }
  }

  function installReceiverWatchdog() {
    let tried = 0, maxTries = 300; // 30s
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      if (document.visibilityState !== 'visible') return;

      inFlight = true;
      try {
        const applied = await receiveAndApplyPromptIfAny();
        if (applied) {
          clearInterval(loop);
        } else if (++tried >= maxTries) {
          clearInterval(loop);
        }
      } finally {
        inFlight = false;
      }
    };

    const loop = setInterval(tick, 100);
    tick(); // immediate first attempt (single-flight)
    document.addEventListener('visibilitychange', tick, { once: true });
  }

  if (/chatgpt\.com$/i.test(location.hostname)) {
    installReceiverWatchdog();
    return;
  }

  // =============================
  // UI（⚙️ + 🌐通常 + 🛠️強制）
  // =============================
  const STYLE_ID  = 'cgpt-ui-style';
  const STATE_KEY = 'cgpt_ui_state_v2';
  const HOST_KEY  = 'cgpt_ui_hostprefs_v1';
  const CORNERS = ['bottom-left','bottom-right','top-right','top-left'];
  const LONGPRESS_MS = 600;
  const DRAG_THRESHOLD_PX = 6;
  const SNAP_RADIUS_PX = 64;

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
    GM_registerMenuCommand('キャッシュ無視で再読込', () => {
      const u = new URL(location.href);
      u.searchParams.set('_cb', Date.now());
      location.href = u.toString();
    });
  }
  if (!enabled(host)) return;

  // ---- Style (once) ----
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .chatgpt-btn{
        background-color:#10a37f;color:#fff;border:none;
        padding:6px 10px;border-radius:6px;cursor:pointer;
        font-size:clamp(11px,2vw,13px);font-weight:700;
        min-height:32px;line-height:1.1;user-select:none;
        box-shadow:0 1px 5px rgba(0,0,0,.18);touch-action:manipulation;
      }
      .chatgpt-btn:hover{background-color:#0e8f70;}
      .chatgpt-gear{
        background:transparent;border:none;color:inherit;width:28px;height:28px;
        display:flex;align-items:center;justify-content:center;
        font-size:20px;cursor:grab;line-height:1;padding:0;box-shadow:none;
        user-select:none;touch-action:none;
      }
      .chatgpt-gear.dragging{cursor:grabbing;}
      .cgpt-toast{
        position:fixed;left:50%;transform:translateX(-50%);
        bottom:calc(12px + env(safe-area-inset-bottom));
        background:rgba(17,17,17,.92);color:#fff;padding:8px 12px;border-radius:8px;
        font-size:12px;z-index:2147483647;box-shadow:0 6px 20px rgba(0,0,0,.35);
        pointer-events:none;opacity:0;transition:opacity .2s ease;
      }
      .cgpt-toast.show{opacity:1;}
      .cgpt-pop{
        position:fixed;z-index:2147483647;background:#fff;color:#111;border:1px solid #ddd;
        border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:8px;min-width:180px;font-size:13px;
      }
      .cgpt-pop button{
        display:block;width:100%;text-align:left;background:#f6f6f6;border:none;border-radius:6px;
        padding:8px 10px;margin:4px 0;cursor:pointer;
      }
      .cgpt-pop button:hover{background:#e9e9e9;}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // 旧ランチャーDOMの掃除
  try { document.querySelectorAll('#chatgpt-ui-launcher').forEach(n => n.remove()); } catch {}

  // ---------- UI ----------
  const state = loadJSON(STATE_KEY, { mode:'corner', corner:'bottom-left', x:24, y:24, collapsed:true });
  if (state.__initialized_v122_toggle !== true) {
    state.collapsed = true;
    state.__initialized_v122_toggle = true;
    saveState();
  }

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
    const rectW = 240, rectH = 200;
    pop.style.left = Math.min(vw - rectW - 8, Math.max(8, x - 20)) + 'px';
    pop.style.top  = Math.min(vh - rectH - 8, Math.max(8, y + 8)) + 'px';

    const enabledNow = enabled(host);

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

  function enabled(h){ const p = prefs[h]; return !p || p.enabled !== false; }
  function setHostEnabled(h, en){
    prefs[h] = { enabled: !!en };
    saveJSON(HOST_KEY, prefs);
  }
  function menuLabelForHost(isEnabled){ return isEnabled ? 'このサイトで無効にする' : 'このサイトで有効にする'; }

  function saveState(){ saveJSON(STATE_KEY, state); }
  function loadJSON(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch{ return def; } }
  function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
})();
