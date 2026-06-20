import { test, expect } from '@playwright/test'

/**
 * 登录辅助函数：导航到登录页，填写账号密码，提交登录，等待跳转到 /project。
 *
 * 后端实际响应格式：
 *   POST /api/auth/login { username, password }
 *   → { code: 0, data: { token: "...", userInfo: {...} } }
 *
 * 前端将 token 存入 localStorage key: stress_token
 */
export async function login(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })

  // 填写账号密码（测试账号：admin / admin123）
  await page.fill('input[placeholder="用户名"]', 'admin')
  await page.fill('input[placeholder="密码"]', 'admin123')

  // 点击登录按钮
  await page.click('button:has-text("登录")')

  // 等待跳转到项目选择页（登录成功后路由 push /project）
  await page.waitForURL('**/project', { timeout: 10000 })

  // 确认 token 已写入 localStorage
  const token = await page.evaluate(() => localStorage.getItem('stress_token'))
  expect(token).toBeTruthy()
}
