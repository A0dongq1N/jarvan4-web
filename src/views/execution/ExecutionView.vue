<template>
  <div class="execution-view">
    <ExecutionStepper
      :status="executionStatus"
      :has-report="!!executionStore.state?.reportId"
      :deploy-done="deployDone"
      :traffic-started="trafficStarted"
    />

    <!-- Control Panel -->
    <div class="execution-control">
      <div class="execution-control__info">
        <div class="execution-control__task-name">{{ taskName }}</div>
        <div class="execution-control__status">
          <StatusBadge :status="executionStatus" />
          <span v-if="executionStore.state && executionStatus === 'running'" class="execution-control__elapsed">
            {{ formatDuration(executionStore.state.elapsedSeconds) }}
          </span>
          <span v-if="executionStore.scenarioMode === 'rps' && executionStatus === 'running'" class="rps-badge">
            RPS 模式 &nbsp;目标: {{ executionStore.targetRps }} req/s
          </span>
        </div>
        <p v-if="showStartHint" class="execution-control__hint">
          先创建执行并勾选脚本，部署完成后再注入流量
        </p>
        <p v-else-if="executionStatus === 'pending'" class="execution-control__hint">
          勾选本次要部署的脚本，确认后点击「开始部署」
        </p>
      </div>

      <div class="execution-control__actions">
        <el-button
          v-if="canStartDeploy"
          type="primary"
          :icon="VideoPlay"
          size="large"
          :loading="executionStore.loading"
          @click="handleStart"
        >
          {{ startStressLabel }}
        </el-button>
        <el-button
          v-if="executionStatus === 'pending'"
          type="primary"
          :icon="VideoPlay"
          size="large"
          :loading="executionStore.loading"
          :disabled="selectedScriptIds.length === 0"
          @click="handleDeploy"
        >
          开始部署
        </el-button>
        <el-button
          v-if="isDeploying"
          type="primary"
          :icon="VideoPlay"
          size="large"
          loading
          disabled
        >
          正在部署脚本...
        </el-button>
        <el-button
          v-if="executionStatus === 'prepared' && hasDeployedScripts"
          type="primary"
          :icon="VideoPlay"
          size="large"
          class="start-run-btn"
          :loading="executionStore.loading"
          @click="handleStartRun"
        >
          开始注入流量
        </el-button>
        <el-button
          v-if="canStop"
          type="danger"
          :icon="VideoPause"
          size="large"
          @click="handleStop"
        >
          {{ stopButtonLabel }}
        </el-button>
        <el-button
          v-if="executionStatus === 'success' || executionStatus === 'stopped' || executionStatus === 'circuit_broken'"
          type="success"
          size="large"
          :icon="Document"
          @click="goReport"
        >
          查看报告
        </el-button>
      </div>
    </div>

    <!-- 失败原因（运行期失败；准备阶段失败由 init-panel 展示） -->
    <el-alert
      v-if="executionStatus === 'failed' && executionStore.state?.errorMsg && !isDeployFailure"
      type="error"
      title="压测失败"
      :description="executionStore.state.errorMsg"
      show-icon
      :closable="false"
      class="execution-error-alert"
    />

    <!-- 流量注入启动失败（保持 prepared，可修复后重试） -->
    <el-alert
      v-if="executionStatus === 'prepared' && injectBlockError"
      type="error"
      show-icon
      :closable="false"
      class="execution-error-alert"
      title="流量注入启动失败"
      :description="injectBlockError"
    />
    <el-alert
      v-else-if="executionStatus === 'prepared' && executionStore.state?.errorMsg"
      type="error"
      show-icon
      :closable="false"
      class="execution-error-alert"
      title="流量注入启动失败"
      :description="executionStore.state.errorMsg"
    />

    <!-- 部署阶段 -->
    <section v-if="showDeployZone" class="phase-panel">
      <div class="phase-panel__header">
        <h3 class="phase-panel__title">{{ deployPhaseTitle }}</h3>
        <span class="phase-panel__subtitle">{{ deployPhaseSubtitle }}</span>
      </div>

      <el-alert
        v-if="!hasTaskScripts && canStartDeploy"
        type="warning"
        show-icon
        :closable="false"
        class="deploy-block-alert"
        title="未绑定压测脚本"
        description="请先在任务详情的「脚本绑定」页签中添加脚本，否则无法完成部署。"
      />

      <el-alert
        v-if="deployBlockError"
        type="error"
        show-icon
        :closable="false"
        class="deploy-block-alert"
        :title="formatDeployError(deployBlockError).title"
        :description="formatDeployError(deployBlockError).description"
      />

    <div v-if="executionStatus === 'pending'" class="script-select-panel">
      <div class="script-select-panel__header">
        <span class="script-select-panel__title">选择要部署的脚本</span>
        <span class="script-select-panel__hint">未勾选的脚本不会下发到 Worker，也不参与本次注入</span>
      </div>
      <el-checkbox
        :model-value="allScriptsSelected"
        :indeterminate="scriptsIndeterminate"
        @change="toggleSelectAll"
      >
        全选
      </el-checkbox>
      <el-checkbox-group v-model="selectedScriptIds" class="script-select-panel__list">
        <label
          v-for="s in candidateScripts"
          :key="s.scriptId"
          class="script-select-item"
        >
          <el-checkbox :value="s.scriptId">
            <span class="script-select-item__name">{{ s.scriptName }}</span>
            <code v-if="s.commitHash" class="script-select-item__hash">{{ s.commitHash.slice(0, 8) }}</code>
          </el-checkbox>
        </label>
      </el-checkbox-group>
    </div>

    <!-- Preparing/DeployFailed: 初始化面板 -->
    <div v-if="executionStatus === 'preparing' || isDeployFailure" class="init-panel">
      <div class="init-panel__header">
        <span class="init-panel__title">
          <template v-if="isDeployFailure">{{ deployFailureTitle }}</template>
          <template v-else>正在部署脚本到 Worker...</template>
        </span>
        <span class="init-panel__hint">
          <template v-if="isDeployFailure">请根据失败原因调整任务配置或扩容节点后，点击「再次压测」重试</template>
          <template v-else>部署完成后需确认才会开始注入流量</template>
        </span>
      </div>
      <div class="init-steps">
        <div
          v-for="step in executionStore.state?.initSteps ?? []"
          :key="step.key"
          class="init-step"
          :class="`init-step--${step.status}`"
        >
          <div class="init-step__main">
            <span class="init-step__icon">
              <svg v-if="step.status === 'running'" class="spin-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-dasharray="28 56" />
              </svg>
              <svg v-else-if="step.status === 'done'" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" fill-opacity="0.15" />
                <path d="M7 12.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="step.status === 'error'" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" fill-opacity="0.15" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" />
              </svg>
            </span>
            <span class="init-step__label">{{ step.label }}</span>
            <span v-if="step.detail" class="init-step__detail">{{ step.detail }}</span>
          </div>
          <div v-if="step.items?.length" class="init-step__items">
            <code v-for="item in step.items" :key="item" class="init-step__tag">{{ item }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Prepared: 部署完成待注入 -->
    <div v-if="executionStatus === 'prepared' && hasDeployedScripts" class="prepared-panel">
      <div class="prepared-panel__icon">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="currentColor" fill-opacity="0.15" />
          <path d="M7 12.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="prepared-panel__text">
        <div class="prepared-panel__title">脚本部署完成，可开始注入流量</div>
        <div class="prepared-panel__hint">
          已选定 {{ executionStore.state?.workerSnapshots?.length || 0 }} 个 Worker 节点并加载脚本插件，确认后才会开始发压。
          超过 15 分钟未开始注入流量将自动取消并释放 Worker。
        </div>
        <div v-if="executionStore.state?.workerSnapshots?.length" class="prepared-panel__workers">
          <span v-for="w in executionStore.state.workerSnapshots" :key="w.workerId" class="prepared-panel__worker-tag">
            <code>{{ w.ip }}</code>
            <span class="prepared-panel__worker-spec">{{ workerSpecLabel(w) }}</span>
          </span>
        </div>
        <div v-if="scenePlan" class="scene-plan">
          <div class="scene-plan__title">本次压测计划</div>
          <div class="scene-plan__summary">{{ scenePlanSummary }}</div>
          <div v-if="scenePlan.scripts?.length && scenePlan.mode === 'rps'" class="scene-plan__section">
            <span class="scene-plan__label">脚本目标 RPS</span>
            <div class="scene-plan__tags">
              <span v-for="s in scenePlan.scripts" :key="s.scriptName" class="scene-plan__tag">
                {{ s.scriptName }} · {{ s.targetRps }} RPS
              </span>
            </div>
          </div>
          <div v-else-if="scenePlan.scripts && scenePlan.scripts.length > 1" class="scene-plan__section">
            <span class="scene-plan__label">脚本流量权重</span>
            <div class="scene-plan__tags">
              <span v-for="s in scenePlan.scripts" :key="s.scriptName" class="scene-plan__tag">
                {{ s.scriptName }} · 权重 {{ s.weight }}
              </span>
            </div>
          </div>
          <div v-if="scenePlan.workers?.length && scenePlan.mode === 'rps'" class="scene-plan__section">
            <span class="scene-plan__label">节点分配</span>
            <div class="scene-plan__tags">
              <span v-for="w in scenePlan.workers" :key="w.addr" class="scene-plan__tag">
                {{ w.addr }} · 分配 {{ w.assignedRps }} RPS
                <template v-if="w.effectiveQuota">（配额 {{ w.effectiveQuota }}）</template>
              </span>
            </div>
          </div>
        </div>
        <div class="prepared-panel__options">
          <el-checkbox v-model="autoInject">部署完成后自动开始注入流量</el-checkbox>
        </div>
      </div>
    </div>

    <!-- Prepared 但无脚本：不应出现，防御性提示 -->
    <div v-if="executionStatus === 'prepared' && !hasDeployedScripts" class="prepared-panel prepared-panel--warn">
      <div class="prepared-panel__text">
        <div class="prepared-panel__title">未检测到已部署脚本</div>
        <div class="prepared-panel__hint">
          当前执行未绑定压测脚本，无法注入流量。请返回任务详情绑定脚本后重新执行。
        </div>
      </div>
    </div>

    <!-- 脚本部署进度（preparing 和 prepared 状态都显示，独立区块） -->
    <div
      v-if="(executionStatus === 'preparing' || executionStatus === 'prepared') && executionStore.state?.scriptStatuses?.length"
      class="script-deploy"
    >
      <div class="script-deploy__header">
        <span class="script-deploy__title">部署明细</span>
        <span class="script-deploy__summary" :class="scriptDeploySummaryClass">{{ scriptDeploySummary }}</span>
      </div>
      <div class="script-deploy-list">
        <div
          v-for="s in executionStore.state.scriptStatuses"
          :key="s.scriptId"
          class="script-deploy-item"
          :class="`script-deploy-item--${s.status}`"
        >
          <div class="script-deploy-item__main">
            <span class="script-deploy-item__icon">
              <svg v-if="s.status === 'downloading'" class="spin-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-dasharray="28 56" />
              </svg>
              <svg v-else-if="s.status === 'ready'" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" fill-opacity="0.15" />
                <path d="M7 12.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="s.status === 'failed'" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" fill-opacity="0.15" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" />
              </svg>
            </span>
            <span class="script-deploy-item__name">{{ s.scriptName }}</span>
          </div>
          <div class="script-deploy-item__meta">
            <div class="script-deploy-item__row">
              <span class="script-deploy-item__label">commit:</span>
              <code class="script-deploy-item__hash">{{ s.commitHash ? s.commitHash.slice(0, 8) : '-' }}</code>
            </div>
            <div class="script-deploy-item__row">
              <span class="script-deploy-item__label">artifact:</span>
              <code class="script-deploy-item__artifact">{{ s.artifactUrl || '-' }}</code>
            </div>
          </div>
          <div v-if="s.workers?.length" class="script-deploy-workers">
            <div class="script-deploy-workers__title">节点部署</div>
            <div
              v-for="w in s.workers"
              :key="w.workerId"
              class="script-deploy-worker"
              :class="`script-deploy-worker--${w.status}`"
            >
              <span class="script-deploy-worker__addr">{{ w.addr }}</span>
              <span class="script-deploy-worker__status">{{ scriptStatusLabel(w.status) }}</span>
              <el-alert
                v-if="w.status === 'failed' && w.error"
                type="error"
                show-icon
                :closable="false"
                class="script-deploy-worker__alert"
                :title="formatDeployError(w.error).title"
                :description="formatDeployError(w.error).description"
              />
            </div>
          </div>
          <div v-else class="script-deploy-item__row script-deploy-item__row--fallback">
            <span class="script-deploy-item__label">状态:</span>
            <span class="script-deploy-item__status">{{ scriptStatusLabel(s.status) }}</span>
          </div>
          <el-alert
            v-if="s.status === 'failed' && s.error"
            type="error"
            show-icon
            :closable="false"
            class="script-deploy-item__alert"
            :title="formatDeployError(s.error).title"
            :description="formatDeployError(s.error).description"
          />
        </div>
      </div>
    </div>
    </section>

    <!-- 流量注入阶段 -->
    <section v-if="showStressZone" class="phase-panel">
      <div class="phase-panel__header">
        <h3 class="phase-panel__title">流量注入监控</h3>
        <span class="phase-panel__subtitle">实时观测压测指标、接口表现与错误分析</span>
      </div>

    <!-- Summary Metrics + Charts（与报告页同一套展示） -->
    <template v-if="executionStatus !== 'pending' && executionStatus !== 'preparing' && executionStatus !== 'prepared' && executionStatus !== 'idle'">
      <StressReportResults
        v-if="executionStore.liveReport"
        :report="executionStore.liveReport"
        :show-verdict="isTerminalExecution"
      />

      <ExecutionLogPanel
        :logs="logs"
        :dropped-logs="droppedLogs"
        :level-filter="logLevelFilter"
        :worker-filter="logWorkerFilter"
        :workers="executionStore.state?.workerSnapshots ?? []"
        title="实时日志"
        show-auto-scroll
        empty-text="暂无日志"
        @update:level-filter="executionStore.setLogLevelFilter"
        @update:worker-filter="executionStore.setLogWorkerFilter"
        @clear="executionStore.clearLogs"
      />
    </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { VideoPlay, VideoPause, Document } from '@element-plus/icons-vue'
import { useExecutionStore } from '@/stores/execution'
import { useTaskStore } from '@/stores/task'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ExecutionStepper from '@/components/execution/ExecutionStepper.vue'
import ExecutionLogPanel from '@/components/execution/ExecutionLogPanel.vue'
import StressReportResults from '@/components/report/StressReportResults.vue'
import { formatDuration } from '@/utils/format'
import { formatDeployError } from '@/utils/execution'
import request from '@/utils/request'
import type { TaskStatus, ScriptStatus, WorkerSnapshot, ExecutionState } from '@/types'

const route = useRoute()
const router = useRouter()
const executionStore = useExecutionStore()
const { logs, droppedLogs, logWorkerFilter } = storeToRefs(executionStore)
const taskStore = useTaskStore()

const AUTO_INJECT_KEY = 'jarvan4_execution_auto_inject'

const taskId = computed(() => route.params.taskId as string)
const taskName = ref('加载中...')
const taskScriptCount = ref(0)
const deployBlockError = ref('')
const injectBlockError = ref('')
const selectedScriptIds = ref<string[]>([])
const logLevelFilter = computed({
  get: () => executionStore.logLevelFilter,
  set: (value: string) => executionStore.setLogLevelFilter(value ?? ''),
})
const autoInject = ref(localStorage.getItem(AUTO_INJECT_KEY) === 'true')

const executionStatus = computed<TaskStatus>(() => executionStore.state?.status || 'idle')

const isTerminalExecution = computed(() =>
  ['success', 'stopped', 'circuit_broken', 'failed'].includes(executionStatus.value),
)

const trafficStarted = computed(() => {
  const s = executionStore.state
  if (!s) return false
  return !!s.startTime || s.elapsedSeconds > 0 || s.status === 'running' || s.status === 'success'
})

const deployDone = computed(() => {
  const s = executionStore.state
  if (!s) return false
  if (['prepared', 'running', 'success'].includes(s.status)) return true
  if (trafficStarted.value) return true
  const statuses = s.scriptStatuses
  return !!(statuses?.length && statuses.every(st => st.status === 'ready'))
})

const scenePlan = computed(() => executionStore.state?.scenePlan)

const scenePlanSummary = computed(() => {
  const plan = scenePlan.value
  if (!plan) return ''
  const duration = plan.durationSec ? ` · 总时长 ${plan.durationSec}s` : ''
  if (plan.mode === 'rps') {
    return `RPS 阶梯爬升 · 峰值 ${plan.peakRps ?? executionStore.targetRps ?? '-'} req/s${duration}`
  }
  return `VU 阶梯爬升 · 峰值 ${plan.peakConcurrent ?? '-'} 并发${duration}`
})

function workerSpecLabel(w: WorkerSnapshot): string {
  const base = `${w.cpuCores} 核 · ${w.memTotalGb?.toFixed(1) || '?'} GB · 最大并发 ${w.maxConcurrency}`
  const planWorkers = scenePlan.value?.workers
  if (planWorkers?.length) {
    const match = planWorkers.find(pw => pw.addr === w.ip || pw.addr === w.hostname)
    if (match?.assignedRps) {
      return `${base} · 分配 ${match.assignedRps} RPS`
    }
  }
  if (w.effectiveMaxRps) {
    return `${base} · RPS 配额 ${w.effectiveMaxRps}`
  }
  return base
}

const hasTaskScripts = computed(() => taskScriptCount.value > 0)

const isDeployFailure = computed(() =>
  executionStatus.value === 'failed'
  && !!executionStore.state?.errorMsg
  && !(executionStore.state?.elapsedSeconds && executionStore.state.elapsedSeconds > 0)
)

const isCapacityDeployFailure = computed(() =>
  isDeployFailure.value
  && executionStore.state?.initSteps?.some(s => s.key === 'select_worker' && s.status === 'error')
)

const deployFailureTitle = computed(() =>
  isCapacityDeployFailure.value ? '压测准备失败' : '脚本部署失败'
)

const deployPhaseTitle = computed(() =>
  isCapacityDeployFailure.value ? '压测准备' : '脚本部署'
)

const deployPhaseSubtitle = computed(() => {
  if (isCapacityDeployFailure.value) return '校验集群容量与节点资源，通过后再分发脚本'
  if (executionStatus.value === 'pending') return '勾选本次要部署的脚本，确认后再下发到 Worker'
  return '将脚本插件分发到 Worker 节点并完成加载'
})

const candidateScripts = computed(() => executionStore.state?.scriptSnapshots ?? [])

const allScriptsSelected = computed(() =>
  candidateScripts.value.length > 0
  && selectedScriptIds.value.length === candidateScripts.value.length,
)

const scriptsIndeterminate = computed(() =>
  selectedScriptIds.value.length > 0
  && selectedScriptIds.value.length < candidateScripts.value.length,
)

function toggleSelectAll(checked: boolean | string | number) {
  selectedScriptIds.value = checked
    ? candidateScripts.value.map(s => s.scriptId)
    : []
}

const hasDeployedScripts = computed(() =>
  (executionStore.state?.scriptStatuses?.length ?? 0) > 0
    || (executionStore.state?.scriptSnapshots?.length ?? 0) > 0
)

const canStartDeploy = computed(() =>
  ['idle', 'success', 'failed', 'stopped'].includes(executionStatus.value)
)
const isDeploying = computed(() =>
  executionStatus.value === 'preparing'
)
const canStop = computed(() =>
  ['pending', 'preparing', 'prepared', 'running'].includes(executionStatus.value)
)
const showDeployZone = computed(() =>
  ['pending', 'preparing', 'prepared'].includes(executionStatus.value)
  || isDeployFailure.value
  || (canStartDeploy.value && !hasTaskScripts.value)
)
const showStressZone = computed(() =>
  ['running', 'success', 'stopped', 'failed', 'circuit_broken'].includes(executionStatus.value)
  && !isDeployFailure.value
)
const startStressLabel = computed(() =>
  ['success', 'stopped', 'failed'].includes(executionStatus.value) ? '再次压测' : '开始压测'
)
const showStartHint = computed(() => canStartDeploy.value)
const stopButtonLabel = computed(() => {
  if (executionStatus.value === 'running') return '停止注入'
  if (executionStatus.value === 'prepared') return '取消执行'
  return '取消压测'
})

onMounted(async () => {
  try {
    const task = await taskStore.fetchById(taskId.value)
    taskName.value = task.name
    taskScriptCount.value = task.scripts?.length ?? 0
  } catch {
    taskName.value = '未知任务'
  }

  const execId = route.query.execId as string | undefined
  const autostart = route.query.autostart === '1'

  if (execId) {
    // 刷新恢复：已有执行 ID，重连到正在运行的执行，不清空状态
    await executionStore.resumeExecution(execId)
  } else {
    const active = await executionStore.findActiveExecution(taskId.value)
    if (active) {
      await executionStore.resumeExecution(active.id)
      router.replace({ path: route.path, query: { execId: active.id } })
      if (autostart) {
        ElMessage.info('已恢复进行中的压测')
      }
    } else {
      executionStore.reset()
      if (autostart) {
        await executionStore.startExecution(taskId.value)
        if (executionStore.state?.id) {
          router.replace({ path: route.path, query: { execId: executionStore.state.id } })
        }
      }
    }
  }
})

onUnmounted(() => {
  executionStore.stopTimers()
})

watch(autoInject, (val) => {
  localStorage.setItem(AUTO_INJECT_KEY, String(val))
})

watch(candidateScripts, (list) => {
  if (executionStatus.value === 'pending' && list.length && selectedScriptIds.value.length === 0) {
    selectedScriptIds.value = list.map(s => s.scriptId)
  }
}, { immediate: true })

watch(executionStatus, async (status, prevStatus) => {
  if (status === 'prepared' && (prevStatus === 'pending' || prevStatus === 'preparing')) {
    ElMessage.success('脚本部署完成，可开始注入流量')
    if (autoInject.value) {
      await handleStartRun()
    }
  } else if (status === 'running' && prevStatus === 'prepared') {
    ElMessage.success('已开始注入流量')
  } else if (status === 'running' && (prevStatus === 'pending' || prevStatus === 'preparing')) {
    ElMessage.success('部署完成，已开始注入流量')
  } else if (status === 'success') {
    ElMessage.success('流量注入完成，正在跳转报告...')
    const reportId = executionStore.state?.reportId
    router.push(reportId ? `/report/${reportId}` : '/report')
  } else if (status === 'stopped') {
    const msg = executionStore.state?.errorMsg
    if (prevStatus === 'prepared' && msg) {
      ElMessage.warning(msg)
    } else if (prevStatus === 'prepared') {
      ElMessage.warning('等待超时，已自动取消')
    } else {
      ElMessage.warning('流量注入已停止')
    }
  } else if (status === 'failed') {
    const raw = executionStore.state?.errorMsg || '执行失败'
    ElMessage.error(formatDeployError(raw).title)
  } else if (status === 'circuit_broken') {
    ElMessage.error(executionStore.state?.errorMsg || '熔断保护已触发，压测已自动停止')
  }
})

async function handleStart() {
  deployBlockError.value = ''
  try {
    const task = await taskStore.fetchById(taskId.value)
    taskScriptCount.value = task.scripts?.length ?? 0
    if (!taskScriptCount.value) {
      const msg = '任务未绑定压测脚本，请先在任务详情 → 脚本绑定中添加脚本'
      deployBlockError.value = msg
      ElMessage.error(msg)
      return
    }
    if (executionStatus.value !== 'idle') {
      executionStore.reset()
    }
    selectedScriptIds.value = []
    await executionStore.startExecution(taskId.value)
    if (executionStore.state?.id) {
      router.replace({ query: { ...route.query, execId: executionStore.state.id, autostart: undefined } })
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    const msg = err?.response?.data?.message || '启动压测失败'
    deployBlockError.value = msg
    ElMessage.error(msg)
  }
}

async function handleDeploy() {
  const id = executionStore.state?.id
  if (!id) return
  if (selectedScriptIds.value.length === 0) {
    ElMessage.warning('请至少选择一个脚本')
    return
  }
  deployBlockError.value = ''
  executionStore.loading = true
  try {
    // 直接打接口，不经过 store action：避免 Vite/Pinia HMR 仍持有旧 store 实例时
    // 出现 executionStore.deployScripts is not a function
    const res = await request.post(`/executions/${id}/deploy`, { scriptIds: selectedScriptIds.value })
    const executionState = res.data.data as ExecutionState
    await executionStore.resumeExecution(id)
    if (executionState?.status === 'failed' || executionStore.state?.status === 'failed') {
      deployBlockError.value = executionState?.errorMsg || executionStore.state?.errorMsg || '部署失败'
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    const msg = err?.response?.data?.message || err?.message || '部署失败'
    deployBlockError.value = msg
    ElMessage.error(msg)
  } finally {
    executionStore.loading = false
  }
}

// prepared → running：手动触发已部署的执行
async function handleStartRun() {
  if (!executionStore.state?.id) return
  injectBlockError.value = ''
  try {
    await executionStore.startRun(executionStore.state.id)
    ElMessage.success('已开始注入流量')
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    const msg = err?.response?.data?.message || executionStore.state?.errorMsg || '流量注入启动失败'
    injectBlockError.value = msg
    ElMessage.error(msg)
  }
}

async function handleStop() {
  const prevStatus = executionStatus.value
  await executionStore.stopExecution()
  const msg = prevStatus === 'running'
    ? '已停止流量注入'
    : prevStatus === 'prepared'
      ? '已取消执行'
      : '已取消压测'
  ElMessage.info(msg)
}

function goReport() {
  const reportId = executionStore.state?.reportId
  router.push(reportId ? `/report/${reportId}` : '/report')
}

function scriptStatusLabel(status: ScriptStatus): string {
  const map: Record<ScriptStatus, string> = {
    pending: '等待中',
    downloading: '下载中...',
    ready: '已就绪',
    failed: '失败',
  }
  return map[status] || status
}

// 脚本部署统计摘要："2/2 已就绪" 或 "1/2 已就绪，1 失败"
const scriptDeploySummary = computed(() => {
  const list = executionStore.state?.scriptStatuses ?? []
  if (!list.length) return ''
  const hasWorkers = list.some(s => (s.workers?.length ?? 0) > 0)
  if (hasWorkers) {
    const total = list.reduce((n, s) => n + (s.workers?.length ?? 0), 0)
    const ready = list.reduce((n, s) => n + (s.workers?.filter(w => w.status === 'ready').length ?? 0), 0)
    const failed = list.reduce((n, s) => n + (s.workers?.filter(w => w.status === 'failed').length ?? 0), 0)
    if (failed > 0) return `${ready}/${total} 节点已就绪，${failed} 失败`
    return `${ready}/${total} 节点已就绪`
  }
  const ready = list.filter(s => s.status === 'ready').length
  const failed = list.filter(s => s.status === 'failed').length
  const total = list.length
  if (failed > 0) return `${ready}/${total} 已就绪，${failed} 失败`
  return `${ready}/${total} 已就绪`
})

const scriptDeploySummaryClass = computed(() => {
  const list = executionStore.state?.scriptStatuses ?? []
  if (!list.length) return ''
  const hasWorkers = list.some(s => (s.workers?.length ?? 0) > 0)
  if (hasWorkers) {
    const total = list.reduce((n, s) => n + (s.workers?.length ?? 0), 0)
    const ready = list.reduce((n, s) => n + (s.workers?.filter(w => w.status === 'ready').length ?? 0), 0)
    const failed = list.reduce((n, s) => n + (s.workers?.filter(w => w.status === 'failed').length ?? 0), 0)
    if (failed > 0) return 'script-deploy__summary--has-failed'
    if (ready === total && total > 0) return 'script-deploy__summary--all-ready'
    return ''
  }
  const failed = list.filter(s => s.status === 'failed').length
  const ready = list.filter(s => s.status === 'ready').length
  if (failed > 0) return 'script-deploy__summary--has-failed'
  if (ready === list.length) return 'script-deploy__summary--all-ready'
  return ''
})
</script>

<style lang="scss" scoped>
.execution-view {
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.execution-error-alert,
.deploy-block-alert {
  margin: 0;

  :deep(.el-alert__description) {
    white-space: pre-line;
    line-height: 1.6;
  }
}

.phase-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;
  }

  &__subtitle {
    font-size: 13px;
    color: $text-secondary;
  }
}

.execution-control {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px 24px;
  box-shadow: $shadow-sm;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &__task-name {
    font-size: 18px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 6px;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: $text-secondary;
    line-height: 1.5;
  }

  &__elapsed {
    font-size: 14px;
    color: $text-secondary;
    font-variant-numeric: tabular-nums;
    font-family: 'SF Mono', 'Monaco', monospace;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

// RPS 模式标识徽章
.rps-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: rgba(114, 46, 209, 0.1);
  border: 1px solid rgba(114, 46, 209, 0.35);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #722ed1;
  letter-spacing: 0.02em;
}

// prepared 状态：开始压测按钮 - 带脉冲动画醒目
.start-run-btn {
  animation: pulse-btn 2s infinite;
}

@keyframes pulse-btn {
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 113, 220, 0.5); }
  50% { box-shadow: 0 0 0 10px rgba(56, 113, 220, 0); }
}

// ── Prepared 部署完成提示面板 ──────────────────────────────────────────
.prepared-panel {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 32px;
  box-shadow: $shadow-sm;
  border: 1px solid rgba(8, 151, 156, 0.25);
  display: flex;
  align-items: center;
  gap: 18px;

  &__icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    color: #08979c;
    display: flex;
    align-items: center;
    justify-content: center;

    svg { width: 48px; height: 48px; }
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    color: $text-primary;
  }

  &__hint {
    font-size: 13px;
    color: $text-secondary;
  }

  &__workers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  &__worker-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: $bg-page;
    border: 1px solid $border-color;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;

    code {
      color: #08979c;
      font-weight: 600;
    }
  }

  &__worker-spec {
    color: $text-secondary;
  }

  &__options {
    margin-top: 8px;
  }
}

.scene-plan {
  margin-top: 12px;
  padding: 12px 14px;
  background: rgba(8, 151, 156, 0.06);
  border: 1px solid rgba(8, 151, 156, 0.2);
  border-radius: 8px;

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: #08979c;
    margin-bottom: 6px;
  }

  &__summary {
    font-size: 14px;
    font-weight: 500;
    color: $text-primary;
    margin-bottom: 8px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  &__label {
    font-size: 12px;
    color: $text-secondary;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__tag {
    display: inline-block;
    padding: 2px 8px;
    background: $bg-page;
    border: 1px solid $border-color;
    border-radius: 4px;
    font-size: 12px;
    color: $text-primary;
  }
}

.script-select-panel {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px 24px;
  box-shadow: $shadow-sm;
  border: 1px solid $border-color-light;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 14px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
  }

  &__hint {
    font-size: 12px;
    color: $text-secondary;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }
}

.script-select-item {
  display: flex;
  align-items: center;

  &__name {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-weight: 600;
    font-size: 13px;
    margin-right: 8px;
  }

  &__hash {
    font-size: 12px;
    color: $color-primary;
    background: $color-primary-light-9;
    padding: 1px 6px;
    border-radius: 4px;
  }
}

// ── Pending 初始化面板 ─────────────────────────────────────────────────
.init-panel {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 28px 32px;
  box-shadow: $shadow-sm;
  border: 1px solid rgba(114, 46, 209, 0.15);

  &__header {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin-bottom: 24px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
  }

  &__hint {
    font-size: 13px;
    color: $text-secondary;
  }
}

.init-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.init-step {
  padding: 12px 0;
  border-bottom: 1px solid $border-color-light;
  transition: opacity 0.2s;

  &:last-child { border-bottom: none; }

  // 主行：图标 + 标题 + 摘要
  &__main {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  &__label {
    font-size: 14px;
    flex: 1;
  }

  &__detail {
    font-size: 12px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    padding: 1px 8px;
    border-radius: 4px;
    flex-shrink: 1;
    max-width: 50%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // 子行：tag 列表，左侧与标题文字对齐（icon宽20 + gap12 = 32px）
  &__items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    padding-left: 32px;
  }

  &__tag {
    display: inline-block;
    font-size: 12px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    padding: 2px 10px;
    border-radius: 4px;
    width: fit-content;
  }

  // 等待：灰色
  &--waiting {
    opacity: 0.45;
    .init-step__icon { color: $text-secondary; }
    .init-step__label { color: $text-secondary; }
    .init-step__detail,
    .init-step__tag { background: $bg-page; color: $text-secondary; }
  }

  // 进行中：蓝紫色 + 旋转
  &--running {
    .init-step__icon { color: #722ed1; }
    .init-step__label { color: $text-primary; font-weight: 500; }
    .init-step__detail,
    .init-step__tag { background: rgba(114, 46, 209, 0.08); color: #722ed1; }
  }

  // 完成：绿色
  &--done {
    .init-step__icon { color: $color-success; }
    .init-step__label { color: $text-regular; }
    .init-step__detail,
    .init-step__tag {
      background: rgba($color-success, 0.08);
      color: $color-success;
    }
  }

  // 错误：红色
  &--error {
    .init-step__icon { color: $color-danger; }
    .init-step__label { color: $color-danger; }
    .init-step__detail,
    .init-step__tag { background: rgba($color-danger, 0.08); color: $color-danger; }
    .init-step__detail {
      white-space: nowrap;
    }
  }
}

// SVG 旋转动画
.spin-icon {
  animation: spin 0.9s linear infinite;
  transform-origin: center;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

// ── 脚本部署进度（独立区块，preparing 和 prepared 状态都显示） ──────────
.script-deploy {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px 24px;
  box-shadow: $shadow-sm;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 14px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
  }

  &__summary {
    font-size: 13px;
    color: $text-secondary;
    font-variant-numeric: tabular-nums;

    &--all-ready { color: $color-success; font-weight: 600; }
    &--has-failed { color: $color-danger; font-weight: 600; }
  }
}

.script-deploy-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.script-deploy-item {
  padding: 12px 14px;
  background: $bg-page;
  border-radius: $border-radius-sm;
  border-left: 3px solid transparent;

  &__main {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    svg { width: 18px; height: 18px; }
  }

  &__name {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-weight: 600;
    font-size: 13px;
    color: $text-primary;
  }

  // 元信息块：与脚本名对齐（icon 18 + gap 10 = 28px）
  &__meta {
    margin-top: 8px;
    padding-left: 28px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
  }

  &__label {
    color: $text-secondary;
    flex-shrink: 0;
    width: 56px;
  }

  &__hash {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    color: $color-primary;
    background: $color-primary-light-9;
    padding: 1px 6px;
    border-radius: 4px;
  }

  &__artifact {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    color: $text-regular;
    word-break: break-all;
  }

  &__status {
    font-size: 12px;
    color: $text-secondary;
  }

  &__alert {
    margin-top: 8px;
    margin-left: 28px;

    :deep(.el-alert__description) {
      white-space: pre-line;
      line-height: 1.6;
    }
  }

  // 状态颜色：失败红、就绪绿、下载中橙、等待灰
  &--ready {
    border-left-color: $color-success;
    .script-deploy-item__icon { color: $color-success; }
    .script-deploy-item__name { color: $color-success; }
    .script-deploy-item__status { color: $color-success; }
  }

  &--downloading {
    border-left-color: #d48806;
    .script-deploy-item__icon { color: #d48806; }
    .script-deploy-item__status { color: #d48806; }
  }

  &--failed {
    border-left-color: $color-danger;
    background: rgba($color-danger, 0.04);
    .script-deploy-item__icon { color: $color-danger; }
    .script-deploy-item__name { color: $color-danger; }
    .script-deploy-item__status { color: $color-danger; }
  }

  &--pending {
    border-left-color: $border-color-light;
    .script-deploy-item__icon { color: $text-secondary; }
  }

  &__row--fallback {
    margin-top: 4px;
    margin-left: 28px;
  }
}

.script-deploy-workers {
  margin-top: 10px;
  margin-left: 28px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: $border-radius-sm;
  border: 1px solid $border-color-light;

  &__title {
    font-size: 12px;
    font-weight: 600;
    color: $text-secondary;
    margin-bottom: 8px;
  }
}

.script-deploy-worker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px dashed $border-color-light;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &__addr {
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: $text-primary;
    min-width: 160px;
  }

  &__status {
    color: $text-secondary;
    font-variant-numeric: tabular-nums;
  }

  &__alert {
    flex: 1 1 100%;
    margin-top: 4px;

    :deep(.el-alert__description) {
      white-space: pre-line;
      line-height: 1.6;
    }
  }

  &--ready &__status { color: $color-success; font-weight: 600; }
  &--downloading &__status { color: #d48806; font-weight: 600; }
  &--failed &__status { color: $color-danger; font-weight: 600; }
}

// ── 指标 & 图表区 ──────────────────────────────────────────────────────
.metrics-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @include breakpoint('md') {
    grid-template-columns: repeat(2, 1fr);
  }
}

.charts-dashboard {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @include breakpoint('sm') {
    grid-template-columns: 1fr;
  }
}

// Real-time Log Panel — 唯一深色区域
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
  height: 280px;
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

  &__time { color: #6b7280; min-width: 88px; }
  &__level { min-width: 48px; font-weight: 600; }
  &__source { color: #9ca3af; min-width: 80px; }
  &__msg { color: #d1d5db; flex: 1; }

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

// ── 接口维度 & 错误分析区块 ───────────────────────────────────────────
.section {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 20px;
  box-shadow: $shadow-sm;

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
    margin: 0 0 16px;
  }
}

// 接口错误率颜色编码
.err-rate--high { color: $color-danger;  font-weight: 600; }
.err-rate--mid  { color: $color-warning; font-weight: 600; }
.err-rate--low  { color: $color-success; }

// 接口维度趋势图区域
.api-charts {
  margin-top: 16px;
  padding: 16px;
  background: $bg-page;
  border-radius: $border-radius-sm;
  border: 1px solid $border-color-light;

  &__header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__name {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    font-weight: 600;
    color: $color-primary;
    background: $color-primary-light-9;
    padding: 2px 8px;
    border-radius: 4px;
  }

  &__hint {
    font-size: 12px;
    color: $text-secondary;
  }

  &__row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;

    @include breakpoint('md') {
      grid-template-columns: 1fr;
    }
  }
}

.chart-card {
  background: $bg-card;
  border-radius: $border-radius;
  padding: 16px;
  box-shadow: $shadow-sm;
  border: 1px solid $border-color-light;

  &__title {
    font-size: 13px;
    color: $text-secondary;
    margin-bottom: 8px;
    font-weight: 500;
  }
}

// 错误分析布局
.error-analysis {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  align-items: start;

  @include breakpoint('md') {
    grid-template-columns: 1fr;
  }
}

.error-chart {
  background: $bg-page;
  border-radius: $border-radius-sm;
}

// 淡入淡出
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
