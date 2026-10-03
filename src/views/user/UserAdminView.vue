<template>
  <div class="user-admin-view">
    <PageHeader title="用户管理" subtitle="审批权限申请，调整角色、停用或恢复账号" />

    <div class="panel">
      <div class="panel__title">待审批</div>
      <el-table :data="applications" empty-text="没有待处理的申请">
        <el-table-column label="用户" prop="username" />
        <el-table-column label="提交时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="review(row.id, 'approve')">通过</el-button>
            <el-button size="small" @click="review(row.id, 'reject')">拒绝</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="panel">
      <div class="panel__title">全部用户</div>
      <div class="user-table">
        <div class="user-table__row user-table__head">
          <div>用户名</div>
          <div>角色</div>
          <div class="user-table__center">状态</div>
          <div class="user-table__center">操作</div>
        </div>
        <div v-if="users.length === 0" class="user-table__empty">暂无用户</div>
        <div v-for="row in users" :key="row.id" class="user-table__row">
          <div class="user-table__name" :title="row.username">{{ row.username }}</div>
          <div>
            <el-select
              :model-value="row.role"
              size="small"
              class="role-select"
              :disabled="roleSavingId === row.id"
              @change="(role: AppRole) => onRoleChange(row, role)"
            >
              <el-option
                v-for="opt in roleOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="user-table__center">
            {{ row.status === 'disabled' ? '已停用' : '正常' }}
          </div>
          <div class="user-table__center">
            <el-button
              v-if="row.status === 'disabled'"
              size="small"
              type="primary"
              plain
              @click="setStatus(row.id, 'active')"
            >启用</el-button>
            <el-button
              v-else
              size="small"
              type="danger"
              plain
              @click="setStatus(row.id, 'disabled')"
            >停用</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { roleLabel, type AppRole } from '@/utils/permissions'
import PageHeader from '@/components/common/PageHeader.vue'

interface UserRow {
  id: string
  username: string
  role: AppRole
  status: 'active' | 'disabled'
}

interface ApplicationRow {
  id: string
  username: string
  createdAt: string
}

const users = ref<UserRow[]>([])
const applications = ref<ApplicationRow[]>([])
const roleSavingId = ref('')

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'viewer', label: roleLabel.viewer },
  { value: 'operator', label: roleLabel.operator },
  { value: 'admin', label: roleLabel.admin },
]

function formatTime(value: string) {
  return value.replace('T', ' ').slice(0, 16)
}

async function load() {
  const res = await request.get('/users')
  if (res.data.code !== 0) throw new Error(res.data.message)
  users.value = res.data.data.list
  applications.value = res.data.data.applications
}

async function review(id: string, action: 'approve' | 'reject') {
  try {
    const res = await request.post(`/users/applications/${id}/${action}`)
    if (res.data.code !== 0) throw new Error(res.data.message)
    ElMessage.success(action === 'approve' ? '已通过，权限已提升一级' : '已拒绝')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
  }
}

async function onRoleChange(row: UserRow, role: AppRole) {
  if (role === row.role) return
  roleSavingId.value = row.id
  try {
    const res = await request.put(`/users/${row.id}`, { role })
    if (res.data.code !== 0) throw new Error(res.data.message)
    row.role = role
    ElMessage.success(`已设为${roleLabel[role]}`)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
    await load()
  } finally {
    roleSavingId.value = ''
  }
}

async function setStatus(id: string, status: 'active' | 'disabled') {
  try {
    const res = await request.put(`/users/${id}`, { status })
    if (res.data.code !== 0) throw new Error(res.data.message)
    ElMessage.success(status === 'active' ? '账号已恢复' : '账号已停用')
    await load()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '操作失败')
  }
}

onMounted(() => {
  load().catch((e) => ElMessage.error(e?.message || '加载失败'))
})
</script>

<style lang="scss" scoped>
.panel {
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: 16px 20px 8px;
  margin-bottom: 16px;

  &__title {
    font-weight: 600;
    margin-bottom: 12px;
  }
}

.role-select {
  width: 100%;
  max-width: 200px;
}

.user-table {
  width: 100%;
  font-size: 14px;
  color: $text-primary;

  &__row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: 16px;
    align-items: center;
    min-height: 48px;
    padding: 0 12px;
    border-bottom: 1px solid $border-color-light;
  }

  &__head {
    min-height: 40px;
    font-weight: 600;
    color: $text-secondary;
    background: $bg-page;
    border-bottom: 1px solid $border-color-light;
  }

  &__row:not(&__head):hover {
    background: rgba(0, 0, 0, 0.02);
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__center {
    text-align: center;
  }

  &__empty {
    padding: 32px 12px;
    text-align: center;
    color: $text-secondary;
  }
}
</style>
