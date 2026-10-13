const { chromium } = require("playwright");
function browserOptions() {
  return {
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath(),
  };
}
module.exports = { browserOptions };
