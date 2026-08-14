import { computed, ref, watch, type Ref } from 'vue'
import type { MetricPoint, PercentileData, Report, RTHistogramBucket } from '@/types'
import { enrichPercentilesWithTargetRps, computeSteadyAvgRps } from '@/utils/apiTargetRps'
import { evaluateReportVerdict } from '@/utils/reportVerdict'
import { buildReportTimeRange, makeLineOption, makeMultiLineOption } from '@/utils/reportCharts'
import { formatNumber, formatHistogramShare } from '@/utils/format'

export function isRpsScenario(mode?: string) {
  return mode === 'rps'
}

export function useStressReportDisplay(report: Ref<Report | null | undefined>) {
  const selectedApiName = ref('')

  const activePercentile = computed(() => {
    if (!selectedApiName.value || !report.value) return null
    return report.value.percentiles.find(p => p.api === selectedApiName.value) ?? null
  })

  watch(report, (r) => {
    if (!r || !r.percentiles.length) return
    if (!isRpsScenario(r.scenarioMode)) return
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

  const reportVerdict = computed(() => {
    if (!report.value) return null
    return evaluateReportVerdict(report.value)
  })

  const reportTimeRange = computed(() => {
    const r = report.value
    if (!r) return undefined
    return buildReportTimeRange(r)
  })

  const displayMetrics = computed(() => {
    if (!report.value) {
      return { rps: 0, avgResponseTime: 0, p99ResponseTime: 0, maxResponseTime: 0, errorRate: 0, totalRequests: 0, successRequests: 0, failedRequests: 0, concurrent: 0 }
    }
    if (!selectedApiName.value) {
      return report.value.summary
    }
    const p = report.value.percentiles.find(x => x.api === selectedApiName.value)
    if (!p) return report.value.summary
    return {
      rps: p.peakRps || report.value.summary.rps,
      avgResponseTime: p.p50,
      p99ResponseTime: p.p99,
      maxResponseTime: p.max,
      errorRate: p.errorRate,
      totalRequests: p.requests,
      successRequests: p.requests - p.errors,
      failedRequests: p.errors,
      concurrent: report.value.summary.concurrent,
    }
  })

  const rpsAchievement = computed(() => {
    if (!isRpsScenario(report.value?.scenarioMode) || !report.value?.targetRps) return 0
    const target = report.value.targetRps
    const steadyAvg = computeSteadyAvgRps(report.value.rpsData, target)
    const actual = steadyAvg ?? report.value.summary.rps
    return Math.min(100, parseFloat((actual / target * 100).toFixed(2)))
  })

  const displayRpsAchievement = computed(() => {
    if (!isRpsScenario(report.value?.scenarioMode) || !report.value?.targetRps) return 0
    if (!selectedApiName.value) return rpsAchievement.value
    const p = report.value.percentiles.find(x => x.api === selectedApiName.value)
    if (!p || !p.targetRps) return 0
    const compareRps = p.steadyAvgRps ?? p.avgRps ?? p.actualRps ?? 0
    return Math.min(100, parseFloat((compareRps / p.targetRps * 100).toFixed(2)))
  })

  const rpsAchievementClass = computed(() => {
    const v = displayRpsAchievement.value
    if (v >= 95) return 'achievement--good'
    if (v >= 80) return 'achievement--warn'
    return 'achievement--bad'
  })

  const showErrorAnalysis = computed(() => {
    const r = report.value
    if (!r) return false
    return !!(r.errors?.length || r.errorMsg || r.summary.failedRequests > 0)
  })

  function pickChartSeries(global?: MetricPoint[], api?: MetricPoint[]): MetricPoint[] {
    if (activePercentile.value && api?.length) return api
    return global ?? []
  }

  function pickHistogramSeries(global?: RTHistogramBucket[], api?: RTHistogramBucket[]): RTHistogramBucket[] {
    if (activePercentile.value && api?.length) return api
    return global ?? []
  }

  /** 展示用：裁掉首尾 count=0 的桶，收窄横轴范围 */
  function trimHistogramBuckets(data: RTHistogramBucket[]): RTHistogramBucket[] {
    let start = 0
    let end = data.length - 1
    while (start < data.length && data[start].count === 0) start++
    while (end > start && data[end].count === 0) end--
    if (start > end) return []
    return data.slice(start, end + 1)
  }

  function histogramBarCount(params: { value?: unknown; data?: unknown }): number {
    if (typeof params.data === 'number') return params.data
    if (typeof params.value === 'number') return params.value
    if (Array.isArray(params.value) && typeof params.value[1] === 'number') return params.value[1]
    return 0
  }

  const histogramChartOption = computed(() => {
    if (!report.value) return {}
    const raw = pickHistogramSeries(report.value.rtHistogramData, activePercentile.value?.rtHistogramData)
    const data = trimHistogramBuckets(raw)
    if (!data.length) return {}
    const total = raw.reduce((sum, b) => sum + b.count, 0)
    if (total === 0) return {}
    return {
      grid: { top: 36, right: 16, bottom: 56, left: 52 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { name: string; value: number; dataIndex: number }[]) => {
          const p = params[0]
          if (!p) return ''
          const count = typeof p.value === 'number' ? p.value : (data[p.dataIndex]?.count ?? 0)
          return `${p.name}<br/>请求数：${formatNumber(count, 0)}（${formatHistogramShare(count, total)}）`
        },
      },
      xAxis: {
        type: 'category',
        data: data.map(b => b.label),
        axisLabel: { rotate: 28, fontSize: 10 },
      },
      yAxis: { type: 'value', name: '请求数', minInterval: 1 },
      series: [{
        type: 'bar',
        data: data.map(b => b.count),
        itemStyle: { color: '#3871dc', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 40,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: '#666',
          formatter: (p: { value?: unknown; data?: unknown }) => {
            const count = histogramBarCount(p)
            return `${formatNumber(count, 0)}\n(${formatHistogramShare(count, total)})`
          },
        },
      }],
    }
  })

  const showHistogramChart = computed(() => {
    if (!report.value) return false
    const data = pickHistogramSeries(report.value.rtHistogramData, activePercentile.value?.rtHistogramData)
    return data.length > 0 && data.some(b => b.count > 0)
  })

  const rpsChartOption = computed(() => {
    if (!report.value) return {}
    const data = pickChartSeries(report.value.rpsData, activePercentile.value?.rpsData)
    const targetValue = isRpsScenario(report.value.scenarioMode)
      ? (activePercentile.value?.targetRps ?? report.value.targetRps)
      : undefined
    return makeLineOption(data, '#3871dc', v => String(Math.ceil(v)), targetValue, false, reportTimeRange.value)
  })

  const errChartOption = computed(() => {
    if (!report.value) return {}
    const data = pickChartSeries(report.value.errorRateData, activePercentile.value?.errorRateData)
    return makeLineOption(data, '#e0226e', v => v.toFixed(2) + '%', undefined, false, reportTimeRange.value)
  })

  const concChartOption = computed(() =>
    report.value ? makeLineOption(report.value.concurrentData, '#1b855e', undefined, undefined, true, reportTimeRange.value) : {},
  )

  const percentileChartOption = computed(() => {
    if (!report.value) return {}
    const p95 = pickChartSeries(report.value.p95Data, activePercentile.value?.p95Data)
    const p99 = pickChartSeries(report.value.p99Data, activePercentile.value?.p99Data)
    const max = pickChartSeries(report.value.maxData, activePercentile.value?.maxData)
    if (!p95.length && !p99.length && !max.length) return {}
    const series: {
      name: string
      data: MetricPoint[]
      color: string
      lineStyle?: { type?: 'solid' | 'dashed' | 'dotted'; width?: number }
      z?: number
    }[] = []
    if (p95.length) series.push({ name: 'P95', data: p95, color: '#ff9c19', z: 2 })
    if (p99.length) series.push({ name: 'P99', data: p99, color: '#e0226e', z: 4 })
    if (max.length) series.push({ name: 'Max', data: max, color: '#3871dc', z: 3 })
    return makeMultiLineOption(
      series,
      v => v.toFixed(2) + ' ms',
      reportTimeRange.value,
    )
  })

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

  return {
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
  }
}
