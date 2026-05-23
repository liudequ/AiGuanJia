import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { IPC_CHANNELS } from '../../src/main/ipc/handlers';

interface ExposedMap {
  [key: string]: unknown;
}

interface InvokeCall {
  channel: string;
  args: unknown[];
}

declare global {
  // eslint-disable-next-line no-var
  var __preloadTestState: {
    exposed: ExposedMap;
    invokeCalls: InvokeCall[];
  };
}

test('preload should expose flowApi and projectApi with expected ipc channels', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preload-test-'));

  try {
    globalThis.__preloadTestState = {
      exposed: {},
      invokeCalls: []
    };

    const preloadSourcePath = path.resolve('src/main/preload.ts');
    const handlersPath = path.resolve('src/main/ipc/handlers.ts').replace(/\\/g, '/');
    const preloadSource = await fs.readFile(preloadSourcePath, 'utf8');

    const electronMockSource = `
export const contextBridge = {
  exposeInMainWorld(name: string, api: unknown) {
    globalThis.__preloadTestState.exposed[name] = api;
  }
};

export const ipcRenderer = {
  invoke(channel: string, ...args: unknown[]) {
    globalThis.__preloadTestState.invokeCalls.push({ channel, args });
    return Promise.resolve({ channel, args });
  }
};
`;

    const patchedPreloadSource = preloadSource
      .replace("from 'electron'", "from './electron-mock'")
      .replace("from './ipc/handlers'", `from '${handlersPath}'`);

    const electronMockPath = path.join(tempDir, 'electron-mock.ts');
    const preloadUnderTestPath = path.join(tempDir, 'preload-under-test.ts');

    await fs.writeFile(electronMockPath, electronMockSource, 'utf8');
    await fs.writeFile(preloadUnderTestPath, patchedPreloadSource, 'utf8');

    await import(`${pathToFileURL(preloadUnderTestPath).href}?case=${Date.now()}`);

    const flowApi = globalThis.__preloadTestState.exposed.flowApi as {
      runFlow: (template: unknown) => Promise<unknown>;
      getRuns: () => Promise<unknown>;
    };

    const projectApi = globalThis.__preloadTestState.exposed.projectApi as {
      getState: () => Promise<unknown>;
      pickDirectory: () => Promise<unknown>;
      selectPath: (projectPath: string) => Promise<unknown>;
    };
    const agentApi = globalThis.__preloadTestState.exposed.agentApi as {
      list: () => Promise<unknown>;
      add: (payload?: unknown) => Promise<unknown>;
      remove: (id: string) => Promise<unknown>;
    };

    assert.ok(flowApi);
    assert.ok(projectApi);
    assert.ok(agentApi);

    await flowApi.runFlow({ id: 'flow-1' });
    await flowApi.getRuns();
    await projectApi.getState();
    await projectApi.pickDirectory();
    await projectApi.selectPath('/tmp/project-a');
    await agentApi.list();
    await agentApi.add({ id: 'agent-1', name: 'Agent 1', prompt: 'hello' });
    await agentApi.remove('agent-1');

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[0], {
      channel: IPC_CHANNELS.flowRun,
      args: [{ id: 'flow-1' }]
    });

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[1], {
      channel: IPC_CHANNELS.runsGet,
      args: []
    });

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[2], {
      channel: IPC_CHANNELS.projectsGetState,
      args: []
    });

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[3], {
      channel: IPC_CHANNELS.projectsPickDirectory,
      args: []
    });

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[4], {
      channel: IPC_CHANNELS.projectsSelectPath,
      args: [{ path: '/tmp/project-a' }]
    });

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[5], {
      channel: IPC_CHANNELS.agentsList,
      args: []
    });

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[6], {
      channel: IPC_CHANNELS.agentsAdd,
      args: [{ id: 'agent-1', name: 'Agent 1', prompt: 'hello' }]
    });

    assert.deepEqual(globalThis.__preloadTestState.invokeCalls[7], {
      channel: IPC_CHANNELS.agentsRemove,
      args: [{ id: 'agent-1' }]
    });
  } finally {
    delete globalThis.__preloadTestState;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
