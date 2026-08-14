<template>
  <div v-if="report" class="stress-report-results">
    <div v-if="showVerdict && reportVerdict" class="report-verdict" :class="`report-verdict--${reportVerdict.status}`">
      <div class="report-verdict__main">
        <span class="report-verdict__badge">{{ reportVerdict.title }}</span>
        <span v-if="reportVerdict.description" class="report-verdict__desc">{{ reportVerdict.description }}</span>
      </div>
    </div>

    <div v-if="report.percentiles.length > 1" class="api-selector-row">
      <span class="api-selector-row__label">查看范围：</span>
      <el-select v-model="selectedApiName" size="small" style="width: 280px" clearable placeholder="全局汇总">
        <el-option label="全局汇总" value="" />
        <el-option
          v-for="p in report.percentiles"
          :key="p.api"
          :label="p.api"
          :value="p.api"
        />
      </el-select>
      <span class="api-selector-row__hint">切换后上方指标卡与趋势图同步更新该接口数据</span>
    </div>

    <div class="summary-grid">
      <MetricCard label="峰值 RPS" :value="formatNumber(displayMetrics.rps, 0)" unit="req/s" accent="#3871dc" />
      <MetricCard
        :label="activePercentile ? 'P50 响应时间' : '平均响应时间'"
        :value="formatMs(displayMetrics.avgResponseTime)"
        accent="#ff7f40"
      />
      <MetricCard label="P99 响应时间" :value="formatMs(displayMetrics.p99ResponseTime)" accent="#ff7f40" />
      <MetricCard
        v-if="displayMetrics.maxResponseTime"
        label="最大响应时间"
        :value="formatMs(displayMetrics.maxResponseTime)"
        accent="#3871dc"
      />
      <MetricCard
        label="错误率"
        :value="formatErrorRate(displayMetrics.errorRate)"
        :trend-reverse="true"
        accent="#e0226e"
      />
      <MetricCard label="总请求数" :value="formatNumber(displayMetrics.totalRequests, 0)" />
      <MetricCard label="成功请求" :value="formatNumber(displayMetrics.successRequests, 0)" accent="#1b855e" />
      <MetricCard label="失败请求" :value="formatNumber(displayMetrics.failedRequests, 0)" accent="#e0226e" />
      <MetricCard
        v-if="isRpsScenario(report.scenarioMode) && report.targetRps"
        label="RPS 达成率"
        :value="displayRpsAchievement.toFixed(2) + '%'"
        :class="rpsAchievementClass"
        desc="稳态均值 / 目标 RPS"
        accent="#3871dc"
      />
      <MetricCard
        v-else-if="!isRpsScenario(report.scenarioMode)"
        label="峰值并发"
        :value="formatNumber(report.summary.concurrent, 0)"
        unit="个"
        accent="#1b855e"
      />
    </div>

    <div v-if="activePercentile" class="chart-scope-bar">
      <span class="chart-scope-bar__label">趋势数据</span>
      <code class="chart-scope-bar__api">{{ activePercentile.api }}</code>
    </div>

    <div class="charts-row charts-row--single">
      <div class="chart-card">
        <div class="chart-card__title">响应时间趋势（P95 / P99 / Max）</div>
        <BaseChart :option="percentileChartOption" width="100%" height="220px" />
      </div>
    </div>

    <div v-if="showHistogramChart" class="charts-row charts-row--single">
      <div class="chart-card">
        <div class="chart-card__title">响应时间分布</div>
        <BaseChart :option="histogramChartOption" width="100%" height="260px" />
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-card__title">RPS 趋势</div>
        <BaseChart :option="rpsChartOption" width="100%" height="220px" />
      </div>
      <div class="chart-card">
        <div class="chart-card__title">错误率趋势</div>
        <BaseChart :option="errChartOption" width="100%" height="220px" />
      </div>
    </div>

    <div v-if="!isRpsScenario(report.scenarioMode) && !activePercentile" class="charts-row charts-row--single">
      <div class="chart-card">
        <div class="chart-card__title">并发用户趋势</div>
        <BaseChart :option="concChartOption" width="100%" height="220px" />
      </div>
    </div>

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
                <span v-else class="stress-report-results__muted">—</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, watch } from 'vue'
import type { Report } from '@/types'
import MetricCard from '@/components/common/MetricCard.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import { formatNumber, formatMs, formatErrorRate } from '@/utils/format'
import { isRpsScenario, useStressReportDisplay } from '@/composables/useStressReportDisplay'

const props = withDefaults(defineProps<{
  report: Report | null
  showVerdict?: boolean
  selectedApi?: string
}>(), {
  showVerdict: true,
  selectedApi: undefined,
})

const emit = defineEmits<{
  'update:selectedApi': [value: string]
}>()

const reportRef = toRef(props, 'report')
const {
  selectedApiName,
  activePercentile,
  reportVerdict,
  displayMetrics,
  displayRpsAchievement,
  rpsAchievementClass,
  showErrorAnalysis,
  rpsChartOption,
  errChartOption,
  concChartOption,
  percentileChartOption,
  histogramChartOption,
  showHistogramChart,
  errorPieOption,
} = useStressReportDisplay(reportRef)

watch(() => props.selectedApi, (v) => {
  if (v !== undefined && v !== selectedApiName.value) {
    selectedApiName.value = v
  }
}, { immediate: true })

watch(selectedApiName, (v) => {
  emit('update:selectedApi', v)
})

const report = computed(() => props.report)
</script>

<style lang="scss" scoped>
.stress-report-results {
  &__muted {
    color: $text-placeholder;
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

:deep(.achievement--good .metric-card__value) { color: $color-success; }
:deep(.achievement--warn .metric-card__value) { color: $color-warning; }
:deep(.achievement--bad .metric-card__value)  { color: $color-danger; }

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;

  &--single {
    grid-template-columns: 1fr;
  }
}

.report-verdict {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: $border-radius;
  border: 1px solid $border-color-light;
  background: $bg-card;

  &--completed {
    border-color: rgba(56, 113, 220, 0.25);
    background: rgba(56, 113, 220, 0.05);
  }

  &--failed {
    border-color: rgba(224, 34, 110, 0.35);
    background: rgba(224, 34, 110, 0.05);
  }

  &--circuit_broken,
  &--stopped {
    border-color: rgba(255, 156, 25, 0.35);
    background: rgba(255, 156, 25, 0.06);
  }

  &__main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.06);
  }

  &__desc {
    font-size: 13px;
    color: $text-secondary;
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
</style>
