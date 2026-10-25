export type Action =
  | "toggle-play"
  | "forward"
  | "backward"
  | "next-page"
  | "prev-page"
  | "next-work"
  | "prev-work"
  | "first-page"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | "faster"
  | "slower"
  | "pan-left"
  | "pan-right"
  | "toggle-mode"
  | "toggle-view"
  | "toggle-fullscreen"
  | "open-library"
  | "toggle-help";

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface KeyBinding {
  action: Action;
  /** KeyboardEvent.key の値。1 文字のキーは小文字で書く */
  codes: string[];
  /** Help 画面での表示。codes と同じ順に並べる */
  keys: string[];
  label: string;
}

/**
 * キー割り当てはここ 1 箇所。actionForKey も Help 画面もこの表から作る。
 * すべて 1 キーで操作できるようにする(修飾キーの組み合わせは使わない)。
 */
export const KEY_BINDINGS: KeyBinding[] = [
  { action: "toggle-play", codes: [" "], keys: ["Space"], label: "自動再生 / 一時停止" },
  {
    action: "forward",
    codes: ["ArrowDown", "ArrowRight", "j", "Enter", "PageDown"],
    keys: ["↓", "→", "J", "Enter", "PageDown"],
    label: "進む",
  },
  {
    action: "backward",
    codes: ["ArrowUp", "ArrowLeft", "k", "Backspace", "PageUp"],
    keys: ["↑", "←", "K", "Backspace", "PageUp"],
    label: "戻る",
  },
  { action: "next-page", codes: [".", "l"], keys: [".", "L"], label: "次のページ" },
  { action: "prev-page", codes: [",", "i"], keys: [",", "I"], label: "前のページ" },
  { action: "next-work", codes: ["n"], keys: ["N"], label: "次の作品" },
  { action: "prev-work", codes: ["p"], keys: ["P"], label: "前の作品" },
  { action: "first-page", codes: ["Home"], keys: ["Home"], label: "作品の先頭へ" },
  { action: "faster", codes: ["]", "+"], keys: ["]", "+"], label: "速くする" },
  { action: "slower", codes: ["[", "-"], keys: ["[", "-"], label: "遅くする" },
  { action: "zoom-in", codes: ["z"], keys: ["Z"], label: "拡大" },
  { action: "zoom-out", codes: ["x"], keys: ["X"], label: "縮小" },
  { action: "zoom-reset", codes: ["0"], keys: ["0"], label: "横幅フィットに戻す" },
  { action: "pan-left", codes: ["a"], keys: ["A"], label: "左へずらす(拡大中)" },
  { action: "pan-right", codes: ["d"], keys: ["D"], label: "右へずらす(拡大中)" },
  { action: "toggle-view", codes: ["v"], keys: ["V"], label: "ページ送り / 連続スクロール 切替" },
  { action: "toggle-mode", codes: ["m"], keys: ["M"], label: "この作品を 順番 / ランダム 切替" },
  { action: "toggle-fullscreen", codes: ["f", "F11"], keys: ["F", "F11"], label: "全画面" },
  { action: "open-library", codes: ["o"], keys: ["O"], label: "フォルダを開く" },
  { action: "toggle-help", codes: ["h", "?", "Escape"], keys: ["H", "?", "Esc"], label: "操作一覧を開く / 閉じる" },
];

const ACTION_BY_CODE: ReadonlyMap<string, Action> = new Map(
  KEY_BINDINGS.flatMap((b) => b.codes.map((c) => [c, b.action] as const)),
);

export function actionForKey(e: KeyInput): Action | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  // Shift は記号の入力(+ や ? など)にだけ使う。矢印などとの組み合わせは割り当てない
  if (e.shiftKey && e.key.length !== 1) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return ACTION_BY_CODE.get(key) ?? null;
}
