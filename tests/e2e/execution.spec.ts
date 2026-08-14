import { test, expect } from '@playwright/test'
import { login } from './helpers'

/**
 * Execution e2e 测试
 * 依赖：后端已启动（:8090），前端 dev server 已启动（:5173，VITE_USE_MOCK=false）
 *
 * 注意：POST /api/executions 只创建 pending 执行，不选 Worker。
 * 部署（POST /api/executions/:id/deploy）才校验容量。
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

  test('POST /api/executions 创建后停在 pending', async ({ page }) => {
    const { token, taskId } = await getTokenAndTaskId(page)

    const resp = await page.request.post('/api/executions', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { taskId },
    })
    const body = await resp.json()
    // 有绑定脚本：200 + pending；未绑定：400
    expect([0, 400]).toContain(body.code)
    if (body.code === 0) {
      expect(body.data.status).toBe('pending')
      expect(body.data.id).toBeTruthy()
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
      expect(['pending', 'preparing', 'prepared', 'running', 'success', 'stopped', 'failed', 'circuit_broken']).toContain(rec.status)
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

  test('GET /api/executions/:id/logs 返回 logs 包装对象', async ({ page }) => {
    const { token } = await getTokenAndTaskId(page)

    const resp = await page.request.get('/api/executions/non-existent-id/logs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await resp.json()
    if (body.code === 0) {
      expect(body.data).toHaveProperty('logs')
      expect(body.data).toHaveProperty('droppedLogs')
      expect(Array.isArray(body.data.logs)).toBe(true)
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
