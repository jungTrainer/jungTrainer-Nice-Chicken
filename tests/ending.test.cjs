const assert = require("node:assert/strict");
const { test } = require("node:test");
const { harness } = require("./helpers/game.cjs");
const { game, fixture } = harness();
function unlocked() {
  return fixture({ endingUnlocked: true, endingPrompted: true });
}
async function finish(p) {
  await p.evaluate(() => {
    while (endingPhase === "playing") nextEndingStep();
  });
  await p.waitForFunction(() => endingPhase === "idle", null, { polling: 20 });
}
test("tick unlocks at unchanged target and closed prompt stays closed on reload", async () =>
  game(fixture(), async (p) => {
    await p.evaluate(() => {
      state.money = ENDING_MONEY;
      tick(0.1);
    });
    assert.equal(
      await p.locator("#endingConditionPopup").getAttribute("aria-hidden"),
      "false",
    );
    await p.locator("#endingNoBtn").click();
    await p.reload();
    assert.equal(
      await p.locator("#endingConditionPopup").getAttribute("aria-hidden"),
      "true",
    );
    assert.equal(await p.locator("#replayEndingBtn").isVisible(), true);
  }));
test("input binds once and duplicate start or premature finish cannot grant reward", async () =>
  game(unlocked(), async (p) => {
    const r = await p.evaluate(async () => {
      bindEndingUI();
      bindEndingUI();
      initDOMRefs();
      await startEndingSequence();
      clearEndingTyping();
      endingEls().wrap.click();
      const started = await startEndingSequence(),
        finished = await finishEndingSequence();
      return { step: __endingStep, started, finished, seen: state.endingSeen };
    });
    assert.deepEqual(r, {
      step: 1,
      started: false,
      finished: false,
      seen: false,
    });
  }));
test("completion and replay grant a saved effect exactly once", async () =>
  game(unlocked(), async (p) => {
    await p.locator("#replayEndingBtn").click();
    await finish(p);
    assert.equal(await p.evaluate(() => sumEffects().earningMul), 0.5);
    await p.locator("#replayEndingBtn").click();
    await finish(p);
    await p.reload();
    assert.equal(await p.evaluate(() => sumEffects().earningMul), 0.5);
    assert.equal(
      await p.evaluate(
        () => STAFF_POOL.find((s) => s.key === "grandson").label,
      ),
      "로봇손주",
    );
  }));
test("reset during finishing cancels old timers and restores normal staff", async () =>
  game(unlocked(), async (p) => {
    await p.locator("#replayEndingBtn").click();
    await p.evaluate(() => {
      while (endingPhase === "playing") nextEndingStep();
    });
    // The reset lifecycle is exercised directly; IMP-06 separately rejects background buttons.
    await p.evaluate(() => {
      localStorage.clear();
      state = defaultState();
      initAfterLoad(true);
    });
    await p.waitForTimeout(1100);
    assert.equal(await p.evaluate(() => state.robotGrandson), false);
    assert.equal(await p.evaluate(() => endingFinishTimer), null);
    assert.equal(
      await p.locator("#endingOverlay").getAttribute("aria-hidden"),
      "true",
    );
  }));
test("import while typing cancels execution and preserves pending paid rewards", async () =>
  game(unlocked(), async (p) => {
    p.on("dialog", (d) => d.accept());
    await p.locator("#replayEndingBtn").click();
    const f = fixture({
      offlineReward: { amount: 456, seconds: 60 },
      coupons: { veg: 7, drink: 3 },
    });
    await p.evaluate((f) => importSaveData(JSON.stringify(f)), f);
    assert.equal(await p.evaluate(() => __endingTypingTimer), null);
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 456);
    assert.equal(await p.evaluate(() => state.coupons.veg), 7);
    assert.equal(
      await p.locator("#endingOverlay").getAttribute("aria-hidden"),
      "true",
    );
  }));
test("failed completion rolls back flags and permits a final-scene retry", async () =>
  game(unlocked(), async (p) => {
    await p.locator("#replayEndingBtn").click();
    const r = await p.evaluate(async () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw Error("full");
      };
      clearEndingTyping();
      __endingStep = endingStoryData.length;
      const result = await finishEndingSequence();
      Storage.prototype.setItem = original;
      return { result, robot: state.robotGrandson, seen: state.endingSeen };
    });
    assert.deepEqual(r, { result: false, robot: false, seen: false });
    await finish(p);
    await p.reload();
    assert.equal(await p.evaluate(() => state.endingSeen), true);
  }));
test("real rAF loop unlocks during play and leaves the canvas running after story", async () =>
  game(
    fixture(),
    async (p) => {
      await p.evaluate(() => {
        state.money = ENDING_MONEY;
      });
      await p.waitForFunction(() => state.endingUnlocked);
      await p.locator("#endingYesBtn").click();
      await finish(p);
      await p.locator('.navBtn[data-panel="upg"]').click();
      assert.equal(
        await p
          .locator("#panel-upg")
          .evaluate((e) => e.classList.contains("on")),
        true,
      );
    },
    { live: true },
  ));
