//! pageboy デスクトップアプリ。
//!
//! Rust 側はフォルダ走査・画像の読み込み・設定ファイルの読み書きだけを受け持つ。
//! ページ送りや自動再生のロジックはすべて TypeScript(src/core)にあり、ここでは判断しない。

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "avif", "gif", "bmp"];
/// ライブラリのフォルダから何階層まで作品を探すか
const MAX_SCAN_DEPTH: usize = 3;
/// データ置き場(home)の中の構成
const DATA_DIR: &str = "data";
const SETTINGS_FILE: &str = "settings.json";
const LOG_FILE: &str = "pageboy.log";
const LIBRARY_DIR: &str = "library";

/// 設定と既定のライブラリを置く場所
struct Home(PathBuf);

#[derive(Serialize)]
struct Work {
    path: String,
    name: String,
    pages: Vec<String>,
}

#[derive(Serialize)]
struct Library {
    root: String,
    works: Vec<Work>,
}

#[derive(Serialize)]
struct Size {
    width: u32,
    height: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    home: String,
    settings_path: String,
    default_library: String,
}

/// データの置き場所。環境変数 PAGEBOY_HOME > 開発中はこのリポジトリ > インストール版は OS の設定フォルダ
fn resolve_home(app: &tauri::App) -> PathBuf {
    if let Ok(dir) = std::env::var("PAGEBOY_HOME") {
        return PathBuf::from(dir);
    }
    if cfg!(debug_assertions) {
        if let Some(root) = Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
            return root.to_path_buf();
        }
    }
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// dir 直下の画像を 1 作品にまとめ、サブフォルダも depth まで再帰的に見る。並べ替えは TS 側で行う
fn collect_works(dir: &Path, depth: usize, out: &mut Vec<Work>) -> std::io::Result<()> {
    let mut pages = Vec::new();
    let mut subdirs = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            subdirs.push(path);
        } else if file_type.is_file() && is_image(&path) {
            pages.push(path.to_string_lossy().into_owned());
        }
    }
    if !pages.is_empty() {
        let name = dir
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| dir.display().to_string());
        out.push(Work {
            path: dir.to_string_lossy().into_owned(),
            name,
            pages,
        });
    }
    if depth < MAX_SCAN_DEPTH {
        // 読めないサブフォルダ(権限なし等)は飛ばす。開いたフォルダ自体が読めないときだけ上へエラーを返す
        for sub in subdirs {
            let _ = collect_works(&sub, depth + 1, out);
        }
    }
    Ok(())
}

#[tauri::command]
fn app_info(home: tauri::State<Home>) -> AppInfo {
    AppInfo {
        home: home.0.display().to_string(),
        settings_path: home.0.join(DATA_DIR).join(SETTINGS_FILE).display().to_string(),
        default_library: home.0.join(LIBRARY_DIR).display().to_string(),
    }
}

#[tauri::command]
fn scan_library(root: String) -> Result<Library, String> {
    let dir = Path::new(&root);
    if !dir.is_dir() {
        return Err(format!("フォルダではありません: {root}"));
    }
    let mut works = Vec::new();
    collect_works(dir, 0, &mut works).map_err(|e| format!("{root}: {e}"))?;
    Ok(Library { root, works })
}

#[tauri::command]
fn read_image(path: String) -> Result<tauri::ipc::Response, String> {
    let p = Path::new(&path);
    if !is_image(p) {
        return Err(format!("画像ファイルではありません: {path}"));
    }
    std::fs::read(p)
        .map(tauri::ipc::Response::new)
        .map_err(|e| format!("{path}: {e}"))
}

/// ヘッダだけ読んで画像の縦横を返す(連続モードのレイアウトに使う)。読めないものは null
#[tauri::command]
fn page_sizes(paths: Vec<String>) -> Vec<Option<Size>> {
    paths
        .iter()
        .map(|p| {
            imagesize::size(p).ok().map(|s| Size {
                width: s.width as u32,
                height: s.height as u32,
            })
        })
        .collect()
}

fn settings_path(home: &Home) -> Result<PathBuf, String> {
    let dir = home.0.join(DATA_DIR);
    std::fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    Ok(dir.join(SETTINGS_FILE))
}

#[tauri::command]
fn load_settings(home: tauri::State<Home>) -> Result<serde_json::Value, String> {
    let path = settings_path(&home)?;
    if !path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))
}

/// 書きかけで壊れないよう、一時ファイルに書いてから置き換える
#[tauri::command]
fn save_settings(home: tauri::State<Home>, settings: serde_json::Value) -> Result<(), String> {
    let path = settings_path(&home)?;
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, text).map_err(|e| format!("{}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("{}: {e}", path.display()))
}

/// 起動引数。フォルダのパスが渡されていれば TS 側がそれを開く
#[tauri::command]
fn startup_args() -> Vec<String> {
    std::env::args().skip(1).collect()
}

/// フロントエンドのエラーを data/pageboy.log に追記する(WebView のコンソールは普段見えないため)
#[tauri::command]
fn log_message(home: tauri::State<Home>, text: String) -> Result<(), String> {
    use std::io::Write;
    let dir = home.0.join(DATA_DIR);
    std::fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let path = dir.join(LOG_FILE);
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("{}: {e}", path.display()))?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    writeln!(f, "{now} {text}").map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let home = resolve_home(app);
            std::fs::create_dir_all(home.join(LIBRARY_DIR))?;
            app.manage(Home(home));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            scan_library,
            read_image,
            page_sizes,
            load_settings,
            save_settings,
            startup_args,
            log_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
