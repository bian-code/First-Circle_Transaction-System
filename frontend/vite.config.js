import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Optional proxy: forward /api calls to Spring Boot so you don't need CORS in dev
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    // Playwright owns everything under e2e/ (see playwright.config.js) — keep
    // Vitest's default file matching from also picking those specs up.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
