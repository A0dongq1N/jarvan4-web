<template>
  <div class="project-select-page">
    <!-- 极简页头 -->
    <header class="page-header">
      <div class="page-header__brand">
        <span class="page-header__logo">⚡</span>
        <span class="page-header__title">压测平台</span>
      </div>
      <div class="page-header__user">
        <span class="page-header__username">{{ authStore.userInfo?.displayName || 'Admin' }}</span>
        <el-button text size="small" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          退出
        </el-button>
      </div>
    </header>

    <!-- 主体内容 -->
    <main class="page-body">
      <!-- 标题区域 -->
      <div class="content-header">
        <div class="content-header__text">
          <h1 class="content-header__title">选择项目</h1>
          <p class="content-header__subtitle">选择一个项目以继续</p>
        </div>
        <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
          新建项目
        </el-button>
      </div>

      <!-- 搜索框 -->
      <div class="search-bar">
        <el-input
          v-model="keyword"
          placeholder="搜索项目..."
          :prefix-icon="Search"
          clearable
          @input="handleSearch"
          @clear="handleSearch"
        />
      </div>

      <!-- 项目网格 -->
      <div v-if="projectStore.loading" class="loading-state">
        <el-skeleton :rows="3" animated />
      </div>
      <div v-else-if="projectStore.list.length === 0" class="empty-state">
        <el-empty description="暂无项目，点击右上角新建一个吧" />
      </div>
      <div v-else class="project-grid">
        <div
          v-for="project in projectStore.list"
          :key="project.id"
          class="project-card"
        >
          <div class="project-card__body">
            <div class="project-card__icon">📁</div>
            <div class="project-card__info">
              <div class="project-card__name">{{ project.name }}</div>
              <div v-if="project.description" class="project-card__desc">
                {{ project.description }}
              </div>
            </div>
          </div>

          <div class="project-card__stats">
            <div class="stat-item">
              <span class="stat-item__label">任务</span>
              <span class="stat-item__value">{{ project.taskCount }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-item__label">脚本</span>
              <span class="stat-item__value">{{ project.scriptCount }}</span>
            </div>
          </div>

          <div class="project-card__footer">
            <span class="project-card__last-run">
              <template v-if="project.lastRunAt">
                最近 {{ formatRelativeTime(project.lastRunAt) }}
              </template>
              <template v-else>
                尚未运行
              </template>
            </span>
            <div class="project-card__actions">
              <el-button
                size="small"
                type="danger"
                plain
                :icon="Delete"
                @click.stop="handleDelete(project)"
              />
              <el-button
                type="primary"
                size="small"
                @click="enterProject(project)"
              >
                进入项目 →
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 新建项目弹窗 -->
    <el-dialog
      v-model="showCreateDialog"
      title="新建项目"
      width="480px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        @submit.prevent="handleCreate"
      >
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入项目名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="项目描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入项目描述（选填）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, SwitchButton, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useAuthStore } from '@/stores/auth'
import type { Project } from '@/types'

const router = useRouter()
const projectStore = useProjectStore()
const authStore = useAuthStore()

// 搜索
const keyword = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    projectStore.fetchList({ keyword: keyword.value })
  }, 300)
}

// 进入项目
function enterProject(project: Project) {
  projectStore.selectProject(project)
  router.push('/task')
}

// 删除项目
async function handleDelete(project: Project) {
  await ElMessageBox.confirm(
    `确定删除项目「${project.name}」？该操作不可恢复。`,
    '删除确认',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
  )
  try {
    await projectStore.deleteProject(project.id)
    ElMessage.success('项目已删除')
  } catch {
    ElMessage.error('删除失败，请重试')
  }
}

// 退出登录
function handleLogout() {
  authStore.logout()
  projectStore.clearProject()
  router.push('/login')
}

// 时间格式化
function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}

// 新建项目
const showCreateDialog = ref(false)
const creating = ref(false)
const formRef = ref<FormInstance>()
const form = ref({ name: '', description: '' })
const rules: FormRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
}

function resetForm() {
  form.value = { name: '', description: '' }
  formRef.value?.clearValidate()
}

async function handleCreate() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  creating.value = true
  try {
    await projectStore.createProject({ name: form.value.name, description: form.value.description || undefined })
    ElMessage.success('项目创建成功')
    showCreateDialog.value = false
    projectStore.fetchList({ keyword: keyword.value })
  } catch {
    ElMessage.error('创建失败，请重试')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  projectStore.fetchList()
})
</script>

<style lang="scss" scoped>
.project-select-page {
  min-height: 100vh;
  background: $bg-page;
  display: flex;
  flex-direction: column;
}

// 页头
.page-header {
  height: 56px;
  background: $bg-card;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  flex-shrink: 0;

  &__brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__logo {
    font-size: 20px;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    color: $text-primary;
    letter-spacing: 0.5px;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__username {
    font-size: 13px;
    color: $text-secondary;
  }
}

// 主体
.page-body {
  flex: 1;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 24px;
}

// 标题区域
.content-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;

  &__title {
    font-size: 22px;
    font-weight: 700;
    color: $text-primary;
    margin: 0 0 4px;
  }

  &__subtitle {
    font-size: 13px;
    color: $text-secondary;
    margin: 0;
  }
}

// 搜索框
.search-bar {
  margin-bottom: 24px;

  :deep(.el-input) {
    max-width: 360px;
  }
}

// 加载 / 空状态
.loading-state {
  padding: 24px 0;
}

.empty-state {
  padding: 60px 0;
}

// 项目网格
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

// 项目卡片
.project-card {
  background: $bg-card;
  border: 1px solid $border-color;
  border-left: 4px solid $color-primary;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: box-shadow $transition-fast, transform $transition-fast;
  cursor: default;

  &:hover {
    box-shadow: $shadow-md;
    transform: translateY(-2px);
  }

  &__body {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &__icon {
    font-size: 28px;
    flex-shrink: 0;
    line-height: 1;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__desc {
    font-size: 12px;
    color: $text-secondary;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  &__stats {
    display: flex;
    gap: 24px;
    padding: 12px 0;
    border-top: 1px solid $border-color-light;
    border-bottom: 1px solid $border-color-light;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__last-run {
    font-size: 12px;
    color: $text-placeholder;
  }
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &__label {
    font-size: 11px;
    color: $text-placeholder;
  }

  &__value {
    font-size: 20px;
    font-weight: 600;
    color: $text-primary;
  }
}
</style>
