import { test, expect } from '@playwright/test'
import { login } from './helpers'

/**
 * Audit Log e2e 测试
 * 审计日志由各写操作自动写入，当前后端写入点尚未全部接入，DB 可能为空。
 * 本测试覆盖接口契约（分页结构、字段名、过滤参数）。
 */

async function getToken(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('stress_token'))
  expect(token).toBeTruthy()
  return token!
}

test.describe('Audit Log — 审计日志', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('GET /api/audit-logs 返回合法分页结构', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/audit-logs?page=1&pageSize=20', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(typeof body.data.total).toBe('number')
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  test('GET /api/audit-logs 若有数据则字段结构符合前端契约', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/audit-logs?page=1&pageSize=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)

    if (body.data.list.length > 0) {
      const log = body.data.list[0]
      // 前端期望的所有字段
      expect(log).toHaveProperty('id')
      expect(log).toHaveProperty('userId')
      expect(log).toHaveProperty('username')
      expect(log).toHaveProperty('action')
      expect(log).toHaveProperty('resourceType')
      expect(log).toHaveProperty('ip')
      expect(log).toHaveProperty('createdAt')
      expect(log.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
      // resourceType 必须是合法枚举值
      expect(['task', 'script', 'execution', 'project', 'user', 'worker', 'system']).toContain(log.resourceType)
    }
  })

  test('GET /api/audit-logs?action=login 过滤参数被正确处理', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/audit-logs?action=login&page=1&pageSize=10', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)
    // 若有结果，验证 action 字段正确
    for (const log of body.data.list) {
      expect(log.action).toBe('login')
    }
  })

  test('GET /api/audit-logs?resourceType=task 过滤参数被正确处理', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/audit-logs?resourceType=task&page=1&pageSize=10', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)
    for (const log of body.data.list) {
      expect(log.resourceType).toBe('task')
    }
  })

  test('GET /api/audit-logs 时间范围过滤（YYYY-MM-DD 格式）正常处理', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get(
      '/api/audit-logs?startTime=2026-01-01&endTime=2026-12-31&page=1&pageSize=10',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const body = await resp.json()
    // 不报错即可（接口能正常解析 YYYY-MM-DD 格式）
    expect(body.code).toBe(0)
    expect(typeof body.data.total).toBe('number')
  })

  test('无 token 访问 /api/audit-logs 返回 401', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    const resp = await page.request.get('/api/audit-logs')
    expect(resp.status()).toBe(401)
  })
})
