import type { TaskStatus } from '@/types'

/** 尚未结束、可进入执行页查看进度的状态 */
export const ACTIVE_EXECUTION_STATUSES: TaskStatus[] = [
  'pending',
  'preparing',
  'prepared',
  'running',
]

export function isActiveExecution(status: TaskStatus): boolean {
  return ACTIVE_EXECUTION_STATUSES.includes(status)
}

export function executionMonitorPath(taskId: string, executionId?: string) {
  return {
    path: `/execution/${taskId}`,
    query: executionId ? { execId: executionId } : {},
  }
}
