const API_BASE = "http://localhost:8000";

console.log("[Sentinel BG] Service worker loaded");

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Sentinel BG] onMessage", message?.type, {
    from: sender?.url || sender?.origin || "unknown",
  });

  handleMessage(message, sender)
    .then((result) => {
      console.log("[Sentinel BG] response", message?.type, result);
      sendResponse(result);
    })
    .catch((error) => {
      console.error("[Sentinel BG] handleMessage failed", message?.type, error);
      sendResponse({ success: false, error: error?.message || "Unknown background error" });
    });

  return true;
});

async function handleMessage(message, sender) {
  const { type, payload } = message;

  switch (type) {
    case "GET_PAGE_CONTENT": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          url: window.location.href,
          title: document.title,
          content: document.body.innerText.slice(0, 10000),
        }),
      });
      return results[0]?.result || {};
    }

    case "RUN_RESEARCH": {
      return await callAPI("/research", payload);
    }

    case "RUN_SYNC": {
      return await callAPI("/sync", payload);
    }

    case "RUN_AUDIT": {
      const result = await callAPI("/audit", payload);
      if (result?.result?.risk_level === "high" || result?.result?.risk_level === "critical") {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "⚠️ Sentinel Security Alert",
          message: result.result.recommendation?.slice(0, 100) || "High privacy risk detected on this page.",
          priority: 2,
        });
      }
      return result;
    }

    case "RUN_CHAT": {
      console.log("[Sentinel BG] RUN_CHAT payload", payload);
      const res = await callAPI("/chat", payload);
      console.log("[Sentinel BG] RUN_CHAT response", res);
      return res;
    }

    default:
      return { error: "Unknown message type" };
  }
}

async function callAPI(endpoint, payload) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    console.error(`Sentinel API error [${endpoint}]:`, error);
    return { success: false, error: error.message };
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url?.startsWith("http")) return;

  const settings = await chrome.storage.sync.get("autoAudit");
  if (!settings.autoAudit) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.body.innerText.slice(0, 5000),
  });

  const content = results[0]?.result || "";
  await callAPI("/audit", { url: tab.url, page_content: content, session_id: `tab-${tabId}` });
});
