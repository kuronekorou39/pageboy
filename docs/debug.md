# デバッグ: WebView の中を見る

画面のスクリーンショットやキー送信(PrintWindow / SendKeys)は WebView2 に対して信頼できない。
代わりに WebView2 のリモートデバッグ(CDP)を使う。`scripts/cdp.mjs` が状態の読み取り・キー注入・スクリーンショットをまとめている。

```
npm run dev                                   # Vite だけ起動
cd src-tauri; cargo build; cd ..
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9229"
.\src-tauri\target\debug\pageboy.exe <folder>
node scripts/cdp.mjs 9229 "eval:document.querySelector('.hud')?.textContent" "key:v" "wait:1000" "shot:out.png"
```

`cdp.mjs` のステップ:

| ステップ | 動き |
|---|---|
| `eval:<js>` | ページ内で評価して結果を表示 |
| `key:<key>` | キー入力を注入(`key:v`、`key:ArrowDown` など) |
| `wait:<ms>` | 待つ |
| `shot:<file.png>` | スクリーンショットを保存 |

## ログ

フロントエンドの未処理エラーは `data/pageboy.log` に追記される(`main.tsx` の ErrorBoundary と window.onerror)。
WebView のコンソールは普段見えないので、原因を探すときはまずここを見る。

## データの置き場所

開発ビルドはリポジトリ直下の `data/` と `library/` を使う。インストール版は OS の設定フォルダ(Windows は `%APPDATA%\com.rou39.pageboy\`)。
環境変数 `PAGEBOY_HOME` でどちらも上書きできる。
