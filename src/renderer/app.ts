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

interface ProjectItem {
  name: string;
  path: string;
}

interface ProjectState {
  currentProject?: ProjectItem | null;
  recentProjects?: ProjectItem[];
}

interface PickDirectoryResult {
  canceled?: boolean;
  path?: string;
}

interface SelectPathResult {
  outcome?: 'added' | 'switched' | 'exists' | 'failed';
}

interface ProjectApiLike {
  getState: () => Promise<ProjectState>;
  pickDirectory: () => Promise<PickDirectoryResult>;
  selectPath: (path: string) => Promise<SelectPathResult | void>;
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

function renderProjectGroup(
  doc: DocumentLike,
  root: ElementLike,
  state: ProjectState
): { actionButtons: ElementLike[] } {
  if (!state.currentProject) {
    const createButton = doc.createElement('button');
    createButton.textContent = '新建项目';

    const existingButton = doc.createElement('button');
    existingButton.textContent = '本地已有项目';

    root.replaceChildren(createButton, existingButton);
    return { actionButtons: [createButton, existingButton] };
  }

  const current = doc.createElement('p');
  current.textContent = `当前项目：${state.currentProject.name} (${state.currentProject.path})`;

  const title = doc.createElement('p');
  title.textContent = '最近项目：';

  const recentList = doc.createElement('ul');
  const recentProjects = state.recentProjects ?? [];
  if (recentProjects.length === 0) {
    const empty = doc.createElement('li');
    empty.textContent = '暂无最近项目';
    recentList.replaceChildren(empty);
  } else {
    const recentItems = recentProjects.map((project) => {
      const item = doc.createElement('li');
      item.textContent = `${project.name} - ${project.path}`;
      return item;
    });
    recentList.replaceChildren(...recentItems);
  }

  root.replaceChildren(current, title, recentList);
  return { actionButtons: [] };
}

async function refreshRuns(doc: DocumentLike, runsList: ElementLike, api: FlowApiLike): Promise<void> {
  const runs = await api.getRuns();
  renderRuns(doc, runsList, runs);
}

async function refreshProjectGroup(
  doc: DocumentLike,
  root: ElementLike,
  status: ElementLike,
  projectApi: ProjectApiLike,
  message?: string
): Promise<{ actionButtons: ElementLike[] }> {
  const state = await projectApi.getState();
  const rendered = renderProjectGroup(doc, root, state);

  if (message) {
    setStatus(status, message);
  } else if (state.currentProject) {
    setStatus(status, '已选择项目组');
  } else {
    setStatus(status, '未选择项目组');
  }

  return rendered;
}

export async function initRenderer(
  doc: DocumentLike,
  api: FlowApiLike & { projectApi?: ProjectApiLike }
): Promise<void> {
  const runButton = doc.getElementById('run-flow-btn');
  const runsList = doc.getElementById('runs-list');
  const statusText = doc.getElementById('status-text');
  const projectGroupRoot = doc.getElementById('project-group-root');
  const projectGroupStatus = doc.getElementById('project-group-status');

  if (!runButton || !runsList || !statusText) {
    return;
  }

  if (api.projectApi && projectGroupRoot && projectGroupStatus) {
    const pickAndSelect = async (): Promise<void> => {
      try {
        const picked = await api.projectApi!.pickDirectory();
        if (picked.canceled || !picked.path) {
          setStatus(projectGroupStatus, '已取消选择');
          return;
        }

        const selected = await api.projectApi!.selectPath(picked.path);
        const outcome = selected?.outcome ?? 'added';
        let message = '添加项目成功';

        if (outcome === 'exists') {
          message = '项目已存在，已切换';
        } else if (outcome === 'switched') {
          message = '切换项目成功';
        } else if (outcome === 'failed') {
          setStatus(projectGroupStatus, '项目选择失败');
          return;
        }

        await refreshProjectGroup(doc, projectGroupRoot, projectGroupStatus, api.projectApi!, message);
      } catch {
        setStatus(projectGroupStatus, '项目选择失败');
      }
    };

    const rendered = await refreshProjectGroup(doc, projectGroupRoot, projectGroupStatus, api.projectApi);
    for (const button of rendered.actionButtons) {
      button.addEventListener('click', async () => {
        await pickAndSelect();
      });
    }
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
    projectApi?: ProjectApiLike;
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.flowApi) {
  void initRenderer(document as unknown as DocumentLike, {
    ...window.flowApi,
    projectApi: window.projectApi
  });
}
