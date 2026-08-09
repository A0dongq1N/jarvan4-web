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

/** [[timestampMs, value], ...] */
export function timeSeriesPairs(points: { timestamp: number; value: number }[]) {
  return points.map(p => [p.timestamp, p.value])
}
