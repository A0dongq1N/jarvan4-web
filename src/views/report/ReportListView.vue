<template>
  <div class="report-list-view">
    <PageHeader title="压测报告" subtitle="查看历史压测结果与分析报告" />

    <!-- Search -->
    <div class="search-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索报告..."
        :prefix-icon="Search"
        style="width: 280px"
        clearable
        @change="loadReports"
      />
    </div>

    <!-- Table -->
    <div class="table-card">
      <el-table
        :data="reportStore.list"
        v-loading="reportStore.loading"
      >
        <el-table-column label="报告名称" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/report/${row.id}`)">
              {{ row.taskName }}
            </el-link>
            <div style="font-size: 12px; color: #86909c">{{ row.id }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <StatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="峰值 RPS" width="120">
          <template #default="{ row }">
            {{ formatNumber(row.summary.rps, 0) }}
          </template>
        </el-table-column>
        <el-table-column label="平均响应" width="120">
          <template #default="{ row }">
            {{ formatNumber(row.summary.avgResponseTime, 0) }} ms
          </template>
        </el-table-column>
        <el-table-column label="错误率" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.summary.errorRate > 0.01 ? '#e54545' : '#00a870' }">
              {{ formatPercent(row.summary.errorRate) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="持续时长" width="120">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.startTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="$router.push(`/report/${row.id}`)">详情</el-button>
            <el-button size="small" type="danger" plain @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="reportStore.total"
          layout="total, prev, pager, next"
          @change="loadReports"
        />
      </div>
    </div>

    <ConfirmDialog
      v-model="deleteVisible"
      title="删除报告"
      :message="`确认删除报告「${deletingReport?.taskName}」？`"
      type="danger"
      confirm-text="删除"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useReportStore } from '@/stores/report'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { formatNumber, formatPercent, formatDuration, formatTime } from '@/utils/format'
import type { Report } from '@/types'

const reportStore = useReportStore()
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const deleteVisible = ref(false)
const deletingReport = ref<Report | null>(null)

onMounted(() => loadReports())

async function loadReports() {
  await reportStore.fetchList({
    page: currentPage.value,
    pageSize: pageSize.value,
    keyword: keyword.value,
  })
}

function confirmDelete(report: Report) {
  deletingReport.value = report
  deleteVisible.value = true
}

async function doDelete() {
  if (!deletingReport.value) return
  await reportStore.deleteReport(deletingReport.value.id)
  ElMessage.success('删除成功')
  loadReports()
}
</script>

<style lang="scss" scoped>
.report-list-view {
  max-width: 1200px;
}

.search-bar {
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
</style>
