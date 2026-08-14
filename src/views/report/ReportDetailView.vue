<template>
  <div class="report-detail-view">
    <PageHeader
      :title="report?.taskName || '报告详情'"
      :back="true"
    >
      <el-button
        v-if="report?.taskId"
        size="small"
        @click="goTask"
      >
        查看任务
      </el-button>
      <StatusBadge v-if="report" :status="report.status" />
      <!-- 场景模式 Tag -->
      <el-tag
        v-if="report?.scenarioMode === 'rps'"
        type="info"
        size="small"
        class="mode-tag mode-tag--rps"
      >RPS 模式</el-tag>
      <el-tag
        v-else-if="report"
        type="primary"
        size="small"
        class="mode-tag"
      >VU 阶梯</el-tag>
      <span v-if="report" class="report-time">
        {{ formatTime(report.startTime) }} — {{ formatTime(report.endTime) }}
      </span>
    </PageHeader>

    <div v-if="loading" v-loading="true" style="height: 400px" />
    <template v-else-if="report">
      <el-alert
        v-if="terminationAlert"
        class="report-termination-alert"
        :title="terminationAlert.title"
        :type="terminationAlert.type"
        :description="terminationAlert.description"
        show-icon
        :closable="false"
      />

      <el-tabs v-model="reportTab" class="report-tabs">
        <!-- ── Tab 1：压测结果（主阅读路径） ── -->
        <el-tab-pane label="压测结果" name="results">
          <StressReportResults
            v-if="report"
            :report="report"
            :show-verdict="false"
            v-model:selected-api="selectedApiName"
          />
        </el-tab-pane>

        <!-- ── Tab 2：接口对比（多接口时横向对比，与压测结果下钻分离） ── -->
        <el-tab-pane v-if="hasApiComparison" label="接口对比" name="comparison">
          <div class="section-card section-card--tab">
            <div class="section-card__header">
              <div class="section-card__title">接口对比</div>
              <span class="section-card__subtitle">汇总各接口请求量、RPS 与分位数；点击行跳转至「压测结果」查看该接口趋势</span>
            </div>
            <el-table
              ref="percentileTableRef"
              :data="report.percentiles"
              stripe
              highlight-current-row
              class="comparison-table"
              @row-click="openApiFromComparison"
            >
              <el-table-column label="接口" prop="api" min-width="200" />
              <el-table-column label="脚本" prop="scriptName" width="120" />
              <el-table-column label="请求数" prop="requests" width="100">
                <template #default="{ row }">{{ formatNumber(row.requests, 0) }}</template>
              </el-table-column>
              <el-table-column width="110">
                <template #header>
                  <span>峰值 RPS</span>
                  <el-tooltip content="稳态区间（排除爬坡）内有流量的秒的 P95 瞬时 RPS" placement="top">
                    <el-icon style="margin-left: 4px; vertical-align: -2px; color: #9c9fa3; cursor: help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </template>
                <template #default="{ row }">{{ row.peakRps ? row.peakRps.toFixed(1) : '-' }}</template>
              </el-table-column>
              <el-table-column width="110">
                <template #header>
                  <span>平均 RPS</span>
                  <el-tooltip content="稳态区间均值（排除爬坡段）" placement="top">
                    <el-icon style="margin-left: 4px; vertical-align: -2px; color: #9c9fa3; cursor: help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </template>
                <template #default="{ row }">{{ (row.steadyAvgRps ?? row.avgRps ?? row.actualRps) ? (row.steadyAvgRps ?? row.avgRps ?? row.actualRps)!.toFixed(1) : '-' }}</template>
              </el-table-column>
              <el-table-column v-if="report.scenarioMode === 'rps'" width="110">
                <template #header>
                  <span>目标 RPS</span>
                  <el-tooltip
                    content="脚本目标 = 全局目标 × 权重占比；接口目标 = 脚本目标 ×（该接口请求数 / 脚本内最大请求数），链路主路径接口目标接近脚本迭代 RPS"
                    placement="top"
                  >
                    <el-icon style="margin-left: 4px; vertical-align: -2px; color: #9c9fa3; cursor: help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </template>
                <template #default="{ row }">{{ row.targetRps ? row.targetRps.toFixed(1) : '-' }}</template>
              </el-table-column>
              <el-table-column v-if="report.scenarioMode === 'rps'" width="100">
                <template #header>
                  <span>相差</span>
                  <el-tooltip content="目标 RPS − 平均 RPS（稳态均值）。达成度以平均值为准：峰值是 P95 分位，天然高于均值约 1~2%" placement="top">
                    <el-icon style="margin-left: 4px; vertical-align: -2px; color: #9c9fa3; cursor: help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </template>
                <template #default="{ row }">
                  <span v-if="row.rpsGap !== undefined" :style="{ color: row.rpsGap > 0 ? '#e54545' : row.rpsGap < 0 ? '#00a870' : '#86909c' }">
                    {{ row.rpsGap > 0 ? '-' : '+' }}{{ Math.abs(row.rpsGap).toFixed(1) }}
                    ({{ Math.abs(row.rpsGapPercent).toFixed(1) }}%)
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="错误数" prop="errors" width="90">
                <template #default="{ row }">
                  <span :style="{ color: row.errors > 0 ? '#e54545' : '#86909c' }">
                    {{ formatNumber(row.errors, 0) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="错误率" prop="errorRate" width="90">
                <template #default="{ row }">
                  <span :class="errorRateClass(row.errorRate)">
                    {{ formatPercent(row.errorRate) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="P50" prop="p50" width="75">
                <template #default="{ row }">{{ formatMs(row.p50) }}</template>
              </el-table-column>
              <el-table-column label="P90" prop="p90" width="75">
                <template #default="{ row }">{{ formatMs(row.p90) }}</template>
              </el-table-column>
              <el-table-column label="P99" prop="p99" width="80">
                <template #default="{ row }">
                  <span :style="{ color: row.p99 > 1000 ? '#e54545' : row.p99 > 500 ? '#ff9c19' : '#00a870' }">
                    {{ formatMs(row.p99) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="最大" prop="max" width="80">
                <template #default="{ row }">{{ formatMs(row.max) }}</template>
              </el-table-column>
              <el-table-column label="最小" prop="min" width="75">
                <template #default="{ row }">{{ formatMs(row.min) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- ── Tab 3：执行环境（配置与部署，附录性质） ── -->
        <el-tab-pane v-if="hasExecutionMeta" label="执行环境" name="environment">
          <section class="exec-info exec-info--tab">
            <div class="exec-info__header">
              <p class="exec-info__desc">本次压测的节点、脚本版本与部署状态，用于复现与审计。</p>
              <span class="exec-info__summary">{{ deploySummaryText }}</span>
            </div>

            <div class="exec-info__overview">
              <div class="exec-info__fact">
                <span class="exec-info__fact-label">执行 ID</span>
                <code class="exec-info__fact-value exec-info__fact-value--mono">{{ report.executionId }}</code>
              </div>
              <div class="exec-info__fact">
                <span class="exec-info__fact-label">报告 ID</span>
                <code class="exec-info__fact-value exec-info__fact-value--mono">{{ report.id }}</code>
              </div>
              <div class="exec-info__fact">
                <span class="exec-info__fact-label">场景模式</span>
                <span class="exec-info__fact-value">{{ scenarioModeLabel }}</span>
              </div>
              <div v-if="report.scenarioMode === 'rps' && report.targetRps" class="exec-info__fact">
                <span class="exec-info__fact-label">目标 RPS</span>
                <span class="exec-info__fact-value">{{ formatNumber(report.targetRps, 0) }} req/s</span>
              </div>
              <div class="exec-info__fact">
                <span class="exec-info__fact-label">持续时长</span>
                <span class="exec-info__fact-value">{{ formatDuration(report.duration) }}</span>
              </div>
              <div class="exec-info__fact">
                <span class="exec-info__fact-label">压测时段</span>
                <span class="exec-info__fact-value">{{ formatTime(report.startTime) }} — {{ formatTime(report.endTime) }}</span>
              </div>
            </div>

            <div class="exec-info__layout">
              <div v-if="report.workerSnapshots?.length" class="exec-info__block">
                <div class="exec-info__block-title">参与节点（{{ report.workerSnapshots.length }}）</div>
                <el-table :data="report.workerSnapshots" size="small" class="exec-info__table">
                  <el-table-column label="节点地址" min-width="160">
                    <template #default="{ row }">
                      <code class="exec-info__mono">{{ row.ip }}</code>
                    </template>
                  </el-table-column>
                  <el-table-column label="主机名" min-width="120" prop="hostname" show-overflow-tooltip />
                  <el-table-column label="CPU" width="72" align="center">
                    <template #default="{ row }">{{ row.cpuCores }} 核</template>
                  </el-table-column>
                  <el-table-column label="内存" width="88" align="center">
                    <template #default="{ row }">{{ row.memTotalGb?.toFixed(1) || '?' }} GB</template>
                  </el-table-column>
                  <el-table-column label="最大并发" width="96" align="center" prop="maxConcurrency" />
                </el-table>
              </div>

              <div v-if="scriptDeployViews.length" class="exec-info__block">
                <div class="exec-info__block-title">脚本与部署（{{ scriptDeployViews.length }}）</div>
                <div class="exec-script-list">
                  <div
                    v-for="s in scriptDeployViews"
                    :key="s.scriptId"
                    class="exec-script-card"
                    :class="s.status ? `exec-script-card--${s.status}` : ''"
                  >
                    <div class="exec-script-card__head">
                      <div class="exec-script-card__title-row">
                        <code class="exec-script-card__name">{{ s.scriptName }}</code>
                        <el-tag v-if="s.weight > 0" size="small" type="info" effect="plain">
                          权重 {{ scriptWeightLabel(s.weight) }}
                        </el-tag>
                        <el-tag
                          v-if="s.status"
                          size="small"
                          :type="deployTagType(s.status)"
                          effect="plain"
                        >
                          {{ scriptDeployStatusLabel(s.status) }}
                        </el-tag>
                      </div>
                      <div class="exec-script-card__meta">
                        <span class="exec-script-card__meta-item">
                          <span class="exec-script-card__meta-label">Commit</span>
                          <code>{{ s.commitHash ? s.commitHash.slice(0, 8) : '—' }}</code>
                        </span>
                        <span v-if="s.artifactUrl" class="exec-script-card__meta-item">
                          <span class="exec-script-card__meta-label">Artifact</span>
                          <code class="exec-script-card__artifact">{{ s.artifactUrl }}</code>
                        </span>
                      </div>
                      <el-alert
                        v-if="s.error"
                        type="error"
                        show-icon
                        :closable="false"
                        class="exec-script-card__alert"
                        :title="formatDeployError(s.error).title"
                        :description="formatDeployError(s.error).description"
                      />
                    </div>

                    <div v-if="s.workers?.length" class="exec-script-card__workers">
                      <div class="exec-script-card__workers-title">节点部署（{{ s.workers.length }}）</div>
                      <el-table :data="s.workers" size="small" class="exec-info__table exec-info__table--nested">
                        <el-table-column label="Worker 地址" min-width="180">
                          <template #default="{ row }">
                            <code class="exec-info__mono">{{ row.addr }}</code>
                          </template>
                        </el-table-column>
                        <el-table-column label="部署状态" width="110" align="center">
                          <template #default="{ row }">
                            <el-tag size="small" :type="deployTagType(row.status)" effect="plain">
                              {{ scriptDeployStatusLabel(row.status) }}
                            </el-tag>
                          </template>
                        </el-table-column>
                        <el-table-column label="错误信息" min-width="260">
                          <template #default="{ row }">
                            <el-alert
                              v-if="row.error"
                              type="error"
                              show-icon
                              :closable="false"
                              class="exec-script-card__alert"
                              :title="formatDeployError(row.error).title"
                              :description="formatDeployError(row.error).description"
                            />
                            <span v-else class="exec-info__muted">—</span>
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </el-tab-pane>

        <el-tab-pane label="执行日志" name="logs">
          <ExecutionLogPanel
            :logs="reportLogs"
            :dropped-logs="reportDroppedLogs"
            :level-filter="reportLogLevelFilter"
            :worker-filter="reportLogWorkerFilter"
            :workers="report?.workerSnapshots ?? []"
            :loading="reportLogsLoading"
            title="执行日志"
            height="480px"
            empty-text="本次压测未产生脚本日志，或日志已过期（保留 7 天）"
            @update:level-filter="onReportLogLevelChange"
            @update:worker-filter="onReportLogWorkerChange"
            @clear="clearReportLogs"
          />
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ExecutionLogPanel from '@/components/execution/ExecutionLogPanel.vue'
import StressReportResults from '@/components/report/StressReportResults.vue'
import { useExecutionLogs } from '@/composables/useExecutionLogs'
import { formatNumber, formatMs, formatPercent, formatTime, formatDuration } from '@/utils/format'
import { enrichPercentilesWithTargetRps } from '@/utils/apiTargetRps'
import { formatDeployError } from '@/utils/execution'
import type { PercentileData, ScriptStatus, ScriptStatusInfo } from '@/types'

const route = useRoute()
const router = useRouter()
const reportStore = useReportStore()

const reportId = computed(() => route.params.id as string)
const loading = ref(false)
const report = computed(() => reportStore.currentReport)
// 查看范围：空=全局汇总，非空=指定接口（驱动指标卡与趋势图）
const selectedApiName = ref('')
const percentileTableRef = ref<{ setCurrentRow: (row: PercentileData | null) => void } | null>(null)
const reportTab = ref<'results' | 'comparison' | 'environment' | 'logs'>('results')

const hasApiComparison = computed(() => (report.value?.percentiles.length ?? 0) > 1)

const {
  logs: reportLogs,
  droppedLogs: reportDroppedLogs,
  logLevelFilter: reportLogLevelFilter,
  logWorkerFilter: reportLogWorkerFilter,
  loading: reportLogsLoading,
  clearLogs: clearReportLogs,
  loadHistoricalLogs,
  setLogLevelFilter,
  setLogWorkerFilter,
} = useExecutionLogs()

interface ScriptDeployView {
  scriptId: string
  scriptName: string
  commitHash: string
  weight: number
  artifactUrl?: string
  status?: ScriptStatus
  error?: string
  workers?: ScriptStatusInfo['workers']
}

const hasExecutionMeta = computed(() => {
  const r = report.value
  if (!r) return false
  return !!(r.scriptSnapshots?.length || r.workerSnapshots?.length || r.scriptStatuses?.length)
})

const scriptDeployViews = computed<ScriptDeployView[]>(() => {
  const r = report.value
  if (!r) return []
  const statusMap = new Map((r.scriptStatuses || []).map(s => [s.scriptId, s]))
  if (r.scriptSnapshots?.length) {
    return r.scriptSnapshots.map(s => {
      const st = statusMap.get(s.scriptId)
      return {
        scriptId: s.scriptId,
        scriptName: s.scriptName,
        commitHash: s.commitHash,
        weight: s.weight,
        artifactUrl: st?.artifactUrl,
        status: st?.status,
        error: st?.error,
        workers: st?.workers,
      }
    })
  }
  return (r.scriptStatuses || []).map(s => ({
    scriptId: s.scriptId,
    scriptName: s.scriptName,
    commitHash: s.commitHash,
    weight: 0,
    artifactUrl: s.artifactUrl,
    status: s.status,
    error: s.error,
    workers: s.workers,
  }))
})

const deploySummaryText = computed(() => {
  const views = scriptDeployViews.value
  const workerCount = report.value?.workerSnapshots?.length ?? 0
  if (!views.length) {
    return workerCount > 0 ? `${workerCount} 个节点` : ''
  }
  const ready = views.filter(s => s.status === 'ready').length
  const failed = views.filter(s => s.status === 'failed').length
  const parts = [`${views.length} 个脚本`, `${ready}/${views.length} 已就绪`]
  if (workerCount > 0) parts.push(`${workerCount} 个节点`)
  if (failed > 0) parts.push(`${failed} 个失败`)
  return parts.join(' · ')
})

const scenarioModeLabel = computed(() =>
  report.value?.scenarioMode === 'rps' ? 'RPS 定速' : 'VU 阶梯',
)

const terminationAlert = computed(() => {
  const r = report.value
  if (!r) return null
  if (r.status === 'circuit_broken') {
    return {
      type: 'error' as const,
      title: '熔断停止',
      description: r.errorMsg || '压测因错误率超过熔断阈值而自动停止，请查看下方错误分析。',
    }
  }
  if (r.status === 'failed') {
    return {
      type: 'error' as const,
      title: '执行失败',
      description: r.errorMsg || '压测执行失败，请查看错误分析。',
    }
  }
  if (r.status === 'stopped' && r.errorMsg) {
    return {
      type: 'warning' as const,
      title: '手动停止',
      description: r.errorMsg,
    }
  }
  return null
})

onMounted(async () => {
  loading.value = true
  try {
    await reportStore.fetchById(reportId.value)
    // 从 URL query 恢复上次选中的接口（刷新保持状态）
    const apiFromQuery = route.query.api as string | undefined
    if (apiFromQuery && report.value?.percentiles.some(p => p.api === apiFromQuery)) {
      selectedApiName.value = apiFromQuery
    }
    await nextTick()
    const tabFromQuery = route.query.tab as string | undefined
    if (tabFromQuery === 'comparison' && hasApiComparison.value) {
      reportTab.value = 'comparison'
      await nextTick()
      syncComparisonTableHighlight()
    } else if (tabFromQuery === 'environment' && hasExecutionMeta.value) {
      reportTab.value = 'environment'
    } else if (tabFromQuery === 'logs') {
      reportTab.value = 'logs'
    }
    if (report.value?.executionId) {
      await loadHistoricalLogs(report.value.executionId)
    }
  } finally {
    loading.value = false
  }
})

async function onReportLogLevelChange(level: string) {
  if (!report.value?.executionId) return
  await setLogLevelFilter(report.value.executionId, level ?? '')
}

async function onReportLogWorkerChange(workerId: string) {
  if (!report.value?.executionId) return
  await setLogWorkerFilter(report.value.executionId, workerId ?? '')
}

watch(reportTab, (tab) => {
  const query = { ...route.query }
  if (tab === 'comparison') {
    query.tab = 'comparison'
    nextTick(() => syncComparisonTableHighlight())
  } else if (tab === 'environment') {
    query.tab = 'environment'
  } else if (tab === 'logs') {
    query.tab = 'logs'
    if (report.value?.executionId && reportLogs.value.length === 0 && !reportLogsLoading.value) {
      loadHistoricalLogs(report.value.executionId)
    }
  } else {
    delete query.tab
  }
  router.replace({ query })
})

// 计算接口维度的目标 RPS vs 实际 RPS（仅 RPS 模式）
watch(report, (r) => {
  if (!r || !r.percentiles.length) return
  if (r.scenarioMode !== 'rps') return

  const duration = r.duration || 0
  const globalTargetRps = r.targetRps || 0
  if (duration <= 0 && globalTargetRps <= 0) return

  r.percentiles = enrichPercentilesWithTargetRps(
    r.percentiles,
    r.scriptSnapshots || [],
    globalTargetRps,
    duration,
  )
}, { immediate: true })

function syncComparisonTableHighlight() {
  const table = percentileTableRef.value
  if (!table || !report.value) return
  const row = selectedApiName.value
    ? report.value.percentiles.find(p => p.api === selectedApiName.value) ?? null
    : null
  table.setCurrentRow(row)
}

function openApiFromComparison(row: PercentileData) {
  selectedApiName.value = row.api
  reportTab.value = 'results'
}

watch(selectedApiName, (name) => {
  router.replace({ query: { ...route.query, api: name || undefined } })
})

function goTask() {
  const taskId = report.value?.taskId
  if (!taskId) return
  router.push({ path: `/task/${taskId}`, query: { tab: 'history' } })
}

function errorRateClass(rate: number) {
  if (rate >= 0.05) return 'err-rate--high'
  if (rate >= 0.01) return 'err-rate--mid'
  return 'err-rate--low'
}

function scriptDeployStatusLabel(status: ScriptStatus): string {
  const map: Record<ScriptStatus, string> = {
    pending: '等待中',
    downloading: '部署中',
    ready: '已就绪',
    failed: '部署失败',
  }
  return map[status] || status
}

function deployTagType(status?: ScriptStatus): 'success' | 'danger' | 'warning' | 'info' {
  switch (status) {
    case 'ready': return 'success'
    case 'failed': return 'danger'
    case 'downloading': return 'warning'
    default: return 'info'
  }
}

function scriptWeightLabel(weight: number): string {
  const views = scriptDeployViews.value
  const total = views.reduce((sum, s) => sum + s.weight, 0)
  if (total <= 0) return String(weight)
  return `${Math.round((weight / total) * 100)}%`
}

</script>

<style lang="scss" scoped>
.report-detail-view {
  max-width: 1400px;
}

.report-termination-alert {
  margin-bottom: 16px;
}

.report-time {
  font-size: 13px;
  color: $text-secondary;
}

.report-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 16px;
  }

  :deep(.el-tabs__item) {
    font-size: 14px;
    font-weight: 500;
  }

  :deep(.el-tabs__content) {
    overflow: visible;
  }
}

// 场景模式 Tag
.mode-tag {
  font-size: 12px;

  &--rps {
    background: rgba(114, 46, 209, 0.1) !important;
    border-color: rgba(114, 46, 209, 0.35) !important;
    color: #722ed1 !important;
  }
}

.api-selector-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;

  &__label {
    font-size: 14px;
    color: $text-secondary;
    flex-shrink: 0;
  }

  &__hint {
    font-size: 12px;
    color: $text-placeholder;
  }
}

.chart-scope-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: rgba(56, 113, 220, 0.06);
  border-radius: $border-radius;
  border: 1px solid rgba(56, 113, 220, 0.15);

  &__label {
    font-size: 12px;
    color: $text-secondary;
  }

  &__api {
    font-size: 12px;
    color: #3871dc;
    background: rgba(56, 113, 220, 0.08);
    padding: 2px 8px;
    border-radius: 4px;
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;

  @include breakpoint('md') {
    grid-template-columns: repeat(2, 1fr);
  }
}

// RPS 达成率颜色编码
:deep(.achievement--good .metric-card__value) { color: $color-success; }
:deep(.achievement--warn .metric-card__value) { color: $color-warning; }
:deep(.achievement--bad .metric-card__value)  { color: $color-danger; }

// 接口错误率颜色编码
.err-rate--high { color: $color-danger;  font-weight: 600; }
.err-rate--mid  { color: $color-warning; font-weight: 600; }
.err-rate--low  { color: $color-success; }

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;

  &--single {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 16px;
  box-shadow: $shadow-sm;
  border: 1px solid $border-color-light;

  &__title {
    font-size: 13px;
    color: $text-secondary;
    margin-bottom: 8px;
    font-weight: 500;
  }
}

.section-card {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px;
  box-shadow: $shadow-sm;
  margin-bottom: 16px;

  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 0;
  }

  &__subtitle {
    font-size: 12px;
    color: $text-placeholder;
  }

  &--tab {
    margin-bottom: 0;
  }
}

.comparison-table {
  :deep(.el-table__row) {
    cursor: pointer;
  }
}

.error-analysis {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  align-items: start;
}

.error-stop-reason {
  margin-bottom: 16px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: $text-primary;
  background: rgba(224, 34, 110, 0.06);
  border: 1px solid rgba(224, 34, 110, 0.18);
  border-radius: $border-radius-sm;
}

.error-code {
  font-size: 12px;
  background: $bg-page;
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.error-chart {
  background: $bg-page;
  border-radius: $border-radius-sm;
}

.snapshot-card {
  margin-bottom: 16px;
}

// 执行信息
.exec-info {
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: $shadow-sm;

  &--tab {
    margin-bottom: 0;
  }

  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 16px;
  }

  &__desc {
    margin: 0;
    font-size: 13px;
    color: $text-secondary;
    flex: 1 1 280px;
  }

  &__summary {
    font-size: 13px;
    color: $text-secondary;
    font-variant-numeric: tabular-nums;
  }

  &__overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px 24px;
    padding: 14px 16px;
    margin-bottom: 20px;
    background: $bg-page;
    border-radius: $border-radius-sm;
  }

  &__fact {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__fact-label {
    font-size: 11px;
    font-weight: 600;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__fact-value {
    font-size: 13px;
    color: $text-primary;
    word-break: break-all;

    &--mono {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
    }
  }

  &__block {
    min-width: 0;

    & + & {
      margin-top: 20px;
    }
  }

  &__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 24px;
    align-items: start;

    @include breakpoint('lg') {
      grid-template-columns: 1fr;
    }

    .exec-info__block + .exec-info__block {
      margin-top: 0;
    }
  }

  &__block-title {
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 10px;
  }

  &__table {
    width: 100%;

    :deep(.el-table__header th) {
      background: $bg-page;
      font-size: 12px;
      color: $text-secondary;
    }

    &--nested {
      :deep(.el-table__header th) {
        background: #fff;
      }
    }
  }

  &__mono {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    color: $text-primary;
  }

  &__muted {
    color: $text-secondary;
    font-size: 12px;
  }
}

.exec-script-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exec-script-card {
  border: 1px solid $border-color-light;
  border-radius: $border-radius-sm;
  overflow: hidden;
  border-left-width: 3px;
  border-left-color: $border-color-light;

  &--ready { border-left-color: $color-success; }
  &--failed { border-left-color: $color-danger; }
  &--downloading { border-left-color: #d48806; }
  &--pending { border-left-color: $text-secondary; }

  &__head {
    padding: 14px 16px;
    background: $bg-page;
  }

  &__title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__name {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 24px;
  }

  &__meta-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    font-size: 12px;
    color: $text-secondary;

    code {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
      color: $text-primary;
    }
  }

  &__meta-label {
    flex-shrink: 0;
    color: $text-secondary;
  }

  &__artifact {
    word-break: break-all;
  }

  &__alert {
    margin-top: 10px;

    :deep(.el-alert__description) {
      white-space: pre-line;
      line-height: 1.6;
    }
  }

  &__workers {
    padding: 12px 16px 14px;
    background: #fff;
    border-top: 1px solid $border-color-light;
  }

  &__workers-title {
    font-size: 12px;
    font-weight: 600;
    color: $text-secondary;
    margin-bottom: 8px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
