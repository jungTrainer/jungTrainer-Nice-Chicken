const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
for (const file of [
  "js/main.js",
  ...fs
    .readdirSync("js/core")
    .filter((f) => f.endsWith(".js"))
    .map((f) => "js/core/" + f),
  "sw.js",
]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  console.log("Syntax OK: " + file);
}
