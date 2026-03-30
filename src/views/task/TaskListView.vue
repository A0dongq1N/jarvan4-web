<template>
  <div class="task-list-view">
    <PageHeader title="压测任务" subtitle="管理和执行压测任务">
      <el-button type="primary" :icon="Plus" @click="openCreate">新建任务</el-button>
    </PageHeader>

    <!-- Search Bar -->
    <div class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索任务名称..."
        :prefix-icon="Search"
        style="width: 280px"
        clearable
        @input="handleSearch"
        @clear="handleSearch"
      />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 140px" @change="handleSearch">
        <el-option label="全部状态" value="" />
        <el-option label="空闲" value="idle" />
        <el-option label="运行中" value="running" />
        <el-option label="已完成" value="success" />
        <el-option label="失败" value="failed" />
      </el-select>
    </div>

    <!-- Task Table -->
    <div class="table-card">
      <el-table
        :data="taskStore.list"
        v-loading="taskStore.loading"
        row-key="id"
      >
        <el-table-column label="任务名称" prop="name" min-width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="goDetail(row.id)">{{ row.name }}</el-link>
            <div class="task-desc">{{ row.description || '暂无描述' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <StatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="场景模式" width="120">
          <template #default="{ row }">
            <span class="mode-tag" :class="`mode-tag--${row.scenarioConfig.mode}`">
              {{ modeLabel(row.scenarioConfig.mode) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="脚本数量" width="100">
          <template #default="{ row }">{{ row.scripts.length }} 个</template>
        </el-table-column>
        <el-table-column label="更新时间" prop="updatedAt" width="180">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :disabled="row.status === 'running'"
              @click="goExecution(row.id)"
            >执行</el-button>
            <el-button size="small" @click="goDetail(row.id)">详情</el-button>
            <el-dropdown size="small" @command="(cmd: string) => handleMore(cmd, row)">
              <el-button size="small">
                更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="row.lastExecutionId"
                    command="report"
                  >查看报告</el-dropdown-item>
                  <el-dropdown-item command="delete" style="color:#e0226e">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="taskStore.total"
          layout="total, prev, pager, next"
          @change="loadTasks"
        />
      </div>
    </div>

    <!-- Create/Edit Drawer -->
    <el-drawer
      v-model="drawerVisible"
      :title="editingTask ? '编辑任务' : '新建任务'"
      size="480px"
      :close-on-click-modal="false"
    >
      <el-form :model="taskForm" label-position="top" ref="formRef">
        <el-form-item label="任务名称" required>
          <el-input v-model="taskForm.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input v-model="taskForm.description" type="textarea" :rows="3" placeholder="可选描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawerVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-drawer>

    <!-- Confirm Delete Dialog -->
    <ConfirmDialog
      v-model="deleteDialogVisible"
      title="删除任务"
      :message="`确认删除任务「${deletingTask?.name}」？此操作不可撤销。`"
      type="danger"
      confirm-text="删除"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '@/stores/task'
import { useReportStore } from '@/stores/report'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { formatTime } from '@/utils/format'
import type { StressTask } from '@/types'

const router = useRouter()
const taskStore = useTaskStore()
const reportStore = useReportStore()

const searchKeyword = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const drawerVisible = ref(false)
const editingTask = ref<StressTask | null>(null)
const taskForm = reactive({ name: '', description: '' })
const saving = ref(false)
const formRef = ref()

const deleteDialogVisible = ref(false)
const deletingTask = ref<StressTask | null>(null)

// 防抖 timer
let searchTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => loadTasks())

async function loadTasks() {
  await taskStore.fetchList({
    page: currentPage.value,
    pageSize: pageSize.value,
    keyword: searchKeyword.value,
    status: statusFilter.value,
  })
}

function handleSearch() {
  currentPage.value = 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadTasks(), 300)
}

function modeLabel(mode: string) {
  const map: Record<string, string> = { step: 'VU 阶梯', rps: 'RPS' }
  return map[mode] || mode
}

function openCreate() {
  editingTask.value = null
  taskForm.name = ''
  taskForm.description = ''
  drawerVisible.value = true
}

async function handleSave() {
  if (!taskForm.name) {
    ElMessage.warning('请输入任务名称')
    return
  }
  saving.value = true
  try {
    if (editingTask.value) {
      await taskStore.updateTask(editingTask.value.id, taskForm)
    } else {
      await taskStore.createTask(taskForm)
    }
    drawerVisible.value = false
    ElMessage.success('保存成功')
    loadTasks()
  } finally {
    saving.value = false
  }
}

function goDetail(id: string) {
  router.push(`/task/${id}`)
}

function goExecution(taskId: string) {
  router.push(`/execution/${taskId}`)
}

async function handleMore(cmd: string, task: StressTask) {
  if (cmd === 'report') {
    await goReport(task)
  } else if (cmd === 'delete') {
    confirmDelete(task)
  }
}

async function goReport(task: StressTask) {
  // Find report for this task
  await reportStore.fetchList({ keyword: task.name })
  const report = reportStore.list[0]
  if (report) {
    router.push(`/report/${report.id}`)
  } else {
    router.push('/report')
  }
}

function confirmDelete(task: StressTask) {
  deletingTask.value = task
  deleteDialogVisible.value = true
}

async function doDelete() {
  if (!deletingTask.value) return
  await taskStore.deleteTask(deletingTask.value.id)
  ElMessage.success('删除成功')
  loadTasks()
}
</script>

<style lang="scss" scoped>
.task-list-view {
  max-width: 1200px;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.table-card {
  background: $bg-card;
  border-radius: $border-radius;
  border: 1px solid $border-color-light;
  overflow: hidden;
}

.table-footer {
  padding: 14px 20px;
  border-top: 1px solid $border-color-light;
  display: flex;
  justify-content: flex-end;
}

.task-desc {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

// 场景模式 tag（按模式着色）
.mode-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;

  &--concurrent {
    background: rgba($color-primary, 0.08);
    color: $color-primary;
    border: 1px solid rgba($color-primary, 0.2);
  }
  &--step {
    background: rgba($color-warning, 0.08);
    color: darken(#ff9900, 10%);
    border: 1px solid rgba($color-warning, 0.25);
  }
  &--rps {
    background: rgba(#722ed1, 0.08);
    color: #722ed1;
    border: 1px solid rgba(#722ed1, 0.2);
  }
}
</style>
