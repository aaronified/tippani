// works.jsx — shared building blocks for "works" (books + films/shows), the two
// halves of the catalogue that render in parallel across the Library, Movies,
// Search and Metadata screens. Kept in their own module so both sides compose
// the same pieces instead of re-deriving them (and to avoid a ui ↔ people
// import cycle — this layer is free to import from both).
import { useState } from 'react'
import { DEMO, coverImgURL, errText, json } from './api.js'
import { t } from './i18n.js'
import { CreditFaces, PersonPortrait, splitCredits } from './people.jsx'
import {
  ConfirmDialog,
  EmptyState,
  ErrorText,
  ExpandableDescription,
  FavBadge,
  GenreFilter,
  HandCard,
  Hearts,
  IconBack,
  IconButton,
  IconExport,
  IconFilter,
  MobileSheet,
  MonoLabel,
  MoreMenu,
  MultiSelect,
  PageHeader,
  PartialDateField,
  PickMark,
  Placeholder,
  QuizSkipMark,
  SHELF_META,
  Select,
  SheetFooter,
  StateTag,
  StatusBar,
  useIsMobileScreen,
  ReadingBadge,
  Toggle,
  Tooltip,
  filterChipClass,
  formatPartialDate,
  seriesLabel,
  shelfLabel,
  useCardMenu,
} from './ui.jsx'
import { actionsFor } from './actions.jsx'
import { usePractice } from './review.jsx'
import { useBulkOps } from './bulkOps.jsx'
import { selectionClick, selectionMenuItems } from './selection.jsx'

// ---- shelf state (§3f) -----------------------------------------------------
// A work has one shelf state, and everything visual keys off it: the colour bar
// under its cover, the chip on its detail, the filter dropdown, the pin at the
// top of the default board. Two axes fold into one label here:
//
//   status    what YOU said — reading/watching · paused · abandoned · completed
//   wishlist  what the data says — nothing quoted from it yet (derived, no column)
//
// A set status WINS over wishlist. A book you started last night has no quotes
// yet, so it satisfies both; the state you chose is the truer label. The wishlist
// FILTER still keys on the count alone (see wishFilter), so the two chips never
// disagree about the same row.

// ACTIVE_STATUS is the in-progress word for a side — the only state that pins a
// work to the top of its board and the only one the shelf cap counts. Mirrors
// activeStatus() in internal/httpapi/shelf.go.
//
// KEYED BY CAP KEY, NOT BY KIND, since 0040. A game is PLAYED, not watched, and
// games share the movies table — so `ACTIVE_STATUS[kind]` would have handed every
// game the word "watching" and quietly excluded it from its own board's pinned
// row. `.book` and `.movie` still read the same, so the callers that genuinely
// mean "the books side" are unchanged; anything holding an item should go through
// activeStatusFor instead.
export const ACTIVE_STATUS = { book: 'reading', movie: 'watching', show: 'watching', game: 'playing' }

// SHELF_CAPS — how many works may be in progress at once before the cap dialog
// asks whether you mean it. Films are capped hardest: two at a time is already
// unusual, whereas five part-read books is an ordinary shelf. Keyed the way the
// board asks: books, then films, shows and games separately (a binge-watched
// series should not crowd out a film). Games get three — more than a film,
// because a long game sits unfinished for months and two would nag constantly,
// fewer than a book, because you cannot really be playing five at once.
// Mirrors shelfCap() on the server.
export const SHELF_CAPS = { book: 5, movie: 2, show: 5, game: 3 }

// activeStatusFor is the in-progress word for one ROW, which is the only version
// that can tell a game from a film.
export function activeStatusFor(kind, item = {}) {
  return ACTIVE_STATUS[capKeyFor(kind, item)]
}

// isActive says whether a row is the in-progress one for its side.
export function isActive(kind, item) {
  return item.status === activeStatusFor(kind, item)
}

// shelfState names the state a tile/detail should draw, or null when a work is
// simply in the library with quotes and no status of its own.
export function shelfState(kind, item) {
  if (item.status) return item.status
  const count = kind === 'book' ? item.annotation_count || 0 : item.dialogue_count || 0
  return count === 0 ? 'wishlist' : null
}

// capKeyFor picks which cap pool a work belongs to: books, films, shows or games.
export function capKeyFor(kind, item) {
  if (kind === 'book') return 'book'
  const mt = item.media_type || 'movie'
  if (mt === 'show') return 'show'
  if (mt === 'game') return 'game'
  return 'movie'
}

// creditNounFor / creditLabelFor name the primary credit for a media type — the
// column is movies.director for all three. ONE definition rather than the four
// inline `isShow ? 'Creator' : 'Director'` ternaries that were spread across the
// add form, the edit form and the detail header, because a fourth media type is
// four places to forget rather than one.
export function creditNounFor(mediaType) {
  if (mediaType === 'game') return t('common.field.studio.label')
  if (mediaType === 'show') return t('common.field.creator.label')
  return t('common.field.director.label')
}

export function creditLabelFor(mediaType) {
  if (mediaType === 'game') return t('common.badge.studio')
  if (mediaType === 'show') return t('common.badge.created-by')
  return t('common.badge.director')
}

// personKindFor is the people-console kind a work's primary credit belongs to.
// It matters because a studio and a director share movies.director and are told
// apart only by media_type — the same split the server's people queries make.
export function personKindFor(mediaType) {
  return mediaType === 'game' ? 'studio' : 'director'
}

// decadeOf floors a year to its decade using the full 4-digit year, so old
// works land in the right century (1850 → 1850s, distinct from 1950s).
export function decadeOf(year) {
  if (!year) return null
  return Math.floor(year / 10) * 10
}

// groupWorks buckets an (already filtered + sorted) list into labelled groups
// for a "group by" view — the one bucketing used by both the Library group-by
// and the Search grouped results. Order: series/credit alphabetical, decade
// newest first, genre by size; the catch-all bucket (no series/credit/year/
// genre) always sinks to the end. A work with several credits or genres appears
// in each. Members keep the incoming order unless `sortMembers` reorders them.
//
// `dim` is 'series' | 'author' | 'decade' | 'genre' ('author' means the primary
// credit — authors for books, directors/creators for films), or ANY other
// string, which is treated as a caller-defined single-value facet. Accessors
// keep the util blind to the data shapes it serves:
//   credit(item)      → the credit string       (default '')
//   year(item)        → a 4-digit year          (default null)
//   genres(item)      → string[]                (default [])
//   series(item)      → the series name         (default item.series)
//   facet(item, dim)  → the value for any other dim   (default '')
//
// The facet branch exists because the Quotes page groups by medium and by
// place, and both have exactly the shape 'series' has — one value, alphabetical,
// with a residual bucket. Routing them through `series` would have worked and
// would have meant a screen with no series calling an accessor named series,
// which is the kind of thing that reads as a bug forever after. Since medium and
// place are literal column names, that call site passes `(u, d) => u[d]`.
//
// Options: splitCredit (split the credit into co-credits, books), seps (the
// separator set for that split), creditResidual (label for the no-credit
// bucket), facetResidual(dim) → label for the no-value bucket,
// sortMembers(members, dim) → members.
export function groupWorks(list, dim, opts = {}) {
  const {
    credit = () => '',
    year = () => null,
    genres = () => [],
    series = (it) => it.series,
    facet = () => '',
    splitCredit = false,
    seps,
    creditResidual = t('common.group.unknown-credit.label'),
    facetResidual = () => t('common.group.none.label'),
    sortMembers,
  } = opts
  const map = new Map()
  const add = (key, label, it, o = {}) => {
    let g = map.get(key)
    if (!g) {
      g = { key, label, items: [], residual: !!o.residual, order: o.order }
      map.set(key, g)
    }
    g.items.push(it)
  }
  for (const it of list) {
    if (dim === 'series') {
      const s = series(it)
      if (s) add(s, s, it)
      else add('~none', t('common.group.no-series.label'), it, { residual: true })
    } else if (dim === 'author') {
      const c = credit(it)
      const names = splitCredit ? splitCredits(c, seps) : c ? [c] : []
      if (names.length) names.forEach((n) => add(n, n, it))
      else add('~none', creditResidual, it, { residual: true })
    } else if (dim === 'decade') {
      const d = decadeOf(year(it))
      if (d != null) add(String(d), t('common.group.decade.label', { year: d }), it, { order: d })
      else add('~none', t('common.group.unknown-year.label'), it, { residual: true })
    } else if (dim === 'genre') {
      const gs = genres(it)
      if (gs.length) gs.forEach((g) => add(g, g, it))
      else add('~none', t('common.group.no-genre.label'), it, { residual: true })
    } else {
      // Caller-defined facet — one value per item, sorted alphabetically by the
      // fall-through at the bottom, with its own residual label.
      const v = facet(it, dim)
      if (v) add(v, v, it)
      else add('~none', facetResidual(dim), it, { residual: true })
    }
  }
  const out = [...map.values()]
  out.sort((a, b) => {
    if (a.residual !== b.residual) return a.residual ? 1 : -1
    if (dim === 'decade') return (b.order ?? 0) - (a.order ?? 0)
    if (dim === 'genre') return b.items.length - a.items.length || a.label.localeCompare(b.label)
    return a.label.localeCompare(b.label)
  })
  if (sortMembers) for (const g of out) if (!g.residual) g.items = sortMembers(g.items, dim)
  return out
}

// wishFilter applies the 3-way wishlist scope to a list. `mode` is '' (all),
// 'wishlist' (only works with nothing quoted yet) or 'annotated' (hide those).
// `count` reads a row's quote/dialogue total — the same number the tile prints,
// so what the filter matches is always what the board shows.
//
// Note it keys on the count alone, NOT on shelfState(): a book you are reading
// with no quotes yet draws the reading mark rather than the wishlist one, but it
// is still un-annotated, and hiding it from "annotated" would make the two chips
// disagree about the same row.
export function wishFilter(list, mode, count) {
  if (mode === 'wishlist') return list.filter((it) => count(it) === 0)
  if (mode === 'annotated') return list.filter((it) => count(it) > 0)
  return list
}

// pinInProgress floats what you're reading/watching to the front of the default
// view, keeping both blocks in their incoming (server, created_at DESC) order.
// Only the default sort pins: picking anything from the sort menu is the user
// taking control of the order, and the answer there is the sort they asked for.
// Only the ACTIVE state pins — paused, abandoned and completed are not what you
// are on with right now, so they stay where the data puts them.
export function pinInProgress(list, kind) {
  const pinned = list.filter((it) => isActive(kind, it))
  if (pinned.length === 0 || pinned.length === list.length) return list
  return [...pinned, ...list.filter((it) => !isActive(kind, it))]
}

// statusFilter keeps only rows whose status is among `states`. An empty
// selection means "every state", which is what a filter with nothing ticked
// should mean. 'none' matches works carrying no status at all.
export function statusFilter(list, states) {
  if (!states || states.length === 0) return list
  return list.filter((it) => states.includes(it.status || 'none'))
}

// InProgressCapDialog — the soft cap. Starting one more work than the shelf holds
// (5 books · 2 films · 5 shows) opens this instead of silently refusing: it lists
// what is already on that shelf so you can settle one — `onRelease` finishes a row
// in place — or wave the cap through with "Start it anyway". The cap is a nudge to
// keep the shelf worth glancing at, never a wall.
//
// `items` are the works holding the shelf ({id, title, meta}); `noun` is what
// they are ("book"), `verb` the state they are in ("reading"), `pastLabel` the
// settle-it action ("Mark as read").
//
// `nounPlural` follows the pattern `creditNounPlural` below already sets: a
// caller that names the noun should name its plural, because appending an s is an
// English rule and not a fact about nouns. The s stays as the fallback until
// every call site passes one.
export function InProgressCapDialog({ open, items, cap, noun, nounPlural = `${noun}s`, verb, pastLabel, onRelease, onProceed, onCancel, busyId, error }) {
  return (
    <ConfirmDialog
      open={open}
      title={t('common.work.cap.confirm.title', { verb, n: items.length })}
      confirmLabel={t('common.work.cap.confirm.action.label')}
      onCancel={onCancel}
      onConfirm={onProceed}
      body={
        <>
          <p>
            {t('common.work.cap.confirm.body', { n: cap, count: cap, noun: cap === 1 ? noun : nounPlural })}
          </p>
          <ul className="mt-3 space-y-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ color: 'var(--ink)' }}>
                    {it.title}
                  </span>
                  {it.meta && (
                    <span className="block truncate" style={{ fontSize: 'var(--type-ui-13)', color: 'var(--faint)' }}>
                      {it.meta}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="tp-chip tp-chip-btn shrink-0"
                  disabled={busyId === it.id}
                  onClick={() => onRelease(it)}
                >
                  {busyId === it.id ? t('common.action.save.busy') : pastLabel}
                </button>
              </li>
            ))}
          </ul>
          <ErrorText>{error}</ErrorText>
        </>
      }
    />
  )
}

// ShelfDateDialog — the date prompt a transition opens. Starting a work asks when
// you started; finishing or abandoning asks when you stopped. It opens on today,
// because that is almost always the answer, and the picker is there for the times
// it is not (a book you finished last month, or one you only know you read "in
// 2019" — see PartialDateField).
export function ShelfDateDialog({ open, title, label, value, onChange, onConfirm, onCancel, confirmLabel, error }) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel || t('common.action.save.label')}
      onCancel={onCancel}
      onConfirm={onConfirm}
      body={
        <>
          <PartialDateField
            label={label}
            value={value}
            onChange={onChange}
            hint={t('common.work.shelf-date.hint')}
          />
          <ErrorText>{error}</ErrorText>
        </>
      }
    />
  )
}

// posUnitFor is the unit a work can be counted in — pages for a book, episodes
// for a show. A film has neither, so it tracks in percent alone. Mirrors
// posUnitFor() in internal/httpapi/shelf.go.
export function posUnitFor(kind, item = {}) {
  if (kind === 'book') return 'page'
  return (item.media_type || 'movie') === 'show' ? 'episode' : ''
}

// ofTotal renders "current of total" as a zero-padded pair, the way an episode is
// actually cited: 6 of 10 is "06/10", 2 of 3 is "02/03", 6 of 456 is "006/456",
// 11 of 123 is "011/123".
//
// Two digits is the floor even when the total needs only one, so a short run reads
// like a long one; past 99 the pair widens together. BOTH sides are padded, so the
// two halves are always the same width and a column of these cannot rag.
function ofTotal(current, total) {
  const width = Math.max(2, String(total).length)
  return `${String(current).padStart(width, '0')}/${String(total).padStart(width, '0')}`
}

// positionLabel reads a position back in its own units: "p. 128 of 320",
// "E06/10 · S02/03". '' when a work is tracked as a bare percentage.
export function positionLabel(pos) {
  if (!pos || !pos.pos_unit || !pos.pos_total) return ''
  if (pos.pos_unit === 'episode') {
    // Episode first: it is the finer of the two, and the thing you are actually
    // on. The season follows as the coarser context, and only when there is a
    // run to place it in.
    const episode = t('common.position.episode.label', { a: ofTotal(pos.pos || 0, pos.pos_total) })
    if (!pos.season_total) return episode
    return t('common.position.episode-season.label', { a: episode, b: ofTotal(pos.season || 1, pos.season_total) })
  }
  return t('common.position.page.label', { a: pos.pos || 0, b: pos.pos_total })
}

// ShelfProgress — the track under a work's state chip on its detail. Any
// in-progress work shows it, so "where am I" is answered without opening the
// popover, in the units the work is actually counted in.
export function ShelfProgress({ status, progress = 0, pos }) {
  const label = positionLabel(pos)
  return (
    <span style={{ display: 'block', minWidth: 168, maxWidth: 260 }}>
      <StatusBar state={status} progress={progress} radius={3} />
      <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)', letterSpacing: '.06em', color: 'var(--faint)' }}>
        {/* The percentage is only worth words when it is the ONLY thing known.
            Where the work counts in its own units, "E06/10" already says where
            you are more precisely than "53%" does, and the bar beside it is
            drawn from that percentage anyway — so printing both just crowds it. */}
        {label || `${progress}%`}
      </span>
    </span>
  )
}

// ShelfControl — a work's shelf state on its detail: the state chip (whose
// popover holds the transitions and, while in progress, the progress field), the
// ×N read-count chip whose popover lists the history, and — for anything in
// progress — the progress track. Purely presentational: the page owns the cap
// check, the date prompt and the save.
//
// `onSelect(next)` takes the status the user picked; `onProgress(patch)` takes
// either { progress } or a position ({ pos_unit, pos, pos_total, … }).
// `wishlist` is the derived fallback shown when a work has no status of its own.
// ProgressEditor — the progress field inside the state chip's popover. Two ways
// to say the same thing, one visible at a time so there is never a question about
// which number is authoritative:
//
//   %      a plain percentage, the only option for a film
//   pages  the page you are on out of the book's pages — what a physical book
//          actually gives you, and no arithmetic to do in your head
//   eps    season + episode for a show, since a series has both
//
// The percentage is DERIVED from a unit position server-side (see position.percent
// in shelf.go), so the bar under every cover keeps reading one number.
function ProgressEditor({ kind, unit, status, progress, pos, busy, onSave }) {
  const tracking = pos?.pos_unit === unit && unit !== ''
  const [mode, setMode] = useState(tracking ? 'unit' : 'pct')
  const [pct, setPct] = useState(String(progress || 0))
  const [at, setAt] = useState(String(pos?.pos || ''))
  const [total, setTotal] = useState(String(pos?.pos_total || ''))
  const [season, setSeason] = useState(String(pos?.season || ''))
  const [seasonTotal, setSeasonTotal] = useState(String(pos?.season_total || ''))
  const num = (s) => Math.max(0, Number(s || 0))
  const digits = (v, max = 5) => v.replace(/\D/g, '').slice(0, max)
  const episodes = unit === 'episode'
  // A count needs something to count towards, which is the same rule the server
  // enforces — caught here so the message arrives beside the empty field.
  const missingTotal = mode === 'unit' && num(at) > 0 && num(total) === 0
  const preview =
    mode === 'unit' && num(total) > 0
      ? Math.round(
          (episodes && num(seasonTotal) > 0
            ? (Math.max(1, num(season)) - 1 + num(at) / num(total)) / num(seasonTotal)
            : num(at) / num(total)) * 100,
        )
      : Math.min(100, num(pct))
  const save = () => {
    if (mode === 'pct') return onSave({ progress: Math.min(100, num(pct)) })
    if (missingTotal) return
    onSave({
      pos_unit: unit,
      pos: num(at),
      pos_total: num(total),
      ...(episodes ? { season: num(season), season_total: num(seasonTotal) } : {}),
    })
  }
  const field = (label, value, set, max) => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 'var(--type-ui-13)', color: 'var(--soft)' }}>{label}</span>
      <input
        className="tp-input"
        inputMode="numeric"
        style={{ width: 58 }}
        aria-label={label}
        value={value}
        onChange={(e) => set(digits(e.target.value, max))}
      />
    </label>
  )
  return (
    <div style={{ padding: '4px 6px 8px' }}>
      <MonoLabel className="mb-1.5 block">{t('common.progress.editor.title')}</MonoLabel>
      {unit !== '' && (
        <div className="mb-2">
          <Toggle
            ariaLabel={t('common.progress.unit.aria')}
            value={mode}
            onChange={setMode}
            options={[['pct', t('common.progress.unit.percent.label')], ['unit', t(episodes ? 'common.progress.unit.episodes.label' : 'common.progress.unit.pages.label')]]}
          />
        </div>
      )}
      {mode === 'pct' ? (
        <div className="flex items-center gap-2">
          {field(t('common.progress.unit.percent.label'), pct, setPct, 3)}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {episodes && field(t('common.progress.field.season.label'), season, setSeason, 3)}
          {episodes && field(t('common.progress.field.of.label'), seasonTotal, setSeasonTotal, 3)}
          {field(t(episodes ? 'common.progress.field.episode.label' : 'common.progress.field.page.label'), at, setAt, 5)}
          {field(t('common.progress.field.of.label'), total, setTotal, 5)}
        </div>
      )}
      {missingTotal && (
        <span style={{ display: 'block', marginTop: 5, fontSize: 'var(--type-ui-12)', color: 'var(--error)' }}>
          {t(episodes ? 'error.validate.episodes-total' : 'error.validate.pages-total')}
        </span>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1">
          <StatusBar state={status} progress={preview} radius={3} />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)', color: 'var(--faint)' }}>{preview}%</span>
        <button type="button" className="tp-chip tp-chip-btn" disabled={busy || missingTotal} onClick={save}>
          {t('common.action.set.label')}
        </button>
      </div>
    </div>
  )
}

// ReadLog — the read/watch history, editable.
//
// work_reads could only ever be written as a side effect of a status change,
// which records what is happening now and is hopeless for what happened before.
// A book read three times over fifteen years had one row at best, and there was
// no way to say "I finished this in 2009" about something already on the shelf.
// 1.7.2 then made the Library sortable by that log, which turned it from a
// curiosity into something the shelf order depends on — and a sort you cannot
// correct is worse than no sort.
//
// THE OPEN READ IS NOT EDITABLE HERE, and that is the design rather than a
// shortcut. The status control and the log are kept consistent by one path, and
// the open row IS that consistency: it exists exactly while the work is in
// progress. Deleting it would leave a book reading with nothing being read.
// Both things you might want to do to it — finish it, abandon it — are already
// one tap away in the status menu above, so the row says so instead of offering
// a second route to an inconsistent state.
export function ReadLog({ kind, workId, reads = [], onChanged }) {
  const [editing, setEditing] = useState(null) // a read id, or 'new'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const path = kind === 'movie' ? 'movies' : 'books'

  async function run(method, url, body) {
    setBusy(true)
    setError('')
    const r = await json(method, url, body)
    setBusy(false)
    if (!r.ok) {
      setError(errText(r, t(kind === 'movie' ? 'error.save.watch' : 'error.save.read')))
      return false
    }
    setEditing(null)
    onChanged?.()
    return true
  }

  return (
    <div className="read-log-wrap">
      <ul className="read-log">
        {reads.map((r, i) => (
          <li key={r.id ?? i}>
            <span className="read-n">{i + 1}</span>
            {editing === r.id ? (
              <ReadForm
                initial={r}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(body) => run('PUT', `/reads/${r.id}`, body)}
                onDelete={() => run('DELETE', `/reads/${r.id}`)}
              />
            ) : (
              <>
                <span>
                  {r.outcome === 'open'
                    ? t('common.read-log.range.open.label', { a: formatPartialDate(r.started_at) || t('common.read-log.unknown.label') })
                    : t('common.read-log.range.label', {
                        a: formatPartialDate(r.started_at) || t('common.read-log.unknown.label'),
                        b: formatPartialDate(r.finished_at) || t('common.read-log.unknown.label'),
                      })}
                  {r.outcome === 'abandoned' && <span className="read-open">{t('common.read-log.abandoned.label')}</span>}
                </span>
                {r.outcome === 'open' ? (
                  <span className="read-hint">{t('common.read-log.open.hint')}</span>
                ) : (
                  <button type="button" className="read-edit" onClick={() => setEditing(r.id)}>
                    {t('common.read-log.edit.label')}
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new' ? (
        <ReadForm
          initial={{ started_at: '', finished_at: '', outcome: 'finished' }}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(body) => run('POST', `/${path}/${workId}/reads`, body)}
        />
      ) : (
        <button type="button" className="read-add" onClick={() => setEditing('new')}>
          {t(kind === 'movie' ? 'common.read-log.add.film.label' : 'common.read-log.add.book.label')}
        </button>
      )}
      {error && <p className="tp-error">{error}</p>}
    </div>
  )
}

// ReadForm — two partial dates and an outcome.
//
// The dates stay partial on purpose. "I read it in 2009" is a real answer, and
// padding it to a January morning would invent a precision nobody had — the same
// reasoning the schema has carried since 0024. So these are text inputs with a
// shape hint rather than date pickers, which cannot express a bare year.
function ReadForm({ initial, busy, onCancel, onSave, onDelete }) {
  const [started, setStarted] = useState(initial.started_at || '')
  const [finished, setFinished] = useState(initial.finished_at || '')
  const [outcome, setOutcome] = useState(initial.outcome === 'abandoned' ? 'abandoned' : 'finished')
  return (
    <span className="read-form">
      <input
        className="tp-input read-date"
        value={started}
        onChange={(e) => setStarted(e.target.value)}
        placeholder={t('common.read-log.started.placeholder')}
        aria-label={t('common.field.started.label')}
      />
      <input
        className="tp-input read-date"
        value={finished}
        onChange={(e) => setFinished(e.target.value)}
        placeholder={t('common.read-log.finished.placeholder')}
        aria-label={t('common.field.finished.label')}
      />
      <select
        className="tp-input read-outcome"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        aria-label={t('common.field.outcome.label')}
      >
        <option value="finished">{t('common.read-log.outcome.finished.label')}</option>
        <option value="abandoned">{t('common.read-log.outcome.abandoned.label')}</option>
      </select>
      <button
        type="button"
        className="read-edit"
        disabled={busy}
        onClick={() => onSave({ started_at: started.trim(), finished_at: finished.trim(), outcome })}
      >
        {t('common.read-log.save.label')}
      </button>
      <button type="button" className="read-edit" disabled={busy} onClick={onCancel}>
        {t('common.read-log.cancel.label')}
      </button>
      {onDelete && (
        <button type="button" className="read-edit read-danger" disabled={busy} onClick={onDelete}>
          {t('common.read-log.delete.label')}
        </button>
      )}
    </span>
  )
}

export function ShelfControl({ kind, item = {}, status, progress = 0, pos, reads = [], wishlist, onSelect, onProgress, onReadsChanged, busy }) {
  // Per ROW, not per kind: this control is what offers "start playing" on a game
  // and "start watching" on a film, and both are movies-table rows.
  const active = activeStatusFor(kind, item)
  const unit = posUnitFor(kind, item)
  // Which moves are offered. From completed the only way on is to start again —
  // pausing or abandoning something you already finished is not a thing that
  // happens — but clearing stays available everywhere as the undo for a mis-tap.
  const moves =
    status === 'completed'
      ? [active, '']
      : [active, 'paused', 'abandoned', 'completed', ''].filter((s) => s !== status)
  const finished = reads.filter((r) => r.outcome === 'finished').length
  const state = status || (wishlist ? 'wishlist' : null)

  // Untracked and already quoted from: no state to show, but every state has to
  // stay REACHABLE — a book you finished years ago should go straight to
  // "completed" without pretending to read it first. The chip is the one
  // transitions surface, so it stands in as a quiet "Shelve" until there is a
  // state to name. (The ⋯ / standing button remains the one-tap shortcut for the
  // overwhelmingly common case, marking it as being read now.)
  if (!state) {
    return (
      <StateTag state="" label={t('common.shelf.shelve.label')}>
        {(close) => transitionItems(kind, status, moves, busy, close, onSelect)}
      </StateTag>
    )
  }

  // Wishlist is derived, so its chip explains itself rather than offering a way
  // off it — but it still carries the transitions, so a work you have never
  // quoted from can go on a shelf without first being marked up.
  if (state === 'wishlist') {
    return (
      <StateTag state="wishlist" label={t('common.shelf.wishlist.book.label')} tip={t('common.shelf.wishlist.tip')}>
        {(close) => (
          <>
            <p style={{ padding: '4px 6px 8px', fontSize: 'var(--type-ui-13)', lineHeight: 1.5, color: 'var(--soft)' }}>
              {t('common.shelf.wishlist.explainer.prose')}
            </p>
            {transitionItems(kind, status, moves, busy, close, onSelect)}
          </>
        )}
      </StateTag>
    )
  }
  return (
    <>
      <StateTag state={state} label={shelfLabel(state, kind)} tip={t('common.shelf.change.tip')}>
        {(close) => (
          <>
            {status === active && (
              <ProgressEditor
                kind={kind}
                unit={unit}
                status={status}
                progress={progress}
                pos={pos}
                busy={busy}
                onSave={onProgress}
              />
            )}
            {transitionItems(kind, status, moves, busy, close, onSelect)}
          </>
        )}
      </StateTag>
      {/* The log is always reachable, not only once something has been finished.
          Recording that you read a book in 2009 is the whole point of editing
          history, and gating the way in on the history already existing made it
          impossible for exactly the books it matters for. */}
      <StateTag state={state} label={t('common.shelf.reads.label', { n: finished })} tip={t('common.shelf.read-log.tip')}>
        <ReadLog kind={kind} workId={item.id} reads={reads} onChanged={onReadsChanged} />
      </StateTag>
      {/* Any in-progress work shows its track, in its own units.
          LAST, and on its own line. It used to sit BETWEEN the state chip and the
          ×N counter, which on a phone put a 168px-wide bar in the middle of a
          wrapping row of chips: the row broke around it and the state, the track
          and the counter came out on three lines in no particular order. Chips
          first, then the track — and `.shelf-track` takes the whole line on a
          narrow screen, so the order is the same every time. */}
      {(status === active || status === 'paused') && (
        <span className="shelf-track">
          <ShelfProgress status={status} progress={progress} pos={pos} />
        </span>
      )}
    </>
  )
}

// transitionItems renders one menu row per legal move, each swatched in the
// colour its state will paint the bar. Shared by the state chip and the
// stand-in "Shelve" chip so there is one transitions menu, not two.
function transitionItems(kind, from, moves, busy, close, onSelect) {
  return moves.map((next) => (
    <button
      key={next || 'none'}
      type="button"
      role="menuitem"
      className="menu-item"
      disabled={busy}
      onClick={() => {
        close()
        onSelect(next)
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          flex: 'none',
          background: next ? SHELF_META[next].color : 'transparent',
          border: next ? 'none' : '1px solid var(--line)',
        }}
      />
      {moveLabel(kind, from, next)}
    </button>
  ))
}

// moveLabel words a transition the way a person would say it, given where the
// work is now. Starting again after finishing is a reread, not a fresh start.
// moveLabel names the button for one shelf transition.
//
// It switches on the DESTINATION word rather than on the kind, which is what lets
// games join without a third branch everywhere: 'playing' is its own case, and a
// completed game reads "Play it again" rather than "Watch it again".
export function moveLabel(kind, from, to) {
  const book = kind === 'book'
  switch (to) {
    case 'playing':
      if (from === 'completed') return t('common.shelf.move.playing.again.label')
      if (from === 'paused') return t('common.shelf.move.playing.resume.label')
      return t('common.shelf.move.playing.start.label')
    case 'reading':
    case 'watching':
      if (from === 'completed') return t(book ? 'common.shelf.move.reading.again.book.label' : 'common.shelf.move.reading.again.film.label')
      if (from === 'paused') return t(book ? 'common.shelf.move.reading.resume.book.label' : 'common.shelf.move.reading.resume.film.label')
      return t(book ? 'common.shelf.move.reading.start.book.label' : 'common.shelf.move.reading.start.film.label')
    case 'paused':
      return t('common.shelf.move.paused.label')
    case 'abandoned':
      return t('common.shelf.move.abandoned.label')
    case 'completed':
      // The finished word follows what you DID with it, so a game reads
      // "Mark as played" where a film reads "Mark as watched". `from` carries
      // that: only a game is ever moved to completed from 'playing'.
      if (from === 'playing') return t('common.shelf.move.completed.played.label')
      return t(book ? 'common.shelf.move.completed.book.label' : 'common.shelf.move.completed.film.label')
    default:
      return t('common.shelf.move.clear.label')
  }
}

// WorkCard — one catalogue tile for a book or a film/show: cover/poster (2:3)
// with the favourite badge, title, a credit face-chip + line, an optional
// series line, and a count. `kind` ('book' | 'movie') selects the book's
// hand-drawn card frame + "quotes" vs the film's plain poster + "dialogues".
// The book grid (Library) and poster grid (Movies) both deal these; each keeps
// its own <ul>/grid wrapper and gap, sharing only the tile.
export function WorkCard({ kind, item, index = 0, onOpen, people = {}, seps, selection, selectKind = kind, onChanged, onEdit }) {
  const isBook = kind === 'book'
  const isShow = !isBook && (item.media_type || 'movie') === 'show'
  const credit = isBook ? item.author : item.director
  const coverPath = isBook ? item.cover_path : item.poster_path
  const year = isBook ? item.published_year : item.release_year
  const count = isBook ? item.annotation_count || 0 : item.dialogue_count || 0
  const state = shelfState(kind, item)
  const image = coverPath ? (
    <img
      src={coverImgURL(coverPath)}
      alt={t(isBook ? 'common.cover.alt' : 'common.poster.alt', { title: item.title })}
      className="block aspect-[2/3] w-full object-cover"
    />
  ) : (
    <Placeholder kind={t(isBook ? 'common.badge.cover' : 'common.badge.poster')} className={isBook ? 'w-full rounded-none border-0' : 'w-full'} />
  )
  // ONE TILE FOR BOTH, and it is a HandCard.
  //
  // A book cover has always sat in a hand-card; a film poster sat in a bare
  // <span> with a 1px line and an 8px radius. So the Library's board wore the
  // app's material — the tile, the dither, the aesthetic toggle — and the
  // Catalogue's wore a rectangle, on two screens built from the same component
  // and reachable from each other in one tap. A film is not a lesser kind of
  // work and its board should not look like a different app's.
  //
  // The status bar rides INSIDE the card, directly under the artwork: the card
  // clips it to its own shape, so it reads as part of the card rather than a
  // stripe floating below it — and the artwork stays completely unobscured,
  // which is the whole point of a bar over a badge. That was already the book
  // branch's reasoning; it was never poster-specific.
  // ---- selecting a work (1.11.1) --------------------------------------------
  //
  // Long-press, Ctrl/Cmd-click, or the tickmark in the corner — the same three
  // doors a quote card has, and the same tick, because a selection that looked
  // like a checkbox on one board and something else on another would be two
  // affordances for one idea.
  //
  // THERE IS NO .card-text HERE, and that is the whole difference from a quote
  // card. A cover is a picture: there is nothing on this tile a thumb could
  // usefully select, so every press that is not on a control belongs to the card.
  // The title and the credit line under the artwork are labels rather than prose.
  //
  // ---- and its own menu (1.14.2) ---------------------------------------------
  //
  // This said "no context menu (an empty `items` list)", and gave a good reason:
  // a menu that opened on a gesture and offered nothing would teach the gesture
  // and then refuse it. What was actually empty was the registry's ITEM list for
  // a work — `bulkActionsFor` grew a work branch in 1.11.1 and `actionsFor` never
  // did — so the bar could skip a book in the quiz, fill its gaps, edit it and
  // delete it with exactly one thing selected, and the tile it was selected from
  // could do none of them. The gesture was not the problem; the list was.
  //
  // Everything here runs through the same `useBulkOps` the bar calls, with one id
  // instead of forty. Not for tidiness: two implementations of "skip this in the
  // quiz" is how a card and a bar come to disagree about what the act does, and
  // the card's own mark reports the result of whichever one ran.
  const picked = !!selection?.isSelected(item.id)
  const ops = useBulkOps({ kind, ids: [item.id], onDone: onChanged })
  const [asking, setAsking] = useState(false)
  // "Quiz me on this one." The dialog belongs to the tile that opened it, so it
  // closes with the board rather than outliving it.
  const { practise, practiceDialog } = usePractice()
  const acts = actionsFor(kind, item, {
    // Absent unless the board passes a reload — a surface that cannot refresh
    // after a write should not offer the write. That is the registry's rule and
    // it is what keeps this menu empty in a read-only context rather than
    // full of controls that appear to do nothing.
    fillGaps: onChanged ? () => ops.fillGaps() : undefined,
    setReview: onChanged
      ? (_, wasExcluded) =>
          ops.post(
            { review: wasExcluded },
            // The bar's own two, at n = 1. Spelled in English here until now, which
            // is a class of miss the pseudo-locale gate cannot catch: a toast is
            // not on screen when a screen mounts.
            wasExcluded
              ? t('common.selection.toast.back-in-quiz')
              : t('common.selection.toast.skipping', { n: 1, count: 1 }),
          )
      : undefined,
    excluded: !!item.review_excluded,
    edit: onEdit ? () => onEdit(item.id) : undefined,
    remove: onChanged ? () => setAsking(true) : undefined,
    // NOT gated on onChanged, unlike its neighbours. Every other action here
    // writes, and a surface that cannot reload after a write should not offer
    // one; a themed round only reads the pool, and grading inside it changes
    // nothing this tile draws.
    practise: () => practise({ [kind === 'book' ? 'book' : 'movie']: item.id, label: item.title }),
  })
  // SELECT FIRST, the same as a quote card's menu: the gesture that asks "what
  // can I do to this" is also how you start doing it to several. Select all
  // under it, from the shared helper.
  const menuItems = [
    ...selectionMenuItems(selection, item.id, selectKind),
    ...acts.map((x) => ({ ...x, onClick: x.run })),
  ]
  const { cardProps, menuClass, menu } = useCardMenu(
    menuItems,
    selection ? { onLongPress: () => selection.toggle(item.id, selectKind) } : undefined,
  )
  const onClick = (e) => {
    // The press already acted; running the click too would toggle it straight back.
    if (cardProps.onClickCapture?.(e)) return
    if (!selection) return onOpen(item.id)
    const what = selectionClick(e, selection)
    if (what === 'open') return onOpen(item.id)
    e.preventDefault()
    if (what === 'extend') selection.extendTo(item.id, selectKind)
    else selection.toggle(item.id, selectKind)
  }
  // The tick sits OUTSIDE the button, over it. A <label> wrapping an <input>
  // inside a <button> is invalid HTML and the browsers disagree about which of
  // the two nested controls a tap belongs to — so the tile stays a plain button
  // and the checkbox is a sibling positioned on top of it. `.work-tile` is the
  // positioned host, and the reason the hover rule keys off it rather than off
  // the tile.
  const tile = (
    <button
      type="button"
      onClick={onClick}
      className={`cover-tile block w-full text-left ${menuClass}`}
      title={item.title}
      {...cardProps}
      // The tile IS a button, so useCardMenu's onClickCapture cannot be spread on
      // as-is — onClick above calls it first and honours what it says.
      onClickCapture={undefined}
    >
      <HandCard
        variant={index % 4}
        className={`relative overflow-hidden cover-lift${picked ? ' is-picked' : ''}`}
      >
        {image}
        {state && <StatusBar state={state} progress={item.progress} />}
        {isShow && (
          <span
            className="tp-chip tp-scrim-deep absolute left-1.5 top-1.5"
            style={{ fontSize: 'var(--type-ui-9)', color: 'var(--on-scrim)', borderColor: 'transparent' }}
          >
            SHOW
          </span>
        )}
        {/* A show's poster already spends its top-left on the SHOW chip, so the
            reading mark stacks under it rather than overprinting. */}
        {isActive(kind, item) && <ReadingBadge kind={kind} stacked={isShow} />}
        {item.favorite && <FavBadge />}
      </HandCard>
      <p className="mt-2.5 truncate" style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 'var(--type-display-15)', color: 'var(--ink)' }}>
        {item.title}
      </p>
      <div className="flex items-center gap-1.5">
        {/* Credit face(s): authors / directors, co-credits overlapping (first on top). */}
        <CreditFaces names={splitCredits(credit, seps)} map={people} size={24} ring="var(--bg)" />
        <p className="min-w-0 truncate text-[13px]" style={{ color: 'var(--soft)' }}>
          {[credit, year || null].filter(Boolean).join(' · ') || ' '}
        </p>
      </div>
      {item.series && (
        <p className="truncate text-[12px]" style={{ color: 'var(--faint)', fontStyle: 'italic' }}>
          {seriesLabel(item)}
        </p>
      )}
      <div className="mt-0.5 flex items-center gap-2">
        {isBook ? (
          <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t('common.work-card.count.quote', { count, n: count })}</MonoLabel>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-12)', color: 'var(--amber)' }}>
            {t('common.work-card.count.dialogue', { count, n: count })}
          </span>
        )}
        {/* IN THE COUNT ROW, NOT OVER THE ARTWORK. Every other mark this tile
            wears is a badge on the cover, and this one deliberately is not: the
            comment above is explicit that keeping the artwork unobscured is why
            the shelf state is a bar rather than a badge, and a fourth overlay
            would spend the last free corner on the quietest fact here.

            `quiet`, because the tile IS a button — see QuizSkipMark. */}
        <QuizSkipMark item={item} quiet />
      </div>
    </button>
  )
  // ONE TAP, NOT A TYPED PHRASE, and the difference from the bulk bar is the
  // point rather than an inconsistency. The bar asks you to type "delete 12
  // books" because twelve is a number you can misread and one Undo covers the
  // whole lot; here the subject is the cover you just right-clicked, and the bin
  // holds it with every quote it took, restorable from the toast or from
  // Settings. That is the same net a single quote's delete has always relied on.
  const confirm = (
    <ConfirmDialog
      open={asking}
      title={t('common.work.delete.confirm.title', { title: item.title })}
      body={
        <p className="microcopy">
          {count > 0
            ? t('common.work.delete.confirm.body', { count, n: count })
            : t('common.work.delete.confirm.body.empty')}
        </p>
      }
      confirmLabel={t('common.work.delete.confirm.action.label')}
      onConfirm={() => {
        setAsking(false)
        ops.remove()
      }}
      onCancel={() => setAsking(false)}
    />
  )
  if (!selection) {
    return (
      <>
        {tile}
        {menu}
        {confirm}
        {practiceDialog}
      </>
    )
  }
  return (
    <div className={`work-tile${selection.active ? ' is-selecting' : ''}`}>
      {tile}
      <PickMark
        picked={picked}
        label={isBook ? 'this book' : isShow ? 'this show' : 'this film'}
        onChange={() => selection.toggle(item.id, selectKind)}
      />
      {menu}
      {confirm}
      {practiceDialog}
    </div>
  )
}

// ---- the wishlist, folded into one tile (1.12.0) --------------------------
//
// A library that keeps quotes accumulates books it has nothing from yet: a
// shelf photographed at a friend's house, an import that brought the titles and
// not the highlights, everything bought and not started. They are the wishlist —
// derived, with no column and no bookkeeping (a work with zero quotes IS the
// wishlist, and it clears itself the moment you add one). The board already had
// a chip triplet to browse them.
//
// What it did not have was a way to get them OUT OF THE WAY. Forty unopened
// covers scattered through a grid of books you have actually read is forty tiles
// of noise between the ones you are looking for, and the chip only helps if what
// you want is the wishlist rather than everything else.
//
// So: one tile, opening the chip that already exists. The folder is a DOOR to a
// filter rather than a new place things live — nothing moves, nothing is stored,
// and there is no state that can disagree with the count on a cover.
//
// COLLAGE_SPANS decides the layout for one to four covers, because a 2×2 grid
// holding one cover and three blanks reads as a broken image rather than as a
// wishlist with one thing on it. Four or more is the plain quartet; fewer, and
// the covers there are fill the box between them.
const COLLAGE_SPANS = {
  1: ['span 2 / span 2'],
  2: ['span 2 / span 1', 'span 2 / span 1'],
  3: ['span 2 / span 1', 'span 1 / span 1', 'span 1 / span 1'],
}

// WishlistFolder — the tile. Drawn as a WorkCard is drawn, deliberately: it sits
// in the same grid at the same width, and a folder that wore a different material
// would read as a control that had wandered into the board rather than as one of
// its tiles.
//
// It is NOT selectable. A selection acts on rows, and this is not a row — a tick
// in its corner would have to mean "select the twelve behind it", which is a
// different act from every other tick on the board and one the bar has no way to
// report a count for.
export function WishlistFolder({ kind = 'book', items = [], onOpen }) {
  const isBook = kind === 'book'
  const n = items.length
  // The first four, in the board's own order, so what the folder shows is what
  // opening it shows first.
  const covers = items.slice(0, 4).map((it) => (isBook ? it.cover_path : it.poster_path))
  const spans = COLLAGE_SPANS[covers.length] || []
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cover-tile block w-full text-left"
      title={t('common.wishlist-folder.tip', { n })}
    >
      <HandCard variant={0} className="relative overflow-hidden cover-lift">
        <span className="wish-collage" aria-hidden="true">
          {covers.map((path, i) => (
            <span key={i} className="wish-cell" style={{ gridArea: spans[i] }}>
              {path ? <img src={coverImgURL(path)} alt="" /> : null}
            </span>
          ))}
        </span>
        {/* The word, over the collage. Without it a quartet of covers is just four
            covers at quarter size, and the one thing this tile has to say is what
            it is. */}
        <span className="wish-folder-tag tp-scrim-deep">{t('common.shelf.wishlist.book.label')}</span>
      </HandCard>
      <p className="mt-2.5 truncate" style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 'var(--type-display-15)', color: 'var(--ink)' }}>
        {t('common.shelf.wishlist.book.label')}
      </p>
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 truncate text-[13px]" style={{ color: 'var(--soft)' }}>
          {t('common.wishlist-folder.subtitle.label')}
        </p>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        {isBook ? (
          <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t('common.count.phrase', { n, noun: t('unit.book', { count: n }) })}</MonoLabel>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-12)', color: 'var(--amber)' }}>
            {t('common.count.phrase', { n, noun: t('unit.title', { count: n }) })}
          </span>
        )}
      </div>
    </button>
  )
}

// GroupHeading — the label above one bucket of a "group by" view. Shared by the
// Library (books by series / author / decade / genre) and the Catalogue (films
// and shows by collection), so the two boards read identically; `noun` is what
// the count is counting, and `person` turns an author/director heading into a
// portrait chip that opens their panel.
export function GroupHeading({ label, count, noun, nounPlural, person, onOpenPerson }) {
  const one = noun || t('unit.item.one')
  // The plural of a caller-supplied noun, with the English s as the fallback the
  // call sites have always relied on. Passing `nounPlural` is how a language that
  // does not form plurals that way gets the right word.
  const many = nounPlural || (noun ? `${noun}s` : t('unit.item.other'))
  return (
    <div className="mb-4 flex items-center gap-3">
      {person && <PersonPortrait person={person} size={34} />}
      {onOpenPerson ? (
        <Tooltip label={t('common.person.open.tip')} className="min-w-0">
          <button
            type="button"
            className="display-title truncate"
            style={{ fontSize: 'var(--type-ui-19)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            onClick={onOpenPerson}
          >
            {label}
          </button>
        </Tooltip>
      ) : (
        <h3 className="display-title truncate" style={{ fontSize: 'var(--type-ui-19)' }}>
          {label}
        </h3>
      )}
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>
        {t('common.count.phrase', { n: count, noun: count === 1 ? one : many })}
      </MonoLabel>
      <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
    </div>
  )
}

// MobileDetailBar — the sticky top bar on a book/film detail on mobile: a round
// back button, the title + a meta subtitle, and a caller-supplied actions
// cluster (filter / add / overflow — these differ per detail). Shared so the
// bar structure lives in one place.
// MobileDetailBar — the phone's in-page top bar for a detail screen (the shell
// bar steps aside for it).
//
// No help button here on purpose: this bar already carries a back arrow, a
// filter, a ＋ and a ⋯ , and a fifth 44px control would leave a book title about
// eighty pixels of a 360px screen. The detail screens put help in the ⋯ menu
// instead (see ScreenHelpSheet), which costs the bar nothing.
export function MobileDetailBar({ onClose, title, meta, actions }) {
  return (
    <div className="mobile-sticky-bar">
      <div className="mobile-detail-bar">
        <Tooltip label={t('common.detail.back.tip')} side="bottom" className="shrink-0">
          <button
            type="button"
            className="tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full"
            style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }}
            onClick={onClose}
            aria-label={t('common.action.back.label')}
          >
            <IconBack />
          </button>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <div className="mobile-detail-title">{title}</div>
          {meta && <div className="mobile-detail-meta">{meta}</div>}
        </div>
        <div className="mobile-detail-actions">{actions}</div>
      </div>
    </div>
  )
}

// countQuotes — the four numbers HeroCounts prints, off one list of quotes.
//
// ONE FUNCTION FOR BOTH SIDES, because a highlight and a film line answer these
// questions identically and two copies would drift on the day a fifth number is
// added. `tags` is an array on both (absent on neither, but defended anyway: a
// row that arrives mid-save without it should not crash a hero).
//
// It must be handed the UNFILTERED list. Both callers only recompute on an
// unfiltered load, for the same reason the wishlist count already worked that way
// — a colour filter that made a book look emptier than it is would be a lie told
// by the one line on the page whose whole job is the tally.
export function countQuotes(list = []) {
  let favourites = 0
  let noted = 0
  let tagged = 0
  for (const q of list) {
    if (q.favorite) favourites++
    if ((q.note || '').trim()) noted++
    if ((q.tags || []).length > 0) tagged++
  }
  return { total: list.length, favourites, noted, tagged }
}

// minusQuote takes one row back out of a count, subtracting exactly what that row
// contributed rather than only the total.
//
// It exists for the optimistic path a single delete already takes: the board
// decrements its own total on the spot so the number does not lag the card
// disappearing, and a hero left one ahead of the toolbar is precisely the stale
// number this line was added to replace.
//
// WHAT NEITHER OF THESE COVERS, stated rather than discovered: a mutation made
// while a FILTER is on. The list in hand is not the whole set then, so the counts
// cannot be recomputed from it, and they hold their last unfiltered values until
// the filter clears. That is exactly how the toolbar's own unfiltered total has
// always behaved — and because both numbers come from the same state, they are
// stale together and can never disagree with each other, which is the property
// worth having. Two counts on one screen quietly contradicting each other is a
// worse bug than one count briefly behind.
export function minusQuote(stats, q) {
  if (!stats) return stats
  const less = (n, yes) => Math.max(0, n - (yes ? 1 : 0))
  return {
    total: Math.max(0, stats.total - 1),
    favourites: less(stats.favourites, q?.favorite),
    noted: less(stats.noted, (q?.note || '').trim()),
    tagged: less(stats.tagged, (q?.tags || []).length > 0),
  }
}

// HeroCounts — what this work is holding, at the top of its own page.
//
// WHY IT IS HERE AND NOT ONLY DOWN THERE. The board below has always printed a
// count in its toolbar, and that toolbar is the wrong place to learn it from: on
// a phone it is inside the filter sheet, and on a desktop it is past the
// description, so "how much have I got out of this book" was a scroll away on the
// page whose entire subject is the answer. The hero is where the identity of the
// work is stated, and how much of it you have kept is part of that identity.
//
// FOUR NUMBERS, AND THREE OF THEM ARE ALLOWED TO BE ABSENT. The total always
// shows — a zero total is the wishlist state and saying "no quotes yet" out loud
// is better than an empty space where a count goes. The other three are omitted
// at zero rather than printed as "0 favourites", because a row of zeroes reads as
// a report of failure and there is nothing to act on in it.
//
// It is deliberately NOT the same numbers as the board toolbar. That one says how
// many are on screen under the current filter, which is a fact about the filter;
// this one is a fact about the work, and it is computed off the unfiltered set
// (see the load() in Annotations / Dialogues) so a colour filter cannot make a
// book look emptier than it is.
// `tone` is 'accent' or 'amber'. A prop rather than a page class it could inherit,
// because there is no page class to inherit: the Catalogue's credit line sets amber
// inline, and a terracotta total under an amber credit reads as two unrelated
// systems on one card.
export function HeroCounts({ counts, noun, tone = 'accent' }) {
  if (!counts) return null // still loading: no count is better than a wrong one
  const pair = noun || [t('unit.quote.one'), t('unit.quote.other')]
  const { total = 0, favourites = 0, noted = 0, tagged = 0 } = counts
  const parts = [
    total === 0
      ? t('common.hero.counts.empty.label', { noun: pair[1] })
      : t('common.count.phrase', { n: total, noun: total === 1 ? pair[0] : pair[1] }),
    favourites > 0 && t('common.hero.counts.favourites', { count: favourites, n: favourites }),
    noted > 0 && t('common.hero.counts.noted.label', { n: noted }),
    tagged > 0 && t('common.hero.counts.tagged.label', { n: tagged }),
  ].filter(Boolean)
  return (
    <div className={`hero-counts${tone === 'amber' ? ' hero-counts-amber' : ''}`}>
      {parts.map((p, i) => (
        <span key={i}>
          {/* The separator is a sibling rather than a border, because the row
              wraps on a phone and a border-left would leave a hairline hanging at
              the start of the second line. */}
          {i > 0 && <span aria-hidden="true" className="hero-counts-sep">·</span>}
          <span className={i === 0 ? 'hero-counts-total' : undefined}>{p}</span>
        </span>
      ))}
    </div>
  )
}

// WorkHero — the desktop detail hero shared by books and films: cover/poster
// column (drop-shadowed), an info column (title · meta slot · counts · favourite
// hearts · genre chips · description), and an actions column. Returns the three
// columns as a fragment so the caller owns the flex container (a plain div for
// books, a Reveal for films). Divergent bits are slots: `cover` (Cover vs
// Poster), `meta` (the mono/amber credit line), `counts` (what the work is
// holding — see HeroCounts), `actions` (Export/Edit/Delete), `tags` (the
// shelf-state chips, which sit on the hearts row so a work's two pieces of
// personal state — favourite, and what shelf it is on — read together).
export function WorkHero({
  cover,
  shadow = 'drop-shadow(0 12px 22px rgba(0,0,0,.4))',
  title,
  titleSize = 28,
  titleStyle,
  meta,
  counts,
  favorite,
  onFavorite,
  tags,
  genres = [],
  description,
  actions,
}) {
  const mobile = useIsMobileScreen()
  // ON A PHONE THE FLOAT IS THE BUG. The desktop layout floats a 144–176px cover
  // into a wide column and lets everything wrap around it, which is right when
  // there are 500px to wrap in. On a 320px screen it leaves a ~150px gutter, and
  // into that gutter go the title, the author chips, the year, the series, the
  // shelf state, the read counter, the progress track and the hearts — each
  // wrapping independently, so the identity of the work and the state of it come
  // out interleaved. Nothing is misplaced; there is simply nowhere to put it.
  //
  // So the phone gets a stated ORDER instead of a flow, and the same order for a
  // book, a film and a show:
  //
  //   1. what it is      cover beside title, author and year — one band
  //   2. where you are   the shelf row: state, read count, then its own track
  //   3. what it is to you  the heart and the tags
  //   4. what it is about   genres, then the description
  //
  // The cover shrinks to 96px because in this arrangement it is an identifier
  // rather than the subject — the full-size art is one tap away through it.
  if (mobile) {
    return (
      <div className="work-hero-m">
        <div className="work-hero-m-top">
          <div className="work-hero-m-cover">{cover}</div>
          <div className="min-w-0 flex-1">
            <h1 className="display-title" style={{ fontSize: 'var(--type-ui-22)', lineHeight: 1.2, ...titleStyle }}>
              {title}
            </h1>
            {meta && <div className="mt-1.5">{meta}</div>}
            {/* Inside the top band, under the credit — this is the one place on a
                phone where it is legible without opening the filter sheet, and it
                belongs to the work rather than to the shelf row below. */}
            {counts && <div className="mt-1.5">{counts}</div>}
          </div>
        </div>
        {(tags || onFavorite) && (
          <div className="work-hero-m-shelf">
            <Hearts value={!!favorite} onChange={onFavorite} />
            {tags}
          </div>
        )}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <span key={g} className="tp-chip">
                {g}
              </span>
            ))}
          </div>
        )}
        <ExpandableDescription text={description} />
        {/* The desktop action row is deliberately absent: on a phone these live
            in the sticky bar's ⋯ overflow, and both pages already pass null. */}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    )
  }
  // Float layout (not flex): the cover floats left and the actions float right,
  // so the title / meta / favourite / genres / description flow in normal order
  // — beside the cover while short, and wrapping full-width UNDER it once the
  // description is expanded. Native rectangular text-wrap: it reflows on resize
  // and keeps the text selectable, no measuring needed. `display:flow-root`
  // clears the floats without clipping the cover's drop-shadow (overflow:hidden
  // would). A collapsed (clamped) description is its own block beside the cover;
  // expanding it drops the clamp so its lines wrap around the cover.
  return (
    <div style={{ display: 'flow-root' }}>
      {actions && (
        <div className="flex flex-wrap justify-end gap-2" style={{ float: 'right', marginLeft: 20, marginBottom: 10 }}>
          {actions}
        </div>
      )}
      <div className="w-36 sm:w-44" style={{ float: 'left', marginRight: 24, marginBottom: 14, filter: shadow }}>
        {cover}
      </div>
      <h1 className="display-title" style={{ fontSize: titleSize, ...titleStyle }}>
        {title}
      </h1>
      {meta && <div className="mt-2.5">{meta}</div>}
      {counts && <div className="mt-2">{counts}</div>}
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <Hearts value={!!favorite} onChange={onFavorite} />
        {tags}
      </div>
      {genres.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <span key={g} className="tp-chip">
              {g}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2.5">
        <ExpandableDescription text={description} />
      </div>
    </div>
  )
}

// WorkListScaffold — the shared catalogue list-page shell (Library + Movies):
// header (title · counts · export / lookup aside), the desktop filter row
// and mobile filter sheet (genre · [leading] · wishlist · favourites ·
// reading/watching · tagged · has notes · series · [trailing] · sort), the empty
// states, the grid (children), and the trailing surfaces
// (export dialog, extra modals). The page owns its data + the
// page-specific filter — a film's media-type via the `leading` slots, a book's
// group-by via the `trailing` slots — and the derived `shown` list; the
// scaffold owns the mobile-sheet open state and renders the shared favourites /
// series / sort controls so those live in one place.
//
// Neither an Add control nor a "?" lives here any more (1.4.1). Both were shell
// controls drawn a second time per page: the header's ＋ sat immediately beside
// the top bar's own ＋ , and the top bar's Add now knows which page it is on, so
// it adds a book on Library and a film on the Catalogue by itself. Help moved
// into that same bar. What the header keeps is what is genuinely local to the
// list — its filters and its export.
export function WorkListScaffold({
  mobile,
  title,
  counts,
  error,
  // onBack (1.14.2) makes this scaffold a DETAIL page rather than a list one.
  //
  // A board is opened from a list of boards, so it needs a way back, and until
  // now the scaffold had no slot for one — /quotes drew its own button in a
  // <div> above, which on a phone is an entire row spent on a single back
  // arrow while the title, the count and the filters sit in the row beneath it.
  // A book's detail page has never done that: it puts all four in one bar.
  //
  // So the back arrow comes INSIDE the sticky bar, drawn by the same
  // MobileDetailBar a work's page uses, rather than being another control
  // stacked above it. Absent on the three list screens, which are nobody's
  // detail page and have nowhere to go back to.
  onBack,
  onExport,
  headerAside,
  loaded, // items != null (data has arrived)
  hasItems, // items && items.length > 0
  shownCount,
  emptyText,
  noMatchText,
  genres = [],
  genre,
  setGenre,
  fav,
  setFav,
  tagged,
  setTagged,
  noted,
  setNoted,
  wish, // '' = all | 'wishlist' | 'annotated'
  setWish,
  states = [], // shelf states to keep; [] = every state
  setStates,
  kind = 'book', // 'book' | 'movie' — which side's words the state control uses
  // The in-progress word(s) this board can hold. A single-medium board has one;
  // the catalogue has two once it contains a game, because a game is played and
  // a film is watched and both are movies-table rows.
  activeStates = [ACTIVE_STATUS[kind]],
  noun = t('unit.book.one'), // what a row is, for the "show only" chip tooltips
  // Its plural, compared against the default the way seriesNounPlural below is:
  // a caller that renames the noun keeps the English s until it passes one.
  nounPlural = noun === t('unit.book.one') ? t('unit.book.other') : `${noun}s`,
  // Books group into a "series"; films and shows into a "collection" — the same
  // movies.series column, but "series" already means a TV show on that page.
  seriesNoun = t('common.filters.series.noun.one'),
  // Carried separately because "series" is its own plural: appending an s gave
  // the books filter "all seriess". Defaults to the regular English form, so
  // "collection" still needs no call-site change.
  seriesNounPlural = seriesNoun === t('common.filters.series.noun.one') ? t('common.filters.series.noun.other') : `${seriesNoun}s`,
  seriesNames = [],
  series,
  setSeries,
  // WHO IS QUOTED IN IT (1.14.2). Generic rather than `actorNames`, because the
  // control is one dropdown over one column of names and the Library will want
  // the same one for authors; `creditNoun` is the only thing that differs.
  // Hidden when nothing supplies it, like the series select above — a board with
  // no credits to filter by shows no credit filter rather than an empty one.
  creditNames = [],
  credit,
  setCredit,
  creditNoun = t('common.filters.credit.noun.one'),
  creditNounPlural = creditNoun === t('common.filters.credit.noun.one') ? t('common.filters.credit.noun.other') : `${creditNoun}s`,
  sort,
  setSort,
  sortOptions = [],
  leading, // desktop extra control before favourites (film media-type)
  trailing, // desktop extra control before sort (book group-by)
  leadingMobile, // mobile-sheet section for `leading`
  trailingMobile, // mobile-sheet section for `trailing`
  onReset,
  children, // the grid (flat or grouped)
  exportDialog,
  extraModals,
}) {
  const [mobileFilter, setMobileFilter] = useState(false)
  // A section renders when its setter was supplied. One rule, applied the same
  // way everywhere, so adding a screen to this scaffold is a question of which
  // setters you pass rather than which booleans you remember to set.
  //
  // Quotes is why this exists: a standalone quote has no genre, no shelf state,
  // no series and no wishlist (there is nothing to acquire), but it has colours,
  // tags, notes, a speaker and a medium. Everything here is shared or absent —
  // a second scaffold would have drifted from this one inside a release.
  const hasGenre = !!setGenre
  const hasWish = !!setWish
  const hasStates = !!setStates
  const hasSeries = !!setSeries && (seriesNames || []).length > 0
  const hasCredit = !!setCredit && (creditNames || []).length > 0
  const hasSort = !!setSort && (sortOptions || []).length > 0
  // "show only" — independent toggles, ANDed by the page's `shown` memo. Shared
  // with the desktop row rather than mobile-only: the predicates live in that
  // memo, so a phone-set filter would otherwise survive a resize past the
  // breakpoint with no control left to see or clear it.
  const onlyChips = (
    <>
      {setFav && (
        <Tooltip label={t('common.filters.favourites.tip')}>
          <button onClick={() => setFav(!fav)} className={filterChipClass(fav)}>
            {t('common.filters.favourites.label')}
          </button>
        </Tooltip>
      )}
      {setTagged && (
        <Tooltip label={t('common.filters.tagged.tip', { noun: nounPlural })}>
          <button onClick={() => setTagged(!tagged)} className={filterChipClass(tagged)}>
            {t('common.filters.tagged.label')}
          </button>
        </Tooltip>
      )}
      {setNoted && (
        <Tooltip label={t('common.filters.noted.tip', { noun: nounPlural })}>
          <button onClick={() => setNoted(!noted)} className={filterChipClass(noted)}>
            {t('common.filters.noted.label')}
          </button>
        </Tooltip>
      )}
    </>
  )
  // The wishlist control is a 3-way scope, not a toggle: a work with nothing
  // annotated is "on the wishlist", and you either ignore that (all), browse only
  // those (wishlist), or hide them to see just what you have actually quoted
  // (annotated). Same chip-triplet shape as the Catalogue's movie/show control.
  const wishChips = [
    ['', t('common.filters.wish.all.label'), t('common.filters.wish.all.tip', { noun })],
    ['wishlist', t('common.filters.wish.only.label'), t('common.filters.wish.only.tip', { noun: nounPlural })],
    ['annotated', t('common.filters.wish.annotated.label'), t('common.filters.wish.annotated.tip', { noun: nounPlural })],
  ].map(([k, label, hint]) => (
    <Tooltip key={k || 'all'} label={hint}>
      <button className={filterChipClass(wish === k)} onClick={() => setWish(k)}>
        {label}
      </button>
    </Tooltip>
  ))
  // Shelf state is a multi-select rather than a chip per state: five states would
  // double the length of the filter row, and "paused or abandoned" — the unfinished
  // business you'd actually go looking for — is one dropdown away this way. Each
  // row carries its bar colour, so the control and the board teach each other.
  const stateSelect = (
    <MultiSelect
      ariaLabel={t('common.filters.shelf.aria')}
      allLabel={t('common.filters.shelf.all.label')}
      values={states}
      onChange={setStates}
      options={[
        // One row per in-progress word the board can actually hold. A catalogue
        // with games has two ('watching' and 'playing'), and they are separate
        // options rather than one merged row because they are separate stored
        // values — merging them would filter to neither.
        ...activeStates.map((s) => [s, shelfLabel(s, kind), SHELF_META[s].color]),
        // The three settled states read the same on both sides, so the book
        // spelling is the only one there is to draw.
        ['paused', t(SHELF_META.paused.book), SHELF_META.paused.color],
        ['abandoned', t(SHELF_META.abandoned.book), SHELF_META.abandoned.color],
        ['completed', t(SHELF_META.completed.book), SHELF_META.completed.color],
        ['none', t('common.filters.shelf.none.label'), 'transparent'],
      ]}
    />
  )
  const seriesSelect = hasSeries && (
    <Select
      ariaLabel={t('common.filters.by.aria', { field: seriesNoun })}
      value={series}
      onChange={setSeries}
      options={[['', t('common.filters.all.label', { field: seriesNounPlural })], ...seriesNames.map((s) => [s, s])]}
    />
  )
  const creditSelect = hasCredit && (
    <Select
      ariaLabel={t('common.filters.by.aria', { field: creditNoun })}
      value={credit}
      onChange={setCredit}
      options={[['', t('common.filters.all.label', { field: creditNounPlural })], ...creditNames.map((n) => [n, n])]}
    />
  )
  const sortSelect = hasSort && <Select ariaLabel={t('common.filters.sort.aria')} value={sort} onChange={setSort} options={sortOptions} />
  // The same two controls whichever bar draws them, so a board and a book put
  // Filters and Export in the same place under the same thumb.
  const mobileActions = (
    <>
      <IconButton icon={<IconFilter />} label={t('common.filters.label')}
        ariaLabel={t('common.filters.label')} onClick={() => setMobileFilter((o) => !o)} />
      {!DEMO && <MoreMenu items={[{ icon: <IconExport />, label: t('common.action.export.label'), onClick: onExport }]} />}
    </>
  )

  return (
    <section>
      {mobile && onBack ? (
        // Identical to a work's detail page, because it IS one: back, what you
        // are looking at, how much of it there is, and what you can do to it —
        // one row, not two.
        <MobileDetailBar onClose={onBack} title={title} meta={counts} actions={mobileActions} />
      ) : (
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title={title}
          counts={counts}
          right={
            <>
              {mobile && <div className="flex items-center gap-2">{mobileActions}</div>}
              {!mobile && headerAside}
              {/* Export is a glyph, not a word: the header row is the tightest
                  real estate on the page and "Export all" spent it on a label
                  the ⬇ already carries.

                  It says "Export", not "Export all", because it is not all: all
                  three screens post `shown` — the filtered view — and the confirm
                  dialog has always said "N in view". The label was the last
                  survivor of the whole-collection export it replaced, and it
                  contradicted the dialog directly above the button you press. */}
              {!mobile && !DEMO && (
                <IconButton icon={<IconExport />} label={t('common.action.export.label')}
            ariaLabel={t('common.action.export.label')} onClick={onExport} tooltip={t('common.action.export.shown.tip')} />
              )}
            </>
          }
        />
      </div>
      )}
      <ErrorText>{error}</ErrorText>

      {hasItems && !mobile && (
        <div className="filter-row mb-5">
          {hasGenre ? <GenreFilter genres={genres} value={genre} onChange={setGenre} /> : <span />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {leading}
            {hasWish && wishChips}
            {onlyChips}
            {hasStates && stateSelect}
            {creditSelect}
            {seriesSelect}
            {trailing}
            {hasSort && (
              <label className="flex items-center gap-2">
                <MonoLabel>{t('common.filters.sort.label')}</MonoLabel>
                {sortSelect}
              </label>
            )}
          </div>
        </div>
      )}

      {mobile && (
        <MobileSheet
          open={mobileFilter}
          onClose={() => setMobileFilter(false)}
          title={t('common.filters.label')}
          footer={
            <SheetFooter
              count={loaded ? t('common.filters.shown.label', { n: shownCount }) : ''}
              onReset={onReset}
              onDone={() => setMobileFilter(false)}
            />
          }
        >
          <div className="space-y-5">
            {hasGenre && (
              <div>
                <MonoLabel className="mb-2 block">{t('common.filters.genre.label')}</MonoLabel>
                {/* The same GenreFilter the desktop row uses — one select over every
                    genre. The sheet reached that shape first (1.4.0), because a
                    measured chip strip inside a full-width section always collapsed
                    to zero visible chips; the desktop row joined it in 1.4.2. */}
                <GenreFilter genres={genres} value={genre} onChange={setGenre} />
              </div>
            )}
            {leadingMobile}
            {hasWish && (
              <div>
                <MonoLabel className="mb-2 block">{t('common.filters.wish.label')}</MonoLabel>
                <div className="flex flex-wrap items-center gap-2">{wishChips}</div>
              </div>
            )}
            <div>
              <MonoLabel className="mb-2 block">{t('common.filters.only.label')}</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">{onlyChips}</div>
            </div>
            {hasStates && (
              <div>
                <MonoLabel className="mb-2 block">{t('common.filters.shelf.label')}</MonoLabel>
                {stateSelect}
              </div>
            )}
            {hasSeries && (
              <div>
                <MonoLabel className="mb-2 block">{seriesNoun}</MonoLabel>
                {seriesSelect}
              </div>
            )}
            {hasCredit && (
              <div>
                <MonoLabel className="mb-2 block">{creditNoun}</MonoLabel>
                {creditSelect}
              </div>
            )}
            {trailingMobile}
            {hasSort && (
              <div>
                <MonoLabel className="mb-2 block">{t('common.filters.sort.label')}</MonoLabel>
                {sortSelect}
              </div>
            )}
          </div>
        </MobileSheet>
      )}

      {loaded && !hasItems && <EmptyState>{emptyText}</EmptyState>}
      {hasItems && shownCount === 0 && <EmptyState>{noMatchText}</EmptyState>}
      {shownCount > 0 && children}

      {extraModals}
      {exportDialog}
    </section>
  )
}
