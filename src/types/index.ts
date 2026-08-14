// ============================================================
// 全局类型定义
// ============================================================

// 通用响应结构
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 状态枚举
// pending: 已创建执行，等待勾选脚本后部署
// prepared: 脚本部署完成，等待用户手动触发开始压测
export type TaskStatus = 'idle' | 'pending' | 'preparing' | 'prepared' | 'running' | 'success' | 'failed' | 'stopped' | 'circuit_broken'
export type ScriptLanguage = 'go' | 'python' | 'javascript'

// 脚本部署状态（preparing 阶段展示）
export type ScriptStatus = 'pending' | 'downloading' | 'ready' | 'failed'

export interface WorkerScriptDeployStatus {
  workerId: string
  addr: string
  status: ScriptStatus
  error?: string
}

export interface ScriptStatusInfo {
  scriptId: string
  scriptName: string
  commitHash: string
  artifactUrl: string
  status: ScriptStatus
  error?: string
  workers?: WorkerScriptDeployStatus[]
}

// 用户
export interface UserInfo {
  id: string
  username: string
  displayName: string
  avatar?: string
  role: 'admin' | 'user'
}

// 任务相关
export interface StressTask {
  id: string
  projectId?: string
  name: string
  description?: string
  status: TaskStatus
  scenarioConfig: ScenarioConfig
  scripts: TaskScript[]
  createdAt: string
  updatedAt: string
  lastExecutionId?: string
}

export type ScenarioMode = 'vu' | 'rps'

export interface ScenarioConfig {
  mode: ScenarioMode
  duration: number      // 秒
  // VU 阶梯模式
  vuSteps?: VuStepConfig[]
  // RPS 阶梯模式（仅支持阶梯爬升）
  rpsMode?: 'step'
  rpsSteps?: RpsStepConfig[]
  /** @deprecated 旧固定速率字段，加载时自动迁移为 rpsSteps */
  targetRps?: number
  /** @deprecated 旧固定速率字段 */
  rpsRampTime?: number
  /** RPS 稳态结束后的回落时长（秒）；0=到期即停 */
  rpsRampDownTime?: number
  // 场景级环境变量，执行时下发给 Worker，脚本通过 ctx.Vars.Env(key) 读取
  envVars?: Record<string, string>
  // 熔断配置
  circuitBreaker?: CircuitBreakerConfig
}

// 接口级熔断规则（每条规则参数独立）
export interface CircuitBreakerRule {
  urlPattern: string          // 接口 pattern，支持 * 通配符，如 /api/order/*
  errorRateThreshold: number  // 该接口错误率阈值（%）
  windowSeconds: number       // 滑动统计窗口（秒）
  minRequests: number         // 窗口内最少请求数
}

export interface CircuitBreakerConfig {
  enabled: boolean
  // 接口级规则（优先级高于全局兜底，可为空）
  rules: CircuitBreakerRule[]
  // 全局兜底（独立参数，与接口级规则互不干扰）
  globalErrorRateThreshold: number
  globalWindowSeconds: number
  globalMinRequests: number
}

export interface VuStepConfig {
  concurrent: number
  duration: number   // 稳定持续时长（秒）
  rampTime: number   // 从上一阶段线性爬升到本并发数所需时间（秒），0 = 瞬变，第一阶段从 0 起步
}

export interface RpsStepConfig {
  rps: number
  duration: number   // 稳定持续时长（秒），不含爬坡
  rampTime: number   // 从上一阶段线性爬升到本阶段 rps 所需时间（秒），0 表示瞬变
}

export interface TaskScript {
  scriptId: string
  scriptName: string
  weight: number
  targetRps?: number
  // 运行时透传给脚本的环境变量，脚本通过 ctx.Vars.Env(key) 读取
  // 格式：{ "INTERFACE_WEIGHTS": "{\"search\":70,\"order\":30}", "BASE_URL": "..." }
  envVars?: Record<string, string>
}

export interface ScriptSnapshot {
  scriptId: string
  scriptName: string
  commitHash: string
  weight: number
}

export interface WorkerSnapshot {
  workerId: string
  hostname: string
  ip: string
  cpuCores: number
  memTotalGb: number
  maxConcurrency: number
  effectiveMaxRps?: number
}

export interface ScenePlan {
  mode: ScenarioMode
  peakRps?: number
  peakConcurrent?: number
  durationSec?: number
  scripts?: ScriptPlanItem[]
  workers?: WorkerPlanItem[]
}

export interface ScriptPlanItem {
  scriptName: string
  targetRps?: number
  weight?: number
}

export interface WorkerPlanItem {
  addr: string
  effectiveQuota?: number
  assignedRps?: number
}

// 脚本相关
export interface Script {
  id: string
  name: string
  language: ScriptLanguage
  description?: string
  commitHash: string       // 最新发布版本的 Git commit hash
  artifactUrl: string      // 对象存储 .so 路径
  commitMsg: string        // commit message
  author: string           // 提交者
  // 源码仓库信息（CI 发布时透传），用于在前端展示"查看源码"链接
  // 链接 URL 规则：`${sourceRepo}/-/blob/main/${sourcePath}`（适配 cnb.cool / GitHub 等）
  sourceRepo?: string      // 仓库地址，如 https://cnb.cool/group/repo
  sourcePath?: string      // 脚本在仓库中的相对路径，如 scripts/http_login/main.go
  updatedAt: string
  createdAt: string
}

export interface ScriptVersion {
  commitHash: string
  artifactUrl: string
  commitMsg: string
  author: string
  createdAt: string
}

// 执行历史记录（列表页展示用，不含实时指标）
export interface ExecutionRecord {
  id: string
  taskId: string
  status: TaskStatus
  triggerType: 1 | 2          // 1=手动 2=定时
  triggeredByName: string
  startTime?: string
  endTime?: string
  durationSec?: number        // 实际执行时长（秒）
  errorMsg?: string
  reportId?: string           // 若已生成报告，可直接跳转
  // preparing 阶段各脚本部署进度
  scriptStatuses?: ScriptStatusInfo[]
}

// 初始化步骤（pending 阶段展示）
export type InitStepStatus = 'waiting' | 'running' | 'done' | 'error'

export interface InitStep {
  key: string
  label: string
  status: InitStepStatus
  detail?: string
  items?: string[]   // 结构化列表（worker 节点、脚本版本等）
}

// 执行相关
export interface ExecutionState {
  id: string
  taskId: string
  taskName: string
  status: TaskStatus
  startTime?: string
  endTime?: string
  elapsedSeconds: number
  // 场景模式上下文（前端差异化展示用）
  scenarioMode?: ScenarioMode
  targetRps?: number
  scenePlan?: ScenePlan
  scriptSnapshots?: ScriptSnapshot[]
  // pending 阶段初始化步骤
  initSteps?: InitStep[]
  // preparing 阶段各脚本部署进度
  scriptStatuses?: ScriptStatusInfo[]
  // 选定的 Worker 节点
  workerSnapshots?: WorkerSnapshot[]
  // 压测完成后关联的报告 ID（用于自动跳转）
  reportId?: string
  errorMsg?: string
  warningMsg?: string
}

export interface MetricPoint {
  timestamp: number
  value: number
}

export interface RTHistogramBucket {
  label: string
  count: number
}

export interface MetricsSummary {
  rps: number
  avgResponseTime: number
  p99ResponseTime: number
  maxResponseTime?: number
  errorRate: number
  totalRequests: number
  successRequests: number
  failedRequests: number
  concurrent: number
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  source?: string
  workerId?: string
}

export interface ExecutionLogsResponse {
  logs: LogEntry[]
  droppedLogs: number
}

// 报告相关
export interface Report {
  id: string
  taskId: string
  taskName: string
  executionId: string
  status: TaskStatus
  startTime: string
  endTime: string
  duration: number
  summary: MetricsSummary
  rpsData: MetricPoint[]
  responseTimeData: MetricPoint[]
  errorRateData: MetricPoint[]
  concurrentData: MetricPoint[]
  p95Data?: MetricPoint[]
  p99Data?: MetricPoint[]
  maxData?: MetricPoint[]
  rtHistogramData?: RTHistogramBucket[]
  percentiles: PercentileData[]
  errors: ErrorData[]
  createdAt: string
  errorMsg?: string
  // 场景模式（RPS 模式报告差异化展示用）
  scenarioMode?: ScenarioMode
  targetRps?: number
  circuitBreaker?: CircuitBreakerConfig
  scriptSnapshots?: ScriptSnapshot[]
  workerSnapshots?: WorkerSnapshot[]
  scriptStatuses?: ScriptStatusInfo[]
}

export interface PercentileData {
  api: string
  scriptName?: string  // 所属脚本名
  requests: number   // 该接口总请求数
  errors: number     // 该接口错误数
  errorRate: number  // 错误率（0-1）
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
  max: number
  min: number
  // 接口维度时序（每秒一个点，与全局时序同步）
  rpsData?:          MetricPoint[]
  responseTimeData?: MetricPoint[]
  errorRateData?:    MetricPoint[]
  p95Data?:          MetricPoint[]
  p99Data?:          MetricPoint[]
  maxData?:          MetricPoint[]
  rtHistogramData?:  RTHistogramBucket[]
  // RPS 达成率（前端计算）
  peakRps?:        number  // 稳态 P95 峰值
  steadyAvgRps?:   number  // 稳态平均 RPS（达成率/相差对比用）
  avgRps?:         number  // 全程平均 RPS = requests / duration
  actualRps?:      number  // 兼容旧字段，等同 avgRps
  scriptTargetRps?: number // 脚本级目标 RPS（全局目标 × 权重占比）
  targetRps?:      number  // 接口目标 RPS（脚本目标 × 请求数/脚本内最大请求数）
  rpsGap?:         number  // 相差数 = target - 峰值（稳态 P95）
  rpsGapPercent?:  number  // 相差百分比
}

export interface ErrorData {
  // 关联接口（可选）
  api?: string
  // 错误码：业务错误码（如 "10001"）或系统错误标识（如 "TIMEOUT"、"CONNECTION_REFUSED"）
  code:       string
  // 错误描述：脚本 ScriptError.Message 或 error.Error() 原始字符串
  message:    string
  // 错误分类：business=业务错误（被测服务返回）system=系统错误（网络/超时/协议层）
  errorType:  'business' | 'system'
  count:      number
  percentage: number
}

// Worker 节点
export type WorkerStatus = 'online' | 'busy' | 'offline'

export interface WorkerNode {
  id: string
  workerId: string
  hostname: string
  ip: string
  port: number
  status: WorkerStatus
  cpuCores: number
  memTotalGb: number          // 总内存(GB)
  maxConcurrency: number
  cpuUsage: number            // 0-100
  memUsage: number            // 0-100
  currentConcurrency: number
  runningRunId?: string
  runningTaskName?: string
  lastHeartbeat: string
  heartbeatAgoSec: number
  pluginAbiVersion?: number
  workerBuildId?: string
  declaredMaxRps?: number
  effectiveMaxRps?: number
}

// 项目
export interface Project {
  id: string
  name: string
  description?: string
  taskCount: number
  scriptCount: number
  lastRunAt?: string   // 最近一次压测时间
  createdAt: string
  updatedAt: string
}

// Audit Log
export type AuditAction =
  | 'login' | 'logout'
  | 'create_task' | 'update_task' | 'delete_task' | 'copy_task'
  | 'start_execution' | 'stop_execution'
  | 'create_script' | 'delete_script'
  | 'create_project' | 'delete_project'
  | 'create_user' | 'update_user' | 'delete_user'
  | 'register_worker' | 'offline_worker'

export type AuditResourceType = 'task' | 'script' | 'execution' | 'project' | 'user' | 'worker' | 'system'

export interface AuditLog {
  id: string
  userId: string
  username: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  resourceName?: string
  detail?: string
  ip: string
  createdAt: string
}
