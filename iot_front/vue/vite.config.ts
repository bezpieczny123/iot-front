import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['NODE_RED_URL', 'VITE_WS_PATH'])
  const path = env.VITE_WS_PATH || '/ws/serverroom'
  const proxy = env.NODE_RED_URL && path.startsWith('/') && !path.startsWith('//')
    ? { [path]: { target: env.NODE_RED_URL, changeOrigin: true, ws: true } }
    : undefined
  return {
    base: './',
    plugins: [vue()],
    server: { proxy },
    preview: { proxy },
  }
})
