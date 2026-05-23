import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createProjectStore } from '../../src/main/storage/project_store';

function tempHomeDir(): string {
  return mkdtempSync(join(tmpdir(), 'aiguanjia-project-store-'));
}

function storageFile(homeDir: string): string {
  return join(homeDir, '.aiguanjia', 'projects.json');
}

test('getProjectState should initialize empty state when storage file does not exist', async () => {
  const homeDir = tempHomeDir();

  try {
    const store = createProjectStore({ homeDir });
    const state = await store.getProjectState();

    assert.deepEqual(state, {
      currentProjectPath: null,
      projects: []
    });
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('selectProjectByPath should add first project and persist pretty JSON with trailing newline', async () => {
  const homeDir = tempHomeDir();

  try {
    const store = createProjectStore({ homeDir });
    const state = await store.selectProjectByPath('/tmp/demo-project');

    assert.equal(state.currentProjectPath, '/tmp/demo-project');
    assert.equal(state.projects.length, 1);
    assert.equal(state.projects[0]?.path, '/tmp/demo-project');
    assert.equal(state.projects[0]?.name, 'demo-project');

    const filePath = storageFile(homeDir);
    const raw = await readFile(filePath, 'utf8');

    assert.equal(raw.endsWith('\n'), true);
    assert.equal(raw, `${JSON.stringify(state, null, 2)}\n`);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('selectProjectByPath should deduplicate repeated path and only update lastOpenedAt', async () => {
  const homeDir = tempHomeDir();

  try {
    const store = createProjectStore({ homeDir });
    const first = await store.selectProjectByPath('/tmp/repeat-project');
    const firstProject = first.projects[0];

    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await store.selectProjectByPath('/tmp/repeat-project');
    const secondProject = second.projects[0];

    assert.equal(second.projects.length, 1);
    assert.equal(secondProject?.path, '/tmp/repeat-project');
    assert.equal(secondProject?.name, firstProject?.name);
    assert.notEqual(secondProject?.lastOpenedAt, firstProject?.lastOpenedAt);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('selectProjectByPath should reject non-absolute path', async () => {
  const homeDir = tempHomeDir();

  try {
    const store = createProjectStore({ homeDir });
    await assert.rejects(() => store.selectProjectByPath('relative/path'), /absolute path/i);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('getProjectState should throw when projects.json is corrupted', async () => {
  const homeDir = tempHomeDir();

  try {
    const filePath = storageFile(homeDir);
    await mkdir(join(homeDir, '.aiguanjia'), { recursive: true });
    writeFileSync(filePath, '{"currentProjectPath":', { encoding: 'utf8', flag: 'w' });

    const store = createProjectStore({ homeDir });
    await assert.rejects(() => store.getProjectState(), /projects\.json/i);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('getProjectState should return projects sorted by lastOpenedAt descending', async () => {
  const homeDir = tempHomeDir();

  try {
    const store = createProjectStore({ homeDir });
    await store.selectProjectByPath('/tmp/project-a');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.selectProjectByPath('/tmp/project-b');

    const state = await store.getProjectState();

    assert.equal(state.projects.length, 2);
    assert.equal(state.projects[0]?.path, '/tmp/project-b');
    assert.equal(state.projects[1]?.path, '/tmp/project-a');
    assert.equal(state.currentProjectPath, '/tmp/project-b');
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
