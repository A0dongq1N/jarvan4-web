export type AppRole = 'admin' | 'operator' | 'viewer'

export interface PermissionItem {
  key: string
  label: string
  allowed: boolean
}

const CATALOG: { key: string; label: string }[] = [
  { key: 'view', label: '查看项目、任务、执行和报告' },
  { key: 'edit', label: '创建和修改项目、任务' },
  { key: 'run', label: '绑定脚本、部署、开始和停止压测' },
  { key: 'offline', label: '下线节点' },
  { key: 'upgrade', label: '升级节点' },
  { key: 'scheduling', label: '修改全局调度配额' },
  { key: 'users', label: '管理用户、审批权限申请' },
]

export function normalizeRole(role?: string | null): AppRole {
  if (role === 'admin' || role === 'operator' || role === 'viewer') return role
  if (role === 'user') return 'operator'
  return 'viewer'
}

export function permissionItems(role?: string | null): PermissionItem[] {
  const current = normalizeRole(role)
  const allow = new Set<string>(['view'])
  if (current === 'operator' || current === 'admin') {
    allow.add('edit')
    allow.add('run')
  }
  if (current === 'admin') {
    allow.add('offline')
    allow.add('upgrade')
    allow.add('scheduling')
    allow.add('users')
  }
  return CATALOG.map((item) => ({ ...item, allowed: allow.has(item.key) }))
}

export function can(role: string | null | undefined, key: string): boolean {
  return permissionItems(role).some((item) => item.key === key && item.allowed)
}

export const roleLabel: Record<AppRole, string> = {
  admin: '管理员',
  operator: '操作员',
  viewer: '观察员',
}
