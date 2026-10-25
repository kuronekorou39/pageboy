import type { Cursor, FolderMode, Library, Work } from "./types";

export interface NavContext {
  library: Library;
  modeOf: (work: Work) => FolderMode;
  /** ランダムモードで次に見せるページ番号。current は今のページ */
  randomPage: (work: Work, current: number) => number;
  /** true ならページを読み終えるたびにライブラリ全体からランダムなページへ(作品ごとのモードより優先) */
  libraryRandom: boolean;
  /** ライブラリ全体から次に見せる場所。current は今の位置 */
  randomAnywhere: (current: Cursor) => Cursor;
}

const LAST = Number.POSITIVE_INFINITY;

function workAt(ctx: NavContext, index: number): Work {
  const w = ctx.library.works[index];
  if (!w) throw new Error(`work index out of range: ${index}`);
  return w;
}

/**
 * 「進む」。ステップが残っていれば次ステップ。ページを読み終えたら、
 * ライブラリ全体ランダムなら全体からランダムな場所、
 * 作品がランダムモードなら同じ作品内のランダムなページ、
 * 順番モードなら 次ページ → 次作品、終端なら null。
 */
export function forward(ctx: NavContext, cur: Cursor, stepCount: number): Cursor | null {
  if (cur.step + 1 < stepCount) return { ...cur, step: cur.step + 1 };
  if (ctx.libraryRandom) return ctx.randomAnywhere(cur);
  const work = workAt(ctx, cur.work);
  if (ctx.modeOf(work) === "random") {
    return { work: cur.work, page: ctx.randomPage(work, cur.page), step: 0 };
  }
  if (cur.page + 1 < work.pages.length) return { work: cur.work, page: cur.page + 1, step: 0 };
  if (cur.work + 1 < ctx.library.works.length) return { work: cur.work + 1, page: 0, step: 0 };
  return null;
}

/**
 * 「戻る」。前ステップ → 前ページ末尾 → 前作品末尾。先頭なら null。
 * ランダム(作品ごと / ライブラリ全体)でステップ 0 のときも null(呼び出し側が履歴で戻る)。
 */
export function backward(ctx: NavContext, cur: Cursor): Cursor | null {
  if (cur.step > 0) return { ...cur, step: cur.step - 1 };
  if (ctx.libraryRandom) return null;
  const work = workAt(ctx, cur.work);
  if (ctx.modeOf(work) === "random") return null;
  if (cur.page > 0) return { work: cur.work, page: cur.page - 1, step: LAST };
  if (cur.work > 0) {
    const prev = workAt(ctx, cur.work - 1);
    return { work: cur.work - 1, page: prev.pages.length - 1, step: LAST };
  }
  return null;
}

export function nextPage(ctx: NavContext, cur: Cursor): Cursor | null {
  if (ctx.libraryRandom) return ctx.randomAnywhere(cur);
  const work = workAt(ctx, cur.work);
  if (ctx.modeOf(work) === "random") {
    return { work: cur.work, page: ctx.randomPage(work, cur.page), step: 0 };
  }
  if (cur.page + 1 < work.pages.length) return { work: cur.work, page: cur.page + 1, step: 0 };
  return nextWork(ctx, cur);
}

export function prevPage(ctx: NavContext, cur: Cursor): Cursor | null {
  if (cur.page > 0) return { work: cur.work, page: cur.page - 1, step: 0 };
  return prevWork(ctx, cur);
}

export function nextWork(ctx: NavContext, cur: Cursor): Cursor | null {
  if (cur.work + 1 < ctx.library.works.length) return { work: cur.work + 1, page: 0, step: 0 };
  return null;
}

export function prevWork(ctx: NavContext, cur: Cursor): Cursor | null {
  if (cur.work > 0) return { work: cur.work - 1, page: 0, step: 0 };
  return null;
}

/** 作品の先頭へ */
export function firstPage(cur: Cursor): Cursor {
  return { work: cur.work, page: 0, step: 0 };
}
