import type { TaskStatus } from '@/types'

export interface DeployErrorView {
  title: string
  description: string
}

/** 把 Worker/Master 返回的部署错误收成短标题 + 可换行说明，兼容历史长文案。 */
export function formatDeployError(raw: string): DeployErrorView {
  const text = raw
    .replace(/^worker rejected:\s*/i, '')
    .replace(/^plugin compatibility\s+\S+:\s*/i, '')
    .replace(/^prepare script \S+ failed on worker \S+:\s*/i, '')
    .replace(/\s*\(Worker ABI=\d+ build=\S+，不兼容时请重启 Worker 并用当前平台代码重编脚本\)\s*$/, '')
    .trim()

  const abi = text.match(/ABI[= ](\d+)/)?.[1]
  const build = text.match(/build[= ]([0-9a-f]+)/i)?.[1]
  const meta = [abi && `ABI ${abi}`, build && `build ${build}`].filter(Boolean).join(' · ')

  if (/包版本不一致|different version of package/i.test(text)) {
    const pkgMatch = text.match(/的\s+(\S+)\s+包版本/)
    const pkg = pkgMatch?.[1]?.split('/').pop() || 'spec'
    return {
      title: '脚本与 Worker 版本不一致',
      description: [
        `插件与 Worker 的 ${pkg} 包不是同一版本${meta ? `（${meta}）` : ''}。`,
        '请用当前平台代码重新编译脚本并上传，或重启 Worker 后再部署。',
      ].join('\n'),
    }
  }
  if (/已在当前 Worker|already loaded|无法重试/i.test(text)) {
    return {
      title: '插件无法重复加载',
      description: '请重启 Worker 后再重新部署。',
    }
  }
  if (/ABI.*=.*不一致|ABI 不匹配/.test(text)) {
    return {
      title: '插件 ABI 不匹配',
      description: '请用当前平台代码重新编译脚本并上传。',
    }
  }
  if (text.length <= 80 && !/plugin\.Open|worker rejected/i.test(text)) {
    return { title: text || raw, description: '' }
  }
  return {
    title: '脚本部署失败',
    description: text || raw,
  }
}

/** 尚未结束、可进入执行页查看进度的状态 */
export const ACTIVE_EXECUTION_STATUSES: TaskStatus[] = [
  'pending',
  'preparing',
  'prepared',
  'running',
]

export function isActiveExecution(status: TaskStatus): boolean {
  return ACTIVE_EXECUTION_STATUSES.includes(status)
}

export function executionMonitorPath(taskId: string, executionId?: string) {
  return {
    path: `/execution/${taskId}`,
    query: executionId ? { execId: executionId } : {},
  }
}
