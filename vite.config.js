import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → dist/index.html: ONE self-contained file (scripts, styles and assets inlined).
// Open it straight from disk or upload it to any static host.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: { host: true, port: 5173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 3000, assetsInlineLimit: 100000000 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
