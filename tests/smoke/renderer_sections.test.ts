import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { initRenderer } from '../../src/renderer/app';

class FakeElement {
  public textContent = '';
  public innerHTML = '';
  public disabled = false;
  public children: FakeElement[] = [];
  public readonly tagName: string;
  private listeners = new Map<string, Array<() => void | Promise<void>>>();

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  addEventListener(event: string, handler: () => void | Promise<void>): void {
    const current = this.listeners.get(event) ?? [];
    current.push(handler);
    this.listeners.set(event, current);
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = children;
  }

  async click(): Promise<void> {
    const handlers = this.listeners.get('click') ?? [];
    for (const handler of handlers) {
      await handler();
    }
  }
}

class FakeDocument {
  private readonly elements = new Map<string, FakeElement>();

  getElementById(id: string): FakeElement | null {
    return this.elements.get(id) ?? null;
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  register(id: string, tagName?: string): FakeElement {
    const element = new FakeElement(tagName);
    this.elements.set(id, element);
    return element;
  }
}

test('renderer page should include four v1 sections', () => {
  const html = readFileSync(join(process.cwd(), 'src/renderer/index.html'), 'utf-8');

  assert.match(html, /项目组/);
  assert.match(html, /Agent/);
  assert.match(html, /流程模板/);
  assert.match(html, /运行中心/);
  assert.match(html, /project-group-root/);
  assert.match(html, /agent-add-btn/);
  assert.match(html, /agent-status/);
  assert.match(html, /agent-root/);
});

test('build script should copy index.html and styles.css to dist/renderer', () => {
  const pkg = readFileSync(join(process.cwd(), 'package.json'), 'utf-8');

  assert.match(pkg, /copyFileSync\('src\/renderer\/index\.html','dist\/renderer\/index\.html'\)/);
  assert.match(pkg, /copyFileSync\('src\/renderer\/styles\.css','dist\/renderer\/styles\.css'\)/);
});

test('initRenderer should bind run button and render runs list', async () => {
  const doc = new FakeDocument();
  const runButton = doc.register('run-flow-btn', 'button');
  const runsList = doc.register('runs-list', 'ul');
  const statusText = doc.register('status-text', 'p');

  let runFlowCalls = 0;
  let getRunsCalls = 0;

  const api = {
    runFlow: async () => {
      runFlowCalls += 1;
      return {
        runId: 'run-1',
        flowTemplateId: 'flow-1',
        startedAt: '2026-05-23T08:00:00.000Z',
        result: {
          finalStatus: 'SUCCEEDED',
          stepResults: []
        }
      };
    },
    getRuns: async () => {
      getRunsCalls += 1;
      return [
        {
          runId: 'run-1',
          flowTemplateId: 'flow-1',
          startedAt: '2026-05-23T08:00:00.000Z',
          result: {
            finalStatus: 'SUCCEEDED',
            stepResults: []
          }
        }
      ];
    }
  };

  await initRenderer(doc as never, api);
  await runButton.click();

  assert.equal(runFlowCalls, 1);
  assert.equal(getRunsCalls, 2);
  assert.equal(runsList.children.length, 1);
  assert.equal(runsList.children[0].textContent, 'run-1 - SUCCEEDED');
  assert.equal(statusText.textContent, '运行成功');
});

test('initRenderer should show error text when runFlow fails', async () => {
  const doc = new FakeDocument();
  const runButton = doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  const statusText = doc.register('status-text', 'p');

  const api = {
    runFlow: async () => {
      throw new Error('boom');
    },
    getRuns: async () => []
  };

  await initRenderer(doc as never, api);
  await runButton.click();

  assert.equal(statusText.textContent, '运行失败，请稍后重试');
});

test('initRenderer should render project-group empty state buttons', async () => {
  const doc = new FakeDocument();
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');
  const projectGroupRoot = doc.register('project-group-root', 'div');
  doc.register('project-group-status', 'p');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    projectApi: {
      getState: async () => ({
        currentProjectPath: null,
        projects: []
      }),
      pickDirectory: async () => ({ canceled: true }),
      selectPath: async () => ({
        currentProjectPath: null,
        projects: []
      })
    }
  };

  await initRenderer(doc as never, api);

  assert.equal(projectGroupRoot.children.length, 2);
  assert.equal(projectGroupRoot.children[0].textContent, '新建项目');
  assert.equal(projectGroupRoot.children[1].textContent, '本地已有项目');
});

test('initRenderer should switch current project when clicking project list item', async () => {
  const doc = new FakeDocument();
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');
  const projectGroupRoot = doc.register('project-group-root', 'div');
  const projectGroupStatus = doc.register('project-group-status', 'p');

  const projects = [
    { name: 'project-a', path: '/tmp/project-a' },
    { name: 'project-b', path: '/tmp/project-b' }
  ];
  let currentProjectPath = '/tmp/project-a';
  const selectedPaths: string[] = [];

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    projectApi: {
      getState: async () => ({
        currentProjectPath,
        projects
      }),
      pickDirectory: async () => ({ canceled: true }),
      selectPath: async (path: string) => {
        selectedPaths.push(path);
        currentProjectPath = path;
        return {
          currentProjectPath,
          projects
        };
      }
    }
  };

  await initRenderer(doc as never, api);

  const projectList = projectGroupRoot.children[2];
  assert.ok(projectList);
  await projectList.children[1].click();

  assert.deepEqual(selectedPaths, ['/tmp/project-b']);
  assert.equal(projectGroupStatus.textContent, '切换项目成功');
});

test('initRenderer should render agent empty state on initial load', async () => {
  const doc = new FakeDocument();
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');
  doc.register('agent-add-btn', 'button');
  const agentStatus = doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api);

  assert.equal(agentRoot.children.length, 1);
  assert.equal(agentRoot.children[0].textContent, '暂无 Agent，请先新增');
  assert.equal(agentStatus.textContent, '就绪');
});

test('initRenderer should show new agent item after add', async () => {
  const doc = new FakeDocument();
  const addButton = doc.register('agent-add-btn', 'button');
  const agentStatus = doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');

  const agents: Array<{ id: string; name: string; emoji?: string; command?: string; argsTemplate?: string[]; env?: Record<string, string> }> = [];
  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [...agents],
      add: async () => {
        agents.push({ id: 'agent-1', name: 'Agent 1', emoji: '🤖', command: 'codex', argsTemplate: ['run'], env: { MODE: 'dev' } });
        return agents[0];
      },
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api);
  await addButton.click();

  assert.equal(agentRoot.children.length, 1);
  const list = agentRoot.children[0];
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[0].textContent, '🤖 Agent 1');
  assert.equal(list.children[0].children[0].textContent.includes('agent-1'), false);
  assert.equal(agentStatus.textContent, '就绪');
});

test('initRenderer should reduce agent list after delete success', async () => {
  const doc = new FakeDocument();
  doc.register('agent-add-btn', 'button');
  const agentStatus = doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');

  const agents: Array<{ id: string; name: string; emoji?: string; command?: string; argsTemplate?: string[]; env?: Record<string, string> }> = [
    { id: 'agent-1', name: 'Agent 1', emoji: '🤖', command: 'codex', argsTemplate: ['run'], env: { MODE: 'dev' } },
    { id: 'agent-2', name: 'Agent 2', emoji: '🧪', command: 'node', argsTemplate: ['main.js'], env: { NODE_ENV: 'test' } }
  ];
  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [...agents],
      add: async () => ({}),
      remove: async (id: string) => {
        const idx = agents.findIndex((item) => item.id === id);
        if (idx >= 0) {
          agents.splice(idx, 1);
        }
        return { ok: true };
      }
    }
  };

  await initRenderer(doc as never, api);

  const listBefore = agentRoot.children[0];
  assert.equal(listBefore.children.length, 2);
  await listBefore.children[0].children[1].click();

  const listAfter = agentRoot.children[0];
  assert.equal(listAfter.children.length, 1);
  assert.equal(listAfter.children[0].children[0].textContent, '🧪 Agent 2');
  assert.equal(agentStatus.textContent, '就绪');
});

test('initRenderer should show AGENT_IN_USE message when delete fails with reference error', async () => {
  const doc = new FakeDocument();
  doc.register('agent-add-btn', 'button');
  const agentStatus = doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [{ id: 'agent-1', name: 'Agent 1', emoji: '🤖', command: 'codex', argsTemplate: ['run'], env: { MODE: 'dev' } }],
      add: async () => ({}),
      remove: async () => {
        throw new Error('AGENT_IN_USE');
      }
    }
  };

  await initRenderer(doc as never, api);

  const list = agentRoot.children[0];
  await list.children[0].children[1].click();

  assert.equal(agentStatus.textContent, '该 Agent 已被流程模板引用，无法删除');
});

test('initRenderer should render agent summary as emoji plus name and hide id from visible text', async () => {
  const doc = new FakeDocument();
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [{ id: 'agent-secret', name: 'Agent One', emoji: '🚀', command: 'codex', argsTemplate: ['run'], env: { A: '1' } }],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api);

  const list = agentRoot.children[0];
  const first = list.children[0];
  assert.equal(first.children[0].textContent, '🚀 Agent One');
  for (const child of first.children) {
    assert.equal(child.textContent.includes('agent-secret'), false);
  }
});

test('initRenderer should expand only one agent details and hide id while showing required fields', async () => {
  const doc = new FakeDocument();
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [
        { id: 'agent-1', name: 'Alpha', emoji: '🤖', command: 'codex', argsTemplate: ['run', '--fast'], env: { MODE: 'dev' } },
        { id: 'agent-2', name: 'Beta', emoji: '🧪', command: 'node', argsTemplate: ['main.js'], env: { NODE_ENV: 'test' } }
      ],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api);
  const list = agentRoot.children[0];
  await list.children[0].children[0].click();
  const firstAfterExpand = agentRoot.children[0].children[0];
  assert.equal(firstAfterExpand.children.length, 4);
  assert.equal(firstAfterExpand.children[1].textContent, 'name: Alpha');
  assert.equal(firstAfterExpand.children[2].textContent, 'emoji: 🤖 | command: codex | argsTemplate: ["run","--fast"] | env: {"MODE":"dev"}');
  for (const child of firstAfterExpand.children) {
    assert.equal(child.textContent.includes('agent-1'), false);
  }

  await agentRoot.children[0].children[1].children[0].click();
  const listAfterSecondExpand = agentRoot.children[0];
  assert.equal(listAfterSecondExpand.children[0].children.length, 2);
  assert.equal(listAfterSecondExpand.children[1].children.length, 4);
});

test('initRenderer should apply fallback values in expanded agent details', async () => {
  const doc = new FakeDocument();
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [{ id: 'agent-1', name: 'NoMeta', command: '', argsTemplate: [], env: {} }],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api);
  await agentRoot.children[0].children[0].children[0].click();

  const expanded = agentRoot.children[0].children[0];
  assert.equal(expanded.children[0].textContent, '🙂 NoMeta');
  assert.equal(expanded.children[2].textContent, 'emoji: 🙂 | command:  | argsTemplate: [] | env: 未设置');
});

test('initRenderer should fallback emoji in summary when emoji is empty or blank', async () => {
  const doc = new FakeDocument();
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [
        { id: 'agent-1', name: 'EmptyEmoji', emoji: '' },
        { id: 'agent-2', name: 'BlankEmoji', emoji: '   ' }
      ],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api);

  const list = agentRoot.children[0];
  assert.equal(list.children[0].children[0].textContent, '🙂 EmptyEmoji');
  assert.equal(list.children[1].children[0].textContent, '🙂 BlankEmoji');
});
