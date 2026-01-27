import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-staticwebapp-config',
      closeBundle() {
        // Copy staticwebapp.config.json to dist after build
        const src = resolve(__dirname, 'staticwebapp.config.json')
        const dest = resolve(__dirname, 'dist', 'staticwebapp.config.json')
        copyFileSync(src, dest)
        console.log('✅ Copied staticwebapp.config.json to dist/')
      }
    }
  ],
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  }
})
