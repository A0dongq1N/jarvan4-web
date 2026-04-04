import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import type { MockHandler } from './types'

// Import all handlers
import { authHandlers } from './handlers/auth'
import { taskHandlers } from './handlers/task'
// scriptHandlers 已联调，不再 mock
// executionHandlers 已联调，不再 mock
// reportHandlers 已联调，不再 mock
// auditHandlers 已联调，不再 mock
// workerHandlers 已联调，不再 mock
import { projectHandlers } from './handlers/project'

const allHandlers: MockHandler[] = [
  ...authHandlers,
  ...taskHandlers,
  ...projectHandlers,
]

// Compile URL pattern: /tasks/:id → regex
function compilePattern(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\//g, '\\/')
    .replace(/:([a-zA-Z_]+)/g, '([^/]+)')
  return new RegExp(`^${escaped}$`)
}

// Extract params from URL
function extractParams(pattern: string, url: string): Record<string, string> {
  const paramNames: string[] = []
  const nameRegex = /:([a-zA-Z_]+)/g
  let match
  while ((match = nameRegex.exec(pattern)) !== null) {
    paramNames.push(match[1])
  }
  const re = compilePattern(pattern)
  const m = re.exec(url)
  if (!m) return {}
  const params: Record<string, string> = {}
  paramNames.forEach((name, i) => {
    params[name] = m[i + 1]
  })
  return params
}

function matchHandler(method: string, url: string): { handler: MockHandler; params: Record<string, string> } | null {
  // Remove /api prefix
  const cleanUrl = url.replace(/^\/api/, '')
  // Remove query string
  const urlPath = cleanUrl.split('?')[0]

  for (const handler of allHandlers) {
    if (handler.method.toUpperCase() !== method.toUpperCase()) continue
    const re = compilePattern(handler.url)
    if (re.test(urlPath)) {
      const params = extractParams(handler.url, urlPath)
      return { handler, params }
    }
  }
  return null
}

// Simulate network delay
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function setupMock(instance: AxiosInstance) {
  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toUpperCase() || 'GET'
    const url = config.url || ''

    const result = matchHandler(method, url)
    if (!result) return config

    const { handler, params } = result

    // Parse query params
    const queryString = url.includes('?') ? url.split('?')[1] : ''
    const query: Record<string, string> = {}
    if (queryString) {
      queryString.split('&').forEach(part => {
        const [k, v] = part.split('=')
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '')
      })
    }

    // Parse body
    let body: unknown = {}
    if (config.data) {
      try {
        body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      } catch {}
    }

    await delay(handler.delay ?? 200)

    const responseData = JSON.parse(JSON.stringify(handler.handler({ params, query, body })))

    // Create a fake axios response that bypasses the adapter
    const fakeResponse: AxiosResponse = {
      data: responseData,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config,
    }

    // Use a custom adapter trick: throw a special "mock" error that response interceptor catches
    // Instead, we monkey-patch by returning a promise rejection that response interceptor handles
    // Better: Override the adapter
    ;(config as any).__mockResponse = fakeResponse
    config.adapter = () => Promise.resolve(fakeResponse)

    return config
  })
}
