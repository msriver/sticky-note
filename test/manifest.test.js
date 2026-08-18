const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const readJson = (file) => JSON.parse(read(file));

const manifest = readJson("manifest.json");
const locales = fs
  .readdirSync(path.join(root, "_locales"))
  .map((dir) => [dir, readJson(path.join("_locales", dir, "messages.json"))]);

test("manifest ships only the permissions the code actually uses", () => {
  assert.deepEqual(manifest.permissions.sort(), ["contextMenus", "storage"]);
  // Declared content scripts carry their own access; <all_urls> host_permissions
  // would only add a Web Store review burden.
  assert.equal(manifest.host_permissions, undefined);
});

test("every file the manifest references exists", () => {
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((entry) => [...(entry.js || []), ...(entry.css || [])]),
    ...Object.values(manifest.icons),
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }
});

test("the core module loads before the scripts that use it", () => {
  const js = manifest.content_scripts[0].js;
  assert.ok(js.indexOf("stn-core.js") < js.indexOf("content.js"));
  assert.ok(js.indexOf("styles.js") < js.indexOf("content.js"));
});

test("locales exist and agree on every key", () => {
  assert.ok(locales.length >= 2);
  assert.ok(locales.some(([dir]) => dir === manifest.default_locale));

  const [, base] = locales[0];
  for (const [dir, messages] of locales) {
    assert.deepEqual(
      Object.keys(messages).sort(),
      Object.keys(base).sort(),
      `_locales/${dir} has a different set of keys`
    );
    for (const [key, entry] of Object.entries(messages)) {
      assert.equal(typeof entry.message, "string", `${dir}/${key} has no message`);
      assert.ok(entry.message.length > 0, `${dir}/${key} is empty`);
    }
  }
});

test("every message key referenced in code is translated", () => {
  const sources = ["manifest.json", "background.js", "content.js", "popup.js", "popup.html"]
    .map(read)
    .join("\n");

  const used = new Set();
  for (const match of sources.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) used.add(match[1]);
  for (const match of sources.matchAll(/getMessage\(\s*"([A-Za-z0-9_]+)"/g)) used.add(match[1]);
  for (const match of sources.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)) used.add(match[1]);
  // content.js and popup.js call the strings through a t() helper.
  for (const match of sources.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)) used.add(match[1]);

  assert.ok(used.size > 5, "expected to find message keys in the sources");
  for (const [dir, messages] of locales) {
    for (const key of used) {
      assert.ok(messages[key], `_locales/${dir} is missing "${key}"`);
    }
  }
});
