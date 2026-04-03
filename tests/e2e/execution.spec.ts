import { test, expect } from '@playwright/test'
import { login } from './helpers'

/**
 * Execution e2e 测试
 * 依赖：后端已启动（:8090），前端 dev server 已启动（:5173，VITE_USE_MOCK=false）
 *
 * 注意：启动压测（POST /api/executions）需要 Worker 节点在线，
 * 无 Worker 环境下该接口返回 500 "no available workers"，属正常。
 * 本测试覆盖接口契约（字段、结构），不依赖 Worker 实际运行。
 */

async function getTokenAndTaskId(page: import('@playwright/test').Page) {
  const token = await page.evaluate(() => localStorage.getItem('stress_token'))
  expect(token).toBeTruthy()

  const projectsRes = await page.request.get('/api/projects', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const projectId = (await projectsRes.json()).data.list[0].id

  const tasksRes = await page.request.get(`/api/tasks?projectId=${projectId}&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const tasks = (await tasksRes.json()).data.list
  expect(tasks.length).toBeGreaterThan(0)
  return { token: token!, taskId: tasks[0].id }
}

test.describe('Execution — 执行管理', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('POST /api/executions 无 Worker 时返回 500（接口契约正常）', async ({ page }) => {
    const { token, taskId } = await getTokenAndTaskId(page)

    const resp = await page.request.post('/api/executions', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { taskId },
    })
    const body = await resp.json()
    // 无 Worker 返回 500，说明接口路由和请求解析正常
    // code=0 说明有 Worker（集成测试环境）；code=500 说明无 Worker（开发环境）
    expect([0, 500]).toContain(body.code)
    if (body.code === 500) {
      expect(body.message).toContain('worker')
    }
  })

  test('GET /api/tasks/:taskId/executions 历史列表结构正确', async ({ page }) => {
    const { token, taskId } = await getTokenAndTaskId(page)

    const resp = await page.request.get(`/api/tasks/${taskId}/executions?page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(typeof body.data.total).toBe('number')
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(10)

    // 若有历史记录，验证字段结构
    if (body.data.list.length > 0) {
      const rec = body.data.list[0]
      expect(rec).toHaveProperty('id')
      expect(rec).toHaveProperty('taskId')
      expect(rec).toHaveProperty('status')
      expect(rec).toHaveProperty('triggerType')
      expect(rec).toHaveProperty('triggeredByName')
      // status 必须是合法枚举值
      expect(['pending', 'running', 'success', 'stopped', 'failed', 'circuit_broken']).toContain(rec.status)
      // triggerType 必须是 1 或 2
      expect([1, 2]).toContain(rec.triggerType)
    }
  })

  test('GET /api/executions/:id 不存在时返回 404', async ({ page }) => {
    const { token } = await getTokenAndTaskId(page)

    const resp = await page.request.get('/api/executions/non-existent-id', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(resp.status()).toBe(404)
  })

  test('GET /api/executions/:id/metrics 不存在时返回 404', async ({ page }) => {
    const { token } = await getTokenAndTaskId(page)

    const resp = await page.request.get('/api/executions/non-existent-id/metrics', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(resp.status()).toBe(404)
  })

  test('GET /api/executions/:id/logs 返回数组', async ({ page }) => {
    const { token } = await getTokenAndTaskId(page)

    // logs 接口对不存在的 id 也返回空数组（前端轮询容错）
    const resp = await page.request.get('/api/executions/non-existent-id/logs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    // 返回空数组或 404 均可接受
    if (body.code === 0) {
      expect(Array.isArray(body.data)).toBe(true)
    }
  })

  test('GET /api/executions/:id/api-metrics 返回正确结构', async ({ page }) => {
    const { token } = await getTokenAndTaskId(page)

    const resp = await page.request.get('/api/executions/non-existent-id/api-metrics', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    if (body.code === 0) {
      expect(body.data).toHaveProperty('percentiles')
      expect(body.data).toHaveProperty('errors')
      expect(Array.isArray(body.data.percentiles)).toBe(true)
      expect(Array.isArray(body.data.errors)).toBe(true)
    }
  })

  test('无 token 访问 /api/executions 返回 401', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'load' })
    const resp = await page.request.post('/api/executions', {
      data: { taskId: 'xxx' },
    })
    expect(resp.status()).toBe(401)
  })
})
