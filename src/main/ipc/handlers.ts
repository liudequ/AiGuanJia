import { parseFlowTemplate, type AppConfig, type FlowTemplate } from '../domain/models';
import { runFlow, type FlowExecutionResult } from '../engine/execution_engine';
import { createAgentStore, type AddAgentInput, type AgentEntity, type AgentStore } from '../storage/agent_store';
import { createProjectStore, type ProjectState, type ProjectStore } from '../storage/project_store';

export const IPC_CHANNELS = {
  flowRun: 'flow:run',
  runsGet: 'runs:get',
  projectsGetState: 'projects:getState',
  projectsSelectPath: 'projects:selectPath',
  projectsPickDirectory: 'projects:pickDirectory',
  agentsList: 'agents:list',
  agentsAdd: 'agents:add',
  agentsRemove: 'agents:remove'
} as const;

export interface IpcMainLike {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => void;
}

export interface FlowRunRecord {
  runId: string;
  flowTemplateId: string;
  startedAt: string;
  result: FlowExecutionResult;
}

export interface HandlerDeps {
  executeFlow?: (template: FlowTemplate) => Promise<FlowExecutionResult>;
  projectStore?: ProjectStore;
  agentStore?: AgentStore;
  loadAppConfig?: () => Promise<AppConfig>;
  pickDirectory?: () => Promise<{ canceled: true } | { canceled: false; path: string }>;
}

function buildDefaultExecuteFlow(): (template: FlowTemplate) => Promise<FlowExecutionResult> {
  return async (template: FlowTemplate) => runFlow(template, async () => ({ exitCode: 0 }));
}

async function buildDefaultPickDirectory(): Promise<{ canceled: true } | { canceled: false; path: string }> {
  const { dialog } = await import('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, path: result.filePaths[0] };
}

export function registerIpcHandlers(ipcMain: IpcMainLike, deps: HandlerDeps = {}): void {
  const runs: FlowRunRecord[] = [];
  const executeFlow = deps.executeFlow ?? buildDefaultExecuteFlow();
  const projectStore = deps.projectStore ?? createProjectStore();
  const agentStore = deps.agentStore ?? createAgentStore();
  const loadAppConfig = deps.loadAppConfig ?? (async () => ({ projectGroups: [], agentProfiles: [], flowTemplates: [] }));
  const pickDirectory = deps.pickDirectory ?? buildDefaultPickDirectory;

  ipcMain.handle(IPC_CHANNELS.flowRun, async (_event: unknown, payload: unknown) => {
    const template = parseFlowTemplate(payload);
    const result = await executeFlow(template);
    const runRecord: FlowRunRecord = {
      runId: `run-${runs.length + 1}`,
      flowTemplateId: template.id,
      startedAt: new Date().toISOString(),
      result
    };

    runs.unshift(runRecord);
    return runRecord;
  });

  ipcMain.handle(IPC_CHANNELS.runsGet, async () => [...runs]);

  ipcMain.handle(IPC_CHANNELS.projectsGetState, async (): Promise<ProjectState> => projectStore.getProjectState());

  ipcMain.handle(IPC_CHANNELS.projectsSelectPath, async (_event: unknown, payload: unknown): Promise<ProjectState> => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload: path must be a non-empty string.');
    }

    const { path } = payload as { path?: unknown };
    if (typeof path !== 'string' || path.trim() === '') {
      throw new Error('Invalid payload: path must be a non-empty string.');
    }

    return projectStore.selectProjectByPath(path);
  });

  ipcMain.handle(IPC_CHANNELS.projectsPickDirectory, async () => {
    const picked = await pickDirectory();
    if (picked.canceled) {
      return { canceled: true as const };
    }

    return { canceled: false as const, path: picked.path };
  });

  ipcMain.handle(IPC_CHANNELS.agentsList, async (): Promise<AgentEntity[]> => agentStore.listAgents());

  ipcMain.handle(IPC_CHANNELS.agentsAdd, async (_event: unknown, payload: unknown): Promise<AgentEntity> => {
    const inputPayload: unknown = payload === undefined ? {} : payload;
    if (!inputPayload || typeof inputPayload !== 'object' || Array.isArray(inputPayload)) {
      throw new Error('invalid payload');
    }

    return agentStore.addAgent(inputPayload as AddAgentInput);
  });

  ipcMain.handle(IPC_CHANNELS.agentsRemove, async (_event: unknown, payload: unknown): Promise<{ ok: true }> => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('invalid payload');
    }

    const { id } = payload as { id?: unknown };
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error('invalid payload');
    }

    const appConfig = await loadAppConfig();
    const inUse = appConfig.flowTemplates.some((flowTemplate) =>
      flowTemplate.steps.some((step) => step.agentProfileId === id)
    );
    if (inUse) {
      throw new Error('AGENT_IN_USE');
    }

    await agentStore.removeAgent(id);
    return { ok: true };
  });
}
