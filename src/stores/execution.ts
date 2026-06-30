import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExecutionState, MetricPoint, MetricsSummary, LogEntry, ScenarioMode, PercentileData, ErrorData } from '@/types'
import request from '@/utils/request'

const WINDOW_SIZE = 60

// ── per-API 滑动窗口（模块级，跨轮询周期积累；startPolling 时初始化，stopPolling 时清理）
let apiRpsWindows  = new Map<string, MetricPoint[]>()
let apiRtWindows   = new Map<string, MetricPoint[]>()
let apiErrWindows  = new Map<string, MetricPoint[]>()

function pushApiPoint(map: Map<string, MetricPoint[]>, api: string, point: MetricPoint) {
  if (!map.has(api)) map.set(api, [])
  const arr = map.get(api)!
  arr.push(point)
  if (arr.length > WINDOW_SIZE) arr.shift()
}

export const useExecutionStore = defineStore('execution', () => {
  const state = ref<ExecutionState | null>(null)
  const summary = ref<MetricsSummary>({
    rps: 0,
    avgResponseTime: 0,
    p99ResponseTime: 0,
    errorRate: 0,
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    concurrent: 0,
  })
  const rpsData = ref<MetricPoint[]>([])
  const responseTimeData = ref<MetricPoint[]>([])
  const errorRateData = ref<MetricPoint[]>([])
  const concurrentData = ref<MetricPoint[]>([])
  const logs = ref<LogEntry[]>([])
  const loading = ref(false)
  const lastLogId = ref<string | undefined>(undefined)

  // 场景模式上下文（从 ExecutionState 透传）
  const scenarioMode = ref<ScenarioMode | undefined>(undefined)
  const targetRps = ref<number | undefined>(undefined)

  // 接口维度实时指标
  const livePercentiles = ref<PercentileData[]>([])
  const liveErrors = ref<ErrorData[]>([])

  let metricsTimer: ReturnType<typeof setInterval> | null = null
  let logTimer: ReturnType<typeof setInterval> | null = null
  let initTimer: ReturnType<typeof setInterval> | null = null

  function pushPoint(arr: MetricPoint[], point: MetricPoint) {
    arr.push(point)
    if (arr.length > WINDOW_SIZE) arr.shift()
  }

  async function startExecution(taskId: string) {
    loading.value = true
    try {
      const res = await request.post(`/executions`, { taskId })
      const executionState: ExecutionState = res.data.data
      state.value = executionState
      // 透传场景模式上下文
      scenarioMode.value = executionState.scenarioMode
      targetRps.value = executionState.targetRps
      clearCharts()

      if (executionState.status === 'pending' || executionState.status === 'preparing') {
        // pending/preparing 阶段：轮询初始化与脚本部署进度，等待转 prepared
        _startInitPoller(executionState.id)
      } else if (executionState.status === 'prepared') {
        // prepared：部署完成，等用户手动 startRun，不启动任何轮询
        _stopInitPoller()
      } else {
        // 直接 running（理论上不会，但保留兼容）
        startTimers(executionState.id)
      }
    } finally {
      loading.value = false
    }
  }

  // 手动触发已部署（prepared）的执行开始压测
  async function startRun(executionId: string) {
    loading.value = true
    try {
      const res = await request.post(`/executions/${executionId}/start`)
      state.value = res.data.data
      // 转入 running，启动指标/日志轮询
      startTimers(executionId)
    } finally {
      loading.value = false
    }
  }

  async function stopExecution() {
    if (!state.value) return
    await request.post(`/executions/${state.value.id}/stop`)
    stopTimers()
  }

  async function fetchState(executionId: string) {
    const res = await request.get(`/executions/${executionId}`)
    state.value = res.data.data
    return res.data.data as ExecutionState
  }

  function _startInitPoller(executionId: string) {
    _stopInitPoller()
    initTimer = setInterval(async () => {
      try {
        const res = await request.get(`/executions/${executionId}`)
        const s: ExecutionState = res.data.data
        state.value = s

        // 检查是否有脚本部署失败
        const hasFailedScript = s.scriptStatuses?.some(sc => sc.status === 'failed')

        if (s.status === 'running') {
          // 后端直接转 running（兼容旧流程）
          _stopInitPoller()
          startTimers(executionId)
        } else if (s.status === 'prepared') {
          // 部署完成，等用户手动 startRun，停止轮询
          _stopInitPoller()
        } else if (s.status === 'failed' || hasFailedScript) {
          // 部署失败，停止轮询
          _stopInitPoller()
        } else if (s.status !== 'pending' && s.status !== 'preparing') {
          // stopped / circuit_broken during init
          _stopInitPoller()
        }
      } catch (e) {
        console.error('[execution] init poller error', e)
      }
    }, 500)
  }

  function _stopInitPoller() {
    if (initTimer) { clearInterval(initTimer); initTimer = null }
  }

  async function _pollMetrics(executionId: string) {
    try {
      const res = await request.get(`/executions/${executionId}/metrics`)
      const data = res.data.data
      const ts = Date.now()
      pushPoint(rpsData.value, { timestamp: ts, value: data.rps })
      pushPoint(responseTimeData.value, { timestamp: ts, value: data.avgResponseTime })
      pushPoint(errorRateData.value, { timestamp: ts, value: data.errorRate * 100 })
      pushPoint(concurrentData.value, { timestamp: ts, value: data.concurrent })
      summary.value = data
      // refresh state
      const stateRes = await request.get(`/executions/${executionId}`)
      state.value = stateRes.data.data
      if (state.value!.status !== 'running') {
        stopTimers()
      }
    } catch (e) {
      console.error('[execution] poll metrics error', e)
    }
  }

  async function _pollApiMetrics(executionId: string) {
    try {
      const res = await request.get(`/executions/${executionId}/api-metrics`)
      const { percentiles, errors } = res.data.data as { percentiles: PercentileData[]; errors: ErrorData[] }

      // 将每个接口的当前点推入滑动窗口，并组装完整时序
      const assembled: PercentileData[] = percentiles.map(p => {
        const rpsPoint   = p.rpsData?.[0]
        const rtPoint    = p.responseTimeData?.[0]
        const errPoint   = p.errorRateData?.[0]

        if (rpsPoint)  pushApiPoint(apiRpsWindows,  p.api, rpsPoint)
        if (rtPoint)   pushApiPoint(apiRtWindows,   p.api, rtPoint)
        if (errPoint)  pushApiPoint(apiErrWindows,  p.api, errPoint)

        return {
          ...p,
          rpsData:          [...(apiRpsWindows.get(p.api)  ?? [])],
          responseTimeData: [...(apiRtWindows.get(p.api)   ?? [])],
          errorRateData:    [...(apiErrWindows.get(p.api)  ?? [])],
        }
      })

      livePercentiles.value = assembled
      liveErrors.value = errors
    } catch (e) {
      console.error('[execution] poll api-metrics error', e)
    }
  }

  async function _pollLogs(executionId: string) {
    try {
      const res = await request.get(`/executions/${executionId}/logs`, {
        params: { last_id: lastLogId.value }
      })
      const newLogs: LogEntry[] = res.data.data
      if (newLogs.length) {
        lastLogId.value = newLogs[newLogs.length - 1].id
        logs.value = [...logs.value, ...newLogs].slice(-500)
      }
    } catch (e) {
      console.error('[execution] poll logs error', e)
    }
  }

  function startTimers(executionId: string) {
    stopTimers()
    // 初始化 per-API 滑动窗口
    apiRpsWindows  = new Map()
    apiRtWindows   = new Map()
    apiErrWindows  = new Map()
    _pollMetrics(executionId)
    _pollApiMetrics(executionId)
    _pollLogs(executionId)
    metricsTimer = setInterval(() => {
      _pollMetrics(executionId)
      _pollApiMetrics(executionId)
    }, 2000)
    logTimer = setInterval(() => _pollLogs(executionId), 1500)
  }

  function stopTimers() {
    _stopInitPoller()
    if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null }
    if (logTimer) { clearInterval(logTimer); logTimer = null }
    // 清理 per-API 滑动窗口
    apiRpsWindows.clear()
    apiRtWindows.clear()
    apiErrWindows.clear()
  }

  function clearCharts() {
    rpsData.value = []
    responseTimeData.value = []
    errorRateData.value = []
    concurrentData.value = []
    logs.value = []
    lastLogId.value = undefined
    livePercentiles.value = []
    liveErrors.value = []
  }

  function reset() {
    stopTimers()
    state.value = null
    scenarioMode.value = undefined
    targetRps.value = undefined
    clearCharts()
    summary.value = { rps: 0, avgResponseTime: 0, p99ResponseTime: 0, errorRate: 0, totalRequests: 0, successRequests: 0, failedRequests: 0, concurrent: 0 }
  }

  // 从执行 ID 恢复：刷新页面时重连到已有执行，不清空历史数据
  async function resumeExecution(executionId: string) {
    const s = await fetchState(executionId)
    scenarioMode.value = s.scenarioMode
    targetRps.value = s.targetRps
    if (s.status === 'running') {
      startTimers(executionId)
    } else if (s.status === 'pending' || s.status === 'preparing') {
      _startInitPoller(executionId)
    }
    // prepared / success / failed / stopped：仅展示终态/待执行态，不启动轮询
  }

  return {
    state, summary, rpsData, responseTimeData, errorRateData, concurrentData, logs, loading,
    scenarioMode, targetRps, livePercentiles, liveErrors,
    startExecution, startRun, stopExecution, fetchState, resumeExecution, startTimers, stopTimers, reset, clearCharts
  }
})
