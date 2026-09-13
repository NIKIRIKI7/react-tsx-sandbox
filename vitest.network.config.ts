import { defineConfig } from 'vitest/config';

// Сетевые тесты: реально скачивают библиотеки с CDN (esm.sh).
// Вынесены из `npm test`, чтобы юнит-прогон оставался офлайн.
export default defineConfig({
  test: {
    include: ['src/**/*.network.spec.ts'],
    environment: 'node',
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
