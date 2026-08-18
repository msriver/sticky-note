importScripts("stn-core.js");

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
          console.warn("[Sticky Notes] menu setup failed", chrome.runtime.lastError.message);
        }
      }
    );
  });
}

/** Moves the pre-1.1 single `notes` object onto one storage key per page. */
async function migrateStorage() {
  try {
    const data = await chrome.storage.local.get(["notes", "enabled"]);
    if (data.enabled === undefined) await chrome.storage.local.set({ enabled: true });
    if (!data.notes || typeof data.notes !== "object") return;

    const migrated = STNCore.migrateLegacyNotes(data.notes);
    if (Object.keys(migrated).length) await chrome.storage.local.set(migrated);
    await chrome.storage.local.remove("notes");
  } catch (error) {
    console.warn("[Sticky Notes] storage migration failed", error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  createMenu();
  await migrateStorage();
});

chrome.runtime.onStartup.addListener(createMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ADD_NOTE || !tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "STN_ADD_NOTE" }).catch(() => {});
});
