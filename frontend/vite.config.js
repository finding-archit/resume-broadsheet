import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api to the FastAPI backend, so the browser talks to a
// single origin and no API URL needs configuring for local demos.
// If port 8000 is busy, run the backend elsewhere and set BACKEND_URL,
// e.g. BACKEND_URL=http://127.0.0.1:8010 npm run dev
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': BACKEND_URL,
    },
    // Sample job descriptions are imported from ../sample_data (single source of truth).
    fs: { allow: ['..'] },
  },
  preview: {
    port: 4173,
    proxy: { '/api': BACKEND_URL },
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) requires the function form.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/[\\/](recharts|d3-[a-z]+|victory-vendor)[\\/]/.test(id)) return 'charts'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
})
