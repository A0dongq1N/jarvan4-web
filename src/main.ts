import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import '@/assets/styles/index.scss'
// 程序化 Toast（ElMessage / ElNotification / ElMessageBox）的样式，auto-import 不会自动带上
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/notification/style/css'
import 'element-plus/es/components/message-box/style/css'

// Setup mock in dev mode (disabled by VITE_USE_MOCK=false)
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'false') {
  const { setupMock } = await import('./mock/index')
  const request = (await import('./utils/request')).default
  setupMock(request)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
