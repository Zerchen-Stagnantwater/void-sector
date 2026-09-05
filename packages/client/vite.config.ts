import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: '.',
  base: './',

  resolve: {
    alias: {
      // Absolute path so Vite finds shared regardless of cwd
      '@void-sector/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
    // Resolve .js imports as .ts — needed for Node16-style module imports
    // e.g. import './foo.js' finds 'src/foo.ts'
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },

  build: {
    outDir:      'dist',
    emptyOutDir: true,
    target:      'es2022',
    rollupOptions: {
      input: './index.html',
    },
  },

  server: {
    port: 3000,
    open: false,
  },
});
