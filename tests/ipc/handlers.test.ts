import test from 'node:test';
import assert from 'node:assert/strict';

import type { FlowTemplate } from '../../src/main/domain/models';
import { IPC_CHANNELS, registerIpcHandlers } from '../../src/main/ipc/handlers';
import type { ProjectState } from '../../src/main/storage/project_store';

interface MockIpcMain {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => void;
}

test('registerIpcHandlers should register flow and run history channels', () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  registerIpcHandlers(ipcMain);

  assert.equal(handlers.has(IPC_CHANNELS.flowRun), true);
  assert.equal(handlers.has(IPC_CHANNELS.runsGet), true);
  assert.equal(handlers.has(IPC_CHANNELS.projectsGetState), true);
  assert.equal(handlers.has(IPC_CHANNELS.projectsSelectPath), true);
  assert.equal(handlers.has(IPC_CHANNELS.projectsPickDirectory), true);
});

test('flow:run should execute flow and getRuns should return run history', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  const flowTemplate: FlowTemplate = {
    id: 'flow-1',
    name: 'Demo Flow',
    steps: [{ id: 'step-1', name: 'Step One' }]
  };

  registerIpcHandlers(ipcMain, {
    executeFlow: async () => ({
      finalStatus: 'SUCCEEDED',
      executedSteps: 1,
      stepResults: [
        {
          stepId: 'step-1',
          status: 'SUCCEEDED',
          exitCode: 0,
          output: 'ok'
        }
      ]
    })
  });

  const runFlowHandler = handlers.get(IPC_CHANNELS.flowRun);
  const getRunsHandler = handlers.get(IPC_CHANNELS.runsGet);

  assert.ok(runFlowHandler);
  assert.ok(getRunsHandler);

  const runResult = await runFlowHandler({}, flowTemplate);

  assert.equal(typeof runResult.runId, 'string');
  assert.equal(runResult.flowTemplateId, 'flow-1');
  assert.equal(runResult.result.finalStatus, 'SUCCEEDED');

  const runs = await getRunsHandler({});
  assert.equal(runs.length, 1);
  assert.equal(runs[0].runId, runResult.runId);
  assert.equal(runs[0].flowTemplateId, 'flow-1');
  assert.equal(runs[0].result.executedSteps, 1);
});

test('projects:selectPath should call projectStore.selectProjectByPath with valid path', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  const selectedState: ProjectState = {
    currentProjectPath: '/tmp/demo-project',
    projects: [
      {
        path: '/tmp/demo-project',
        name: 'demo-project',
        addedAt: '2026-01-01T00:00:00.000Z',
        lastOpenedAt: '2026-01-01T00:00:00.000Z'
      }
    ]
  };

  const calls: string[] = [];
  registerIpcHandlers(ipcMain, {
    projectStore: {
      getProjectState: async () => ({ currentProjectPath: null, projects: [] }),
      selectProjectByPath: async (absPath: string) => {
        calls.push(absPath);
        return selectedState;
      }
    },
    pickDirectory: async () => ({ canceled: true })
  });

  const selectPathHandler = handlers.get(IPC_CHANNELS.projectsSelectPath);
  assert.ok(selectPathHandler);

  const result = await selectPathHandler({}, { path: '/tmp/demo-project' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], '/tmp/demo-project');
  assert.deepEqual(result, selectedState);
});

test('projects:selectPath should reject invalid payload.path', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  registerIpcHandlers(ipcMain, {
    projectStore: {
      getProjectState: async () => ({ currentProjectPath: null, projects: [] }),
      selectProjectByPath: async () => {
        throw new Error('should not be called');
      }
    },
    pickDirectory: async () => ({ canceled: true })
  });

  const selectPathHandler = handlers.get(IPC_CHANNELS.projectsSelectPath);
  assert.ok(selectPathHandler);

  await assert.rejects(() => selectPathHandler({}, {}), /non-empty string/i);
  await assert.rejects(() => selectPathHandler({}, { path: '' }), /non-empty string/i);
  await assert.rejects(() => selectPathHandler({}, { path: '   ' }), /non-empty string/i);
});

test('projects:pickDirectory should return canceled true when picker is canceled', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  registerIpcHandlers(ipcMain, {
    projectStore: {
      getProjectState: async () => ({ currentProjectPath: null, projects: [] }),
      selectProjectByPath: async () => ({ currentProjectPath: null, projects: [] })
    },
    pickDirectory: async () => ({ canceled: true })
  });

  const pickDirectoryHandler = handlers.get(IPC_CHANNELS.projectsPickDirectory);
  assert.ok(pickDirectoryHandler);

  const result = await pickDirectoryHandler({});
  assert.deepEqual(result, { canceled: true });
});

test('projects:pickDirectory should return selected path when picker succeeds', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  registerIpcHandlers(ipcMain, {
    projectStore: {
      getProjectState: async () => ({ currentProjectPath: null, projects: [] }),
      selectProjectByPath: async () => ({ currentProjectPath: null, projects: [] })
    },
    pickDirectory: async () => ({ canceled: false, path: '/tmp/selected-project' })
  });

  const pickDirectoryHandler = handlers.get(IPC_CHANNELS.projectsPickDirectory);
  assert.ok(pickDirectoryHandler);

  const result = await pickDirectoryHandler({});
  assert.deepEqual(result, { canceled: false, path: '/tmp/selected-project' });
});
