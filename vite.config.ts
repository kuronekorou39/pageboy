import { defineConfig } from "vite";

// Tauri が devUrl として参照するので port は固定する
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // src-tauri/target を監視すると Rust のビルド中に EBUSY が出続けるので外す
    watch: { ignored: ["**/src-tauri/**", "**/data/**", "**/library/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
