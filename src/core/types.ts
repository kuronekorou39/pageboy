/** 作品ごとの進み方。sequential はページ順、random は同じ作品内をランダムに巡る */
export type FolderMode = "sequential" | "random";

/**
 * 1 フォルダ = 1 作品。pages は表示順に並んだ画像ファイルの絶対パス。
 * name は表示用の題名(フォルダ名から先頭の [作者] を除いたもの)。
 * author はフォルダ名の [作者]、なければ親フォルダ名。ライブラリ直下の作品は null
 */
export interface Work {
  path: string;
  name: string;
  author: string | null;
  pages: string[];
}

/** Rust の scan_library が返す形。author は TS 側で付ける */
export interface RawLibrary {
  root: string;
  works: { path: string; name: string; pages: string[] }[];
}

export interface Library {
  root: string;
  works: Work[];
}

export interface Size {
  width: number;
  height: number;
}

/**
 * 読んでいる位置。
 * step は Infinity で「そのページの最後のステップ」を表す(画像を読む前はステップ数が分からないため)。
 */
export interface Cursor {
  work: number;
  page: number;
  step: number;
}
