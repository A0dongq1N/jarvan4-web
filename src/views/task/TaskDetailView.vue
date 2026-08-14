<template>
  <div class="task-detail-view">
    <PageHeader
      :title="isCreate ? '新建任务' : (task?.name || '任务详情')"
      :back="true"
    >
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ isCreate ? '创建任务' : '保存修改' }}
      </el-button>
      <el-button v-if="!isCreate && activeExecution" type="warning" @click="goMonitor(activeExecution.id)">
        查看监控
      </el-button>
      <el-button v-if="!isCreate" type="success" @click="goExecution">执行压测</el-button>
    </PageHeader>

    <el-alert
      v-if="!isCreate && activeExecution"
      type="info"
      show-icon
      :closable="false"
      class="active-exec-banner"
    >
      <template #title>
        当前有进行中的压测（{{ activeExecutionStatusLabel }}）
        <el-button type="primary" link @click="goMonitor(activeExecution.id)">进入监控页</el-button>
      </template>
    </el-alert>

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

      <!-- 脚本绑定 -->
      <el-tab-pane label="脚本绑定" name="scripts" :disabled="isCreate">
        <div class="tab-panel">
          <!-- 场景级环境变量（与脚本配置放一起更直观） -->
          <div class="scene-env-editor scene-env-editor--scripts-tab">
            <div class="scene-env-editor__header">
              <span class="scene-env-editor__title">场景环境变量</span>
              <span class="scene-env-editor__tip">
                下发给所有脚本，通过 <code>ctx.Vars.Env("KEY")</code> 读取；脚本级变量可覆盖同名 key
              </span>
            </div>
            <div class="scene-env-editor__rows">
              <div v-for="(row, i) in sceneEnvRows" :key="i" class="script-env-row">
                <el-input v-model="row.key" placeholder="KEY" size="small" style="width: 180px" />
                <span class="script-env-row__sep">=</span>
                <el-input v-model="row.value" placeholder="VALUE" size="small" style="flex: 1" />
                <el-button :icon="Close" size="small" text type="danger" @click="removeSceneEnvRow(i)" />
              </div>
              <el-button size="small" :icon="Plus" text type="primary" @click="addSceneEnvRow">添加变量</el-button>
            </div>
            <div v-if="sceneEnvRows.length === 0" class="scene-env-editor__empty">
              未配置环境变量，脚本中依赖的 <code>BASE_URL</code> 等将无法读取（保存任务时一并提交）
            </div>
          </div>

          <div v-if="isRpsMode" class="scripts-rps-summary">
            <span>总目标 RPS（峰值）</span>
            <strong>{{ totalScriptTargetRps }}</strong>
            <span class="scripts-rps-summary__hint">= 各脚本目标 RPS 之和，场景阶梯末阶段自动对齐此值</span>
          </div>

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
                  <div v-if="isRpsMode" class="script-binding-item__weight">
                    <span>目标 RPS</span>
                    <el-input-number
                      :model-value="scriptTargetRps(s)"
                      :min="1"
                      :max="100000"
                      :step="100"
                      style="width: 160px; margin: 0 12px"
                      @change="(val: number | undefined) => onTargetRpsChange(s.scriptId, val ?? 0)"
                    />
                  </div>
                  <div v-else class="script-binding-item__weight">
                    <span>权重</span>
                    <el-slider
                      v-model="s.weight"
                      :min="1"
                      :max="1000"
                      :step="1"
                      style="width: 180px; margin: 0 12px"
                      show-input
                      input-size="small"
                      @change="(val: number | number[]) => onWeightChange(s.scriptId, Array.isArray(val) ? val[0] : val)"
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
                  <span class="script-env-editor__tip">脚本级变量覆盖场景级同名 key，通过 <code>ctx.Vars.Env("KEY")</code> 读取</span>
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

      <!-- 场景配置 -->
      <el-tab-pane label="场景配置" name="scenario">
        <div class="tab-panel">
          <el-form :model="form.scenarioConfig" label-position="top" class="scenario-form">
            <el-form-item label="场景模式">
              <el-radio-group v-model="form.scenarioConfig.mode">
                <el-radio-button value="vu">VU 阶梯</el-radio-button>
                <el-radio-button value="rps">RPS 模式</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <!-- VU 阶梯配置 -->
            <template v-if="form.scenarioConfig.mode === 'vu'">
              <el-form-item label="阶梯配置">
                <div class="step-config">
                  <div
                    v-for="(step, i) in form.scenarioConfig.vuSteps"
                    :key="i"
                    class="step-item step-item--vu"
                  >
                    <span class="step-item__label">阶段 {{ i + 1 }}</span>
                    <div class="step-item__group">
                      <el-input-number v-model="step.concurrent" :min="1" placeholder="并发数" controls-position="right" class="step-input step-input--md" />
                      <span class="step-item__unit">并发</span>
                    </div>
                    <div class="step-item__group">
                      <span class="step-item__hint">{{ i === 0 ? '从 0 爬坡' : '爬坡' }}</span>
                      <el-input-number v-model="step.rampTime" :min="0" placeholder="秒" controls-position="right" class="step-input step-input--sm" />
                      <span class="step-item__unit">秒</span>
                    </div>
                    <div class="step-item__group">
                      <span class="step-item__hint">稳定</span>
                      <el-input-number v-model="step.duration" :min="10" placeholder="秒" controls-position="right" class="step-input step-input--sm" />
                      <span class="step-item__unit">秒</span>
                    </div>
                    <el-button size="small" type="danger" plain :icon="Delete" class="step-item__delete" @click="removeStep(i)" />
                  </div>
                  <el-button size="small" :icon="Plus" @click="addStep">添加阶段</el-button>
                </div>
              </el-form-item>
            </template>

            <!-- RPS 模式：仅阶梯爬升 -->
            <template v-if="form.scenarioConfig.mode === 'rps'">
              <div class="rps-scene-hint">
                <span>峰值 RPS</span>
                <strong>{{ totalScriptTargetRps || '—' }}</strong>
                <span class="rps-scene-hint__unit">req/s</span>
                <span class="rps-scene-hint__desc">
                  由各脚本目标 RPS 汇总；末阶段自动对齐峰值，前几阶段配置爬升曲线
                </span>
                <el-button v-if="!isCreate" size="small" text type="primary" @click="activeTab = 'scripts'">
                  去配置脚本
                </el-button>
              </div>
              <el-alert
                v-if="form.scripts.length === 0"
                type="warning"
                :closable="false"
                show-icon
                title="请先在「脚本绑定」页添加脚本并配置各脚本目标 RPS"
                style="margin-bottom: 16px"
              />

              <el-form-item label="RPS 阶梯配置">
                <div class="step-config">
                  <div
                    v-for="(step, i) in form.scenarioConfig.rpsSteps"
                    :key="i"
                    class="step-item step-item--rps"
                  >
                    <span class="step-item__label">阶段 {{ i + 1 }}</span>
                    <div class="step-item__group step-item__group--rps">
                      <template v-if="i === (form.scenarioConfig.rpsSteps?.length ?? 0) - 1">
                        <span class="rps-peak-readonly">{{ totalScriptTargetRps || '—' }}</span>
                        <span class="step-item__unit">req/s</span>
                        <el-tag size="small" type="info">峰值（脚本汇总）</el-tag>
                      </template>
                      <template v-else>
                        <el-input-number
                          v-model="step.rps"
                          :min="1"
                          :max="Math.max(1, totalScriptTargetRps - 1)"
                          placeholder="目标 RPS"
                          controls-position="right"
                          class="step-input step-input--lg"
                        />
                        <span class="step-item__unit">req/s</span>
                      </template>
                    </div>
                    <div class="step-item__group">
                      <span class="step-item__hint">{{ i === 0 ? '从 0 爬坡' : '爬坡' }}</span>
                      <el-input-number v-model="step.rampTime" :min="0" :max="step.duration" placeholder="秒" controls-position="right" class="step-input step-input--sm" />
                      <span class="step-item__unit">秒</span>
                    </div>
                    <div class="step-item__group">
                      <span class="step-item__hint">稳定</span>
                      <el-input-number v-model="step.duration" :min="10" placeholder="秒" controls-position="right" class="step-input step-input--sm" />
                      <span class="step-item__unit">秒</span>
                    </div>
                    <el-button size="small" type="danger" plain :icon="Delete" class="step-item__delete" @click="removeRpsStep(i)" />
                  </div>
                  <el-button size="small" :icon="Plus" @click="addRpsStep">添加阶段</el-button>
                </div>
              </el-form-item>

              <!-- 并发 / RPS 曲线预览 -->
              <div class="curve-preview">
                <div class="curve-preview__title">{{ form.scenarioConfig.mode === 'rps' ? 'RPS 曲线预览' : '并发曲线预览' }}</div>
                <BaseChart :option="curveOption" width="100%" height="180px" />
              </div>
            </template>

            <el-form-item v-if="form.scenarioConfig.mode === 'vu'" label=" ">
              <div class="curve-preview curve-preview--inline">
                <div class="curve-preview__title">并发曲线预览</div>
                <BaseChart :option="curveOption" width="100%" height="180px" />
              </div>
            </el-form-item>
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
                    @click="removeCircuitRule(i)"
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
        </div>
      </el-tab-pane>

      <!-- 执行历史 -->
      <el-tab-pane label="执行历史" name="history" :disabled="isCreate">
        <div class="tab-panel">
          <div class="history-header">
            <span class="history-header__title">历史执行记录</span>
            <el-button size="small" type="primary" @click="goExecution">再次压测</el-button>
          </div>
          <div v-if="historyLoading" v-loading="true" style="height: 200px" />
          <EmptyState v-else-if="historyList.length === 0" title="暂无执行记录" desc="点击「执行压测」发起第一次压测" />
          <el-table v-else :data="historyList" class="history-table" style="width: 100%" row-key="id">
            <el-table-column label="执行ID" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <code class="history-table__id">{{ row.id }}</code>
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="120" align="center">
              <template #default="{ row }">
                <StatusBadge :status="row.status" />
              </template>
            </el-table-column>
            <el-table-column label="开始时间" min-width="180">
              <template #default="{ row }">
                {{ row.startTime ? formatTime(row.startTime) : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="持续时长" min-width="110" align="center">
              <template #default="{ row }">
                {{ row.durationSec != null ? formatDuration(row.durationSec) : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="触发人" min-width="100" prop="triggeredByName" show-overflow-tooltip />
            <el-table-column label="备注" min-width="360" show-overflow-tooltip class-name="history-table__remark-col">
              <template #default="{ row }">
                <span v-if="row.errorMsg" class="history-table__error">{{ row.errorMsg }}</span>
                <span v-else class="history-table__muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="108" align="center">
              <template #default="{ row }">
                <el-button
                  v-if="isActiveExecution(row.status)"
                  size="small"
                  type="warning"
                  text
                  @click="goMonitor(row.id)"
                >查看监控</el-button>
                <el-button
                  v-else-if="canViewReport(row)"
                  size="small"
                  type="primary"
                  text
                  @click="goReport(row.reportId || row.id)"
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
import { notifyError, notifySuccess, notifyWarning, getErrorMessage } from '@/utils/feedback'
import { confirmDanger } from '@/utils/confirm'
import { Plus, Delete, Document, Search, WarningFilled, Close } from '@element-plus/icons-vue'
import { useTaskStore } from '@/stores/task'
import { useScriptStore } from '@/stores/script'
import { useExecutionStore } from '@/stores/execution'
import { useProjectStore } from '@/stores/project'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import BaseChart from '@/components/charts/BaseChart.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import type { StressTask, ScenarioConfig, ExecutionRecord, RpsStepConfig } from '@/types'
import { formatTime, formatDuration } from '@/utils/format'
import { isActiveExecution, executionMonitorPath } from '@/utils/execution'
import request from '@/utils/request'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const scriptStore = useScriptStore()
const executionStore = useExecutionStore()
const projectStore = useProjectStore()

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
// 场景级环境变量（随「保存修改」一并提交）
const sceneEnvRows = ref<{ key: string; value: string }[]>([])

// 执行历史
const historyList = ref<ExecutionRecord[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyPageSize = 10
const historyLoading = ref(false)
const activeExecution = ref<ExecutionRecord | null>(null)

const activeExecutionStatusLabel = computed(() => {
  if (!activeExecution.value) return ''
  const map: Record<string, string> = {
    pending: '待部署',
    preparing: '部署中',
    prepared: '待注入',
    running: '注入中',
  }
  return map[activeExecution.value.status] || activeExecution.value.status
})

async function refreshActiveExecution() {
  if (isCreate.value) return
  activeExecution.value = await executionStore.findActiveExecution(taskId.value)
}

async function loadHistory() {
  if (isCreate.value) return
  historyLoading.value = true
  try {
    const res = await request.get(`/tasks/${taskId.value}/executions`, {
      params: { page: historyPage.value, pageSize: historyPageSize },
    })
    historyList.value = res.data.data.list
    historyTotal.value = res.data.data.total
    const active = historyList.value.find(r => isActiveExecution(r.status))
    if (active) activeExecution.value = active
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

function scriptTargetRps(s: { targetRps?: number; weight: number }) {
  return s.targetRps && s.targetRps > 0 ? s.targetRps : s.weight
}

const form = reactive({
  name: '',
  description: '',
  scenarioConfig: {
    mode: 'vu' as ScenarioConfig['mode'],
    duration: 300,
    targetRps: 500,
    rpsRampTime: 0,
    rpsRampDownTime: 3,
    rpsMode: 'step' as 'step',
    vuSteps: [
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
    envVars: {} as Record<string, string>,
  },
  scripts: [] as any[],
})

const isRpsMode = computed(() => form.scenarioConfig.mode === 'rps')

const totalScriptTargetRps = computed(() =>
  form.scripts.reduce((sum, s) => sum + scriptTargetRps(s), 0),
)

/** 将场景阶梯末阶段 RPS 对齐为各脚本 targetRps 之和（峰值唯一来源） */
function syncScenePeakRps() {
  if (!isRpsMode.value) return
  const steps = form.scenarioConfig.rpsSteps
  if (!steps?.length) return
  const peak = totalScriptTargetRps.value
  if (peak <= 0) return

  const oldPeak = steps[steps.length - 1].rps
  if (oldPeak > 0 && oldPeak !== peak) {
    const ratio = peak / oldPeak
    for (let i = 0; i < steps.length - 1; i++) {
      steps[i].rps = Math.max(1, Math.round(steps[i].rps * ratio))
    }
  }
  steps[steps.length - 1].rps = peak
}

watch(totalScriptTargetRps, () => syncScenePeakRps())

const curveOption = computed(() => {
  const points: { x: number; y: number }[] = []
  const cfg = form.scenarioConfig
  if (cfg.mode === 'vu') {
    let t = 0
    let prevC = 0
    ;(cfg.vuSteps || []).forEach(step => {
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
    const rampDown = cfg.rpsRampDownTime ?? 0
    if (rampDown > 0 && prevR > 0) {
      points.push({ x: t, y: prevR })
      points.push({ x: t + rampDown, y: 0 })
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
    // 先复制顶层字段，再单独合并 circuitBreaker 以确保字段名对齐
    const sc = task.value.scenarioConfig
    Object.assign(form.scenarioConfig, sc)
    // 防御：后端返回的 circuitBreaker 可能字段不完整或为 null
    const cb = sc?.circuitBreaker
    form.scenarioConfig.circuitBreaker = {
      enabled: cb?.enabled ?? false,
      rules: Array.isArray(cb?.rules) ? cb!.rules : [],
      globalErrorRateThreshold: cb?.globalErrorRateThreshold ?? 20,
      globalWindowSeconds: cb?.globalWindowSeconds ?? 30,
      globalMinRequests: cb?.globalMinRequests ?? 100,
    }
    form.scenarioConfig.envVars = sc?.envVars ? { ...sc.envVars } : {}
    syncSceneEnvRowsFromConfig(form.scenarioConfig.envVars)
    normalizeRpsScene(form.scenarioConfig)
    form.scripts = [...task.value.scripts]
    syncScenePeakRps()
  }
  await scriptStore.fetchList({ pageSize: 100 })
  await refreshActiveExecution()

  const tabFromQuery = route.query.tab as string | undefined
  const guideFromQuery = route.query.guide as string | undefined
  if (!isCreate.value) {
    const validTabs = ['basic', 'scripts', 'scenario', 'history']
    if (tabFromQuery && validTabs.includes(tabFromQuery)) {
      activeTab.value = tabFromQuery
    }
    if (guideFromQuery === 'bind-scripts') {
      activeTab.value = 'scripts'
      notifyWarning('请先添加脚本，再配置 RPS 阶梯')
      router.replace({ path: route.path, query: tabFromQuery === 'scripts' ? { tab: 'scripts' } : {} })
    }
  }
})

function addStep() {
  form.scenarioConfig.vuSteps = form.scenarioConfig.vuSteps || []
  form.scenarioConfig.vuSteps.push({ concurrent: 100, duration: 60, rampTime: 20 })
}

function removeStep(i: number) {
  void (async () => {
    const ok = await confirmDanger('确认删除该 VU 阶梯？', { title: '删除确认' })
    if (!ok) return
    form.scenarioConfig.vuSteps?.splice(i, 1)
  })()
}

function addRpsStep() {
  form.scenarioConfig.rpsSteps = form.scenarioConfig.rpsSteps || []
  const steps = form.scenarioConfig.rpsSteps
  const peak = totalScriptTargetRps.value
  const prev = steps.at(-1)?.rps ?? 0
  const guess = peak > prev ? Math.min(peak, prev + 200) : prev + 200
  steps.push({ rps: Math.max(1, guess), duration: 60, rampTime: 30 })
  syncScenePeakRps()
}

function removeRpsStep(i: number) {
  const steps = form.scenarioConfig.rpsSteps
  if (!steps || steps.length <= 1) return
  void (async () => {
    const ok = await confirmDanger('确认删除该 RPS 阶梯？', { title: '删除确认' })
    if (!ok) return
    steps.splice(i, 1)
    syncScenePeakRps()
  })()
}

async function selectScript(script: any) {
  if (!task.value) return
  const defaultRps = isRpsMode.value ? 1000 : 100
  await taskStore.bindScript(task.value.id, script.id, defaultRps, isRpsMode.value ? defaultRps : undefined)
  form.scripts = [...(taskStore.currentTask?.scripts || [])]
  syncScenePeakRps()
  showScriptSelector.value = false
  notifySuccess(`已绑定脚本 ${script.name}`)
}

async function onTargetRpsChange(scriptId: string, targetRps: number) {
  if (!task.value || targetRps <= 0) return
  try {
    await taskStore.updateScriptTargetRps(task.value.id, scriptId, targetRps)
    form.scripts = [...(taskStore.currentTask?.scripts || [])]
    syncScenePeakRps()
    notifySuccess('脚本目标 RPS 已保存')
  } catch (e) {
    notifyError(getErrorMessage(e), '保存失败')
  }
}

async function onWeightChange(scriptId: string, weight: number) {
  if (!task.value) return
  try {
    await taskStore.updateScriptWeight(task.value.id, scriptId, weight)
    form.scripts = [...(taskStore.currentTask?.scripts || [])]
    notifySuccess('权重已保存')
  } catch (e) {
    notifyError(getErrorMessage(e), '保存失败')
  }
}

async function unbindScript(scriptId: string) {
  if (!task.value) return
  const name = form.scripts.find((s) => s.scriptId === scriptId)?.scriptName || scriptId
  const ok = await confirmDanger(
    `确认解绑脚本「${name}」？解绑后需重新绑定才能使用。`,
    { title: '解绑确认', confirmText: '解绑' },
  )
  if (!ok) return
  try {
    await taskStore.unbindScript(task.value.id, scriptId)
    form.scripts = [...(taskStore.currentTask?.scripts || [])]
    syncScenePeakRps()
    if (expandedEnvScript.value === scriptId) expandedEnvScript.value = null
    notifySuccess('脚本已解绑')
  } catch (e) {
    notifyError(getErrorMessage(e), '解绑失败')
  }
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
  void (async () => {
    const ok = await confirmDanger('确认删除该环境变量？', { title: '删除确认' })
    if (!ok) return
    editingEnvRows.value.splice(i, 1)
  })()
}

function syncSceneEnvRowsFromConfig(envVars?: Record<string, string>) {
  const vars = envVars || {}
  sceneEnvRows.value = Object.entries(vars).map(([key, value]) => ({ key, value }))
}

function buildSceneEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {}
  for (const row of sceneEnvRows.value) {
    if (row.key.trim()) envVars[row.key.trim()] = row.value
  }
  return envVars
}

function addSceneEnvRow() {
  sceneEnvRows.value.push({ key: '', value: '' })
}

function removeSceneEnvRow(i: number) {
  void (async () => {
    const ok = await confirmDanger('确认删除该场景环境变量？', { title: '删除确认' })
    if (!ok) return
    sceneEnvRows.value.splice(i, 1)
  })()
}

function removeCircuitRule(i: number) {
  void (async () => {
    const ok = await confirmDanger('确认删除该熔断规则？', { title: '删除确认' })
    if (!ok) return
    form.scenarioConfig.circuitBreaker.rules.splice(i, 1)
  })()
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
  notifySuccess('环境变量已保存')
}

function normalizeRpsScene(sc: ScenarioConfig) {
  if (sc.mode !== 'rps') return
  sc.rpsMode = 'step'
  // 兼容旧任务：固定速率 → 单阶段阶梯
  if ((!sc.rpsSteps || sc.rpsSteps.length === 0) && (sc.targetRps || sc.duration)) {
    sc.rpsSteps = [{
      rps: sc.targetRps || 500,
      duration: sc.duration || 300,
      rampTime: sc.rpsRampTime ?? 0,
    }]
  }
  if (!sc.rpsSteps?.length) {
    sc.rpsSteps = [
      { rps: 100, duration: 60, rampTime: 0 },
      { rps: 300, duration: 60, rampTime: 30 },
      { rps: 500, duration: 120, rampTime: 30 },
    ]
  }
}

function rpsStepsTotalDuration(steps: RpsStepConfig[] = []) {
  return steps.reduce((sum, s) => sum + (s.rampTime ?? 0) + (s.duration ?? 0), 0)
}

async function handleSave() {
  if (!form.name) {
    notifyWarning('请输入任务名称')
    return
  }
  saving.value = true
  try {
    form.scenarioConfig.envVars = buildSceneEnvVars()
    if (isRpsMode.value) {
      form.scenarioConfig.rpsMode = 'step'
      syncScenePeakRps()
      form.scenarioConfig.duration = rpsStepsTotalDuration(form.scenarioConfig.rpsSteps)
    }
    if (isCreate.value) {
      if (!projectStore.currentProject) {
        notifyWarning('请先在顶部选择项目，再创建压测任务')
        return
      }
      const newTask = await taskStore.createTask({
        name: form.name,
        description: form.description,
        projectId: projectStore.currentProject.id,
      })
      // 创建成功后再保存场景配置，并引导用户先绑定脚本
      await taskStore.updateScene(newTask.id, form.scenarioConfig)
      notifySuccess('任务创建成功', '创建成功')
      router.replace({ path: `/task/${newTask.id}`, query: { tab: 'scripts', guide: 'bind-scripts' } })
    } else {
      // 串行执行：updateTask 内部会 upsert scene_config，必须先完成再覆盖 scene
      await taskStore.updateTask(taskId.value, { name: form.name, description: form.description })
      await taskStore.updateScene(taskId.value, form.scenarioConfig)
      notifySuccess('任务名称、场景配置与环境变量已保存', '保存成功')
    }
  } catch (e) {
    notifyError(getErrorMessage(e), '保存失败')
  } finally {
    saving.value = false
  }
}

function goExecution() {
  router.push(`/execution/${taskId.value}?autostart=1`)
}

function goMonitor(executionId: string) {
  router.push(executionMonitorPath(taskId.value, executionId))
}

function canViewReport(row: ExecutionRecord): boolean {
  return row.status === 'success' || row.status === 'stopped' || row.status === 'circuit_broken'
}

function goReport(reportId: string) {
  router.push(`/report/${reportId}`)
}
</script>

<style lang="scss" scoped>
.task-detail-view {
  width: 100%;
}

.active-exec-banner {
  margin-bottom: 16px;
}

.detail-tabs {
  width: 100%;

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

.scenario-form {
  max-width: 100%;
}

.step-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.step-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px 24px;
  padding: 16px 20px;
  background: $bg-page;
  border-radius: $border-radius-sm;
  width: 100%;
  box-sizing: border-box;

  &__label {
    flex: 0 0 56px;
    font-size: 13px;
    font-weight: 500;
    color: $text-secondary;
  }

  &__group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;

    &--rps {
      flex: 1 1 220px;
      min-width: 220px;
    }
  }

  &__hint {
    font-size: 13px;
    color: $text-secondary;
    white-space: nowrap;
    min-width: 56px;
  }

  &__unit {
    font-size: 13px;
    color: $text-secondary;
    white-space: nowrap;
  }

  &__delete {
    margin-left: auto;
    flex-shrink: 0;
  }

  &--rps {
    min-height: 64px;
  }
}

.step-input {
  &--sm {
    width: 140px;
  }

  &--md {
    width: 160px;
  }

  &--lg {
    width: 180px;
  }

  &.el-input-number {
    flex-shrink: 0;
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
  margin-top: 8px;
  margin-bottom: 20px;
  padding: 16px;
  background: $bg-card;
  border-radius: $border-radius;
  border: 1px solid $border-color-light;

  &--inline {
    width: 100%;
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 8px;
  }
}

.rps-scene-hint {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: $color-primary-light-9;
  border-radius: $border-radius;
  font-size: 13px;
  color: $text-secondary;

  strong {
    font-size: 22px;
    color: $color-primary;
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    font-size: 13px;
  }

  &__desc {
    flex: 1;
    min-width: 200px;
    font-size: 12px;
  }
}

.rps-peak-readonly {
  display: inline-flex;
  align-items: center;
  min-width: 100px;
  padding: 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: $color-primary;
  font-variant-numeric: tabular-nums;
  line-height: 32px;
}

.rps-total-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;

  &__value {
    font-size: 28px;
    font-weight: 700;
    color: $color-primary;
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    font-size: 13px;
    color: $text-secondary;
  }

  &__hint {
    font-size: 12px;
    color: $text-secondary;
    width: 100%;
  }
}

.scripts-rps-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: $color-primary-light-9;
  border-radius: $border-radius;

  strong {
    font-size: 22px;
    color: $color-primary;
    font-variant-numeric: tabular-nums;
  }

  &__hint {
    font-size: 12px;
    color: $text-secondary;
  }
}

.scene-env-editor--scripts-tab {
  margin-bottom: 20px;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: 14px 16px;
  background: $bg-card;
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

.scene-env-editor {
  max-width: 700px;
  margin-top: 8px;
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid $border-color-light;
  border-radius: $border-radius-sm;
  background: $bg-card;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
  }

  &__tip {
    font-size: 12px;
    color: $text-secondary;
    line-height: 1.5;

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
  }

  &__empty {
    font-size: 12px;
    color: $text-secondary;

    code {
      font-family: 'SFMono-Regular', Consolas, monospace;
    }
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

.history-table {
  width: 100%;

  :deep(.cell) {
    white-space: nowrap;
  }

  // 备注列吃掉表格剩余宽度，熔断说明尽量单行展示
  :deep(.history-table__remark-col .cell) {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__id {
    font-size: 12px;
    color: #6b7280;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }

  &__error {
    color: #e54545;
    font-size: 12px;
  }

  &__muted {
    color: #9c9fa3;
    font-size: 12px;
  }
}
</style>
