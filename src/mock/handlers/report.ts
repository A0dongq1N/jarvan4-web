import type { MockHandler } from '../types'
import { ok, fail, pageResult } from '../types'
import { mockReports } from '../data/reports'

let reports = [...mockReports]

export const reportHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/reports',
    handler: ({ query }) => {
      let result = [...reports]
      const { keyword, page = '1', pageSize = '10' } = query
      if (keyword) {
        result = result.filter(r => r.taskName.includes(keyword))
      }
      const p = parseInt(page)
      const ps = parseInt(pageSize)
      const total = result.length
      const list = result.slice((p - 1) * ps, p * ps)
      return pageResult(list, total)
    },
  },
  {
    method: 'GET',
    url: '/reports/:id',
    handler: ({ params }) => {
      const report = reports.find(r => r.id === params.id)
      return report ? ok(report) : fail('报告不存在', 404)
    },
  },
  {
    method: 'DELETE',
    url: '/reports/:id',
    handler: ({ params }) => {
      const idx = reports.findIndex(r => r.id === params.id)
      if (idx === -1) return fail('报告不存在', 404)
      reports.splice(idx, 1)
      return ok(null)
    },
  },
]
