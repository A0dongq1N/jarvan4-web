import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { StressTask } from '@/types'
import request from '@/utils/request'

export const useTaskStore = defineStore('task', () => {
  const list = ref<StressTask[]>([])
  const total = ref(0)
  const currentTask = ref<StressTask | null>(null)
  const loading = ref(false)

  async function fetchList(params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) {
    loading.value = true
    try {
      const res = await request.get('/tasks', { params })
      list.value = res.data.data.list
      total.value = res.data.data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: string) {
    const res = await request.get(`/tasks/${id}`)
    currentTask.value = res.data.data
    return res.data.data as StressTask
  }

  async function createTask(data: Partial<StressTask>) {
    const res = await request.post('/tasks', data)
    return res.data.data as StressTask
  }

  async function updateTask(id: string, data: Partial<StressTask>) {
    const res = await request.put(`/tasks/${id}`, data)
    return res.data.data as StressTask
  }

  async function deleteTask(id: string) {
    await request.delete(`/tasks/${id}`)
    list.value = list.value.filter(t => t.id !== id)
    total.value--
  }

  async function bindScript(taskId: string, scriptId: string, weight: number) {
    await request.post(`/tasks/${taskId}/scripts`, {
      scriptId,
      weight,
    })
    await fetchById(taskId)
  }

  async function updateScriptEnvVars(taskId: string, scriptId: string, envVars: Record<string, string>) {
    await request.post(`/tasks/${taskId}/scripts`, {
      scriptId,
      weight: currentTask.value?.scripts.find(s => s.scriptId === scriptId)?.weight ?? 100,
      envVars,
    })
    await fetchById(taskId)
  }

  async function unbindScript(taskId: string, scriptId: string) {
    await request.delete(`/tasks/${taskId}/scripts/${scriptId}`)
    await fetchById(taskId)
  }

  return { list, total, currentTask, loading, fetchList, fetchById, createTask, updateTask, deleteTask, bindScript, unbindScript, updateScriptEnvVars }
})
