import { resolve } from 'path'

// TODO: Clean up TS d files

export default {
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
}
