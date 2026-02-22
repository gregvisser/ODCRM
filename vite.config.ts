import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

// Get Git SHA for build fingerprint
const getGitSHA = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// Emit __build.json at build time for unauthenticated deploy verification
function buildInfoPlugin() {
  return {
    name: 'build-info',
    writeBundle(_options: { dir?: string }, _bundle: Record<string, unknown>) {
      const outDir = _options?.dir ?? 'dist'
      const outPath = path.resolve(process.cwd(), outDir, '__build.json')
      const payload = {
        sha: process.env.VITE_BUILD_SHA ?? 'unknown',
        time: process.env.VITE_BUILD_TIME ?? 'unknown',
        app: 'odcrm',
        env: process.env.MODE ?? 'production',
        version: 1,
      }
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify(payload, null, 0), 'utf8')
      console.log('  ✓ Emitted /__build.json')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    buildInfoPlugin(),
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
