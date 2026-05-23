import { parseFlowTemplate, type FlowTemplate } from '../domain/models';
import { runFlow, type FlowExecutionResult } from '../engine/execution_engine';
import { createProjectStore, type ProjectState, type ProjectStore } from '../storage/project_store';

export const IPC_CHANNELS = {
  flowRun: 'flow:run',
  runsGet: 'runs:get',
  projectsGetState: 'projects:getState',
  projectsSelectPath: 'projects:selectPath',
  projectsPickDirectory: 'projects:pickDirectory'
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

  ipcMain.handle(IPC_CHANNELS.runsGet, async () => runs);

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
}
