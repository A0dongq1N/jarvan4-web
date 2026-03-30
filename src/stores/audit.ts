import { ref } from 'vue'
import { defineStore } from 'pinia'
import request from '@/utils/request'
import type { AuditLog } from '@/types'

export const useAuditStore = defineStore('audit', () => {
  const list = ref<AuditLog[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function fetchList(params: {
    page?: number
    pageSize?: number
    keyword?: string
    action?: string
    resourceType?: string
    startTime?: string
    endTime?: string
  } = {}) {
    loading.value = true
    try {
      const res = await request.get('/audit-logs', { params })
      list.value = res.data.data.list
      total.value = res.data.data.total
    } finally {
      loading.value = false
    }
  }

  return { list, total, loading, fetchList }
})
