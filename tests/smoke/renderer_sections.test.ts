import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { initRenderer } from '../../src/renderer/app';

class FakeElement {
  public textContent = '';
  public innerHTML = '';
  public disabled = false;
  private listeners = new Map<string, Array<() => void | Promise<void>>>();

  addEventListener(event: string, handler: () => void | Promise<void>): void {
    const current = this.listeners.get(event) ?? [];
    current.push(handler);
    this.listeners.set(event, current);
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

  register(id: string): FakeElement {
    const element = new FakeElement();
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
});

test('initRenderer should bind run button and render runs list', async () => {
  const doc = new FakeDocument();
  const runButton = doc.register('run-flow-btn');
  const runsList = doc.register('runs-list');

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
          status: 'SUCCEEDED',
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
            status: 'SUCCEEDED',
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
  assert.match(runsList.innerHTML, /run-1/);
  assert.match(runsList.innerHTML, /SUCCEEDED/);
});
