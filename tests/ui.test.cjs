const assert = require("node:assert/strict");
const { test } = require("node:test");
const { harness } = require("./helpers/game.cjs");
const { game, fixture } = harness();

test("modal ownership blocks synthetic canvas and menu background actions", async () =>
  game(fixture(), async (p) => {
    await p.evaluate(() => {
      state.customers = [
        {
          id: "blocked",
          menuId: "fried",
          state: "waiting",
          x: 20,
          y: 35,
          patience: 99,
        },
      ];
      state.selectedCustomerId = null;
    });
    await p.locator("#openSettings").tap();
    const r = await p.evaluate(() => {
      const b = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          clientX: b.x + 20,
          clientY: b.y + 35,
        }),
      );
      document
        .querySelector('[data-action="serve-menu"][data-menu-id="fried"]')
        .click();
      return { selected: state.selectedCustomerId, money: state.money };
    });
    assert.deepEqual(r, { selected: null, money: 0 });
  }));
test("landscape settings are bounded and scrollable", async () =>
  game(
    fixture(),
    async (p) => {
      await p.locator("#openSettings").click();
      const r = await p.locator("#modalSettings .modal").evaluate((e) => {
        const b = e.getBoundingClientRect();
        return {
          top: b.top,
          bottom: b.bottom,
          overflow: getComputedStyle(e).overflowY,
        };
      });
      assert.ok(r.top >= 0 && r.bottom <= 390);
      assert.equal(r.overflow, "auto");
    },
    { viewport: { width: 844, height: 390 } },
  ));
test("closed panels are removed from keyboard input", async () =>
  game(fixture(), async (p) => {
    assert.equal(await p.locator("#panel-upg").evaluate((e) => e.inert), true);
  }));
test("Escape closes settings and restores focus to its opener", async () =>
  game(fixture(), async (p) => {
    await p.locator("#openSettings").click();
    await p.keyboard.press("Escape");
    assert.equal(
      await p
        .locator("#modalSettings")
        .evaluate((e) => e.classList.contains("on")),
      false,
    );
    assert.equal(
      await p.evaluate(() => document.activeElement.id),
      "openSettings",
    );
  }));

const sizes = [
  ["small", 320, 568],
  ["mobile", 390, 844],
  ["landscape", 844, 390],
  ["desktop", 1280, 900],
];
async function bounded(p, selector) {
  await p.waitForFunction(
    (selector) => {
      const b = document.querySelector(selector).getBoundingClientRect(),
        v = visualViewport;
      return (
        b.top >= -1 &&
        b.left >= -1 &&
        b.bottom <= v.height + 1 &&
        b.right <= v.width + 1
      );
    },
    selector,
    { polling: 20, timeout: 3000 },
  );
  const r = await p.locator(selector).evaluate((e) => {
    const b = e.getBoundingClientRect(),
      v = visualViewport;
    return {
      top: b.top,
      bottom: b.bottom,
      left: b.left,
      right: b.right,
      height: v.height,
      width: v.width,
    };
  });
  assert.ok(
    r.top >= -1 &&
      r.left >= -1 &&
      r.bottom <= r.height + 1 &&
      r.right <= r.width + 1,
    JSON.stringify(r),
  );
}
for (const [name, width, height] of sizes) {
  test(`${name}: panels scroll, close and keep navigation accessible`, async () =>
    game(
      fixture({ money: 1e12 }),
      async (p) => {
        for (const key of ["upg", "res", "mis", "shr"]) {
          await p.locator(`.navBtn[data-panel="${key}"]`).tap();
          await bounded(p, `#panel-${key}`);
          await bounded(p, "nav");
          assert.equal(
            await p.locator(`#panel-${key} .closeBtn`).evaluate((e) => {
              const r = e.getBoundingClientRect();
              return e.contains(
                document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                ),
              );
            }),
            true,
          );
          const scroll = p.locator(`#panel-${key} .scroll`);
          await scroll.evaluate((e) => (e.scrollTop = e.scrollHeight));
          assert.equal(
            await scroll.evaluate(
              (e) => e.scrollHeight <= e.clientHeight || e.scrollTop > 0,
            ),
            true,
          );
          if (key === "upg")
            await p.screenshot({
              path: `test-results/screenshots/nice-chicken-imp06-${name}-panel.png`,
            });
          await p.locator(`#panel-${key} .closeBtn`).tap();
          assert.equal(
            await p.locator(`#panel-${key}`).evaluate((e) => e.inert),
            true,
          );
        }
      },
      { viewport: { width, height } },
    ));
  test(`${name}: settings, report and map fit with reachable close controls`, async () =>
    game(
      fixture(),
      async (p) => {
        for (const [opener, id] of [
          ["openSettings", "modalSettings"],
          ["openStats", "modalStats"],
          ["openMap", "modalExpansion"],
        ]) {
          await p.locator("#" + opener).tap();
          await bounded(p, `#${id} .modal`);
          const close = p.locator(`#${id} .ui-modal-head .closeBtn`);
          await p
            .locator(`#${id} .modal`)
            .evaluate((e) => (e.scrollTop = e.scrollHeight));
          await close.tap();
          assert.equal(
            await p
              .locator("#" + id)
              .evaluate((e) => e.classList.contains("on")),
            false,
          );
          assert.equal(
            await p.evaluate(() => document.activeElement.id),
            opener,
          );
        }
        await p.locator("#openSettings").tap();
        await p.screenshot({
          path: `test-results/screenshots/nice-chicken-imp06-${name}-settings.png`,
        });
      },
      { viewport: { width, height } },
    ));
  test(`${name}: ending dialogue keyboard and cancellation fit without reward`, async () =>
    game(
      fixture({ endingUnlocked: true, endingPrompted: true }),
      async (p) => {
        await p.locator("#replayEndingBtn").tap();
        await bounded(p, "#endingOverlay .img-viewport");
        await bounded(p, "#endingDialogWrapper");
        await p.locator("#endingDialogWrapper").focus();
        await p.keyboard.press("Enter");
        assert.equal(await p.evaluate(() => __endingStep), 0);
        await p.keyboard.press("Space");
        assert.equal(await p.evaluate(() => __endingStep), 1);
        await p.evaluate(() => {
          clearEndingTyping();
          endingEls().text.textContent = endingStoryData[1].text;
        });
        assert.equal(
          await p
            .locator("#imgCut1")
            .evaluate((e) => e.complete && e.naturalWidth > 0),
          true,
        );
        assert.equal(
          await p
            .locator("#imgCut1")
            .evaluate((e) => getComputedStyle(e).objectFit),
          "contain",
        );
        await p.screenshot({
          path: `test-results/screenshots/nice-chicken-imp06-${name}-ending.png`,
        });
        await p.keyboard.press("Escape");
        assert.equal(await p.evaluate(() => endingPhase), "idle");
        assert.equal(await p.evaluate(() => state.robotGrandson), false);
        await p.reload();
        assert.equal(await p.evaluate(() => state.endingSeen), false);
      },
      { viewport: { width, height } },
    ));
}
test("pending reward close, background click and Escape preserve every receipt until claimed", async () =>
  game(
    fixture({
      offlineReward: { amount: 12345, seconds: 3600 },
      coupons: { veg: 5, drink: 2 },
    }),
    async (p) => {
      const before = await p.evaluate(() => ({
        money: state.money,
        reward: state.offlineReward,
        coupons: state.coupons,
      }));
      await p.locator('[data-ui-close="modalOffline"]').tap();
      assert.deepEqual(
        await p.evaluate(() => ({
          money: state.money,
          reward: state.offlineReward,
          coupons: state.coupons,
        })),
        before,
      );
      await p.locator("#openSettings").tap();
      await p.locator("#openOfflineReward").tap();
      assert.equal(
        await p.locator("#modalSettings").evaluate((e) => e.inert),
        true,
      );
      await p.locator("#modalOffline").evaluate((e) => e.click());
      await p.keyboard.press("Escape");
      await p.reload();
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 12345);
      await p.locator("#claimOffline").tap();
      await p.reload();
      assert.equal(await p.evaluate(() => state.money), 12345);
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 0);
    },
  ));
test("nested coupons and PIN restore parent focus and block background actions", async () =>
  game(fixture({ coupons: { veg: 5, drink: 2 } }), async (p) => {
    p.on("dialog", (d) => d.accept());
    await p.locator("#openSettings").tap();
    await p.locator("#openCoupons").tap();
    assert.equal(
      await p.locator("#modalSettings").evaluate((e) => e.inert),
      true,
    );
    await p.locator("#useVegCoupon").tap();
    await p.waitForSelector("#modalPin.on");
    assert.equal(await p.evaluate(() => document.activeElement.id), "pinInput");
    for (let i = 0; i < 12; i++) await p.keyboard.press("Tab");
    assert.equal(
      await p.evaluate(
        () => document.activeElement.closest("#modalPin") !== null,
      ),
      true,
    );
    await p.locator("#resetAll").evaluate((b) => b.click());
    assert.equal(await p.evaluate(() => state.coupons.veg), 5);
    await p.keyboard.press("Escape");
    assert.equal(
      await p.evaluate(() => document.activeElement.id),
      "useVegCoupon",
    );
    await p.keyboard.press("Escape");
    assert.equal(
      await p.evaluate(() => document.activeElement.id),
      "openCoupons",
    );
    await p.keyboard.press("Escape");
    assert.equal(
      await p.evaluate(() => document.activeElement.id),
      "openSettings",
    );
  }));
test("touch purchase executes once and menu serving survives reload", async () =>
  game(fixture({ money: 1e9 }), async (p) => {
    await p.locator('.navBtn[data-panel="upg"]').tap();
    const b = p.locator('[data-upgrade-id="expand"]');
    await b.scrollIntoViewIfNeeded();
    await b.tap();
    assert.equal(await p.evaluate(() => state.upgrades.expand), 1);
    await p.keyboard.press("Escape");
    await p.evaluate(() => {
      state.customers = [
        {
          id: "touch",
          menuId: "fried",
          state: "waiting",
          x: 20,
          y: 35,
          r: 22,
          patience: 99,
        },
      ];
      state.selectedCustomerId = null;
    });
    const point = await p
      .locator("#stage")
      .evaluate((e) => ({
        x: (20 * e.getBoundingClientRect().width) / e.width,
        y: (35 * e.getBoundingClientRect().height) / e.height,
      }));
    await p.locator("#stage").tap({ position: point });
    assert.equal(await p.evaluate(() => state.selectedCustomerId), "touch");
    await p.locator('[data-menu-id="fried"][data-action="serve-menu"]').tap();
    assert.equal(await p.evaluate(() => state.menuStats.fried.count), 1);
    await p.reload();
    assert.equal(await p.evaluate(() => state.menuStats.fried.count), 1);
  }));
test("visual viewport resize keeps keyboard input and close in view", async () =>
  game(fixture(), async (p) => {
    await p.locator("#openSettings").tap();
    await p.evaluate(() => {
      document.getElementById("modalProfile").classList.add("on");
    });
    await p.locator("#nameInput").fill("검증");
    await p.setViewportSize({ width: 390, height: 340 });
    await bounded(p, "#modalProfile .modal");
    await p.locator("#saveName").tap();
    assert.equal(await p.evaluate(() => state.profile.name), "검증");
  }));
test("correct PIN consumes a coupon once and persists before reconnection", async () =>
  game(fixture({ coupons: { veg: 5, drink: 2 } }), async (p) => {
    p.on("dialog", (d) => d.accept());
    await p.locator("#openSettings").tap();
    await p.locator("#openCoupons").tap();
    await p.locator("#useVegCoupon").tap();
    await p.locator("#pinInput").fill("0000");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => state.coupons.veg === 4, null, {
      polling: 20,
    });
    await p.reload();
    assert.equal(await p.evaluate(() => state.coupons.veg), 4);
  }));
test("region list scrolls horizontally and keyboard selection keeps focus", async () =>
  game(fixture(), async (p) => {
    await p.locator("#openMap").tap();
    await p.locator("#mapWrap").evaluate((e) => (e.scrollLeft = e.scrollWidth));
    assert.ok(await p.locator("#mapWrap").evaluate((e) => e.scrollLeft > 0));
    const node = p.locator(".map-node").nth(1);
    await node.focus();
    await p.keyboard.press("Enter");
    assert.equal(
      await p.evaluate(() => document.activeElement.dataset.regionId),
      await node.getAttribute("data-region-id"),
    );
    assert.equal(
      await p.evaluate(() => state.mapSelected),
      await node.getAttribute("data-region-id"),
    );
  }));
