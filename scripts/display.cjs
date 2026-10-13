// Real X11 display for the single headed visibility case. No global DISPLAY mutation.
const { spawn } = require("node:child_process");
async function startDisplay() {
  if (process.env.DISPLAY)
    return { display: process.env.DISPLAY, stop: async () => {} };
  const child = spawn(
    process.env.PLAYWRIGHT_XVFB_EXECUTABLE || "Xvfb",
    ["-displayfd", "1", "-screen", "0", "1280x1024x24", "-nolisten", "tcp"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (b) => {
    stderr = (stderr + b).slice(-4000);
  });
  const display = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("Xvfb startup timed out: " + stderr));
    }, 10000);
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(
        Error(
          "Headed Chromium requires Xvfb or DISPLAY. Install Xvfb or set PLAYWRIGHT_XVFB_EXECUTABLE. " +
            e.message,
        ),
      );
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error("Xvfb exited " + code + ": " + stderr));
    });
    child.stdout.on("data", (b) => {
      output += b;
      if (/^\d+\n/.test(output)) {
        clearTimeout(timer);
        resolve(":" + output.trim());
      }
    });
  });
  return {
    display,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill("SIGTERM");
      }),
  };
}
module.exports = { startDisplay };
// Attach without Playwright focus emulation: a separate CDP session cannot undo
// the focus override on Playwright's own session. Use the documented noDefaults.
async function startHeadedContext(profile) {
  const fs = require("node:fs");
  const path = require("node:path");
  const { chromium } = require("playwright");
  const { browserOptions } = require("./browser-options.cjs");
  fs.mkdirSync(profile, { recursive: true });
  const display = await startDisplay();
  const child = spawn(
    browserOptions().executablePath,
    [
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "--remote-debugging-address=127.0.0.1",
      "--no-first-run",
      "--no-sandbox",
      "--no-default-browser-check",
      "--disable-dev-shm-usage",
      // Connect before creating pages; avoid a default-context attach/init race.
      "--no-startup-window",
    ],
    {
      env: {
        ...process.env,
        DISPLAY: display.display,
        XDG_DATA_HOME: path.join(profile, "xdg-data"),
        XDG_CONFIG_HOME: path.join(profile, "xdg-config"),
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let errors = "",
    failure,
    browser;
  child.stderr.on("data", (b) => {
    errors = (errors + b).slice(-4000);
  });
  child.once("error", (e) => {
    failure = e;
  });
  async function stop() {
    await browser?.close();
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      await new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill("SIGTERM");
      });
    }
    await display.stop();
  }
  try {
    const deadline = Date.now() + 10000,
      portfile = path.join(profile, "DevToolsActivePort");
    while (!fs.existsSync(portfile)) {
      if (failure) throw failure;
      if (
        child.exitCode !== null ||
        child.signalCode !== null ||
        Date.now() > deadline
      )
        throw Error("Native Chromium startup failed: " + errors);
      await new Promise((r) => setTimeout(r, 50));
    }
    const port = fs.readFileSync(portfile, "utf8").split("\n")[0];
    browser = await chromium.connectOverCDP("http://127.0.0.1:" + port, {
      noDefaults: true,
    });
    return { context: browser.contexts()[0], stop };
  } catch (e) {
    await stop();
    throw e;
  }
}
module.exports.startHeadedContext = startHeadedContext;
