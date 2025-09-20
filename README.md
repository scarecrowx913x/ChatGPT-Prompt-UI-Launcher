# ChatGPT-Prompt-UI-Launcher

ページ端に「📘要約 / 🔍️解説」のランチャーを常駐表示。押すとモーダルで「ChatGPTを開く」または「プロンプトだけコピー」を選べます。URLを自動でプロンプトへ含め、素早く要約・解説を実行できます。

[![Install Userscript](https://img.shields.io/badge/Install-UserScript-10a37f)](https://raw.githubusercontent.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js)

![Desktop](docs/screenshot-desktop.png)
![Mobile](docs/screenshot-mobile.png)

---

## 🚀 インストール

**ワンクリック（推奨）**  
- 👉 [インストール（Raw .user.js）](https://raw.githubusercontent.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js)

**Userscript マネージャが未導入の方**  
1. ブラウザに Userscript マネージャ（Tampermonkey / Violentmonkey など）をインストール  
2. 上の「インストール（Raw .user.js）」リンクを開いて **Install** を選択

**コピペ用URL**  
https://raw.githubusercontent.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js

**リポジトリ**  
- https://github.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher

---

## ✨ 主な機能

- ランチャー：📘要約 / 🔍️解説  
- モーダル：オーバーレイ・×ボタン・外側クリックで閉じる（※Escは仕様として未対応）  
- クリップボード多段フォールバック（`GM_setClipboard` → `navigator.clipboard` → `execCommand('copy')`）  
- ドラッグ移動（任意位置へ配置） / 近接四隅への自動吸着（スナップ）  
- 折りたたみ / 展開の切替（状態を保存）  
- 長押しメニュー：四隅を順送り / このサイトで非表示 / 折りたたみ切替  
- サイトごとの表示 ON/OFF（記憶・GMメニューから復帰）  
- セーフエリア対応（`env(safe-area-inset-*)`）・高い `z-index`  
- ChatGPT ドメインでは表示しない（`@exclude`）

## 🧰 使い方

1. ページ端に表示される ⚙️（設定）と「📘要約」「🔍️解説」がランチャーです。  
2. 📘要約 または 🔍️解説 を押すとモーダルが開きます：  
   - **ChatGPTを開く 🌐** … プロンプトをコピーして `https://chatgpt.com/` を新規タブで開く  
   - **プロンプトだけコピー 📋** … コピーのみ実行  
3. ⚙️の操作：  
   - **クリック** … 折りたたみ／展開  
   - **ドラッグ** … ランチャーを任意の位置へ移動（離すと近い四隅にスナップ）  
   - **長押し** … メニュー（四隅順送り／このサイトで非表示／折りたたみ切替）

> 注意：URLは自動でプロンプトへ含めます。非公開ページでは取り扱いにご注意ください。

## ⚙️ 設定

- **配置**：自由配置（ドラッグ）／四隅固定（スナップ）  
- **折りたたみ**：クリックで切替（状態は保存）  
- **サイト別設定**：長押しメニューまたは GM メニューから表示 ON/OFF を切替

## 🔒 権限とプライバシー

- 使用権限：`GM_setClipboard`（クリップボード）、`GM_registerMenuCommand`（GM メニュー）  
- ネットワーク送信は行いません（ChatGPT タブを開く以外の通信なし）  
- プロンプトには閲覧中の URL が含まれます。機密ページではご注意ください。

## 🐛 トラブルシュート

- **ドラッグ後にカーソルへ“くっつく”**  
  `pointerup` の取り逃し対策（グローバル捕捉 / `lostpointercapture` / `blur`）を実装済み。発生サイトは強いイベント制御の可能性があります。折りたたみや四隅トグルで回避可能です。  
- **コピーできない**  
  クリップボード権限や HTTPS 環境を確認。`navigator.clipboard` が不可でも `GM_setClipboard` → `execCommand('copy')` を順に試みます。  
- **サイト UI と重なる**  
  ドラッグで退避。位置・折りたたみ状態は保存されます。  
- **モーダルが閉じない**  
  ×ボタンまたはオーバーレイ外クリックで閉じます（Esc は未対応）。


## 🤝 コントリビュート

Issue / PR 歓迎です。再現手順・ブラウザ・Userscript マネージャの種類/バージョン・対象 URL・スクリーンショット等をご提供ください。

## 📜 ライセンス

MIT
