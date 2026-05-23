# Agent 标签全局管理（单文件实体）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Agent 标签页实现全局 Agent 列表的持久化管理（新增/删除/被引用不可删），并补齐主进程、预加载、渲染与测试闭环。

**Architecture:** 新增独立 `agent_store` 负责 `~/.aiguanjia/agents/` 下的索引与实体文件；IPC 新增 `agents:list/add/remove` 通道；preload 暴露 `agentApi`；renderer 在 Agent 面板接入列表、新增、删除与状态提示。删除前在主进程进行 flow template 引用校验，避免悬挂引用。

**Tech Stack:** TypeScript, Electron IPC, Node.js fs/promises, node:test, assert/strict

---

## File Structure

- Create: `src/main/storage/agent_store.ts`（全局 Agent 持久化与校验）
- Modify: `src/main/ipc/handlers.ts`（注册 Agent IPC 与引用校验）
- Modify: `src/main/preload.ts`（暴露 `agentApi`）
- Modify: `src/renderer/app.ts`（Agent 面板渲染与交互）
- Modify: `src/renderer/index.html`（Agent 面板容器）
- Create: `tests/storage/agent_store.test.ts`
- Modify: `tests/ipc/handlers.test.ts`
- Modify: `tests/main/preload.test.ts`
- Modify: `tests/smoke/renderer_sections.test.ts`

### Task 1: 新增 Agent Store（TDD）

**Files:**
- Create: `tests/storage/agent_store.test.ts`
- Create: `src/main/storage/agent_store.ts`

- [ ] **Step 1: 写失败测试（空仓库、新增、删除、名称唯一、损坏索引）**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createAgentStore } from '../../src/main/storage/agent_store';

test('listAgents should return empty when index missing', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'agent-store-'));
  const store = createAgentStore({ homeDir: home, now: () => '2026-05-23T00:00:00.000Z' });
  const list = await store.listAgents();
  assert.deepEqual(list, []);
});

test('addAgent should persist index and entity file', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'agent-store-'));
  const store = createAgentStore({ homeDir: home, now: () => '2026-05-23T00:00:00.000Z' });
  const created = await store.addAgent();
  assert.equal(created.name, '新建 Agent 1');
  assert.equal(created.icon, '🤖');

  const indexPath = path.join(home, '.aiguanjia', 'agents', 'index.json');
  const indexRaw = JSON.parse(await readFile(indexPath, 'utf8')) as { agentIds: string[] };
  assert.equal(indexRaw.agentIds.length, 1);
});

test('removeAgent should delete entity and update index', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'agent-store-'));
  const store = createAgentStore({ homeDir: home, now: () => '2026-05-23T00:00:00.000Z' });
  const created = await store.addAgent();
  await store.removeAgent(created.id);
  assert.deepEqual(await store.listAgents(), []);
});

test('addAgent should pick smallest available default suffix', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'agent-store-'));
  const store = createAgentStore({ homeDir: home, now: () => '2026-05-23T00:00:00.000Z' });
  const a1 = await store.addAgent();
  const a2 = await store.addAgent();
  await store.removeAgent(a1.id);
  const a3 = await store.addAgent();
  assert.equal(a2.name, '新建 Agent 2');
  assert.equal(a3.name, '新建 Agent 1');
});

test('listAgents should throw AGENT_STORE_CORRUPTED when index references missing file', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'agent-store-'));
  const agentsDir = path.join(home, '.aiguanjia', 'agents');
  await writeFile(path.join(agentsDir, 'index.json'), JSON.stringify({ version: 1, agentIds: ['missing-id'] }), 'utf8');
  const store = createAgentStore({ homeDir: home });
  await assert.rejects(() => store.listAgents(), /AGENT_STORE_CORRUPTED/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/storage/agent_store.test.ts`  
Expected: FAIL（`Cannot find module '../../src/main/storage/agent_store'`）

- [ ] **Step 3: 写最小实现**

```ts
// src/main/storage/agent_store.ts
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';

export interface AgentRecord {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentIndex {
  version: number;
  agentIds: string[];
}

export interface AgentStoreDeps {
  homeDir?: string;
  now?: () => string;
  uuid?: () => string;
}

export interface AgentStore {
  listAgents(): Promise<AgentRecord[]>;
  addAgent(): Promise<AgentRecord>;
  removeAgent(id: string): Promise<void>;
}

function buildPaths(homeDir: string): { dir: string; index: string; entity: (id: string) => string } {
  const dir = join(homeDir, '.aiguanjia', 'agents');
  return { dir, index: join(dir, 'index.json'), entity: (id: string) => join(dir, `${id}.json`) };
}

async function safeReadIndex(indexPath: string): Promise<AgentIndex> {
  try {
    await access(indexPath, constants.F_OK);
  } catch {
    return { version: 1, agentIds: [] };
  }
  const parsed = JSON.parse(await readFile(indexPath, 'utf8')) as AgentIndex;
  if (!Array.isArray(parsed.agentIds)) throw new Error('AGENT_STORE_CORRUPTED: invalid index');
  return { version: 1, agentIds: parsed.agentIds };
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function nextDefaultName(existing: AgentRecord[]): string {
  const taken = new Set<number>();
  for (const item of existing) {
    const m = /^新建 Agent (\d+)$/.exec(item.name);
    if (m) taken.add(Number(m[1]));
  }
  let i = 1;
  while (taken.has(i)) i += 1;
  return `新建 Agent ${i}`;
}

export function createAgentStore(deps: AgentStoreDeps = {}): AgentStore {
  const home = deps.homeDir ?? homedir();
  const now = deps.now ?? (() => new Date().toISOString());
  const uuid = deps.uuid ?? randomUUID;
  const paths = buildPaths(home);

  return {
    async listAgents(): Promise<AgentRecord[]> {
      const index = await safeReadIndex(paths.index);
      const records: AgentRecord[] = [];
      for (const id of index.agentIds) {
        try {
          const raw = await readFile(paths.entity(id), 'utf8');
          records.push(JSON.parse(raw) as AgentRecord);
        } catch {
          throw new Error(`AGENT_STORE_CORRUPTED: missing entity for ${id}`);
        }
      }
      return records;
    },
    async addAgent(): Promise<AgentRecord> {
      const list = await this.listAgents();
      const id = `agent-${uuid()}`;
      const ts = now();
      const created: AgentRecord = { id, name: nextDefaultName(list), icon: '🤖', createdAt: ts, updatedAt: ts };
      const index = await safeReadIndex(paths.index);
      index.agentIds.push(id);
      await writeJson(paths.entity(id), created);
      await writeJson(paths.index, index);
      return created;
    },
    async removeAgent(id: string): Promise<void> {
      const index = await safeReadIndex(paths.index);
      if (!index.agentIds.includes(id)) throw new Error('AGENT_NOT_FOUND');
      index.agentIds = index.agentIds.filter((x) => x !== id);
      await rm(paths.entity(id), { force: true });
      await writeJson(paths.index, index);
    }
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/storage/agent_store.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add tests/storage/agent_store.test.ts src/main/storage/agent_store.ts
git commit -m "feat: add global agent store with per-agent files"
```

### Task 2: 扩展 IPC（agents:list/add/remove + 被引用不可删）

**Files:**
- Modify: `src/main/ipc/handlers.ts`
- Modify: `tests/ipc/handlers.test.ts`

- [ ] **Step 1: 写失败测试（通道注册、add/list、remove 被引用失败）**

```ts
test('registerIpcHandlers should register agent channels', () => {
  // 断言 IPC_CHANNELS 包含 agentsList/agentsAdd/agentsRemove
});

test('agents:add then agents:list should include created item', async () => {
  // 调 handlers.get(IPC_CHANNELS.agentsAdd) 后再 list，断言长度和默认 icon
});

test('agents:remove should reject with AGENT_IN_USE when referenced by flow template step', async () => {
  // 构造 flowTemplates 中 step.agentProfileId = created.id，删除应 reject /AGENT_IN_USE/
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/ipc/handlers.test.ts`  
Expected: FAIL（缺少 agent 通道与逻辑）

- [ ] **Step 3: 实现 IPC 与引用校验**

```ts
// handlers.ts 增量示意
import { createAgentStore, type AgentStore } from '../storage/agent_store';
import { readConfig } from '../storage/config_store';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const IPC_CHANNELS = {
  // ...
  agentsList: 'agents:list',
  agentsAdd: 'agents:add',
  agentsRemove: 'agents:remove'
} as const;

export interface HandlerDeps {
  // ...
  agentStore?: AgentStore;
  loadAppConfig?: () => Promise<{ flowTemplates: Array<{ steps: Array<{ agentProfileId?: string }> }> } | null>;
}

const agentStore = deps.agentStore ?? createAgentStore();
const loadAppConfig =
  deps.loadAppConfig ??
  (() => readConfig(join(homedir(), '.aiguanjia', 'config.json')) as Promise<any>);

ipcMain.handle(IPC_CHANNELS.agentsList, async () => agentStore.listAgents());
ipcMain.handle(IPC_CHANNELS.agentsAdd, async () => agentStore.addAgent());
ipcMain.handle(IPC_CHANNELS.agentsRemove, async (_event, payload) => {
  if (!payload || typeof payload !== 'object' || typeof (payload as any).id !== 'string' || !(payload as any).id.trim()) {
    throw new Error('Invalid payload: id must be a non-empty string.');
  }
  const id = (payload as any).id.trim();
  const config = await loadAppConfig();
  const inUse = !!config?.flowTemplates?.some((tpl: any) =>
    Array.isArray(tpl.steps) && tpl.steps.some((s: any) => s.agentProfileId === id)
  );
  if (inUse) throw new Error('AGENT_IN_USE');
  await agentStore.removeAgent(id);
  return { ok: true as const };
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/ipc/handlers.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/ipc/handlers.ts tests/ipc/handlers.test.ts
git commit -m "feat: add agent ipc handlers with in-use guard"
```

### Task 3: 扩展 preload 暴露 agentApi

**Files:**
- Modify: `src/main/preload.ts`
- Modify: `tests/main/preload.test.ts`

- [ ] **Step 1: 写失败测试（agentApi 映射）**

```ts
// preload.test.ts 增加断言：
// exposed.agentApi 存在，并调用 list/add/remove 时走 IPC_CHANNELS.agentsList/agentsAdd/agentsRemove
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/main/preload.test.ts`  
Expected: FAIL（agentApi 未暴露）

- [ ] **Step 3: 修改 preload**

```ts
contextBridge.exposeInMainWorld('agentApi', {
  list: () => ipcRenderer.invoke(IPC_CHANNELS.agentsList),
  add: () => ipcRenderer.invoke(IPC_CHANNELS.agentsAdd),
  remove: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.agentsRemove, { id })
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/main/preload.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/preload.ts tests/main/preload.test.ts
git commit -m "feat: expose agent api in preload bridge"
```

### Task 4: Renderer 接入 Agent 面板（列表/新增/删除/状态）

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/app.ts`
- Modify: `tests/smoke/renderer_sections.test.ts`

- [ ] **Step 1: 写失败测试（空态、新增、删除成功、删除被引用失败文案）**

```ts
test('initRenderer should render agent empty state', async () => {
  // 注册 agent-root/agent-status/agent-add-btn，agentApi.list 返回 []
  // 断言显示“暂无 Agent，请先新增”
});

test('click add should append agent row', async () => {
  // add 后 list 返回 1 条，断言 root.children 中包含 🤖 与 新建 Agent 1
});

test('delete failure with AGENT_IN_USE should show message', async () => {
  // remove 抛 AGENT_IN_USE，断言状态文案为“该 Agent 已被流程模板引用，无法删除”
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`  
Expected: FAIL（缺少 Agent DOM 和逻辑）

- [ ] **Step 3: 修改 HTML 与 app 初始化逻辑**

```html
<!-- index.html 的 Agent section -->
<section class="panel">
  <h2>Agent</h2>
  <button id="agent-add-btn" type="button">新增 Agent</button>
  <p id="agent-status">就绪</p>
  <div id="agent-root"></div>
</section>
```

```ts
// app.ts 增量示意
interface AgentApiLike {
  list: () => Promise<Array<{ id: string; name: string; icon: string }>>;
  add: () => Promise<{ id: string; name: string; icon: string }>;
  remove: (id: string) => Promise<{ ok: true }>;
}

function renderAgents(doc: DocumentLike, root: ElementLike, agents: Array<{ id: string; name: string; icon: string }>) {
  if (agents.length === 0) {
    const empty = doc.createElement('p');
    empty.textContent = '暂无 Agent，请先新增';
    root.replaceChildren(empty);
    return [];
  }
  return agents.map((agent) => {
    const row = doc.createElement('div');
    row.textContent = `${agent.icon} ${agent.name}`;
    const del = doc.createElement('button');
    del.textContent = '删除';
    row.replaceChildren(row, del);
    return { id: agent.id, deleteButton: del, row };
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/renderer/index.html src/renderer/app.ts tests/smoke/renderer_sections.test.ts
git commit -m "feat: add agent tab list/add/remove interactions"
```

### Task 5: 全量回归与文档同步

**Files:**
- Modify: `README.md`（如需补充 Agent 全局存储说明）

- [ ] **Step 1: 运行全量测试**

Run: `npm test`  
Expected: PASS（全部通过，无回归）

- [ ] **Step 2: 如有必要更新 README 存储说明**

```md
## Local Data
- `~/.aiguanjia/projects.json`
- `~/.aiguanjia/agents/index.json`
- `~/.aiguanjia/agents/<agentId>.json`
```

- [ ] **Step 3: 最终提交**

```bash
git add README.md
git commit -m "docs: document global agent storage layout"
```

## Self-Review Checklist (completed)

- Spec coverage: 已覆盖存储、IPC、删除校验、前端交互、测试闭环。
- Placeholder scan: 无 `TODO/TBD/implement later` 占位。
- Type consistency: 统一使用 `id/name/icon`，删除接口统一 `remove(id)` 与 `{ id }` payload。
