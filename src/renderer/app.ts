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
  textContent: string;
  replaceChildren: (...children: ElementLike[]) => void;
  addEventListener: (event: 'click', handler: () => Promise<void>) => void;
}

interface DocumentLike {
  getElementById: (id: string) => ElementLike | null;
  createElement: (tagName: string) => ElementLike;
}

const DEFAULT_TEMPLATE = {
  id: 'flow-v1-demo',
  name: 'V1 演示流程',
  steps: [{ id: 'step-1', name: '执行默认步骤' }]
};

function setStatus(statusText: ElementLike, message: string): void {
  statusText.textContent = message;
}

function renderRuns(doc: DocumentLike, runsList: ElementLike, runs: RunRecord[]): void {
  if (runs.length === 0) {
    const emptyItem = doc.createElement('li');
    emptyItem.textContent = '暂无运行记录';
    runsList.replaceChildren(emptyItem);
    return;
  }

  const items = runs.map((run) => {
    const item = doc.createElement('li');
    item.textContent = `${run.runId} - ${run.result?.status ?? 'UNKNOWN'}`;
    return item;
  });

  runsList.replaceChildren(...items);
}

async function refreshRuns(doc: DocumentLike, runsList: ElementLike, api: FlowApiLike): Promise<void> {
  const runs = await api.getRuns();
  renderRuns(doc, runsList, runs);
}

export async function initRenderer(doc: DocumentLike, api: FlowApiLike): Promise<void> {
  const runButton = doc.getElementById('run-flow-btn');
  const runsList = doc.getElementById('runs-list');
  const statusText = doc.getElementById('status-text');

  if (!runButton || !runsList || !statusText) {
    return;
  }

  runButton.addEventListener('click', async () => {
    try {
      await api.runFlow(DEFAULT_TEMPLATE);
      await refreshRuns(doc, runsList, api);
      setStatus(statusText, '运行成功');
    } catch {
      setStatus(statusText, '运行失败，请稍后重试');
    }
  });

  try {
    await refreshRuns(doc, runsList, api);
    setStatus(statusText, '就绪');
  } catch {
    setStatus(statusText, '加载运行记录失败');
  }
}

declare global {
  interface Window {
    flowApi?: FlowApiLike;
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.flowApi) {
  void initRenderer(document as unknown as DocumentLike, window.flowApi);
}
