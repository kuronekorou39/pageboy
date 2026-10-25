// ダウンロード画面。サイトごとのモジュール(subscribestar.js / fanbox.js)から投稿を受け取り、
// 選んだフォルダへ直接書く。ブラウザのログイン状態をそのまま使うので Cookie の持ち出しは要らない。
// 同時に取るのは 1 つだけ。ファイルの間と投稿の間に設定した時間だけ待つ。

import * as fanbox from "./fanbox.js";
import { formatName, templateVars } from "./naming.js";
import * as subscribestar from "./subscribestar.js";

const STATE_FILE = "pageboy-downloads.json";
const FIELD_IDS = ["creator", "limit", "authorTemplate", "folderTemplate", "fileDelay", "postDelay"];

/** サイトごとの既定値と取り込みモジュール */
const SITES = {
  "subscribestar.art": {
    label: "SubscribeStar",
    origin: "https://subscribestar.art",
    module: subscribestar,
    creatorHint: "URL の https://subscribestar.art/ の後ろ",
    defaults: { authorTemplate: "{nick}", folderTemplate: "{site}_{date}_{kind}_{chars}", fileDelay: 1500, postDelay: 3000 },
  },
  "subscribestar.com": {
    label: "SubscribeStar",
    origin: "https://www.subscribestar.com",
    module: subscribestar,
    creatorHint: "URL の https://www.subscribestar.com/ の後ろ",
    defaults: { authorTemplate: "{nick}", folderTemplate: "{site}_{date}_{kind}_{chars}", fileDelay: 1500, postDelay: 3000 },
  },
  fanbox: {
    label: "FANBOX",
    origin: "https://www.fanbox.cc",
    module: fanbox,
    creatorHint: "URL の @ の後ろ(https://www.fanbox.cc/@gyu なら gyu)",
    defaults: { authorTemplate: "{nick}", folderTemplate: "{site}_{date}_{title}", fileDelay: 2000, postDelay: 4000 },
  },
};

const $ = (id) => document.getElementById(id);
const logEl = $("log");
let stopRequested = false;

function log(text, cls = "") {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 保存先フォルダのハンドルを IndexedDB に覚える ----
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pageboy-downloader", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction("kv").objectStore("kv").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function kvSet(key, value) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRoot(interactive) {
  const handle = await kvGet("root");
  if (!handle) return null;
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return handle;
  if (interactive && (await handle.requestPermission({ mode: "readwrite" })) === "granted") return handle;
  return null;
}

async function showRoot() {
  const handle = await kvGet("root");
  $("folder").textContent = handle ? `${handle.name}(開始時に権限を確認します)` : "未設定";
}

// ---- ファイル操作 ----
async function fileSize(dir, name) {
  try {
    const fh = await dir.getFileHandle(name);
    return (await fh.getFile()).size;
  } catch {
    return -1;
  }
}

async function writeFile(dir, name, blob) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

const PREVIEW_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];

/** 原寸 "a.png" の代わりに保存するプレビューの名前。"a.preview.png" のように並び順が原寸の隣になる */
function previewName(originalName, previewUrl) {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext = (/\.([a-z0-9]+)(?:$|\?)/i.exec(previewUrl)?.[1] ?? "png").toLowerCase();
  return `${base}.preview.${PREVIEW_EXTS.includes(ext) ? ext : "png"}`;
}

/** 原寸が取れなかったファイルの代わりにプレビューを保存する。保存できたらその名前、できなければ null */
async function savePreview(dir, f) {
  if (!f.previewUrl) return null;
  const name = previewName(f.name, f.previewUrl);
  try {
    if ((await fileSize(dir, name)) > 0) return name;
    const res = await fetch(f.previewUrl, { credentials: "include" });
    if (!res.ok) return null;
    await writeFile(dir, name, await res.blob());
    return name;
  } catch {
    return null;
  }
}

/** 原寸が取れたので、以前の代用プレビューがあれば消す */
async function removePreview(dir, originalName) {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  for (const ext of PREVIEW_EXTS) {
    try {
      await dir.removeEntry(`${base}.preview.${ext}`);
    } catch {
      // なければそれでよい
    }
  }
}

async function readJson(dir, name) {
  try {
    const fh = await dir.getFileHandle(name);
    return JSON.parse(await (await fh.getFile()).text());
  } catch {
    return null;
  }
}

// ---- 設定(サイトごとに別に覚える) ----
function currentSite() {
  return SITES[$("site").value] ?? SITES["subscribestar.art"];
}

async function loadFields(siteKey) {
  const site = SITES[siteKey];
  const stored = (await chrome.storage.local.get(`settings:${siteKey}`))[`settings:${siteKey}`] ?? {};
  // 以前の既定(Skeb_...)をそのまま使っていたら、新しい既定({site}_...)に乗り換える
  if (stored.folderTemplate === "Skeb_{date}_{kind}_{chars}") delete stored.folderTemplate;
  for (const id of FIELD_IDS) $(id).value = stored[id] ?? site.defaults[id] ?? "";
  $("creatorHint").textContent = site.creatorHint;
}

function readFields() {
  const siteKey = $("site").value;
  const site = SITES[siteKey];
  const s = {};
  for (const id of FIELD_IDS) s[id] = $(id).value.trim();
  chrome.storage.local.set({ site: siteKey, [`settings:${siteKey}`]: s });
  return {
    siteKey,
    site,
    origin: site.origin,
    creator: s.creator.replace(/^@/, ""),
    limit: Number(s.limit) || 0,
    authorTemplate: s.authorTemplate || "{nick}",
    folderTemplate: s.folderTemplate || "{date}_{id}",
    fileDelay: Math.max(0, Number(s.fileDelay) || 0),
    postDelay: Math.max(0, Number(s.postDelay) || 0),
  };
}

// ---- 本体 ----
async function run(dry) {
  stopRequested = false;
  logEl.textContent = "";
  const cfg = readFields();
  if (!cfg.creator) return log("作者を入れてください", "err");

  const root = await getRoot(true);
  if (!root) return log("保存先フォルダを選んでください", "err");

  setBusy(true);
  try {
    let authorDir = null;
    let state = null;
    let saved = 0;
    let skipped = 0;
    let n = 0;
    /** この実行で使ったフォルダ名 → 投稿 ID(名前の衝突を見つけるため。dry のときは state に書かないので必要) */
    const usedFolders = new Map();
    log(`${cfg.site.label} の ${cfg.creator} から${cfg.limit ? `上から ${cfg.limit} 件` : "全部"}。間隔: ファイル ${cfg.fileDelay}ms、投稿 ${cfg.postDelay}ms`);
    for await (const { post, nick } of cfg.site.module.fetchPosts(cfg, { fetch, sleep })) {
      if (stopRequested) break;
      n++;
      const extra = { nick: nick || cfg.creator, slug: cfg.creator, site: cfg.site.label };
      if (!state) {
        const authorName = formatName(cfg.authorTemplate, templateVars({ lines: [], tags: [] }, extra));
        authorDir = dry ? null : await root.getDirectoryHandle(authorName, { create: true });
        state = (authorDir && (await readJson(authorDir, STATE_FILE))) || { version: 1, site: cfg.siteKey, creator: cfg.creator, posts: {} };
        log(`保存先: ${root.name}\\${authorName}\\`);
      }
      if (!post.date) {
        log(`#${n} 投稿 ${post.id}: 日付が読めません(${post.dateText})`, "warn");
        continue;
      }
      let folder = formatName(cfg.folderTemplate, templateVars(post, extra));
      // 同じ日に同じ題名の投稿が 2 つあると名前がぶつかる。先に使った投稿と違うなら投稿 ID を足す
      const takenBy = usedFolders.get(folder) ?? Object.entries(state?.posts ?? {}).find(([, p]) => p.folder === folder)?.[0];
      if (takenBy && takenBy !== post.id) folder = `${folder}_${post.id}`;
      usedFolders.set(folder, post.id);
      const head = `#${n} ${folder}`;
      if (post.files.length === 0) {
        log(`${head}: ${post.locked ? "鍵付き(購読範囲外)" : "ファイルなし"}`, "skip");
        continue;
      }
      if (dry) {
        log(`${head}  (${post.files.map((f) => f.name).join(", ")})`);
        const detail = [post.title ? `タイトル: ${post.title}` : "", post.lines.length ? `本文: ${post.lines.slice(0, 3).join(" | ")}` : "", post.tags.length ? `タグ: ${post.tags.join(", ")}` : ""].filter(Boolean);
        if (detail.length) log(`      ${detail.join("  ")}`, "skip");
        continue;
      }

      const known = state.posts[post.id];
      const dir = await authorDir.getDirectoryHandle(folder, { create: true });
      let wrote = 0;
      let present = 0;
      let failed = 0;
      /** 原寸が取れず、代わりにプレビューを保存した(または何も保存できなかった)ファイル名 */
      const incomplete = [];
      for (const f of post.files) {
        if (stopRequested) break;
        if ((await fileSize(dir, f.name)) > 0) {
          present++;
          continue;
        }
        if (wrote + failed > 0) await sleep(cfg.fileDelay);
        try {
          const res = await fetch(f.url, { credentials: "include" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await writeFile(dir, f.name, await res.blob());
          await removePreview(dir, f.name); // 以前プレビューで代用していたなら、原寸が取れたので消す
          wrote++;
          log(`    ${f.name}`, "ok");
        } catch (e) {
          failed++;
          incomplete.push(f.name);
          const fallback = await savePreview(dir, f);
          log(`    ${f.name}: 原寸は取れず(${e.message ?? e})${fallback ? `。代わりに ${fallback} を保存` : ""}`, "err");
        }
      }
      if (wrote === 0 && failed === 0 && present === post.files.length) {
        skipped++;
        log(`${head}: 済み${known ? "" : "(記録なし、ファイルあり)"}`, "skip");
      } else {
        saved++;
        log(
          `${head}: ${wrote} 件保存${failed ? `、${failed} 件は原寸が取れず(次回また試します)  → 手で確かめる: ${cfg.site.module.postUrl(cfg, post)}` : ""}`,
          failed ? "warn" : "ok",
        );
      }
      state.posts[post.id] = {
        date: post.date.toISOString(),
        folder,
        title: post.title ?? "",
        lines: post.lines,
        tags: post.tags,
        files: post.files.map((f) => f.name),
        savedAt: new Date().toISOString(),
        ...(incomplete.length ? { incomplete } : {}),
      };
      await writeFile(authorDir, STATE_FILE, new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
      if (wrote + failed > 0) await sleep(cfg.postDelay);
    }
    log(stopRequested ? "止めました" : dry ? `${n} 件の名前を確認しました` : `完了: ${saved} 件保存、${skipped} 件は済み`);
  } catch (e) {
    log(`エラー: ${e.message ?? e}`, "err");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  for (const id of ["start", "dry", "pick", "site"]) $(id).disabled = busy;
  $("stop").disabled = !busy;
}

// ---- 初期化 ----
(async () => {
  const params = new URLSearchParams(location.search);
  const stored = await chrome.storage.local.get("site");
  const siteKey = params.get("site") || stored.site || "subscribestar.art";
  $("site").value = siteKey in SITES ? siteKey : "subscribestar.art";
  await loadFields($("site").value);
  const from = params.get("from");
  if (from) {
    const creator = currentSite().module.creatorFromUrl(from);
    if (creator) $("creator").value = creator;
  }
  await showRoot();

  $("site").onchange = () => void loadFields($("site").value);
  $("pick").onclick = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await kvSet("root", handle);
      await showRoot();
      log(`保存先を ${handle.name} にしました`);
    } catch (e) {
      if (e.name !== "AbortError") log(`フォルダを選べませんでした: ${e.message}`, "err");
    }
  };
  $("start").onclick = () => run(false);
  $("dry").onclick = () => run(true);
  $("stop").onclick = () => {
    stopRequested = true;
    log("止めています…");
  };
})();
