<template>
  <div class="worker-list-view">
    <PageHeader title="节点管理">
      <el-button :icon="Refresh" @click="refresh" :loading="loading">刷新</el-button>
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

    <!-- 全局调度设置 -->
    <div class="scheduling-settings">
      <div class="scheduling-settings__info">
        <div class="scheduling-settings__title">调度配额</div>
        <div class="scheduling-settings__desc">
          每核 RPS 系数 × CPU 核数 = 节点自报配额；与「单 Worker 上限」取 min 后用于调度加权分配
        </div>
      </div>
      <div class="scheduling-settings__controls">
        <div class="scheduling-settings__field">
          <span class="scheduling-settings__label">每核 RPS 系数</span>
          <el-input-number v-model="rpsPerCore" :min="50" :max="5000" :step="50" />
        </div>
        <div class="scheduling-settings__field">
          <span class="scheduling-settings__label">单 Worker 上限</span>
          <el-input-number v-model="maxRpsPerWorker" :min="100" :max="100000" :step="100" />
        </div>
        <el-button v-if="canScheduling" type="primary" :loading="savingScheduling" @click="saveScheduling">保存</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="worker-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索主机名或 IP"
        :prefix-icon="Search"
        clearable
        style="width: 240px"
        @input="handleKeywordInput"
        @clear="handleKeywordInput"
      />
      <el-radio-group v-model="statusFilter" @change="handleStatusChange">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="busy">执行中</el-radio-button>
        <el-radio-button value="online">空闲</el-radio-button>
        <el-radio-button value="offline">离线</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 节点列表 -->
    <div class="table-card">
      <el-table
        :data="workers"
        row-key="id"
        class="worker-table"
        :row-class-name="rowClassName"
      >
        <el-table-column label="主机名" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-mono">{{ row.hostname }}</span>
          </template>
        </el-table-column>
        <el-table-column label="地址" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell-mono cell-muted">{{ row.ip }}:{{ row.port }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="108">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="statusType(row.status)"
              effect="light"
              class="status-tag"
            >
              <span class="status-dot" :class="`dot--${row.status}`" />
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="正在执行的任务" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="runningTaskLabel(row)" class="task-name">{{ runningTaskLabel(row) }}</span>
            <span v-else class="cell-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="CPU 使用率" min-width="150">
          <template #default="{ row }">
            <div class="usage-cell">
              <span class="usage-cell__value">{{ row.cpuUsage.toFixed(1) }}%</span>
              <el-progress
                :percentage="clampPct(row.cpuUsage)"
                :stroke-width="6"
                :color="cpuColor(row.cpuUsage)"
                :show-text="false"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="内存使用率" min-width="150">
          <template #default="{ row }">
            <div class="usage-cell">
              <span class="usage-cell__value">{{ row.memUsage.toFixed(1) }}%</span>
              <el-progress
                :percentage="clampPct(row.memUsage)"
                :stroke-width="6"
                :color="cpuColor(row.memUsage)"
                :show-text="false"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="并发" width="110" align="right">
          <template #default="{ row }">
            <span class="cell-num">{{ row.currentConcurrency }} / {{ row.maxConcurrency }}</span>
          </template>
        </el-table-column>
        <el-table-column label="调度 RPS 配额" min-width="140">
          <template #default="{ row }">
            <div class="quota-cell">
              <span class="cell-num">{{ row.effectiveMaxRps ?? '—' }}</span>
              <span
                v-if="row.declaredMaxRps != null && row.declaredMaxRps !== row.effectiveMaxRps"
                class="cell-sub"
              >自报 {{ row.declaredMaxRps }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="规格" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.cpuCores }} 核 / {{ row.memTotalGb }} GB</span>
          </template>
        </el-table-column>
        <el-table-column label="心跳" width="100">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatHeartbeatAgo(heartbeatDisplaySec(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 'offline' && canOffline"
              size="small"
              type="danger"
              plain
              @click="offlineWorker(row)"
            >下线</el-button>
            <span v-else class="cell-muted">—</span>
          </template>
        </el-table-column>
        <template #empty>
          <EmptyState v-if="!loading" title="暂无节点" desc="没有符合条件的 Worker 节点" />
        </template>
      </el-table>

      <div class="worker-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @change="onPageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { notifyError, notifySuccess, getErrorMessage } from '@/utils/feedback'
import { confirmDanger } from '@/utils/confirm'
import { Refresh, Search } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { formatHeartbeatAgo } from '@/utils/format'
import { can } from '@/utils/permissions'
import { useAuthStore } from '@/stores/auth'
import type { WorkerListData, WorkerNode, WorkerStatus } from '@/types'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const workers = ref<WorkerNode[]>([])
const authStore = useAuthStore()
const canScheduling = computed(() => can(authStore.userInfo?.role, 'scheduling'))
const canOffline = computed(() => can(authStore.userInfo?.role, 'offline'))
const loading = ref(false)
const maxRpsPerWorker = ref(2000)
const rpsPerCore = ref(300)
const savingScheduling = ref(false)
const statusFilter = ref('')
const keyword = ref('')
const queryKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const stats = ref({
  total: 0,
  busy: 0,
  online: 0,
  offline: 0,
  usedConcurrency: 0,
  totalConcurrency: 0,
})
const workersFetchedAt = ref(0)
const nowTick = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

// 心跳间隔内维持最近一次非零 CPU/内存，避免轮询间隙展示为 0
const metricCache = new Map<string, { cpuUsage: number; memUsage: number }>()

function applyStickyMetrics(list: WorkerNode[]): WorkerNode[] {
  return list.map((w) => {
    const cached = metricCache.get(w.workerId)
    let cpuUsage = w.cpuUsage
    let memUsage = w.memUsage

    if (w.status === 'offline') {
      metricCache.delete(w.workerId)
      return w
    }

    if (cpuUsage > 0) {
      const next = { cpuUsage, memUsage: memUsage > 0 ? memUsage : (cached?.memUsage ?? 0) }
      metricCache.set(w.workerId, next)
      return { ...w, ...next }
    }
    if (memUsage > 0) {
      const next = { cpuUsage: cached?.cpuUsage ?? 0, memUsage }
      metricCache.set(w.workerId, next)
      return { ...w, ...next }
    }
    if (cached) {
      return { ...w, cpuUsage: cached.cpuUsage, memUsage: cached.memUsage }
    }
    return w
  })
}

function commitKeyword() {
  queryKeyword.value = keyword.value.trim()
}

function clearSearchTimer() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
}

async function load(opts?: { silent?: boolean }) {
  const silent = opts?.silent === true
  if (!silent) loading.value = true
  try {
    const params: Record<string, string | number> = {
      page: currentPage.value,
      pageSize: pageSize.value,
    }
    if (statusFilter.value) params.status = statusFilter.value
    if (queryKeyword.value) params.keyword = queryKeyword.value
    const res = await request.get('/workers', { params })
    const data = res.data.data as WorkerListData
    workers.value = applyStickyMetrics(data.list ?? [])
    total.value = data.total ?? 0
    stats.value = {
      total: data.total ?? 0,
      busy: data.busyCount ?? 0,
      online: data.onlineCount ?? 0,
      offline: data.offlineCount ?? 0,
      usedConcurrency: data.usedConcurrency ?? 0,
      totalConcurrency: data.totalConcurrency ?? 0,
    }
    workersFetchedAt.value = Date.now()
    nowTick.value = workersFetchedAt.value
  } catch (e) {
    if (!silent) throw e
  } finally {
    if (!silent) loading.value = false
  }
}

function reloadFromFirstPage() {
  if (currentPage.value !== 1) {
    currentPage.value = 1
    return
  }
  load()
}

function handleKeywordInput() {
  clearSearchTimer()
  searchTimer = setTimeout(() => {
    searchTimer = null
    commitKeyword()
    reloadFromFirstPage()
  }, 300)
}

function handleStatusChange() {
  clearSearchTimer()
  commitKeyword()
  reloadFromFirstPage()
}

function onPageChange() {
  load()
}

function refresh() {
  clearSearchTimer()
  const next = keyword.value.trim()
  if (next !== queryKeyword.value) {
    queryKeyword.value = next
    reloadFromFirstPage()
    return
  }
  load()
}

async function loadScheduling() {
  try {
    const res = await request.get('/settings/scheduling')
    maxRpsPerWorker.value = res.data.data.maxRpsPerWorker || 2000
    rpsPerCore.value = res.data.data.rpsPerCore || 300
  } catch {
    // 使用默认值
  }
}

async function saveScheduling() {
  savingScheduling.value = true
  try {
    await request.put('/settings/scheduling', {
      maxRpsPerWorker: maxRpsPerWorker.value,
      rpsPerCore: rpsPerCore.value,
    })
    notifySuccess('调度配额已更新', '保存成功')
  } catch (e) {
    notifyError(getErrorMessage(e), '保存失败')
  } finally {
    savingScheduling.value = false
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

function runningTaskLabel(row: WorkerNode) {
  return row.runningTaskName?.trim() || row.runningRunId?.trim() || ''
}

function cpuColor(pct: number) {
  if (pct >= 85) return '#e0226e'
  if (pct >= 60) return '#ff9900'
  return '#1b855e'
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function heartbeatDisplaySec(w: WorkerNode) {
  const elapsed = workersFetchedAt.value
    ? Math.max(0, Math.floor((nowTick.value - workersFetchedAt.value) / 1000))
    : 0
  return w.heartbeatAgoSec + elapsed
}

function rowClassName({ row }: { row: WorkerNode }) {
  return row.status === 'offline' ? 'worker-row--offline' : ''
}

function startTimers() {
  if (!timer) {
    timer = setInterval(() => {
      load({ silent: true })
    }, 5000)
  }
  if (!tickTimer) {
    tickTimer = setInterval(() => {
      nowTick.value = Date.now()
    }, 1000)
  }
}

function stopTimers() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  clearSearchTimer()
}

async function offlineWorker(w: WorkerNode) {
  const ok = await confirmDanger(`确定将节点 ${w.hostname} 下线？`, {
    title: '下线节点',
    confirmText: '确定下线',
  })
  if (!ok) return
  try {
    await request.post(`/workers/${w.workerId}/offline`)
    notifySuccess(`节点 ${w.hostname} 已下线`)
    load()
  } catch (e) {
    notifyError(getErrorMessage(e), '下线失败')
  }
}

onMounted(() => {
  load()
  loadScheduling()
  startTimers()
})

// keep-alive 缓存组件时，onUnmounted 不触发
// 用 onDeactivated/onActivated 管理定时器
onActivated(() => {
  if (!timer) {
    load()
    startTimers()
  }
})

onDeactivated(() => {
  stopTimers()
})

onUnmounted(() => {
  stopTimers()
})
</script>

<style lang="scss" scoped>
.worker-list-view {
  max-width: 100%;
}

// ── 统计卡片 ────────────────────────────────────────────────────
.worker-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.scheduling-settings {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 14px 18px;
  background: $bg-card;
  border-radius: $border-radius;
  box-shadow: $shadow-sm;
  border: 1px solid $border-color-light;

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
  }

  &__desc {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 4px;
  }

  &__controls {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__label {
    font-size: 12px;
    color: $text-secondary;
  }
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
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.table-card {
  background: $bg-card;
  border-radius: $border-radius;
  border: 1px solid $border-color-light;
  overflow: hidden;
}

.worker-table {
  :deep(.el-table__header th) {
    color: $text-regular;
    font-weight: 600;
  }

  :deep(.worker-row--offline) {
    opacity: 0.65;
  }

  :deep(.el-table__empty-block) {
    min-height: 220px;
  }
}

.worker-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid $border-color-light;
}

.cell-mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  color: $text-primary;
}

.cell-muted {
  color: $text-secondary;
  font-size: 13px;
}

.cell-num {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: $text-regular;
}

.cell-sub {
  font-size: 12px;
  color: $text-secondary;
}

.status-tag {
  display: inline-flex;
  align-items: center;
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 4px;
  border-radius: 50%;
  vertical-align: middle;

  &.dot--busy {
    background: $color-warning;
    animation: pulse 1.5s infinite;
  }

  &.dot--online { background: $color-success; }
  &.dot--offline { background: $text-secondary; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.task-name {
  color: $color-warning;
  font-size: 13px;
}

.usage-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .el-progress {
    flex: 1;
    min-width: 48px;
  }

  &__value {
    width: 48px;
    flex-shrink: 0;
    text-align: right;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: $text-regular;
  }
}

.quota-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}
</style>
