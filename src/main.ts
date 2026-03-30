import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import '@/assets/styles/index.scss'

// Setup mock in dev mode
if (import.meta.env.DEV) {
  const { setupMock } = await import('./mock/index')
  const request = (await import('./utils/request')).default
  setupMock(request)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
