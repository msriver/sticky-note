const toggle = document.getElementById("enabledToggle");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");

let activeTab = null;

function isSupportedUrl(url) {
  return /^https?:\/\//.test(url || "") || /^file:\/\//.test(url || "");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshStatus() {
  const data = await chrome.storage.local.get(["enabled"]);
  const enabled = data.enabled !== false;
  toggle.checked = enabled;

  activeTab = await getActiveTab();

  if (!activeTab || !isSupportedUrl(activeTab.url)) {
    statusEl.textContent = "이 페이지에서는 사용할 수 없어요.";
    addBtn.disabled = true;
    clearBtn.disabled = true;
    return;
  }

  try {
    const res = await chrome.tabs.sendMessage(activeTab.id, { type: "STN_GET_COUNT" });
    if (res && res.ok) {
      statusEl.textContent = enabled ? `이 페이지의 메모: ${res.count}개` : "메모가 꺼져 있어요.";
    }
  } catch {
    statusEl.textContent = "페이지를 새로고침하면 사용할 수 있어요.";
  }

  addBtn.disabled = !enabled;
  clearBtn.disabled = !enabled;
}

toggle.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: toggle.checked });
  await refreshStatus();
});

addBtn.addEventListener("click", async () => {
  if (!activeTab) return;
  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: "STN_ADD_NOTE" });
    window.close();
  } catch {
    statusEl.textContent = "페이지를 새로고침한 뒤 다시 시도해주세요.";
  }
});

clearBtn.addEventListener("click", async () => {
  if (!activeTab) return;
  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: "STN_CLEAR_PAGE" });
    await refreshStatus();
  } catch {
    statusEl.textContent = "페이지를 새로고침한 뒤 다시 시도해주세요.";
  }
});

refreshStatus();
