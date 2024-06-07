import { resolve } from 'path'
import { defineConfig } from 'vite'

// TODO: Clean up TS d files

export default defineConfig({
  server: {
    port: 5174,
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SoLit',
      fileName: 'main',
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
