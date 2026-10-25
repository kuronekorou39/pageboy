import { describe, expect, it } from "vitest";
import { ShuffleBag } from "../src/core/random";

/** テストを決定的にするための線形合同法 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("ShuffleBag", () => {
  it("1 周のあいだ同じ値を出さない", () => {
    const bag = new ShuffleBag(5, lcg(1));
    const seen = new Set(Array.from({ length: 5 }, () => bag.next()));
    expect(seen.size).toBe(5);
  });

  it("詰め直しの直後に直前の値を繰り返さない", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const bag = new ShuffleBag(4, lcg(seed));
      let prev = -1;
      for (let i = 0; i < 40; i++) {
        const v = bag.next(prev);
        expect(v).not.toBe(prev);
        prev = v;
      }
    }
  });

  it("要素が 1 つなら常に 0", () => {
    const bag = new ShuffleBag(1);
    expect(bag.next(0)).toBe(0);
  });
});
