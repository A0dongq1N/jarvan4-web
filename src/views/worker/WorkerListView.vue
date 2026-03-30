<template>
  <div class="worker-list-view">
    <PageHeader title="节点管理">
      <el-button :icon="Refresh" @click="load" :loading="loading">刷新</el-button>
    </PageHeader>

    <!-- 统计卡片 -->
    <div class="worker-stats">
      <div class="stat-card">
        <div class="stat-card__value">{{ stats.total }}</div>
        <div class="stat-card__label">节点总数</div>
      </div>
      <div class="stat-card stat-card--busy">
        <div class="stat-card__value">{{ stats.busy }}</div>
        <div class="stat-card__label">执行中</div>
      </div>
      <div class="stat-card stat-card--online">
        <div class="stat-card__value">{{ stats.online }}</div>
        <div class="stat-card__label">空闲</div>
      </div>
      <div class="stat-card stat-card--offline">
        <div class="stat-card__value">{{ stats.offline }}</div>
        <div class="stat-card__label">离线</div>
      </div>
      <div class="stat-card stat-card--concurrency">
        <div class="stat-card__value">{{ stats.usedConcurrency }} <span class="stat-card__sub">/ {{ stats.totalConcurrency }}</span></div>
        <div class="stat-card__label">已用并发 / 总容量</div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="worker-toolbar">
      <el-radio-group v-model="statusFilter" @change="load">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="busy">执行中</el-radio-button>
        <el-radio-button value="online">空闲</el-radio-button>
        <el-radio-button value="offline">离线</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 节点列表 -->
    <div class="worker-grid">
      <div
        v-for="w in workers"
        :key="w.id"
        class="worker-card"
        :class="`worker-card--${w.status}`"
      >
        <!-- 卡片头部 -->
        <div class="worker-card__header">
          <div class="worker-card__title">
            <span class="worker-card__hostname">{{ w.hostname }}</span>
            <el-tag
              size="small"
              :type="statusType(w.status)"
              effect="light"
              class="worker-card__status-tag"
            >
              <span class="worker-card__status-dot" :class="`dot--${w.status}`" />
              {{ statusLabel(w.status) }}
            </el-tag>
          </div>
          <el-dropdown v-if="w.status !== 'offline'" trigger="click" @command="handleCommand($event, w)">
            <el-button :icon="MoreFilled" size="small" text />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="offline" style="color: #e0226e">下线节点</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 地址 -->
        <div class="worker-card__addr">
          <el-icon><Monitor /></el-icon>
          <span>{{ w.ip }}:{{ w.port }}</span>
        </div>

        <!-- 正在执行的任务 -->
        <div v-if="w.runningTaskName" class="worker-card__task">
          <el-icon><VideoPlay /></el-icon>
          <span>{{ w.runningTaskName }}</span>
        </div>

        <!-- 指标行 -->
        <div class="worker-card__metrics">
          <div class="metric">
            <div class="metric__label">CPU 使用率</div>
            <el-progress
              :percentage="w.cpuUsage"
              :stroke-width="6"
              :color="cpuColor(w.cpuUsage)"
              :show-text="false"
              style="flex: 1"
            />
            <span class="metric__value">{{ w.cpuUsage.toFixed(1) }}%</span>
          </div>
          <div class="metric">
            <div class="metric__label">内存使用率</div>
            <el-progress
              :percentage="w.memUsage"
              :stroke-width="6"
              :color="cpuColor(w.memUsage)"
              :show-text="false"
              style="flex: 1"
            />
            <span class="metric__value">{{ w.memUsage.toFixed(1) }}%</span>
          </div>
          <div class="metric">
            <div class="metric__label">并发占用</div>
            <el-progress
              :percentage="concurrencyPct(w)"
              :stroke-width="6"
              color="#3871dc"
              :show-text="false"
              style="flex: 1"
            />
            <span class="metric__value">{{ w.currentConcurrency }} / {{ w.maxConcurrency }}</span>
          </div>
        </div>

        <!-- 底部：CPU 核数 + 心跳时间 -->
        <div class="worker-card__footer">
          <span>{{ w.cpuCores }} 核 / {{ w.memTotalGb }} GB</span>
          <span>心跳 {{ heartbeatAgo(w.lastHeartbeat) }}</span>
        </div>
      </div>

      <EmptyState v-if="!loading && workers.length === 0" title="暂无节点" desc="没有符合条件的 Worker 节点" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, MoreFilled, Monitor, VideoPlay } from '@element-plus/icons-vue'
import request from '@/utils/request'
import type { WorkerNode, WorkerStatus } from '@/types'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const workers = ref<WorkerNode[]>([])
const loading = ref(false)
const statusFilter = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const stats = computed(() => {
  const all = workers.value
  const total = all.length
  const busy = all.filter(w => w.status === 'busy').length
  const online = all.filter(w => w.status === 'online').length
  const offline = all.filter(w => w.status === 'offline').length
  const usedConcurrency = all.reduce((s, w) => s + w.currentConcurrency, 0)
  const totalConcurrency = all.filter(w => w.status !== 'offline').reduce((s, w) => s + w.maxConcurrency, 0)
  return { total, busy, online, offline, usedConcurrency, totalConcurrency }
})

async function load() {
  loading.value = true
  try {
    const params: Record<string, string> = { pageSize: '100' }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await request.get('/workers', { params })
    workers.value = res.data.data.list
  } finally {
    loading.value = false
  }
}

function statusType(status: WorkerStatus) {
  if (status === 'busy') return 'warning'
  if (status === 'online') return 'success'
  return 'info'
}

function statusLabel(status: WorkerStatus) {
  if (status === 'busy') return '执行中'
  if (status === 'online') return '空闲'
  return '离线'
}

function cpuColor(pct: number) {
  if (pct >= 85) return '#e0226e'
  if (pct >= 60) return '#ff9900'
  return '#1b855e'
}

function concurrencyPct(w: WorkerNode) {
  if (!w.maxConcurrency) return 0
  return Math.min(100, Math.round(w.currentConcurrency / w.maxConcurrency * 100))
}

function heartbeatAgo(ts: string) {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (sec < 60) return `${sec}s 前`
  return `${Math.floor(sec / 60)}m 前`
}

async function handleCommand(cmd: string, w: WorkerNode) {
  if (cmd === 'offline') {
    await ElMessageBox.confirm(`确定将节点 ${w.hostname} 下线？`, '下线节点', {
      confirmButtonText: '确定下线',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await request.post(`/workers/${w.workerId}/offline`)
    ElMessage.success('节点已下线')
    load()
  }
}

onMounted(() => {
  load()
  timer = setInterval(load, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.worker-list-view {
  max-width: 1200px;
}

// ── 统计卡片 ────────────────────────────────────────────────────
.worker-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-card {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 16px 24px;
  box-shadow: $shadow-sm;
  min-width: 100px;
  border-top: 3px solid $border-color;

  &--busy   { border-top-color: $color-warning; }
  &--online { border-top-color: $color-success; }
  &--offline { border-top-color: $text-secondary; }
  &--concurrency { border-top-color: $color-primary; }

  &__value {
    font-size: 26px;
    font-weight: 700;
    color: $text-primary;
    line-height: 1.2;
  }

  &__sub {
    font-size: 14px;
    font-weight: 400;
    color: $text-secondary;
  }

  &__label {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 4px;
  }
}

// ── 筛选栏 ──────────────────────────────────────────────────────
.worker-toolbar {
  margin-bottom: 16px;
}

// ── 节点网格 ─────────────────────────────────────────────────────
.worker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.worker-card {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 18px 20px;
  box-shadow: $shadow-sm;
  border-left: 4px solid $border-color;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.15s ease;

  &:hover { box-shadow: $shadow-md; }

  &--busy    { border-left-color: $color-warning; }
  &--online  { border-left-color: $color-success; }
  &--offline { border-left-color: $text-secondary; opacity: 0.65; }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__hostname {
    font-weight: 600;
    font-size: 14px;
    color: $text-primary;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }

  &__status-tag {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__addr {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: $text-secondary;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }

  &__task {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: $color-warning;
    background: rgba($color-warning, 0.08);
    padding: 4px 8px;
    border-radius: $border-radius-sm;
  }

  &__metrics {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__footer {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: $text-secondary;
    padding-top: 6px;
    border-top: 1px solid $border-color-light;
  }
}

.dot--busy    { background: $color-warning; }
.dot--online  { background: $color-success; }
.dot--offline { background: $text-secondary; }

.worker-card__status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;

  .dot--busy & { animation: pulse 1.5s infinite; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.metric {
  display: flex;
  align-items: center;
  gap: 8px;

  &__label {
    font-size: 11px;
    color: $text-secondary;
    width: 60px;
    flex-shrink: 0;
  }

  &__value {
    font-size: 11px;
    color: $text-regular;
    width: 80px;
    text-align: right;
    flex-shrink: 0;
  }
}
</style>
