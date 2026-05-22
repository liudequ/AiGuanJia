import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { access, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createRunLayout } from '../../src/main/storage/run_store';

function tempProjectPath(): string {
  return mkdtempSync(join(tmpdir(), 'aiguanjia-run-store-'));
}

test('createRunLayout should create run and step files under project .aiguanjia path', async () => {
  const projectPath = tempProjectPath();

  try {
    const layout = await createRunLayout(projectPath, 'run-001', 'step-build', 1);

    assert.equal(layout.runDir, join(projectPath, '.aiguanjia', 'runs', 'run-001'));
    assert.equal(layout.flowRunFile, join(layout.runDir, 'flow-run.json'));
    assert.equal(layout.stepDir, join(layout.runDir, 'steps', '1-step-build'));
    assert.equal(layout.stdoutLogFile, join(layout.stepDir, 'stdout.log'));
    assert.equal(layout.stderrLogFile, join(layout.stepDir, 'stderr.log'));
    assert.equal(layout.stepRunFile, join(layout.stepDir, 'step-run.json'));
    assert.equal(layout.stepStatusFile, join(layout.stepDir, 'step-status.json'));

    await access(layout.runDir, constants.F_OK);
    await access(layout.flowRunFile, constants.F_OK);
    await access(layout.stepDir, constants.F_OK);
    await access(layout.stdoutLogFile, constants.F_OK);
    await access(layout.stderrLogFile, constants.F_OK);
    await access(layout.stepRunFile, constants.F_OK);
    await access(layout.stepStatusFile, constants.F_OK);

    assert.equal(await readFile(layout.flowRunFile, 'utf8'), '');
    assert.equal(await readFile(layout.stdoutLogFile, 'utf8'), '');
    assert.equal(await readFile(layout.stderrLogFile, 'utf8'), '');
    assert.equal(await readFile(layout.stepRunFile, 'utf8'), '');
    assert.equal(await readFile(layout.stepStatusFile, 'utf8'), '');
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
});
