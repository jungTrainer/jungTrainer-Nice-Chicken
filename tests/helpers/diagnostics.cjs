const fs = require("node:fs");
const path = require("node:path");
const resultRoot = path.resolve(__dirname, "../../test-results");
async function captureFailure({
  page,
  context,
  error,
  pageErrors,
  consoleMessages,
  browserVersion,
  options,
  caseNumber,
}) {
  const suite = path
    .basename(process.argv[1] || "browser")
    .replace(/[^\w.-]/g, "_");
  const folder = path.join(
    resultRoot,
    "failures",
    `${suite}-${process.pid}-${caseNumber}`,
  );
  fs.mkdirSync(folder, { recursive: true });
  const captureErrors = [];
  try {
    await page.screenshot({
      path: path.join(folder, "page.png"),
      fullPage: true,
      timeout: 5000,
    });
  } catch (e) {
    captureErrors.push("screenshot: " + e.message);
  }
  try {
    await context.tracing.stop({ path: path.join(folder, "trace.zip") });
  } catch (e) {
    captureErrors.push("trace: " + e.message);
  }
  fs.writeFileSync(
    path.join(folder, "failure.json"),
    JSON.stringify(
      {
        suite,
        caseNumber,
        createdAt: new Date().toISOString(),
        browserVersion,
        viewport: options.viewport || { width: 390, height: 844 },
        live: options.live || false,
        error: error.stack || String(error),
        pageErrors,
        consoleMessages,
        captureErrors,
      },
      null,
      2,
    ),
  );
  console.error("Failure diagnostics:", path.relative(process.cwd(), folder));
}
module.exports = { captureFailure, resultRoot };
