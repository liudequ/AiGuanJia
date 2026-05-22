# AiGuanJia

最小 Electron + TypeScript 工程骨架。

## 环境要求

- Node.js 22+
- npm 10+

## 快速开始

```bash
npm install
npm test
npm run build
```

## 脚本说明

- `npm test`: 运行 smoke test，验证主进程启动配置。
- `npm run build`: 编译 TypeScript 到 `dist/`，并复制渲染进程 `index.html`。
- `npm start`: 先构建再启动 Electron 应用。

## 目录结构

- `src/main`: Electron 主进程与 preload。
- `src/renderer`: 渲染进程页面与脚本。
- `src/shared`: 主/渲染共享类型。
- `tests/smoke`: 基础冒烟测试。
