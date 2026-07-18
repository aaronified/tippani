import { useEffect, useMemo, useState } from 'react'
import { json, errText } from './api.js'
import { BookLookupPicker, MovieLookupPicker } from './CoverPicker.jsx'
import { EditBook } from './Library.jsx'
import { EditMovie } from './Movies.jsx'
import { EmptyState, ErrorText, GhostButton, HandCard, InfoDot, MonoLabel, PageHeader, ProgressBar, Tooltip, splitCommas, useIsMobileScreen } from './ui.jsx'
import { PersonModal, PersonName, ProviderChips, mergeLinks, parseLinks } from './people.jsx'
import { ReverifyFlow } from './ReverifyReview.jsx'

// Metadata tab — a management console: coverage stats up top, then filterable
// books / films-shows lists with multi-select bulk actions (fill actors, delete,
// fetch missing covers) plus per-row review-each look-up, and a per-title speaker
// remap tool. The point of the tab is doing metadata at scale, not one at a time.
export default function MetadataPage({ user, onOpenBook, onOpenMovie, onSearch }) {
  const [lib, setLib] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  // Force-fetch & re-verify (ROADMAP §2): {book_ids, movie_ids, people} or null.
  const [reverify, setReverify] = useState(null)

  async function load() {
    const r = await json('GET', '/metadata/library')
    if (r.ok) setLib(r.data)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [])

  // Fetch missing covers/posters for the whole library (Open Library by ISBN,
  // Amazon by ASIN, cached posters — no key needed). Admin-only endpoint.
  // The endpoint is chunked ({cursor} → {next_cursor, done, total, remaining}),
  // so this loops chunk by chunk and drives a real progress bar.
  const [progress, setProgress] = useState(null) // {done, total} while running
  // missingOnly = fill empty covers/posters + details only, never upgrade stored
  // low-res art — the "no replacement" mode the stripped-down mobile screen uses.
  async function fetchMissingCovers(missingOnly = false) {
    setBusy(true)
    setError('')
    setFlash('')
    // Seed progress before the first request so the bar paints immediately, even
    // when the whole library fits in one chunk (React would otherwise batch the
    // set-then-clear into a single render and the bar would never show). total 0
    // => indeterminate stripe until the first chunk reports the real total.
    setProgress({ done: 0, total: 0 })
    const sum = { fetched: 0, enriched: 0, failed: 0, skipped: 0 }
    try {
      let cursor = ''
      let total = 0
      for (;;) {
        const body = {}
        if (cursor) body.cursor = cursor
        if (missingOnly) body.missing_only = true
        const r = await json('POST', '/covers/refetch', body)
        if (!r.ok) return setError(errText(r, 'could not re-fetch covers'))
        sum.fetched += r.data.fetched
        sum.enriched += r.data.enriched || 0
        sum.failed += r.data.failed
        sum.skipped += r.data.skipped || 0
        total = total || r.data.total
        setProgress({ done: total - r.data.remaining, total })
        if (r.data.done) break
        cursor = r.data.next_cursor
      }
      // Spell out skipped/failed so a partial run reads as intentional ("11
      // already had the best available") rather than a silent nothing-happened.
      const parts = [`${sum.fetched} covers fetched/upgraded`, `${sum.enriched} details filled`]
      if (sum.skipped) parts.push(`${sum.skipped} left as-is (no higher-res source)`)
      if (sum.failed) parts.push(`${sum.failed} failed`)
      if (!sum.fetched && !sum.enriched && !sum.skipped && !sum.failed) parts.length = 0
      setFlash(parts.length ? parts.join(' · ') : 'everything already up to date')
      load()
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  // Unified catalogue console: a type (all/book/movie/show) that drives which
  // filters the second dropdown offers, plus the chosen filter.
  const [catType, setCatType] = useState('all')
  const [catFilter, setCatFilter] = useState('flagged')
  const mobile = useIsMobileScreen()

  const stats = useMemo(() => {
    const b = lib?.books || []
    const m = lib?.movies || []
    const d = lib?.dialogue_stats || { total: 0, missing_actor: 0 }
    const count = (list, pred) => list.filter(pred).length
    return {
      books: {
        total: b.length,
        no_cover: count(b, (x) => !x.has_cover),
        low_res: count(b, (x) => x.low_res_cover),
        no_author: count(b, (x) => !x.has_author),
        no_series: count(b, (x) => !x.has_series),
        no_year: count(b, (x) => !x.has_year),
        no_genre: count(b, (x) => !x.has_genre),
        no_source: count(b, (x) => !x.has_ids),
      },
      movies: {
        total: m.length,
        no_poster: count(m, (x) => !x.has_poster),
        low_res: count(m, (x) => x.low_res_poster),
        no_cast: count(m, (x) => !x.has_cast),
        no_director: count(m, (x) => !x.has_director),
        no_year: count(m, (x) => !x.has_year),
        no_genre: count(m, (x) => !x.has_genre),
        no_source: count(m, (x) => !x.has_source),
      },
      dialogues: d,
    }
  }, [lib])

  return (
    <section className="space-y-6">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title="Metadata"
          counts={mobile ? 'maintenance' : 'stats · filters · bulk actions'}
          right={
            mobile ? (
              <InfoDot
                side="bottom"
                text="This is the trimmed-down maintenance view. Open Tippani on a desktop for the full metadata console — coverage stats, filterable book & film lists, and bulk actions."
              />
            ) : (
              user?.is_admin && (
                <Tooltip
                  side="bottom"
                  label="Admin maintenance: fetches missing covers/posters (and replaces low-res ones) and backfills author/description/year/genres across all libraries on this instance (fill-empty, non-destructive). Caps genres at 5 per item to avoid low-quality random tagging."
                >
                  <GhostButton disabled={busy} onClick={() => fetchMissingCovers(false)}>
                    Fetch missing covers &amp; metadata
                  </GhostButton>
                </Tooltip>
              )
            )
          }
      />
      </div>
      <ErrorText>{error}</ErrorText>
      {busy && progress && (
        <ProgressBar
          value={progress.done}
          max={progress.total}
          label={progress.total > 0
            ? `fetching covers & metadata · ${progress.done}/${progress.total}`
            : 'fetching covers & metadata…'}
        />
      )}
      {flash && (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
          {flash}
        </p>
      )}
      {!lib ? (
        <EmptyState>loading…</EmptyState>
      ) : mobile ? (
        // Mobile (§5): a maintenance screen, not the at-scale console. Just the
        // handful of one-tap actions; the big filterable lists are desktop-only,
        // and the coverage tiles collapse into plain text lines at the bottom.
        <>
          {user?.is_admin && (
            <MobileAction
              title="Fetch covers & metadata"
              desc="Fill missing covers, posters and details — never replaces what you already have."
              actionLabel="Fetch"
              busy={busy}
              onClick={() => fetchMissingCovers(true)}
            />
          )}
          <MobileAction
            title="Re-verify metadata"
            desc="Re-check every pinned book, film and show against the live sources and review each change before it's applied."
            actionLabel="Re-verify"
            busy={!!reverify}
            onClick={() =>
              setReverify({
                book_ids: lib.books.filter((b) => b.has_ids).map((b) => b.id),
                movie_ids: lib.movies.filter((m) => m.has_source).map((m) => m.id),
                people: [],
              })
            }
          />
          <DuplicatesPanel onDone={load} onFlash={setFlash} />
          <SpeakerRemap movies={lib.movies.filter((m) => m.dialogue_count > 0)} onDone={load} />
          <PeopleConsole onFlash={setFlash} compact />
          <StatsLines stats={stats} />
        </>
      ) : (
        <>
          <StatsStrip stats={stats} onPick={(t, f) => { setCatType(t); setCatFilter(f) }} />
          <CatalogueConsole
            books={lib.books}
            movies={lib.movies}
            type={catType}
            setType={setCatType}
            filter={catFilter}
            setFilter={setCatFilter}
            onOpenBook={onOpenBook}
            onOpenMovie={onOpenMovie}
            onDone={load}
            onFlash={setFlash}
            onReverify={(selection) => setReverify(selection)}
          />
          <DuplicatesPanel onDone={load} onFlash={setFlash} />
          <PeopleConsole onFlash={setFlash} onReverify={(people) => setReverify({ people })} onSearch={onSearch} />
          <SpeakerRemap movies={lib.movies.filter((m) => m.dialogue_count > 0)} onDone={load} />
        </>
      )}
      {reverify && (
        <ReverifyFlow
          selection={reverify}
          onClose={() => setReverify(null)}
          onFlash={setFlash}
          onDone={load}
        />
      )}
    </section>
  )
}

// MobileAction — a compact action card for the stripped-down mobile Metadata
// screen (§5): a title, a one-line what-it-does, and a single run button.
function MobileAction({ title, desc, actionLabel = 'Run', busy, onClick, disabled }) {
  return (
    <HandCard className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <h2 style={H2}>{title}</h2>
        {desc && <p className="microcopy" style={{ color: 'var(--soft)' }}>{desc}</p>}
      </div>
      <GhostButton className="shrink-0" disabled={busy || disabled} onClick={onClick}>
        {busy ? '…' : actionLabel}
      </GhostButton>
    </HandCard>
  )
}

// StatsLines — the coverage tiles as plain text lines (§5, mobile): one line per
// group listing only the non-zero gaps, so "what still needs work" reads at a
// glance without the tap-to-filter tiles the mobile screen has no lists to feed.
function StatsLines({ stats }) {
  const line = (label, entries) => {
    const parts = entries.filter(([, n]) => n > 0).map(([l, n]) => `${n} ${l}`)
    return (
      <p className="microcopy" style={{ color: 'var(--soft)' }}>
        <b style={{ color: 'var(--ink)' }}>{label}</b> — {parts.length ? parts.join(' · ') : 'all complete ✓'}
      </p>
    )
  }
  const b = stats.books
  const m = stats.movies
  return (
    <div className="space-y-1.5 pt-1">
      <MonoLabel className="block">Coverage</MonoLabel>
      {line(`Books (${b.total})`, [['no cover', b.no_cover], ['low-res', b.low_res], ['no author', b.no_author], ['no series', b.no_series], ['no year', b.no_year], ['no genre', b.no_genre], ['no source', b.no_source]])}
      {line(`Films & shows (${m.total})`, [['no poster', m.no_poster], ['low-res', m.low_res], ['no cast', m.no_cast], ['no director', m.no_director], ['no year', m.no_year], ['no genre', m.no_genre], ['no source', m.no_source]])}
      {line(`Dialogues (${stats.dialogues.total})`, [['no actor', stats.dialogues.missing_actor]])}
    </div>
  )
}

const H2 = { fontFamily: 'var(--font-ui)', fontSize: 16.5, fontWeight: 600 }

// Stat is a coverage tile. When onClick is set it's a filter button: clicking a
// "missing X" tile filters the console below to exactly those rows.
function Stat({ n, label, warn, onClick }) {
  const bad = warn && n > 0
  const clickable = !!onClick && (n > 0 || !warn)
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={clickable ? `Filter below to ${label}` : undefined}
      style={{
        textAlign: 'left',
        background: 'var(--raised)',
        border: `1px solid ${bad ? 'color-mix(in srgb, var(--error) 40%, var(--line))' : 'var(--line)'}`,
        borderRadius: 9,
        padding: '8px 13px',
        minWidth: 74,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, lineHeight: 1, color: bad ? 'var(--error)' : 'var(--ink)' }}>
        {n}
      </div>
      <div className="mono-label" style={{ marginTop: 4, color: bad ? 'var(--error)' : undefined }}>
        {label}
      </div>
    </button>
  )
}

function StatsStrip({ stats, onPick }) {
  const group = (label, tiles) => (
    <div>
      <MonoLabel className="mb-2 block">{label}</MonoLabel>
      <div className="flex flex-wrap gap-2">{tiles}</div>
    </div>
  )
  const b = stats.books
  const m = stats.movies
  return (
    <HandCard className="p-5">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {group('Books', [
          <Stat key="t" n={b.total} label="total" onClick={() => onPick('book', 'all')} />,
          <Stat key="c" n={b.no_cover} label="no cover" warn onClick={() => onPick('book', 'no_cover')} />,
          <Stat key="lr" n={b.low_res} label="low-res" warn onClick={() => onPick('book', 'low_res')} />,
          <Stat key="au" n={b.no_author} label="no author" warn onClick={() => onPick('book', 'no_author')} />,
          <Stat key="se" n={b.no_series} label="no series" warn onClick={() => onPick('book', 'no_series')} />,
          <Stat key="y" n={b.no_year} label="no year" warn onClick={() => onPick('book', 'no_year')} />,
          <Stat key="g" n={b.no_genre} label="no genre" warn onClick={() => onPick('book', 'no_genre')} />,
          <Stat key="s" n={b.no_source} label="no source" warn onClick={() => onPick('book', 'no_source')} />,
        ])}
        {group('Films & shows', [
          <Stat key="t" n={m.total} label="total" onClick={() => onPick('movie', 'all')} />,
          <Stat key="p" n={m.no_poster} label="no poster" warn onClick={() => onPick('movie', 'no_poster')} />,
          <Stat key="lr" n={m.low_res} label="low-res" warn onClick={() => onPick('movie', 'low_res')} />,
          <Stat key="c" n={m.no_cast} label="no cast" warn onClick={() => onPick('movie', 'no_cast')} />,
          <Stat key="d" n={m.no_director} label="no director" warn onClick={() => onPick('movie', 'no_director')} />,
          <Stat key="y" n={m.no_year} label="no year" warn onClick={() => onPick('movie', 'no_year')} />,
          <Stat key="g" n={m.no_genre} label="no genre" warn onClick={() => onPick('movie', 'no_genre')} />,
          <Stat key="s" n={m.no_source} label="no source" warn onClick={() => onPick('movie', 'no_source')} />,
        ])}
        {group('Dialogues', [
          <Stat key="t" n={stats.dialogues.total} label="total" />,
          <Stat key="a" n={stats.dialogues.missing_actor} label="no actor" warn />,
        ])}
      </div>
    </HandCard>
  )
}

function GapChips({ gaps }) {
  if (gaps.length === 0) return <span className="microcopy" style={{ color: 'var(--accent-ui)' }}>complete ✓</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {gaps.map((g) => (
        <span
          key={g}
          className="tp-chip"
          style={{ color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 40%, var(--line))' }}
        >
          {g}
        </span>
      ))}
    </span>
  )
}

// runPooled runs fn over items with a small concurrency cap (SQLite is a single
// writer), each call caught so one failure can't reject the batch. Returns the
// results in order ({ok:false} for a thrown request).
async function runPooled(items, limit, fn) {
  const out = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx]).catch(() => ({ ok: false }))
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function BulkBar({ n, onClear, children }) {
  if (n === 0) return null
  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2"
      style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--line))', borderRadius: 9 }}
    >
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>{n} selected</MonoLabel>
      {children}
      <GhostButton className="ml-auto" onClick={onClear}>
        Clear
      </GhostButton>
    </div>
  )
}


// ---- catalogue console (books + films + shows, merged) ----

// The type selector drives which filters the second dropdown offers. "all types"
// gets the filters common to books and films; a specific type gets that kind's
// full set. Keep the shared keys (flagged/low_res/no_year/no_genre/no_source)
// spelled the same across both so an "all types" filter applies to either kind.
const CATALOGUE_TYPES = [
  ['all', 'all types'],
  ['book', 'books'],
  ['movie', 'films'],
  ['show', 'shows'],
]
const BOOK_FILTERS = [
  ['flagged', 'flagged'], ['no_cover', 'no cover'], ['low_res', 'low-res'],
  ['no_author', 'no author'], ['no_series', 'no series'], ['no_year', 'no year'],
  ['no_genre', 'no genre'], ['no_source', 'no source'], ['all', 'all'],
]
const MOVIE_FILTERS = [
  ['flagged', 'flagged'], ['no_poster', 'no poster'], ['low_res', 'low-res'],
  ['no_cast', 'no cast'], ['no_director', 'no director'], ['no_year', 'no year'],
  ['no_genre', 'no genre'], ['no_source', 'no source'], ['all', 'all'],
]
const ALL_FILTERS = [
  ['flagged', 'flagged'], ['low_res', 'low-res'], ['no_year', 'no year'],
  ['no_genre', 'no genre'], ['no_source', 'no source'], ['all', 'all'],
]
function filtersForType(type) {
  if (type === 'book') return BOOK_FILTERS
  if (type === 'movie' || type === 'show') return MOVIE_FILTERS
  return ALL_FILTERS
}
const catKey = (kind, id) => `${kind}:${id}`
function bookPasses(b, filter) {
  const p = {
    flagged: (b) => !b.has_cover || !b.has_ids, no_cover: (b) => !b.has_cover,
    low_res: (b) => b.low_res_cover, no_author: (b) => !b.has_author,
    no_series: (b) => !b.has_series, no_year: (b) => !b.has_year,
    no_genre: (b) => !b.has_genre, no_source: (b) => !b.has_ids,
  }[filter]
  return p ? p(b) : true
}
function moviePasses(m, filter) {
  const p = {
    flagged: (m) => !m.has_poster || !m.has_cast || !m.has_source, no_poster: (m) => !m.has_poster,
    low_res: (m) => m.low_res_poster, no_cast: (m) => !m.has_cast,
    no_director: (m) => !m.has_director, no_year: (m) => !m.has_year,
    no_genre: (m) => !m.has_genre, no_source: (m) => !m.has_source,
  }[filter]
  return p ? p(m) : true
}

// CatalogueConsole — one section (styled like the People console: no card,
// its own scroll box) listing books, films and shows together. The first
// dropdown picks the type and reshapes the second (filter) dropdown; rows render
// as BookRow / MovieRow by kind, and the bulk bar splits the (kind-namespaced)
// selection back into per-kind actions.
function CatalogueConsole({ books, movies, type, setType, filter, setFilter, onOpenBook, onOpenMovie, onDone, onFlash, onReverify }) {
  const [q, setQ] = useState('')
  const [lookupKey, setLookupKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false) // book bulk-edit form open
  const [sel, setSel] = useState(() => new Set()) // "book:id" / "movie:id" keys

  // Guard against a filter that isn't valid for the current type (e.g. after a
  // type switch) so the <select> and predicates always agree.
  const filterOpts = filtersForType(type)
  const filterVal = filterOpts.some(([v]) => v === filter) ? filter : 'flagged'

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    const out = []
    if (type === 'all' || type === 'book') {
      for (const b of books) {
        if (!bookPasses(b, filterVal)) continue
        if (s && !(b.title.toLowerCase().includes(s) || (b.author || '').toLowerCase().includes(s))) continue
        out.push({ kind: 'book', item: b })
      }
    }
    if (type === 'all' || type === 'movie' || type === 'show') {
      for (const m of movies) {
        const mt = m.media_type || 'movie'
        if (type === 'movie' && mt !== 'movie') continue
        if (type === 'show' && mt !== 'show') continue
        if (!moviePasses(m, filterVal)) continue
        if (s && !m.title.toLowerCase().includes(s)) continue
        out.push({ kind: 'movie', item: m })
      }
    }
    return out
  }, [books, movies, type, filterVal, q])

  const keys = shown.map((x) => catKey(x.kind, x.item.id))
  const selectedKeys = keys.filter((k) => sel.has(k))
  const selBookIds = selectedKeys.filter((k) => k.startsWith('book:')).map((k) => Number(k.slice(5)))
  const selMovieIds = selectedKeys.filter((k) => k.startsWith('movie:')).map((k) => Number(k.slice(6)))
  const selMoviesWithCast = shown.filter((x) => x.kind === 'movie' && sel.has(catKey('movie', x.item.id)) && x.item.has_cast).length
  const allChecked = keys.length > 0 && keys.every((k) => sel.has(k))

  useEffect(() => {
    setSel((s) => new Set([...s].filter((k) => keys.includes(k))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, filterVal, q])

  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const clearSel = () => setSel(new Set())

  async function del() {
    const total = selectedKeys.length
    if (!confirm(`Delete ${total} item(s) and all their quotes/dialogues?`)) return
    setBusy(true)
    setErr('')
    try {
      const rs = await runPooled(selectedKeys, 4, (k) => {
        const [kind, id] = k.split(':')
        return json('DELETE', `/${kind === 'book' ? 'books' : 'movies'}/${id}`)
      })
      const fail = rs.filter((r) => !r.ok).length
      onFlash(`deleted ${total - fail} item(s)${fail ? `, ${fail} failed` : ''}`)
    } finally {
      setBusy(false)
      clearSel()
      onDone()
    }
  }

  // bulkEdit is books-only (POST /books/bulk); the button only shows when books
  // are in the selection.
  async function bulkEdit(fields) {
    setBusy(true)
    setErr('')
    const r = await json('POST', '/books/bulk', { ids: selBookIds, ...fields })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'bulk edit failed'))
    onFlash(`updated ${r.data.updated} book(s)`)
    setEditing(false)
    clearSel()
    onDone()
  }

  async function fillActors() {
    setBusy(true)
    setErr('')
    try {
      const rs = await runPooled(selMovieIds, 4, (id) => json('POST', `/movies/${id}/remap-speakers`, { mappings: [], refill: true }))
      const filled = rs.reduce((n, r) => n + (r.ok ? r.data.refilled || 0 : 0), 0)
      const fail = rs.filter((r) => !r.ok).length
      onFlash(`filled ${filled} actor(s) across ${selMovieIds.length} title(s)${fail ? `, ${fail} failed` : ''}`)
    } finally {
      setBusy(false)
      clearSel()
      onDone()
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={H2}>Catalogue</h2>
        <MonoLabel>{shown.length} shown</MonoLabel>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="tp-input w-auto" title="Type" value={type} onChange={(e) => { setType(e.target.value); setFilter('flagged') }}>
            {CATALOGUE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="tp-input w-auto" title="Filter" value={filterVal} onChange={(e) => setFilter(e.target.value)}>
            {filterOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="tp-input w-auto" placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="microcopy">nothing matches.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 microcopy" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(keys))} /> select all shown
            </label>
          </div>
          <BulkBar n={selectedKeys.length} onClear={clearSel}>
            {selBookIds.length > 0 && (
              <GhostButton disabled={busy} onClick={() => setEditing((v) => !v)}>
                {editing ? 'Close bulk edit' : 'Bulk edit books…'}
              </GhostButton>
            )}
            {selMovieIds.length > 0 && (
              <GhostButton
                disabled={busy || selMoviesWithCast === 0}
                title={selMoviesWithCast === 0 ? 'none of the selected titles have a cast to fill from' : undefined}
                onClick={fillActors}
              >
                Fill actors from cast
              </GhostButton>
            )}
            <GhostButton disabled={busy} onClick={() => onReverify({ book_ids: selBookIds, movie_ids: selMovieIds })}>
              Re-verify…
            </GhostButton>
            <GhostButton disabled={busy} style={{ color: 'var(--error)' }} onClick={del}>
              Delete
            </GhostButton>
          </BulkBar>
          {editing && selBookIds.length > 0 && <BulkEditForm n={selBookIds.length} busy={busy} onApply={bulkEdit} />}
          <ErrorText>{err}</ErrorText>
          <div className="ann-table-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
            {shown.map((x) =>
              x.kind === 'book' ? (
                <BookRow
                  key={catKey('book', x.item.id)}
                  book={x.item}
                  checked={sel.has(catKey('book', x.item.id))}
                  onCheck={() => toggle(catKey('book', x.item.id))}
                  open={lookupKey === catKey('book', x.item.id)}
                  onToggleLookup={() => setLookupKey((k) => (k === catKey('book', x.item.id) ? null : catKey('book', x.item.id)))}
                  onOpen={onOpenBook}
                  onDone={() => { setLookupKey(null); onDone() }}
                />
              ) : (
                <MovieRow
                  key={catKey('movie', x.item.id)}
                  movie={x.item}
                  checked={sel.has(catKey('movie', x.item.id))}
                  onCheck={() => toggle(catKey('movie', x.item.id))}
                  open={lookupKey === catKey('movie', x.item.id)}
                  onToggleLookup={() => setLookupKey((k) => (k === catKey('movie', x.item.id) ? null : catKey('movie', x.item.id)))}
                  onOpen={onOpenMovie}
                  onDone={() => { setLookupKey(null); onDone() }}
                />
              ),
            )}
          </div>
        </>
      )}
    </section>
  )
}

// InlineEdit fetches a book/movie detail and renders its full editor inline in a
// console row, so metadata can be corrected without leaving the page. kind is
// "books" | "movies".
function InlineEdit({ kind, id, onDone, onCancel }) {
  const [row, setRow] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    json('GET', `/${kind}/${id}`).then((r) => (r.ok ? setRow(r.data) : setErr(errText(r))))
  }, [kind, id])
  if (err) return <ErrorText>{err}</ErrorText>
  if (!row) return <p className="microcopy mt-3">loading…</p>
  return (
    <div className="mt-3">
      {kind === 'books'
        ? <EditBook book={row} onSaved={onDone} onCancel={onCancel} />
        : <EditMovie movie={row} onSaved={onDone} onCancel={onCancel} />}
    </div>
  )
}

function BookRow({ book, checked, onCheck, open, onToggleLookup, onOpen, onDone }) {
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const gaps = [
    !book.has_cover && 'no cover',
    book.low_res_cover && 'low-res cover',
    !book.has_author && 'no author',
    !book.has_series && 'no series',
    !book.has_year && 'no year',
    !book.has_genre && 'no genre',
    !book.has_ids && 'no source',
  ].filter(Boolean)

  async function apply(c) {
    setErr('')
    const cur = await json('GET', `/books/${book.id}`)
    if (!cur.ok) return setErr(errText(cur))
    const b = cur.data
    // Base metadata (incl. source link so the "no source" gap clears). No cover
    // here — a flaky candidate cover URL must not discard the metadata merge.
    const base = {
      title: c.title || b.title,
      author: c.author || b.author || '',
      isbn: c.isbn13 || b.isbn || '',
      asin: b.asin || '',
      description: c.description || b.description || '',
      published_year: c.published_year || b.published_year || 0,
      // take genres/series from the candidate when it has them (the whole point
      // of applying a match), else keep the book's existing values
      genres: (c.genres && c.genres.length ? c.genres : b.genres) || [],
      series: c.series || b.series || '',
      series_index: c.series_index || b.series_index || 0,
      favorite: !!b.favorite,
      rating: b.rating || 0,
      source: c.source || undefined,
      source_id: c.source_id || undefined,
    }
    const r = await json('PUT', `/books/${book.id}`, base)
    if (!r.ok) return setErr(errText(r))
    // Cover as a separate PUT: if it fails, the metadata above is already saved.
    if (c.cover_url) await json('PUT', `/books/${book.id}`, { ...base, cover_url: c.cover_url })
    onDone()
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="flex flex-wrap items-center gap-3">
        <input type="checkbox" checked={checked} onChange={onCheck} />
        <div className="min-w-0 flex-1">
          <p className="truncate">
            <b>{book.title}</b>
            {book.author && <span style={{ color: 'var(--soft)' }}> · {book.author}</span>}
            <span className="microcopy"> · {book.annotation_count} quotes</span>
          </p>
          <GapChips gaps={gaps} />
        </div>
        <GhostButton onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</GhostButton>
        <GhostButton onClick={onToggleLookup}>{open ? 'Close' : 'Look up'}</GhostButton>
        {onOpen && <GhostButton onClick={() => onOpen(book.id)}>Open</GhostButton>}
      </div>
      {editing && <InlineEdit kind="books" id={book.id} onDone={() => { setEditing(false); onDone() }} onCancel={() => setEditing(false)} />}
      {open && (
        <div className="mt-3">
          <BookLookupPicker title={book.title} isbn={book.isbn} asin={book.asin} onPick={apply} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </div>
  )
}

function MovieRow({ movie, checked, onCheck, open, onToggleLookup, onOpen, onDone }) {
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(false)
  const gaps = [!movie.has_poster && 'no poster', movie.low_res_poster && 'low-res poster', !movie.has_cast && 'no cast', !movie.has_source && 'no source'].filter(Boolean)

  async function resync(c) {
    setErr('')
    const r = await json('PUT', `/movies/${movie.id}`, {
      source: c.source || 'tmdb',
      source_id: c.source === 'tvdb' ? c.source_id : String(c.tmdb_id || c.source_id),
      media_type: c.media_type || movie.media_type || 'movie',
    })
    if (r.ok) onDone()
    else setErr(errText(r))
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="flex flex-wrap items-center gap-3">
        <input type="checkbox" checked={checked} onChange={onCheck} />
        <div className="min-w-0 flex-1">
          <p className="truncate">
            <b>{movie.title}</b>
            {movie.release_year ? <span style={{ color: 'var(--soft)' }}> · {movie.release_year}</span> : null}
            {movie.dialogue_count > 0 && <span className="microcopy"> · {movie.dialogue_count} dialogues</span>}
          </p>
          <GapChips gaps={gaps} />
        </div>
        <GhostButton onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</GhostButton>
        <GhostButton onClick={onToggleLookup}>{open ? 'Close' : 'Look up'}</GhostButton>
        {onOpen && <GhostButton onClick={() => onOpen(movie.id)}>Open</GhostButton>}
      </div>
      {editing && <InlineEdit kind="movies" id={movie.id} onDone={() => { setEditing(false); onDone() }} onCancel={() => setEditing(false)} />}
      {open && (
        <div className="mt-3">
          <MovieLookupPicker title={movie.title} year={movie.release_year} mediaType={movie.media_type || 'movie'} onPick={resync} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </div>
  )
}

// BulkEditForm applies a correction to the whole selection at once (the "select
// the wrong ones, replace with the right value" flow). Only the fields you fill
// are sent — an empty field is left untouched (an empty author/series clears it,
// which is why those are opt-in checkboxes, not blank = clear).
function BulkEditForm({ n, busy, onApply }) {
  const [setAuthor, setSetAuthor] = useState(false)
  const [author, setAuthor2] = useState('')
  const [setSeries, setSetSeries] = useState(false)
  const [series, setSeries2] = useState('')
  const [seriesIndex, setSeriesIndex] = useState('')
  const [addGenres, setAddGenres] = useState('')

  function apply() {
    const fields = {}
    if (setAuthor) fields.author = author.trim()
    if (setSeries) {
      fields.series = series.trim()
      if (seriesIndex.trim()) fields.series_index = Number(seriesIndex) || 0
    }
    const genres = splitCommas(addGenres)
    if (genres.length) fields.add_genres = genres
    if (Object.keys(fields).length === 0) return
    onApply(fields)
  }

  return (
    <div className="space-y-2.5 rounded-xl p-3" style={{ border: '1px solid var(--line)', background: 'var(--raised)' }}>
      <MonoLabel className="block">Bulk edit {n} selected</MonoLabel>
      <label className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={setAuthor} onChange={(e) => setSetAuthor(e.target.checked)} />
        <span className="microcopy" style={{ minWidth: 54 }}>author</span>
        <input className="tp-input w-auto flex-1" placeholder="set author (blank = clear)" value={author} disabled={!setAuthor} onChange={(e) => setAuthor2(e.target.value)} />
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={setSeries} onChange={(e) => setSetSeries(e.target.checked)} />
        <span className="microcopy" style={{ minWidth: 54 }}>series</span>
        <input className="tp-input w-auto flex-1" placeholder="set series (blank = clear)" value={series} disabled={!setSeries} onChange={(e) => setSeries2(e.target.value)} />
        <input className="tp-input w-16 shrink-0" placeholder="#" inputMode="decimal" value={seriesIndex} disabled={!setSeries} onChange={(e) => setSeriesIndex(e.target.value)} />
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span className="microcopy" style={{ minWidth: 72, marginLeft: 22 }}>add genres</span>
        <input className="tp-input w-auto flex-1" placeholder="comma-separated — added, not replaced" value={addGenres} onChange={(e) => setAddGenres(e.target.value)} />
      </label>
      <button className="tp-btn tp-btn-primary" disabled={busy} onClick={apply}>
        Apply to {n}
      </button>
    </div>
  )
}

// ---- duplicate detection + merge ----

// DuplicatesPanel loads fuzzy-title duplicate groups and lets you merge each
// group into a chosen keeper (annotations move over, dupes drop, sources delete).
function DuplicatesPanel({ onDone, onFlash }) {
  const [groups, setGroups] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)

  async function scan() {
    setBusy(true)
    setErr('')
    const r = await json('GET', '/metadata/duplicates')
    setBusy(false)
    setOpen(true)
    if (r.ok) setGroups(r.data.groups)
    else setErr(errText(r, 'could not scan for duplicates'))
  }

  async function merge(into, from) {
    if (!confirm(`Merge ${from.length} book(s) into the keeper? Their annotations move over; the others are deleted.`)) return
    setBusy(true)
    setErr('')
    const r = await json('POST', '/books/merge', { into, from })
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'merge failed'))
    onFlash(`merged ${r.data.merged} book(s)`)
    scan()
    onDone()
  }

  return (
    <HandCard className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={H2}>Duplicate books</h2>
        {groups && <MonoLabel>{groups.length} group{groups.length === 1 ? '' : 's'}</MonoLabel>}
        <GhostButton className="ml-auto" disabled={busy} onClick={scan}>
          {busy ? 'Scanning…' : open ? 'Rescan' : 'Scan for duplicates'}
        </GhostButton>
      </div>
      <ErrorText>{err}</ErrorText>
      {open && groups && groups.length === 0 && <p className="microcopy">no duplicate titles found ✓</p>}
      {groups && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((g, i) => (
            <DuplicateGroup key={i} group={g} busy={busy} onMerge={merge} />
          ))}
        </div>
      )}
    </HandCard>
  )
}

function DuplicateGroup({ group, busy, onMerge }) {
  // Default keeper = the copy with the most annotations (least to lose).
  const [keep, setKeep] = useState(() => group.reduce((a, b) => (b.annotation_count > a.annotation_count ? b : a), group[0]).id)
  return (
    <div className="rounded-xl p-3" style={{ border: '1px solid var(--line)' }}>
      <div className="space-y-1.5">
        {group.map((b) => (
          <label key={b.id} className="flex flex-wrap items-center gap-2">
            <input type="radio" name={`keep-${group[0].id}`} checked={keep === b.id} onChange={() => setKeep(b.id)} />
            <span className="min-w-0 flex-1 truncate text-sm">
              <b>{b.title}</b>
              {b.author && <span style={{ color: 'var(--soft)' }}> · {b.author}</span>}
              {b.year ? <span className="microcopy"> · {b.year}</span> : null}
              <span className="microcopy"> · {b.annotation_count} quotes</span>
            </span>
            {keep === b.id && <span className="tp-chip shrink-0" style={{ color: 'var(--accent-ui)' }}>keep</span>}
          </label>
        ))}
      </div>
      <div className="mt-2">
        <GhostButton
          disabled={busy}
          onClick={() => onMerge(keep, group.filter((b) => b.id !== keep).map((b) => b.id))}
        >
          Merge into keeper
        </GhostButton>
      </div>
    </div>
  )
}

// ---- per-title speaker remap ----

function SpeakerRemap({ movies, onDone }) {
  const [movieId, setMovieId] = useState('')
  const [cast, setCast] = useState([])
  const [labels, setLabels] = useState([])
  const [maps, setMaps] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function loadMovie(id) {
    setErr('')
    setMsg('')
    setMaps({})
    if (!id) {
      setCast([])
      setLabels([])
      return
    }
    const [mr, dr] = await Promise.all([json('GET', `/movies/${id}`), json('GET', `/dialogues?movie_id=${id}`)])
    setCast((mr.ok && mr.data.cast) || [])
    if (dr.ok) {
      const counts = {}
      for (const d of dr.data.dialogues) {
        const k = (d.character || '').trim()
        if (k) counts[k] = (counts[k] || 0) + 1
      }
      setLabels(
        Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      )
    }
  }
  useEffect(() => {
    loadMovie(movieId)
  }, [movieId])

  async function apply(refill = false) {
    setBusy(true)
    setErr('')
    setMsg('')
    const mappings = Object.entries(maps)
      .filter(([, v]) => v)
      .map(([from, v]) => ({ from, character: v.character, actor: v.actor || '' }))
    if (!refill && mappings.length === 0) {
      setBusy(false)
      return setErr('Choose at least one mapping, or use “Fill actors from cast”.')
    }
    const r = await json('POST', `/movies/${movieId}/remap-speakers`, { mappings, refill })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    setMsg(`${r.data.remapped} remapped${r.data.refilled ? `, ${r.data.refilled} actor(s) filled` : ''}`)
    loadMovie(movieId)
    onDone()
  }

  return (
    <HandCard className="space-y-3 p-5">
      <h2 style={H2}>Speaker &amp; character remap</h2>
      <p className="microcopy">
        Reconcile imported speaker labels with a title’s cast, then fill the actors. Pick a title with dialogues:
      </p>
      <select className="tp-input w-auto" value={movieId} onChange={(e) => setMovieId(e.target.value)}>
        <option value="">— choose a title —</option>
        {movies.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
            {m.release_year ? ` (${m.release_year})` : ''} · {m.dialogue_count} dialogues
          </option>
        ))}
      </select>

      {movieId && cast.length === 0 && (
        <p className="microcopy" style={{ color: 'var(--amber, var(--accent-ui))' }}>
          ⚠ This title has no cast yet — look it up above first, then come back to remap.
        </p>
      )}
      {movieId && labels.length === 0 && <p className="microcopy">No speaker labels on this title’s dialogues.</p>}
      {movieId && labels.length > 0 && (
        <>
          <MonoLabel className="block">Speaker labels → cast</MonoLabel>
          <div>
            {labels.map((l) => (
              <RemapRow key={l.name} label={l} cast={cast} value={maps[l.name]} onChange={(v) => setMaps((m) => ({ ...m, [l.name]: v }))} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="tp-btn tp-btn-primary" disabled={busy} onClick={() => apply(false)}>
              Apply remap
            </button>
            <GhostButton disabled={busy} onClick={() => apply(true)}>
              Fill actors from cast
            </GhostButton>
            {msg && (
              <span className="microcopy" style={{ color: 'var(--accent-ui)' }}>
                {msg}
              </span>
            )}
          </div>
          <ErrorText>{err}</ErrorText>
        </>
      )}
    </HandCard>
  )
}

function RemapRow({ label, cast, value, onChange }) {
  const idx = value && !value.custom ? cast.findIndex((c) => c.character === value.character && c.actor === value.actor) : -1
  const sel = value?.custom ? 'custom' : idx >= 0 ? `cast:${idx}` : ''
  return (
    <div className="flex flex-wrap items-center gap-2 py-2" style={{ borderTop: '1px solid var(--line)' }}>
      <span className="min-w-0 flex-1 truncate">
        <span style={{ fontWeight: 600 }}>{label.name}</span>
        <span className="microcopy"> · {label.count}</span>
      </span>
      <span className="microcopy">→</span>
      <select
        className="tp-input w-auto"
        value={sel}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange(undefined)
          else if (v === 'custom') onChange({ character: label.name, actor: '', custom: true })
          else {
            const i = Number(v.slice(5))
            onChange({ character: cast[i].character, actor: cast[i].actor })
          }
        }}
      >
        <option value="">keep as-is</option>
        {cast.map((c, i) => (
          <option key={i} value={`cast:${i}`}>
            {c.character || '(no character)'}
            {c.actor ? ` — ${c.actor}` : ''}
          </option>
        ))}
        <option value="custom">custom…</option>
      </select>
      {value?.custom && (
        <>
          <input
            className="tp-input w-auto"
            style={{ maxWidth: 150 }}
            placeholder="Character"
            value={value.character}
            onChange={(e) => onChange({ ...value, character: e.target.value })}
          />
          <input
            className="tp-input w-auto"
            style={{ maxWidth: 150 }}
            placeholder="Actor"
            value={value.actor}
            onChange={(e) => onChange({ ...value, actor: e.target.value })}
          />
        </>
      )}
    </div>
  )
}

// ---- people console ----

// editDistance is Levenshtein (iterative, one row of state) — used to spot
// author/actor names that are one or two edits apart (typos, transliterations).
function editDistance(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1])
      prev = tmp
    }
  }
  return dp[m]
}

// normName folds a name for fuzzy comparison: lowercased, diacritics stripped,
// punctuation collapsed to spaces. "Fyodor Dostoyevsky" and "Fyodor Dostoevsky"
// stay one edit apart; "J.R.R. Tolkien" and "JRR Tolkien" normalise equal.
function normName(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// nearDupGroups clusters names that look like the same person: equal once
// normalised, or within a small edit distance (capped as a fraction of length so
// short distinct names — "Poe" vs "Roe" — aren't flagged). Returns groups of 2+.
function nearDupGroups(names) {
  const norm = names.map(normName)
  const parent = names.map((_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = norm[i], b = norm[j]
      if (!a || !b) continue
      const same = a === b || (() => { const d = editDistance(a, b); return d > 0 && d <= 2 && d / Math.max(a.length, b.length) <= 0.25 })()
      if (same) parent[find(i)] = find(j)
    }
  }
  const groups = {}
  names.forEach((n, i) => { const r = find(i); (groups[r] = groups[r] || []).push(n) })
  return Object.values(groups).filter((g) => g.length >= 2)
}

// DupCard offers to merge one near-duplicate cluster: pick the spelling to keep,
// and every other name in the group is renamed to it across the whole library
// (POST /people/rename), folding their saved metadata in.
function DupCard({ group, kind, rowsByName, onMerged }) {
  const def = [...group].sort((a, b) =>
    (rowsByName[b]?.has_image ? 1 : 0) - (rowsByName[a]?.has_image ? 1 : 0) || b.length - a.length)[0]
  const [keep, setKeep] = useState(def)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function merge() {
    setBusy(true)
    setErr('')
    for (const n of group) {
      if (n === keep) continue
      const r = await json('POST', '/people/rename', { kind, from: n, to: keep })
      if (!r.ok) { setBusy(false); return setErr(errText(r, 'merge failed')) }
    }
    setBusy(false)
    onMerged()
  }

  return (
    <HandCard variant={2} style={{ padding: '12px 14px' }}>
      <MonoLabel>Possible duplicate — keep which spelling?</MonoLabel>
      <div className="mt-1.5 flex flex-col gap-1">
        {group.map((n) => (
          <label key={n} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input type="radio" name={`dup-${kind}-${group.join('|')}`} checked={keep === n} onChange={() => setKeep(n)} />
            <span>{n}</span>
            {rowsByName[n]?.has_image && <span className="mono-label" style={{ color: 'var(--soft)' }}>· photo</span>}
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <GhostButton type="button" disabled={busy} onClick={merge}>
          {busy ? 'Merging…' : `Merge into “${keep}”`}
        </GhostButton>
        <ErrorText>{err}</ErrorText>
      </div>
    </HandCard>
  )
}

// PeopleConsole — every author/actor referenced in the library, with their
// external reference pages (IMDb · TMDB · TheTVDB · Wikipedia · Open Library).
// This metadata backs the person popup that opens when a name is clicked
// anywhere in the app — including right here (each row's name opens it).
// Links are fetched per row or in bulk for the ones still missing; rows stay
// listed even when no longer referenced so stale metadata remains manageable.
export function PeopleConsole({ onFlash, compact = false, onReverify, onSearch }) {
  const [kind, setKind] = useState('author')
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [busyName, setBusyName] = useState('')
  const [bulk, setBulk] = useState(null) // {done, total} while bulk-fetching
  const [err, setErr] = useState('')
  // {kind, name} captured at click time, so flipping the Authors/Actors toggle
  // while the modal is open can't re-key it.
  const [person, setPerson] = useState(null)

  async function load(k = kind) {
    const r = await json('GET', `/people/names?kind=${k}`)
    if (r.ok) setRows(r.data.people)
    else setErr(errText(r))
  }
  useEffect(() => {
    setRows(null)
    setErr('')
    load(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows || []).filter((p) => !s || p.name.toLowerCase().includes(s))
  }, [rows, q])
  // A row still needs work if it has no provider links OR no stored photo.
  const noLinks = (p) => Object.keys(parseLinks(p.links).known).length === 0
  const missing = shown.filter((p) => noLinks(p) || !p.has_image)
  // Near-duplicate clusters (typos / transliterations of one person) to offer a
  // one-click merge — computed over the full list, not the search filter.
  const dupGroups = useMemo(() => nearDupGroups((rows || []).map((p) => p.name)), [rows])
  const rowsByName = useMemo(() => Object.fromEntries((rows || []).map((p) => [p.name, p])), [rows])

  // fetchOne resolves the RIGHT person (book/credits disambiguation), fetches
  // their portrait and pins the identity via POST /people/portrait, then merges
  // the identity-resolved links into the row (bio/born untouched). Returns an
  // error string or null, like the form handlers do. This is what makes the
  // console pick the correct namesake — the old /people/lookup ranked by work
  // count and grabbed the wrong "David Reich".
  async function fetchOne(p) {
    const r = await json('POST', '/people/portrait', { kind, name: p.name })
    if (!r.ok) return errText(r)
    const cur = r.data.person && r.data.person.id ? r.data.person : null
    // Prefer the links the portrait resolved from the same identity; fall back to
    // a plain lookup (e.g. actors, or an author with no confident match).
    let linksMap = r.data.links && Object.keys(r.data.links).length ? r.data.links : null
    if (!linksMap) {
      const l = await json('POST', '/people/lookup', { kind, name: p.name })
      if (l.ok) linksMap = l.data.links
    }
    const merged = mergeLinks(cur?.links ?? p.links, linksMap)
    // The portrait may have stored an image even when there are no links — only
    // the link save is conditional; a clean run still counts as success.
    if (merged && merged !== (cur?.links ?? p.links ?? '')) {
      const s = await json('PUT', '/people', {
        kind,
        name: p.name,
        bio: cur?.bio || '',
        born: cur?.born || '',
        links: merged,
        source: cur?.source || 'portrait',
        source_id: cur?.source_id || '',
      })
      if (!s.ok) return errText(s)
    }
    return null
  }

  async function fetchRow(p) {
    setBusyName(p.name)
    setErr('')
    const e = await fetchOne(p)
    setBusyName('')
    if (e) setErr(`${p.name}: ${e}`)
    load()
  }

  async function fetchMissing() {
    setErr('')
    setBulk({ done: 0, total: missing.length })
    let done = 0
    let failed = 0
    let firstErr = ''
    await runPooled(missing, 2, async (p) => {
      const e = await fetchOne(p)
      if (e) {
        failed++
        if (!firstErr) firstErr = e
      }
      done++
      setBulk({ done, total: missing.length })
    })
    setBulk(null)
    onFlash(`people: ${missing.length - failed} fetched · ${failed} failed${firstErr ? ` (${firstErr})` : ''}`)
    load()
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 style={H2}>People</h2>
        {/* §4: the verbose "what this fetches" copy now lives in a tooltip. */}
        <InfoDot text="Photos + reference pages (IMDb · TMDB · TheTVDB · Wikipedia · Open Library), matched to the right person — an author by the books they wrote, an actor from the film's cast. Actor photos and links need a TMDB key (Settings); author photos are keyless." />
        {!compact && <MonoLabel>{shown.length} shown</MonoLabel>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {[['author', 'Authors'], ['actor', 'Actors']].map(([k, label]) => (
            <button key={k} className={'tp-filter-chip' + (kind === k ? ' active' : '')} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
          {!compact && <input className="tp-input w-auto" placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />}
          <GhostButton disabled={!!bulk || missing.length === 0} onClick={fetchMissing}>
            Fetch missing{missing.length > 0 ? ` (${missing.length})` : ''}
          </GhostButton>
          {!compact && onReverify && (
            <GhostButton
              disabled={!!bulk || !(rows || []).some((p) => p.saved)}
              title="Re-check every saved person's identity, links and portrait against the live sources — review before anything is applied"
              onClick={() => onReverify((rows || []).filter((p) => p.saved).map((p) => ({ kind, name: p.name })))}
            >
              Re-verify saved
            </GhostButton>
          )}
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      {bulk && <ProgressBar value={bulk.done} max={bulk.total} label={`fetching photos & links · ${bulk.done}/${bulk.total}`} />}
      {/* Mobile (§5): no browsable list — just how many still need work. */}
      {compact ? (
        <p className="microcopy" style={{ color: 'var(--soft)' }}>
          {!rows
            ? 'loading…'
            : `${missing.length} ${kind === 'author' ? 'author' : 'actor'}${missing.length === 1 ? '' : 's'} still need${missing.length === 1 ? 's' : ''} photos or links`}
        </p>
      ) : (
        <>
          {dupGroups.length > 0 && (
            <div className="space-y-2">
              <MonoLabel>Possible duplicates ({dupGroups.length})</MonoLabel>
              {dupGroups.map((g, i) => (
                <DupCard key={i} group={g} kind={kind} rowsByName={rowsByName} onMerged={() => load()} />
              ))}
            </div>
          )}
          {!rows ? (
            <EmptyState>loading…</EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState>{kind === 'author' ? 'no authors in the library yet' : 'no actors on any dialogue yet'}</EmptyState>
          ) : (
            <div className="ann-table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="ann-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>{kind === 'author' ? 'Books' : 'Titles'}</th>
                    <th>Links</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <PersonName kind={kind} name={p.name} onOpen={setPerson} />
                        {p.has_image && (
                          <span className="mono-label" style={{ marginLeft: 6, color: 'var(--soft)' }} title="photo saved">· photo</span>
                        )}
                      </td>
                      <td>
                        {/* Work count → search, which matches authors on book
                            hits and actors on dialogue hits. Saved-but-no-
                            longer-referenced rows count 0 — nothing to find. */}
                        {p.count > 0 ? (
                          <button
                            className="tp-link"
                            title={`search “${p.name}”`}
                            onClick={() => onSearch?.(p.name)}
                          >
                            {p.count}
                          </button>
                        ) : (
                          <span className="microcopy">0</span>
                        )}
                      </td>
                      <td><ProviderChips links={p.links} /></td>
                      <td className="col-actions">
                        <button className="tp-link" disabled={busyName === p.name || !!bulk} onClick={() => fetchRow(p)}>
                          {busyName === p.name ? 'fetching…' : (Object.keys(parseLinks(p.links).known).length > 0 || p.has_image) ? 'refetch' : 'fetch'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {/* onSaved must reload: a rename/delete/photo/link change from inside the
          modal changes this console's rows. */}
      {person && (
        <PersonModal
          kind={person.kind}
          name={person.name}
          onClose={() => setPerson(null)}
          onSaved={() => load()}
        />
      )}
    </section>
  )
}
