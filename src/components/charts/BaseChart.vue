<template>
  <div ref="chartEl" class="base-chart" :style="{ width, height }"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import echarts from '@/utils/echarts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = defineProps<{
  option: Record<string, any>
  width?: string
  height?: string
}>()

const chartEl = ref<HTMLElement | null>(null)
let chart: ReturnType<typeof echarts.init> | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!chartEl.value) return
  chart = echarts.init(chartEl.value)
  chart.setOption(props.option)

  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartEl.value)
})

watch(() => props.option, (newOpt) => {
  chart?.setOption(newOpt)
}, { deep: true })

onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.base-chart {
  width: v-bind(width);
  height: v-bind(height);
}
</style>
