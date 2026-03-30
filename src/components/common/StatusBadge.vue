<template>
  <span class="status-badge" :class="`status-badge--${status}`">
    <span class="status-badge__dot"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@/types'

const props = defineProps<{ status: TaskStatus }>()

const labelMap: Record<TaskStatus, string> = {
  idle: '空闲',
  pending: '初始化中',
  running: '运行中',
  success: '已完成',
  failed: '失败',
  stopped: '已停止',
  circuit_broken: '熔断停止',
}

const label = computed(() => labelMap[props.status] || props.status)
</script>

<style lang="scss" scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &--running {
    color: $color-primary;
    background: rgba($color-primary, 0.1);
    .status-badge__dot {
      background: $color-primary;
      animation: pulse 1.5s infinite;
    }
  }
  &--success {
    color: $color-success;
    background: rgba($color-success, 0.1);
    .status-badge__dot { background: $color-success; }
  }
  &--failed {
    color: $color-danger;
    background: rgba($color-danger, 0.1);
    .status-badge__dot { background: $color-danger; }
  }
  &--stopped {
    color: $color-warning;
    background: rgba($color-warning, 0.1);
    .status-badge__dot { background: $color-warning; }
  }
  &--circuit_broken {
    color: $color-danger;
    background: rgba($color-danger, 0.08);
    border: 1px solid rgba($color-danger, 0.2);
    .status-badge__dot { background: $color-danger; }
  }
  &--idle {
    color: $text-secondary;
    background: rgba($text-secondary, 0.1);
    .status-badge__dot { background: $text-secondary; }
  }
  &--pending {
    color: #722ed1;
    background: rgba(114, 46, 209, 0.1);
    .status-badge__dot {
      background: #722ed1;
      animation: pulse 1s infinite;
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}
</style>
