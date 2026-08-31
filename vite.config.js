import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// API 后端地址从 .env.development / .env.production 的 VITE_API_BASE 读取
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_BASE = env.VITE_API_BASE || 'http://127.0.0.1:8000'

  return {
    plugins: [vue()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: API_BASE,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    preview: {
      port: 4173,
      host: true,
      proxy: {
        '/api': {
          target: API_BASE,
          changeOrigin: true,
        },
      },
    },
  }
})
