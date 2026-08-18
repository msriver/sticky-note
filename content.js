(() => {
  if (window.__stickyNotesInjected) return;
  window.__stickyNotesInjected = true;

  const Core = globalThis.STNCore;
  const SAVE_DEBOUNCE_MS = 250;
  const CONTEXT_POS_TTL_MS = 5000;
  const NAV_POLL_MS = 700;
  const TOAST_MS = 2600;

  let notes = [];
  let enabled = true;
  let pageKey = Core.pageKeyFromUrl(location.href);
  let lastContext = null;
  let pending = null;
  let saveTimer = null;
  let writeChain = Promise.resolve();
  let interactions = 0;
  let navToken = 0;
  let host = null;
  let shadow = null;
  let layer = null;
  let toastEl = null;
  let toastTimer = null;

  const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

  // ---------------------------------------------------------------- storage

  async function readNotes(key) {
    const sKey = Core.storageKey(key);
    try {
      const data = await chrome.storage.local.get([sKey, "notes"]);
      if (Array.isArray(data[sKey])) return Core.sanitizeNotes(data[sKey]);
      // Pre-1.1 layout, in case the service worker migration has not run yet.
      const legacy = data.notes && data.notes[key];
      return Core.sanitizeNotes(legacy);
    } catch (error) {
      console.warn("[Sticky Notes] load failed", error);
      return [];
    }
  }

  function writeNotes(key, serialized) {
    const sKey = Core.storageKey(key);
    const run = async () => {
      try {
        if (serialized.length) await chrome.storage.local.set({ [sKey]: serialized });
        else await chrome.storage.local.remove(sKey);
      } catch (error) {
        console.warn("[Sticky Notes] save failed", error);
        showToast(t("errorSaveFailed"));
      }
    };
    // Per-page keys already remove cross-page races; the lock serialises the
    // remaining case of two tabs sitting on the very same page.
    writeChain = writeChain
      .then(() => (navigator.locks ? navigator.locks.request("stn:" + sKey, run) : run()))
      .catch(() => {});
    return writeChain;
  }

  // Snapshots both the key and the notes, so a mid-flight SPA navigation cannot
  // write this page's notes under the next page's key.
  function scheduleSave() {
    pending = { key: pageKey, list: notes.map(Core.serializeNote) };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!pending) return;
    const snapshot = pending;
    pending = null;
    writeNotes(snapshot.key, snapshot.list);
  }

  // ------------------------------------------------------------------- host

  function ensureHost() {
    if (host && host.isConnected) return;

    host = document.createElement("div");
    host.id = "sticky-notes-for-web";
    // Inline !important so no page rule (div { position: relative }, * { display: none }, ...)
    // can move or hide the layer. Everything inside is shadowed and therefore untouchable.
    const hostStyle = {
      position: "absolute",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      margin: "0",
      padding: "0",
      border: "0",
      display: "block",
      float: "none",
      transform: "none",
      filter: "none",
      opacity: "1",
      visibility: "visible",
      "clip-path": "none",
      contain: "none",
      isolation: "isolate",
      "pointer-events": "none",
      "z-index": "2147483647",
    };
    for (const [prop, value] of Object.entries(hostStyle)) {
      host.style.setProperty(prop, value, "important");
    }

    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = globalThis.STN_STYLES;
    layer = document.createElement("div");
    layer.className = "stn-layer";
    toastEl = document.createElement("div");
    toastEl.className = "stn-toast";
    toastEl.hidden = true;
    shadow.append(style, layer, toastEl);

    // Anchored to <html>, not <body>: absolute children then resolve against the
    // initial containing block, immune to body margins and transforms.
    (document.documentElement || document.body).appendChild(host);
  }

  function showToast(message) {
    ensureHost();
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, TOAST_MS);
  }

  function docBounds() {
    const de = document.documentElement;
    const body = document.body;
    return {
      w: Math.max(de.scrollWidth, de.clientWidth, body ? body.scrollWidth : 0, window.innerWidth || 0),
      h: Math.max(de.scrollHeight, de.clientHeight, body ? body.scrollHeight : 0, window.innerHeight || 0),
    };
  }

  // ----------------------------------------------------------------- render

  function applyZ() {
    if (!layer) return;
    for (const el of layer.children) {
      const note = notes.find((n) => n.id === el.dataset.id);
      if (note) el.style.zIndex = String(note.z);
    }
  }

  function bringToFront(note) {
    const top = Core.maxZ(notes);
    if (note.z === top) return false;
    note.z = top + 1;
    Core.normalizeZ(notes);
    applyZ();
    return true;
  }

  function createNoteElement(note) {
    const el = document.createElement("div");
    el.className = "stn-note";
    el.dataset.id = note.id;
    el.style.left = note.x + "px";
    el.style.top = note.y + "px";
    el.style.width = note.w + "px";
    el.style.height = note.h + "px";
    el.style.background = note.color;
    el.style.zIndex = String(note.z);

    const header = document.createElement("div");
    header.className = "stn-header";
    header.title = t("noteDrag");

    const colors = document.createElement("div");
    colors.className = "stn-colors";
    Core.COLORS.forEach((color) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "stn-color-dot" + (color === note.color ? " stn-active" : "");
      dot.style.background = color;
      dot.title = t("noteColor");
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        note.color = color;
        el.style.background = color;
        colors.querySelectorAll(".stn-color-dot").forEach((d) => d.classList.remove("stn-active"));
        dot.classList.add("stn-active");
        scheduleSave();
      });
      colors.appendChild(dot);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "stn-delete";
    delBtn.title = t("noteDelete");
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      removeNote(note.id, el);
    });

    header.append(colors, delBtn);

    const body = document.createElement("div");
    body.className = "stn-body";
    // plaintext-only keeps pasted markup out of the note; older engines fall back to true.
    body.setAttribute("contenteditable", "plaintext-only");
    if (body.contentEditable !== "plaintext-only") body.setAttribute("contenteditable", "true");
    body.dataset.placeholder = t("notePlaceholder");
    body.textContent = note.text || "";
    body.addEventListener("input", () => {
      note.text = readBodyText(body);
      scheduleSave();
    });
    body.addEventListener("paste", (event) => {
      if (!event.clipboardData) return;
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    });
    body.addEventListener("pointerdown", (event) => event.stopPropagation());
    body.addEventListener("focus", () => {
      if (bringToFront(note)) scheduleSave();
    });
    body.addEventListener("blur", flushSave);

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "stn-resize-handle";
    resizeHandle.title = t("noteResize");

    el.append(header, body, resizeHandle);
    attachDrag(el, header, note);
    attachResize(el, resizeHandle, note);
    el.addEventListener("pointerdown", () => {
      if (bringToFront(note)) scheduleSave();
    });

    return el;
  }

  function readBodyText(body) {
    const text = typeof body.innerText === "string" ? body.innerText : body.textContent;
    return (text || "").slice(0, Core.MAX_TEXT);
  }

  function attachDrag(el, handle, note) {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let bounds = null;
    let pointerId = null;

    function onMove(event) {
      if (event.pointerId !== pointerId) return;
      const next = Core.clampPosition(
        startLeft + (event.clientX - startX),
        startTop + (event.clientY - startY),
        note.w,
        note.h,
        bounds
      );
      note.x = next.x;
      note.y = next.y;
      el.style.left = next.x + "px";
      el.style.top = next.y + "px";
    }

    function onEnd(event) {
      if (event.pointerId !== pointerId) return;
      endInteraction();
      el.classList.remove("stn-dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      pointerId = null;
      scheduleSave();
    }

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pointerId !== null) return;
      if (event.target.closest(".stn-delete, .stn-color-dot")) return;
      event.preventDefault();
      pointerId = event.pointerId;
      handle.setPointerCapture(pointerId);
      startInteraction();
      bringToFront(note);
      el.classList.add("stn-dragging");
      startX = event.clientX;
      startY = event.clientY;
      // note.x/note.y, never offsetLeft: offsetLeft is measured from the
      // offsetParent's padding box and jumps when the page styles <body>.
      startLeft = note.x;
      startTop = note.y;
      bounds = docBounds();
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onEnd);
      handle.addEventListener("pointercancel", onEnd);
    });
  }

  function attachResize(el, handle, note) {
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let bounds = null;
    let pointerId = null;

    function onMove(event) {
      if (event.pointerId !== pointerId) return;
      const next = Core.clampSize(
        startW + (event.clientX - startX),
        startH + (event.clientY - startY),
        note.x,
        note.y,
        bounds
      );
      note.w = next.w;
      note.h = next.h;
      el.style.width = next.w + "px";
      el.style.height = next.h + "px";
    }

    function onEnd(event) {
      if (event.pointerId !== pointerId) return;
      endInteraction();
      el.classList.remove("stn-resizing");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onEnd);
      handle.removeEventListener("pointercancel", onEnd);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      pointerId = null;
      scheduleSave();
    }

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || pointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      handle.setPointerCapture(pointerId);
      startInteraction();
      bringToFront(note);
      el.classList.add("stn-resizing");
      startX = event.clientX;
      startY = event.clientY;
      startW = note.w;
      startH = note.h;
      bounds = docBounds();
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onEnd);
      handle.addEventListener("pointercancel", onEnd);
    });
  }

  function startInteraction() {
    interactions += 1;
  }

  function endInteraction() {
    interactions = Math.max(0, interactions - 1);
  }

  function isBusy() {
    if (interactions > 0) return true;
    const active = shadow && shadow.activeElement;
    return !!(active && active.classList && active.classList.contains("stn-body"));
  }

  function removeNote(id, el) {
    notes = notes.filter((note) => note.id !== id);
    el.remove();
    Core.normalizeZ(notes);
    applyZ();
    scheduleSave();
  }

  function renderAll() {
    ensureHost();
    layer.replaceChildren();
    if (!enabled) return;
    Core.normalizeZ(notes);
    for (const note of notes) layer.appendChild(createNoteElement(note));
  }

  function addNote(position) {
    const bounds = docBounds();
    const fallbackX = (window.scrollX || 0) + Math.max(20, window.innerWidth / 2 - Core.DEFAULT_WIDTH / 2);
    const fallbackY = (window.scrollY || 0) + Math.max(20, window.innerHeight / 2 - Core.DEFAULT_HEIGHT / 2);
    const spot = Core.clampPosition(
      position ? position.x : fallbackX,
      position ? position.y : fallbackY,
      Core.DEFAULT_WIDTH,
      Core.DEFAULT_HEIGHT,
      bounds
    );

    const note = Core.createNote({ x: spot.x, y: spot.y, z: Core.maxZ(notes) + 1 });
    notes.push(note);
    Core.normalizeZ(notes);
    ensureHost();
    const el = createNoteElement(note);
    layer.appendChild(el);
    applyZ();
    scheduleSave();
    el.querySelector(".stn-body").focus();
  }

  // ------------------------------------------------------------- navigation

  async function handleNavigation() {
    const nextKey = Core.pageKeyFromUrl(location.href);
    if (nextKey === pageKey) {
      ensureHost();
      return;
    }
    // Persist under the key the notes actually belong to before switching.
    flushSave();
    pageKey = nextKey;
    const token = (navToken += 1);
    const loaded = await readNotes(nextKey);
    if (token !== navToken) return;
    notes = loaded;
    Core.normalizeZ(notes);
    renderAll();
  }

  function observeNavigation() {
    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("hashchange", handleNavigation);
    if (window.navigation && typeof window.navigation.addEventListener === "function") {
      // Same-document SPA routing (pushState/replaceState) surfaces here.
      window.navigation.addEventListener("navigatesuccess", handleNavigation);
    }
    // pushState cannot be hooked from an isolated world, so a cheap poll stays
    // as the backstop for routers the events above do not cover.
    setInterval(handleNavigation, NAV_POLL_MS);
  }

  function observeHost() {
    const root = document.documentElement;
    if (!root) return;
    new MutationObserver(() => {
      if (!host || !host.isConnected) renderAll();
    }).observe(root, { childList: true });
  }

  // --------------------------------------------------------------- messaging

  document.addEventListener(
    "contextmenu",
    (event) => {
      lastContext = {
        x: (window.scrollX || 0) + event.clientX,
        y: (window.scrollY || 0) + event.clientY,
        at: Date.now(),
      };
    },
    true
  );

  // Only honour a right-click position that is actually fresh, otherwise the
  // popup's "add note" button would reuse a stale context-menu spot.
  function takeContextPosition() {
    const context = lastContext;
    lastContext = null;
    if (!context || Date.now() - context.at > CONTEXT_POS_TTL_MS) return null;
    return { x: context.x, y: context.y };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return false;

    if (message.type === "STN_ADD_NOTE") {
      if (!enabled) {
        showToast(t("statusDisabled"));
        sendResponse({ ok: false, reason: "disabled" });
        return false;
      }
      addNote(takeContextPosition());
      sendResponse({ ok: true, count: notes.length });
      return false;
    }

    if (message.type === "STN_CLEAR_PAGE") {
      notes = [];
      renderAll();
      scheduleSave();
      flushSave();
      sendResponse({ ok: true, count: 0 });
      return false;
    }

    if (message.type === "STN_GET_COUNT") {
      sendResponse({ ok: true, count: notes.length, enabled });
      return false;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      renderAll();
    }

    const sKey = Core.storageKey(pageKey);
    if (!Object.prototype.hasOwnProperty.call(changes, sKey)) return;

    const incoming = Core.sanitizeNotes(changes[sKey].newValue);
    // Our own write, or a change that arrived mid-edit (our next save wins).
    if (Core.sameNotes(incoming, notes) || isBusy()) return;
    notes = incoming;
    Core.normalizeZ(notes);
    renderAll();
  });

  // -------------------------------------------------------------------- init

  async function init() {
    try {
      const data = await chrome.storage.local.get(["enabled"]);
      enabled = data.enabled !== false;
    } catch (error) {
      console.warn("[Sticky Notes] settings unavailable", error);
    }
    notes = await readNotes(pageKey);
    Core.normalizeZ(notes);
    renderAll();
    observeNavigation();
    observeHost();
  }

  // A debounced edit must not be lost when the tab goes away.
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });

  init();
})();
