export interface MockContext {
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
}

export interface MockHandler {
  method: string
  url: string
  delay?: number
  handler: (ctx: MockContext) => unknown
}

export function ok<T>(data: T) {
  return { code: 0, message: 'ok', data }
}

export function fail(message: string, code = -1) {
  return { code, message, data: null }
}

export function pageResult<T>(list: T[], total: number) {
  return ok({ list, total })
}
