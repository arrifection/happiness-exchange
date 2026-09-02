import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function copyIndexTo404() {
  return {
    name: 'copy-index-to-404',
    closeBundle() {
      const indexPath = resolve(__dirname, 'dist/index.html')
      const notFoundPath = resolve(__dirname, 'dist/404.html')
      if (existsSync(indexPath)) {
        copyFileSync(indexPath, notFoundPath)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyIndexTo404()],
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        contact: resolve(__dirname, 'contact.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'vendor-maps'
          }
          if (
            id.includes('react-router')
            || id.includes('react-dom')
            || id.includes('/react/')
          ) {
            return 'vendor-react'
          }
          return undefined
        },
      },
    },
  },
})
