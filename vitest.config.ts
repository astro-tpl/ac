import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    pool: 'forks', // 使用 forks 而不是 threads 来支持 process.chdir
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/index.ts'
      ]
    }
  }
})
