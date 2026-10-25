import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { SORT_LABELS, SORT_ORDERS, matchesQuery, type SortOrder } from "../core/library";
import type { Work } from "../core/types";

interface Props {
  /** 表示順に並んだ作品 */
  works: Work[];
  /** いま読んでいる作品(works の添字)。なければ -1 */
  currentIndex: number;
  sortOrder: SortOrder;
  favorites: Record<string, number[]>;
  onSelect: (index: number) => void;
  onSortChange: (order: SortOrder) => void;
  onClose: () => void;
}

const PAGE_JUMP = 10;

function formatDate(t: number | null): string {
  if (t === null) return "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 作品一覧。文字で絞り込み、並び順を選び、↑↓ と Enter(またはクリック)で開く。
 * 開いているあいだのキー入力はここで消費し、ビューアの 1 キー操作には渡さない。
 */
export function LibraryList({ works, currentIndex, sortOrder, favorites, onSelect, onSortChange, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo(
    () =>
      works
        .map((work, index) => ({ work, index }))
        .filter(({ work }) => matchesQuery(work, query) && (!favOnly || (favorites[work.path]?.length ?? 0) > 0)),
    [works, query, favOnly, favorites],
  );

  const [cursor, setCursor] = useState(() => Math.max(0, rows.findIndex((r) => r.index === currentIndex)));

  // 絞り込みが変わったら、いまの作品が残っていればそこ、なければ先頭へ
  useEffect(() => {
    const i = rows.findIndex((r) => r.index === currentIndex);
    setCursor(i >= 0 ? i : 0);
  }, [rows, currentIndex]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const move = (delta: number) => setCursor((c) => Math.min(Math.max(0, c + delta), Math.max(0, rows.length - 1)));

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowDown":
        move(1);
        break;
      case "ArrowUp":
        move(-1);
        break;
      case "PageDown":
        move(PAGE_JUMP);
        break;
      case "PageUp":
        move(-PAGE_JUMP);
        break;
      case "Home":
        setCursor(0);
        break;
      case "End":
        setCursor(Math.max(0, rows.length - 1));
        break;
      case "Enter": {
        const r = rows[cursor];
        if (r) onSelect(r.index);
        break;
      }
      default:
        return; // 文字入力は input に任せる
    }
    e.preventDefault();
  };

  const favTotal = Object.keys(favorites).length;

  return (
    <div
      class="list"
      onKeyDown={onKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div class="list-panel" onClick={(e) => e.stopPropagation()}>
        <div class="list-head">
          <input
            ref={inputRef}
            type="text"
            placeholder="作者名・題名で絞り込み(空白区切りで AND)"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          <select value={sortOrder} onChange={(e) => onSortChange((e.target as HTMLSelectElement).value as SortOrder)}>
            {SORT_ORDERS.map((o) => (
              <option key={o} value={o}>
                {SORT_LABELS[o]}
              </option>
            ))}
          </select>
          <label class={`fav-filter ${favTotal === 0 ? "disabled" : ""}`}>
            <input type="checkbox" checked={favOnly} disabled={favTotal === 0} onChange={(e) => setFavOnly((e.target as HTMLInputElement).checked)} />
            ♥ のみ
          </label>
          <span class="count">
            {rows.length} / {works.length} 作品
          </span>
          <button class="close" onClick={onClose} title="閉じる (Esc)">
            ×
          </button>
        </div>
        <ul class="list-body" ref={listRef}>
          {rows.map((r, i) => {
            const favs = favorites[r.work.path]?.length ?? 0;
            return (
              <li
                key={r.work.path}
                class={`${i === cursor ? "cursor" : ""} ${r.index === currentIndex ? "current" : ""}`}
                onClick={() => onSelect(r.index)}
                onMouseMove={() => setCursor(i)}
              >
                <span class="date">{formatDate(r.work.date)}</span>
                <span class="author">{r.work.author ?? ""}</span>
                <span class="title">{r.work.name}</span>
                <span class="pages">{r.work.pages.length}p</span>
                <span class="favs">{favs > 0 ? `♥${favs}` : ""}</span>
              </li>
            );
          })}
          {rows.length === 0 && <li class="none">該当する作品がありません</li>}
        </ul>
        <div class="list-foot">↑↓ 選ぶ　Enter 開く　Esc 閉じる　　読んでいる位置から続きます。先頭から読むには開いてから Home</div>
      </div>
    </div>
  );
}
