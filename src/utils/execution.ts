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

  if (/self-check/i.test(text)) {
    return {
      title: '脚本二进制自检失败',
      description: '请重新编译并上传脚本产物，确认目标架构与 Worker 一致。',
    }
  }
  if (/无法执行|permission denied|exec format/i.test(text)) {
    return {
      title: '脚本二进制无法执行',
      description: text,
    }
  }
  if (/包版本不一致|different version of package/i.test(text)) {
    // 历史 plugin 错误（旧部署记录）
    return {
      title: '脚本与 Worker 版本不一致',
      description: '请用当前平台代码重新编译脚本并上传（独立二进制方案下一般不再出现此错误）。',
    }
  }
  if (/已在当前 Worker|already loaded|无法重试/i.test(text)) {
    return {
      title: '历史插件错误',
      description: '请重启 Worker 后改用最新脚本二进制重新部署。',
    }
  }
  if (/ABI.*=.*不一致|ABI 不匹配/.test(text)) {
    return {
      title: '历史 ABI 错误',
      description: '当前已改为独立二进制，请重新编译上传脚本后再部署。',
    }
  }
  if (text.length <= 80 && !/plugin\.Open|worker rejected|self-check/i.test(text)) {
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
