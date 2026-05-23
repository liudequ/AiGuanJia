# 项目组（Project Group）路径记录与选择流程设计

日期：2026-05-23  
状态：已评审（待实现）

## 1. 背景与目标

本次设计细化 AiGuanJia 界面中“项目组”模块，聚焦以下目标：

1. 软件在用户 `~/` 下创建 `.aiguanjia` 目录用于存储项目组信息。
2. 在“项目组”模块无任何已记录项目时，显示两个入口：`新建项目`、`本地已有项目`。
3. 点击 `新建项目` 打开目录选择界面。
4. 无论选择 `新建项目` 还是 `本地已有项目`，最终都将所选目录路径写入 `~/.aiguanjia` 下的记录文件。

## 2. 范围与非目标

### 2.1 范围

1. 项目路径记录与当前项目切换。
2. 空状态与已选择状态的 UI 交互。
3. 主进程 IPC、preload API、渲染层联动。
4. 基础错误处理与测试验收标准。

### 2.2 非目标

1. 自动扫描本地项目目录（如 `~/projects`）。
2. 多窗口并发写入一致性方案。
3. 远程项目源、网络同步、权限体系。
4. 超出“项目组”模块的业务功能改造。

## 3. 数据落盘设计

### 3.1 存储位置

- 目录：`~/.aiguanjia/`
- 文件：`~/.aiguanjia/projects.json`

### 3.2 数据结构

```json
{
  "currentProjectPath": "/abs/path/to/project",
  "projects": [
    {
      "path": "/abs/path/to/project",
      "name": "project",
      "addedAt": "2026-05-23T05:00:00.000Z",
      "lastOpenedAt": "2026-05-23T05:00:00.000Z"
    }
  ]
}
```

字段约束：

1. `path`：绝对路径，作为唯一键去重。
2. `name`：自动取目录名（basename）。
3. `addedAt`：首次加入时间（ISO 8601）。
4. `lastOpenedAt`：最近被选中时间（ISO 8601）。
5. `currentProjectPath`：当前选中项目路径，可为空字符串或 `null`（实现时二选一并保持一致）。

### 3.3 写入规则

1. 首次写入时自动创建 `~/.aiguanjia/` 与 `projects.json`。
2. 选择新路径：新增记录并设置 `currentProjectPath`。
3. 选择已存在路径：不新增，仅更新该记录 `lastOpenedAt` 并切换 `currentProjectPath`。

## 4. UI 状态与交互设计

### 4.1 空状态（`projects` 为空）

显示两个按钮：

1. `新建项目`
2. `本地已有项目`

两个按钮当前阶段行为一致：打开目录选择器。

### 4.2 已选择状态（存在 `currentProjectPath`）

展示内容：

1. 当前项目名称（目录名）
2. 当前项目完整路径
3. 最近项目列表（按 `lastOpenedAt` 倒序，可点击切换）

### 4.3 关键交互分支

1. 用户取消目录选择：不改数据，不报错。
2. 目录不可用（不存在/无权限）：提示失败，不改数据。
3. 目录已存在：提示“项目已存在，已切换到该项目”。
4. 新目录写入成功：提示“项目已添加并设为当前项目”。

## 5. 架构与模块拆分

## 5.1 主进程存储模块

新增文件：`src/main/storage/project_store.ts`

职责：

1. 读取并解析 `projects.json`。
2. 提供状态读取、按路径选择项目、项目列表查询。
3. 处理目录创建、文件初始化、去重、时间戳更新。

建议 API：

1. `getProjectState(): Promise<ProjectState>`
2. `selectProjectByPath(absPath: string): Promise<ProjectState>`
3. `listProjects(): Promise<ProjectRecord[]>`

### 5.2 IPC 通道

在 `src/main/ipc/handlers.ts` 增加：

1. `projects:getState`
2. `projects:selectPath`
3. `projects:pickDirectory`

职责边界：

1. 目录选择器由主进程调用 `dialog.showOpenDialog({ properties: ['openDirectory'] })`。
2. 参数校验（如绝对路径）在主进程执行，渲染层不信任输入。

### 5.3 preload 暴露接口

在 `src/main/preload.ts` 扩展前端可调用 API（新增 `projectApi` 或在现有命名空间内扩展）：

1. `getState()`
2. `pickDirectory()`
3. `selectPath(path)`

### 5.4 渲染层

在 `src/renderer/app.ts` 增加“项目组”初始化与交互逻辑：

1. 首屏加载状态：`getState()`
2. 空状态渲染按钮
3. 点击按钮触发目录选择并提交路径
4. 根据返回 state 重绘为已选择状态

## 6. 端到端数据流

一次“选择项目目录”流程：

1. Renderer 点击按钮。
2. 调用 `projects:pickDirectory` 打开目录选择。
3. 选择成功后调用 `projects:selectPath`。
4. Main 调用 `project_store` 更新 `~/.aiguanjia/projects.json`。
5. 返回最新状态给 Renderer。
6. Renderer 刷新 UI（当前项目 + 最近项目）。

## 7. 错误处理策略

### 7.1 可恢复错误

1. 用户取消选择：静默返回。
2. 路径不可用：提示“目录不可用，请重新选择”。
3. `projects.json` 损坏（JSON 解析失败）：提示“配置文件损坏，已拒绝写入”，并记录日志。

### 7.2 不可恢复错误

1. 无法创建 `~/.aiguanjia` 或写文件失败：提示“无法写入项目配置，请检查权限/磁盘状态”。
2. IPC 参数非法（非绝对路径）：主进程拒绝请求并返回错误。

### 7.3 提示文案最小集合

1. `项目已添加并设为当前项目`
2. `项目已存在，已切换到该项目`
3. `目录不可用，请重新选择`
4. `无法写入项目配置，请检查权限`

## 8. 测试与验收标准

### 8.1 单元测试（存储层）

文件建议：`tests/storage/project_store.test.ts`

覆盖点：

1. 首次读取自动初始化空结构。
2. 新路径添加成功并设为当前项目。
3. 重复路径不新增，仅更新时间与当前项目。
4. 非绝对路径被拒绝。
5. 损坏 JSON 抛出明确错误。

### 8.2 IPC 测试

在 `tests/ipc/handlers.test.ts` 增补：

1. `projects:getState` 返回结构正确。
2. `projects:selectPath` 参数校验与成功路径。
3. `projects:pickDirectory` 在 `canceled/selected` 分支下返回正确。

### 8.3 渲染层测试

沿用当前 smoke 风格，覆盖：

1. 空状态显示“新建项目/本地已有项目”。
2. 选择成功后渲染当前项目信息。
3. 错误提示分支可见。

## 9. 方案决策记录

已确认决策：

1. 存储结构采用单文件 `projects.json`（而非 `current_project.txt` 分离）。
2. 项目名称自动取目录名（basename）。
3. 路径重复时不新增，仅切换为当前并更新时间。
4. “本地已有项目”采用手动目录选择，不做自动扫描。

