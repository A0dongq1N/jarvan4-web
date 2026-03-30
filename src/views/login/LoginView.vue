<template>
  <div class="login-page">
    <!-- Left Panel -->
    <div class="login-page__left">
      <div class="login-page__brand">
        <div class="login-page__logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="white" fill-opacity="0.2"/>
            <path d="M12 24h24M24 12v24" stroke="white" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="brand-title login-page__title">压测平台</h1>
        <p class="login-page__subtitle">高性能分布式压力测试平台</p>
      </div>
      <div class="login-page__features">
        <div class="feature-item">
          <span class="feature-item__icon">⚡</span>
          <span>实时监控，毫秒级指标采集</span>
        </div>
        <div class="feature-item">
          <span class="feature-item__icon">📊</span>
          <span>多维度报告，深度性能分析</span>
        </div>
        <div class="feature-item">
          <span class="feature-item__icon">🔧</span>
          <span>Go 脚本引擎，灵活扩展</span>
        </div>
      </div>
    </div>

    <!-- Right Panel -->
    <div class="login-page__right">
      <div class="login-form-wrapper">
        <h2 class="login-form__title">欢迎回来</h2>
        <p class="login-form__subtitle">请登录您的账号</p>

        <!-- 登录方式 Tab -->
        <div class="login-tabs">
          <button
            class="login-tab"
            :class="{ 'login-tab--active': activeTab === 'password' }"
            @click="switchTab('password')"
          >账号密码</button>
          <button
            class="login-tab"
            :class="{ 'login-tab--active': activeTab === 'sms' }"
            @click="switchTab('sms')"
          >手机验证码</button>
          <div class="login-tab__indicator" :class="`login-tab__indicator--${activeTab}`" />
        </div>

        <!-- 账号密码表单 -->
        <el-form
          v-show="activeTab === 'password'"
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          class="login-form"
          @submit.prevent="handlePasswordLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="passwordForm.username"
              placeholder="用户名"
              size="large"
              :prefix-icon="User"
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="passwordForm.password"
              type="password"
              placeholder="密码"
              size="large"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handlePasswordLogin"
            />
          </el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-form__btn"
            @click="handlePasswordLogin"
          >
            登录
          </el-button>
        </el-form>

        <!-- 手机验证码表单 -->
        <el-form
          v-show="activeTab === 'sms'"
          ref="smsFormRef"
          :model="smsForm"
          :rules="smsRules"
          class="login-form"
          @submit.prevent="handleSmsLogin"
        >
          <el-form-item prop="phone">
            <el-input
              v-model="smsForm.phone"
              placeholder="请输入手机号"
              size="large"
              :prefix-icon="Phone"
              maxlength="11"
            />
          </el-form-item>
          <el-form-item prop="code">
            <div class="sms-code-row">
              <el-input
                v-model="smsForm.code"
                placeholder="请输入验证码"
                size="large"
                :prefix-icon="Key"
                maxlength="6"
                @keyup.enter="handleSmsLogin"
              />
              <el-button
                class="sms-code-btn"
                size="large"
                :disabled="smsCounting || !smsForm.phone"
                @click="handleSendCode"
              >
                {{ smsCounting ? `${smsCountdown}s 后重发` : '获取验证码' }}
              </el-button>
            </div>
          </el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-form__btn"
            @click="handleSmsLogin"
          >
            登录
          </el-button>
        </el-form>

        <div class="login-form__hint">
          <el-text v-if="activeTab === 'password'" type="info" size="small">
            测试账号：admin / admin123
          </el-text>
          <el-text v-else type="info" size="small">
            测试验证码：123456（任意手机号）
          </el-text>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock, Phone, Key } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import request from '@/utils/request'

const router = useRouter()
const authStore = useAuthStore()

// ── Tab 状态 ────────────────────────────────────────────────────
const activeTab = ref<'password' | 'sms'>('password')

function switchTab(tab: 'password' | 'sms') {
  activeTab.value = tab
}

// ── 通用 ─────────────────────────────────────────────────────────
const loading = ref(false)

// ── 账号密码登录 ──────────────────────────────────────────────────
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({ username: 'admin', password: 'admin123' })

const passwordRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handlePasswordLogin() {
  if (!passwordFormRef.value) return
  const valid = await passwordFormRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await request.post('/auth/login', passwordForm)
    if (res.data.code !== 0) throw new Error(res.data.message)
    const { token, userInfo } = res.data.data
    authStore.login(token, userInfo)
    ElMessage.success('登录成功')
    await router.push('/project')
  } catch (e: any) {
    ElMessage.error(e?.message || e?.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}

// ── 手机验证码登录 ────────────────────────────────────────────────
const smsFormRef = ref<FormInstance>()
const smsForm = reactive({ phone: '', code: '' })

const phoneRegex = /^1[3-9]\d{9}$/
const smsRules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: phoneRegex, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' },
  ],
}

// 倒计时
const smsCounting = ref(false)
const smsCountdown = ref(60)
let countdownTimer: ReturnType<typeof setInterval> | null = null

async function handleSendCode() {
  if (!phoneRegex.test(smsForm.phone)) {
    ElMessage.warning('请输入正确的手机号')
    return
  }
  try {
    const res = await request.post('/auth/sms/send', { phone: smsForm.phone })
    if (res.data.code !== 0) throw new Error(res.data.message)
    ElMessage.success('验证码已发送')
    startCountdown()
  } catch (e: any) {
    ElMessage.error(e?.message || '发送失败，请稍后重试')
  }
}

function startCountdown() {
  smsCounting.value = true
  smsCountdown.value = 60
  countdownTimer = setInterval(() => {
    smsCountdown.value--
    if (smsCountdown.value <= 0) {
      smsCounting.value = false
      if (countdownTimer) clearInterval(countdownTimer)
    }
  }, 1000)
}

async function handleSmsLogin() {
  if (!smsFormRef.value) return
  const valid = await smsFormRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await request.post('/auth/login/sms', smsForm)
    if (res.data.code !== 0) throw new Error(res.data.message)
    const { token, userInfo } = res.data.data
    authStore.login(token, userInfo)
    ElMessage.success('登录成功')
    await router.push('/project')
  } catch (e: any) {
    ElMessage.error(e?.message || e?.response?.data?.message || '验证码错误或已过期')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;

  @include breakpoint('sm') {
    grid-template-columns: 1fr;
  }

  &__left {
    background: #1c2333;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 60px;
    color: white;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -80px;
      left: -80px;
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(56,113,220,0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    &::after {
      content: '';
      position: absolute;
      bottom: -60px;
      right: -60px;
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(27,133,94,0.2) 0%, transparent 70%);
      pointer-events: none;
    }

    @include breakpoint('sm') {
      display: none;
    }
  }

  &__brand {
    margin-bottom: 60px;
  }

  &__logo {
    margin-bottom: 20px;
  }

  &__title {
    font-size: 36px;
    color: white;
    margin-bottom: 12px;
  }

  &__subtitle {
    font-size: 16px;
    opacity: 0.8;
  }

  &__features {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__right {
    display: flex;
    align-items: center;
    justify-content: center;
    background: $bg-page;
    padding: 40px;
  }
}

.login-form-wrapper {
  width: 100%;
  max-width: 380px;
}

// ── Tab 切换 ──────────────────────────────────────────────────────
.login-tabs {
  position: relative;
  display: flex;
  gap: 0;
  margin-bottom: 28px;
  border-bottom: 2px solid $border-color-light;
}

.login-tab {
  flex: 1;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 500;
  color: $text-secondary;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  position: relative;

  &--active {
    color: $color-primary;
    font-weight: 600;
  }

  &:hover:not(&--active) {
    color: $text-regular;
  }
}

.login-tab__indicator {
  position: absolute;
  bottom: -2px;
  height: 2px;
  width: 50%;
  background: $color-primary;
  border-radius: 2px 2px 0 0;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &--password { left: 0; }
  &--sms      { left: 50%; }
}

// ── 表单 ─────────────────────────────────────────────────────────
.login-form {
  &__title {
    font-size: 28px;
    font-weight: 700;
    color: $text-primary;
    margin-bottom: 8px;
  }

  &__subtitle {
    color: $text-secondary;
    margin-bottom: 32px;
    font-size: 14px;
  }

  &__btn {
    width: 100%;
    height: 48px;
    font-size: 16px;
    margin-top: 8px;
  }

  &__hint {
    text-align: center;
    margin-top: 20px;
  }
}

// ── 验证码行 ──────────────────────────────────────────────────────
.sms-code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.sms-code-btn {
  flex-shrink: 0;
  width: 126px;
  font-size: 13px;
  white-space: nowrap;
}

// ── 特性列表 ──────────────────────────────────────────────────────
.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  opacity: 0.9;

  &__icon {
    font-size: 20px;
    width: 32px;
    text-align: center;
  }
}

:deep(.el-input__wrapper) {
  height: 44px;
}
</style>
