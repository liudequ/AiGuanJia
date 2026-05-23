interface RunRecord {
  runId: string;
  result?: {
    finalStatus?: string;
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
  currentProjectPath?: string | null;
  projects?: ProjectItem[];
}

interface PickDirectoryResult {
  canceled?: boolean;
  path?: string;
}

interface ProjectApiLike {
  getState: () => Promise<ProjectState>;
  pickDirectory: () => Promise<PickDirectoryResult>;
  selectPath: (path: string) => Promise<ProjectState | void>;
}

interface ProjectPathAction {
  element: ElementLike;
  path: string;
}

interface ProjectGroupRenderResult {
  actionButtons: ElementLike[];
  pathActions: ProjectPathAction[];
}

interface ElementLike {
  textContent: string;
  children: ElementLike[];
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
    item.textContent = `${run.runId} - ${run.result?.finalStatus ?? run.result?.status ?? 'UNKNOWN'}`;
    return item;
  });

  runsList.replaceChildren(...items);
}

function renderProjectGroup(
  doc: DocumentLike,
  root: ElementLike,
  state: ProjectState
): ProjectGroupRenderResult {
  const projects = state.projects ?? [];
  const currentProject = state.currentProjectPath
    ? projects.find((project) => project.path === state.currentProjectPath)
    : undefined;

  if (!currentProject) {
    const createButton = doc.createElement('button');
    createButton.textContent = '新建项目';

    const existingButton = doc.createElement('button');
    existingButton.textContent = '本地已有项目';

    root.replaceChildren(createButton, existingButton);
    return { actionButtons: [createButton, existingButton], pathActions: [] };
  }

  const current = doc.createElement('p');
  current.textContent = `当前项目：${currentProject.name} (${currentProject.path})`;

  const title = doc.createElement('p');
  title.textContent = '项目列表：';

  const projectList = doc.createElement('ul');
  if (projects.length === 0) {
    const empty = doc.createElement('li');
    empty.textContent = '暂无项目';
    projectList.replaceChildren(empty);
  } else {
    const projectItems = projects.map((project) => {
      const item = doc.createElement('li');
      item.textContent = `${project.name} - ${project.path}`;
      return item;
    });
    projectList.replaceChildren(...projectItems);
  }

  root.replaceChildren(current, title, projectList);
  const pathActions = projectList.children.map((element, index) => ({
    element,
    path: projects[index]?.path ?? ''
  }));
  return { actionButtons: [], pathActions };
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
): Promise<ProjectGroupRenderResult> {
  const state = await projectApi.getState();
  const rendered = renderProjectGroup(doc, root, state);

  if (message) {
    setStatus(status, message);
  } else if (state.currentProjectPath) {
    setStatus(status, '已选择项目组');
  } else {
    setStatus(status, '未选择项目组');
  }

  return rendered;
}

function bindProjectGroupHandlers(
  rendered: ProjectGroupRenderResult,
  onPick: () => Promise<void>,
  onSelectPath: (path: string) => Promise<void>
): void {
  for (const button of rendered.actionButtons) {
    button.addEventListener('click', async () => {
      await onPick();
    });
  }

  for (const action of rendered.pathActions) {
    if (!action.path) {
      continue;
    }
    action.element.addEventListener('click', async () => {
      await onSelectPath(action.path);
    });
  }
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

  if (projectGroupRoot && projectGroupStatus && !api.projectApi) {
    const rendered = renderProjectGroup(doc, projectGroupRoot, {
      currentProjectPath: null,
      projects: []
    });
    for (const button of rendered.actionButtons) {
      button.addEventListener('click', async () => {
        setStatus(projectGroupStatus, '项目功能暂不可用，请重启应用');
      });
    }
    setStatus(projectGroupStatus, '未选择项目组');
  } else if (api.projectApi && projectGroupRoot && projectGroupStatus) {
    const switchByPath = async (path: string): Promise<void> => {
      try {
        const prevState = await api.projectApi!.getState();
        const nextState = (await api.projectApi!.selectPath(path)) ?? (await api.projectApi!.getState());
        const rendered = renderProjectGroup(doc, projectGroupRoot, nextState);
        bindProjectGroupHandlers(rendered, pickAndSelect, switchByPath);
        if (nextState.currentProjectPath === prevState.currentProjectPath) {
          setStatus(projectGroupStatus, '已选择该项目');
          return;
        }
        setStatus(projectGroupStatus, '切换项目成功');
      } catch {
        setStatus(projectGroupStatus, '项目切换失败');
      }
    };

    const pickAndSelect = async (): Promise<void> => {
      try {
        const prevState = await api.projectApi!.getState();
        const picked = await api.projectApi!.pickDirectory();
        if (picked.canceled || !picked.path) {
          setStatus(projectGroupStatus, '已取消选择');
          return;
        }

        const nextState = (await api.projectApi!.selectPath(picked.path)) ?? (await api.projectApi!.getState());
        let message = '项目选择成功';
        if (nextState.currentProjectPath === prevState.currentProjectPath) {
          message = '已选择该项目';
        } else if (!prevState.currentProjectPath && nextState.currentProjectPath) {
          message = '添加并选择项目成功';
        } else if (prevState.currentProjectPath && nextState.currentProjectPath) {
          message = '切换项目成功';
        }

        const rendered = renderProjectGroup(doc, projectGroupRoot, nextState);
        bindProjectGroupHandlers(rendered, pickAndSelect, switchByPath);
        setStatus(projectGroupStatus, message);
      } catch {
        setStatus(projectGroupStatus, '项目选择失败');
      }
    };

    try {
      const rendered = await refreshProjectGroup(doc, projectGroupRoot, projectGroupStatus, api.projectApi);
      bindProjectGroupHandlers(rendered, pickAndSelect, switchByPath);
    } catch {
      setStatus(projectGroupStatus, '加载项目组失败');
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
} else if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  void initRenderer(document as unknown as DocumentLike, {
    runFlow: async () => {
      throw new Error('flowApi unavailable');
    },
    getRuns: async () => [],
    projectApi: window.projectApi
  });
}
