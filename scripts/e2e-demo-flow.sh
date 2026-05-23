#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[quick-verify] Step 1/3: build application"
npm run build

echo "[quick-verify] Step 2/3: verify build artifacts"
test -f dist/main/main.js
test -f dist/main/ipc/handlers.js
test -f dist/renderer/index.html
test -f dist/renderer/styles.css

echo "[quick-verify] Step 3/3: verify flow engine behavior from built output"
node <<'NODE'
const assert = require('node:assert/strict');
const { runFlow } = require('./dist/main/engine/execution_engine.js');

(async () => {
  const template = {
    id: 'demo-flow',
    name: 'Demo Flow',
    steps: [
      { id: 'step-1', name: 'Prepare' },
      { id: 'step-2', name: 'Execute' }
    ]
  };

  const result = await runFlow(template, async (_step, index) => ({
    exitCode: 0,
    output: `ok-${index}`
  }));

  assert.equal(result.finalStatus, 'SUCCEEDED');
  assert.equal(result.executedSteps, 2);
  assert.equal(result.stepResults.length, 2);
  console.log('[quick-verify] Flow engine validation passed:', result.finalStatus);
})().catch((error) => {
  console.error('[quick-verify] Flow engine validation failed:', error);
  process.exit(1);
});
NODE

echo "[quick-verify] PASS (non end-to-end)"
