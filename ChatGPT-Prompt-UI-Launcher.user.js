// ==UserScript==
// @name         ChatGPT-Prompt-UI-Launcher
// @namespace    https://github.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher
// @version      0.9.2
// @description  オーバーレイ/ESC/Tab/トースト/選択テキスト注入/ダーク/ドラッグ/設定パネル/モバイル対応📱✨
// @author       scarecrowx913x
// @license      MIT
// @match        *://*/*
// @run-at       document-end
// @noframes
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @downloadURL  https://raw.githubusercontent.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js
// @updateURL    https://raw.githubusercontent.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js
// @supportURL   https://github.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/issues
// @homepageURL  https://github.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher
// @icon         https://chat.openai.com/favicon.ico
// ==/UserScript==

(function () {
  'use strict';
  if (window.top !== window.self) return;
  if (document.getElementById('chatgpt-ui-launcher')) return;

  // ----------- Constants / Storage Keys -----------
  const CHATGPT_URLS = ['https://chat.openai.com/', 'https://chatgpt.com/'];
  const CFG_KEY = 'cgpt.launcher.cfg.v1';
  const POS_KEY = 'cgpt.launcher.pos.v1';
  const HOST = location.host;
  const Z_TOP = 2147483647;

  const defaultCfg = {
    positionMode: 'corner', // 'corner' | 'free'
    corner: 'bl',           // 'bl' | 'br' | 'tl' | 'tr'
    snap: true,
    scale: 1.0,
    opacity: 1.0,
    autoMinimize: false,
    autoMinimizeMs: 3000,
    showOnMobile: true,
    showOnDesktop: true,
    perSiteOverride: false,
  };

  // ----------- Utilities -----------
  function loadCfg() {
    try {
      const all = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
      const base = { ...defaultCfg, ...(all._global || {}) };
      if (base.perSiteOverride && all[HOST]) return { ...base, ...all[HOST] };
      return base;
    } catch { return { ...defaultCfg }; }
  }

  function saveCfg(newCfg) {
    const all = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    const base = { ...defaultCfg, ...(all._global || {}) };
    const merged = { ...base, ...newCfg };
    if (merged.perSiteOverride) {
      all._global = base;
      all[HOST] = merged;
    } else {
      all._global = merged;
      delete all[HOST];
    }
    localStorage.setItem(CFG_KEY, JSON.stringify(all));
  }

  function loadPos() {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch { return null; }
  }
  function savePos(left, top) {
    localStorage.setItem(POS_KEY, JSON.stringify({ left, top, ts: Date.now() }));
  }

  function vw() { return (window.visualViewport?.width ?? window.innerWidth); }
  function vh() { return (window.visualViewport?.height ?? window.innerHeight); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function isMobile() { return matchMedia('(pointer:coarse)').matches || Math.min(screen.width, screen.height) < 768; }

  async function copyToClipboard(text) {
    try {
      if (typeof GM_setClipboard === 'function') { GM_setClipboard(text); return; }
      throw new Error('GM_setClipboard unavailable');
    } catch (_) {
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(text); return; } catch {}
      }
      // textarea fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
  }

  function openChatGPT() {
    const u = CHATGPT_URLS.find(Boolean) || 'https://chat.openai.com/';
    try {
      if (typeof GM_openInTab === 'function') {
        GM_openInTab(u, { active: true, setParent: true });
      } else {
        window.open(u, '_blank', 'noopener');
      }
    } catch (_) { window.location.href = u; }
  }

  // ----------- Styles -----------
  const styleSafe = document.createElement('style');
  styleSafe.textContent = `
:root{
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
`;
  document.head.appendChild(styleSafe);

  const style = document.createElement('style');
  style.textContent = `
:root{
  --cgpt-bg:#fff; --cgpt-fg:#111; --cgpt-ol:rgba(0,0,0,.5);
  --cgpt-ac:#10a37f; --cgpt-ac2:#0e8f70; --cgpt-m:#eee; --cgpt-mf:#333;
  --cgpt-z:${Z_TOP};
}
@media (prefers-color-scheme: dark){
  :root{ --cgpt-bg:#1f1f1f; --cgpt-fg:#eaeaea; --cgpt-m:#2a2a2a; --cgpt-mf:#ddd; }
}
.chatgpt-btn{
  background:var(--cgpt-ac); color:#fff; border:none; padding:6px 10px;
  border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;
  box-shadow:0 2px 6px rgba(0,0,0,.2)
}
.chatgpt-btn:hover{ background:var(--cgpt-ac2); }
.cgpt-modal-overlay{
  position:fixed; inset:0; background:var(--cgpt-ol);
  display:flex; align-items:center; justify-content:center; z-index:var(--cgpt-z);
}
.cgpt-modal{
  position:relative; background:var(--cgpt-bg); color:var(--cgpt-fg);
  padding:20px; border-radius:8px; text-align:center; max-width:360px; width:92%;
  box-shadow:0 4px 12px rgba(0,0,0,.3)
}
.cgpt-modal-close{
  position:absolute; top:8px; right:8px; background:transparent; border:none;
  font-size:18px; cursor:pointer; color:#888
}
.cgpt-modal-close:hover{ color:#fff; }
.cgpt-modal-btn{
  margin:12px 8px 0; padding:10px 16px; border:none; border-radius:4px;
  cursor:pointer; font-size:14px; font-weight:bold
}
.cgpt-modal-btn.open{ background:var(--cgpt-ac); color:#fff; }
.cgpt-modal-btn.copy{ background:var(--cgpt-m); color:var(--cgpt-mf); }
#chatgpt-ui-launcher{
  position:fixed; z-index:var(--cgpt-z); display:flex; flex-direction:column; gap:6px;
}
.cgpt-toast{
  position:fixed; bottom:calc(20px + var(--safe-bottom)); right:calc(20px + var(--safe-right));
  z-index:var(--cgpt-z); background:var(--cgpt-bg); color:var(--cgpt-fg);
  padding:10px 14px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,.3)
}
.chatgpt-gear{
  background:transparent; border:none; cursor:pointer; font-size:16px; align-self:flex-start;
}
.cgpt-dragbar{
  height:8px; border-radius:6px; background:rgba(0,0,0,.2); cursor:move; margin-bottom:4px;
}
@media (pointer:coarse){
  .chatgpt-btn{ padding:10px 14px; font-size:15px; }
}
`;
  document.head.appendChild(style);

  // ----------- Toast -----------
  function toast(msg, ms = 2400) {
    const t = document.createElement('div');
    t.className = 'cgpt-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ----------- Modal (ESC/Tab trap/scroll lock) -----------
  let openerButton = null;
  function showActionModal(promptText) {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    const overlay = document.createElement('div'); overlay.className = 'cgpt-modal-overlay';
    const modal = document.createElement('div'); modal.className = 'cgpt-modal';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'ChatGPTアクション');

    const btnClose = document.createElement('button'); btnClose.className = 'cgpt-modal-close'; btnClose.textContent = '✕';
    const title = document.createElement('p'); title.textContent = 'どうする？';
    const btnOpen = document.createElement('button'); btnOpen.className = 'cgpt-modal-btn open'; btnOpen.textContent = 'ChatGPTを開く 🌐';
    const btnCopy = document.createElement('button'); btnCopy.className = 'cgpt-modal-btn copy'; btnCopy.textContent = 'プロンプトだけコピー 📋';

    modal.append(btnClose, title, btnOpen, btnCopy);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const focusables = [];
    setTimeout(() => { focusables.push(...modal.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')); focusables[0]?.focus(); }, 0);

    function closeModal() {
      overlay.remove();
      document.documentElement.style.overflow = prevOverflow || '';
      openerButton?.focus?.();
    }

    btnClose.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); closeModal(); }
      if (e.key === 'Tab' && focusables.length) {
        const i = focusables.indexOf(document.activeElement);
        const dir = e.shiftKey ? -1 : 1;
        const next = (i + dir + focusables.length) % focusables.length;
        focusables[next].focus();
        e.preventDefault();
      }
    }, { capture: true });

    btnOpen.addEventListener('click', async () => {
      closeModal();
      await copyToClipboard(promptText).catch(() => {});
      openChatGPT();
      toast('🚀 ChatGPTを開いたよ！');
    });
    btnCopy.addEventListener('click', async () => {
      closeModal();
      try { await copyToClipboard(promptText); toast('📋 コピーしたよ！'); }
      catch { toast('⚠️ コピー失敗…'); }
    });
  }

  function handleAction(promptText, btn) { openerButton = btn || null; showActionModal(promptText); }

  function buildContextualPrompt(template) {
    const url = location.href;
    const title = document.title || '';
    const selection = (window.getSelection?.().toString() || '').trim();
    return template
      .replace('{URL}', url)
      .replace('{TITLE}', title)
      .replace('{SELECTION}', selection ? `\n[Selection]\n${selection}\n` : '');
  }

  // ----------- Settings Panel -----------
  function showSettings(container, applyCfg) {
    const cfg = loadCfg();

    const wrap = document.createElement('div');
    wrap.className = 'cgpt-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'cgpt-modal';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');

    const close = document.createElement('button');
    close.className = 'cgpt-modal-close';
    close.textContent = '✕';

    const h = document.createElement('h3');
    h.textContent = '設定';

    function row(label, input, small) {
      const r = document.createElement('div');
      r.style.textAlign = 'left';
      r.style.marginTop = '10px';
      const l = document.createElement('label');
      l.textContent = label;
      l.style.display = 'block';
      l.style.fontSize = '12px';
      if (small) {
        const s = document.createElement('div');
        s.style.fontSize = '11px';
        s.style.opacity = '0.75';
        s.textContent = small;
        r.appendChild(l); r.appendChild(s);
      } else {
        r.appendChild(l);
      }
      r.appendChild(input);
      return r;
    }

    const selMode = document.createElement('select');
    selMode.innerHTML = `<option value="corner">corner</option><option value="free">free</option>`;
    selMode.value = cfg.positionMode;

    const selCorner = document.createElement('select');
    selCorner.innerHTML = `<option value="bl">左下</option><option value="br">右下</option><option value="tl">左上</option><option value="tr">右上</option>`;
    selCorner.value = cfg.corner;

    const chkSnap = document.createElement('input'); chkSnap.type = 'checkbox'; chkSnap.checked = cfg.snap;
    const rngScale = document.createElement('input'); rngScale.type = 'range'; rngScale.min = '0.8'; rngScale.max = '1.4'; rngScale.step = '0.05'; rngScale.value = String(cfg.scale);
    const rngOpacity = document.createElement('input'); rngOpacity.type = 'range'; rngOpacity.min = '0.35'; rngOpacity.max = '1'; rngOpacity.step = '0.05'; rngOpacity.value = String(cfg.opacity);
    const chkAutoMin = document.createElement('input'); chkAutoMin.type = 'checkbox'; chkAutoMin.checked = cfg.autoMinimize;
    const numAutoMs = document.createElement('input'); numAutoMs.type = 'number'; numAutoMs.min = '500'; numAutoMs.step = '100'; numAutoMs.value = String(cfg.autoMinimizeMs);
    const chkMob = document.createElement('input'); chkMob.type = 'checkbox'; chkMob.checked = cfg.showOnMobile;
    const chkDesk = document.createElement('input'); chkDesk.type = 'checkbox'; chkDesk.checked = cfg.showOnDesktop;
    const chkPerSite = document.createElement('input'); chkPerSite.type = 'checkbox'; chkPerSite.checked = cfg.perSiteOverride;

    const btnSave = document.createElement('button'); btnSave.className = 'cgpt-modal-btn open'; btnSave.textContent = '保存';
    const btnReset = document.createElement('button'); btnReset.className = 'cgpt-modal-btn copy'; btnReset.textContent = 'リセット';

    modal.append(
      close, h,
      row('位置モード', selMode, 'corner=四隅固定 / free=自由配置（ドラッグ可）'),
      row('角（corner時）', selCorner),
      row('スナップ（free時）', chkSnap),
      row(`サイズ (${rngScale.value})`, rngScale),
      row(`透明度 (${rngOpacity.value})`, rngOpacity),
      row('自動ミニ化', chkAutoMin),
      row('ミニ化までの時間(ms)', numAutoMs),
      row('モバイルで表示', chkMob),
      row('デスクトップで表示', chkDesk),
      row(`サイト別設定（${HOST}）`, chkPerSite),
      btnSave, btnReset
    );
    wrap.appendChild(modal);
    document.body.appendChild(wrap);

    close.onclick = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    rngScale.oninput = () => { rngScale.previousSibling.textContent = `サイズ (${rngScale.value})`; };
    rngOpacity.oninput = () => { rngOpacity.previousSibling.textContent = `透明度 (${rngOpacity.value})`; };

    btnSave.onclick = () => {
      saveCfg({
        positionMode: selMode.value,
        corner: selCorner.value,
        snap: chkSnap.checked,
        scale: parseFloat(rngScale.value),
        opacity: parseFloat(rngOpacity.value),
        autoMinimize: chkAutoMin.checked,
        autoMinimizeMs: parseInt(numAutoMs.value, 10),
        showOnMobile: chkMob.checked,
        showOnDesktop: chkDesk.checked,
        perSiteOverride: chkPerSite.checked,
      });
      applyCfg(container);
      wrap.remove();
    };
    btnReset.onclick = () => {
      const all = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
      delete all[HOST]; delete all._global;
      localStorage.setItem(CFG_KEY, JSON.stringify(all));
      applyCfg(container);
      wrap.remove();
    };
  }

  // ----------- Drag (Pointer Events) -----------
  function enableDrag(container, applyCfg) {
    let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType !== 'touch') return;
      dragging = true;
      container.setPointerCapture?.(e.pointerId);
      const rect = container.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; sl = rect.left; st = rect.top;
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const cfg = loadCfg();
      if (cfg.positionMode !== 'free') return;

      const padL = 0, padT = 0, padR = 0, padB = 0; // safe-areaは初期化済みCSSで確保
      const left = clamp(sl + (e.clientX - sx), padL, vw() - container.offsetWidth - padR);
      const top = clamp(st + (e.clientY - sy), padT, vh() - container.offsetHeight - padB);
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      const rect = container.getBoundingClientRect();
      savePos(rect.left, rect.top);

      const cfg = loadCfg();
      if (cfg.positionMode === 'free' && cfg.snap) {
        const toLeft = rect.left < (vw() / 2 - rect.width / 2);
        const toTop = rect.top < (vh() / 2 - rect.height / 2);
        container.style.left = `${toLeft ? 12 : vw() - rect.width - 12}px`;
        container.style.top = `${toTop ? 12 : vh() - rect.height - 12}px`;
        const r2 = container.getBoundingClientRect();
        savePos(r2.left, r2.top);
      }
    };

    container.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });

    const clampIntoView = () => {
      const rect = container.getBoundingClientRect();
      const left = clamp(rect.left, 0, vw() - rect.width);
      const top = clamp(rect.top, 0, vh() - rect.height);
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
      savePos(left, top);
    };
    window.addEventListener('resize', clampIntoView);
    window.visualViewport?.addEventListener('resize', clampIntoView, { passive: true });
  }

  // ----------- Apply Settings / Initial Position -----------
  function applyCfg(container) {
    const cfg = loadCfg();
    const mobile = isMobile();
    if ((mobile && !cfg.showOnMobile) || (!mobile && !cfg.showOnDesktop)) {
      container.style.display = 'none';
      return;
    } else {
      container.style.display = 'flex';
    }

    container.style.transform = `scale(${cfg.scale})`;
    container.style.opacity = `${cfg.opacity}`;

    const saved = loadPos();
    if (cfg.positionMode === 'corner' || !saved) {
      const pad = 12;
      const map = {
        bl: () => ({ left: pad, top: vh() - container.offsetHeight - pad }),
        br: () => ({ left: vw() - container.offsetWidth - pad, top: vh() - container.offsetHeight - pad }),
        tl: () => ({ left: pad, top: pad }),
        tr: () => ({ left: vw() - container.offsetWidth - pad, top: pad }),
      };
      const pos = (map[cfg.corner] || map.bl)();
      container.style.left = `${pos.left}px`;
      container.style.top = `${pos.top}px`;
      savePos(pos.left, pos.top);
    } else {
      const left = clamp(saved.left, 0, vw() - container.offsetWidth);
      const top = clamp(saved.top, 0, vh() - container.offsetHeight);
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
    }

    if (cfg.autoMinimize) {
      let t;
      const arm = () => {
        clearTimeout(t);
        t = setTimeout(() => {
          container.style.opacity = `${Math.min(cfg.opacity, 0.5)}`;
          container.style.transform = `scale(${cfg.scale * 0.9})`;
        }, cfg.autoMinimizeMs);
      };
      const disarm = () => {
        clearTimeout(t);
        container.style.opacity = `${cfg.opacity}`;
        container.style.transform = `scale(${cfg.scale})`;
        arm();
      };
      ['pointerenter', 'pointerleave', 'pointerdown', 'pointerup', 'touchstart', 'mousemove', 'scroll', 'keydown'].forEach(ev => {
        window.addEventListener(ev, disarm, { passive: true });
      });
      arm();
    }
  }

  // ----------- Launcher UI -----------
  const container = document.createElement('div');
  container.id = 'chatgpt-ui-launcher';
  container.style.left = `calc(20px + var(--safe-left))`;
  container.style.bottom = `calc(20px + var(--safe-bottom))`; // will be overridden by applyCfg (top/left)
  container.style.position = 'fixed';
  container.style.zIndex = String(Z_TOP);
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '6px';

  const dragbar = document.createElement('div');
  dragbar.className = 'cgpt-dragbar';
  container.appendChild(dragbar);

  const gear = document.createElement('button');
  gear.className = 'chatgpt-gear';
  gear.title = '設定';
  gear.textContent = '⚙️';
  gear.onclick = () => showSettings(container, applyCfg);
  container.appendChild(gear);

  const btnSummary = document.createElement('button');
  btnSummary.textContent = ' 📘要約';
  btnSummary.className = 'chatgpt-btn';
  btnSummary.onclick = (e) => {
    const promptText = buildContextualPrompt(
`Please analyze:
Title: {TITLE}
URL: {URL}
{SELECTION}
Summarize the key points in Japanese using headers and bullet points.`);
    handleAction(promptText, e.currentTarget);
  };

  const btnExplain = document.createElement('button');
  btnExplain.textContent = ' 🔍️解説';
  btnExplain.className = 'chatgpt-btn';
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

  container.appendChild(btnSummary);
  container.appendChild(btnExplain);
  document.body.appendChild(container);

  // Initialize position/appearance & enable drag
  // Switch from bottom-based to top-based placement
  container.style.bottom = '';
  applyCfg(container);

  // Dragging: handle starts on dragbar, or Alt+drag anywhere in container
  dragbar.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Temporarily switch to free mode while dragging? Keep user setting.
  });
  enableDrag(container, applyCfg);
  container.addEventListener('pointerdown', (e) => { if (e.altKey) e.target === container && e.preventDefault(); });

  // ----------- Hotkeys -----------
  // Alt+Shift+S/E: open summary/explain; Alt+Shift+G: minimize toggle
  let minimized = false;
  function toggleMini() {
    minimized = !minimized;
    container.style.transform = minimized ? 'scale(0.85)' : `scale(${loadCfg().scale})`;
    container.style.opacity = minimized ? '0.35' : `${loadCfg().opacity}`;
  }
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || !e.shiftKey || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 's') { btnSummary.click(); }
    if (k === 'e') { btnExplain.click(); }
    if (k === 'g') { toggleMini(); }
  });

})();
