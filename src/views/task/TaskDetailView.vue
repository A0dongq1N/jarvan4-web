<template>
  <div class="task-detail-view">
    <PageHeader
      :title="isCreate ? '新建任务' : (task?.name || '任务详情')"
      :back="true"
    >
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ isCreate ? '创建任务' : '保存修改' }}
      </el-button>
      <el-button v-if="!isCreate" type="success" @click="goExecution">执行压测</el-button>
    </PageHeader>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <!-- 基础信息 -->
      <el-tab-pane label="基础信息" name="basic">
        <div class="tab-panel">
          <el-form :model="form" label-position="top" style="max-width: 600px">
            <el-form-item label="任务名称" required>
              <el-input v-model="form.name" placeholder="输入任务名称" />
            </el-form-item>
            <el-form-item label="任务描述">
              <el-input v-model="form.description" type="textarea" :rows="4" placeholder="描述此压测任务的目的和范围" />
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 场景配置 -->
      <el-tab-pane label="场景配置" name="scenario">
        <div class="tab-panel">
          <el-form :model="form.scenarioConfig" label-position="top" style="max-width: 700px">
            <el-form-item label="场景模式">
              <el-radio-group v-model="form.scenarioConfig.mode">
                <el-radio-button value="step">VU 阶梯</el-radio-button>
                <el-radio-button value="rps">RPS 模式</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <!-- VU 阶梯配置 -->
            <template v-if="form.scenarioConfig.mode === 'step'">
              <el-form-item label="阶梯配置">
                <div class="step-config">
                  <div
                    v-for="(step, i) in form.scenarioConfig.steps"
                    :key="i"
                    class="step-item"
                  >
                    <span class="step-item__label">阶段 {{ i + 1 }}</span>
                    <el-input-number v-model="step.concurrent" :min="1" placeholder="并发数" style="width: 130px" />
                    <span>并发</span>
                    <span style="color: #86909c">{{ i === 0 ? '从 0 爬坡' : '爬坡' }}</span>
                    <el-input-number v-model="step.rampTime" :min="0" placeholder="秒" style="width: 100px" />
                    <span style="color: #86909c">秒 /</span>
                    <span>稳定</span>
                    <el-input-number v-model="step.duration" :min="10" placeholder="秒" style="width: 100px" />
                    <span>秒</span>
                    <el-button size="small" type="danger" plain :icon="Delete" @click="removeStep(i)" />
                  </div>
                  <el-button size="small" :icon="Plus" @click="addStep">添加阶段</el-button>
                </div>
              </el-form-item>
            </template>

            <!-- RPS 模式 -->
            <template v-if="form.scenarioConfig.mode === 'rps'">
              <el-form-item label="RPS 注入方式">
                <el-radio-group v-model="form.scenarioConfig.rpsMode">
                  <el-radio-button value="fixed">固定速率</el-radio-button>
                  <el-radio-button value="step">阶梯爬升</el-radio-button>
                </el-radio-group>
              </el-form-item>

              <!-- 固定速率 -->
              <template v-if="form.scenarioConfig.rpsMode === 'fixed'">
                <el-form-item label="目标 RPS">
                  <el-input-number v-model="form.scenarioConfig.targetRps" :min="1" :max="100000" style="width: 200px" />
                </el-form-item>
                <el-form-item label="爬坡时长（秒）">
                  <el-input-number v-model="form.scenarioConfig.rpsRampTime" :min="0" :max="600" style="width: 200px" />
                  <span style="margin-left: 8px; color: #86909c; font-size: 12px">0 = 立即起步</span>
                </el-form-item>
                <el-form-item label="持续时长（秒）">
                  <el-input-number v-model="form.scenarioConfig.duration" :min="10" :max="86400" style="width: 200px" />
                </el-form-item>
              </template>

              <!-- 阶梯爬升 -->
              <el-form-item v-if="form.scenarioConfig.rpsMode === 'step'" label="RPS 阶梯配置">
                <div class="step-config">
                  <div
                    v-for="(step, i) in form.scenarioConfig.rpsSteps"
                    :key="i"
                    class="step-item"
                  >
                    <span class="step-item__label">阶段 {{ i + 1 }}</span>
                    <el-input-number v-model="step.rps" :min="1" placeholder="目标 RPS" style="width: 140px" />
                    <span>req/s</span>
                    <span style="color: #86909c">{{ i === 0 ? '从 0 爬坡' : '爬坡' }}</span>
                    <el-input-number v-model="step.rampTime" :min="0" :max="step.duration" placeholder="秒" style="width: 100px" />
                    <span style="color: #86909c">秒 /</span>
                    <span>稳定</span>
                    <el-input-number v-model="step.duration" :min="10" placeholder="秒" style="width: 100px" />
                    <span>秒</span>
                    <el-button size="small" type="danger" plain :icon="Delete" @click="removeRpsStep(i)" />
                  </div>
                  <el-button size="small" :icon="Plus" @click="addRpsStep">添加阶段</el-button>
                </div>
              </el-form-item>
            </template>
          </el-form>

          <!-- 熔断配置 -->
          <div class="circuit-breaker">
            <div class="circuit-breaker__header">
              <span class="circuit-breaker__title">
                <el-icon style="vertical-align: -2px; margin-right: 4px"><WarningFilled /></el-icon>
                熔断保护
              </span>
              <el-switch v-model="form.scenarioConfig.circuitBreaker.enabled" />
            </div>
            <div v-if="form.scenarioConfig.circuitBreaker.enabled" class="circuit-breaker__body">

              <!-- 接口级规则 -->
              <div class="cb-section-label">
                接口级规则
                <span class="form-tip">命中任意规则即触发熔断，优先级高于全局兜底</span>
              </div>
              <div class="cb-rules">
                <div class="cb-rule-header">
                  <span style="flex:1">接口 Pattern</span>
                  <span style="width:110px">错误率阈值</span>
                  <span style="width:110px">统计窗口</span>
                  <span style="width:110px">最少请求数</span>
                  <span style="width:32px"></span>
                </div>
                <div
                  v-for="(rule, i) in form.scenarioConfig.circuitBreaker.rules"
                  :key="i"
                  class="cb-rule-row"
                >
                  <el-input
                    v-model="rule.urlPattern"
                    placeholder="/api/pay 或 /api/order/*"
                    style="flex: 1; min-width: 0"
                  />
                  <el-input-number
                    v-model="rule.errorRateThreshold"
                    :min="1" :max="100" :step="1"
                    style="width: 110px"
                  >
                    <template #suffix>%</template>
                  </el-input-number>
                  <el-input-number
                    v-model="rule.windowSeconds"
                    :min="5" :max="300" :step="5"
                    style="width: 110px"
                  >
                    <template #suffix>s</template>
                  </el-input-number>
                  <el-input-number
                    v-model="rule.minRequests"
                    :min="1" :max="10000" :step="10"
                    style="width: 110px"
                  />
                  <el-button
                    size="small" type="danger" plain :icon="Delete"
                    style="width:32px;padding:0"
                    @click="form.scenarioConfig.circuitBreaker.rules.splice(i, 1)"
                  />
                </div>
                <el-button
                  size="small" :icon="Plus" style="margin-top: 8px; align-self: flex-start"
                  @click="form.scenarioConfig.circuitBreaker.rules.push({ urlPattern: '', errorRateThreshold: 10, windowSeconds: 30, minRequests: 50 })"
                >添加接口规则</el-button>
              </div>

              <!-- 全局兜底 -->
              <div class="cb-section-label" style="margin-top: 24px">
                全局兜底
                <span class="form-tip">所有请求整体错误率超过阈值时兜底触发</span>
              </div>
              <div class="cb-global-row">
                <div class="cb-global-item">
                  <div class="cb-global-item__label">错误率阈值</div>
                  <el-input-number
                    v-model="form.scenarioConfig.circuitBreaker.globalErrorRateThreshold"
                    :min="1" :max="100" :step="1" style="width: 130px"
                  />
                  <span class="cb-unit">%</span>
                </div>
                <div class="cb-global-item">
                  <div class="cb-global-item__label">统计窗口</div>
                  <el-input-number
                    v-model="form.scenarioConfig.circuitBreaker.globalWindowSeconds"
                    :min="5" :max="300" :step="5" style="width: 130px"
                  />
                  <span class="cb-unit">秒</span>
                </div>
                <div class="cb-global-item">
                  <div class="cb-global-item__label">最少请求数</div>
                  <el-input-number
                    v-model="form.scenarioConfig.circuitBreaker.globalMinRequests"
                    :min="10" :max="10000" :step="10" style="width: 130px"
                  />
                </div>
              </div>

              <!-- 摘要预览 -->
              <div class="circuit-breaker__preview">
                <el-icon color="#ff9900"><WarningFilled /></el-icon>
                <span>
                  <template v-if="form.scenarioConfig.circuitBreaker.rules.length">
                    接口规则 <strong>{{ form.scenarioConfig.circuitBreaker.rules.length }}</strong> 条（任意命中即停止）；
                  </template>
                  全局兜底：<strong>{{ form.scenarioConfig.circuitBreaker.globalWindowSeconds }}s</strong> 内 ≥
                  <strong>{{ form.scenarioConfig.circuitBreaker.globalMinRequests }}</strong> 次请求且错误率超过
                  <strong>{{ form.scenarioConfig.circuitBreaker.globalErrorRateThreshold }}%</strong> 时停止压测
                </span>
              </div>
            </div>
          </div>

          <!-- 并发曲线预览 -->
          <div class="curve-preview">
            <div class="curve-preview__title">并发曲线预览</div>
            <BaseChart :option="curveOption" width="100%" height="180px" />
          </div>
        </div>
      </el-tab-pane>

      <!-- 脚本绑定 -->
      <el-tab-pane label="脚本绑定" name="scripts" :disabled="isCreate">
        <div class="tab-panel">
          <div class="scripts-header">
            <span class="scripts-header__title">已绑定脚本</span>
            <el-button size="small" type="primary" :icon="Plus" @click="showScriptSelector = true">
              添加脚本
            </el-button>
          </div>

          <div v-if="form.scripts.length === 0" class="scripts-empty">
            <EmptyState title="未绑定脚本" desc="请点击右上角添加脚本" />
          </div>

          <div v-else class="scripts-list">
            <div v-for="s in form.scripts" :key="s.scriptId" class="script-binding-item">
              <div class="script-binding-item__main">
                <div class="script-binding-item__info">
                  <el-icon><Document /></el-icon>
                  <span class="script-binding-item__name">{{ s.scriptName }}</span>
                  <!-- env vars badge -->
                  <el-tag
                    v-if="s.envVars && Object.keys(s.envVars).length > 0"
                    size="small"
                    type="info"
                    style="font-size: 11px; cursor: pointer"
                    @click="openEnvEditor(s)"
                  >{{ Object.keys(s.envVars).length }} 个变量</el-tag>
                </div>
                <div class="script-binding-item__actions">
                  <div class="script-binding-item__weight">
                    <span>权重</span>
                    <el-slider
                      v-model="s.weight"
                      :min="1"
                      :max="100"
                      :step="1"
                      style="width: 180px; margin: 0 12px"
                      show-input
                      input-size="small"
                    />
                  </div>
                  <el-button size="small" @click="openEnvEditor(s)">环境变量</el-button>
                  <el-button size="small" type="danger" plain @click="unbindScript(s.scriptId)">解绑</el-button>
                </div>
              </div>

              <!-- 环境变量编辑区（展开） -->
              <div v-if="expandedEnvScript === s.scriptId" class="script-env-editor">
                <div class="script-env-editor__header">
                  <span class="script-env-editor__title">环境变量</span>
                  <span class="script-env-editor__tip">脚本通过 <code>ctx.Vars.Env("KEY")</code> 读取</span>
                </div>
                <div class="script-env-editor__rows">
                  <div v-for="(row, i) in editingEnvRows" :key="i" class="script-env-row">
                    <el-input v-model="row.key" placeholder="KEY" size="small" style="width: 180px" />
                    <span class="script-env-row__sep">=</span>
                    <el-input v-model="row.value" placeholder="VALUE" size="small" style="flex: 1" />
                    <el-button
                      :icon="Close"
                      size="small"
                      text
                      type="danger"
                      @click="removeEnvRow(i)"
                    />
                  </div>
                  <el-button size="small" :icon="Plus" text type="primary" @click="addEnvRow">添加变量</el-button>
                </div>
                <div class="script-env-editor__footer">
                  <el-button size="small" @click="closeEnvEditor">取消</el-button>
                  <el-button size="small" type="primary" @click="saveEnvVars(s.scriptId)">保存</el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Script Selector Dialog -->
          <el-dialog v-model="showScriptSelector" title="选择脚本" width="640px" @closed="scriptKeyword = ''">            <el-input
              v-model="scriptKeyword"
              placeholder="搜索脚本名称或描述"
              clearable
              style="margin-bottom: 14px"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-table :data="filteredScripts" @row-click="selectScript" style="cursor: pointer">
              <el-table-column label="脚本名称" min-width="160">
                <template #default="{ row }">
                  <span style="font-family: monospace; font-weight: 600">{{ row.name }}</span>
                  <div style="font-size: 12px; color: #86909c; margin-top: 2px">{{ row.description }}</div>
                </template>
              </el-table-column>
              <el-table-column label="最新 Commit" min-width="200">
                <template #default="{ row }">
                  <code style="font-size: 12px; background: #f0f4ff; color: #3871dc; padding: 1px 6px; border-radius: 4px">{{ row.commitHash.slice(0, 8) }}</code>
                  <span style="font-size: 12px; color: #4e5969; margin-left: 8px">{{ row.commitMsg }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="primary" @click.stop="selectScript(row)">选择</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-dialog>
        </div>
      </el-tab-pane>

      <!-- 执行历史 -->
      <el-tab-pane label="执行历史" name="history" :disabled="isCreate">
        <div class="tab-panel">
          <div class="history-header">
            <span class="history-header__title">历史执行记录</span>
            <el-button size="small" type="primary" @click="goExecution">发起新执行</el-button>
          </div>
          <div v-if="historyLoading" v-loading="true" style="height: 200px" />
          <EmptyState v-else-if="historyList.length === 0" title="暂无执行记录" desc="点击「执行压测」按钮发起第一次压测" />
          <el-table v-else :data="historyList" style="width: 100%">
            <el-table-column label="执行ID" prop="id" width="140">
              <template #default="{ row }">
                <code style="font-size:12px;color:#6b7280">{{ row.id }}</code>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <StatusBadge :status="row.status" />
              </template>
            </el-table-column>
            <el-table-column label="开始时间" min-width="160">
              <template #default="{ row }">
                {{ row.startTime ? formatTime(row.startTime) : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="持续时长" width="110">
              <template #default="{ row }">
                {{ row.durationSec != null ? formatDuration(row.durationSec) : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="触发人" width="100" prop="triggeredByName" />
            <el-table-column label="备注" min-width="160">
              <template #default="{ row }">
                <span v-if="row.errorMsg" style="color:#e54545;font-size:12px">{{ row.errorMsg }}</span>
                <span v-else style="color:#9c9fa3;font-size:12px">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.reportId"
                  size="small"
                  type="primary"
                  text
                  @click="goReport(row.reportId)"
                >查看报告</el-button>
                <span v-else style="color:#9c9fa3;font-size:12px">—</span>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="historyTotal > historyPageSize" style="margin-top:16px;display:flex;justify-content:flex-end">
            <el-pagination
              v-model:current-page="historyPage"
              :page-size="historyPageSize"
              :total="historyTotal"
              layout="prev, pager, next"
              @current-change="loadHistory"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Document, Search, WarningFilled, Close } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
import { useScriptStore } from '@/stores/script'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import type { StressTask, ScenarioConfig, ExecutionRecord } from '@/types'
import { formatTime, formatDuration } from '@/utils/format'
import request from '@/utils/request'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const scriptStore = useScriptStore()

const taskId = computed(() => route.params.id as string)
const isCreate = computed(() => !taskId.value || route.path === '/task/create')

const task = ref<StressTask | null>(null)
const activeTab = ref('basic')
const saving = ref(false)
const showScriptSelector = ref(false)
const scriptKeyword = ref('')
// 当前展开环境变量编辑的脚本 id，null 表示全部收起
const expandedEnvScript = ref<string | null>(null)
// 编辑中的临时 envVars（key-value 行数组，方便 UI 操作）
const editingEnvRows = ref<{ key: string; value: string }[]>([])

// 执行历史
const historyList = ref<ExecutionRecord[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyPageSize = 10
const historyLoading = ref(false)

async function loadHistory() {
  if (isCreate.value) return
  historyLoading.value = true
  try {
    const res = await request.get(`/tasks/${taskId.value}/executions`, {
      params: { page: historyPage.value, page_size: historyPageSize }
    })
    historyList.value = res.data.data.list
    historyTotal.value = res.data.data.total
  } finally {
    historyLoading.value = false
  }
}

// 切换到执行历史 tab 时加载
watch(activeTab, (tab) => {
  if (tab === 'history') loadHistory()
})

// 按最近更新时间排序，始终与 store 保持同步
const availableScripts = computed(() =>
  [...scriptStore.list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
)

const filteredScripts = computed(() => {
  const kw = scriptKeyword.value.trim().toLowerCase()
  if (!kw) return availableScripts.value
  return availableScripts.value.filter(s =>
    s.name.toLowerCase().includes(kw) || (s.description || '').toLowerCase().includes(kw)
  )
})

const form = reactive({
  name: '',
  description: '',
  scenarioConfig: {
    mode: 'step' as ScenarioConfig['mode'],
    duration: 300,
    targetRps: 500,
    rpsRampTime: 20,
    rpsMode: 'fixed' as 'fixed' | 'step',
    steps: [
      { concurrent: 50,  duration: 100, rampTime: 20 },
      { concurrent: 100, duration: 100, rampTime: 20 },
      { concurrent: 200, duration: 100, rampTime: 30 },
    ],
    rpsSteps: [
      { rps: 100, duration: 60, rampTime: 0 },
      { rps: 300, duration: 60, rampTime: 30 },
      { rps: 500, duration: 120, rampTime: 30 },
    ],
    circuitBreaker: {
      enabled: false,
      rules: [] as { urlPattern: string; errorRateThreshold: number; windowSeconds: number; minRequests: number }[],
      globalErrorRateThreshold: 20,
      globalWindowSeconds: 30,
      globalMinRequests: 100,
    },
  },
  scripts: [] as any[],
})

const curveOption = computed(() => {
  const points: { x: number; y: number }[] = []
  const cfg = form.scenarioConfig
  if (cfg.mode === 'step') {
    let t = 0
    let prevC = 0
    ;(cfg.steps || []).forEach(step => {
      const ramp = step.rampTime ?? 0
      if (ramp > 0) {
        // 爬坡段：斜线
        points.push({ x: t, y: prevC })
        points.push({ x: t + ramp, y: step.concurrent })
        t += ramp
      } else {
        // 瞬变：阶跃
        points.push({ x: t, y: prevC })
        points.push({ x: t, y: step.concurrent })
      }
      t += step.duration
      points.push({ x: t, y: step.concurrent })
      prevC = step.concurrent
    })
  } else if (cfg.mode === 'rps') {
    if (cfg.rpsMode === 'step') {
      let t = 0
      let prevR = 0
      ;(cfg.rpsSteps || []).forEach(step => {
        if (step.rampTime > 0) {
          points.push({ x: t, y: prevR })
          points.push({ x: t + step.rampTime, y: step.rps })
          t += step.rampTime
        } else {
          points.push({ x: t, y: prevR })
          points.push({ x: t, y: step.rps })
        }
        t += step.duration
        points.push({ x: t, y: step.rps })
        prevR = step.rps
      })
    } else {
      // 固定速率：有 rpsRampTime 则先斜线爬升，再水平稳定
      const ramp = cfg.rpsRampTime ?? 0
      const dur = cfg.duration || 300
      const target = cfg.targetRps || 0
      if (ramp > 0) {
        points.push({ x: 0, y: 0 })
        points.push({ x: ramp, y: target })
      } else {
        points.push({ x: 0, y: target })
      }
      points.push({ x: ramp + dur, y: target })
    }
  }

  return {
    grid: { top: 10, right: 16, bottom: 24, left: 52 },
    xAxis: {
      type: 'value',
      name: '时间(s)',
      axisLabel: { color: '#86909c', fontSize: 11 },
      axisLine: { lineStyle: { color: '#e5e6eb' } },
    },
    yAxis: {
      type: 'value',
      name: cfg.mode === 'rps' ? 'RPS' : '并发数',
      axisLabel: { color: '#86909c', fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f2f3f5' } },
    },
    series: [{
      type: 'line',
      data: points.map(p => [p.x, p.y]),
      symbol: 'none',
      lineStyle: { color: '#006EFF', width: 2 },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(0,110,255,0.25)' }, { offset: 1, color: 'rgba(0,110,255,0)' }] },
      },
    }],
  }
})

onMounted(async () => {
  if (!isCreate.value) {
    task.value = await taskStore.fetchById(taskId.value)
    form.name = task.value.name
    form.description = task.value.description || ''
    Object.assign(form.scenarioConfig, task.value.scenarioConfig)
    form.scripts = [...task.value.scripts]
  }
  await scriptStore.fetchList({ pageSize: 100 })
})

function addStep() {
  form.scenarioConfig.steps = form.scenarioConfig.steps || []
  form.scenarioConfig.steps.push({ concurrent: 100, duration: 60, rampTime: 20 })
}

function removeStep(i: number) {
  form.scenarioConfig.steps?.splice(i, 1)
}

function addRpsStep() {
  form.scenarioConfig.rpsSteps = form.scenarioConfig.rpsSteps || []
  const last = form.scenarioConfig.rpsSteps.at(-1)
  form.scenarioConfig.rpsSteps.push({ rps: last ? last.rps + 200 : 100, duration: 60, rampTime: 30 })
}

function removeRpsStep(i: number) {
  form.scenarioConfig.rpsSteps?.splice(i, 1)
}

async function selectScript(script: any) {
  if (!task.value) return
  await taskStore.bindScript(task.value.id, script.id, 100)
  form.scripts = [...(taskStore.currentTask?.scripts || [])]
  showScriptSelector.value = false
  ElMessage.success(`已绑定 ${script.name}`)
}

async function unbindScript(scriptId: string) {
  if (!task.value) return
  await taskStore.unbindScript(task.value.id, scriptId)
  form.scripts = [...(taskStore.currentTask?.scripts || [])]
  if (expandedEnvScript.value === scriptId) expandedEnvScript.value = null
  ElMessage.success('解绑成功')
}

function openEnvEditor(s: any) {
  expandedEnvScript.value = s.scriptId
  const vars = s.envVars || {}
  editingEnvRows.value = Object.entries(vars).map(([key, value]) => ({ key, value: value as string }))
  if (editingEnvRows.value.length === 0) editingEnvRows.value.push({ key: '', value: '' })
}

function closeEnvEditor() {
  expandedEnvScript.value = null
  editingEnvRows.value = []
}

function addEnvRow() {
  editingEnvRows.value.push({ key: '', value: '' })
}

function removeEnvRow(i: number) {
  editingEnvRows.value.splice(i, 1)
}

async function saveEnvVars(scriptId: string) {
  if (!task.value) return
  const envVars: Record<string, string> = {}
  for (const row of editingEnvRows.value) {
    if (row.key.trim()) envVars[row.key.trim()] = row.value
  }
  await taskStore.updateScriptEnvVars(task.value.id, scriptId, envVars)
  form.scripts = [...(taskStore.currentTask?.scripts || [])]
  closeEnvEditor()
  ElMessage.success('环境变量已保存')
}

async function handleSave() {
  if (!form.name) {
    ElMessage.warning('请输入任务名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name,
      description: form.description,
      scenarioConfig: form.scenarioConfig,
    }
    if (isCreate.value) {
      const newTask = await taskStore.createTask(payload)
      ElMessage.success('创建成功')
      router.replace(`/task/${newTask.id}`)
    } else {
      await taskStore.updateTask(taskId.value, payload)
      ElMessage.success('保存成功')
    }
  } finally {
    saving.value = false
  }
}

function goExecution() {
  router.push(`/execution/${taskId.value}?autostart=1`)
}

function goReport(reportId: string) {
  router.push(`/report/${reportId}`)
}
</script>

<style lang="scss" scoped>
.task-detail-view {
  max-width: 900px;
}

.detail-tabs {
  :deep(.el-tabs__nav-wrap) {
    background: $bg-card;
    border-radius: $border-radius $border-radius 0 0;
    padding: 0 16px;
  }
}

.tab-panel {
  background: $bg-card;
  border-radius: 0 0 $border-radius $border-radius;
  padding: 28px;
  box-shadow: $shadow-sm;
}

.step-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: $bg-page;
  border-radius: $border-radius-sm;

  &__label {
    font-size: 13px;
    color: $text-secondary;
    min-width: 50px;
  }
}

.circuit-breaker {
  margin-top: 28px;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: $bg-page;
    cursor: default;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
  }

  &__body {
    padding: 20px 18px 8px;
    background: $bg-card;
    border-top: 1px solid $border-color-light;
  }

  &__preview {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba($color-warning, 0.08);
    border: 1px solid rgba($color-warning, 0.25);
    border-radius: $border-radius-sm;
    padding: 10px 14px;
    margin-bottom: 16px;
    font-size: 13px;
    color: $text-regular;
    line-height: 1.6;

    .el-icon { margin-top: 2px; flex-shrink: 0; }
  }
}

.form-tip {
  display: block;
  font-size: 12px;
  color: $text-secondary;
  font-weight: 400;
  margin-top: 2px;
}

.cb-section-label {
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: 10px;

  .form-tip {
    display: inline;
    margin-left: 8px;
    margin-top: 0;
  }
}

.cb-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cb-rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cb-rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 4px;
  font-size: 12px;
  color: $text-secondary;
  font-weight: 500;
}

.cb-rule-sep {
  font-size: 13px;
  color: $text-secondary;
  white-space: nowrap;
  flex-shrink: 0;
}

.cb-global-row {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: $bg-page;
  border-radius: $border-radius-sm;
  border: 1px solid $border-color-light;
}

.cb-global-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: 12px;
    color: $text-secondary;
    font-weight: 500;
  }

  // 让 input-number + unit 横排
  display: flex;
  flex-direction: column;
  gap: 6px;

  .el-input-number {
    display: inline-flex;
  }
}

// 放在 cb-global-item 内部的 input + unit 同行
.cb-global-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;

  &__label {
    flex-basis: 100%;
    font-size: 12px;
    color: $text-secondary;
    font-weight: 500;
    margin-bottom: 6px;
  }
}

.cb-unit {
  font-size: 13px;
  color: $text-secondary;
  margin-left: 6px;
  white-space: nowrap;
}

.curve-preview {
  padding: 16px;
  background: $bg-page;
  border-radius: $border-radius;
  border: 1px solid $border-color-light;

  &__title {
    font-size: 13px;
    color: $text-secondary;
    margin-bottom: 12px;
    font-weight: 500;
  }
}

.scripts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
  }
}

.script-binding-item {
  background: $bg-page;
  border-radius: $border-radius-sm;
  margin-bottom: 8px;
  border: 1px solid $border-color-light;
  overflow: hidden;

  &__main {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
  }

  &__info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 200px;
    color: $text-primary;
  }

  &__name {
    font-weight: 500;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  &__weight {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    font-size: 13px;
    color: $text-secondary;
  }

  &__hash {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 11px;
    background: $color-primary-light-9;
    color: $color-primary;
    padding: 1px 6px;
    border-radius: 4px;
  }
}

.script-env-editor {
  border-top: 1px solid $border-color-light;
  padding: 14px 16px;
  background: $bg-card;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
  }

  &__tip {
    font-size: 12px;
    color: $text-secondary;

    code {
      font-family: 'SFMono-Regular', Consolas, monospace;
      background: $color-primary-light-9;
      color: $color-primary;
      padding: 1px 5px;
      border-radius: 3px;
    }
  }

  &__rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.script-env-row {
  display: flex;
  align-items: center;
  gap: 8px;

  &__sep {
    font-size: 13px;
    color: $text-secondary;
    font-weight: 600;
  }
}

.scripts-empty {
  padding: 40px 0;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $text-primary;
  }
}
</style>
