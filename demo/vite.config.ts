import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));

// Multi-page demo: index.html (Player) + studio.html (Studio).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: page('index.html'),
        studio: page('studio.html'),
      },
    },
  },
});
