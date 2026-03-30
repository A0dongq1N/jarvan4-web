<template>
  <div class="page-header">
    <div class="page-header__info">
      <div class="page-header__title">
        <el-icon v-if="back" class="page-header__back" @click="$router.back()">
          <ArrowLeft />
        </el-icon>
        <h2>{{ title }}</h2>
      </div>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div class="page-header__actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'

defineProps<{
  title: string
  subtitle?: string
  back?: boolean
}>()
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;

  &__info {
    flex: 1;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;

    h2 {
      font-size: 20px;
      font-weight: 600;
      color: $text-primary;
    }
  }

  &__back {
    cursor: pointer;
    color: $text-secondary;
    font-size: 20px;
    transition: color 0.2s;
    &:hover { color: $color-primary; }
  }

  &__subtitle {
    font-size: 13px;
    color: $text-secondary;
    margin-top: 4px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    margin-left: 16px;
  }
}
</style>
