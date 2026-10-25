import { useEffect, useState } from "preact/hooks";
import { visiblePages, type StripLayout } from "../core/strip";
import type { Size } from "../core/types";
import type { ImageCache } from "./imageCache";

interface Props {
  pages: string[];
  layout: StripLayout;
  scrollY: number;
  viewport: Size;
  panX: number;
  cache: ImageCache;
}

/** 連続モード。画面の前後 1 画面ぶんにかかるページだけ <img> を置く */
export function StripViewer({ pages, layout, scrollY, viewport, panX, cache }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const visible = visiblePages(layout, scrollY, viewport.height, viewport.height);
  const visibleKey = visible.join(",");

  useEffect(() => {
    let alive = true;
    for (const i of visible) {
      const path = pages[i];
      if (!path) continue;
      // キャッシュから追い出された画像は URL が変わるので、見えるたびに取り直す
      cache.get(path).then(
        (img) => {
          if (!alive) return;
          setUrls((u) => (u[path] === img.url ? u : { ...u, [path]: img.url }));
        },
        () => {},
      );
    }
    return () => {
      alive = false;
    };
    // visible の中身が変わったときだけ走らせる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, pages, cache]);

  return (
    <div class="strip" style={{ transform: `translateY(${-scrollY}px)` }}>
      {visible.map((i) => {
        const path = pages[i]!;
        const w = layout.widths[i]!;
        const left = w <= viewport.width ? (viewport.width - w) / 2 : -(w - viewport.width) * panX;
        const url = urls[path];
        return (
          <div
            key={path}
            class="strip-page"
            style={{ top: `${layout.tops[i]}px`, left: `${left}px`, width: `${w}px`, height: `${layout.heights[i]}px` }}
          >
            {url && <img src={url} draggable={false} />}
          </div>
        );
      })}
    </div>
  );
}
