import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExecutionState, ExecutionRecord, MetricPoint, MetricsSummary, LogEntry, ScenarioMode, PercentileData, ErrorData } from '@/types'
import request from '@/utils/request'
import { enrichPercentilesWithTargetRps } from '@/utils/apiTargetRps'
import { isActiveExecution } from '@/utils/execution'

const WINDOW_SIZE = 60
const LIVE_POLL_MS = 1000

function normalizeTimestamp(ts: number): number {
  // 后端时序为 Unix 秒，实时轮询为毫秒
  return ts < 1e12 ? ts * 1000 : ts
}

function normalizeChartPoints(points: MetricPoint[] = []): MetricPoint[] {
  return points.map(p => ({ timestamp: normalizeTimestamp(p.timestamp), value: p.value }))
}

// ── per-API 滑动窗口
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
  let preparedTimer: ReturnType<typeof setInterval> | null = null

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
        // prepared：等待用户 startRun，轮询以感知后端超时自动取消
        _stopInitPoller()
        _startPreparedPoller(executionState.id)
      } else if (executionState.status === 'running') {
        startTimers(executionState.id)
      } else {
        _stopInitPoller()
      }
      return executionState
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
      _stopPreparedPoller()
      startTimers(executionId)
      return res.data.data as ExecutionState
    } catch (e) {
      try {
        await fetchState(executionId)
      } catch {
        // ignore refresh failure
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function stopExecution() {
    if (!state.value) return
    const executionId = state.value.id
    await request.post(`/executions/${executionId}/stop`)
    stopTimers()
    // 刷新状态，获取最终状态和 reportId
    try {
      const res = await request.get(`/executions/${executionId}`)
      state.value = res.data.data
      await loadHistoricalCharts(executionId)
    } catch (e) {
      console.error('[execution] refresh after stop error', e)
    }
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
          // 部署完成，等用户手动 startRun
          _stopInitPoller()
          _startPreparedPoller(executionId)
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

  function _startPreparedPoller(executionId: string) {
    _stopPreparedPoller()
    preparedTimer = setInterval(async () => {
      try {
        const res = await request.get(`/executions/${executionId}`)
        const s: ExecutionState = res.data.data
        state.value = s
        if (s.status !== 'prepared') {
          _stopPreparedPoller()
        }
      } catch (e) {
        console.error('[execution] prepared poller error', e)
      }
    }, 5000)
  }

  function _stopPreparedPoller() {
    if (preparedTimer) { clearInterval(preparedTimer); preparedTimer = null }
  }

  function applyChartData(chart: {
    rpsData?: MetricPoint[]
    responseTimeData?: MetricPoint[]
    errorRateData?: MetricPoint[]
    concurrentData?: MetricPoint[]
  }): boolean {
    if (!chart.rpsData?.length) return false
    rpsData.value = normalizeChartPoints(chart.rpsData)
    responseTimeData.value = normalizeChartPoints(chart.responseTimeData ?? [])
    errorRateData.value = normalizeChartPoints(chart.errorRateData ?? [])
    concurrentData.value = normalizeChartPoints(chart.concurrentData ?? [])
    return true
  }

  function applyMetricsSnapshot(data: MetricsSummary) {
    const ts = Date.now()
    pushPoint(rpsData.value, { timestamp: ts, value: data.rps })
    pushPoint(responseTimeData.value, { timestamp: ts, value: data.avgResponseTime })
    pushPoint(errorRateData.value, { timestamp: ts, value: data.errorRate * 100 })
    pushPoint(concurrentData.value, { timestamp: ts, value: data.concurrent })
  }

  function mergeLivePoint(points: MetricPoint[], value: number, ts = Date.now()): MetricPoint[] {
    const next = [...points]
    const last = next[next.length - 1]
    // 与 1s 轮询对齐：1 秒内只更新最后一个点，避免曲线被刷得过密
    if (last && ts - last.timestamp < 1000) {
      next[next.length - 1] = { timestamp: ts, value }
    } else {
      next.push({ timestamp: ts, value })
      if (next.length > WINDOW_SIZE) next.shift()
    }
    return next
  }

  function applyLiveMetricsToCharts(
    chart: {
      rpsData?: MetricPoint[]
      responseTimeData?: MetricPoint[]
      errorRateData?: MetricPoint[]
      concurrentData?: MetricPoint[]
    },
    data: MetricsSummary,
  ) {
    const ts = Date.now()
    if (chart.rpsData?.length) {
      rpsData.value = mergeLivePoint(normalizeChartPoints(chart.rpsData), data.rps, ts)
      responseTimeData.value = mergeLivePoint(
        normalizeChartPoints(chart.responseTimeData ?? []),
        data.avgResponseTime,
        ts,
      )
      errorRateData.value = mergeLivePoint(
        normalizeChartPoints(chart.errorRateData ?? []),
        data.errorRate * 100,
        ts,
      )
      concurrentData.value = mergeLivePoint(
        normalizeChartPoints(chart.concurrentData ?? []),
        data.concurrent,
        ts,
      )
      return
    }
    if (data.rps > 0 || data.totalRequests > 0) {
      applyMetricsSnapshot(data)
    }
  }

  async function _pollLiveData(executionId: string) {
    try {
      const [metricsRes, chartRes, stateRes, apiRes] = await Promise.all([
        request.get(`/executions/${executionId}/metrics`),
        request.get(`/executions/${executionId}/chart-data`),
        request.get(`/executions/${executionId}`),
        request.get(`/executions/${executionId}/api-metrics`),
      ])

      const data = metricsRes.data.data
      summary.value = data
      state.value = stateRes.data.data

      const chart = chartRes.data.data
      applyLiveMetricsToCharts(chart, data)

      const { percentiles, errors } = apiRes.data.data as { percentiles: PercentileData[]; errors: ErrorData[] }
      _applyApiMetrics(percentiles, errors, percentiles.some(p => (p.rpsData?.length ?? 0) > 1))

      if (state.value!.status !== 'running') {
        stopTimers()
      }
    } catch (e) {
      console.error('[execution] poll live data error', e)
    }
  }

  async function loadHistoricalCharts(executionId: string) {
    try {
      const [metricsRes, chartRes, apiRes] = await Promise.all([
        request.get(`/executions/${executionId}/metrics`),
        request.get(`/executions/${executionId}/chart-data`),
        request.get(`/executions/${executionId}/api-metrics`),
      ])
      summary.value = metricsRes.data.data
      const chart = chartRes.data.data
      applyChartData(chart)
      const { percentiles, errors } = apiRes.data.data as { percentiles: PercentileData[]; errors: ErrorData[] }
      _applyApiMetrics(percentiles, errors, true)
    } catch (e) {
      console.error('[execution] load historical charts error', e)
    }
  }

  function _applyApiMetrics(percentiles: PercentileData[], errors: ErrorData[], fromHistory = false) {
    const elapsed = state.value?.elapsedSeconds || 0
    const globalTargetRps = targetRps.value || 0
    const snapshots = state.value?.scriptSnapshots || []

    const assembled: PercentileData[] = percentiles.map(p => {
      if (!fromHistory) {
        const rpsPoint   = p.rpsData?.[0]
        const rtPoint    = p.responseTimeData?.[0]
        const errPoint   = p.errorRateData?.[0]
        if (rpsPoint)  pushApiPoint(apiRpsWindows,  p.api, rpsPoint)
        if (rtPoint)   pushApiPoint(apiRtWindows,   p.api, rtPoint)
        if (errPoint)  pushApiPoint(apiErrWindows,  p.api, errPoint)
      }

      const rpsSeries = fromHistory
        ? normalizeChartPoints(p.rpsData)
        : [...(apiRpsWindows.get(p.api) ?? [])]
      const rtSeries = fromHistory
        ? normalizeChartPoints(p.responseTimeData)
        : [...(apiRtWindows.get(p.api) ?? [])]
      const errSeries = fromHistory
        ? normalizeChartPoints(p.errorRateData)
        : [...(apiErrWindows.get(p.api) ?? [])]

      return {
        ...p,
        rpsData:          rpsSeries,
        responseTimeData: rtSeries,
        errorRateData:    errSeries,
      }
    })

    livePercentiles.value = scenarioMode.value === 'rps'
      ? enrichPercentilesWithTargetRps(assembled, snapshots, globalTargetRps, elapsed)
      : assembled
    liveErrors.value = errors
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
    apiRpsWindows  = new Map()
    apiRtWindows   = new Map()
    apiErrWindows  = new Map()

    const poll = () => _pollLiveData(executionId)
    poll()
    metricsTimer = setInterval(poll, LIVE_POLL_MS)

    _pollLogs(executionId)
    logTimer = setInterval(() => _pollLogs(executionId), 2000)
  }

  function stopTimers() {
    _stopInitPoller()
    _stopPreparedPoller()
    if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null }
    if (logTimer) { clearInterval(logTimer); logTimer = null }
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

  /** 查询任务当前进行中的执行（部署中 / 待注入 / 注入中） */
  async function findActiveExecution(taskId: string): Promise<ExecutionRecord | null> {
    const res = await request.get(`/tasks/${taskId}/executions`, { params: { page: 1, pageSize: 10 } })
    const list = res.data.data.list as ExecutionRecord[]
    return list.find(r => isActiveExecution(r.status)) ?? null
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
    } else if (s.status === 'prepared') {
      _startPreparedPoller(executionId)
    } else if (s.status === 'success' || s.status === 'stopped' || s.status === 'circuit_broken' || s.status === 'failed') {
      await loadHistoricalCharts(executionId)
    }
  }

  return {
    state, summary, rpsData, responseTimeData, errorRateData, concurrentData, logs, loading,
    scenarioMode, targetRps, livePercentiles, liveErrors,
    startExecution, startRun, stopExecution, fetchState, findActiveExecution, resumeExecution, loadHistoricalCharts, startTimers, stopTimers, reset, clearCharts
  }
})
