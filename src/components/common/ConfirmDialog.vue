<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="400px"
    :close-on-click-modal="false"
  >
    <div class="confirm-dialog__content">
      <el-icon class="confirm-dialog__icon" :class="`confirm-dialog__icon--${type}`" :size="40">
        <WarningFilled v-if="type === 'warning'" />
        <CircleCloseFilled v-else-if="type === 'danger'" />
        <InfoFilled v-else />
      </el-icon>
      <p class="confirm-dialog__message">{{ message }}</p>
    </div>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button :type="type === 'danger' ? 'danger' : 'primary'" :loading="loading" @click="handleConfirm">
        {{ confirmText || '确认' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { WarningFilled, CircleCloseFilled, InfoFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  title?: string
  message: string
  type?: 'warning' | 'danger' | 'info'
  confirmText?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const visible = defineModel<boolean>({ default: false })
const loading = ref(false)

function handleCancel() {
  visible.value = false
  emit('cancel')
}

async function handleConfirm() {
  emit('confirm')
  visible.value = false
}
</script>

<style lang="scss" scoped>
.confirm-dialog {
  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 8px 0 16px;
    gap: 12px;
  }

  &__icon {
    &--warning { color: $color-warning; }
    &--danger { color: $color-danger; }
    &--info { color: $color-primary; }
  }

  &__message {
    font-size: 14px;
    color: $text-regular;
    line-height: 1.6;
  }
}
</style>
