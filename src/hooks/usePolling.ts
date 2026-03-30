import { ref, onUnmounted } from 'vue'

interface PollingOptions {
  interval?: number
  immediate?: boolean
}

export function usePolling(fn: () => Promise<void> | void, options: PollingOptions = {}) {
  const { interval = 2000, immediate = true } = options
  const running = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  async function execute() {
    try {
      await fn()
    } catch (e) {
      console.error('[usePolling] error:', e)
    }
  }

  function start() {
    if (running.value) return
    running.value = true
    if (immediate) {
      execute()
    }
    timer = setInterval(execute, interval)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    running.value = false
  }

  onUnmounted(() => {
    stop()
  })

  return { running, start, stop }
}
