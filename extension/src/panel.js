const API_BASE = "http://localhost:8000";

const state = {
  currentTab: "chat",
  pageInfo: { url: "", title: "", content: "" },
  chatHistory: [],
  isLoading: false,
  backendOnline: false,
  sessionId: crypto.randomUUID(),
};

document.getElementById("app").innerHTML = `
  <div class="header">
    <div class="logo">
      <div class="logo-icon">🛡️</div>
      <span class="logo-text">SENTINEL</span>
    </div>
    <div id="status-dot" class="status-dot" title="Backend Status"></div>
  </div>

  <div class="page-bar">
    <span class="site-icon">🌐</span>
    <span class="page-title" id="page-title">Loading page...</span>
  </div>

  <div class="tabs">
    <button class="tab-btn active" data-tab="chat">
      <span class="tab-icon">💬</span>Chat
    </button>
    <button class="tab-btn" data-tab="research">
      <span class="tab-icon">🔍</span>Research
    </button>
    <button class="tab-btn" data-tab="sync">
      <span class="tab-icon">📚</span>Notion
    </button>
  </div>

  <div class="panels">
    <!-- CHAT -->
    <div class="panel active" id="panel-chat">
      <div class="chat-messages" id="chat-messages">
        <div class="msg msg-agent">
          <div class="msg-label">SENTINEL</div>
          <div class="msg-bubble">Hello! I'm Sentinel. I can answer questions about this page, run deep research, or help you understand any content. What would you like to know?</div>
        </div>
      </div>
      <div class="chat-input-row">
        <textarea class="input" id="chat-input" rows="2" placeholder="Ask about this page..."></textarea>
        <button class="chat-send" id="chat-send">↑</button>
      </div>
    </div>

    <!-- RESEARCH -->
    <div class="panel" id="panel-research">
      <div class="card">
        <div class="card-title">🔍 Deep Research</div>
        <textarea class="input" id="research-query" rows="3" placeholder="What do you want to research about this topic? Sentinel will create a plan and search the live web..."></textarea>
        <div style="height:8px"></div>
        <button class="btn btn-primary" id="research-btn">Run Deep Research</button>
      </div>
      <div id="research-log" style="display:none" class="agent-log">Initializing research agent...</div>
      <div id="research-result" style="display:none"></div>
    </div>

    <!-- NOTION SYNC -->
    <div class="panel" id="panel-sync">
      <div class="card">
        <div class="card-title">📚 Intelligent Notion Sync</div>
        <p style="color:var(--text2);font-size:12px;line-height:1.5;margin-bottom:12px">
          Sentinel will analyze this page, generate tags and insights, and sync it to your Notion database — automatically categorized and structured.
        </p>
        <button class="btn btn-purple" id="sync-btn">Sync to Notion</button>
      </div>
      <div id="sync-result" style="display:none"></div>
    </div>

  </div>
`;

async function init() {
  await loadPageInfo();
  await checkBackendHealth();
  setupEventListeners();
}

async function loadPageInfo() {
  try {
    const info = await chrome.runtime.sendMessage({ type: "GET_PAGE_CONTENT" });
    state.pageInfo = info;
    const titleEl = document.getElementById("page-title");
    titleEl.textContent = info.title || info.url || "Unknown page";
    titleEl.title = info.url;
  } catch (e) {
    document.getElementById("page-title").textContent = "Unable to read page";
  }
}

async function checkBackendHealth() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "CHECK_HEALTH" });
    state.backendOnline = result?.status === "online";
  } catch {
    state.backendOnline = false;
  }

  const dot = document.getElementById("status-dot");
  dot.className = `status-dot ${state.backendOnline ? "online" : ""}`;
  dot.title = state.backendOnline ? "Backend online" : "Backend offline — start the server";
}

function setupEventListeners() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentTab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    });
  });

  document.getElementById("chat-send").addEventListener("click", sendChat);
  document.getElementById("chat-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  document.getElementById("research-btn").addEventListener("click", runResearch);

  document.getElementById("sync-btn").addEventListener("click", runSync);
}

async function sendChat() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message || state.isLoading) return;

  input.value = "";
  appendMessage("user", message);
  state.chatHistory.push({ role: "user", content: message });

  const loadingId = appendLoading();

  try {
    const result = await chrome.runtime.sendMessage({
      type: "RUN_CHAT",
      payload: {
        url: state.pageInfo.url,
        page_content: state.pageInfo.content,
        message,
        history: state.chatHistory.slice(-8),
        session_id: state.sessionId,
      },
    });

    removeElement(loadingId);
    const response = result?.result || "Sorry, I couldn't get a response.";
    appendMessage("agent", response);
    state.chatHistory.push({ role: "assistant", content: response });
  } catch (e) {
    removeElement(loadingId);
    appendMessage("agent", "⚠️ Error connecting to Sentinel backend. Is the server running?");
  }
}

function appendMessage(role, content) {
  const container = document.getElementById("chat-messages");
  const id = `msg-${Date.now()}`;
  const label = role === "user" ? "YOU" : "SENTINEL";
  container.innerHTML += `
    <div class="msg msg-${role}" id="${id}">
      <div class="msg-label">${label}</div>
      <div class="msg-bubble">${escapeHtml(content)}</div>
    </div>
  `;
  container.scrollTop = container.scrollHeight;
  return id;
}

function appendLoading() {
  const container = document.getElementById("chat-messages");
  const id = `loading-${Date.now()}`;
  container.innerHTML += `
    <div class="loading" id="${id}">
      <div class="spinner"></div> Sentinel is thinking...
    </div>
  `;
  container.scrollTop = container.scrollHeight;
  return id;
}

async function runResearch() {
  const query = document.getElementById("research-query").value.trim();
  if (!query) return;

  const btn = document.getElementById("research-btn");
  const log = document.getElementById("research-log");
  const result = document.getElementById("research-result");

  btn.disabled = true;
  btn.textContent = "Researching...";
  log.style.display = "block";
  result.style.display = "none";

  const steps = [
    "[ PLANNER ] Generating research plan...",
    "[ SEARCHER ] Querying Tavily AI...",
    "[ SEARCHER ] Fetching additional sources...",
    "[ SYNTHESIZER ] Synthesizing findings...",
  ];

  let stepIndex = 0;
  const logInterval = setInterval(() => {
    if (stepIndex < steps.length) {
      log.textContent = steps[stepIndex++];
    }
  }, 800);

  try {
    const res = await chrome.runtime.sendMessage({
      type: "RUN_RESEARCH",
      payload: {
        url: state.pageInfo.url,
        page_content: state.pageInfo.content,
        query,
        session_id: state.sessionId,
      },
    });

    clearInterval(logInterval);
    log.style.display = "none";

    const data = res?.result;
    if (!data) throw new Error("No result");

    const sources = (data.sources || []).filter(Boolean).map(url =>
      `<a class="source-link" href="${url}" target="_blank">${url.slice(0, 50)}...</a>`
    ).join("<br>");

    result.style.display = "block";
    result.innerHTML = `
      <div class="research-result">${escapeHtml(data.synthesis || "No synthesis available.")}</div>
      ${sources ? `<div class="card"><div class="card-title">📎 Sources</div>${sources}</div>` : ""}
    `;
  } catch (e) {
    clearInterval(logInterval);
    log.style.display = "none";
    result.style.display = "block";
    result.innerHTML = `<div class="research-result" style="color:var(--danger)">⚠️ Research failed. Check backend connection.</div>`;
  }

  btn.disabled = false;
  btn.textContent = "Run Deep Research";
}

async function runSync() {
  const btn = document.getElementById("sync-btn");
  const resultEl = document.getElementById("sync-result");

  btn.disabled = true;
  btn.textContent = "Syncing...";
  resultEl.style.display = "none";

  try {
    const res = await chrome.runtime.sendMessage({
      type: "RUN_SYNC",
      payload: {
        url: state.pageInfo.url,
        page_content: state.pageInfo.content,
        page_title: state.pageInfo.title,
        session_id: state.sessionId,
      },
    });

    const data = res?.result;
    resultEl.style.display = "block";

    if (data?.status === "already_synced") {
      resultEl.innerHTML = `
        <div class="card" style="border-color:var(--warn)">
          <div style="color:var(--warn);font-weight:700">⚠️ Already Synced</div>
          <div style="color:var(--text2);font-size:12px;margin-top:6px">This page is already in your Notion database.</div>
        </div>
      `;
    } else if (data?.status === "synced") {
      const tags = (data.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
      const insights = (data.insights || []).map(i => `<div class="insight-item">${escapeHtml(i)}</div>`).join("");
      resultEl.innerHTML = `
        <div class="card" style="border-color:var(--accent3)">
          <div style="color:var(--accent3);font-weight:700;margin-bottom:8px">✅ Synced to Notion</div>
          <div class="card-title">📝 Summary</div>
          <p style="font-size:12px;color:var(--text);line-height:1.5;margin-bottom:10px">${escapeHtml(data.summary || "")}</p>
          ${tags ? `<div class="card-title">🏷️ Tags</div><div class="tags-row" style="margin-bottom:10px">${tags}</div>` : ""}
          ${insights ? `<div class="card-title">💡 Insights</div><div style="display:flex;flex-direction:column;gap:5px">${insights}</div>` : ""}
        </div>
      `;
    }
  } catch (e) {
    resultEl.style.display = "block";
    resultEl.innerHTML = `<div class="card" style="color:var(--danger)">⚠️ Sync failed. Check backend and Notion credentials.</div>`;
  }

  btn.disabled = false;
  btn.textContent = "Sync to Notion";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function removeElement(id) {
  document.getElementById(id)?.remove();
}

init();