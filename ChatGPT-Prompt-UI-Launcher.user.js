// ==UserScript==
// @name         ChatGPT-Prompt-UI-Launcher (Fixed + ShadowDOM)
// @namespace    https://github.com/scarecrowx913x/chatgpt-ui-launcher
// @version      0.9.3
// @description  Quick launcher for summary/explain prompts with draggable UI; mobile-safe; Shadow DOM; per-site position; initial-corner auto-avoid.
// @author       scarecrowx913x
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Config & Storage ----------
  const HOST = location.host;
  const CFG_KEY = 'cgpt.launcher.cfg.v2';
  const POS_KEY_GLOBAL = 'cgpt.launcher.pos.v2';
  const POS_KEY_SITE_PREFIX = 'cgpt.launcher.pos.v2:';
  const TOAST_LIMIT = 3;

  const defaultCfg = {
    corner: 'bl',              // 'bl'|'br'|'tl'|'tr'
    offsetX: 16,
    offsetY: 16,
    snap: 12,
    minified: false,
    perSiteOverride: false,    // true=位置をサイト別保存
    hideOnChatGPT: true,       // chatgpt.com等ではUIを出さない
    selectionMaxChars: 2000,   // {SELECTION} の上限
    openChatGPT: true,         // コピー後にChatGPTを開く
    language: 'ja',            // 予備
    templates: {
      summary: '以下のテキストを300字で要約：\\n\\n{SELECTION}\\n\\n#出力\\n・重要点を3つの箇条書き\\n・専門用語は一言補足\\n・最後に結論を一文',
      explain: '以下のテキストを中学生にも分かるように解説：\\n\\n{SELECTION}\\n\\n#出力\\n・ポイント3つ\\n・比喩を1つ\\n・最後に注意点'
    },
  };

  const chatgptHosts = /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i;

  // 既存設定読み込み
  function loadCfg() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      if (!raw) return structuredClone(defaultCfg);
      const parsed = JSON.parse(raw);
      return deepMerge(structuredClone(defaultCfg), parsed);
    } catch {
      return structuredClone(defaultCfg);
    }
  }
  function saveCfg(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }
  function posKey(cfg) {
    return cfg.perSiteOverride ? (POS_KEY_SITE_PREFIX + HOST) : POS_KEY_GLOBAL;
  }
  function loadPos(cfg) {
    try {
      const raw = localStorage.getItem(posKey(cfg));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function savePos(cfg, pos) {
    localStorage.setItem(posKey(cfg), JSON.stringify(pos));
  }

  function deepMerge(base, add) {
    for (const k of Object.keys(add || {})) {
      if (add[k] && typeof add[k] === 'object' && !Array.isArray(add[k])) {
        base[k] = deepMerge(base[k] || {}, add[k]);
      } else {
        base[k] = add[k];
      }
    }
    return base;
  }

  let cfg = loadCfg();

  // ChatGPTドメインで非表示
  if (cfg.hideOnChatGPT && chatgptHosts.test(HOST)) return;

  // ---------- Utilities ----------
  const vw = () => (window.visualViewport?.width || window.innerWidth);
  const vh = () => (window.visualViewport?.height || window.innerHeight);

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function snap(n, s) { return Math.round(n / s) * s; }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    if (children && children.length) node.append(...children);
    return node;
  }

  function getSelectionText(maxChars) {
    const sel = document.getSelection();
    let text = sel ? (sel.toString?.() || '') : '';
    text = text.replace(/\s+$/,''); // 末尾整形
    if (!maxChars || text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n...（長文のため省略）';
  }

  function copyToClipboard(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return true;
      }
    } catch {}
    // フォールバック
    try {
      const ta = el('textarea', { value: text });
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }

  function openChatGPTTab() {
    try {
      if (typeof GM_openInTab === 'function') {
        GM_openInTab('https://chatgpt.com/?utm_source=ui_launcher', { active: true, insert: true });
      } else {
        window.open('https://chatgpt.com/?utm_source=ui_launcher', '_blank', 'noopener');
      }
    } catch {
      window.open('https://chatgpt.com/?utm_source=ui_launcher', '_blank', 'noopener');
    }
  }

  // 初回角の自動回避（左下が塞がれている場合に迂回）
  function chooseInitialCorner(baseCorner) {
    if (loadPos(cfg)) return baseCorner; // 既に手動位置あり
    const order = (function* () {
      // base → 他3角の順に試す
      const arr = ['bl','br','tl','tr'];
      yield baseCorner;
      for (const c of arr) if (c !== baseCorner) yield c;
    })();
    for (const c of order) {
      if (!isCornerBlocked(c)) return c;
    }
    return baseCorner;
  }

  function isCornerBlocked(corner) {
    // 角から16px内側のポイントで elementFromPoint を見る
    const margin = 16;
    let x = margin, y = margin;
    if (corner.includes('r')) x = vw() - margin;
    if (corner.includes('b')) y = vh() - margin;
    const elmt = document.elementFromPoint(x, y);
    if (!elmt || elmt === document.documentElement || elmt === document.body) return false;
    // 固定要素っぽい/ボタンっぽい要素はブロック判定
    const cs = getComputedStyle(elmt);
    const fixedish = cs.position === 'fixed' || cs.position === 'sticky';
    const clickable = /(button|a|input|label|select|textarea)/i.test(elmt.tagName) || cs.cursor === 'pointer';
    return fixedish || clickable;
  }

  // ---------- Shadow DOM Host ----------
  const host = el('div', { id: 'cgpt-launcher-host' });
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  // Toast container（Shadow側）
  const toastWrap = el('div', { id: 'cgpt-toast-wrap', role: 'region', 'aria-label': '通知' });
  shadow.appendChild(toastWrap);

  function showToast(message, type = 'info', ms = 2200) {
    // 上限管理
    while (toastWrap.childElementCount >= TOAST_LIMIT) {
      toastWrap.firstElementChild?.remove();
    }
    const t = el('div', {
      className: `cgpt-toast ${type}`,
      role: 'status',
      ariaLive: 'polite',
      textContent: message
    });
    toastWrap.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, ms);
  }

  // ---------- Styles ----------
  const style = el('style');
  style.textContent = `
:host, :root { --cgpt-z: 2147483647; --pad: 10px; }
#cgpt-toast-wrap {
  position: fixed; inset: auto 0 env(safe-area-inset-bottom) 0;
  bottom: calc(10px + env(safe-area-inset-bottom));
  display: grid; place-items: center; gap: 6px; z-index: var(--cgpt-z);
  pointer-events: none;
}
.cgpt-toast {
  opacity: 0; transform: translateY(6px);
  transition: opacity .18s ease, transform .18s ease;
  background: rgba(24,24,27,.96); color: #fff; font: 12px/1.4 system-ui, sans-serif;
  padding: 8px 12px; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.25);
  pointer-events: auto; max-width: min(90vw, 480px);
}
.cgpt-toast.show { opacity: 1; transform: translateY(0); }
.cgpt-toast.success { background: rgba(16,115,36,.96); }
.cgpt-toast.warn { background: rgba(190,112,0,.96); }
.cgpt-toast.error { background: rgba(166,22,22,.96); }

/* Launcher */
.wrap {
  position: fixed; z-index: var(--cgpt-z);
  inset: auto auto auto auto; /* left/top/right/bottomはJSで設定 */
  display: grid; grid-auto-flow: row; gap: 6px;
  filter: drop-shadow(0 6px 18px rgba(0,0,0,.22));
  touch-action: none;
}
.box {
  backdrop-filter: saturate(1.2) blur(6px);
  background: color-mix(in lch, white 85%, transparent);
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 16px; padding: 8px;
  min-width: 56px;
}
.dragbar {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px;
  cursor: grab; user-select: none; padding: 6px 8px 2px;
}
.dragbar:active { cursor: grabbing; }
.title {
  font: 600 12px/1 system-ui, sans-serif; color: #111; opacity: .7;
}
.controls { display: grid; grid-auto-flow: column; gap: 6px; justify-content: end; }
.btn, .gear {
  font: 600 12px/1 system-ui, sans-serif;
  padding: 8px 10px; border-radius: 12px; border: 1px solid rgba(0,0,0,.08);
  background: white; cursor: pointer;
}
.btn:active, .gear:active { transform: translateY(1px); }
.btn { min-width: 64px; }
.row { display: grid; grid-auto-flow: column; gap: 8px; }
.small { font-size: 11px; opacity: .8; }

.minibar {
  display: grid; grid-auto-flow: column; gap: 6px; justify-content: center;
}
.mini {
  width: 40px; height: 40px; border-radius: 12px; border: 1px solid rgba(0,0,0,.08);
  background: white; cursor: pointer; display: grid; place-items: center;
  font: 700 14px/1 system-ui, sans-serif;
}

.hidden { display: none !important; }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.35);
  display: grid; place-items: center; z-index: var(--cgpt-z);
}
.modal {
  width: min(92vw, 720px); max-height: min(88vh, 720px); overflow: auto;
  background: white; border-radius: 14px; padding: 16px;
  border: 1px solid rgba(0,0,0,.08);
}
.modal header {
  display: grid; grid-template-columns: 1fr auto; align-items: center; margin-bottom: 8px;
}
.modal h2 { font: 700 16px/1.2 system-ui, sans-serif; margin: 0; }
.xbtn { border: none; background: #0000; font-size: 16px; cursor: pointer; }
.form { display: grid; gap: 12px; }
.field { display: grid; gap: 6px; }
label { font: 600 12px/1 system-ui, sans-serif; }
input[type="number"], select, textarea {
  border: 1px solid rgba(0,0,0,.15); border-radius: 10px; padding: 8px; font: 12px/1.4 system-ui, sans-serif;
}
textarea { min-height: 120px; resize: vertical; }
.actions { display: grid; grid-auto-flow: column; justify-content: end; gap: 8px; margin-top: 8px; }
  `;
  shadow.appendChild(style);

  // ---------- Layout / Elements ----------
  const wrap = el('div', { className: 'wrap', id: 'cgpt-wrap' });
  const box = el('div', { className: 'box', id: 'cgpt-box' });
  const dragbar = el('div', { className: 'dragbar', id: 'cgpt-drag', role: 'button', tabIndex: 0, 'aria-label': 'ドラッグで移動' });
  const title = el('div', { className: 'title', textContent: 'ChatGPT Launcher' });
  const controls = el('div', { className: 'controls' });
  const gear = el('button', { className: 'gear', textContent: '⚙️ 設定', 'aria-label': '設定を開く' });

  const row = el('div', { className: 'row' });
  const btnSum = el('button', { className: 'btn', textContent: '要約' });
  const btnExp = el('button', { className: 'btn', textContent: '解説' });

  const minibar = el('div', { className: 'minibar' });
  const miniBtn = el('button', { className: 'mini', title: '開く', 'aria-label': '開く', textContent: '💬' });

  controls.appendChild(gear);
  dragbar.append(title, controls);
  row.append(btnSum, btnExp);
  box.append(dragbar, row, el('div', { className: 'small', textContent: 'Alt+ドラッグでどこでも移動／ダブルクリックで最小化' }));
  wrap.append(box);
  wrap.append(minibar);
  minibar.append(miniBtn);
  shadow.appendChild(wrap);

  // 初期表示切替
  function applyMinified(state) {
    cfg.minified = !!state;
    box.classList.toggle('hidden', cfg.minified);
    minibar.classList.toggle('hidden', !cfg.minified);
    saveCfg(cfg);
  }

  function applyCornerPos() {
    // cfg.corner, cfg.offsetX/Y から fixedの辺を決定
    wrap.style.left = wrap.style.right = wrap.style.top = wrap.style.bottom = 'auto';
    const padX = Math.max(0, cfg.offsetX);
    const padY = Math.max(0, cfg.offsetY);
    if (cfg.corner.includes('l')) wrap.style.left = `calc(${padX}px + env(safe-area-inset-left))`;
    else wrap.style.right = `calc(${padX}px + env(safe-area-inset-right))`;
    if (cfg.corner.includes('t')) wrap.style.top = `calc(${padY}px + env(safe-area-inset-top))`;
    else wrap.style.bottom = `calc(${padY}px + env(safe-area-inset-bottom))`;
  }

  // ---------- Drag (handle-limited, Alt=anywhere) ----------
  function enableDrag(container, handle) {
    let dragging = false, sx=0, sy=0, ox=0, oy=0;

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType !== 'touch') return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = cfg.offsetX; oy = cfg.offsetY;
      container.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const baseSnap = Math.max(4, Math.min(24, cfg.snap));
      let nx = snap(clamp(ox + (cfg.corner.includes('l') ? dx : -dx), 0, 0x7fffffff), baseSnap);
      let ny = snap(clamp(oy + (cfg.corner.includes('t') ? dy : -dy), 0, 0x7fffffff), baseSnap);
      cfg.offsetX = nx; cfg.offsetY = ny;
      applyCornerPos();
    };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      container.releasePointerCapture?.(e.pointerId);
      savePos(cfg, { corner: cfg.corner, offsetX: cfg.offsetX, offsetY: cfg.offsetY });
      saveCfg(cfg);
    };

    // ハンドル限定
    handle.addEventListener('pointerdown', onDown);
    shadow.addEventListener('pointermove', onMove);
    shadow.addEventListener('pointerup', onUp);
    shadow.addEventListener('pointercancel', onUp);

    // Alt押下中はコンテナ全域でドラッグ許可
    container.addEventListener('pointerdown', (e) => {
      if (!e.altKey) return;
      onDown(e);
    });
  }

  enableDrag(wrap, dragbar);

  // ダブルクリックで最小化切替
  dragbar.addEventListener('dblclick', () => applyMinified(!cfg.minified));

  miniBtn.addEventListener('click', () => applyMinified(false));

  // ---------- Actions ----------
  function buildPrompt(tpl) {
    let sel = getSelectionText(cfg.selectionMaxChars).trim();
    if (!sel) {
      // 選択がない場合はページ概要を差し込む
      sel = `【ページ情報】\nタイトル: ${document.title}\nURL: ${location.href}\n本文の一部: ${(document.body?.innerText || '').trim().slice(0, 800)}\n...`;
    }
    return tpl.replace(/\{SELECTION\}/g, sel);
  }

  function runAction(kind) {
    const tpl = (kind === 'summary') ? cfg.templates.summary : cfg.templates.explain;
    const prompt = buildPrompt(tpl);
    const ok = copyToClipboard(prompt);
    if (ok) {
      showToast('プロンプトをクリップボードへコピーしました ✅', 'success');
      if (cfg.openChatGPT) openChatGPTTab();
    } else {
      showToast('コピーに失敗… テキストを選択して Ctrl+C / ⌘C を試してね', 'warn', 3200);
    }
  }

  btnSum.addEventListener('click', (e) => { e.preventDefault(); runAction('summary'); });
  btnExp.addEventListener('click', (e) => { e.preventDefault(); runAction('explain'); });

  // ---------- Settings Modal ----------
  let modalBackdrop = null;

  function openSettings() {
    if (modalBackdrop) return;
    modalBackdrop = el('div', { className: 'modal-backdrop', role: 'dialog', ariaModal: 'true' });
    const modal = el('div', { className: 'modal' });
    const header = el('header');
    const h2 = el('h2', { textContent: '設定' });
    const xbtn = el('button', { className: 'xbtn', innerHTML: '✕', 'aria-label': '閉じる' });

    // --- fields
    const form = el('div', { className: 'form' });

    // 角
    const fCorner = el('div', { className: 'field' });
    const lbCorner = el('label', { textContent: '表示位置（角）' });
    const selCorner = el('select');
    selCorner.innerHTML = `
      <option value="bl">左下</option>
      <option value="br">右下</option>
      <option value="tl">左上</option>
      <option value="tr">右上</option>
    `;
    selCorner.value = cfg.corner;
    fCorner.append(lbCorner, selCorner);

    // オフセット
    const fOffset = el('div', { className: 'field' });
    const lbOffset = el('label', { textContent: '余白（px）' });
    const rowOffset = el('div', { className: 'row' });
    const inX = el('input', { type: 'number', value: cfg.offsetX, min: 0 });
    const inY = el('input', { type: 'number', value: cfg.offsetY, min: 0 });
    inX.placeholder = 'X'; inY.placeholder = 'Y';
    rowOffset.append(inX, inY);
    fOffset.append(lbOffset, rowOffset);

    // サイト別保存
    const fSite = el('div', { className: 'field' });
    const lbSite = el('label', { textContent: '位置をサイト別に保存' });
    const cbSite = el('input', { type: 'checkbox', checked: cfg.perSiteOverride });
    fSite.append(lbSite, cbSite);

    // ChatGPT上の表示
    const fHide = el('div', { className: 'field' });
    const lbHide = el('label', { textContent: 'ChatGPTサイトでは非表示' });
    const cbHide = el('input', { type: 'checkbox', checked: cfg.hideOnChatGPT });
    fHide.append(lbHide, cbHide);

    // 開く/コピー
    const fOpen = el('div', { className: 'field' });
    const lbOpen = el('label', { textContent: 'コピー後にChatGPTを開く' });
    const cbOpen = el('input', { type: 'checkbox', checked: cfg.openChatGPT });
    fOpen.append(lbOpen, cbOpen);

    // 選択上限
    const fLen = el('div', { className: 'field' });
    const lbLen = el('label', { textContent: '選択テキスト上限（文字）' });
    const inLen = el('input', { type: 'number', value: cfg.selectionMaxChars, min: 200, step: 100 });
    fLen.append(lbLen, inLen);

    // テンプレ
    const fTplSum = el('div', { className: 'field' });
    const lbTplSum = el('label', { textContent: 'テンプレ：要約' });
    const taSum = el('textarea', { value: cfg.templates.summary });
    fTplSum.append(lbTplSum, taSum);

    const fTplExp = el('div', { className: 'field' });
    const lbTplExp = el('label', { textContent: 'テンプレ：解説' });
    const taExp = el('textarea', { value: cfg.templates.explain });
    fTplExp.append(lbTplExp, taExp);

    // ボタン
    const actions = el('div', { className: 'actions' });
    const btnReset = el('button', { className: 'btn', textContent: '既定に戻す' });
    const btnSave = el('button', { className: 'btn', textContent: '保存' });

    actions.append(btnReset, btnSave);

    form.append(fCorner, fOffset, fSite, fHide, fOpen, fLen, fTplSum, fTplExp, actions);
    header.append(h2, xbtn);
    modal.append(header, form);
    modalBackdrop.append(modal);
    shadow.appendChild(modalBackdrop);

    function close() {
      modalBackdrop?.remove();
      modalBackdrop = null;
      dragbar.focus();
    }

    xbtn.addEventListener('click', close);
    modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) close(); });
    document.addEventListener('keydown', escClose, { capture: true });
    function escClose(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); document.removeEventListener('keydown', escClose, { capture: true }); } }

    btnReset.addEventListener('click', () => {
      cfg = structuredClone(defaultCfg);
      selCorner.value = cfg.corner;
      inX.value = cfg.offsetX; inY.value = cfg.offsetY;
      cbSite.checked = cfg.perSiteOverride;
      cbHide.checked = cfg.hideOnChatGPT;
      cbOpen.checked = cfg.openChatGPT;
      inLen.value = cfg.selectionMaxChars;
      taSum.value = cfg.templates.summary;
      taExp.value = cfg.templates.explain;
      saveCfg(cfg);
      applyCornerPos();
      showToast('設定を既定に戻しました', 'success');
    });

    btnSave.addEventListener('click', () => {
      cfg.corner = selCorner.value;
      cfg.offsetX = clamp(Number(inX.value) || 0, 0, 9999);
      cfg.offsetY = clamp(Number(inY.value) || 0, 0, 9999);
      cfg.perSiteOverride = !!cbSite.checked;
      cfg.hideOnChatGPT = !!cbHide.checked;
      cfg.openChatGPT = !!cbOpen.checked;
      cfg.selectionMaxChars = clamp(parseInt(inLen.value, 10) || defaultCfg.selectionMaxChars, 200, 20000);
      cfg.templates.summary = taSum.value || defaultCfg.templates.summary;
      cfg.templates.explain = taExp.value || defaultCfg.templates.explain;

      saveCfg(cfg);
      savePos(cfg, { corner: cfg.corner, offsetX: cfg.offsetX, offsetY: cfg.offsetY });
      applyCornerPos();
      showToast('設定を保存しました', 'success');
      // ChatGPT上の非表示切替は次回読込で反映
    });
  }

  gear.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });

  // ---------- Hotkeys ----------
  document.addEventListener('keydown', (e) => {
    // 例: Alt+Shift+S/E で要約/解説、Alt+Shift+M で最小化
    if (e.altKey && e.shiftKey && !e.repeat) {
      if (e.code === 'KeyS') { e.preventDefault(); runAction('summary'); }
      else if (e.code === 'KeyE') { e.preventDefault(); runAction('explain'); }
      else if (e.code === 'KeyM') { e.preventDefault(); applyMinified(!cfg.minified); }
    }
  }, { capture: true });

  // ---------- Init position ----------
  // 既存保存がなければ角の自動回避を走らせる
  if (!loadPos(cfg)) {
    cfg.corner = chooseInitialCorner(cfg.corner);
    saveCfg(cfg);
  } else {
    const saved = loadPos(cfg);
    if (saved) {
      cfg.corner = saved.corner || cfg.corner;
      cfg.offsetX = typeof saved.offsetX === 'number' ? saved.offsetX : cfg.offsetX;
      cfg.offsetY = typeof saved.offsetY === 'number' ? saved.offsetY : cfg.offsetY;
    }
  }

  // 初期表示
  applyCornerPos();
  applyMinified(!!cfg.minified);

  // リサイズ時も再適用（セーフエリアの変化へ追従）
  window.addEventListener('resize', () => {
    applyCornerPos();
  });

})();
