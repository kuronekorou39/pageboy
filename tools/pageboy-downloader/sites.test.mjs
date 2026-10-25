// node --test tools/pageboy-downloader/
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatName, normalizeChars, safeFileName, templateVars, uniqueFileNames, ymd } from "./naming.js";
import * as fanbox from "./fanbox.js";
import * as ss from "./subscribestar.js";

const d = (y, m, day) => new Date(y, m - 1, day);

test("日付", () => {
  assert.equal(ymd(ss.parseDate("Oct 19, 2026 11:00 am")), "20261019");
  assert.equal(ymd(ss.parseDate("Updated on September 05, 2025 01:30 pm")), "20250905");
  assert.equal(ss.parseDate("unknown"), null);
});

test("テンプレート: 1 行目がキャラ、2 行目が種別", () => {
  const f = (date, lines) => formatName("Skeb_{date}_{kind}_{chars}", templateVars({ date, lines, tags: [] }));
  assert.equal(f(d(2026, 10, 19), ["Lurantis/Ariados", "commission"]), "Skeb_20261019_commission_Lurantis／Ariados");
  assert.equal(f(d(2026, 10, 8), ["Hanaby & Fusey", "commission"]), "Skeb_20261008_commission_Hanaby／Fusey");
  assert.equal(f(d(2026, 10, 1), ["Garchomp/Salandit", "comission"]), "Skeb_20261001_commission_Garchomp／Salandit");
  assert.equal(f(d(2026, 9, 30), ["Mienshao/Annihilape", "manga"]), "Skeb_20260930_manga_Mienshao／Annihilape");
  assert.equal(f(d(2026, 10, 16), ["commissions"]), "Skeb_20261016_commission_");
  assert.equal(f(d(2026, 6, 2), ["Gastrodonぽこポケ"]), "Skeb_20260602__Gastrodonぽこポケ");
  assert.equal(normalizeChars("x".repeat(80)).length, 50);
});

test("テンプレート: いろいろな値と、使えない文字", () => {
  const post = { id: "1", date: d(2026, 10, 19), lines: ["Lurantis/Ariados", "commission"], tags: ["Pkmn", "Illust"] };
  const vars = templateVars(post, { nick: "IKAGERIRA", slug: "kgym", site: "SubscribeStar" });
  assert.equal(formatName("{site}_{date}_{kind}_{chars}", vars), "SubscribeStar_20261019_commission_Lurantis／Ariados");
  assert.equal(formatName("{date-} {line1} [{tag1}]", vars), "2026-10-19 Lurantis／Ariados [Pkmn]");
  assert.equal(formatName("{nick}", vars), "IKAGERIRA");
  assert.equal(formatName("{slug}-{id}", vars), "kgym-1");
  assert.equal(formatName("{unknown}", vars), "{unknown}");
  assert.equal(formatName("{tags}", vars), "Pkmn／Illust");
  assert.equal(formatName("{title}", vars), "Lurantis／Ariados commission");
  assert.equal(formatName("{title}", templateVars({ ...post, title: "見出し" })), "見出し");
  assert.equal(formatName("a: b. ", {}), "a／ b");
  assert.equal(formatName("", {}), "untitled");
});

test("ファイル名: 先頭のドットと、同じ投稿内の重複", () => {
  assert.equal(safeFileName(".png"), "_.png");
  assert.equal(safeFileName("a/b.png"), "a_b.png");
  const files = uniqueFileNames([{ name: "x_.png" }, { name: "y.png" }, { name: "x_.png" }, { name: "x_.png" }, { name: "noext" }, { name: "noext" }]);
  assert.deepEqual(files.map((f) => f.name), ["x_.png", "y.png", "x__2.png", "x__3.png", "noext", "noext_2"]);
});

// ---- SubscribeStar ----
const loggedIn = `<div class="post " data-id="2732900"><div class="post-date"><a href="/posts/2732900">Oct 14, 2026 11:00 am</a></div>
<div class="post-content" data-role="post_content-text"><div class="trix-content">
<div>Cinderace/Charizard<br>commission</div>
</div></div><div class="post-uploads"><div class="uploads"><div class="uploads-images" data-gallery="[{&quot;id&quot;:1,&quot;original_filename&quot;:&quot;Skeb20261013.png&quot;,&quot;url&quot;:&quot;/post_uploads/1?t=x&amp;s=y&quot;,&quot;type&quot;:&quot;image&quot;},{&quot;id&quot;:2,&quot;original_filename&quot;:&quot;Skeb20261013_.png&quot;,&quot;url&quot;:&quot;https://cdn.example/uploads/b.png&quot;,&quot;type&quot;:&quot;image&quot;}]"></div></div></div>
<div class="post_tags for-post"><a href="/kgym?tag=Pkmn">Pkmn</a><a href="/kgym?tag=FxM">FxM</a></div><div class="post-actions"></div></div>`;

const locked = `<div class="post " data-id="2731304"><div class="post-date"><a href="/posts/2731304">Oct 09, 2026 11:00 am</a></div>
<div class="post-body is-locked"><div class="post-content_wrapper"><div class="post-title"><i class="md_icon"></i><h2>Dialgacommission</h2></div></div>
<div class="post-uploads"><div class="uploads"><div class="uploads-images" data-gallery="[{&quot;id&quot;:3,&quot;original_filename&quot;:&quot;x.png&quot;,&quot;url&quot;:&quot;https://cdn.example/previews_v2/x.jpg&quot;}]"></div></div></div>
<div class="post-actions"></div><a data-role="infinite_scroll-next_page" href="/kgym/posts?page=2&amp;x=1"></a></div>`;

test("SubscribeStar: ログイン後の投稿。相対 URL は origin で絶対にする", () => {
  const p = ss.parsePost(loggedIn, "https://subscribestar.art");
  assert.equal(p.id, "2732900");
  assert.equal(ymd(p.date), "20261014");
  assert.deepEqual(p.lines, ["Cinderace/Charizard", "commission"]);
  assert.deepEqual(p.tags, ["Pkmn", "FxM"]);
  assert.equal(p.files.length, 2);
  assert.equal(p.files[0].name, "Skeb20261013.png");
  assert.equal(p.files[0].url, "https://subscribestar.art/post_uploads/1?t=x&s=y");
  assert.equal(p.files[1].url, "https://cdn.example/uploads/b.png");
  assert.equal(p.files[0].previewUrl, null);
  assert.equal(p.locked, false);
  assert.equal(formatName("Skeb_{date}_{kind}_{chars}", templateVars(p)), "Skeb_20261014_commission_Cinderace／Charizard");
});

test("SubscribeStar: 鍵付き(未ログイン)の投稿はプレビューしかないので files が空", () => {
  const p = ss.parsePost(locked);
  assert.equal(ymd(p.date), "20261009");
  assert.deepEqual(p.lines, ["Dialga", "commission"]);
  assert.equal(p.files.length, 0);
  assert.equal(p.locked, true);
});

test("SubscribeStar: ページの分割、次ページ、URL から作者名", () => {
  const page = ss.parsePage(`<html><head><title>IKAGERIRA on SubscribeStar.art</title></head><body>${loggedIn}${locked}</body></html>`);
  assert.equal(page.posts.length, 2);
  assert.equal(page.nick, "IKAGERIRA");
  assert.equal(page.next, "/kgym/posts?page=2&x=1");
  assert.equal(ss.creatorFromUrl("https://subscribestar.art/kgym"), "kgym");
  assert.equal(ss.creatorFromUrl("https://subscribestar.art/posts/123"), null);
  assert.equal(ss.postUrl({ origin: "https://subscribestar.art" }, { id: "337509" }), "https://subscribestar.art/posts/337509");
  assert.equal(fanbox.postUrl({ creator: "gyu" }, { id: "12739123" }), "https://www.fanbox.cc/@gyu/posts/12739123");
});

// ---- FANBOX ----
const article = {
  body: {
    post: {
      id: "12739123",
      title: "トカゲ漫画30ページ目 [the page 30 of the lizard comic]",
      publishedDatetime: "2026-10-09T18:40:48+09:00",
      tags: [],
      isRestricted: false,
      user: { name: "gyu" },
      type: "article",
      body: {
        blocks: [
          { type: "p", text: "ドラゴンにかかれば女王様もただの肉々しい袋！" },
          { type: "p", text: "" },
          { type: "image", imageId: "b" },
          { type: "image", imageId: "a" },
          { type: "file", fileId: "z" },
        ],
        imageMap: {
          a: { id: "a", extension: "png", width: 4441, height: 6213, originalUrl: "https://downloads.fanbox.cc/images/post/1/a.png", thumbnailUrl: "x" },
          b: { id: "b", extension: "jpeg", originalUrl: "https://downloads.fanbox.cc/images/post/1/b.jpeg", thumbnailUrl: "x" },
          c: { id: "c", extension: "png", originalUrl: "https://downloads.fanbox.cc/images/post/1/c.png", thumbnailUrl: "x" },
        },
        fileMap: { z: { id: "z", name: "まとめ", extension: "zip", url: "https://downloads.fanbox.cc/files/post/1/z.zip" } },
      },
    },
  },
};

test("FANBOX: 記事型。画像はブロックの順、参照されない画像は後ろ、ファイルも拾う", () => {
  const p = fanbox.normalizePost(article);
  assert.equal(p.id, "12739123");
  assert.equal(p.title, "トカゲ漫画30ページ目 [the page 30 of the lizard comic]");
  assert.equal(ymd(p.date), "20261009");
  assert.deepEqual(p.lines, ["ドラゴンにかかれば女王様もただの肉々しい袋！"]);
  assert.deepEqual(p.files.map((f) => f.name), ["001_b.jpeg", "002_a.png", "まとめ.zip", "003_c.png"]);
  assert.equal(p.files[0].previewUrl, "x");
  assert.equal(p.locked, false);
  assert.equal(p.nick, "gyu");
  assert.equal(formatName("{date}_{title}", templateVars(p)), "20261009_トカゲ漫画30ページ目 [the page 30 of the lizard comic]");
});

test("FANBOX: 画像型と、鍵付き", () => {
  const image = { body: { id: "5", title: "絵", publishedDatetime: "2026-01-02T00:00:00+09:00", type: "image", body: { text: "一言\n二言", images: [{ id: "q", extension: "png", originalUrl: "https://downloads.fanbox.cc/q.png" }] } } };
  const p = fanbox.normalizePost(image);
  assert.deepEqual(p.lines, ["一言", "二言"]);
  assert.deepEqual(p.files.map((f) => f.name), ["001_q.png"]);
  const lockedPost = fanbox.normalizePost({ body: { id: "6", title: "鍵", publishedDatetime: "2026-01-02T00:00:00+09:00", isRestricted: true, body: null } });
  assert.equal(lockedPost.locked, true);
  assert.equal(lockedPost.files.length, 0);
});

test("FANBOX: URL から作者 ID", () => {
  assert.equal(fanbox.creatorFromUrl("https://www.fanbox.cc/@gyu/posts"), "gyu");
  assert.equal(fanbox.creatorFromUrl("https://www.fanbox.cc/@gyu"), "gyu");
  assert.equal(fanbox.creatorFromUrl("https://gyu.fanbox.cc/"), "gyu");
  assert.equal(fanbox.creatorFromUrl("https://gyu.fanbox.cc/posts"), "gyu");
  assert.equal(fanbox.creatorFromUrl("https://api.fanbox.cc/post.info"), null);
  assert.equal(fanbox.creatorFromUrl("https://www.fanbox.cc/"), null);
});

test("FANBOX: fetchPosts は一覧 → 本文の順に呼び、鍵付きは本文を読まない", async () => {
  const calls = [];
  const fetchMock = async (url) => {
    calls.push(url.replace(/\?.*/, ""));
    const json = url.includes("paginateCreator")
      ? { body: { pageUrls: ["https://api.fanbox.cc/post.listCreator?creatorId=gyu&page=1"] } }
      : url.includes("listCreator")
        ? { body: { posts: [{ id: "1", title: "a", publishedDatetime: "2026-01-01T00:00:00+09:00", isRestricted: false, user: { name: "gyu" } }, { id: "2", title: "b", publishedDatetime: "2026-01-01T00:00:00+09:00", isRestricted: true }] } }
        : { body: { id: "1", title: "a", publishedDatetime: "2026-01-01T00:00:00+09:00", type: "image", body: { images: [{ id: "x", extension: "png", originalUrl: "https://downloads.fanbox.cc/x.png" }] } } };
    return { ok: true, status: 200, json: async () => json };
  };
  const out = [];
  for await (const r of fanbox.fetchPosts({ creator: "gyu", limit: 0, fileDelay: 0, postDelay: 0 }, { fetch: fetchMock, sleep: async () => {} })) out.push(r);
  assert.deepEqual(calls, ["https://api.fanbox.cc/post.paginateCreator", "https://api.fanbox.cc/post.listCreator", "https://api.fanbox.cc/post.info"]);
  assert.equal(out.length, 2);
  assert.equal(out[0].nick, "gyu");
  assert.equal(out[0].post.files.length, 1);
  assert.equal(out[1].post.locked, true);
});
