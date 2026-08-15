import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { categoryVar } from './theme.js'
import { DEMO, coverImgURL, json, errText, downloadPost } from './api.js'
import { CoverControls, CoverPreview, MovieLookupPicker, idNum } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { ScreenHelpSheet } from './help.jsx'
import { WorkDetails } from './WorkDetails.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, copyQuote, movieShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { actionsFor, atOverflow, atRow } from './actions.jsx'
import { selectionClick, useSelection } from './selection.jsx'
import { facetValue, facetValues, publishSearchSeed, seedableChips, withFacet, withFacetValues, workSeedChip } from './facets.js'
import { SelectionBar } from './SelectionBar.jsx'
import { CreditFaces, PersonCredit, PersonModal, PersonName, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import {
  ACTIVE_STATUS,
  GroupHeading,
  HeroCounts,
  InProgressCapDialog,
  MobileDetailBar,
  SHELF_CAPS,
  ShelfControl,
  ShelfDateDialog,
  WorkCard,
  WorkHero,
  WorkListScaffold,
  capKeyFor,
  countQuotes,
  groupWorks,
  isActive,
  moveLabel,
  pinInProgress,
  statusFilter,
  wishFilter,
} from './works.jsx'
import {
  ANNOTATION_HEX,
  byLastRead,
  bySeries,
  clampSequence,
  ColorSwatches,
  ConfirmDialog,
  EdgeRow,
  EmptyState,
  ErrorText,
  ExpandableText,
  filterChipClass,
  FormModal,
  frameCode,
  FrameCode,
  GenreFilter,
  GhostButton,
  HandCard,
  HandNote,
  Hearts,
  IconButton,
  IconDelete,
  IconDetails,
  IconExport,
  IconFilter,
  IconHelp,
  IconMetadata,
  IconPlus,
  IconWatching,
  Lightbox,
  Masonry,
  MobileSheet,
  MonoLabel,
  NameInput,
  MoreMenu,
  mulberry32,
  PageHeader,
  PickMark,
  Placeholder,
  QuizSkipMark,
  QuoteActions,
  QuoteTools,
  ReviewDot,
  Select,
  seriesLabel,
  SheetFooter,
  splitCommas,
  Sprockets,
  TableActions,
  TagChip,
  titleCaseGenre,
  todayPartial,
  Toggle,
  TokenInput,
  Tooltip,
  BOARD_COLUMNS,
  useCardMenu,
  useColumnsAt,
  useCoverSize,
  useFrameBase,
  useFormHost,
  useIsMobileScreen,
  usePersistedState,
  useReveal,
  ViewToggle,
  formatYear,
  parseYearInput,
} from './ui.jsx'

// Movies — the reel wall (§8.6, mockups 12–14) + movie detail with the
// filmstrip (§8.7 + §6 recipe, mockups 15–16). Dialogues mirror annotations
// (PLAN §3b); tags are objects now — chips take color/style from GET /tags.
// Adding anything — a title, a line of dialogue, an import — belongs to the
// shell's one ＋ Add surface (`onAdd`), which since 1.4.1 opens on the right
// thing for the page it is on; `dataNonce` is how anything saved there tells
// whichever list it changed — the poster grid or a title's lines — to refetch.
export default function Movies({ openId, onOpen, onClose, creditSeparators, onAdd, dataNonce }) {
  if (openId) {
    return (
      <MovieDetail
        id={openId}
        onClose={onClose}
        creditSeparators={creditSeparators}
        onAdd={onAdd}
        dataNonce={dataNonce}
      />
    )
  }
  return <MovieList onOpen={onOpen} creditSeparators={creditSeparators} dataNonce={dataNonce} />
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

// Group-by dimensions for the Catalogue. "Collection" is movies.series — the
// column the 0006 migration already called a "franchise / collection name" —
// relabelled here because "series" means a TV show on this page.
const GROUP_OPTIONS = [
  ['none', 'Titles'],
  ['series', 'Collection'],
  ['author', 'Director'],
  ['decade', 'Decade'],
  ['genre', 'Genre'],
]

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
        <Tooltip label="View this poster full screen" className="w-full">
          <button
            type="button"
            className="cover-zoom-btn"
            aria-label={title ? `View poster of ${title} full screen` : 'View poster full screen'}
            onClick={() => setZoom(true)}
          >
            {img}
          </button>
        </Tooltip>
        {zoom && <Lightbox path={path} title={title} onClose={() => setZoom(false)} />}
      </>
    )
  }
  return <Placeholder kind="POSTER" className={'w-full ' + className} />
}

// movieState is the full PUT body for a movie (PUT is full-state, and omitting
// tmdb_id keeps it on the manual-update path) — used by the detail-header ♥.
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
    // imdb_id is full-state, so the detail-header ♥ has to carry it or
    // favouriting a film would clear the id — the same trap 0034, 0035, 0036
    // and 0037 each caught on a different column.
    imdb_id: m.imdb_id || '',
    // status / progress / reads are absent on purpose: they belong to
    // PUT /movies/:id/status, so an ordinary save cannot rewrite the watch log.
  }
}

// setMovieStatus moves one title to a shelf state, through the endpoint that
// keeps the status and the watch log consistent. Returns an error string.
async function setMovieStatus(id, body) {
  const r = await json('PUT', `/movies/${id}/status`, body)
  return r.ok ? '' : errText(r, 'could not save')
}

// ---- movie list: poster grid mirroring Library (§8.6) ----

function MovieList({ onOpen, creditSeparators, dataNonce }) {
  const [movies, setMovies] = useState(null)
  const { map: directorMap } = usePeople('director') // name→metadata, for director/creator face chips
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
  const [status, setStatus] = useState(null) // GET /metadata/status → Add-movie is status-aware
  // ONE LIST, NOT TEN useStates — see BookList, which does the same with nine.
  // The tenth here is `media`, the films/shows split, which is board-only: there
  // is no facet for it, so it is dropped on the way to the search box.
  const [filters, setFilters] = useState([])
  const [groupBy, setGroupBy] = useState('none') // none | series | author | decade | genre
  // Derived once per change, not per render: `states` is a fresh array each read
  // and the `shown` memo has it in its deps.
  const f = useMemo(() => ({
    mediaType: facetValue(filters, 'media'), // '' = all, 'movie', 'show'
    genre: facetValue(filters, 'genre'),
    series: facetValue(filters, 'series'),
    fav: facetValue(filters, 'favourite') === 'yes',
    tagged: facetValue(filters, 'tagged') === 'yes', // has at least one tagged dialogue
    noted: facetValue(filters, 'noted') === 'yes', // has at least one dialogue with a note
    wish: { yes: 'wishlist', no: 'annotated' }[facetValue(filters, 'wishlist')] || '',
    states: facetValues(filters, 'shelf'), // shelf states kept; [] = every state
  }), [filters])
  const { mediaType, genre, series, fav, tagged, noted, wish, states } = f
  const setMediaType = (v) => setFilters((c) => withFacet(c, 'media', v))
  const setGenre = (v) => setFilters((c) => withFacet(c, 'genre', v))
  const setSeries = (v) => setFilters((c) => withFacet(c, 'series', v))
  const setFav = (v) => setFilters((c) => withFacet(c, 'favourite', v ? 'yes' : ''))
  const setTagged = (v) => setFilters((c) => withFacet(c, 'tagged', v ? 'yes' : ''))
  const setNoted = (v) => setFilters((c) => withFacet(c, 'noted', v ? 'yes' : ''))
  const setWish = (v) => setFilters((c) => withFacet(c, 'wishlist', v === 'wishlist' ? 'yes' : v === 'annotated' ? 'no' : ''))
  const setStates = (v) => setFilters((c) => withFacetValues(c, 'shelf', v))
  const [sort, setSort] = useState('recent')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:movies', 150) // set from Settings
  const mobile = useIsMobileScreen()

  // Mirrors the Library: a search started from a filtered catalogue searches
  // the filtered catalogue. `mediaType` has no facet to map onto, so a board
  // filtered to shows seeds everything else and leaves that one behind rather
  // than seeding a facet that would empty the results.
  useEffect(() => {
    publishSearchSeed(seedableChips(filters))
    return () => publishSearchSeed([])
  }, [filters])

  async function load() {
    const r = await json('GET', '/movies')
    if (r.ok) setMovies(r.data.movies)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
    // A title added through the shell's Add surface lands server-side without this
    // list knowing — and when the surface was opened FROM here, nothing remounts
    // on the way back, so there is no other moment to refetch at. The key status
    // is fetched once, not per nonce: it does not change when a film is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataNonce])
  useEffect(() => {
    json('GET', '/metadata/status').then((r) => {
      if (r.ok) setStatus(r.data)
    })
  }, [])

  const tmdbSource = status?.tmdb?.source
  const hasShows = (movies || []).some((m) => (m.media_type || 'movie') === 'show')
  // Most-common genres first — the select lists them in that order, so the ones
  // you actually use are at the top of it.
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
    if (tagged) list = list.filter((m) => (m.tagged_count || 0) > 0)
    if (noted) list = list.filter((m) => (m.noted_count || 0) > 0)
    list = statusFilter(list, states)
    list = wishFilter(list, wish, (m) => m.dialogue_count || 0)
    // Default view = server order with what you're watching floated to the top;
    // an explicit sort from the menu takes over completely.
    if (sort === 'recent') return pinInProgress(list, 'movie')
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'year') list.sort((a, b) => (b.release_year || 0) - (a.release_year || 0))
    else if (sort === 'series') list.sort(bySeries)
    else if (sort === 'read') list.sort(byLastRead)
    return list
  }, [movies, mediaType, genre, series, fav, tagged, noted, states, wish, sort])

  // Over `shown`, the visible order — see the Library board and useSelection.
  const selection = useSelection(shown.map((m) => m.id))
  const afterBulk = () => {
    selection.clear()
    load()
  }
  // Edit one title from the bar — see the Library board for why this is an id
  // rather than the row it already has on screen.
  const [editWork, setEditWork] = useState(null)

  // Grouping only buckets the view — a title still appears in the flat list, and
  // because media_type lives on the same row as series, one collection can hold
  // a film and a show together (Twin Peaks and Fire Walk With Me).
  const grouped = useMemo(
    () =>
      groupBy === 'none'
        ? null
        : groupWorks(shown, groupBy, {
            credit: (m) => m.director,
            splitCredit: true,
            creditResidual: 'Unknown director',
            year: (m) => m.release_year,
            genres: (m) => m.genres || [],
            series: (m) => m.series,
            seps: creditSeps,
            sortMembers: (items, dim) => (dim === 'series' ? [...items].sort(bySeries) : items),
          }),
    [shown, groupBy, creditSeps],
  )

  const films = movies ? movies.length : 0
  const lines = movies ? movies.reduce((n, m) => n + (m.dialogue_count || 0), 0) : 0
  const counts = movies
    ? `${films} title${films === 1 ? '' : 's'} · ${lines} dialogue${lines === 1 ? '' : 's'}`
    : null

  return (
    <WorkListScaffold
      mobile={mobile}
      title="Movies & Shows"
      counts={counts}
      error={error}
      onExport={() => setExporting(true)}
      headerAside={
        <MonoLabel className="hidden sm:inline">
          {tmdbSource === 'none' ? 'no TMDB key — manual entry' : 'lookup: title + year'}
        </MonoLabel>
      }
      loaded={movies != null}
      hasItems={!!(movies && movies.length > 0)}
      shownCount={shown.length}
      emptyText="No titles yet — look one up on TMDB/TVDB or add it manually."
      noMatchText="no titles match these filters"
      genres={genres}
      genre={genre}
      setGenre={setGenre}
      fav={fav}
      setFav={setFav}
      tagged={tagged}
      setTagged={setTagged}
      noted={noted}
      setNoted={setNoted}
      wish={wish}
      setWish={setWish}
      states={states}
      setStates={setStates}
      kind="movie"
      noun="title"
      seriesNames={seriesNames}
      series={series}
      setSeries={setSeries}
      sort={sort}
      setSort={setSort}
      seriesNoun="collection"
      sortOptions={[['recent', 'Recent'], ['title', 'Title'], ['year', 'Year'], ['series', 'Collection'], ['read', 'Last watched']]}
      leading={
        hasShows &&
        [['', 'All'], ['movie', 'Movies'], ['show', 'Shows']].map(([k, label]) => (
          <button key={k} className={filterChipClass(mediaType === k)} onClick={() => setMediaType(k)}>
            {label}
          </button>
        ))
      }
      leadingMobile={
        hasShows && (
          <div>
            <MonoLabel className="mb-2 block">type</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              {[['', 'All'], ['movie', 'Movies'], ['show', 'Shows']].map(([k, label]) => (
                <button key={k} className={filterChipClass(mediaType === k)} onClick={() => setMediaType(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )
      }
      trailing={
        <label className="flex items-center gap-2">
          <MonoLabel>group</MonoLabel>
          <Select
            ariaLabel="Group by"
            value={groupBy}
            onChange={setGroupBy}
            options={GROUP_OPTIONS}
          />
        </label>
      }
      trailingMobile={
        <div>
          <MonoLabel className="mb-2 block">group</MonoLabel>
          <Select ariaLabel="Group by" value={groupBy} onChange={setGroupBy} options={GROUP_OPTIONS} />
        </div>
      }
      onReset={() => { setFilters([]); setGroupBy('none'); setSort('recent') }}
      exportDialog={
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
      }
    >
      {/* The MODE, not the count — see useSelection. */}
      {selection.open && (
        <SelectionBar selection={selection} rows={shown} onDone={afterBulk} onEdit={setEditWork} />
      )}
      {editWork != null && (
        <EditWorkModal
          kind="movies"
          id={editWork}
          title="Edit title"
          onDone={() => {
            setEditWork(null)
            afterBulk()
          }}
          onCancel={() => setEditWork(null)}
        />
      )}
      {grouped ? (
        <div className="space-y-10">
          {grouped.map((g) => (
            <section key={g.key}>
              <GroupHeading label={g.label} count={g.items.length} noun="title" />
              <div
                className="grid gap-x-5 gap-y-8"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}
              >
                {g.items.map((m) => (
                  <WorkCard key={m.id} kind="movie" item={m} onOpen={onOpen} people={directorMap} seps={creditSeps} selection={selection} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Reveal
          className="grid gap-x-5 gap-y-8"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}
        >
          {shown.map((m) => (
            <WorkCard key={m.id} kind="movie" item={m} onOpen={onOpen} people={directorMap} seps={creditSeps} selection={selection} />
          ))}
        </Reveal>
      )}
    </WorkListScaffold>
  )
}


// ---- add movie (§8.4): look-up / manual forms, now hosted by AddSurface (§7).
// The old modal wrapper lives in AddSurface; the forms below are exported. ----

// candSourceID is a candidate's id within its supplier ("#603"). SourceIcon
// already names the supplier, so a row only needs the id half.
export function candSourceID(c) {
  return `#${c.source === 'tvdb' ? c.source_id : c.tmdb_id || c.source_id}`
}

// candSource labels a candidate's supplier + id (e.g. "TMDB #603", "TVDB #121361").
export function candSource(c) {
  return `${(c.source || 'tmdb').toUpperCase()} ${candSourceID(c)}`
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
            <GhostButton icon={<IconMetadata />} type="button" className="shrink-0" disabled={busy} onClick={() => onEnrich(e.id)}>
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

// `formId` + `onBusy` are the Add-manually popup's header ✓ reaching in: the
// commit control sits in the dialog header now, beside close, so the form is
// submitted from outside via the HTML `form=` attribute and reports its in-flight
// state up so that button can grey itself. See ManualTab in Library.jsx.
export function ManualMovie({ mediaType, setMediaType, title, setTitle, onAdded, formId, onBusy }) {
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
  const isShow = mediaType === 'show'

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    onBusy?.(true)
    setError('')
    const r = await json('POST', '/movies', {
      title: title.trim(),
      media_type: mediaType,
      director: director.trim() || undefined,
      release_year: year ? parseYearInput(year).year : undefined,
      release_circa: year ? parseYearInput(year).circa : undefined,
      genres,
      series: series.trim() || undefined,
      series_index: Number(seriesIndex) || 0,
      description: description.trim() || undefined,
    })
    onBusy?.(false)
    if (r.ok) onAdded(r.data) // hand back the created title (capture targets it)
    else setError(errText(r, 'could not add title'))
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <NameInput placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <NameInput
          placeholder={isShow ? 'Creator' : 'Director'}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        <input className="tp-input" placeholder="Year" inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder="add a genre…" ariaLabel="Genres" transform={titleCaseGenre} />
        <NameInput placeholder="Collection / franchise" value={series} onChange={(e) => setSeries(e.target.value)} />
        <input
          className="tp-input"
          placeholder="Collection #"
          inputMode="decimal"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
      </div>
      <textarea className="tp-input" rows="3" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      {/* Title is the one must-fill field. The ✓ in the popup header stays greyed
          until it has one rather than accepting the press and answering with an
          error; this line says why, because a disabled icon cannot. */}
      {!title.trim() && <p className="microcopy" style={{ color: 'var(--faint)' }}>A title is required to save.</p>}
    </form>
  )
}

// MediaTypeToggle — the Movie | Show switch, reused by the add + edit forms
// (TV is folded into movies via media_type).
export function MediaTypeToggle({ value, onChange }) {
  return <Toggle ariaLabel="Media type" value={value} onChange={onChange} options={[['movie', 'Movie'], ['show', 'Show']]} />
}

// ---- movie detail (§8.7): poster header + filmstrip of dialogues ----

function MovieDetail({ id, onClose, creditSeparators, onAdd, dataNonce }) {
  const [movie, setMovie] = useState(null)
  const [editing, setEditing] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false) // phone: help opens from the ⋯ menu
  const [error, setError] = useState('')
  const [mobileFilter, setMobileFilter] = useState(false)
  // { kind:'director', name } open in the metadata panel — captured at click time.
  const [person, setPerson] = useState(null)
  // Live unfiltered dialogue count, reported up by <Dialogues>: it decides the
  // Wishlist tag, so the first dialogue retracts the tag straight away.
  // Live unfiltered dialogue counts, reported up by <Dialogues> — total, plus how
  // many are favourited / noted / tagged. The total decides the Wishlist tag; all
  // four print in the hero (see HeroCounts). null until the lines land, and a hero
  // with no counts prints none rather than printing zeroes.
  const [lineStats, setLineStats] = useState(null)
  const lineCount = lineStats?.total ?? null
  // Shelf machinery, mirroring the Library's: `pending` is a transition waiting
  // on its date, `capPool` the titles already watching while the cap dialog is up.
  const [pending, setPending] = useState(null) // { status, date }
  const [capPool, setCapPool] = useState(null)
  const [capBusyId, setCapBusyId] = useState(null)
  const [capError, setCapError] = useState('')
  const [shelfBusy, setShelfBusy] = useState(false)
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
    setLineStats(null)
    load()
  }, [id])

  // Mirrors BookDetail: from inside a film, Search means search this film. Chip
  // shows the title, wire carries the id.
  useEffect(() => {
    publishSearchSeed(movie ? [workSeedChip('movie', movie.id, movie.title)] : [])
    return () => publishSearchSeed([])
  }, [movie])

  // ---- shelf transitions ------------------------------------------------------
  // The films and shows caps are separate pools (2 · 5): a binge-watched series
  // should not crowd out the one film you have on the go.
  const capKey = movie ? capKeyFor('movie', movie) : 'movie'

  async function save(status, date) {
    setShelfBusy(true)
    // Carry the current position through — a transition is about the status, and
    // a show's season/episode is what the server derives its percentage from.
    const body = {
      status,
      progress: movie?.progress || 0,
      pos_unit: movie?.pos_unit || '',
      pos: movie?.pos || 0,
      pos_total: movie?.pos_total || 0,
      season: movie?.season || 0,
      season_total: movie?.season_total || 0,
    }
    if (status === ACTIVE_STATUS.movie) body.started_at = date || ''
    else if (status === 'completed' || status === 'abandoned') body.finished_at = date || ''
    const r = await json('PUT', `/movies/${id}/status`, body)
    setShelfBusy(false)
    if (r.ok) setMovie(r.data)
    else setError(errText(r, 'could not save'))
  }

  async function pick(next) {
    if (!movie) return
    if (next === ACTIVE_STATUS.movie && movie.status !== 'paused') {
      const r = await json('GET', '/movies')
      if (!r.ok) return setError(errText(r))
      const pool = (r.data.movies || []).filter(
        (m) => isActive('movie', m) && m.id !== movie.id && capKeyFor('movie', m) === capKey,
      )
      if (pool.length >= SHELF_CAPS[capKey]) {
        setCapError('')
        setCapPool(pool)
        return
      }
    }
    if (next === '' || next === 'paused') return save(next, '')
    setPending({ status: next, date: todayPartial() })
  }

  async function releaseWatching(item) {
    setCapBusyId(item.id)
    const err = await setMovieStatus(item.id, { status: 'completed', finished_at: todayPartial() })
    setCapBusyId(null)
    if (err) return setCapError(err)
    const left = capPool.filter((m) => m.id !== item.id)
    if (left.length < SHELF_CAPS[capKey]) {
      setCapPool(null)
      setPending({ status: ACTIVE_STATUS.movie, date: todayPartial() })
      return
    }
    setCapPool(left)
  }

  // `patch` is either { progress } or a season/episode position — the server
  // derives the percentage from the latter (whole earlier seasons counting in
  // full), so a show's bar advances as you work through the run.
  async function saveProgress(patch) {
    setShelfBusy(true)
    const r = await json('PUT', `/movies/${id}/status`, { status: movie.status, ...patch })
    setShelfBusy(false)
    if (r.ok) setMovie(r.data)
    else setError(errText(r, 'could not save'))
  }

  async function remove() {
    if (!confirm(`Delete "${movie.title}" and all its dialogues?`)) return
    // As with a book: this view closes, so there is nothing here to reload.
    const r = await deleteWithUndo(`/movies/${id}`, { label: 'title deleted' })
    if (r.ok) onClose()
    else setError(errText(r))
  }

  // patch PUTs the movie's full current state with one field changed (♥).
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
  // The credit line mixes portrait chips (tall) with mono text, so it lays out as
  // an inline flex row that vertically CENTRES everything — otherwise the text
  // sits on the baseline and reads low against the face discs.
  const directorNode =
    dirNames.length > 0 ? (
      <span key="director" style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
        <span>{isShow ? 'CREATED BY' : 'DIR.'}</span>
        {dirNames.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && <span aria-hidden="true" style={{ marginLeft: -2 }}>,</span>}
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
  // The TMDB / TheTVDB ids used to ride this line as two more segments. They are
  // supplier plumbing — what a re-sync pulls from — not something anyone reads a
  // film page to learn, so they moved into the Details panel, where each carries
  // an InfoDot explaining what it is and a link out to the source record.
  const metaParts = movie
    ? [
        directorNode,
        formatYear(movie.release_year, movie.release_circa) || null,
        seriesLabel(movie) || null,
      ].filter(Boolean)
    : []

  const detailTitle = movie ? (movie.title || 'Untitled') : ''
  const detailMeta = movie ? (movie.director || formatYear(movie.release_year, movie.release_circa) || '') : ''

  return (
    <section className="space-y-6 md:pt-5" data-screen-label="movie-detail">
      {mobile && (
        <MobileDetailBar
          onClose={onClose}
          title={detailTitle}
          meta={detailMeta}
          actions={
            <>
              <IconButton icon={<IconFilter />} label="Filter"
            ariaLabel="Filter dialogues" onClick={() => setMobileFilter(true)} />
              {/* The shell's one Add surface, opened on Capture with this title
                  already the target — not a second add form of its own. */}
              <IconButton icon={<IconPlus />} label="Capture"
            ariaLabel="Capture a line" onClick={() => onAdd?.('quote', { type: 'movie', id })} />
              <MoreMenu
                items={[
                  {
                    icon: <IconWatching size={24} />,
                    label: moveLabel('movie', movie?.status || '', ACTIVE_STATUS.movie),
                    onClick: () => pick(ACTIVE_STATUS.movie),
                  },
                  ...(DEMO ? [] : [{ icon: <IconExport />, label: 'Export .md', onClick: () => { if (movie) window.location.href = `/api/movies/${movie.id}/export` } }]),
                  { icon: <IconDetails />, label: 'Details', onClick: () => setEditing(true) },
                  { icon: <IconHelp size={24} />, label: 'What’s on this screen', onClick: () => setHelpOpen(true) },
                  { icon: <IconDelete />, label: 'Delete', onClick: remove, danger: true },
                ]}
              />
            </>
          }
        />
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
        <Reveal>
          <WorkHero
            cover={<Poster path={movie.poster_path} title={movie.title} zoomable />}
            title={movie.title}
            titleSize={27}
            meta={
              metaParts.length > 0 && (
                <div style={{ ...amberMono, display: 'flex', flexWrap: 'wrap', alignItems: 'center', rowGap: 2 }}>
                  {metaParts.map((part, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span aria-hidden="true" style={{ margin: '0 8px' }}>·</span>}
                      {part}
                    </Fragment>
                  ))}
                </div>
              )
            }
            // What this title is HOLDING, above the fold. Amber rather than the
            // app accent, because the credit line directly above it is amber and
            // two accents on one card read as two unrelated systems.
            counts={<HeroCounts counts={lineStats} noun={['line', 'lines']} tone="amber" />}
            favorite={movie.favorite}
            onFavorite={(v) => patch({ favorite: v })}
            // Shelf state beside the hearts: the state chip (transitions and, while
            // watching, the progress field in its popover) and the ×N watch counter.
            tags={
              <ShelfControl
                kind="movie"
                item={movie}
                status={movie.status}
                progress={movie.progress}
                pos={movie}
                reads={movie.reads}
                onReadsChanged={load}
                wishlist={lineCount === 0}
                busy={shelfBusy}
                onSelect={pick}
                onProgress={saveProgress}
              />
            }
            genres={movie.genres || []}
            description={movie.description}
            // Desktop only: on mobile these same actions live in the sticky bar's
            // ⋯ overflow above, and a second standing row just duplicated them.
            actions={
              mobile ? null : (
                <>
                  <GhostButton onClick={() => pick(ACTIVE_STATUS.movie)} disabled={shelfBusy}>
                    {moveLabel('movie', movie.status || '', ACTIVE_STATUS.movie)}
                  </GhostButton>
                  {!DEMO && (
                    <IconButton
                        icon={<IconExport />}
                        label="Export"
            ariaLabel="Export as Markdown"
                        onClick={() => (window.location.href = `/api/movies/${movie.id}/export`)}
                      tooltip="Export as Markdown"
                    />
                  )}
                  <IconButton icon={<IconDetails />} label="Details"
            ariaLabel="Details" onClick={() => setEditing(true)} tooltip="Details and metadata" />
                  <IconButton
                      icon={<IconDelete />}
                      label="Delete"
            ariaLabel="Delete this title"
                      onClick={remove}
                      danger
                    tooltip="Delete this title"
                  />
                </>
              )
            }
          />
        </Reveal>
      )}
      {movie && (
        <WorkDetails
          open={editing}
          onClose={() => setEditing(false)}
          kind="movie"
          item={movie}
          onChanged={setMovie}
          onDelete={remove}
        />
      )}
      <InProgressCapDialog
        open={!!capPool}
        items={(capPool || []).map((m) => ({ id: m.id, title: m.title, meta: [m.director, formatYear(m.release_year, m.release_circa) || null].filter(Boolean).join(' · ') }))}
        cap={SHELF_CAPS[capKey]}
        noun={capKey === 'show' ? 'show' : 'film'}
        verb="watching"
        pastLabel="Mark as watched"
        busyId={capBusyId}
        error={capError}
        onRelease={releaseWatching}
        onCancel={() => setCapPool(null)}
        onProceed={() => { setCapPool(null); setPending({ status: ACTIVE_STATUS.movie, date: todayPartial() }) }}
      />
      <ShelfDateDialog
        open={!!pending}
        title={pending ? moveLabel('movie', movie?.status || '', pending.status) : ''}
        label={pending?.status === ACTIVE_STATUS.movie ? 'Started' : pending?.status === 'abandoned' ? 'Gave up' : 'Finished'}
        value={pending?.date || ''}
        onChange={(v) => setPending((p) => (p ? { ...p, date: v } : p))}
        onCancel={() => setPending(null)}
        onConfirm={() => { const p = pending; setPending(null); save(p.status, p.date) }}
      />
      {movie && <Dialogues movieId={movie.id} cast={movie.cast || []} movie={movie} creditSeps={creditSeps} onStats={setLineStats} mobileFilterOpen={mobileFilter} onMobileFilterOpen={setMobileFilter} onAdd={onAdd} dataNonce={dataNonce} />}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
      {/* Phone-only route into this screen's help — see the Library twin. */}
      <ScreenHelpSheet screen="movie-detail" open={helpOpen} onClose={() => setHelpOpen(false)} />
    </section>
  )
}


// EditWorkModal — the work's own edit form, opened from the selection bar when
// exactly ONE work is picked.
//
// It FETCHES the row rather than taking the one the board is already holding.
// The list endpoints send a summary — no description, no genres — and every form
// in this app is full-state, so handing a summary to one would write two empty
// fields over two real ones on the next Save. The console's InlineEdit made the
// same call for the same reason; this is that shape in a dialog.
function EditWorkModal({ kind, id, title, onDone, onCancel }) {
  const [row, setRow] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    setRow(null)
    setErr('')
    json('GET', `/${kind}/${id}`).then((r) => (r.ok ? setRow(r.data) : setErr(errText(r))))
  }, [kind, id])
  return (
    <FormModal open onClose={onCancel} title={title}>
      {err ? (
        <ErrorText>{err}</ErrorText>
      ) : !row ? (
        <p className="microcopy">loading…</p>
      ) : (
        <EditMovie movie={row} onSaved={onDone} onCancel={onCancel} />
      )}
    </FormModal>
  )
}

export function EditMovie({ movie, onSaved, onCancel }) {
  const [title, setTitle] = useState(movie.title || '')
  const [mediaType, setMediaType] = useState(movie.media_type || 'movie')
  const [director, setDirector] = useState(movie.director || '')
  const [year, setYear] = useState(formatYear(movie.release_year, movie.release_circa))
  const [genres, setGenres] = useState(movie.genres || [])
  const [genreSuggestions, setGenreSuggestions] = useState([])
  useEffect(() => {
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
  }, [])
  const [series, setSeries] = useState(movie.series || '')
  const [seriesIndex, setSeriesIndex] = useState(movie.series_index ? String(movie.series_index) : '')
  const [description, setDescription] = useState(movie.description || '')
  // The supplier ids, typed rather than only fetched: correcting one is how you
  // point a title at the right record when its name matches several. They feed
  // the picker below, so the next search returns that record first.
  const [tmdbId, setTmdbId] = useState(movie.tmdb_id ? String(movie.tmdb_id) : '')
  const [tvdbId, setTvdbId] = useState(movie.tvdb_id ? String(movie.tvdb_id) : '')
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
      release_year: year ? parseYearInput(year).year : undefined,
      release_circa: year ? parseYearInput(year).circa : undefined,
      genres,
      series: series.trim(),
      series_index: Number(seriesIndex) || 0,
      description: description.trim(),
      // favorite is edited on the detail header — carry it (PUT is full-state).
      favorite: !!movie.favorite,
      // An emptied field sends 0, which is how the API spells "clear it".
      tmdb_id: idNum(tmdbId),
      tvdb_id: idNum(tvdbId),
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
        search={{ title, year, mediaType, tmdbId, tvdbId }}
      />
      <MediaTypeToggle value={mediaType} onChange={setMediaType} />
      {pickerOpen && (
        <div>
          <MonoLabel className="mb-1.5 block">Pick the right title — replaces details, cast &amp; poster</MonoLabel>
          <MovieLookupPicker auto title={title} year={year} mediaType={mediaType} tmdbId={tmdbId} tvdbId={tvdbId} onPick={resync} />
        </div>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <NameInput placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <NameInput
          placeholder={isShow ? 'Creator' : 'Director'}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        <input className="tp-input" placeholder="Year" inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder="add a genre…" ariaLabel="Genres" transform={titleCaseGenre} />
        <NameInput placeholder="Collection / franchise" value={series} onChange={(e) => setSeries(e.target.value)} />
        <input
          className="tp-input"
          placeholder="Collection #"
          inputMode="decimal"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
        {/* Digits only: both ids are the bare number out of the supplier's URL,
            and pasting the whole URL is the obvious mistake to absorb rather
            than reject. Emptying a field clears that id. */}
        <input
          className="tp-input"
          placeholder="TMDB id"
          inputMode="numeric"
          value={tmdbId}
          onChange={(e) => setTmdbId(e.target.value.replace(/\D/g, '').slice(0, 12))}
        />
        <input
          className="tp-input"
          placeholder="TheTVDB id"
          inputMode="numeric"
          value={tvdbId}
          onChange={(e) => setTvdbId(e.target.value.replace(/\D/g, '').slice(0, 12))}
        />
      </div>
      <textarea className="tp-input" rows="4" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        {/* Greyed until the must-fill field has a value: an empty title would
            be refused by the handler anyway, so the button says so first. */}
        <button className="tp-btn tp-btn-primary" disabled={busy || !title.trim()}>
          Save
        </button>
        <GhostButton type="button" onClick={onCancel}>
          Cancel
        </GhostButton>
      </div>
    </form>
  )
}

// episodeLabel renders a show line's episode locator the way people write it:
// S2E5, or S2 when the season is all that's recorded. '' when there is none —
// which is every film line, so a caller can join it into a credit unconditionally.
//
// The null checks are deliberate, not `|| ''`: season 0 is a real season (it is
// where a series keeps its specials), so 0 has to render.
export function episodeLabel(d) {
  if (d?.season == null) return ''
  return d.episode == null ? `S${d.season}` : `S${d.season}E${d.episode}`
}

// countOrNull turns a form field back into what the API wants for a nullable
// count: null for blank (unset), a number otherwise. '' and '0' are different
// answers here — season 0 is where a series keeps its specials.
export function countOrNull(v) {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 ? n : null
}

// dialogueState builds the full PUT body from a dialogue row — PUT is
// full-state, so every field must be carried even when only one changes.
export function dialogueState(d) {
  return {
    quote: d.quote || '',
    note: d.note || '',
    color: d.color || 'yellow',
    character: d.character || '',
    actor: d.actor || '',
    timestamp: d.timestamp || '',
    // Shows only; null on a film's lines. ?? not ||, so season 0 survives.
    season: d.season ?? null,
    episode: d.episode ?? null,
    tags: d.tags || [],
    favorite: !!d.favorite,
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
function Dialogues({ movieId, cast, movie, creditSeps, onStats, mobileFilterOpen, onMobileFilterOpen, onAdd, dataNonce }) {
  // Only a series carries an episode locator: a film is one runtime, so its
  // timestamp already says where a line is. Drives the form fields, the Episode
  // column, and nothing else — the credit line reads the row's own numbers, so a
  // leftover pair from a work that used to be a show is still visible.
  const show = movie?.media_type === 'show'
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // dialogue being shared
  const [person, setPerson] = useState(null) // actor metadata panel ({ kind, name })
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  const [color, setColor] = useState('') // '' = all colours
  const [editingId, setEditingId] = useState(null)

  // A line captured through the shell's Add surface lands server-side without
  // this list knowing, so the shell ticks dataNonce and the list refetches.
  // Skips the first render — the load() effect below already covers the mount.
  const firstNonce = useRef(true)
  useEffect(() => {
    if (firstNonce.current) { firstNonce.current = false; return }
    setExpandedId(null) // collapse before the longer set re-packs the board
    load()
    loadTags() // a capture can invent a tag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataNonce])

  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:view:dialogues', 'tiles')
  // A show's table opens grouped by episode, which is the order the list view is
  // served in; a film has only its runtime to sort by.
  const [sort, setSort] = useState({ col: show ? 'episode' : 'timestamp', dir: 'asc' })
  const tileCols = useColumnsAt(BOARD_COLUMNS) // tiles: book-style collage (§8.6)
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
  // Over the visible order. The table view has no tickmarks — a row is already a
  // row of controls — so this is offered on the strip and the tiles board, where a
  // long press means something.
  const dlgSelection = useSelection((items || []).map((d) => d.id))
  const afterBulk = () => {
    dlgSelection.clear()
    load()
  }
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
    if (color) params.set('color', color)
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
  }, [movieId, tag, fav, color])
  useEffect(() => {
    loadTags()
  }, [movieId])
  // Report the unfiltered dialogue counts up to the detail: the total decides the
  // Wishlist tag, and all four print in the hero. Only while nothing is filtered —
  // a filtered view would otherwise report a zero that means "none match", not
  // "none exist" — so under a filter these hold their last unfiltered values.
  useEffect(() => {
    if (items && !tag && !fav && !color) onStats?.(countQuotes(items))
  }, [items, tag, fav, color])

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
    const r = await deleteWithUndo(`/dialogues/${d.id}`, { reload: load })
    if (r.ok) { setExpandedId(null); load() } // collapse before the shorter set re-packs
    else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (♥ clicks).
  async function patch(d, fields) {
    const r = await json('PUT', `/dialogues/${d.id}`, { ...dialogueState(d), ...fields })
    if (!r.ok) return setError(errText(r, 'could not save dialogue'))
    setError('')
    load()
  }

  const filtering = tag || fav || color

  // Build the normalised share payload from the chosen dialogue + its movie.
  const sharePayload = (d) =>
    movieShare({
      quote: d.quote,
      note: d.note,
      color: d.color,
      title: movie?.title,
      year: movie?.release_year,
      character: d.character,
      actor: d.actor,
      timestamp: d.timestamp,
      episode: episodeLabel(d), // '' on a film — the share dialog drops empty parts
      tags: d.tags,
      tmdbId: movie?.tmdb_id,
      tvdbId: movie?.tvdb_id,
      people: actorMap,
      seps: creditSeps,
    })

  // The frame's copy glyph writes out the same line the share dialog's plain-text
  // format would — same payload, same default ticks (see copyQuote).
  const copyOne = (d) => copyQuote(sharePayload(d))

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
              onReset={() => { setTag(''); setFav(false); setColor('') }}
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
              <MonoLabel className="mb-2 block">colour</MonoLabel>
              {/* Re-picking the active colour clears it — the list filter has an
                  "all" state the server has no equivalent for (see validColor),
                  matching how the Library's colour filter behaves. */}
              <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
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
            <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
            {tags.length > 0 && (
              <Select
                ariaLabel="Filter by tag"
                value={tag}
                onChange={setTag}
                options={[['', 'All tags'], ...tags.map((t) => [t.name, t.name])]}
              />
            )}
            <ViewToggle value={view} onChange={setView} />
            {/* Both form factors now open the ONE Add surface, on Capture with
                this title as the target — the shell's ＋ knows which page it is
                on. This is the desktop route to it; the phone's is the ＋ in the
                detail bar above. */}
            <GhostButton onClick={() => onAdd?.('quote', { type: 'movie', id: movieId })}>＋ Capture a line</GhostButton>
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

      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'No dialogues match the filters.' : 'No dialogues yet — the ＋ in the bar above captures the first line.'}
        </EmptyState>
      )}
      {dlgSelection.open && (
        <SelectionBar
          selection={dlgSelection}
          rows={items || []}
          onDone={afterBulk}
          tagSuggestions={Object.keys(tagMap)}
          onEdit={setEditingId}
        />
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
                show={show}
                cast={cast}
                onEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(fields) => save(d.id, fields)}
                onPatch={(fields) => patch(d, fields)}
                onDelete={() => remove(d)}
                onCopy={() => copyOne(d)}
                onShare={() => setShareTarget(d)}
                onOpenPerson={setPerson}
                actorMap={actorMap}
                seps={creditSeps}
                quoteLines={clampLines[i]}
                expanded={expandedId === d.id}
                onToggleExpand={() => toggleExpanded(d.id)}
                selection={dlgSelection}
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
                show={show}
                cast={cast}
                onEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(fields) => save(d.id, fields)}
                onPatch={(fields) => patch(d, fields)}
                onDelete={() => remove(d)}
                onCopy={() => copyOne(d)}
                onShare={() => setShareTarget(d)}
                onOpenPerson={setPerson}
                actorMap={actorMap}
                seps={creditSeps}
                quoteLines={5}
                selection={dlgSelection}
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
          show={show}
          cast={cast}
          actorMap={actorMap}
          onCopy={copyOne}
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

// A show gains an Episode column; a film has no episodes to show one for.
const dialogueCols = (show) =>
  [
    { key: 'quote', label: 'Quote' },
    { key: 'character', label: 'Character' },
    show ? { key: 'episode', label: 'Episode' } : null,
    { key: 'timestamp', label: 'Time' },
    { key: 'favorite', label: '♥' },
  ].filter(Boolean)

// episodeSortKey orders a line within its run. Unset sorts last (Infinity) rather
// than first, matching the server's NULLS-last dialogue order; season 0 is a real
// season and sorts where it belongs, ahead of season 1.
function episodeSortKey(d) {
  return [d.season ?? Infinity, d.episode ?? Infinity]
}

// sortDialogues orders rows for the table view: text columns collate, favourite
// compares numerically, ascending/descending per the header click.
function sortDialogues(rows, sort) {
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    switch (sort.col) {
      case 'favorite':
        return ((a.favorite ? 1 : 0) - (b.favorite ? 1 : 0)) * dir
      case 'character':
        return (a.character || '').localeCompare(b.character || '') * dir
      case 'episode': {
        const [as, ae] = episodeSortKey(a)
        const [bs, be] = episodeSortKey(b)
        // Ties on the season fall through to the episode, then to the timestamp —
        // the same three-level order the list view is served in.
        if (as !== bs) return (as - bs) * dir
        if (ae !== be) return (ae - be) * dir
        return (a.timestamp || '').localeCompare(b.timestamp || '') * dir
      }
      case 'timestamp':
        return (a.timestamp || '').localeCompare(b.timestamp || '') * dir
      default:
        return (a.quote || '').localeCompare(b.quote || '') * dir
    }
  })
}

// DialogueTable — the sortable table view for dialogues, mirroring the Library
// annotation table (shared .ann-table styles): sortable columns + inline edit;
// ♥ is shown read-only here and toggled from the tiles/list views.
function DialogueTable({ rows, tagMap, stickers = [], reloadStickers, sort, onSort, editingId, setEditingId, save, remove, show = false, cast = [], actorMap = {}, onCopy, onShare }) {
  const arrow = (k) => (sort.col === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')
  const editingRow = rows.find((d) => d.id === editingId)
  return (
    <div className="ann-table-wrap">
      <table className="ann-table">
        <thead>
          <tr>
            {dialogueCols(show).map((c) => (
              <th
                key={c.key}
                className="sortable"
                onClick={() => onSort(c.key)}
                aria-sort={sort.col === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <Tooltip label="Sort by this column" side="bottom">
                  <span>
                    {c.label}
                    {arrow(c.key)}
                  </span>
                </Tooltip>
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
              {show && <td className="col-mono">{episodeLabel(d) || '—'}</td>}
              <td className="col-mono">{d.timestamp || '—'}</td>
              <td className="col-center">{d.favorite ? '♥' : '—'}</td>
              <td className="col-actions">
                <TableActions
                  noun="line"
                  onCopy={onCopy && (() => onCopy(d))}
                  onShare={onShare && (() => onShare(d))}
                  onEdit={() => setEditingId(d.id)}
                  onDelete={() => remove(d)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <FormModal open={!!editingRow} onClose={() => setEditingId(null)} title="Edit dialogue">
        {editingRow && (
          <DialogueForm initial={editingRow} onSubmit={(fields) => save(editingRow.id, fields)} onCancel={() => setEditingId(null)} submitLabel="Save" show={show} cast={cast} actorMap={actorMap} tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
        )}
      </FormModal>
    </div>
  )
}

// Frame — one dialogue as a film frame: Newsreader quote, amber mono credit
// line, tag chips, ♥ (immediate PUT patches), note, edit/delete.
//
// WHY A DIALOGUE IS SOMETIMES THIS AND SOMETIMES A HAND-CARD, written down
// because the difference has read as drift for three releases. The frame is a
// property of the STRIP, not of the dialogue: on a film's own page the lines are
// laid out as a strip with sprockets and edge codes, and a frame is what sits in
// a strip. In a mixed list — Home's favourites, which interleaves book
// highlights and film lines in one column — there is no strip, and a dialogue is
// a quote like any other, so it wears the same card its neighbours do. The
// search modal shows a single line in isolation and mimics the strip, which is
// why it uses this.
//
// What made that look like a bug rather than a choice is that until 1.6.0
// .film-frame had no material at all — no texture tile, no dither, no answer to
// the aesthetic toggle — so the difference between a dialogue on Home and the
// same dialogue on its film's page was "a textured card" versus "an untextured
// rectangle". It is now "a torn-edged card" versus "a square lit panel", which
// is a difference you can mean.
export function Frame({ d, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, show = false, cast = [], onEdit, onCancelEdit, onSave, onPatch, onDelete, onCopy, onShare, onOpenPerson, actorMap = {}, seps, actionsAlwaysVisible = false, editInline = false, wrapClass = 'mx-4 my-1.5', quoteLines = 6, expanded, onToggleExpand, selection, selectKind = 'dialogue' }) {
  // wrapClass carries the frame's outer spacing: the strip (list) view indents
  // frames from the film edges (mx-4 my-1.5); the masonry (tiles) view drops it
  // so the card fills its column slot and the masonry gap does the spacing.
  const frameClass = ['film-frame', wrapClass, 'px-5 py-4'].filter(Boolean).join(' ')
  // From the registry, like every other card (actions.jsx). A dialogue is an
  // annotation with different credits, so it gets the same set in the same places.
  const acts = actionsFor('dialogue', d, {
    copy: onCopy && (() => onCopy()),
    share: onShare && (() => onShare()),
    edit: onEdit && (() => onEdit()),
    // The same immediate PUT the frame's own ♥ runs, so the two cannot disagree
    // about what favouriting is.
    favourite: onPatch && (() => onPatch({ favorite: !d.favorite })),
    favourited: !!d.favorite,
    remove: onDelete && (() => onDelete()),
  })
  // The same list the row and the ⋯ render, on a right-click or Shift+F10; a long
  // press on the frame's whitespace SELECTS it, and a long press on the line itself
  // is left to the browser so a thumb can still pull a phrase out (useCardMenu).
  const menuItems = acts.map((x) => ({ ...x, onClick: x.run }))
  if (selection) {
    // Select first, which is what makes the menu and multiselect one feature.
    menuItems.unshift({
      id: 'select',
      label: selection.isSelected(d.id) ? 'Deselect' : 'Select',
      onClick: () => selection.toggle(d.id, selectKind),
    })
  }
  const { cardProps, menuClass, menu } = useCardMenu(
    menuItems,
    selection ? { onLongPress: () => selection.toggle(d.id, selectKind) } : undefined,
  )
  const picked = !!selection?.isSelected(d.id)
  const onFrameClick = selection
    ? (e) => {
        const what = selectionClick(e, selection)
        if (what === 'open') return
        e.preventDefault()
        e.stopPropagation()
        if (what === 'extend') selection.extendTo(d.id, selectKind)
        else selection.toggle(d.id, selectKind)
      }
    : undefined
  // The colour bar is the same affordance annotations get from HandCard's
  // colorBar — a dialogue is a quote like any other, so it wears its colour the
  // same way. Inline rather than a class because the frame's own borders are
  // part of the film-strip recipe (§6) and must not be overridden wholesale.
  const frameStyle = { borderLeft: `4px solid ${categoryVar(d.color) || 'var(--hl-1)'}` }
  // Accordion mode (tiles board): the parent owns which dialogue is open, so one
  // expands at a time. Elsewhere (list, search modal) each frame keeps its own.
  // The quote clamps to `quoteLines` and a chevron reveals only when it overflows
  // (click the text to expand — no button), mirroring book annotations.
  const accordion = typeof onToggleExpand === 'function'
  const editForm = (
    <DialogueForm initial={d} onSubmit={onSave} onCancel={onCancelEdit} submitLabel="Save" show={show} cast={cast} actorMap={actorMap} tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
  )
  // editInline renders the form in place of the frame — used inside the search
  // QuoteModal (already a pop-up). Elsewhere the edit opens in a FormModal.
  if (editInline && editing) {
    return <article className={frameClass} style={frameStyle}>{editForm}</article>
  }
  // Credit line; a dialogue can name more than one actor (entered like genres),
  // so PLAYED BY lists each — every name clickable (opens the metadata panel)
  // when an onOpenPerson handler is supplied, styled to inherit the amber mono
  // voice. The stored actor string stays verbatim; splitCredits only drives the
  // people-derived views (this list + the overlapping face chips below).
  const actorNames = d.actor ? splitCredits(d.actor, seps) : []
  const actorInherit = { font: 'inherit', color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }
  const actorCredit =
    actorNames.length > 0 ? (
      <span key="actor">
        PLAYED BY{' '}
        {actorNames.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && ', '}
            {onOpenPerson ? (
              <PersonName kind="actor" name={n} onOpen={onOpenPerson} className="" style={actorInherit}>
                {n}
              </PersonName>
            ) : (
              n
            )}
          </Fragment>
        ))}
      </span>
    ) : null
  // Coarse to fine: which episode, who says it, then where in the runtime.
  const creditParts = [episodeLabel(d) || null, d.character || null, actorCredit, d.timestamp || null].filter(Boolean)
  // Attached sticker → corner seal the line flows around (same as book
  // annotations). Nothing else competes for the top-right corner: the favourite
  // ♥ lives in the action row at the foot of the frame, where a book
  // annotation has always kept it (Library's ActionRow).
  const sticker = d.sticker_id != null ? stickerMap[d.sticker_id] : null
  const quoteStyle = { fontFamily: 'var(--font-display)', fontSize: 16.5, lineHeight: 1.5, color: 'var(--ink)' }
  return (
    <>
      <FormModal open={editing} onClose={onCancelEdit} title="Edit dialogue">
        {editForm}
      </FormModal>
    <article
      className={`${frameClass} ${menuClass}${picked ? ' is-picked' : ''}${selection?.active ? ' is-selecting' : ''}`}
      style={frameStyle}
      {...cardProps}
      onClickCapture={(e) => {
        // The press already acted; running the click too would toggle it back.
        if (cardProps.onClickCapture?.(e)) return
        onFrameClick?.(e)
      }}
    >
      {selection && (
        <PickMark picked={picked} label="this line" onChange={() => selection.toggle(d.id, selectKind)} />
      )}
      {d.quote &&
        (sticker ? (
          <FlowQuote
            text={d.quote}
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
          <ExpandableText
            text={d.quote}
            lines={quoteLines}
            style={quoteStyle}
            open={accordion ? !!expanded : undefined}
            onToggle={accordion ? onToggleExpand : undefined}
          />
        ))}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2">
          {/* Actor face(s) on the quote block (when a portrait is saved),
              overlapping with the first actor on top; sized to match the
              library's author chip. */}
          <CreditFaces names={actorNames} map={actorMap} size={24} ring="var(--card)" />
          <ReviewDot item={d} />
          {/* The library's twin — see AnnotationCard. `show` is already the prop
              that tells this frame which kind of thing it is inside, so the mark
              can say "its show" rather than calling every episode a film. */}
          <QuizSkipMark item={d} parent={show ? 'show' : 'film'} />
          <span style={amberMono}>
            {creditParts.map((p, i) => (
              <span key={i}>
                {i > 0 ? ' · ' : ''}
                {p}
              </span>
            ))}
          </span>
        </span>
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
      {/* §7 declutter: the ♥ is the frame's resting mark and leads this row, then
          copy and share, then the colour quick-pick — the three reveal on hover
          (desktop) and stand on a phone. Edit and delete are behind the ⋯ at
          every width. Order and contents match Library's ActionRow exactly — a
          dialogue is an annotation with different credits, and the two cards
          should not put the same control in two different places. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Hearts value={!!d.favorite} onChange={(v) => onPatch({ favorite: v })} />
        <QuoteTools actions={atRow(acts)} alwaysVisible={actionsAlwaysVisible} />
        {/* shrink-0: the colour dots are one atomic control — the row wraps the
            ⋯ cluster to a second line before it splits or squeezes them. (Six
            of them since 1.7.1, and below a 330px card they collapse to a single
            trigger, which is what keeps this row on one line beside the ♥.) */}
        <span className={'card-colors shrink-0' + (actionsAlwaysVisible ? ' is-visible' : '')}>
          <ColorSwatches
            collapsible
            value={d.color || 'yellow'}
            onChange={(c) => onPatch({ color: c })}
            ariaLabel="Colour category"
          />
        </span>
        <span className="ml-auto flex items-center">
          <QuoteActions actions={atOverflow(acts)} />
        </span>
      </div>
      {menu}
    </article>
    </>
  )
}

// DialogueForm serves both add (no initial) and inline edit (initial set).
// You pick the CHARACTER(S) speaking the line (from the movie's cast); the
// actor(s) who play them are derived from the cast metadata — shown live as a
// "played by" preview and stored server-side (leaving `actor` blank lets the
// server fill it from the character↔cast mapping).
// `show` adds the season/episode pair, which only a series has — a film is one
// runtime, so its timestamp already locates the line. A leftover pair on a film
// (flipped from a show after the fact) still shows, so it can be seen and cleared.
// Exported for Home's favourite-tile inline edit (same form, same contract).
export function DialogueForm({ initial, onSubmit, onCancel, submitLabel, show = false, cast = [], actorMap = {}, tagSuggestions = [], stickers = [], reloadStickers }) {
  // character↔actor lookups from the movie's cast (case-insensitive keys).
  const charActor = useMemo(() => {
    const m = new Map()
    for (const c of cast) if (c.character) m.set(c.character.trim().toLowerCase(), (c.actor || '').trim())
    return m
  }, [cast])
  const charSuggestions = useMemo(() => [...new Set(cast.map((c) => c.character).filter(Boolean))], [cast])

  const [quote, setQuote] = useState(initial?.quote || '')
  // A line can be spoken by more than one character (entered like tags). Seed
  // from the stored character string; for legacy rows that only carry actors
  // (character empty), reverse-map each actor back to its cast character so the
  // form reflects what's shown on the frame.
  const [characters, setCharacters] = useState(() => {
    if (initial?.character) return splitCredits(initial.character)
    if (initial?.actor && cast.length) {
      const actorToChar = new Map()
      for (const c of cast) if (c.actor) actorToChar.set(c.actor.trim().toLowerCase(), c.character)
      return splitCredits(initial.actor).map((a) => actorToChar.get(a.trim().toLowerCase())).filter(Boolean)
    }
    return []
  })
  const [timestamp, setTimestamp] = useState(initial?.timestamp || '')
  // Kept as strings: '' is unset and '0' is season 0, and a number field cannot
  // hold both. ?? not ||, so a stored 0 seeds as "0" rather than blank.
  const [season, setSeason] = useState(initial?.season ?? '')
  const [episode, setEpisode] = useState(initial?.episode ?? '')
  const [note, setNote] = useState(initial?.note || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [tags, setTags] = useState(initial?.tags || [])
  const [stickerId, setStickerId] = useState(initial?.sticker_id ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // The actor(s) implied by the chosen characters (unique, in order) — the
  // "played by" preview, and what the server derives on save.
  const derivedActors = useMemo(() => {
    const out = []
    const seen = new Set()
    for (const ch of characters) {
      const a = charActor.get(String(ch).trim().toLowerCase())
      if (a && !seen.has(a.toLowerCase())) { seen.add(a.toLowerCase()); out.push(a) }
    }
    return out
  }, [characters, charActor])

  // The episode fields show for a series, and for a film's line that somehow
  // still carries one (media_type flipped after the fact) so it can be cleared.
  const episodeFields = show || initial?.season != null
  const seasonNum = countOrNull(season)
  const episodeVal = countOrNull(episode)

  // The must-fill rules, stated once: the guard below and the greyed-out button
  // read the same value, so the button is never pressable in a state the handler
  // would refuse. The second rule is the server's too — an episode number means
  // nothing without its season.
  const missing = !quote.trim()
    ? 'The line itself is required'
    : episodeFields && episodeVal != null && seasonNum == null
      ? 'An episode needs its season'
      : ''
  // Joins the dialog's header ✓ when there is one — see FormHostContext.
  const host = useFormHost(busy ? 'Saving…' : missing)

  async function submit(e) {
    e.preventDefault()
    if (missing) return setError(missing.toLowerCase())
    setBusy(true)
    setError('')
    const err = await onSubmit({
      quote: quote.trim(),
      note: note.trim(),
      season: episodeFields ? seasonNum : null,
      episode: episodeFields ? episodeVal : null,
      character: characters.map((c) => c.trim()).filter(Boolean).join(', '),
      // Actor is derived from the characters via the cast, server-side. Send it
      // empty so the server maps it; but if no character is chosen, carry any
      // existing actor through untouched (don't silently wipe a legacy credit).
      actor: characters.length ? '' : (initial?.actor || ''),
      timestamp: timestamp.trim(),
      color,
      tags,
      // favorite is edited on the frame, not in the form — but PUT is
      // full-state, so carry the existing value through.
      favorite: !!initial?.favorite,
      // sticker: id chosen here; position is dragged on the frame, carry through.
      sticker_id: stickerId,
      sticker_x: initial?.sticker_x ?? null,
      sticker_y: initial?.sticker_y ?? null,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setQuote('')
      setCharacters([])
      setTimestamp('')
      // Season and episode deliberately stay put: you add a run of lines from
      // the episode you are watching, so re-typing both every time would be the
      // wrong default. The timestamp above does clear — it changes every line.
      setNote('')
      setTags([])
      setStickerId(null)
    }
  }

  return (
    <form id={host?.formId} onSubmit={submit} className="space-y-2.5">
      <textarea
        className="tp-input"
        rows="3"
        placeholder="Quote (required)"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      <div>
        <TokenInput
          value={characters}
          onChange={setCharacters}
          suggestions={charSuggestions}
          placeholder="add a character… (picks from the cast)"
          ariaLabel="Characters"
          nameCase
        />
        {/* The cast maps each character to who plays them — shown here so the
            credit is what you see. Derived, not editable. */}
        {derivedActors.length > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <CreditFaces names={derivedActors} map={actorMap} size={20} ring="var(--card)" />
            <span style={{ ...amberMono, fontSize: 11 }}>played by {derivedActors.join(', ')}</span>
          </div>
        )}
      </div>
      {/* Episode locator, coarse to fine: a series line says which episode, then
          where in it. Season 0 is legal — it is where specials live — so the
          fields are min=0 and blank means "not recorded". */}
      {episodeFields ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            className="tp-input"
            type="number"
            min="0"
            max="999"
            placeholder="Season"
            title="Season (blank if unknown)"
            aria-label="Season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
          <input
            className="tp-input"
            type="number"
            min="0"
            max="9999"
            placeholder="Episode"
            title="Episode (needs a season)"
            aria-label="Episode"
            value={episode}
            onChange={(e) => setEpisode(e.target.value)}
          />
          {/* Full width under the pair on a phone, third column from sm up. */}
          <input
            className="tp-input col-span-2 sm:col-span-1"
            placeholder="HH:MM:SS"
            title="Timestamp"
            aria-label="Timestamp"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
          />
        </div>
      ) : (
        <input
          className="tp-input"
          placeholder="HH:MM:SS"
          title="Timestamp"
          aria-label="Timestamp"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
        />
      )}
      <textarea className="tp-input" rows="2" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <TokenInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="add a tag…" ariaLabel="Tags" />
      <div className="flex items-center gap-3">
        <MonoLabel>colour</MonoLabel>
        <ColorSwatches value={color} onChange={setColor} ariaLabel="Colour category" />
      </div>
      <div>
        <MonoLabel className="mb-1.5 block">Sticker</MonoLabel>
        <StickerPicker value={stickerId} onChange={setStickerId} stickers={stickers} reload={reloadStickers} />
      </div>
      {/* Hosted in a dialog, yes and no live together in its header. Inline
          there is no header, so the footer stays. See FormHostContext. */}
      {!host && (
        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <GhostButton type="button" onClick={onCancel}>
              Cancel
            </GhostButton>
          )}
          <button className="tp-btn tp-btn-primary" disabled={busy || !!missing} title={missing || undefined}>
            {submitLabel}
          </button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
