import { test, expect } from '@playwright/test'
import { login } from './helpers'

/**
 * Report e2e 测试
 * 注意：报告由压测完成后自动生成，无 Worker 环境下 DB 中无报告数据。
 * 本测试覆盖接口契约（路由、字段结构、错误码），不依赖真实报告数据。
 */

async function getToken(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('stress_token'))
  expect(token).toBeTruthy()
  return token!
}

test.describe('Report — 压测报告', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('GET /api/reports 列表返回合法分页结构', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/reports?page=1&pageSize=10', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(typeof body.data.total).toBe('number')
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(10)

    // 若有报告，验证列表字段
    if (body.data.list.length > 0) {
      const r = body.data.list[0]
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('taskId')
      expect(r).toHaveProperty('executionId')
      expect(r).toHaveProperty('status')
      expect(r).toHaveProperty('duration')
      expect(r).toHaveProperty('summary')
      expect(r.summary).toHaveProperty('rps')
      expect(r.summary).toHaveProperty('avgResponseTime')
      expect(r.summary).toHaveProperty('p99ResponseTime')
      expect(r.summary).toHaveProperty('errorRate')
      expect(r.summary).toHaveProperty('totalRequests')
      expect(r).toHaveProperty('createdAt')
      expect(r.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    }
  })

  test('GET /api/reports/:id 不存在时返回 404', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.get('/api/reports/non-existent-report-id', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(resp.status()).toBe(404)
    const body = await resp.json()
    expect(body.code).toBe(404)
  })

  test('GET /api/reports/:id 若存在则返回完整字段结构', async ({ page }) => {
    const token = await getToken(page)

    // 先查列表，若有报告则验证详情结构
    const listResp = await page.request.get('/api/reports?page=1&pageSize=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listBody = await listResp.json()

    if (listBody.data.list.length === 0) {
      // 无报告数据，跳过（无 Worker 环境）
      return
    }

    const reportId = listBody.data.list[0].id
    const resp = await page.request.get(`/api/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)

    const r = body.data
    // 核心字段
    expect(r).toHaveProperty('id')
    expect(r).toHaveProperty('taskId')
    expect(r).toHaveProperty('executionId')
    expect(r).toHaveProperty('summary')
    // 时序数据必须是数组
    expect(Array.isArray(r.rpsData)).toBe(true)
    expect(Array.isArray(r.responseTimeData)).toBe(true)
    expect(Array.isArray(r.errorRateData)).toBe(true)
    expect(Array.isArray(r.concurrentData)).toBe(true)
    // 分位数和错误分析必须是数组
    expect(Array.isArray(r.percentiles)).toBe(true)
    expect(Array.isArray(r.errors)).toBe(true)
  })

  test('DELETE /api/reports/:id 不存在时返回非 0 code', async ({ page }) => {
    const token = await getToken(page)

    const resp = await page.request.delete('/api/reports/non-existent-report-id', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    // 不存在时 service 返回 500（find report: entity not found）
    expect(body.code).not.toBe(0)
  })

  test('无 token 访问 /api/reports 返回 401', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    const resp = await page.request.get('/api/reports')
    expect(resp.status()).toBe(401)
  })
})
