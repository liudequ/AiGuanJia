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

function createNowSequence(values: string[]): () => string {
  let index = 0;
  return () => {
    const value = values[index];
    if (!value) {
      throw new Error('No more now() values in test sequence');
    }
    index += 1;
    return value;
  };
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
  const projectPath = join(homeDir, 'demo-project');

  try {
    await mkdir(projectPath, { recursive: true });
    const store = createProjectStore({ homeDir });
    const state = await store.selectProjectByPath(projectPath);

    assert.equal(state.currentProjectPath, projectPath);
    assert.equal(state.projects.length, 1);
    assert.equal(state.projects[0]?.path, projectPath);
    assert.equal(state.projects[0]?.name, 'demo-project');
    assert.equal(typeof state.projects[0]?.addedAt, 'string');
    assert.match(state.projects[0]?.addedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);

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
  const projectPath = join(homeDir, 'repeat-project');

  try {
    await mkdir(projectPath, { recursive: true });
    const store = createProjectStore({
      homeDir,
      now: createNowSequence(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z'])
    });
    const first = await store.selectProjectByPath(projectPath);
    const firstProject = first.projects[0];

    const second = await store.selectProjectByPath(projectPath);
    const secondProject = second.projects[0];

    assert.equal(second.projects.length, 1);
    assert.equal(secondProject?.path, projectPath);
    assert.equal(secondProject?.name, firstProject?.name);
    assert.equal(secondProject?.addedAt, firstProject?.addedAt);
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

test('getProjectState should throw when project entry misses addedAt', async () => {
  const homeDir = tempHomeDir();

  try {
    const filePath = storageFile(homeDir);
    await mkdir(join(homeDir, '.aiguanjia'), { recursive: true });
    writeFileSync(
      filePath,
      JSON.stringify(
        {
          currentProjectPath: '/tmp/bad-project',
          projects: [
            {
              path: '/tmp/bad-project',
              name: 'bad-project',
              lastOpenedAt: new Date().toISOString()
            }
          ]
        },
        null,
        2
      ),
      { encoding: 'utf8', flag: 'w' }
    );

    const store = createProjectStore({ homeDir });
    await assert.rejects(() => store.getProjectState(), /invalid project fields/i);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('getProjectState should return projects sorted by lastOpenedAt descending', async () => {
  const homeDir = tempHomeDir();
  const projectAPath = join(homeDir, 'project-a');
  const projectBPath = join(homeDir, 'project-b');

  try {
    await mkdir(projectAPath, { recursive: true });
    await mkdir(projectBPath, { recursive: true });
    const store = createProjectStore({
      homeDir,
      now: createNowSequence(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z'])
    });
    await store.selectProjectByPath(projectAPath);
    await store.selectProjectByPath(projectBPath);

    const state = await store.getProjectState();

    assert.equal(state.projects.length, 2);
    assert.equal(state.projects[0]?.path, projectBPath);
    assert.equal(state.projects[1]?.path, projectAPath);
    assert.equal(state.currentProjectPath, projectBPath);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('selectProjectByPath should reject non-existing path', async () => {
  const homeDir = tempHomeDir();
  const missingPath = join(homeDir, 'missing-project');

  try {
    const store = createProjectStore({ homeDir });
    await assert.rejects(() => store.selectProjectByPath(missingPath), /does not exist/i);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('selectProjectByPath should reject non-directory path', async () => {
  const homeDir = tempHomeDir();
  const filePath = join(homeDir, 'not-a-directory.txt');

  try {
    writeFileSync(filePath, 'content', { encoding: 'utf8', flag: 'w' });
    const store = createProjectStore({ homeDir });
    await assert.rejects(() => store.selectProjectByPath(filePath), /must be a directory/i);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('selectProjectByPath should not pollute state when selection is rejected', async () => {
  const homeDir = tempHomeDir();
  const validPath = join(homeDir, 'valid-project');
  const missingPath = join(homeDir, 'missing-project');

  try {
    await mkdir(validPath, { recursive: true });
    const store = createProjectStore({ homeDir });
    const before = await store.selectProjectByPath(validPath);
    const beforeRaw = await readFile(storageFile(homeDir), 'utf8');

    await assert.rejects(() => store.selectProjectByPath(missingPath), /does not exist/i);

    const after = await store.getProjectState();
    const afterRaw = await readFile(storageFile(homeDir), 'utf8');
    assert.deepEqual(after, before);
    assert.equal(afterRaw, beforeRaw);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('getProjectState should throw on access errors other than ENOENT', async () => {
  const homeDir = tempHomeDir();

  try {
    writeFileSync(join(homeDir, '.aiguanjia'), 'not-a-directory', { encoding: 'utf8', flag: 'w' });
    const store = createProjectStore({ homeDir });
    await assert.rejects(() => store.getProjectState(), /Failed to access projects\.json/i);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
