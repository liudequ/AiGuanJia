# AiGuanJia

最小 Electron + TypeScript 工程骨架。

## 环境要求

- Node.js 22+
- npm 10+
- 图形桌面环境（`npm start` 需要可用的 GUI 会话；无头服务器通常无法直接启动 Electron 窗口）

## 快速开始

```bash
npm install
npm test
npm run build
npm start
```

## 脚本说明

- `npm test`: 运行 smoke tests，覆盖基础配置检查与主进程启动流程（基于 mock electron 的生命周期调用验证）。
- `npm run build`: 编译 TypeScript 到 `dist/`，并复制渲染进程页面与样式资源（`index.html`、`styles.css`）。
- `npm start`: 先构建再启动 Electron 应用。
- `npm run test:e2e`: 当前桌面模式下无浏览器预览 E2E（占位命令）。
- `./scripts/e2e-demo-flow.sh`: 快速验证脚本（非端到端），覆盖构建、关键产物存在性、以及构建后 `runFlow` 成功路径校验。

## v1 验收

```bash
./scripts/e2e-demo-flow.sh
```

- 自动脚本不覆盖 UI→IPC 全链路；该链路请按手工步骤验收。
- 手工验收步骤见：[docs/runbook/v1-manual-qa.md](docs/runbook/v1-manual-qa.md)

## 项目组流程（手工验收要点）

项目组状态持久化文件：`~/.aiguanjia/projects.json`

- 首次启动空状态：项目组列表为空，显示可选择目录的入口。
- 首次选择目录：选择任意本地目录后，`~/.aiguanjia/projects.json` 被创建并写入该目录记录。
- 重复选择同目录：不会产生重复记录（去重）。
- 重启恢复：关闭并重新启动应用后，当前项目保持为上次所选项目。

## V1 范围

已支持：
- 串行流程执行与失败即中断（fail-fast）
- 参数模板渲染（多占位符）
- 终端类型命令映射（wezterm/iterm2/gnome-terminal）
- 运行元数据与日志目录落盘
- Electron 最小 UI（项目组/Agent/流程模板/运行中心）

未支持：
- 并行调度
- 自动超时与重试
- 自定义终端命令模板
- 远程执行

## 目录结构

- `src/main`: Electron 主进程与 preload。
- `src/renderer`: 渲染进程页面与脚本。
- `src/shared`: 主/渲染共享类型。
- `tests/smoke`: 基础冒烟测试。
