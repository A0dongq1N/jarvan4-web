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
          <!-- 接口选择器 -->
          <div v-if="report.percentiles.length > 1" class="api-selector-row">
            <span class="api-selector-row__label">指标维度：</span>
            <el-select v-model="selectedApiName" size="small" style="width: 240px">
              <el-option label="全部接口" value="" />
              <el-option
                v-for="p in report.percentiles"
                :key="p.api"
                :label="p.api"
                :value="p.api"
              />
            </el-select>
          </div>

          <!-- Summary Metrics -->
          <div class="summary-grid">
        <MetricCard label="峰值 RPS" :value="formatNumber(displayMetrics.rps, 0)" unit="req/s" accent="#3871dc" />
        <MetricCard label="平均响应时间" :value="formatMs(displayMetrics.avgResponseTime)" unit="ms" accent="#ff7f40" />
        <MetricCard label="P99 响应时间" :value="formatMs(displayMetrics.p99ResponseTime)" unit="ms" accent="#ff7f40" />
        <MetricCard
          label="错误率"
          :value="formatPercent(displayMetrics.errorRate)"
          :trend-reverse="true"
          accent="#e0226e"
        />
        <MetricCard label="总请求数" :value="formatNumber(displayMetrics.totalRequests, 0)" />
        <MetricCard label="成功请求" :value="formatNumber(displayMetrics.successRequests, 0)" accent="#1b855e" />
        <MetricCard label="失败请求" :value="formatNumber(displayMetrics.failedRequests, 0)" accent="#e0226e" />
        <!-- 第8张指标卡：RPS 模式显示 RPS 达成率，否则显示峰值并发 -->
        <MetricCard
          v-if="report.scenarioMode === 'rps' && report.targetRps"
          label="RPS 达成率"
          :value="displayRpsAchievement + '%'"
          :class="rpsAchievementClass"
          desc="稳态均值 / 目标 RPS"
          accent="#3871dc"
        />
        <MetricCard
          v-else-if="report.scenarioMode !== 'rps'"
          label="峰值并发"
          :value="formatNumber(report.summary.concurrent, 0)"
          unit="个"
          accent="#1b855e"
        />
      </div>

          <!-- Charts -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-card__title">RPS 趋势</div>
          <BaseChart :option="rpsChartOption" width="100%" height="220px" />
        </div>
        <div class="chart-card">
          <div class="chart-card__title">响应时间趋势</div>
          <BaseChart :option="rtChartOption" width="100%" height="220px" />
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-card__title">错误率趋势</div>
          <BaseChart :option="errChartOption" width="100%" height="220px" />
        </div>
        <!-- RPS 模式不展示并发图 -->
        <div v-if="report.scenarioMode !== 'rps'" class="chart-card">
          <div class="chart-card__title">并发用户趋势</div>
          <BaseChart :option="concChartOption" width="100%" height="220px" />
        </div>
      </div>

      <!-- Percentile Table -->
      <div class="section-card">
        <div class="section-card__title">接口维度指标</div>
        <el-table
          :data="report.percentiles"
          stripe
          highlight-current-row
          @current-change="handleApiChange"
          style="cursor: pointer"
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

        <!-- 接口维度趋势图（点击行展开） -->
        <transition name="fade">
          <div v-if="selectedApi?.rpsData" class="api-charts">
            <div class="api-charts__header">
              <code class="api-charts__name">{{ selectedApi.api }}</code>
              <span class="api-charts__hint">接口维度趋势</span>
            </div>
            <div class="charts-row">
              <div class="chart-card">
                <div class="chart-card__title">RPS 趋势</div>
                <BaseChart :option="apiRpsChartOption" width="100%" height="180px" />
              </div>
              <div class="chart-card">
                <div class="chart-card__title">响应时间趋势</div>
                <BaseChart :option="apiRtChartOption" width="100%" height="180px" />
              </div>
              <div class="chart-card">
                <div class="chart-card__title">错误率趋势</div>
                <BaseChart :option="apiErrChartOption" width="100%" height="180px" />
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Error Analysis -->
      <div class="section-card" v-if="showErrorAnalysis">
        <div class="section-card__title">错误分析</div>
        <div v-if="report.errorMsg && !report.errors.length" class="error-stop-reason">
          {{ report.errorMsg }}
        </div>
        <div v-if="report.errors.length" class="error-analysis">
          <div class="error-chart">
            <BaseChart :option="errorPieOption" width="100%" height="260px" />
          </div>
          <div class="error-table">
            <el-table :data="report.errors" stripe>
              <el-table-column label="类型" width="90">
                <template #default="{ row }">
                  <el-tag
                    :type="row.errorType === 'business' ? 'warning' : 'danger'"
                    size="small"
                  >{{ row.errorType === 'business' ? '业务' : '系统' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="接口" prop="api" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">
                  <span v-if="row.api">{{ row.api }}</span>
                  <span v-else class="exec-info__muted">—</span>
                </template>
              </el-table-column>
              <el-table-column label="错误码" prop="code" width="120">
                <template #default="{ row }">
                  <code class="error-code">{{ row.code }}</code>
                </template>
              </el-table-column>
              <el-table-column label="描述" prop="message" min-width="220" show-overflow-tooltip />
              <el-table-column label="次数" prop="count" width="90">
                <template #default="{ row }">{{ formatNumber(row.count, 0) }}</template>
              </el-table-column>
              <el-table-column label="占比" prop="percentage" width="80">
                <template #default="{ row }">{{ row.percentage.toFixed(1) }}%</template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
        </el-tab-pane>

        <!-- ── Tab 2：执行环境（配置与部署，附录性质） ── -->
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
                      <div v-if="s.error" class="exec-script-card__error">{{ s.error }}</div>
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
                        <el-table-column label="错误信息" min-width="200" show-overflow-tooltip>
                          <template #default="{ row }">
                            <span v-if="row.error" class="exec-script-card__error-inline">{{ row.error }}</span>
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
      </el-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import MetricCard from '@/components/common/MetricCard.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { formatNumber, formatMs, formatPercent, formatTime, formatDuration } from '@/utils/format'
import { enrichPercentilesWithTargetRps, computeSteadyAvgRps } from '@/utils/apiTargetRps'
import type { PercentileData, ScriptStatus, ScriptStatusInfo } from '@/types'

const route = useRoute()
const router = useRouter()
const reportStore = useReportStore()

const reportId = computed(() => route.params.id as string)
const loading = ref(false)
const report = computed(() => reportStore.currentReport)
// 当前选中的接口行（点击 percentile 表格展开接口维度趋势）
const selectedApi = ref<PercentileData | null>(null)
// 顶部指标卡接口选择器（空=全部接口）
const selectedApiName = ref('')
const reportTab = ref<'results' | 'environment'>('results')

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

const showErrorAnalysis = computed(() => {
  const r = report.value
  if (!r) return false
  return !!(r.errors?.length || r.errorMsg || r.summary.failedRequests > 0)
})

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
    if (apiFromQuery && report.value) {
      selectedApi.value = report.value.percentiles.find(p => p.api === apiFromQuery) ?? null
    }
    const tabFromQuery = route.query.tab as string | undefined
    if (tabFromQuery === 'environment' && hasExecutionMeta.value) {
      reportTab.value = 'environment'
    }
  } finally {
    loading.value = false
  }
})

watch(reportTab, (tab) => {
  const query = { ...route.query }
  if (tab === 'environment') {
    query.tab = 'environment'
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

function handleApiChange(row: PercentileData | null) {
  selectedApi.value = row
  // 将选中接口写入 URL query，刷新后可恢复
  router.replace({ query: { ...route.query, api: row?.api ?? undefined } })
}

function goTask() {
  const taskId = report.value?.taskId
  if (!taskId) return
  router.push({ path: `/task/${taskId}`, query: { tab: 'history' } })
}

// RPS 达成率（稳态均值 / 目标，排除爬坡）
const rpsAchievement = computed(() => {
  if (report.value?.scenarioMode !== 'rps' || !report.value?.targetRps) return 0
  const target = report.value.targetRps
  const steadyAvg = computeSteadyAvgRps(report.value.rpsData, target)
  const actual = steadyAvg ?? report.value.summary.rps
  return Math.min(100, parseFloat((actual / target * 100).toFixed(1)))
})

// 顶部 MetricCard 展示的指标（按选中接口切换）
const displayMetrics = computed(() => {
  if (!report.value) return { rps: 0, avgResponseTime: 0, p99ResponseTime: 0, errorRate: 0, totalRequests: 0, successRequests: 0, failedRequests: 0 }
  if (!selectedApiName.value) {
    // 全局
    return report.value.summary
  }
  // 选中接口
  const p = report.value.percentiles.find(x => x.api === selectedApiName.value)
  if (!p) return report.value.summary
  return {
    rps: p.peakRps || report.value.summary.rps,
    avgResponseTime: p.p50,
    p99ResponseTime: p.p99,
    errorRate: p.errorRate,
    totalRequests: p.requests,
    successRequests: p.requests - p.errors,
    failedRequests: p.errors,
  }
})

// 选中接口的 RPS 达成率（稳态均值 / 目标）
const displayRpsAchievement = computed(() => {
  if (report.value?.scenarioMode !== 'rps' || !report.value?.targetRps) return 0
  if (!selectedApiName.value) return rpsAchievement.value
  const p = report.value.percentiles.find(x => x.api === selectedApiName.value)
  if (!p || !p.targetRps) return 0
  const compareRps = p.steadyAvgRps ?? p.avgRps ?? p.actualRps ?? 0
  return Math.min(100, parseFloat((compareRps / p.targetRps * 100).toFixed(1)))
})

const rpsAchievementClass = computed(() => {
  const v = displayRpsAchievement.value
  if (v >= 95) return 'achievement--good'
  if (v >= 80) return 'achievement--warn'
  return 'achievement--bad'
})

function makeLineOption(data: any[], color: string, yAxisFormatter?: (v: number) => string, targetValue?: number) {
  const AXIS_COLOR  = '#babcbe'
  const SPLIT_COLOR = '#ececed'
  const LABEL_COLOR = '#9c9fa3'
  // 将 hex 转为带透明度的 rgba（简单方法：hardcode area color 传参）
  return {
    grid: { top: 12, right: 16, bottom: 24, left: 60 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(p => new Date(p.timestamp * 1000).toLocaleTimeString()),
      axisLabel: { color: LABEL_COLOR, fontSize: 11 },
      axisLine: { lineStyle: { color: AXIS_COLOR } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: SPLIT_COLOR } },
      axisLabel: { color: LABEL_COLOR, fontSize: 11, formatter: yAxisFormatter },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#e1e2e3',
      borderWidth: 1,
      textStyle: { color: '#22252b', fontSize: 12 },
      formatter: yAxisFormatter ? (params: any) => {
        const p = params[0]
        return `<span style="color:#9c9fa3;font-size:11px">${p.axisValue}</span><br/><b style="color:${color}">${yAxisFormatter(p.value)}</b>`
      } : undefined,
    },
    series: [{
      type: 'line',
      data: data.map(p => p.value),
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: color.replace(')', ',0.18)').replace('rgb', 'rgba') },
            { offset: 1, color: color.replace(')', ',0)').replace('rgb', 'rgba') },
          ],
        },
      },
      markLine: targetValue != null ? {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#e0226e', type: 'dashed', width: 1.5 },
        label: {
          formatter: `目标 ${targetValue} req/s`,
          position: 'end',
          color: '#e0226e',
          fontSize: 11,
        },
        data: [{ yAxis: targetValue }],
      } : undefined,
    }],
  }
}

const rpsChartOption = computed(() => {
  if (!report.value) return {}
  const targetValue = report.value.scenarioMode === 'rps' ? report.value.targetRps : undefined
  return makeLineOption(report.value.rpsData, '#3871dc', v => String(Math.ceil(v)), targetValue)
})
const rtChartOption = computed(() =>
  report.value ? makeLineOption(report.value.responseTimeData, '#ff7f40', v => v.toFixed(2) + ' ms') : {}
)
const errChartOption = computed(() =>
  report.value ? makeLineOption(report.value.errorRateData, '#e0226e', v => v.toFixed(2) + '%') : {}
)
const concChartOption = computed(() =>
  report.value ? makeLineOption(report.value.concurrentData, '#1b855e') : {}
)

// 接口错误率颜色等级
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

const errorPieOption = computed(() => {
  if (!report.value?.errors.length) return {}
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'middle' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      data: report.value.errors.map(e => ({
        name: e.api ? `[${e.code}] ${e.api}` : `[${e.code}] ${e.message}`,
        value: e.count,
      })),
      itemStyle: { borderRadius: 4 },
      label: { show: false },
    }],
  }
})

// 接口维度趋势图
const apiRpsChartOption = computed(() =>
  selectedApi.value?.rpsData ? makeLineOption(selectedApi.value.rpsData, '#3871dc', v => String(Math.ceil(v))) : {}
)
const apiRtChartOption = computed(() =>
  selectedApi.value?.responseTimeData ? makeLineOption(selectedApi.value.responseTimeData, '#ff7f40', v => v.toFixed(2) + ' ms') : {}
)
const apiErrChartOption = computed(() =>
  selectedApi.value?.errorRateData ? makeLineOption(selectedApi.value.errorRateData, '#e0226e', v => v.toFixed(2) + '%') : {}
)
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
  gap: 8px;
  margin-bottom: 12px;

  &__label {
    font-size: 14px;
    color: $text-secondary;
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

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 16px;
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

  &__error {
    margin-top: 10px;
    font-size: 12px;
    color: $color-danger;
    line-height: 1.5;
  }

  &__error-inline {
    font-size: 12px;
    color: $color-danger;
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

.api-charts {
  margin-top: 16px;
  padding: 16px;
  background: $bg-page;
  border-radius: $border-radius-sm;
  border: 1px solid $border-color-light;

  &__header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__name {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    font-weight: 600;
    color: $color-primary;
    background: $color-primary-light-9;
    padding: 2px 8px;
    border-radius: 4px;
  }

  &__hint {
    font-size: 12px;
    color: $text-secondary;
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
