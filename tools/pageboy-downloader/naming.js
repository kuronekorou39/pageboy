// フォルダ名・ファイル名の組み立て。サイトに依存しない。

/** 本文 2 行目(種別)の表記ゆれ */
const KIND_ALIASES = { comission: "commission", commissions: "commission", comissions: "commission" };
export const KINDS = ["commission", "manga", "illust", "sketch"];
/** Windows でフォルダ名に使えない文字 */
const INVALID = /[\\/:*?"<>|]/g;
/** キャラ名欄の最大文字数(本文が長文のときに切る) */
const CHARS_MAX = 50;

export function ymd(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
}

/** "Dialgacommission" のようにつながった 1 行から、末尾の種別語を切り離す */
export function splitTrailingKind(lines) {
  if (lines.length !== 1) return lines;
  const low = lines[0].toLowerCase();
  for (const k of [...Object.keys(KIND_ALIASES), ...KINDS]) {
    if (low.endsWith(k) && low.length > k.length) return [lines[0].slice(0, -k.length).trim(), lines[0].slice(-k.length)];
  }
  return lines;
}

/** 種別として分かる語だけ小文字に正規化して返す。それ以外は空 */
export function normalizeKind(s) {
  let k = s.trim().toLowerCase();
  k = KIND_ALIASES[k] ?? k;
  return KINDS.includes(k) ? k : "";
}

export function normalizeChars(s) {
  s = s.trim().replace(/\s*(?:\/|&|\band\b)\s*/g, "／");
  s = s.replace(INVALID, "／");
  s = s.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  return s.slice(0, CHARS_MAX).trim();
}

/**
 * 添付ファイル名として使える形にする(パス区切りや制御文字を除く)。
 * 先頭が "." のファイル(".png" など)は pageboy が隠しファイルとして飛ばすので "_" を前に付ける
 */
export function safeFileName(name) {
  const s = name.replace(INVALID, "_").replace(/[\u0000-\u001f]/g, "").trim() || "file";
  return s.startsWith(".") ? `_${s}` : s;
}

/** 同じ投稿の中で同じファイル名が 2 回出てきたら、2 つ目以降に _2, _3 … を付ける(上書きや取りこぼしを防ぐ) */
export function uniqueFileNames(files) {
  const seen = new Map();
  for (const f of files) {
    const n = (seen.get(f.name) ?? 0) + 1;
    seen.set(f.name, n);
    if (n > 1) {
      const dot = f.name.lastIndexOf(".");
      f.name = dot > 0 ? `${f.name.slice(0, dot)}_${n}${f.name.slice(dot)}` : `${f.name}_${n}`;
    }
  }
  return files;
}

/** フォルダ名 1 階層ぶんとして使える形にする */
export function safeFolderName(name) {
  return name.replace(INVALID, "／").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").replace(/[. ]+$/, "").trim().slice(0, 120) || "untitled";
}

/**
 * テンプレートの {名前} を値で置き換える。使える名前は templateVars を見る。
 * 空の値は空文字になる(区切りの `_` はそのまま残る。`Skeb_20261016_commission_` のように)
 */
export function formatName(template, vars) {
  return safeFolderName(template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? "") : m)));
}

/**
 * テンプレートで使える値。post は各サイトのモジュールが返す共通の形:
 * { id, date, title?, lines, tags, files, locked }
 * title がないサイトでは本文の全行をつないだものを title にする
 */
export function templateVars(post, extra = {}) {
  const lines = post.lines ?? [];
  const date = post.date;
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: date ? ymd(date) : "",
    "date-": date ? `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` : "",
    year: date ? String(date.getFullYear()) : "",
    id: post.id ?? "",
    line1: lines[0] ?? "",
    line2: lines[1] ?? "",
    line3: lines[2] ?? "",
    title: post.title ?? lines.join(" "),
    kind: normalizeKind(lines.length >= 2 ? lines[1] : (lines[0] ?? "")),
    chars: normalizeChars(lines.length >= 2 || !normalizeKind(lines[0] ?? "") ? (lines[0] ?? "") : ""),
    tags: (post.tags ?? []).join("／"),
    tag1: post.tags?.[0] ?? "",
    nick: extra.nick ?? "",
    slug: extra.slug ?? "",
    site: extra.site ?? "",
  };
}
