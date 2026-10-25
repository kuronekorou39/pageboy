import { describe, expect, it } from "vitest";
import {
  clampScroll,
  layoutStrip,
  maxScroll,
  pageAtScroll,
  rescaleScroll,
  scrollBackward,
  scrollForPage,
  scrollForward,
  visiblePages,
} from "../src/core/strip";

const page = { width: 4488, height: 6260 };
const sizes = [page, page, page];
const V = 1080;
const strip = layoutStrip(sizes, 1920, 1, 16); // 1 ページ 2678px

describe("layoutStrip", () => {
  it("ページを縦に並べ、間に gap を空ける", () => {
    expect(strip.tops[0]).toBe(0);
    expect(strip.tops[1]).toBeCloseTo(strip.heights[0]! + 16);
    expect(strip.total).toBeCloseTo(strip.heights[0]! * 3 + 32);
  });
  it("ページが無ければ高さ 0", () => {
    expect(layoutStrip([], 1920, 1, 16).total).toBe(0);
  });
});

describe("スクロール", () => {
  it("forward は 1 画面(重なりを除く)進み、末尾で止まって次は null", () => {
    const y1 = scrollForward(0, strip, V, 0.15)!;
    expect(y1).toBeCloseTo(V * 0.85);
    const max = maxScroll(strip, V);
    expect(scrollForward(max - 10, strip, V, 0.15)).toBe(max);
    expect(scrollForward(max, strip, V, 0.15)).toBeNull();
  });
  it("backward は先頭で null", () => {
    expect(scrollBackward(0, V, 0.15)).toBeNull();
    expect(scrollBackward(100, V, 0.15)).toBe(0);
  });
  it("clampScroll は Infinity を末尾にする", () => {
    expect(clampScroll(Number.POSITIVE_INFINITY, strip, V)).toBe(maxScroll(strip, V));
    expect(clampScroll(-5, strip, V)).toBe(0);
  });
});

describe("ページとの対応", () => {
  it("画面中央にかかるページを返す", () => {
    expect(pageAtScroll(strip, 0, V)).toBe(0);
    expect(pageAtScroll(strip, strip.tops[1]!, V)).toBe(1);
    expect(pageAtScroll(strip, strip.tops[1]! - V / 2 - 1, V)).toBe(0);
  });
  it("scrollForPage はページ上端。範囲外のページ番号は端に丸める", () => {
    expect(scrollForPage(strip, 1, V)).toBe(strip.tops[1]);
    expect(scrollForPage(strip, 99, V)).toBe(strip.tops[2]);
    expect(scrollForPage(strip, -1, V)).toBe(0);
  });
  it("最後のページが画面より低ければ、その上端は末尾に丸められる", () => {
    const short = layoutStrip([page, { width: 4488, height: 1000 }], 1920, 1, 16);
    expect(scrollForPage(short, 1, V)).toBe(maxScroll(short, V));
  });
  it("visiblePages は画面にかかるページだけ", () => {
    expect(visiblePages(strip, 0, V, 0)).toEqual([0]);
    expect(visiblePages(strip, strip.tops[1]! - 100, V, 0)).toEqual([0, 1]);
  });
});

describe("rescaleScroll", () => {
  it("拡大してもページ内の相対位置を保つ", () => {
    const zoomed = layoutStrip(sizes, 1920, 2, 16);
    const y = strip.tops[1]! + strip.heights[1]! * 0.5;
    const y2 = rescaleScroll(strip, zoomed, y, V);
    expect(y2).toBeCloseTo(zoomed.tops[1]! + zoomed.heights[1]! * 0.5);
  });
});
