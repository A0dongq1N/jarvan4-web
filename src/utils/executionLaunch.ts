import { ElMessageBox } from 'element-plus'
import type { Router } from 'vue-router'
import type { ExecutionRecord } from '@/types'
import { executionMonitorPath } from '@/utils/execution'

/** 从任务列表/详情进入执行页：无 active 则直接新建；有 active 则让用户选择继续或新建 */
export async function launchExecutionForTask(
  router: Router,
  taskId: string,
  actives: ExecutionRecord[],
): Promise<void> {
  if (actives.length === 0) {
    await router.push({
      path: `/execution/${taskId}`,
      query: { autostart: '1', newRun: '1' },
    })
    return
  }

  const primary = actives[0]!
  const hint =
    actives.length > 1
      ? `当前有 ${actives.length} 个进行中的压测。选择「继续当前」将打开最近一条（${primary.id.slice(0, 8)}…）；其余可在执行历史或执行页切换。`
      : '当前已有进行中的压测，可继续监控或新建一次独立压测（并行执行，Worker 不足时新压测可能部署失败）。'

  try {
    await ElMessageBox.confirm(hint, '选择操作', {
      confirmButtonText: '继续当前压测',
      cancelButtonText: '新建一次压测',
      distinguishCancelAndClose: true,
      type: 'info',
    })
    await router.push(executionMonitorPath(taskId, primary.id))
  } catch (action) {
    if (action === 'cancel') {
      await router.push({
        path: `/execution/${taskId}`,
        query: { autostart: '1', newRun: '1' },
      })
    }
  }
}
