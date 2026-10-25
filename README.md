# pageboy

ページ漫画をハンズフリーで読むビューア。横幅いっぱいに表示したページを、画面の高さぶんずつ下へ送り、末尾で次のページへ進みます。手で送っても、自動で送っても、同じ「進む」1 操作です。

- 入力: 画像(png / jpg / webp / avif / gif / bmp)のフォルダ。親フォルダを開けば中のサブフォルダが作品として並びます
- 表示は 2 通り。ページ送り(末尾で次ページの先頭へ)と、連続スクロール(全ページを縦につなげる)。`V` で切替
- 自動再生の速度、拡大率、表示モード、作品ごとの「順番 / ランダム」、最後に読んだページを記憶します
- 操作はすべて 1 キー(`H` で一覧)
- 漫画フォルダを `library/` に置くと起動時に自動で開きます。設定は `data/settings.json`。どちらも git には入りません
- 起動引数にフォルダを渡すとそれを開きます: `pageboy.exe D:\manga`

## 使い方

```
npm install
npm run app        # 開発モードで起動
npm run app:build  # インストーラを作る(src-tauri/target/release/bundle/)
```

起動したら `O` でフォルダを開き(`library/` に置いてあれば自動で開きます)、`Space` で自動再生。`H` か右上の `?` で操作一覧が出ます。

## 開発

```
npm test           # core のテスト
npm run typecheck
npx tauri icon assets/app-icon.png   # アイコンを差し替えたら src-tauri/icons/ を再生成
```

設計は `docs/design.md`、WebView の中を見るデバッグ手順は `docs/debug.md`、方針と規約は `CLAUDE.md` を参照。
