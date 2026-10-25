import type { ViewMode } from "../core/settings";
import type { FolderMode } from "../core/types";

interface Props {
  visible: boolean;
  workName: string;
  author: string | null;
  page: number;
  pageCount: number;
  /** ページ内の位置。ページ送りなら「2 / 3」、連続なら「42%」 */
  position: string;
  playing: boolean;
  intervalMs: number;
  zoom: number;
  mode: FolderMode;
  /** true ならライブラリ全体からランダムに進んでいる(mode より優先) */
  libraryRandom: boolean;
  viewMode: ViewMode;
  /** いま見ているページがお気に入りか */
  favorite: boolean;
  /** この作品のお気に入りページ数 */
  favoriteCount: number;
  sortLabel: string;
  message: string | null;
  onHelp: () => void;
  onList: () => void;
}

export function Hud(p: Props) {
  const order = p.libraryRandom ? "🔀 全体ランダム" : p.mode === "random" ? "🔀 ランダム" : `→ 順番(${p.sortLabel})`;
  return (
    <>
      <div class={`dot ${p.playing ? "playing" : ""}`} title={p.playing ? "自動再生中" : "停止中"} />
      <div class={`corner ${p.visible ? "visible" : ""}`}>
        <button
          class="corner-button"
          title="作品一覧 (G)"
          onClick={(e) => {
            e.stopPropagation();
            p.onList();
          }}
        >
          ≡
        </button>
        <button
          class="corner-button"
          title="操作一覧 (H)"
          onClick={(e) => {
            e.stopPropagation();
            p.onHelp();
          }}
        >
          ?
        </button>
      </div>
      <div class={`hud ${p.visible ? "visible" : ""}`}>
        <span class={`heart ${p.favorite ? "on" : ""}`} title={p.favorite ? "お気に入り (S で外す)" : "S でお気に入りに"}>
          {p.favorite ? "♥" : "♡"}
          {p.favoriteCount > 0 && <small>{p.favoriteCount}</small>}
        </span>
        <span class="name">
          {p.author && <span class="author">{p.author} / </span>}
          {p.workName}
        </span>
        {p.message && <span class="msg">{p.message}</span>}
        <span>{p.page + 1} / {p.pageCount}</span>
        <span>▾ {p.position}</span>
        <span>{p.playing ? "▶" : "❚❚"} {(p.intervalMs / 1000).toFixed(1)}s</span>
        <span>×{p.zoom.toFixed(2)}</span>
        <span>{p.viewMode === "strip" ? "⇣ 連続" : "⇩ ページ"}</span>
        <span>{order}</span>
        <span class="hint">G 一覧 / H 操作</span>
      </div>
    </>
  );
}
