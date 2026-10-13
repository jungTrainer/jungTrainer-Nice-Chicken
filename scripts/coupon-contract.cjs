// Proposal-only contract checker for synthetic/staging responses, NOT authentication.
// Not loaded by the static app and never performs requests or changes game data.
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
function validateRedemptionRequest(couponId, body) {
  return (
    id(couponId) &&
    body &&
    typeof body === "object" &&
    Object.keys(body).sort().join(",") ===
      "expectedRevision,requestId,storeId" &&
    uuid.test(body.requestId) &&
    id(body.storeId) &&
    Number.isSafeInteger(body.expectedRevision) &&
    body.expectedRevision >= 0
  );
}
function classifyRedemptionResponse(status, receipt, expected) {
  if (status === 401) return "reauthenticate";
  if ([403, 409, 410, 422].includes(status)) return "rejected";
  if (status !== 200 && status !== 201) return "unknown-retry-same-key";
  if (!validateRedemptionRequest(expected?.couponId, expected?.request))
    return "invalid";
  const request = expected.request;
  if (
    !receipt ||
    receipt.status !== "redeemed" ||
    !id(receipt.receiptId) ||
    receipt.requestId !== request.requestId ||
    receipt.couponId !== expected.couponId ||
    receipt.storeId !== request.storeId ||
    !Number.isSafeInteger(receipt.revision) ||
    receipt.revision !== request.expectedRevision + 1 ||
    typeof receipt.redeemedAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(receipt.redeemedAt) ||
    !Number.isFinite(Date.parse(receipt.redeemedAt))
  )
    return "invalid";
  return "receipt-shape-valid";
}
module.exports = { validateRedemptionRequest, classifyRedemptionResponse };
