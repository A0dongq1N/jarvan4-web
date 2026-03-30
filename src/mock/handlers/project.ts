import type { MockHandler } from '../types'
import { ok, fail, pageResult } from '../types'
import { mockProjects } from '../data/projects'
import type { Project } from '@/types'

let projects = [...mockProjects]

export const projectHandlers: MockHandler[] = [
  {
    method: 'GET',
    url: '/projects',
    handler: ({ query }) => {
      const { keyword = '', page = '1', pageSize = '20' } = query
      let result = [...projects]
      if (keyword) {
        result = result.filter(p =>
          p.name.includes(keyword) || (p.description || '').includes(keyword)
        )
      }
      const p = parseInt(page)
      const ps = parseInt(pageSize)
      return pageResult(result.slice((p - 1) * ps, p * ps), result.length)
    },
  },
  {
    method: 'POST',
    url: '/projects',
    handler: ({ body }) => {
      const { name, description } = body as { name: string; description?: string }
      if (!name) return fail('项目名称不能为空')
      const now = new Date().toISOString()
      const project: Project = {
        id: `proj${Date.now()}`,
        name,
        description,
        taskCount: 0,
        scriptCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      projects.unshift(project)
      return ok(project)
    },
  },
  {
    method: 'DELETE',
    url: '/projects/:id',
    handler: ({ params }) => {
      const idx = projects.findIndex(p => p.id === params.id)
      if (idx === -1) return fail('项目不存在', 404)
      projects.splice(idx, 1)
      return ok(null)
    },
  },
]
