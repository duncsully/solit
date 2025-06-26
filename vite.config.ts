import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// TODO: Clean up TS d files

export default defineConfig({
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
