#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[e2e] Step 1/4: run unit and smoke tests"
npm test

echo "[e2e] Step 2/4: build application"
npm run build

echo "[e2e] Step 3/4: verify build artifacts"
test -f dist/main/main.js
test -f dist/main/ipc/handlers.js
test -f dist/renderer/index.html
test -f dist/renderer/styles.css

echo "[e2e] Step 4/4: verify flow execution in built output"
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
  console.log('[e2e] Flow result validated:', result.finalStatus);
})().catch((error) => {
  console.error('[e2e] Flow validation failed:', error);
  process.exit(1);
});
NODE

echo "[e2e] PASS"
