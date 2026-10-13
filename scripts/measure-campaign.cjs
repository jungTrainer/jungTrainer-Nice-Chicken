// Reproducible Chromium work counts; timings are diagnostics, not pass thresholds.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const root = path.resolve(process.argv[2] || ".");
  const mode = process.argv[3] || "legacy";
  const channel = process.argv[4] || "auto";
  const proposal = JSON.parse(process.argv[5] || "null");
  if (!["legacy", "easy", "normal"].includes(mode) || !["auto", "active", "offline"].includes(channel)) throw Error("Unknown mode/channel");
  const policy = "legacy";
  const server = http.createServer((req, res) => {
    const file = path.resolve(
      root,
      "." +
        new URL(req.url, "http://localhost").pathname.replace(
          /^\/$/,
          "/index.html",
        ),
    );
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
      );
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch(
      require("./browser-options.cjs").browserOptions(),
    );
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      timezoneId: "Asia/Seoul",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await page.addInitScript(() => {
      Date.now = () => Date.UTC(2026, 9, 12, 12);
      requestAnimationFrame = () => 1;
      cancelAnimationFrame = () => {};
    });
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.waitForFunction(() => typeof SessionOwner !== "undefined" && SessionOwner.mode !== "starting", null, { polling: 100, timeout: 20000 });
    await page.evaluate(() => SessionOwner.ready);
    const result = await page.evaluate(({mode, channel, proposal}) => {
      const defaults = {
        legacy: {costs: REGIONS.map(r=>r.unlockCost), goals: null, ending: ENDING_MONEY},
        easy: {costs: [0,1000000,500000000,50000000000,5000000000000,500000000000000], goals:[40000000,100000000000,100000000000000,"5000000000000000","200000000000000000","20000000000000000000"], ending:"20000000000000000000"},
        normal: {costs:[0,500000000,200000000000,100000000000000,"5000000000000000","200000000000000000"], goals:[10000000000,200000000000,200000000000000,"10000000000000000","400000000000000000","40000000000000000000"], ending:"225000000000000000000"},
      };
      const rules = proposal || (typeof Campaign !== "undefined" ? Campaign.rules(mode) : defaults[mode]);
      const cost = r => Number(rules.costs[REGIONS.findIndex(v=>v.id===r.id)]);
      const target = Number(rules.ending);
      const policy = "legacy";

      const num = (v) => Number(v);
      const rows = [];
      const reset = () => {
        state = defaultState();
        sanitizeState();
        state.soundOn = false;
        if (state.campaign) state.campaign.mode = mode;
        if (typeof defaultManagement === "function" && policy !== "legacy") {
          const [focus, staff] = policy.split("-");
          if (focus === "signature") {
            state.management.menuPolicy = "signature";
            state.management.featuredMenu = staff;
          } else {
            state.management.focus = focus;
            state.management.leadStaff = staff;
          }
        }
      };
      const rate = () => {
        const r = computeRates(),
          e = r.eff;
        const prices = (
          typeof getOrderMenuPool === "function"
            ? getOrderMenuPool()
            : MENUS.slice(0, getOpenMenuCount())
        ).map((m) => num(getMenuPrice(m.id, e)));
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        // 40 midpoint samples of the real random interval, including the 12% rest.
        let ms = 0;
        const original = Math.random;
        for (let i = 0; i < 40; i++)
          for (const [rest, weight] of [
            [false, 0.88],
            [true, 0.12],
          ]) {
            let call = 0;
            Math.random = () => (call++ === 0 ? (i + 0.5) / 40 : rest ? 0 : 1);
            ms +=
              (computeDeliveryIntervalMs(
                VEHICLES[Math.min(9, state.delivery.level)],
              ) *
                weight) /
              40;
          }
        Math.random = original;
        const served = channel === "active" ? r.ordersPerMin : channel === "offline" ? r.autoServesPerMin : Math.min(r.ordersPerMin, r.autoServesPerMin * 2);
        const delivery = state.delivery.riders > 0 ? 60000 / ms : 0;
        return {
          avgPrice: avg,
          servedPerMin: served,
          deliveryPerMin: delivery,
          incomePerMin: channel === "offline" ? avg * served * (0.85 + (state.rep / 5) * 0.2) :
            avg *
            (served * (1 + r.tipChance * r.tipMul + 0.01) +
              delivery * (1 + (e.deliveryEarningMul || 0)) +
              r.onlineOrdersPerMin *
                (1 + (e.onlineMul || 0)) *
                (1 + (e.onlineEarningMul || 0))),
        };
      };
      for (const region of REGIONS) {
        reset();
        state.regionId = region.id;
        state.level = 999;
        for (const u of UPGRADES) state.upgrades[u.id] = u.maxLevel;
        state.delivery = { level: 10, riders: 10 };
        for (const s of STAFF_POOL)
          state.staffStats[s.key] = { auto: 10, tip: 10, earned: 0 };
        for (const r of RESEARCH) state.research.levels[r.id] = 10;
        for (const m of MENUS) state.menuLevels[m.id] = 10;
        const r = rate();
        rows.push({
          region: region.id,
          ...r,
          nextUnlockMinutes: cost(getNextRegion()) / r.incomePerMin,
          endingYearsFromZero:
            target / r.incomePerMin / 60 / 24 / 365,
        });
      }
      reset();
      state.money = 2 ** 53;
      recordIncome(1, { menuId: "fried", count: 1 });
      const lost = {
        start: 2 ** 53,
        after: state.money,
        sales: state.totalSales,
      };
      state.menuLevels.fried = 1200;
      const overflowCost =
        typeof menuResearchCost === "function"
          ? String(menuResearchCost(1200))
          : String(Math.floor(100000 * Math.pow(1.8, 1200)));
      reset();
      // Optimistic automated growth model. Continuous orders, no crowd loss or events;
      // one real-duration research slot, branch research restarts on moving;
      // shared staff education; menu research capped at 10 for the measurement only.
      const milestones = [],
        levels = [],
        chapters = [],
        running = [];
      let minute = 0,
        arrivedAt = 0,
        nextLevel = 10,
        ending = null;
      const candidates = () => {
        const list = [];
        for (const u of UPGRADES)
          if ((state.upgrades[u.id] || 0) < u.maxLevel) {
            const cur = state.upgrades[u.id] || 0;
            list.push({
              cost: num(upgradeCost(u.id, cur)),
              change: (delta) => {
                state.upgrades[u.id] = cur + delta;
                if (u.id === "deliRider") state.delivery.riders = cur + delta;
                if (u.id === "deliVehicle") state.delivery.level = cur + delta;
              },
            });
          }
        for (const s of getHiredStaff())
          for (const k of ["auto", "tip"]) {
            const cur = state.staffStats[s.key][k];
            if (cur < 10)
              list.push({
                cost: num(staffUpgradeCost(s.key, k, cur)),
                change: (d) => (state.staffStats[s.key][k] = cur + d),
              });
          }
        for (const m of MENUS.slice(0, getOpenMenuCount())) {
          const cur = state.menuLevels[m.id] || 0;
          if (cur < 10)
            list.push({
              cost:
                typeof menuResearchCost === "function"
                  ? num(menuResearchCost(cur))
                  : Math.floor(100000 * 1.8 ** cur),
              change: (d) => (state.menuLevels[m.id] = cur + d),
            });
        }
        return list;
      };
      // Thirty days is a censoring horizon, not an estimated ending time.
      for (minute = 0; minute < 43200; minute++) {
        // Offline-only schedule: one short return each eight hours. No purchases/new research
        // while absent; use the previous completed effects for the capped absence receipt.
        if (channel === "offline" && minute % 480 !== 0) continue;
        const absenceIncome = channel === "offline" && minute > 0 ? rate().incomePerMin * 480 : null;
        if (running[0] && running[0].end <= minute) {
          state.research.levels[running[0].id]++;
          running.length = 0;
        }
        if (!running.length) {
          const r = RESEARCH.filter(
            (r) =>
              (state.research.levels[r.id] || 0) < 10 &&
              Object.keys(r.effectPerLevel).some((k) =>
                [
                  "earningMul",
                  "baseAutoAdd",
                  "autoServeMul",
                  "staffSpeedMul",
                  "ordersMul",
                  "deliveryFreqMul",
                  "onlineFreqMul",
                  "deliveryEarningMul",
                  "onlineEarningMul",
                ].includes(k),
              ),
          ).sort(
            (a, b) =>
              a.baseMin * a.timeScale ** (state.research.levels[a.id] || 0) -
              b.baseMin * b.timeScale ** (state.research.levels[b.id] || 0),
          )[0];
          if (r) {
            state.research.levels[r.id] ||= 0;
            running.push({
              id: r.id,
              end:
                minute + r.baseMin * r.timeScale ** state.research.levels[r.id],
            });
          }
        }
        const rpm = absenceIncome ?? rate().incomePerMin;
        state.money = num(state.money) + rpm;
        state.totalSales = num(state.totalSales) + rpm;
        if (minute && minute % 1440 === 0)
          state.money -= getStaffCount() * 80000;
        for (let lv = state.level + 1; lv <= CONFIG.maxLevel; lv++) {
          if (num(state.totalSales) >= num(CONFIG.levelUpTotalSales[lv]))
            state.level = lv;
          else break;
        }
        if (state.level >= nextLevel) {
          levels.push({ level: state.level, minute });
          nextLevel = nextLevel === 10 ? 100 : nextLevel === 100 ? 500 : 999;
          if (state.level >= 999) nextLevel = 1000;
        }
        const goal = rules.goals?.[REGIONS.findIndex(r=>r.id===state.regionId)];
        if (goal && !chapters.some(c=>c.region===state.regionId) && num(state.totalSales)>=num(goal))
          chapters.push({region:state.regionId, minute, localMinutes:minute-arrivedAt, required:String(goal)});
        const chapterReady = !goal || chapters.some(c=>c.region===state.regionId);
        if (num(state.money) >= target && (mode === "legacy" || chapters.length === REGIONS.length)) {
          ending = minute;
          break;
        }
        const next = getNextRegion();
        if (
          chapterReady && next.id !== state.regionId &&
          num(state.money) >= cost(next)
        ) {
          const money = num(state.money) - cost(next),
            stats = state.staffStats;
          milestones.push({ region: next.id, minute });
          reset();
          state.money = money;
          state.staffStats = stats;
          state.regionId = next.id;
          running.length = 0;
          arrivedAt = minute;
          continue;
        }
        // Buy the best expected revenue gain per cost when affordable, max 40 per minute.
        for (let n = 0; n < 40; n++) {
          const before = rate().incomePerMin;
          let best = null,
            score = 0;
          for (const c of candidates())
            if (c.cost <= num(state.money)) {
              c.change(1);
              const gain = rate().incomePerMin - before;
              c.change(0);
              if (gain / c.cost > score) {
                best = c;
                score = gain / c.cost;
              }
            }
          if (!best) break;
          state.money = num(state.money) - best.cost;
          best.change(1);
        }
      }
      const model = {
        channel,
        assumptions: {integration:"Number approximation; actual settlement uses integer-won APIs",manual:"perfect player fills remaining arrivals; no walking/patience/crowd loss",offline:"8h return/claim schedule, no purchases/research starts while absent, old completed effects used for receipt",purchase:"same greedy marginal income/cost, up to 40 per return/minute",clock:"minute-based model; not a human play-time guarantee",offlineMaxHours:8},
        firstRegionEndingMinute: chapters[0]?.minute ?? null,
        chapters,
        horizonMinutes: 43200,
        endingMinute: ending,
        milestones,
        levels,
        finalRegion: state.regionId,
        finalMoney: String(state.money),
        finalLevel: state.level,
        finalRate: rate(),
      };
      // Actual service loops, fixed 0.1s steps, steady max-growth Mars checkpoint.
      // Isolated harness replaces save only to omit disk I/O, not ledger arithmetic.
      reset();
      state.regionId = "mars";
      state.level = 999;
      for (const u of UPGRADES) state.upgrades[u.id] = u.maxLevel;
      state.delivery = { level: 10, riders: 10 };
      for (const s of STAFF_POOL)
        state.staffStats[s.key] = { auto: 10, tip: 10, earned: 0 };
      for (const r of RESEARCH) state.research.levels[r.id] = 10;
      for (const m of MENUS) state.menuLevels[m.id] = 10;
      sanitizeState();
      BranchManager.bootstrap();
      let seed = 12345,
        arrivals = 0;
      const originalRandom = Math.random,
        originalSave = save;
      Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      save = () => true;
      let deliveryCount = 0,
        serveCount = 0,
        onlineCount = 0;
      const counts = () =>
        Object.values(state.menuStats).reduce((a, r) => a + (r.count || 0), 0);
      try {
        for (let step = 0; step < 6000; step++) {
          const rates = computeRates();
          arrivals += rates.ordersPerMin / 600;
          state.customers = state.customers.filter(
            (c) => c.state !== "leaving",
          );
          while (arrivals >= 1) {
            arrivals--;
            if (state.customers.length < CONFIG.maxCustomers)
              state.customers.push({
                id: "measure-" + step,
                menuId: (typeof getOrderMenuPool === "function"
                  ? getOrderMenuPool()
                  : MENUS)[
                  Math.floor(
                    Math.random() *
                      (typeof getOrderMenuPool === "function"
                        ? getOrderMenuPool().length
                        : MENUS.length),
                  )
                ].id,
                state: "waiting",
                x: 50,
                y: 50,
                patience: 99,
              });
          }
          let before = counts();
          autoServe(0.1);
          serveCount += counts() - before;
          before = counts();
          updateDelivery(0.1, Date.now());
          deliveryCount += counts() - before;
          before = counts();
          updateOnlineAuto(0.1);
          onlineCount += counts() - before;
        }
      } finally {
        Math.random = originalRandom;
        save = originalSave;
      }
      const actualTenMinutes = {
        seed: 12345,
        stepSeconds: 0.1,
        simulatedMinutes: 10,
        serveCount,
        deliveryCount,
        onlineCount,
        earned: String(state.totalSales),
        perMinute: Number(state.totalSales) / 10,
      };
      return {
        precision: lost,
        overflowCost,
        thresholds: [1, 10, 100, 500, 999].map((lv) => ({
          level: lv,
          required: String(CONFIG.levelUpTotalSales[lv]),
        })),
        endingTarget: String(rules.ending),
        checkpoints: rows,
        model,
        actualTenMinutes,
      };
    }, {mode, channel, proposal});
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      JSON.stringify(
        { root, mode, channel, proposal, browser: browser.version(), ...result },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
