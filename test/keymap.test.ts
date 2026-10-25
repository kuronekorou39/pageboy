import { describe, expect, it } from "vitest";
import { KEY_BINDINGS, actionForKey, type KeyInput } from "../src/core/keymap";

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

describe("actionForKey", () => {
  it("基本操作", () => {
    expect(actionForKey(key(" "))).toBe("toggle-play");
    expect(actionForKey(key("ArrowDown"))).toBe("forward");
    expect(actionForKey(key("J"))).toBe("forward");
    expect(actionForKey(key("ArrowUp"))).toBe("backward");
    expect(actionForKey(key("."))).toBe("next-page");
    expect(actionForKey(key(","))).toBe("prev-page");
    expect(actionForKey(key("v"))).toBe("toggle-view");
    expect(actionForKey(key("Escape"))).toBe("toggle-help");
  });
  it("Ctrl / Alt の組み合わせは使わない", () => {
    expect(actionForKey(key("ArrowUp", { ctrlKey: true }))).toBeNull();
    expect(actionForKey(key("o", { ctrlKey: true }))).toBeNull();
    expect(actionForKey(key("j", { altKey: true }))).toBeNull();
  });
  it("Shift は記号の入力にだけ使う", () => {
    expect(actionForKey(key("+", { shiftKey: true }))).toBe("faster");
    expect(actionForKey(key("?", { shiftKey: true }))).toBe("toggle-help");
    expect(actionForKey(key("ArrowDown", { shiftKey: true }))).toBeNull();
  });
  it("割り当てのないキーは null", () => {
    expect(actionForKey(key("q"))).toBeNull();
  });
  it("表のすべてのキーがその操作に届く", () => {
    for (const b of KEY_BINDINGS) {
      expect(b.codes.length, b.action).toBe(b.keys.length);
      for (const c of b.codes) expect(actionForKey(key(c)), `${b.action}: ${c}`).toBe(b.action);
    }
  });
  it("同じキーが 2 つの操作に割り当てられていない", () => {
    const all = KEY_BINDINGS.flatMap((b) => b.codes);
    expect(new Set(all).size).toBe(all.length);
  });
});
