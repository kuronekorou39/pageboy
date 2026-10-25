import type { Size } from "./types";

/**
 * 連続モード: 作品の全ページを縦に 1 本につなげた「帯」のレイアウト。
 * 各ページは横幅フィット × zoom で描き、ページの間に gap(画面 px)を空ける。
 */
export interface StripLayout {
  /** 各ページの帯の中での上端(画面 px) */
  tops: number[];
  heights: number[];
  widths: number[];
  /** 帯全体の高さ */
  total: number;
}

export function layoutStrip(sizes: Size[], viewportWidth: number, zoom: number, gap: number): StripLayout {
  const tops: number[] = [];
  const heights: number[] = [];
  const widths: number[] = [];
  let y = 0;
  for (const s of sizes) {
    const scale = (viewportWidth * zoom) / s.width;
    tops.push(y);
    widths.push(s.width * scale);
    const h = s.height * scale;
    heights.push(h);
    y += h + gap;
  }
  const total = sizes.length === 0 ? 0 : y - gap;
  return { tops, heights, widths, total };
}

export function maxScroll(layout: StripLayout, viewportHeight: number): number {
  return Math.max(0, layout.total - viewportHeight);
}

/** スクロール位置を範囲内に収める。Infinity は末尾 */
export function clampScroll(y: number, layout: StripLayout, viewportHeight: number): number {
  const max = maxScroll(layout, viewportHeight);
  if (!Number.isFinite(y)) return max;
  return Math.min(Math.max(0, y), max);
}

/** 1 画面ぶん(重なりを除く)下へ。すでに末尾なら null */
export function scrollForward(y: number, layout: StripLayout, viewportHeight: number, overlap: number): number | null {
  const max = maxScroll(layout, viewportHeight);
  if (y >= max - 0.5) return null;
  return Math.min(max, y + viewportHeight * (1 - overlap));
}

/** 1 画面ぶん上へ。すでに先頭なら null */
export function scrollBackward(y: number, viewportHeight: number, overlap: number): number | null {
  if (y <= 0.5) return null;
  return Math.max(0, y - viewportHeight * (1 - overlap));
}

/** 画面の中央にかかっているページ。HUD の表示と「最後に読んだページ」の保存に使う */
export function pageAtScroll(layout: StripLayout, y: number, viewportHeight: number): number {
  if (layout.tops.length === 0) return 0;
  const center = y + viewportHeight / 2;
  let page = 0;
  for (let i = 0; i < layout.tops.length; i++) {
    if (layout.tops[i]! <= center) page = i;
    else break;
  }
  return page;
}

/** 指定ページの上端へ移動するためのスクロール位置 */
export function scrollForPage(layout: StripLayout, page: number, viewportHeight: number): number {
  const top = layout.tops[Math.min(Math.max(0, page), layout.tops.length - 1)] ?? 0;
  return clampScroll(top, layout, viewportHeight);
}

/** 画面(前後に margin を足した範囲)にかかるページ番号。描画する <img> を絞るために使う */
export function visiblePages(layout: StripLayout, y: number, viewportHeight: number, margin: number): number[] {
  const from = y - margin;
  const to = y + viewportHeight + margin;
  const out: number[] = [];
  for (let i = 0; i < layout.tops.length; i++) {
    const top = layout.tops[i]!;
    const bottom = top + layout.heights[i]!;
    if (bottom >= from && top <= to) out.push(i);
  }
  return out;
}

/**
 * 拡大率や画面サイズが変わってレイアウトが変わったとき、
 * 「どのページのどの割合まで読んでいたか」を保ったままスクロール位置を移す
 */
export function rescaleScroll(from: StripLayout, to: StripLayout, y: number, viewportHeight: number): number {
  if (from.tops.length === 0 || to.tops.length === 0) return 0;
  let page = 0;
  for (let i = 0; i < from.tops.length; i++) {
    if (from.tops[i]! <= y) page = i;
    else break;
  }
  const fromH = from.heights[page]! || 1;
  const frac = (y - from.tops[page]!) / fromH;
  const target = (to.tops[page] ?? 0) + frac * (to.heights[page] ?? 0);
  return clampScroll(target, to, viewportHeight);
}
