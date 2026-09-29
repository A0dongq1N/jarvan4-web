import type { MockHandler } from '../types'
import { ok, fail } from '../types'
import { createOperator, findAccount, setSessionUser, toUserInfo } from '../data/accounts'

// 模拟短信验证码存储（手机号 → 验证码）
const smsCodeStore = new Map<string, string>()

// 固定公钥：仅让前端 Web Crypto 能 import；mock 登录不解密校验密文。
const MOCK_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5tOY3QMLILYKRqYktD9B
qAP9smbUN2Z8ZDvuRQn65OGNDMeF9Uyd0iep/CTmMqtQ0SEJyb39EGnw+2WZiEBK
wRbrTrWAk7YbiYZAAuYarTMYJP5nfroEp0v2lLhWgX0h0N3PNECCum8L+/RYuPA5
QhEqotm4DN6l8bGD9Kr0Hjv2zjGutKZ11MKP6Y258YKpJGi2zL5gxIjUA28Sj8l9
kMvJ2oL23t/eNUPlylnPCjpWDJtFCag/cgx3lSGi4GMhqd4vLFqa/8FkbZxPn4tD
0wTM1ULWQpfBXr3FN4+tjxHbezeIzevaoxb7zptrJEU8xn9ttb2N6MW0M4yKzBKX
7wIDAQAB
-----END PUBLIC KEY-----`

export const authHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/auth/login-key',
    handler: () =>
      ok({
        keyId: 'mock-key',
        publicKeyPem: MOCK_PUBLIC_KEY_PEM,
        nonce: 'mock-nonce-' + Date.now(),
        expireAt: Math.floor(Date.now() / 1000) + 120,
      }),
  },
  {
    method: 'POST',
    url: '/auth/login',
    delay: 600,
    handler: ({ body }) => {
      const { username, password, keyId } = body as {
        username: string
        password: string
        keyId?: string
      }
      if (!username || !password || !keyId) {
        return fail('用户名或密码错误', 401)
      }
      let account = findAccount(username)
      let registered = false
      if (!account) {
        account = createOperator(username)
        registered = true
      }
      if (account.status === 'disabled') {
        return fail('账号已停用', 403)
      }
      setSessionUser(account.id)
      return ok({
        token: 'mock_token_' + account.id,
        registered,
        userInfo: toUserInfo(account),
      })
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
      const account = findAccount('admin')
      if (!account) return fail('验证码错误或已过期', 401)
      setSessionUser(account.id)
      return ok({
        token: 'mock_token_sms_' + account.id,
        registered: false,
        userInfo: toUserInfo(account),
      })
    },
  },
  {
    method: 'POST',
    url: '/auth/logout',
    handler: () => ok(null),
  },
]
