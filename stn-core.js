/**
 * Pure helpers shared by the content script, the service worker and the tests.
 * No DOM and no chrome.* access in here, so it can run under `node --test`.
 */
(function (root, factory) {
  const api = factory();
  root.STNCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const COLORS = ["#fff6a9", "#ffd6e8", "#c9f0ff", "#d6ffd6", "#e0d6ff"];
  const DEFAULT_WIDTH = 220;
  const DEFAULT_HEIGHT = 160;
  const MIN_WIDTH = 140;
  const MIN_HEIGHT = 110;
  const MAX_TEXT = 20000;
  const STORAGE_PREFIX = "n:";

  function toNumber(value, fallback) {
    const n = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampRange(value, min, max) {
    if (max < min) max = min;
    return Math.min(Math.max(value, min), max);
  }

  /** Page identity: origin + pathname + search. The hash is deliberately ignored. */
  function pageKeyFromUrl(href) {
    try {
      const url = new URL(href);
      return url.origin + url.pathname + url.search;
    } catch {
      return String(href || "").split("#")[0];
    }
  }

  /** Every page gets its own storage key, so two pages can never overwrite each other. */
  function storageKey(pageKey) {
    return STORAGE_PREFIX + pageKey;
  }

  function isNoteKey(key) {
    return typeof key === "string" && key.startsWith(STORAGE_PREFIX);
  }

  function newId() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function sanitizeNote(raw) {
    if (!raw || typeof raw !== "object") return null;
    const w = Math.round(Math.max(MIN_WIDTH, toNumber(raw.w, DEFAULT_WIDTH)));
    const h = Math.round(Math.max(MIN_HEIGHT, toNumber(raw.h, DEFAULT_HEIGHT)));
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
      text: typeof raw.text === "string" ? raw.text.slice(0, MAX_TEXT) : "",
      x: Math.round(Math.max(0, toNumber(raw.x, 0))),
      y: Math.round(Math.max(0, toNumber(raw.y, 0))),
      w,
      h,
      color: COLORS.includes(raw.color) ? raw.color : COLORS[0],
      z: Math.max(0, Math.round(toNumber(raw.z, 0))),
    };
  }

  function sanitizeNotes(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      const note = sanitizeNote(raw);
      if (!note || seen.has(note.id)) continue;
      seen.add(note.id);
      out.push(note);
    }
    return out;
  }

  function serializeNote(note) {
    return {
      id: note.id,
      text: note.text,
      x: note.x,
      y: note.y,
      w: note.w,
      h: note.h,
      color: note.color,
      z: note.z,
    };
  }

  /**
   * Rewrites stacking order to a dense 1..n range, in place.
   * Notes live in their own shadow-root stacking context, so small integers are
   * enough and the old "increment towards 2147483647 forever" overflow is gone.
   */
  function normalizeZ(list) {
    const sorted = list.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    sorted.forEach((note, index) => {
      note.z = index + 1;
    });
    return list;
  }

  function maxZ(list) {
    return list.reduce((max, note) => Math.max(max, note.z || 0), 0);
  }

  function createNote(options) {
    const opts = options || {};
    return sanitizeNote({
      id: newId(),
      text: "",
      x: opts.x,
      y: opts.y,
      w: opts.w != null ? opts.w : DEFAULT_WIDTH,
      h: opts.h != null ? opts.h : DEFAULT_HEIGHT,
      color: opts.color || COLORS[0],
      z: opts.z != null ? opts.z : 1,
    });
  }

  /** Keeps a note inside the document so dragging can never grow the scroll area. */
  function clampPosition(x, y, w, h, bounds) {
    return {
      x: Math.round(clampRange(x, 0, bounds.w - w)),
      y: Math.round(clampRange(y, 0, bounds.h - h)),
    };
  }

  function clampSize(w, h, x, y, bounds) {
    return {
      w: Math.round(clampRange(w, MIN_WIDTH, Math.max(MIN_WIDTH, bounds.w - x))),
      h: Math.round(clampRange(h, MIN_HEIGHT, Math.max(MIN_HEIGHT, bounds.h - y))),
    };
  }

  /** Cheap structural comparison used to ignore storage events we caused ourselves. */
  function sameNotes(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const x = a[i];
      const y = b[i];
      if (
        x.id !== y.id ||
        x.text !== y.text ||
        x.x !== y.x ||
        x.y !== y.y ||
        x.w !== y.w ||
        x.h !== y.h ||
        x.color !== y.color ||
        x.z !== y.z
      ) {
        return false;
      }
    }
    return true;
  }

  /** Pre-1.1 storage kept every page inside a single `notes` object. */
  function migrateLegacyNotes(legacy) {
    const out = {};
    if (!legacy || typeof legacy !== "object") return out;
    for (const [key, value] of Object.entries(legacy)) {
      const notes = sanitizeNotes(value);
      if (notes.length) out[storageKey(key)] = notes.map(serializeNote);
    }
    return out;
  }

  return {
    COLORS,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    MIN_WIDTH,
    MIN_HEIGHT,
    MAX_TEXT,
    STORAGE_PREFIX,
    pageKeyFromUrl,
    storageKey,
    isNoteKey,
    newId,
    sanitizeNote,
    sanitizeNotes,
    serializeNote,
    normalizeZ,
    maxZ,
    createNote,
    clampPosition,
    clampSize,
    clampRange,
    sameNotes,
    migrateLegacyNotes,
  };
});
