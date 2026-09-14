import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));

// Multi-page demo: index.html (Player) + studio.html (Studio).
export default defineConfig({
  server: {
    fs: {
      // Разрешить Vite отдавать локальные файлы по абсолютному пути (`/@fs/C:/...`),
      // чтобы медиа-сцены с путями `C:\...` работали без блокировки браузера.
      strict: false,
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: page('index.html'),
        studio: page('studio.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('sucrase')) return 'vendor-sucrase';
          if (id.includes('remotion') && id.includes('player')) return 'vendor-remotion-player';
          if (id.includes('remotion')) return 'vendor-remotion-core';
          if (id.includes('lucide')) return 'vendor-lucide';
          if (id.includes('react')) return 'vendor-react';
          return 'vendor-utils';
        },
      },
    },
    onwarn(warning, warn) {
      if (typeof warning === 'object' && warning.message.includes('"use client"')) return;
      warn(warning);
    },
  },
});