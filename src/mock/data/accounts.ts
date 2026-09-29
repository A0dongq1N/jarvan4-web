import type { AppRole } from '@/utils/permissions'

export interface MockAccount {
  id: string
  username: string
  phone: string
  role: AppRole
  status: 'active' | 'disabled'
  createdAt: string
}

export interface MockApplication {
  id: string
  userId: string
  username: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

const accounts: MockAccount[] = [
  {
    id: 'user-admin',
    username: 'admin',
    phone: '13800000000',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-viewer',
    username: 'viewer',
    phone: '',
    role: 'viewer',
    status: 'active',
    createdAt: '2026-03-01T00:00:00Z',
  },
]

const applications: MockApplication[] = []

let sessionUserId = ''

export function setSessionUser(id: string) {
  sessionUserId = id
}

export function sessionAccount() {
  return accounts.find((item) => item.id === sessionUserId) ?? null
}

export function listAccounts() {
  return accounts.map((item) => ({ ...item }))
}

export function findAccount(username: string) {
  return accounts.find((item) => item.username === username)
}

export function findAccountById(id: string) {
  return accounts.find((item) => item.id === id)
}

export function createOperator(username: string): MockAccount {
  const account: MockAccount = {
    id: 'user-' + Date.now(),
    username,
    phone: '',
    role: 'operator',
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  accounts.push(account)
  return account
}

export function toUserInfo(account: MockAccount) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.username,
    role: account.role,
  }
}

export function updateAccount(id: string, patch: Partial<Pick<MockAccount, 'role' | 'status'>>) {
  const account = accounts.find((item) => item.id === id)
  if (!account) return null
  const admins = accounts.filter((item) => item.role === 'admin' && item.status === 'active')
  const demotingLastAdmin = account.role === 'admin' && admins.length === 1
    && (patch.role && patch.role !== 'admin' || patch.status === 'disabled')
  if (demotingLastAdmin) return null
  if (patch.role) account.role = patch.role
  if (patch.status) account.status = patch.status
  return { ...account }
}

export function listApplications() {
  return applications.map((item) => ({ ...item }))
}

export function pendingApplication(userId: string) {
  return applications.find((item) => item.userId === userId && item.status === 'pending') ?? null
}

export function createApplication(account: MockAccount) {
  if (account.role === 'admin') return null
  const existing = pendingApplication(account.id)
  if (existing) return existing
  const item: MockApplication = {
    id: 'app-' + Date.now(),
    userId: account.id,
    username: account.username,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  applications.unshift(item)
  return item
}

export function reviewApplication(id: string, status: 'approved' | 'rejected') {
  const item = applications.find((row) => row.id === id)
  if (!item || item.status !== 'pending') return null
  item.status = status
  if (status === 'approved') {
    const account = accounts.find((row) => row.id === item.userId)
    if (account?.role === 'viewer') account.role = 'operator'
    else if (account?.role === 'operator') account.role = 'admin'
  }
  return { ...item }
}
