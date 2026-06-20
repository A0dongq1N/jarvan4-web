import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e 测试配置
 *
 * 前提条件：
 * 1. 后端已启动（默认 :8090）
 * 2. 前端 dev server 已启动（VITE_USE_MOCK=false，默认 :5173）
 *
 * 运行：npx playwright test --config=playwright.config.ts
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // 指向前端 dev server
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 前端 dev server 需预先启动
  // webServer 配置（可选，若希望 Playwright 自动管理）：
  // webServer: {
  //   command: 'VITE_USE_MOCK=false npm run dev -- --host --port 5173',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
})
