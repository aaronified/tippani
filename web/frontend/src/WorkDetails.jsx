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
import { t } from './i18n.js'
import { BookLookupPicker, CoverControls, CoverPreview, MovieLookupPicker, hiResPoster, idNum } from './CoverPicker.jsx'
import {
  ErrorText,
  FieldIconButton,
  FormModal,
  GhostButton,
  IconBack,
  IconCheck,
  IconClose,
  IconDelete,
  IconMetadata,
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
} from './ui.jsx'

// ---- field specs -----------------------------------------------------------
// One row per stored field. `kind` picks the editor and the coercion on save:
//   text (default) · long (textarea) · year · number · tokens · id
// `hint` is the InfoDot beside the label — where the ISBN/ASIN/TMDB explanation
// went when it came off the hero.

const BOOK_FIELDS = [
  { key: 'title', get label() { return t('common.field.title.label') }, nameCase: true },
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
  { key: 'published_year', get label() { return t('common.field.year.label') }, kind: 'year', circaKey: 'published_circa' },
  {
    key: 'series',
    get label() { return t('common.field.series.label') },
    nameCase: true,
    get hint() { return t('book.field.series.info') },
  },
  { key: 'series_index', get label() { return t('common.field.series-no.label') }, kind: 'number' },
  {
    key: 'isbn',
    get label() { return t('common.field.isbn.label') },
    get hint() { return t('book.field.isbn.info') },
  },
  {
    key: 'asin',
    get label() { return t('common.field.asin.label') },
    get hint() { return t('book.field.asin.info') },
  },
  { key: 'genres', get label() { return t('common.field.genres.label') }, kind: 'tokens' },
  { key: 'description', get label() { return t('common.field.description.label') }, kind: 'long' },
]

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
  {
    key: 'media_type',
    get label() { return t('common.field.media-type.label') },
    kind: 'mediaType',
    get hint() { return t('film.field.media-type.info') },
  },
  { key: 'director', get label() { return t('common.field.director.label') }, nameCase: true },
  {
    key: 'publisher',
    get label() { return t('common.field.publisher.label') },
    nameCase: true,
    media: ['game'],
    get hint() { return t('film.field.publisher.info') },
  },
  { key: 'release_year', get label() { return t('common.field.year.label') }, kind: 'year', circaKey: 'release_circa' },
  {
    key: 'series',
    get label() { return t('common.field.collection.label') },
    nameCase: true,
    get hint() { return t('film.field.series.info') },
  },
  { key: 'series_index', get label() { return t('common.field.collection-no.label') }, kind: 'number' },
  {
    key: 'tmdb_id',
    get label() { return t('film.field.tmdb-id.label') },
    sourceKey: 'vocab.source.tmdb.label',
    kind: 'id',
    media: ['movie', 'show'],
    get hint() { return t('film.field.tmdb-id.info') },
    href: (it) => `https://www.themoviedb.org/${(it.media_type || 'movie') === 'show' ? 'tv' : 'movie'}/${it.tmdb_id}`,
  },
  {
    key: 'tvdb_id',
    get label() { return t('film.field.tvdb-id.label') },
    sourceKey: 'vocab.source.tvdb.label',
    kind: 'id',
    media: ['movie', 'show'],
    get hint() { return t('film.field.tvdb-id.info') },
    // The dereferrer resolves a bare numeric id to the right series/movie page.
    href: (it) => `https://thetvdb.com/dereferrer/${(it.media_type || 'movie') === 'show' ? 'series' : 'movie'}/${it.tvdb_id}`,
  },
  {
    key: 'imdb_id',
    get label() { return t('film.field.imdb-id.label') },
    sourceKey: 'vocab.source.imdb.label',
    media: ['movie', 'show'],
    get hint() { return t('film.field.imdb-id.info') },
    href: (it) => `https://www.imdb.com/title/${it.imdb_id}/`,
  },
  {
    key: 'igdb_id',
    get label() { return t('film.field.igdb-id.label') },
    sourceKey: 'vocab.source.igdb.label',
    kind: 'id',
    media: ['game'],
    // NO href. IGDB addresses its pages by SLUG and this is the numeric id, so a
    // link built from it would 404 — and a link that goes nowhere is worse than
    // no link, because it invites the one click that proves it broken.
    get hint() { return t('film.field.igdb-id.info') },
  },
  { key: 'genres', get label() { return t('common.field.genres.label') }, kind: 'tokens' },
  { key: 'description', get label() { return t('common.field.description.label') }, kind: 'long' },
]

// fullState mirrors bookState / movieState on the pages: PUT is full-state, so a
// one-field save has to carry every other field through untouched. Shelf status,
// progress and the read log are deliberately absent from both — they belong to
// PUT /:kind/:id/status, so editing a field here can never rewrite a history.
function fullState(kind, it) {
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
  if (spec.kind === 'number' || spec.kind === 'id') return v ? String(v) : ''
  return v == null ? '' : String(v)
}

// blank — "this field holds nothing". Kind-aware, because the numeric fields
// spell nothing as 0, not as "": a book with no year stores published_year 0,
// and a plain string test would call that filled. Getting this wrong both ways
// at once is what made it worth its own function — an unset year would refuse to
// pre-tick, and a match that also has no year would propose "0" as a change.
function blank(v, kind) {
  if (Array.isArray(v)) return v.length === 0
  if (kind === 'year' || kind === 'number' || kind === 'id') return !Number(v)
  return String(v ?? '').trim() === ''
}

export function WorkDetails({ open, onClose, kind, item, onChanged, onDelete }) {
  const path = kind === 'book' ? 'books' : 'movies'
  // The medium, which decides three things on this screen: what the credit is
  // called, which supplier ids are worth showing, and what "Type" reads as.
  // `book` has no media type of its own, so it is its own answer.
  const mediaType = kind === 'book' ? 'book' : item?.media_type || 'movie'
  const specs = specsFor(kind === 'book' ? BOOK_FIELDS : MOVIE_FIELDS, mediaType)
  const [view, setView] = useState('fields') // fields | lookup | merge
  const [merge, setMerge] = useState(null) // { rows, candidate }
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [genreSuggestions, setGenreSuggestions] = useState([])

  useEffect(() => {
    if (!open) return
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
  }, [open])
  // Re-opening the panel always lands on the field list, never on a half-done
  // merge from last time.
  useEffect(() => {
    if (open) { setView('fields'); setMerge(null); setError('') }
  }, [open])

  if (!item) return null

  // save PUTs the whole record with `patch` applied. One field or ten — the
  // merge screen uses the same call, so there is one write path to reason about.
  async function save(patch, label) {
    setBusy(label || 'save')
    setError('')
    const r = await json('PUT', `/${path}/${item.id}`, { ...fullState(kind, item), ...patch })
    setBusy('')
    if (!r.ok) {
      setError(errText(r, t('error.save.generic')))
      return false
    }
    onChanged?.(r.data)
    return true
  }

  // Returns whether the write landed, so InlineField keeps the editor (and what
  // was typed) open when it did not.
  // saveAll — every open, edited row committed in ONE request.
  //
  // Merged into a single patch rather than looped over saveField, and that is
  // the whole correctness argument. Each row PUTs the FULL record with its own
  // field changed, so six rows saving themselves is six full-state writes over
  // the top of each other: in parallel the last reply wins, and in sequence each
  // one still reads `item` as it was before the previous reply landed. Either
  // way five edits are silently lost behind five toasts saying they were saved.
  async function saveAll(entries, closeAll) {
    const patch = {}
    for (const e of entries) {
      const spec = specs.find((s) => s.key === e.key)
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
      return
    }
    if (!Object.keys(patch).length) return
    if (await save(patch)) {
      // Closed only after the server agreed, like every row does on its own: a
      // failed save must leave what you typed on the screen.
      closeAll()
      const n = entries.length
      toast(t('common.work.fields-saved.toast', { count: n, n }))
    }
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
    return buildRows(cand, c.poster_url || '')
  }

  // buildRows keeps only the fields the match actually has something to say
  // about AND that differ from what is stored. A row that would change nothing
  // is noise on a phone screen.
  function buildRows(cand, artUrl) {
    const rows = []
    for (const spec of specs) {
      // A match proposes the fields it actually carries. The supplier ids are
      // deliberately not among them: adopting an id without the record behind
      // it would leave the row pointing at something it does not describe —
      // "Re-sync everything" is the control that changes both together.
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
    onChanged?.(r.data)
    toast(t('common.work.resync.toast'))
    setMerge(null)
    setView('fields')
  }

  const title = t(
    view === 'merge' ? 'common.work.merge.title' : view === 'lookup' ? 'common.work.lookup.title' : 'common.work.details.title',
  )

  return (
    <FormModal open={open} onClose={onClose} title={title} maxWidth={620}>
      <ErrorText>{error}</ErrorText>

      {view === 'fields' && (
        <FieldList
          kind={kind}
          item={item}
          specs={specs}
          mediaType={mediaType}
          busy={busy}
          genreSuggestions={genreSuggestions}
          onSaveField={saveField}
          onSaveAll={saveAll}
          onCover={(patch) => save(patch, 'cover')}
          onChanged={onChanged}
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
    </FormModal>
  )
}

// ---- the resting view ------------------------------------------------------

function FieldList({ kind, item, specs, mediaType, busy, genreSuggestions, onSaveField, onSaveAll, onCover, onChanged, onFetch, onDelete }) {
  const artPath = kind === 'book' ? item.cover_path : item.poster_path
  // THE MASTER SAVE. Every row still saves itself — that is what the panel is
  // for, and changing one field should not cost more than one press. What it
  // did cost was six presses for six fields, so the header offers one.
  //
  // It goes through the dialog's own header slot rather than being a button
  // this component draws, so it lands in the same place on a phone's sheet and
  // on a desktop dialog, and greys with its reason on it like every other ✓.
  // "Nothing to save" is inside the five-word rule.
  const unsaved = useUnsavedFields()
  const host = useFormHost(unsaved.count ? '' : t('common.work.details.nothing-to-save.hint'))
  async function submit(e) {
    e.preventDefault()
    if (!unsaved.count) return
    await onSaveAll(unsaved.collect(), unsaved.closeAll)
  }
  return (
    // A real <form> bound to the header's ✓ by the HTML `form=` attribute, the
    // way every other dialog in this app does it.
    <form id={host?.formId} onSubmit={submit} className="space-y-3">
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
        onUploaded={(rec) => onChanged?.(rec)}
        search={kind === 'book'
          ? { isbn: item.isbn, title: item.title, author: item.author, asin: item.asin }
          : { title: item.title, year: item.release_year, mediaType: item.media_type || 'movie', tmdbId: item.tmdb_id, tvdbId: item.tvdb_id, igdbId: item.igdb_id }}
      />

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

      <div>
        {specs.map((spec) => {
          const label = labelFor(spec, mediaType)
          const value = resting(spec, item)
          if (spec.kind === 'id') {
            // A supplier id edits like any other field, but reads as a link to
            // the record it names — the number itself is only worth looking at
            // when you are checking it, and then you want to open it.
            return (
              <InlineField
                key={spec.key}
                fieldKey={spec.key}
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
                fieldKey={spec.key}
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
                fieldKey={spec.key}
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
              fieldKey={spec.key}
              label={label}
              value={value}
              hint={spec.hint}
              busy={!!busy}
              nameCase={!!spec.nameCase}
              multiline={spec.kind === 'long'}
              inputMode={spec.kind === 'number' ? 'decimal' : undefined}
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
      </UnsavedFieldsContext.Provider>
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FieldIconButton
          icon={<IconBack />}
          ariaLabel={t('common.work.merge.back.aria')}
          onClick={onBack}
        />
        <MonoLabel>{sourceLabel}</MonoLabel>
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
                      {r.current ? <CoverPreview url={r.current} label="" className="w-16" /> : <Placeholder kind={t('common.badge.none')} className="w-16" />}
                    </span>
                    <span className="merge-art-side">
                      <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t('common.work.merge.theirs.label')}</MonoLabel>
                      <CoverPreview url={r.next} label="" className="w-16" />
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
        <StickerButton type="button" disabled={!!busy || chosen === 0} onClick={() => onApply(state)}>
          {busy === 'merge'
            ? t('common.action.apply.busy')
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
