# Codex Agent Manager V1 设计文档

日期：2026-05-23  
状态：已评审（用户口头确认）

## 1. 目标与范围

本项目目标是构建一个可视化管理器，用于管理多个 Codex Agent 的调用，并在本地项目目录中完成任务执行与结果沉淀。

V1 聚焦子系统：`Agent 执行引擎 / CLI 编排`，并提供可视化窗口进行配置与运行管理。

V1 范围内明确约束：

- 执行模式：同步串行。
- 失败策略：任一步骤失败即中断流程。
- Agent 输入：CLI 参数（支持占位符模板替换）。
- Agent 输出：项目文件变更（以项目目录中的文件作为产出）。
- 流程选择：用户手动选择预定义流程模板。
- 命令定义：`command` 与 `args` 分离存储。
- 工作目录：固定为项目根目录（`cwd = project_path`）。
- 日志策略：按步骤持久化日志文件。
- 超时策略：V1 不设置自动超时，依赖手动中断。
- 终端策略：可配置终端类型，执行时每个步骤新开终端窗口。

## 2. 架构设计

V1 采用“轻量单体执行器（Codex 专用）+ 可视化壳层（Electron）”。

### 2.1 分层结构

1. Core Engine（无界面）
- 负责流程模板解析、参数渲染、进程执行、状态汇总、日志落盘。
- 提供稳定接口给 UI（本地 API 或进程调用）。

2. Desktop UI（Electron）
- 负责项目组管理、Agent 配置、流程发起、状态展示、日志查看。
- 不直接承载业务执行逻辑，仅调用 Core。

### 2.2 关键模块

1. `ProjectGroup`
- 绑定本地项目根目录、默认终端类型、可用流程模板集合。

2. `AgentProfile`
- 表示一种 Codex 调用配置。
- 包含命令入口（允许每个 Agent 不同）与参数模板。

3. `FlowTemplate`
- 预定义串行步骤列表。
- 每个步骤引用一个 Agent，并提供该步任务参数。

4. `ExecutionEngine`
- 按步骤执行：模板解析 -> 参数替换 -> 调起终端执行 -> 采集结果。
- 执行策略固定为串行，失败即中断。

5. `TerminalLauncher`
- 基于终端类型映射到内置启动参数。
- V1 不支持自定义终端命令模板。

6. `LogStore`
- 按运行实例/步骤落盘 stdout、stderr 与元信息，支持审计与复盘。

## 3. 数据模型与配置结构

以下为逻辑模型，文件格式可选择 YAML 或 JSON。

### 3.1 `project_group`

- `id`: string
- `name`: string
- `project_path`: string（绝对路径）
- `terminal_type`: string（如 `wezterm` / `iterm2` / `gnome-terminal`）
- `flow_templates`: string[]（模板 ID 列表）

### 3.2 `agent_profile`

- `id`: string
- `name`: string
- `command`: string（Codex 命令入口）
- `args_template`: string[]（支持多占位符）
- `env`: Record<string, string>（可选）

### 3.3 `flow_template`

- `id`: string
- `name`: string
- `steps`: Step[]

`Step` 字段：
- `id`: string
- `name`: string
- `agent_profile_id`: string
- `task_payload`: Record<string, string>
- `status_file_path`: string（可选，默认 `.aiguanjia/status/{run_id}-{step_id}.json`）

### 3.4 `flow_run`

- `run_id`: string
- `project_group_id`: string
- `flow_template_id`: string
- `started_at`: string（ISO 时间）
- `ended_at`: string（ISO 时间，可空）
- `final_status`: `SUCCEEDED | FAILED | INTERRUPTED`
- `stopped_at_step_id`: string（失败或中断时）

### 3.5 `step_run`

- `run_id`: string
- `step_id`: string
- `resolved_command`: string
- `cwd`: string（固定项目根）
- `log_stdout_path`: string
- `log_stderr_path`: string
- `exit_code`: number | null
- `status`: `PENDING | RUNNING | SUCCEEDED | FAILED | INTERRUPTED`
- `started_at`: string（ISO 时间）
- `ended_at`: string（ISO 时间，可空）

## 4. 状态识别协议

“新终端启动的 codex 是否可回传可识别状态”的答案是可以，V1 采用三层状态机制：

1. 进程级状态（最终裁决）
- `RUNNING`: 子进程已启动
- `SUCCEEDED`: 退出码为 0
- `FAILED`: 退出码非 0
- `INTERRUPTED`: 用户中断（signal）

2. 日志标记状态（可选增强）
- Agent 可输出结构化标记行，例如：
  - `[[AGENT_STATUS:STARTED]]`
  - `[[AGENT_STATUS:WORKING]]`
  - `[[AGENT_STATUS:DONE]]`
  - `[[AGENT_STATUS:ERROR:<reason>]]`
- 管理器解析日志标记生成中间态事件。

3. 文件状态（推荐中间态主渠道）
- 每步可写 `step-status.json`，建议字段：
  - `state`: `RUNNING | DONE | ERROR`
  - `message`: string
  - `updated_at`: string（ISO 时间）
  - `artifacts`: string[]
- 即使终端关闭，状态仍可恢复。

规则：`退出码`用于最终成功/失败判定，`step-status.json`和日志标记用于过程可观测。

## 5. 可视化窗口（Electron）设计

### 5.1 页面结构

1. 项目组页
- 配置 `project_path`、默认终端类型、可用流程模板。

2. Agent 页
- 管理 `command`、`args_template`、环境变量。

3. 流程模板页
- 配置串行步骤（步骤绑定 Agent + `task_payload`）。

4. 运行中心页
- 选择项目组与流程模板后执行。
- 展示当前步骤、历史步骤、状态流转、失败位置。

5. 日志详情页（或抽屉）
- 按步骤查看 stdout/stderr、退出码、状态文件快照。

### 5.2 交互流程

1. 用户选择项目组与流程模板，点击运行。
2. UI 调用 Core 创建 `flow_run`（状态置 `RUNNING`）。
3. Engine 串行执行每个步骤，逐步更新 `step_run`。
4. 任一步失败即停止后续步骤，回写 `flow_run.final_status`。
5. UI 自动刷新并高亮停止步骤，支持一键打开对应日志。

## 6. 执行与错误处理

### 6.1 执行主流程

1. 运行前校验（项目路径、模板、Agent、命令可用性）。
2. 参数渲染（多占位符替换，如 `{task}` `{project_path}` `{step_name}`）。
3. 在项目根目录按终端类型启动该步 Agent（每步新窗口）。
4. 采集退出码并更新状态。
5. 若失败/中断则立即终止流程。

### 6.2 错误分类

1. 配置错误
- 例如：项目路径不存在、模板引用不存在 Agent。
- 处理：启动前阻断，给出明确错误信息。

2. 启动错误
- 例如：终端不可用、命令不存在。
- 处理：当前步骤 `FAILED`，流程中断。

3. 执行错误
- Codex 返回非 0。
- 处理：当前步骤 `FAILED`，流程中断。

4. 用户中断
- 手动停止流程或关闭相关执行。
- 处理：当前步骤 `INTERRUPTED`，流程终止并落盘。

## 7. 日志与落盘规范

建议路径：`<project_path>/.aiguanjia/runs/<run_id>/`

文件结构：

- `flow-run.json`
- `steps/<index>-<step_id>/stdout.log`
- `steps/<index>-<step_id>/stderr.log`
- `steps/<index>-<step_id>/step-run.json`
- `steps/<index>-<step_id>/step-status.json`（可选）

说明：UI 以这些文件为事实来源，支持运行历史恢复与审计追踪。

## 8. 最小测试策略（V1）

1. 单元测试
- 占位符替换正确性。
- 串行执行与失败中断逻辑。
- 退出码/信号到状态枚举的映射。

2. 集成测试（使用假命令）
- 全成功流程。
- 中间步骤失败中断流程。
- 日志与元数据落盘完整性。

3. 手工验收（UI）
- 可创建项目组 / Agent / 模板。
- 可启动流程并实时查看步骤推进。
- 失败后可快速定位失败步骤与日志文件。

## 9. 非目标（V1 不做）

- 并行调度与依赖图执行。
- 自动超时与超时重试。
- 自定义终端启动命令模板。
- 远程执行与分布式 Agent。
- 产出语义评估（只记录执行与文件结果，不判断内容质量）。

## 10. 里程碑建议

1. M1：Core 执行引擎（CLI 可跑通）
2. M2：Electron 基础 UI（配置与运行中心）
3. M3：日志可观测与状态恢复
4. M4：测试补齐与发布准备
