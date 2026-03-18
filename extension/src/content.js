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
