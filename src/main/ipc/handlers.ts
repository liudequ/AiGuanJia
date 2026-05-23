import { parseFlowTemplate, type FlowTemplate } from '../domain/models';
import { runFlow, type FlowExecutionResult } from '../engine/execution_engine';

export const IPC_CHANNELS = {
  flowRun: 'flow:run',
  runsGet: 'runs:get'
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
}

function buildDefaultExecuteFlow(): (template: FlowTemplate) => Promise<FlowExecutionResult> {
  return async (template: FlowTemplate) => runFlow(template, async () => ({ exitCode: 0 }));
}

export function registerIpcHandlers(ipcMain: IpcMainLike, deps: HandlerDeps = {}): void {
  const runs: FlowRunRecord[] = [];
  const executeFlow = deps.executeFlow ?? buildDefaultExecuteFlow();

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
}
