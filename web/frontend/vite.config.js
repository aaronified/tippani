import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Build output lands in ../dist, which the Go binary embeds (web/embed.go).
// `npm run dev` proxies API calls to a locally running tippani server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // React changes on its own schedule and the app changes on every commit.
        // In one chunk they share a cache entry, so a one-line fix re-downloads the
        // framework with it. Split, the framework stays cached across releases.
        manualChunks: (id) =>
          id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react/') || id.includes('/node_modules/scheduler/')
            ? 'react'
            : undefined,
      },
    },
  },
  server: {
    // The whole REST API is mounted under /api (api.js prefixes every call),
    // so one proxy entry covers it. TIPPANI_DEV_API overrides the target when
    // the local server runs on a non-default port.
    proxy: { '/api': process.env.TIPPANI_DEV_API || 'http://127.0.0.1:8080' },
    // src/i18n.js imports internal/i18n/*.txt with `?raw` — the canonical
    // locale files, which live in a Go package because //go:embed cannot reach
    // outside its own directory and Vite can reach anywhere. The dev server
    // refuses to serve a file outside its allowlist, which defaults to a DETECTED
    // workspace root; naming the repository root removes the detection from the
    // loop. vitest.config.js says the same thing, for the same import.
    fs: { allow: [join(dirname(fileURLToPath(import.meta.url)), '..', '..')] },
  },
})
