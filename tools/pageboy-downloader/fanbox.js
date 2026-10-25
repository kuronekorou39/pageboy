// pixiv FANBOX。ページは JavaScript で組み立てられるので、サイトが使っている API をそのまま叩く。
//   post.paginateCreator?creatorId=X  → 一覧ページの URL の配列
//   (各ページ)                        → posts: [{ id, title, publishedDatetime, isRestricted, tags, ... }]
//   post.info?postId=N                 → 本文。type が article なら blocks + imageMap + fileMap、image なら images、file なら files
// API と原寸画像(downloads.fanbox.cc)は Origin / Referer が www.fanbox.cc でないと拒否されるので、
// background.js が拡張機能からの要求にそのヘッダを付けている。

import { safeFileName, uniqueFileNames } from "./naming.js";

export const API = "https://api.fanbox.cc";

/** URL から作者 ID を読む。https://www.fanbox.cc/@gyu/posts と https://gyu.fanbox.cc/ の両方 */
export function creatorFromUrl(url) {
  const u = new URL(url);
  if (!u.hostname.endsWith("fanbox.cc")) return null;
  if (u.hostname === "www.fanbox.cc") return /^\/@([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
  const sub = u.hostname.slice(0, -".fanbox.cc".length);
  return sub && sub !== "api" && sub !== "downloads" ? sub : null;
}

/** 本文(post.info の結果)を共通の形に直す */
export function normalizePost(raw, listItem = {}) {
  const p = raw?.body?.post ?? raw?.body ?? raw ?? {};
  const body = p.body ?? null;
  const files = [];
  const lines = [];
  let n = 0;
  const pushImage = (img) => {
    if (!img?.originalUrl) return;
    n++;
    files.push({ id: img.id, url: img.originalUrl, name: safeFileName(`${String(n).padStart(3, "0")}_${img.id}.${img.extension || "png"}`), type: "image", previewUrl: img.thumbnailUrl ?? null });
  };
  const pushFile = (f) => {
    if (!f?.url) return;
    files.push({ id: f.id, url: f.url, name: safeFileName(`${f.name || f.id}.${f.extension || "bin"}`), type: "attachment" });
  };
  if (body) {
    if (body.text) lines.push(...body.text.split("\n"));
    const seenImages = new Set();
    const seenFiles = new Set();
    for (const b of body.blocks ?? []) {
      if (b.type === "p" || b.type === "header") {
        if (b.text) lines.push(b.text);
      } else if (b.type === "image" && body.imageMap?.[b.imageId]) {
        seenImages.add(b.imageId);
        pushImage(body.imageMap[b.imageId]);
      } else if (b.type === "file" && body.fileMap?.[b.fileId]) {
        seenFiles.add(b.fileId);
        pushFile(body.fileMap[b.fileId]);
      }
    }
    for (const img of body.images ?? []) pushImage(img);
    for (const [k, img] of Object.entries(body.imageMap ?? {})) if (!seenImages.has(k)) pushImage(img);
    for (const f of body.files ?? []) pushFile(f);
    for (const [k, f] of Object.entries(body.fileMap ?? {})) if (!seenFiles.has(k)) pushFile(f);
  }
  const published = p.publishedDatetime ?? listItem.publishedDatetime ?? null;
  const date = published ? new Date(published) : null;
  return {
    id: String(p.id ?? listItem.id ?? ""),
    dateText: published ?? "",
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    title: (p.title ?? listItem.title ?? "").trim(),
    lines: lines.map((s) => s.trim()).filter((s) => s),
    tags: p.tags ?? listItem.tags ?? [],
    files: uniqueFileNames(files),
    locked: Boolean(p.isRestricted ?? listItem.isRestricted) || body === null,
    nick: p.user?.name ?? listItem.user?.name ?? null,
  };
}

/** 投稿ページの URL(失敗したときに手で開けるように) */
export function postUrl(cfg, post) {
  return `https://www.fanbox.cc/@${cfg.creator}/posts/${post.id}`;
}

/**
 * 投稿を新しい順に 1 つずつ返す(app.js から使う)。
 * cfg: { creator, limit, fileDelay, postDelay }。
 * 投稿ごとに post.info を 1 回呼ぶので、その前に fileDelay、一覧の次ページを読む前に postDelay だけ待つ
 */
export async function* fetchPosts(cfg, { fetch, sleep }) {
  const json = async (url) => {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401 || res.status === 403) throw new Error(`API に拒否されました(HTTP ${res.status})。FANBOX にログインしているか確かめてください`);
    if (!res.ok) throw new Error(`API エラー: HTTP ${res.status} ${url.replace(/\?.*/, "")}`);
    return res.json();
  };
  const pages = (await json(`${API}/post.paginateCreator?creatorId=${encodeURIComponent(cfg.creator)}`)).body?.pageUrls ?? [];
  let count = 0;
  let nick = null;
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) await sleep(cfg.postDelay);
    const list = (await json(pages[i])).body?.posts ?? [];
    for (const item of list) {
      if (cfg.limit && count >= cfg.limit) return;
      count++;
      nick ??= item.user?.name ?? null;
      if (item.isRestricted) {
        yield { post: normalizePost({ body: { ...item, body: null } }, item), nick };
        continue;
      }
      await sleep(cfg.fileDelay);
      const post = normalizePost(await json(`${API}/post.info?postId=${encodeURIComponent(item.id)}`), item);
      nick ??= post.nick;
      yield { post, nick };
    }
  }
}
