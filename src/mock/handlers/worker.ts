import type { MockHandler } from '../types'
import { ok, fail, pageResult } from '../types'
import { mockWorkers } from '../data/workers'

const workers = [...mockWorkers]

export const workerHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/workers',
    handler: ({ query }) => {
      const { status, page = '1', pageSize = '20' } = query
      let result = [...workers]
      if (status) result = result.filter(w => w.status === status)
      const p = parseInt(page)
      const ps = parseInt(pageSize)
      return pageResult(result.slice((p - 1) * ps, p * ps), result.length)
    },
  },
  {
    method: 'POST',
    url: '/workers/:workerId/offline',
    handler: ({ params }) => {
      const w = workers.find(w => w.workerId === params.workerId)
      if (!w) return fail('节点不存在', 404)
      w.status = 'offline'
      w.currentConcurrency = 0
      w.cpuUsage = 0
      return ok(null)
    },
  },
]
