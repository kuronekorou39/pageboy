// WebView2 のリモートデバッグ(CDP)につないで、ページの状態を読み、キー操作を注入する
const port = process.argv[2] ?? "9229";
const steps = process.argv.slice(3); // 例: eval:document.title  key:v  wait:1500

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("page target not found: " + JSON.stringify(list));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[console." + msg.params.type + "]", msg.params.args.map((a) => a.value ?? a.description).join(" "));
    } else if (msg.method === "Runtime.exceptionThrown") {
      console.log("[exception]", msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Runtime.enable");
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.exceptionDetails ? "EXC: " + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text) : r.result?.result?.value;
  };
  for (const s of steps) {
    const [kind, ...rest] = s.split(":");
    const arg = rest.join(":");
    if (kind === "eval") console.log(arg, "=>", JSON.stringify(await evalJs(arg)));
    else if (kind === "key") {
      await evalJs(`window.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(arg)}, bubbles: true }))`);
      console.log("key", arg);
    } else if (kind === "wait") await new Promise((r) => setTimeout(r, Number(arg)));
    else if (kind === "shot") {
      const r = await send("Page.captureScreenshot", { format: "png" });
      const { writeFileSync } = await import("node:fs");
      writeFileSync(arg, Buffer.from(r.result.data, "base64"));
      console.log("saved", arg);
    }
  }
  ws.close();
}
main().catch((e) => {
  console.error("CDP error:", e.message);
  process.exit(1);
});
