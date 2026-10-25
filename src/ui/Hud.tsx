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
  viewMode: ViewMode;
  message: string | null;
  onHelp: () => void;
}

export function Hud(p: Props) {
  return (
    <>
      <div class={`dot ${p.playing ? "playing" : ""}`} title={p.playing ? "自動再生中" : "停止中"} />
      <button
        class={`help-button ${p.visible ? "visible" : ""}`}
        title="操作一覧 (H)"
        onClick={(e) => {
          e.stopPropagation();
          p.onHelp();
        }}
      >
        ?
      </button>
      <div class={`hud ${p.visible ? "visible" : ""}`}>
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
        <span>{p.mode === "random" ? "🔀 ランダム" : "→ 順番"}</span>
      </div>
    </>
  );
}
