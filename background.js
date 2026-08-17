const MENU_ADD_NOTE = "stn-add-note";

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: MENU_ADD_NOTE,
    title: "여기에 스티키 노트 추가",
    contexts: ["page", "selection", "image", "link"],
  });

  const data = await chrome.storage.local.get(["enabled"]);
  if (data.enabled === undefined) {
    await chrome.storage.local.set({ enabled: true, notes: data.notes || {} });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ADD_NOTE || !tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "STN_ADD_NOTE" }).catch(() => {});
});
