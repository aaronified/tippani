// works.jsx — shared building blocks for "works" (books + films/shows), the two
// halves of the catalogue that render in parallel across the Library, Movies,
// Search and Metadata screens. Kept in their own module so both sides compose
// the same pieces instead of re-deriving them (and to avoid a ui ↔ people
// import cycle — this layer is free to import from both).
import { useState } from 'react'
import { DEMO, coverImgURL } from './api.js'
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
  Placeholder,
  SHELF_META,
  Select,
  SheetFooter,
  StateTag,
  StatusBar,
  ReadingBadge,
  Toggle,
  Tooltip,
  filterChipClass,
  formatPartialDate,
  seriesLabel,
  shelfLabel,
} from './ui.jsx'

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
export const ACTIVE_STATUS = { book: 'reading', movie: 'watching' }

// SHELF_CAPS — how many works may be in progress at once before the cap dialog
// asks whether you mean it. Films are capped hardest: two at a time is already
// unusual, whereas five part-read books is an ordinary shelf. Keyed the way the
// board asks: books, then films and shows separately (a binge-watched series
// should not crowd out a film). Mirrors shelfCap() on the server.
export const SHELF_CAPS = { book: 5, movie: 2, show: 5 }

// isActive says whether a row is the in-progress one for its side.
export function isActive(kind, item) {
  return item.status === ACTIVE_STATUS[kind]
}

// shelfState names the state a tile/detail should draw, or null when a work is
// simply in the library with quotes and no status of its own.
export function shelfState(kind, item) {
  if (item.status) return item.status
  const count = kind === 'book' ? item.annotation_count || 0 : item.dialogue_count || 0
  return count === 0 ? 'wishlist' : null
}

// capKeyFor picks which cap pool a work belongs to: books, films, or shows.
export function capKeyFor(kind, item) {
  if (kind === 'book') return 'book'
  return (item.media_type || 'movie') === 'show' ? 'show' : 'movie'
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
// credit — authors for books, directors/creators for films). Accessors keep the
// util blind to the two data shapes:
//   credit(item)  → the credit string           (default '')
//   year(item)    → a 4-digit year              (default null)
//   genres(item)  → string[]                    (default [])
//   series(item)  → the series name             (default item.series)
// Options: splitCredit (split the credit into co-credits, books), seps (the
// separator set for that split), creditResidual (label for the no-credit
// bucket), sortMembers(members, dim) → members.
export function groupWorks(list, dim, opts = {}) {
  const {
    credit = () => '',
    year = () => null,
    genres = () => [],
    series = (it) => it.series,
    splitCredit = false,
    seps,
    creditResidual = 'Unknown',
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
      else add('~none', 'No series', it, { residual: true })
    } else if (dim === 'author') {
      const c = credit(it)
      const names = splitCredit ? splitCredits(c, seps) : c ? [c] : []
      if (names.length) names.forEach((n) => add(n, n, it))
      else add('~none', creditResidual, it, { residual: true })
    } else if (dim === 'decade') {
      const d = decadeOf(year(it))
      if (d != null) add(String(d), `${d}s`, it, { order: d })
      else add('~none', 'Unknown year', it, { residual: true })
    } else if (dim === 'genre') {
      const gs = genres(it)
      if (gs.length) gs.forEach((g) => add(g, g, it))
      else add('~none', 'No genre', it, { residual: true })
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
export function InProgressCapDialog({ open, items, cap, noun, verb, pastLabel, onRelease, onProceed, onCancel, busyId, error }) {
  return (
    <ConfirmDialog
      open={open}
      title={`Already ${verb} ${items.length}`}
      confirmLabel="Start it anyway"
      onCancel={onCancel}
      onConfirm={onProceed}
      body={
        <>
          <p>
            {`The shelf holds ${cap} ${noun}${cap === 1 ? '' : 's'} at a time, to keep it worth glancing at. Settle one
              below — that marks it finished today, and you can correct the date on its own page — or start this one too
              and let the shelf run long.`}
          </p>
          <ul className="mt-3 space-y-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ color: 'var(--ink)' }}>
                    {it.title}
                  </span>
                  {it.meta && (
                    <span className="block truncate" style={{ fontSize: 12.5, color: 'var(--faint)' }}>
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
                  {busyId === it.id ? 'saving…' : pastLabel}
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
export function ShelfDateDialog({ open, title, label, value, onChange, onConfirm, onCancel, confirmLabel = 'Save', error }) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      onCancel={onCancel}
      onConfirm={onConfirm}
      body={
        <>
          <PartialDateField
            label={label}
            value={value}
            onChange={onChange}
            hint="as precise as you actually know — a year on its own is fine"
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
    const episode = `E${ofTotal(pos.pos || 0, pos.pos_total)}`
    if (!pos.season_total) return episode
    return `${episode} · S${ofTotal(pos.season || 1, pos.season_total)}`
  }
  return `p. ${pos.pos || 0} of ${pos.pos_total}`
}

// ShelfProgress — the track under a work's state chip on its detail. Any
// in-progress work shows it, so "where am I" is answered without opening the
// popover, in the units the work is actually counted in.
export function ShelfProgress({ status, progress = 0, pos }) {
  const label = positionLabel(pos)
  return (
    <span style={{ display: 'block', minWidth: 168, maxWidth: 260 }}>
      <StatusBar state={status} progress={progress} radius={3} />
      <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)' }}>
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
      <span style={{ fontSize: 12.5, color: 'var(--soft)' }}>{label}</span>
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
      <MonoLabel className="mb-1.5 block">progress</MonoLabel>
      {unit !== '' && (
        <div className="mb-2">
          <Toggle
            ariaLabel="Progress unit"
            value={mode}
            onChange={setMode}
            options={[['pct', '%'], ['unit', episodes ? 'episodes' : 'pages']]}
          />
        </div>
      )}
      {mode === 'pct' ? (
        <div className="flex items-center gap-2">
          {field('%', pct, setPct, 3)}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {episodes && field('season', season, setSeason, 3)}
          {episodes && field('of', seasonTotal, setSeasonTotal, 3)}
          {field(episodes ? 'episode' : 'page', at, setAt, 5)}
          {field('of', total, setTotal, 5)}
        </div>
      )}
      {missingTotal && (
        <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: 'var(--error)' }}>
          {episodes ? 'how many episodes in this season?' : 'how many pages in the book?'}
        </span>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1">
          <StatusBar state={status} progress={preview} radius={3} />
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)' }}>{preview}%</span>
        <button type="button" className="tp-chip tp-chip-btn" disabled={busy || missingTotal} onClick={save}>
          set
        </button>
      </div>
    </div>
  )
}

export function ShelfControl({ kind, item = {}, status, progress = 0, pos, reads = [], wishlist, onSelect, onProgress, busy }) {
  const active = ACTIVE_STATUS[kind]
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
      <StateTag state="" label="Shelve">
        {(close) => transitionItems(kind, status, moves, busy, close, onSelect)}
      </StateTag>
    )
  }

  // Wishlist is derived, so its chip explains itself rather than offering a way
  // off it — but it still carries the transitions, so a work you have never
  // quoted from can go on a shelf without first being marked up.
  if (state === 'wishlist') {
    return (
      <StateTag state="wishlist" label="Wishlist" tip="Why this is on the wishlist">
        {(close) => (
          <>
            <p style={{ padding: '4px 6px 8px', fontSize: 13, lineHeight: 1.5, color: 'var(--soft)' }}>
              On the wishlist because nothing is quoted from it yet — automatic, and it clears itself the moment you add a
              quote. Putting it on a shelf below is a separate thing.
            </p>
            {transitionItems(kind, status, moves, busy, close, onSelect)}
          </>
        )}
      </StateTag>
    )
  }
  return (
    <>
      <StateTag state={state} label={shelfLabel(state, kind)} tip="Change the shelf state">
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
      {/* Any in-progress work shows its track, in its own units. */}
      {(status === active || status === 'paused') && (
        <ShelfProgress status={status} progress={progress} pos={pos} />
      )}
      {finished > 0 && (
        <StateTag state={state} label={`×${finished}`} tip="Open the read log">
          <ul className="read-log">
            {reads.map((r, i) => (
              <li key={r.id ?? i}>
                <span className="read-n">{i + 1}</span>
                <span>
                  {formatPartialDate(r.started_at) || 'unknown'}
                  {' – '}
                  {r.outcome === 'open' ? (
                    <span className="read-open">still going</span>
                  ) : (
                    <>
                      {formatPartialDate(r.finished_at) || 'unknown'}
                      {r.outcome === 'abandoned' && <span className="read-open"> (abandoned)</span>}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </StateTag>
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
export function moveLabel(kind, from, to) {
  const book = kind === 'book'
  switch (to) {
    case 'reading':
    case 'watching':
      if (from === 'completed') return book ? 'Read it again' : 'Watch it again'
      if (from === 'paused') return book ? 'Pick it back up' : 'Carry on watching'
      return book ? 'Mark as reading' : 'Mark as watching'
    case 'paused':
      return 'Pause it'
    case 'abandoned':
      return book ? 'Give up on it' : 'Give up on it'
    case 'completed':
      return book ? 'Mark as read' : 'Mark as watched'
    default:
      return 'Clear the shelf tag'
  }
}

// WorkCard — one catalogue tile for a book or a film/show: cover/poster (2:3)
// with the favourite badge, title, a credit face-chip + line, an optional
// series line, and a count. `kind` ('book' | 'movie') selects the book's
// hand-drawn card frame + "quotes" vs the film's plain poster + "dialogues".
// The book grid (Library) and poster grid (Movies) both deal these; each keeps
// its own <ul>/grid wrapper and gap, sharing only the tile.
export function WorkCard({ kind, item, index = 0, onOpen, people = {}, seps }) {
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
      alt={`${isBook ? 'Cover' : 'Poster'} of ${item.title}`}
      className="block aspect-[2/3] w-full object-cover"
    />
  ) : (
    <Placeholder kind={isBook ? 'COVER' : 'POSTER'} className={isBook ? 'w-full rounded-none border-0' : 'w-full'} />
  )
  // A film's poster and its status bar are one clipped unit: the frame owns the
  // border and the 8px radius, so the bar sits flush under the artwork instead of
  // reading as a loose stripe below a separately-rounded image. (A book's cover
  // needs none of this — HandCard already clips both to its hand-drawn shape.)
  const framed = isBook ? (
    image
  ) : (
    <span style={{ display: 'block', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
      {image}
      {state && <StatusBar state={state} progress={item.progress} />}
    </span>
  )
  return (
    <button type="button" onClick={() => onOpen(item.id)} className="cover-tile block w-full text-left" title={item.title}>
      {isBook ? (
        // The status bar rides INSIDE the hand-card, directly under the cover:
        // the card clips it to its own hand-drawn shape, so it reads as part of
        // the card rather than a stripe floating below it — and the artwork stays
        // completely unobscured, which is the whole point of a bar over a badge.
        <HandCard variant={index % 4} className="relative overflow-hidden cover-lift">
          {image}
          {state && <StatusBar state={state} progress={item.progress} />}
          {isActive(kind, item) && <ReadingBadge kind={kind} />}
          {item.favorite && <FavBadge />}
        </HandCard>
      ) : (
        <div className="relative cover-lift">
          {framed}
          {isShow && (
            <span
              className="tp-chip absolute left-1.5 top-1.5"
              style={{ fontSize: 9.5, background: 'rgba(21,16,12,.72)', color: '#fff', borderColor: 'transparent' }}
            >
              SHOW
            </span>
          )}
          {/* A show's poster already spends its top-left on the SHOW chip, so the
              reading mark stacks under it rather than overprinting. */}
          {isActive(kind, item) && <ReadingBadge kind={kind} stacked={isShow} />}
          {item.favorite && <FavBadge />}
        </div>
      )}
      <p className="mt-2.5 truncate" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>
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
          <MonoLabel style={{ color: 'var(--accent-ui)' }}>{`${count} quote${count === 1 ? '' : 's'}`}</MonoLabel>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)' }}>
            {count} dialogue{count === 1 ? '' : 's'}
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
export function GroupHeading({ label, count, noun = 'item', person, onOpenPerson }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {person && <PersonPortrait person={person} size={34} />}
      {onOpenPerson ? (
        <Tooltip label="Open this person's details" className="min-w-0">
          <button
            type="button"
            className="display-title truncate"
            style={{ fontSize: 19, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            onClick={onOpenPerson}
          >
            {label}
          </button>
        </Tooltip>
      ) : (
        <h3 className="display-title truncate" style={{ fontSize: 19 }}>
          {label}
        </h3>
      )}
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>
        {count} {noun}{count === 1 ? '' : 's'}
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
        <Tooltip label="Back to the list" side="bottom" className="shrink-0">
          <button
            type="button"
            className="tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full"
            style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }}
            onClick={onClose}
            aria-label="Back"
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

// WorkHero — the desktop detail hero shared by books and films: cover/poster
// column (drop-shadowed), an info column (title · meta slot · favourite hearts ·
// genre chips · description), and an actions column. Returns the three columns
// as a fragment so the caller owns the flex container (a plain div for books, a
// Reveal for films). Divergent bits are slots: `cover` (Cover vs Poster), `meta`
// (the mono/amber credit line), `actions` (Export/Edit/Delete), `tags` (the
// shelf-state chips, which sit on the hearts row so a work's two pieces of
// personal state — favourite, and what shelf it is on — read together).
export function WorkHero({
  cover,
  shadow = 'drop-shadow(0 12px 22px rgba(0,0,0,.4))',
  title,
  titleSize = 28,
  titleStyle,
  meta,
  favorite,
  onFavorite,
  tags,
  genres = [],
  description,
  actions,
}) {
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
  onExport,
  headerAside,
  loaded, // items != null (data has arrived)
  hasItems, // items && items.length > 0
  shownCount,
  emptyText,
  noMatchText,
  genres,
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
  states, // shelf states to keep; [] = every state
  setStates,
  kind = 'book', // 'book' | 'movie' — which side's words the state control uses
  noun = 'book', // what a row is, for the "show only" chip tooltips
  // Books group into a "series"; films and shows into a "collection" — the same
  // movies.series column, but "series" already means a TV show on that page.
  seriesNoun = 'series',
  // Carried separately because "series" is its own plural: appending an s gave
  // the books filter "all seriess". Defaults to the regular English form, so
  // "collection" still needs no call-site change.
  seriesNounPlural = seriesNoun === 'series' ? 'series' : `${seriesNoun}s`,
  seriesNames,
  series,
  setSeries,
  sort,
  setSort,
  sortOptions,
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
  // "show only" — independent toggles, ANDed by the page's `shown` memo. Shared
  // with the desktop row rather than mobile-only: the predicates live in that
  // memo, so a phone-set filter would otherwise survive a resize past the
  // breakpoint with no control left to see or clear it.
  const onlyChips = (
    <>
      <Tooltip label="Show only favourites">
        <button onClick={() => setFav(!fav)} className={filterChipClass(fav)}>
          ♥ favourites
        </button>
      </Tooltip>
      <Tooltip label={`Only tagged ${noun}s`}>
        <button onClick={() => setTagged(!tagged)} className={filterChipClass(tagged)}>
          tagged
        </button>
      </Tooltip>
      <Tooltip label={`Only ${noun}s with notes`}>
        <button onClick={() => setNoted(!noted)} className={filterChipClass(noted)}>
          has notes
        </button>
      </Tooltip>
    </>
  )
  // The wishlist control is a 3-way scope, not a toggle: a work with nothing
  // annotated is "on the wishlist", and you either ignore that (all), browse only
  // those (wishlist), or hide them to see just what you have actually quoted
  // (annotated). Same chip-triplet shape as the Catalogue's movie/show control.
  const wishChips = [
    ['', 'all', `Every ${noun}`],
    ['wishlist', 'wishlist', `Only unquoted ${noun}s`],
    ['annotated', 'annotated', `Hide unquoted ${noun}s`],
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
      ariaLabel="Filter by shelf state"
      allLabel="any state"
      values={states}
      onChange={setStates}
      options={[
        [ACTIVE_STATUS[kind], shelfLabel(ACTIVE_STATUS[kind], kind), SHELF_META[ACTIVE_STATUS[kind]].color],
        ['paused', 'Paused', SHELF_META.paused.color],
        ['abandoned', 'Abandoned', SHELF_META.abandoned.color],
        ['completed', 'Completed', SHELF_META.completed.color],
        ['none', 'No shelf tag', 'transparent'],
      ]}
    />
  )
  const seriesSelect = seriesNames.length > 0 && (
    <Select
      ariaLabel={`Filter by ${seriesNoun}`}
      value={series}
      onChange={setSeries}
      options={[['', `all ${seriesNounPlural}`], ...seriesNames.map((s) => [s, s])]}
    />
  )
  const sortSelect = <Select ariaLabel="Sort" value={sort} onChange={setSort} options={sortOptions} />
  return (
    <section>
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title={title}
          counts={counts}
          right={
            <>
              {mobile && (
                <div className="flex items-center gap-2">
                  <IconButton icon={<IconFilter />} ariaLabel="Filters" onClick={() => setMobileFilter((o) => !o)} />
                  {!DEMO && <MoreMenu items={[{ icon: <IconExport />, label: 'Export all', onClick: onExport }]} />}
                </div>
              )}
              {!mobile && headerAside}
              {/* Export is a glyph, not a word: the header row is the tightest
                  real estate on the page and "Export all" spent it on a label
                  the ⬇ already carries. */}
              {!mobile && !DEMO && (
                <IconButton icon={<IconExport />} ariaLabel="Export all" onClick={onExport} tooltip="Export everything as Markdown" />
              )}
            </>
          }
        />
      </div>
      <ErrorText>{error}</ErrorText>

      {hasItems && !mobile && (
        <div className="filter-row mb-5">
          <GenreFilter genres={genres} value={genre} onChange={setGenre} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {leading}
            {wishChips}
            {onlyChips}
            {stateSelect}
            {seriesSelect}
            {trailing}
            <label className="flex items-center gap-2">
              <MonoLabel>sort</MonoLabel>
              {sortSelect}
            </label>
          </div>
        </div>
      )}

      {mobile && (
        <MobileSheet
          open={mobileFilter}
          onClose={() => setMobileFilter(false)}
          title="Filters"
          footer={
            <SheetFooter
              count={loaded ? `${shownCount} shown` : ''}
              onReset={onReset}
              onDone={() => setMobileFilter(false)}
            />
          }
        >
          <div className="space-y-5">
            <div>
              <MonoLabel className="mb-2 block">genre</MonoLabel>
              {/* The same GenreFilter the desktop row uses — one select over every
                  genre. The sheet reached that shape first (1.4.0), because a
                  measured chip strip inside a full-width section always collapsed
                  to zero visible chips; the desktop row joined it in 1.4.2. */}
              <GenreFilter genres={genres} value={genre} onChange={setGenre} />
            </div>
            {leadingMobile}
            <div>
              <MonoLabel className="mb-2 block">wishlist</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">{wishChips}</div>
            </div>
            <div>
              <MonoLabel className="mb-2 block">show only</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">{onlyChips}</div>
            </div>
            <div>
              <MonoLabel className="mb-2 block">shelf</MonoLabel>
              {stateSelect}
            </div>
            {seriesNames.length > 0 && (
              <div>
                <MonoLabel className="mb-2 block">{seriesNoun}</MonoLabel>
                {seriesSelect}
              </div>
            )}
            {trailingMobile}
            <div>
              <MonoLabel className="mb-2 block">sort</MonoLabel>
              {sortSelect}
            </div>
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
