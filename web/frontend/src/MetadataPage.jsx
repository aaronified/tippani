import { useEffect, useMemo, useState } from 'react'
import { json, errText } from './api.js'
import { BookLookupPicker, MovieLookupPicker } from './CoverPicker.jsx'
import { EmptyState, ErrorText, GhostButton, HandCard, MonoLabel, PageHeader } from './ui.jsx'

// Metadata tab — a management console: coverage stats up top, then filterable
// books / films-shows lists with multi-select bulk actions (fill actors, delete,
// fetch missing covers) plus per-row review-each look-up, and a per-title speaker
// remap tool. The point of the tab is doing metadata at scale, not one at a time.
export default function MetadataPage({ user, onOpenBook, onOpenMovie }) {
  const [lib, setLib] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')

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
  async function fetchMissingCovers() {
    setBusy(true)
    setError('')
    const r = await json('POST', '/covers/refetch')
    setBusy(false)
    if (!r.ok) return setError(errText(r, 'could not re-fetch covers'))
    setFlash(`covers: ${r.data.fetched} fetched · ${r.data.enriched || 0} enriched · ${r.data.failed} failed`)
    load()
  }

  const stats = useMemo(() => {
    const b = lib?.books || []
    const m = lib?.movies || []
    const d = lib?.dialogue_stats || { total: 0, missing_actor: 0 }
    return {
      books: { total: b.length, noCover: b.filter((x) => !x.has_cover).length, noSource: b.filter((x) => !x.has_ids).length },
      movies: {
        total: m.length,
        noPoster: m.filter((x) => !x.has_poster).length,
        noCast: m.filter((x) => !x.has_cast).length,
        noSource: m.filter((x) => !x.has_source).length,
      },
      dialogues: d,
    }
  }, [lib])

  return (
    <section className="space-y-6">
      <PageHeader
        title="Metadata"
        counts="stats · filters · bulk actions"
        right={
          user?.is_admin && (
            <GhostButton
              disabled={busy}
              title="Admin maintenance: fetches missing covers/posters and backfills author/description/year/genres across all libraries on this instance (fill-empty, non-destructive)."
              onClick={fetchMissingCovers}
            >
              Fetch missing covers &amp; metadata
            </GhostButton>
          )
        }
      />
      <ErrorText>{error}</ErrorText>
      {flash && (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
          {flash}
        </p>
      )}
      {!lib ? (
        <EmptyState>loading…</EmptyState>
      ) : (
        <>
          <StatsStrip stats={stats} />
          <BooksConsole books={lib.books} onOpen={onOpenBook} onDone={load} onFlash={setFlash} />
          <MoviesConsole movies={lib.movies} onOpen={onOpenMovie} onDone={load} onFlash={setFlash} />
          <SpeakerRemap movies={lib.movies.filter((m) => m.dialogue_count > 0)} onDone={load} />
        </>
      )}
    </section>
  )
}

const H2 = { fontFamily: 'var(--font-ui)', fontSize: 16.5, fontWeight: 600 }

function Stat({ n, label, warn }) {
  const bad = warn && n > 0
  return (
    <div
      style={{
        background: 'var(--raised)',
        border: `1px solid ${bad ? 'color-mix(in srgb, var(--error) 40%, var(--line))' : 'var(--line)'}`,
        borderRadius: 9,
        padding: '8px 13px',
        minWidth: 74,
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, lineHeight: 1, color: bad ? 'var(--error)' : 'var(--ink)' }}>
        {n}
      </div>
      <div className="mono-label" style={{ marginTop: 4, color: bad ? 'var(--error)' : undefined }}>
        {label}
      </div>
    </div>
  )
}

function StatsStrip({ stats }) {
  const group = (label, tiles) => (
    <div>
      <MonoLabel className="mb-2 block">{label}</MonoLabel>
      <div className="flex flex-wrap gap-2">{tiles}</div>
    </div>
  )
  return (
    <HandCard className="p-5">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {group('Books', [
          <Stat key="t" n={stats.books.total} label="total" />,
          <Stat key="c" n={stats.books.noCover} label="no cover" warn />,
          <Stat key="s" n={stats.books.noSource} label="no source" warn />,
        ])}
        {group('Films & shows', [
          <Stat key="t" n={stats.movies.total} label="total" />,
          <Stat key="p" n={stats.movies.noPoster} label="no poster" warn />,
          <Stat key="c" n={stats.movies.noCast} label="no cast" warn />,
          <Stat key="s" n={stats.movies.noSource} label="no source" warn />,
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

// useSelection — a Set of ids; pruned to what's shown when filters change so the
// visible checkbox state and the stored selection never diverge.
function useSelection() {
  const [sel, setSel] = useState(() => new Set())
  return {
    sel,
    has: (id) => sel.has(id),
    toggle: (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }),
    setAll: (ids, on) => setSel(() => (on ? new Set(ids) : new Set())),
    prune: (ids) => setSel((s) => new Set([...s].filter((id) => ids.includes(id)))),
    clear: () => setSel(new Set()),
  }
}

function Toolbar({ shownCount, filter, setFilter, filterOptions, mediaType, setMediaType, q, setQ }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 style={H2}>{filterOptions.title}</h2>
      <MonoLabel>{shownCount} shown</MonoLabel>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {setMediaType && (
          <select className="tp-input w-auto" title="Media type" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
            <option value="">all types</option>
            <option value="movie">movies</option>
            <option value="show">shows</option>
          </select>
        )}
        <select className="tp-input w-auto" title="Filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {filterOptions.options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input className="tp-input w-auto" placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
    </div>
  )
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

function SelectAll({ ids, sel }) {
  const all = ids.length > 0 && ids.every((id) => sel.has(id))
  return (
    <label className="flex items-center gap-2 microcopy" style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={all} onChange={() => sel.setAll(ids, !all)} /> select all shown
    </label>
  )
}

// ---- books console ----

function BooksConsole({ books, onOpen, onDone, onFlash }) {
  const [filter, setFilter] = useState('flagged')
  const [q, setQ] = useState('')
  const [lookupId, setLookupId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const sel = useSelection()

  const shown = useMemo(() => {
    let list = books
    if (filter === 'flagged') list = list.filter((b) => !b.has_cover || !b.has_ids)
    else if (filter === 'no_cover') list = list.filter((b) => !b.has_cover)
    else if (filter === 'no_source') list = list.filter((b) => !b.has_ids)
    const s = q.trim().toLowerCase()
    if (s) list = list.filter((b) => b.title.toLowerCase().includes(s) || (b.author || '').toLowerCase().includes(s))
    return list
  }, [books, filter, q])
  const ids = shown.map((b) => b.id)
  const selected = ids.filter((id) => sel.has(id))
  useEffect(() => {
    sel.prune(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q])

  async function del() {
    if (!confirm(`Delete ${selected.length} book(s) and all their annotations?`)) return
    setBusy(true)
    setErr('')
    try {
      const rs = await runPooled(selected, 4, (id) => json('DELETE', `/books/${id}`))
      const fail = rs.filter((r) => !r.ok).length
      onFlash(`deleted ${selected.length - fail} book(s)${fail ? `, ${fail} failed` : ''}`)
    } finally {
      setBusy(false)
      sel.clear()
      onDone()
    }
  }

  return (
    <HandCard className="space-y-3 p-5">
      <Toolbar
        shownCount={shown.length}
        filter={filter}
        setFilter={setFilter}
        q={q}
        setQ={setQ}
        filterOptions={{
          title: 'Books',
          options: [
            ['flagged', 'flagged'],
            ['no_cover', 'no cover'],
            ['no_source', 'no source'],
            ['all', 'all'],
          ],
        }}
      />
      {shown.length === 0 ? (
        <p className="microcopy">nothing matches.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SelectAll ids={ids} sel={sel} />
          </div>
          <BulkBar n={selected.length} onClear={sel.clear}>
            <GhostButton disabled={busy} style={{ color: 'var(--error)' }} onClick={del}>
              Delete
            </GhostButton>
          </BulkBar>
          <ErrorText>{err}</ErrorText>
          <div>
            {shown.map((b) => (
              <BookRow
                key={b.id}
                book={b}
                checked={sel.has(b.id)}
                onCheck={() => sel.toggle(b.id)}
                open={lookupId === b.id}
                onToggleLookup={() => setLookupId((id) => (id === b.id ? null : b.id))}
                onOpen={onOpen}
                onDone={() => {
                  setLookupId(null)
                  onDone()
                }}
              />
            ))}
          </div>
        </>
      )}
    </HandCard>
  )
}

function BookRow({ book, checked, onCheck, open, onToggleLookup, onOpen, onDone }) {
  const [err, setErr] = useState('')
  const gaps = [!book.has_cover && 'no cover', !book.has_ids && 'no source'].filter(Boolean)

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
      genres: b.genres || [],
      series: b.series || '',
      series_index: b.series_index || 0,
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
        <GhostButton onClick={onToggleLookup}>{open ? 'Close' : 'Look up'}</GhostButton>
        {onOpen && <GhostButton onClick={() => onOpen(book.id)}>Open</GhostButton>}
      </div>
      {open && (
        <div className="mt-3">
          <BookLookupPicker title={book.title} isbn={book.isbn} asin={book.asin} onPick={apply} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
    </div>
  )
}

// ---- movies console ----

function MoviesConsole({ movies, onOpen, onDone, onFlash }) {
  const [filter, setFilter] = useState('flagged')
  const [mediaType, setMediaType] = useState('')
  const [q, setQ] = useState('')
  const [lookupId, setLookupId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const sel = useSelection()

  const shown = useMemo(() => {
    let list = movies
    if (mediaType) list = list.filter((m) => (m.media_type || 'movie') === mediaType)
    if (filter === 'flagged') list = list.filter((m) => !m.has_poster || !m.has_cast || !m.has_source)
    else if (filter === 'no_poster') list = list.filter((m) => !m.has_poster)
    else if (filter === 'no_cast') list = list.filter((m) => !m.has_cast)
    else if (filter === 'no_source') list = list.filter((m) => !m.has_source)
    const s = q.trim().toLowerCase()
    if (s) list = list.filter((m) => m.title.toLowerCase().includes(s))
    return list
  }, [movies, filter, mediaType, q])
  const ids = shown.map((m) => m.id)
  const selected = ids.filter((id) => sel.has(id))
  // "Fill actors from cast" only does anything for titles that HAVE a cast.
  const selectedWithCast = shown.filter((m) => sel.has(m.id) && m.has_cast).length
  useEffect(() => {
    sel.prune(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, mediaType, q])

  async function fillActors() {
    setBusy(true)
    setErr('')
    try {
      const rs = await runPooled(selected, 4, (id) => json('POST', `/movies/${id}/remap-speakers`, { mappings: [], refill: true }))
      const filled = rs.reduce((n, r) => n + (r.ok ? r.data.refilled || 0 : 0), 0)
      const fail = rs.filter((r) => !r.ok).length
      onFlash(`filled ${filled} actor(s) across ${selected.length} title(s)${fail ? `, ${fail} failed` : ''}`)
    } finally {
      setBusy(false)
      sel.clear()
      onDone()
    }
  }

  async function del() {
    if (!confirm(`Delete ${selected.length} title(s) and all their dialogues?`)) return
    setBusy(true)
    setErr('')
    try {
      const rs = await runPooled(selected, 4, (id) => json('DELETE', `/movies/${id}`))
      const fail = rs.filter((r) => !r.ok).length
      onFlash(`deleted ${selected.length - fail} title(s)${fail ? `, ${fail} failed` : ''}`)
    } finally {
      setBusy(false)
      sel.clear()
      onDone()
    }
  }

  return (
    <HandCard className="space-y-3 p-5">
      <Toolbar
        shownCount={shown.length}
        filter={filter}
        setFilter={setFilter}
        mediaType={mediaType}
        setMediaType={setMediaType}
        q={q}
        setQ={setQ}
        filterOptions={{
          title: 'Films & shows',
          options: [
            ['flagged', 'flagged'],
            ['no_poster', 'no poster'],
            ['no_cast', 'no cast'],
            ['no_source', 'no source'],
            ['all', 'all'],
          ],
        }}
      />
      {shown.length === 0 ? (
        <p className="microcopy">nothing matches.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SelectAll ids={ids} sel={sel} />
          </div>
          <BulkBar n={selected.length} onClear={sel.clear}>
            <GhostButton
              disabled={busy || selectedWithCast === 0}
              title={selectedWithCast === 0 ? 'none of the selected titles have a cast to fill from' : undefined}
              onClick={fillActors}
            >
              Fill actors from cast
            </GhostButton>
            <GhostButton disabled={busy} style={{ color: 'var(--error)' }} onClick={del}>
              Delete
            </GhostButton>
          </BulkBar>
          <ErrorText>{err}</ErrorText>
          <div>
            {shown.map((m) => (
              <MovieRow
                key={m.id}
                movie={m}
                checked={sel.has(m.id)}
                onCheck={() => sel.toggle(m.id)}
                open={lookupId === m.id}
                onToggleLookup={() => setLookupId((id) => (id === m.id ? null : m.id))}
                onOpen={onOpen}
                onDone={() => {
                  setLookupId(null)
                  onDone()
                }}
              />
            ))}
          </div>
        </>
      )}
    </HandCard>
  )
}

function MovieRow({ movie, checked, onCheck, open, onToggleLookup, onOpen, onDone }) {
  const [err, setErr] = useState('')
  const gaps = [!movie.has_poster && 'no poster', !movie.has_cast && 'no cast', !movie.has_source && 'no source'].filter(Boolean)

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
        <GhostButton onClick={onToggleLookup}>{open ? 'Close' : 'Look up'}</GhostButton>
        {onOpen && <GhostButton onClick={() => onOpen(movie.id)}>Open</GhostButton>}
      </div>
      {open && (
        <div className="mt-3">
          <MovieLookupPicker title={movie.title} year={movie.release_year} mediaType={movie.media_type || 'movie'} onPick={resync} />
          <ErrorText>{err}</ErrorText>
        </div>
      )}
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
