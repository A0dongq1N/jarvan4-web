import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '@/types'
import request from '@/utils/request'

export const useProjectStore = defineStore('project', () => {
  const list = ref<Project[]>([])
  const total = ref(0)
  const currentProject = ref<Project | null>(
    JSON.parse(localStorage.getItem('stress_project') || 'null')
  )
  const loading = ref(false)

  async function fetchList(params?: { keyword?: string }) {
    loading.value = true
    try {
      const res = await request.get('/projects', { params })
      list.value = res.data.data.list
      total.value = res.data.data.total
    } finally {
      loading.value = false
    }
  }

  async function createProject(data: { name: string; description?: string }) {
    const res = await request.post('/projects', data)
    return res.data.data as Project
  }

  async function deleteProject(id: string) {
    await request.delete(`/projects/${id}`)
    list.value = list.value.filter(p => p.id !== id)
    total.value--
    // 若删除的是当前选中项目，清除选中状态
    if (currentProject.value?.id === id) {
      clearProject()
    }
  }

  function selectProject(project: Project) {
    currentProject.value = project
    localStorage.setItem('stress_project', JSON.stringify(project))
  }

  function clearProject() {
    currentProject.value = null
    localStorage.removeItem('stress_project')
  }

  return { list, total, currentProject, loading, fetchList, createProject, deleteProject, selectProject, clearProject }
})
