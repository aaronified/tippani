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
//
// `bin` IS A ROUTE AND NOT A NAV TAB, and the asymmetry is the point. Nothing
// about the bin is a place you go: it is a place you are sent, by the tile in
// Settings or by an Undo that expired before you noticed it. A ninth entry in the
// strip for "things you have deleted" would put a permanent invitation to browse
// your deletions beside Library and Stats. But it is a real page rather than a
// modal, so it bookmarks and survives a refresh — which is what a route buys and
// a nav entry does not. The nav contract in routes.test.js runs one way only:
// every nav tab must have a URL; a URL is free not to be a tab.
export const ROUTE_TABS = ['search', 'quotes', 'tags', 'metadata', 'stats', 'settings', 'staging', 'bin']

// ---- the nav contract ----
//
// Four lists put a tab in front of you, and four is the right number because
// the surfaces genuinely differ: the desktop strip splits content from tools,
// the phone's bottom bar holds only what a thumb should reach, and the drawer
// is the one place that has to hold everything.
//
// They live here, next to the routing table, because they are the same
// contract seen from the other end — ROUTE_TABS says a tab has a URL, these say
// you can get to it — and because four hand-maintained lists of the same keys
// is a shape that only stays correct if something checks it.
//
// Nothing did. 1.5.0 added Quotes to CONTENT_TABS and BOTTOM_TABS and missed
// DRAWER_TABS, so on a phone the tab existed, routed, held data and appeared in
// the bottom bar, while the ☰ menu — the one surface that is supposed to list
// everything — did not mention it. routes.test.js now asserts the invariant.
//
// The third element of a strip/bar row is the hover label: those two collapse
// to icon-only, so each tab has to be able to name itself. Five words or fewer,
// like every other label. Drawer rows always show their words and need none.

// CONTENT_TABS / UTILITY_TABS — the desktop strip, content then tools.
export const CONTENT_TABS = [
  ['home', 'Home', "Today's review"],
  ['library', 'Library', 'Your books'],
  ['movies', 'Catalogue', 'Your films and shows'],
  ['quotes', 'Quotes', 'Lines from anywhere else'],
]
export const UTILITY_TABS = [
  ['tags', 'Tags', 'Tags and stickers'],
  ['metadata', 'Metadata', 'Covers, people and duplicates'],
  ['stats', 'Stats', 'Calendar, memory, breakdowns'],
  ['settings', 'Settings', 'Appearance, keys, backups'],
]

// DRAWER_TABS — the ☰ menu. null is the divider between the primary screens and
// the utility group. Search leads, directly below the ＋ Add row.
export const DRAWER_TABS = [
  ['search', 'Search'],
  ['home', 'Home'],
  ['library', 'Library'],
  ['movies', 'Catalogue'],
  ['quotes', 'Quotes'],
  null,
  ['tags', 'Tags'],
  ['metadata', 'Metadata'],
  ['stats', 'Stats'],
  ['settings', 'Settings'],
]

// BOTTOM_TABS — the floating phone nav. Content screens only: the drawer owns
// the utility tabs, ＋ Add and the account rows. Search is not here because the
// phone's top bar has carried it since 1.4.1.
export const BOTTOM_TABS = [
  ['home', 'Home', "Go home to today's review"],
  ['library', 'Library', 'Open your book library'],
  ['movies', 'Catalogue', 'Open your film catalogue'],
  ['quotes', 'Quotes', 'Open your standalone quotes'],
]

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
  // A board's own page (0036). /quotes lists the boards the way /library lists
  // books, and a board opens at /quotes/{id} the way a book opens at /books/{id}.
  // 'all' is the pinned All quotes entry rather than a board — it is not a row,
  // so it has no id, and giving it the word keeps it bookmarkable like the rest.
  if (a === 'quotes' && b === 'all') return { tab: 'quotes', detail: { type: 'board', id: 'all' } }
  if (a === 'quotes' && workID(b)) return { tab: 'quotes', detail: { type: 'board', id: workID(b) } }
  if (a === 'movies' || a === 'catalogue') return { tab: 'movies', detail: null }
  // /import is no longer a tab (§7 One "＋ Add"); an old link opens the Add
  // surface on its Import section over Home — handled by the Shell.
  //
  // /capture is the same trick for the other section, and it exists for the
  // installed app's icon shortcut: a long press on the icon has to name a URL, and
  // "capture a quote" is a surface rather than a screen. Neither is a tab, and
  // neither is written back to the bar — the Shell swaps both for Home and opens
  // the surface over it, so the URL you land on is the one you stay on.
  if (a === 'import') return { tab: 'import', detail: null }
  if (a === 'capture') return { tab: 'capture', detail: null }
  if (a === 'pending') return { tab: 'staging', detail: null }
  if (ROUTE_TABS.includes(a)) return { tab: a, detail: null }
  return { tab: 'home', detail: null }
}

export function statePath(tab, detail) {
  if (detail?.type === 'book') return `/books/${detail.id}`
  if (detail?.type === 'movie') return `/catalogue/${detail.id}`
  if (detail?.type === 'board') return `/quotes/${detail.id}`
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
  // The Quotes list holds quotes belonging to nothing, so ＋ there means one of
  // those — not a book, and not a highlight against a work you do not have open.
  if (tab === 'quotes') return 'standalone'
  return 'book'
}

// searchScope — what the top bar's Search lands pre-filtered to. SearchPage
// persists its own scope, so this writes the same key it reads.
export function searchScope(tab, detail) {
  if (tab === 'library' || detail?.type === 'book') return 'books'
  if (tab === 'movies' || detail?.type === 'movie') return 'movies'
  if (tab === 'quotes') return 'quotes'
  return 'all'
}
