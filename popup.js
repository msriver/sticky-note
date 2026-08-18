const toggle = document.getElementById("enabledToggle");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");

let activeTab = null;

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

function applyI18n() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

function setUnavailable(message) {
  statusEl.textContent = message;
  addBtn.disabled = true;
  clearBtn.disabled = true;
}

/**
 * Availability is decided by whether the content script answers, not by reading
 * tab.url. That keeps the extension free of the "tabs"/"activeTab" permission.
 */
async function refreshStatus() {
  let enabled = true;
  try {
    const data = await chrome.storage.local.get(["enabled"]);
    enabled = data.enabled !== false;
  } catch {
    /* fall back to enabled */
  }
  toggle.checked = enabled;

  activeTab = await getActiveTab();
  if (!activeTab || activeTab.id == null) {
    setUnavailable(t("statusUnsupported"));
    return;
  }

  try {
    const res = await chrome.tabs.sendMessage(activeTab.id, { type: "STN_GET_COUNT" });
    if (!res || !res.ok) throw new Error("no response");
    statusEl.textContent = enabled ? t("statusCount", [String(res.count)]) : t("statusDisabled");
    addBtn.disabled = !enabled;
    clearBtn.disabled = !enabled || res.count === 0;
  } catch {
    setUnavailable(t("statusReload"));
  }
}

async function send(type) {
  if (!activeTab || activeTab.id == null) return null;
  try {
    return await chrome.tabs.sendMessage(activeTab.id, { type });
  } catch {
    statusEl.textContent = t("statusRetry");
    return null;
  }
}

toggle.addEventListener("change", async () => {
  try {
    await chrome.storage.local.set({ enabled: toggle.checked });
  } catch {
    /* refreshStatus re-reads the real value below */
  }
  await refreshStatus();
});

addBtn.addEventListener("click", async () => {
  const res = await send("STN_ADD_NOTE");
  if (res && res.ok) window.close();
  else if (res) statusEl.textContent = t("statusDisabled");
});

clearBtn.addEventListener("click", async () => {
  const res = await send("STN_CLEAR_PAGE");
  if (res) await refreshStatus();
});

applyI18n();
refreshStatus();
