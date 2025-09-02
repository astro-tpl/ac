import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})