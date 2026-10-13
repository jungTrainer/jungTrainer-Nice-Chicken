const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  validateRedemptionRequest,
  classifyRedemptionResponse,
} = require("../scripts/coupon-contract.cjs");
const request = {
  requestId: "b3f6e9f4-f521-4b05-a84b-364259dc8c16",
  storeId: "test-store",
  expectedRevision: 0,
};
const expected = { couponId: "server-fixture-coupon", request };
const receipt = {
  receiptId: "receipt-fixture",
  requestId: request.requestId,
  couponId: expected.couponId,
  storeId: request.storeId,
  redeemedAt: "2026-10-13T00:00:00.000Z",
  revision: 1,
  status: "redeemed",
};
test("proposed request rejects client balance/operator and malformed identities", () => {
  assert.ok(validateRedemptionRequest(expected.couponId, request));
  for (const body of [
    { ...request, money: 500 },
    { ...request, operator: "owner" },
    { ...request, requestId: "0000" },
    { ...request, expectedRevision: -1 },
    { ...request, expectedRevision: Infinity },
  ])
    assert.equal(validateRedemptionRequest(expected.couponId, body), false);
});
test("proposed receipt validates correlation and shape without claiming authentication", () => {
  assert.equal(
    classifyRedemptionResponse(201, receipt, expected),
    "receipt-shape-valid",
  );
  for (const r of [
    { ...receipt, couponId: "other" },
    { ...receipt, requestId: "other" },
    { ...receipt, storeId: "other" },
    { ...receipt, revision: 0 },
    { ...receipt, redeemedAt: "bad" },
    { ...receipt, status: "success" },
  ])
    assert.equal(classifyRedemptionResponse(200, r, expected), "invalid");
});
test("timeout and retriable responses remain unknown, never a local PIN success", () => {
  for (const status of [0, 202, 429, 500, 503])
    assert.equal(
      classifyRedemptionResponse(status, null, expected),
      "unknown-retry-same-key",
    );
});
test("authentication/conflict/expiry errors require explicit rejection or reauthentication", () => {
  assert.equal(
    classifyRedemptionResponse(401, null, expected),
    "reauthenticate",
  );
  for (const status of [403, 409, 410, 422])
    assert.equal(
      classifyRedemptionResponse(status, null, expected),
      "rejected",
    );
});
test("same receipt can be correlated on retry without modifying local or server state", () => {
  const before = JSON.stringify({ request, receipt });
  for (let i = 0; i < 2; i++)
    assert.equal(
      classifyRedemptionResponse(200, receipt, expected),
      "receipt-shape-valid",
    );
  assert.equal(JSON.stringify({ request, receipt }), before);
});
