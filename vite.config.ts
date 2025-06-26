import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import { externalizeDeps } from 'vite-plugin-externalize-deps'

// TODO: Clean up TS d files

export default defineConfig({
  plugins: [externalizeDeps()],
  server: {
    port: 5174,
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'solit-html',
      fileName: 'main',
    },
    minify: false,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
