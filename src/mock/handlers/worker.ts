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
    url: '/workers/upgrade',
    handler: ({ body }) => {
      const ids = ((body as { workerIds?: string[] } | null)?.workerIds) || []
      const results = ids.map(id => {
        const w = workers.find(item => item.workerId === id)
        if (!w) return { workerId: id, hostname: id, status: 'failed', message: '节点不存在' }
        if (w.status !== 'online') return { workerId: id, hostname: w.hostname, status: 'skipped', message: '节点不可升级' }
        w.binarySha256 = 'abc123def456'
        w.configRevision = 'cfg123def456'
        return { workerId: id, hostname: w.hostname, status: 'succeeded', message: '' }
      })
      return ok({
        batchId: 'mock-batch',
        sha256: 'abc123def456',
        configRevision: 'cfg123def456',
        results,
      })
    },
  },
  {
    method: 'GET',
    url: '/workers/upgrades/:batchId',
    handler: () => ok({
      batchId: 'mock-batch',
      sha256: 'abc123def456',
      configRevision: 'cfg123def456',
      results: workers.filter(w => w.status === 'online').map(w => ({
        workerId: w.workerId,
        hostname: w.hostname,
        status: 'succeeded',
        message: '',
      })),
    }),
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
