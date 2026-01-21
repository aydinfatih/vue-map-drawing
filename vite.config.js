import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'VueMapDrawing',
      fileName: 'vue-map-drawing'
    },
    rollupOptions: {
      // Externalize Vue so it's not bundled
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})
