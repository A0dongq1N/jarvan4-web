import { ElMessageBox } from 'element-plus'

/**
 * 删除/危险操作二次确认。取消返回 false，不会抛错。
 */
export async function confirmDanger(
  message: string,
  options?: {
    title?: string
    confirmText?: string
    cancelText?: string
  },
): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, options?.title ?? '确认删除', {
      confirmButtonText: options?.confirmText ?? '删除',
      cancelButtonText: options?.cancelText ?? '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
      closeOnClickModal: false,
    })
    return true
  } catch {
    return false
  }
}
