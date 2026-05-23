interface RunRecord {
  runId: string;
  result?: {
    status?: string;
  };
}

interface FlowApiLike {
  runFlow: (template: unknown) => Promise<unknown>;
  getRuns: () => Promise<RunRecord[]>;
}

interface ElementLike {
  innerHTML: string;
  addEventListener: (event: 'click', handler: () => Promise<void>) => void;
}

const DEFAULT_TEMPLATE = {
  id: 'flow-v1-demo',
  name: 'V1 演示流程',
  steps: [{ id: 'step-1', name: '执行默认步骤' }]
};

function renderRuns(runsList: ElementLike, runs: RunRecord[]): void {
  if (runs.length === 0) {
    runsList.innerHTML = '<li>暂无运行记录</li>';
    return;
  }

  runsList.innerHTML = runs
    .map((run) => `<li>${run.runId} - ${run.result?.status ?? 'UNKNOWN'}</li>`)
    .join('');
}

async function refreshRuns(runsList: ElementLike, api: FlowApiLike): Promise<void> {
  const runs = await api.getRuns();
  renderRuns(runsList, runs);
}

export async function initRenderer(
  doc: Pick<Document, 'getElementById'>,
  api: FlowApiLike
): Promise<void> {
  const runButton = doc.getElementById('run-flow-btn');
  const runsList = doc.getElementById('runs-list');

  if (!runButton || !runsList || !('addEventListener' in runButton) || !('innerHTML' in runsList)) {
    return;
  }

  runButton.addEventListener('click', async () => {
    await api.runFlow(DEFAULT_TEMPLATE);
    await refreshRuns(runsList, api);
  });

  await refreshRuns(runsList, api);
}

declare global {
  interface Window {
    flowApi?: FlowApiLike;
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.flowApi) {
  void initRenderer(document, window.flowApi);
}
