/**
 * 用 HTTP 响应头 Date 估算前后端时钟偏差，修正相对时间计算。
 * 仍会在 formatRelativeAgo 中对 diff 做下限钳制，避免偶发负值。
 */
let clockOffsetMs = 0

export function syncServerClock(responseDateHeader?: string | null) {
  if (!responseDateHeader) return
  const serverMs = new Date(responseDateHeader).getTime()
  if (Number.isNaN(serverMs)) return
  clockOffsetMs = serverMs - Date.now()
}

export function correctedNow(): number {
  return Date.now() + clockOffsetMs
}
