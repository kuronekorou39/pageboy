import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { actionForKey, type Action } from "../core/keymap";
import { buildLibrary, findWorkIndex } from "../core/library";
import {
  backward,
  firstPage,
  forward,
  nextPage,
  nextWork,
  prevPage,
  prevWork,
  type NavContext,
} from "../core/navigation";
import { ShuffleBag } from "../core/random";
import {
  DEFAULT_SETTINGS,
  faster,
  folderState,
  parseSettings,
  slower,
  toggleMode,
  toggleViewMode,
  zoomIn,
  zoomOut,
  type Settings,
} from "../core/settings";
import { clampStep, layoutSteps } from "../core/steps";
import {
  clampScroll,
  layoutStrip,
  maxScroll,
  pageAtScroll,
  rescaleScroll,
  scrollBackward,
  scrollForPage,
  scrollForward,
  type StripLayout,
} from "../core/strip";
import type { Cursor, Library, Size, Work } from "../core/types";
import { backend, type AppInfo } from "./backend";
import { Help } from "./Help";
import { Hud } from "./Hud";
import { ImageCache, type LoadedImage } from "./imageCache";
import { StripViewer } from "./StripViewer";
import { Viewer } from "./Viewer";

const HUD_VISIBLE_MS = 2500;
const PRELOAD_AHEAD = 2;
const WHEEL_THROTTLE_MS = 250;
const SAVE_DEBOUNCE_MS = 400;
const PAN_STEP = 0.1;
const HISTORY_MAX = 200;
/** 連続モードでページの間に空ける黒い帯(画面 px) */
const STRIP_GAP_PX = 16;
/** 縦横が読めない画像があったときの仮の大きさ(B5 比率) */
const FALLBACK_PAGE_SIZE: Size = { width: 1000, height: 1400 };
const LAST = Number.POSITIVE_INFINITY;

function viewportSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [viewport, setViewport] = useState<Size>(viewportSize);
  const [playing, setPlaying] = useState(false);
  const [panX, setPanX] = useState(0.5);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  /** 連続モード用。作品パス → 各ページの縦横 */
  const [sizes, setSizes] = useState<Record<string, Size[]>>({});
  /** 連続モードのスクロール位置。Infinity は末尾 */
  const [stripY, setStripY] = useState(0);

  const cache = useRef(new ImageCache(backend.readImage, 12));
  const bags = useRef(new Map<string, ShuffleBag>());
  const history = useRef<Cursor[]>([]);
  const hudTimer = useRef<number | undefined>(undefined);
  const lastWheel = useRef(0);
  const lastShownStep = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  const work: Work | null = library && cursor ? (library.works[cursor.work] ?? null) : null;
  const mode = work ? folderState(settings, work.path).mode : "sequential";
  // 連続モードは順番モードの作品にだけ使う。ランダムはページ単位で動かす
  const stripActive = settings.viewMode === "strip" && mode === "sequential" && work !== null;

  // ---- ページモードのレイアウト ----
  const pagePath = work && cursor ? (work.pages[cursor.page] ?? null) : null;
  const ready = image !== null && image.path === pagePath;
  const layout = useMemo(
    () => (image ? layoutSteps(image.size, viewport, settings.zoom, settings.overlap) : null),
    [image, viewport, settings.zoom, settings.overlap],
  );
  const stepCount = layout?.offsets.length ?? 1;
  const step = cursor ? clampStep(cursor.step, stepCount) : 0;
  // 次のページを読み込んでいるあいだは、前のページを前の位置のまま見せておく
  const shownStep = ready ? step : lastShownStep.current;
  if (ready) lastShownStep.current = step;

  // ---- 連続モードのレイアウト ----
  const workSizes = work ? sizes[work.path] : undefined;
  const stripLayout: StripLayout | null = useMemo(
    () => (stripActive && workSizes ? layoutStrip(workSizes, viewport.width, settings.zoom, STRIP_GAP_PX) : null),
    [stripActive, workSizes, viewport.width, settings.zoom],
  );
  const stripYc = stripLayout ? clampScroll(stripY, stripLayout, viewport.height) : 0;
  const stripPage = stripLayout ? pageAtScroll(stripLayout, stripYc, viewport.height) : 0;
  /** HUD と「最後に読んだページ」の保存に使う、今見ているページ */
  const displayPage = stripActive && stripLayout ? stripPage : (cursor?.page ?? 0);

  const touchHud = useCallback(() => {
    setHudVisible(true);
    window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => {
      setHudVisible(false);
      setMessage(null); // 通知は HUD と一緒に消す
    }, HUD_VISIBLE_MS);
  }, []);

  const notify = useCallback(
    (text: string) => {
      setMessage(text);
      touchHud();
    },
    [touchHud],
  );

  const folders = settings.folders;
  const nav: NavContext | null = useMemo(
    () =>
      library
        ? {
            library,
            modeOf: (w) => folders[w.path]?.mode ?? "sequential",
            randomPage: (w, current) => {
              let bag = bags.current.get(w.path);
              if (!bag) {
                bag = new ShuffleBag(w.pages.length);
                bags.current.set(w.path, bag);
              }
              return bag.next(current);
            },
          }
        : null,
    [library, folders],
  );
  const navRef = useRef(nav);
  navRef.current = nav;

  /** ライブラリを開く。開けたら true */
  const openLibrary = useCallback(
    async (root: string, s: Settings, quiet = false): Promise<boolean> => {
      try {
        const lib = buildLibrary(await backend.scanLibrary(root));
        if (lib.works.length === 0) {
          if (!quiet) notify(`画像のあるフォルダが見つかりません: ${root}`);
          return false;
        }
        bags.current.clear();
        history.current = [];
        setLibrary(lib);
        const wi = Math.max(0, findWorkIndex(lib, s.lastWork));
        const w = lib.works[wi]!;
        const page = Math.min(folderState(s, w.path).lastPage, w.pages.length - 1);
        setCursor({ work: wi, page, step: 0 });
        setSettings((prev) => ({ ...prev, lastLibrary: root }));
        touchHud();
        return true;
      } catch (e) {
        if (!quiet) notify(`開けませんでした: ${String(e)}`);
        return false;
      }
    },
    [notify, touchHud],
  );

  // 起動時: 設定を読み、引数のフォルダ → 前回のライブラリ → 既定の library/ の順に開く
  useEffect(() => {
    void (async () => {
      const info = await backend.appInfo().catch(() => null);
      setAppInfo(info);
      const s = parseSettings(await backend.loadSettings().catch(() => null));
      setSettings(s);
      setSettingsLoaded(true);
      const args = await backend.startupArgs().catch(() => [] as string[]);
      const candidates = [args.find((a) => !a.startsWith("-")), s.lastLibrary, info?.defaultLibrary].filter(
        (c): c is string => typeof c === "string" && c.length > 0,
      );
      for (const c of candidates) {
        if (await openLibrary(c, s, true)) return;
      }
    })();
  }, [openLibrary]);

  // ページモード: 画像を読み、次のページを先読みする
  useEffect(() => {
    if (!pagePath || stripActive) return;
    let alive = true;
    setMessage(null);
    cache.current.get(pagePath).then(
      (img) => {
        if (alive) setImage(img);
      },
      (e: unknown) => {
        if (alive) notify(`読み込み失敗: ${String(e)}`);
      },
    );
    const cur = cursorRef.current;
    if (work && cur) {
      for (let i = 1; i <= PRELOAD_AHEAD; i++) {
        const p = work.pages[cur.page + i];
        if (p) void cache.current.get(p).catch(() => {});
      }
    }
    return () => {
      alive = false;
    };
  }, [pagePath, work, notify, stripActive]);

  // 連続モード: 作品に入ったら全ページの縦横をヘッダから読む
  useEffect(() => {
    if (!stripActive || !work || sizes[work.path]) return;
    let alive = true;
    backend.pageSizes(work.pages).then(
      (list) => {
        if (!alive) return;
        const known = list.find((s): s is Size => s !== null) ?? FALLBACK_PAGE_SIZE;
        setSizes((prev) => ({ ...prev, [work.path]: list.map((s) => s ?? known) }));
      },
      (e: unknown) => {
        if (alive) notify(`ページの大きさが読めません: ${String(e)}`);
      },
    );
    return () => {
      alive = false;
    };
  }, [stripActive, work, sizes, notify]);

  // 連続モード: カーソル(ページ指定)が変わったらそのページの上端へ
  const hasSizes = workSizes !== undefined;
  const stripLayoutRef = useRef(stripLayout);
  stripLayoutRef.current = stripLayout;
  useEffect(() => {
    if (!stripActive || !cursor) return;
    const l = stripLayoutRef.current;
    if (!l) return;
    setStripY(Number.isFinite(cursor.step) ? scrollForPage(l, cursor.page, viewport.height) : LAST);
    // viewport は含めない(リサイズでは下の rescale が位置を保つ)
  }, [stripActive, cursor, hasSizes]);

  // 連続モード: 拡大率や画面サイズが変わっても、読んでいた位置を保つ
  const prevStripLayout = useRef<StripLayout | null>(null);
  useEffect(() => {
    const prev = prevStripLayout.current;
    prevStripLayout.current = stripLayout;
    if (!prev || !stripLayout || prev === stripLayout || prev.tops.length !== stripLayout.tops.length) return;
    setStripY((y) => rescaleScroll(prev, stripLayout, clampScroll(y, prev, viewport.height), viewport.height));
  }, [stripLayout]);

  const go = useCallback(
    (next: Cursor | null, record = true, quiet = false) => {
      if (!next) {
        setPlaying(false);
        notify("ここで終わりです");
        return;
      }
      const cur = cursorRef.current;
      if (record && cur && (cur.work !== next.work || cur.page !== next.page)) {
        history.current.push(cur);
        if (history.current.length > HISTORY_MAX) history.current.shift();
      }
      setCursor(next);
      if (!quiet) touchHud();
    },
    [notify, touchHud],
  );

  /** 「進む」。自動再生からも呼ぶので、quiet なら HUD を出さない */
  const advance = useCallback(
    (quiet: boolean) => {
      const n = navRef.current;
      const cur = cursorRef.current;
      if (!n || !cur) return;
      if (stripActive) {
        const l = stripLayoutRef.current;
        if (!l) return;
        const y = scrollForward(stripYc, l, viewport.height, settings.overlap);
        if (y === null) go(nextWork(n, cur), true, quiet);
        else {
          setStripY(y);
          if (!quiet) touchHud();
        }
        return;
      }
      go(forward(n, { ...cur, step }, stepCount), true, quiet);
    },
    [stripActive, stripYc, viewport.height, settings.overlap, go, touchHud, step, stepCount],
  );
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // 自動再生。画像(連続モードならページの大きさ)が揃ってから間隔を数える
  const autoReady = stripActive ? hasSizes : ready;
  useEffect(() => {
    if (!playing || !autoReady || !cursor || helpOpen) return;
    const t = window.setTimeout(() => advanceRef.current(true), settings.intervalMs);
    return () => window.clearTimeout(t);
  }, [playing, autoReady, cursor, step, stripYc, settings.intervalMs, helpOpen]);

  const toggleFullscreen = useCallback(async () => {
    const w = getCurrentWindow();
    await w.setFullscreen(!(await w.isFullscreen()));
  }, []);

  const pickAndOpen = useCallback(async () => {
    const dir = await backend.pickFolder();
    if (dir) await openLibrary(dir, settingsRef.current);
  }, [openLibrary]);

  const dispatch = useCallback(
    (action: Action) => {
      touchHud();
      switch (action) {
        case "toggle-fullscreen":
          void toggleFullscreen();
          return;
        case "open-library":
          void pickAndOpen();
          return;
        case "toggle-help":
          setHelpOpen((h) => !h);
          return;
        case "zoom-in":
          setSettings((s) => ({ ...s, zoom: zoomIn(s.zoom) }));
          return;
        case "zoom-out":
          setSettings((s) => ({ ...s, zoom: zoomOut(s.zoom) }));
          return;
        case "zoom-reset":
          setSettings((s) => ({ ...s, zoom: 1 }));
          setPanX(0.5);
          return;
        case "faster":
          setSettings((s) => ({ ...s, intervalMs: faster(s.intervalMs) }));
          return;
        case "slower":
          setSettings((s) => ({ ...s, intervalMs: slower(s.intervalMs) }));
          return;
        case "pan-left":
          setPanX((p) => Math.max(0, p - PAN_STEP));
          return;
        case "pan-right":
          setPanX((p) => Math.min(1, p + PAN_STEP));
          return;
      }
      if (!nav || !cursor || !work) return;
      const eff: Cursor = { ...cursor, page: displayPage, step: stripActive ? 0 : step };
      const l = stripLayoutRef.current;
      switch (action) {
        case "toggle-play":
          setPlaying((p) => !p);
          return;
        case "forward":
          advance(false);
          return;
        case "backward": {
          if (stripActive && l) {
            const y = scrollBackward(stripYc, viewport.height, settings.overlap);
            if (y !== null) setStripY(y);
            else {
              const r = prevWork(nav, eff);
              if (r) go({ ...r, step: LAST }, false);
            }
            return;
          }
          const r = backward(nav, eff);
          if (r) {
            go(r, false);
            return;
          }
          const prev = history.current.pop();
          if (prev) go(prev, false);
          return;
        }
        case "next-page":
          if (stripActive && l && displayPage + 1 < work.pages.length) {
            setStripY(scrollForPage(l, displayPage + 1, viewport.height));
            return;
          }
          go(nextPage(nav, eff));
          return;
        case "prev-page":
          if (stripActive && l && displayPage > 0) {
            setStripY(scrollForPage(l, displayPage - 1, viewport.height));
            return;
          }
          go(prevPage(nav, eff));
          return;
        case "next-work":
          go(nextWork(nav, eff));
          return;
        case "prev-work":
          go(prevWork(nav, eff));
          return;
        case "first-page":
          if (stripActive) setStripY(0);
          else go(firstPage(eff));
          return;
        case "toggle-view": {
          const next = toggleViewMode(settings.viewMode);
          // 連続 → ページに戻るときは、いま見ているページから続ける
          if (next === "page") setCursor({ work: cursor.work, page: displayPage, step: 0 });
          setSettings((s) => ({ ...s, viewMode: next }));
          notify(next === "strip" ? "連続スクロール" : "ページ送り");
          return;
        }
        case "toggle-mode": {
          const m = toggleMode(folderState(settings, work.path).mode);
          if (m === "random") setCursor({ work: cursor.work, page: displayPage, step: 0 });
          setSettings((s) => ({
            ...s,
            folders: { ...s.folders, [work.path]: { ...folderState(s, work.path), mode: m } },
          }));
          notify(m === "random" ? "この作品はランダムに進みます" : "この作品は順番に進みます");
          return;
        }
      }
    },
    [
      touchHud, toggleFullscreen, pickAndOpen, nav, cursor, work, displayPage, stripActive, step,
      stripYc, viewport.height, settings, go, advance, notify,
    ],
  );

  // キーボード
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHelpOpen(false);
        e.preventDefault();
        return;
      }
      const action = actionForKey(e);
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  // 画面サイズ
  useEffect(() => {
    const onResize = () => setViewport(viewportSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 読んでいる場所を設定に反映する
  useEffect(() => {
    if (!work) return;
    setSettings((s) => {
      const fs = folderState(s, work.path);
      if (s.lastWork === work.path && fs.lastPage === displayPage) return s;
      return { ...s, lastWork: work.path, folders: { ...s.folders, [work.path]: { ...fs, lastPage: displayPage } } };
    });
  }, [work, displayPage]);

  // 設定の保存(まとめて書く)
  useEffect(() => {
    if (!settingsLoaded) return;
    const t = window.setTimeout(() => void backend.saveSettings(settings).catch(() => {}), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [settings, settingsLoaded]);

  // ウィンドウタイトル
  useEffect(() => {
    void getCurrentWindow()
      .setTitle(work ? `${work.author ? `${work.author} / ` : ""}${work.name} - pageboy` : "pageboy")
      .catch(() => {});
  }, [work]);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheel.current < WHEEL_THROTTLE_MS) return;
    lastWheel.current = now;
    dispatch(e.deltaY > 0 ? "forward" : "backward");
  };

  const position =
    stripActive && stripLayout
      ? `${Math.round((stripYc / Math.max(1, maxScroll(stripLayout, viewport.height))) * 100)}%`
      : `${shownStep + 1} / ${stepCount}`;

  return (
    <div
      class={`root ${hudVisible ? "" : "idle"}`}
      onClick={() => library && dispatch("forward")}
      onContextMenu={(e) => {
        e.preventDefault();
        if (library) dispatch("backward");
      }}
      onWheel={onWheel}
      onMouseMove={touchHud}
    >
      {stripActive && stripLayout && work ? (
        <StripViewer
          pages={work.pages}
          layout={stripLayout}
          scrollY={stripYc}
          viewport={viewport}
          panX={panX}
          cache={cache.current}
        />
      ) : (
        image &&
        layout && (
          <Viewer
            url={image.url}
            drawWidth={layout.drawWidth}
            drawHeight={layout.drawHeight}
            offsetY={layout.offsets[clampStep(shownStep, stepCount)] ?? 0}
            viewportWidth={viewport.width}
            panX={panX}
          />
        )
      )}
      {!library && (
        <div class="empty">
          <h1>pageboy</h1>
          <p>漫画のフォルダ、または作品フォルダをまとめた親フォルダを開いてください。</p>
          {appInfo && (
            <p>
              <code>{appInfo.defaultLibrary}</code> に置いたフォルダは起動時に自動で開きます。
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void pickAndOpen();
            }}
          >
            フォルダを開く (O)
          </button>
          {message && <p class="msg">{message}</p>}
        </div>
      )}
      {work && cursor && (
        <Hud
          visible={hudVisible}
          workName={work.name}
          author={work.author}
          page={displayPage}
          pageCount={work.pages.length}
          position={position}
          playing={playing}
          intervalMs={settings.intervalMs}
          zoom={settings.zoom}
          mode={mode}
          viewMode={stripActive ? "strip" : "page"}
          message={message}
          onHelp={() => setHelpOpen((h) => !h)}
        />
      )}
      {helpOpen && (
        <Help
          onClose={() => setHelpOpen(false)}
          settingsPath={appInfo?.settingsPath ?? null}
          libraryPath={appInfo?.defaultLibrary ?? null}
        />
      )}
    </div>
  );
}
