import type { MockHandler } from '../types'
import { ok, fail, pageResult } from '../types'
import type { ExecutionState, MetricsSummary, LogEntry, ScenarioConfig, PercentileData, ErrorData } from '@/types'
import type { ExecutionRecord as ExecutionHistoryRecord } from '@/types'
import { mockTasks } from '../data/tasks'
import { mockScripts } from '../data/scripts'
import { mockWorkers } from '../data/workers'
import { mockReports } from '../data/reports'
import { genId } from '@/utils/format'

// ── 接口维度 Mock 数据配置 ──────────────────────────────────────────────
const TASK_API_PATTERNS: Record<string, { api: string; rpsWeight: number }[]> = {
  task002: [
    { api: '/v1/search',         rpsWeight: 0.8 },
    { api: '/v1/search/suggest', rpsWeight: 0.2 },
  ],
  task003: [{ api: '/v1/home', rpsWeight: 1.0 }],
  task006: [
    { api: '/v1/search', rpsWeight: 0.6 },
    { api: '/v1/login',  rpsWeight: 0.4 },
  ],
}
const DEFAULT_API_PATTERNS = [
  { api: '/v1/api-a', rpsWeight: 0.6 },
  { api: '/v1/api-b', rpsWeight: 0.4 },
]

// 每个接口的固定业务错误码（与接口路径绑定）
const API_ERROR_CODES: Record<string, { code: string; message: string }> = {
  '/v1/search':         { code: '40001', message: '搜索参数非法' },
  '/v1/search/suggest': { code: '40002', message: '建议词服务不可用' },
  '/v1/home':           { code: '50001', message: '首页数据加载失败' },
  '/v1/login':          { code: '40101', message: '认证令牌过期' },
  '/v1/api-a':          { code: '50010', message: '下游服务超时' },
  '/v1/api-b':          { code: '50011', message: '内部逻辑错误' },
}

// 预置的历史执行记录（静态，用于展示历史列表）
const mockExecutionHistory: ExecutionHistoryRecord[] = [
  {
    id: 'exec002',
    taskId: 'task002',
    status: 'success',
    triggerType: 1,
    triggeredByName: 'admin',
    startTime: '2026-03-14T14:00:00Z',
    endTime: '2026-03-14T14:10:00Z',
    durationSec: 600,
    reportId: 'report001',
  },
  {
    id: 'exec003',
    taskId: 'task003',
    status: 'failed',
    triggerType: 1,
    triggeredByName: 'admin',
    startTime: '2026-03-13T09:00:00Z',
    endTime: '2026-03-13T09:05:30Z',
    durationSec: 330,
    reportId: 'report002',
    errorMsg: '错误率超过阈值，系统过载',
  },
  {
    id: 'exec006',
    taskId: 'task006',
    status: 'success',
    triggerType: 1,
    triggeredByName: 'tester01',
    startTime: '2026-03-19T09:00:00Z',
    endTime: '2026-03-19T09:03:00Z',
    durationSec: 180,
    reportId: 'report003',
  },
]

interface ExecutionRecord {
  execution: ExecutionState
  startTime: number
  logOffset: number
  taskId: string
  scenarioConfig: ScenarioConfig
}

const executions = new Map<string, ExecutionRecord>()

function getElapsed(record: ExecutionRecord): number {
  if (record.execution.status !== 'running') return 0
  return Math.floor((Date.now() - record.startTime) / 1000)
}

// ── VU 阶梯模式仿真（并发驱动 RPS）─────────────────────────────────────
function simulateVuMetrics(elapsed: number, config: ScenarioConfig): MetricsSummary {
  // 按步骤累计时长确定当前并发（含阶段内 rampTime 线性爬升）
  let concurrent = 0
  if (config.steps?.length) {
    let acc = 0
    let prevConcurrent = 0
    for (const step of config.steps) {
      const stepTotal = (step.rampTime ?? 0) + step.duration
      if (elapsed < acc + stepTotal) {
        const localElapsed = elapsed - acc
        const ramp = step.rampTime ?? 0
        if (ramp > 0 && localElapsed < ramp) {
          // 爬坡阶段：线性插值
          concurrent = Math.floor(prevConcurrent + (step.concurrent - prevConcurrent) * (localElapsed / ramp))
        } else {
          concurrent = step.concurrent
        }
        break
      }
      acc += stepTotal
      prevConcurrent = step.concurrent
      concurrent = step.concurrent
    }
  }

  const rps = concurrent * (3.5 + Math.random() * 1.5)
  const avgResponseTime = 80 + Math.random() * 60 + (elapsed > 90 ? 40 : 0)
  const errorRate = elapsed > 100 ? 0.01 + Math.random() * 0.02 : Math.random() * 0.005

  return {
    rps: parseFloat(rps.toFixed(1)),
    avgResponseTime: parseFloat(avgResponseTime.toFixed(0)),
    p99ResponseTime: parseFloat((avgResponseTime * 4 + Math.random() * 100).toFixed(0)),
    errorRate: parseFloat(errorRate.toFixed(4)),
    totalRequests: Math.floor(elapsed * rps),
    successRequests: Math.floor(elapsed * rps * (1 - errorRate)),
    failedRequests: Math.floor(elapsed * rps * errorRate),
    concurrent,
  }
}

// ── RPS 模式仿真（吞吐量驱动，RT 随压力增长）────────────────────────
function simulateRpsMetrics(elapsed: number, config: ScenarioConfig): MetricsSummary {
  const targetRps = config.targetRps ?? 100
  const duration = config.duration ?? 180
  const rpsRampTime = config.rpsRampTime ?? 0  // 固定速率爬坡时长

  // RPS 受控：有爬坡则线性爬升，否则立即到位；稳定期 ±3% 抖动
  const rampProgress = rpsRampTime > 0
    ? Math.min(elapsed / rpsRampTime, 1)
    : 1
  const totalElapsed = elapsed
  const stableElapsed = Math.max(0, totalElapsed - rpsRampTime)
  const stressFactor = Math.max(0, (stableElapsed - duration * 0.7) / (duration * 0.3))

  const rand = Math.random()

  // RPS 受控：预热线性爬升，稳定期 ±3% 抖动
  const rps = targetRps * rampProgress * (0.97 + rand * 0.06)

  // RT 二次曲线上升：施压后非线性增大
  const avgResponseTime = 80 + stressFactor * stressFactor * 400 + Math.random() * 20

  // Little's Law: C = RPS × RT(s)
  const concurrent = Math.max(1, Math.ceil(rps * avgResponseTime / 1000))

  // 错误率：施压后期才出现
  const errorRate = stressFactor > 0.6
    ? (stressFactor - 0.6) * 0.15
    : Math.random() * 0.002

  return {
    rps: parseFloat(rps.toFixed(1)),
    avgResponseTime: parseFloat(avgResponseTime.toFixed(0)),
    p99ResponseTime: parseFloat((avgResponseTime * (2 + stressFactor * 3) + Math.random() * 50).toFixed(0)),
    errorRate: parseFloat(errorRate.toFixed(4)),
    totalRequests: Math.floor(elapsed * rps),
    successRequests: Math.floor(elapsed * rps * (1 - errorRate)),
    failedRequests: Math.floor(elapsed * rps * errorRate),
    concurrent,
  }
}

// ── VU 专用日志池 ──────────────────────────────────────────────────────
const vuLogMessages = [
  { level: 'info', msg: '开始压测，初始化连接池...' },
  { level: 'info', msg: '并发用户已就绪，开始发送请求' },
  { level: 'info', msg: 'GET /api/search - 200 OK - 45ms' },
  { level: 'info', msg: 'POST /api/login - 200 OK - 89ms' },
  { level: 'warn', msg: '响应时间超过阈值: 500ms' },
  { level: 'info', msg: 'GET /api/products - 200 OK - 123ms' },
  { level: 'info', msg: '当前 RPS: 856.3, 并发: 150, 错误率: 0.12%' },
  { level: 'error', msg: 'POST /api/checkout - 503 Service Unavailable - 5000ms' },
  { level: 'info', msg: 'GET /api/user/profile - 200 OK - 67ms' },
  { level: 'debug', msg: '连接复用率: 94.2%, 活跃连接: 148' },
  { level: 'info', msg: 'POST /api/cart/add - 200 OK - 234ms' },
  { level: 'warn', msg: '内存使用率: 78%, 注意监控' },
  { level: 'info', msg: 'DELETE /api/cart/item - 200 OK - 56ms' },
  { level: 'info', msg: '阶段检查点：已发送 50000 个请求' },
  { level: 'error', msg: 'GET /api/recommend - Connection timeout after 10s' },
]

// ── RPS 专用日志池 ─────────────────────────────────────────────────────
function getRpsLogMessages(config: ScenarioConfig) {
  const targetRps = config.targetRps ?? 100
  const actualTps = (targetRps * (0.95 + Math.random() * 0.1)).toFixed(1)
  const p99 = Math.floor(300 + Math.random() * 200)
  const concurrent = Math.ceil(parseFloat(actualTps) * 0.1)
  const achievement = (parseFloat(actualTps) / targetRps * 100).toFixed(1)

  return [
    { level: 'info', msg: `令牌桶速率控制器就绪，目标: ${targetRps} req/s` },
    { level: 'info', msg: `速率调度器: 实际 ${actualTps} req/s vs 目标 ${targetRps} req/s` },
    { level: 'warn', msg: `响应时间 P99 超过 500ms 告警，当前: ${p99}ms` },
    { level: 'info', msg: `系统接近饱和，推算并发: ${concurrent}（Little's Law）` },
    { level: 'info', msg: `RPS 达成率: ${achievement}%` },
    { level: 'info', msg: `GET /api/home - 200 OK - ${Math.floor(80 + Math.random() * 40)}ms` },
    { level: 'debug', msg: `令牌桶剩余令牌: ${Math.floor(Math.random() * 50)}, 等待队列: ${Math.floor(Math.random() * 10)}` },
    { level: 'info', msg: `批次发送 ${Math.floor(targetRps / 10)} 个请求，预计间隔 ${(1000 / targetRps).toFixed(1)}ms` },
  ]
}

// ── 接口维度指标生成 ────────────────────────────────────────────────────
function generateApiMetrics(record: ExecutionRecord): { percentiles: PercentileData[]; errors: ErrorData[] } {
  const elapsed = getElapsed(record)
  const config = record.scenarioConfig
  const summary: MetricsSummary = config.mode === 'rps'
    ? simulateRpsMetrics(elapsed, config)
    : simulateVuMetrics(elapsed, config)

  const patterns = TASK_API_PATTERNS[record.taskId] ?? DEFAULT_API_PATTERNS
  const ts = Date.now()

  const percentiles: PercentileData[] = patterns.map(({ api, rpsWeight }) => {
    const apiRps = summary.rps * rpsWeight
    // 每个接口的 RT 在全局 avgRT 基础上加随机扰动（±20%）
    const perturbation = 0.8 + Math.random() * 0.4
    const avgRT = summary.avgResponseTime * perturbation

    const p50  = Math.round(avgRT * 0.8)
    const p75  = Math.round(avgRT * 0.95)
    const p90  = Math.round(avgRT * 1.2)
    const p95  = Math.round(avgRT * 1.5)
    const p99  = Math.round(avgRT * 2.0)
    const max  = Math.round(avgRT * 3.5)
    const min  = Math.round(avgRT * 0.3)

    const requests   = Math.max(1, Math.floor(elapsed * apiRps))
    const errorRate  = summary.errorRate * (0.8 + Math.random() * 0.4)
    const errors     = Math.floor(requests * errorRate)

    return {
      api,
      requests,
      errors,
      errorRate: parseFloat(errorRate.toFixed(4)),
      p50, p75, p90, p95, p99, max, min,
      // 当前周期单点（前端滑动窗口将追加积累）
      rpsData:          [{ timestamp: ts, value: parseFloat(apiRps.toFixed(1)) }],
      responseTimeData: [{ timestamp: ts, value: Math.round(avgRT) }],
      errorRateData:    [{ timestamp: ts, value: parseFloat((errorRate * 100).toFixed(2)) }],
    }
  })

  // 错误分析：TIMEOUT 系统错误 + 各接口的业务错误码
  const totalErrors = percentiles.reduce((sum, p) => sum + p.errors, 0)
  const errorsData: ErrorData[] = []
  if (totalErrors > 0) {
    const timeoutCount = Math.floor(totalErrors * 0.35)
    const remaining = totalErrors - timeoutCount
    errorsData.push({
      code: 'TIMEOUT',
      message: '请求超时（>10s）',
      errorType: 'system',
      count: timeoutCount,
      percentage: parseFloat((timeoutCount / totalErrors * 100).toFixed(1)),
    })

    // 各接口的业务错误，按 rpsWeight 比例分摊 remaining
    patterns.forEach(({ api, rpsWeight }) => {
      const bizErr = API_ERROR_CODES[api]
      if (!bizErr) return
      const count = Math.round(remaining * rpsWeight)
      if (count > 0) {
        errorsData.push({
          code: bizErr.code,
          message: bizErr.message,
          errorType: 'business',
          count,
          percentage: parseFloat((count / totalErrors * 100).toFixed(1)),
        })
      }
    })
  }

  return { percentiles, errors: errorsData }
}

export const executionHandlers: MockHandler[] = [
  {
    method: 'POST',
    url: '/executions',
    handler: ({ body }) => {
      const { taskId } = body as { taskId: string }
      const id = 'exec' + genId()
      const now = new Date().toISOString()

      // 从 mockTasks 查找任务配置
      const task = mockTasks.find(t => t.id === taskId)
      const scenarioConfig: ScenarioConfig = task?.scenarioConfig ?? {
        mode: 'step',
        duration: 120,
        steps: [{ concurrent: 100, duration: 100, rampTime: 20 }],
      }

      // 执行时快照：从 mockScripts 查最新 commitHash
      const scriptSnapshots = (task?.scripts || []).map(s => {
        const scriptData = mockScripts.find(ms => ms.id === s.scriptId)
        return {
          scriptId: s.scriptId,
          scriptName: s.scriptName,
          commitHash: scriptData?.commitHash || '',
          weight: s.weight,
        }
      })

      // 初始化步骤（pending 阶段）
      const initSteps = [
        { key: 'select_worker', label: '选定可用 Worker 节点', status: 'waiting' as const, detail: '' },
        { key: 'download_script', label: '下发脚本产物到 Worker', status: 'waiting' as const, detail: '' },
        { key: 'load_plugin', label: '加载脚本插件（plugin.Open）', status: 'waiting' as const, detail: '' },
        { key: 'inject_start', label: '开始注入流量', status: 'waiting' as const, detail: '' },
      ]

      const record: ExecutionRecord = {
        execution: {
          id,
          taskId,
          taskName: task?.name ?? '压测任务',
          status: 'pending',
          startTime: now,
          elapsedSeconds: 0,
          // 透传场景上下文
          scenarioMode: scenarioConfig.mode,
          targetRps: scenarioConfig.targetRps,
          scriptSnapshots,
          initSteps,
        },
        startTime: Date.now(),
        logOffset: 0,
        taskId,
        scenarioConfig,
      }
      executions.set(id, record)

      // 模拟初始化阶段：各步骤逐步完成，最终转 running
      const scriptNames = scriptSnapshots.map(s => `${s.scriptName}@${s.commitHash.slice(0, 8)}`)
      // 从在线节点中随机选取 2~3 台
      const onlineWorkers = mockWorkers.filter(w => w.status === 'online')
      const pickCount = Math.min(onlineWorkers.length, Math.floor(Math.random() * 2) + 2)
      const pickedWorkers = onlineWorkers.slice(0, pickCount)
      const workerItems = pickedWorkers.map(w => `${w.hostname}  ${w.ip}`)

      setTimeout(() => {
        const r = executions.get(id)
        if (!r || r.execution.status !== 'pending') return
        r.execution.initSteps![0] = { key: 'select_worker', label: '选定可用 Worker 节点', status: 'running', detail: '' }
      }, 200)
      setTimeout(() => {
        const r = executions.get(id)
        if (!r || r.execution.status !== 'pending') return
        r.execution.initSteps![0] = { key: 'select_worker', label: '选定可用 Worker 节点', status: 'done', detail: `已选定 ${pickedWorkers.length} 个节点`, items: workerItems }
        r.execution.initSteps![1] = { key: 'download_script', label: '下发脚本产物到 Worker', status: 'running', detail: '' }
      }, 700)
      setTimeout(() => {
        const r = executions.get(id)
        if (!r || r.execution.status !== 'pending') return
        r.execution.initSteps![1] = { key: 'download_script', label: '下发脚本产物到 Worker', status: 'done', detail: `${scriptNames.length} 个脚本`, items: scriptNames.length ? scriptNames : ['（无绑定脚本）'] }
        r.execution.initSteps![2] = { key: 'load_plugin', label: '加载脚本插件（plugin.Open）', status: 'running', detail: '' }
      }, 1400)
      setTimeout(() => {
        const r = executions.get(id)
        if (!r || r.execution.status !== 'pending') return
        r.execution.initSteps![2] = { key: 'load_plugin', label: '加载脚本插件（plugin.Open）', status: 'done', detail: '全部 Worker 加载成功' }
        r.execution.initSteps![3] = { key: 'inject_start', label: '开始注入流量', status: 'running', detail: '' }
      }, 2000)
      setTimeout(() => {
        const r = executions.get(id)
        if (!r || r.execution.status !== 'pending') return
        r.execution.initSteps![3] = { key: 'inject_start', label: '开始注入流量', status: 'done', detail: '' }
        r.execution.status = 'running'
        r.startTime = Date.now()  // running 计时从此刻开始
      }, 2500)

      // Auto-stop after duration (or 2 minutes max for demo)
      const stopAfter = Math.min((scenarioConfig.duration ?? 120) * 1000, 180000) + 2500
      setTimeout(() => {
        const r = executions.get(id)
        if (r && r.execution.status === 'running') {
          r.execution.status = 'success'
          r.execution.endTime = new Date().toISOString()
          // 关联对应 taskId 的 mock 报告，供前端自动跳转
          const report = mockReports.find(rp => rp.taskId === r.taskId) ?? mockReports[0]
          if (report) r.execution.reportId = report.id
        }
      }, stopAfter)

      return ok(record.execution)
    },
  },
  {
    method: 'GET',
    url: '/executions/:id',
    handler: ({ params }) => {
      const record = executions.get(params.id)
      if (!record) return fail('执行记录不存在', 404)
      if (record.execution.status === 'running') {
        record.execution.elapsedSeconds = getElapsed(record)
      }
      return ok(record.execution)
    },
  },
  {
    method: 'POST',
    url: '/executions/:id/stop',
    handler: ({ params }) => {
      const record = executions.get(params.id)
      if (!record) return fail('执行记录不存在', 404)
      record.execution.status = 'stopped'
      record.execution.endTime = new Date().toISOString()
      return ok(record.execution)
    },
  },
  {
    method: 'GET',
    url: '/executions/:id/metrics',
    handler: ({ params }) => {
      const record = executions.get(params.id)
      if (!record) return fail('执行记录不存在', 404)
      const elapsed = getElapsed(record)
      const config = record.scenarioConfig

      const summary: MetricsSummary = config.mode === 'rps'
        ? simulateRpsMetrics(elapsed, config)
        : simulateVuMetrics(elapsed, config)

      return ok(summary)
    },
  },
  {
    method: 'GET',
    url: '/executions/:id/logs',
    handler: ({ params }) => {
      const record = executions.get(params.id)
      if (!record) return ok([])
      const config = record.scenarioConfig
      const isRps = config.mode === 'rps'
      const pool = isRps ? getRpsLogMessages(config) : vuLogMessages

      const newLogs: LogEntry[] = []
      const count = Math.floor(Math.random() * 4) + 1
      for (let i = 0; i < count; i++) {
        const template = pool[Math.floor(Math.random() * pool.length)]
        newLogs.push({
          id: genId(),
          timestamp: new Date().toISOString(),
          level: template.level as LogEntry['level'],
          message: template.msg,
          source: isRps ? 'rate-ctrl-' + (Math.floor(Math.random() * 4) + 1) : 'worker-' + (Math.floor(Math.random() * 8) + 1),
        })
      }
      return ok(newLogs)
    },
  },
  // ── 接口维度实时指标 ──────────────────────────────────────────────────
  {
    method: 'GET',
    url: '/executions/:id/api-metrics',
    handler: ({ params }) => {
      const record = executions.get(params.id)
      if (!record) return fail('执行记录不存在', 404)
      if (record.execution.status !== 'running') return ok({ percentiles: [], errors: [] })
      return ok(generateApiMetrics(record))
    },
  },
  // ── 任务历史执行记录列表 ──────────────────────────────────────────────
  {
    method: 'GET',
    url: '/tasks/:taskId/executions',
    handler: ({ params, query }) => {
      const taskId = params.taskId
      const page = parseInt((query.page as string) || '1')
      const pageSize = parseInt((query.page_size as string) || '10')

      // 静态历史 + 当前内存中已完成的动态记录
      const dynamicFinished: ExecutionHistoryRecord[] = []
      executions.forEach((rec) => {
        if (rec.taskId === taskId && rec.execution.status !== 'running') {
          dynamicFinished.push({
            id: rec.execution.id,
            taskId: rec.taskId,
            status: rec.execution.status,
            triggerType: 1,
            triggeredByName: 'admin',
            startTime: rec.execution.startTime,
            endTime: rec.execution.endTime,
            durationSec: rec.execution.endTime && rec.execution.startTime
              ? Math.round((new Date(rec.execution.endTime).getTime() - new Date(rec.execution.startTime).getTime()) / 1000)
              : undefined,
          })
        }
      })

      const staticHistory = mockExecutionHistory.filter(e => e.taskId === taskId)
      const all = [...dynamicFinished, ...staticHistory]
        .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime())

      const start = (page - 1) * pageSize
      const list = all.slice(start, start + pageSize)
      return ok({ list, total: all.length, page, pageSize })
    },
  },
]
