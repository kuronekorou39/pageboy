import type { Library, RawLibrary, Work } from "./types";

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

/** Rust から受け取った走査結果に作者を付け、表示順に並べ替える */
export function buildLibrary(raw: RawLibrary): Library {
  const works: Work[] = raw.works
    .map((w) => ({
      path: w.path,
      ...parseWorkName(w.path, raw.root),
      pages: [...w.pages].sort((a, b) => naturalCompare(basename(a), basename(b))),
    }))
    .sort((a, b) => naturalCompare(a.path, b.path));
  return { root: raw.root, works };
}

export function findWorkIndex(library: Library, path: string | null | undefined): number {
  if (!path) return -1;
  return library.works.findIndex((w) => w.path === path);
}
