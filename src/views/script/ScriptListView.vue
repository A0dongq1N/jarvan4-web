<template>
  <div class="script-list-view">
    <PageHeader title="脚本管理" subtitle="脚本由 Git 仓库管理，push 后 CI 自动编译发布" />

    <!-- Search -->
    <div class="search-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索脚本名称 / 描述 / 提交者..."
        :prefix-icon="Search"
        style="width: 320px"
        clearable
        @change="handleSearch"
      />
    </div>

    <!-- Script Table -->
    <div class="table-card">
      <el-table
        :data="scriptStore.list"
        v-loading="scriptStore.loading"
        row-key="id"
        @row-click="(row: Script) => openDetail(row)"
        style="cursor: pointer"
      >
        <el-table-column label="脚本名称" min-width="180">
          <template #default="{ row }">
            <div class="script-name">
              <el-icon class="script-name__icon"><Document /></el-icon>
              <span class="script-name__text">{{ row.name }}</span>
              <el-tag size="small" effect="plain" class="lang-tag">{{ row.language.toUpperCase() }}</el-tag>
            </div>
            <div class="script-desc">{{ row.description || '暂无描述' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="最新 Commit" min-width="260">
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
              <el-avatar :size="22" class="author__avatar">{{ row.author.slice(0, 1).toUpperCase() }}</el-avatar>
              <span>{{ row.author }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="发布时间" width="160">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain @click.stop="openDetail(row)">版本历史</el-button>
            <el-button size="small" type="danger" plain @click.stop="confirmDelete(row)">下线</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="scriptStore.total"
          layout="total, prev, pager, next"
          @change="loadScripts"
        />
      </div>
    </div>

    <!-- Version History Drawer -->
    <el-drawer
      v-model="drawerVisible"
      :title="`版本历史 · ${selectedScript?.name}`"
      size="560px"
      direction="rtl"
    >
      <template v-if="selectedScript">
        <div class="drawer-meta">
          <div class="drawer-meta__item">
            <span class="drawer-meta__label">描述</span>
            <span>{{ selectedScript.description || '暂无描述' }}</span>
          </div>
          <div class="drawer-meta__item">
            <span class="drawer-meta__label">语言</span>
            <el-tag size="small" effect="plain">{{ selectedScript.language.toUpperCase() }}</el-tag>
          </div>
        </div>

        <div class="version-list" v-loading="versionLoading">
          <div
            v-for="ver in scriptStore.versionHistory"
            :key="ver.commitHash"
            class="version-item"
          >
            <div class="version-item__dot" />
            <div class="version-item__body">
              <div class="version-item__header">
                <code class="version-item__hash">{{ ver.commitHash.slice(0, 8) }}</code>
                <span class="version-item__author">{{ ver.author }}</span>
                <span class="version-item__time">{{ formatTime(ver.createdAt) }}</span>
              </div>
              <div class="version-item__msg">{{ ver.commitMsg }}</div>
              <div class="version-item__url">
                <el-icon><Link /></el-icon>
                <span>{{ ver.artifactUrl }}</span>
              </div>
            </div>
          </div>
          <div v-if="scriptStore.versionHistory.length === 0" style="padding: 40px 0">
            <EmptyState title="暂无版本记录" desc="push 代码后 CI 自动写入版本历史" />
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- Confirm Delete -->
    <ConfirmDialog
      v-model="deleteVisible"
      title="下线脚本"
      :message="`确认下线脚本「${deletingScript?.name}」？下线后任务将无法绑定此脚本。`"
      type="danger"
      confirm-text="下线"
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search, Document, Link } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useScriptStore } from '@/stores/script'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { formatTime } from '@/utils/format'
import type { Script } from '@/types'

const scriptStore = useScriptStore()
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

const drawerVisible = ref(false)
const selectedScript = ref<Script | null>(null)
const versionLoading = ref(false)

const deleteVisible = ref(false)
const deletingScript = ref<Script | null>(null)

onMounted(() => loadScripts())

async function loadScripts() {
  await scriptStore.fetchList({ page: currentPage.value, pageSize: pageSize.value, keyword: keyword.value })
}

function handleSearch() {
  currentPage.value = 1
  loadScripts()
}

async function openDetail(script: Script) {
  selectedScript.value = script
  drawerVisible.value = true
  versionLoading.value = true
  try {
    await scriptStore.fetchVersionHistory(script.id)
  } finally {
    versionLoading.value = false
  }
}

function confirmDelete(script: Script) {
  deletingScript.value = script
  deleteVisible.value = true
}

async function doDelete() {
  if (!deletingScript.value) return
  await scriptStore.deleteScript(deletingScript.value.id)
  ElMessage.success('下线成功')
  loadScripts()
}
</script>

<style lang="scss" scoped>
.script-list-view {
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

.script-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;

  &__icon {
    color: $color-primary;
    flex-shrink: 0;
  }

  &__text {
    font-weight: 600;
    font-size: 14px;
    color: $text-primary;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
}

.lang-tag {
  font-size: 11px;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
}

.script-desc {
  font-size: 12px;
  color: $text-secondary;
  margin-left: 24px;
  @include ellipsis(1);
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

// Drawer
.drawer-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 0 20px;
  border-bottom: 1px solid $border-color-light;
  margin-bottom: 24px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: $text-regular;
  }

  &__label {
    color: $text-secondary;
    min-width: 40px;
  }
}

.version-list {
  position: relative;
  padding-left: 16px;

  &::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 8px;
    bottom: 0;
    width: 1px;
    background: $border-color-light;
  }
}

.version-item {
  display: flex;
  gap: 16px;
  padding-bottom: 24px;
  position: relative;

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: $color-primary;
    border: 2px solid $bg-card;
    box-shadow: 0 0 0 1px $color-primary;
    flex-shrink: 0;
    margin-top: 4px;
    position: relative;
    z-index: 1;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  &__hash {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
    background: $color-primary-light-9;
    color: $color-primary;
    padding: 1px 6px;
    border-radius: 4px;
  }

  &__author {
    font-size: 13px;
    font-weight: 500;
    color: $text-primary;
  }

  &__time {
    font-size: 12px;
    color: $text-secondary;
    margin-left: auto;
  }

  &__msg {
    font-size: 13px;
    color: $text-regular;
    margin-bottom: 6px;
    line-height: 1.5;
  }

  &__url {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: $text-placeholder;
    font-family: 'SFMono-Regular', Consolas, monospace;
    @include ellipsis(1);
  }
}
</style>
