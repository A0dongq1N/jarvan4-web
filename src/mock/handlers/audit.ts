import type { MockHandler } from '../types'
import { pageResult } from '../types'
import { mockAuditLogs } from '../data/auditLogs'

export const auditHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/audit-logs',
    handler: ({ query }) => {
      let result = [...mockAuditLogs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      const { keyword, action, resourceType, startTime, endTime, page = '1', pageSize = '20' } = query
      if (keyword) {
        result = result.filter(
          l =>
            l.username.includes(keyword) ||
            (l.resourceName || '').includes(keyword) ||
            (l.detail || '').includes(keyword)
        )
      }
      if (action) {
        result = result.filter(l => l.action === action)
      }
      if (resourceType) {
        result = result.filter(l => l.resourceType === resourceType)
      }
      if (startTime) {
        result = result.filter(l => new Date(l.createdAt).getTime() >= new Date(startTime).getTime())
      }
      if (endTime) {
        // endTime 精确到天，取当天结束（23:59:59.999）
        const end = new Date(endTime)
        end.setHours(23, 59, 59, 999)
        result = result.filter(l => new Date(l.createdAt).getTime() <= end.getTime())
      }
      const p = parseInt(page)
      const ps = parseInt(pageSize)
      return pageResult(result.slice((p - 1) * ps, p * ps), result.length)
    },
  },
]
