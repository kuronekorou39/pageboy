import { Component, render, type ComponentChildren } from "preact";
import { App } from "./ui/App";
import { backend } from "./ui/backend";
import "./ui/style.css";

/** 画面に出ないエラーを data/pageboy.log に残す(WebView のコンソールは普段見えないため) */
function report(kind: string, detail: unknown): void {
  const text = detail instanceof Error ? `${detail.message}\n${detail.stack ?? ""}` : String(detail);
  void backend.log(`[${kind}] ${text}`).catch(() => {});
}

window.addEventListener("error", (e) => report("error", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => report("unhandledrejection", e.reason));

interface BoundaryState {
  error: string | null;
}

/** 描画中の例外で画面が固まらないよう、エラーを表示してログに残す */
class ErrorBoundary extends Component<{ children: ComponentChildren }, BoundaryState> {
  override state: BoundaryState = { error: null };

  override componentDidCatch(error: unknown): void {
    report("render", error);
    this.setState({ error: error instanceof Error ? (error.stack ?? error.message) : String(error) });
  }

  override render() {
    if (this.state.error) {
      return (
        <div class="fatal">
          <h1>画面の描画でエラーが起きました</h1>
          <pre>{this.state.error}</pre>
          <p>data/pageboy.log にも記録しました。アプリを再起動してください。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById("app")!,
);
