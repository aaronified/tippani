// WorkDetails — the panel that replaced the "Edit" button on every work page
// (books, films and shows alike).
//
// Why it exists: the detail hero used to print ISBN / ASIN / TMDB / TVDB ids in
// its credit line — five words of catalogue plumbing above the thing you came to
// read — and the only way to change any field was a modal that made you re-save
// the whole record. Both problems have the same fix: one place that shows every
// stored field, where each field edits and saves on its own.
//
// Three surfaces, in one sheet, mobile-first (a full-screen MobileSheet on a
// phone, a centred dialog on desktop):
//
//   'fields'  the resting view — cover controls, then every field as an
//             InlineField (read at rest, pencil to edit, ✓ to save that field).
//   'lookup'  the metadata picker, exactly as it always looked.
//   'merge'   NEW: after a match is chosen, old and new side by side, one
//             toggle per field, so adopting a match is a choice per field
//             instead of an all-or-nothing overwrite.
//
// The merge screen defaults to checking only the fields you have nothing in.
// That is the non-destructive direction: filling a blank is never a loss, and
// overwriting an author you typed by hand is, so the second one asks first.
import { useEffect, useMemo, useState } from 'react'
import { coverImgURL, errText, json } from './api.js'
import { CastFills, CastSection } from './cast.jsx'
import { PillRow, SectionHead } from './characterRows.jsx'
import { DEFAULT_CREDIT_SEPS, splitCredits } from './credits.jsx'
import { characterPanel } from './identity.jsx'
import { OFFERED_FIELDS, fieldOffersPanel } from './fieldOffers.jsx'
import { PasteLink, WorkLinks, linksSummary, providerURL } from './workLinks.jsx'
import { t } from './i18n.js'
import { BookLookupPicker, CoverControls, CoverPreview, MovieLookupPicker, hiResPoster, idNum } from './CoverPicker.jsx'
import {
  BigField,
  ErrorText,
  Field,
  FieldIconButton,
  GhostButton,
  IconBack,
  IconCheck,
  IconClose,
  IconDelete,
  IconEdit,
  IconButton,
  IconMetadata,
  IconPlus,
  IconUsers,
  InfoDot,
  formatYear,
  parseYearInput,
  InlineField,
  MonoLabel,
  Placeholder,
  StickerButton,
  TokenInput,
  Tooltip,
  UnsavedFieldsContext,
  titleCaseGenre,
  toast,
  useFormHost,
  useUnsavedFields,
  FormModal,
} from './ui.jsx'

// ---- field specs -----------------------------------------------------------
// One row per stored field. `kind` picks the editor and the coercion on save:
//   text (default) · long (textarea) · year · number · count · tokens · id
// `hint` is the InfoDot beside the label — where the ISBN/ASIN/TMDB explanation
// went when it came off the hero.

// `nameCase` where the field holds a name or a title and the
// PERSON, because the two capitalise differently: a title keeps its small words
// small ("The Wheel of Time") and a name must not, since half of those words are
// whole names in other languages ("Nguyen Van An"). See ui.jsx's SMALL_WORDS.
// ONE LIST, ORDERED BY WHAT A READER LOOKS FOR — the handoff's D_ORDER, and not
// by which editor a field happens to open. Sorting by editor put the record in
// implementation order: it told the reader which rows open a sheet, which is the
// app's problem and not theirs, and it buried People and Description — the two
// things most often wanted — under ISBN and ASIN. Identity first, then who made
// it, then what it is about, then the edition's facts, then the catalogue
// numbers. No section headings: "Fields" over a list of fields inside a panel
// called Details is the panel's title said twice.
const BOOK_FIELDS = [
  { key: 'title', get label() { return t('common.field.title.label') }, nameCase: true },
  // NOT nameCase. A subtitle is a sentence more often than it is a name — "A
  // Novel", "The Life of Samuel Johnson" — and title-casing it would capitalise
  // the small words a title keeps small.
  {
    key: 'subtitle',
    get label() { return t('common.field.subtitle.label') },
    get hint() { return t('book.field.subtitle.info') },
  },
  // NOT A VALUE, so not a row that edits one: a work's people are a list with
  // roles, faces and their own actions, and the three credit boxes plus the cast
  // live behind this one door. See workPeoplePanel.
  { key: 'people', kind: 'people', get label() { return t('common.field.people.label') } },
  { key: 'description', get label() { return t('common.field.description.label') }, kind: 'long', sheet: true },
  { key: 'genres', get label() { return t('common.field.genres.label') }, kind: 'tokens', sheet: true },
  { key: 'published_year', get label() { return t('common.field.year.label') }, kind: 'year', circaKey: 'published_circa' },
  // THE TWO LANGUAGES, storable since 0047 and never once editable from a screen.
  // The hero has printed them for releases and the only way to put one there was
  // an import file — a field the app can show, can search by and cannot be told.
  // Two language codes, paired for the reason the series pair is: neither has
  // ever needed a line of its own, and side by side they read as the one fact
  // they are — what it is in, and what it was written in.
  { key: 'language', half: true, get label() { return t('common.field.language.label') } },
  { key: 'orig_language', half: true, get label() { return t('common.field.orig-language.label') } },
  {
    key: 'publisher',
    get label() { return t('common.field.publisher.label') },
    nameCase: true,
    get hint() { return t('book.field.publisher.info') },
  },
  // ── PAIRED, and the pack pairs exactly these ──
  // A series number is one character and a series name is a few words; each of
  // them was taking a whole row of a panel whose other rows are a title and a
  // description. `half` asks to share a line with the row after it (see
  // .inline-field-rows), so the form is as tall as it has something to say.
  {
    key: 'series',
    half: true,
    get label() { return t('common.field.series.label') },
    nameCase: true,
    get hint() { return t('book.field.series.info') },
  },
  { key: 'series_index', half: true, get label() { return t('common.field.series-no.label') }, kind: 'number' },
  {
    key: 'pages',
    get label() { return t('common.field.pages.label') },
    kind: 'count',
    get hint() { return t('book.field.pages.info') },
  },
  // ── THE IDS, WHICH ARE A SECTION AND NOT ROWS ──
  //
  // `ids: true` takes a spec out of the form's row list and into the Ids strip at
  // the foot of the panel: a pill per id the record HOLDS, and one editor for the
  // lot. The pack's reason is what the rows looked like — five or six of them in a
  // row, each a label and a number, filling the bottom third of a form whose other
  // rows are the title and the author. An id is not a fact about the work; it is
  // how one catalogue happens to file it, and six of them read as the record's
  // subject rather than as its footnotes.
  //
  // `mark` is the provider whose glyph the pill wears, and `href` the page it
  // opens. Both are optional: an id with no address keeps its pill and gives up
  // the following, which is what an IGDB numeric id has always had to do.
  // AND THE TWO THE STRIP WAS MISSING, on the owner's instruction ("ol id: add
  // them back"). The audit this comment used to defer is done and it came out
  // smaller than it read: only ONE writer of `UPDATE books SET …` names the
  // ordinary fields, and the two supplier ids do not join it. They write on their
  // own from a nil-able pointer, which is the contract `movieReq.TMDBID` has
  // always had — nil means the body said nothing and the column stands, a present
  // empty string clears it. So bulk edit, import approval and the metadata
  // backfill need no change at all: each of them writes named columns and simply
  // never mentions these two.
  {
    key: 'isbn',
    ids: true,
    // GOOGLE BOOKS ADDRESSES A BOOK BY ITS ISBN, which is why the number wears
    // that mark rather than a barcode of its own: `?vid=ISBN<n>` resolves to the
    // edition, so the one number every back cover carries is also a page. It is
    // the pack's own pill for this row.
    mark: 'google',
    get label() { return t('common.field.isbn.label') },
    get hint() { return t('book.field.isbn.info') },
    href: (it) => (String(it.isbn || '').replace(/[^0-9Xx]/g, '')
      ? `https://books.google.com/books?vid=ISBN${String(it.isbn).replace(/[^0-9Xx]/g, '')}`
      : ''),
  },
  {
    key: 'asin',
    ids: true,
    mark: 'amazon',
    get label() { return t('common.field.asin.label') },
    get hint() { return t('book.field.asin.info') },
    // A BOOK'S ASIN IS ITS PRODUCT PAGE, and /dp/ is the right address for it —
    // which is the opposite of the ruling on a PERSON's ASIN, where /dp/ would
    // file a book under the author. The difference is what the id names.
    href: (it) => (String(it.asin || '').trim()
      ? `https://www.amazon.com/dp/${encodeURIComponent(String(it.asin).trim())}`
      : ''),
  },
  {
    key: 'openlibrary_id',
    ids: true,
    mark: 'openlibrary',
    get label() { return t('book.field.openlibrary-id.label') },
    get hint() { return t('book.field.openlibrary-id.info') },
    // AN OL KEY IS ALREADY A PATH, which is why this one is not a template with a
    // number dropped in it. The column stores what the API returns — `/works/OL1W`
    // for a work, `/books/OL1M` for an edition — and both resolve under the site
    // root as they stand. A reader who pastes the bare key gets the slash added
    // rather than a 404, because "OL82563W" is what the page's own title bar shows.
    href: (it) => {
      const v = String(it.openlibrary_id || '').trim()
      if (!v) return ''
      const path = v.startsWith('/') ? v : `/works/${v}`
      return `https://openlibrary.org${path}`
    },
  },
  {
    key: 'google_id',
    ids: true,
    mark: 'google',
    get label() { return t('book.field.google-id.label') },
    get hint() { return t('book.field.google-id.info') },
    href: (it) => (String(it.google_id || '').trim()
      ? `https://books.google.com/books?id=${encodeURIComponent(String(it.google_id).trim())}`
      : ''),
  },
  // LAST, which is the handoff's own position for it: a link is where you go
  // NEXT, so it sits under the record rather than in it.
  { key: 'links', kind: 'links', get label() { return t('common.field.links.label') }, get hint() { return t('links.info') } },
]

// THE CREDIT ROWS, WHICH ARE NOT ROWS OF THE FORM. They live behind the People
// door with the cast, because "who made this" and "who is in it" are one question
// and the reader asks it in one place. They are still SPECS — same shape, same
// coercion, same provenance tag, and the merge screen reads this list beside the
// other so that a lookup match can still propose an author.
const BOOK_CREDIT_FIELDS = [
  {
    key: 'author',
    get label() { return t('common.field.author.label') },
    nameCase: true,
    get hint() { return t('book.field.author.info') },
  },
  {
    key: 'translator',
    get label() { return t('common.field.translator.label') },
    nameCase: true,
    get hint() { return t('book.field.translator.info') },
  },
  {
    key: 'editor',
    get label() { return t('common.field.editor.label') },
    nameCase: true,
    get hint() { return t('book.field.editor.info') },
  },
]

const MOVIE_CREDIT_FIELDS = [
  { key: 'director', get label() { return t('common.field.director.label') }, nameCase: true },
]

export function creditSpecsFor(kind) {
  return kind === 'book' ? BOOK_CREDIT_FIELDS : MOVIE_CREDIT_FIELDS
}

// MEDIA_LABELS — the words that change with the MEDIUM rather than with the kind.
//
// One table, and it exists because the ad-hoc version had already gone wrong.
// The only per-medium label used to be `labelShow`, resolved at two call sites
// by `spec.key === 'director' && isShow`. That covers films and shows and says
// nothing about games — so a game's studio was labelled Director, two releases
// after 0040 started storing games as `movies` rows.
//
// A game credits a STUDIO (0040 puts the developer in `director`, the same
// column a show's creator uses) and its franchise is a SERIES, not a Collection,
// which is a word films use.
// The values are KEYS, resolved by labelFor at render time.
const MEDIA_LABELS = {
  show: { director: 'common.field.creator.label' },
  game: {
    director: 'common.field.studio.label',
    series: 'common.field.series.label',
    series_index: 'common.field.series-no.label',
  },
}

// The three things a Catalogue row can be, and what each is called. One list, so
// the display and the picker cannot offer different sets — which is how a game
// came to read as a Film with no way to correct it.
// A [key, label] pair whose LABEL resolves when it is read. The pair shape every
// caller destructures is unchanged, and nothing resolves at module scope — which
// is what a plain table of words would have done, before a locale was applied.
function labelPair(key, labelKey) {
  const row = [key, '']
  Object.defineProperty(row, 1, { get: () => t(labelKey), enumerable: true, configurable: true })
  return row
}

export const MEDIA_TYPES = [
  labelPair('movie', 'vocab.kind.movie.label'),
  labelPair('show', 'vocab.kind.show.label'),
  labelPair('game', 'vocab.kind.game.label'),
]

// labelFor is the one place a spec's label is resolved. Both call sites go
// through it, so a medium cannot be handled on one screen and missed on the
// other — which is exactly how Director survived on a game.
export function labelFor(spec, mediaType) {
  const key = MEDIA_LABELS[mediaType]?.[spec.key]
  return key ? t(key) : spec.label
}

// specsFor drops the fields a medium has no use for.
//
// A GAME HAS NO TMDB, THETVDB OR IMDB ID, and showing all three was not merely
// clutter: those are the ids the fetch uses, so a game's Details page offered
// three film identifiers that nothing would ever look it up by, and omitted the
// one that does. `media` names the media types a field belongs to; absent means
// all of them.
export function specsFor(specs, mediaType) {
  return specs.filter((sp) => !sp.media || sp.media.includes(mediaType))
}

export const MOVIE_FIELDS = [
  { key: 'title', get label() { return t('common.field.title.label') }, nameCase: true },
  // ── THE MEDIUM AND THE YEAR SHARE A LINE, which is the pack's own pairing and
  // the reason the year moved up here from below the genres. Two facts of four
  // characters each, and neither has ever filled a row: side by side they are the
  // line that says what this is and when, which is what a reader checks first
  // after the title. Adjacency is what pairs them — see .inline-field-rows.
  {
    key: 'media_type',
    half: true,
    get label() { return t('common.field.media-type.label') },
    kind: 'mediaType',
    get hint() { return t('film.field.media-type.info') },
  },
  { key: 'release_year', half: true, get label() { return t('common.field.year.label') }, kind: 'year', circaKey: 'release_circa' },
  // The same door a book has, holding the same two halves: the credits and the
  // cast. A film's cast pairs a character with a performer; a book's does not.
  { key: 'people', kind: 'people', get label() { return t('common.field.people.label') } },
  { key: 'description', get label() { return t('common.field.description.label') }, kind: 'long', sheet: true },
  { key: 'genres', get label() { return t('common.field.genres.label') }, kind: 'tokens', sheet: true },
  {
    key: 'publisher',
    get label() { return t('common.field.publisher.label') },
    nameCase: true,
    media: ['game'],
    get hint() { return t('film.field.publisher.info') },
  },
  {
    key: 'series',
    half: true,
    get label() { return t('common.field.collection.label') },
    nameCase: true,
    get hint() { return t('film.field.series.info') },
  },
  { key: 'series_index', half: true, get label() { return t('common.field.collection-no.label') }, kind: 'number' },
  {
    key: 'tmdb_id',
    get label() { return t('film.field.tmdb-id.label') },
    sourceKey: 'vocab.source.tmdb.label',
    kind: 'id',
    ids: true,
    mark: 'tmdb',
    media: ['movie', 'show'],
    get hint() { return t('film.field.tmdb-id.info') },
    href: (it) => providerURL('tmdb', it),
  },
  {
    key: 'tvdb_id',
    get label() { return t('film.field.tvdb-id.label') },
    sourceKey: 'vocab.source.tvdb.label',
    kind: 'id',
    ids: true,
    mark: 'tvdb',
    media: ['movie', 'show'],
    get hint() { return t('film.field.tvdb-id.info') },
    // The dereferrer resolves a bare numeric id to the right series/movie page.
    href: (it) => providerURL('tvdb', it),
  },
  {
    key: 'imdb_id',
    get label() { return t('film.field.imdb-id.label') },
    sourceKey: 'vocab.source.imdb.label',
    ids: true,
    mark: 'imdb',
    media: ['movie', 'show'],
    get hint() { return t('film.field.imdb-id.info') },
    href: (it) => providerURL('imdb', it),
  },
  {
    key: 'igdb_id',
    get label() { return t('film.field.igdb-id.label') },
    sourceKey: 'vocab.source.igdb.label',
    kind: 'id',
    ids: true,
    mark: 'igdb',
    media: ['game'],
    // NO href. IGDB addresses its pages by SLUG and this is the numeric id, so a
    // link built from it would 404 — and a link that goes nowhere is worse than
    // no link, because it invites the one click that proves it broken.
    get hint() { return t('film.field.igdb-id.info') },
  },
  { key: 'links', kind: 'links', get label() { return t('common.field.links.label') }, get hint() { return t('links.info') } },
]

// fullState mirrors bookState / movieState on the pages: PUT is full-state, so a
// one-field save has to carry every other field through untouched. Shelf status,
// progress and the read log are deliberately absent from both — they belong to
// PUT /:kind/:id/status, so editing a field here can never rewrite a history.
export function fullState(kind, it) {
  if (kind === 'book') {
    return {
      title: it.title,
      author: it.author || '',
      translator: it.translator || '',
      editor: it.editor || '',
      isbn: it.isbn || '',
      asin: it.asin || '',
      description: it.description || '',
      published_year: it.published_year || 0,
      published_circa: !!it.published_circa,
      // Storable since 0047 and never once sent by a client, so every save from
      // this panel cleared them. The rows that edit them arrive in the same pass
      // as this line, and a row whose save destroys the field it edits would be
      // worse than no row at all.
      language: it.language || '',
      orig_language: it.orig_language || '',
      // 0061, and on this list for exactly the reason the two above it are: the
      // server's UPDATE writes every column it names unconditionally, so a body
      // that omits one clears it. A field added to the form and not added here is
      // a field the next ♥ press deletes.
      subtitle: it.subtitle || '',
      publisher: it.publisher || '',
      pages: it.pages || 0,
      links: it.links || '',
      // THE TWO SUPPLIER IDS, which the server treats as optional rather than
      // full-state — the same pair `movieReq`'s tmdb/tvdb/igdb make. Carrying them
      // anyway keeps this function honest to its name, and `|| ''` is safe HERE and
      // nowhere else: a present empty string clears the column, so this line is
      // only correct because GET /books/:id now returns both. It did not until
      // this pass, and sending them before it did would have wiped an id on every
      // save of any other field.
      google_id: it.google_id || '',
      openlibrary_id: it.openlibrary_id || '',
      genres: it.genres || [],
      series: it.series || '',
      series_index: it.series_index || 0,
      favorite: !!it.favorite,
    }
  }
  return {
    title: it.title,
    director: it.director || '',
    // 0042 — a game's publisher, full-state like everything else here.
    publisher: it.publisher || '',
    // 0062 — and unconditional in the server's UPDATE like the publisher, so an
    // omission here is a deletion.
    links: it.links || '',
    release_year: it.release_year || 0,
    release_circa: !!it.release_circa,
    description: it.description || '',
    genres: it.genres || [],
    media_type: it.media_type || 'movie',
    series: it.series || '',
    series_index: it.series_index || 0,
    favorite: !!it.favorite,
    // The supplier ids are the one pair the server treats as optional rather
    // than full-state, but carrying them anyway keeps this function honest to
    // its name — every save re-states the record exactly as it stands.
    tmdb_id: it.tmdb_id || 0,
    tvdb_id: it.tvdb_id || 0,
    igdb_id: it.igdb_id || 0,
    // And the IMDb id genuinely IS full-state, so leaving it out of this would
    // clear it on the next save of any other field — the trap 0034, 0035, 0036
    // and 0037 each caught in turn.
    imdb_id: it.imdb_id || '',
  }
}

// coerce turns an editor's draft into what the API stores for that field kind.
function coerce(spec, draft) {
  if (spec.kind === 'tokens') return Array.isArray(draft) ? draft : []
  if (spec.kind === 'year') {
    // `n > 0` used to live here, which read every BCE year as no year at all —
    // you could type 380 BCE, watch it save, and find the field empty. The
    // parser also carries the estimate, because "c. 380 BCE" is how the year of
    // an ancient text is actually written, and splitting that across two
    // controls asks the reader to disassemble a phrase they already know.
    const { year, circa } = parseYearInput(draft)
    return spec.circaKey ? { [spec.key]: year, [spec.circaKey]: circa } : year
  }
  if (spec.kind === 'number') return Number(String(draft).trim()) || 0
  // A COUNT IS NOT A NUMBER, and the difference is a 400 the reader cannot read.
  // `series_index` is deliberately fractional — Discworld 22.5 is a real book —
  // while a page count is a whole non-negative one, and the server's field is an
  // int: sending 480.5 fails the JSON decode before any validation gets to say
  // something useful about it. Rounded here, where the typo is.
  if (spec.kind === 'count') return Math.max(0, Math.round(Number(String(draft).trim()) || 0))
  // A supplier id is a positive whole number or nothing at all; 0 is how the
  // API spells "clear it", so an emptied field and a typo both land there
  // rather than sending a fraction the server would only reject.
  if (spec.kind === 'id') return idNum(draft)
  return String(draft ?? '').trim()
}

// resting turns a stored value into what InlineField edits and shows.
function resting(spec, it) {
  const v = it?.[spec.key]
  if (spec.kind === 'tokens') return v || []
  if (spec.kind === 'year') return formatYear(v, spec.circaKey ? it?.[spec.circaKey] : false)
  if (spec.kind === 'number' || spec.kind === 'count' || spec.kind === 'id') return v ? String(v) : ''
  return v == null ? '' : String(v)
}

// blank — "this field holds nothing". Kind-aware, because the numeric fields
// spell nothing as 0, not as "": a book with no year stores published_year 0,
// and a plain string test would call that filled. Getting this wrong both ways
// at once is what made it worth its own function — an unset year would refuse to
// pre-tick, and a match that also has no year would propose "0" as a change.
function blank(v, kind) {
  if (Array.isArray(v)) return v.length === 0
  if (kind === 'year' || kind === 'number' || kind === 'count' || kind === 'id') return !Number(v)
  return String(v ?? '').trim() === ''
}

// useWorkRecord — the record a panel body is looking at, and the writes to it.
//
// A PANEL BODY MUST OWN ITS RECORD, and this is what it cost to learn. A panel's
// descriptor is captured when it is PUSHED: `render: () => <WorkDetails item={…}/>`
// closes over the record as it stood at that moment, and the stack entry is
// immutable, so a page that re-renders with a newer record does not reach it. The
// panel stack also renders only its TOP entry, so opening a sheet unmounts the
// body underneath and walking back mounts a fresh one from that same captured
// prop. Both together meant: save the title, watch the row snap back to the old
// one, and every later save restate the record as it stood when Details opened.
//
// So the prop is a SEED and not the truth. The body reads the work back on mount
// — one GET, the same thing identity.jsx's panels do — writes from what it read,
// and reports upward so the page behind it stays in step. Walking back into a
// body refetches, which is why a sheet's save is visible the moment you return.
function useWorkRecord({ kind, initial, onChanged, specs, creditSpecs }) {
  const path = kind === 'book' ? 'books' : 'movies'
  const [rec, setRec] = useState(initial)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const id = initial?.id
  useEffect(() => {
    if (!id) return undefined
    let live = true
    json('GET', `/${path}/${id}`).then((r) => {
      // Silent on failure, deliberately: the seed is a real record and the panel
      // is usable from it. A red line over a form that is working, because a
      // freshness check did not answer, would be the worse of the two states.
      //
      // AND ONLY IF IT IS THE SAME RECORD. Adopting whatever came back would let
      // a reply the panel did not expect — an error body, a redirect, a stub —
      // blank a form the reader is looking at, which is a worse failure than the
      // staleness this read exists to end.
      if (live && r.ok && r.data && r.data.id === id) setRec(r.data)
    })
    return () => { live = false }
  }, [path, id])

  // BOTH DIRECTIONS ON EVERY WRITE. Setting only the local copy leaves the page
  // behind the panel stale; calling only upward leaves the row you just saved
  // showing what it used to say.
  const emit = (next) => {
    if (!next) return
    setRec(next)
    onChanged?.(next)
  }

  async function save(patch, label) {
    setBusy(label || 'save')
    setError('')
    const r = await json('PUT', `/${path}/${rec.id}`, { ...fullState(kind, rec), ...patch })
    setBusy('')
    if (!r.ok) {
      setError(errText(r, t('error.save.generic')))
      return false
    }
    emit(r.data)
    return true
  }

  function specFor(key) {
    return (specs || []).find((sp) => sp.key === key) || (creditSpecs || []).find((sp) => sp.key === key)
  }

  // saveAll — every open, edited row committed in ONE request.
  //
  // Merged into a single patch rather than looped over saveField, and that is
  // the whole correctness argument. Each row PUTs the FULL record with its own
  // field changed, so six rows saving themselves is six full-state writes over
  // the top of each other: in parallel the last reply wins, and in sequence each
  // one still reads the record as it was before the previous reply landed.
  // Either way five edits are silently lost behind five toasts saying they were
  // saved.
  async function saveAll(entries, closeAll) {
    const patch = {}
    for (const e of entries) {
      const spec = specFor(e.key)
      if (!spec) continue
      const next = coerce(spec, e.get())
      // A year writes two columns, so coerce hands back a patch rather than a
      // value — the same branch saveField takes, for the same reason.
      Object.assign(patch, next && typeof next === 'object' && !Array.isArray(next)
        ? next
        : { [spec.key]: next })
    }
    if ('title' in patch && !String(patch.title).trim()) {
      setError(t('error.validate.title-required'))
      return false
    }
    if (!Object.keys(patch).length) return true
    if (await save(patch)) {
      // Closed only after the server agreed, like every row does on its own: a
      // failed save must leave what you typed on the screen.
      closeAll()
      const n = entries.length
      toast(t('common.work.fields-saved.toast', { count: n, n }))
      return true
    }
    // Reported, because the ✓ closes the panel afterwards and must not close it
    // over a failed write — the error line and what you typed both have to stay.
    return false
  }

  async function saveField(spec, draft) {
    const next = coerce(spec, draft)
    if (spec.key === 'title' && !String(next).trim()) {
      setError(t('error.validate.title-required'))
      return false
    }
    // A year writes two columns (the year and whether it is an estimate), so
    // coerce may return a patch instead of a value. Arrays are token fields and
    // are values, not patches.
    const patch =
      next && typeof next === 'object' && !Array.isArray(next) ? next : { [spec.key]: next }
    const ok = await save(patch)
    if (ok) toast(t('common.work.field-saved.toast', { field: spec.label.toLowerCase() }))
    return ok
  }

  return { rec, path, busy, setBusy, error, setError, emit, save, saveField, saveAll }
}

export function WorkDetails({ onClose, kind, item: seed, onChanged, onDelete, stack }) {
  // The medium, which decides three things on this screen: what the credit is
  // called, which supplier ids are worth showing, and what "Type" reads as.
  // `book` has no media type of its own, so it is its own answer.
  const mediaType = kind === 'book' ? 'book' : seed?.media_type || 'movie'
  const specs = specsFor(kind === 'book' ? BOOK_FIELDS : MOVIE_FIELDS, mediaType)
  // The credits are edited behind the People door, and the merge screen reads
  // them beside the form's own list — a match proposing an author must still be
  // offerable, and a spec that left the form must not leave the proposal.
  const creditSpecs = creditSpecsFor(kind)
  const { rec: item, path, busy, setBusy, error, setError, emit, save, saveField, saveAll } =
    useWorkRecord({ kind, initial: seed, onChanged, specs, creditSpecs })
  const [view, setView] = useState('fields') // fields | lookup | merge
  const [merge, setMerge] = useState(null) // { rows, candidate }
  const [genreSuggestions, setGenreSuggestions] = useState([])

  // NO `open` PROP ANY MORE: the panel stack mounts this only while it is open, so
  // mounting IS opening. What used to be "reset whenever open goes true" is now an
  // unconditional reset on mount, which is the same guarantee with nothing to keep
  // in step — re-opening always lands on the field list rather than on a half-done
  // merge from last time.
  useEffect(() => {
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
    setView('fields')
    setMerge(null)
    setError('')
  }, [])

  if (!item) return null

  // ---- adopting a match ----------------------------------------------------
  // Building the merge rows is the whole difference from the old behaviour: the
  // candidate is not applied, it is *proposed*, field by field.
  function proposeBook(c) {
    const cand = {
      title: c.title || '',
      author: c.author || '',
      isbn: c.isbn13 || '',
      published_year: c.published_year || 0,
      series: c.series || '',
      series_index: c.series_index || 0,
      genres: c.genres || [],
      description: c.description || '',
      // 0061. The suppliers have always sent these and the app always dropped
      // them; a match that carries a publisher and does not offer it is a match
      // silently declining to fill the blank it can fill.
      subtitle: c.subtitle || '',
      publisher: c.publisher || '',
      pages: c.pages || 0,
    }
    return buildRows(cand, c.cover_url || '')
  }

  function proposeMovie(c) {
    const cand = {
      title: c.title || '',
      release_year: c.release_year || 0,
      description: c.overview || '',
      media_type: c.media_type || item.media_type || 'movie',
    }
    // THE MATCH'S OWN ID IS PROPOSED, AND IT IS THE POINT OF MIXING SOURCES.
    //
    // The rule below still stands for the ids this candidate does NOT carry: an
    // id adopted without the record behind it points at something it does not
    // describe. But THIS id IS the record — the reader is looking at the match it
    // names — and taking it alone is the one way to say "keep TMDB's title and
    // year, and remember which TheTVDB record this is". That is what makes the
    // character art reachable: `Cast from TheTVDB` needs a tvdb_id on the row and
    // refuses to search for one, so without this the only route was reading the
    // number off their website and typing it in.
    const idKey = { tvdb: 'tvdb_id', tmdb: 'tmdb_id', igdb: 'igdb_id' }[c.source || 'tmdb']
    const idValue = Number(c.source === 'tmdb' ? c.tmdb_id || c.source_id : c.source_id)
    if (idKey && Number.isInteger(idValue) && idValue > 0) cand[idKey] = idValue
    return buildRows(cand, c.poster_url || '')
  }

  // buildRows keeps only the fields the match actually has something to say
  // about AND that differ from what is stored. A row that would change nothing
  // is noise on a phone screen.
  function buildRows(cand, artUrl) {
    const rows = []
    for (const spec of specs.concat(creditSpecs)) {
      // A match proposes the fields it actually carries — including, since the
      // mixing change, the id of the record it IS (see proposeMovie). The OTHER
      // suppliers' ids are still deliberately absent: adopting one without the
      // record behind it would leave the row pointing at something it does not
      // describe, and "Re-sync everything" is the control that changes both
      // together.
      if (!(spec.key in cand)) continue
      const next = cand[spec.key]
      if (blank(next, spec.kind)) continue
      const current = item[spec.key]
      const same = Array.isArray(next)
        ? JSON.stringify([...next].sort()) === JSON.stringify([...(current || [])].sort())
        : String(next ?? '') === String(current ?? '')
      if (same) continue
      rows.push({
        key: spec.key,
        label: labelFor(spec, mediaType),
        spec,
        current,
        next,
        // Fill a blank without asking twice; never pre-tick an overwrite.
        take: blank(current, spec.kind),
      })
    }
    const currentArt = item.cover_path || item.poster_path
    if (artUrl) {
      rows.push({
        key: '__cover',
        label: t(kind === 'book' ? 'common.field.cover.label' : 'common.field.poster.label'),
        art: true,
        current: currentArt ? coverImgURL(currentArt) : '',
        next: artUrl,
        take: !currentArt,
      })
    }
    return rows
  }

  async function applyMerge(rows) {
    const chosen = rows.filter((r) => r.take)
    if (!chosen.length) {
      setView('fields')
      return
    }
    const patch = {}
    for (const r of chosen) {
      // A movie candidate's poster_url is the w342 picker thumbnail. Store the
      // original instead, the same upgrade the cover search does — otherwise
      // taking a poster here quietly saves a worse image than the search would.
      if (r.key === '__cover') patch[kind === 'book' ? 'cover_url' : 'poster_url'] = kind === 'book' ? r.next : hiResPoster(r.next)
      else patch[r.key] = r.next
    }
    if (await save(patch, 'merge')) {
      toast(t('common.work.merge.toast', { count: chosen.length, n: chosen.length }))
      setMerge(null)
      setView('fields')
    }
  }

  // resync is the film side's all-in option: the server re-pulls poster, cast,
  // genres and details from the chosen supplier. Cast in particular exists
  // nowhere in a search result, so field-picking alone cannot produce it.
  async function resync(c) {
    setBusy('resync')
    setError('')
    const r = await json('PUT', `/movies/${item.id}`, {
      source: c.source || 'tmdb',
      source_id: c.source === 'tvdb' ? c.source_id : String(c.tmdb_id || c.source_id),
      media_type: c.media_type || item.media_type || 'movie',
    })
    setBusy('')
    if (!r.ok) return setError(errText(r, t('error.sync.source')))
    emit(r.data)
    toast(t('common.work.resync.toast'))
    setMerge(null)
    setView('fields')
  }

  // THE PANEL'S TITLE IS FIXED AT "DETAILS" and the two sub-views name themselves
  // in the body. `panel.title` is read from the immutable stack entry, so a title
  // that changed with `view` could not survive the move — and the repair that
  // looks obvious, pushing lookup and merge as their own panels, would move
  // `save`, `busy` and `error` out of one component into three closures, which is
  // a second change wearing this one's clothes. Nothing becomes unnamed: the
  // lookup draws its own heading row and the merge draws its source label, each
  // already with its own back key.
  return (
    <>
      <ErrorText>{error}</ErrorText>

      {view === 'fields' && (
        <FieldList
          kind={kind}
          item={item}
          stack={stack}
          specs={specs}
          creditSpecs={creditSpecs}
          mediaType={mediaType}
          busy={busy}
          genreSuggestions={genreSuggestions}
          onSaveField={saveField}
          onSaveAll={saveAll}
          // EVERY ID IN ONE REQUEST, which is the pack's own note on that dialog.
          // `save` already PUTs the full record with a patch over it, so a patch
          // naming three ids writes three ids once — where three rows saving
          // themselves would have been three full-state writes over each other.
          onSaveIds={(patch) => save(patch, 'ids')}
          onClose={onClose}
          onCover={(patch) => save(patch, 'cover')}
          onChanged={emit}
          onFetch={() => setView('lookup')}
          onDelete={onDelete}
        />
      )}

      {view === 'lookup' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FieldIconButton
              icon={<IconBack />}
              ariaLabel={t('common.work.lookup.back.aria')}
              onClick={() => setView('fields')}
            />
            {/* "PICK THE MATCH", which is the pack's title for this surface —
                it read "pick the closest match", and "closest" is the word that
                made a reader think one of them had to be taken. Nothing here
                writes; the crumb saying what the search used is the picker's own,
                because only it knows what it sent. */}
            <MonoLabel>{t('common.work.lookup.pick.label')}</MonoLabel>
            <InfoDot title={t('common.work.lookup.info.title')} text={t('common.work.lookup.info.body')} />
          </div>
          {kind === 'book' ? (
            <BookLookupPicker
              auto
              isbn={item.isbn}
              title={item.title}
              author={item.author}
              asin={item.asin}
              onPick={(c) => { setMerge({ rows: proposeBook(c), candidate: c }); setView('merge') }}
            />
          ) : (
            <MovieLookupPicker
              auto
              title={item.title}
              year={item.release_year}
              mediaType={item.media_type || 'movie'}
              tmdbId={item.tmdb_id}
              tvdbId={item.tvdb_id}
              onPick={(c) => { setMerge({ rows: proposeMovie(c), candidate: c }); setView('merge') }}
            />
          )}
          {/* THE CAST-ONLY FETCHES, on the screen the reader came to fetch from.
              They used to live inside the People panel, two screens away from the
              lookup they are a narrower version of — so a reader who wanted this
              title's cast pressed "Fetch metadata", got a title picker, and never
              found the button that asks for the cast alone. Below the picker
              rather than above it: the picker is what most people came for, and
              these two are the answer to "the record is fine, its cast is thin".

              A book has neither: TheTVDB has no books and IMDb has no books. */}
          {kind !== 'book' && (
            <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
              <MonoLabel>{t('cast.fill.heading.label')}</MonoLabel>
              <CastFills
                item={item}
                // A NEW RECORD CARRYING THE NEW CAST, which is the same contract
                // the People panel keeps — handing back `item` would be a state set
                // to the same reference, which React bails out of.
                onFilled={(cast) => emit({ ...item, cast: cast || [] })}
              />
            </div>
          )}
        </div>
      )}

      {view === 'merge' && merge && (
        <MergeScreen
          kind={kind}
          rows={merge.rows}
          candidate={merge.candidate}
          busy={busy}
          onBack={() => setView('lookup')}
          onApply={applyMerge}
          onResync={kind === 'movie' ? () => resync(merge.candidate) : null}
        />
      )}
    </>
  )
}

// ---- the two sheets, and the door with the people behind it ----------------

// fieldSheetPanel — one field, its own surface, the panel's own ✓.
//
// A SHEET IS NOT A SECOND KIND OF ROW. The pencil is the same pencil; what
// differs is only that a description needs several lines and room to reread, and
// a token list needs its own filtered picker. Both were being edited in the
// gap under a 44px label, which is the shape the handoff calls a letterbox.
//
// It registers a form with the panel chrome exactly as the field list does, so
// the ✓ in the header commits it, Escape and the scrim ask before discarding,
// and a failed write keeps the sheet open with what was typed still in it.
function FieldSheet({ kind, item, spec, label, genreSuggestions, onChanged, onDone }) {
  // ITS OWN RECORD, for useWorkRecord's stated reason: this panel unmounted the
  // form underneath it, so a save written from the form's captured copy would
  // restate the work as it stood when Details opened.
  const { rec, busy, error, saveField } = useWorkRecord({
    kind, initial: item, onChanged, specs: [spec],
  })
  const value = resting(spec, rec)
  const [draft, setDraft] = useState(value)
  const [seeded, setSeeded] = useState(false)
  // The read-back lands a frame later, and a draft nobody has touched follows it.
  useEffect(() => {
    if (seeded) return
    setDraft(value)
  }, [value, seeded])
  const host = useFormHost('')
  // The chrome's guard reads a COUNT of unsaved things, and a sheet holds one.
  useEffect(() => {
    const dirty = spec.kind === 'tokens'
      ? JSON.stringify([...(draft || [])]) !== JSON.stringify([...(value || [])])
      : String(draft ?? '') !== String(value ?? '')
    host?.setDirty?.(dirty ? 1 : 0)
    return () => host?.setDirty?.(0)
  }, [host, draft, value, spec.kind])

  async function submit(e) {
    // Somebody else's submit is not this one's — see the field list's own note.
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    if (await saveField(spec, draft) === false) return
    host?.setDirty?.(0)
    onDone()
  }

  const edit = (next) => {
    setSeeded(true)
    setDraft(next)
  }

  return (
    <form id={host?.formId} onSubmit={submit} style={{ display: 'grid', gap: 'var(--row)' }}>
      <ErrorText>{error}</ErrorText>
      <MonoLabel>{label}</MonoLabel>
      {spec.kind === 'tokens' ? (
        <TokenInput
          value={draft || []}
          onChange={edit}
          suggestions={genreSuggestions}
          placeholder={t('common.field.genres.placeholder')}
          ariaLabel={label}
          transform={titleCaseGenre}
        />
      ) : (
        // TWELVE ROWS, not four. This is the whole reason the field has a surface
        // of its own: a blurb is read while it is being corrected, and four rows
        // of a nine-hundred-pixel panel is a slot to type into rather than a page
        // to read.
        <textarea
          className="tp-input"
          rows={12}
          value={draft ?? ''}
          aria-label={label}
          disabled={!!busy}
          onChange={(e) => edit(e.target.value)}
        />
      )}
    </form>
  )
}

export function fieldSheetPanel(stack, { kind, item, spec, label, genreSuggestions, onChanged }) {
  return {
    title: label,
    saveTip: t('common.action.save.label'),
    render: () => (
      <FieldSheet
        kind={kind}
        item={item}
        spec={spec}
        label={label}
        genreSuggestions={genreSuggestions}
        onChanged={onChanged}
        onDone={() => stack.back()}
      />
    ),
  }
}

// WorkPeople — the credits and the cast, which are one question asked in one
// place.
//
// A WORK'S PEOPLE ARE NOT A VALUE. Three text boxes and a twenty-row cast list
// sitting among Year, ISBN and Series told the reader that "author" is the same
// size of edit as "series number", and put the list nobody can miss above the
// form rather than in it. Behind one door they are what they are: a list of
// people with roles, faces and actions of their own.
function WorkPeople({ kind, item, creditSpecs, mediaType, stack, onChanged, onDone, onOpenCharacter }) {
  // ITS OWN RECORD, like the sheets: pushing this panel unmounts the form under
  // it, so both the values these rows show and the full state they write have to
  // come from a read this panel made rather than from the form's captured copy.
  const { rec, busy, error, saveField, saveAll } = useWorkRecord({
    kind, initial: item, onChanged, creditSpecs,
  })
  const fieldSources = useMemo(() => {
    const out = {}
    for (const fs of rec?.field_sources || []) if (fs?.field) out[fs.field] = fs
    return out
  }, [rec])
  const unsaved = useUnsavedFields()
  const host = useFormHost('')
  useEffect(() => {
    host?.setDirty?.(unsaved.count)
    return () => host?.setDirty?.(0)
  }, [host, unsaved.count])

  async function submit(e) {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    const entries = unsaved.collect()
    for (const e2 of entries) {
      if (e2.save && (await e2.save()) === false) return
    }
    if (unsaved.count && !(await saveAll(entries, unsaved.closeAll))) return
    onDone()
  }
  const swallowEnter = (e) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
    if (e.target.form === e.currentTarget) e.preventDefault()
  }

  return (
    <form id={host?.formId} onSubmit={submit} onKeyDown={swallowEnter} style={{ display: 'grid', gap: 'var(--row)' }}>
      <UnsavedFieldsContext.Provider value={unsaved.host}>
        <ErrorText>{error}</ErrorText>
        <div>
          {creditSpecs.map((spec) => {
            const prov = fieldSources[spec.key]
            const label = labelFor(spec, mediaType)
            // THE SAME DOOR THE DETAILS LIST HAS. An author and a director are
            // fields the suppliers disagree about as readily as a year, and this
            // panel is where those two rows live — leaving them out would make the
            // door a property of which panel a field happens to be drawn in.
            const offers = stack && prov?.source && OFFERED_FIELDS.has(spec.key)
              ? () => stack.push(fieldOffersPanel(stack, {
                  kind, item, field: spec.key, label, storedSource: prov.source, onChanged,
                }))
              : undefined
            return (
              <InlineField
                key={spec.key}
                fieldKey={spec.key}
                source={prov?.source}
                sourceAt={prov?.at}
                sourceOpen={offers}
                label={label}
                value={resting(spec, rec)}
                hint={spec.hint}
                busy={!!busy}
                nameCase={!!spec.nameCase}
                onSave={(d) => saveField(spec, d)}
              />
            )
          })}
        </div>
        {/* THE WORK'S CHARACTERS, who plays them, and both of their pictures.
            Books included: a book's cast is the characters the reader names, and
            0048 has stored them for as long as a film's. What is film-only is the
            FETCH, and that gate is inside the panel where it belongs. */}
        <CastSection
          kind={kind}
          item={rec}
          onCastChanged={(cast) => onChanged?.({ ...rec, cast: cast || [] })}
          onOpenCharacter={onOpenCharacter}
        />
      </UnsavedFieldsContext.Provider>
    </form>
  )
}

export function workPeoplePanel(stack, props) {
  return {
    title: t('common.field.people.label'),
    saveTip: t('common.work.people.done.tip'),
    render: () => (
      <WorkPeople
        {...props}
        stack={stack}
        onDone={() => stack.back()}
        // A CHARACTER'S PAGE, PUSHED ON TOP OF THIS LIST rather than replacing it:
        // the reader presses V, reads who V is, and Back puts them back among the
        // cast. `work` is what makes the page open ON THIS WORK — see
        // characterPanel, which lifts that one appearance above the rest.
        //
        // Built here because this is where the stack is, and because cast.jsx
        // cannot import identity.jsx: identity.jsx already imports the picture
        // hook out of cast.jsx, and the two would form a cycle.
        onOpenCharacter={(row) => stack.push(characterPanel(stack, {
          id: row.character_id,
          name: row.character,
          // THE ROW, not just the work. One work can bill a character twice — two
          // performers for one part — and both rows point at one record, so a
          // panel told only the work lifts whichever comes first and leaves the
          // reader looking at the sibling of the row they pressed.
          work: { kind: props.kind, id: props.item.id, title: props.item.title, castId: row.id },
        }))}
      />
    ),
  }
}

// WorkLinksHost — the links list, which owns its record like every other panel
// body does (useWorkRecord's header says why) and writes the whole column on each
// removal.
function WorkLinksHost({ kind, item, onChanged, onAdd }) {
  const spec = { key: 'links', label: t('common.field.links.label') }
  const { rec, busy, saveField } = useWorkRecord({ kind, initial: item, onChanged, specs: [spec] })
  return (
    <WorkLinks
      value={rec.links || ''}
      busy={busy}
      onSave={(next) => saveField(spec, next)}
      onEmptyAdd={onAdd}
    />
  )
}

function PasteLinkHost({ kind, item, onChanged, onDone }) {
  const spec = { key: 'links', label: t('common.field.links.label') }
  const { rec, busy, saveField } = useWorkRecord({ kind, initial: item, onChanged, specs: [spec] })
  return (
    <PasteLink
      // THE WHOLE RECORD AND NOT JUST THE LINKS, because the pages this panel can
      // offer are derived from the row's own pinned ids — a tmdb_id, an OL key, a
      // fandom wiki. `rec` rather than `item`: this panel re-reads, so a lookup
      // that pinned an id a moment ago is already in it.
      item={rec}
      value={rec.links || ''}
      busy={busy}
      onSave={(next) => saveField(spec, next)}
      onDone={onDone}
    />
  )
}

// A PANEL MAY CARRY ONE VERB IN ITS HEADER, AND ONLY ITS OWN (§1.12): `+` on
// Links. The list is what is already there, and adding to it is not another
// member of it — so the paste box is its own surface rather than a last row
// pretending to be a link.
export function pasteLinkPanel(stack, props) {
  return {
    title: t('links.paste.label'),
    saveTip: t('links.add.aria'),
    render: () => <PasteLinkHost {...props} onDone={() => stack.back()} />,
  }
}

export function workLinksPanel(stack, props) {
  const add = () => stack.push(pasteLinkPanel(stack, props))
  return {
    title: t('common.field.links.label'),
    headVerb: (
      <IconButton
        icon={<IconPlus />}
        ariaLabel={t('links.paste.label')}
        tooltip={t('links.paste.label')}
        onClick={add}
      />
    ),
    render: () => <WorkLinksHost {...props} onAdd={add} />,
  }
}

// peopleSummary — what the People row reads at rest.
//
// THE NAMES, NOT A COUNT. "6 people" is a number a reader has to open the panel
// to understand; the names are the answer they came for, and a work with four
// credits has four short strings. The character count follows because a cast is
// genuinely a quantity at that point — twenty names on a resting row would be the
// panel drawn twice.
//
// NOTHING IS TRUNCATED: the row wraps. A shortened name and a short name look
// alike, which is the one failure a reader cannot detect.
export function peopleSummary(item, creditSpecs, seps = DEFAULT_CREDIT_SEPS) {
  const names = []
  for (const spec of creditSpecs) {
    for (const n of splitCredits(String(item?.[spec.key] || ''), seps)) {
      if (n && !names.includes(n)) names.push(n)
    }
  }
  const cast = (item?.cast || []).filter((c) => c && c.origin !== 'removed').length
  const parts = []
  if (names.length) parts.push(names.join(' · '))
  if (cast) parts.push(t('common.field.people.characters.summary', { n: cast, count: cast }))
  return parts.join(' — ')
}

// workDetailsPanel — the descriptor a screen opens, in identity.jsx's idiom.
//
// `wide` because this is a form of a dozen rows rather than a list of links, and
// `saveTip` is what the panel's ✓ says when the form has no objection of its own.
// `onClose` closes the WHOLE stack rather than walking back one: the field list's
// own ✓ means "I am finished here", and a Details panel is never opened from
// inside another one.
export function workDetailsPanel(stack, { kind, item, onChanged, onDelete }) {
  return {
    title: t('common.work.details.title'),
    wide: true,
    saveTip: t('common.work.details.done.tip'),
    render: () => (
      <WorkDetails
        kind={kind}
        item={item}
        stack={stack}
        onChanged={onChanged}
        onDelete={onDelete}
        onClose={() => stack.close()}
      />
    ),
  }
}

// ---- the resting view ------------------------------------------------------

function FieldList({ kind, item, stack, specs, creditSpecs, mediaType, busy, genreSuggestions, onSaveField, onSaveAll, onSaveIds, onCover, onChanged, onFetch, onDelete, onClose }) {
  const artPath = kind === 'book' ? item.cover_path : item.poster_path
  // field_sources[] -> { field: { source, at } }, so a row is one lookup rather than a
  // scan. Empty when the record has none, which is every record until something
  // fetches or somebody edits it — and an empty tag is the right answer there.
  const fieldSources = useMemo(() => {
    const out = {}
    for (const fs of item?.field_sources || []) if (fs?.field) out[fs.field] = fs
    return out
  }, [item])

  // ── THE FORM'S ROWS, AND THE IDS THAT ARE NOT ROWS ──
  //
  // `ids: true` takes a spec out of this list and into the strip at the foot of
  // the panel. Split here rather than at the table, so both halves are derived
  // from one ordered list and a spec cannot end up in neither.
  const rows = useMemo(() => specs.filter((sp) => !sp.ids), [specs])
  const idSpecs = useMemo(() => specs.filter((sp) => sp.ids), [specs])

  // THE DOOR BEHIND EVERY TAG — handoff §1.2's last clause. One opener rather
  // than a prop per row: the panel needs the field name, its label and the
  // supplier currently credited, and every branch below already has all three in
  // hand. Absent when there is no stack (the glossary renders this list without
  // one), which leaves each tag the plain label it has always been.
  const openOffers = (spec, label, prov) =>
    stack && prov?.source && OFFERED_FIELDS.has(spec.key)
      ? () => stack.push(fieldOffersPanel(stack, {
          kind, item, field: spec.key, label, storedSource: prov.source, onChanged,
        }))
      : undefined

  // THE MASTER SAVE. Every row still saves itself — that is what the panel is
  // for, and changing one field should not cost more than one press. What it
  // did cost was six presses for six fields, so the header offers one.
  //
  // It goes through the dialog's own header slot rather than being a button
  // this component draws, so it lands in the same place on a phone's sheet and
  // on a desktop dialog, and greys with its reason on it like every other ✓.
  // "Nothing to save" is inside the five-word rule.
  // IT IS NEVER GREYED, AND IT CLOSES THE PANEL. It used to be blocked with
  // "Nothing to save" whenever no row was open with an unsaved edit in it, which
  // is the state the panel is in for most of the time it is on screen — so the ✓
  // in the header of a dialog you had just finished editing did nothing, and the
  // way out was the ✕ beside it. A ✓ that is inert more often than not is not a
  // save button, it is a decoration.
  //
  // So it means "done": commit whatever is open and leave. Nothing open is not an
  // error, it is the ordinary case — every row saves itself, so by the time you
  // reach for the header the work is usually already done and the only thing left
  // is the leaving.
  const unsaved = useUnsavedFields()
  const host = useFormHost('')
  // TELL THE CHROME WHAT IS AT STAKE. This registry has always known how many
  // rows are open with an unsaved change in them — the header's ✓ is drawn from
  // it — and nothing ever read it on the way OUT. So every dismissal was
  // unconditional: three rows opened and typed into went to one click on the
  // scrim, with no question asked. See PanelHost's guard.
  useEffect(() => {
    host?.setDirty?.(unsaved.count)
    // Leaving is not discarding: a panel that unmounts because it SAVED must not
    // leave a count behind for the next thing opened in the same host.
    return () => host?.setDirty?.(0)
  }, [host, unsaved.count])
  async function submit(e) {
    // A SUBMIT FROM SOMEBODY ELSE'S FORM IS NOT THIS ONE'S. React's synthetic
    // events bubble through the React tree — a portal does not stop them — so a
    // dialog rendered inside this panel that submits its own form used to run this
    // handler too, closing the panel out from under it and, if a field row was
    // open and dirty, writing the record nobody asked to write. The person editor
    // opened from the People panel did exactly that.
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    // WHAT IS OPEN IN THE PANEL'S OWN SUB-EDITORS, first. A cast row registers a
    // `save` rather than a field: it writes through its own endpoint and cannot
    // join the merged patch below, but "saves everything open and closes" has to
    // be true of it or the reader loses what they typed to a button that says it
    // saved. A refusal stops the close, exactly as a refused field write does.
    const entries = unsaved.collect()
    for (const e2 of entries) {
      if (e2.save && (await e2.save()) === false) return
    }
    // A failed write keeps the panel open with its error and its drafts intact.
    if (unsaved.count && !(await onSaveAll(entries, unsaved.closeAll))) return
    onClose?.()
  }
  // ENTER IN A TEXT INPUT MUST NOT SUBMIT THIS FORM, and that has to be said
  // here rather than left to each control.
  //
  // The tick is `type="submit" form={formId}` and, since it stopped being greyed,
  // it is this form's DEFAULT BUTTON — so implicit submission fires on Enter from
  // any of the inputs inside it. That is: type a character's name in the People
  // panel, press Enter, and the whole Details panel closes without adding the
  // character. Two changes that were each harmless became one bug together, and
  // jsdom does not implement implicit submission, so nothing failed.
  //
  // Textareas are left alone: they take a newline and never implicitly submit.
  // Controls that WANT Enter — an InlineField committing a row, the combobox
  // picking a suggestion, the cast panel's own boxes — handle it on their own
  // element, and their handlers run before this one on the way up.
  //
  // `e.target.form === e.currentTarget` IS THE WHOLE OF THE SECOND VERSION. The
  // first swallowed Enter from every input in the subtree, which took it away from
  // the controls inside a NESTED form — the person editor, which submits on Enter
  // like any form — and left them dead. An input's `.form` is the form that owns
  // it, so this cancels implicit submission of THIS form and leaves every inner
  // one to its own business.
  const swallowEnter = (e) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
    if (e.target.form === e.currentTarget) e.preventDefault()
  }
  return (
    // A real <form> bound to the header's ✓ by the HTML `form=` attribute, the
    // way every other dialog in this app does it.
    <form id={host?.formId} onSubmit={submit} onKeyDown={swallowEnter} className="space-y-3">
      <UnsavedFieldsContext.Provider value={unsaved.host}>
      {/* Artwork keeps its own icon row (upload · paste URL · search) — the same
          control CoverControls has always been, but wired to save immediately
          rather than stage a change for a Save button that no longer exists. */}
      <CoverControls
        kind={kind === 'book' ? 'books' : 'movies'}
        id={item.id}
        currentPath={artPath || ''}
        asin={item.asin}
        coverUrl=""
        clearCover={false}
        onSetUrl={(u) => onCover(kind === 'book' ? { cover_url: u } : { poster_url: u })}
        onClear={(reset) => { if (reset !== true) onCover({ clear_cover: true }) }}
        onUploaded={(next) => onChanged?.(next)}
        search={kind === 'book'
          ? { isbn: item.isbn, title: item.title, author: item.author, asin: item.asin }
          : { title: item.title, year: item.release_year, mediaType: item.media_type || 'movie', tmdbId: item.tmdb_id, tvdbId: item.tvdb_id, igdbId: item.igdb_id }}
      />

      {/* THE CAST MOVED BEHIND THE PEOPLE DOOR, with the credits it belongs
          beside. It used to sit HERE, above the form — twenty rows of a film's
          cast between the cover and the first field, which is the list nobody can
          miss printed over the record nobody could reach. See workPeoplePanel. */}

      <div className="flex flex-wrap items-center gap-2">
        <GhostButton type="button" onClick={onFetch} disabled={!!busy}>
          <IconMetadata />
          <span>{t('common.work.fetch.label')}</span>
        </GhostButton>
        <InfoDot
          title={t('common.work.lookup.info.title')}
          text={t(kind === 'book' ? 'book.fetch.info.body' : 'film.fetch.info.body')}
        />
        <span className="flex-1" />
        {onDelete && (
          <FieldIconButton
            icon={<IconDelete />}
            ariaLabel={t('common.work.delete.aria', { noun: t(kind === 'book' ? 'unit.book.one' : 'unit.title.one') })}
            onClick={onDelete}
            danger
          />
        )}
      </div>

      {/* A FLEX WRAP, so a spec marked `half` can share its line with the row after
          it. Every row is full width in here unless it asks otherwise, which is
          why this cost nothing to the twelve that did not ask. */}
      <div className="inline-field-rows">
        {rows.map((spec) => {
          const label = labelFor(spec, mediaType)
          const value = resting(spec, item)
          const prov0 = fieldSources[spec.key]
          // THE FOUR THAT KEEP A SHEET, each for its own stated reason (BigField).
          // The row is InlineField's resting row to the pixel; only what the
          // pencil opens is different.
          if (spec.kind === 'people') {
            return (
              <BigField
                key={spec.key}
                half={!!spec.half}
                label={label}
                display={peopleSummary(item, creditSpecs)}
                onOpen={() => stack?.push(workPeoplePanel(stack, {
                  kind, item, creditSpecs, mediaType, onChanged,
                }))}
              />
            )
          }
          if (spec.kind === 'links') {
            return (
              <BigField
                key={spec.key}
                half={!!spec.half}
                label={label}
                hint={spec.hint}
                // NO SOURCE TAG, and the handoff says why: the links under this
                // row come from a dozen places and one of them is a pasted
                // address, so one tag over the lot would be describing none of
                // them. The answers are one level down, one per link.
                display={linksSummary(item.links)}
                onOpen={() => stack?.push(workLinksPanel(stack, { kind, item, onChanged }))}
              />
            )
          }
          if (spec.sheet) {
            return (
              <BigField
                key={spec.key}
                half={!!spec.half}
                label={label}
                source={prov0?.source}
                sourceAt={prov0?.at}
                sourceOpen={openOffers(spec, label, prov0)}
                hint={spec.hint}
                display={spec.kind === 'tokens' ? (value || []).join(' · ') : value}
                disabled={!!busy}
                onOpen={() => stack?.push(fieldSheetPanel(stack, {
                  kind, item, spec, label, genreSuggestions, onChanged,
                }))}
              />
            )
          }
          // WHO WROTE THIS FIELD. `field_sources` has been on the wire since 0054 and
          // the client threw it away; this is where it lands. A spec's `key` already
          // IS the store's field name — title, author, published_year, isbn — so no
          // translation table stands between them, and one that drifted would be
          // worse than the absence it replaced.
          const prov = fieldSources[spec.key]
          if (spec.kind === 'id') {
            // A supplier id edits like any other field, but reads as a link to
            // the record it names — the number itself is only worth looking at
            // when you are checking it, and then you want to open it.
            return (
              <InlineField
                key={spec.key}
                half={!!spec.half}
                fieldKey={spec.key}
                source={prov?.source}
                sourceAt={prov?.at}
                sourceOpen={openOffers(spec, label, prov)}
                label={label}
                value={value}
                hint={spec.hint}
                busy={!!busy}
                inputMode="numeric"
                maxLength={12}
                placeholder={t('common.work.id.placeholder')}
                onSave={(d) => onSaveField(spec, d)}
                display={spec.href && value ? (
                  /* THE SOURCE NAME COMES FROM THE SPEC, not from the label. It
                     used to be `label.replace(/ id$/, '')`, which is an English
                     rule about an English label and strips nothing at all once the
                     label is in another language. */
                  <Tooltip label={t('common.work.id.open.tip', { source: t(spec.sourceKey) })}>
                    <a href={spec.href(item)} target="_blank" rel="noopener noreferrer" className="tp-link">
                      {t('common.work.id.display.label', { n: value })}
                    </a>
                  </Tooltip>
                ) : undefined}
              />
            )
          }
          if (spec.kind === 'tokens') {
            return (
              <InlineField
                key={spec.key}
                half={!!spec.half}
                fieldKey={spec.key}
                source={prov?.source}
                sourceAt={prov?.at}
                sourceOpen={openOffers(spec, label, prov)}
                label={label}
                value={value}
                display={value.join(' · ')}
                hint={spec.hint}
                busy={!!busy}
                onSave={(d) => onSaveField(spec, d)}
                input={({ value: v, onChange }) => (
                  <TokenInput value={v} onChange={onChange} suggestions={genreSuggestions} placeholder={t('common.field.genres.placeholder')} ariaLabel={label} transform={titleCaseGenre} />
                )}
              />
            )
          }
          if (spec.kind === 'mediaType') {
            return (
              <InlineField
                key={spec.key}
                half={!!spec.half}
                fieldKey={spec.key}
                source={prov?.source}
                sourceAt={prov?.at}
                sourceOpen={openOffers(spec, label, prov)}
                label={label}
                value={value}
                // THREE MEDIA, NOT TWO. This read `value === 'show' ? 'Show' :
                // 'Film'`, so a game — stored as a movies row since 0040 —
                // reported itself as a Film on its own Details page, and the
                // picker below offered no way to say otherwise. Naming the
                // options once, in a table, is what stops a fourth medium
                // landing in the same hole.
                display={MEDIA_TYPES.find(([k]) => k === value)?.[1] || t('vocab.kind.movie.label')}
                hint={spec.hint}
                busy={!!busy}
                onSave={(d) => onSaveField(spec, d)}
                input={({ value: v, onChange }) => (
                  <div className="flex gap-2">
                    {MEDIA_TYPES.map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        className={'tp-filter-chip' + (v === k ? ' active' : '')}
                        aria-pressed={v === k}
                        onClick={() => onChange(k)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              />
            )
          }
          return (
            <InlineField
              key={spec.key}
                half={!!spec.half}
              fieldKey={spec.key}
              source={prov?.source}
              sourceAt={prov?.at}
              sourceOpen={openOffers(spec, label, prov)}
              label={label}
              value={value}
              hint={spec.hint}
              busy={!!busy}
              nameCase={!!spec.nameCase}
              multiline={spec.kind === 'long'}
              inputMode={spec.kind === 'number' ? 'decimal' : spec.kind === 'count' ? 'numeric' : undefined}
              maxLength={spec.kind === 'year' ? 12 : undefined}
              onSave={(d) => onSaveField(spec, d)}
              // A text field can carry a link too — the IMDb id is a string
              // rather than a number, so it takes this branch rather than the
              // numeric-id one above, and it is still worth being able to open.
              display={spec.href && value ? (
                <Tooltip label={`Open on ${label.replace(/ id$/, '')}`}>
                  <a href={spec.href(item)} target="_blank" rel="noopener noreferrer" className="tp-link">
                    {String(value)} ↗
                  </a>
                </Tooltip>
              ) : undefined}
            />
          )
        })}
      </div>

      {/* ── THE IDS, AS A STRIP AND NOT AS ROWS ──
          A pill per id the record HOLDS, and one editor for the lot. The rows it
          replaces were five or six of a form whose other rows are the title and
          the description, each a label and a number, and together they read as
          what the record is ABOUT rather than as its footnotes. */}
      {idSpecs.length > 0 && (
        <WorkIds
          item={item}
          specs={idSpecs}
          mediaType={mediaType}
          busy={!!busy}
          onSave={onSaveIds}
        />
      )}
      </UnsavedFieldsContext.Provider>
    </form>
  )
}

// ---- the ids ---------------------------------------------------------------
//
// WorkIds — the strip at the foot of the panel, and the one dialog behind it.
//
// AN ID IS NOT A FACT ABOUT THE WORK. It is how one catalogue files it, which is
// why the pack takes all of them out of the form: a book's ISBN and ASIN, a
// film's TMDB, TheTVDB and IMDb ids, a game's IGDB id. As rows they were a third
// of the panel's height saying nothing a reader came to read; as a strip they are
// the record's footnotes, which is what they are.
//
// ONLY THE ONES WITH A VALUE GET A PILL. The alternative is the roster of
// absences workLinks.jsx argues against at length — six slots with four of them
// reading "not linked" tells the reader which catalogues their book OUGHT to be
// in, and is wrong about it. What is missing is behind the editor, where every id
// this medium has is offered whether it is filled or not.
//
// A PILL WITHOUT AN ADDRESS KEEPS ITS PILL. An IGDB numeric id names no page the
// app can build — IGDB addresses by slug — so that one draws flat rather than as
// a link, which PillRow does by itself when handed no url.
function WorkIds({ item, specs, mediaType, busy, onSave }) {
  const [open, setOpen] = useState(false)
  const pills = specs
    .map((sp) => {
      const raw = item[sp.key]
      const value = raw === 0 || raw === '0' ? '' : String(raw ?? '').trim()
      if (!value) return null
      const url = sp.href ? sp.href(item) : ''
      const name = sp.sourceKey ? t(sp.sourceKey) : labelFor(sp, mediaType)
      return {
        key: sp.key,
        slug: sp.mark || '',
        name: value,
        mono: true,
        url,
        title: url ? t('common.work.id.open.tip', { source: name }) : t('work.ids.no-page.tip', { source: name }),
      }
    })
    .filter(Boolean)
  return (
    <>
      <SectionHead label={t('work.ids.label')} />
      <PillRow
        pills={pills}
        onAdd={() => setOpen(true)}
        addLabel={pills.length ? t('work.ids.edit.label') : t('work.ids.add.label')}
        addIcon={pills.length ? <IconEdit /> : <IconPlus />}
        addTitle={t('work.ids.edit.tip')}
      />
      <WorkIdsDialog
        open={open}
        item={item}
        specs={specs}
        mediaType={mediaType}
        busy={busy}
        onClose={() => setOpen(false)}
        onSave={async (patch) => {
          const ok = await onSave(patch)
          if (ok !== false) setOpen(false)
          return ok
        }}
      />
    </>
  )
}

// WorkIdsDialog — every id this medium has, in one form, saved in one request.
//
// ONE REQUEST IS THE WHOLE POINT. Editing three of a film's ids as three rows was
// three PUTs of the whole record, and the pack's own note on this screen is "Ids
// saved — every one in a single request". They are also the fields most often
// filled together, because they arrive together: a reader pinning a record to its
// supplier pastes two or three ids off two or three tabs in one sitting.
//
// EVERY ID, FILLED OR NOT, unlike the strip outside — this is the place the
// missing ones are missing FROM, so an empty box here is the offer the strip
// deliberately does not make.
//
// The header pair is the app's standing one: the ✓ takes the accent and a count
// of how many ids this press will change, and the ✕ is red because it discards.
function WorkIdsDialog({ open, item, specs, mediaType, busy, onClose, onSave }) {
  const [draft, setDraft] = useState({})
  useEffect(() => {
    if (!open) return
    const next = {}
    for (const sp of specs) {
      const raw = item[sp.key]
      next[sp.key] = raw === 0 || raw === '0' ? '' : String(raw ?? '')
    }
    setDraft(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])
  const stored = (sp) => {
    const raw = item[sp.key]
    return raw === 0 || raw === '0' ? '' : String(raw ?? '')
  }
  // WHAT THE TICK COUNTS: ids whose SUBSTANCE differs from what is stored.
  // Trimmed, because a trailing space is not a change to an id, and retyping the
  // same number is not one either — the standing rule is that a tick which looks
  // armed when nothing has changed teaches the reader to stop reading it.
  const changed = specs.filter((sp) => String(draft[sp.key] ?? '').trim() !== stored(sp).trim())
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t('work.ids.label')}
      maxWidth={460}
      dirty={changed.length}
      closeDanger
      saveTip={t('work.ids.save.tip')}
    >
      <WorkIdsForm
        specs={specs}
        mediaType={mediaType}
        draft={draft}
        onDraft={(key, v) => setDraft((d) => ({ ...d, [key]: v }))}
        busy={busy}
        blocked={changed.length === 0 ? t('work.ids.save.blocked') : ''}
        onSubmit={() => onSave(Object.fromEntries(changed.map((sp) => [sp.key, coerce(sp, draft[sp.key])])))}
      />
    </FormModal>
  )
}

// The form body, a child of the modal for the reason identity.jsx's link dialog
// states: useFormHost reads the context FormModal puts around its CHILDREN, so a
// call in the component that renders the modal registers with the surface outside
// it and the modal draws no ✓ at all.
function WorkIdsForm({ specs, mediaType, draft, onDraft, busy, blocked, onSubmit }) {
  const host = useFormHost(busy ? t('common.action.save.busy') : blocked)
  return (
    <form
      id={host?.formId}
      style={{ display: 'grid', gap: 'var(--row)' }}
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
    >
      {specs.map((sp) => (
        <Field
          key={sp.key}
          id={`work-id-${sp.key}`}
          label={labelFor(sp, mediaType)}
          value={draft[sp.key] ?? ''}
          // THE EVENT, NOT THE VALUE. `Field` passes its input's onChange
          // straight through, so a handler written for a value receives the
          // event and stores "[object Object]" — which is exactly what the id
          // this dialog wrote turned out to be until a test read the body.
          onChange={(e) => onDraft(sp.key, e.target.value)}
        />
      ))}
      <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('work.ids.form.hint')}</p>
    </form>
  )
}

// ---- the merge screen ------------------------------------------------------

// MergeScreen is the answer to "it fetched metadata and clobbered my author":
// every field the match would change, yours on the left and theirs on the right,
// with a toggle you own. Stacked rather than columned, because the phone is the
// first target and two 150px columns of prose are unreadable there.
function MergeScreen({ kind, rows, candidate, busy, onBack, onApply, onResync }) {
  const [state, setState] = useState(rows)
  useEffect(() => setState(rows), [rows])
  const chosen = useMemo(() => state.filter((r) => r.take).length, [state])
  const setAll = (take) => setState((s) => s.map((r) => ({ ...r, take })))
  const toggle = (key) => setState((s) => s.map((r) => (r.key === key ? { ...r, take: !r.take } : r)))

  const sourceLabel = kind === 'book'
    ? (candidate?.source || '').toUpperCase()
    : `${(candidate?.source || 'tmdb').toUpperCase()} #${candidate?.source === 'tvdb' ? candidate?.source_id : candidate?.tmdb_id || candidate?.source_id}`
  // THE CRUMB SAYS HOW MUCH IS AT STAKE, which the pack writes as "TMDB #12445 ·
  // 5 fields differ". The source alone said where the answer came from and
  // nothing about the size of the decision — and this screen only ever lists the
  // fields that DIFFER, so the count is the length of the list a reader is about
  // to read. One differing field and eleven look identical until you scroll.
  const crumb = [sourceLabel, t('common.work.merge.differ', { n: rows.length, count: rows.length })]
    .filter(Boolean).join(' · ')

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FieldIconButton
          icon={<IconBack />}
          ariaLabel={t('common.work.merge.back.aria')}
          onClick={onBack}
        />
        <MonoLabel>{crumb}</MonoLabel>
        <InfoDot title={t('common.work.merge.info.title')} text={t('common.work.merge.info.body')} />
        <span className="flex-1" />
        <FieldIconButton
          icon={<IconCheck />}
          ariaLabel={t('common.work.merge.all.aria')}
          onClick={() => setAll(true)}
          tooltip={t('common.work.merge.all.tip')}
        />
        <FieldIconButton
          icon={<IconClose />}
          ariaLabel={t('common.work.merge.none.aria')}
          onClick={() => setAll(false)}
          tooltip={t('common.work.merge.none.tip')}
        />
      </div>

      {state.length === 0 && (
        <p className="microcopy">{t('common.work.merge.empty')}</p>
      )}

      <div className="merge-list">
        {state.map((r) => (
          <Tooltip key={r.key} label={t('common.work.merge.row.tip')}>
            <button
              type="button"
              className={'merge-row' + (r.take ? ' is-taken' : '')}
              aria-pressed={r.take}
              onClick={() => toggle(r.key)}
            >
              <span className="merge-check" aria-hidden="true">{r.take ? <IconCheck /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className="merge-label">{r.label}</span>
                {r.art ? (
                  <span className="merge-art">
                    <span className="merge-art-side">
                      <MonoLabel>{t('common.work.merge.yours.label')}</MonoLabel>
                      {/* A PICTURE OFFERED IS A PICTURE MEASURED — the pack's
                          rule, and this pair is the one place in the app that
                          offered two and measured neither. 342 x 513 against
                          2000 x 3000 is the whole reason to keep yours, and the
                          badge inks itself red under the floor. */}
                      {r.current ? <CoverPreview url={r.current} label="" showRes className="w-16" /> : <Placeholder kind={t('common.badge.none')} className="w-16" />}
                    </span>
                    <span className="merge-art-side">
                      <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t('common.work.merge.theirs.label')}</MonoLabel>
                      <CoverPreview url={r.next} label="" showRes className="w-16" />
                    </span>
                  </span>
                ) : (
                  <>
                    {/* blank(), not a truthiness test: an unset year is 0, and
                        "0" is not what "you have nothing here" looks like. */}
                    <span className="merge-old">
                      {blank(r.current, r.spec?.kind) ? t('common.work.merge.blank.label') : fmtVal(r.current)}
                    </span>
                    <span className="merge-new">{fmtVal(r.next)}</span>
                  </>
                )}
              </span>
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* "NOTHING TICKED" RATHER THAN "TAKE 0", which is the pack's own label
            and the difference between a button that is off and a button that is
            broken. Disabled either way — there is nothing to write — but a
            greyed "Take 0 fields" reads as a count that failed to load, where the
            words say what the reader has to do about it. */}
        <StickerButton type="button" disabled={!!busy || chosen === 0} onClick={() => onApply(state)}>
          {busy === 'merge'
            ? t('common.action.apply.busy')
            : chosen === 0
              ? t('common.work.merge.take.none')
              : t('common.work.merge.take', { count: chosen, n: chosen })}
        </StickerButton>
        {onResync && (
          <>
            <GhostButton type="button" disabled={!!busy} onClick={onResync}>
              {t(busy === 'resync' ? 'common.work.resync.busy' : 'common.work.resync.label')}
            </GhostButton>
            <InfoDot title={t('common.work.resync.info.title')} text={t('common.work.resync.info.body')} />
          </>
        )}
      </div>
    </div>
  )
}

// fmtVal renders a stored value for the comparison rows: an array joins, a
// number prints, a blank stays blank. Long descriptions are clamped by CSS
// rather than truncated here, so the full text is still selectable.
function fmtVal(v) {
  if (Array.isArray(v)) return v.join(' · ')
  if (v == null) return ''
  return String(v)
}
