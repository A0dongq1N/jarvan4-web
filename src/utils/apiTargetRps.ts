import type { MetricPoint, PercentileData } from '@/types'

export interface ScriptWeightSnapshot {
  scriptName: string
  weight: number
}

/** 稳态区间：达到目标 90% 起至倒数第 2 个点（排除末尾 flush） */
function steadyStateSlice(values: number[], targetRps: number): number[] {
  if (!values.length) return []
  const end = values.length >= 2 ? values.length - 1 : values.length
  let start = 0
  if (targetRps > 0) {
    const threshold = targetRps * 0.9
    for (let i = 0; i < end; i++) {
      if (values[i] >= threshold) {
        start = i
        break
      }
    }
  }
  if (start >= end) {
    start = Math.floor(values.length / 4)
    if (start >= end) start = 0
  }
  return values.slice(start, end)
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))
  return sorted[idx]
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

/**
 * 稳态 P95 峰值（展示用，抑制单秒抖动）。
 *
 * 只统计有流量的秒：链路中「每 VU 只调一次」的接口（如登录）绝大多数秒为 0，
 * 把这些 0 计入分位数会让 P95 落在 0 附近，出现「峰值 < 平均」。
 */
export function computeSteadyPeakRps(rpsData: MetricPoint[] | undefined, targetRps: number): number | undefined {
  if (!rpsData?.length) return undefined
  const steady = steadyStateSlice(rpsData.map(p => p.value), targetRps).filter(v => v > 0)
  if (!steady.length) return undefined
  return percentile(steady, 0.95)
}

/** 稳态平均 RPS（与目标对比更公允，排除爬坡） */
export function computeSteadyAvgRps(rpsData: MetricPoint[] | undefined, targetRps: number): number | undefined {
  if (!rpsData?.length) return undefined
  const steady = steadyStateSlice(rpsData.map(p => p.value), targetRps)
  if (!steady.length) return undefined
  return average(steady)
}

/**
 * 为接口维度指标计算目标 RPS 与达成差距。
 *
 * 1. 脚本目标 = 全局目标 × 实际请求占比（无数据时回退权重占比）
 * 2. 接口目标 = 脚本目标 ×（该接口请求数 / 脚本内最大请求数）
 * 3. 峰值 = 稳态 P95；平均 = 稳态均值；相差 = 目标 − 平均
 *
 * 达成度用平均值衡量：峰值是 P95 分位，天然高于均值约 1~2%，拿它对比目标会把
 * 正常的秒级抖动误读成超发。
 */
export function enrichPercentilesWithTargetRps(
  percentiles: PercentileData[],
  scriptSnapshots: ScriptWeightSnapshot[],
  globalTargetRps: number,
  durationSec = 0,
): PercentileData[] {
  if (!percentiles.length || globalTargetRps <= 0 || !scriptSnapshots.length) {
    return percentiles
  }

  const totalWeight = scriptSnapshots.reduce((s, sc) => s + sc.weight, 0)
  if (totalWeight <= 0) return percentiles

  const byScript: Record<string, PercentileData[]> = {}
  for (const p of percentiles) {
    const sn = p.scriptName || ''
    if (!byScript[sn]) byScript[sn] = []
    byScript[sn].push(p)
  }

  const maxRequestsByScript: Record<string, number> = {}
  let totalScriptIterations = 0
  for (const [sn, group] of Object.entries(byScript)) {
    const mx = Math.max(0, ...group.map(x => x.requests || 0))
    maxRequestsByScript[sn] = mx
    totalScriptIterations += mx
  }

  const scriptTargetByName: Record<string, number> = {}
  for (const sc of scriptSnapshots) {
    if (totalScriptIterations > 0 && maxRequestsByScript[sc.scriptName] > 0) {
      scriptTargetByName[sc.scriptName] = globalTargetRps * maxRequestsByScript[sc.scriptName] / totalScriptIterations
    } else {
      scriptTargetByName[sc.scriptName] = globalTargetRps * sc.weight / totalWeight
    }
  }

  return percentiles.map(p => {
    const sn = p.scriptName || ''
    const scriptTargetRps = scriptTargetByName[sn]
    if (!scriptTargetRps) return p

    const avgRps = p.avgRps ?? (durationSec > 0 ? p.requests / durationSec : p.actualRps ?? 0)
    const rawPeak = p.peakRps
      ?? (p.rpsData?.length ? Math.max(...p.rpsData.map(pt => pt.value)) : undefined)

    const iterationRequests = maxRequestsByScript[sn] || 0
    let targetRps: number
    if (iterationRequests > 0 && p.requests > 0) {
      targetRps = scriptTargetRps * (p.requests / iterationRequests)
    } else {
      targetRps = scriptTargetRps
    }

    const steadyPeakRps = computeSteadyPeakRps(p.rpsData, targetRps) ?? rawPeak
    const steadyAvgRps = computeSteadyAvgRps(p.rpsData, targetRps) ?? avgRps
    const displayPeak = steadyPeakRps ?? rawPeak ?? 0
    const rpsGap = targetRps - steadyAvgRps
    const rpsGapPercent = targetRps > 0 ? (rpsGap / targetRps) * 100 : 0

    return {
      ...p,
      avgRps: steadyAvgRps,
      actualRps: steadyAvgRps,
      peakRps: displayPeak,
      steadyAvgRps,
      scriptTargetRps,
      targetRps,
      rpsGap,
      rpsGapPercent,
    }
  })
}
