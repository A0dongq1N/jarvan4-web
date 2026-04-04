import { test, expect } from '@playwright/test'
import { login } from './helpers'

/**
 * Worker e2e 测试
 * Worker 节点通过 Nacos 注册，无真实 Worker 环境时 DB 为空。
 * 本测试覆盖接口契约（分页结构、字段名、过滤参数、offline 路由）。
 */

async function getToken(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('stress_token'))
  expect(token).toBeTruthy()
  return token!
}

test.describe('Worker — 节点管理', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('GET /api/workers 返回合法分页结构', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/workers?page=1&pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(typeof body.data.total).toBe('number')
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  test('GET /api/workers 若有节点则字段结构符合前端契约', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/workers?page=1&pageSize=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)

    if (body.data.list.length > 0) {
      const w = body.data.list[0]
      expect(w).toHaveProperty('id')
      expect(w).toHaveProperty('workerId')
      expect(w).toHaveProperty('hostname')
      expect(w).toHaveProperty('ip')
      expect(w).toHaveProperty('port')
      expect(w).toHaveProperty('status')
      expect(w).toHaveProperty('cpuCores')
      expect(w).toHaveProperty('memTotalGb')
      expect(w).toHaveProperty('maxConcurrency')
      expect(w).toHaveProperty('cpuUsage')
      expect(w).toHaveProperty('memUsage')
      expect(w).toHaveProperty('currentConcurrency')
      expect(w).toHaveProperty('lastHeartbeat')
      expect(['online', 'busy', 'offline']).toContain(w.status)
    }
  })

  test('GET /api/workers?status=online 过滤参数被正确处理', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/workers?status=online&page=1&pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)
    // 若有结果，验证 status 字段均为 online
    for (const w of body.data.list) {
      expect(w.status).toBe('online')
    }
  })

  test('POST /api/workers/:workerId/offline 路由存在（节点不存在返回 500）', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.post('/api/workers/non-existent-worker/offline', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    // 节点不存在时返回 500，说明路由已注册且请求到达 handler
    expect([0, 500]).toContain(body.code)
  })

  test('无 token 访问 /api/workers 返回 401', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    const resp = await page.request.get('/api/workers')
    expect(resp.status()).toBe(401)
  })
})
