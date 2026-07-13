// Read-only demo mode for the GitHub Pages build (VITE_DEMO=1). There is no
// backend on a static host, so installDemo() replaces window.fetch with a shim
// that answers /api/* from the in-memory fixtures below: GETs return dummy data,
// writes return 403 "read-only" (except appearance preferences + login/logout +
// person link lookups, which are harmless client-side niceties). Everything
// non-/api (the built JS/CSS/font assets) passes through.
//
// Covers/posters/stickers/portraits are inline data: SVG URIs — coverImgURL
// (api.js) passes data: paths straight through to <img src>, so the demo can
// show real-looking artwork without a cover route. See App.jsx (DEMO) for the
// routing/banner side.

const USER = {
  id: 1,
  username: 'reader',
  is_admin: true,
  avatar_path: '',
  preferences: { aesthetic: 'paper', theme: 'light', accent: 'terracotta' },
}

// ---- inline artwork (data: URIs) ----
const svgURI = (s) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s)
const coverArt = (bg, fg, title, sub) =>
  svgURI(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">` +
      `<rect width="200" height="300" fill="${bg}"/>` +
      `<rect x="12" y="12" width="176" height="276" fill="none" stroke="${fg}" stroke-opacity=".55" stroke-width="2"/>` +
      `<text x="100" y="140" font-family="Georgia,serif" font-size="19" fill="${fg}" text-anchor="middle">${title}</text>` +
      (sub ? `<text x="100" y="168" font-family="Georgia,serif" font-size="11" fill="${fg}" fill-opacity=".8" text-anchor="middle">${sub}</text>` : '') +
      `</svg>`,
  )
const portraitArt = (bg, initials) =>
  svgURI(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">` +
      `<rect width="120" height="160" fill="${bg}"/>` +
      `<circle cx="60" cy="58" r="26" fill="#FFFEF9" fill-opacity=".85"/>` +
      `<rect x="24" y="96" width="72" height="44" rx="20" fill="#FFFEF9" fill-opacity=".85"/>` +
      `<text x="60" y="66" font-family="Georgia,serif" font-size="20" fill="${bg}" text-anchor="middle">${initials}</text>` +
      `</svg>`,
  )
const STAR = svgURI(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 3l6.3 13.1 14.2 1.9-10.4 9.8 2.7 14.1L24 35.3 11.2 42l2.7-14.1L3.5 18l14.2-1.9z" fill="#E5C355" stroke="#B0862F" stroke-width="1.6" stroke-linejoin="round"/></svg>',
)
const HEART = svgURI(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M24 42S5 29.5 5 16.5A9.5 9.5 0 0 1 24 11a9.5 9.5 0 0 1 19 5.5C43 29.5 24 42 24 42z" fill="#D98CA6" stroke="#B5677F" stroke-width="1.6" stroke-linejoin="round"/></svg>',
)

// ---- books + annotations ----
const BOOKS = [
  { id: 1, title: 'The Wide Margin', author: 'A. Whitfield', published_year: 1998, genres: ['essays', 'memoir'], series: '', series_index: 0, favorite: true, rating: 4, cover_path: coverArt('#5C4A33', '#F4EDDE', 'The Wide', 'Margin') },
  { id: 2, title: "Reaper's Gale", author: 'Steven Erikson', published_year: 2007, genres: ['fantasy', 'epic'], series: 'Malazan Book of the Fallen', series_index: 7, favorite: false, rating: 5, cover_path: coverArt('#2F3A4A', '#ECE3D1', "Reaper's", 'Gale') },
  { id: 3, title: 'Quiet Light', author: 'M. Sinha', published_year: 2015, genres: ['poetry'], series: '', series_index: 0, favorite: false, rating: 3, cover_path: '' },
  { id: 4, title: 'The Salt Path', author: 'R. Winn', published_year: 2018, genres: ['memoir', 'nature'], series: '', series_index: 0, favorite: true, rating: 4, cover_path: coverArt('#3F7D5A', '#F4EDDE', 'The Salt', 'Path') },
  { id: 5, title: 'On Colour', author: '(unknown)', published_year: 0, genres: [], series: '', series_index: 0, favorite: false, rating: 0, cover_path: '' },
]
const DESCRIPTIONS = {
  1: 'A slim book of essays on attention, reading, and the room we leave in the margins.',
  2: 'The seventh volume of a sprawling epic fantasy.',
  3: 'Poems on stillness and the ordinary.',
  4: 'A memoir of a long coastal walk after losing everything.',
}
const ANNOTATIONS = [
  { id: 1, book_id: 1, quote: 'She kept the margins wider than the text, the way some people keep a spare room — for whoever might arrive.', note: 'the wide-margin argument, again — keep.', color: 'yellow', chapter: '3', location: '142', favorite: true, rating: 4, tags: ['memory', 'craft'], noted_at: '2026-02-11', sticker_id: 1, sticker_x: 0.84, sticker_y: 0.06 },
  { id: 2, book_id: 1, quote: 'Quiet is not the absence of sound but the presence of attention.', note: '', color: 'blue', chapter: '1', location: '9', favorite: false, rating: 3, tags: ['craft'], noted_at: '2026-03-02' },
  { id: 3, book_id: 1, quote: 'A margin is a promise: that there is always room to answer back.', note: '', color: 'pink', chapter: '5', location: '201', favorite: true, rating: 5, tags: ['favourite'], noted_at: '2026-05-19' },
  { id: 4, book_id: 2, quote: 'The dead do not dream, and yet here we are, dreaming them.', note: '', color: 'orange', chapter: '', location: '', favorite: false, rating: 5, tags: ['heartbreak'], noted_at: '2026-06-08' },
  { id: 5, book_id: 2, quote: 'Children. Confront them with a mystery and they will attack it with a hammer.', note: 'so good', color: 'yellow', chapter: '', location: '', favorite: true, rating: 5, tags: ['funny', 'wisdom'], noted_at: '2026-06-21' },
  { id: 6, book_id: 3, quote: 'The lamp does not argue with the dark; it simply keeps its corner.', note: '', color: 'blue', chapter: '', location: '', favorite: false, rating: 3, tags: [], noted_at: '2026-07-01' },
]

// ---- movies + dialogues ----
const MOVIES = [
  { id: 1, title: 'Northline', director: 'R. Whitfield', release_year: 1978, genres: ['drama', 'night'], series: 'Northline Diptych', series_index: 1, favorite: true, rating: 5, media_type: 'movie', poster_path: coverArt('#1D1710', '#D6A25C', 'NORTHLINE', '1978') },
  { id: 2, title: 'The Long Take', director: 'H. Okonkwo', release_year: 2009, genres: ['noir'], series: '', series_index: 0, favorite: false, rating: 4, media_type: 'movie', poster_path: coverArt('#15100C', '#A2937C', 'THE LONG', 'TAKE') },
  { id: 3, title: 'Reel Seven', director: 'A. Costa', release_year: 2021, genres: ['drama'], series: '', series_index: 0, favorite: false, rating: 3, media_type: 'show', poster_path: '' },
  { id: 4, title: 'Southline', director: 'R. Whitfield', release_year: 1982, genres: ['drama'], series: 'Northline Diptych', series_index: 2, favorite: false, rating: 4, media_type: 'movie', poster_path: '' },
]
const MOVIE_DESCRIPTIONS = {
  1: 'Two strangers share a night train north; neither says where they are going.',
  2: 'A single unbroken take through a city that keeps changing behind the camera.',
  4: 'The companion piece, twenty years on, heading the other way.',
}
const CAST = {
  1: [{ character: 'Mira', actor: 'E. Sen' }, { character: 'Joel', actor: 'D. Kapoor' }],
  2: [{ character: 'Vaughn', actor: 'T. Marsh' }],
  3: [{ character: 'Ana', actor: 'L. Reyes' }],
  4: [{ character: 'Mira', actor: 'E. Sen' }],
}
const DIALOGUES = [
  { id: 1, movie_id: 1, quote: "We don't remember days. We remember light, and the room it fell in.", note: '', character: 'Mira', actor: 'E. Sen', timestamp: '01:12:04', favorite: true, rating: 5, tags: ['light'], sticker_id: 2, sticker_x: 0.86, sticker_y: 0.1 },
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

// ---- stickers (the FlowQuote seals) ----
const STICKERS = [
  { id: 1, name: 'Gold star', path: STAR, annotations: 1, dialogues: 0 },
  { id: 2, name: 'Heart', path: HEART, annotations: 0, dialogues: 1 },
]

// ---- people (authors/actors): the redirect-menu metadata ----
const PEOPLE = [
  { id: 1, kind: 'author', name: 'A. Whitfield', bio: 'Essayist. Writes about attention, margins, and rooms.', image_path: portraitArt('#B4482D', 'AW'), born: '1954', links: 'https://openlibrary.org/authors/OL0000001A\nhttps://en.wikipedia.org/wiki/Essay', source: 'lookup', source_id: '' },
  { id: 2, kind: 'author', name: 'Steven Erikson', bio: '', image_path: '', born: '', links: 'https://openlibrary.org/authors/OL447624A\nhttps://en.wikipedia.org/wiki/Steven_Erikson', source: 'lookup', source_id: '' },
  { id: 3, kind: 'actor', name: 'E. Sen', bio: '', image_path: portraitArt('#2F6D8F', 'ES'), born: '', links: 'https://www.imdb.com/name/nm0000000/\nhttps://www.themoviedb.org/person/1\nhttps://en.wikipedia.org/wiki/Actor', source: 'lookup', source_id: '' },
]

// Annotation/dialogue counts per tag, derived from the fixtures above.
function tagRows() {
  return TAGS.map((t) => ({
    ...t,
    annotations: ANNOTATIONS.filter((a) => a.tags.includes(t.name)).length,
    dialogues: DIALOGUES.filter((d) => d.tags.includes(t.name)).length,
  }))
}

function bookListItem(b) {
  return { ...b, annotation_count: ANNOTATIONS.filter((a) => a.book_id === b.id).length }
}
function bookDetail(b) {
  return { ...b, isbn: '', asin: '', description: DESCRIPTIONS[b.id] || '', created_at: '2026-01-10 09:00:00' }
}
function movieListItem(m) {
  return { ...m, dialogue_count: DIALOGUES.filter((d) => d.movie_id === m.id).length }
}
function movieDetail(m) {
  return { ...m, tmdb_id: 0, tvdb_id: 0, description: MOVIE_DESCRIPTIONS[m.id] || '', cast: CAST[m.id] || [], created_at: '2026-01-10 09:00:00' }
}
// A UTC timestamp n days ago in the stored "YYYY-MM-DD HH:MM:SS" shape.
function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ')
}
// Canned spaced-repetition state so the status dots (v0.5.0) show the full
// spread in the demo: id 1 remembered (green), 2 forgetting (yellow), 3
// probably-forgotten (red); everything else unseen.
const DEMO_REVIEW = {
  'book:1': { reviewed: true, stability: 30, last_reviewed_at: daysAgo(1) },
  'book:2': { reviewed: true, stability: 6, last_reviewed_at: daysAgo(3) },
  'book:3': { reviewed: true, stability: 2, last_reviewed_at: daysAgo(5) },
  'screen:1': { reviewed: true, stability: 20, last_reviewed_at: daysAgo(2) },
}
function demoReview(kind, id) {
  return DEMO_REVIEW[`${kind}:${id}`] || { reviewed: false, stability: 0, last_reviewed_at: '' }
}

function annRow(a) {
  const b = BOOKS.find((x) => x.id === a.book_id) || {}
  return {
    sticker_id: null, sticker_x: null, sticker_y: null,
    book_title: b.title || '', book_author: b.author || '',
    ...a,
    ...demoReview('book', a.id),
    created_at: a.noted_at + ' 09:00:00', updated_at: a.noted_at + ' 09:00:00',
  }
}

// ---- Daily Quiz & Practice (ROADMAP №2, v0.5.0): live little decks so the
// Home screen's ritual can actually be played in the demo. Session-only —
// reload resets it. The reveal/grade flow and both modes work for real.
const REVIEW_DECK = [1, 5, 4] // annotation ids, "due" order
const review = { touched: new Set(), got: 0, forgot: 0 }
const practice = { answered: 0, got: 0, forgot: 0 }

// reviewCard shapes a card the way review_handlers.go does.
function bookCard(a, direction) {
  const b = BOOKS.find((x) => x.id === a.book_id) || {}
  return {
    kind: 'book', id: a.id, direction: direction || (a.id % 2 ? 'source' : 'quote'),
    quote: a.quote || '', note: a.note || '', color: a.color || 'yellow',
    title: b.title || '', author: b.author || '', character: '',
    chapter: a.chapter || '', location: a.location || '', timestamp: '', media_type: '',
    stability: 1, review_count: 0, status: 'unseen',
  }
}
function screenCard(d, direction) {
  const m = MOVIES.find((x) => x.id === d.movie_id) || {}
  return {
    kind: 'screen', id: d.id, direction: direction || (d.id % 2 ? 'source' : 'quote'),
    quote: d.quote || '', note: d.note || '', color: '',
    title: m.title || '', author: '', character: d.character || '',
    chapter: '', location: '', timestamp: d.timestamp || '', media_type: m.media_type || 'movie',
    stability: 1, review_count: 0, status: 'unseen',
  }
}
function reviewItems() {
  return REVIEW_DECK.filter((id) => !review.touched.has(id))
    .map((id) => bookCard(ANNOTATIONS.find((x) => x.id === id)))
}
function demoStates() {
  const total = ANNOTATIONS.length + DIALOGUES.length
  return { unseen: Math.max(0, total - 4), remembered: 2, forgetting: 1, probably_forgotten: 1, total }
}
function reviewDeck() {
  return {
    items: reviewItems(),
    answered_today: review.touched.size,
    got_today: review.got,
    forgot_today: review.forgot,
    quota: 8,
    streak: 3,
    states: demoStates(),
  }
}
function practiceDeck() {
  const cards = ANNOTATIONS.map((a) => bookCard(a)).concat(DIALOGUES.map((d) => screenCard(d)))
  return { items: cards, pool: cards.length }
}
function reviewAnswer(body) {
  const { kind, id, result, mode } = body || {}
  if (mode === 'practice') {
    if (result !== 'skip') {
      practice.answered++
      if (result === 'got') practice.got++
      if (result === 'forgot') practice.forgot++
    }
    return { ok: true, kind, id, stability: 2.5, status: 'unseen', mode, answered: practice.answered, got: practice.got, forgot: practice.forgot }
  }
  review.touched.add(id)
  if (result === 'got') review.got++
  if (result === 'forgot') review.forgot++
  return {
    ok: true, kind, id, stability: result === 'got' ? 2.5 : 1, status: 'remembered', mode: 'daily',
    answered: review.touched.size, got: review.got, forgot: review.forgot, remaining: reviewItems().length,
  }
}
function reviewScores() {
  const acc = (g, n) => (n ? g / n : 0)
  return {
    daily: { answered: review.touched.size, got: review.got, forgot: review.forgot, accuracy: acc(review.got, review.touched.size), streak: 3, days: 5, remaining: reviewItems().length, quota: 8 },
    practice: { answered: practice.answered, got: practice.got, forgot: practice.forgot, accuracy: acc(practice.got, practice.answered), sessions: practice.answered ? 1 : 0 },
    states: demoStates(),
  }
}
function dlgRow(d) {
  return { sticker_id: null, sticker_x: null, sticker_y: null, ...d, ...demoReview('screen', d.id), created_at: '2026-06-01 09:00:00', updated_at: '2026-06-01 09:00:00' }
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
      has_cover: !!b.cover_path, has_ids: false, has_author: !!b.author && b.author !== '(unknown)',
      has_series: !!b.series, has_year: b.published_year > 0, has_genre: b.genres.length > 0,
      has_description: !!DESCRIPTIONS[b.id], annotation_count: ANNOTATIONS.filter((a) => a.book_id === b.id).length,
    })),
    movies: MOVIES.map((m) => ({
      id: m.id, title: m.title, media_type: m.media_type, release_year: m.release_year,
      has_poster: !!m.poster_path, has_cast: (CAST[m.id] || []).length > 0, has_source: false,
      has_director: !!m.director, has_year: m.release_year > 0, has_genre: m.genres.length > 0,
      dialogue_count: DIALOGUES.filter((d) => d.movie_id === m.id).length,
    })),
    dialogue_stats: { total: DIALOGUES.length, missing_actor: 0 },
  }
}

// search mirrors the real hit shapes (search_handler.go): parent fields ride
// along so the Search page's group-by (author/decade/series/genre) works.
function search(q, scope) {
  const s = (q || '').trim().toLowerCase()
  const hit = (txt) => s && String(txt || '').toLowerCase().includes(s)
  const mv = (id) => MOVIES.find((m) => m.id === id) || {}
  const bk = (id) => BOOKS.find((b) => b.id === id) || {}
  const out = {
    books: BOOKS.filter((b) => hit(b.title) || hit(b.author) || b.genres.some(hit) || hit(b.series))
      .map((b) => ({ id: b.id, title: b.title, author: b.author, cover_path: b.cover_path, genres: b.genres, published_year: b.published_year, series: b.series, series_index: b.series_index })),
    annotations: ANNOTATIONS.filter((a) => hit(a.quote) || hit(a.note))
      .map((a) => { const b = bk(a.book_id); return { id: a.id, book_id: a.book_id, book_title: b.title || '', book_cover_path: b.cover_path || '', book_author: b.author || '', book_published_year: b.published_year || 0, book_series: b.series || '', book_genres: b.genres || [], quote: a.quote, note: a.note } }),
    movies: MOVIES.filter((m) => hit(m.title) || hit(m.director) || m.genres.some(hit) || hit(m.series))
      .map((m) => ({ id: m.id, title: m.title, director: m.director, release_year: m.release_year, poster_path: m.poster_path, genres: m.genres, series: m.series, series_index: m.series_index })),
    dialogues: DIALOGUES.filter((d) => hit(d.quote) || hit(d.character) || hit(d.actor))
      .map((d) => { const m = mv(d.movie_id); return { id: d.id, movie_id: d.movie_id, movie_title: m.title || '', movie_poster_path: m.poster_path || '', movie_director: m.director || '', movie_release_year: m.release_year || 0, movie_series: m.series || '', movie_genres: m.genres || [], quote: d.quote, character: d.character, actor: d.actor, timestamp: d.timestamp } }),
  }
  if (scope && scope !== 'all') {
    for (const k of Object.keys(out)) if (k !== scope) out[k] = []
  }
  return out
}

const RO = { error: 'This is a read-only demo — changes are not saved. Self-host Tippani to edit your own library.' }

function route(method, path, params, body) {
  if (method !== 'GET') {
    // Harmless niceties keep working: appearance prefs, login/logout, avatar,
    // add-form lookups (graceful empty), and person link lookups (read-only in
    // spirit — they resolve external pages; the demo answers from a stub).
    if (path === '/auth/me/preferences' || path === '/auth/login') return [200, USER]
    if (path === '/auth/logout') return [200, { ok: true }]
    // The Daily Quiz & Practice ritual works for real (session-only) — it IS
    // the demo. Grading and the practice-score reset both respond live.
    if (path === '/review/answer') return [200, reviewAnswer(body)]
    if (path === '/review/practice' && method === 'DELETE') {
      practice.answered = practice.got = practice.forgot = 0
      return [200, { ok: true }]
    }
    if (path === '/auth/me/avatar') return [200, { avatar_path: '' }]
    if (path === '/books/lookup' || path === '/movies/lookup') return [200, { candidates: [] }]
    if (path === '/people/lookup') {
      const name = (body && body.name) || ''
      const wiki = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(name).replace(/ /g, '_'))
      const links = body && body.kind === 'actor'
        ? { tmdb: 'https://www.themoviedb.org/person/1', imdb: 'https://www.imdb.com/name/nm0000000/', wikipedia: wiki }
        : { openlibrary: 'https://openlibrary.org/search/authors?q=' + encodeURIComponent(name), wikipedia: wiki }
      return [200, { links }]
    }
    // PUT /people is tolerated (echo) so the link menu + console flows can be
    // exercised — nothing persists, which is the point of the demo.
    if (path === '/people' && method === 'PUT') return [200, { id: 99, image_path: '', ...body }]
    return [403, RO]
  }
  const id = (p) => Number(path.slice(p.length))
  switch (true) {
    case path === '/auth/me': return [200, USER]
    case path === '/auth/status': return [200, { needs_onboarding: false }]
    case path === '/review/daily': return [200, reviewDeck()]
    case path === '/review/practice': return [200, practiceDeck()]
    case path === '/review/scores': return [200, reviewScores()]
    case path === '/books': return [200, { books: BOOKS.map(bookListItem) }]
    case /^\/books\/\d+$/.test(path): { const b = BOOKS.find((x) => x.id === id('/books/')); return b ? [200, bookDetail(b)] : [404, { error: 'not found' }] }
    case path === '/annotations': {
      const bid = Number(params.get('book_id'))
      let list = ANNOTATIONS.filter((a) => !bid || a.book_id === bid)
      const color = params.get('color')
      const tag = params.get('tag')
      const mr = Number(params.get('min_rating'))
      if (color) list = list.filter((a) => a.color === color)
      if (tag) list = list.filter((a) => a.tags.includes(tag))
      if (params.get('favorite')) list = list.filter((a) => a.favorite)
      if (mr) list = list.filter((a) => (a.rating || 0) >= mr)
      return [200, { annotations: list.map(annRow) }]
    }
    case path === '/movies': return [200, { movies: MOVIES.map(movieListItem) }]
    case /^\/movies\/\d+$/.test(path): { const m = MOVIES.find((x) => x.id === id('/movies/')); return m ? [200, movieDetail(m)] : [404, { error: 'not found' }] }
    case path === '/dialogues': {
      const mid = Number(params.get('movie_id'))
      let list = DIALOGUES.filter((d) => !mid || d.movie_id === mid)
      const tag = (params.get('tag') || '').toLowerCase()
      const mr = Number(params.get('min_rating'))
      if (tag) list = list.filter((d) => d.tags.some((t) => t.toLowerCase() === tag) || (d.character || '').toLowerCase().includes(tag))
      if (params.get('favorite')) list = list.filter((d) => d.favorite)
      if (mr) list = list.filter((d) => (d.rating || 0) >= mr)
      return [200, { dialogues: list.map(dlgRow) }]
    }
    case path === '/tags': return [200, { tags: tagRows() }]
    case path === '/stickers': return [200, { stickers: STICKERS }]
    case path === '/genres': return [200, { genres: GENRES }]
    case path === '/stats': return [200, stats()]
    case path === '/metadata/library': return [200, metadataLibrary()]
    case path === '/metadata/duplicates': return [200, { groups: [] }]
    case path === '/metadata/status': return [200, { tmdb: { source: 'none' }, tvdb: { source: 'none' }, google_books: { key_set: false }, books_lookup: { ok: null, error: '', checked_at: '' } }]
    case path === '/admin/metadata-keys': return [200, { tmdb_key_set: false, tvdb_key_set: false, google_books_key_set: false, amazon_cookie_set: false, amazon_domain: '', tmdb_source: 'none', tvdb_source: 'none' }]
    case path === '/admin/users': return [200, { users: [{ id: 1, username: 'reader', is_admin: true, created_at: '2026-01-05' }] }]
    case path === '/search': return [200, search(params.get('q'), params.get('scope'))]
    case path === '/people/names': {
      const kind = params.get('kind')
      const referenced = kind === 'actor'
        ? [...new Set(DIALOGUES.map((d) => d.actor).filter(Boolean))]
        : [...new Set(BOOKS.map((b) => b.author).filter((a) => a && a !== '(unknown)'))]
      const rows = new Map()
      for (const n of referenced) rows.set(n.toLowerCase(), { name: n, saved: false, links: '' })
      for (const p of PEOPLE.filter((x) => x.kind === kind)) rows.set(p.name.toLowerCase(), { name: p.name, saved: true, id: p.id, links: p.links })
      return [200, { people: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)) }]
    }
    case path === '/people': {
      const kind = params.get('kind')
      const name = params.get('name')
      const list = PEOPLE.filter((p) => p.kind === kind)
      if (name) {
        const p = list.find((x) => x.name === name)
        return p ? [200, { exists: true, person: p }] : [200, { exists: false, kind, name }]
      }
      return [200, { people: list }]
    }
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
    let body = null
    if (opts.body && typeof opts.body === 'string') {
      try { body = JSON.parse(opts.body) } catch { /* multipart etc. — leave null */ }
    }
    const [status, respBody] = route(method, path, u.searchParams, body)
    return new Response(JSON.stringify(respBody), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
