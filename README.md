# ChatGPT-Prompt-UI-Launcher

ページ端に「📘要約 / 🔍️解説」のランチャーを常駐表示。
押すとモーダルで「ChatGPTを開く」または「プロンプトだけコピー」を選べます。
URLを自動でプロンプトへ含め、素早く要約・解説を実行できます。

[![Install Userscript](https://img.shields.io/badge/Install-UserScript-10a37f)](https://raw.githubusercontent.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js)

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

- ページ端に **⚙️（設定）** と **「🌐通常」「🛠️強制」** が表示されます（ランチャー）。
- **🌐通常** を押すと、対象ページの **URL を含むプロンプト**をコピーしつつ、`https://chatgpt.com/` を新規タブで開き、**自動で貼り付け**ます。
- **🛠️強制** を押すと、**URL + ページ本文スニペット（約3,500字）** を含むプロンプトをコピーしつつ、`https://chatgpt.com/` を開き、**自動で貼り付け**ます。  
  - 公開範囲外・ログイン必須・社内ネットワーク等で URL を直接参照できない場合に有効です。
- **⚙️ の操作**
  - **クリック** … 折りたたみ／展開
  - **ドラッグ** … ランチャーを任意位置へ移動（離すと近い四隅にスナップ）
  - **長押し** … メニュー（四隅順送り／このサイトで非表示／折りたたみ切替／**ChatGPT自動送信: ON/OFF**）

> 🔒 注意：**URL は常に自動でプロンプトへ含まれます**。  
> **🛠️強制** は本文スニペットも同梱するため、**機密情報の取り扱いに注意**してください。

### 🚀 自動送信（オプション）

- **有効化／無効化**：
  - Tampermonkey（または拡張）メニューの **「ChatGPT自動送信: ON/OFF」** で切り替えできます。  
  - もしくは **⚙️長押しメニュー**からも同じ項目を切り替え可能です。
- **動作**：`chatgpt.com` の入力欄が表示されたら、**自動で貼り付け →（ON の場合）送信** まで行います。
- **前提**：
  - `https://chatgpt.com/` に **ログイン済み** であること。
  - まれに表示が遅延するサイトがあります。入力欄の表示を **最大30秒間待機**してから自動投入します。
- **フォールバック**：貼り付けに失敗した場合でも、**プロンプトはクリップボードへコピー**されます。タブが開いたら貼り付けて送信してください。


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
