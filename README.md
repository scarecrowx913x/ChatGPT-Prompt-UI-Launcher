# ChatGPT Prompt UI Launcher

このユーザースクリプトは、Webページ上に簡易なUIボタンを追加し、  
開いているページのURLを元に ChatGPT に「要約」または「解説」を依頼するプロンプトを生成します。

## 機能

- 「要約」ボタン  
  GPT-4（Browse with Bing機能）を使用し、URL先の内容を日本語で要点整理します。

- 「解説」ボタン  
  GPT-4にURLを参照させ、重要な概念を簡潔な日本語で解説させます。  
  解説の後、目次を表示し、ユーザーが任意の項目を選んで詳細を確認できる形式になっています。

## インストール方法（Tampermonkey）

1. Tampermonkey をインストール  
   - [Tampermonkey for Firefox](https://addons.mozilla.org/ja/firefox/addon/tampermonkey/)  
   - [Tampermonkey for Chrome](https://tampermonkey.net/)

2. 以下のリンクからユーザースクリプトをインストール  
   [ChatGPT-Prompt-UI-Launcher.user.js](https://raw.githubusercontent.com/junx913x/ChatGPT-Prompt-UI-Launcher/main/ChatGPT-Prompt-UI-Launcher.user.js)

3. 任意のWebページにアクセスすると、右下に「要約」「解説」ボタンが表示されます。

## 使い方

1. 任意のページを開く  
2. 表示されたボタンのいずれかをクリック  
3. プロンプトがクリップボードにコピーされ、自動で ChatGPT が開きます  
4. 開いたチャット画面にペーストし、プロンプトを送信してください

## License

This project is licensed under the MIT License.  
See the [LICENSE](./LICENSE) file for details.

