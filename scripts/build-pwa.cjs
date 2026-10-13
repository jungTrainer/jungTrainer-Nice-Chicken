// Deterministic static release; --check is read-only and runs in npm run check.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const sri = (bytes) =>
  "sha256-" + crypto.createHash("sha256").update(bytes).digest("base64");
function build(root, check = false) {
  const read = (file) => fs.readFileSync(path.join(root, file));
  const original = read("index.html").toString();
  const normalized = original
    .replace(
      /(<meta name="app-version" content=")[^"]*("\s*\/>)/,
      "$1unbuilt$2",
    )
    .replace(/ integrity="[^"]*" crossorigin="anonymous"/g, "");
  const scripts = [...normalized.matchAll(/<script src="\.\/([^\"]+)"/g)].map(
    (m) => m[1],
  );
  const styles = [
    ...normalized.matchAll(/<link rel="stylesheet" href="\.\/([^\"]+)"/g),
  ].map((m) => m[1]);
  const files = [
    ...new Set([
      ...scripts,
      ...styles,
      "manifest.json",
      "icon-192.png",
      "icon-512.png",
    ]),
  ];
  const workerOriginal = read("sw.js").toString();
  const workerSource = workerOriginal.replace(
    /\/\/ BEGIN PWA RELEASE[\s\S]*?\/\/ END PWA RELEASE/,
    "// PWA GENERATED",
  );
  const optional = [
    "END_01.png",
    "END_02.png",
    "END_03.png",
    "END_04.png",
    "END_05.png",
    "END_SOUND.mp3",
  ];
  const version =
    "imp12-" +
    hash(
      JSON.stringify([
        normalized,
        workerSource,
        ...[...files, ...optional].map((file) => [file, hash(read(file))]),
      ]),
    ).slice(0, 20);
  let html = normalized.replace('content="unbuilt"', `content="${version}"`);
  for (const file of scripts)
    html = html.replace(
      `<script src="./${file}"`,
      `<script src="./${file}" integrity="${sri(read(file))}" crossorigin="anonymous"`,
    );
  for (const file of styles)
    html = html.replace(
      `<link rel="stylesheet" href="./${file}"`,
      `<link rel="stylesheet" href="./${file}" integrity="${sri(read(file))}" crossorigin="anonymous"`,
    );
  const mime = (file) =>
    ({
      ".html": "text/html",
      ".js": "javascript",
      ".css": "text/css",
      ".json": "json",
      ".png": "image/png",
      ".mp3": "audio/mpeg",
    })[path.extname(file)];
  const asset = (file) => ({
    path: file,
    hash: hash(file === "index.html" ? html : read(file)),
    mime: mime(file),
  });
  const release = {
    version,
    required: ["index.html", ...files].map(asset),
    optional: optional.map(asset),
  };
  const worker = workerOriginal.replace(
    /\/\/ BEGIN PWA RELEASE[\s\S]*?\/\/ END PWA RELEASE/,
    `// BEGIN PWA RELEASE\nconst RELEASE = ${JSON.stringify(release, null, 2)};\n// END PWA RELEASE`,
  );
  if (check) {
    if (html !== original || worker !== workerOriginal)
      throw Error(
        "PWA release is stale. Run npm run pwa:build and commit index.html + sw.js.",
      );
  } else {
    fs.writeFileSync(path.join(root, "index.html"), html);
    fs.writeFileSync(path.join(root, "sw.js"), worker);
  }
  return release;
}
if (require.main === module)
  console.log(
    "PWA release OK: " +
      build(path.resolve(__dirname, ".."), process.argv.includes("--check"))
        .version,
  );
module.exports = { build };
