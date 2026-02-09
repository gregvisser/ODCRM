import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get Git SHA for build fingerprint
const getGitSHA = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(getGitSHA()),
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
