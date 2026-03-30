<template>
  <div class="app-layout">
    <SideBar :collapsed="layoutStore.sidebarCollapsed" @toggle="layoutStore.toggleSidebar" />
    <div class="app-layout__main" :class="{ 'sidebar-collapsed': layoutStore.sidebarCollapsed }">
      <TopBar />
      <main class="app-layout__content">
        <router-view v-slot="{ Component, route }">
          <keep-alive :include="cachedViews">
            <component :is="Component" :key="route.fullPath" />
          </keep-alive>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import SideBar from './SideBar.vue'
import TopBar from './TopBar.vue'
import { useLayoutStore } from '@/stores/layout'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const layoutStore = useLayoutStore()
const route = useRoute()

const cachedViews = computed(() => {
  return ['TaskListView', 'ScriptListView', 'ReportListView', 'WorkerListView']
})
route // suppress unused warning
cachedViews
</script>

<style lang="scss" scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: $bg-page;

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-left: $sidebar-width;
    transition: margin-left 0.25s ease;
    min-width: 0;

    &.sidebar-collapsed {
      margin-left: $sidebar-collapsed-width;
    }
  }

  &__content {
    flex: 1;
    padding: $content-padding;
    overflow-y: auto;
    min-height: calc(100vh - #{$topbar-height});
  }
}
</style>
