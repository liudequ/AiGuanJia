# v1 手工验收 Runbook

本文档用于 Task 9 的 v1 验收，分为“自动快速验证（非 UI→IPC 全链路）”和“手工 UI 链路验收”。

## 1. 前置条件

- 操作系统：macOS / Linux（支持 Bash）
- Node.js 22+
- npm 10+
- 已执行依赖安装：

```bash
npm install
```

## 2. 自动快速验证（非端到端）

在仓库根目录执行：

```bash
./scripts/e2e-demo-flow.sh
```

覆盖范围（自动脚本）：

- TypeScript 构建可通过（`npm run build`）。
- 构建产物完整性校验（`dist/main` 与 `dist/renderer` 关键文件存在）。
- 基于构建产物的 `runFlow` 运行结果校验（Node 进程内验证引擎成功路径）。

不覆盖范围（自动脚本）：

- 不覆盖 Electron UI 交互。
- 不覆盖 Renderer → Preload → IPC Main 的真实链路调用。

预期结果：

- 控制台出现：`[quick-verify] PASS (non end-to-end)`。

## 3. 手工 UI 验收（覆盖 UI→IPC 链路）

说明：该步骤需要图形桌面环境，远程无头环境可跳过。

1. 启动应用：

```bash
npm start
```

2. 打开主窗口后，确认页面可见以下模块标题：
- 项目组
- Agent
- 流程模板
- 运行中心

3. 在运行中心点击“运行流程”（按钮 id: `run-flow-btn`）。

4. 预期行为（该步骤覆盖 UI→IPC 主链路）：
- 状态文本更新为“运行成功”。
- 运行列表（`runs-list`）新增一条记录，形如：`run-1 - SUCCEEDED`。

## 4. 失败排查

- 快速验证脚本失败：先单独执行 `npm run build`，再重跑脚本。
- `npm run build` 失败：检查 TypeScript 编译报错并修复。
- UI 未启动：确认本机有可用 GUI 会话与 Electron 运行依赖。
