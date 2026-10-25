// 1. ツールバーのアイコン、またはページ内のボタンから、ダウンロード画面(app.html)をタブで開く。
//    ポップアップだとフォーカスが外れた時点で閉じて処理が止まるので、独立したタブにしている。
// 2. FANBOX の API と原寸画像は Origin / Referer が www.fanbox.cc でないと拒否されるので、
//    拡張機能からの要求にそのヘッダを付ける(declarativeNetRequest)。

const FANBOX_HEADER_RULE_ID = 1;
const SUBSCRIBESTAR_LINK_RULE_ID = 2;

function siteFromUrl(url) {
  if (!url) return null;
  if (/^https:\/\/(?:www\.)?subscribestar\.(?:art|adult)\//.test(url)) return "subscribestar.art";
  if (/^https:\/\/(?:www\.)?subscribestar\.com\//.test(url)) return "subscribestar.com";
  if (/^https:\/\/(?:[a-z0-9-]+\.)?fanbox\.cc\//.test(url)) return "fanbox";
  return null;
}

function openApp(fromUrl) {
  const url = new URL(chrome.runtime.getURL("app.html"));
  const site = siteFromUrl(fromUrl);
  if (site) {
    url.searchParams.set("site", site);
    url.searchParams.set("from", fromUrl);
  }
  chrome.tabs.create({ url: url.toString() });
}

chrome.action.onClicked.addListener((tab) => openApp(tab?.url));

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "open-app") openApp(sender.tab?.url);
});

const FANBOX_HEADER_RULE = {
  id: FANBOX_HEADER_RULE_ID,
  priority: 1,
  action: {
    type: "modifyHeaders",
    requestHeaders: [
      { header: "Origin", operation: "set", value: "https://www.fanbox.cc" },
      { header: "Referer", operation: "set", value: "https://www.fanbox.cc/" },
    ],
  },
  condition: {
    requestDomains: ["api.fanbox.cc", "downloads.fanbox.cc"],
    resourceTypes: ["xmlhttprequest"],
  },
};

// SubscribeStar のページ応答には Link: rel=preload ヘッダが付いていて、
// 拡張機能の画面で fetch しただけでも Chrome がその CSS / JS を先読みしようとし、
// 拡張機能の CSP に弾かれてコンソールに警告が出る。実害はないが、ヘッダを落として静かにする
const SUBSCRIBESTAR_LINK_RULE = {
  id: SUBSCRIBESTAR_LINK_RULE_ID,
  priority: 1,
  action: { type: "modifyHeaders", responseHeaders: [{ header: "Link", operation: "remove" }] },
  condition: {
    requestDomains: ["subscribestar.art", "www.subscribestar.com", "subscribestar.adult"],
    resourceTypes: ["xmlhttprequest"],
    initiatorDomains: [chrome.runtime.id],
  },
};

async function installHeaderRules() {
  const removeRuleIds = [FANBOX_HEADER_RULE_ID, SUBSCRIBESTAR_LINK_RULE_ID];
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [FANBOX_HEADER_RULE, SUBSCRIBESTAR_LINK_RULE] });
  } catch (e) {
    // initiatorDomains に拡張機能 ID が使えない環境なら、Link ヘッダの規則は諦めて FANBOX の規則だけ入れる
    console.warn("declarativeNetRequest: Link ヘッダの規則を入れられませんでした", e);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [FANBOX_HEADER_RULE] });
  }
}

chrome.runtime.onInstalled.addListener(() => void installHeaderRules());
chrome.runtime.onStartup.addListener(() => void installHeaderRules());
