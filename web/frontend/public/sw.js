// sw.js — the app shell, cached so Tippani opens on a phone with no signal.
//
// WHAT IS CACHED: index.html, the files it names (the entry script and the
// stylesheet, read from the page at install), the manifest and the icons, and
// the hashed /assets/ files — fonts and lazily loaded chunks — the first time a
// page asks for them. A hashed name never changes its contents, so once cached
// it is never stale.
//
// WHAT IS NEVER CACHED: /api/. Every answer there is somebody's library or a live
// lookup, and a worker that kept one would show the reader yesterday's shelf.
// Anything else the server answers (covers, uploads, exports) is passed straight
// to the network.
//
// NOTHING RUNS ON A TIMER. The worker acts only on requests the page makes, the
// same rule the server keeps.

const SHELL = 'tippani-shell-1'
const SHELL_FILES = ['/', '/index.html', '/manifest.json', '/mark.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== SHELL).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

// precache reads the page the server gives now, so the entry script and stylesheet
// it names are the ones this install needs. Each file is added on its own: one that
// is missing must not stop the rest from being kept.
async function precache() {
  const cache = await caches.open(SHELL)
  const files = [...SHELL_FILES]
  try {
    const html = await (await fetch('/index.html', { cache: 'no-cache' })).clone().text()
    for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) files.push(m[1])
  } catch {
    // Offline at install: the shell files above still cover the next visit.
  }
  await Promise.allSettled(files.map((f) => cache.add(new Request(f, { cache: 'no-cache' }))))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkThenShell(request))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
  }
})

// A page is the network's when there is a network, and the cached shell when
// there is not: the client-side router answers every route from the same index.
async function networkThenShell(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(SHELL)
    return (await cache.match('/index.html')) || Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}
