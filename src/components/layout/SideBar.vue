<template>
  <div class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <!-- Logo -->
    <div class="sidebar__logo">
      <div class="sidebar__logo-icon">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect width="26" height="26" rx="6" fill="#3871dc"/>
          <path d="M6 13h14M13 6v14" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      </div>
      <span v-if="!collapsed" class="sidebar__logo-text app-logo-text">压测平台</span>
    </div>

    <!-- 导航菜单 -->
    <nav class="sidebar__nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="sidebar__nav-item"
        :class="{ 'is-active': activeMenu === item.path }"
      >
        <el-icon class="sidebar__nav-icon" :size="18">
          <component :is="item.icon" />
        </el-icon>
        <span v-if="!collapsed" class="sidebar__nav-label">{{ item.label }}</span>
        <el-tooltip
          v-if="collapsed"
          :content="item.label"
          placement="right"
          :show-after="200"
        />
      </router-link>
    </nav>

    <!-- 折叠按钮 -->
    <div class="sidebar__toggle" @click="$emit('toggle')">
      <el-icon :size="15">
        <component :is="collapsed ? 'Expand' : 'Fold'" />
      </el-icon>
      <span v-if="!collapsed" class="sidebar__toggle-label">收起</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DataAnalysis, Document, TrendCharts, Cpu, Expand, Fold, Tickets } from '@element-plus/icons-vue'

defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()

const route = useRoute()

const navItems = [
  { path: '/task',   label: '压测任务', icon: DataAnalysis },
  { path: '/script', label: '脚本管理', icon: Document },
  { path: '/report', label: '压测报告', icon: TrendCharts },
  { path: '/worker', label: '节点管理', icon: Cpu },
  { path: '/audit',  label: '审计日志', icon: Tickets },
]

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/task') || path.startsWith('/execution')) return '/task'
  if (path.startsWith('/script')) return '/script'
  if (path.startsWith('/report')) return '/report'
  if (path.startsWith('/worker')) return '/worker'
  if (path.startsWith('/audit')) return '/audit'
  return '/task'
})
</script>

<style lang="scss" scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: $sidebar-width;
  background: $bg-sidebar;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  transition: width 0.22s ease;
  z-index: 100;
  overflow: hidden;

  &--collapsed {
    width: $sidebar-collapsed-width;

    .sidebar__nav-item {
      justify-content: center;
      padding: 0;
    }
  }

  // ── Logo 区 ────────────────────────────────────────────────
  &__logo {
    height: $topbar-height;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 10px;
    flex-shrink: 0;
    border-bottom: 1px solid $border-color;
  }

  &__logo-text {
    color: $text-primary;
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    letter-spacing: -0.01em;
  }

  // ── 导航区 ─────────────────────────────────────────────────
  &__nav {
    flex: 1;
    padding: 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  &__nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 10px;
    border-radius: 6px;
    text-decoration: none;
    color: $text-regular;
    font-size: 13.5px;
    font-weight: 500;
    transition: background 0.15s ease, color 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    position: relative;

    &:hover {
      background: rgba($color-primary, 0.07);
      color: $color-primary;
    }

    &.is-active {
      background: $bg-sidebar-active;
      color: $color-primary;
      font-weight: 600;

      // Grafana 风格：左侧 3px active 竖线
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 6px;
        bottom: 6px;
        width: 3px;
        border-radius: 0 2px 2px 0;
        background: $color-primary;
      }
    }
  }

  &__nav-icon {
    flex-shrink: 0;
    color: inherit;
  }

  &__nav-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // ── 折叠按钮 ───────────────────────────────────────────────
  &__toggle {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    color: $text-secondary;
    border-top: 1px solid $border-color;
    flex-shrink: 0;
    font-size: 12px;
    transition: color 0.15s ease, background 0.15s ease;
    padding: 0 16px;

    &:hover {
      color: $text-primary;
      background: rgba(0, 0, 0, 0.03);
    }
  }

  &__toggle-label {
    font-size: 12px;
    font-weight: 500;
  }
}
</style>
