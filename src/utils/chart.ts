/** 数据点较少时显示圆点，避免单点折线不可见 */
export function sparseLineSymbol(dataLength: number) {
  const sparse = dataLength > 0 && dataLength < 3
  return {
    symbol: sparse ? 'circle' : 'none',
    symbolSize: sparse ? 6 : 4,
  } as const
}

const AXIS_COLOR = '#babcbe'
const LABEL_COLOR = '#9c9fa3'

/** 报告时序：后端 Unix 秒 → 毫秒 */
export function normalizeReportTimestamp(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts
}

/** [[timestampMs, value], ...] */
export function metricTimePairs(points: { timestamp: number; value: number }[]) {
  return points.map(p => [normalizeReportTimestamp(p.timestamp), p.value] as [number, number])
}

export function formatChartAxisTime(value: number): string {
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** ECharts 时间轴（毫秒时间戳） */
export function timeXAxis() {
  return {
    type: 'time' as const,
    boundaryGap: false,
    axisLine: { lineStyle: { color: AXIS_COLOR } },
    axisTick: { show: false },
    axisLabel: { color: LABEL_COLOR, fontSize: 11 },
  }
}

/** 报告趋势图时间轴：锁定压测起止，强制显示首尾刻度 */
export function reportTimeXAxis(startMs?: number, endMs?: number) {
  return {
    type: 'time' as const,
    boundaryGap: false,
    ...(startMs != null ? { min: startMs } : {}),
    ...(endMs != null ? { max: endMs } : {}),
    axisLine: { lineStyle: { color: AXIS_COLOR } },
    axisTick: { show: false },
    axisLabel: {
      color: LABEL_COLOR,
      fontSize: 11,
      showMinLabel: true,
      showMaxLabel: true,
      formatter: (value: number) => formatChartAxisTime(value),
    },
  }
}

/** [[timestampMs, value], ...] */
export function timeSeriesPairs(points: { timestamp: number; value: number }[]) {
  return points.map(p => [p.timestamp, p.value])
}
