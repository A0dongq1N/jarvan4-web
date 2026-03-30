import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Script, ScriptVersion } from '@/types'
import request from '@/utils/request'

export const useScriptStore = defineStore('script', () => {
  const list = ref<Script[]>([])
  const total = ref(0)
  const currentScript = ref<Script | null>(null)
  const versionHistory = ref<ScriptVersion[]>([])
  const versionTotal = ref(0)
  const loading = ref(false)

  async function fetchList(params?: { page?: number; pageSize?: number; keyword?: string }) {
    loading.value = true
    try {
      const res = await request.get('/scripts', { params })
      list.value = res.data.data.list
      total.value = res.data.data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: string) {
    const res = await request.get(`/scripts/${id}`)
    currentScript.value = res.data.data
    return res.data.data as Script
  }

  async function deleteScript(id: string) {
    await request.delete(`/scripts/${id}`)
    list.value = list.value.filter(s => s.id !== id)
    total.value--
  }

  async function fetchVersionHistory(id: string, params?: { page?: number; pageSize?: number }) {
    const res = await request.get(`/scripts/${id}/versions`, { params })
    versionHistory.value = res.data.data.list
    versionTotal.value = res.data.data.total
    return res.data.data.list as ScriptVersion[]
  }

  return {
    list, total, currentScript, versionHistory, versionTotal, loading,
    fetchList, fetchById, deleteScript, fetchVersionHistory,
  }
})
