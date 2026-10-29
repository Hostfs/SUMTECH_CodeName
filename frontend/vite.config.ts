import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중에는 Spring(3000)으로 API를 넘긴다. 배포·docker에서는 Spring이 빌드 결과를 같은 주소에서 제공한다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/__health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
})
