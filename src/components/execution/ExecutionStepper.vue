<template>
  <div class="execution-stepper">
    <div
      v-for="(step, index) in steps"
      :key="step.key"
      class="execution-stepper__item"
      :class="`execution-stepper__item--${stepStates[index]}`"
      :style="{ '--step-index': index }"
    >
      <div class="execution-stepper__node-wrap">
        <span
          v-if="stepStates[index] === 'active'"
          class="execution-stepper__pulse"
          aria-hidden="true"
        />
        <div class="execution-stepper__node">
          <Transition name="step-icon" mode="out-in">
            <span
              v-if="stepStates[index] === 'done'"
              key="done"
              class="execution-stepper__icon execution-stepper__icon--done"
            >✓</span>
            <span
              v-else-if="stepStates[index] === 'error'"
              key="error"
              class="execution-stepper__icon execution-stepper__icon--error"
            >!</span>
            <span
              v-else
              :key="`num-${index}`"
              class="execution-stepper__icon execution-stepper__icon--num"
            >{{ index + 1 }}</span>
          </Transition>
        </div>
      </div>

      <span class="execution-stepper__label">{{ step.label }}</span>

      <div
        v-if="index < steps.length - 1"
        class="execution-stepper__line"
        :class="`execution-stepper__line--${lineStates[index]}`"
      >
        <div class="execution-stepper__line-track" />
        <div class="execution-stepper__line-fill" />
        <div
          v-if="lineStates[index] === 'active'"
          class="execution-stepper__line-flow"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@/types'

const props = defineProps<{
  status: TaskStatus
  hasReport?: boolean
  /** 脚本是否已部署完成 */
  deployDone?: boolean
  /** 是否已开始注入流量（首条指标到达后才有 startTime） */
  trafficStarted?: boolean
}>()

const steps = [
  { key: 'create', label: '创建执行' },
  { key: 'deploy', label: '脚本部署' },
  { key: 'inject', label: '流量注入' },
  { key: 'report', label: '生成报告' },
]

type StepState = 'waiting' | 'active' | 'done' | 'error'

const stepStates = computed<StepState[]>(() => {
  const states: StepState[] = ['waiting', 'waiting', 'waiting', 'waiting']
  const status = props.status

  if (status === 'idle') {
    states[0] = 'active'
    return states
  }

  states[0] = 'done'

  if (status === 'pending' || status === 'preparing') {
    states[1] = 'active'
    return states
  }

  if (status === 'prepared') {
    states[1] = 'done'
    states[2] = 'active'
    return states
  }

  if (status === 'running') {
    states[1] = 'done'
    states[2] = 'active'
    return states
  }

  if (status === 'success') {
    states[1] = 'done'
    states[2] = 'done'
    states[3] = props.hasReport ? 'done' : 'active'
    return states
  }

  if (status === 'stopped') {
    if (props.deployDone) states[1] = 'done'
    if (props.trafficStarted === true) {
      states[2] = 'done'
      states[3] = props.hasReport ? 'done' : 'waiting'
    }
    return states
  }

  if (status === 'circuit_broken') {
    if (props.deployDone) states[1] = 'done'
    if (props.trafficStarted === true) states[2] = 'done'
    states[3] = props.hasReport ? 'done' : 'waiting'
    return states
  }

  if (status === 'failed') {
    if (props.deployDone) states[1] = 'done'
    states[2] = props.trafficStarted === true ? 'error' : 'waiting'
    return states
  }

  return states
})

const lineStates = computed(() => {
  return stepStates.value.map((state, index) => {
    if (index >= steps.length - 1) return 'waiting'
    const next = stepStates.value[index + 1]
    if (state === 'done' && (next === 'done' || next === 'active' || next === 'error')) return 'done'
    if (state === 'done' && next === 'waiting') return 'done'
    if (state === 'active') return 'active'
    return 'waiting'
  })
})
</script>

<style lang="scss" scoped>
.execution-stepper {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $border-radius;
  border: 1px solid $border-color-light;
  padding: 16px 24px;
  box-shadow: $shadow-sm;
  animation: stepper-enter 0.45s ease-out both;

  &__item {
    display: flex;
    align-items: center;
    flex: 1;
    position: relative;
    min-width: 0;
    animation: step-item-enter 0.4s ease-out both;
    animation-delay: calc(var(--step-index) * 0.08s);

    &:last-child {
      flex: 0 0 auto;
    }
  }

  &__node-wrap {
    position: relative;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__pulse {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid $color-primary;
    animation: step-pulse 2s ease-out infinite;
    pointer-events: none;
  }

  &__node {
    position: relative;
    z-index: 1;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    border: 2px solid $border-color;
    color: $text-secondary;
    background: $bg-page;
    transition:
      border-color 0.35s ease,
      background 0.35s ease,
      color 0.35s ease,
      box-shadow 0.35s ease,
      transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  &__icon {
    display: block;
    line-height: 1;

    &--done {
      font-size: 14px;
      animation: icon-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    &--error {
      font-size: 14px;
      animation: icon-shake 0.5s ease both;
    }

    &--num {
      font-size: 13px;
    }
  }

  &__label {
    margin-left: 10px;
    font-size: 13px;
    color: $text-secondary;
    white-space: nowrap;
    transition:
      color 0.35s ease,
      font-weight 0.35s ease,
      transform 0.35s ease;
  }

  &__line {
    flex: 1;
    height: 4px;
    margin: 0 12px;
    position: relative;
    border-radius: 2px;
    overflow: hidden;
  }

  &__line-track {
    position: absolute;
    inset: 0;
    background: $border-color-light;
    border-radius: inherit;
  }

  &__line-fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &__line-flow {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba($color-primary, 0.15) 30%,
      rgba($color-primary, 0.55) 50%,
      rgba($color-primary, 0.15) 70%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: line-flow 1.6s linear infinite;
  }

  // ── 连线状态 ──────────────────────────────────────────────
  &__line--done .execution-stepper__line-fill {
    transform: scaleX(1);
    background: $color-success;
  }

  &__line--active .execution-stepper__line-fill {
    transform: scaleX(0.55);
    background: linear-gradient(90deg, $color-success 0%, $color-primary 100%);
    animation: line-grow 1.2s ease-in-out infinite alternate;
  }

  // ── 步骤状态 ──────────────────────────────────────────────
  &__item--active {
    .execution-stepper__node {
      border-color: $color-primary;
      background: rgba($color-primary, 0.12);
      color: $color-primary;
      box-shadow: 0 0 0 4px rgba($color-primary, 0.08);
      transform: scale(1.06);
    }
    .execution-stepper__label {
      color: $text-primary;
      font-weight: 600;
      transform: translateX(1px);
    }
  }

  &__item--done {
    .execution-stepper__node {
      border-color: $color-success;
      background: rgba($color-success, 0.12);
      color: $color-success;
    }
    .execution-stepper__label {
      color: $text-regular;
    }
  }

  &__item--error {
    .execution-stepper__node {
      border-color: $color-danger;
      background: rgba($color-danger, 0.12);
      color: $color-danger;
      box-shadow: 0 0 0 4px rgba($color-danger, 0.08);
    }
    .execution-stepper__label {
      color: $color-danger;
      font-weight: 600;
    }
  }
}

// ── 图标切换过渡 ────────────────────────────────────────────
.step-icon-enter-active {
  transition: opacity 0.2s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.step-icon-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.step-icon-enter-from {
  opacity: 0;
  transform: scale(0.4) rotate(-20deg);
}
.step-icon-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

// ── 关键帧 ──────────────────────────────────────────────────
@keyframes stepper-enter {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes step-item-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes step-pulse {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  70% {
    transform: scale(1.55);
    opacity: 0;
  }
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}

@keyframes icon-pop {
  0% {
    transform: scale(0.2);
    opacity: 0;
  }
  60% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes icon-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-3px); }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

@keyframes line-flow {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@keyframes line-grow {
  0% { transform: scaleX(0.45); }
  100% { transform: scaleX(0.72); }
}

@media (prefers-reduced-motion: reduce) {
  .execution-stepper,
  .execution-stepper__item,
  .execution-stepper__pulse,
  .execution-stepper__line-flow,
  .execution-stepper__line--active .execution-stepper__line-fill,
  .execution-stepper__icon--done,
  .execution-stepper__icon--error {
    animation: none !important;
  }

  .execution-stepper__line-fill {
    transition: none;
  }

  .step-icon-enter-active,
  .step-icon-leave-active {
    transition: none;
  }
}
</style>
