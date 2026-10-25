import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  INTERVAL_MAX_MS,
  INTERVAL_MIN_MS,
  ZOOM_MAX,
  faster,
  parseSettings,
  slower,
  zoomIn,
} from "../src/core/settings";

describe("parseSettings", () => {
  it("空や壊れた入力は既定値", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
  });

  it("欠けた項目は既定値で埋め、未知の項目は捨てる", () => {
    const s = parseSettings({ intervalMs: 2000, unknown: 1 });
    expect(s.intervalMs).toBe(2000);
    expect(s.zoom).toBe(DEFAULT_SETTINGS.zoom);
    expect("unknown" in s).toBe(false);
  });

  it("範囲外は丸める", () => {
    const s = parseSettings({ intervalMs: 1, zoom: 100 });
    expect(s.intervalMs).toBe(INTERVAL_MIN_MS);
    expect(s.zoom).toBe(ZOOM_MAX);
  });

  it("viewMode は page か strip だけ", () => {
    expect(parseSettings({ viewMode: "strip" }).viewMode).toBe("strip");
    expect(parseSettings({ viewMode: "weird" }).viewMode).toBe("page");
  });

  it("フォルダごとの設定を読む", () => {
    const s = parseSettings({ folders: { "/a": { mode: "random", lastPage: 3 }, "/b": { mode: "weird" }, "/c": 5 } });
    expect(s.folders["/a"]).toEqual({ mode: "random", lastPage: 3 });
    expect(s.folders["/b"]).toEqual({ mode: "sequential", lastPage: 0 });
    expect(s.folders["/c"]).toBeUndefined();
  });
});

describe("速度と拡大の操作", () => {
  it("faster / slower は範囲内に収まる", () => {
    expect(faster(INTERVAL_MIN_MS)).toBe(INTERVAL_MIN_MS);
    expect(slower(INTERVAL_MAX_MS)).toBe(INTERVAL_MAX_MS);
    expect(faster(4000)).toBeLessThan(4000);
    expect(slower(4000)).toBeGreaterThan(4000);
  });
  it("zoomIn は上限を超えない", () => {
    expect(zoomIn(ZOOM_MAX)).toBe(ZOOM_MAX);
  });
});
