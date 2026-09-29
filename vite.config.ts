import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import type { IncomingMessage } from 'http'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

function attachClientIP(proxy: any) {
  proxy.on('proxyReq', (proxyReq: any, req: IncomingMessage) => {
    const clientIP = normalizeProxyClientIP(req)
    if (!clientIP) return
    const prior = req.headers['x-forwarded-for']
    const xff = prior
      ? `${Array.isArray(prior) ? prior[0] : prior}, ${clientIP}`
      : clientIP
    proxyReq.setHeader('X-Forwarded-For', xff)
    proxyReq.setHeader('X-Real-IP', clientIP)
  })
}

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'sass',
        }),
      ],
      dts: 'src/components.d.ts',
    }),
    (monacoEditorPlugin as any).default({
      languageWorkers: ['editorWorkerService', 'typescript', 'json'],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: (content: string, filepath: string) => {
          if (filepath.includes('element-plus') || filepath.includes('node_modules')) {
            return content
          }
          return `@use "@/assets/styles/_global.scss" as *;\n${content}`
        },
      },
    },
  },
  optimizeDeps: {
    // 组件样式由 unplugin 在转换 SFC 时注入，依赖扫描扫不到。
    // 漏掉后预构建缓存被清掉，旧模块仍指向已删除文件，浏览器会一直拿到 504。
    include: [
      'element-plus/es/components/base/style/index',
      'element-plus/es/components/progress/style/index',
      'element-plus/es/components/button/style/index',
      'element-plus/es/components/icon/style/index',
      'element-plus/es/components/tag/style/index',
      'element-plus/es/components/dropdown/style/index',
      'element-plus/es/components/dropdown-menu/style/index',
      'element-plus/es/components/dropdown-item/style/index',
      'element-plus/es/components/radio-group/style/index',
      'element-plus/es/components/radio-button/style/index',
      'element-plus/es/components/input/style/index',
      'element-plus/es/components/input-number/style/index',
    ],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        configure: attachClientIP,
      },
    },
  },
})

function normalizeProxyClientIP(req: IncomingMessage): string {
  const raw = req.socket?.remoteAddress || ''
  if (!raw) return ''
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}
