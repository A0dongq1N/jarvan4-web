import type { MockHandler } from '../types'
import { ok, fail } from '../types'
import type { UserInfo } from '@/types'

const mockUser: UserInfo = {
  id: 'user001',
  username: 'admin',
  displayName: '管理员',
  role: 'admin',
}

// 模拟短信验证码存储（手机号 → 验证码）
const smsCodeStore = new Map<string, string>()

export const authHandlers: MockHandler[] = [
  {
    method: 'POST',
    url: '/auth/login',
    delay: 600,
    handler: ({ body }) => {
      const { username, password } = body as { username: string; password: string }
      if (username === 'admin' && password === 'admin123') {
        return ok({
          token: 'mock_token_' + Date.now(),
          userInfo: mockUser,
        })
      }
      return fail('用户名或密码错误', 401)
    },
  },
  {
    method: 'POST',
    url: '/auth/sms/send',
    delay: 800,
    handler: ({ body }) => {
      const { phone } = body as { phone: string }
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        return fail('手机号格式错误', 400)
      }
      // mock：固定验证码 123456
      smsCodeStore.set(phone, '123456')
      return ok(null)
    },
  },
  {
    method: 'POST',
    url: '/auth/login/sms',
    delay: 600,
    handler: ({ body }) => {
      const { phone, code } = body as { phone: string; code: string }
      const stored = smsCodeStore.get(phone)
      if (!stored || stored !== code) {
        return fail('验证码错误或已过期', 401)
      }
      smsCodeStore.delete(phone)
      return ok({
        token: 'mock_token_sms_' + Date.now(),
        userInfo: mockUser,
      })
    },
  },
  {
    method: 'POST',
    url: '/auth/logout',
    handler: () => ok(null),
  },
  {
    method: 'GET',
    url: '/auth/profile',
    handler: () => ok(mockUser),
  },
]
