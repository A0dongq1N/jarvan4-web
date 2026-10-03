<template>
  <div class="account-view">
    <PageHeader title="用户信息" subtitle="查看身份和当前可以操作的功能" />

    <div class="account-card" v-loading="loading">
      <div class="account-card__title">身份信息</div>
      <div class="account-grid">
        <div>
          <div class="account-grid__label">用户名</div>
          <div>{{ profile?.username || '—' }}</div>
        </div>
        <div>
          <div class="account-grid__label">手机</div>
          <div>{{ profile?.phone || '未填写' }}</div>
        </div>
        <div>
          <div class="account-grid__label">注册时间</div>
          <div>{{ createdText }}</div>
        </div>
        <div>
          <div class="account-grid__label">账号状态</div>
          <div>{{ profile?.status === 'disabled' ? '已停用' : '正常' }}</div>
        </div>
      </div>
    </div>

    <div class="account-card">
      <div class="account-card__title">权限</div>
      <div class="perm-list">
        <div v-for="item in permissions" :key="item.key" class="perm-row">
          <span class="perm-row__mark" :class="item.allowed ? 'is-yes' : 'is-no'">
            {{ item.allowed ? '✓' : '×' }}
          </span>
          <span class="perm-row__label">{{ item.label }}</span>
          <el-button
            v-if="!item.allowed && canApply"
            size="small"
            :disabled="pending"
            @click="apply"
          >
            {{ pending ? '已申请，等待处理' : '申请' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import type { PermissionItem } from '@/utils/permissions'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/common/PageHeader.vue'

interface Profile {
  username: string
  phone: string
  status: string
  createdAt: string
  permissions: PermissionItem[]
  applicationPending: boolean
}

const authStore = useAuthStore()
const loading = ref(false)
const profile = ref<Profile | null>(null)
const pending = ref(false)

const permissions = computed(() => profile.value?.permissions ?? [])
const canApply = computed(() => authStore.userInfo?.role !== 'admin' && permissions.value.some((item) => !item.allowed))
const createdText = computed(() => {
  if (!profile.value?.createdAt) return '—'
  return profile.value.createdAt.replace('T', ' ').slice(0, 16)
})

async function load() {
  loading.value = true
  try {
    const res = await request.get('/me')
    if (res.data.code !== 0) throw new Error(res.data.message)
    profile.value = res.data.data
    pending.value = !!res.data.data.applicationPending
  } catch (e: any) {
    ElMessage.error(e?.message || '加载用户信息失败')
  } finally {
    loading.value = false
  }
}

async function apply() {
  try {
    const res = await request.post('/me/applications', {})
    if (res.data.code !== 0) throw new Error(res.data.message)
    pending.value = true
    ElMessage.success('已提交申请')
  } catch (e: any) {
    ElMessage.error(e?.message || '申请失败')
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.account-card {
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: 20px 24px;
  margin-bottom: 16px;

  &__title {
    font-weight: 600;
    margin-bottom: 16px;
  }
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;

  &__label {
    color: $text-secondary;
    font-size: 12px;
    margin-bottom: 4px;
  }
}

.perm-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid $border-color-light;

  &__mark {
    width: 22px;
    text-align: center;
    font-weight: 700;
  }

  &__label {
    flex: 1;
  }
}

.is-yes { color: $color-success; }
.is-no { color: $color-danger; }
</style>
