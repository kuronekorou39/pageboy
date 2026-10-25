import { describe, expect, it } from "vitest";
import { clampStep, layoutSteps } from "../src/core/steps";

const page = { width: 4488, height: 6260 }; // B5 比率のページ
const screen = { width: 1920, height: 1080 };

describe("layoutSteps", () => {
  it("B5 比率のページを 16:9 で横幅フィットすると 3 ステップになる", () => {
    const l = layoutSteps(page, screen, 1, 0.15);
    expect(l.drawWidth).toBeCloseTo(1920);
    expect(l.offsets).toHaveLength(3);
    expect(l.offsets[0]).toBe(0);
    expect(l.offsets.at(-1)).toBeCloseTo(l.drawHeight - screen.height);
  });

  it("画面に収まるなら 1 ステップ", () => {
    const l = layoutSteps({ width: 1000, height: 500 }, screen, 1, 0.15);
    expect(l.offsets).toEqual([0]);
  });

  it("ステップは等間隔で、移動量は重なりを除いた画面高さ以下", () => {
    const l = layoutSteps(page, screen, 1, 0.15);
    const diffs = l.offsets.slice(1).map((o, i) => o - l.offsets[i]!);
    for (const d of diffs) {
      expect(d).toBeCloseTo(diffs[0]!);
      expect(d).toBeLessThanOrEqual(screen.height * 0.85 + 1e-6);
    }
  });

  it("拡大するとステップが増える", () => {
    const a = layoutSteps(page, screen, 1, 0.15).offsets.length;
    const b = layoutSteps(page, screen, 2, 0.15).offsets.length;
    expect(b).toBeGreaterThan(a);
  });

  it("縮小して全体が収まれば 1 ステップに戻る", () => {
    const l = layoutSteps(page, screen, 0.35, 0.15);
    expect(l.offsets).toEqual([0]);
  });
});

describe("clampStep", () => {
  it("Infinity は最後のステップ", () => {
    expect(clampStep(Number.POSITIVE_INFINITY, 3)).toBe(2);
  });
  it("範囲外は端に丸める", () => {
    expect(clampStep(-1, 3)).toBe(0);
    expect(clampStep(7, 3)).toBe(2);
    expect(clampStep(1, 3)).toBe(1);
  });
});
