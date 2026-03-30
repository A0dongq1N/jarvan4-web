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
export type TaskStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'stopped' | 'circuit_broken'
export type ScriptLanguage = 'go' | 'python' | 'javascript'

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
  name: string
  description?: string
  status: TaskStatus
  scenarioConfig: ScenarioConfig
  scripts: TaskScript[]
  createdAt: string
  updatedAt: string
  lastExecutionId?: string
}

export type ScenarioMode = 'step' | 'rps'

export interface ScenarioConfig {
  mode: ScenarioMode
  duration: number      // 秒
  // 阶梯模式
  steps?: StepConfig[]
  // RPS 固定模式
  targetRps?: number
  rpsRampTime?: number  // 固定速率爬坡时长（秒），0 = 立即起步
  // RPS 阶梯模式
  rpsSteps?: RpsStepConfig[]
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

export interface StepConfig {
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
  maxConcurrency: number
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
  scriptSnapshots?: ScriptSnapshot[]
  // pending 阶段初始化步骤
  initSteps?: InitStep[]
  // 压测完成后关联的报告 ID（用于自动跳转）
  reportId?: string
}

export interface MetricPoint {
  timestamp: number
  value: number
}

export interface MetricsSummary {
  rps: number
  avgResponseTime: number
  p99ResponseTime: number
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
  percentiles: PercentileData[]
  errors: ErrorData[]
  createdAt: string
  // 场景模式（RPS 模式报告差异化展示用）
  scenarioMode?: ScenarioMode
  targetRps?: number
  scriptSnapshots?: ScriptSnapshot[]
  workerSnapshots?: WorkerSnapshot[]
}

export interface PercentileData {
  api: string
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
}

export interface ErrorData {
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
