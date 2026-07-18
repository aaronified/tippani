import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO, coverImgURL, json, errText, downloadPost } from './api.js'
import AddSurface from './AddSurface.jsx'
import { CoverControls, CoverPreview, MovieLookupPicker } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, movieShare } from './share.jsx'
import { CreditFaces, PersonCredit, PersonModal, PersonName, PersonPortrait, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import {
  ConfirmDialog,
  EdgeRow,
  EmptyState,
  ExpandableDescription,
  ErrorText,
  FavBadge,
  FormModal,
  FrameCode,
  GenreFilter,
  GhostButton,
  HandCard,
  HandNote,
  Hearts,
  IconBack,
  IconButton,
  IconDelete,
  IconEdit,
  IconExport,
  IconFilter,
  IconMore,
  IconPlus,
  Lightbox,
  Masonry,
  MobileSheet,
  MoreMenu,
  MonoLabel,
  PageHeader,
  Placeholder,
  QuoteActions,
  Select,
  SheetFooter,
  Sprockets,
  ReviewDot,
  TagChip,
  Toggle,
  TokenInput,
  ViewToggle,
  bySeries,
  clampSequence,
  filterChipClass,
  frameCode,
  mulberry32,
  seriesLabel,
  splitCommas,
  titleCaseGenre,
  useColumnsAt,
  useCoverSize,
  useFrameBase,
  useIsMobileScreen,
  usePersistedState,
  useReveal,
  ExpandableText,
} from './ui.jsx'

// Movies — the reel wall (§8.6, mockups 12–14) + movie detail with the
// filmstrip (§8.7 + §6 recipe, mockups 15–16). Dialogues mirror annotations
// (PLAN §3b); tags are objects now — chips take color/style from GET /tags.
export default function Movies({ openId, onOpen, onClose, creditSeparators }) {
  if (openId) return <MovieDetail id={openId} onClose={onClose} creditSeparators={creditSeparators} />
  return <MovieList onOpen={onOpen} creditSeparators={creditSeparators} />
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
function Poster({ path, title, className = '', zoomable = false }) {
  const [zoom, setZoom] = useState(false)
  if (path) {
    const img = (
      <img
        src={coverImgURL(path)}
        alt={title ? `Poster of ${title}` : ''}
        className={'block w-full object-cover ' + className}
        style={{ aspectRatio: '2 / 3', border: '1px solid var(--line)', borderRadius: 8 }}
      />
    )
    if (!zoomable) return img
    return (
      <>
        <button
          type="button"
          className="cover-zoom-btn"
          aria-label={title ? `View poster of ${title} full screen` : 'View poster full screen'}
          onClick={() => setZoom(true)}
        >
          {img}
        </button>
        {zoom && <Lightbox path={path} title={title} onClose={() => setZoom(false)} />}
      </>
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

function MovieList({ onOpen, creditSeparators }) {
  const [movies, setMovies] = useState(null)
  const { map: directorMap } = usePeople('director') // name→metadata, for director/creator face chips
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
  const [status, setStatus] = useState(null) // GET /metadata/status → Add-movie is status-aware
  const [mediaType, setMediaType] = useState('') // '' = all, 'movie', 'show'
  const [genre, setGenre] = useState('')
  const [series, setSeries] = useState('')
  const [fav, setFav] = useState(false)
  const [sort, setSort] = useState('recent')
  const [adding, setAdding] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:movies', 150) // set from Settings
  const mobile = useIsMobileScreen()
  const [mobileFilter, setMobileFilter] = useState(false)

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
  // Most-common genres first (GenreFilter shows as many as fit, tail into More…).
  const genres = useMemo(() => {
    const counts = new Map()
    for (const m of movies || []) for (const g of m.genres || []) counts.set(g, (counts.get(g) || 0) + 1)
    return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b))
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
    if (sort === 'recent') return list
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'year') list.sort((a, b) => (b.release_year || 0) - (a.release_year || 0))
    else if (sort === 'series') list.sort(bySeries)
    return list
  }, [movies, mediaType, genre, series, fav, sort])

  const films = movies ? movies.length : 0
  const lines = movies ? movies.reduce((n, m) => n + (m.dialogue_count || 0), 0) : 0
  const counts = movies
    ? `${films} title${films === 1 ? '' : 's'} · ${lines} dialogue${lines === 1 ? '' : 's'}`
    : null

  return (
    <section>
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader
          title="Movies & Shows"
          counts={counts}
          right={
            <>
              {mobile && (
                <div className="flex items-center gap-2">
                  <IconButton icon={<IconPlus />} ariaLabel="Add title" onClick={() => setAdding(true)} />
                  <IconButton icon={<IconFilter />} ariaLabel="Filters" onClick={() => setMobileFilter((o) => !o)} />
                  {!DEMO && <MoreMenu items={[{ icon: <IconExport />, label: 'Export all', onClick: () => setExporting(true) }]} />}
                </div>
              )}
              {!mobile && (
                <MonoLabel className="hidden sm:inline">
                  {tmdbSource === 'none' ? 'no TMDB key — manual entry' : 'lookup: title + year'}
                </MonoLabel>
              )}
              {!mobile && !DEMO && <GhostButton onClick={() => setExporting(true)}>Export all</GhostButton>}
              {!mobile && (
                <button className="tp-btn tp-btn-primary" onClick={() => setAdding(true)}>
                  ＋ Add title
                </button>
              )}
            </>
          }
        />
      </div>
      <ErrorText>{error}</ErrorText>

      {movies && movies.length > 0 && !mobile && (
        <div className="filter-row mb-5">
          <GenreFilter genres={genres} value={genre} onChange={setGenre} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {hasShows &&
              [
                ['', 'All'],
                ['movie', 'Movies'],
                ['show', 'Shows'],
              ].map(([k, label]) => (
                <button key={k} className={filterChipClass(mediaType === k)} onClick={() => setMediaType(k)}>
                  {label}
                </button>
              ))}
            <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
              ♥ favourites
            </button>
            {seriesNames.length > 0 && (
              <Select
                ariaLabel="Filter by series"
                value={series}
                onChange={setSeries}
                options={[['', 'all series'], ...seriesNames.map((s) => [s, s])]}
              />
            )}
            <label className="flex items-center gap-2">
              <MonoLabel>sort</MonoLabel>
              <Select
                ariaLabel="Sort"
                value={sort}
                onChange={setSort}
                options={[['recent', 'Recent'], ['title', 'Title'], ['year', 'Year'], ['series', 'Series']]}
              />
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
              count={movies ? `${shown.length} shown` : ''}
              onReset={() => { setGenre(''); setMediaType(''); setFav(false); setSeries(''); setSort('recent') }}
              onDone={() => setMobileFilter(false)}
            />
          }
        >
          <div className="space-y-5">
            <div>
              <MonoLabel className="mb-2 block">genre</MonoLabel>
              <GenreFilter genres={genres} value={genre} onChange={setGenre} />
            </div>
            {hasShows && (
              <div>
                <MonoLabel className="mb-2 block">type</MonoLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ['', 'All'],
                    ['movie', 'Movies'],
                    ['show', 'Shows'],
                  ].map(([k, label]) => (
                    <button key={k} className={filterChipClass(mediaType === k)} onClick={() => setMediaType(k)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <MonoLabel className="mb-2 block">show only</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
                  ♥ favourites
                </button>
                  </div>
            </div>
            {seriesNames.length > 0 && (
              <div>
                <MonoLabel className="mb-2 block">series</MonoLabel>
                <Select
                  ariaLabel="Filter by series"
                  value={series}
                  onChange={setSeries}
                  options={[['', 'all series'], ...seriesNames.map((s) => [s, s])]}
                />
              </div>
            )}
            <div>
              <MonoLabel className="mb-2 block">sort</MonoLabel>
              <Select
                ariaLabel="Sort"
                value={sort}
                onChange={setSort}
                options={[['recent', 'Recent'], ['title', 'Title'], ['year', 'Year'], ['series', 'Series']]}
              />
            </div>
          </div>
        </MobileSheet>
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
            <PosterCard key={m.id} movie={m} onOpen={onOpen} directorMap={directorMap} seps={creditSeps} />
          ))}
        </Reveal>
      )}
      <AddSurface
        open={adding}
        initialSection="film"
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false)
          load()
        }}
        onOpenMovie={onOpen}
      />
      <ConfirmDialog
        open={exporting}
        title="Export catalogue"
        body={(() => {
          const shows = shown.filter((m) => (m.media_type || 'movie') === 'show').length
          const films = shown.length - shows
          const parts = [films > 0 && `${films} movie${films === 1 ? '' : 's'}`, shows > 0 && `${shows} show${shows === 1 ? '' : 's'}`].filter(Boolean)
          return <>{parts.join(' · ') || '0 titles'} in view will be exported as a single Markdown file.</>
        })()}
        confirmLabel="Export"
        onCancel={() => setExporting(false)}
        onConfirm={async () => {
          setExporting(false)
          await downloadPost('/export/movies', { ids: shown.map((m) => m.id) }, 'tippani-titles.md')
        }}
      />
    </section>
  )
}

function PosterCard({ movie: m, onOpen, directorMap = {}, seps }) {
  const n = m.dialogue_count || 0
  const isShow = (m.media_type || 'movie') === 'show'
  return (
    <button type="button" className="cover-tile block w-full text-left" title={m.title} onClick={() => onOpen(m.id)}>
      <div className="relative cover-lift">
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
      <span className="flex items-center gap-1.5">
        {/* Director/creator face(s), matching the book library's author chip;
            co-directors overlap with the first on top (CreditFaces). */}
        <CreditFaces names={splitCredits(m.director, seps)} map={directorMap} size={24} ring="var(--bg)" />
        <span className="min-w-0 truncate text-[13px]" style={{ color: 'var(--soft)' }}>
        {[m.director, m.release_year].filter(Boolean).join(' · ') || ' '}
        </span>
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
      </span>
    </button>
  )
}

// ---- add movie (§8.4): look-up / manual forms, now hosted by AddSurface (§7).
// The old modal wrapper lives in AddSurface; the forms below are exported. ----

// candSource labels a candidate's supplier + id (e.g. "TMDB #603", "TVDB #121361").
export function candSource(c) {
  const id = c.source === 'tvdb' ? c.source_id : c.tmdb_id || c.source_id
  return `${(c.source || 'tmdb').toUpperCase()} #${id}`
}

// sourceRef normalises a candidate to the {source, source_id, media_type} the
// create/enrich endpoints expect.
export function sourceRef(c, fallbackMedia) {
  return {
    source: c.source || 'tmdb',
    source_id: c.source === 'tvdb' ? c.source_id : String(c.tmdb_id || c.source_id),
    media_type: c.media_type || fallbackMedia,
  }
}

// DuplicateConfirm asks the user what to do when the picked title shares a name
// with something already in their library: enrich one of the existing rows in
// place (keeping its dialogues), or add a separate title.
export function DuplicateConfirm({ confirm, busy, onEnrich, onAddSeparate, onCancel }) {
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

export function ManualMovie({ mediaType, setMediaType, title, setTitle, onAdded }) {
  const [director, setDirector] = useState('')
  const [year, setYear] = useState('')
  const [genres, setGenres] = useState([])
  const [genreSuggestions, setGenreSuggestions] = useState([])
  useEffect(() => {
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
  }, [])
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
      genres,
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
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input className="tp-input" placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="tp-input"
          placeholder={isShow ? 'Creator' : 'Director'}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        <input className="tp-input" placeholder="Year" inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder="add a genre…" ariaLabel="Genres" transform={titleCaseGenre} />
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

// MediaTypeToggle — the Movie | Show switch, reused by the add + edit forms
// (TV is folded into movies via media_type).
export function MediaTypeToggle({ value, onChange }) {
  return <Toggle ariaLabel="Media type" value={value} onChange={onChange} options={[['movie', 'Movie'], ['show', 'Show']]} />
}

// ---- movie detail (§8.7): poster header + filmstrip of dialogues ----

function MovieDetail({ id, onClose, creditSeparators }) {
  const [movie, setMovie] = useState(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [mobileFilter, setMobileFilter] = useState(false)
  const [mobileAdd, setMobileAdd] = useState(false)
  // { kind:'director', name } open in the metadata panel — captured at click time.
  const [person, setPerson] = useState(null)
  const { map: directorMap } = usePeople('director') // name→metadata, for the director/creator face chip
  const mobile = useIsMobileScreen()
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])

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
  // The director/creator name(s) are clickable (open the People panel), styled to
  // inherit the amber mono voice; co-credits split like book authors do.
  const dirNames = movie?.director ? splitCredits(movie.director, creditSeps) : []
  const directorNode =
    dirNames.length > 0 ? (
      <span key="director">
        {isShow ? 'CREATED BY ' : 'DIR. '}
        {dirNames.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && ', '}
            <PersonCredit
              kind="director"
              name={n}
              person={directorMap[n]}
              size={28}
              onOpen={setPerson}
              nameClassName=""
              nameStyle={{ font: 'inherit', color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
            />
          </Fragment>
        ))}
      </span>
    ) : null
  const metaParts = movie
    ? [
        directorNode,
        movie.release_year && String(movie.release_year),
        seriesLabel(movie) || null,
        movie.tmdb_id && `TMDB #${movie.tmdb_id}`,
        movie.tvdb_id && `TVDB #${movie.tvdb_id}`,
      ].filter(Boolean)
    : []

  const detailTitle = movie ? (movie.title || 'Untitled') : ''
  const detailMeta = movie ? (movie.director || movie.release_year || '') : ''

  return (
    <section className="space-y-6 md:pt-5" data-screen-label="movie-detail">
      {mobile && (
        <div className="mobile-sticky-bar">
          <div className="mobile-detail-bar">
            <button type="button" className="tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full" style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }} onClick={onClose} aria-label="Back">
              <IconBack />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mobile-detail-title">{detailTitle}</div>
              {detailMeta && <div className="mobile-detail-meta">{detailMeta}</div>}
            </div>
            <div className="mobile-detail-actions">
              <IconButton icon={<IconFilter />} ariaLabel="Filter dialogues" onClick={() => setMobileFilter(true)} />
              <IconButton icon={<IconPlus />} ariaLabel="Add dialogue" onClick={() => setMobileAdd(true)} />
              <MoreMenu
                items={[
                  ...(DEMO ? [] : [{ icon: <IconExport />, label: 'Export .md', onClick: () => { if (movie) window.location.href = `/api/movies/${movie.id}/export` } }]),
                  { icon: <IconEdit />, label: 'Edit', onClick: () => setEditing(true) },
                  { icon: <IconDelete />, label: 'Delete', onClick: remove, danger: true },
                ]}
              />
            </div>
          </div>
        </div>
      )}
      {!mobile && (
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
      )}
      <ErrorText>{error}</ErrorText>
      {movie && (
        <Reveal className="flex flex-wrap items-start gap-6">
          <div className="w-36 shrink-0 sm:w-44" style={{ filter: 'drop-shadow(0 12px 22px rgba(0,0,0,.4))' }}>
            <Poster path={movie.poster_path} title={movie.title} zoomable />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5" style={{ minWidth: 220 }}>
            <h1 className="display-title" style={{ fontSize: 27 }}>
              {movie.title}
            </h1>
            {metaParts.length > 0 && (
              <p style={amberMono}>
                {metaParts.map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && ' · '}
                    {part}
                  </Fragment>
                ))}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Hearts value={!!movie.favorite} onChange={(v) => patch({ favorite: v })} />
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
            {!DEMO && (
              <GhostButton onClick={() => (window.location.href = `/api/movies/${movie.id}/export`)}>
                Export .md
              </GhostButton>
            )}
            <GhostButton onClick={() => setEditing(true)}>Edit</GhostButton>
            <GhostButton style={{ color: 'var(--error)' }} onClick={remove}>
              Delete
            </GhostButton>
          </div>
        </Reveal>
      )}
      {movie && (
        <FormModal open={editing} onClose={() => setEditing(false)} title="Edit title">
          <EditMovie
            movie={movie}
            onSaved={() => {
              setEditing(false)
              load()
            }}
            onCancel={() => setEditing(false)}
          />
        </FormModal>
      )}
      {movie && <Dialogues movieId={movie.id} cast={movie.cast || []} movie={movie} mobileFilterOpen={mobileFilter} onMobileFilterOpen={setMobileFilter} mobileAddOpen={mobileAdd} onMobileAddOpen={setMobileAdd} />}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
    </section>
  )
}

export function EditMovie({ movie, onSaved, onCancel }) {
  const [title, setTitle] = useState(movie.title || '')
  const [mediaType, setMediaType] = useState(movie.media_type || 'movie')
  const [director, setDirector] = useState(movie.director || '')
  const [year, setYear] = useState(movie.release_year ? String(movie.release_year) : '')
  const [genres, setGenres] = useState(movie.genres || [])
  const [genreSuggestions, setGenreSuggestions] = useState([])
  useEffect(() => {
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
  }, [])
  const [series, setSeries] = useState(movie.series || '')
  const [seriesIndex, setSeriesIndex] = useState(movie.series_index ? String(movie.series_index) : '')
  const [description, setDescription] = useState(movie.description || '')
  const [posterPath, setPosterPath] = useState(movie.poster_path || '')
  const [posterUrl, setPosterUrl] = useState('')
  const [clearCover, setClearCover] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // §7: the Fetch-metadata icon opens the TMDB/TVDB match picker rather than a
  // permanently-visible lookup block.
  const [pickerOpen, setPickerOpen] = useState(false)
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
      genres,
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
        onFetchMeta={() => setPickerOpen((v) => !v)}
        fetchMetaOpen={pickerOpen}
        search={{ title, year, mediaType }}
      />
      <MediaTypeToggle value={mediaType} onChange={setMediaType} />
      {pickerOpen && (
        <div>
          <MonoLabel className="mb-1.5 block">Pick the right title — replaces details, cast &amp; poster</MonoLabel>
          <MovieLookupPicker auto title={title} year={year} mediaType={mediaType} onPick={resync} />
        </div>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input className="tp-input" placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="tp-input"
          placeholder={isShow ? 'Creator' : 'Director'}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        <input className="tp-input" placeholder="Year" inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder="add a genre…" ariaLabel="Genres" transform={titleCaseGenre} />
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
export function dialogueState(d) {
  return {
    quote: d.quote || '',
    note: d.note || '',
    character: d.character || '',
    actor: d.actor || '',
    timestamp: d.timestamp || '',
    tags: d.tags || [],
    favorite: !!d.favorite,
    rating: d.rating || 0,
    // carry the attached sticker + its draggable seal position through every
    // full-state PUT (nulls = no sticker / unplaced → top-right default)
    sticker_id: d.sticker_id ?? null,
    sticker_x: d.sticker_x ?? null,
    sticker_y: d.sticker_y ?? null,
  }
}

// Dialogues — the FILM STRIP (§6 recipe): strip container → sprocket row →
// edge row (TIPPANI · SAFETY FILM + runtime-random frame code) → frame cards
// separated by divider rows carrying the next code → closing sprockets.
// Server orders by (timestamp IS NULL), timestamp, id — rendered as served.
function Dialogues({ movieId, cast, movie, mobileFilterOpen, onMobileFilterOpen, mobileAddOpen, onMobileAddOpen }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // dialogue being shared
  const [person, setPerson] = useState(null) // actor metadata panel ({ kind, name })
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (mobileAddOpen) { setAdding(true); onMobileAddOpen?.(false); }
  }, [mobileAddOpen])

  // The add form sits at the top of the section; when it opens while the strip
  // is scrolled (the sticky-bar ＋ on mobile), bring it into view.
  const addRef = useRef(null)
  useEffect(() => {
    if (adding && addRef.current) addRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [adding])
  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:view:dialogues', 'tiles')
  const [sort, setSort] = useState({ col: 'timestamp', dir: 'asc' })
  const tileCols = useColumnsAt([[1280, 3], [640, 2]]) // tiles: book-style collage (§8.6)
  const reqSeq = useRef(0)
  const base = useFrameBase() // frame codes regenerate per mount (§6)
  const toggleSort = (col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  const mobile = useIsMobileScreen()

  const { stickers, reload: reloadStickers } = useStickers()
  const { map: actorMap } = usePeople('actor') // name→metadata, for actor face icons
  const castListId = `cast-characters-${movieId}`
  const characters = [...new Set(cast.map((c) => c.character).filter(Boolean))]
  const tagMap = Object.fromEntries(tags.map((t) => [t.name, t]))
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  // Tiles board (mirrors the Library's annotation board): one seed off the movie
  // drives both the masonry and each card's clamp height. Cards clamp to a seeded
  // 3–5 lines with no three-adjacent the same; the board is laid out in source
  // order so the clamp — not a height sort — is what varies it. A one-open-at-a-
  // time accordion expands a dialogue in place and locks the column order while
  // one is open, so nothing reshuffles under the reader.
  const boardSeed = Number(movieId) || 1
  const clampLines = useMemo(() => clampSequence(items?.length || 0, mulberry32(boardSeed)), [items?.length, boardSeed])
  const [expandedId, setExpandedId] = useState(null)
  const toggleExpanded = useCallback((id) => setExpandedId((cur) => (cur === id ? null : id)), [])
  // Keep expandedId honest: if the open dialogue leaves the set (filtered out via
  // patch/save, which don't reset it), clear it — a dangling id keeps lockOrder
  // stuck true and defeats the masonry's rising-edge freeze on the next expand.
  useEffect(() => {
    if (expandedId != null && items && !items.some((x) => x.id === expandedId)) setExpandedId(null)
  }, [items, expandedId])
  // A column-count change (breakpoint / rotation) re-opens masonry packing;
  // collapse any open dialogue so the board re-packs off collapsed heights.
  useEffect(() => { setExpandedId(null) }, [tileCols])

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
    const r = await json('GET', `/dialogues?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) setItems(r.data.dialogues)
    else setError(errText(r))
  }
  useEffect(() => {
    // A movie switch or filter change swaps the tile set, so collapse any open
    // dialogue first (keeps the masonry column lock from latching around an
    // expanded card while the set changes underneath it).
    setExpandedId(null)
    load()
  }, [movieId, tag, fav])
  useEffect(() => {
    loadTags()
  }, [movieId])

  async function add(fields) {
    const r = await json('POST', '/dialogues', { movie_id: movieId, ...fields })
    if (!r.ok) return errText(r, 'could not add dialogue')
    setExpandedId(null) // collapse before the new dialogue reshapes the board
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
    if (r.ok) { setExpandedId(null); load() } // collapse before the shorter set re-packs
    else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (♥/★ clicks).
  async function patch(d, fields) {
    const r = await json('PUT', `/dialogues/${d.id}`, { ...dialogueState(d), ...fields })
    if (!r.ok) return setError(errText(r, 'could not save dialogue'))
    setError('')
    load()
  }

  const filtering = tag || fav

  // Build the normalised share payload from the chosen dialogue + its movie.
  const sharePayload = (d) =>
    movieShare({
      quote: d.quote,
      note: d.note,
      title: movie?.title,
      year: movie?.release_year,
      character: d.character,
      actor: d.actor,
      timestamp: d.timestamp,
      rating: d.rating,
      tags: d.tags,
      tmdbId: movie?.tmdb_id,
      tvdbId: movie?.tvdb_id,
    })

  return (
    <div className="space-y-4">
      {mobile && (
        <MobileSheet
          open={mobileFilterOpen}
          onClose={() => onMobileFilterOpen?.(false)}
          title="Filter dialogues"
          footer={
            <SheetFooter
              count={items ? `${items.length} shown` : ''}
              onReset={() => { setTag(''); setFav(false) }}
              onDone={() => onMobileFilterOpen?.(false)}
            />
          }
        >
          <div className="space-y-5">
            <div>
              <MonoLabel className="mb-2 block">character / tag</MonoLabel>
              <input
                className="tp-input"
                list={characters.length > 0 ? castListId : undefined}
                placeholder="character or tag…"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>
            <div>
              <MonoLabel className="mb-2 block">show only</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
                  ♥ favourites
                </button>
                  </div>
            </div>
            <div>
              <MonoLabel className="mb-2 block">view</MonoLabel>
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>
        </MobileSheet>
      )}
      {!mobile && (
        <div className="flex flex-wrap items-center gap-2">
          <MonoLabel>Dialogues{items ? ` · ${items.length}` : ''}</MonoLabel>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title="Only favourites">
              ♥ Favourites
            </button>
            {tags.length > 0 && (
              <Select
                ariaLabel="Filter by tag"
                value={tag}
                onChange={setTag}
                options={[['', 'All tags'], ...tags.map((t) => [t.name, t.name])]}
              />
            )}
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      )}
      {characters.length > 0 && (
        <datalist id={castListId}>
          {characters.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}

      <ErrorText>{error}</ErrorText>

      {/* Add-dialogue leads the section (collapsed to a slim dashed tile) so
          capturing a line never requires scrolling past the whole strip. */}
      <div ref={addRef}>
        {adding ? (
          <HandCard variant={2} className="p-5">
            <DialogueForm
              onSubmit={add}
              onCancel={() => setAdding(false)}
              submitLabel="Add dialogue"
              castListId={castListId}
              tagSuggestions={Object.keys(tagMap)}
              stickers={stickers}
              reloadStickers={reloadStickers}
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

      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'No dialogues match the filters.' : 'No dialogues yet — capture the first line above.'}
        </EmptyState>
      )}
      {items && items.length > 0 && view === 'tiles' && (
        // Tiles read like the book board (§8.6): a masonry collage (1/2/3 cols by
        // width, seeded off the movie so it never wobbles) whose cards keep the
        // film-frame skin — book layout, film-negative theme. Laid out in SOURCE
        // order so each card's seeded 3–5 line clamp — not a height sort — is what
        // varies the board. Clicking a dialogue expands it in place (chevron
        // affordance, no button); doing so collapses any other and locks the
        // column order so the board never reshuffles. The strip decoration
        // (sprockets/edge/dividers) belongs to the list view.
        <Reveal>
          <Masonry columns={tileCols} gap={16} seed={boardSeed} lockOrder={expandedId != null} order="source">
            {items.map((d, i) => (
              <Frame
                key={d.id}
                d={d}
                wrapClass=""
                tagMap={tagMap}
                stickerMap={stickerMap}
                stickers={stickers}
                reloadStickers={reloadStickers}
                editing={editingId === d.id}
                castListId={castListId}
                onEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(fields) => save(d.id, fields)}
                onPatch={(fields) => patch(d, fields)}
                onDelete={() => remove(d)}
                onShare={() => setShareTarget(d)}
                onOpenPerson={setPerson}
                actorMap={actorMap}
                quoteLines={clampLines[i]}
                expanded={expandedId === d.id}
                onToggleExpand={() => toggleExpanded(d.id)}
              />
            ))}
          </Masonry>
        </Reveal>
      )}
      {items && items.length > 0 && view === 'list' && (
        // List is the FILM STRIP (§6): strip container → sprockets → edge row →
        // frames stacked vertically, divided by rows carrying the next frame code.
        <Reveal className="film-strip">
          <Sprockets count={15} />
          <EdgeRow code={frameCode(base)} />
          {items.map((d, i) => (
            <Fragment key={d.id}>
              {i > 0 && <FrameDivider code={frameCode(base, i)} />}
              <Frame
                d={d}
                tagMap={tagMap}
                stickerMap={stickerMap}
                stickers={stickers}
                reloadStickers={reloadStickers}
                editing={editingId === d.id}
                castListId={castListId}
                onEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(fields) => save(d.id, fields)}
                onPatch={(fields) => patch(d, fields)}
                onDelete={() => remove(d)}
                onShare={() => setShareTarget(d)}
                onOpenPerson={setPerson}
                actorMap={actorMap}
                quoteLines={5}
              />
            </Fragment>
          ))}
          <Sprockets count={15} />
        </Reveal>
      )}
      {items && items.length > 0 && view === 'table' && (
        <DialogueTable
          rows={sortDialogues(items, sort)}
          tagMap={tagMap}
          stickers={stickers}
          reloadStickers={reloadStickers}
          sort={sort}
          onSort={toggleSort}
          editingId={editingId}
          setEditingId={setEditingId}
          save={save}
          remove={remove}
          castListId={castListId}
          onShare={setShareTarget}
        />
      )}

      {shareTarget && <ShareDialog share={sharePayload(shareTarget)} seen={{ kind: 'screen', id: shareTarget.id }} onClose={() => setShareTarget(null)} />}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
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

const DIALOGUE_COLS = [
  { key: 'quote', label: 'Quote' },
  { key: 'character', label: 'Character' },
  { key: 'timestamp', label: 'Time' },
  { key: 'favorite', label: '♥' },
]

// sortDialogues orders rows for the table view: text columns collate, rating and
// favourite compare numerically, ascending/descending per the header click.
function sortDialogues(rows, sort) {
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    switch (sort.col) {
      case 'favorite':
        return ((a.favorite ? 1 : 0) - (b.favorite ? 1 : 0)) * dir
      case 'character':
        return (a.character || '').localeCompare(b.character || '') * dir
      case 'timestamp':
        return (a.timestamp || '').localeCompare(b.timestamp || '') * dir
      default:
        return (a.quote || '').localeCompare(b.quote || '') * dir
    }
  })
}

// DialogueTable — the sortable table view for dialogues, mirroring the Library
// annotation table (shared .ann-table styles): sortable columns + inline edit;
// ♥/★ are shown read-only here and toggled from the tiles/list views.
function DialogueTable({ rows, tagMap, stickers = [], reloadStickers, sort, onSort, editingId, setEditingId, save, remove, castListId, onShare }) {
  const arrow = (k) => (sort.col === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')
  const editingRow = rows.find((d) => d.id === editingId)
  return (
    <div className="ann-table-wrap">
      <table className="ann-table">
        <thead>
          <tr>
            {DIALOGUE_COLS.map((c) => (
              <th
                key={c.key}
                className="sortable"
                onClick={() => onSort(c.key)}
                aria-sort={sort.col === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                {c.label}
                {arrow(c.key)}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="col-quote">
                <ExpandableText text={d.quote} lines={2} style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }} />
                {d.tags?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {d.tags.map((name) => {
                      const t = tagMap[name]
                      return (
                        <TagChip key={name} color={t?.color} style={t?.style}>
                          {name}
                        </TagChip>
                      )
                    })}
                  </div>
                )}
              </td>
              <td className="col-mono">{[d.character, d.actor && `(${d.actor})`].filter(Boolean).join(' ') || '—'}</td>
              <td className="col-mono">{d.timestamp || '—'}</td>
              <td className="col-center">{d.favorite ? '♥' : '—'}</td>
              <td className="col-actions">
                {onShare && <button className="tp-link" onClick={() => onShare(d)}>share</button>}
                <button className="tp-link" onClick={() => setEditingId(d.id)}>edit</button>
                <button className="tp-link tp-link-danger" onClick={() => remove(d)}>del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <FormModal open={!!editingRow} onClose={() => setEditingId(null)} title="Edit dialogue">
        {editingRow && (
          <DialogueForm initial={editingRow} onSubmit={(fields) => save(editingRow.id, fields)} onCancel={() => setEditingId(null)} submitLabel="Save" castListId={castListId} tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
        )}
      </FormModal>
    </div>
  )
}

// Frame — one dialogue as a film frame: Newsreader quote, amber mono credit
// line, tag chips, ♥ + tilted ★ (immediate PUT patches), note, edit/delete.
export function Frame({ d, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, castListId, onEdit, onCancelEdit, onSave, onPatch, onDelete, onShare, onOpenPerson, actorMap = {}, actionsAlwaysVisible = false, editInline = false, wrapClass = 'mx-4 my-1.5', quoteLines = 6, expanded, onToggleExpand }) {
  // wrapClass carries the frame's outer spacing: the strip (list) view indents
  // frames from the film edges (mx-4 my-1.5); the masonry (tiles) view drops it
  // so the card fills its column slot and the masonry gap does the spacing.
  const frameClass = ['film-frame', wrapClass, 'px-5 py-4'].filter(Boolean).join(' ')
  // Accordion mode (tiles board): the parent owns which dialogue is open, so one
  // expands at a time. Elsewhere (list, search modal) each frame keeps its own.
  // The quote clamps to `quoteLines` and a chevron reveals only when it overflows
  // (click the text to expand — no button), mirroring book annotations.
  const accordion = typeof onToggleExpand === 'function'
  const editForm = (
    <DialogueForm initial={d} onSubmit={onSave} onCancel={onCancelEdit} submitLabel="Save" castListId={castListId} tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
  )
  // editInline renders the form in place of the frame — used inside the search
  // QuoteModal (already a pop-up). Elsewhere the edit opens in a FormModal.
  if (editInline && editing) {
    return <article className={frameClass}>{editForm}</article>
  }
  // Credit line; the actor name is clickable (opens the metadata panel) when an
  // onOpenPerson handler is supplied — styled to inherit the amber mono voice.
  const actorLink = (label) =>
    onOpenPerson ? (
      <PersonName
        key="actor"
        kind="actor"
        name={d.actor}
        onOpen={onOpenPerson}
        className=""
        style={{ font: 'inherit', color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
      >
        {label}
      </PersonName>
    ) : (
      label
    )
  const creditParts = [
    d.character || null,
    d.actor ? actorLink(`PLAYED BY ${d.actor}`) : null,
    d.timestamp || null,
  ].filter(Boolean)
  // Attached sticker → corner seal the line flows around (same as book
  // annotations). With a seal present the favourite heart moves down beside the
  // rating so the top-right corner is free for the sticker.
  const sticker = d.sticker_id != null ? stickerMap[d.sticker_id] : null
  const quoteStyle = { fontFamily: 'var(--font-display)', fontSize: 16.5, lineHeight: 1.5, color: 'var(--ink)' }
  return (
    <>
      <FormModal open={editing} onClose={onCancelEdit} title="Edit dialogue">
        {editForm}
      </FormModal>
    <article className={frameClass}>
      {d.quote &&
        (sticker ? (
          <FlowQuote
            text={`“${d.quote}”`}
            quoteStyle={quoteStyle}
            stickerKey={`s${sticker.id}`}
            maxLines={quoteLines} /* collapsed → small corner badge; expanded →
                                     full positioned/draggable seal (see flow.jsx) */
            pos={d.sticker_x != null ? { x: d.sticker_x, y: d.sticker_y } : null}
            onMove={(x, y) => onPatch({ sticker_x: x, sticker_y: y })}
            sticker={<StickerImg sticker={sticker} />}
            open={accordion ? !!expanded : undefined}
            onToggle={accordion ? onToggleExpand : undefined}
          />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <ExpandableText
              text={`“${d.quote}”`}
              lines={quoteLines}
              style={quoteStyle}
              className="min-w-0 flex-1"
              open={accordion ? !!expanded : undefined}
              onToggle={accordion ? onToggleExpand : undefined}
            />
            <Hearts value={!!d.favorite} onChange={(v) => onPatch({ favorite: v })} />
          </div>
        ))}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2">
          {/* Actor face on the quote block (when a portrait is saved for them),
              sized to match the library's author chip. */}
          <PersonPortrait person={actorMap[d.actor]} size={24} />
          <ReviewDot item={d} />
          <span style={amberMono}>
            {creditParts.map((p, i) => (
              <span key={i}>
                {i > 0 ? ' · ' : ''}
                {p}
              </span>
            ))}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {sticker && <Hearts value={!!d.favorite} onChange={(v) => onPatch({ favorite: v })} />}
        </div>
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
      {/* §7 declutter: the ♥ above is the frame's resting mark; share/edit/delete
          reveal on hover (desktop) or fold behind a ⋯ overflow (mobile). */}
      <div className="mt-1 flex justify-end">
        <QuoteActions
          onShare={onShare || undefined}
          onEdit={onEdit}
          onDelete={onDelete}
          alwaysVisible={actionsAlwaysVisible}
        />
      </div>
    </article>
    </>
  )
}

// DialogueForm serves both add (no initial) and inline edit (initial set).
// Leaving actor blank lets the server auto-fill it from the movie's cast.
// Exported for Home's favourite-tile inline edit (same form, same contract).
export function DialogueForm({ initial, onSubmit, onCancel, submitLabel, castListId, tagSuggestions = [], stickers = [], reloadStickers }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [character, setCharacter] = useState(initial?.character || '')
  const [actor, setActor] = useState(initial?.actor || '')
  const [timestamp, setTimestamp] = useState(initial?.timestamp || '')
  const [note, setNote] = useState(initial?.note || '')
  const [tags, setTags] = useState(initial?.tags || [])
  const [stickerId, setStickerId] = useState(initial?.sticker_id ?? null)
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
      tags,
      // favorite/rating are edited on the frame, not in the form — but PUT is
      // full-state, so carry the existing values through.
      favorite: !!initial?.favorite,
      rating: initial?.rating || 0,
      // sticker: id chosen here; position is dragged on the frame, carry through.
      sticker_id: stickerId,
      sticker_x: initial?.sticker_x ?? null,
      sticker_y: initial?.sticker_y ?? null,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setQuote('')
      setCharacter('')
      setActor('')
      setTimestamp('')
      setNote('')
      setTags([])
      setStickerId(null)
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
      <TokenInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="add a tag…" ariaLabel="Tags" />
      <div>
        <MonoLabel className="mb-1.5 block">Sticker</MonoLabel>
        <StickerPicker value={stickerId} onChange={setStickerId} stickers={stickers} reload={reloadStickers} />
      </div>
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
