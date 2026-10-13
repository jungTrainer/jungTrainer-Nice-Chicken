const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { test } = require("node:test");
const { build } = require("../scripts/build-pwa.cjs");
test("forgotten release regeneration fails read-only check, rebuilt versions are deterministic", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "nice-chicken-release-check-"),
  );
  const source = path.resolve(__dirname, "..");
  try {
    for (const file of [
      "index.html",
      "sw.js",
      "manifest.json",
      "icon-192.png",
      "icon-512.png",
      "js",
      "css",
      ...[1, 2, 3, 4, 5].map((n) => `END_0${n}.png`),
      "END_SOUND.mp3",
    ])
      fs.cpSync(path.join(source, file), path.join(root, file), {
        recursive: true,
      });
    const original = build(root, true).version;
    fs.appendFileSync(
      path.join(root, "js/core/config.js"),
      "\n// synthetic release change\n",
    );
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    assert.throws(() => build(root, true), /PWA release is stale/);
    assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), html);
    const next = build(root).version;
    assert.notEqual(next, original);
    assert.equal(build(root, true).version, next);
    assert.equal(build(root).version, next);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
