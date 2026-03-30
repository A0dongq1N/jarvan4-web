import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Report } from '@/types'
import request from '@/utils/request'

export const useReportStore = defineStore('report', () => {
  const list = ref<Report[]>([])
  const total = ref(0)
  const currentReport = ref<Report | null>(null)
  const loading = ref(false)

  async function fetchList(params?: { page?: number; pageSize?: number; keyword?: string }) {
    loading.value = true
    try {
      const res = await request.get('/reports', { params })
      list.value = res.data.data.list
      total.value = res.data.data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: string) {
    const res = await request.get(`/reports/${id}`)
    currentReport.value = res.data.data
    return res.data.data as Report
  }

  async function deleteReport(id: string) {
    await request.delete(`/reports/${id}`)
    list.value = list.value.filter(r => r.id !== id)
    total.value--
  }

  return { list, total, currentReport, loading, fetchList, fetchById, deleteReport }
})
