import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, constants, readFileSync } from 'node:fs';
import { join } from 'node:path';

test('e2e demo script should exist and be executable', () => {
  const scriptPath = join(process.cwd(), 'scripts', 'e2e-demo-flow.sh');

  accessSync(scriptPath, constants.F_OK);
  accessSync(scriptPath, constants.X_OK);
  assert.ok(true);
});

test('e2e demo script should clearly state quick verification scope', () => {
  const scriptPath = join(process.cwd(), 'scripts', 'e2e-demo-flow.sh');
  const content = readFileSync(scriptPath, 'utf-8');

  assert.match(content, /quick-verify/);
  assert.match(content, /non end-to-end/);
  assert.doesNotMatch(content, /\[e2e\] PASS/);
});
