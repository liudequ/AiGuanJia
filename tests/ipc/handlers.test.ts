import test from 'node:test';
import assert from 'node:assert/strict';

import type { FlowTemplate } from '../../src/main/domain/models';
import { IPC_CHANNELS, registerIpcHandlers } from '../../src/main/ipc/handlers';

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
