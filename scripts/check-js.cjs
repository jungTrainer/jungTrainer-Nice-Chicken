const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
require("./build-pwa.cjs").build(process.cwd(), true);
for (const file of [
  "js/main.js",
  ...fs
    .readdirSync("js/core")
    .filter((f) => f.endsWith(".js"))
    .map((f) => "js/core/" + f),
  "sw.js",
  ...["scripts", "tests/helpers"].flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".cjs"))
      .map((f) => dir + "/" + f),
  ),
]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  console.log("Syntax OK: " + file);
}
