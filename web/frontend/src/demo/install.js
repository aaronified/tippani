// Read-only demo mode for the GitHub Pages build (VITE_DEMO=1). There is no
// backend on a static host, so installDemo() replaces window.fetch with a shim
// that answers /api/* from the in-memory fixtures below: GETs return dummy data,
// writes return 403 "read-only" (except appearance preferences + login/logout,
// which are harmless client-side niceties so the theme/accent toggles still
// work). Everything non-/api (the built JS/CSS/font assets) passes through.
//
// Covers/posters/stickers use empty paths on purpose → the app's own striped
// placeholders render instead of broken <img>s (a static host can't serve the
// cover route). See App.jsx (DEMO) for the routing/banner side.

const USER = {
  id: 1,
  username: 'reader',
  is_admin: true,
  avatar_path: '',
  preferences: { aesthetic: 'paper', theme: 'light', accent: 'terracotta', home: 'library' },
}

// ---- books + annotations ----
const BOOKS = [
  { id: 1, title: 'The Wide Margin', author: 'A. Whitfield', published_year: 1998, genres: ['essays', 'memoir'], series: '', series_index: 0, favorite: true, rating: 4 },
  { id: 2, title: "Reaper's Gale", author: 'Steven Erikson', published_year: 2007, genres: ['fantasy', 'epic'], series: 'Malazan Book of the Fallen', series_index: 7, favorite: false, rating: 5 },
  { id: 3, title: 'Quiet Light', author: 'M. Sinha', published_year: 2015, genres: ['poetry'], series: '', series_index: 0, favorite: false, rating: 3 },
  { id: 4, title: 'The Salt Path', author: 'R. Winn', published_year: 2018, genres: ['memoir', 'nature'], series: '', series_index: 0, favorite: true, rating: 4 },
  { id: 5, title: 'On Colour', author: '(unknown)', published_year: 0, genres: [], series: '', series_index: 0, favorite: false, rating: 0 },
]
const DESCRIPTIONS = {
  1: 'A slim book of essays on attention, reading, and the room we leave in the margins.',
  2: 'The seventh volume of a sprawling epic fantasy.',
  3: 'Poems on stillness and the ordinary.',
  4: 'A memoir of a long coastal walk after losing everything.',
}
const ANNOTATIONS = [
  { id: 1, book_id: 1, quote: 'She kept the margins wider than the text, the way some people keep a spare room — for whoever might arrive.', note: 'the wide-margin argument, again — keep.', color: 'yellow', chapter: '3', location: '142', favorite: true, rating: 4, tags: ['memory', 'craft'], noted_at: '2026-02-11' },
  { id: 2, book_id: 1, quote: 'Quiet is not the absence of sound but the presence of attention.', note: '', color: 'blue', chapter: '1', location: '9', favorite: false, rating: 3, tags: ['craft'], noted_at: '2026-03-02' },
  { id: 3, book_id: 1, quote: 'A margin is a promise: that there is always room to answer back.', note: '', color: 'pink', chapter: '5', location: '201', favorite: true, rating: 5, tags: ['favourite'], noted_at: '2026-05-19' },
  { id: 4, book_id: 2, quote: 'The dead do not dream, and yet here we are, dreaming them.', note: '', color: 'orange', chapter: '', location: '', favorite: false, rating: 5, tags: ['heartbreak'], noted_at: '2026-06-08' },
  { id: 5, book_id: 2, quote: 'Children. Confront them with a mystery and they will attack it with a hammer.', note: 'so good', color: 'yellow', chapter: '', location: '', favorite: true, rating: 5, tags: ['funny', 'wisdom'], noted_at: '2026-06-21' },
  { id: 6, book_id: 3, quote: 'The lamp does not argue with the dark; it simply keeps its corner.', note: '', color: 'blue', chapter: '', location: '', favorite: false, rating: 3, tags: [], noted_at: '2026-07-01' },
]

// ---- movies + dialogues ----
const MOVIES = [
  { id: 1, title: 'Northline', director: 'R. Whitfield', release_year: 1978, genres: ['drama', 'night'], series: '', series_index: 0, favorite: true, rating: 5, media_type: 'movie' },
  { id: 2, title: 'The Long Take', director: 'H. Okonkwo', release_year: 2009, genres: ['noir'], series: '', series_index: 0, favorite: false, rating: 4, media_type: 'movie' },
  { id: 3, title: 'Reel Seven', director: 'A. Costa', release_year: 2021, genres: ['drama'], series: '', series_index: 0, favorite: false, rating: 3, media_type: 'show' },
]
const CAST = {
  1: [{ character: 'Mira', actor: 'E. Sen' }, { character: 'Joel', actor: 'D. Kapoor' }],
  2: [{ character: 'Vaughn', actor: 'T. Marsh' }],
  3: [{ character: 'Ana', actor: 'L. Reyes' }],
}
const DIALOGUES = [
  { id: 1, movie_id: 1, quote: "We don't remember days. We remember light, and the room it fell in.", note: '', character: 'Mira', actor: 'E. Sen', timestamp: '01:12:04', favorite: true, rating: 5, tags: ['light'] },
  { id: 2, movie_id: 1, quote: 'You came back. Nobody comes back.', note: '', character: 'Joel', actor: 'D. Kapoor', timestamp: '00:41:52', favorite: false, rating: 3, tags: [] },
  { id: 3, movie_id: 1, quote: 'Roll the reel. Let them see what we were.', note: '', character: 'Mira', actor: 'E. Sen', timestamp: '01:48:20', favorite: true, rating: 4, tags: ['light'] },
  { id: 4, movie_id: 2, quote: 'Every alibi is a little story we tell the clock.', note: '', character: 'Vaughn', actor: 'T. Marsh', timestamp: '00:22:10', favorite: false, rating: 4, tags: ['craft'] },
]

const TAGS = [
  { id: 1, name: 'craft', color: 'blue', style: 'tape' },
  { id: 2, name: 'memory', color: 'yellow', style: 'sticker' },
  { id: 3, name: 'favourite', color: 'pink', style: 'sticker' },
  { id: 4, name: 'heartbreak', color: 'pink', style: 'reel' },
  { id: 5, name: 'funny', color: 'yellow', style: 'sticker' },
  { id: 6, name: 'wisdom', color: 'orange', style: 'sticker' },
  { id: 7, name: 'light', color: 'yellow', style: 'flyout' },
  { id: 8, name: 'insight', color: 'blue', style: 'banner' },
  { id: 9, name: 'beautiful', color: 'orange', style: 'tape' },
]
const GENRES = ['drama', 'epic', 'essays', 'fantasy', 'memoir', 'nature', 'noir', 'night', 'poetry']

// Annotation/dialogue counts per tag, derived from the fixtures above.
function tagRows() {
  return TAGS.map((t) => ({
    ...t,
    annotations: ANNOTATIONS.filter((a) => a.tags.includes(t.name)).length,
    dialogues: DIALOGUES.filter((d) => d.tags.includes(t.name)).length,
  }))
}

function bookListItem(b) {
  return { ...b, cover_path: '', annotation_count: ANNOTATIONS.filter((a) => a.book_id === b.id).length }
}
function bookDetail(b) {
  return { ...b, isbn: '', asin: '', description: DESCRIPTIONS[b.id] || '', cover_path: '', created_at: '2026-01-10 09:00:00' }
}
function movieListItem(m) {
  return { ...m, poster_path: '', dialogue_count: DIALOGUES.filter((d) => d.movie_id === m.id).length }
}
function movieDetail(m) {
  return { ...m, tmdb_id: 0, tvdb_id: 0, poster_path: '', description: '', cast: CAST[m.id] || [], created_at: '2026-01-10 09:00:00' }
}
function annRow(a) {
  return { ...a, sticker_id: null, sticker_x: null, sticker_y: null, created_at: a.noted_at + ' 09:00:00', updated_at: a.noted_at + ' 09:00:00' }
}
function dlgRow(d) {
  return { ...d, sticker_id: null, sticker_x: null, sticker_y: null, created_at: '2026-06-01 09:00:00', updated_at: '2026-06-01 09:00:00' }
}

function lastMonths(n) {
  const out = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}
function stats() {
  const months = lastMonths(6)
  const counts = [3, 7, 4, 9, 6, 12]
  return {
    books: BOOKS.length,
    annotations: ANNOTATIONS.length,
    movies: MOVIES.length,
    dialogues: DIALOGUES.length,
    tags: TAGS.length,
    favorites: ANNOTATIONS.filter((a) => a.favorite).length + DIALOGUES.filter((d) => d.favorite).length,
    most_annotated: { id: 1, title: 'The Wide Margin', count: 3 },
    most_quoted: { id: 1, title: 'Northline', count: 3 },
    busiest_month: { month: months[5], count: counts[5] },
    monthly_activity: months.map((m, i) => ({ month: m, count: counts[i] })),
  }
}
function metadataLibrary() {
  return {
    books: BOOKS.map((b) => ({
      id: b.id, title: b.title, author: b.author, series: b.series, isbn: '', asin: '',
      has_cover: false, has_ids: false, has_author: !!b.author && b.author !== '(unknown)',
      has_series: !!b.series, has_year: b.published_year > 0, has_genre: b.genres.length > 0,
      has_description: !!DESCRIPTIONS[b.id], annotation_count: ANNOTATIONS.filter((a) => a.book_id === b.id).length,
    })),
    movies: MOVIES.map((m) => ({
      id: m.id, title: m.title, media_type: m.media_type, release_year: m.release_year,
      has_poster: false, has_cast: (CAST[m.id] || []).length > 0, has_source: false,
      has_director: !!m.director, has_year: m.release_year > 0, has_genre: m.genres.length > 0,
      dialogue_count: DIALOGUES.filter((d) => d.movie_id === m.id).length,
    })),
    dialogue_stats: { total: DIALOGUES.length, missing_actor: 0 },
  }
}
function search(q) {
  const s = (q || '').trim().toLowerCase()
  const hit = (txt) => s && String(txt || '').toLowerCase().includes(s)
  return {
    books: BOOKS.filter((b) => hit(b.title) || hit(b.author) || b.genres.some(hit) || hit(b.series))
      .map((b) => ({ id: b.id, title: b.title, author: b.author, cover_path: '', genres: b.genres })),
    annotations: ANNOTATIONS.filter((a) => hit(a.quote) || hit(a.note))
      .map((a) => ({ id: a.id, book_id: a.book_id, book_title: (BOOKS.find((b) => b.id === a.book_id) || {}).title || '', book_cover_path: '', quote: a.quote, note: a.note })),
    movies: MOVIES.filter((m) => hit(m.title) || hit(m.director) || m.genres.some(hit))
      .map((m) => ({ id: m.id, title: m.title, director: m.director, release_year: m.release_year, poster_path: '' })),
    dialogues: DIALOGUES.filter((d) => hit(d.quote) || hit(d.character) || hit(d.actor))
      .map((d) => ({ id: d.id, movie_id: d.movie_id, movie_title: (MOVIES.find((m) => m.id === d.movie_id) || {}).title || '', movie_poster_path: '', quote: d.quote, character: d.character, actor: d.actor, timestamp: d.timestamp })),
  }
}

const RO = { error: 'This is a read-only demo — changes are not saved. Self-host Tippani to edit your own library.' }

function route(method, path, params) {
  if (method !== 'GET') {
    // Appearance prefs + login/logout are client-side niceties; let them "work".
    if (path === '/auth/me/preferences' || path === '/auth/login') return [200, method === 'GET' ? USER : USER]
    if (path === '/auth/logout') return [200, { ok: true }]
    if (path === '/auth/me/avatar') return [200, { avatar_path: '' }]
    return [403, RO]
  }
  const id = (p) => Number(path.slice(p.length))
  switch (true) {
    case path === '/auth/me': return [200, USER]
    case path === '/auth/status': return [200, { needs_onboarding: false }]
    case path === '/books': return [200, { books: BOOKS.map(bookListItem) }]
    case path.startsWith('/books/') && path.endsWith('/export'): return [200, {}]
    case /^\/books\/\d+$/.test(path): { const b = BOOKS.find((x) => x.id === id('/books/')); return b ? [200, bookDetail(b)] : [404, { error: 'not found' }] }
    case path === '/annotations': { const bid = Number(params.get('book_id')); return [200, { annotations: ANNOTATIONS.filter((a) => !bid || a.book_id === bid).map(annRow) }] }
    case path === '/movies': return [200, { movies: MOVIES.map(movieListItem) }]
    case /^\/movies\/\d+$/.test(path): { const m = MOVIES.find((x) => x.id === id('/movies/')); return m ? [200, movieDetail(m)] : [404, { error: 'not found' }] }
    case path === '/dialogues': { const mid = Number(params.get('movie_id')); return [200, { dialogues: DIALOGUES.filter((d) => !mid || d.movie_id === mid).map(dlgRow) }] }
    case path === '/tags': return [200, { tags: tagRows() }]
    case path === '/stickers': return [200, { stickers: [] }]
    case path === '/genres': return [200, { genres: GENRES }]
    case path === '/stats': return [200, stats()]
    case path === '/metadata/library': return [200, metadataLibrary()]
    case path === '/metadata/duplicates': return [200, { groups: [] }]
    case path === '/metadata/status': return [200, { tmdb: { source: 'none' }, tvdb: { source: 'none' }, google_books: { key_set: false }, books_lookup: { ok: null, error: '', checked_at: '' } }]
    case path === '/admin/metadata-keys': return [200, { tmdb_key_set: false, tvdb_key_set: false, google_books_key_set: false, amazon_cookie_set: false, amazon_domain: '', tmdb_source: 'none', tvdb_source: 'none' }]
    case path === '/admin/users': return [200, { users: [{ id: 1, username: 'reader', is_admin: true, created_at: '2026-01-05' }] }]
    case path === '/search': return [200, search(params.get('q'))]
    case path === '/books/lookup' || path === '/movies/lookup': return [200, { candidates: [] }]
    default: return [200, {}]
  }
}

export function installDemo() {
  const real = window.fetch.bind(window)
  window.fetch = async (input, opts = {}) => {
    let url
    let method = (opts.method || 'GET').toUpperCase()
    if (typeof input === 'string') url = input
    else { url = input.url; if (input.method) method = input.method.toUpperCase() }
    let u
    try {
      u = new URL(url, window.location.origin)
    } catch {
      return real(input, opts)
    }
    if (u.pathname !== '/api' && !u.pathname.startsWith('/api/')) return real(input, opts)
    const path = u.pathname.replace(/^\/api/, '') || '/'
    const [status, body] = route(method, path, u.searchParams)
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
