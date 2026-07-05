import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { json, errText } from './api.js'
import { CoverControls, CoverPreview, MovieLookupPicker } from './CoverPicker.jsx'
import {
  EdgeRow,
  EmptyState,
  ExpandableDescription,
  ErrorText,
  FavBadge,
  FrameCode,
  GhostButton,
  HandCard,
  HandNote,
  Hearts,
  MinRatingSelect,
  MonoLabel,
  PageHeader,
  Placeholder,
  Sprockets,
  TagChip,
  TiltStars,
  bySeries,
  filterChipClass,
  frameCode,
  seriesLabel,
  splitCommas,
  useCoverSize,
  useFrameBase,
  useReveal,
} from './ui.jsx'

// Movies — the reel wall (§8.6, mockups 12–14) + movie detail with the
// filmstrip (§8.7 + §6 recipe, mockups 15–16). Dialogues mirror annotations
// (PLAN §3b); tags are objects now — chips take color/style from GET /tags.
export default function Movies({ openId, onOpen, onClose }) {
  if (openId) return <MovieDetail id={openId} onClose={onClose} />
  return <MovieList onOpen={onOpen} />
}

// Reveal — a div that mounts with its content, so useReveal's effect sees the
// element (the grid/strip render only after data loads).
function Reveal({ className = '', children, ...rest }) {
  const ref = useReveal()
  return (
    <div ref={ref} className={'reveal ' + className} {...rest}>
      {children}
    </div>
  )
}

// amberMono — the metadata voice of the film pages (counts, credit lines).
const amberMono = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  fontWeight: 500,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--amber)',
}

// Poster renders the locally-served poster (GET /covers/{file}) or the
// striped POSTER placeholder (§6), always 2:3 and full-width.
function Poster({ path, title, className = '' }) {
  if (path) {
    return (
      <img
        src={`/covers/${path}`}
        alt={title ? `Poster of ${title}` : ''}
        className={'block w-full object-cover ' + className}
        style={{ aspectRatio: '2 / 3', border: '1px solid var(--line)', borderRadius: 8 }}
      />
    )
  }
  return <Placeholder kind="POSTER" className={'w-full ' + className} />
}

// movieState is the full PUT body for a movie (PUT is full-state, and omitting
// tmdb_id keeps it on the manual-update path) — used by the detail-header ♥/★.
function movieState(m) {
  return {
    title: m.title,
    director: m.director || '',
    release_year: m.release_year || 0,
    description: m.description || '',
    genres: m.genres || [],
    media_type: m.media_type || 'movie',
    series: m.series || '',
    series_index: m.series_index || 0,
    favorite: !!m.favorite,
    rating: m.rating || 0,
  }
}

// ---- movie list: poster grid mirroring Library (§8.6) ----

function MovieList({ onOpen }) {
  const [movies, setMovies] = useState(null)
  const [status, setStatus] = useState(null) // GET /metadata/status → Add-movie is status-aware
  const [mediaType, setMediaType] = useState('') // '' = all, 'movie', 'show'
  const [genre, setGenre] = useState('')
  const [series, setSeries] = useState('')
  const [fav, setFav] = useState(false)
  const [minRating, setMinRating] = useState('')
  const [sort, setSort] = useState('recent')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:movies', 150) // set from Settings

  async function load() {
    const r = await json('GET', '/movies')
    if (r.ok) setMovies(r.data.movies)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
    json('GET', '/metadata/status').then((r) => {
      if (r.ok) setStatus(r.data)
    })
  }, [])

  const tmdbSource = status?.tmdb?.source
  const hasShows = (movies || []).some((m) => (m.media_type || 'movie') === 'show')
  const genres = useMemo(() => {
    const s = new Set()
    for (const m of movies || []) for (const g of m.genres || []) s.add(g)
    return [...s].sort()
  }, [movies])
  const seriesNames = useMemo(() => {
    const s = new Set()
    for (const m of movies || []) if (m.series) s.add(m.series)
    return [...s].sort()
  }, [movies])

  const shown = useMemo(() => {
    let list = movies || []
    if (mediaType) list = list.filter((m) => (m.media_type || 'movie') === mediaType)
    if (genre) list = list.filter((m) => (m.genres || []).includes(genre))
    if (series) list = list.filter((m) => (m.series || '') === series)
    if (fav) list = list.filter((m) => m.favorite)
    if (minRating) list = list.filter((m) => (m.rating || 0) >= Number(minRating))
    if (sort === 'recent') return list
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'year') list.sort((a, b) => (b.release_year || 0) - (a.release_year || 0))
    else if (sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    else if (sort === 'series') list.sort(bySeries)
    return list
  }, [movies, mediaType, genre, series, fav, minRating, sort])

  const films = movies ? movies.length : 0
  const lines = movies ? movies.reduce((n, m) => n + (m.dialogue_count || 0), 0) : 0
  const counts = movies
    ? `${films} title${films === 1 ? '' : 's'} · ${lines} dialogue${lines === 1 ? '' : 's'}`
    : null

  return (
    <section>
      <PageHeader
        title="Movies & Shows"
        counts={counts}
        right={
          <>
            <MonoLabel className="hidden sm:inline">
              {tmdbSource === 'none' ? 'no TMDB key — manual entry' : 'lookup: title + year'}
            </MonoLabel>
            <button className="tp-btn tp-btn-primary" onClick={() => setAdding(true)}>
              ＋ Add title
            </button>
          </>
        }
      />
      <ErrorText>{error}</ErrorText>

      {movies && movies.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {hasShows && (
            <>
              {[
                ['', 'All'],
                ['movie', 'Movies'],
                ['show', 'Shows'],
              ].map(([k, label]) => (
                <button key={k} className={filterChipClass(mediaType === k)} onClick={() => setMediaType(k)}>
                  {label}
                </button>
              ))}
            </>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {genres.length > 0 && (
              <select
                className="tp-input w-auto"
                title="Filter by genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                <option value="">all genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
              ♥ favourites
            </button>
            <MinRatingSelect value={minRating} onChange={setMinRating} />
            {seriesNames.length > 0 && (
              <select
                className="tp-input w-auto"
                title="Filter by series"
                value={series}
                onChange={(e) => setSeries(e.target.value)}
              >
                <option value="">all series</option>
                {seriesNames.map((sname) => (
                  <option key={sname} value={sname}>
                    {sname}
                  </option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2">
              <MonoLabel>sort</MonoLabel>
              <select
                className="cursor-pointer"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 2px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--faint)',
                }}
                title="Sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">recent</option>
                <option value="title">title</option>
                <option value="year">year</option>
                <option value="rating">rating</option>
                <option value="series">series</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {movies && movies.length === 0 && (
        <EmptyState>No titles yet — look one up on TMDB/TVDB or add it manually.</EmptyState>
      )}
      {movies && movies.length > 0 && shown.length === 0 && <EmptyState>no titles match these filters</EmptyState>}
      {shown.length > 0 && (
        <Reveal
          className="grid gap-x-5 gap-y-8"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}
        >
          {shown.map((m) => (
            <PosterCard key={m.id} movie={m} onOpen={onOpen} />
          ))}
        </Reveal>
      )}
      {adding && (
        <AddMovieModal
          tmdbSource={tmdbSource}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            load()
          }}
        />
      )}
    </section>
  )
}

function PosterCard({ movie: m, onOpen }) {
  const n = m.dialogue_count || 0
  const isShow = (m.media_type || 'movie') === 'show'
  return (
    <button type="button" className="block w-full text-left" title={m.title} onClick={() => onOpen(m.id)}>
      <div className="relative">
        <Poster path={m.poster_path} title={m.title} />
        {isShow && (
          <span
            className="tp-chip absolute left-1.5 top-1.5"
            style={{ fontSize: 9.5, background: 'rgba(21,16,12,.72)', color: '#fff', borderColor: 'transparent' }}
          >
            SERIES
          </span>
        )}
        {m.favorite && <FavBadge />}
      </div>
      <span
        className="mt-2.5 block truncate"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}
      >
        {m.title}
      </span>
      <span className="block truncate text-[13px]" style={{ color: 'var(--soft)' }}>
        {[m.director, m.release_year].filter(Boolean).join(' · ') || ' '}
      </span>
      {m.series && (
        <span className="block truncate text-[12px]" style={{ color: 'var(--faint)', fontStyle: 'italic' }}>
          {seriesLabel(m)}
        </span>
      )}
      <span className="mt-0.5 flex items-center gap-2">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)' }}>
          {n} dialogue{n === 1 ? '' : 's'}
        </span>
        {m.rating > 0 && <TiltStars value={m.rating} />}
      </span>
    </button>
  )
}

// ---- add movie (§8.4): modal, tabs Look up | Manual, status-aware ----

function Modal({ label, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      style={{ background: 'rgba(21,16,12,.55)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={label} className="hand-card hc-r2 mx-auto w-full max-w-xl px-6 py-6">
        {children}
      </div>
    </div>
  )
}

function AddMovieModal({ tmdbSource, onClose, onAdded }) {
  const noKey = tmdbSource === 'none' // §2: no key → 503; Manual stays first-class
  const [mode, setMode] = useState(noKey ? 'manual' : 'lookup')
  const [lookupError, setLookupError] = useState('') // runtime 503 message, shown above Manual

  return (
    <Modal label="Add movie" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="display-title text-xl">Add movie</h2>
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
      <div className="mb-4 flex gap-1.5">
        <button className={filterChipClass(mode === 'lookup')} onClick={() => setMode('lookup')}>
          Look up
        </button>
        <button className={filterChipClass(mode === 'manual')} onClick={() => setMode('manual')}>
          Manual
        </button>
      </div>
      {noKey && (
        <p className="tp-error mb-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          no TMDB key configured — lookup returns 503. Add one in Settings (or set TIPPANI_TMDB_API_KEY);
          manual entry always works.
        </p>
      )}
      {mode === 'lookup' ? (
        <LookupMovie
          onAdded={onAdded}
          onUnavailable={(msg) => {
            // TMDB key missing at request time — surface it and fall back to manual.
            setLookupError(msg)
            setMode('manual')
          }}
        />
      ) : (
        <>
          <ErrorText>{lookupError}</ErrorText>
          <ManualMovie onAdded={onAdded} />
        </>
      )}
    </Modal>
  )
}

// candSource labels a candidate's supplier + id (e.g. "TMDB #603", "TVDB #121361").
function candSource(c) {
  const id = c.source === 'tvdb' ? c.source_id : c.tmdb_id || c.source_id
  return `${(c.source || 'tmdb').toUpperCase()} #${id}`
}

// sourceRef normalises a candidate to the {source, source_id, media_type} the
// create/enrich endpoints expect.
function sourceRef(c, fallbackMedia) {
  return {
    source: c.source || 'tmdb',
    source_id: c.source === 'tvdb' ? c.source_id : String(c.tmdb_id || c.source_id),
    media_type: c.media_type || fallbackMedia,
  }
}

function LookupMovie({ onAdded, onUnavailable }) {
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [mediaType, setMediaType] = useState('movie')
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null) // {cand, existing:[…]} when a same-name title already exists

  async function search(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError('')
    setConfirm(null)
    setCandidates(null)
    const body = { title: title.trim(), media_type: mediaType }
    if (year) body.year = Number(year)
    const r = await json('POST', '/movies/lookup', body)
    setBusy(false)
    if (r.ok) return setCandidates(r.data.candidates)
    if (r.status === 503) return onUnavailable(errText(r, 'lookup is unavailable'))
    setError(errText(r, 'lookup failed'))
  }

  // add posts the pick. A same-name title already in the library comes back as
  // 409 + needs_confirm (with the existing rows) so the user chooses: enrich one
  // of them, or add a distinct title (same-name films are legitimate).
  async function add(c, confirmNew = false) {
    setError('')
    const r = await json('POST', '/movies', { ...sourceRef(c, mediaType), confirm_new: confirmNew })
    if (r.ok) return onAdded()
    if (r.status === 409 && r.data?.needs_confirm) return setConfirm({ cand: c, existing: r.data.existing || [] })
    setError(errText(r, 'could not add title'))
  }

  // enrich re-syncs an existing row from the picked candidate's supplier — a
  // full re-pull that keeps that row's dialogues/rating/favourite (PLAN §6).
  async function enrich(existingId, c) {
    setBusy(true)
    setError('')
    const r = await json('PUT', `/movies/${existingId}`, sourceRef(c, mediaType))
    setBusy(false)
    if (r.ok) return onAdded()
    setError(errText(r, 'could not enrich that title'))
  }

  return (
    <div className="space-y-3">
      <MediaTypeToggle value={mediaType} onChange={setMediaType} />
      <form onSubmit={search} className="flex gap-2">
        <input className="tp-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="tp-input w-24 shrink-0"
          placeholder="Year"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <button className="tp-btn tp-btn-primary shrink-0" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>
      <ErrorText>{error}</ErrorText>
      {confirm && (
        <DuplicateConfirm
          confirm={confirm}
          busy={busy}
          onEnrich={(id) => enrich(id, confirm.cand)}
          onAddSeparate={() => add(confirm.cand, true)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {!confirm && candidates && candidates.length === 0 && <EmptyState>No matches found.</EmptyState>}
      {!confirm && candidates && candidates.length > 0 && (
        <ul style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
          {candidates.map((c, i) => (
            <li
              key={`${c.source}-${c.source_id || c.tmdb_id}`}
              className="flex items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
            >
              <CoverPreview url={c.poster_url} label="" />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15 }}>{c.title}</span>
                  {c.release_year ? (
                    <span className="ml-2 text-[12.5px]" style={{ color: 'var(--soft)' }}>
                      {c.release_year}
                    </span>
                  ) : null}
                </p>
                {c.overview && (
                  <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'var(--faint)' }}>
                    {c.overview}
                  </p>
                )}
              </div>
              <span className="tp-chip shrink-0" style={{ color: 'var(--amber)' }}>
                {candSource(c)}
              </span>
              <GhostButton className="shrink-0" onClick={() => add(c)}>
                Add
              </GhostButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// DuplicateConfirm asks the user what to do when the picked title shares a name
// with something already in their library: enrich one of the existing rows in
// place (keeping its dialogues), or add a separate title.
function DuplicateConfirm({ confirm, busy, onEnrich, onAddSeparate, onCancel }) {
  return (
    <div className="hand-card hc-r1 space-y-3 p-4" style={{ borderLeft: '4px solid var(--amber, var(--accent))' }}>
      <p className="text-sm">
        You already have a title named <b>“{confirm.cand.title}”</b>. Enrich it with this metadata (keeps its
        dialogues), or add “{confirm.cand.title}” as a separate title.
      </p>
      <ul className="space-y-2">
        {confirm.existing.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2"
            style={{ border: '1px solid var(--line)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {e.title}
                {e.release_year ? (
                  <span className="ml-2 font-normal" style={{ color: 'var(--soft)' }}>
                    {e.release_year}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs" style={{ color: 'var(--faint)' }}>
                {[
                  `${e.dialogue_count} dialogue${e.dialogue_count === 1 ? '' : 's'}`,
                  e.has_poster ? 'has poster' : 'no poster',
                ].join(' · ')}
              </p>
            </div>
            <GhostButton type="button" className="shrink-0" disabled={busy} onClick={() => onEnrich(e.id)}>
              Enrich this
            </GhostButton>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="tp-btn tp-btn-primary" disabled={busy} onClick={onAddSeparate}>
          Add as a separate title
        </button>
        <GhostButton type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </GhostButton>
      </div>
    </div>
  )
}

function ManualMovie({ onAdded }) {
  const [title, setTitle] = useState('')
  const [mediaType, setMediaType] = useState('movie')
  const [director, setDirector] = useState('')
  const [year, setYear] = useState('')
  const [genres, setGenres] = useState('')
  const [series, setSeries] = useState('')
  const [seriesIndex, setSeriesIndex] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isShow = mediaType === 'show'

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    setBusy(true)
    setError('')
    const r = await json('POST', '/movies', {
      title: title.trim(),
      media_type: mediaType,
      director: director.trim() || undefined,
      release_year: year ? Number(year) : undefined,
      genres: splitCommas(genres),
      series: series.trim() || undefined,
      series_index: Number(seriesIndex) || 0,
      description: description.trim() || undefined,
    })
    setBusy(false)
    if (r.ok) onAdded()
    else setError(errText(r, 'could not add title'))
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <MediaTypeToggle value={mediaType} onChange={setMediaType} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input className="tp-input" placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="tp-input"
          placeholder={isShow ? 'Creator' : 'Director'}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        <input className="tp-input" placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        <input className="tp-input" placeholder="Genres (comma-separated)" value={genres} onChange={(e) => setGenres(e.target.value)} />
        <input className="tp-input" placeholder="Series / franchise" value={series} onChange={(e) => setSeries(e.target.value)} />
        <input
          className="tp-input"
          placeholder="Series #"
          inputMode="decimal"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
      </div>
      <textarea className="tp-input" rows="3" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <button className="tp-btn tp-btn-primary" disabled={busy}>
        Add {isShow ? 'show' : 'movie'}
      </button>
    </form>
  )
}

// MediaTypeToggle — the Movie | Show segmented switch, reused by the add + edit
// forms (TV is folded into movies via media_type).
function MediaTypeToggle({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {[
        ['movie', 'Movie'],
        ['show', 'Show'],
      ].map(([k, label]) => (
        <button key={k} type="button" className={filterChipClass(value === k)} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ---- movie detail (§8.7): poster header + filmstrip of dialogues ----

function MovieDetail({ id, onClose }) {
  const [movie, setMovie] = useState(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const r = await json('GET', `/movies/${id}`)
    if (r.ok) setMovie(r.data)
    else setError(errText(r))
  }
  useEffect(() => {
    setMovie(null)
    setEditing(false)
    load()
  }, [id])

  async function remove() {
    if (!confirm(`Delete "${movie.title}" and all its dialogues?`)) return
    const r = await json('DELETE', `/movies/${id}`)
    if (r.ok) onClose()
    else setError(errText(r))
  }

  // patch PUTs the movie's full current state with one field changed (♥/★).
  async function patch(fields) {
    const r = await json('PUT', `/movies/${id}`, { ...movieState(movie), ...fields })
    if (r.ok) setMovie(r.data)
    else setError(errText(r, 'could not save'))
  }

  const isShow = movie && (movie.media_type || 'movie') === 'show'
  // "DIR./CREATED BY X · YEAR · Series #n · TMDB/TVDB #id" — the mono credit line.
  const metaLine = movie
    ? [
        movie.director && `${isShow ? 'CREATED BY' : 'DIR.'} ${movie.director}`,
        movie.release_year,
        seriesLabel(movie) || null,
        movie.tmdb_id && `TMDB #${movie.tmdb_id}`,
        movie.tvdb_id && `TVDB #${movie.tvdb_id}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <section className="space-y-6 pt-5" data-screen-label="movie-detail">
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '.1em',
          color: 'var(--soft)',
        }}
      >
        ← Movies
      </button>
      <ErrorText>{error}</ErrorText>
      {movie &&
        (editing ? (
          <HandCard variant={1} className="p-5">
            <EditMovie
              movie={movie}
              onSaved={() => {
                setEditing(false)
                load()
              }}
              onCancel={() => setEditing(false)}
            />
          </HandCard>
        ) : (
          <Reveal className="flex flex-wrap items-start gap-6">
            <div className="w-36 shrink-0 sm:w-44" style={{ filter: 'drop-shadow(0 12px 22px rgba(0,0,0,.4))' }}>
              <Poster path={movie.poster_path} title={movie.title} />
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              <h1 className="display-title" style={{ fontSize: 27 }}>
                {movie.title}
              </h1>
              {metaLine && <p style={amberMono}>{metaLine}</p>}
              <div className="flex items-center gap-3">
                <Hearts value={!!movie.favorite} onChange={(v) => patch({ favorite: v })} />
                <TiltStars value={movie.rating || 0} onChange={(v) => patch({ rating: v })} />
              </div>
              {movie.genres?.length > 0 && (
                <p className="flex flex-wrap gap-1.5">
                  {movie.genres.map((g) => (
                    <span key={g} className="tp-chip">
                      {g}
                    </span>
                  ))}
                </p>
              )}
              <div className="max-w-prose">
                <ExpandableDescription text={movie.description} />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <GhostButton onClick={() => (window.location.href = `/movies/${movie.id}/export`)}>
                Export .md
              </GhostButton>
              <GhostButton onClick={() => setEditing(true)}>Edit</GhostButton>
              <GhostButton style={{ color: 'var(--error)' }} onClick={remove}>
                Delete
              </GhostButton>
            </div>
          </Reveal>
        ))}
      {movie && <Dialogues movieId={movie.id} cast={movie.cast || []} />}
    </section>
  )
}

function EditMovie({ movie, onSaved, onCancel }) {
  const [title, setTitle] = useState(movie.title || '')
  const [mediaType, setMediaType] = useState(movie.media_type || 'movie')
  const [director, setDirector] = useState(movie.director || '')
  const [year, setYear] = useState(movie.release_year ? String(movie.release_year) : '')
  const [genres, setGenres] = useState((movie.genres || []).join(', '))
  const [series, setSeries] = useState(movie.series || '')
  const [seriesIndex, setSeriesIndex] = useState(movie.series_index ? String(movie.series_index) : '')
  const [description, setDescription] = useState(movie.description || '')
  const [posterPath, setPosterPath] = useState(movie.poster_path || '')
  const [posterUrl, setPosterUrl] = useState('')
  const [clearCover, setClearCover] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isShow = mediaType === 'show'

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    setBusy(true)
    setError('')
    const r = await json('PUT', `/movies/${movie.id}`, {
      title: title.trim(),
      media_type: mediaType,
      director: director.trim(),
      release_year: year ? Number(year) : undefined,
      genres: splitCommas(genres),
      series: series.trim(),
      series_index: Number(seriesIndex) || 0,
      description: description.trim(),
      // favorite/rating are edited on the detail header — carry them (PUT is full-state).
      favorite: !!movie.favorite,
      rating: movie.rating || 0,
      poster_url: posterUrl || undefined,
      clear_cover: clearCover || undefined,
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setError(errText(r, 'could not save'))
  }

  // Picking a match re-syncs everything server-side from that supplier (poster,
  // cast, genres, details) — a full re-pull, so we just refresh afterwards.
  async function resync(c) {
    setBusy(true)
    setError('')
    const r = await json('PUT', `/movies/${movie.id}`, {
      source: c.source || 'tmdb',
      source_id: c.source === 'tvdb' ? c.source_id : String(c.tmdb_id || c.source_id),
      media_type: c.media_type || mediaType,
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setError(errText(r, 'could not sync from the source'))
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <CoverControls
        kind="movies"
        id={movie.id}
        currentPath={posterPath}
        coverUrl={posterUrl}
        clearCover={clearCover}
        onSetUrl={(u) => {
          setPosterUrl(u)
          setClearCover(false)
        }}
        onClear={(reset) => {
          if (reset === true) {
            setPosterUrl('')
            setClearCover(false)
          } else {
            setClearCover(true)
            setPosterUrl('')
          }
        }}
        onUploaded={(rec) => setPosterPath(rec.poster_path || '')}
      />
      <MediaTypeToggle value={mediaType} onChange={setMediaType} />
      <div>
        <MonoLabel className="mb-1.5 block">Look up on TMDB / TVDB (replaces details, cast &amp; poster)</MonoLabel>
        <MovieLookupPicker title={title} year={year} mediaType={mediaType} onPick={resync} />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input className="tp-input" placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="tp-input"
          placeholder={isShow ? 'Creator' : 'Director'}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        <input className="tp-input" placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        <input className="tp-input" placeholder="Genres (comma-separated)" value={genres} onChange={(e) => setGenres(e.target.value)} />
        <input className="tp-input" placeholder="Series / franchise" value={series} onChange={(e) => setSeries(e.target.value)} />
        <input
          className="tp-input"
          placeholder="Series #"
          inputMode="decimal"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
      </div>
      <textarea className="tp-input" rows="4" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className="tp-btn tp-btn-primary" disabled={busy}>
          Save
        </button>
        <GhostButton type="button" onClick={onCancel}>
          Cancel
        </GhostButton>
      </div>
    </form>
  )
}

// dialogueState builds the full PUT body from a dialogue row — PUT is
// full-state, so every field must be carried even when only one changes.
function dialogueState(d) {
  return {
    quote: d.quote || '',
    note: d.note || '',
    character: d.character || '',
    actor: d.actor || '',
    timestamp: d.timestamp || '',
    tags: d.tags || [],
    favorite: !!d.favorite,
    rating: d.rating || 0,
  }
}

// Dialogues — the FILM STRIP (§6 recipe): strip container → sprocket row →
// edge row (TIPPANI · SAFETY FILM + runtime-random frame code) → frame cards
// separated by divider rows carrying the next code → closing sprockets.
// Server orders by (timestamp IS NULL), timestamp, id — rendered as served.
function Dialogues({ movieId, cast }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  const [minRating, setMinRating] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const reqSeq = useRef(0)
  const base = useFrameBase() // frame codes regenerate per mount (§6)

  const castListId = `cast-characters-${movieId}`
  const characters = [...new Set(cast.map((c) => c.character).filter(Boolean))]
  const tagMap = Object.fromEntries(tags.map((t) => [t.name, t]))

  async function loadTags() {
    const r = await json('GET', '/tags')
    if (r.ok) setTags(r.data.tags)
  }
  async function load() {
    // Sequence guard: only the newest response renders when filters toggle fast.
    const seq = ++reqSeq.current
    const params = new URLSearchParams({ movie_id: movieId })
    if (tag) params.set('tag', tag)
    if (fav) params.set('favorite', '1')
    if (minRating) params.set('min_rating', minRating)
    const r = await json('GET', `/dialogues?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) setItems(r.data.dialogues)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [movieId, tag, fav, minRating])
  useEffect(() => {
    loadTags()
  }, [movieId])

  async function add(fields) {
    const r = await json('POST', '/dialogues', { movie_id: movieId, ...fields })
    if (!r.ok) return errText(r, 'could not add dialogue')
    load()
    loadTags()
    return null
  }

  async function save(id, fields) {
    const r = await json('PUT', `/dialogues/${id}`, fields)
    if (!r.ok) return errText(r, 'could not save dialogue')
    setEditingId(null)
    load()
    loadTags()
    return null
  }

  async function remove(d) {
    if (!confirm('Delete this dialogue?')) return
    const r = await json('DELETE', `/dialogues/${d.id}`)
    if (r.ok) load()
    else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (♥/★ clicks).
  async function patch(d, fields) {
    const r = await json('PUT', `/dialogues/${d.id}`, { ...dialogueState(d), ...fields })
    if (!r.ok) return setError(errText(r, 'could not save dialogue'))
    setError('')
    load()
  }

  const filtering = tag || fav || minRating

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonoLabel>Dialogues{items ? ` · ${items.length}` : ''}</MonoLabel>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
            ♥ Favourites
          </button>
          <MinRatingSelect value={minRating} onChange={setMinRating} />
          {tags.length > 0 && (
            <select
              className="tp-input w-auto"
              title="Filter by tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {characters.length > 0 && (
        <datalist id={castListId}>
          {characters.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}

      <ErrorText>{error}</ErrorText>
      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'No dialogues match the filters.' : 'No dialogues yet — capture the first line below.'}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <Reveal className="film-strip">
          <Sprockets count={15} />
          <EdgeRow code={frameCode(base)} />
          {items.map((d, i) => (
            <Fragment key={d.id}>
              {i > 0 && <FrameDivider code={frameCode(base, i)} />}
              <Frame
                d={d}
                tagMap={tagMap}
                editing={editingId === d.id}
                castListId={castListId}
                onEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(fields) => save(d.id, fields)}
                onPatch={(fields) => patch(d, fields)}
                onDelete={() => remove(d)}
              />
            </Fragment>
          ))}
          <Sprockets count={15} />
        </Reveal>
      )}

      {adding ? (
        <HandCard variant={2} className="p-5">
          <DialogueForm
            onSubmit={add}
            onCancel={() => setAdding(false)}
            submitLabel="Add dialogue"
            castListId={castListId}
          />
        </HandCard>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-3"
          style={{ background: 'transparent', border: '1.6px dashed var(--ink-border)', borderRadius: 12, minHeight: 56 }}
        >
          <span style={{ color: 'var(--accent-ui)', fontWeight: 600, fontSize: 14.5 }}>＋ Add dialogue</span>
          <span className="microcopy">character picker from cast · actor auto-fills · timestamp HH:MM:SS</span>
        </button>
      )}
    </div>
  )
}

// FrameDivider — the row between frames, carrying the next frame code (§6).
function FrameDivider({ code }) {
  const rule = { borderTop: '1px solid color-mix(in srgb, var(--amber) 22%, transparent)' }
  return (
    <div className="mx-4 flex items-center gap-3 py-1.5" aria-hidden="true">
      <span className="flex-1" style={rule} />
      <FrameCode>{code}</FrameCode>
      <span className="flex-1" style={rule} />
    </div>
  )
}

// Frame — one dialogue as a film frame: Newsreader quote, amber mono credit
// line, tag chips, ♥ + tilted ★ (immediate PUT patches), note, edit/delete.
function Frame({ d, tagMap, editing, castListId, onEdit, onCancelEdit, onSave, onPatch, onDelete }) {
  if (editing) {
    return (
      <article className="film-frame mx-4 my-1.5 px-5 py-4">
        <DialogueForm initial={d} onSubmit={onSave} onCancel={onCancelEdit} submitLabel="Save" castListId={castListId} />
      </article>
    )
  }
  const credit = [d.character, d.actor && `PLAYED BY ${d.actor}`, d.timestamp].filter(Boolean).join(' · ')
  return (
    <article className="film-frame mx-4 my-1.5 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <blockquote
          className="whitespace-pre-wrap"
          style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, lineHeight: 1.5, color: 'var(--ink)' }}
        >
          &ldquo;{d.quote}&rdquo;
        </blockquote>
        <Hearts value={!!d.favorite} onChange={(v) => onPatch({ favorite: v })} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span style={amberMono}>{credit}</span>
        <TiltStars value={d.rating || 0} onChange={(v) => onPatch({ rating: v })} />
      </div>
      {d.tags?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {d.tags.map((name) => {
            const t = tagMap[name] // tag objects carry the user's colour + style
            return (
              <TagChip key={name} color={t?.color} style={t?.style}>
                {name}
              </TagChip>
            )
          })}
        </div>
      )}
      {d.note && <HandNote className="mt-2">{d.note}</HandNote>}
      <div className="mt-1 flex justify-end gap-2.5">
        <button className="tp-link" onClick={onEdit}>
          edit
        </button>
        <button className="tp-link tp-link-danger" onClick={onDelete}>
          delete
        </button>
      </div>
    </article>
  )
}

// DialogueForm serves both add (no initial) and inline edit (initial set).
// Leaving actor blank lets the server auto-fill it from the movie's cast.
function DialogueForm({ initial, onSubmit, onCancel, submitLabel, castListId }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [character, setCharacter] = useState(initial?.character || '')
  const [actor, setActor] = useState(initial?.actor || '')
  const [timestamp, setTimestamp] = useState(initial?.timestamp || '')
  const [note, setNote] = useState(initial?.note || '')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!quote.trim()) return setError('quote is required')
    setBusy(true)
    setError('')
    const err = await onSubmit({
      quote: quote.trim(),
      note: note.trim(),
      character: character.trim(),
      actor: actor.trim(),
      timestamp: timestamp.trim(),
      tags: splitCommas(tags),
      // favorite/rating are edited on the frame, not in the form — but PUT is
      // full-state, so carry the existing values through.
      favorite: !!initial?.favorite,
      rating: initial?.rating || 0,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setQuote('')
      setCharacter('')
      setActor('')
      setTimestamp('')
      setNote('')
      setTags('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <textarea
        className="tp-input"
        rows="3"
        placeholder="Quote (required)"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      <div className="grid gap-2.5 sm:grid-cols-3">
        <input
          className="tp-input"
          placeholder="Character"
          title="Character — picks from the stored cast"
          list={castListId}
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
        />
        <input
          className="tp-input"
          placeholder="Actor (auto-fills from cast)"
          title="Actor — left blank, fills from the movie's cast"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />
        <input
          className="tp-input"
          placeholder="HH:MM:SS"
          title="Timestamp"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
        />
      </div>
      <textarea className="tp-input" rows="2" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <input
        className="tp-input"
        placeholder="Tags (comma-separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <GhostButton type="button" onClick={onCancel}>
            Cancel
          </GhostButton>
        )}
        <button className="tp-btn tp-btn-primary" disabled={busy}>
          {submitLabel}
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
