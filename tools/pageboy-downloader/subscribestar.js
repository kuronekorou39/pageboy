// SubscribeStar。作者ページの HTML を投稿ごとに分解する。
// ログイン後の画像 URL は "/post_uploads/..." の相対パスで来るので origin で絶対にする。
// DOM に依存しない文字列処理だけにしてあるので、Node でもテストできる。

import { safeFileName, splitTrailingKind, uniqueFileNames } from "./naming.js";

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function unescapeHtml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripTags(s) {
  return unescapeHtml(s.replace(/<[^>]+>/g, "")).trim();
}

/** "Oct 19, 2026 11:00 am" → Date(ローカル)。読めなければ null */
export function parseDate(text) {
  const m = /([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})(?: (\d{1,2}):(\d{2}) ([ap]m))?/i.exec(text);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  let hour = m[4] ? Number(m[4]) % 12 : 0;
  if (m[6]?.toLowerCase() === "pm") hour += 12;
  return new Date(Number(m[3]), month, Number(m[2]), hour, m[5] ? Number(m[5]) : 0);
}

/** 本文を行に分ける。ログイン後は <br> や <div> 区切り。鍵付き表示では <h2> 1 行につながる */
export function contentLines(postHtml) {
  const m = /data-role="post_content-text">([\s\S]*?)(?=<div class="(?:post-uploads|post_tags|post-actions))/.exec(postHtml);
  let raw = m ? m[1] : (/<div class="post-title">[\s\S]*?<h2>([\s\S]*?)<\/h2>/.exec(postHtml)?.[1] ?? "");
  raw = raw.replace(/<br\s*\/?>|<\/div>|<\/p>|\n/g, "\n");
  const lines = raw
    .split("\n")
    .map((s) => stripTags(s))
    .filter((s) => s);
  return splitTrailingKind(lines);
}

/** 1 投稿ぶんの HTML から、ID・日付・本文・タグ・ファイル一覧を取り出す */
export function parsePost(postHtml, origin = "") {
  const id = /data-id="(\d+)"/.exec(postHtml)?.[1] ?? null;
  // <div class="post-date"><a href=...>Oct 19, 2026 11:00 am</a></div> でも <a class="post-date" href=...>…</a> でも読める
  const dateText = stripTags(/class="post-date"[^>]*>([\s\S]*?)<\/(?:a|div|span|time)>/.exec(postHtml)?.[1] ?? "");
  const date = parseDate(dateText.replace(/^Updated on /, ""));
  const lines = contentLines(postHtml);
  const tagsHtml = /<div class="post_tags[^"]*">([\s\S]*?)<div class="post-actions"/.exec(postHtml)?.[1] ?? "";
  const tags = [...tagsHtml.matchAll(/\?tag=([^"&]+)"/g)].map((m) => decodeURIComponent(unescapeHtml(m[1]).replace(/\+/g, " ")));
  const files = [];
  let locked = false;
  const absolute = (u) => (/^https?:\/\//.test(u) ? u : u.startsWith("/") ? origin + u : u);

  const g = /data-gallery="([^"]*)"/.exec(postHtml);
  if (g) {
    let items = [];
    try {
      items = JSON.parse(unescapeHtml(g[1]));
    } catch {
      items = [];
    }
    for (const it of items) {
      if (!it.url) continue;
      if (it.url.includes("/previews")) {
        locked = true;
        continue;
      }
      files.push({
        id: it.id,
        url: absolute(it.url),
        name: safeFileName(it.original_filename || `${it.id}`),
        type: it.type ?? "image",
        // 原寸が取れないときの代わり(幅 1200px 程度の縮小版)
        previewUrl: it.preview_url ? absolute(it.preview_url) : null,
      });
    }
  }
  const docs = /class="uploads-docs"([\s\S]*?)(?=class="post-edit_form"|<div class="post_tags|<div class="post-actions)/.exec(postHtml)?.[1];
  if (docs) {
    for (const att of docs.split(/class="doc_preview[" ]/).slice(1)) {
      const url = /href="([^"]+)"/.exec(att)?.[1];
      const name = /doc_preview-title">([^<]*)</.exec(att)?.[1];
      if (url) files.push({ id: /data-upload-id="(\d+)"/.exec(att)?.[1], url: absolute(unescapeHtml(url)), name: safeFileName(unescapeHtml(name || "attachment")), type: "attachment" });
    }
  }
  return { id, dateText, date, lines, tags, files: uniqueFileNames(files), locked };
}

/** 作者ページ(または「次のページ」の html 断片)を投稿ごとに分け、次ページの URL も返す */
export function parsePage(html, origin = "") {
  const chunks = html.split('<div class="post ').slice(1);
  const posts = chunks.map((c) => parsePost('<div class="post ' + c, origin));
  const next = /data-role="infinite_scroll-next_page" href="([^"]*)"/.exec(chunks[chunks.length - 1] ?? "")?.[1];
  const nick = /<title>([^<]*?) on SubscribeStar/.exec(html)?.[1];
  return { posts, next: next ? unescapeHtml(next) : null, nick: nick ? unescapeHtml(nick).trim() : null };
}

/** URL から作者名を読む。https://subscribestar.art/kgym → kgym */
export function creatorFromUrl(url) {
  return /^https:\/\/(?:www\.)?subscribestar\.(?:art|com|adult)\/(?!posts\/)([^/?#]+)/.exec(url)?.[1] ?? null;
}

/** 投稿ページの URL(失敗したときに手で開けるように) */
export function postUrl(cfg, post) {
  return `${cfg.origin}/posts/${post.id}`;
}

/**
 * 投稿を新しい順に 1 つずつ返す(app.js から使う)。
 * cfg: { origin, creator, limit, postDelay }。一覧の次ページを読む前に postDelay だけ待つ
 */
export async function* fetchPosts(cfg, { fetch, sleep }) {
  let res = await fetch(`${cfg.origin}/${cfg.creator}`, { credentials: "include" });
  if (!res.ok) throw new Error(`作者ページが開けません: HTTP ${res.status}`);
  if (/\/(?:verify_subscriber|age_confirmation_warning|login)/.test(res.url)) {
    throw new Error(`ログインか年齢確認が必要です: ${res.url}`);
  }
  let page = parsePage(await res.text(), cfg.origin);
  const nick = page.nick;
  let count = 0;
  while (true) {
    for (const post of page.posts) {
      if (cfg.limit && count >= cfg.limit) return;
      count++;
      yield { post, nick };
    }
    if (!page.next || (cfg.limit && count >= cfg.limit)) return;
    await sleep(cfg.postDelay);
    res = await fetch(cfg.origin + page.next, { credentials: "include", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`次のページが開けません: HTTP ${res.status}`);
    const json = await res.json();
    page = parsePage(json.html ?? "", cfg.origin);
    if (page.posts.length === 0) return;
  }
}
