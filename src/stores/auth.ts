import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('stress_token'))
  const _rawUserInfo = localStorage.getItem('stress_userinfo')
  const userInfo = ref<UserInfo | null>(
    _rawUserInfo && _rawUserInfo !== 'undefined' ? JSON.parse(_rawUserInfo) : null
  )

  const isLoggedIn = computed(() => !!token.value)

  function login(newToken: string, info: UserInfo) {
    token.value = newToken
    userInfo.value = info
    localStorage.setItem('stress_token', newToken)
    localStorage.setItem('stress_userinfo', JSON.stringify(info))
  }

  function logout() {
    token.value = null
    userInfo.value = null
    localStorage.removeItem('stress_token')
    localStorage.removeItem('stress_userinfo')
  }

  return { token, userInfo, isLoggedIn, login, logout }
})
