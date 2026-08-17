(() => {
  if (window.__stickyNotesInjected) return;
  window.__stickyNotesInjected = true;

  const COLORS = ["#fff6a9", "#ffd6e8", "#c9f0ff", "#d6ffd6", "#e0d6ff"];
  const DEFAULT_WIDTH = 220;
  const DEFAULT_HEIGHT = 160;

  let notes = [];
  let enabled = true;
  let topZ = 2147483000;
  let lastContextPos = null;
  let saveTimer = null;

  const pageKey = () => location.origin + location.pathname + location.search;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNotes, 300);
  }

  async function persistNotes() {
    clearTimeout(saveTimer);
    const data = await chrome.storage.local.get(["notes"]);
    const all = data.notes || {};
    if (notes.length) {
      all[pageKey()] = notes;
    } else {
      delete all[pageKey()];
    }
    await chrome.storage.local.set({ notes: all });
  }

  function bringToFront(el) {
    topZ += 1;
    el.style.zIndex = String(topZ);
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
    el.style.zIndex = String(note.z || topZ);

    const header = document.createElement("div");
    header.className = "stn-header";

    const colors = document.createElement("div");
    colors.className = "stn-colors";
    COLORS.forEach((c) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "stn-color-dot" + (c === note.color ? " stn-active" : "");
      dot.style.background = c;
      dot.title = "색상 변경";
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        note.color = c;
        el.style.background = c;
        colors.querySelectorAll(".stn-color-dot").forEach((d) => d.classList.remove("stn-active"));
        dot.classList.add("stn-active");
        scheduleSave();
      });
      colors.appendChild(dot);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "stn-delete";
    delBtn.title = "삭제";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeNote(note.id, el);
    });

    header.appendChild(colors);
    header.appendChild(delBtn);

    const body = document.createElement("div");
    body.className = "stn-body";
    body.contentEditable = "true";
    body.dataset.placeholder = "메모를 입력하세요...";
    body.textContent = note.text || "";
    body.addEventListener("input", () => {
      note.text = body.textContent;
      scheduleSave();
    });
    body.addEventListener("mousedown", (e) => e.stopPropagation());
    body.addEventListener("focus", () => bringToFront(el));

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "stn-resize-handle";

    el.appendChild(header);
    el.appendChild(body);
    el.appendChild(resizeHandle);

    attachDrag(el, header, note);
    attachResize(el, resizeHandle, note);

    el.addEventListener("mousedown", () => bringToFront(el));

    return el;
  }

  function attachDrag(el, handle, note) {
    let startX, startY, startLeft, startTop;
    function onMouseMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, startLeft + dx);
      const newTop = Math.max(0, startTop + dy);
      el.style.left = newLeft + "px";
      el.style.top = newTop + "px";
      note.x = newLeft;
      note.y = newTop;
    }
    function onMouseUp() {
      el.classList.remove("stn-dragging");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      scheduleSave();
    }
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".stn-delete") || e.target.closest(".stn-color-dot")) return;
      e.preventDefault();
      bringToFront(el);
      el.classList.add("stn-dragging");
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.offsetLeft;
      startTop = el.offsetTop;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  function attachResize(el, handle, note) {
    let startX, startY, startW, startH;
    function onMouseMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newW = Math.max(140, startW + dx);
      const newH = Math.max(110, startH + dy);
      el.style.width = newW + "px";
      el.style.height = newH + "px";
      note.w = newW;
      note.h = newH;
    }
    function onMouseUp() {
      el.classList.remove("stn-resizing");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      scheduleSave();
    }
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      bringToFront(el);
      el.classList.add("stn-resizing");
      startX = e.clientX;
      startY = e.clientY;
      startW = el.offsetWidth;
      startH = el.offsetHeight;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  function removeNote(id, el) {
    notes = notes.filter((n) => n.id !== id);
    el.remove();
    scheduleSave();
  }

  function renderAll() {
    document.querySelectorAll(".stn-note").forEach((el) => el.remove());
    if (!enabled) return;
    notes.forEach((note) => {
      document.body.appendChild(createNoteElement(note));
    });
  }

  function addNote(pos) {
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const x = pos ? pos.x : scrollX + Math.max(20, window.innerWidth / 2 - DEFAULT_WIDTH / 2);
    const y = pos ? pos.y : scrollY + Math.max(20, window.innerHeight / 2 - DEFAULT_HEIGHT / 2);
    topZ += 1;
    const note = {
      id: "n" + Date.now() + Math.random().toString(36).slice(2, 7),
      text: "",
      x,
      y,
      w: DEFAULT_WIDTH,
      h: DEFAULT_HEIGHT,
      color: COLORS[0],
      z: topZ,
    };
    notes.push(note);
    const el = createNoteElement(note);
    document.body.appendChild(el);
    scheduleSave();
    const body = el.querySelector(".stn-body");
    body.focus();
  }

  document.addEventListener(
    "contextmenu",
    (e) => {
      lastContextPos = { x: (window.scrollX || 0) + e.clientX, y: (window.scrollY || 0) + e.clientY };
    },
    true
  );

  async function init() {
    const data = await chrome.storage.local.get(["notes", "enabled"]);
    enabled = data.enabled !== false;
    notes = (data.notes && data.notes[pageKey()]) || [];
    notes.forEach((n) => {
      if (n.z && n.z > topZ) topZ = n.z;
    });
    renderAll();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      renderAll();
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "STN_ADD_NOTE") {
      if (!enabled) {
        sendResponse({ ok: false, reason: "disabled" });
        return;
      }
      addNote(lastContextPos);
      lastContextPos = null;
      sendResponse({ ok: true });
    } else if (msg && msg.type === "STN_CLEAR_PAGE") {
      notes = [];
      renderAll();
      scheduleSave();
      sendResponse({ ok: true });
    } else if (msg && msg.type === "STN_GET_COUNT") {
      sendResponse({ ok: true, count: notes.length, enabled });
    }
    return true;
  });

  init();
})();
