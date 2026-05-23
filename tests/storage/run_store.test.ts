import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { access, readFile, rm, writeFile } from 'node:fs/promises';
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

test('createRunLayout should reject invalid runId and stepId', async () => {
  const projectPath = tempProjectPath();

  const invalidIds = ['../escape', 'a/b', 'a\\b', 'run 01', '', '/abs', 'C:/tmp'];

  try {
    for (const invalidRunId of invalidIds) {
      await assert.rejects(() => createRunLayout(projectPath, invalidRunId, 'step-ok', 1), /invalid runId/);
    }

    for (const invalidStepId of invalidIds) {
      await assert.rejects(() => createRunLayout(projectPath, 'run-ok', invalidStepId, 1), /invalid stepId/);
    }
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
});

test('createRunLayout should overwrite metadata files while keeping logs append-friendly', async () => {
  const projectPath = tempProjectPath();

  try {
    const layout = await createRunLayout(projectPath, 'run-001', 'step-build', 1);

    await writeFile(layout.flowRunFile, 'old-flow', 'utf8');
    await writeFile(layout.stepRunFile, 'old-step-run', 'utf8');
    await writeFile(layout.stepStatusFile, 'old-step-status', 'utf8');
    await writeFile(layout.stdoutLogFile, 'old-stdout', 'utf8');
    await writeFile(layout.stderrLogFile, 'old-stderr', 'utf8');

    const secondLayout = await createRunLayout(projectPath, 'run-001', 'step-build', 1);

    assert.equal(await readFile(secondLayout.flowRunFile, 'utf8'), '');
    assert.equal(await readFile(secondLayout.stepRunFile, 'utf8'), '');
    assert.equal(await readFile(secondLayout.stepStatusFile, 'utf8'), '');
    assert.equal(await readFile(secondLayout.stdoutLogFile, 'utf8'), 'old-stdout');
    assert.equal(await readFile(secondLayout.stderrLogFile, 'utf8'), 'old-stderr');
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
});
