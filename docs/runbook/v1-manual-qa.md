# v1 手工验收 Runbook

本文档用于 Task 9 的 v1 手工验收，目标是验证最小端到端流程可运行。

## 1. 前置条件

- 操作系统：macOS / Linux（支持 Bash）
- Node.js 22+
- npm 10+
- 已执行依赖安装：

```bash
npm install
```

## 2. 自动化最小 E2E 校验

在仓库根目录执行：

```bash
./scripts/e2e-demo-flow.sh
```

预期结果：

- `npm test` 全部通过。
- `npm run build` 成功。
- 存在以下产物：
  - `dist/main/main.js`
  - `dist/main/ipc/handlers.js`
  - `dist/renderer/index.html`
  - `dist/renderer/styles.css`
- 控制台出现：`[e2e] PASS`

## 3. 手工 UI 验收

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

4. 预期行为：
- 状态文本更新为“运行成功”。
- 运行列表（`runs-list`）新增一条记录，形如：`run-1 - SUCCEEDED`。

## 4. 失败排查

- `npm test` 失败：先执行 `npm run build`，再重试 `npm test`。
- `npm run build` 失败：检查 TypeScript 编译报错并修复。
- UI 未启动：确认本机有可用 GUI 会话与 Electron 运行依赖。
