# jarvan4-web

分布式压测平台的管理台。用来管项目、任务、脚本、节点、压测执行和报告。

技术栈：Vue 3 · TypeScript · Vite · Element Plus · Pinia · ECharts

配套后端：[../jarvan4-platform/README.md](../jarvan4-platform/README.md)

```
浏览器 (:5173)
 │  HTTP /api + JWT
 ▼
Master (:8090)  ←  vite 开发代理
 │
 └── Worker (:9090)   真正发压时才需要
```

开发时有两种模式：

| 模式 | 要不要后端 | 命令 |
|------|------------|------|
| Mock | 不要 | `npm run dev` |
| 直连后端 | 要先起 Master | `VITE_USE_MOCK=false npm run dev` |

只想看页面、点菜单，用 Mock 即可。要登录真实账号、看库里的任务和报告，用直连后端。

## 依赖

- Node.js 20+（本仓库 Vite 8）
- 直连后端时还需要已启动的 Master，见下方「完整启动」

首次进入目录先装依赖：

```bash
cd jarvan4-web
npm install
```

## 只看前端（Mock）

```bash
cd jarvan4-web
npm run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)。

默认就是 Mock：开发模式下 `src/main.ts` 会拦截 Axios，请求不会打到 Master。执行状态存在内存里，刷新页面会丢。

登录页预填了测试账号（Mock 和本地后端都是这一组）：

- 用户名 `admin`
- 密码 `admin123`

局域网访问：

```bash
npm run dev -- --host
```

## 完整启动（前端 + 后端）

先起后端，再起前端。后端敏感配置（MySQL / Redis / JWT / COS）在 Polaris 的 `master.yaml` 里，拉不到配置 Master 起不来。Polaris 地址等见 [平台 README](../jarvan4-platform/README.md)。

**1. 编译并重启 Master + Worker**

```bash
cd ../jarvan4-platform
make restart
```

常用替代：

| 命令 | 作用 |
|------|------|
| `make restart-master` | 只重启 Master（HTTP `:8090`，内部 tRPC `:8095`） |
| `make restart-worker` | 只重启 Worker（tRPC `:9090`，并清 `/tmp/worker-scripts/`） |
| `make help` | 全部 Makefile target |

确认 Master 在听 8090 后再开前端。只做管理台联调时 Worker 可以后启；要点「部署 / 开跑」才需要 Worker 在线。

**2. 前端直连 Master**

在 `jarvan4-web`：

```bash
VITE_USE_MOCK=false npm run dev
```

或在 `jarvan4-platform` 里一条命令（同样是关 Mock、监听 5173）：

```bash
make web-dev
```

Vite 把 `/api` 代理到 `http://localhost:8090`（见 `vite.config.ts`）。页面地址仍是 [http://localhost:5173](http://localhost:5173)，不要直接打开 8090 当管理台。

登录仍是 `admin` / `admin123`（本地库里的测试账号；密码走 RSA 加密后再提交）。

## 页面

登录后默认进项目下的任务列表。

| 路径 | 页面 |
|------|------|
| `/login` | 登录 |
| `/project` | 项目列表 |
| `/task` | 任务 |
| `/script` | 脚本 |
| `/execution/:taskId` | 某次任务的执行 |
| `/report` | 报告 |
| `/worker` | 节点 |
| `/audit` | 审计日志 |

## 其他命令

```bash
npm run build      # vue-tsc 类型检查 + 生产构建
npm run preview    # 预览构建产物（不带 Mock，需自行提供 /api）
npx tsc --noEmit   # 只做类型检查
npx playwright test
```

Playwright 前提：Master 已在 `:8090`，且前端已用 `VITE_USE_MOCK=false` 起在 `:5173`。

改了 `.vue` / `.ts` / `.scss` 后跑一次 `npm run build`，确认能编过。从平台目录构建前端是 `make web`。

## 目录

| 目录 | 内容 |
|------|------|
| `src/views/` | 页面：login、project、task、script、execution、report、worker、audit |
| `src/api/` | 对 Master REST 的 Axios 封装 |
| `src/mock/` | Mock：`handlers/` 按模块，`data/` 静态数据 |
| `src/stores/` | Pinia |
| `src/router/` | 路由 |
| `src/assets/styles/` | 主题（Grafana Light，主色 `#3871dc`） |

Mock 关不关只看环境变量：`VITE_USE_MOCK=false` 才打真实接口；不设或设成别的值，开发模式都走 Mock。

编码约定、表单校验写法和审计日志同步见 [CODEBUDDY.md](CODEBUDDY.md)。后端编译、Polaris、Worker 安装见 [平台 README](../jarvan4-platform/README.md)。
