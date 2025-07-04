import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import { nodeExternals } from 'rollup-plugin-node-externals'

export default defineConfig({
  // This is a library, so we don't want to bundle any dependencies nor minify.
  // Dev deps are included by default with the assumption they're needed for a library.
  // This is not the case for solit-html (truly are just dev deps), so we explicitly exclude them.
  plugins: [nodeExternals({ devDeps: true })],
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
