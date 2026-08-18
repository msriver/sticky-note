const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../stn-core.js");

test("pageKeyFromUrl keeps the query but drops the hash", () => {
  assert.equal(Core.pageKeyFromUrl("https://a.com/p?q=1#frag"), "https://a.com/p?q=1");
  assert.equal(Core.pageKeyFromUrl("https://a.com/p#a"), Core.pageKeyFromUrl("https://a.com/p#b"));
  assert.notEqual(Core.pageKeyFromUrl("https://a.com/p?q=1"), Core.pageKeyFromUrl("https://a.com/p?q=2"));
});

test("pageKeyFromUrl survives junk input", () => {
  assert.equal(Core.pageKeyFromUrl("not a url#x"), "not a url");
  assert.equal(Core.pageKeyFromUrl(undefined), "");
});

test("each page gets its own storage key", () => {
  const a = Core.storageKey("https://a.com/1");
  const b = Core.storageKey("https://a.com/2");
  assert.notEqual(a, b);
  assert.ok(Core.isNoteKey(a));
  assert.ok(!Core.isNoteKey("enabled"));
});

test("normalizeZ produces a dense 1..n range and cannot drift upwards", () => {
  const notes = [{ z: 2147483000 }, { z: 2147483600 }, { z: 5 }];
  Core.normalizeZ(notes);
  assert.deepEqual(notes.map((n) => n.z), [2, 3, 1]);
  assert.equal(Core.maxZ(notes), 3);

  // Repeated "bring to front" cycles stay bounded instead of climbing to int32.
  for (let i = 0; i < 1000; i += 1) {
    notes[i % notes.length].z = Core.maxZ(notes) + 1;
    Core.normalizeZ(notes);
  }
  assert.equal(Core.maxZ(notes), notes.length);
});

test("sanitizeNote repairs or rejects bad records", () => {
  assert.equal(Core.sanitizeNote(null), null);
  assert.equal(Core.sanitizeNote("nope"), null);

  const note = Core.sanitizeNote({ id: "n1", x: -50, y: "40", w: 10, h: NaN, color: "red", z: -3 });
  assert.equal(note.x, 0);
  assert.equal(note.y, 40);
  assert.equal(note.w, Core.MIN_WIDTH);
  assert.equal(note.h, Core.DEFAULT_HEIGHT);
  assert.equal(note.color, Core.COLORS[0]);
  assert.equal(note.z, 0);
  assert.equal(note.text, "");
});

test("sanitizeNotes drops duplicates and non-objects", () => {
  const list = Core.sanitizeNotes([{ id: "a" }, { id: "a" }, null, 7, { id: "b" }]);
  assert.deepEqual(list.map((n) => n.id), ["a", "b"]);
  assert.deepEqual(Core.sanitizeNotes("not an array"), []);
});

test("note text is bounded so one note cannot eat the storage quota", () => {
  const note = Core.sanitizeNote({ id: "a", text: "x".repeat(Core.MAX_TEXT + 500) });
  assert.equal(note.text.length, Core.MAX_TEXT);
});

test("clampPosition keeps a note inside the document", () => {
  const bounds = { w: 1000, h: 800 };
  assert.deepEqual(Core.clampPosition(-40, -40, 220, 160, bounds), { x: 0, y: 0 });
  assert.deepEqual(Core.clampPosition(5000, 5000, 220, 160, bounds), { x: 780, y: 640 });
  assert.deepEqual(Core.clampPosition(100, 100, 220, 160, bounds), { x: 100, y: 100 });
});

test("clampPosition degrades to 0 when the note is wider than the page", () => {
  assert.deepEqual(Core.clampPosition(50, 50, 400, 300, { w: 200, h: 150 }), { x: 0, y: 0 });
});

test("clampSize respects both the minimum and the remaining space", () => {
  const bounds = { w: 1000, h: 800 };
  assert.deepEqual(Core.clampSize(10, 10, 0, 0, bounds), { w: Core.MIN_WIDTH, h: Core.MIN_HEIGHT });
  assert.deepEqual(Core.clampSize(5000, 5000, 300, 200, bounds), { w: 700, h: 600 });
});

test("sameNotes detects any field change", () => {
  const a = [Core.sanitizeNote({ id: "1", text: "hi", x: 1, y: 2 })];
  const b = [Core.sanitizeNote({ id: "1", text: "hi", x: 1, y: 2 })];
  assert.ok(Core.sameNotes(a, b));

  b[0].text = "bye";
  assert.ok(!Core.sameNotes(a, b));
  assert.ok(!Core.sameNotes(a, []));
  assert.ok(!Core.sameNotes(a, null));
});

test("createNote is always a valid, saveable note", () => {
  const note = Core.createNote({ x: 12, y: 34 });
  assert.deepEqual(Core.serializeNote(note), note);
  assert.equal(note.w, Core.DEFAULT_WIDTH);
  assert.ok(note.id.length > 1);
});

test("legacy storage is split into one key per page", () => {
  const migrated = Core.migrateLegacyNotes({
    "https://a.com/1": [{ id: "a", text: "one" }],
    "https://a.com/2": [{ id: "b", text: "two" }],
    "https://a.com/3": [],
    "https://a.com/4": "garbage",
  });
  assert.deepEqual(Object.keys(migrated).sort(), [
    Core.storageKey("https://a.com/1"),
    Core.storageKey("https://a.com/2"),
  ].sort());
  assert.equal(migrated[Core.storageKey("https://a.com/1")][0].text, "one");
  assert.deepEqual(Core.migrateLegacyNotes(undefined), {});
});
