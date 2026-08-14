import type { MetricPoint } from '@/types'
import { formatChartAxisTime, metricTimePairs, normalizeReportTimestamp, reportTimeXAxis } from '@/utils/chart'

export interface ReportChartTimeRange {
  startMs: number
  endMs: number
}

export function buildReportTimeRange(report: {
  startTime?: string
  endTime?: string
  rpsData: MetricPoint[]
  p95Data?: MetricPoint[]
  p99Data?: MetricPoint[]
  maxData?: MetricPoint[]
  errorRateData: MetricPoint[]
  concurrentData: MetricPoint[]
}): ReportChartTimeRange | undefined {
  if (!report.startTime || !report.endTime) return undefined
  let startMs = Date.parse(report.startTime)
  let endMs = Date.parse(report.endTime)
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return undefined

  const series: MetricPoint[] = [
    ...report.rpsData,
    ...(report.p95Data ?? []),
    ...(report.p99Data ?? []),
    ...(report.maxData ?? []),
    ...report.errorRateData,
    ...report.concurrentData,
  ]
  const firstDataMs = series.reduce(
    (min, p) => Math.min(min, normalizeReportTimestamp(p.timestamp)),
    Number.POSITIVE_INFINITY,
  )
  if (Number.isFinite(firstDataMs) && firstDataMs > startMs) {
    startMs = firstDataMs
  }
  const lastDataMs = series.reduce(
    (max, p) => Math.max(max, normalizeReportTimestamp(p.timestamp)),
    0,
  )
  if (lastDataMs > startMs && lastDataMs < endMs) {
    endMs = lastDataMs
  }
  return { startMs, endMs }
}

export interface MultiLineSeries {
  name: string
  data: MetricPoint[]
  color: string
  lineStyle?: { type?: 'solid' | 'dashed' | 'dotted'; width?: number }
  z?: number
}

export function makeMultiLineOption(
  seriesList: MultiLineSeries[],
  yAxisFormatter?: (v: number) => string,
  timeRange?: ReportChartTimeRange,
) {
  const SPLIT_COLOR = '#ececed'
  const LABEL_COLOR = '#9c9fa3'
  return {
    grid: { top: 28, right: 16, bottom: 28, left: 60 },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: LABEL_COLOR, fontSize: 11 },
    },
    xAxis: reportTimeXAxis(timeRange?.startMs, timeRange?.endMs),
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
        const lines = params.map((p: any) => {
          const val = Array.isArray(p.value) ? p.value[1] : p.value
          return `<span style="color:${p.color}">${p.seriesName}</span> <b>${yAxisFormatter(val)}</b>`
        })
        const time = Array.isArray(params[0]?.value)
          ? formatChartAxisTime(params[0].value[0])
          : params[0]?.axisValue
        return `<span style="color:#9c9fa3;font-size:11px">${time}</span><br/>${lines.join('<br/>')}`
      } : undefined,
    },
    series: seriesList.map(s => ({
      name: s.name,
      type: 'line',
      color: s.color,
      z: s.z,
      data: metricTimePairs(s.data),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: s.color, width: 2, ...s.lineStyle },
    })),
  }
}

export function makeLineOption(
  data: MetricPoint[],
  color: string,
  yAxisFormatter?: (v: number) => string,
  targetValue?: number,
  areaFill = true,
  timeRange?: ReportChartTimeRange,
) {
  const SPLIT_COLOR = '#ececed'
  const LABEL_COLOR = '#9c9fa3'
  return {
    grid: { top: 12, right: 16, bottom: 28, left: 60 },
    xAxis: reportTimeXAxis(timeRange?.startMs, timeRange?.endMs),
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
        const val = Array.isArray(p.value) ? p.value[1] : p.value
        const time = Array.isArray(p.value) ? formatChartAxisTime(p.value[0]) : p.axisValue
        return `<span style="color:#9c9fa3;font-size:11px">${time}</span><br/><b style="color:${color}">${yAxisFormatter(val)}</b>`
      } : undefined,
    },
    series: [{
      type: 'line',
      color,
      data: metricTimePairs(data),
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 2 },
      ...(areaFill ? {
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color.replace(')', ',0.18)').replace('rgb', 'rgba') },
              { offset: 1, color: color.replace(')', ',0)').replace('rgb', 'rgba') },
            ],
          },
        },
      } : {}),
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
