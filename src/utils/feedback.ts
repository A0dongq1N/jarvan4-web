import { ElMessage, ElNotification } from 'element-plus'

/** 程序化调用 Message/Notification 时需全局引入样式（见 main.ts） */

export function notifySuccess(message: string, title = '操作成功') {
  ElNotification({
    title,
    message,
    type: 'success',
    duration: 4000,
    position: 'top-right',
    showClose: true,
  })
}

export function notifyError(message: string, title = '操作失败') {
  ElNotification({
    title,
    message,
    type: 'error',
    duration: 6000,
    position: 'top-right',
    showClose: true,
  })
}

export function notifyWarning(message: string) {
  ElMessage({
    message,
    type: 'warning',
    duration: 3500,
    showClose: true,
    grouping: true,
  })
}

export function getErrorMessage(err: unknown, fallback = '操作失败，请稍后重试') {
  if (typeof err === 'string' && err) return err
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message || e?.message || fallback
}
