import { defineConfig } from 'vitest/config';

// Отдельный конфиг для «тяжёлых» e2e-тестов: они бандлят Remotion-проект
// и запускают реальный headless-браузер, поэтому не входят в `npm test`.
export default defineConfig({
  test: {
    include: ['render/**/*.e2e.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
