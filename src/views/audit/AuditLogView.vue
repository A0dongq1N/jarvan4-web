<template>
  <div class="audit-log">
    <PageHeader title="操作审计" subtitle="记录平台关键操作，包括任务执行、用户变更、节点管理等" />

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索用户名 / 资源名称 / 详情..."
        :prefix-icon="Search"
        clearable
        class="filter-bar__keyword"
        @clear="handleSearch"
        @keyup.enter="handleSearch"
      />
      <el-select
        v-model="actionFilter"
        placeholder="操作类型"
        clearable
        class="filter-bar__select"
        @change="handleSearch"
      >
        <el-option
          v-for="(label, val) in ACTION_LABELS"
          :key="val"
          :label="label"
          :value="val"
        />
      </el-select>
      <el-select
        v-model="resourceTypeFilter"
        placeholder="资源类型"
        clearable
        class="filter-bar__select"
        @change="handleSearch"
      >
        <el-option
          v-for="(label, val) in RESOURCE_TYPE_LABELS"
          :key="val"
          :label="label"
          :value="val"
        />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        class="filter-bar__date"
        value-format="YYYY-MM-DD"
        :editable="false"
        @change="handleSearch"
        @clear="handleSearch"
      />
      <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
      <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <el-table
        :data="auditStore.list"
        v-loading="auditStore.loading"
        stripe
        style="width: 100%"
      >
        <el-table-column label="操作时间" width="180" prop="createdAt">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作人" width="120" prop="username" />

        <el-table-column label="操作类型" width="130">
          <template #default="{ row }">
            <el-tag
              :type="actionTagType(getAction(row))"
              size="small"
              effect="light"
            >
              {{ ACTION_LABELS[getAction(row)] ?? row.action }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="资源类型" width="100">
          <template #default="{ row }">
            <el-tag
              type="info"
              size="small"
              effect="plain"
            >
              {{ RESOURCE_TYPE_LABELS[getResourceType(row)] ?? row.resourceType }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="资源名称" min-width="160" prop="resourceName">
          <template #default="{ row }">
            <span class="resource-name">{{ row.resourceName ?? '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="来源 IP" width="130" prop="ip" />

        <el-table-column label="操作详情" min-width="200">
          <template #default="{ row }">
            <template v-if="row.detail">
              <el-tooltip
                :content="row.detail"
                placement="top"
                :show-after="300"
                :max-width="300"
              >
                <span class="detail-text">{{ row.detail }}</span>
              </el-tooltip>
            </template>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <ElEmpty
        v-if="!auditStore.loading && auditStore.list.length === 0"
        description="暂无审计记录"
        :image-size="80"
        style="padding: 40px 0"
      />

      <!-- 分页 -->
      <div class="table-footer">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="auditStore.total"
          layout="total, prev, pager, next"
          @change="loadList"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { ElEmpty } from 'element-plus'
import { useAuditStore } from '@/stores/audit'
import PageHeader from '@/components/common/PageHeader.vue'
import { formatTime } from '@/utils/format'
import type { AuditAction, AuditResourceType, AuditLog } from '@/types'

const auditStore = useAuditStore()

const keyword = ref('')
const actionFilter = ref('')
const resourceTypeFilter = ref('')
const dateRange = ref<[string, string] | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)

const ACTION_LABELS: Record<AuditAction, string> = {
  login: '登录',
  logout: '登出',
  create_task: '创建任务',
  update_task: '编辑任务',
  delete_task: '删除任务',
  copy_task: '复制任务',
  start_execution: '启动压测',
  stop_execution: '停止压测',
  create_script: '上传脚本',
  delete_script: '删除脚本',
  create_project: '创建项目',
  delete_project: '删除项目',
  create_user: '创建用户',
  update_user: '编辑用户',
  delete_user: '删除用户',
  register_worker: '注册节点',
  offline_worker: '下线节点',
}

const RESOURCE_TYPE_LABELS: Record<AuditResourceType, string> = {
  task: '任务',
  script: '脚本',
  execution: '执行',
  project: '项目',
  user: '用户',
  worker: '节点',
  system: '系统',
}

type TagType = 'success' | 'warning' | 'danger' | 'primary' | 'info' | undefined

function getAction(row: AuditLog): AuditAction {
  return row.action
}

function getResourceType(row: AuditLog): AuditResourceType {
  return row.resourceType
}

function actionTagType(action: AuditAction): TagType {
  if (action === 'login' || action === 'logout') return 'info'
  if (action === 'start_execution') return 'success'
  if (action === 'stop_execution') return 'warning'
  if (
    action === 'delete_task' ||
    action === 'delete_script' ||
    action === 'delete_user' ||
    action === 'delete_project' ||
    action === 'offline_worker'
  ) return 'danger'
  return 'primary'
}

onMounted(() => loadList())

function handleSearch() {
  currentPage.value = 1
  loadList()
}

function handleReset() {
  keyword.value = ''
  actionFilter.value = ''
  resourceTypeFilter.value = ''
  dateRange.value = null
  currentPage.value = 1
  loadList()
}

async function loadList() {
  await auditStore.fetchList({
    page: currentPage.value,
    pageSize: pageSize.value,
    keyword: keyword.value || undefined,
    action: actionFilter.value || undefined,
    resourceType: resourceTypeFilter.value || undefined,
    startTime: dateRange.value?.[0] || undefined,
    endTime: dateRange.value?.[1] || undefined,
  })
}
</script>

<style lang="scss" scoped>
.audit-log {
  max-width: 1400px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  &__keyword {
    width: 220px;
  }

  &__select {
    width: 140px;
  }

  &__date {
    width: 240px;
  }
}

.table-wrapper {
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

.resource-name {
  color: $text-primary;
  font-size: 13px;
}

.detail-text {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  color: $text-regular;
  font-size: 13px;
  cursor: default;
}

.text-muted {
  color: $text-placeholder;
}
</style>
