import { describe, expect, it } from "vitest";
import { basename, buildLibrary, findWorkIndex, naturalCompare } from "../src/core/library";

describe("naturalCompare", () => {
  it("数字を数値として比べる", () => {
    expect(["_10.png", "_2.png", "_1.png"].sort(naturalCompare)).toEqual(["_1.png", "_2.png", "_10.png"]);
  });
});

describe("basename", () => {
  it("Windows と POSIX の区切りに対応", () => {
    expect(basename("C:\\a\\b\\c.png")).toBe("c.png");
    expect(basename("/a/b/c.png")).toBe("c.png");
  });
});

describe("buildLibrary", () => {
  it("作品とページを自然順に並べる", () => {
    const lib = buildLibrary({
      root: "/r",
      works: [
        { path: "/r/vol10", name: "vol10", pages: ["/r/vol10/p3.png", "/r/vol10/p10.png", "/r/vol10/p1.png"] },
        { path: "/r/vol2", name: "vol2", pages: [] },
      ],
    });
    expect(lib.works.map((w) => w.name)).toEqual(["vol2", "vol10"]);
    expect(lib.works[1]!.pages).toEqual(["/r/vol10/p1.png", "/r/vol10/p3.png", "/r/vol10/p10.png"]);
    expect(findWorkIndex(lib, "/r/vol10")).toBe(1);
    expect(findWorkIndex(lib, null)).toBe(-1);
  });
});
