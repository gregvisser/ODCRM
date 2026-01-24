import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@chakra-ui/react', '@chakra-ui/icons', '@emotion/react', '@emotion/styled'],
          utils: ['framer-motion', 'papaparse'],
        }
      }
    }
  }
})
