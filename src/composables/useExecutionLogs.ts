import { ref } from 'vue'
import request from '@/utils/request'
import type { ExecutionLogsResponse, LogEntry } from '@/types'

const HISTORICAL_PAGE_SIZE = 200
const HISTORICAL_MAX_LOGS = 5000

export async function fetchAllExecutionLogs(executionId: string, level = '', workerId = '') {
  let lastId: string | undefined
  const collected: LogEntry[] = []
  let dropped = 0

  for (;;) {
    const params: Record<string, string> = {}
    if (lastId) params.last_id = lastId
    if (level) params.level = level
    if (workerId) params.worker_id = workerId

    const res = await request.get(`/executions/${executionId}/logs`, { params })
    const payload = res.data.data as ExecutionLogsResponse
    dropped = payload.droppedLogs ?? dropped
    const batch = payload.logs ?? []
    if (!batch.length) break

    collected.push(...batch)
    lastId = batch[batch.length - 1].id
    if (batch.length < HISTORICAL_PAGE_SIZE || collected.length >= HISTORICAL_MAX_LOGS) break
  }

  return {
    logs: collected.slice(-HISTORICAL_MAX_LOGS),
    droppedLogs: dropped,
    lastId,
  }
}

export function useExecutionLogs() {
  const logs = ref<LogEntry[]>([])
  const droppedLogs = ref(0)
  const logLevelFilter = ref('')
  const logWorkerFilter = ref('')
  const loading = ref(false)

  function clearLogs() {
    logs.value = []
    droppedLogs.value = 0
  }

  async function loadHistoricalLogs(executionId: string) {
    if (!executionId) return
    loading.value = true
    clearLogs()
    try {
      const result = await fetchAllExecutionLogs(executionId, logLevelFilter.value, logWorkerFilter.value)
      logs.value = result.logs
      droppedLogs.value = result.droppedLogs
    } catch (e) {
      console.error('[execution-logs] load historical error', e)
    } finally {
      loading.value = false
    }
  }

  async function setLogLevelFilter(executionId: string, level: string) {
    logLevelFilter.value = level
    await loadHistoricalLogs(executionId)
  }

  async function setLogWorkerFilter(executionId: string, workerId: string) {
    logWorkerFilter.value = workerId
    await loadHistoricalLogs(executionId)
  }

  return {
    logs,
    droppedLogs,
    logLevelFilter,
    logWorkerFilter,
    loading,
    clearLogs,
    loadHistoricalLogs,
    setLogLevelFilter,
    setLogWorkerFilter,
  }
}
