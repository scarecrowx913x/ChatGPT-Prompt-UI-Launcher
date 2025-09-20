// ==UserScript==
// @name         ChatGPT-Prompt-UI-Launcher
// @namespace    https://github.com/junx913x/chatgpt-ui-launcher
// @version      0.9.1
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

// ====== 追加：共通ユーティリティ（モバイル & 設定） ======
const CFG_KEY = 'cgpt.launcher.cfg.v1';
const POS_KEY = 'cgpt.launcher.pos.v1';
const HOST = location.host;

const defaultCfg = {
  positionMode: 'corner',  // 'corner' | 'free'
  corner: 'bl',            // 'bl' | 'br' | 'tl' | 'tr'
  snap: true,
  scale: 1.0,
  opacity: 1.0,
  autoMinimize: false,
  autoMinimizeMs: 3000,
  showOnMobile: true,
  showOnDesktop: true,
  perSiteOverride: false,  // true にするとサイト別設定を使う
};

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
    all._global = base;     // 既存のグローバルは保持
    all[HOST] = merged;     // ホスト別に保存
  } else {
    all._global = merged;   // グローバルに保存
    delete all[HOST];
  }
  localStorage.setItem(CFG_KEY, JSON.stringify(all));
}

function vw() { return (window.visualViewport?.width ?? window.innerWidth); }
function vh() { return (window.visualViewport?.height ?? window.innerHeight); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function isMobile() { return matchMedia('(pointer:coarse)').matches || Math.min(screen.width, screen.height) < 768; }

// ====== 追加：設定パネル（簡易版） ======
function showSettings(container, applyCfg) {
  const cfg = loadCfg();

  // ベースUI
  const wrap = document.createElement('div');
  wrap.className = 'cgpt-modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'cgpt-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const close = document.createElement('button');
  close.className = 'cgpt-modal-close';
  close.textContent = '✕';

  const h = document.createElement('h3');
  h.textContent = '設定';

  // 入力群
  function row(label, input) {
    const r = document.createElement('div');
    r.style.textAlign = 'left';
    r.style.marginTop = '10px';
    const l = document.createElement('label');
    l.textContent = label;
    l.style.display = 'block';
    l.style.fontSize = '12px';
    r.appendChild(l);
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

  const btnSave = document.createElement('button'); btnSave.className='cgpt-modal-btn open'; btnSave.textContent='保存';
  const btnReset = document.createElement('button'); btnReset.className='cgpt-modal-btn copy'; btnReset.textContent='リセット';

  modal.append(close, h,
    row('位置モード', selMode),
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

  // ラベル値更新
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
    // 位置だけ残して設定は初期化
    const all = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    delete all[HOST]; delete all._global;
    localStorage.setItem(CFG_KEY, JSON.stringify(all));
    applyCfg(container);
    wrap.remove();
  };
}

// ====== 追加：ドラッグ（Pointer Events）＆位置補正 ======
function enableDrag(container, applyCfg) {
  let dragging = false, sx=0, sy=0, sl=0, st=0;

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
    const padL = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-left') || 0) || 0;
    const padT = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top') || 0) || 0;
    const padR = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-right') || 0) || 0;
    const padB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || 0) || 0;

    const left = clamp(sl + (e.clientX - sx), padL, vw() - container.offsetWidth - padR);
    const top  = clamp(st + (e.clientY - sy), padT, vh() - container.offsetHeight - padB);
    container.style.left = `${left}px`;
    container.style.top  = `${top}px`;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    const rect = container.getBoundingClientRect();
    localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    // スナップ
    const cfg = loadCfg();
    if (cfg.positionMode === 'free' && cfg.snap) {
      const left = rect.left, top = rect.top;
      const toLeft = left < (vw()/2 - rect.width/2);
      const toTop = top < (vh()/2 - rect.height/2);
      container.style.left = `${toLeft ? 12 : vw()-rect.width-12}px`;
      container.style.top  = `${toTop ? 12 : vh()-rect.height-12}px`;
      const r2 = container.getBoundingClientRect();
      localStorage.setItem(POS_KEY, JSON.stringify({ left: r2.left, top: r2.top }));
    }
  };

  container.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('resize', () => {
    const rect = container.getBoundingClientRect();
    const left = clamp(rect.left, 0, vw() - rect.width);
    const top  = clamp(rect.top,  0, vh() - rect.height);
    container.style.left = `${left}px`;
    container.style.top  = `${top}px`;
  });
  window.visualViewport?.addEventListener('resize', () => {
    const rect = container.getBoundingClientRect();
    const left = clamp(rect.left, 0, vw() - rect.width);
    const top  = clamp(rect.top,  0, vh() - rect.height);
    container.style.left = `${left}px`;
    container.style.top  = `${top}px`;
  }, { passive: true });
}

// ====== 追加：安全なセーフエリアCSS変数 ======
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

// ====== 追加：設定適用ロジック ======
function applyCfg(container){
  const cfg = loadCfg();

  // デバイス別表示
  const mobile = isMobile();
  if ((mobile && !cfg.showOnMobile) || (!mobile && !cfg.showOnDesktop)) {
    container.style.display = 'none';
    return;
  } else {
    container.style.display = 'flex';
  }

  // 見た目
  container.style.transform = `scale(${cfg.scale})`;
  container.style.opacity = `${cfg.opacity}`;

  // 位置
  const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
  if (cfg.positionMode === 'corner' || !saved) {
    const padL = 12; const padB = 12;
    const map = {
      bl: () => ({ left: padL, top: vh() - container.offsetHeight - padB }),
      br: () => ({ left: vw() - container.offsetWidth - padL, top: vh() - container.offsetHeight - padB }),
      tl: () => ({ left: padL, top: 12 }),
      tr: () => ({ left: vw() - container.offsetWidth - padL, top: 12 }),
    };
    const pos = (map[cfg.corner] || map.bl)();
    container.style.left = `${pos.left}px`;
    container.style.top  = `${pos.top}px`;
  } else {
    const left = clamp(saved.left, 0, vw() - container.offsetWidth);
    const top  = clamp(saved.top, 0, vh() - container.offsetHeight);
    container.style.left = `${left}px`;
    container.style.top  = `${top}px`;
  }

  // 自動ミニ化
  if (cfg.autoMinimize) {
    let t;
    const arm = () => {
      clearTimeout(t);
      t = setTimeout(()=>{ container.style.opacity = `${Math.min(cfg.opacity, 0.5)}`; container.style.transform = `scale(${cfg.scale*0.9})`; }, cfg.autoMinimizeMs);
    };
    const disarm = () => { clearTimeout(t); container.style.opacity = `${cfg.opacity}`; container.style.transform = `scale(${cfg.scale})`; arm(); };
    ['pointerenter','pointerleave','pointerdown','pointerup','touchstart','mousemove','scroll','keydown'].forEach(ev=>{
      window.addEventListener(ev, disarm, { passive: true });
    });
    arm();
  }
}

.chatgpt-gear{ background:transparent; border:none; cursor:pointer; font-size:16px; align-self:flex-start; }
@media (pointer:coarse){
  .chatgpt-btn{ padding:10px 14px; font-size:15px; } /* 指で押しやすく */
}
