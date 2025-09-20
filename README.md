# ChatGPT-Prompt-UI-Launcher

ページ端に「📘要約 / 🔍️解説」のランチャーを常駐表示。押すとモーダルで「ChatGPTを開く」or「プロンプトだけコピー」を選べます。選択テキスト・ページタイトル・URLを自動注入して、精度の高い要約/解説をサクッと実行📚✨

![Desktop](docs/screenshot-desktop.png)
![Mobile](docs/screenshot-mobile.png)

## 🚀 インストール
1. ブラウザに Userscript マネージャ（Tampermonkey/Violentmonkey 等）を導入  
2. こちらを開いて「インストール」  
   - **Raw**: https://raw.githubusercontent.com/scarecrowx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js

## ✨ 主な機能
- オーバーレイモーダル（背景クリック/✕/ESC で閉じる、Tab でフォーカス循環）
- 選択テキスト/タイトル/URL の自動注入
- 非ブロッキングのトースト通知
- ダークモード（`prefers-color-scheme` 対応）
- ドラッグ移動 / 位置記憶（localStorage）
- セーフエリア対応（`env(safe-area-inset-*)`）
- **設定パネル（⚙️）**：位置モード（corner/free）/ 角 / スナップ / スケール / 透明度 / 自動ミニ化 / 表示対象（モバイル/デスクトップ）/ サイト別設定
- **ショートカット**：Alt+Shift+S（要約）/ Alt+Shift+E（解説）/ Alt+Shift+G（ミニ化）

## 🧰 使い方
1. 任意でページのテキストを選択 → ランチャーの **📘要約** か **🔍️解説** をクリック  
2. モーダルで「ChatGPTを開く」or「プロンプトだけコピー」を選択（クリップボードとタブオープンは多段フォールバックで安定）  
3. ⚙️から見た目・位置・自動ミニ化などを調整できます

## ⚙️ 設定（Settings）
- **位置モード**：`corner`（四隅固定） / `free`（自由配置・ドラッグ可）  
- **角**（corner時）：BL/BR/TL/TR  
- **スナップ**（free時）：端に吸着  
- **スケール/透明度/自動ミニ化**：視界の邪魔にならないように調整  
- **表示対象**：モバイル/デスクトップの出し分け  
- **サイト別設定**：ドメインごとの上書き保存

## 🔒 権限とプライバシー
- 使用GM権限：`GM_setClipboard`, `GM_openInTab`  
- ネットワーク送信は行いません（ページ情報は端末内処理）

## 🐛 トラブルシュート
- **ポップアップブロック**：タブが開かない → Userscript マネージャ側の許可設定を確認  
- **厳格CSPサイト**：まれにUIが注入できない場合あり（IssueでURLを共有いただけると助かります）  
- **互換性**：Tampermonkey推奨。VM環境では `GM.openInTab` 名義のことがあるため適宜対応予定

## 🗓️ 更新履歴
- v0.9.1: モバイル向け設定パネル / Pointer Events ドラッグ / visualViewport 対応 / セーフエリア整理
- v0.9.0: ESC/Tab/フォーカス/スクロールロック / トースト通知 / 選択テキスト注入 / ダーク / 高 z-index

## 🤝 コントリビュート
- バグ報告・要望は Issue へ。再現手順・ブラウザ・Userscript マネージャ名/バージョン・対象URL・スクショがあると助かります  
- PR 歓迎！小さな修正でも大歓迎です

## 📜 ライセンス
MIT
