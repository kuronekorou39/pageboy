import { describe, expect, it } from "vitest";
import { basename, buildLibrary, dateFromName, dirname, findWorkIndex, matchesQuery, naturalCompare, nextSortOrder, pageIndex, parseWorkName, sortWorks } from "../src/core/library";
import type { Work } from "../src/core/types";

describe("naturalCompare", () => {
  it("数字を数値として比べる", () => {
    expect(["_10.png", "_2.png", "_1.png"].sort(naturalCompare)).toEqual(["_1.png", "_2.png", "_10.png"]);
  });
});

describe("basename / dirname", () => {
  it("Windows と POSIX の区切りに対応", () => {
    expect(basename("C:\\a\\b\\c.png")).toBe("c.png");
    expect(basename("/a/b/c.png")).toBe("c.png");
    expect(dirname("C:\\a\\b\\c.png")).toBe("C:\\a\\b");
    expect(dirname("/a/b/c.png")).toBe("/a/b");
    expect(dirname("c.png")).toBe("");
  });
});

describe("parseWorkName", () => {
  const root = "D:\\manga";
  it("作者フォルダの中の作品は、親フォルダが作者", () => {
    expect(parseWorkName("D:\\manga\\作者A\\作品1", root)).toEqual({ author: "作者A", name: "作品1" });
  });
  it("[作者] 題名 の形なら角括弧の中が作者。親フォルダより優先", () => {
    expect(parseWorkName("D:\\manga\\[作者B] 作品3 (ジャンル)", root)).toEqual({ author: "作者B", name: "作品3 (ジャンル)" });
    expect(parseWorkName("D:\\manga\\作者A\\[サークルX] 作品4", root)).toEqual({ author: "サークルX", name: "作品4" });
  });
  it("ライブラリ直下の作品と root 自体は作者なし", () => {
    expect(parseWorkName("D:\\manga\\イラスト集", root)).toEqual({ author: null, name: "イラスト集" });
    expect(parseWorkName("D:\\manga", root)).toEqual({ author: null, name: "manga" });
    expect(parseWorkName("D:/manga/直下", "D:\\manga\\")).toEqual({ author: null, name: "直下" });
  });
  it("角括弧だけで題名がないフォルダ名はそのまま題名にする", () => {
    expect(parseWorkName("D:\\manga\\作者A\\[2026]", root)).toEqual({ author: "作者A", name: "[2026]" });
  });
});

describe("buildLibrary", () => {
  it("作品とページを自然順に並べ、作者を付ける", () => {
    const lib = buildLibrary({
      root: "/r",
      works: [
        { path: "/r/vol10", name: "vol10", modified: 1700000000, pages: ["/r/vol10/p3.png", "/r/vol10/p10.png", "/r/vol10/p1.png"] },
        { path: "/r/vol2", name: "vol2", modified: null, pages: [] },
        { path: "/r/作者/SubscribeStar_20261019_commission_本", name: "本", modified: 1, pages: [] },
      ],
    });
    expect(lib.works.map((w) => w.name)).toEqual(["vol2", "vol10", "SubscribeStar_20261019_commission_本"]);
    // 日付はフォルダ名 > 更新日時 > null
    expect(lib.works.map((w) => w.date)).toEqual([null, 1700000000 * 1000, new Date(2026, 9, 19).getTime()]);
    expect(lib.works.map((w) => w.author)).toEqual([null, null, "作者"]);
    expect(lib.works[1]!.pages).toEqual(["/r/vol10/p1.png", "/r/vol10/p3.png", "/r/vol10/p10.png"]);
    expect(findWorkIndex(lib, "/r/vol10")).toBe(1);
    expect(findWorkIndex(lib, null)).toBe(-1);
  });
});

describe("dateFromName", () => {
  it("20261019 / 2026-10-19 / 2026_10_19 を読む", () => {
    const t = new Date(2026, 9, 19).getTime();
    expect(dateFromName("SubscribeStar_20261019_commission_X")).toBe(t);
    expect(dateFromName("2026-10-19 題名")).toBe(t);
    expect(dateFromName("FANBOX_2026_10_19_題名")).toBe(t);
  });
  it("日付に見えない数字は読まない", () => {
    expect(dateFromName("vol10")).toBeNull();
    expect(dateFromName("12345678")).toBeNull();
    expect(dateFromName("20261345")).toBeNull();
  });
});

const w = (path: string, date: number | null, pages = 1): Work => ({ path, name: basename(path), author: null, date, pages: Array.from({ length: pages }, (_, i) => `${path}/${i}.png`) });

describe("sortWorks", () => {
  const works = [w("/r/b", 200), w("/r/a", 100), w("/r/c", null), w("/r/d", 200)];
  it("newest は日付の降順、同じ日付は名前順、日付なしは末尾", () => {
    expect(sortWorks(works, "newest").map((x) => x.path)).toEqual(["/r/b", "/r/d", "/r/a", "/r/c"]);
  });
  it("oldest は昇順、name はパス順。元の配列は変えない", () => {
    expect(sortWorks(works, "oldest").map((x) => x.path)).toEqual(["/r/a", "/r/b", "/r/d", "/r/c"]);
    expect(sortWorks(works, "name").map((x) => x.path)).toEqual(["/r/a", "/r/b", "/r/c", "/r/d"]);
    expect(works[0]!.path).toBe("/r/b");
  });
  it("nextSortOrder は 3 つを巡る", () => {
    expect(nextSortOrder("newest")).toBe("oldest");
    expect(nextSortOrder("name")).toBe("newest");
  });
});

describe("matchesQuery", () => {
  const work: Work = { path: "/r/x", name: "Lurantis／Ariados commission", author: "IKAGERIRA", date: null, pages: [] };
  it("作者名と題名を、空白区切りの AND で、大文字小文字を区別せずに探す", () => {
    expect(matchesQuery(work, "")).toBe(true);
    expect(matchesQuery(work, "lurantis")).toBe(true);
    expect(matchesQuery(work, "ikagerira ariados")).toBe(true);
    expect(matchesQuery(work, "ikagerira dialga")).toBe(false);
  });
});

describe("pageIndex", () => {
  const idx = pageIndex({ root: "/r", works: [w("/r/a", null, 3), w("/r/b", null, 1), w("/r/c", null, 2)] });
  it("全ページを通し番号にし、往復できる", () => {
    expect(idx.total).toBe(6);
    expect(idx.locate(0)).toEqual({ work: 0, page: 0, step: 0 });
    expect(idx.locate(2)).toEqual({ work: 0, page: 2, step: 0 });
    expect(idx.locate(3)).toEqual({ work: 1, page: 0, step: 0 });
    expect(idx.locate(5)).toEqual({ work: 2, page: 1, step: 0 });
    expect(idx.indexOf({ work: 2, page: 1, step: 7 })).toBe(5);
  });
});
