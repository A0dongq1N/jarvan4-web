<template>
  <div v-loading="loading" class="log-panel">
    <el-alert
      v-if="droppedLogs > 0"
      type="warning"
      :closable="false"
      show-icon
      class="log-panel__dropped-alert"
      :title="`已丢弃 ${droppedLogs} 条日志（超过速率限制 10 条/秒/Worker）`"
    />
    <div class="log-panel__header">
      <span class="log-panel__title">{{ title }}</span>
      <div class="log-panel__controls">
        <el-select
          :model-value="workerFilter"
          size="small"
          placeholder="全部 Worker"
          clearable
          style="width: 180px"
          @update:model-value="onWorkerChange"
        >
          <el-option label="全部 Worker" value="" />
          <el-option
            v-for="w in workerOptions"
            :key="w.id"
            :label="w.label"
            :value="w.id"
          />
        </el-select>
        <el-select
          :model-value="levelFilter"
          size="small"
          placeholder="日志级别"
          clearable
          style="width: 120px"
          @update:model-value="onLevelChange"
        >
          <el-option label="全部" value="" />
          <el-option label="INFO" value="info" />
          <el-option label="WARN" value="warn" />
          <el-option label="ERROR" value="error" />
          <el-option label="DEBUG" value="debug" />
        </el-select>
        <el-button size="small" :icon="Delete" @click="onClear">清空</el-button>
        <el-switch v-if="showAutoScroll" v-model="autoScroll" size="small" active-text="自动滚动" />
      </div>
    </div>
    <div ref="logContainer" class="log-container" :style="containerStyle">
      <div
        v-for="log in logs"
        :key="log.id"
        class="log-entry"
        :class="`log-entry--${log.level}`"
      >
        <span class="log-entry__time">{{ formatLogTime(log.timestamp) }}</span>
        <span class="log-entry__level">{{ log.level.toUpperCase() }}</span>
        <span
          class="log-entry__worker"
          :style="{ color: workerColor(logWorkerId(log)) }"
          :title="logWorkerId(log)"
        >{{ workerLabel(log) }}</span>
        <span class="log-entry__msg">{{ log.message }}</span>
      </div>
      <div v-if="!loading && logs.length === 0" class="log-empty">
        {{ emptyText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import type { LogEntry, WorkerSnapshot } from '@/types'
import { formatLogTime } from '@/utils/format'
import { confirmDanger } from '@/utils/confirm'

const WORKER_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185', '#c084fc']

const props = withDefaults(defineProps<{
  logs: LogEntry[]
  droppedLogs?: number
  levelFilter?: string
  workerFilter?: string
  workers?: WorkerSnapshot[]
  loading?: boolean
  title?: string
  emptyText?: string
  showAutoScroll?: boolean
  height?: string
}>(), {
  droppedLogs: 0,
  levelFilter: '',
  workerFilter: '',
  workers: () => [],
  loading: false,
  title: '执行日志',
  emptyText: '暂无日志',
  showAutoScroll: false,
  height: '280px',
})

const emit = defineEmits<{
  'update:levelFilter': [value: string]
  'update:workerFilter': [value: string]
  clear: []
}>()

const autoScroll = ref(true)
const logContainer = ref<HTMLElement | null>(null)

const containerStyle = computed(() => ({ height: props.height }))

function logWorkerId(log: LogEntry): string {
  return log.workerId || log.source || ''
}

function workerLabel(log: LogEntry): string {
  const id = logWorkerId(log)
  if (!id) return '-'
  const snap = props.workers.find(w => w.workerId === id || w.ip === id || w.hostname === id)
  if (snap?.ip && snap.ip !== id) return snap.ip
  return id
}

function workerColor(id: string): string {
  if (!id) return '#9ca3af'
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  return WORKER_COLORS[Math.abs(hash) % WORKER_COLORS.length]
}

const workerOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const w of props.workers) {
    if (w.workerId) seen.set(w.workerId, w.ip || w.hostname || w.workerId)
  }
  for (const log of props.logs) {
    const id = logWorkerId(log)
    if (id && !seen.has(id)) seen.set(id, workerLabel(log))
  }
  return [...seen.entries()].map(([id, label]) => ({ id, label }))
})

function onLevelChange(value: string) {
  emit('update:levelFilter', value ?? '')
}

function onWorkerChange(value: string) {
  emit('update:workerFilter', value ?? '')
}

async function onClear() {
  const ok = await confirmDanger('确认清空当前日志列表？', {
    title: '清空确认',
    confirmText: '清空',
  })
  if (!ok) return
  emit('clear')
}

watch(() => props.logs.length, async () => {
  if (!props.showAutoScroll || !autoScroll.value) return
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
})
</script>

<style scoped lang="scss">
.log-panel {
  background: #1a1d23;
  border-radius: $border-radius;
  overflow: hidden;

  &__dropped-alert {
    margin: 12px 16px 0;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #141720;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

.log-container {
  overflow-y: auto;
  padding: 8px 0;
  font-family: 'SF Mono', 'Fira Code', 'Monaco', monospace;
  font-size: 12px;

  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); }
  &::-webkit-scrollbar-track { background: transparent; }
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 3px 16px;
  line-height: 1.6;

  &:hover { background: rgba(255, 255, 255, 0.04); }

  &__time { color: #6b7280; min-width: 96px; flex-shrink: 0; }
  &__level { min-width: 48px; font-weight: 600; flex-shrink: 0; }
  &__worker {
    min-width: 110px;
    max-width: 180px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  &__msg { color: #d1d5db; flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all; }

  &--info .log-entry__level { color: #60a5fa; }
  &--warn .log-entry__level { color: #fbbf24; }
  &--error {
    .log-entry__level { color: #f87171; }
    .log-entry__msg { color: #fca5a5; }
  }
  &--debug .log-entry__level { color: #a3e635; }
}

.log-empty {
  padding: 40px;
  text-align: center;
  color: #4b5563;
  font-size: 13px;
}
</style>
