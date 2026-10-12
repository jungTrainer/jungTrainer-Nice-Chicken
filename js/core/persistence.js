/* IMP-08: explicit dirty ownership; write batching only during initial boot. */
let deferRecoveryWrites = false;
let lastStateChangeReason = "";
function markStateChanged(reason) {
  _saveDirty = true;
  lastStateChangeReason = reason;
}
