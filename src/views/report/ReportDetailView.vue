<template>
  <div class="report-detail-view">
    <PageHeader
      :title="report?.taskName || '报告详情'"
      :back="true"
    >
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
      <!-- Summary Metrics -->
      <div class="summary-grid">
        <MetricCard label="峰值 RPS" :value="formatNumber(report.summary.rps, 0)" unit="req/s" accent="#3871dc" />
        <MetricCard label="平均响应时间" :value="formatNumber(report.summary.avgResponseTime, 0)" unit="ms" accent="#ff7f40" />
        <MetricCard label="P99 响应时间" :value="formatNumber(report.summary.p99ResponseTime, 0)" unit="ms" accent="#ff7f40" />
        <MetricCard
          label="错误率"
          :value="formatPercent(report.summary.errorRate)"
          :trend-reverse="true"
          accent="#e0226e"
        />
        <MetricCard label="总请求数" :value="formatNumber(report.summary.totalRequests, 0)" />
        <MetricCard label="成功请求" :value="formatNumber(report.summary.successRequests, 0)" accent="#1b855e" />
        <MetricCard label="失败请求" :value="formatNumber(report.summary.failedRequests, 0)" accent="#e0226e" />
        <!-- 第8张指标卡：RPS 模式显示 RPS 达成率，否则显示峰值并发 -->
        <MetricCard
          v-if="report.scenarioMode === 'rps' && report.targetRps"
          label="RPS 达成率"
          :value="rpsAchievement + '%'"
          :class="rpsAchievementClass"
          desc="实际 RPS / 目标 RPS"
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

      <!-- 执行信息折叠面板：脚本快照 + 参与节点 -->
      <el-collapse
        v-if="report.scriptSnapshots?.length || report.workerSnapshots?.length"
        class="meta-collapse"
      >
        <el-collapse-item name="meta">
          <template #title>
            <span class="meta-collapse__title">执行信息</span>
            <span class="meta-collapse__summary">
              <template v-if="report.scriptSnapshots?.length">
                {{ report.scriptSnapshots.length }} 个脚本
              </template>
              <template v-if="report.scriptSnapshots?.length && report.workerSnapshots?.length">
                &nbsp;·&nbsp;
              </template>
              <template v-if="report.workerSnapshots?.length">
                {{ report.workerSnapshots.length }} 个节点
              </template>
            </span>
          </template>

          <div class="meta-collapse__body">
            <div v-if="report.scriptSnapshots?.length" class="meta-section">
              <div class="meta-section__label">脚本快照</div>
              <div class="meta-section__items">
                <div v-for="s in report.scriptSnapshots" :key="s.scriptId" class="meta-item">
                  <code class="meta-item__name">{{ s.scriptName }}</code>
                  <code class="meta-item__hash">{{ s.commitHash.slice(0, 8) }}</code>
                  <span class="meta-item__sub">权重 {{ s.weight }}%</span>
                </div>
              </div>
            </div>
            <div v-if="report.workerSnapshots?.length" class="meta-section">
              <div class="meta-section__label">参与节点</div>
              <div class="meta-section__items">
                <div v-for="w in report.workerSnapshots" :key="w.workerId" class="meta-item">
                  <code class="meta-item__name">{{ w.hostname }}</code>
                  <code class="meta-item__hash meta-item__hash--green">{{ w.ip }}</code>
                  <span class="meta-item__sub">{{ w.cpuCores }} 核 · 最大并发 {{ w.maxConcurrency }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

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
          <el-table-column label="请求数" prop="requests" width="100">
            <template #default="{ row }">{{ formatNumber(row.requests, 0) }}</template>
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
            <template #default="{ row }">{{ row.p50 }} ms</template>
          </el-table-column>
          <el-table-column label="P90" prop="p90" width="75">
            <template #default="{ row }">{{ row.p90 }} ms</template>
          </el-table-column>
          <el-table-column label="P99" prop="p99" width="80">
            <template #default="{ row }">
              <span :style="{ color: row.p99 > 1000 ? '#e54545' : row.p99 > 500 ? '#ff9c19' : '#00a870' }">
                {{ row.p99 }} ms
              </span>
            </template>
          </el-table-column>
          <el-table-column label="最大" prop="max" width="80">
            <template #default="{ row }">{{ row.max }} ms</template>
          </el-table-column>
          <el-table-column label="最小" prop="min" width="75">
            <template #default="{ row }">{{ row.min }} ms</template>
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
      <div class="section-card" v-if="report.errors.length">
        <div class="section-card__title">错误分析</div>
        <div class="error-analysis">
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
              <el-table-column label="错误码" prop="code" width="130">
                <template #default="{ row }">
                  <code style="font-size: 12px; background: #f4f5f5; padding: 1px 6px; border-radius: 3px">{{ row.code }}</code>
                </template>
              </el-table-column>
              <el-table-column label="描述" prop="message" min-width="200" show-overflow-tooltip />
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReportStore } from '@/stores/report'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import MetricCard from '@/components/common/MetricCard.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { formatNumber, formatPercent, formatTime, formatDuration } from '@/utils/format'
import type { PercentileData } from '@/types'

const route = useRoute()
const router = useRouter()
const reportStore = useReportStore()

const reportId = computed(() => route.params.id as string)
const loading = ref(false)
const report = computed(() => reportStore.currentReport)
// 当前选中的接口行（点击 percentile 表格展开接口维度趋势）
const selectedApi = ref<PercentileData | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    await reportStore.fetchById(reportId.value)
    // 从 URL query 恢复上次选中的接口（刷新保持状态）
    const apiFromQuery = route.query.api as string | undefined
    if (apiFromQuery && report.value) {
      selectedApi.value = report.value.percentiles.find(p => p.api === apiFromQuery) ?? null
    }
  } finally {
    loading.value = false
  }
})

function handleApiChange(row: PercentileData | null) {
  selectedApi.value = row
  // 将选中接口写入 URL query，刷新后可恢复
  router.replace({ query: { ...route.query, api: row?.api ?? undefined } })
}

// RPS 达成率（RPS 模式专用）
const rpsAchievement = computed(() => {
  if (!report.value?.targetRps || !report.value.summary.rps) return 0
  return Math.min(100, parseFloat((report.value.summary.rps / report.value.targetRps * 100).toFixed(1)))
})

const rpsAchievementClass = computed(() => {
  const v = rpsAchievement.value
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
      data: data.map(p => new Date(p.timestamp).toLocaleTimeString()),
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
  return makeLineOption(report.value.rpsData, '#3871dc', undefined, targetValue)
})
const rtChartOption = computed(() =>
  report.value ? makeLineOption(report.value.responseTimeData, '#ff7f40') : {}
)
const errChartOption = computed(() =>
  report.value ? makeLineOption(report.value.errorRateData, '#e0226e', v => v.toFixed(1) + '%') : {}
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

const errorPieOption = computed(() => {
  if (!report.value?.errors.length) return {}
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'middle' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      data: report.value.errors.map(e => ({ name: `[${e.code}] ${e.message}`, value: e.count })),
      itemStyle: { borderRadius: 4 },
      label: { show: false },
    }],
  }
})

// 接口维度趋势图
const apiRpsChartOption = computed(() =>
  selectedApi.value?.rpsData ? makeLineOption(selectedApi.value.rpsData, '#3871dc') : {}
)
const apiRtChartOption = computed(() =>
  selectedApi.value?.responseTimeData ? makeLineOption(selectedApi.value.responseTimeData, '#ff7f40') : {}
)
const apiErrChartOption = computed(() =>
  selectedApi.value?.errorRateData ? makeLineOption(selectedApi.value.errorRateData, '#e0226e', v => v.toFixed(1) + '%') : {}
)
</script>

<style lang="scss" scoped>
.report-detail-view {
  max-width: 1400px;
}

.report-time {
  font-size: 13px;
  color: $text-secondary;
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

.error-chart {
  background: $bg-page;
  border-radius: $border-radius-sm;
}

.snapshot-card {
  margin-bottom: 16px;
}

// 执行信息折叠面板
.meta-collapse {
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  overflow: hidden;

  // 覆盖 el-collapse 默认边框
  :deep(.el-collapse-item__header) {
    padding: 0 16px;
    height: 44px;
    font-size: 13px;
    background: $bg-card;
    border-bottom: none;
  }

  :deep(.el-collapse-item__wrap) {
    background: $bg-card;
    border-top: 1px solid $border-color-light;
  }

  :deep(.el-collapse-item__content) {
    padding: 0;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
  }

  &__summary {
    margin-left: 10px;
    font-size: 12px;
    color: $text-secondary;
  }

  &__body {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    padding: 16px;
  }
}

.meta-section {
  &__label {
    font-size: 11px;
    font-weight: 600;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;

  &__name {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    font-weight: 600;
    color: $text-primary;
  }

  &__hash {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: $color-primary-light-9;
    color: $color-primary;

    &--green {
      background: rgba(27, 133, 94, 0.08);
      color: #1b855e;
    }
  }

  &__sub {
    font-size: 12px;
    color: $text-secondary;
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
