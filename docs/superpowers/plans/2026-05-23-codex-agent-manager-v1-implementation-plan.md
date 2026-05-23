# Codex Agent Manager V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Electron 的可视化管理器，支持按预定义模板串行调用多个 Codex Agent，失败即中断，并将运行状态与日志持久化到项目目录。  
**Architecture:** 采用 `Electron UI + Node Core Engine` 的双层结构。UI 仅负责配置与运行可视化，执行逻辑集中在 Core（模板解析、占位符渲染、终端拉起、状态落盘、日志归档）。运行数据以本地 JSON/YAML 配置与 `.aiguanjia/runs` 目录文件为事实来源。  
**Tech Stack:** Electron, Node.js (TypeScript), Vitest, electron-builder（可选打包）

---

### Task 1: 初始化工程骨架与基础脚本

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/main/main.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/app.ts`
- Create: `src/shared/types.ts`
- Create: `tests/smoke/app_boot.test.ts`
- Modify: `README.md`

- [ ] **Step 1: 写失败测试（基础启动检查）**

```ts
// tests/smoke/app_boot.test.ts
import { describe, it, expect } from "vitest";

describe("app bootstrap", () => {
  it("has basic runtime constants", () => {
    expect(process.platform.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认可执行**

Run: `npm test`  
Expected: PASS（至少 1 个用例通过）

- [ ] **Step 3: 实现最小 Electron 骨架与脚本**

```json
{
  "name": "aiguanjia",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main/main.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "npm run build && electron .",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "electron": "^33.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: 运行测试与构建**

Run: `npm test && npm run build`  
Expected: 测试通过，TypeScript 编译成功

- [ ] **Step 5: 提交**

```bash
git add package.json tsconfig.json src tests README.md
git commit -m "chore: bootstrap electron typescript project"
```

### Task 2: 定义领域模型与配置存储

**Files:**
- Create: `src/main/domain/models.ts`
- Create: `src/main/storage/config_store.ts`
- Create: `tests/domain/models.test.ts`
- Create: `tests/storage/config_store.test.ts`

- [ ] **Step 1: 写失败测试（模型约束）**

```ts
import { describe, it, expect } from "vitest";
import { parseFlowTemplate } from "../../src/main/domain/models";

describe("flow template validation", () => {
  it("rejects empty steps", () => {
    expect(() => parseFlowTemplate({ id: "f1", name: "x", steps: [] })).toThrow();
  });
});
```

- [ ] **Step 2: 运行单测确认失败**

Run: `npm test -- tests/domain/models.test.ts`  
Expected: FAIL（`parseFlowTemplate` 未实现）

- [ ] **Step 3: 实现模型与配置持久化**

```ts
export type StepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "INTERRUPTED";

export interface AgentProfile {
  id: string;
  name: string;
  command: string;
  argsTemplate: string[];
  env?: Record<string, string>;
}
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/domain/models.test.ts tests/storage/config_store.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/domain/models.ts src/main/storage/config_store.ts tests/domain tests/storage
git commit -m "feat: add domain models and config store"
```

### Task 3: 实现参数渲染与命令解析

**Files:**
- Create: `src/main/engine/template_renderer.ts`
- Create: `tests/engine/template_renderer.test.ts`

- [ ] **Step 1: 写失败测试（多占位符替换）**

```ts
import { describe, it, expect } from "vitest";
import { renderArgs } from "../../src/main/engine/template_renderer";

describe("renderArgs", () => {
  it("replaces task/project_path/step_name placeholders", () => {
    const args = renderArgs(["--task", "{task}", "--cwd", "{project_path}", "--step", "{step_name}"], {
      task: "fix lint",
      project_path: "/tmp/p",
      step_name: "s1"
    });
    expect(args).toEqual(["--task", "fix lint", "--cwd", "/tmp/p", "--step", "s1"]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/engine/template_renderer.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现渲染器**

```ts
export function renderArgs(argsTemplate: string[], payload: Record<string, string>): string[] {
  return argsTemplate.map((token) =>
    token.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => payload[key] ?? `{${key}}`)
  );
}
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/engine/template_renderer.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/engine/template_renderer.ts tests/engine/template_renderer.test.ts
git commit -m "feat: add args template renderer"
```

### Task 4: 实现终端启动器（按终端类型映射）

**Files:**
- Create: `src/main/engine/terminal_launcher.ts`
- Create: `tests/engine/terminal_launcher.test.ts`

- [ ] **Step 1: 写失败测试（终端命令映射）**

```ts
import { describe, it, expect } from "vitest";
import { buildTerminalCommand } from "../../src/main/engine/terminal_launcher";

describe("buildTerminalCommand", () => {
  it("builds wezterm launch args", () => {
    const cmd = buildTerminalCommand("wezterm", "/repo", "codex", ["--task", "x"]);
    expect(cmd.program.length).toBeGreaterThan(0);
    expect(cmd.args.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/engine/terminal_launcher.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现终端映射**

```ts
export interface LaunchCommand {
  program: string;
  args: string[];
}
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/engine/terminal_launcher.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/engine/terminal_launcher.ts tests/engine/terminal_launcher.test.ts
git commit -m "feat: add terminal launcher mapping"
```

### Task 5: 实现串行执行引擎与失败即中断

**Files:**
- Create: `src/main/engine/execution_engine.ts`
- Create: `tests/engine/execution_engine.test.ts`

- [ ] **Step 1: 写失败测试（第二步失败后中断第三步）**

```ts
import { describe, it, expect } from "vitest";
import { runFlow } from "../../src/main/engine/execution_engine";

describe("runFlow", () => {
  it("stops at first failed step", async () => {
    const result = await runFlow(/* fake launcher with step2 fail */);
    expect(result.finalStatus).toBe("FAILED");
    expect(result.executedSteps).toBe(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/engine/execution_engine.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现最小执行器**

```ts
for (const step of template.steps) {
  // mark running -> launch -> collect exitCode
  // if exitCode !== 0 => mark failed and break
}
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/engine/execution_engine.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/engine/execution_engine.ts tests/engine/execution_engine.test.ts
git commit -m "feat: add sequential execution engine with fail-fast"
```

### Task 6: 实现运行日志与状态文件落盘

**Files:**
- Create: `src/main/storage/run_store.ts`
- Create: `tests/storage/run_store.test.ts`

- [ ] **Step 1: 写失败测试（run 目录结构）**

```ts
import { describe, it, expect } from "vitest";
import { createRunLayout } from "../../src/main/storage/run_store";

describe("run store", () => {
  it("creates expected run directory layout", async () => {
    const layout = await createRunLayout("/tmp/project", "run-1", "step-a", 1);
    expect(layout.stdoutPath.includes(".aiguanjia/runs/run-1")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/storage/run_store.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现落盘结构**

```txt
<project_path>/.aiguanjia/runs/<run_id>/
  flow-run.json
  steps/<index>-<step_id>/stdout.log
  steps/<index>-<step_id>/stderr.log
  steps/<index>-<step_id>/step-run.json
  steps/<index>-<step_id>/step-status.json
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/storage/run_store.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/storage/run_store.ts tests/storage/run_store.test.ts
git commit -m "feat: add run metadata and log persistence"
```

### Task 7: 暴露 IPC 接口给 Electron Renderer

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Create: `src/main/ipc/handlers.ts`
- Create: `tests/ipc/handlers.test.ts`

- [ ] **Step 1: 写失败测试（创建并运行 flow）**

```ts
import { describe, it, expect } from "vitest";
import { listHandlers } from "../../src/main/ipc/handlers";

describe("ipc handlers", () => {
  it("exposes runFlow handler", () => {
    expect(listHandlers()).toContain("flow:run");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/ipc/handlers.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现 IPC 边界**

```ts
contextBridge.exposeInMainWorld("api", {
  runFlow: (payload) => ipcRenderer.invoke("flow:run", payload),
  getRuns: () => ipcRenderer.invoke("runs:list")
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/ipc/handlers.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/main.ts src/main/preload.ts src/main/ipc/handlers.ts tests/ipc/handlers.test.ts
git commit -m "feat: add ipc handlers for flow execution and run history"
```

### Task 8: 构建 V1 可视化页面（项目组/Agent/模板/运行中心）

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/app.ts`
- Create: `src/renderer/styles.css`
- Create: `tests/smoke/renderer_sections.test.ts`

- [ ] **Step 1: 写失败测试（页面区块存在）**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";

describe("renderer sections", () => {
  it("contains required sections", () => {
    const html = fs.readFileSync("src/renderer/index.html", "utf8");
    expect(html.includes("项目组")).toBe(true);
    expect(html.includes("Agent")).toBe(true);
    expect(html.includes("流程模板")).toBe(true);
    expect(html.includes("运行中心")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现页面与交互**

```ts
// app.ts
// load configs -> render list -> bind run button -> call window.api.runFlow
```

- [ ] **Step 4: 运行测试**

Run: `npm test -- tests/smoke/renderer_sections.test.ts`  
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/renderer tests/smoke/renderer_sections.test.ts
git commit -m "feat: add v1 renderer for config and run center"
```

### Task 9: 打通端到端流程与手工验收脚本

**Files:**
- Create: `scripts/e2e-demo-flow.sh`
- Create: `docs/runbook/v1-manual-qa.md`
- Modify: `README.md`

- [ ] **Step 1: 写失败测试（最小 e2e 命令存在）**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";

describe("e2e script", () => {
  it("has executable demo flow script", () => {
    expect(fs.existsSync("scripts/e2e-demo-flow.sh")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`  
Expected: FAIL（脚本未创建）

- [ ] **Step 3: 增加验收脚本与文档**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "Prepare sample project and run a 2-step template"
```

- [ ] **Step 4: 运行全量验证**

Run: `npm test && npm run build`  
Expected: 全通过

- [ ] **Step 5: 提交**

```bash
git add scripts/e2e-demo-flow.sh docs/runbook/v1-manual-qa.md README.md
git commit -m "docs: add v1 runbook and e2e verification script"
```

### Task 10: 发布前收口（质量闸门）

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-23-codex-agent-manager-design.md`（如实现偏差需回写）

- [ ] **Step 1: 运行最终质量检查**

Run: `npm test && npm run build`  
Expected: 全部通过

- [ ] **Step 2: 执行手工 QA 清单**

Run: `bash scripts/e2e-demo-flow.sh`  
Expected: 生成 run 目录，失败场景可中断并定位日志

- [ ] **Step 3: 完成发布说明**

```md
V1 supports: sequential flow, fail-fast, per-step logs, status persistence, Electron UI.
Not included: parallel scheduling, timeout, custom terminal template.
```

- [ ] **Step 4: 最终提交**

```bash
git add README.md docs/superpowers/specs/2026-05-23-codex-agent-manager-design.md
git commit -m "chore: finalize v1 readiness and docs"
```

## Spec Coverage Check

- 已覆盖：Electron 可视化窗口、项目组/Agent/模板管理、串行执行、失败即中断、固定项目根 cwd、日志落盘、状态协议（退出码/日志标记/状态文件）。
- 非目标保持一致：并行调度、自动超时、自定义终端命令模板、远程执行均未纳入任务。

