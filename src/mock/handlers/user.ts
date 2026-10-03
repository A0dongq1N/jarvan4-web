import type { MockHandler } from '../types'
import { ok, fail } from '../types'
import { permissionItems } from '@/utils/permissions'
import {
  createApplication,
  findAccountById,
  listAccounts,
  listApplications,
  pendingApplication,
  reviewApplication,
  sessionAccount,
  updateAccount,
} from '../data/accounts'

function currentUserId(body: unknown) {
  return (body as { userId?: string })?.userId || sessionAccount()?.id || ''
}

export const userHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/me',
    handler: () => {
      const account = sessionAccount()
      if (!account) return fail('未登录', 401)
      return ok({
        id: account.id,
        username: account.username,
        phone: account.phone,
        status: account.status,
        createdAt: account.createdAt,
        permissions: permissionItems(account.role),
        applicationPending: !!pendingApplication(account.id),
      })
    },
  },
  {
    method: 'POST',
    url: '/me/applications',
    handler: ({ body }) => {
      const account = findAccountById(currentUserId(body))
      if (!account) return fail('未登录', 401)
      if (account.role === 'admin') return fail('当前账号已具备全部权限', 400)
      const item = createApplication(account)
      if (!item) return fail('无法提交申请', 400)
      return ok(item)
    },
  },
  {
    method: 'GET',
    url: '/users',
    handler: () => ok({
      list: listAccounts(),
      applications: listApplications().filter((item) => item.status === 'pending'),
    }),
  },
  {
    method: 'PUT',
    url: '/users/:id',
    handler: ({ params, body }) => {
      const patch = body as { role?: 'admin' | 'operator' | 'viewer'; status?: 'active' | 'disabled' }
      const updated = updateAccount(params.id, patch)
      if (!updated) return fail('不能停用或降级最后一个管理员', 400)
      return ok(updated)
    },
  },
  {
    method: 'POST',
    url: '/users/applications/:id/approve',
    handler: ({ params }) => {
      const item = reviewApplication(params.id, 'approved')
      if (!item) return fail('申请不存在或已处理', 400)
      return ok(item)
    },
  },
  {
    method: 'POST',
    url: '/users/applications/:id/reject',
    handler: ({ params }) => {
      const item = reviewApplication(params.id, 'rejected')
      if (!item) return fail('申请不存在或已处理', 400)
      return ok(item)
    },
  },
]
