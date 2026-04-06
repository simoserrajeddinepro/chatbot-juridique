import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/token': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: !!process.env.CHOKIDAR_USEPOLLING,
    },
  },
})
