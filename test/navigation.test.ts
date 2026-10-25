import { describe, expect, it } from "vitest";
import { backward, forward, nextPage, nextWork, prevPage, prevWork, type NavContext } from "../src/core/navigation";
import type { Cursor, FolderMode, Library } from "../src/core/types";

const library: Library = {
  root: "/lib",
  works: [
    { path: "/lib/a", name: "a", author: null, pages: ["/lib/a/1.png", "/lib/a/2.png", "/lib/a/3.png"] },
    { path: "/lib/b", name: "b", author: null, pages: ["/lib/b/1.png", "/lib/b/2.png"] },
  ],
};

function ctx(modes: Record<string, FolderMode> = {}, randomPage = () => 1): NavContext {
  return {
    library,
    modeOf: (w) => modes[w.path] ?? "sequential",
    randomPage,
  };
}

const at = (work: number, page: number, step: number): Cursor => ({ work, page, step });

describe("forward(順番)", () => {
  it("ステップが残っていれば次のステップ", () => {
    expect(forward(ctx(), at(0, 0, 0), 3)).toEqual(at(0, 0, 1));
  });
  it("最後のステップなら次ページの先頭", () => {
    expect(forward(ctx(), at(0, 0, 2), 3)).toEqual(at(0, 1, 0));
  });
  it("作品の最後のページなら次の作品の先頭", () => {
    expect(forward(ctx(), at(0, 2, 0), 1)).toEqual(at(1, 0, 0));
  });
  it("ライブラリの終端では null", () => {
    expect(forward(ctx(), at(1, 1, 0), 1)).toBeNull();
  });
});

describe("forward(ランダム)", () => {
  it("ページを使い切ったら同じ作品内のランダムなページへ", () => {
    const c = ctx({ "/lib/a": "random" }, () => 2);
    expect(forward(c, at(0, 0, 1), 2)).toEqual(at(0, 2, 0));
  });
  it("ステップ内では順番と同じ", () => {
    const c = ctx({ "/lib/a": "random" }, () => 2);
    expect(forward(c, at(0, 0, 0), 2)).toEqual(at(0, 0, 1));
  });
});

describe("backward", () => {
  it("前のステップ", () => {
    expect(backward(ctx(), at(0, 1, 2))).toEqual(at(0, 1, 1));
  });
  it("ステップ 0 なら前ページの最後のステップ(Infinity)", () => {
    expect(backward(ctx(), at(0, 1, 0))).toEqual(at(0, 0, Number.POSITIVE_INFINITY));
  });
  it("作品の先頭なら前の作品の最後のページ", () => {
    expect(backward(ctx(), at(1, 0, 0))).toEqual(at(0, 2, Number.POSITIVE_INFINITY));
  });
  it("ライブラリの先頭では null", () => {
    expect(backward(ctx(), at(0, 0, 0))).toBeNull();
  });
  it("ランダムモードのステップ 0 は null(履歴で戻る)", () => {
    expect(backward(ctx({ "/lib/a": "random" }), at(0, 1, 0))).toBeNull();
  });
});

describe("ページ・作品単位の移動", () => {
  it("nextPage は作品末尾で次の作品へ", () => {
    expect(nextPage(ctx(), at(0, 2, 1))).toEqual(at(1, 0, 0));
    expect(nextPage(ctx(), at(1, 1, 0))).toBeNull();
  });
  it("prevPage は作品先頭で前の作品の先頭へ", () => {
    expect(prevPage(ctx(), at(1, 0, 0))).toEqual(at(0, 0, 0));
  });
  it("nextWork / prevWork", () => {
    expect(nextWork(ctx(), at(0, 1, 1))).toEqual(at(1, 0, 0));
    expect(prevWork(ctx(), at(1, 1, 1))).toEqual(at(0, 0, 0));
    expect(prevWork(ctx(), at(0, 0, 0))).toBeNull();
  });
});
