import type { MockHandler } from '../types'
import { ok, fail, pageResult } from '../types'
import { mockScripts, mockVersionHistory } from '../data/scripts'
import type { Script } from '@/types'

let scripts = [...mockScripts]

export const scriptHandlers: MockHandler[] = [
  // 脚本列表
  {
    method: 'GET',
    url: '/scripts',
    handler: ({ query }) => {
      let result = [...scripts]
      const { keyword, page = '1', pageSize = '20' } = query
      if (keyword) {
        result = result.filter(s =>
          s.name.includes(keyword) || (s.description || '').includes(keyword) || s.author.includes(keyword)
        )
      }
      const p = parseInt(page)
      const ps = parseInt(pageSize)
      const total = result.length
      const list = result.slice((p - 1) * ps, p * ps)
      return pageResult(list, total)
    },
  },
  // 脚本详情
  {
    method: 'GET',
    url: '/scripts/:id',
    handler: ({ params }) => {
      const script = scripts.find(s => s.id === params.id)
      return script ? ok(script) : fail('脚本不存在', 404)
    },
  },
  // 下线脚本
  {
    method: 'DELETE',
    url: '/scripts/:id',
    handler: ({ params }) => {
      const idx = scripts.findIndex(s => s.id === params.id)
      if (idx === -1) return fail('脚本不存在', 404)
      scripts.splice(idx, 1)
      return ok(null)
    },
  },
  // 版本历史列表
  {
    method: 'GET',
    url: '/scripts/:id/versions',
    handler: ({ params, query }) => {
      const history = mockVersionHistory[params.id] || []
      const { page = '1', pageSize = '20' } = query
      const p = parseInt(page)
      const ps = parseInt(pageSize)
      return pageResult(history.slice((p - 1) * ps, p * ps), history.length)
    },
  },
  // CI 发布回调（内部接口，mock 用于演示数据刷新）
  {
    method: 'POST',
    url: '/internal/scripts/publish',
    handler: ({ body }) => {
      const data = body as Partial<Script> & { name: string; commitHash: string; artifactUrl: string; commitMsg: string; author: string }
      const existing = scripts.find(s => s.name === data.name)
      const now = new Date().toISOString()
      if (existing) {
        // 更新最新版本
        const idx = scripts.indexOf(existing)
        scripts[idx] = { ...existing, commitHash: data.commitHash, artifactUrl: data.artifactUrl, commitMsg: data.commitMsg, author: data.author, updatedAt: now }
        // 插入版本历史
        if (!mockVersionHistory[existing.id]) mockVersionHistory[existing.id] = []
        mockVersionHistory[existing.id].unshift({ commitHash: data.commitHash, artifactUrl: data.artifactUrl, commitMsg: data.commitMsg, author: data.author, createdAt: now })
        return ok(scripts[idx])
      } else {
        const newScript: Script = {
          id: 'script' + Date.now(),
          name: data.name,
          language: 'go',
          description: data.description || '',
          commitHash: data.commitHash,
          artifactUrl: data.artifactUrl,
          commitMsg: data.commitMsg,
          author: data.author,
          createdAt: now,
          updatedAt: now,
        }
        scripts.unshift(newScript)
        mockVersionHistory[newScript.id] = [{ commitHash: data.commitHash, artifactUrl: data.artifactUrl, commitMsg: data.commitMsg, author: data.author, createdAt: now }]
        return ok(newScript)
      }
    },
  },
]
