# CODEBUDDY.md — jarvan4-web

前端管理台。Vue 3 + TypeScript + Vite + Element Plus + Pinia。

## 核心规则

### UI 验证要求

- **必须从 UI 视角验证** — 真打开浏览器看页面，不只看 API 返回
- **API 200 不等于通过** — 必须校验页面显示的数值/状态是否合理
- **亚毫秒精度** — RT 值小于 1ms 时用 `formatMs()` 自适应精度，不用 `formatNumber(x, 0)`（会把 0.127 截断为 0）
- **前后端字段对齐** — 后端返回的 status 枚举值必须和前端 `labelMap` 对齐（如 `idle` 不是 `inactive`）

### 审计日志前端同步

新增写操作功能时确认：
- [ ] `src/types/index.ts` 中 `AuditAction` 枚举是否需要新增值？
- [ ] `src/views/audit/AuditLogView.vue` 中 `ACTION_LABELS` 映射是否同步更新？

### 文档同步规则

功能变更后必须同步更新 `../jarvan4-platform/doc/` 下相关设计文档（前后端共用一套设计文档）。

## 开发命令

```bash
npm run dev                    # 本机访问（默认 mock 模式）
npm run dev -- --host          # 局域网访问
VITE_USE_MOCK=false npm run dev  # 直连后端（vite proxy :8090）
npm run build                  # 类型检查 + 生产构建
npx tsc --noEmit               # 只做类型检查
npx playwright test            # E2E 测试
```

**每次修改 `.vue` / `.ts` / `.scss` 后运行 `npm run build` 验证构建通过，不允许在构建报错状态下结束任务。**

## Mock 层

DEV 模式下 `src/mock/index.ts` 拦截所有 Axios 请求，不发起真实网络请求。

- `src/mock/handlers/` — 按模块分文件
- `src/mock/data/` — 静态数据
- 执行状态在内存 Map 中，刷新即重置

新增接口：在对应 handler 文件添加 `MockHandler`，用 `ok()` / `fail()` / `pageResult()` 返回。

Mock 响应已通过 `JSON.parse(JSON.stringify(...))` 序列化，确保 Vue 响应式正常触发。

## SCSS

`src/assets/styles/variables.scss` 使用 **Grafana Light 主题**（主色 `#3871dc`，背景 `#f4f5f5`）。

`_global.scss` 通过 `vite.config.ts` 自动注入所有 Vue SFC，**不需要也不应该在 `.vue` 中手动 `@use`**。SCSS 变量/mixin 可直接使用。

## 编码规范

### el-form 表单提交

始终用 **Promise 写法**，不用回调写法：

```typescript
// ✅ 正确
const valid = await formRef.value.validate().catch(() => false)
if (!valid) return

// ❌ 错误（回调写法导致 router.push 不在 await 链上）
await formRef.value.validate(async (valid) => { ... })
```

### 数值显示精度

响应时间等小数值用 `formatMs()`（自适应精度），不用 `formatNumber(x, 0)`：

| 值 | formatNumber(x, 0) | formatMs(x) |
|----|---------------------|-------------|
| 0.127 | 0 ms | 0.13 ms |
| 0.97 | 1 ms | 1.0 ms |
| 1500 | 1500 ms | 1.50 s |

### 状态字段对齐

前端 `StatusBadge` 的 `labelMap` 和后端返回的 status 值必须一致：

```typescript
// src/components/common/StatusBadge.vue
const labelMap: Record<TaskStatus, string> = {
  idle: '空闲',
  pending: '初始化中',
  running: '运行中',
  success: '已完成',
  failed: '失败',
  stopped: '已停止',
  circuit_broken: '熔断停止',
}
```

后端返回 `status` 值必须是上述 key 之一，不能是 `inactive` 等未定义值。

## 目录结构

| 目录 | 职责 |
|------|------|
| `src/router/` | 路由配置 |
| `src/views/` | 页面组件（login, project, task, script, execution, report, worker, audit） |
| `src/components/` | 复用组件（layout, common, charts, editor） |
| `src/stores/` | Pinia stores |
| `src/api/` | Axios API 模块 |
| `src/mock/` | Mock 层（DEV 模式） |
| `src/types/index.ts` | 全局 TypeScript 类型定义 |
| `src/utils/` | 工具函数（format, request 等） |
| `src/assets/styles/` | SCSS 主题 |

## 联调模式

| 模式 | 命令 | 说明 |
|------|------|------|
| Mock | `npm run dev` | 默认，无需后端 |
| 直连后端 | `VITE_USE_MOCK=false npm run dev` | vite proxy 转发 `/api/*` 到 `:8090` |
