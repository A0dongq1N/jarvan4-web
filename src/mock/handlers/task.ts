import type { MockHandler } from '../types'
import { ok, fail, pageResult } from '../types'
import { mockTasks } from '../data/tasks'
import { mockScripts } from '../data/scripts'
import type { StressTask } from '@/types'
import { genId } from '@/utils/format'

// In-memory store
let tasks = [...mockTasks]

export const taskHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/tasks',
    handler: ({ query }) => {
      let result = [...tasks]
      const { keyword, status, page = '1', pageSize = '10' } = query
      if (keyword) {
        result = result.filter(t => t.name.includes(keyword) || (t.description || '').includes(keyword))
      }
      if (status) {
        result = result.filter(t => t.status === status)
      }
      const p = parseInt(page)
      const ps = parseInt(pageSize)
      const total = result.length
      const list = result.slice((p - 1) * ps, p * ps)
      return pageResult(list, total)
    },
  },
  {
    method: 'GET',
    url: '/tasks/:id',
    handler: ({ params }) => {
      const task = tasks.find(t => t.id === params.id)
      return task ? ok(task) : fail('任务不存在', 404)
    },
  },
  {
    method: 'POST',
    url: '/tasks',
    handler: ({ body }) => {
      const data = body as Partial<StressTask>
      const newTask: StressTask = {
        id: 'task' + genId(),
        name: data.name || '未命名任务',
        description: data.description,
        status: 'idle',
        scenarioConfig: data.scenarioConfig || { mode: 'step', duration: 300, steps: [{ concurrent: 100, rampTime: 20, duration: 280 }] },
        scripts: data.scripts || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      tasks.unshift(newTask)
      return ok(newTask)
    },
  },
  {
    method: 'PUT',
    url: '/tasks/:id',
    handler: ({ params, body }) => {
      const idx = tasks.findIndex(t => t.id === params.id)
      if (idx === -1) return fail('任务不存在', 404)
      const updated = { ...tasks[idx], ...(body as Partial<StressTask>), updatedAt: new Date().toISOString() }
      tasks[idx] = updated
      return ok(updated)
    },
  },
  {
    method: 'DELETE',
    url: '/tasks/:id',
    handler: ({ params }) => {
      const idx = tasks.findIndex(t => t.id === params.id)
      if (idx === -1) return fail('任务不存在', 404)
      tasks.splice(idx, 1)
      return ok(null)
    },
  },
  {
    method: 'POST',
    url: '/tasks/:id/scripts',
    handler: ({ params, body }) => {
      const task = tasks.find(t => t.id === params.id)
      if (!task) return fail('任务不存在', 404)
      const { scriptId, weight, envVars } = body as {
        scriptId: string; weight: number; envVars?: Record<string, string>
      }
      const scriptData = mockScripts.find(s => s.id === scriptId)
      const existIdx = task.scripts.findIndex(s => s.scriptId === scriptId)
      if (existIdx >= 0) {
        task.scripts[existIdx].weight = weight
        if (envVars !== undefined) task.scripts[existIdx].envVars = envVars
      } else {
        task.scripts.push({
          scriptId,
          scriptName: scriptData?.name || scriptId,
          weight,
          envVars,
        })
      }
      return ok(task)
    },
  },
  {
    method: 'DELETE',
    url: '/tasks/:id/scripts/:scriptId',
    handler: ({ params }) => {
      const task = tasks.find(t => t.id === params.id)
      if (!task) return fail('任务不存在', 404)
      task.scripts = task.scripts.filter(s => s.scriptId !== params.scriptId)
      return ok(task)
    },
  },
]
