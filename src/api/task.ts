import request from '@/utils/request'
import type { StressTask } from '@/types'

export const taskApi = {
  list: (params?: Record<string, unknown>) => request.get('/tasks', { params }),
  detail: (id: string) => request.get(`/tasks/${id}`),
  create: (data: Partial<StressTask>) => request.post('/tasks', data),
  update: (id: string, data: Partial<StressTask>) => request.put(`/tasks/${id}`, data),
  delete: (id: string) => request.delete(`/tasks/${id}`),
  bindScript: (taskId: string, data: { scriptId: string; weight: number }) =>
    request.post(`/tasks/${taskId}/scripts`, data),
  unbindScript: (taskId: string, scriptId: string) =>
    request.delete(`/tasks/${taskId}/scripts/${scriptId}`),
}
