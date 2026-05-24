# Agent List Full Info Without ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Agent 列表改为“摘要显示 emoji+name，点击展开显示完整详情（不含 id）”，并保证 id 不出现在任何用户可见文本。

**Architecture:** 保持主进程存储与 IPC 接口不变，仅调整 `src/renderer/app.ts` 的 Agent 渲染逻辑与前端类型定义。通过渲染白名单控制可见字段，内部继续使用 `id` 作为删除动作参数。新增/修改渲染测试覆盖展开交互、字段展示与兜底逻辑。

**Tech Stack:** TypeScript, Electron renderer, Node test runner (`tsx --test`)

---

## File Structure

- Modify: `src/renderer/app.ts`
  - 扩展 `AgentEntity` 前端类型以包含 `emoji/command/argsTemplate/env`
  - 重写 `renderAgents` 为“摘要 + 可展开详情”结构
  - 仅在内部事件绑定中使用 `id`，禁止进入 UI 文本
- Modify: `tests/smoke/renderer_sections.test.ts`
  - 扩展 Fake API 测试数据结构
  - 新增 Agent 渲染行为测试（摘要、详情、兜底、删除）

### Task 1: 建立失败测试（摘要/详情/id 隐藏）

**Files:**
- Modify: `tests/smoke/renderer_sections.test.ts`
- Test: `tests/smoke/renderer_sections.test.ts`

- [ ] **Step 1: 写失败测试 - 摘要只显示 emoji+name 且不显示 id**

```ts
test('agent list summary should show emoji and name only', async () => {
  const doc = new FakeDocument();
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [
        {
          id: 'agent-1',
          name: 'Planner',
          emoji: '🤖',
          command: 'codex',
          argsTemplate: ['run'],
          env: { MODE: 'test' }
        }
      ],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api as never);

  const list = agentRoot.children[0];
  const firstItem = list.children[0];
  const summary = firstItem.children[0];
  assert.equal(summary.textContent, '🤖 Planner');
  assert.equal(summary.textContent.includes('agent-1'), false);
});
```

- [ ] **Step 2: 运行单测并确认失败**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`
Expected: FAIL，当前实现仍输出 `name (id)`，断言不通过。

- [ ] **Step 3: 写失败测试 - 点击摘要后展开详情且详情不显示 id**

```ts
test('agent detail should expand and never render id', async () => {
  const doc = new FakeDocument();
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [
        {
          id: 'agent-1',
          name: 'Planner',
          emoji: '🤖',
          command: 'codex',
          argsTemplate: ['run', '--json'],
          env: { MODE: 'test' }
        }
      ],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api as never);

  const list = agentRoot.children[0];
  const firstItem = list.children[0];
  const summary = firstItem.children[0];
  await summary.click();

  const detail = firstItem.children[1];
  assert.match(detail.textContent, /name: Planner/);
  assert.match(detail.textContent, /emoji: 🤖/);
  assert.match(detail.textContent, /command: codex/);
  assert.match(detail.textContent, /argsTemplate: \["run","--json"\]/);
  assert.match(detail.textContent, /env: \{"MODE":"test"\}/);
  assert.equal(detail.textContent.includes('agent-1'), false);
});
```

- [ ] **Step 4: 运行单测并确认失败**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`
Expected: FAIL，当前实现没有展开详情结构。

- [ ] **Step 5: 提交（仅测试）**

```bash
git add tests/smoke/renderer_sections.test.ts
git commit -m "test: add failing tests for agent summary and detail without id"
```

### Task 2: 最小实现通过测试（渲染与交互）

**Files:**
- Modify: `src/renderer/app.ts`
- Test: `tests/smoke/renderer_sections.test.ts`

- [ ] **Step 1: 扩展前端 AgentEntity 类型字段**

```ts
interface AgentEntity {
  id: string;
  name: string;
  emoji?: string;
  command?: string;
  argsTemplate?: string[];
  env?: Record<string, string>;
}
```

- [ ] **Step 2: 重写 renderAgents 为“摘要+详情”并隐藏 id 文本**

```ts
function renderAgents(
  doc: DocumentLike,
  root: ElementLike,
  agents: AgentEntity[]
): { deleteActions: { element: ElementLike; id: string }[] } {
  if (agents.length === 0) {
    const empty = doc.createElement('p');
    empty.textContent = '暂无 Agent，请先新增';
    root.replaceChildren(empty);
    return { deleteActions: [] };
  }

  const list = doc.createElement('ul');
  const deleteActions: { element: ElementLike; id: string }[] = [];
  let expandedIndex = -1;

  const renderList = (): void => {
    const items = agents.map((agent, index) => {
      const item = doc.createElement('li');

      const summary = doc.createElement('button');
      const emoji = agent.emoji && agent.emoji.trim() ? agent.emoji : '🙂';
      summary.textContent = `${emoji} ${agent.name}`;

      const detail = doc.createElement('p');
      const argsText = JSON.stringify(agent.argsTemplate ?? []);
      const envData = agent.env ?? {};
      const envText = Object.keys(envData).length === 0 ? '未设置' : JSON.stringify(envData);
      detail.textContent = [
        `name: ${agent.name}`,
        `emoji: ${emoji}`,
        `command: ${agent.command ?? ''}`,
        `argsTemplate: ${argsText}`,
        `env: ${envText}`
      ].join(' | ');

      const removeButton = doc.createElement('button');
      removeButton.textContent = '删除';
      deleteActions.push({ element: removeButton, id: agent.id });

      summary.addEventListener('click', async () => {
        expandedIndex = expandedIndex === index ? -1 : index;
        renderList();
      });

      if (expandedIndex === index) {
        item.replaceChildren(summary, detail, removeButton);
      } else {
        item.replaceChildren(summary, removeButton);
      }

      return item;
    });

    list.replaceChildren(...items);
    root.replaceChildren(list);
  };

  renderList();
  return { deleteActions };
}
```

- [ ] **Step 3: 运行针对测试确认通过**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`
Expected: PASS，新增测试通过，既有 renderer smoke 用例不回归。

- [ ] **Step 4: 运行全量测试确认无回归**

Run: `npm test`
Expected: PASS，所有测试通过。

- [ ] **Step 5: 提交（实现代码）**

```bash
git add src/renderer/app.ts
git commit -m "feat: render agent summary with emoji and expandable details without id"
```

### Task 3: 补充兜底与删除交互回归测试

**Files:**
- Modify: `tests/smoke/renderer_sections.test.ts`
- Test: `tests/smoke/renderer_sections.test.ts`

- [ ] **Step 1: 写失败测试 - emoji/env/argsTemplate 兜底显示**

```ts
test('agent detail should apply fallback values for emoji argsTemplate and env', async () => {
  const doc = new FakeDocument();
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');

  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [{ id: 'agent-1', name: 'Fallback' }],
      add: async () => ({}),
      remove: async () => ({ ok: true })
    }
  };

  await initRenderer(doc as never, api as never);

  const list = agentRoot.children[0];
  const firstItem = list.children[0];
  const summary = firstItem.children[0];
  assert.equal(summary.textContent, '🙂 Fallback');

  await summary.click();
  const detail = firstItem.children[1];
  assert.match(detail.textContent, /argsTemplate: \[\]/);
  assert.match(detail.textContent, /env: 未设置/);
});
```

- [ ] **Step 2: 写失败测试 - 删除按钮仍可用且不依赖 id 显示**

```ts
test('agent delete button should still call remove by internal id', async () => {
  const doc = new FakeDocument();
  doc.register('run-flow-btn', 'button');
  doc.register('runs-list', 'ul');
  doc.register('status-text', 'p');
  doc.register('agent-add-btn', 'button');
  doc.register('agent-status', 'p');
  const agentRoot = doc.register('agent-root', 'div');

  const removedIds: string[] = [];
  const api = {
    runFlow: async () => ({}),
    getRuns: async () => [],
    agentApi: {
      list: async () => [
        {
          id: 'agent-internal-1',
          name: 'Removable',
          emoji: '🧪',
          command: 'codex',
          argsTemplate: [],
          env: {}
        }
      ],
      add: async () => ({}),
      remove: async (id: string) => {
        removedIds.push(id);
        return { ok: true };
      }
    }
  };

  await initRenderer(doc as never, api as never);

  const list = agentRoot.children[0];
  const firstItem = list.children[0];
  const removeButton = firstItem.children[1];
  await removeButton.click();

  assert.deepEqual(removedIds, ['agent-internal-1']);
});
```

- [ ] **Step 3: 运行针对测试确认失败后修正断言细节并通过**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`
Expected: 先 FAIL（若断言路径与结构不符），修正后 PASS。

- [ ] **Step 4: 再次运行全量测试**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交（回归测试）**

```bash
git add tests/smoke/renderer_sections.test.ts
git commit -m "test: cover agent detail fallback and delete interaction"
```

## Self-Review Checklist (Applied)

- Spec coverage: 已覆盖摘要显示、点击展开详情、详情字段、隐藏 id、空值兜底、删除回归。
- Placeholder scan: 文档中无 `TBD/TODO/implement later` 等占位词。
- Type consistency: `AgentEntity` 字段命名在计划内统一为 `emoji/command/argsTemplate/env`。
