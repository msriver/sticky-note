const MENU_ADD_NOTE = "stn-add-note";

function createMenu() {
  // removeAll first: onInstalled also fires on update/reload, and creating an
  // existing id throws "Cannot create item with duplicate id".
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create(
      {
        id: MENU_ADD_NOTE,
        title: chrome.i18n.getMessage("menuAddNote"),
        contexts: ["page", "selection", "image", "link"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn("[PagePin] menu setup failed", chrome.runtime.lastError.message);
        }
      }
    );
  });
}

async function initDefaults() {
  try {
    const data = await chrome.storage.local.get("enabled");
    if (data.enabled === undefined) await chrome.storage.local.set({ enabled: true });
  } catch (error) {
    console.warn("[PagePin] could not initialise settings", error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  createMenu();
  await initDefaults();
});

chrome.runtime.onStartup.addListener(createMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ADD_NOTE || !tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "STN_ADD_NOTE" }).catch(() => {});
});
