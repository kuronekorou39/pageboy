# pageboy downloader

購読している SubscribeStar / pixiv FANBOX の作者ページから、投稿を 1 投稿 = 1 フォルダで保存する Chrome 拡張。
フォルダ名はテンプレートで決める。既定は pageboy の規則(`library/README.md`)に合わせてある。

ブラウザのログイン状態をそのまま使うので、Cookie の書き出しは要らない。
画像は原寸のファイル(SubscribeStar は `/post_uploads/...`、FANBOX は `originalUrl`)を取る。

## 入れ方

1. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」を入れる
2. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダ(`tools/pageboy-downloader`)を選ぶ

## 使い方

1. 作者ページを開くと右下に「pageboy に保存」ボタンが出る。押すと保存画面が別タブで開き、サイトと作者が入った状態になる(ツールバーのアイコンからも開ける)
   - SubscribeStar: `https://subscribestar.art/<作者>`
   - FANBOX: `https://www.fanbox.cc/@<作者>/posts` または `https://<作者>.fanbox.cc/`
2. 初回だけ「フォルダを選ぶ」で保存先を選ぶ。`C:\projects\pageboy\library` のように、ダウンロードフォルダ以外でもよい
3. 「上から N 件まで」を 5 などにして「名前だけ確かめる」。作られるフォルダ名とタイトル・本文・タグが一覧で出る
4. よければ「保存を始める」。設定はサイトごとに次回も残る

## 速さ(負荷)

同時に取るのは 1 ファイルだけ。待ち時間は設定で変えられる。

| 設定 | 既定(SubscribeStar / FANBOX) | いつ待つか |
|---|---|---|
| ファイルの間隔 | 1500 / 2000 ms | 同じ投稿の中で 1 ファイル取るごと。FANBOX では投稿の本文を 1 件読む前も |
| 投稿の間隔 | 3000 / 4000 ms | 投稿を 1 つ取り終えるごと。一覧の次ページを読む前も同じ |

済みの投稿(何も取らなかった投稿)では待たない。FANBOX の API は短時間に続けて呼ぶと一時的に拒否するので、既定を少し長めにしてある。

## フォルダ名のテンプレート

| 欄 | 既定(SubscribeStar) | 既定(FANBOX) |
|---|---|---|
| 作者フォルダ名 | `{nick}` | `{nick}` |
| 投稿フォルダ名 | `{site}_{date}_{kind}_{chars}` | `{site}_{date}_{title}` |

| 値 | 中身 |
|---|---|
| `{date}` `{date-}` `{year}` | 投稿日。20261019 / 2026-10-19 / 2026 |
| `{id}` | 投稿 ID |
| `{title}` | 投稿のタイトル。SubscribeStar にはタイトルがないので本文の全行をスペースでつないだもの |
| `{line1}` `{line2}` `{line3}` | 本文の 1〜3 行目そのまま |
| `{kind}` | 2 行目(1 行だけならその行)を種別に正規化。`comission` と `commissions` は `commission`。commission / manga / illust / sketch 以外は空 |
| `{chars}` | 1 行目のキャラ名。`/` `&` `and` を `／` に、50 文字で切る |
| `{tags}` `{tag1}` | 投稿のタグを `／` でつないだもの / 最初の 1 つ |
| `{nick}` `{slug}` | 作者の表示名 / URL の作者名(FANBOX なら gyu、SubscribeStar なら kgym) |
| `{site}` | サイト名。SubscribeStar / FANBOX |

置き換えたあと、Windows で使えない文字(`\ / : * ? " < > |`)は `／` に、末尾の空白とピリオドは落とし、120 文字で切る。
値が空でも区切りの `_` は残る(`SubscribeStar_20261016_commission_` のように)。
同じ日に同じ題名の投稿が 2 つあって名前がぶつかったら、後から処理したほうに `_<投稿 ID>` を足す。

## ファイル名

- SubscribeStar: 投稿に付いている元のファイル名
- FANBOX: 元のファイル名がないので、本文に出てくる順に `001_<画像ID>.png`。添付ファイルは `<名前>.<拡張子>`

## 済みの判定

作者フォルダに `pageboy-downloads.json` を書き、投稿 ID ごとに日付・フォルダ名・タイトル・本文・タグ・ファイル名を記録する。
次回はこの記録に加えて、フォルダとファイルが実際にあるかも見るので、

- 手で先に落としてあったファイルは、フォルダ名とファイル名が同じなら飛ばす(記録には「記録なし、ファイルあり」として追加される)
- JSON を消しても、ファイルがあれば飛ばす
- ファイルを消せば、その分だけ取り直す
- 1 つでも失敗した投稿は記録に書かない(次回また試す)

## 仕組み

| ファイル | 役割 |
|---|---|
| `app.html` / `app.js` | 画面。保存先・命名・済み判定・間隔。サイトのモジュールから投稿を受け取る |
| `naming.js` | テンプレートの展開、キャラ名・種別の正規化、使えない文字の置き換え |
| `subscribestar.js` | 作者ページの HTML を投稿ごとに分解する。「次のページ」の JSON もたどる |
| `fanbox.js` | サイトが使っている API(`post.paginateCreator` → 一覧 → `post.info`)を叩く |
| `background.js` | 画面をタブで開く。FANBOX の API と画像に `Origin` / `Referer` を付ける(declarativeNetRequest) |
| `content.js` | 作者ページに「pageboy に保存」ボタンを置く |

新しいサイトを足すときは、`creatorFromUrl(url)`、`postUrl(cfg, post)`、`fetchPosts(cfg, { fetch, sleep })` を持つモジュールを作り、`app.js` の `SITES` に登録する。
`fetchPosts` は `{ post, nick }` を新しい順に返す。`post` は `{ id, date, title?, lines, tags, files: [{ url, name }], locked }`。

## 原寸が取れなかったとき

サイト側の不具合で原寸ファイルが受け取れないことがある(ファイル名に日本語が入った古い投稿で見かけた。プレビューは表示できるのに原寸だけ失敗する)。

- 原寸の代わりにプレビュー(幅 1200px 程度)を `<元の名前>.preview.png` として保存する。並び順は原寸の隣になるので、pageboy ではそのまま読める
- 記録 JSON のその投稿に `incomplete: [取れなかったファイル名]` を書く
- 次回以降の実行では、原寸のファイルがないので毎回取り直しを試みる(その投稿のぶんだけ時間がかかる)。原寸が取れたらプレビューは消して、`incomplete` も外れる
- ログには投稿ページの URL を出すので、手で確かめたいときはそこから開く

## 注意

- 保存先フォルダの権限は Chrome を起動し直すと再確認を求められる。開始時に出るダイアログで許可する
- 鍵付き(購読範囲外)の投稿は飛ばす
- 「原寸は取れず(Failed to fetch)」はブラウザがファイルを受け取れなかったときに出る。ログに出る投稿ページを Chrome で開いて画像をクリックしても同じように失敗するなら、サイト側の問題。Firefox で開くか、エラー画面のアドレスを curl に渡すと取れることがある
- サイトの HTML や API が変わったら、そのサイトのモジュールを直す

## テスト

```
node --test tools/pageboy-downloader/sites.test.mjs
```
