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
  version: 'demo',
  // showAnthologies is ON here and off for a real fresh account, deliberately: a
  // published demo whose job is to show the app has to show the section, and the
  // default it is overriding is the one the Features card explains.
  preferences: { aesthetic: 'paper', theme: 'light', accent: 'terracotta', showAnthologies: true },
}

// ---- inline artwork (data: URIs) ----
const svgURI = (s) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s)
const coverArt = (bg, fg, title, sub) =>
  svgURI(
    // Explicit width/height (not just viewBox) so the browser gives the inline
    // SVG a firm 2:3 intrinsic size — without them a data-URI cover can size
    // inconsistently under object-cover, nudging the first catalogue tile out
    // of line. (Real builds serve raster covers with real dimensions.)
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">` +
      `<rect width="200" height="300" fill="${bg}"/>` +
      `<rect x="12" y="12" width="176" height="276" fill="none" stroke="${fg}" stroke-opacity=".55" stroke-width="2"/>` +
      `<text x="100" y="140" font-family="Georgia,serif" font-size="19" fill="${fg}" text-anchor="middle">${title}</text>` +
      (sub ? `<text x="100" y="168" font-family="Georgia,serif" font-size="11" fill="${fg}" fill-opacity=".8" text-anchor="middle">${sub}</text>` : '') +
      `</svg>`,
  )
const portraitArt = (bg, initials) =>
  svgURI(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160">` +
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
// status / progress / reads mirror the shelf columns (§3f) so the demo shows the
// whole colour-bar vocabulary at once: one book in progress with a part-filled
// blue bar, one paused, one abandoned, one completed twice (its ×2 chip lists the
// two reads), and one with nothing quoted from it — the derived Wishlist grey.
const BOOKS = [
  // Book 1 is tracked by PAGE (a physical book): pos/pos_total drive the 45%.
  { id: 1, title: 'The Wide Margin', author: 'A. Whitfield', published_year: 1998, genres: ['essays', 'memoir'], series: '', series_index: 0, favorite: true, status: 'reading', progress: 45, pos_unit: 'page', pos: 96, pos_total: 214, cover_path: coverArt('#5C4A33', '#F4EDDE', 'The Wide', 'Margin') },
  { id: 2, title: "Reaper's Gale", author: 'Steven Erikson', published_year: 2007, genres: ['fantasy', 'epic'], series: 'Malazan Book of the Fallen', series_index: 7, favorite: false, status: 'paused', progress: 20, pos_unit: '', pos: 0, pos_total: 0, cover_path: coverArt('#2F3A4A', '#ECE3D1', "Reaper's", 'Gale') },
  // Excluded from the quiz (0033), so the demo shows both halves of the mark:
  // this tile wears its own, and highlight 6 below wears the INHERITED one
  // without any flag of its own. A skipped work with no skipped highlight in it
  // would show only the easy half.
  { id: 3, title: 'Quiet Light', author: 'M. Sinha', published_year: 2015, genres: ['poetry'], series: '', series_index: 0, favorite: false, status: 'completed', progress: 100, cover_path: '', review_excluded: true },
  { id: 4, title: 'The Salt Path', author: 'R. Winn', published_year: 2018, genres: ['memoir', 'nature'], series: '', series_index: 0, favorite: true, status: 'abandoned', progress: 0, cover_path: coverArt('#3F7D5A', '#F4EDDE', 'The Salt', 'Path') },
  { id: 5, title: 'On Colour', author: '(unknown)', published_year: 0, genres: [], series: '', series_index: 0, favorite: false, status: '', progress: 0, cover_path: '' },
]
// Read logs, keyed by book id: a finished-twice book, an open read, and an
// abandoned attempt with a partial (year-only) date — the three outcomes the
// history popover renders differently.
const BOOK_READS = {
  1: [{ id: 1, started_at: '2026-07-02', finished_at: '', outcome: 'open' }],
  2: [{ id: 2, started_at: '2026-05', finished_at: '', outcome: 'open' }],
  3: [
    { id: 3, started_at: '2019', finished_at: '2019-04-18', outcome: 'finished' },
    { id: 4, started_at: '2024-01-06', finished_at: '2024-02-01', outcome: 'finished' },
  ],
  4: [{ id: 5, started_at: '2025-11', finished_at: '2025-12-20', outcome: 'abandoned' }],
}
const MOVIE_READS = {
  1: [{ id: 6, started_at: '2020-02-14', finished_at: '2020-02-14', outcome: 'finished' }],
  3: [{ id: 7, started_at: '2026-07-28', finished_at: '', outcome: 'open' }],
}
const DESCRIPTIONS = {
  1: 'A slim book of essays on attention, reading, and the room we leave in the margins.',
  2: 'The seventh volume of a sprawling epic fantasy.',
  3: 'Poems on stillness and the ordinary.',
  4: 'A memoir of a long coastal walk after losing everything.',
}
const ANNOTATIONS = [
  { id: 1, book_id: 1, quote: 'She kept the margins wider than the text, the way some people keep a spare room — for whoever might arrive.', note: 'the wide-margin argument, again — keep.', color: 'yellow', chapter_no: 3, chapter: 'The wide margin', location: '142', favorite: true, tags: ['memory', 'craft'], noted_at: '2026-02-11', sticker_id: 1, sticker_x: 0.84, sticker_y: 0.06 },
  // Skipped on its own account, in a book that is not — the other half of the
  // pair with highlight 6.
  { id: 2, book_id: 1, quote: 'Quiet is not the absence of sound but the presence of attention.', note: '', color: 'blue', chapter_no: 1, chapter: '', location: '9', favorite: false, tags: ['craft'], noted_at: '2026-03-02', review_excluded: true },
  { id: 3, book_id: 1, quote: 'A margin is a promise: that there is always room to answer back.', note: '', color: 'pink', chapter_no: 5, chapter: 'Answering back', location: '201', favorite: true, tags: ['favourite'], noted_at: '2026-05-19' },
  { id: 4, book_id: 2, quote: 'The dead do not dream, and yet here we are, dreaming them.', note: '', color: 'orange', chapter_no: 0, chapter: '', location: '', favorite: false, tags: ['heartbreak'], noted_at: '2026-06-08' },
  { id: 5, book_id: 2, quote: 'Children. Confront them with a mystery and they will attack it with a hammer.', note: 'so good', color: 'yellow', chapter_no: 0, chapter: '', location: '', favorite: true, tags: ['funny', 'wisdom'], noted_at: '2026-06-21' },
  { id: 6, book_id: 3, quote: 'The lamp does not argue with the dark; it simply keeps its corner.', note: '', color: 'blue', chapter_no: 0, chapter: '', location: '', favorite: false, tags: [], noted_at: '2026-07-01' },
]

// ---- standalone quotes (ROADMAP §24) ----
// Deliberately covers the three shapes the screen has to tell apart: a fully
// attributed line, a second line from the SAME occasion (so the grouping and
// the speaker filter have something to do), and a PROVERB with no speaker and
// no occasion — the one that must stay out of the review deck and still render
// without a stray separator on its meta line.
const UTTERANCES = [
  { id: 1, quote: 'Give me blood, and I will give you freedom.', note: 'the Azad Hind broadcast my grandfather remembered', color: 'blue', favorite: true, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', medium: 'radio', kind: '', tags: ['freedom'], noted_at: '2026-04-02' },
  { id: 2, quote: 'Freedom is not given, it is taken.', note: '', color: 'yellow', favorite: false, speaker: 'Subhas Chandra Bose', occasion: 'Burma Radio broadcast', occasion_date: '1944', place: 'Burma', medium: 'radio', kind: '', tags: [], noted_at: '2026-04-02' },
  { id: 3, quote: 'The only thing we have to fear is fear itself.', note: '', color: 'pink', favorite: false, speaker: 'Franklin D. Roosevelt', occasion: 'first inaugural address', occasion_date: '1933-03-04', place: 'Washington', medium: 'speech', kind: 'speech', tags: ['courage'], noted_at: '2026-05-30' },
  { id: 4, quote: 'Least said, soonest mended.', note: 'my grandmother, about most things', color: 'yellow', favorite: false, speaker: '', occasion: '', occasion_date: '', place: '', medium: '', kind: 'proverb', tags: [], noted_at: '2026-06-14' },
]

// ---- anthologies (2.0.0) ----
//
// TWO OF THEM, because one cannot show what the list is for. The first is a real
// gathering that runs ACROSS the three kinds — a book highlight, a film line and
// something somebody's grandmother said — which is the whole point of the feature
// and the thing a demo of one anthology full of book quotes would not show. The
// second is the empty one somebody has just made, which is the state the tile's
// count exists to report.
//
// The list is sorted by updated_at descending on the server, so these carry
// timestamps that put the worked-on one first.
const ANTHOLOGIES = [
  {
    id: 1,
    title: 'On keeping quiet',
    // The blank line is the reader's paragraph break, and it survives the round
    // trip: trimProse takes the edges off the introduction and leaves its interior
    // alone, so the demo has to carry one or the reading view's prose rule is
    // untested by the published build.
    intro: 'Three people who never met, circling the same idea from three directions.\n\nI keep finding it in different rooms.',
    entries: 3,
    created_at: '2026-07-02 09:14:00',
    updated_at: '2026-08-04 18:02:00',
  },
  {
    id: 2,
    title: 'Beginnings',
    intro: '',
    entries: 0,
    created_at: '2026-08-06 07:40:00',
    updated_at: '2026-08-06 07:40:00',
  },
]

// The entries, in position order and shaped field for field against
// anthologyEntryRow: the anthology's own four facts, then enough of the quote to
// render it without a second request. `work_id` is ABSENT on the standalone quote,
// because the server omits it (omitempty) — a shim that sent 0 would have the card
// offering a doorway to book zero.
const ANTHOLOGY_ENTRIES = {
  1: [
    {
      kind: 'book',
      item_id: 2,
      position: 1,
      note: 'The plainest statement of it, and the one I read first.',
      quote: 'Quiet is not the absence of sound but the presence of attention.',
      quote_note: '',
      color: 'blue',
      favorite: false,
      source: 'The Wide Margin',
      credit: 'A. Whitfield',
      work_id: 1,
    },
    {
      kind: 'screen',
      item_id: 1,
      position: 2,
      note: 'Said in a projection booth, which is the quietest room in any film.',
      quote: "We don't remember days. We remember light, and the room it fell in.",
      quote_note: '',
      color: 'yellow',
      favorite: true,
      source: 'Northline',
      credit: 'Mira · E. Sen',
      work_id: 1,
    },
    {
      kind: 'utterance',
      item_id: 4,
      position: 3,
      note: 'And the shortest version, which nobody wrote down.',
      quote: 'Least said, soonest mended.',
      quote_note: 'my grandmother, about most things',
      color: 'yellow',
      favorite: false,
      source: '',
      credit: '',
    },
  ],
  2: [],
}

// ---- movies + dialogues ----
const MOVIES = [
  { id: 1, title: 'Northline', director: 'R. Whitfield', release_year: 1978, genres: ['drama', 'night'], series: 'Northline Diptych', series_index: 1, favorite: true, media_type: 'movie', status: 'completed', progress: 100, poster_path: coverArt('#1D1710', '#D6A25C', 'NORTHLINE', '1978') },
  { id: 2, title: 'The Long Take', director: 'H. Okonkwo', release_year: 2009, genres: ['noir'], series: '', series_index: 0, favorite: false, media_type: 'movie', status: '', progress: 0, poster_path: coverArt('#15100C', '#A2937C', 'THE LONG', 'TAKE') },
  // A show is positioned in two dimensions: season 2 of 3, episode 6 of 10 —
  // ((2-1) + 6/10) / 3 = 53%, whole earlier seasons counting in full.
  { id: 3, title: 'Reel Seven', director: 'A. Costa', release_year: 2021, genres: ['drama'], series: '', series_index: 0, favorite: false, media_type: 'show', status: 'watching', progress: 53, pos_unit: 'episode', pos: 6, pos_total: 10, season: 2, season_total: 3, poster_path: '' },
  { id: 4, title: 'Southline', director: 'R. Whitfield', release_year: 1982, genres: ['drama'], series: 'Northline Diptych', series_index: 2, favorite: false, media_type: 'movie', status: '', progress: 0, poster_path: '' },
  // A GAME (0040), so the demo exercises the third media type rather than
  // showing a catalogue that cannot have one. `director` holds the STUDIO —
  // that is the whole design, and a fixture that used a separate field would
  // have the demo disagreeing with the server about where a studio lives.
  // Status is 'playing', not 'watching': a shim carrying the wrong word here
  // would render the Games chip over a board whose shelf bar says Watching.
  //
  // `publisher` is a SECOND company, and it is here because 0042 split it out of
  // `director`: the demo has to show the two credits reading differently, or the
  // one screen where the distinction is visible would look identical to the bug
  // it replaced.
  { id: 5, title: 'Hollow Reach', director: 'Lantern Works', publisher: 'Ninefold Games', release_year: 2019, genres: ['adventure'], series: 'Reach', series_index: 1, favorite: true, media_type: 'game', status: 'playing', progress: 35, igdb_id: 90210, poster_path: coverArt('#101A18', '#7FB7A8', 'HOLLOW', 'REACH') },
]
const MOVIE_DESCRIPTIONS = {
  1: 'Two strangers share a night train north; neither says where they are going.',
  2: 'A single unbroken take through a city that keeps changing behind the camera.',
  4: 'The companion piece, twenty years on, heading the other way.',
  5: 'A lantern, a flooded stairwell, and whatever is still down there.',
}
const CAST = {
  1: [{ character: 'Mira', actor: 'E. Sen' }, { character: 'Joel', actor: 'D. Kapoor' }],
  2: [{ character: 'Vaughn', actor: 'T. Marsh' }],
  3: [{ character: 'Ana', actor: 'L. Reyes' }],
  4: [{ character: 'Mira', actor: 'E. Sen' }],
  // A game's voice cast is the same {character, actor} shape as a film's — it is
  // the same cast_json column, which is why the Wikidata walk returns CastMember
  // rather than a games-only type.
  5: [{ character: 'The Warden', actor: 'N. Achebe' }],
}
// EVERY LINE CARRIES A COLOUR, because every dialogues row on the server does:
// the column is TEXT NOT NULL DEFAULT 'yellow', so "no colour" is not a state
// that exists. These had none at all, so the demo's film lines rendered through
// `categoryVar(d.color) || 'var(--hl-1)'` and came out as slot 1 — which is a
// real category somebody may have named, i.e. the app asserting a category
// nobody chose, on every line, in the one build strangers see.
const DIALOGUES = [
  { id: 1, movie_id: 1, quote: "We don't remember days. We remember light, and the room it fell in.", note: '', color: 'yellow', character: 'Mira', actor: 'E. Sen', timestamp: '01:12:04', favorite: true, tags: ['light'], sticker_id: 2, sticker_x: 0.86, sticker_y: 0.1 },
  { id: 2, movie_id: 1, quote: 'You came back. Nobody comes back.', note: '', color: 'pink', character: 'Joel', actor: 'D. Kapoor', timestamp: '00:41:52', favorite: false, tags: [] },
  { id: 3, movie_id: 1, quote: 'Roll the reel. Let them see what we were.', note: '', color: 'green', character: 'Mira', actor: 'E. Sen', timestamp: '01:48:20', favorite: true, tags: ['light'] },
  { id: 4, movie_id: 2, quote: 'Every alibi is a little story we tell the clock.', note: '', color: 'blue', character: 'Vaughn', actor: 'T. Marsh', timestamp: '00:22:10', favorite: false, tags: ['craft'] },
  // Movie 3 is a show, so its lines carry the episode they are from. Season 0 is
  // the specials strand — a real season, which is why unset has to be null.
  { id: 5, movie_id: 3, quote: 'Seven reels, seven ways to lie about a summer.', note: '', color: 'purple', character: 'Ana', actor: 'L. Reyes', season: 1, episode: 1, timestamp: '00:08:31', favorite: true, tags: ['craft'] },
  { id: 6, movie_id: 3, quote: 'You cut the part where I was happy.', note: '', color: 'orange', character: 'Ana', actor: 'L. Reyes', season: 2, episode: 6, timestamp: '00:34:02', favorite: false, tags: [] },
  { id: 7, movie_id: 3, quote: 'The pilot never aired. Ask me why.', note: '', color: 'yellow', character: 'Ana', actor: 'L. Reyes', season: 0, episode: 1, timestamp: '', favorite: false, tags: [] },
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

// tagged_count / noted_count mirror the two subqueries in handleListBooks /
// handleListMovies — they drive the "tagged" and "has notes" filter chips, which
// would silently match nothing here without them.
// read_count mirrors readCounts() on the server: finished reads only, which is
// what the "×2" chip counts (an abandoned attempt is history, not a read).
const finishedCount = (reads) => (reads || []).filter((r) => r.outcome === 'finished').length
function bookListItem(b) {
  const own = ANNOTATIONS.filter((a) => a.book_id === b.id)
  return {
    ...b,
    annotation_count: own.length,
    tagged_count: own.filter((a) => (a.tags || []).length > 0).length,
    noted_count: own.filter((a) => (a.note || '').trim() !== '').length,
    read_count: finishedCount(BOOK_READS[b.id]),
  }
}
function bookDetail(b) {
  return { ...b, isbn: '', asin: '', description: DESCRIPTIONS[b.id] || '', reads: BOOK_READS[b.id] || [], created_at: '2026-01-10 09:00:00' }
}
function movieListItem(m) {
  const own = DIALOGUES.filter((d) => d.movie_id === m.id)
  return {
    ...m,
    dialogue_count: own.length,
    tagged_count: own.filter((d) => (d.tags || []).length > 0).length,
    noted_count: own.filter((d) => (d.note || '').trim() !== '').length,
    read_count: finishedCount(MOVIE_READS[m.id]),
    // Derived from the LINES, exactly as handleListMovies derives it, and not
    // from CAST[m.id] — which is right there and would have been the obvious
    // thing to reach for. A cast entry says the actor was in the film; this says
    // you kept something they said, and the two disagree for every film whose
    // cast you fetched and whose lines you have not saved. A shim that answers
    // the easier question is how a demo board filters to a film the real one
    // would have left out.
    actors: [...new Set(own.map((d) => d.actor).filter(Boolean))].sort(),
  }
}
function movieDetail(m) {
  return { ...m, tmdb_id: 0, tvdb_id: 0, description: MOVIE_DESCRIPTIONS[m.id] || '', cast: CAST[m.id] || [], reads: MOVIE_READS[m.id] || [], created_at: '2026-01-10 09:00:00' }
}
// A UTC timestamp n days ago in the stored "YYYY-MM-DD HH:MM:SS" shape.
function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ')
}
// Canned spaced-repetition state so the status dots (v0.5.0) show the full
// spread in the demo: book 1 remembered (green), 2 forgetting (yellow), 3
// probably-forgotten (red); everything else unseen. Stabilities respect the
// 7-day half-life floor so the derived statuses match the labels.
const DEMO_REVIEW = {
  'book:1': { reviewed: true, stability: 30, last_reviewed_at: daysAgo(1) },
  'book:2': { reviewed: true, stability: 8, last_reviewed_at: daysAgo(4) },
  'book:3': { reviewed: true, stability: 7, last_reviewed_at: daysAgo(20) },
  'screen:1': { reviewed: true, stability: 20, last_reviewed_at: daysAgo(2) },
}
function demoReview(kind, id) {
  return DEMO_REVIEW[`${kind}:${id}`] || { reviewed: false, stability: 0, last_reviewed_at: '' }
}
// demoStatus mirrors reviewStatus (ui.jsx) over the canned rows — floored
// half-life, no lapses, every demo item past its new-item grace week. Uses the
// underscore key ("probably_forgotten") the /stats shapes want.
function demoStatus(kind, id) {
  const r = DEMO_REVIEW[`${kind}:${id}`]
  if (!r) return 'unseen'
  const days = (Date.now() - Date.parse(r.last_reviewed_at.replace(' ', 'T') + 'Z')) / 86400000
  const p = Math.pow(2, -days / Math.max(r.stability, 7))
  return p >= 0.9 ? 'remembered' : p >= 0.5 ? 'forgetting' : 'probably_forgotten'
}

function annRow(a) {
  const b = BOOKS.find((x) => x.id === a.book_id) || {}
  return {
    sticker_id: null, sticker_x: null, sticker_y: null,
    book_title: b.title || '', book_author: b.author || '',
    // Borrowed from the book the same way the title and the author above are —
    // see annotationRow. Before `...a`, so a highlight's own flag can never be
    // overwritten by its parent's.
    work_review_excluded: !!b.review_excluded,
    ...a,
    ...demoReview('book', a.id),
    created_at: a.noted_at + ' 09:00:00', updated_at: a.noted_at + ' 09:00:00',
  }
}

// uttRow mirrors utteranceRow on the server: the shared quote half plus the
// occasion. sticker fields are null rather than absent — utteranceState reads
// them with `??`, and undefined would be indistinguishable from unset.
function uttRow(u) {
  return {
    sticker_id: null, sticker_x: null, sticker_y: null,
    ...u,
    ...demoReview('utterance', u.id),
    created_at: u.noted_at + ' 09:00:00', updated_at: u.noted_at + ' 09:00:00',
  }
}

// ---- Daily Quiz & Practice (ROADMAP №2, v0.5.0): live little decks so the
// Home screen's ritual can actually be played in the demo. Session-only —
// reload resets it. The reveal/grade flow and both modes work for real.
const REVIEW_DECK = [1, 5, 4] // annotation ids, "due" order
const review = { touched: new Set(), got: 0, forgot: 0 }
// `cleared` is what a practice reset means on the Stats calendar, not just on
// the score. The server's DELETE /review/practice removes the quiz_sessions rows
// outright, so the calendar afterwards has nothing left to draw; the demo used
// to zero the three counters and go on serving a full synthetic year of practice
// dots beside them, which said the reset had not worked.
const practice = { answered: 0, got: 0, forgot: 0, cleared: false }

// demoShuffle / demoMCQ attach multiple-choice options the way review_handlers.go
// does — options are titles (source direction) or quotes (quote direction), with
// the correct one's index.
function demoShuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function demoMCQ(card) {
  if (card.direction === 'source') {
    const pool = (card.kind === 'book' ? BOOKS : MOVIES).map((x) => x.title).filter((t) => t && t !== card.title)
    const opts = demoShuffle([card.title, ...demoShuffle(pool).slice(0, 3)])
    return { options: opts, answer: opts.indexOf(card.title) }
  }
  const correct = card.quote || card.note
  const pool = (card.kind === 'book' ? ANNOTATIONS : DIALOGUES).map((x) => x.quote).filter((q) => q && q !== correct)
  const opts = demoShuffle([correct, ...demoShuffle(pool).slice(0, 3)])
  return { options: opts, answer: opts.indexOf(correct) }
}

// reviewCard shapes a card the way review_handlers.go does.
function bookCard(a, direction) {
  const b = BOOKS.find((x) => x.id === a.book_id) || {}
  const card = {
    kind: 'book', id: a.id, direction: direction || (a.id % 2 ? 'source' : 'quote'),
    quote: a.quote || '', note: a.note || '', color: a.color || 'yellow',
    title: b.title || '', author: b.author || '', character: '',
    chapter: a.chapter || '', chapter_no: a.chapter_no || 0, location: a.location || '', timestamp: '', season: null, episode: null, media_type: '',
    stability: 7, review_count: 0, status: 'unseen',
  }
  return { ...card, ...demoMCQ(card) }
}
function screenCard(d, direction) {
  const m = MOVIES.find((x) => x.id === d.movie_id) || {}
  const card = {
    kind: 'screen', id: d.id, direction: direction || (d.id % 2 ? 'source' : 'quote'),
    quote: d.quote || '', note: d.note || '', color: '',
    title: m.title || '', author: '', character: d.character || '',
    chapter: '', chapter_no: 0, location: '', timestamp: d.timestamp || '',
    season: d.season ?? null, episode: d.episode ?? null, media_type: m.media_type || 'movie',
    stability: 7, review_count: 0, status: 'unseen',
  }
  return { ...card, ...demoMCQ(card) }
}
function reviewItems() {
  return REVIEW_DECK.filter((id) => !review.touched.has(id))
    .map((id) => bookCard(ANNOTATIONS.find((x) => x.id === id)))
}
function demoStates() {
  const c = { unseen: 0, remembered: 0, forgetting: 0, probably_forgotten: 0, total: 0 }
  for (const a of ANNOTATIONS) { c[demoStatus('book', a.id)]++; c.total++ }
  for (const d of DIALOGUES) { c[demoStatus('screen', d.id)]++; c.total++ }
  return c
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
    return { ok: true, kind, id, stability: 7, status: 'unseen', mode, answered: practice.answered, got: practice.got, forgot: practice.forgot }
  }
  review.touched.add(id)
  if (result === 'got') review.got++
  if (result === 'forgot') review.forgot++
  return {
    ok: true, kind, id, stability: 7, status: result === 'got' ? 'remembered' : 'probably-forgotten', mode: 'daily',
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
  const m = MOVIES.find((x) => x.id === d.movie_id) || {}
  return { sticker_id: null, sticker_x: null, sticker_y: null, work_review_excluded: !!m.review_excluded, ...d, ...demoReview('screen', d.id), created_at: '2026-06-01 09:00:00', updated_at: '2026-06-01 09:00:00' }
}

// A deterministic year of activity for the Stats calendars: a stable hash
// scatters days, `keepBelow` sets the density (out of 100), `salt` varies the
// pattern per stream so Saves / Quiz / Practice don't overlap identically.
//
// `withGot` mirrors the review series the server sends for Quiz and Practice
// (quiz_sessions.answered + .got): those days report accuracy on hover, not just
// volume, and a demo whose review days carry no `got` would quietly show the
// half of that tooltip the Saves calendar already had. Derived from the same
// hash so it stays stable across reloads, and never above `count` — an accuracy
// over 100% is the one number a demo must not invent.
function demoActivity(salt, keepBelow, withGot = false) {
  const out = []
  for (let i = 364; i >= 0; i--) {
    const h = ((i + salt) * 2654435761) % 100
    if (h >= keepBelow) continue
    const d = new Date(Date.now() - i * 86400000)
    const count = 1 + (h % 4)
    const day = {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      count,
    }
    if (withGot) day.got = Math.min(count, Math.round((count * (55 + (h % 46))) / 100))
    out.push(day)
  }
  return out
}

// demoTimeline mirrors timelineYears (stats_handlers.go): one row per year the
// library touches, works and quotes counted separately, ordered.
//
// The demo had no timeline at all, so the Stats page showed the card's empty
// state — a chart that shipped in 1.7.4 and that nobody looking at the demo has
// ever seen. It is derived here rather than written out, for the same reason the
// breakdown is: a hand-kept second copy of the seed data disagrees with it on
// the first edit.
//
// A STANDALONE QUOTE IS NOT A WORK. It contributes to `quotes` at the year on
// its own occasion_date and to `works` never — it came from no book and no film,
// so there is nothing for it to count as. Books and films count as one work each
// at their own year, and every annotation or dialogue counts as a quote at the
// year of the work it came from. Anything with no year is simply absent: there
// is no "unknown" bucket, because a column labelled "no year" beside the 1970s
// invites reading it as a point in time.
function demoTimeline() {
  const years = new Map()
  const add = (year, works, quotes) => {
    if (!Number.isFinite(year) || year === 0) return
    const cur = years.get(year) || { year, works: 0, quotes: 0 }
    cur.works += works
    cur.quotes += quotes
    years.set(year, cur)
  }
  for (const b of BOOKS) add(b.published_year, 1, 0)
  for (const m of MOVIES) add(m.release_year, 1, 0)
  for (const a of ANNOTATIONS) add(BOOKS.find((b) => b.id === a.book_id)?.published_year, 0, 1)
  for (const d of DIALOGUES) add(MOVIES.find((m) => m.id === d.movie_id)?.release_year, 0, 1)
  // Partial dates: the year is the front of 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD',
  // the same slice the server's substr() takes.
  for (const u of UTTERANCES) add(parseInt(String(u.occasion_date || '').slice(0, 5), 10), 0, 1)
  return [...years.values()].sort((a, b) => a.year - b.year)
}

// demoPractice — the Practice calendar, which is the one activity stream the
// reader can empty. Before a reset it is a synthetic year like the other two;
// after one it holds only what has been practised since, which in a session-only
// demo is today or nothing at all.
function demoPractice() {
  if (!practice.cleared) return demoActivity(13, 15, true)
  if (!practice.answered) return []
  const d = new Date()
  return [{
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    count: practice.answered,
    got: practice.got,
  }]
}

// demoBreakdown mirrors statsBreakdown (stats_handlers.go): per-kind entities
// with works, quotes, and where those quotes sit on the forgetting curve. The
// demo credits are single names, so no multi-author splitting is needed here.
function demoBreakdown() {
  const kinds = { authors: {}, books: {}, series: {}, films: {}, shows: {}, directors: {}, actors: {} }
  const touch = (kind, name, workKey) => {
    name = (name || '').trim()
    if (!name || name === '(unknown)') return null
    const rows = kinds[kind]
    const r = rows[name] || (rows[name] = {
      name, workSet: new Set(), works: 0, quotes: 0,
      remembered: 0, forgetting: 0, probably_forgotten: 0, unseen: 0,
    })
    if (workKey) r.workSet.add(workKey)
    return r
  }
  const quote = (kind, name, workKey, status) => {
    const r = touch(kind, name, workKey)
    if (r) { r.quotes++; r[status]++ }
  }
  for (const b of BOOKS) {
    const key = `b${b.id}`
    const row = touch('books', b.title, key)
    if (row && !row.cover_path && b.cover_path) row.cover_path = b.cover_path
    touch('authors', b.author, key); touch('series', b.series, key)
  }
  for (const a of ANNOTATIONS) {
    const b = BOOKS.find((x) => x.id === a.book_id) || {}
    const st = demoStatus('book', a.id)
    const key = `b${b.id}`
    quote('books', b.title, key, st); quote('authors', b.author, key, st); quote('series', b.series, key, st)
  }
  for (const m of MOVIES) {
    const key = `m${m.id}`
    const row = touch(m.media_type === 'show' ? 'shows' : 'films', m.title, key)
    if (row && !row.cover_path && m.poster_path) row.cover_path = m.poster_path
    touch('directors', m.director, key); touch('series', m.series, key)
  }
  for (const d of DIALOGUES) {
    const m = MOVIES.find((x) => x.id === d.movie_id) || {}
    const st = demoStatus('screen', d.id)
    const key = `m${m.id}`
    quote(m.media_type === 'show' ? 'shows' : 'films', m.title, key, st)
    quote('directors', m.director, key, st)
    quote('actors', d.actor, key, st)
    quote('series', m.series, key, st)
  }
  const out = {}
  for (const [kind, rows] of Object.entries(kinds)) {
    const all = Object.values(rows).map(({ workSet, ...r }) => ({ ...r, works: workSet.size }))
    all.sort((a, z) => z.quotes - a.quotes || z.works - a.works || a.name.localeCompare(z.name))
    const best = (of) => all.filter((r) => of(r) > 0).sort((a, z) => of(z) - of(a))[0] || null
    out[kind] = {
      count: all.length,
      top: all.slice(0, 8),
      most_remembered: best((r) => r.remembered),
      most_forgotten: best((r) => r.probably_forgotten),
    }
  }
  return out
}

function stats() {
  const genreSet = new Set()
  BOOKS.forEach((b) => b.genres.forEach((g) => genreSet.add(g)))
  MOVIES.forEach((m) => m.genres.forEach((g) => genreSet.add(g)))
  // Every kind that wears a colour, matching the server: annotations,
  // dialogues (0021) and standalone quotes (0026).
  const colors = { yellow: 0, blue: 0, pink: 0, orange: 0 }
  for (const x of [...ANNOTATIONS, ...DIALOGUES, ...UTTERANCES]) {
    if (colors[x.color] != null) colors[x.color]++
  }
  const tagCounts = {}
  for (const x of [...ANNOTATIONS, ...DIALOGUES, ...UTTERANCES]) {
    for (const t of x.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1
  }
  const topTags = Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, z) => z.count - a.count || a.name.localeCompare(z.name))
    .slice(0, 5)
  return {
    books: BOOKS.length,
    annotations: ANNOTATIONS.length,
    movies: MOVIES.length,
    dialogues: DIALOGUES.length,
    quotes: UTTERANCES.length,
    tags: TAGS.length,
    favorites:
      ANNOTATIONS.filter((a) => a.favorite).length +
      DIALOGUES.filter((d) => d.favorite).length +
      UTTERANCES.filter((u) => u.favorite).length,
    genres: genreSet.size,
    most_annotated: { id: 1, title: 'The Wide Margin', cover_path: BOOKS[0].cover_path, count: 3 },
    most_quoted: { id: 1, title: 'Northline', cover_path: MOVIES[0].poster_path, count: 3 },
    busiest_month: { month: new Date().toISOString().slice(0, 7), count: 12 },
    daily_activity: demoActivity(0, 34),
    daily_quiz: demoActivity(7, 24, true),
    daily_practice: demoPractice(),
    timeline: demoTimeline(),
    colors,
    top_tags: topTags,
    first_saved: '2026-02-11',
    // stabilities floored at 7: (30 + 8 + 7 + 20) / 4
    recall: { states: demoStates(), reviewed: Object.keys(DEMO_REVIEW).length, avg_half_life: 16.25 },
    breakdown: demoBreakdown(),
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

// search mirrors the faceted hit shapes (search_handler.go): results are
// sectioned by WHAT matched — titles, credits, quotes, notes, tags, genres —
// plus the structured decade and date-added facets. Parent fields ride along
// so the Search page's group-by (author/decade/series/genre) works.
function search(q, scope) {
  const s = (q || '').trim().toLowerCase()
  const hit = (txt) => s && String(txt || '').toLowerCase().includes(s)
  const mv = (id) => MOVIES.find((m) => m.id === id) || {}
  const bk = (id) => BOOKS.find((b) => b.id === id) || {}
  // `review_excluded` on every hit, and the parent's on the two child kinds —
  // the same five shapes search_handler.go returns. A shim that answers a
  // request the app now reads a field out of, without that field, is the
  // `created_at`/`created` class of drift all over again: nothing throws, and
  // the one screen that reads it quietly shows the wrong thing forever.
  const bookHit = (b) => ({ id: b.id, title: b.title, author: b.author, cover_path: b.cover_path, genres: b.genres, published_year: b.published_year, series: b.series, series_index: b.series_index, review_excluded: !!b.review_excluded })
  const movieHit = (m) => ({ id: m.id, title: m.title, director: m.director, release_year: m.release_year, poster_path: m.poster_path, genres: m.genres, series: m.series, series_index: m.series_index, media_type: m.media_type || 'movie', review_excluded: !!m.review_excluded })
  const annHit = (a) => { const b = bk(a.book_id); return { id: a.id, book_id: a.book_id, book_title: b.title || '', book_cover_path: b.cover_path || '', book_author: b.author || '', book_published_year: b.published_year || 0, book_series: b.series || '', book_genres: b.genres || [], quote: a.quote, note: a.note, color: a.color, review_excluded: !!a.review_excluded, work_review_excluded: !!b.review_excluded } }
  const dlgHit = (d) => { const m = mv(d.movie_id); return { id: d.id, movie_id: d.movie_id, movie_title: m.title || '', movie_poster_path: m.poster_path || '', movie_director: m.director || '', movie_release_year: m.release_year || 0, movie_series: m.series || '', movie_genres: m.genres || [], movie_media_type: m.media_type || 'movie', quote: d.quote, note: d.note || '', color: d.color, character: d.character, actor: d.actor, timestamp: d.timestamp, season: d.season ?? null, episode: d.episode ?? null, review_excluded: !!d.review_excluded, work_review_excluded: !!m.review_excluded } }

  const uttHit = (u) => ({ id: u.id, quote: u.quote, note: u.note || '', color: u.color, speaker: u.speaker, occasion: u.occasion, occasion_date: u.occasion_date, place: u.place, medium: u.medium, kind: u.kind || '', review_excluded: !!u.review_excluded })

  const wantBooks = !scope || scope === 'all' || scope === 'books'
  const wantAnnotations = !scope || scope === 'all' || scope === 'annotations'
  const wantMovies = !scope || scope === 'all' || scope === 'movies'
  const wantDialogues = !scope || scope === 'all' || scope === 'dialogues'
  const wantQuotes = !scope || scope === 'all' || scope === 'quotes'

  const out = {
    books: [], annotations: [], movies: [], dialogues: [], quotes: [],
    authors: [], directors: [], actors: [], characters: [], speakers: [],
    notes: { annotations: [], dialogues: [], quotes: [] },
    tags: [], genres: [], decade: null, date_added: null,
  }
  if (!s) return out

  const credit = (list, name, key, mk, row) => {
    let g = list.find((x) => x.name === name)
    if (!g) list.push((g = { name, [key]: [] }))
    g[key].push(mk(row))
  }
  if (wantBooks) {
    out.books = BOOKS.filter((b) => hit(b.title) || hit(b.series)).map(bookHit)
    for (const b of BOOKS.filter((b) => hit(b.author))) credit(out.authors, b.author, 'books', bookHit, b)
  }
  if (wantAnnotations) {
    out.annotations = ANNOTATIONS.filter((a) => hit(a.quote)).map(annHit)
    out.notes.annotations = ANNOTATIONS.filter((a) => hit(a.note)).map(annHit)
  }
  if (wantQuotes) {
    // Quote AND occasion, matching the server's one facet over both — the
    // occasion is the title here, and searching for it is the natural thing.
    out.quotes = UTTERANCES.filter((u) => hit(u.quote) || hit(u.occasion)).map(uttHit)
    out.notes.quotes = UTTERANCES.filter((u) => hit(u.note)).map(uttHit)
    for (const u of UTTERANCES.filter((u) => hit(u.speaker))) credit(out.speakers, u.speaker, 'quotes', uttHit, u)
  }
  if (wantMovies) {
    out.movies = MOVIES.filter((m) => hit(m.title) || hit(m.series)).map(movieHit)
    for (const m of MOVIES.filter((m) => hit(m.director))) credit(out.directors, m.director, 'movies', movieHit, m)
  }
  if (wantDialogues) {
    // The WORDS only. `character` moved out of this filter in 1.16.0 and into
    // its own section below, mirroring the server exactly — see the long note in
    // search_handler.go. Leaving it here would put every character match under a
    // film poster in the demo and under a name in the real app, which is the
    // demo-shim drift this file keeps being bitten by.
    out.dialogues = DIALOGUES.filter((d) => hit(d.quote)).map(dlgHit)
    for (const d of DIALOGUES.filter((d) => hit(d.actor))) credit(out.actors, d.actor, 'dialogues', dlgHit, d)
    for (const d of DIALOGUES.filter((d) => hit(d.character))) credit(out.characters, d.character, 'dialogues', dlgHit, d)
    out.notes.dialogues = DIALOGUES.filter((d) => hit(d.note)).map(dlgHit)
  }
  if (wantAnnotations || wantDialogues) {
    for (const t of TAGS.filter((t) => hit(t.name))) {
      const anns = wantAnnotations ? ANNOTATIONS.filter((a) => (a.tags || []).includes(t.name)) : []
      const dlgs = wantDialogues ? DIALOGUES.filter((d) => (d.tags || []).includes(t.name)) : []
      out.tags.push({ name: t.name, count: anns.length + dlgs.length, annotations: anns.map(annHit), dialogues: dlgs.map(dlgHit) })
    }
  }
  if (wantBooks || wantMovies) {
    for (const gn of GENRES.filter((g) => hit(g))) {
      const books = wantBooks ? BOOKS.filter((b) => b.genres.includes(gn)).map(bookHit) : []
      const movies = wantMovies ? MOVIES.filter((m) => m.genres.includes(gn)).map(movieHit) : []
      if (books.length + movies.length) out.genres.push({ name: gn, books, movies })
    }
  }
  // Structured facets: a decade query ("1990s" / "70s"); and any ISO date reads
  // as a date-added query — the demo pretends a couple of captures landed that
  // day so the Stats calendar's dot links demonstrate the flow.
  const dm = /^(\d{2}|\d{4})['’]?s$/.exec(s)
  if (dm) {
    let n = Number(dm[1])
    if (dm[1].length === 2) n += n <= 20 ? 2000 : 1900
    n -= n % 10
    const inDecade = (y) => y >= n && y <= n + 9
    const books = wantBooks ? BOOKS.filter((b) => inDecade(b.published_year)).map(bookHit) : []
    const movies = wantMovies ? MOVIES.filter((m) => inDecade(m.release_year)).map(movieHit) : []
    if (books.length + movies.length) out.decade = { label: `${n}s`, books, movies }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    out.date_added = {
      date: s,
      books: [],
      movies: [],
      annotations: wantAnnotations ? ANNOTATIONS.slice(0, 2).map(annHit) : [],
      dialogues: wantDialogues ? DIALOGUES.slice(0, 1).map(dlgHit) : [],
    }
  }
  return out
}

const RO = { error: 'This is a read-only demo — changes are not saved. Self-host Tippani to edit your own library.' }

// Exported for tests. It is a pure (method, path, params, body) function with
// no fetch and no DOM, so the shim's shapes can be asserted directly — and the
// shapes are the whole risk here: a demo answer that is close but not identical
// to the server's is a bug that only ever shows up in the demo.
export function route(method, path, params, body) {
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
      practice.cleared = true
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
    // The words the interface is in. A static host has no data/Locales, so the
    // honest answer is the two languages that ship in the box and no added files
    // — which is also exactly what a fresh self-hosted instance answers.
    case path === '/locales': return [200, { builtin: ['en', 'bn'], files: {} }]
    case path === '/admin/update/check':
      return [200, { current: 'demo', image: 'ghcr.io/aaronified/tippani', socket: false, can_self_update: false, update_available: false, guided_command: 'docker compose up -d --pull always --force-recreate' }]
    // The demo has no backend, so a missed case here shows an empty dialog on the
    // published Pages build rather than failing loudly. Three releases is enough
    // to show the shape: newest first, the running one marked, the rest folded.
    case path === '/changelog':
      return [200, {
        current: 'demo',
        current_listed: false,
        releases: [
          {
            version: '1.12.0', date: '2026-08-14',
            sections: [
              { title: 'Added', entries: ['**A translator and an editor**, beside the author. Both are real people \u2014 portrait, life, links, their own page.'] },
              { title: 'Changed', entries: ['The bar a selection puts up is **three glyphs and a `\u22ef`**, instead of eleven words.'] },
            ],
          },
          {
            version: '1.11.2', date: '2026-08-14',
            sections: [{ title: 'Fixed', entries: ['Making a backup no longer downloads it.'] }],
          },
          {
            version: '1.11.1', date: '2026-08-13',
            sections: [{ title: 'Changed', entries: ['A long press now means three different things, decided by what is under your thumb.'] }],
          },
        ],
      }]
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
      if (color) list = list.filter((a) => a.color === color)
      if (tag) list = list.filter((a) => a.tags.includes(tag))
      if (params.get('favorite')) list = list.filter((a) => a.favorite)
      return [200, { annotations: list.map(annRow) }]
    }
    case path === '/movies': return [200, { movies: MOVIES.map(movieListItem) }]
    case /^\/movies\/\d+$/.test(path): { const m = MOVIES.find((x) => x.id === id('/movies/')); return m ? [200, movieDetail(m)] : [404, { error: 'not found' }] }
    case path === '/dialogues': {
      const mid = Number(params.get('movie_id'))
      let list = DIALOGUES.filter((d) => !mid || d.movie_id === mid)
      const tag = (params.get('tag') || '').toLowerCase()
      if (tag) list = list.filter((d) => d.tags.some((t) => t.toLowerCase() === tag) || (d.character || '').toLowerCase().includes(tag))
      if (params.get('favorite')) list = list.filter((d) => d.favorite)
      return [200, { dialogues: list.map(dlgRow) }]
    }
    // The response key is `utterances`, the table — not `quotes`, the route.
    // A shim that answered the friendlier name would break the screen while
    // looking correct in this file.
    case path === '/quotes': {
      let list = UTTERANCES
      const color = params.get('color')
      const tag = (params.get('tag') || '').toLowerCase()
      const speaker = params.get('speaker')
      if (color) list = list.filter((u) => u.color === color)
      if (tag) list = list.filter((u) => (u.tags || []).some((t) => t.toLowerCase() === tag))
      if (speaker) list = list.filter((u) => u.speaker === speaker)
      if (params.get('favorite')) list = list.filter((u) => u.favorite)
      return [200, { utterances: list.map(uttRow) }]
    }
    // The three envelopes the anthology routes actually use: the list is wrapped
    // under `anthologies`, one is wrapped under `anthology` WITH its entries beside
    // it, and `entries` on a detail row is the live length rather than the stored
    // count. A shim that guessed one envelope for all three would look right here
    // and break the screen.
    case path === '/anthologies': return [200, { anthologies: ANTHOLOGIES }]
    case /^\/anthologies\/\d+$/.test(path): {
      const a = ANTHOLOGIES.find((x) => x.id === id('/anthologies/'))
      if (!a) return [404, { error: 'anthology not found' }]
      const entries = ANTHOLOGY_ENTRIES[a.id] || []
      return [200, { anthology: { ...a, entries: entries.length }, entries }]
    }
    case path === '/tags': return [200, { tags: tagRows() }]
    case path === '/stickers': return [200, { stickers: STICKERS }]
    case path === '/genres': return [200, { genres: GENRES }]
    case path === '/stats': return [200, stats()]
    case path === '/metadata/library': return [200, metadataLibrary()]
    case path === '/metadata/duplicates': return [200, { groups: [] }]
    // Field for field against handleMetadataStatus / handleGetMetadataKeys. The
    // igdb keys are reported as a PAIR of booleans on the admin route and as one
    // source on the status route, exactly as the server does — a shim that
    // collapsed them would have Settings claiming the key is set when only the
    // client id is.
    case path === '/metadata/status': return [200, { tmdb: { source: 'none' }, tvdb: { source: 'none' }, igdb: { source: 'none' }, igdb_key_set: false, google_books: { key_set: false }, books_lookup: { ok: null, error: '', checked_at: '' } }]
    case path === '/admin/metadata-keys': return [200, { tmdb_key_set: false, tvdb_key_set: false, google_books_key_set: false, amazon_cookie_set: false, amazon_domain: '', tmdb_source: 'none', tvdb_source: 'none', igdb_client_id_set: false, igdb_secret_set: false, igdb_source: 'none' }]
    case path === '/admin/users': return [200, { users: [{ id: 1, username: 'reader', is_admin: true, created_at: '2026-01-05' }] }]
    // Settings' Devices and Backup cards. Both were falling through to the
    // catch-all below, which answers 200 {} — so `r.data.devices` came back
    // undefined and the card threw on it, taking the whole Settings page down
    // with it. Anything Settings reads has to be answered explicitly here.
    case path === '/auth/devices':
      return [200, { devices: [{ id: 1, name: 'Pixel 8', created_at: '2026-07-28', last_seen_at: '2026-08-03' }] }]
    // Shape-matched to the real handler, field for field. It said `created_at`
    // where the server says `created`, so the card rendered "Invalid Date" —
    // a shim that is close but not identical is a bug that only shows up here.
    // `key`/`account` are how the card knows the archive is sealed with the demo
    // user's own password (see backup_crypto.go).
    case path === '/admin/backup':
      return [200, { backup: { name: 'tippani-backup-20260803-114500.tpbk', size: 4823910, created: '2026-08-03T11:45:00Z', key: 'account', account: 'reader' } }]
    case path === '/search': return [200, search(params.get('q'), params.get('scope'))]
    // The Filters panel and the `field:` dropdown both read this, and both read
    // it by MAPPING over each list — so the fallback's `{}` would not be a thin
    // demo, it would be a panel with nothing in it and no clue why. Every key
    // the real handler returns is answered here, in the real handler's shapes:
    // bare strings for the credit and label lists, {key,name} pairs for the
    // three whose chip shows one thing and whose wire carries another.
    // Counts for the Filters panel. THE FALLBACK IS ACTIVELY WRONG HERE, which
    // is why this cannot be left to it: `{}` reads as "every value counted
    // zero", and the panel greys a zero — so the demo would show a complete
    // panel with every option dimmed, looking like a library with nothing in
    // it. Counting over the demo's own rows is a dozen lines and cannot lie.
    case path === '/search/facets': {
      const tally = (rows, pick) => {
        const out = {}
        for (const r of rows) for (const v of [pick(r)].flat().filter(Boolean)) out[v] = (out[v] || 0) + 1
        return out
      }
      const quotes = [...ANNOTATIONS, ...DIALOGUES, ...UTTERANCES]
      const works = [...BOOKS, ...MOVIES]
      return [200, {
        tag: tally(quotes, (r) => r.tags || []),
        genre: tally(works, (w) => w.genres || []),
        colour: tally(quotes, (r) => r.color),
        shelf: tally(works, (w) => w.status),
        series: tally(works, (w) => w.series),
        year: tally(works, (w) => String(w.published_year || w.release_year || '') || null),
        author: tally(ANNOTATIONS, (a) => (BOOKS.find((b) => b.id === a.book_id) || {}).author),
        director: tally(DIALOGUES, (d) => (MOVIES.find((m) => m.id === d.movie_id) || {}).director),
        actor: tally(DIALOGUES, (d) => d.actor),
        character: tally(DIALOGUES, (d) => d.character),
        speaker: tally(UTTERANCES, (u) => u.speaker),
        favourite: tally(quotes, (r) => (r.favorite ? 'yes' : 'no')),
        note: tally(quotes, (r) => (r.note ? 'yes' : 'no')),
        wishlist: tally(BOOKS, (b) => (ANNOTATIONS.some((a) => a.book_id === b.id) ? 'no' : 'yes')),
        book: tally(ANNOTATIONS, (a) => String(a.book_id)),
        movie: tally(DIALOGUES, (d) => String(d.movie_id)),
      }]
    }
    // Serendipity (roadmap §1). The fallback's `{}` would leave `quotes`
    // undefined, and the card maps over it — a crash rather than a thin demo.
    case path === '/shuffle': {
      const pool = [
        ...ANNOTATIONS.map((a) => ({ kind: 'book', row: a, work: BOOKS.find((b) => b.id === a.book_id) })),
        ...DIALOGUES.map((d) => ({ kind: 'screen', row: d, work: MOVIES.find((m) => m.id === d.movie_id) })),
      ].filter((x) => x.row.quote)
      // Deterministic in the demo: a screenshot harness that re-shot a different
      // quote every run would make every visual diff noise.
      const x = pool[0]
      return [200, { quote: x ? {
        kind: x.kind, id: x.row.id, quote: x.row.quote, note: x.row.note || '',
        color: x.row.color, title: x.work?.title || '',
        credit: x.kind === 'book' ? x.work?.author || '' : x.row.actor || '',
        work_id: x.work?.id || 0, created_at: x.row.noted_at || '',
      } : null }]
    }
    case path === '/on-this-day':
      return [200, { date: '01-01', quotes: [] }]
    case path === '/search/vocabulary':
      return [200, {
        tags: TAGS.map((t) => t.name),
        genres: [...GENRES],
        series: [...new Set([...BOOKS, ...MOVIES].map((w) => w.series).filter(Boolean))],
        authors: [...new Set(BOOKS.map((b) => b.author).filter(Boolean))],
        directors: [...new Set(MOVIES.map((m) => m.director).filter(Boolean))],
        actors: [...new Set(DIALOGUES.map((d) => d.actor).filter(Boolean))],
        characters: [...new Set(DIALOGUES.map((d) => d.character).filter(Boolean))],
        speakers: [...new Set(UTTERANCES.map((u) => u.speaker).filter(Boolean))],
        shelves: [...new Set([...BOOKS, ...MOVIES].map((w) => w.status).filter(Boolean))],
        books: BOOKS.map((b) => ({ key: String(b.id), name: b.title })),
        movies: MOVIES.map((m) => ({ key: String(m.id), name: m.title })),
        colours: ['yellow', 'blue', 'pink', 'orange', 'green', 'purple'].map((k) => ({ key: k, name: k })),
      }]
    case path === '/people/names': {
      const kind = params.get('kind')
      // DIRECTOR AND STUDIO SPLIT ON media_type, the same way the server's
      // queries do. Answering both from an unfiltered MOVIES scan would list
      // every studio under Directors — which is the exact defect the real
      // handler carries a filter to prevent, reproduced in the shim.
      const referenced = kind === 'actor'
        ? [...new Set(DIALOGUES.map((d) => d.actor).filter(Boolean))]
        : kind === 'speaker'
        ? [...new Set(UTTERANCES.map((u) => u.speaker).filter(Boolean))]
        : kind === 'director'
        ? [...new Set(MOVIES.filter((m) => m.media_type !== 'game').map((m) => m.director).filter(Boolean))]
        : kind === 'studio'
        ? [...new Set(MOVIES.filter((m) => m.media_type === 'game').map((m) => m.director).filter(Boolean))]
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
    // Stray marks. THE DEMO LIBRARY IS CLEAN, deliberately: the fixtures are
    // hand-written, so there is nothing in them for a rule to find, and putting a
    // doubled space into the demo's own quotes to show off this page would be
    // vandalising the thing everything else on the tour is looking at. What matters
    // here is the SHAPE — the tile reads `counts`, the page reads `items`, `rules`
    // and `scanned` — so both get the real envelope with nothing in it, and the page
    // shows its clean state.
    case path === '/cleanup':
      return [200, { rules: [], items: [], scanned: (BOOKS.length + MOVIES.length) * 3, truncated: false, counts: { open: 0, ignored: 0 } }]
    // A GET nobody taught the shim about. 200 {} is the least-bad answer — a 404
    // would light up error states all over a demo that is meant to look calm —
    // but it is exactly how the Devices card broke: the component read a list
    // field that wasn't there and threw on it.
    //
    // So it stays permissive and gets loud. Any unhandled path here is a real
    // gap: add a case above with the shape the caller actually reads.
    default:
      console.warn(`[demo] unhandled GET ${path} — returning {}. Add a case in demo/install.js; a caller reading a missing array will throw.`)
      return [200, {}]
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
