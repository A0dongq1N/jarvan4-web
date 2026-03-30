# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 文档同步规则（必须遵守）

**任何功能新增、修改或 Bug 修复完成后，必须同步更新以下所有相关设计文档，不得遗漏任何一份：**

| 文档 | 内容 |
|------|------|
| `docs/01-功能设计.md` | 平台 10 大功能模块清单，是所有实现的需求基线 |
| `docs/02-概要设计.md` | 整体架构图、Master-Worker 分布式方案、MySQL/Redis 数据存储设计、部署结构 |
| `docs/03-详细设计.md` | 工程目录结构、数据库表 DDL、核心流程时序、发压引擎三种模式实现 |
| `docs/04-脚本体系设计.md` | 脚本规范（ScriptEntry/RunContext）、SDK 设计、**Git 工作流 + CI 编译 + 对象存储产物管理**、完整脚本示例 |
| `docs/05-接口设计.md` | 全量 REST API（前端 ↔ Master）+ Master ↔ Worker 内部接口 |

**检查清单**：每次完成功能后，逐一确认：
- [ ] `01-功能设计.md` — 功能列表是否需要新增/修改条目？
- [ ] `02-概要设计.md` — 架构图、模块职责、数据表、Redis Key、技术方案表是否需要更新？
- [ ] `03-详细设计.md` — DDL、流程图、错误码表是否需要更新？
- [ ] `05-接口设计.md` — 接口定义、Request/Response 示例、附录汇总表是否需要更新？

未经用户明确豁免，不允许只更新部分文档。

### 新功能审计日志检查清单

**每次新增功能模块时，必须额外确认：**

- [ ] 该功能是否包含写操作（创建/修改/删除/执行）？
  - 若是：后端实现时必须调用审计日志写入，**不写入等于该操作在审计中不存在**
- [ ] `src/types/index.ts` 中的 `AuditAction` 枚举是否需要新增值？
- [ ] `src/views/audit/AuditLogView.vue` 中的 `ACTION_LABELS` 映射是否同步更新？

> 漏加枚举顶多让过滤下拉少一个选项（前端兜底显示原始 key，不崩溃）；
> 但漏写日志会让该操作在审计中永久缺失，且无法补录。

---

## 核心设计原则（禁止违背）

### 脚本体系：脚本优先，非配置驱动

压测脚本是**独立可执行的 Go 程序**，参考 k6 设计，不是数据库配置数据。

```
✅ 正确：脚本实现 ScriptEntry 接口，包含 Setup/Default/Teardown 三个生命周期方法
         脚本在独立 Git 仓库开发，CI 编译为 .so，Worker 通过 plugin.Open 动态加载
❌ 错误：将压测逻辑存为数据库记录（URL、Method、断言等纯配置字段）
```

脚本实现 `ScriptEntry` 接口，三个生命周期方法：
- `Setup(ctx)` — 压测前执行一次，返回所有 VU 共享的 `setupData`
- `Default(ctx *RunContext)` — 每次迭代调用，**这是压测的核心主体**
- `Teardown(ctx, data)` — 压测结束后执行一次

`RunContext` 提供：`VUId`、`Iteration`、`SetupData`，以及 `ctx.HTTP`、`ctx.Check`、`ctx.Vars`、`ctx.Log`、`ctx.Sleep`。

脚本用 Go Plugin 机制执行：**脚本在独立 Git 仓库（scripts-repo）中用本地 IDE 开发** → push 触发 CI（go vet + 单测 + `go build -buildmode=plugin`）→ 编译产物 `.so` 上传对象存储（MinIO/OSS，路径 `scripts/{name}/{commit_hash}.so`）→ CI 通知 Master 新版本可用 → Master 下发任务时携带 `artifact_url` → Worker 从对象存储拉取 `.so`（本地缓存）→ `plugin.Open` 加载 → `plugin.Lookup("Script")` 获取入口。

**编译环境一致性要求**：CI 必须使用与 Worker 部署相同的 Docker 镜像编译，否则 `plugin.Open` 会报版本不匹配错误。

**脚本限制**：`package main`，必须导出 `var Script`，禁止启动独立 goroutine，禁止 `os.Exit()`，只允许 import 标准库 + `stress-platform/sdk`，脚本名（子目录名）一旦确定不可修改（与平台 `script.name` 绑定）。

### 脚本版本管理：绑定层不锁版本，执行时快照

```
✅ 正确：task_script 表只存 scriptId + weight，不存 commitHash
         启动压测时从 script 表读取当前最新 commitHash，写入 task_run.script_snapshots
❌ 错误：在任务绑定层锁定 commitHash
```

### 实现前先确认方案

遇到有多种实现方式的需求时，**先列出拟采用的方案和关键设计决策，等待用户确认后再动手**，不要自行猜测并直接实现。

---

## 系统架构

```
前端 (Vue3)
    │  HTTP REST（阶段一直连，阶段二经 APISIX）
    ▼
Master (trpc-go, :8080/:8081)
    │  ├── 订阅 stress-worker 服务列表
    │  │         ▲  Nacos（TSE 托管）
    │  │         │  Worker 启动时注册（Pod IP + 元数据）
    │  │
    │  └── tRPC 点对点（直连 Worker Pod IP:9090）
    ▼
Worker × N (:9090)
    │  发压引擎（goroutine + SDK）
    │  每秒推送全局指标 → Master
    │  运行结束推送接口级指标 → Master
    ▼
对象存储（MinIO/OSS）← 脚本 .so 产物（CI 上传）
MySQL + Redis（Master 持久化 & 实时状态）
```

- **前端**：纯前端项目，目前为 mock 模式，所有 API 请求被 Axios 拦截器伪造应答，不需要启动后端
- **Master**：Go + trpc-go（http_no_protocol 模式），对外 `:8080`（前端 API），对内 `:8081`（Worker 通信）；通过 Nacos 订阅 Worker 服务列表，向具体 Worker Pod IP 发起 tRPC 调用（点对点，不经 K8s Service）
- **Worker**：独立 Go 进程，暴露 `:9090`；启动时通过 `nacos-sdk-go v2` 将自身（Pod IP + 元数据）注册到 Nacos；接收 Master 下发任务、从对象存储拉取 `.so` 并执行；运行期每秒推送全局指标，运行结束推送接口级直方图
- **Nacos**：**不部署在 K8s 内**（避免循环依赖），开发用 standalone Docker，生产用腾讯云 TSE（Nacos 托管，3 节点 HA）
- **存储**：MySQL 持久化 + Redis 实时状态（Key 规则见 `docs/02-概要设计.md` 第4节）

### 两阶段部署策略

| | 阶段一（开发期） | 阶段二（生产） |
|---|---|---|
| 基础设施 | `go run` + Docker Compose | 腾讯云 TKE（K8s）|
| Nacos | standalone Docker | TSE 托管（VPC 内网）|
| MySQL/Redis | Docker Compose | CDB / TencentDB Redis |
| 前端→Master | 直连 `localhost:8080` | APISIX Ingress → Master Service |
| Master→Worker | 直连 Pod IP（本地 `localhost`） | 直连 Worker Pod IP（Downward API 注入）|
| APISIX | **不用** | APISIX Ingress Controller |

**K8s 中 Worker 获取自身 IP**：通过 K8s Downward API 将 `status.podIP` 注入环境变量 `POD_IP`，Worker 启动时读取并注册到 Nacos。Master 从 Nacos 拿到 Pod IP 后直接发 tRPC，绕过 K8s Service 的随机负载均衡。

### Nacos 集成要点

- **用 `nacos-sdk-go v2` 直接集成**，trpc-go 没有官方 Nacos 插件，不要尝试用 trpc 插件机制
- Worker 注册服务名：`stress-worker`，元数据：`workerId / cpu_cores / mem_total_gb / max_concurrency / port`
- Master 通过 `NamingClient.Subscribe("stress-worker")` 监听服务变更，维护内存 Worker 列表
- Nacos **只负责服务发现（存活探测）**；Worker→Master 的负载心跳（cpu_usage / mem_usage / current_concurrency）通过独立的 tRPC 心跳接口上报，两者解耦

---

## 压测核心概念

### 压测模式（`ScenarioMode`）

前端类型定义在 `src/types/index.ts`，`ScenarioConfig` 结构：

| 模式 | 控制变量 | 关键字段 |
|------|---------|---------|
| `step`（VU 阶梯） | 任意阶梯数组 | `steps: VUStep[]`（每阶段独立设置 `concurrent`、`rampTime`、`duration`） |
| `rps`（定速 RPS） | 目标请求速率 | `rpsMode: 'fixed'|'step'` 决定子模式 |

RPS 有两个子模式，由 `form.scenarioConfig.rpsMode` 控制：
- **fixed**：`targetRps` 单值，恒速注入
- **step**：`rpsSteps: RpsStepConfig[]`，每阶段含 `rps`（目标值）、`duration`（稳定时长）、`rampTime`（从上阶段线性爬升的秒数，0=瞬变，第一阶段从 0 起步）

VU 阶梯的 `StepConfig` 字段：
- `concurrent`：本阶段目标并发数
- `rampTime`：从上一阶段线性爬升所需秒数，0=瞬变，第一阶段从 0 起步
- `duration`：稳定持续时长（秒）

曲线预览（`curveOption` computed）：`rampTime > 0` 时爬坡段为斜线，`rampTime = 0` 时为垂直阶跃（VU 阶梯和 RPS 阶梯均适用）。

后端 `scene_config` 表用 `steps_json`（JSON 字段）统一存两种阶梯数组，`rps_mode` 字段区分子模式。Worker 侧对应 `VUStep` / `RPSStep` 结构体（见 `docs/04`）。

---

## 前端开发

### 命令

```bash
npm run dev          # 本机访问
npm run dev -- --host  # 局域网其他设备访问（会显示 Network IP）
npm run build        # 类型检查 + 生产构建
```

**每次修改 `.vue` / `.ts` / `.scss` 文件后，运行 `npm run build` 验证构建通过，再提交结果。不允许在构建报错的状态下结束任务。**

### Mock 层（重要）

所有 HTTP 请求在 DEV 模式下被 `src/mock/index.ts` 拦截，通过覆盖 `config.adapter` 直接返回伪造数据，**不发起任何真实网络请求**。`src/mock/handlers/` 下按模块分文件，`src/mock/data/` 存静态数据。执行状态保存在 `execution.ts` 的内存 `Map` 中，**页面刷新即重置**。

新增接口：在对应 handler 文件里添加 `MockHandler`，用 `ok()` / `fail()` / `pageResult()` 返回。

**Mock 响应注意**：`mock/index.ts` 中已通过 `JSON.parse(JSON.stringify(...))` 序列化响应，确保 Vue 响应式正常触发。handler 内部用 `setTimeout` 模拟异步状态变更时，依赖此序列化才能让前端轮询到最新状态。

### SCSS

`src/assets/styles/variables.scss` 使用 **Grafana Light 主题** palette（主色 `#3871dc`，页面背景 `#f4f5f5`，侧边栏 `#f0f1f2`）。`_global.scss` 通过 `vite.config.ts` 自动注入所有 Vue SFC，**不需要也不应该在 `.vue` 文件中手动 `@use`**。

SCSS 变量/mixin 在 `.vue` 文件中可直接使用，无需任何 import 语句。如需引入新的全局样式，修改 `vite.config.ts` 的 `additionalData` 配置。

### 脚本绑定 UI 注意事项

- 脚本选择弹窗（`TaskDetailView.vue`）中 `availableScripts` 是 **computed**，直接派生自 `scriptStore.list` 并按 `updatedAt` 降序排列，**不是 ref**，不需要手动赋值
- `filteredScripts` 在此基础上再按关键词过滤，表格绑定 `filteredScripts`
- 凡涉及场景配置字段的改动（如新增模式参数），需同步更新 `docs/03`（DDL）、`docs/04`（SubTaskConfig）、`docs/05`（接口）

### el-form 表单提交写法

始终使用 **Promise 写法**，不使用回调写法：

```typescript
// ✅ 正确
const valid = await formRef.value.validate().catch(() => false)
if (!valid) return

// ❌ 错误（回调写法导致 router.push 不在 await 链上，跳转可能丢失）
await formRef.value.validate(async (valid) => {
  if (!valid) return
  await router.push('/xxx')  // 不可靠
})
```

---

## 写作风格（文档 / 注释）

- 面向**高级工程师**，避免过于基础或泛泛的描述
- 技术细节要具体：给出字段名、类型、取值范围，而不是模糊描述
- 设计决策要说明**为什么**，不只是**是什么**

---

## 当前状态

`stress-web/` 是前端项目，**后端（Go）尚未开始实现**。`trpc-go/` 目录是后端工程的占位目录。后端实现时参考 `docs/03-详细设计.md` 的工程结构和 `docs/05-接口设计.md` 的接口规范。
