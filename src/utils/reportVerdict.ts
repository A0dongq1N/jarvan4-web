import type { Report } from '@/types'

export type ReportVerdictStatus = 'completed' | 'circuit_broken' | 'stopped' | 'failed'

export interface ReportVerdict {
  status: ReportVerdictStatus
  title: string
  description?: string
}

/** 报告顶栏仅描述本次压测如何结束，不做通过/未达标判定（熔断为保护机制，非压测目标）。 */
export function evaluateReportVerdict(report: Report): ReportVerdict {
  switch (report.status) {
    case 'circuit_broken':
      return {
        status: 'circuit_broken',
        title: '熔断停止',
        description: report.errorMsg || '为保护被测系统，压测因错误率超限而自动停止',
      }
    case 'failed':
      return {
        status: 'failed',
        title: '执行失败',
        description: report.errorMsg || '压测执行过程中发生错误',
      }
    case 'stopped':
      return {
        status: 'stopped',
        title: '手动停止',
        description: report.errorMsg || '压测被手动终止',
      }
    default:
      return {
        status: 'completed',
        title: '正常完成',
      }
  }
}
