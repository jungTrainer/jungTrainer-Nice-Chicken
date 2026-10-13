const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { startHeadedContext } = require("./display.cjs");
const { chromium } = require("playwright");
const { browserOptions } = require("./browser-options.cjs");
(async () => {
  const expected = fs.readFileSync(".nvmrc", "utf8").trim();
  console.log("Node:", process.version, "(CI pin:", expected + ")");
  if (Number(process.versions.node.split(".")[0]) < 20)
    throw Error(
      "Node 20 or newer is required; use the .nvmrc version for CI parity.",
    );
  console.log("Playwright:", require("playwright/package.json").version);
  const options = browserOptions();
  console.log("Chromium executable:", options.executablePath);
  fs.accessSync(options.executablePath, fs.constants.X_OK);
  let browser;
  try {
    browser = await chromium.launch(options);
    const page = await browser.newPage();
    await page.setContent('<button id="ready">ready</button>');
    if ((await page.locator("#ready").textContent()) !== "ready")
      throw Error("Browser DOM smoke failed");
    console.log("Chromium:", browser.version());
    console.log("Browser launch and DOM smoke: OK");
  } finally {
    await browser?.close();
  }
  const profile = fs.mkdtempSync(
    path.join(os.tmpdir(), "nice-chicken-doctor-"),
  );
  let native;
  try {
    native = await startHeadedContext(profile);
    const a = await native.context.newPage(),
      b = await native.context.newPage();
    await a.setContent("<title>Background probe</title>");
    await b.bringToFront();
    await a.waitForFunction(() => document.hidden, null, {
      polling: 100,
      timeout: 5000,
    });
    await a.bringToFront();
    await a.waitForFunction(() => !document.hidden, null, {
      polling: 100,
      timeout: 5000,
    });
    console.log("Native headed Chromium hide/resume (no focus emulation): OK");
  } finally {
    await native?.stop();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error.message);
  console.error(
    "Install the locked browser: npx playwright install chromium --no-shell",
  );
  console.error(
    "Missing Linux libraries: npx playwright install-deps chromium (administrator access required).",
  );
  console.error(
    "For an existing browser set PLAYWRIGHT_CHROMIUM_EXECUTABLE to its executable path.",
  );
  console.error(
    "Linux visibility checks require Xvfb or DISPLAY; use PLAYWRIGHT_XVFB_EXECUTABLE for a verified local Xvfb.",
  );
  process.exitCode = 1;
});
