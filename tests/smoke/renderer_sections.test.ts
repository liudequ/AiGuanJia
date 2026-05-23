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
