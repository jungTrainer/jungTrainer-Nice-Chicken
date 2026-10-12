#!/usr/bin/env bash
# Shared local/Actions commands. Preserve the failing command's exit status through tee.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p test-results/logs test-results/screenshots
npm ci 2>&1 | tee test-results/logs/install.log
# GitHub-hosted Linux gets explicit OS dependencies; local doctor checks the installed libraries.
if [[ "${GITHUB_ACTIONS:-false}" == "true" ]]; then
  npx playwright install-deps chromium 2>&1 | tee test-results/logs/browser-deps.log
fi
npx playwright install chromium --no-shell 2>&1 | tee test-results/logs/browser-install.log
npm run doctor 2>&1 | tee test-results/logs/environment.log
npm run check 2>&1 | tee test-results/logs/check.log
npm test 2>&1 | tee test-results/logs/tests.log
