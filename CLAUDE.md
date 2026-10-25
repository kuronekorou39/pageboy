# pageboy

ページ漫画をハンズフリーで読むビューア。横幅いっぱいのページを画面高さぶんずつ下へ送り、末尾で次ページへ進む。
仕様と背景は `docs/design.md`、使い方は `README.md`、WebView の中を見る方法は `docs/debug.md`。

## 技術スタック

Tauri 2 + Preact + Vite + TypeScript。テストは Vitest。
Rust(`src-tauri/`)はフォルダ走査・画像読み込み・設定の保存だけ。ロジックは `src/core/` に置く。

## 規約

- `src/core/` は純粋関数のみ。I/O・DOM・Tauri API を持ち込まない。`src/ui/` から core を呼ぶ一方向にする
- Tauri API は `src/ui/backend.ts` だけから呼ぶ
- 「進む」「戻る」の意味を変えるときは `core/navigation.ts` と `test/navigation.test.ts` を同時に直す
- キー割り当ては `core/keymap.ts` の `KEY_BINDINGS` 1 箇所。Help 画面もそこから生成する。新しい操作も 1 キー(修飾キーなし)
- 数値のしきい値(拡大率・間隔・重なり率の範囲)は `core/settings.ts` の定数に置く
- 設定ファイル(`data/settings.json`)は後方互換を保つ。欠けた項目は既定値で埋め、未知の項目は無視する
- `data/` と `library/` は git に入れない。置き場所は `PAGEBOY_HOME` で変えられる

## コマンド

```
npm run app          # tauri dev
npm test             # vitest
npm run typecheck
npm run app:build    # インストーラ
```
