import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/player.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  platform: 'neutral',
  treeshake: true,
  external: ['react', 'react-dom', 'sucrase', 'fflate', '@remotion/player'],
});
