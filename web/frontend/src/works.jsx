// works.jsx — shared building blocks for "works" (books + films/shows), the two
// halves of the catalogue that render in parallel across the Library, Movies,
// Search and Metadata screens. Kept in their own module so both sides compose
// the same pieces instead of re-deriving them (and to avoid a ui ↔ people
// import cycle — this layer is free to import from both).
import { useEffect, useRef, useState } from 'react'
import { DEMO, coverImgURL, errText, json } from './api.js'
import { t, tNodes } from './i18n.js'
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
  IconRevert,
  IconSort,
  IconFilter,
  MobileSheet,
  MonoLabel,
  MoreMenu,
  MultiSelect,
  NameScroll,
  PageHeader,
  PartialDateField,
  PickMark,
  Placeholder,
  QuizSkipMark,
  SHELF_META,
  Select,
  Scroller,
  SheetFooter,
  StateTag,
  StatusBar,
  useCrumb,
  useIsMobileScreen,
  useScrolledPast,
  useScreenBar,
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
import { deletePhrase, useBulkOps } from './bulkOps.jsx'
import { selectionClick, selectionMenuItems } from './selection.jsx'

// ---- how much of a board is mounted at once --------------------------------
//
// A shelf is a list the user owns all of, and every control on the page — the
// chips, the sort, the group-by, the counts in the heading, select-all — reads
// the WHOLE of it. So the list stays whole in memory and is filtered whole; what
// is bounded here is only how much of it becomes DOM.
//
// Measured on a four-hundred-book library, which is not a large one: the board
// mounted 401 tiles, 7,492 elements, and spent 707ms of a single blocking task
// building them — on a page where eighteen tiles are visible. Every one of those
// tiles carries a context menu, a selection tick and a shelf control, so the cost
// is per tile and it is not small.
//
// A "load more" button was the alternative and is the wrong shape for a shelf:
// browsing a library is scrolling, and a button turns the one gesture the board
// is for into a decision. This grows on approach instead — 600px before the end,
// which at a normal scroll speed lands the next row before it is asked for.
export const BOARD_PAGE = 60

// A QUOTE CARD IS NOT A COVER TILE, and the page size has to know it. BOARD_PAGE is
// sized for a tile — an image and a caption. An annotation card carries the text, its
// meta line, its tag chips, its colour row and its action menu: around seventy DOM
// nodes each, against a tile's handful. Revealing sixty of those at once mounts four
// thousand nodes in a single frame, which measured a 434ms block mid-scroll — not a
// freeze, but past the point where the scroll stops feeling attached to the finger.
// Two dozen is the same amount of reading revealed a little more often, and the reveal
// happens 600px before the reader gets there either way.
export const ANNOTATION_PAGE = 24

// useBoardWindow returns how many of `total` to render, and the ref to hang on a
// sentinel element AFTER the last one. `resetKey` is whatever changes the list —
// re-filtering back to the top with a thousand tiles still mounted would defeat
// the whole thing.
//
// WITHOUT IntersectionObserver the window opens to the full list rather than
// stopping at the first page. A board that cannot observe its own end cannot grow
// one, and a permanently truncated library is a worse failure than a slow one.
export function useBoardWindow(total, resetKey, page = BOARD_PAGE) {
  const [count, setCount] = useState(page)
  const sentinel = useRef(null)
  useEffect(() => {
    setCount(page)
  }, [resetKey, page])
  const more = count < total
  useEffect(() => {
    if (!more) return undefined
    if (typeof IntersectionObserver !== 'function') {
      setCount(total)
      return undefined
    }
    const el = sentinel.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((n) => Math.min(total, n + page))
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [more, total, page])
  return { count: Math.min(count, total), more, sentinel }
}

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
                  <NameScroll className="block" style={{ color: 'var(--ink)' }}>
                    {it.title}
                  </NameScroll>
                  {it.meta && (
                    <NameScroll className="block" style={{ fontSize: 'var(--type-ui-13)', color: 'var(--faint)' }}>
                      {it.meta}
                    </NameScroll>
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
//
// `kind` is carried for the bar's accessible name alone, and it has to be: with
// it dropped, StatusBar falls back to the books side and a film's track reads
// out as "Reading — 40%". Its caller holds the kind already.
export function ShelfProgress({ kind, status, progress = 0, pos }) {
  const label = positionLabel(pos)
  return (
    <span style={{ display: 'block', minWidth: 168, maxWidth: 260 }}>
      <StatusBar state={status} kind={kind} progress={progress} radius={3} />
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
          <StatusBar state={status} kind={kind} progress={preview} radius={3} />
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
        {(close) => transitionItems(kind, item, status, moves, busy, close, onSelect)}
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
            {transitionItems(kind, item, status, moves, busy, close, onSelect)}
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
            {transitionItems(kind, item, status, moves, busy, close, onSelect)}
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
          first, then the track — and `.work-hero-state .shelf-track` takes the
          whole line UNCONDITIONALLY, because the header is narrow in a 300px
          column as well as on a phone, so the order is the same every time. */}
      {(status === active || status === 'paused') && (
        <span className="shelf-track">
          <ShelfProgress kind={kind} status={status} progress={progress} pos={pos} />
        </span>
      )}
    </>
  )
}

// transitionItems renders one menu row per legal move, each swatched in the
// colour its state will paint the bar. Shared by the state chip and the
// stand-in "Shelve" chip so there is one transitions menu, not two.
//
// It carries `item` for one reason: moveLabel needs the media_type to word the
// finished move, and this function is where the row used to be dropped. Its
// caller already resolves the active word per row, so it holds the row all along
// — passing only `kind` from here meant a correct moveLabel still drew "Mark as
// watched" on a game, with the pure test green.
function transitionItems(kind, item, from, moves, busy, close, onSelect) {
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
      {moveLabel(kind, from, next, item)}
    </button>
  ))
}

// moveLabel names the button for one shelf transition, in the words a person
// would use: starting again after finishing is a reread, not a fresh start.
//
// It switches on the DESTINATION word for the states the sides share, which is
// what lets games join without a third branch everywhere: 'playing' is its own
// case, so a completed game reads "Play it again" rather than "Watch it again".
//
// THE FINISHED WORD TAKES THE ROW, because the destination cannot supply it.
// 'completed' is one word for every medium and its past tense is not — read,
// watched, played — so something has to say which. This used to infer it from
// `from === 'playing'`, on the stated grounds that only a game is ever moved to
// completed from 'playing'. That is true and it is the wrong direction: the branch
// needs the INVERSE, that only from 'playing' does a game reach completed, and
// the inverse is false. A game reaches 'completed' from four other states — the
// untracked "Shelve" chip, paused, abandoned, and a stale 'watching' left behind
// by a media-type edit — and every one of them fell through to "Mark as watched".
// The mirror was wrong too: a film carrying a stale 'playing' was offered "Mark as
// played".
//
// So the row comes in and capKeyFor answers from media_type — the same call
// ShelfControl already makes for the active word, so a chip and the menu under it
// cannot disagree about the same tile. A status is a thing a work is doing and can
// be stale; media_type is what the work IS. The new shape cannot make the old
// mistake because no path is left from a status word to a medium: every
// kind-bearing key is chosen from `key`. A caller that forgets the row gets its
// board's own medium rather than whatever the row happens to be doing, which is a
// wrong word on a game and never a wrong word on a film — and the render test in
// test/dom/shelf-menu.test.jsx is what stops the row being dropped on the way
// down, since transitionItems is where it went missing before.
export function moveLabel(kind, from, to, item = {}) {
  const key = capKeyFor(kind, item)
  const book = key === 'book'
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
      // The finished word follows what you DID with it, so a game reads "Mark as
      // played" where a film reads "Mark as watched" — asked of the row, not of
      // the state it is leaving. A show settles as watched, like a film.
      if (key === 'game') return t('common.shelf.move.completed.played.label')
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
// patchMovesTheRow — would this one-field change take the row off the board?
//
// EXPORTED AND PURE so the decision can be argued with. It is the whole safety of
// splicing a PUT's reply in rather than refetching: the filters are applied by the
// SERVER, so un-hearting a row while the favourites filter is on must remove it,
// and a splice would leave it sitting there looking saved and wrong.
//
// It asks about the FILTERS IN FORCE, not about the fields: changing a colour
// while no colour filter is on moves nothing, and refetching for it would be the
// round trip this exists to avoid. A filter this does not know about is a filter
// that has to be added here — which is why it takes the filter values rather than
// reading them, so a caller cannot forget to pass one without the argument list
// changing shape.
export function patchMovesTheRow(fields, { fav, color, tag } = {}) {
  return Boolean(
    (fav && 'favorite' in fields) ||
      (color && 'color' in fields) ||
      (tag && 'tags' in fields),
  )
}

// WorkDeleteConfirm — the one dialog every single-work delete asks through: the
// board tile's context menu, a book's detail screen, a film's.
//
// A TYPED PHRASE, THE SAME ONE THE BULK BAR ASKS FOR. This reverses the earlier
// decision recorded here — "one tap, not a typed phrase, and the difference from
// the bulk bar is the point" — because the reader who owns the app asked for the
// phrase and the argument against it did not survive being written down. The
// bar's case was that twelve is a number you can misread; the case it did NOT
// make is that one is a number you can misread too, when the one is a book with
// two hundred highlights in it and the tap that destroys it is the same tap that
// opens it.
//
// THE PHRASE IS ENGLISH IN EVERY LANGUAGE, and that was the real objection: this
// app ships Bengali and deletePhrase composes "delete 1 book" from English
// literals. It stands as a deliberate, pragmatic choice — an English keyboard is
// what nearly everyone has, and a phrase nobody can type is a door nobody can
// open. It is also NOT the work's title, which would have been the prettier
// prompt and the unusable one: a Bengali title cannot be typed on the keyboard
// this rule is here to accommodate.
//
// THE CHECK IS THE CLIENT'S, and only here. The bulk route takes `confirm` in
// its body and the server compares it byte for byte; DELETE /books/:id takes no
// body and is not being given one for a dialog. So this is a guard against the
// misclick, which is the whole thing it was asked to be — not an authorisation,
// and it does not pretend to be one.
export function WorkDeleteConfirm({ open, kind, title, count = 0, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const phrase = deletePhrase(kind, 1)
  // Cleared on every open, not on close: a dialog dismissed with Escape and
  // reopened would otherwise arrive already satisfied, which is a typed guard
  // that only has to be typed once.
  useEffect(() => {
    if (open) setTyped('')
  }, [open])
  return (
    <ConfirmDialog
      open={open}
      title={t('common.work.delete.confirm.title', { title: title || '' })}
      body={
        <div className="space-y-2">
          {/* Counted, because the count is the fact that decides it: a book with
              200 highlights and a book with none are the same two clicks and
              very different acts. */}
          <p className="microcopy">
            {count > 0
              ? t('common.work.delete.confirm.body', { count, n: count })
              : t('common.work.delete.confirm.body.empty')}
          </p>
          <p className="microcopy">
            {tNodes('common.work.delete.confirm.phrase', { phrase: <b key="phrase">{phrase}</b> })}
          </p>
          <input
            className="tp-input"
            autoFocus
            value={typed}
            placeholder={phrase}
            aria-label={t('common.selection.delete.confirm.phrase.aria')}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      }
      confirmLabel={t('common.work.delete.confirm.action.label')}
      confirmDisabled={typed.trim().toLowerCase() !== phrase}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

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
      // A board is a few hundred covers at eighty kilobytes each and a viewport
      // that holds eighteen of them. Eager, a library of four hundred books asked
      // for THIRTY-ONE MEGABYTES on every visit to the shelf, measured — most of
      // it for tiles nobody had scrolled to yet, all of it competing with the
      // covers that were actually on screen. The 2:3 box below is declared in CSS
      // rather than measured from the file, so the space is reserved before the
      // image exists and nothing reflows as they arrive — which is the condition
      // that makes lazy loading safe here rather than a scroll-jumping board.
      loading="lazy"
      decoding="async"
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
        {state && <StatusBar state={state} kind={kind} progress={item.progress} />}
        {isShow && (
          <span
            className="tp-chip tp-scrim-deep absolute left-1.5 top-1.5"
            style={{ fontSize: 'var(--type-ui-9)', color: 'var(--on-scrim)', borderColor: 'transparent' }}
          >
            SHOW
          </span>
        )}
        {/* A show's poster already spends its top-left on the SHOW chip, so the
            reading mark stacks under it rather than overprinting.

            The MEDIUM goes into the badge, not the board's kind: a game is a
            movies row, so `kind` alone made the badge on a game you are playing
            say "Currently watching". capKeyFor is the same call the tile's own
            state and the transitions menu under it already make. */}
        {isActive(kind, item) && <ReadingBadge kind={capKeyFor(kind, item)} stacked={isShow} />}
        {item.favorite && <FavBadge />}
      </HandCard>
      <NameScroll as="p" className="mt-2.5" style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 'var(--type-display-15)', color: 'var(--ink)' }}>
        {item.title}
      </NameScroll>
      <div className="flex items-center gap-1.5">
        {/* Credit face(s): authors / directors, co-credits overlapping (first on top). */}
        <CreditFaces names={splitCredits(credit, seps)} map={people} size={24} ring="var(--bg)" />
        <NameScroll as="p" className="min-w-0 text-[13px]" style={{ color: 'var(--soft)' }}>
          {[credit, year || null].filter(Boolean).join(' · ') || ' '}
        </NameScroll>
      </div>
      {item.series && (
        <NameScroll as="p" className="text-[12px]" style={{ color: 'var(--faint)', fontStyle: 'italic' }}>
          {seriesLabel(item)}
        </NameScroll>
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
  const confirm = (
    <WorkDeleteConfirm
      open={asking}
      kind={kind}
      title={item.title}
      count={count}
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
            className="display-title"
            style={{ fontSize: 'var(--type-ui-19)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            onClick={onOpenPerson}
          >
            <NameScroll>{label}</NameScroll>
          </button>
        </Tooltip>
      ) : (
        <h3 className="display-title" style={{ fontSize: 'var(--type-ui-19)' }}>
          <NameScroll>{label}</NameScroll>
        </h3>
      )}
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>
        {t('common.count.phrase', { n: count, noun: count === 1 ? one : many })}
      </MonoLabel>
      <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
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
  // The three qualifiers. They are NOT the same fact as the total — they are
  // slices of it — so they no longer sit on the same line at the same weight,
  // which is what made this a wrapping strip where every number looked equally
  // important and the one you came for was third from the left.
  const rest = [
    favourites > 0 && t('common.hero.counts.favourites', { count: favourites, n: favourites }),
    noted > 0 && t('common.hero.counts.noted.label', { n: noted }),
    tagged > 0 && t('common.hero.counts.tagged.label', { n: tagged }),
  ].filter(Boolean)
  return (
    <div className={`hero-counts${tone === 'amber' ? ' hero-counts-amber' : ''}`}>
      {/* ONE BIG NUMBER AND ITS WORD. The pack sets the total in the display face
          at 21px beside a 13px noun, and it is the right call for a reason the
          mono strip could not reach: this page exists to show what you have kept
          out of this book, so the amount you kept is the headline and not an
          entry in a tally. 22 rather than 21 — the scale has no 21, and every
          size on screen answers the type dials. */}
      <div className="hero-counts-lead">
        {total === 0 ? (
          <span className="hero-counts-empty">{t('common.hero.counts.empty.label', { noun: pair[1] })}</span>
        ) : (
          <>
            <span className="hero-counts-total">{total}</span>
            <span className="hero-counts-word">{total === 1 ? pair[0] : pair[1]}</span>
          </>
        )}
      </div>
      {rest.length > 0 && (
        <div className="hero-counts-rest">
          {rest.map((p, i) => (
            <span key={i}>
              {/* The separator is a sibling rather than a border, because the row
                  wraps on a phone and a border-left would leave a hairline hanging
                  at the start of the second line. */}
              {i > 0 && <span aria-hidden="true" className="hero-counts-sep">·</span>}
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// HeroFact — one fact about a work, in the material every such fact shares: the
// year, the language, a genre, a series. Small, mono, wide-tracked, in --soft.
//
// UNDERLINED ONLY WHEN IT GOES SOMEWHERE. An underline is a promise, and the
// screens behind these are being built one at a time — a genre has a board to
// reach and a year does not, yet. Drawing all of them as links would teach a
// reader that half the line is dead, which is worse than a line that never
// claimed otherwise.
export function HeroFact({ label, onClick, title }) {
  if (!label) return null
  return onClick ? (
    <button type="button" className="work-hero-metalink" onClick={onClick} title={title}>
      {label}
    </button>
  ) : (
    <span className="work-hero-metalink work-hero-metalink-flat" title={title}>
      {label}
    </span>
  )
}

// HeroKindRow — the line above a work's title: WHAT this is, and the two or three
// facts that place it. "Book · 1967 · Russian". "Film · 1979". "Game · 2011".
//
// ONE COMPONENT FOR EVERY KIND OF WORK, and that is the point of it rather than a
// convenience. A book's page and a film's page were assembling this line
// separately and had already drifted — the year sat in the credit line on one
// side and nowhere on the other — which is exactly the class of divergence the
// owner ruled out: a work's detail must come from one source, hardwired so the
// two cannot fall out of step. Adding a kind is a row in the caller's `links` and
// a word in its own map, never a second copy of this.
//
// THE FACTS WERE IN THE CREDIT LINE BEFORE THIS, mixed in with the people:
// "Herman Melville · translator Anna · 1851 · Whales #2" — one sentence in which
// a person, a role word, a year and a series were the same size and a middle dot
// did all the distinguishing. A person is an object now (see PersonChip) and the
// facts are a line of their own, above the title where they say what you are
// looking at before you read its name.
export function HeroKindRow({ word, glyph, links = [] }) {
  const parts = links.filter((l) => l && l.label)
  if (!word && parts.length === 0) return null
  return (
    <>
      {glyph && <span aria-hidden="true">{glyph}</span>}
      {word && <span className="work-hero-kind-word">{word}</span>}
      {parts.map((l, i) => (
        <span key={l.key || i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {(word || i > 0) && <span aria-hidden="true">·</span>}
          <HeroFact label={l.label} onClick={l.onClick} title={l.title} />
        </span>
      ))}
    </>
  )
}

// HeroGenres — a work's genres, in the same material as the rest of its facts and
// in a row that scrolls rather than wraps.
//
// NOT CHIPS, AND THE REASON IS WEIGHT. As filled `tp-chip` pills they were the
// heaviest thing in the header after the title, sitting two rows below the shelf
// state and reading as a set of filters somebody had applied. A genre is the same
// class of fact as the year above it — something this work IS — so it takes the
// same material and sits directly under the title with the rest of them.
export function HeroGenres({ genres = [], onGenre, className = 'work-hero-genres' }) {
  if (genres.length === 0) return null
  return (
    <Scroller axis="x" className={className}>
      {genres.map((g) => (
        <HeroFact key={g} label={g} onClick={onGenre ? () => onGenre(g) : undefined} />
      ))}
    </Scroller>
  )
}

// WorkHero — a work's header. ONE component, ONE markup, at every width and for
// every kind of work.
//
// IT WAS THREE, AND THAT WAS THE MISTAKE. There was a float arrangement for a
// wide page, a stacked arrangement for a phone, a column arrangement for the
// two-column frame, and a WorkHeroAny that picked between them — three copies of
// the same nine facts, which drifted exactly as three copies do: the film side
// only ever called one of them, so a film never got the column at all, and the
// year lived in the credit line on one side and nowhere on the other.
//
// The design pack settles it, and it settles it against the way this was built.
// Its `heroCol` is ONE element with ONE set of children at every width; the only
// thing that branches is `heroSplit`, which stacks the cover above the facts in
// the two-column frame and on a phone, and puts it beside them in between. That
// is a stylesheet's job, and it can be a stylesheet's job precisely BECAUSE there
// is one markup — the reason the old code gave for choosing in JavaScript
// ("rendering both and hiding one puts two <h1>s in the document") only applied
// to having two of them.
//
// So: one source, hardwired, which is the owner's rule for every work detail —
// "always from the same source, always, so they never fall out of sync". A book,
// a film, a show and a game differ in what they pass IN (the kind word, the
// credit roles, the shelf verbs, the accent), never in what draws it. There is no
// second component left to forget to update.
//
// THE FLOAT IS GONE WITH IT, and the pack never had one. Floating the actions
// right is what tore a book's name in half — "Moby-Dick; or, The" on one line,
// five buttons, then the rest of it — a defect that needed `clear: right`, a
// measured guard and a whole harness to catch. The pack puts the verbs in a row
// at the FOOT of the hero, where they cannot cut into anything, and the bug has
// nowhere left to live.
//
// The order answers four questions in turn, and it is the same order the phone
// arrangement stated for itself before this:
//
//   1. what it is        the cover, the kind, the year, the title
//   2. what it is about  its genres
//   3. what it holds     the count
//   4. where you are     the shelf state, and progress on the cover's own foot
//
// with the people, the description and the verbs beneath.
export function WorkHero({
  cover,
  shadow = 'drop-shadow(0 12px 22px rgba(0,0,0,.4))',
  // The line above the title: what this is, when, in what language, in which
  // series. See HeroKindRow — it is shared by every kind of work, which is where
  // "a film's year" and "a book's year" stopped being two different decisions.
  kindRow,
  title,
  // A prop with a default, so a caller may override it — but the DEFAULT is a
  // size like any other and answers the Quotes dial.
  titleSize = 'var(--type-display-30)',
  titleStyle,
  meta,
  counts,
  favorite,
  onFavorite,
  tags,
  genres = [],
  onGenre,
  description,
  actions,
  // 0..1, or null. Drawn as a 5px strip WELDED TO THE BOTTOM EDGE OF THE COVER —
  // the pack's `shelfBar`, inside the cover's own wrapper — so progress reads as
  // part of the book's spine rather than as a separate bar somewhere below it.
  progress = null,
  // The credits row's "and the rest" button. Absent on a work with few enough
  // credits to fit, because a control that opens a list you can already see is
  // furniture — the fade is measured, so a row that fits wears none either.
  onPeople,
  peopleCount = 0,
  // The one line the compact bar carries under the title once the header has
  // scrolled away — the author, the director, whoever this work is by. A string,
  // not the credit chips: at 13px in a bar 44px tall a row of faces is a row of
  // dots, and what the bar is FOR is telling you what you are still looking at.
  miniSub,
}) {
  // WHEN THE HEADER SCROLLS AWAY, WHAT IT WAS SAYING DOES NOT. The owner's
  // request: "when the hero section is scrolled down, the poster, title and
  // author needs to morph into a small top bar in that section."
  //
  // The pack does not draw this — it is the owner's own, so the design is here.
  // A marker sits below the title block and reports when it leaves the top of
  // whatever is scrolling it (useScrolledPast finds that for itself, because
  // this header lives in a column above 1180 and in the page below it, and one
  // component must not have to be told which). Past that point the bar is
  // visible; before it, nothing.
  // NOT ON A PHONE, and this shipped wrong for a few hours. The bar has no
  // business at 390px: the shell's own top bar already sticks at y=0 there and
  // already carries this work's name and its author (useScreenBar), so a second
  // sticky bar pinned to the same edge paints BEHIND it — 61px of bar under a
  // 52px one, so nine pixels of opaque background and a stray hairline protrude
  // below the shell bar and clip the quotes scrolling under it. On a two-line
  // title the shell bar grows and the whole thing disappears: mounted, invisible,
  // and repeating two strings that were already on screen.
  //
  // The pack says it directly: "ON A PHONE THE BAR GOES BACK TO NAMING THE
  // SCREEN… at 390px the hero is BELOW THE FOLD as soon as you scroll, so the bar
  // is the only thing that still says which book you are in." One bar.
  //
  // Gated at the MOUNT rather than in the stylesheet, so a phone also stops
  // paying for the scroll listener and stops carrying a second copy of the title
  // in its document.
  const mobile = useIsMobileScreen()
  const [scrolled, mark] = useScrolledPast()
  return (
    <div className="work-hero">
      {/* A STICKY SLOT OF ZERO HEIGHT, with the bar absolutely inside it, and
          that shape is the whole trick: a sticky bar that joins the flow when it
          appears pushes everything below it down by its own height, which as a
          reader is a jump under your thumb in the middle of a scroll. This one
          never occupies a pixel of layout, so showing and hiding it costs
          nothing and the content behind it does not move.

          MOUNTED ONLY WHILE IT IS SHOWN, rather than always present and faded
          out, and the reason is not performance. A bar that is always in the
          document puts a SECOND COPY OF THE TITLE there — invisible, but found
          by anything that looks for the name by its text, which broke nine tests
          the moment it landed and would have broken every future one that asks
          "is the book's name on this page". aria-hidden keeps it out of the
          accessibility tree; it cannot keep it out of the document. Mounting on
          demand means there is exactly one title at rest, which is the truth.

          It costs the fade — the bar appears rather than easing in — and that is
          the right way round: a rest state may not depend on anything firing,
          and this content now does not.

          Drawn only when there is a title to carry — a header with no name is
          not a header worth repeating. */}
      {title && scrolled && !mobile && (
        <div className="work-hero-mini-slot is-shown" aria-hidden="true">
          <div className="work-hero-mini">
            <div className="work-hero-mini-cover">{cover}</div>
            <div className="work-hero-mini-text">
              <div className="work-hero-mini-title">{title}</div>
              {miniSub && <div className="work-hero-mini-sub">{miniSub}</div>}
            </div>
          </div>
        </div>
      )}
      {/* THE COVER IS AN OBJECT IN THE HEADER, NOT THE HEADER. The pack draws it
          at 132px, which in the 300px column is 44% of the width with the rest
          left as air. Read once as a ratio and given `width: 100%`, it was 2.3x
          as wide, five times the area, and pushed the two verbs the page exists
          for below the fold at 1440x900. frame-scroll.mjs measures both now. */}
      <div className="work-hero-split">
        <div className="work-hero-cover-wrap">
          <div className="work-hero-cover" style={{ filter: shadow }}>{cover}</div>
          {progress != null && (
            <div className="work-hero-shelfbar" aria-hidden="true">
              <span style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
            </div>
          )}
        </div>
        {/* The facts are their own tier with their own step — 9px against the
            header's 11px. One gap everywhere makes six unrelated rows; two tiers
            make a block under a title. */}
        <div className="work-hero-facts">
          {kindRow && <div className="work-hero-kind">{kindRow}</div>}
          <div className="work-hero-title">
            <h1 className="display-title" style={{ fontSize: titleSize, lineHeight: 1.12, ...titleStyle }}>
              {title}
            </h1>
            <Hearts value={!!favorite} onChange={onFavorite} />
            {/* THE MARKER, INSIDE THE TITLE ROW AND PINNED TO ITS BOTTOM EDGE.
                The bar repeats the poster, the title and the author, so it is
                wanted from the moment THOSE have gone — not when the whole block
                of facts has, which is what putting it below the split meant: on a
                1440x380 window the column offered 367px of scroll and the marker
                sat 368px down, so the bar could not appear at all. A control
                unreachable at every real size is one that was never built.

                1x1 and absolute (see the stylesheet): an IntersectionObserver
                fires on a CHANGE of intersection and a zero-area box never
                intersects anything, so a marker with no height was observed once
                and never again. */}
            <span ref={mark} aria-hidden="true" className="work-hero-mark" />
          </div>

          {/* GENRES ARE LINKS, NOT PILLS, and they sit directly under the title.
              They are the same KIND of fact as the year and the language above —
              something this work is, that you can follow — so they take the same
              material. As filled chips two rows lower they competed with the
              shelf state for the same weight and read as filters. */}
          <HeroGenres genres={genres} onGenre={onGenre} />
          {counts && <div className="work-hero-counts">{counts}</div>}
          {tags && <div className="work-hero-state">{tags}</div>}
        </div>
      </div>
      {/* The credits. A horizontal scroller rather than a wrap, so a long list
          stays one line and the header keeps its shape — and so the +N has
          somewhere to sit. THE BUTTON IS NOT A MEMBER OF THE ROW, so it is not
          inside the scroller: the one control that opens the whole cast must not
          scroll away under the fade. The fade says swipe, the button says tap for
          all of it. */}
      {meta && (
        <div className="work-hero-credits">
          <Scroller axis="x" className="work-hero-credit-row">{meta}</Scroller>
          {onPeople && peopleCount > 0 && (
            <button type="button" className="work-hero-more" onClick={onPeople}>
              {t('work.people.more', { n: peopleCount, count: peopleCount })}
            </button>
          )}
        </div>
      )}
      <ExpandableDescription text={description} />
      {actions && <div className="work-hero-actions">{actions}</div>}
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
  const [mobileSort, setMobileSort] = useState(false)
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
  // A sub-board reached from somewhere — a series, a credit — used to draw its
  // own MobileDetailBar, the same second top bar the work details drew. It
  // publishes now: the shell's header takes the title and the counts, and the
  // dock takes the two verbs. `onBack` is what marks it as a place you arrived
  // at rather than a tab, and the dock's own Back key is what leaves it.
  // ONE PUBLICATION FOR BOTH RANKS. A scaffold is either a top-level board
  // (Library, the Catalogue, Quotes) or a sub-board you arrived at (a series, a
  // credit, one board of quotes) — and on a phone both now spend their verbs the
  // same way, in the dock, because the header they used to sit in is a header.
  //
  // The crumb is the one difference: only the arrived-at case publishes a title,
  // since a top-level board's name is already what the shell calls the tab.
  useCrumb(mobile && onBack ? title : null)
  // THE BOARD'S COMPLETE SET, for the top bar's ⋯ — see ScreenMenu.
  //
  // WHAT BECOMES A ROW AND WHAT BECOMES A DOOR. A menu bar can hold a choice
  // among a handful of known values, so the sort options and the "show only"
  // toggles are rows with their state on them. It cannot hold a select over forty
  // genres, every series in the library, or every name credited on the board —
  // those stay one row that OPENS the sheet they live in. The test is the size of
  // the value set, not the kind of control: a menu that swallowed the genre list
  // would be a worse genre picker than the one it replaced.
  //
  // NOT PHONE-ONLY, unlike the dock keys below it. The ⋯ is on both viewports and
  // this is what fills it, so the guard the keys need would empty the menu on
  // every desktop.
  useScreenBar({
    actions: () => {
      const out = []
      const only = []
      if (setFav) only.push({ id: 'only-fav', label: t('common.filters.favourites.label'), checked: !!fav, onClick: () => setFav(!fav) })
      if (setTagged) only.push({ id: 'only-tagged', label: t('common.filters.tagged.label'), checked: !!tagged, onClick: () => setTagged(!tagged) })
      if (setNoted) only.push({ id: 'only-noted', label: t('common.filters.noted.label'), checked: !!noted, onClick: () => setNoted(!noted) })
      if (only.length) out.push({ id: 'h-only', heading: t('common.filters.only.label') }, ...only)

      if (hasSort) {
        out.push({ id: 'h-sort', heading: t('common.filters.sort.label') })
        for (const [value, label] of sortOptions) {
          out.push({ id: `sort-${value}`, label, checked: sort === value, onClick: () => setSort(value) })
        }
      }

      // The doors, and the verbs. `onReset` is offered whatever the filter state:
      // a reader who cannot tell whether a filter is on is exactly the reader who
      // wants this row, and a row that appears only once something is filtered is
      // a row nobody learns is there.
      out.push({ id: 'h-do', heading: t('common.mono.actions.label') })
      // THE ONE PLACE "COMPLETE" IS BOUNDED, and by the width rather than by the
      // screen. The selects — genre, shelf state, series, who is credited — are
      // drawn on the page at desktop widths, so a row here would open a sheet
      // over controls the reader is already looking at. On a phone the same
      // controls are BEHIND that sheet, so the row is how you reach them.
      if (mobile && (hasGenre || hasStates || hasSeries || hasCredit || hasWish)) {
        out.push({ id: 'filters', icon: <IconFilter />, label: t('common.filters.label'), onClick: () => setMobileFilter(true) })
      }
      if (onReset) out.push({ id: 'reset', icon: <IconRevert />, label: t('common.filters.reset.label'), onClick: onReset })
      if (!DEMO && onExport) {
        out.push({ id: 'export', icon: <IconExport />, label: t('common.action.export.label'), onClick: onExport })
      }
      return out
    },
    sub: mobile ? counts : null,
    keys: mobile ? [
      {
        id: 'filter',
        label: t('common.filters.label'),
        icon: <IconFilter />,
        onClick: () => setMobileFilter((o) => !o),
      },
      // SORT, NOT EXPORT. Export is a once-in-a-while act and it has a home in the
      // top bar's ⋯; sort is something you reach for while you are looking at the
      // board, which is exactly what a dock seat is for.
      ...(hasSort ? [{
        id: 'sort',
        label: t('common.filters.sort.aria'),
        icon: <IconSort />,
        onClick: () => setMobileSort((o) => !o),
      }] : []),
    ] : null,
  })

  return (
    <section>
      {/* ON A PHONE THIS IS A HEADING AND NOTHING ELSE. The counts went to the
          shell header's sub-line and the two verbs went to the dock, so what is
          left is the page's <h1> — kept, and taken off the screen by CSS rather
          than out of the document, because it is the top of this page's outline
          and a phone page with no heading at all is a worse bug than a repeated
          word. */}
      <div>
        <PageHeader
          title={title}
          counts={mobile ? null : counts}
          right={mobile ? null : (
            <>
              {headerAside}
              {/* Export is a glyph, not a word: the header row is the tightest
                  real estate on the page and "Export all" spent it on a label
                  the ⬇ already carries.

                  It says "Export", not "Export all", because it is not all: all
                  three screens post `shown` — the filtered view — and the confirm
                  dialog has always said "N in view". The label was the last
                  survivor of the whole-collection export it replaced, and it
                  contradicted the dialog directly above the button you press. */}
              {!DEMO && (
                <IconButton icon={<IconExport />} label={t('common.action.export.label')}
            ariaLabel={t('common.action.export.label')} onClick={onExport} tooltip={t('common.action.export.shown.tip')} />
              )}
            </>
          )}
        />
      </div>
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
          </div>
        </MobileSheet>
      )}

      {/* SORT HAS ITS OWN SHEET, and it used to be the last section of the one
          above. Two dock keys pointing into one sheet would be the same door
          twice — the thing this app keeps taking out (the second magnifier, the
          bin tile in Settings) — so filter filters and sort sorts. It is also the
          honest split: a filter changes WHICH rows you are looking at and a sort
          changes only their order, and the sheet's own footer says "N shown",
          which was never true of the sort control sitting under it. */}
      {mobile && hasSort && (
        <MobileSheet
          open={mobileSort}
          onClose={() => setMobileSort(false)}
          title={t('common.filters.sort.aria')}
        >
          <div>
            <MonoLabel className="mb-2 block">{t('common.filters.sort.label')}</MonoLabel>
            {sortSelect}
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
