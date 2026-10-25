import type { Library, Work } from "./types";

const collator = new Intl.Collator(["ja", "en"], { numeric: true, sensitivity: "base" });

/** 数字を数値として比べる自然順(_2.png < _10.png) */
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

export function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return path.slice(i + 1);
}

/** Rust から受け取った走査結果を表示順に並べ替える */
export function buildLibrary(raw: Library): Library {
  const works: Work[] = raw.works
    .map((w) => ({
      ...w,
      pages: [...w.pages].sort((a, b) => naturalCompare(basename(a), basename(b))),
    }))
    .sort((a, b) => naturalCompare(a.path, b.path));
  return { root: raw.root, works };
}

export function findWorkIndex(library: Library, path: string | null | undefined): number {
  if (!path) return -1;
  return library.works.findIndex((w) => w.path === path);
}
