// routes.js — the URL contract, and the three shell controls derived from it.
//
// Lifted out of App.jsx unchanged. These are pure functions of (tab, detail)
// and a pathname, they are the definition of what every link in the app means,
// and they were the only part of the shell that could be reasoned about without
// rendering it. Keeping them here rather than a thousand lines into the
// component makes them testable without loading React, and keeps the three
// context-aware top-bar controls next to the routing table they read from.

// The tabs whose URL is just their own name. Anything with a different slug, a
// detail id, or a legacy alias is spelled out in parsePath/statePath below.
export const ROUTE_TABS = ['search', 'tags', 'metadata', 'stats', 'settings', 'staging']

// workID reads the id segment of a detail path, or null when it is not one.
// Guarding on Number.isInteger rather than truthiness is the difference between
// /books/abc landing on Home and it opening a detail view for work NaN — which
// fetches /books/NaN and renders an error screen, the exact "blank screen"
// outcome the unknown-path fallback below exists to prevent.
function workID(seg) {
  if (!seg) return null
  const n = Number(seg)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function parsePath(pathname) {
  const [a, b] = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  // "/" is the Home screen (daily review); unknown paths land there too.
  if (!a) return { tab: 'home', detail: null }
  if (a === 'books' && workID(b)) return { tab: 'library', detail: { type: 'book', id: workID(b) } }
  // The catalogue tab's canonical URL is /catalogue (matching its label); /movies
  // is still accepted so old links/bookmarks keep working.
  if ((a === 'catalogue' || a === 'movies') && workID(b)) return { tab: 'movies', detail: { type: 'movie', id: workID(b) } }
  if (a === 'library') return { tab: 'library', detail: null }
  // A work prefix carrying an unusable id falls back to THAT side's list rather
  // than Home: you asked for something in the library, so the library is a
  // better answer than the front page. /catalogue and /movies reach their list
  // on the line below anyway; /books needs saying, because the book list lives
  // at /library and would otherwise fall through to Home.
  if (a === 'books') return { tab: 'library', detail: null }
  if (a === 'movies' || a === 'catalogue') return { tab: 'movies', detail: null }
  // /import is no longer a tab (§7 One "＋ Add"); an old link opens the Add
  // surface on its Import section over Home — handled by the Shell.
  if (a === 'import') return { tab: 'import', detail: null }
  if (a === 'pending') return { tab: 'staging', detail: null }
  if (ROUTE_TABS.includes(a)) return { tab: a, detail: null }
  return { tab: 'home', detail: null }
}

export function statePath(tab, detail) {
  if (detail?.type === 'book') return `/books/${detail.id}`
  if (detail?.type === 'movie') return `/catalogue/${detail.id}`
  if (tab === 'home') return '/'
  if (tab === 'library') return '/library'
  if (tab === 'movies') return '/catalogue'
  if (tab === 'staging') return '/pending'
  return `/${tab}`
}

// ---- what the shell's three context-aware controls read off the route ----
// One Add, one Search and one Help live in the top bar, and each of them means
// something slightly different depending on where you are. Deriving all three
// from (tab, detail) in one place keeps the three from disagreeing — and keeps
// the answer next to the routing table it is derived from.

// helpScreen — which help.jsx entry the top bar's "?" opens.
export function helpScreen(tab, detail) {
  if (detail?.type === 'book') return 'book-detail'
  if (detail?.type === 'movie') return 'movie-detail'
  return tab
}

// addSection — which section the ＋ opens on. A list page offers the kind of
// thing that list holds; a work you have open offers a quote against it (the
// Shell pairs this with `addFor`, the target), because on a book's own page "add"
// means a highlight, not another book. Everywhere else it is the plain look-up card.
export function addSection(tab, detail) {
  if (detail) return 'quote'
  if (tab === 'movies') return 'film'
  return 'book'
}

// searchScope — what the top bar's Search lands pre-filtered to. SearchPage
// persists its own scope, so this writes the same key it reads.
export function searchScope(tab, detail) {
  if (tab === 'library' || detail?.type === 'book') return 'books'
  if (tab === 'movies' || detail?.type === 'movie') return 'movies'
  return 'all'
}
