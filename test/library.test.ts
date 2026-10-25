import { describe, expect, it } from "vitest";
import { basename, buildLibrary, dirname, findWorkIndex, naturalCompare, parseWorkName } from "../src/core/library";

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
        { path: "/r/vol10", name: "vol10", pages: ["/r/vol10/p3.png", "/r/vol10/p10.png", "/r/vol10/p1.png"] },
        { path: "/r/vol2", name: "vol2", pages: [] },
        { path: "/r/作者/本", name: "本", pages: [] },
      ],
    });
    expect(lib.works.map((w) => w.name)).toEqual(["vol2", "vol10", "本"]);
    expect(lib.works.map((w) => w.author)).toEqual([null, null, "作者"]);
    expect(lib.works[1]!.pages).toEqual(["/r/vol10/p1.png", "/r/vol10/p3.png", "/r/vol10/p10.png"]);
    expect(findWorkIndex(lib, "/r/vol10")).toBe(1);
    expect(findWorkIndex(lib, null)).toBe(-1);
  });
});
