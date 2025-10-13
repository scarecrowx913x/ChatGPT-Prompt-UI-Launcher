// ==UserScript==
// @name         ChatGPT Prompt UI Launcher
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      1.2.3
// @description  ChatGPTランチャー（要約/解説、ドラッグ移動＆コーナー吸着、折りたたみ、サイト別表示ON/OFF、クリップボード対応、safe-area・z-index最適化）
// @author       scarecrowx913x
// @match        *://*/*
// @exclude      *://chatgpt.com/*
// @exclude      *://chat.openai.com/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  /**
   * Config
   * Scope persistence per origin so each site can keep its own open/close state.
   */
  const STORAGE_KEY = `cpl_menu_open:${location.origin}`;
  const Z_INDEX = 2147483647; // Max-ish to avoid being covered
  const POSITION = { left: 12, top: 12 }; // px

  /**
   * Utility: safe append to document
   */
  function append(node) {
    (document.body || document.documentElement).appendChild(node);
  }

  /**
   * Inject base styles.
   * Keep to minimal rules; avoid site-specific overrides and !important unless truly necessary.
   */
  const style = document.createElement('style');
  style.textContent = `
    .cpl-root {
      position: fixed;
      left: ${POSITION.left}px;
      top: ${POSITION.top}px;
      z-index: ${Z_INDEX};
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      user-select: none;
    }
    .cpl-gear {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: grid;
      place-items: center;
      background: #0f172a; /* slate-900-ish */
      color: #e5e7eb;      /* zinc-200-ish */
      box-shadow: 0 6px 16px rgba(0,0,0,.3);
      transition: filter .15s ease;
    }
    .cpl-gear:hover { filter: brightness(1.15); }
    .cpl-gear:active { filter: brightness(0.95); }

    .cpl-menu {
      margin-top: 8px;
      display: none; /* default hidden */
    }
    .cpl-menu.is-open { display: block; }

    .cpl-btn {
      display: block;
      width: 140px;
      padding: 10px 12px;
      margin: 8px 0;
      border-radius: 12px;
      border: 0;
      cursor: pointer;
      text-align: left;
      background: #0b1020;
      color: #e6e9f2;
      box-shadow: 0 4px 12px rgba(0,0,0,.35);
      transition: transform .06s ease, filter .15s ease;
    }
    .cpl-btn:hover { filter: brightness(1.06); }
    .cpl-btn:active { transform: translateY(1px); }
    .cpl-btn .icon { margin-right: 8px; }

    @media (prefers-reduced-motion: reduce) {
      .cpl-gear, .cpl-btn { transition: none; }
    }
  `;
  document.documentElement.appendChild(style);

  /**
   * Build UI
   */
  const root = document.createElement('div');
  root.className = 'cpl-root';

  // Gear (toggle) button
  const gearBtn = document.createElement('button');
  gearBtn.className = 'cpl-gear';
  gearBtn.type = 'button';
  gearBtn.title = 'Toggle menu';
  gearBtn.setAttribute('aria-label', 'Toggle menu');
  gearBtn.textContent = '⚙️';

  // Menu container (hidden by default via CSS)
  const menu = document.createElement('div');
  menu.className = 'cpl-menu';

  // Action buttons (example: “Summary” and “Explain”)
  const btnSummary = document.createElement('button');
  btnSummary.className = 'cpl-btn';
  btnSummary.type = 'button';
  btnSummary.innerHTML = '<span class="icon">📘</span><strong>要約</strong>';

  const btnExplain = document.createElement('button');
  btnExplain.className = 'cpl-btn';
  btnExplain.type = 'button';
  btnExplain.innerHTML = '<span class="icon">🔎</span><strong>解説</strong>';

  menu.appendChild(btnSummary);
  menu.appendChild(btnExplain);

  root.appendChild(gearBtn);
  root.appendChild(menu);

  // Mount to document
  append(root);

  /**
   * Restore persisted state. Default is "closed" (hidden).
   * Falls back to false if GM_* is unavailable.
   */
  const savedOpen =
    typeof GM_getValue === 'function' ? Boolean(GM_getValue(STORAGE_KEY, false)) : false;
  if (savedOpen) menu.classList.add('is-open');

  /**
   * Toggle handler: open/close the menu and persist.
   */
  function setMenuOpen(nextOpen) {
    menu.classList.toggle('is-open', nextOpen);
    if (typeof GM_setValue === 'function') {
      GM_setValue(STORAGE_KEY, nextOpen);
    }
  }
  gearBtn.addEventListener('click', () => {
    const next = !menu.classList.contains('is-open');
    setMenuOpen(next);
  });

  /**
   * Example handlers (replace with actual integrations).
   * Avoid alert() in production; use your own dispatcher or message bus.
   */
  btnSummary.addEventListener('click', () => {
    console.log('[CPL] Summary action clicked');
    // TODO: implement summary action
  });
  btnExplain.addEventListener('click', () => {
    console.log('[CPL] Explain action clicked');
    // TODO: implement explain action
  });

  /**
   * Optional: expose minimal API on window for debugging/integration
   * without polluting global scope too much.
   */
  Object.defineProperty(window, '__CPL__', {
    value: {
      open: () => setMenuOpen(true),
      close: () => setMenuOpen(false),
      toggle: () => setMenuOpen(!menu.classList.contains('is-open')),
      get isOpen() { return menu.classList.contains('is-open'); },
      version: '1.0.0'
    },
    writable: false,
    configurable: false,
    enumerable: false
  });
})();
