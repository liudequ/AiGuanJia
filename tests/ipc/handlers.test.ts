import test from 'node:test';
import assert from 'node:assert/strict';

import type { AppConfig, FlowTemplate } from '../../src/main/domain/models';
import { IPC_CHANNELS, registerIpcHandlers } from '../../src/main/ipc/handlers';
import type { AgentEntity } from '../../src/main/storage/agent_store';
import type { ProjectState } from '../../src/main/storage/project_store';

interface MockIpcMain {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => void;
}

type MockAgentEntity = AgentEntity & {
  icon: string;
  createdAt: string;
  updatedAt: string;
};

function createMockAgent(id: string, name: string): MockAgentEntity {
  return {
    id,
    name,
    icon: 'bot',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    command: 'codex',
    argsTemplate: []
  };
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
  assert.equal(handlers.has(IPC_CHANNELS.agentsList), true);
  assert.equal(handlers.has(IPC_CHANNELS.agentsAdd), true);
  assert.equal(handlers.has(IPC_CHANNELS.agentsRemove), true);
});

test('agents:add then agents:list should include new agent', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  type AgentInput = { name: string };
  const agents: MockAgentEntity[] = [];

  registerIpcHandlers(ipcMain, {
    agentStore: {
      listAgents: async () => [...agents],
      addAgent: async (input: AgentInput) => {
        const created = createMockAgent(`agent-${agents.length + 1}`, input.name);
        agents.push(created);
        return created;
      },
      removeAgent: async () => {}
    },
    loadAppConfig: async () =>
      ({
        flowTemplates: []
      }) as AppConfig
  });

  const addHandler = handlers.get(IPC_CHANNELS.agentsAdd);
  const listHandler = handlers.get(IPC_CHANNELS.agentsList);
  assert.ok(addHandler);
  assert.ok(listHandler);

  const created = await addHandler({}, { name: 'Alpha' });
  const listed = await listHandler({});

  assert.equal(created.id, 'agent-1');
  assert.equal(created.name, 'Alpha');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, 'agent-1');
});

test('agents:add should accept undefined payload as empty input', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  const addInputs: unknown[] = [];
  registerIpcHandlers(ipcMain, {
    agentStore: {
      listAgents: async () => [],
      addAgent: async (input: unknown) => {
        addInputs.push(input);
        return createMockAgent('agent-1', '新建 Agent 1');
      },
      removeAgent: async () => {}
    },
    loadAppConfig: async () =>
      ({
        flowTemplates: []
      }) as AppConfig
  });

  const addHandler = handlers.get(IPC_CHANNELS.agentsAdd);
  assert.ok(addHandler);

  const created = await addHandler({}, undefined);
  assert.equal(created.id, 'agent-1');
  assert.deepEqual(addInputs, [{}]);
});

test('agents:add should reject invalid payload', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  registerIpcHandlers(ipcMain, {
    agentStore: {
      listAgents: async () => [],
      addAgent: async () => createMockAgent('agent-1', 'Alpha'),
      removeAgent: async () => {}
    },
    loadAppConfig: async () =>
      ({
        flowTemplates: []
      }) as AppConfig
  });

  const addHandler = handlers.get(IPC_CHANNELS.agentsAdd);
  assert.ok(addHandler);

  await assert.rejects(() => addHandler({}, null), /invalid payload/i);
  await assert.rejects(() => addHandler({}, 1), /invalid payload/i);
  await assert.rejects(() => addHandler({}, 'x'), /invalid payload/i);
  await assert.rejects(() => addHandler({}, []), /invalid payload/i);
});

test('agents:remove should throw AGENT_IN_USE when referenced by any flow step', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  let removeCalled = false;
  registerIpcHandlers(ipcMain, {
    agentStore: {
      listAgents: async () => [],
      addAgent: async () => createMockAgent('unused', 'Unused'),
      removeAgent: async () => {
        removeCalled = true;
      }
    },
    loadAppConfig: async () =>
      ({
        flowTemplates: [
          {
            id: 'flow-1',
            name: 'Flow One',
            steps: [
              { id: 's1', name: 'Step 1', agentProfileId: 'agent-1' },
              { id: 's2', name: 'Step 2' }
            ]
          }
        ]
      }) as AppConfig
  });

  const removeHandler = handlers.get(IPC_CHANNELS.agentsRemove);
  assert.ok(removeHandler);

  await assert.rejects(() => removeHandler({}, { id: 'agent-1' }), /AGENT_IN_USE/);
  assert.equal(removeCalled, false);
});

test('agents:remove should reject invalid payload', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  registerIpcHandlers(ipcMain, {
    agentStore: {
      listAgents: async () => [],
      addAgent: async () => createMockAgent('unused', 'Unused'),
      removeAgent: async () => {}
    },
    loadAppConfig: async () =>
      ({
        flowTemplates: []
      }) as AppConfig
  });

  const removeHandler = handlers.get(IPC_CHANNELS.agentsRemove);
  assert.ok(removeHandler);

  await assert.rejects(() => removeHandler({}, null), /invalid payload/i);
  await assert.rejects(() => removeHandler({}, 1), /invalid payload/i);
  await assert.rejects(() => removeHandler({}, ''), /invalid payload/i);
  await assert.rejects(() => removeHandler({}, {}), /invalid payload/i);
  await assert.rejects(() => removeHandler({}, { id: '' }), /invalid payload/i);
  await assert.rejects(() => removeHandler({}, { id: '   ' }), /invalid payload/i);
});

test('agents:remove should return ok true and call removeAgent when not referenced', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const ipcMain: MockIpcMain = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };

  const removedIds: string[] = [];
  registerIpcHandlers(ipcMain, {
    agentStore: {
      listAgents: async () => [],
      addAgent: async () => createMockAgent('unused', 'Unused'),
      removeAgent: async (id: string) => {
        removedIds.push(id);
      }
    },
    loadAppConfig: async () =>
      ({
        flowTemplates: [
          {
            id: 'flow-1',
            name: 'Flow One',
            steps: [{ id: 's1', name: 'Step 1', agentProfileId: 'agent-2' }]
          }
        ]
      }) as AppConfig
  });

  const removeHandler = handlers.get(IPC_CHANNELS.agentsRemove);
  assert.ok(removeHandler);

  const result = await removeHandler({}, { id: 'agent-1' });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(removedIds, ['agent-1']);
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

test('runs:get should return isolated array copy', async () => {
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

  await runFlowHandler({}, flowTemplate);

  const firstRead = await getRunsHandler({});
  assert.equal(firstRead.length, 1);
  firstRead.pop();
  assert.equal(firstRead.length, 0);

  const secondRead = await getRunsHandler({});
  assert.equal(secondRead.length, 1);
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

  await assert.rejects(() => selectPathHandler({}, null), /non-empty string/i);
  await assert.rejects(() => selectPathHandler({}, 123), /non-empty string/i);
  await assert.rejects(() => selectPathHandler({}, 'abc'), /non-empty string/i);
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
