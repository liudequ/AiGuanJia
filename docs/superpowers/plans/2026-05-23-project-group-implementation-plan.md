# Project Group Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement project-group directory selection and persistence under `~/.aiguanjia/projects.json`, including empty-state UI, deduped path recording, and current-project switching.

**Architecture:** Add a dedicated `project_store` in main process for all filesystem persistence, expose project IPC channels via preload, and keep renderer focused on state-driven rendering and user interactions. Follow fail-fast validation in main process (absolute path + JSON integrity), and keep UI feedback minimal and deterministic.

**Tech Stack:** Electron 42, TypeScript 5, Node built-ins (`fs/promises`, `path`, `os`), `node:test` + `assert/strict`.

---

## File Structure

- Create: `src/main/storage/project_store.ts` - project state persistence (`~/.aiguanjia/projects.json`), dedupe, timestamp updates, absolute-path validation.
- Modify: `src/main/ipc/handlers.ts` - register project-related IPC channels and dependency injection for tests.
- Modify: `src/main/preload.ts` - expose `projectApi` methods to renderer.
- Modify: `src/renderer/index.html` - add project-group container for empty/selected states.
- Modify: `src/renderer/app.ts` - render project-group states and wire click actions.
- Create: `tests/storage/project_store.test.ts` - persistence and validation tests.
- Modify: `tests/ipc/handlers.test.ts` - project IPC registration and behaviors.
- Modify: `tests/smoke/renderer_sections.test.ts` - assert project-group empty-state UI markers.

### Task 1: Add Storage Contract for Project State

**Files:**
- Create: `src/main/storage/project_store.ts`
- Test: `tests/storage/project_store.test.ts`

- [ ] **Step 1: Write failing test for initialization and first add**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createProjectStore } from '../../src/main/storage/project_store';

test('project store should init empty state and add project path', async () => {
  const homeDir = mkdtempSync(join(tmpdir(), 'aiguanjia-home-'));
  const projectPath = join(homeDir, 'demo-project');
  const store = createProjectStore({ homeDir });

  try {
    const initial = await store.getProjectState();
    assert.equal(initial.currentProjectPath, null);
    assert.equal(initial.projects.length, 0);

    const updated = await store.selectProjectByPath(projectPath);
    assert.equal(updated.currentProjectPath, projectPath);
    assert.equal(updated.projects.length, 1);
    assert.equal(updated.projects[0].name, 'demo-project');
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/storage/project_store.test.ts`  
Expected: FAIL with module/file not found for `project_store.ts`.

- [ ] **Step 3: Implement minimal project store**

```ts
export interface ProjectRecord {
  path: string;
  name: string;
  addedAt: string;
  lastOpenedAt: string;
}

export interface ProjectState {
  currentProjectPath: string | null;
  projects: ProjectRecord[];
}

export function createProjectStore(deps?: { homeDir?: string }) {
  const resolvedHome = deps?.homeDir ?? homedir();
  const baseDir = join(resolvedHome, '.aiguanjia');
  const filePath = join(baseDir, 'projects.json');

  return {
    async getProjectState(): Promise<ProjectState> {
      return readProjectState(filePath);
    },
    async selectProjectByPath(absPath: string): Promise<ProjectState> {
      assertAbsolutePath(absPath);
      const state = await readProjectState(filePath);
      const next = upsertProject(state, absPath);
      await writeProjectState(filePath, next);
      return normalizeState(next);
    }
  };
}
```

Implementation requirements:
- Use `os.homedir()` when `deps.homeDir` absent.
- Persist at `join(homeDir, '.aiguanjia', 'projects.json')`.
- Always create parent dir before write.
- Sort `projects` by `lastOpenedAt` descending before returning.

- [ ] **Step 4: Add failing tests for dedupe, invalid path, and corrupted JSON**

```ts
test('selectProjectByPath should dedupe existing path and only update lastOpenedAt', async () => {
  const first = await store.selectProjectByPath(projectPath);
  const firstOpenedAt = first.projects[0].lastOpenedAt;
  const second = await store.selectProjectByPath(projectPath);
  assert.equal(second.projects.length, 1);
  assert.equal(second.currentProjectPath, projectPath);
  assert.equal(second.projects[0].lastOpenedAt >= firstOpenedAt, true);
});

test('selectProjectByPath should reject non-absolute path', async () => {
  await assert.rejects(() => store.selectProjectByPath('relative/path'), /absolute path/);
});

test('getProjectState should throw on corrupted projects.json', async () => {
  await writeFile(projectFilePath, '{broken-json', 'utf8');
  await assert.rejects(() => store.getProjectState(), /invalid project store json/);
});
```

- [ ] **Step 5: Implement remaining store behaviors**

```ts
function assertAbsolutePath(input: string): void {
  if (!isAbsolute(input)) {
    throw new Error('project path must be an absolute path');
  }
}

function upsertProject(state: ProjectState, absPath: string): ProjectState {
  // find existing by exact path
  // if exists: update lastOpenedAt
  // else: push new record (name=basename(absPath), addedAt/lastOpenedAt=now)
  // set currentProjectPath
}
```

- [ ] **Step 6: Run storage tests**

Run: `npm test -- tests/storage/project_store.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/main/storage/project_store.ts tests/storage/project_store.test.ts
git commit -m "feat: add project store persistence and validation"
```

### Task 2: Extend IPC for Project State and Directory Picking

**Files:**
- Modify: `src/main/ipc/handlers.ts`
- Modify: `tests/ipc/handlers.test.ts`

- [ ] **Step 1: Write failing IPC tests for project channels**

Add tests that assert:
- `IPC_CHANNELS.projectsGetState`, `projectsSelectPath`, `projectsPickDirectory` are registered.
- `projects:selectPath` returns updated state from injected store.
- `projects:pickDirectory` returns `{ canceled: true }` or `{ canceled: false, path }` based on mocked dialog result.

```ts
assert.equal(handlers.has(IPC_CHANNELS.projectsGetState), true);
assert.deepEqual(await getStateHandler({}), { currentProjectPath: null, projects: [] });
```

- [ ] **Step 2: Run IPC tests to verify failures**

Run: `npm test -- tests/ipc/handlers.test.ts`  
Expected: FAIL on missing channels/handler paths.

- [ ] **Step 3: Implement IPC channel extensions with dependency injection**

```ts
export const IPC_CHANNELS = {
  flowRun: 'flow:run',
  runsGet: 'runs:get',
  projectsGetState: 'projects:getState',
  projectsSelectPath: 'projects:selectPath',
  projectsPickDirectory: 'projects:pickDirectory'
} as const;

export interface HandlerDeps {
  executeFlow?: (template: FlowTemplate) => Promise<FlowExecutionResult>;
  projectStore?: {
    getProjectState: () => Promise<ProjectState>;
    selectProjectByPath: (path: string) => Promise<ProjectState>;
  };
  pickDirectory?: () => Promise<{ canceled: boolean; path?: string }>;
}
```

Handler behavior:
- `projects:getState` => `projectStore.getProjectState()`
- `projects:selectPath` => validate payload shape and call `selectProjectByPath`
- `projects:pickDirectory` => call injected/default picker

- [ ] **Step 4: Complete picker default implementation**

Default picker in main handlers should map `dialog.showOpenDialog` result to:

```ts
{ canceled: true }
// or
{ canceled: false, path: selectedPath }
```

- [ ] **Step 5: Re-run IPC tests**

Run: `npm test -- tests/ipc/handlers.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/main/ipc/handlers.ts tests/ipc/handlers.test.ts
git commit -m "feat: add project IPC channels and directory picker"
```

### Task 3: Expose Project API Through Preload

**Files:**
- Modify: `src/main/preload.ts`
- (Optional typing sync) Modify: `src/shared/types.ts`

- [ ] **Step 1: Add failing preload contract test (or extend existing preload-related coverage)**

If current suite has no preload test, add a focused test that stubs `ipcRenderer.invoke` and asserts channel + payload for each method.

```ts
projectApi.getState();
projectApi.pickDirectory();
projectApi.selectPath('/tmp/demo');
```

Expected invocations:
- `projects:getState`
- `projects:pickDirectory`
- `projects:selectPath`, with provided path.

- [ ] **Step 2: Run target tests and verify failure**

Run: `npm test -- tests/main/preload.test.ts`  
Expected: FAIL before API exposure.

- [ ] **Step 3: Implement preload API**

```ts
contextBridge.exposeInMainWorld('projectApi', {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.projectsGetState),
  pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.projectsPickDirectory),
  selectPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.projectsSelectPath, { path })
});
```

- [ ] **Step 4: Re-run preload tests**

Run: `npm test -- tests/main/preload.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/main/preload.ts tests/main/preload.test.ts src/shared/types.ts
git commit -m "feat: expose project API in preload bridge"
```

### Task 4: Render Project Group Empty/Selected States in Renderer

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/app.ts`
- Modify: `tests/smoke/renderer_sections.test.ts`

- [ ] **Step 1: Write failing smoke assertions for project-group empty-state controls**

Add checks for stable DOM ids/text:

```ts
assert.match(html, /id="project-group-root"/);
assert.match(html, /新建项目/);
assert.match(html, /本地已有项目/);
```

- [ ] **Step 2: Run smoke test for renderer sections**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`  
Expected: FAIL on missing selectors/text.

- [ ] **Step 3: Add HTML mount points for project group**

Update `index.html` project section to include:

```html
<section class="panel">
  <h2>项目组</h2>
  <div id="project-group-root"></div>
  <p id="project-group-status"></p>
</section>
```

- [ ] **Step 4: Implement renderer project state flow**

In `app.ts`:
- On init call `projectApi.getState()` and render empty/selected state.
- Wire both buttons to shared handler:
  1. `pickDirectory()`
  2. if not canceled and has path -> `selectPath(path)`
  3. rerender state
- Render selected state with current project name/path and recent list items.
- Show status text for success/dedupe/error branches.

Core function signatures:

```ts
function renderProjectGroup(doc: DocumentLike, state: ProjectState): void;
async function handlePickAndSelect(
  doc: DocumentLike,
  api: ProjectApiLike,
  statusText: ElementLike
): Promise<void>;
```

- [ ] **Step 5: Re-run renderer smoke test**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/renderer/index.html src/renderer/app.ts tests/smoke/renderer_sections.test.ts
git commit -m "feat: implement project-group empty state and selection flow"
```

### Task 5: End-to-End Verification and Documentation Sync

**Files:**
- Modify: `README.md`
- Modify: `docs/runbook/v1-manual-qa.md`

- [ ] **Step 1: Add/adjust manual QA steps for project-group flow**

Update runbook to include:
- first launch shows empty state buttons;
- selecting new directory creates `~/.aiguanjia/projects.json`;
- selecting same directory again does not duplicate record;
- restart app keeps current project.

- [ ] **Step 2: Run full test suite**

Run: `npm test`  
Expected: PASS with all test files green.

- [ ] **Step 3: Run build verification**

Run: `npm run build`  
Expected: PASS and updated `dist/` artifacts generated.

- [ ] **Step 4: Final commit for docs/cleanup**

```bash
git add README.md docs/runbook/v1-manual-qa.md
git commit -m "docs: add project-group QA and usage notes"
```

- [ ] **Step 5: Prepare final check output**

Run:
```bash
git log --oneline -n 5
git status --short
```

Expected:
- task commits visible in order;
- clean working tree.

## Spec Coverage Check

- `~/.aiguanjia/projects.json` single-file persistence: covered by Task 1.
- Empty state with `新建项目/本地已有项目`: covered by Task 4.
- Both entries open directory picker and write path: covered by Tasks 2 + 4.
- Duplicate path should switch only, no new record: covered by Task 1 tests + implementation.
- Error handling branches (cancel/invalid path/write issues): covered by Tasks 1, 2, 4.
- Tests across storage, IPC, renderer: covered by Tasks 1, 2, 4, and Task 5 full run.

## Placeholder and Consistency Check

- No `TODO/TBD` placeholders.
- Channel names consistent across handlers/preload/tests:
  - `projects:getState`
  - `projects:selectPath`
  - `projects:pickDirectory`
- Store API names consistent across tasks:
  - `getProjectState`
  - `selectProjectByPath`
