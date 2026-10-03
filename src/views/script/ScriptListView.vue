<template>
  <div class="script-list-view">
    <PageHeader title="脚本管理" subtitle="特性分支每次提交生成预览版，合入主干生成正式版" />

    <div class="search-bar">
      <el-input
        v-model="keyword"
        placeholder="筛选脚本名称"
        :prefix-icon="Search"
        style="width: 280px"
        clearable
        @change="handleSearch"
      />
      <el-select v-model="channel" placeholder="状态" style="width: 140px" @change="handleSearch">
        <el-option label="全部" value="" />
        <el-option label="预览" value="preview" />
        <el-option label="正式" value="release" />
      </el-select>
    </div>

    <div class="table-card">
      <el-table :data="scriptStore.publications" v-loading="scriptStore.loading" row-key="id">
        <el-table-column label="脚本名称" min-width="180">
          <template #default="{ row }">
            <span class="script-name__text">{{ row.scriptName }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.channel === 'release' ? 'success' : 'warning'" size="small" effect="plain">
              {{ row.channel === 'release' ? '正式' : '预览' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="分支" min-width="140">
          <template #default="{ row }">
            <span class="branch">{{ row.branch || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Commit" min-width="240">
          <template #default="{ row }">
            <div class="commit-info">
              <span class="commit-hash">{{ row.commitHash.slice(0, 8) }}</span>
              <span class="commit-msg">{{ row.commitMsg }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="提交者" width="110">
          <template #default="{ row }">
            <div class="author">
              <el-avatar :size="22" class="author__avatar">{{ (row.author || '?').slice(0, 1).toUpperCase() }}</el-avatar>
              <span>{{ row.author }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="源码" width="110" align="center">
          <template #default="{ row }">
            <a
              v-if="row.sourceRepo && row.sourcePath"
              :href="buildSourceUrl(row.sourceRepo, row.sourcePath, row.branch)"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link"
            >
              <el-icon><Link /></el-icon>
              <span>查看源码</span>
            </a>
            <span v-else class="source-empty">-</span>
          </template>
        </el-table-column>

        <el-table-column label="时间" width="160">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="danger" plain @click="confirmDelete(row)">下线</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="scriptStore.publicationTotal"
          layout="total, prev, pager, next"
          @change="loadPublications"
        />
      </div>
    </div>

    <ConfirmDialog
      v-model="deleteVisible"
      title="下线脚本"
      :message="`确认下线脚本「${deleting?.scriptName}」？下线后任务将无法绑定此脚本，其预览和正式记录不再展示。`"
      type="danger"
      confirm-text="下线"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search, Link } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useScriptStore } from '@/stores/script'
import PageHeader from '@/components/common/PageHeader.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { formatTime } from '@/utils/format'
import type { ScriptPublication } from '@/types'

const scriptStore = useScriptStore()
const keyword = ref('')
const channel = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

const deleteVisible = ref(false)
const deleting = ref<ScriptPublication | null>(null)

onMounted(() => loadPublications())

function buildSourceUrl(repo: string, path: string, branch?: string): string {
  const ref = branch || 'main'
  const prefix = repo.includes('github.com') ? `/blob/${ref}/` : `/-/blob/${ref}/`
  return `${repo}${prefix}${path}`
}

async function loadPublications() {
  await scriptStore.fetchPublications({
    page: currentPage.value,
    pageSize: pageSize.value,
    keyword: keyword.value,
    channel: channel.value,
  })
}

function handleSearch() {
  currentPage.value = 1
  loadPublications()
}

function confirmDelete(row: ScriptPublication) {
  deleting.value = row
  deleteVisible.value = true
}

async function doDelete() {
  if (!deleting.value) return
  await scriptStore.deleteScript(deleting.value.scriptId)
  ElMessage.success('已下线')
  deleteVisible.value = false
  await loadPublications()
}
</script>

<style lang="scss" scoped>
.script-list-view {
  max-width: 1280px;
}

.search-bar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
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

.script-name__text {
  font-weight: 600;
  font-size: 14px;
  color: $text-primary;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.branch {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: $text-regular;
}

.commit-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.commit-hash {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  background: $color-primary-light-9;
  color: $color-primary;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.commit-msg {
  font-size: 13px;
  color: $text-regular;
  @include ellipsis(1);
}

.author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $text-regular;

  &__avatar {
    background: $color-primary-light-8;
    color: $color-primary;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }
}

.time-text {
  font-size: 13px;
  color: $text-secondary;
}

.source-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: $color-primary;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.source-empty {
  color: $text-placeholder;
}
</style>
