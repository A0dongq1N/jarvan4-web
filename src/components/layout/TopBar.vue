<template>
  <header class="topbar">
    <!-- 左侧：项目切换 + 面包屑 -->
    <div class="topbar__left">
      <div
        v-if="projectStore.currentProject"
        class="topbar__project-chip"
        @click="router.push('/project')"
        title="切换项目"
      >
        <span class="topbar__project-icon">📁</span>
        <span class="topbar__project-name">{{ projectStore.currentProject.name }}</span>
        <el-icon :size="11" class="topbar__project-caret"><ArrowDown /></el-icon>
      </div>

      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/task' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-if="currentRoute.meta.title">
          {{ currentRoute.meta.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 右侧 -->
    <div class="topbar__right">
      <!-- 文档链接 -->
      <a class="topbar__doc-link" href="#" title="文档">
        <el-icon :size="16"><QuestionFilled /></el-icon>
      </a>

      <div class="topbar__divider" />

      <!-- 用户下拉 -->
      <el-dropdown @command="handleCommand">
        <div class="topbar__user">
          <el-avatar :size="28" class="topbar__avatar">
            {{ userInitial }}
          </el-avatar>
          <span class="topbar__username">{{ authStore.userInfo?.displayName || 'Admin' }}</span>
          <el-icon :size="12" class="topbar__caret"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, SwitchButton, QuestionFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()

const currentRoute = computed(() => route)

const userInitial = computed(() => {
  const name = authStore.userInfo?.displayName || 'A'
  return name.charAt(0).toUpperCase()
})

function handleCommand(command: string) {
  if (command === 'logout') {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<style lang="scss" scoped>
.topbar {
  position: sticky;
  top: 0;
  height: $topbar-height;
  // Grafana 风格：半透明 + 模糊，层次感
  background: rgba($bg-card, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 99;
  flex-shrink: 0;

  &__left {
    display: flex;
    align-items: center;
    gap: 12px;

    :deep(.el-breadcrumb__inner) {
      font-size: 13px;
      color: $text-secondary;
      font-weight: 400;

      &.is-link:hover { color: $color-primary; }
    }

    :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
      color: $text-regular;
      font-weight: 500;
    }
  }

  &__project-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba($color-primary, 0.08);
    border: 1px solid rgba($color-primary, 0.2);
    cursor: pointer;
    transition: $transition-fast;
    flex-shrink: 0;

    &:hover {
      background: rgba($color-primary, 0.14);
      border-color: rgba($color-primary, 0.4);
    }
  }

  &__project-icon {
    font-size: 13px;
    line-height: 1;
  }

  &__project-name {
    font-size: 12px;
    font-weight: 600;
    color: $color-primary;
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__project-caret {
    color: $color-primary;
    opacity: 0.7;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__doc-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    color: $text-secondary;
    text-decoration: none;
    transition: $transition-fast;

    &:hover {
      color: $text-primary;
      background: $gray-90;
    }
  }

  &__divider {
    width: 1px;
    height: 20px;
    background: $border-color;
    margin: 0 4px;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 6px;
    transition: $transition-fast;

    &:hover {
      background: $gray-90;
    }
  }

  &__avatar {
    background: $color-primary !important;
    color: white !important;
    font-weight: 600;
    font-size: 12px;
    flex-shrink: 0;
  }

  &__username {
    font-size: 13px;
    color: $text-regular;
    font-weight: 500;
  }

  &__caret {
    color: $text-secondary;
  }
}
</style>
