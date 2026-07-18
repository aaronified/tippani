import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Build output lands in ../dist, which the Go binary embeds (web/embed.go).
// `npm run dev` proxies API calls to a locally running tippani server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    // The whole REST API is mounted under /api (api.js prefixes every call),
    // so one proxy entry covers it. TIPPANI_DEV_API overrides the target when
    // the local server runs on a non-default port.
    proxy: { '/api': process.env.TIPPANI_DEV_API || 'http://127.0.0.1:8080' },
  },
})
