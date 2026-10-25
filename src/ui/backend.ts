import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Settings } from "../core/settings";
import type { Library, Size } from "../core/types";

export interface AppInfo {
  home: string;
  settingsPath: string;
  defaultLibrary: string;
}

/** Rust 側との境界。ここ以外から Tauri の API を呼ばない */
export const backend = {
  appInfo: () => invoke<AppInfo>("app_info"),
  async pickFolder(): Promise<string | null> {
    const r = await open({
      directory: true,
      multiple: false,
      title: "漫画のフォルダ(または作品フォルダをまとめた親フォルダ)を選ぶ",
    });
    return typeof r === "string" ? r : null;
  },
  scanLibrary: (root: string) => invoke<Library>("scan_library", { root }),
  readImage: (path: string) => invoke<ArrayBuffer>("read_image", { path }),
  pageSizes: (paths: string[]) => invoke<(Size | null)[]>("page_sizes", { paths }),
  loadSettings: () => invoke<unknown>("load_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  startupArgs: () => invoke<string[]>("startup_args"),
  /** data/pageboy.log に 1 行追記する */
  log: (text: string) => invoke<void>("log_message", { text }),
};
