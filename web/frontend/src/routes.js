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
// `cleanup` is the second of those, and for the same reasons: Stray marks is a
// worklist you are sent to when something reads oddly, its only door is a tile in
// Settings, and a permanent tab for "possible mistakes in your quotes" would be a
// standing invitation to worry.
export const ROUTE_TABS = ['search', 'quotes', 'anthologies', 'tags', 'metadata', 'stats', 'settings', 'staging', 'bin', 'cleanup']

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
//
// THE ROWS HOLD KEYS RATHER THAN WORDS, and they have to: this module is
// evaluated at import, which is before the reader's language is known, so a word
// baked in here would be the one word in the app that never changed. The shell
// resolves each row through t() as it draws it. Four lists naming the same tab
// now name the same KEY, which is the invariant one layer down.

// CONTENT_TABS / UTILITY_TABS — the desktop strip, content then tools.
export const CONTENT_TABS = [
  ['home', 'nav.tab.home.label', 'nav.tab.home.tip'],
  ['library', 'nav.tab.library.label', 'nav.tab.library.tip'],
  ['movies', 'nav.tab.movies.label', 'nav.tab.movies.tip'],
  ['quotes', 'nav.tab.quotes.label', 'nav.tab.quotes.tip'],
  ['anthologies', 'nav.tab.anthologies.label', 'nav.tab.anthologies.tip'],
]
export const UTILITY_TABS = [
  ['tags', 'nav.tab.tags.label', 'nav.tab.tags.tip'],
  ['metadata', 'nav.tab.metadata.label', 'nav.tab.metadata.tip'],
  ['stats', 'nav.tab.stats.label', 'nav.tab.stats.tip'],
  ['settings', 'nav.tab.settings.label', 'nav.tab.settings.tip'],
]

// DRAWER_TABS — the ☰ menu. null is the divider between the primary screens and
// the utility group. Search leads, directly below the ＋ Add row.
export const DRAWER_TABS = [
  ['search', 'nav.tab.search.label'],
  ['home', 'nav.tab.home.label'],
  ['library', 'nav.tab.library.label'],
  ['movies', 'nav.tab.movies.label'],
  ['quotes', 'nav.tab.quotes.label'],
  ['anthologies', 'nav.tab.anthologies.label'],
  null,
  ['tags', 'nav.tab.tags.label'],
  ['metadata', 'nav.tab.metadata.label'],
  ['stats', 'nav.tab.stats.label'],
  ['settings', 'nav.tab.settings.label'],
]

// BOTTOM_TABS — the floating phone nav. Content screens only: the drawer owns
// the utility tabs, ＋ Add and the account rows. Search is not here because the
// phone's top bar has carried it since 1.4.1.
export const BOTTOM_TABS = [
  ['home', 'nav.tab.home.label', 'nav.bottom.home.aria'],
  ['library', 'nav.tab.library.label', 'nav.bottom.library.aria'],
  ['movies', 'nav.tab.movies.label', 'nav.bottom.movies.aria'],
  ['quotes', 'nav.tab.quotes.label', 'nav.bottom.quotes.aria'],
  ['anthologies', 'nav.tab.anthologies.label', 'nav.bottom.anthologies.aria'],
]

// ---- the sections a reader can turn off ----
//
// Settings → Features hides a whole section of the app. HIDING IS COSMETIC, and
// the URL is what makes that claim checkable: it takes away the DOORS — the
// desktop strip, the drawer, the phone bar, Home's count tiles, the ＋'s offer of
// that kind, the search scope chips and the shortcut legend — and touches nothing
// else. parsePath and statePath below are deliberately NOT feature-aware, so
// /library still resolves, a bookmark still opens, a quote still links to the book
// it came from, and the review deck still draws from the section. Nothing is
// deleted and nothing is disabled; turning it back on finds everything where it
// was.
//
// A CONTENT LINK IS NOT A DOOR, and that is the line this feature is drawn on. A
// door is a control whose whole purpose is "go to this section". A quote card's
// link to the book it came from is the thread from a thing to its source, and
// muting it would strand four thousand highlights to spare somebody a tab.
//
// `pref` is the stored key, and the RULE IS THE ZERO VALUE RATHER THAN THE WORD:
// whatever a section's default is, `false` has to be it, on both sides of the
// wire — see the prefs struct. Three sections are on until you say otherwise, so
// they are spelled hide*. Anthologies is off until you ask for it, so it is
// spelled show* and carries `off: true` to say which way round it reads.
//
// ONE FLAG RATHER THAN A SECOND LIST. The polarity is a fact about the row, so it
// travels with the row and the two places that care — visibleSections below and
// the Features card's writer — each branch on it once. A separate registry of
// "the inverted ones" is the four-hand-maintained-lists shape this file already
// warns about.
// `label` and `what` are keys, for the reason the tab tables above are.
export const SECTIONS = [
  { tab: 'library', label: 'nav.tab.library.label', pref: 'hideLibrary', what: 'nav.section.library.what' },
  { tab: 'movies', label: 'nav.tab.movies.label', pref: 'hideCatalogue', what: 'nav.section.movies.what' },
  { tab: 'quotes', label: 'nav.tab.quotes.label', pref: 'hideQuotes', what: 'nav.section.quotes.what' },
  {
    tab: 'anthologies',
    label: 'nav.tab.anthologies.label',
    pref: 'showAnthologies',
    off: true,
    what: 'nav.section.anthologies.what',
  },
]

// visibleSections turns the preference bag into { tab: boolean }, which is the
// only shape the rest of the app asks about.
//
// ABSENT MEANS THE DEFAULT, at every layer: a reader who has never opened
// Settings, the demo fixture, and a build that predates a section all resolve to
// the same answer — the three on, anthologies off. That is why each flag is
// spelled so that `false` is what it defaults to.
//
// THE LAST ONE CANNOT GO. The server refuses a set that hides all three and
// corrects such a set on read, but this is asserted here as well rather than
// trusted, because an app with no content sections has no ＋ that offers anything
// and no list to stand in — a broken screen rather than a preference, and the one
// state a reader could not click their way out of.
//
// `any` COUNTS THE CONTENT SECTIONS ONLY, and anthologies is not one. An
// anthology holds quotes that live in the other three — it is a way of reading
// them, not a place to keep anything — so it cannot be the last one standing.
// This has to agree with the server's three-way rule exactly: if the client were
// the more permissive of the two, hiding the third section while anthologies was
// on would move the switch, save optimistically, take a 400 nobody sees, and
// revert on the next reload.
export function visibleSections(prefs) {
  const on = {}
  let any = false
  for (const s of SECTIONS) {
    on[s.tab] = s.off ? !!prefs?.[s.pref] : !prefs?.[s.pref]
    if (on[s.tab] && !s.off) any = true
  }
  if (!any) on[SECTIONS[0].tab] = true
  return on
}

// visibleTabs filters one nav list by that answer, and it is the ONE filter all
// four of them share.
//
// Four hand-maintained lists naming the same tabs is a shape this file already
// says "only stays correct if something checks it", and 1.5.0 proved it. A second
// per-list rule for which rows are hidden would be the same bug with a preference
// in front of it — so there is one function, every consumer calls it, and
// routes.test.js asserts the invariant over all four lists at once rather than
// four cases.
//
// A key this answer says nothing about passes through, which is what keeps Home,
// Search and the four utility tabs out of it.
export function visibleTabs(rows, sections) {
  const out = []
  for (const row of rows) {
    // The drawer's null is a DIVIDER and it is positional — it separates the
    // primary screens from the utility group. Emitted only after something it can
    // divide and never twice, so filtering rows either side of it cannot leave a
    // rule floating at the top of the menu.
    if (row === null) {
      if (out.length && out[out.length - 1] !== null) out.push(null)
      continue
    }
    if (sections && sections[row[0]] === false) continue
    out.push(row)
  }
  while (out.length && out[out.length - 1] === null) out.pop()
  return out
}

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
  // An anthology's own page, the same two-level shape: /anthologies lists them and
  // /anthologies/{id} is the one you are reading. An unusable id falls through to
  // the ROUTE_TABS line below and lands on the list, which is the same answer
  // /books/abc gets — you asked for an anthology, so the anthologies are a better
  // reply than the front page.
  if (a === 'anthologies' && workID(b)) return { tab: 'anthologies', detail: { type: 'anthology', id: workID(b) } }
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
  if (detail?.type === 'anthology') return `/anthologies/${detail.id}`
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
