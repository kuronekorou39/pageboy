// 作者ページの右下に「pageboy に保存」ボタンを置く。押すとダウンロード画面が別タブで開く。
(() => {
  const h = location.hostname;
  const path = location.pathname;
  let onCreatorPage = false;
  if (/subscribestar\.(?:art|com|adult)$/.test(h)) {
    onCreatorPage = /^\/(?!posts\/)[^/]+\/?$/.test(path);
  } else if (h === "www.fanbox.cc") {
    onCreatorPage = /^\/@[^/]+(?:\/posts)?\/?$/.test(path);
  } else if (h.endsWith(".fanbox.cc")) {
    // 作者ごとのサブドメイン(https://gyu.fanbox.cc/ や /posts)
    onCreatorPage = /^\/(?:posts\/?)?$/.test(path);
  }
  if (!onCreatorPage) return;

  const place = () => {
    if (document.getElementById("pageboy-save-button")) return;
    const b = document.createElement("button");
    b.id = "pageboy-save-button";
    b.textContent = "pageboy に保存";
    b.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border:0;border-radius:8px;" +
      "background:#2b7cff;color:#fff;font:14px/1 sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)";
    b.onclick = () => chrome.runtime.sendMessage({ type: "open-app" });
    document.body.appendChild(b);
  };
  place();
  // FANBOX は画面遷移で body を描き直すことがあるので、消えたら置き直す
  new MutationObserver(place).observe(document.body, { childList: true });
})();
