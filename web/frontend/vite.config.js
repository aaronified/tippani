import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Build output lands in ../dist, which the Go binary embeds (web/embed.go).
// `npm run dev` proxies API calls to a locally running tippani server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    proxy: Object.fromEntries(
      ['/auth', '/admin', '/books', '/annotations', '/movies', '/dialogues', '/import', '/export', '/search', '/genres', '/tags', '/covers', '/stats', '/metadata']
        .map((p) => [p, 'http://127.0.0.1:8080'])
    ),
  },
})
