import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import type { IncomingMessage } from 'http'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

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
        // silentCompilerWarnings suppresses deprecation warnings for @import
        // silentCompilerWarnings: true,
        // We use a single _global.scss that only contains variables and mixins
        // This file is injected into EVERY .vue style block
        additionalData: (content: string, filepath: string) => {
          // Skip element-plus internal files to avoid double @use issues
          if (filepath.includes('element-plus') || filepath.includes('node_modules')) {
            return content
          }
          return `@use "@/assets/styles/_global.scss" as *;\n${content}`
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const clientIP = normalizeProxyClientIP(req as IncomingMessage)
            if (!clientIP) return

            const prior = req.headers['x-forwarded-for']
            const xff = prior
              ? `${Array.isArray(prior) ? prior[0] : prior}, ${clientIP}`
              : clientIP
            proxyReq.setHeader('X-Forwarded-For', xff)
            proxyReq.setHeader('X-Real-IP', clientIP)
          })
        },
      },
    },
  },
})

function normalizeProxyClientIP(req: IncomingMessage): string {
  const raw = req.socket?.remoteAddress || ''
  if (!raw) return ''
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  if (raw === '::1') return '127.0.0.1'
  return raw
}
