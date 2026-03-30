<template>
  <div class="empty-state">
    <el-icon class="empty-state__icon" :size="64">
      <component :is="icon || 'FolderOpened'" />
    </el-icon>
    <p class="empty-state__title">{{ title || '暂无数据' }}</p>
    <p v-if="desc" class="empty-state__desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { FolderOpened } from '@element-plus/icons-vue'

defineProps<{
  title?: string
  desc?: string
  icon?: string
}>()
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  color: $text-secondary;

  &__icon {
    color: $border-color;
    margin-bottom: 16px;
  }

  &__title {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  &__desc {
    font-size: 13px;
    text-align: center;
    max-width: 360px;
  }
}
</style>
