# Agent 列表展示增强设计（摘要显示 emoji+name，隐藏 id）

## 1. 背景与目标
当前 Agent 列表仅展示 `name (id)`，信息不完整，且 `id` 暴露在界面中。

本次目标：
- 摘要行仅展示 `emoji + name`
- 点击摘要后展开详情
- 详情展示 `name / emoji / command / argsTemplate / env`
- `id` 仅内部使用，不在任何界面文本中展示

## 2. 范围与非目标
范围：
- 仅修改渲染层（`src/renderer/app.ts` 及对应测试）
- 保持现有 `agentApi.list/add/remove` 与主进程存储结构不变

非目标：
- 不改 `AgentEntity` 持久化结构
- 不新增编辑 Agent 功能
- 不改 Agent 删除业务规则

## 3. 现状与问题
现有 `renderAgents` 在摘要中拼接 `name` 与 `id`，并提供删除按钮。
问题：
- 列表信息不足（缺少 command、argsTemplate、env）
- `id` 属于内部标识，不应展示给用户

## 4. 方案选择
采用“仅改前端渲染”的最小改动方案：
- 数据源保持完整实体，渲染时按显示白名单输出
- 摘要：`emoji + name`
- 详情：`name / emoji / command / argsTemplate / env`
- `id` 只用于删除动作参数，不参与界面文案

选择原因：
- 改动面最小
- 风险最低
- 可快速达成需求并保持后续扩展空间

## 5. 交互设计
### 5.1 列表结构
每个 Agent 列表项包含：
- 摘要区：`emoji + name`（可点击）
- 删除按钮：`删除`
- 详情区：默认折叠，点击摘要切换展开/收起

### 5.2 展开规则
- 同一时刻仅展开一个 Agent（推荐）
- 点击已展开项摘要则收起
- 点击删除按钮不触发展开/收起

### 5.3 空值兜底
- `emoji` 缺失：显示 `🙂`
- `argsTemplate` 为空：显示 `[]`
- `env` 缺失或空对象：显示“未设置”

## 6. 数据流与边界
数据流保持：
- `refreshAgents -> agentApi.list() -> renderAgents`

边界：
- `id` 可在内部逻辑使用（删除调用 `agentApi.remove(id)`）
- `id` 不可进入任何用户可见文本

## 7. 错误处理
保持现有状态文案与行为：
- 列表加载失败：`加载 Agent 列表失败`
- 删除失败：`删除 Agent 失败`
- 被流程模板引用：`该 Agent 已被流程模板引用，无法删除`

渲染层新增要求：
- 字段缺失时使用兜底值，避免出现 `undefined` 文案

## 8. 测试设计
新增/调整渲染层测试，覆盖：
- 摘要仅显示 `emoji + name`，不含 `id`
- 点击摘要可展开/收起详情
- 详情显示 `name / emoji / command / argsTemplate / env`
- 空值兜底展示正确
- 删除按钮行为保持正确且不影响展开逻辑

回归验证：
- 新增 Agent 后刷新正常
- 删除 Agent 后刷新正常
- 空列表提示正常

## 9. 验收标准
- 页面任意可见文本中不出现 Agent `id`
- 摘要固定为 `emoji + name`
- 点击可展开详情，详情字段完整且可读
- 删除与加载失败行为不回归

## 10. 实施影响评估
影响文件（预期）：
- `src/renderer/app.ts`
- `tests` 中对应渲染逻辑测试文件

兼容性：
- 与现有存储、IPC 接口兼容
- 对现有数据文件无迁移需求
