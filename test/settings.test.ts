import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  INTERVAL_MAX_MS,
  INTERVAL_MIN_MS,
  ZOOM_MAX,
  faster,
  favoriteCount,
  isFavorite,
  parseSettings,
  slower,
  toggleFavorite,
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

describe("並び順・全体ランダム・お気に入りの読み込み", () => {
  it("sortOrder は 3 つの値だけ、libraryRandom は true のときだけ", () => {
    expect(parseSettings({ sortOrder: "oldest" }).sortOrder).toBe("oldest");
    expect(parseSettings({ sortOrder: "weird" }).sortOrder).toBe(DEFAULT_SETTINGS.sortOrder);
    expect(parseSettings({ libraryRandom: true }).libraryRandom).toBe(true);
    expect(parseSettings({ libraryRandom: "yes" }).libraryRandom).toBe(false);
  });
  it("favorites は整数のページ番号だけ、重複は除いて昇順、空の作品は捨てる", () => {
    const s = parseSettings({ favorites: { "/a": [3, 1, 3, -1, 2.5, "x"], "/b": [], "/c": "no" } });
    expect(s.favorites).toEqual({ "/a": [1, 3] });
  });
});

describe("toggleFavorite", () => {
  it("付けて、外すと項目ごと消える", () => {
    let s = toggleFavorite(DEFAULT_SETTINGS, "/a", 2);
    expect(isFavorite(s, "/a", 2)).toBe(true);
    expect(favoriteCount(s, "/a")).toBe(1);
    s = toggleFavorite(s, "/a", 0);
    expect(s.favorites["/a"]).toEqual([0, 2]);
    s = toggleFavorite(toggleFavorite(s, "/a", 0), "/a", 2);
    expect(s.favorites["/a"]).toBeUndefined();
    expect(DEFAULT_SETTINGS.favorites).toEqual({}); // 元の設定は変えない
  });
});
