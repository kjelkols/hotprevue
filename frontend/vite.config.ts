import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

// Alle API-ruter proxyes til backend i dev-modus.
const API_ROUTES = [
  '/admin', '/collections', '/events', '/file-copy-operations',
  '/input-sessions', '/machines', '/photographers', '/photos', '/searches',
  '/settings', '/shortcuts', '/stats', '/system', '/tags',
  '/text-items', '/health', '/api',
]

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src'),
    },
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: Object.fromEntries(
      API_ROUTES.map(route => [route, { target: BACKEND, changeOrigin: true }])
    ),
  },
})
