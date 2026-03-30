<template>
  <div class="chart-wrapper">
    <div class="chart-wrapper__header">
      <span class="chart-wrapper__dot" style="background:#3871dc" />
      <span class="chart-wrapper__title">RPS（每秒请求数）</span>
    </div>
    <BaseChart :option="option" width="100%" height="210px" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseChart from './BaseChart.vue'
import type { MetricPoint } from '@/types'

const props = defineProps<{
  data: MetricPoint[]
  targetValue?: number
}>()

// Grafana 浅色主题图表色值
const AXIS_COLOR   = '#babcbe'  // gray-70
const SPLIT_COLOR  = '#ececed'  // gray-90
const LABEL_COLOR  = '#9c9fa3'  // gray-60
const LINE_COLOR   = '#3871dc'  // primary
const AREA_START   = 'rgba(56,113,220,0.18)'
const AREA_END     = 'rgba(56,113,220,0)'

const option = computed(() => ({
  grid: { top: 12, right: 16, bottom: 24, left: 52 },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.data.map(p => new Date(p.timestamp).toLocaleTimeString()),
    axisLine: { lineStyle: { color: AXIS_COLOR } },
    axisTick: { show: false },
    axisLabel: { color: LABEL_COLOR, fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: SPLIT_COLOR } },
    axisLabel: { color: LABEL_COLOR, fontSize: 11 },
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#fff',
    borderColor: '#e1e2e3',
    borderWidth: 1,
    textStyle: { color: '#22252b', fontSize: 12 },
    formatter: (params: any) => {
      const p = params[0]
      return `<span style="color:#9c9fa3;font-size:11px">${p.axisValue}</span><br/>RPS <b style="color:#3871dc">${p.value?.toFixed(1)}</b>`
    },
  },
  series: [{
    type: 'line',
    data: props.data.map(p => p.value),
    smooth: true,
    symbol: 'none',
    lineStyle: { color: LINE_COLOR, width: 2 },
    areaStyle: {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: AREA_START },
          { offset: 1, color: AREA_END },
        ],
      },
    },
    markLine: props.targetValue != null ? {
      silent: true,
      symbol: 'none',
      lineStyle: { color: '#e0226e', type: 'dashed', width: 1.5 },
      label: {
        formatter: `目标 ${props.targetValue} req/s`,
        position: 'end',
        color: '#e0226e',
        fontSize: 11,
      },
      data: [{ yAxis: props.targetValue }],
    } : undefined,
  }],
}))
</script>

<style lang="scss" scoped>
.chart-wrapper {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 16px;
  border: 1px solid $border-color-light;
  transition: box-shadow 0.18s ease, transform 0.18s ease;

  &:hover {
    box-shadow: $shadow-md;
    transform: translateY(-1px);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 12px;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__title {
    font-size: 12.5px;
    color: $text-secondary;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
}
</style>
