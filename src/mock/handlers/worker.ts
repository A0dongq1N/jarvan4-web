import type { MockHandler } from '../types'
import { ok, fail } from '../types'
import { mockWorkers } from '../data/workers'

const workers = [...mockWorkers]

export const workerHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/workers',
    handler: ({ query }) => {
      const { status, keyword = '', page = '1', pageSize = '20' } = query
      let result = [...workers]
      if (status) result = result.filter(w => w.status === status)
      const kw = keyword.trim().toLowerCase()
      if (kw) {
        result = result.filter(w =>
          w.hostname.toLowerCase().includes(kw) || w.ip.toLowerCase().includes(kw),
        )
      }
      const busyCount = result.filter(w => w.status === 'busy').length
      const onlineCount = result.filter(w => w.status === 'online').length
      const offlineCount = result.filter(w => w.status === 'offline').length
      const usedConcurrency = result.reduce((s, w) => s + w.currentConcurrency, 0)
      const totalConcurrency = result
        .filter(w => w.status !== 'offline')
        .reduce((s, w) => s + w.maxConcurrency, 0)
      const p = parseInt(page) || 1
      const ps = parseInt(pageSize) || 20
      return ok({
        list: result.slice((p - 1) * ps, p * ps),
        total: result.length,
        page: p,
        pageSize: ps,
        busyCount,
        onlineCount,
        offlineCount,
        usedConcurrency,
        totalConcurrency,
      })
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
