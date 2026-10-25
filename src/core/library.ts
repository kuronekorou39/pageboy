import type { Cursor, Library, RawLibrary, Work } from "./types";

const collator = new Intl.Collator(["ja", "en"], { numeric: true, sensitivity: "base" });

/** 数字を数値として比べる自然順(_2.png < _10.png) */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

export function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return path.slice(i + 1);
}

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? "" : path.slice(0, i);
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/[\\/]+$/, "").replace(/\\/g, "/");
  return norm(a) === norm(b);
}

/**
 * フォルダ名から作者と題名を読む(命名規則は library/README.md)。
 * `[作者] 題名` なら角括弧の中が作者。なければ親フォルダが作者。
 * ライブラリ直下(または root 自体)の作品は作者なし。
 */
export function parseWorkName(path: string, root: string): { author: string | null; name: string } {
  const folder = basename(path);
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(folder);
  if (m && m[2]) return { author: m[1]!.trim(), name: m[2].trim() };
  const parent = dirname(path);
  if (!parent || samePath(path, root) || samePath(parent, root)) return { author: null, name: folder };
  return { author: basename(parent), name: folder };
}

/**
 * フォルダ名に含まれる日付を読む(ミリ秒)。20261019 / 2026-10-19 / 2026_10_19 の形。
 * 見つからなければ null
 */
export function dateFromName(name: string): number | null {
  const m = /(?:^|\D)((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)/.exec(name);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Rust から受け取った走査結果に作者と日付を付け、名前順に並べる(表示順は sortWorks で決める) */
export function buildLibrary(raw: RawLibrary): Library {
  const works: Work[] = raw.works
    .map((w) => ({
      path: w.path,
      ...parseWorkName(w.path, raw.root),
      pages: [...w.pages].sort((a, b) => naturalCompare(basename(a), basename(b))),
      date: dateFromName(basename(w.path)) ?? (w.modified ? w.modified * 1000 : null),
    }))
    .sort((a, b) => naturalCompare(a.path, b.path));
  return { root: raw.root, works };
}

/** 作品の並び順。newest / oldest は日付、name はパスの自然順 */
export type SortOrder = "newest" | "oldest" | "name";

export const SORT_ORDERS: SortOrder[] = ["newest", "oldest", "name"];

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: "新しい順",
  oldest: "古い順",
  name: "名前順",
};

export function nextSortOrder(order: SortOrder): SortOrder {
  return SORT_ORDERS[(SORT_ORDERS.indexOf(order) + 1) % SORT_ORDERS.length]!;
}

/** 並べ替えた新しい配列を返す。日付がない作品は日付順では末尾(そのなかは名前順) */
export function sortWorks(works: Work[], order: SortOrder): Work[] {
  const byName = (a: Work, b: Work) => naturalCompare(a.path, b.path);
  const list = [...works];
  if (order === "name") return list.sort(byName);
  const sign = order === "newest" ? -1 : 1;
  return list.sort((a, b) => {
    if (a.date === null && b.date === null) return byName(a, b);
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date === b.date ? byName(a, b) : sign * (a.date - b.date);
  });
}

export function findWorkIndex(library: Library, path: string | null | undefined): number {
  if (!path) return -1;
  return library.works.findIndex((w) => w.path === path);
}

/** 一覧の絞り込み。空白区切りの語をすべて含む(作者名・題名、大文字小文字は区別しない) */
export function matchesQuery(work: Work, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${work.author ?? ""} ${work.name}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * ライブラリ全体のページを 1 本の通し番号で扱う(ライブラリ全体ランダム用)。
 * total は全ページ数、locate は通し番号 → カーソル、indexOf はその逆
 */
export interface PageIndex {
  total: number;
  locate: (i: number) => Cursor;
  indexOf: (cur: Cursor) => number;
}

export function pageIndex(library: Library): PageIndex {
  const starts: number[] = [];
  let total = 0;
  for (const w of library.works) {
    starts.push(total);
    total += w.pages.length;
  }
  return {
    total,
    locate: (i) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid]! <= i) lo = mid;
        else hi = mid - 1;
      }
      return { work: lo, page: i - starts[lo]!, step: 0 };
    },
    indexOf: (cur) => (starts[cur.work] ?? 0) + cur.page,
  };
}
