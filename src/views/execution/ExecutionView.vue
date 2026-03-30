<template>
  <div class="execution-view">
    <!-- Control Panel -->
    <div class="execution-control">
      <div class="execution-control__info">
        <div class="execution-control__task-name">{{ taskName }}</div>
        <div class="execution-control__status">
          <StatusBadge :status="executionStatus" />
          <span v-if="executionStore.state && executionStatus === 'running'" class="execution-control__elapsed">
            {{ formatDuration(executionStore.state.elapsedSeconds) }}
          </span>
          <!-- RPS 模式徽章 -->
          <span v-if="executionStore.scenarioMode === 'rps' && executionStatus === 'running'" class="rps-badge">
            RPS 模式 &nbsp;目标: {{ executionStore.targetRps }} req/s
          </span>
        </div>
      </div>

      <div class="execution-control__actions">
        <el-button
          v-if="executionStatus === 'idle' || executionStatus === 'success' || executionStatus === 'failed' || executionStatus === 'stopped'"
          type="primary"
          :icon="VideoPlay"
          size="large"
          :loading="executionStore.loading"
          @click="handleStart"
        >
          开始压测
        </el-button>
        <el-button
          v-if="executionStatus === 'pending' || executionStatus === 'running'"
          type="danger"
          :icon="VideoPause"
          size="large"
          @click="handleStop"
        >
          停止
        </el-button>
        <el-button v-if="executionStatus === 'success'" type="success" :icon="Document" @click="goReport">
          查看报告
        </el-button>
      </div>
    </div>

    <!-- Pending: 初始化面板 -->
    <div v-if="executionStatus === 'pending'" class="init-panel">
      <div class="init-panel__header">
        <span class="init-panel__title">正在初始化压测环境...</span>
        <span class="init-panel__hint">即将开始注入流量，请稍候</span>
      </div>
      <div class="init-steps">
        <div
          v-for="step in executionStore.state?.initSteps ?? []"
          :key="step.key"
          class="init-step"
          :class="`init-step--${step.status}`"
        >
          <div class="init-step__main">
            <span class="init-step__icon">
              <svg v-if="step.status === 'running'" class="spin-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-dasharray="28 56" />
              </svg>
              <svg v-else-if="step.status === 'done'" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" fill-opacity="0.15" />
                <path d="M7 12.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="step.status === 'error'" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" fill-opacity="0.15" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" />
              </svg>
            </span>
            <span class="init-step__label">{{ step.label }}</span>
            <span v-if="step.detail" class="init-step__detail">{{ step.detail }}</span>
          </div>
          <div v-if="step.items?.length" class="init-step__items">
            <code v-for="item in step.items" :key="item" class="init-step__tag">{{ item }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Metrics（running 及之后才显示） -->
    <template v-if="executionStatus !== 'pending' && executionStatus !== 'idle'">
      <div class="metrics-summary">
        <MetricCard
          label="当前 RPS"
          :value="formatNumber(executionStore.summary.rps, 1)"
          unit="req/s"
          accent="#3871dc"
        />
        <MetricCard
          label="平均响应时间"
          :value="formatNumber(executionStore.summary.avgResponseTime, 0)"
          unit="ms"
          accent="#ff7f40"
        />
        <MetricCard
          label="错误率"
          :value="formatPercent(executionStore.summary.errorRate)"
          :trend-reverse="true"
          accent="#e0226e"
        />
        <!-- 第4张指标卡：仅 VU 模式展示并发用户 -->
        <MetricCard
          v-if="executionStore.scenarioMode === 'step'"
          label="并发用户"
          :value="formatNumber(executionStore.summary.concurrent, 0)"
          unit="个"
          accent="#1b855e"
        />
      </div>

      <!-- Charts Dashboard -->
      <div class="charts-dashboard">
        <!-- RPS 图：RPS 模式传入目标参考线 -->
        <RpsChart
          :data="executionStore.rpsData"
          :target-value="executionStore.scenarioMode === 'rps' ? executionStore.targetRps : undefined"
        />
        <ResponseTimeChart :data="executionStore.responseTimeData" />
        <ErrorRateChart :data="executionStore.errorRateData" />
        <!-- 仅 VU 模式展示并发图 -->
        <ConcurrentChart
          v-if="executionStore.scenarioMode === 'step'"
          :data="executionStore.concurrentData"
        />
      </div>

      <!-- [新增] 接口维度指标（running 时实时展示） -->
      <section v-if="executionStatus === 'running' && executionStore.livePercentiles.length > 0" class="section">
        <h3 class="section__title">接口维度指标</h3>
        <el-table
          :data="executionStore.livePercentiles"
          highlight-current-row
          style="cursor: pointer"
          @current-change="handleApiChange"
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
              <span :class="errorRateClass(row.errorRate)">{{ formatPercent(row.errorRate) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="P50" prop="p50" width="75">
            <template #default="{ row }">{{ row.p50 }} ms</template>
          </el-table-column>
          <el-table-column label="P75" prop="p75" width="75">
            <template #default="{ row }">{{ row.p75 }} ms</template>
          </el-table-column>
          <el-table-column label="P90" prop="p90" width="75">
            <template #default="{ row }">{{ row.p90 }} ms</template>
          </el-table-column>
          <el-table-column label="P95" prop="p95" width="75">
            <template #default="{ row }">{{ row.p95 }} ms</template>
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

        <transition name="fade">
          <div v-if="selectedApi?.rpsData?.length" class="api-charts">
            <div class="api-charts__header">
              <code class="api-charts__name">{{ selectedApi.api }}</code>
              <span class="api-charts__hint">接口维度实时趋势</span>
            </div>
            <div class="api-charts__row">
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
      </section>

      <!-- [新增] 错误分析（running 时实时展示） -->
      <section v-if="executionStatus === 'running' && executionStore.liveErrors.length > 0" class="section">
        <h3 class="section__title">错误分析</h3>
        <div class="error-analysis">
          <div class="error-chart">
            <BaseChart :option="errorPieOption" width="100%" height="260px" />
          </div>
          <div class="error-table">
            <el-table :data="executionStore.liveErrors" stripe>
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
      </section>

      <!-- Real-time Logs -->
      <div class="log-panel">
        <div class="log-panel__header">
          <span class="log-panel__title">实时日志</span>
          <div class="log-panel__controls">
            <el-select v-model="logLevelFilter" size="small" placeholder="日志级别" clearable style="width: 120px">
              <el-option label="全部" value="" />
              <el-option label="INFO" value="info" />
              <el-option label="WARN" value="warn" />
              <el-option label="ERROR" value="error" />
              <el-option label="DEBUG" value="debug" />
            </el-select>
            <el-button size="small" :icon="Delete" @click="executionStore.clearCharts">清空</el-button>
            <el-switch v-model="autoScroll" size="small" active-text="自动滚动" />
          </div>
        </div>
        <div ref="logContainer" class="log-container">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="log-entry"
            :class="`log-entry--${log.level}`"
          >
            <span class="log-entry__time">{{ log.timestamp.slice(11, 23) }}</span>
            <span class="log-entry__level">{{ log.level.toUpperCase() }}</span>
            <span class="log-entry__source">{{ log.source }}</span>
            <span class="log-entry__msg">{{ log.message }}</span>
          </div>
          <div v-if="filteredLogs.length === 0" class="log-empty">暂无日志</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { VideoPlay, VideoPause, Document, Delete } from '@element-plus/icons-vue'
import { useExecutionStore } from '@/stores/execution'
import { useTaskStore } from '@/stores/task'
import StatusBadge from '@/components/common/StatusBadge.vue'
import MetricCard from '@/components/common/MetricCard.vue'
import RpsChart from '@/components/charts/RpsChart.vue'
import ResponseTimeChart from '@/components/charts/ResponseTimeChart.vue'
import ErrorRateChart from '@/components/charts/ErrorRateChart.vue'
import ConcurrentChart from '@/components/charts/ConcurrentChart.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { formatNumber, formatPercent, formatDuration } from '@/utils/format'
import type { TaskStatus, PercentileData } from '@/types'

const route = useRoute()
const router = useRouter()
const executionStore = useExecutionStore()
const taskStore = useTaskStore()

const taskId = computed(() => route.params.taskId as string)
const taskName = ref('加载中...')
const logLevelFilter = ref('')
const autoScroll = ref(true)
const logContainer = ref<HTMLElement | null>(null)

// 当前选中接口行（点击展开趋势图）
const selectedApi = ref<PercentileData | null>(null)

function handleApiChange(row: PercentileData | null) {
  selectedApi.value = row
  router.replace({ query: { ...route.query, api: row?.api ?? undefined } })
}

// livePercentiles 每次轮询更新后，同步更新 selectedApi 指向最新对象（保持数值刷新）
// 同时承担刷新恢复：第一次有数据时从 URL query 还原选中行
let apiRestored = false
watch(
  () => executionStore.livePercentiles,
  (list) => {
    if (!list.length) return
    const targetApi = selectedApi.value?.api ?? (!apiRestored ? route.query.api as string | undefined : undefined)
    apiRestored = true
    if (targetApi) {
      selectedApi.value = list.find(p => p.api === targetApi) ?? null
    }
  },
  { deep: false }
)

const executionStatus = computed<TaskStatus>(() => executionStore.state?.status || 'idle')

const filteredLogs = computed(() => {
  if (!logLevelFilter.value) return executionStore.logs
  return executionStore.logs.filter(l => l.level === logLevelFilter.value)
})

// 接口错误率颜色等级
function errorRateClass(rate: number) {
  if (rate >= 0.05) return 'err-rate--high'
  if (rate >= 0.01) return 'err-rate--mid'
  return 'err-rate--low'
}

// ── 接口维度趋势图 ────────────────────────────────────────────────────
function makeLineOption(data: { timestamp: number; value: number }[], color: string, yAxisFormatter?: (v: number) => string) {
  const AXIS_COLOR  = '#babcbe'
  const SPLIT_COLOR = '#ececed'
  const LABEL_COLOR = '#9c9fa3'
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
    }],
  }
}

const apiRpsChartOption = computed(() =>
  selectedApi.value?.rpsData ? makeLineOption(selectedApi.value.rpsData, '#3871dc') : {}
)
const apiRtChartOption = computed(() =>
  selectedApi.value?.responseTimeData ? makeLineOption(selectedApi.value.responseTimeData, '#ff7f40') : {}
)
const apiErrChartOption = computed(() =>
  selectedApi.value?.errorRateData ? makeLineOption(selectedApi.value.errorRateData, '#e0226e', v => v.toFixed(1) + '%') : {}
)

// ── 错误分析饼图 ──────────────────────────────────────────────────────
const errorPieOption = computed(() => {
  const errors = executionStore.liveErrors
  if (!errors.length) return {}
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'middle' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      data: errors.map(e => ({ name: `[${e.code}] ${e.message}`, value: e.count })),
      itemStyle: { borderRadius: 4 },
      label: { show: false },
    }],
  }
})

onMounted(async () => {
  try {
    const task = await taskStore.fetchById(taskId.value)
    taskName.value = task.name
  } catch {
    taskName.value = '未知任务'
  }

  const execId = route.query.execId as string | undefined

  if (execId) {
    // 刷新恢复：已有执行 ID，重连到正在运行的执行，不清空状态
    await executionStore.resumeExecution(execId)
  } else {
    // 全新进入：清空上次残留状态
    executionStore.reset()
    if (route.query.autostart === '1') {
      await executionStore.startExecution(taskId.value)
    }
  }
})

onUnmounted(() => {
  executionStore.stopTimers()
})

watch(() => executionStore.logs.length, async () => {
  if (!autoScroll.value) return
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
})

watch(executionStatus, (status, prevStatus) => {
  // 仅在从 pending 转 running 时提示（排除刷新恢复时 null→running 的误触发）
  if (status === 'running' && prevStatus === 'pending') {
    ElMessage.success('环境初始化完成，开始注入流量')
  } else if (status === 'success') {
    ElMessage.success('压测完成，正在跳转报告...')
    const reportId = executionStore.state?.reportId
    router.push(reportId ? `/report/${reportId}` : '/report')
  } else if (status === 'failed') {
    ElMessage.error('压测失败')
  }
})

async function handleStart() {
  await executionStore.startExecution(taskId.value)
  // 把 execution ID 写入 URL，刷新后可恢复
  if (executionStore.state?.id) {
    router.replace({ query: { ...route.query, execId: executionStore.state.id, autostart: undefined } })
  }
}

async function handleStop() {
  await executionStore.stopExecution()
  ElMessage.info('已停止压测')
}

function goReport() {
  const reportId = executionStore.state?.reportId
  router.push(reportId ? `/report/${reportId}` : '/report')
}
</script>

<style lang="scss" scoped>
.execution-view {
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.execution-control {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px 24px;
  box-shadow: $shadow-sm;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &__task-name {
    font-size: 18px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 6px;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__elapsed {
    font-size: 14px;
    color: $text-secondary;
    font-variant-numeric: tabular-nums;
    font-family: 'SF Mono', 'Monaco', monospace;
  }

  &__actions {
    display: flex;
    gap: 12px;
  }
}

// RPS 模式标识徽章
.rps-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: rgba(114, 46, 209, 0.1);
  border: 1px solid rgba(114, 46, 209, 0.35);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #722ed1;
  letter-spacing: 0.02em;
}

// ── Pending 初始化面板 ─────────────────────────────────────────────────
.init-panel {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 28px 32px;
  box-shadow: $shadow-sm;
  border: 1px solid rgba(114, 46, 209, 0.15);

  &__header {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin-bottom: 24px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
  }

  &__hint {
    font-size: 13px;
    color: $text-secondary;
  }
}

.init-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.init-step {
  padding: 12px 0;
  border-bottom: 1px solid $border-color-light;
  transition: opacity 0.2s;

  &:last-child { border-bottom: none; }

  // 主行：图标 + 标题 + 摘要
  &__main {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  &__label {
    font-size: 14px;
    flex: 1;
  }

  &__detail {
    font-size: 12px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    padding: 1px 8px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  // 子行：tag 列表，左侧与标题文字对齐（icon宽20 + gap12 = 32px）
  &__items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    padding-left: 32px;
  }

  &__tag {
    display: inline-block;
    font-size: 12px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    padding: 2px 10px;
    border-radius: 4px;
    width: fit-content;
  }

  // 等待：灰色
  &--waiting {
    opacity: 0.45;
    .init-step__icon { color: $text-secondary; }
    .init-step__label { color: $text-secondary; }
    .init-step__detail,
    .init-step__tag { background: $bg-page; color: $text-secondary; }
  }

  // 进行中：蓝紫色 + 旋转
  &--running {
    .init-step__icon { color: #722ed1; }
    .init-step__label { color: $text-primary; font-weight: 500; }
    .init-step__detail,
    .init-step__tag { background: rgba(114, 46, 209, 0.08); color: #722ed1; }
  }

  // 完成：绿色
  &--done {
    .init-step__icon { color: $color-success; }
    .init-step__label { color: $text-regular; }
    .init-step__detail,
    .init-step__tag {
      background: rgba($color-success, 0.08);
      color: $color-success;
    }
  }

  // 错误：红色
  &--error {
    .init-step__icon { color: $color-danger; }
    .init-step__label { color: $color-danger; }
    .init-step__detail,
    .init-step__tag { background: rgba($color-danger, 0.08); color: $color-danger; }
  }
}

// SVG 旋转动画
.spin-icon {
  animation: spin 0.9s linear infinite;
  transform-origin: center;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

// ── 指标 & 图表区 ──────────────────────────────────────────────────────
.metrics-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @include breakpoint('md') {
    grid-template-columns: repeat(2, 1fr);
  }
}

.charts-dashboard {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @include breakpoint('sm') {
    grid-template-columns: 1fr;
  }
}

// Real-time Log Panel — 唯一深色区域
.log-panel {
  background: #1a1d23;
  border-radius: $border-radius;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #141720;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

.log-container {
  height: 280px;
  overflow-y: auto;
  padding: 8px 0;
  font-family: 'SF Mono', 'Fira Code', 'Monaco', monospace;
  font-size: 12px;

  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }
  &::-webkit-scrollbar-track { background: transparent; }
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 3px 16px;
  line-height: 1.6;

  &:hover { background: rgba(255, 255, 255, 0.04); }

  &__time { color: #6b7280; min-width: 88px; }
  &__level { min-width: 48px; font-weight: 600; }
  &__source { color: #9ca3af; min-width: 80px; }
  &__msg { color: #d1d5db; flex: 1; }

  &--info .log-entry__level { color: #60a5fa; }
  &--warn .log-entry__level { color: #fbbf24; }
  &--error {
    .log-entry__level { color: #f87171; }
    .log-entry__msg { color: #fca5a5; }
  }
  &--debug .log-entry__level { color: #a3e635; }
}

.log-empty {
  padding: 40px;
  text-align: center;
  color: #4b5563;
  font-size: 13px;
}

// ── 接口维度 & 错误分析区块 ───────────────────────────────────────────
.section {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px;
  box-shadow: $shadow-sm;

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
    margin: 0 0 16px;
  }
}

// 接口错误率颜色编码
.err-rate--high { color: $color-danger;  font-weight: 600; }
.err-rate--mid  { color: $color-warning; font-weight: 600; }
.err-rate--low  { color: $color-success; }

// 接口维度趋势图区域
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

  &__row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;

    @include breakpoint('md') {
      grid-template-columns: 1fr;
    }
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

// 错误分析布局
.error-analysis {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  align-items: start;

  @include breakpoint('md') {
    grid-template-columns: 1fr;
  }
}

.error-chart {
  background: $bg-page;
  border-radius: $border-radius-sm;
}

// 淡入淡出
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
