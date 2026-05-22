import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { readConfig, writeConfig } from '../../src/main/storage/config_store';

function tempConfigPath(): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'aiguanjia-config-'));
  return { dir, file: join(dir, 'config.json') };
}

test('readConfig should return null when file does not exist', async () => {
  const { dir, file } = tempConfigPath();

  try {
    const config = await readConfig(file);
    assert.equal(config, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeConfig and readConfig should persist JSON config', async () => {
  const { dir, file } = tempConfigPath();
  const input = {
    projectGroups: [{ id: 'p1', name: 'Demo', projectPath: '/tmp/demo' }],
    agentProfiles: [{ id: 'a1', name: 'Codex', command: 'codex', argsTemplate: ['-q'] }],
    flowTemplates: [{ id: 'f1', name: 'Flow', steps: [{ id: 's1', name: 'Step' }] }]
  };

  try {
    await writeConfig(file, input);
    const output = await readConfig(file);

    assert.deepEqual(output, input);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
