chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_CONTENT") {
    sendResponse({
      url: window.location.href,
      title: document.title,
      content: document.body.innerText.slice(0, 12000),
      metaDescription: document.querySelector('meta[name="description"]')?.content || "",
    });
  }
  return true;
});

document.addEventListener("sentinel:audit-start", () => {
  const badge = document.createElement("div");
  badge.id = "sentinel-badge";
  badge.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 999999;
    background: #0f172a; color: #38bdf8; padding: 8px 16px;
    border-radius: 20px; font-family: monospace; font-size: 12px;
    border: 1px solid #38bdf8; box-shadow: 0 0 20px rgba(56,189,248,0.3);
  `;
  badge.textContent = "🛡️ Sentinel Auditing...";
  document.body.appendChild(badge);
  setTimeout(() => badge.remove(), 3000);
});
