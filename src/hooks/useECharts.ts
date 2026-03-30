import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import echarts from '@/utils/echarts'
import type { ECharts } from '@/utils/echarts'
import type { EChartsOption } from 'echarts'

export function useECharts(containerRef: Ref<HTMLElement | null>) {
  const chart = ref<ECharts | null>(null)

  function initChart(option?: EChartsOption) {
    if (!containerRef.value) return
    chart.value = echarts.init(containerRef.value)
    if (option) {
      chart.value.setOption(option)
    }
  }

  function setOption(option: EChartsOption, notMerge = false) {
    if (!chart.value) return
    chart.value.setOption(option, notMerge)
  }

  function resize() {
    chart.value?.resize()
  }

  function dispose() {
    chart.value?.dispose()
    chart.value = null
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(containerRef.value)
    }
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
    dispose()
  })

  return { chart, initChart, setOption, resize, dispose }
}
