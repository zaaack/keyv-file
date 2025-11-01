import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 测试配置
    globals: true,
    environment: 'node', // 或 'jsdom' for 浏览器环境
  },
})
