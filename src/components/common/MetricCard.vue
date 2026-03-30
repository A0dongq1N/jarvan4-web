<template>
  <div class="metric-card" :style="accentStyle">
    <div class="metric-card__label">{{ label }}</div>
    <div class="metric-card__value">
      {{ value }}
      <span v-if="unit" class="metric-card__unit">{{ unit }}</span>
    </div>
    <div v-if="trend !== undefined" class="metric-card__trend" :class="trendClass">
      <el-icon :size="11">
        <component :is="trend >= 0 ? 'CaretTop' : 'CaretBottom'" />
      </el-icon>
      {{ Math.abs(trend) }}%
    </div>
    <div v-if="desc" class="metric-card__desc">{{ desc }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CaretTop, CaretBottom } from '@element-plus/icons-vue'

const props = defineProps<{
  label: string
  value: string | number
  unit?: string
  trend?: number
  desc?: string
  trendReverse?: boolean
  accent?: string   // 顶部色条颜色，可选，传入 CSS 颜色值
}>()

const trendClass = computed(() => {
  if (props.trend === undefined) return ''
  const isPositive = props.trendReverse ? props.trend < 0 : props.trend >= 0
  return isPositive ? 'trend--up' : 'trend--down'
})

// 顶部 accent 线（通过 CSS 变量传入，不影响布局）
const accentStyle = computed(() => {
  if (!props.accent) return {}
  return { '--card-accent': props.accent }
})
</script>

<style lang="scss" scoped>
.metric-card {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px 20px 18px;
  border: 1px solid $border-color-light;
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.18s ease, transform 0.18s ease;

  // hover lift 效果
  &:hover {
    box-shadow: $shadow-md;
    transform: translateY(-1px);
  }

  // 顶部 accent 色条（有传入 accent 颜色时显示）
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--card-accent, transparent);
    border-radius: $border-radius $border-radius 0 0;
  }

  &__label {
    font-size: 12px;
    color: $text-secondary;
    margin-bottom: 10px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  &__value {
    font-size: 30px;
    font-weight: 700;
    color: $text-primary;
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    font-size: 13px;
    font-weight: 400;
    color: $text-secondary;
    margin-left: 4px;
    letter-spacing: 0;
  }

  &__trend {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    margin-top: 8px;
    font-weight: 500;

    &.trend--up   { color: $color-success; }
    &.trend--down { color: $color-danger; }
  }

  &__desc {
    font-size: 11px;
    color: $text-secondary;
    margin-top: 6px;
    line-height: 1.4;
  }
}
</style>
