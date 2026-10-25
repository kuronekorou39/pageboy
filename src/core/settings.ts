import { SORT_ORDERS, type SortOrder } from "./library";
import type { FolderMode } from "./types";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_FACTOR = 1.1;

export const INTERVAL_MIN_MS = 500;
export const INTERVAL_MAX_MS = 120_000;
export const INTERVAL_FACTOR = 1.2;

export const OVERLAP_MIN = 0;
export const OVERLAP_MAX = 0.6;

export interface FolderState {
  mode: FolderMode;
  lastPage: number;
}

/** page: ページごとに上から送り、末尾で次ページの先頭へ。strip: 全ページを縦につなげて連続スクロール */
export type ViewMode = "page" | "strip";

export interface Settings {
  version: 1;
  /** 自動再生で次のステップへ進むまでの時間 */
  intervalMs: number;
  /** 1 = 横幅フィット */
  zoom: number;
  /** ステップ同士の重なり(画面高さに対する割合) */
  overlap: number;
  viewMode: ViewMode;
  /** 作品の並び順(一覧と、次の作品 / 前の作品 の向き) */
  sortOrder: SortOrder;
  /** true ならライブラリ全体のページからランダムに進む(作品ごとの順番 / ランダムより優先) */
  libraryRandom: boolean;
  lastLibrary: string | null;
  lastWork: string | null;
  folders: Record<string, FolderState>;
  /** お気に入り。作品のパス → ページ番号(0 始まり、昇順) */
  favorites: Record<string, number[]>;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  intervalMs: 4000,
  zoom: 1,
  overlap: 0.15,
  viewMode: "page",
  sortOrder: "newest",
  libraryRandom: false,
  lastLibrary: null,
  lastWork: null,
  folders: {},
  favorites: {},
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function numberOr(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback;
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function parseFolders(v: unknown): Record<string, FolderState> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, FolderState> = {};
  for (const [path, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    out[path] = {
      mode: r.mode === "random" ? "random" : "sequential",
      lastPage: numberOr(r.lastPage, 0, 0, Number.MAX_SAFE_INTEGER),
    };
  }
  return out;
}

function parseFavorites(v: unknown): Record<string, number[]> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number[]> = {};
  for (const [path, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(raw)) continue;
    const pages = [...new Set(raw.filter((p): p is number => typeof p === "number" && Number.isInteger(p) && p >= 0))].sort((a, b) => a - b);
    if (pages.length > 0) out[path] = pages;
  }
  return out;
}

/** 設定ファイルの内容を読む。欠けた項目は既定値、範囲外は丸める、未知の項目は捨てる */
export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS, folders: {}, favorites: {} };
  const r = raw as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    version: 1,
    intervalMs: numberOr(r.intervalMs, d.intervalMs, INTERVAL_MIN_MS, INTERVAL_MAX_MS),
    zoom: numberOr(r.zoom, d.zoom, ZOOM_MIN, ZOOM_MAX),
    overlap: numberOr(r.overlap, d.overlap, OVERLAP_MIN, OVERLAP_MAX),
    viewMode: r.viewMode === "strip" ? "strip" : "page",
    sortOrder: SORT_ORDERS.includes(r.sortOrder as SortOrder) ? (r.sortOrder as SortOrder) : d.sortOrder,
    libraryRandom: r.libraryRandom === true,
    lastLibrary: stringOrNull(r.lastLibrary),
    lastWork: stringOrNull(r.lastWork),
    folders: parseFolders(r.folders),
    favorites: parseFavorites(r.favorites),
  };
}

export function zoomIn(zoom: number): number {
  return clamp(zoom * ZOOM_FACTOR, ZOOM_MIN, ZOOM_MAX);
}

export function zoomOut(zoom: number): number {
  return clamp(zoom / ZOOM_FACTOR, ZOOM_MIN, ZOOM_MAX);
}

/** 間隔を短くする(速くする) */
export function faster(intervalMs: number): number {
  return clamp(Math.round(intervalMs / INTERVAL_FACTOR), INTERVAL_MIN_MS, INTERVAL_MAX_MS);
}

/** 間隔を長くする(遅くする) */
export function slower(intervalMs: number): number {
  return clamp(Math.round(intervalMs * INTERVAL_FACTOR), INTERVAL_MIN_MS, INTERVAL_MAX_MS);
}

export function folderState(settings: Settings, path: string): FolderState {
  return settings.folders[path] ?? { mode: "sequential", lastPage: 0 };
}

export function toggleMode(mode: FolderMode): FolderMode {
  return mode === "sequential" ? "random" : "sequential";
}

export function toggleViewMode(mode: ViewMode): ViewMode {
  return mode === "page" ? "strip" : "page";
}

// ---- お気に入り ----

export function isFavorite(settings: Settings, path: string, page: number): boolean {
  return settings.favorites[path]?.includes(page) ?? false;
}

export function favoriteCount(settings: Settings, path: string): number {
  return settings.favorites[path]?.length ?? 0;
}

/** そのページのお気に入りを付け外しした新しい設定を返す。ページが 0 件になった作品は項目ごと消す */
export function toggleFavorite(settings: Settings, path: string, page: number): Settings {
  const pages = settings.favorites[path] ?? [];
  const next = pages.includes(page) ? pages.filter((p) => p !== page) : [...pages, page].sort((a, b) => a - b);
  const favorites = { ...settings.favorites };
  if (next.length === 0) delete favorites[path];
  else favorites[path] = next;
  return { ...settings, favorites };
}
