# Agent 标签全局管理设计（V1）

日期：2026-05-23  
状态：已评审（用户逐节确认）

## 1. 背景与目标

本设计用于扩展 Electron UI 中的 `Agent` 标签页，实现最小可用的 Agent 管理能力。

V1 目标：
- 列出所有 Agent。
- 支持新增 Agent。
- 支持删除 Agent。
- 数据持久化到本地存储。

关键约束（已确认）：
- Agent 为应用级全局数据，不跟随项目变化。
- 当前 Agent 字段仅包含 `name` 与 `icon`（可扩展）。
- 删除时若被流程模板引用，禁止删除。
- 新增采用“直接创建占位 Agent”模式。
- 名称全局唯一，不允许重复。
- 图标采用 emoji 字符存储与展示。

## 2. 范围与非目标

### 2.1 V1 范围

- 全局 Agent 存储与读写。
- Agent 列表渲染（图标、名称、删除按钮）。
- 新增/删除交互与状态提示。
- 删除前引用校验（流程模板中的 `agentProfileId`）。

### 2.2 非目标

- Agent 编辑（改名、改图标）。
- 批量操作、拖拽排序。
- 图标上传、URL 图标、图标库系统。
- 自动修复损坏数据（V1 仅显式报错）。

## 3. 存储设计（方案 A：独立 Store + 单 Agent 文件）

### 3.1 存储路径

- 目录：`~/.aiguanjia/agents/`
- 索引文件：`~/.aiguanjia/agents/index.json`
- 实体文件：`~/.aiguanjia/agents/<agentId>.json`

### 3.2 数据结构

`index.json`：
- `version: number`
- `agentIds: string[]`（定义列表顺序）

`<agentId>.json`：
- `id: string`
- `name: string`（全局唯一）
- `icon: string`（emoji）
- `createdAt: string`（ISO）
- `updatedAt: string`（ISO）

### 3.3 读写规则

- `list`：按 `index.json` 顺序读取对应文件并返回。
- `add`：创建新 `<agentId>.json`，并将 `id` 追加到 `index.json`。
- `remove`：删除前先校验引用；通过后删除实体文件并同步更新索引。

### 3.4 一致性与损坏策略

- 若 `index.json` 中存在 `id` 但实体文件缺失，判定 `AGENT_STORE_CORRUPTED`。
- 不静默忽略损坏数据，直接返回可诊断错误，便于人工修复。

## 4. 领域模型与默认策略

### 4.1 领域模型（V1）

```ts
interface Agent {
  id: string;
  name: string;
  icon: string; // emoji
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 默认创建策略

- 默认图标：`🤖`
- 默认名称：`新建 Agent N`
- `N` 计算规则：扫描当前名称集合，选取最小未占用正整数。
- 名称唯一约束由主进程存储层统一保证。

## 5. IPC 设计

新增通道：
- `agents:list`
- `agents:add`
- `agents:remove`

请求与响应：
- `agents:list`：无入参，返回 `Agent[]`
- `agents:add`：空入参或 `{}`，返回新建 `Agent`
- `agents:remove`：`{ id: string }`，成功返回 `{ ok: true }`

参数校验：
- `agents:remove` 要求 `id` 为非空字符串。
- 非法 payload 返回参数错误（沿用现有 handler 风格）。

## 6. 删除引用校验规则

删除前扫描应用配置中的流程模板：
- 来源：`flowTemplates[].steps[].agentProfileId`
- 条件：存在任意步骤引用目标 `agentId`
- 结果：拒绝删除并返回 `AGENT_IN_USE`

该规则确保流程模板引用完整性，不产生悬挂引用。

## 7. 错误模型与前端提示

错误码约定：
- `AGENT_NOT_FOUND`
- `AGENT_IN_USE`
- `AGENT_NAME_CONFLICT`
- `AGENT_STORE_CORRUPTED`
- `AGENT_STORE_IO_ERROR`

前端提示规则：
- `AGENT_IN_USE`：提示“该 Agent 已被流程模板引用，无法删除”
- 其他错误：提示“操作失败：<简短原因>”
- 列表加载失败：保留空态与错误文案，不导致页面崩溃

## 8. Agent 标签页交互设计（V1）

页面结构：
- 操作区：`新增 Agent` 按钮
- 列表区：`icon + name + 删除按钮`
- 状态区：最近一次操作结果

交互流程：
1. 初始化调用 `agents:list`，渲染列表。
2. 点击新增，调用 `agents:add`，成功后刷新列表并提示成功。
3. 点击删除，调用 `agents:remove`：
   - 成功：刷新列表并提示成功。
   - 失败且 `AGENT_IN_USE`：提示被引用不可删除。

空态：
- 列表为空时显示“暂无 Agent，请先新增”。

## 9. 测试策略（最小闭环）

### 9.1 存储层单测

- 首次加载（无目录/无索引）返回空列表。
- 新增会创建单文件并更新索引。
- 删除会删除实体并更新索引。
- 名称唯一校验触发冲突错误。
- 索引指向缺失文件时返回 `AGENT_STORE_CORRUPTED`。

### 9.2 IPC 层单测

- `agents:list` 正常返回。
- `agents:add` 默认名称递增与默认 emoji 正确。
- `agents:remove` 被引用时返回 `AGENT_IN_USE`。
- 非法 payload 返回参数错误。

### 9.3 Renderer 单测

- 空态渲染正确。
- 新增后列表刷新并出现新条目。
- 删除成功后列表减少。
- 删除失败时状态提示正确。

## 10. 实施拆分建议

1. 新增 `agent_store`（主进程存储层）与单测。
2. 扩展 IPC handlers/preload，暴露 Agent API。
3. 在 renderer 的 Agent 面板接入列表、新增、删除与状态提示。
4. 补齐 renderer/ipc 回归测试并通过现有测试集。

