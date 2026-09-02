// workKinds.js — what differs between a book, a film, a show and a game, in ONE
// table, so that one work-detail screen can serve all four.
//
// THE POINT OF THIS FILE IS THAT A CHANGE TO A WORK PAGE IS A CHANGE TO EVERY
// WORK PAGE. Until now a book's detail lived in Library.jsx and a film's in
// Movies.jsx, and the two had drifted into different screens: two columns on one
// and a single stack on the other, sorting on one and none on the other, three
// filter chips against one, a text-view setting the film's card ignored. Nineteen
// such gaps were counted before this table was written, and every one of them is
// the same bug — the same improvement landed twice, or once.
//
// So a fifth media type should be a ROW HERE, not a screen. If something cannot
// be expressed as a value in this table, that is the signal it is a genuine
// difference of medium and belongs in one of the handful of conditionals the
// shared screen keeps; the rest is a lookup.
//
// KEYS, NOT WORDS. Every user-facing string here is a locale KEY resolved at
// render time. A label resolved at module load is a label in whichever language
// happened to be applied first, which is the trap CAP_WORDS (which this absorbs)
// was already written to avoid. Values that must be computed from a row are
// functions taking the row.
//
// KEYED THE WAY THE APP ALREADY KEYS ITS SHELF TABLES — book · movie · show ·
// game, exactly as ACTIVE_STATUS, SHELF_CAPS and capKeyFor in works.jsx do — so
// `spec.kind` indexes all of them and a media type nobody has taught this table
// comes back undefined rather than quietly reading as a film.
//
// IT IMPORTS i18n.js AND NOTHING ELSE, the rule facets.js and quoteKind.js state
// for themselves: a table every screen reads must never be the far end of a
// cycle, and it has to load in the `pure` test project.

import { t } from './i18n.js'

// Title-case every word: "science FICTION" → "Science Fiction".
function titleCase(s) {
  return s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

// bookGenres normalises a book's genres for filtering/display: split any
// comma-joined value, trim, Title-Case, and dedupe — so casing and combined
// strings don't spawn duplicate chips ("fantasy" vs "Fantasy"). Books arrive as
// an array whose members may themselves be comma-joined; the catalogue's are
// already split, which is why only one side needs this.
export function bookGenres(b) {
  const out = []
  for (const raw of b.genres || [])
    for (const part of String(raw).split(',')) {
      const g = titleCase(part.trim())
      if (g && !out.includes(g)) out.push(g)
    }
  return out
}

const YES = true

export const KINDS = {
  book: {
    kind: 'book',
    side: 'book', // which endpoint family, and which table on the server
    mediaType: null, // books have no media_type column
    hasWorkPage: YES,

    // ---- routes and wire words ----
    workPath: 'books', // /books/{id}, /books/{id}/status, /books/{id}/cast
    workListKey: 'books', // r.data[workListKey] on GET /books
    quotePath: 'annotations',
    quoteListKey: 'annotations',
    quoteParam: 'book_id',
    addTarget: 'book', // onAdd('quote', { type: addTarget, id })
    practiseParam: 'book', // practise({ [practiseParam]: id, label })
    seedField: 'book', // facets.js: the chip a search from here carries
    seenKind: 'book', // POST /review/seen { kind: seenKind }
    workActionKind: 'book', // the actions.jsx registry
    quoteActionKind: 'annotation',
    selectKind: 'annotation', // selection.jsx + the bulkOps.jsx endpoints
    screenLabel: 'book-detail',
    scrollKey: 'book', // useColumnScroll(`${scrollKey}:${id}:hero`)

    // ---- nouns ----
    // `family` is for t(family, { count: n }); one/other for the two fixed forms
    // a control needs by name. Both, because the app asks in both shapes.
    unit: { family: 'unit.book', one: 'unit.book.one', other: 'unit.book.other' },
    quoteUnit: { family: 'unit.quote', one: 'unit.quote.one', other: 'unit.quote.other' },
    // The word skipReason() puts inside a localised sentence. A key, because both
    // screens pass a raw English word today and a Bengali reader gets "…with its
    // book" in the middle of a Bengali sentence.
    quizParentUnit: 'unit.book.one',

    // ---- shelf ----
    // The in-progress word and the cap NUMBER stay in works.jsx (ACTIVE_STATUS,
    // SHELF_CAPS): the server mirrors both, and one definition of a rule the
    // server also holds is worth more than having it in this file.
    shelfKind: 'book', // which side's wording ShelfControl and WorkHero use
    statusFields: ['progress', 'pos_unit', 'pos', 'pos_total'],
    capWords: { one: 'unit.book.one', other: 'unit.book.other', past: 'book.shelf.cap.past.label' },
    shelfDate: {
      active: 'book.shelf.started.label',
      completed: 'book.shelf.finished.label',
      abandoned: 'book.shelf.abandoned.label',
    },

    // ---- the hero ----
    // WHICH COLUMN THE ARTWORK IS IN. Named rather than probed: `cover_path ||
    // poster_path` happens to work only because no row carries both, which is a
    // fact about today's schema and not a rule anybody wrote down.
    coverField: 'cover_path',
    coverBadge: 'common.badge.cover',
    // The drop shadow lifts a book off the page. A poster is a printed sheet on
    // a light table and wears none — the one place the two artworks differ.
    coverShadow: 'drop-shadow(0 12px 22px rgba(0,0,0,.34))',
    countsTone: 'accent',
    // The credit row's role labels take the medium's mono voice. The PEOPLE in it
    // are chips either way — that is the standing rule and not a per-kind choice.
    creditTone: null,
    // The board this work came from, named by the SAME key the nav tab uses, so
    // the way back and the tab it leads to can never disagree about what the
    // board is called. The film's read "← Movies" for a release after the
    // catalogue was renamed, for exactly that reason.
    backTab: 'nav.tab.library.label',
    // Which glyph the shelf's one-press move wears. A string, not a component:
    // this table must not import ui.jsx.
    shelfIcon: 'read-again',
    titleFallback: 'book.title.fallback',
    yearField: 'published_year',
    circaField: 'published_circa',
    // The hero's facts, in order. A fact with no value draws nothing, so "a film
    // has no language" needs no conditional anywhere — the row is just shorter.
    facts: ['year', 'language', 'origLanguage', 'series'],
    // Which of them are doors, and to which search facet. Only these three are
    // real facets (facets.js); a fact absent from here draws as flat text.
    factDoors: { year: 'year', series: 'series', genre: 'genre' },
    genres: (b) => bookGenres(b),
    credits: [
      { field: 'author', personKind: 'author', labelKey: null },
      { field: 'translator', personKind: 'translator', labelKey: 'book.credit.translator.label' },
      { field: 'editor', personKind: 'editor', labelKey: 'book.credit.editor.label' },
    ],
    creditOf: (b) => b.author || '',

    // ---- the board ----
    board: {
      filterTitle: 'book.quotes.filter.title',
      capture: 'book.quotes.capture.label',
      empty: 'book.quotes.empty',
      nomatch: 'book.quotes.nomatch',
      deleteConfirm: 'book.quotes.delete.confirm',
      countsShown: 'book.quotes.counts.shown',
      stripShown: 'book.strip.shown.label',
      selectMenu: 'book.select.menu.label',
      editTitle: 'common.quote.edit.title',
      pickLabel: 'common.quote.pick.label',
      tagAll: 'common.filters.tag.all.label',
      // PER SIDE, and deliberately not shared. A reader's film layout must not
      // change the first time they rearrange a book — and a `chapter` order
      // arriving on a film board would send every row into the sort's `missing`
      // partition, so the board would look unsorted with no control saying why.
      persist: { view: 'tippani:annview', sort: 'tippani:annsort', group: 'tippani:anngroup', text: 'tippani:anntext' },
    },
    card: { skin: 'hand', listSkin: 'plain' },
    views: ['tiles', 'list', 'table'],
    defaultSort: { col: 'default', dir: 'asc' },
    sortDims: ['default', 'date', 'chapter', 'location', 'length', 'category'],
    groupDims: ['none', 'chapter', 'color', 'tag', 'date'],
    tableCols: [
      { key: 'quote', labelKey: 'book.table.quote.label' },
      { key: 'chapter', labelKey: 'book.table.chapter.label' },
      { key: 'location', labelKey: 'book.table.location.label' },
      { key: 'date', labelKey: 'book.table.date.label' },
      { key: 'favorite', labelKey: 'book.table.favourite.label' },
    ],

    // ---- what a quote of this kind IS ----
    // 'quote-or-note' because annotationReq accepts a row with a note and no
    // quote; a dialogue may not, and the client must not offer a form the
    // handler will refuse.
    requires: 'quote-or-note',
    stateBuilder: 'annotationState',
    locators: [
      { key: 'chapter_no', labelKey: 'common.field.chapter-no.label', placeholderKey: 'book.quote.form.chapter-no.placeholder', input: 'decimal', number: YES, suggest: 'chapterNumbers', bulk: YES },
      { key: 'chapter', labelKey: 'common.field.chapter-name.label', suggest: 'chapterNames', fillsFrom: 'chapter_no', bulk: YES },
      { key: 'location', labelKey: 'common.field.location.label', placeholderKey: 'book.quote.form.location.placeholder', bulk: YES },
    ],
    carried: [], // fields the full-state PUT must send back untouched
    cleared: [], // fields the server clears for this kind
    speaker: {
      field: 'character',
      multi: YES, // the server splits it to resolve character_images
      suggest: 'cast',
      derive: null, // a book's speaker has nobody who played them
      // No silhouette: a disc for a book character would be a picture of nobody,
      // which is why the card draws no disc at all rather than a placeholder.
      faceFallback: 'none',
      fetchArt: YES,
      labelKey: 'common.field.character.label',
      placeholderKey: 'book.quote.form.character.placeholder',
    },
    // The card's locator line, coarse to fine.
    meta: ['character', 'chapter', 'location', 'date'],

    detail: {
      filterAria: 'book.filter.aria',
      practiseMenu: 'book.practise.menu.label',
      practiseAria: 'book.practise.aria',
      practiseTip: 'book.practise.tip',
      detailsTip: 'book.details.tip',
      export: 'book.export.label',
      deletedToast: 'book.toast.deleted',
      // "Everything from 1967" and "Everything in Hainish" are true of a film as
      // well as a book, so the pair moved out of book.* rather than being copied
      // into film.* — one sentence, one place to fix it.
      yearTip: 'common.hero.year.tip',
      seriesTip: 'common.hero.series.tip',
      origLanguage: 'book.hero.language.original',
    },
  },

  movie: {
    kind: 'movie',
    side: 'movie',
    mediaType: 'movie',
    hasWorkPage: YES,

    workPath: 'movies',
    workListKey: 'movies',
    quotePath: 'dialogues',
    quoteListKey: 'dialogues',
    quoteParam: 'movie_id',
    addTarget: 'movie',
    practiseParam: 'movie',
    seedField: 'movie',
    // NOT 'movie'. The review schedule is keyed on the kind of UTTERANCE, not on
    // the work's table, and sending 'movie' records nothing at all — the deck
    // then keeps serving a line the reader has just seen.
    seenKind: 'screen',
    workActionKind: 'movie',
    quoteActionKind: 'dialogue',
    selectKind: 'dialogue',
    screenLabel: 'movie-detail',
    scrollKey: 'movie',

    unit: { family: 'unit.film', one: 'unit.film.one', other: 'unit.film.other' },
    quoteUnit: { family: 'unit.line', one: 'unit.line.one', other: 'unit.line.other' },
    quizParentUnit: 'unit.film.one',

    shelfKind: 'movie',
    // A show's season and season_total are what the server derives its
    // percentage from, and they travel on every status PUT from this side. Send
    // a book a season of 0, or omit a show's, and the next shelf move silently
    // resets its progress.
    statusFields: ['progress', 'pos_unit', 'pos', 'pos_total', 'season', 'season_total'],
    capWords: { one: 'unit.film.one', other: 'unit.film.other', past: 'film.shelf.cap.past.label' },
    shelfDate: {
      active: 'film.shelf.started.label',
      completed: 'film.shelf.finished.label',
      abandoned: 'film.shelf.abandoned.label',
    },

    coverField: 'poster_path',
    coverBadge: 'common.badge.poster',
    coverShadow: null,
    // Amber rather than accent: the credit row's labels above the counts are
    // amber, and two accents on one card read as two unrelated systems.
    countsTone: 'amber',
    creditTone: 'amber',
    backTab: 'nav.tab.movies.label',
    shelfIcon: 'watching',
    titleFallback: 'film.title.fallback',
    yearField: 'release_year',
    circaField: 'release_circa',
    // No language: the movies table has no language column at all, which is
    // stated in the migration that added the book one.
    facts: ['year', 'series'],
    factDoors: { year: 'year', series: 'series', genre: 'genre' },
    genres: (m) => m.genres || [],
    credits: [{ field: 'director', personKind: 'director', labelKey: 'common.badge.director' }],
    creditOf: (m) => m.director || '',

    board: {
      filterTitle: 'film.lines.filter.title',
      capture: 'film.lines.capture.label',
      empty: 'film.lines.empty',
      nomatch: 'film.lines.nomatch',
      deleteConfirm: 'film.lines.delete.confirm',
      editTitle: 'common.dialogue.edit.title',
      pickLabel: 'common.dialogue.pick.label',
      tagAll: 'film.lines.filter.tag.all.label',
      persist: { view: 'tippani:view:dialogues', sort: 'tippani:dlgsort', group: 'tippani:dlggroup', text: 'tippani:dlgtext' },
      // countsShown / stripShown / selectMenu land with the shared board: this
      // screen builds those three strings in English in the source today, so the
      // keys do not exist yet.
    },
    card: { skin: 'frame', listSkin: 'strip' },
    views: ['tiles', 'list', 'table'],
    defaultSort: { col: 'timestamp', dir: 'asc' },
    sortDims: ['default', 'date', 'character', 'timestamp', 'length', 'category'],
    groupDims: ['none', 'character', 'color', 'tag', 'date'],
    tableCols: [
      { key: 'quote', labelKey: 'film.table.quote.label' },
      { key: 'character', labelKey: 'film.table.character.label' },
      { key: 'timestamp', labelKey: 'film.table.time.label' },
      { key: 'favorite', labelKey: 'film.table.favourite.label' },
    ],

    // The server says why in as many words: a dialogue is always a spoken line,
    // so there is no note-only form, because a thought about a film belongs on
    // the film.
    requires: 'quote',
    stateBuilder: 'dialogueState',
    locators: [
      { key: 'timestamp', labelKey: 'common.field.timestamp.label', placeholderKey: 'film.line.form.timestamp.placeholder', tipKey: 'film.line.form.timestamp.tip', bulk: YES },
    ],
    carried: ['episode_name', 'act', 'quest'],
    cleared: [],
    speaker: {
      field: 'character',
      multi: YES,
      suggest: 'cast',
      derive: { field: 'actor', personKind: 'actor', labelKey: 'film.credit.actor.label' },
      faceFallback: 'actor',
      fetchArt: YES,
      labelKey: 'common.field.character.label',
      placeholderKey: 'film.line.form.characters.placeholder',
    },
    meta: ['episode', 'character', 'actor', 'timestamp'],

    detail: {
      filterAria: 'film.filter.aria',
      practiseMenu: 'film.practise.menu.label',
      practiseAria: 'film.practise.aria',
      practiseTip: 'film.practise.tip',
      detailsTip: 'film.details.tip',
      export: 'film.export.label',
      deletedToast: 'film.toast.deleted',
      origLanguage: null,
      // A film's year and series were dead facts — HeroFact draws a button when
      // handed a callback and a flat span when not, and this screen handed it
      // none, so they looked pressable and were not. Same tips as a book's,
      // because the sentence does not mention the medium.
      yearTip: 'common.hero.year.tip',
      seriesTip: 'common.hero.series.tip',
    },
  },

  // A show is a film whose lines carry an episode and whose credit is a creator.
  // Everything not restated here is inherited from `movie` by specFor().
  show: {
    kind: 'show',
    side: 'movie',
    mediaType: 'show',
    hasWorkPage: YES,
    inherits: 'movie',
    unit: { family: 'unit.show', one: 'unit.show.one', other: 'unit.show.other' },
    quizParentUnit: 'unit.show.one',
    capWords: { one: 'unit.show.one', other: 'unit.show.other', past: 'film.shelf.cap.past.label' },
    credits: [{ field: 'director', personKind: 'director', labelKey: 'common.badge.created-by' }],
    defaultSort: { col: 'episode', dir: 'asc' },
    sortDims: ['default', 'date', 'episode', 'character', 'timestamp', 'length', 'category'],
    groupDims: ['none', 'episode', 'character', 'color', 'tag', 'date'],
    tableCols: [
      { key: 'quote', labelKey: 'film.table.quote.label' },
      { key: 'character', labelKey: 'film.table.character.label' },
      { key: 'episode', labelKey: 'film.table.episode.label' },
      { key: 'timestamp', labelKey: 'film.table.time.label' },
      { key: 'favorite', labelKey: 'film.table.favourite.label' },
    ],
    locators: [
      { key: 'season', labelKey: 'common.field.season.label', placeholderKey: 'film.line.form.season.placeholder', tipKey: 'film.line.form.season.tip', input: 'number', min: 0, max: 999, number: YES, requiredFor: 'episode', bulk: YES },
      { key: 'episode', labelKey: 'common.field.episode.label', placeholderKey: 'film.line.form.episode.placeholder', tipKey: 'film.line.form.episode.tip', input: 'number', min: 0, max: 9999, number: YES, bulk: YES },
      { key: 'timestamp', labelKey: 'common.field.timestamp.label', placeholderKey: 'film.line.form.timestamp.placeholder', tipKey: 'film.line.form.timestamp.tip', bulk: YES },
    ],
    carried: ['episode_name', 'act', 'quest'],
  },

  // A game has no runtime: the server CLEARS its timestamp on save, so the box is
  // absent and the field is sent empty rather than carried. Act and quest are in
  // a game line's dedupe hash — the same bark reused in two quests is two quotes.
  game: {
    kind: 'game',
    side: 'movie',
    mediaType: 'game',
    hasWorkPage: YES,
    inherits: 'movie',
    unit: { family: 'unit.game', one: 'unit.game.one', other: 'unit.game.other' },
    quizParentUnit: 'unit.game.one',
    capWords: { one: 'unit.game.one', other: 'unit.game.other', past: 'common.shelf.move.completed.played.label' },
    credits: [
      { field: 'director', personKind: 'studio', labelKey: 'common.badge.studio' },
      // Not a person. A publisher has no people row, no portrait and no panel,
      // so a clickable name here would promise a page that does not exist.
      { field: 'publisher', personKind: null, labelKey: 'film.credit.publisher.label' },
    ],
    defaultSort: { col: 'act', dir: 'asc' },
    sortDims: ['default', 'date', 'act', 'quest', 'character', 'length', 'category'],
    groupDims: ['none', 'act', 'quest', 'character', 'color', 'tag', 'date'],
    tableCols: [
      { key: 'quote', labelKey: 'film.table.quote.label' },
      { key: 'character', labelKey: 'film.table.character.label' },
      { key: 'act', labelKey: 'common.field.act.label' },
      { key: 'quest', labelKey: 'common.field.quest.label' },
      { key: 'favorite', labelKey: 'film.table.favourite.label' },
    ],
    locators: [
      { key: 'act', labelKey: 'common.field.act.label', placeholderKey: 'film.line.form.act.placeholder', tipKey: 'film.line.form.act.tip', bulk: YES, sticky: YES },
      { key: 'quest', labelKey: 'common.field.quest.label', placeholderKey: 'film.line.form.quest.placeholder', tipKey: 'film.line.form.quest.tip', bulk: YES },
    ],
    carried: ['episode_name', 'season', 'episode'],
    cleared: ['timestamp'],
  },

  // CARD-ONLY, and here so the card's lookup has no hole. A standalone quote has
  // no work page; its board is Quotes.jsx and is not part of this merge. It is
  // listed because SearchPage, Home and Quotes all render the same card, and a
  // card that has to ask "which kind am I" must get an answer for all four.
  quote: {
    kind: 'quote',
    side: null,
    mediaType: null,
    hasWorkPage: false,
    quotePath: 'quotes',
    quoteListKey: 'utterances',
    quoteActionKind: 'quote',
    selectKind: 'quote',
    seenKind: 'utterance',
    quoteUnit: { family: 'unit.quote', one: 'unit.quote.one', other: 'unit.quote.other' },
    quizParentUnit: null, // no work, so no parent to be excluded from
    requires: 'quote-or-note',
    stateBuilder: 'utteranceState',
    card: { skin: 'hand', listSkin: 'plain' },
    locators: [
      { key: 'occasion', labelKey: 'common.field.occasion.label', bulk: YES },
      { key: 'place', labelKey: 'common.field.place.label', bulk: YES },
      { key: 'kind', labelKey: 'quotes.form.kind.label', options: 'quoteKindOptions', bulk: YES },
    ],
    speaker: {
      field: 'speaker',
      multi: YES,
      suggest: null,
      derive: null,
      faceFallback: 'none',
      fetchArt: false,
      labelKey: 'common.field.speaker.label',
    },
    meta: ['speaker', 'kind', 'occasion', 'place', 'date'],
  },
}

// WORK_KINDS — the four that have a page of their own, in the order the app
// meets them. `quote` is excluded by hasWorkPage, so a sweep over the work pages
// cannot accidentally include the card-only row.
export const WORK_KINDS = Object.keys(KINDS).filter((k) => KINDS[k].hasWorkPage)

// specFor resolves inheritance once, so a caller never has to ask whether a show
// has a `board` block of its own.
//
// THE SIDE IS WHAT A SCREEN IS MOUNTED WITH; THE KIND IS WHAT ARRIVED. A film, a
// show and a game are one endpoint and one table, told apart only by media_type
// — which is not known until the row has loaded. Before then the side's own row
// stands in, exactly as the film screen's `movie?.media_type || 'movie'` does.
export function specFor(side, item) {
  const key = side === 'book' ? 'book' : item?.media_type || side || 'movie'
  const row = KINDS[key] || KINDS[side] || KINDS.movie
  return row.inherits ? { ...KINDS[row.inherits], ...row } : row
}

// Every locator any kind declares, for locatorsFor's stray rule below.
const ALL_LOCATORS = Object.values(KINDS).flatMap((k) => k.locators || [])

// locatorsFor generalises the rule the film form already keeps for episodes:
// show this kind's locators, PLUS any other kind's locator the row itself
// already carries a value for.
//
// WHY A ROW MAY CARRY A FIELD ITS KIND HAS NO BOX FOR: a work's media_type can be
// changed after its lines were captured. Flip a show to a film and its lines
// still hold a season; without this rule the reader can neither see that nor
// clear it. A field this kind's server actively clears is excluded, because
// offering a box whose value will not survive the save is worse than hiding it.
export function locatorsFor(spec, row) {
  const mine = new Set((spec.locators || []).map((l) => l.key))
  const seen = new Set()
  const strays = ALL_LOCATORS.filter((l) => {
    if (mine.has(l.key) || seen.has(l.key)) return false
    if ((spec.cleared || []).includes(l.key)) return false
    const v = row?.[l.key]
    if (v == null || v === '') return false
    seen.add(l.key)
    return true
  })
  return [...(spec.locators || []), ...strays]
}

// The words for a kind, resolved at render time rather than at module load.
export const wordOf = (spec, n = 1) => t(n === 1 ? spec.unit.one : spec.unit.other)
export const quoteWordOf = (spec, n = 1) => t(n === 1 ? spec.quoteUnit.one : spec.quoteUnit.other)
