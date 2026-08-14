/**
 * 格式化时间戳
 */
import { correctedNow } from './serverClock'
export function formatTime(ts: number | string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return format
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
}

/**
 * 实时日志时间（本地时区，统一 HH:mm:ss.SSS，与页面其它时间展示一致）
 */
export function formatLogTime(timestamp: string): string {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return timestamp
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/**
 * 格式化数字（千分位）
 */
export function formatNumber(n: number, decimals = 0): string {
  if (isNaN(n)) return '0'
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 格式化持续时间（秒 → mm:ss 或 hh:mm:ss）
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

/**
 * 格式化文件大小
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 格式化响应时间 (ms)
 * - < 0.01ms: 显示 3 位小数（微秒级精度）
 * - 0.01 ~ 1ms: 显示 2 位小数
 * - 1 ~ 1000ms: 显示 1 位小数
 * - >= 1000ms: 转换为秒
 */
export function formatMs(ms: number): string {
  if (!ms || ms === 0) return '0 ms'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${ms.toFixed(2)} ms`
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/** 错误率展示：有失败时避免四舍五入成 0.00% */
export function formatErrorRate(rate: number): string {
  if (rate <= 0) return '0%'
  const pct = rate * 100
  if (pct >= 0.01) return `${pct.toFixed(2)}%`
  if (pct >= 0.001) return `${pct.toFixed(3)}%`
  if (pct >= 0.0001) return `${pct.toFixed(4)}%`
  return '<0.0001%'
}

/**
 * 直方图桶占比：count>0 时不应显示为 0%，按量级自动选择小数位
 */
export function formatHistogramShare(count: number, total: number): string {
  if (total <= 0 || count <= 0) return '0%'
  const pct = (count / total) * 100
  if (pct >= 10) return `${pct.toFixed(1)}%`
  if (pct >= 1) return `${pct.toFixed(2)}%`
  if (pct >= 0.1) return `${pct.toFixed(2)}%`
  if (pct >= 0.01) return `${pct.toFixed(3)}%`
  if (pct >= 0.001) return `${pct.toFixed(4)}%`
  return '<0.001%'
}

/**
 * 相对时间（几分钟前）
 */
export function timeAgo(ts: number | string): string {
  return formatRelativeAgo(ts, 'verbose')
}

export type RelativeAgoStyle = 'verbose' | 'compact'

/**
 * 心跳距今展示（秒数由服务端计算）
 */
export function formatHeartbeatAgo(sec: number): string {
  const safe = Math.max(0, Math.floor(sec))
  if (safe < 60) return safe <= 0 ? '刚刚' : `${safe}s 前`
  return `${Math.floor(safe / 60)}m 前`
}

/**
 * 相对时间。用服务端时钟校准，并对 diff 做下限钳制，避免前后端时间不一致出现负值。
 */
export function formatRelativeAgo(ts: number | string, style: RelativeAgoStyle = 'verbose'): string {
  const targetMs = new Date(ts).getTime()
  if (Number.isNaN(targetMs)) return '--'

  const diffMs = Math.max(0, correctedNow() - targetMs)
  const sec = Math.floor(diffMs / 1000)

  if (style === 'compact') {
    if (sec < 60) return sec <= 0 ? '刚刚' : `${sec}s 前`
    return `${Math.floor(sec / 60)}m 前`
  }

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

/**
 * 生成唯一 ID
 */
export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
