import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { categoryVar } from './theme.js'
import { episodeLabel } from './text.js'
import { coverImgURL, json, errText, downloadPost } from './api.js'
import { CoverControls, MovieLookupPicker, idNum } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, copyQuote, movieShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { actionsFor, atOverflow, atRow } from './actions.jsx'
import { selectionClick, selectionMenuItems, useSelection } from './selection.jsx'
import { facetValue, facetValues, publishSearchSeed, seedableChips, withFacet, withFacetValues } from './facets.js'
import { SelectionBar } from './SelectionBar.jsx'
import { useCharacterArt } from './cast.jsx'
import { CharacterFaces, CreditFaces, PersonChip, PersonModal, PersonName, parseCreditSeps, personImgURL, splitCredits, usePeople, usePortraitFill } from './people.jsx'
import {
  GroupHeading,
  WorkCard,
  WorkListScaffold,
  capKeyFor,
  countQuotes,
  creditNounFor,
  groupWorks,
  moveLabel,
  patchMovesTheRow,
  pinInProgress,
  statusFilter,
  useBoardWindow,
  wishFilter,
} from './works.jsx'
import { KINDS } from './workKinds.js'
import WorkDetail from './WorkDetail.jsx'
import { t } from './i18n.js'
import {
  QUOTE_COLUMNS_IN,
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
  formatYear,
  FormModal,
  FrameCode,
  frameCode,
  GhostButton,
  HandCard,
  HandNote,
  Hearts,
  IconMetadata,
  Masonry,
  MobileSheet,
  MonoLabel,
  mulberry32,
  NameInput,
  NameScroll,
  parseYearInput,
  PickMark,
  QuizSkipMark,
  QuoteActions,
  QuoteTools,
  ReviewDot,
  Scroller,
  Select,
  SheetFooter,
  Sprockets,
  TableActions,
  TagChip,
  titleCaseGenre,
  Toggle,
  TokenInput,
  Tooltip,
  TranslationLine,
  useCardMenu,
  useColumnsIn,
  useCoverSize,
  useFormHost,
  useFrameBase,
  useIsMobileScreen,
  usePersistedState,
  useReveal,
  ViewToggle,
} from './ui.jsx'

// The in-progress cap dialog's nouns now come from the kind table's `capWords`,
// which absorbed the CAP_WORDS that used to live here — and gained the `book` row
// it never had, so the books side reads the same lookup instead of naming its two
// words inline.
//
// The table it came from was written because the ternaries before it were two-way
// (`capKey === 'show' ? … : …`) with the film arm doubling as the fallback, which
// is exactly the shape that swallows a third media type silently: a fourth game
// opened a dialog reading "The shelf holds 3 films at a time" with three buttons
// offering to mark a game as watched. Keyed on capKeyFor's answer, a fifth kind
// is a row rather than an arm — and now it is a row on the one table every work
// page reads, so the same is true of every other word on the screen.
//
// The settled word is shared with the transitions menu on purpose: a game is
// "Mark as played" there (moveLabel) and must not be something else here.
const capWordsFor = (capKey) => (KINDS[capKey] || KINDS.movie).capWords

// Movies — the reel wall (§8.6, mockups 12–14) + movie detail with the
// filmstrip (§8.7 + §6 recipe, mockups 15–16). Dialogues mirror annotations
// (PLAN §3b); tags are objects now — chips take color/style from GET /tags.
// Adding anything — a title, a line of dialogue, an import — belongs to the
// shell's one ＋ Add surface (`onAdd`), which since 1.4.1 opens on the right
// thing for the page it is on; `dataNonce` is how anything saved there tells
// whichever list it changed — the poster grid or a title's lines — to refetch.
export default function Movies({ openId, onOpen, onClose, creditSeparators, onAdd, onSearch, dataNonce }) {
  if (openId) {
    return (
      <MovieDetail
        id={openId}
        onClose={onClose}
        creditSeparators={creditSeparators}
        onAdd={onAdd}
        dataNonce={dataNonce} onSearch={onSearch} />
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

// MovieGroup is one grouped section. It is a component rather than a block inside
// the map because each section carries its OWN window — a group of four hundred
// films needs bounding exactly as the flat board does, and a hook cannot live in
// a loop body.
function MovieGroup({ group, coverSize, onOpen, directorMap, creditSeps, selection, afterBulk, setEditWork }) {
  const win = useBoardWindow(group.items.length, group.items)
  return (
    <section>
      <GroupHeading label={group.label} count={group.items.length} noun={t('unit.title.one')} nounPlural={t('unit.title.other')} />
      <div
        className="grid gap-x-5 gap-y-8"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}
      >
        {group.items.slice(0, win.count).map((m) => (
          <WorkCard key={m.id} kind="movie" item={m} onOpen={onOpen} people={directorMap} seps={creditSeps} selection={selection} onChanged={afterBulk} onEdit={setEditWork} />
        ))}
        {win.more && <div ref={win.sentinel} aria-hidden="true" className="h-px" />}
      </div>
    </section>
  )
}

// Group-by dimensions for the Catalogue. "Collection" is movies.series — the
// column the 0006 migration already called a "franchise / collection name" —
// relabelled here because "series" means a TV show on this page.
const GROUP_OPTIONS = [
  ['none', 'movies.group.none.label'],
  ['series', 'movies.group.series.label'],
  ['author', 'movies.group.author.label'],
  ['decade', 'movies.group.decade.label'],
  ['genre', 'movies.group.genre.label'],
]

// The table above holds KEYS; this is what the two Selects render.
const groupOptions = () => GROUP_OPTIONS.map(([key, labelKey]) => [key, t(labelKey)])

// countOf is "3 titles" / "1 line", from the shared unit table.
const countOf = (n, unit) => t('common.count.phrase', { n, noun: t(unit, { count: n }) })

// amberMono — the metadata voice of the film pages (counts, credit lines).
const amberMono = {
  fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', fontVariantNumeric: 'var(--font-mono-figures)',
  fontSize: 'var(--type-mono-12)',
  fontWeight: 500,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--amber)',
}

// movieState is the full PUT body for a movie (PUT is full-state, and omitting
// tmdb_id keeps it on the manual-update path) — used by the detail-header ♥.
export function movieState(m) {
  return {
    title: m.title,
    director: m.director || '',
    // 0042: a game's publisher is its own column, and it is full-state like the
    // rest — so the detail-header ♥ has to carry it or favouriting a game would
    // clear who published it. The same trap as imdb_id below.
    publisher: m.publisher || '',
    // 0062, and here for the reason the publisher is: unconditional in the
    // server's UPDATE, so a body that omits it clears it.
    links: m.links || '',
    release_year: m.release_year || 0,
    // The circa flag is full-state like the year it qualifies, so leaving it out
    // turned "c. 1942" into "1942" on the next ♥ — the same trap as the ids
    // below, on the field nobody thought of as a field.
    release_circa: !!m.release_circa,
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
  return r.ok ? '' : errText(r, t('error.save.generic'))
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
    actor: facetValue(filters, 'actor'),
    wish: { yes: 'wishlist', no: 'annotated' }[facetValue(filters, 'wishlist')] || '',
    states: facetValues(filters, 'shelf'), // shelf states kept; [] = every state
  }), [filters])
  const { mediaType, genre, series, fav, tagged, noted, actor, wish, states } = f
  const setMediaType = (v) => setFilters((c) => withFacet(c, 'media', v))
  const setGenre = (v) => setFilters((c) => withFacet(c, 'genre', v))
  const setSeries = (v) => setFilters((c) => withFacet(c, 'series', v))
  const setActor = (v) => setFilters((c) => withFacet(c, 'actor', v))
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
  const hasGames = (movies || []).some((m) => m.media_type === 'game')
  // ONE list, rendered twice. The desktop row and the mobile sheet used to carry
  // their own copies of the same array, which is two places to forget a type —
  // and the mobile one is the copy nobody looks at.
  //
  // A chip only appears when the catalogue actually holds that type, so a
  // films-and-games library is not offered a Shows filter that matches nothing.
  const typeChips = useMemo(() => {
    const out = [['', t('movies.filters.media.all.label')], ['movie', t('movies.filters.media.movie.label')]]
    if (hasShows) out.push(['show', t('movies.filters.media.show.label')])
    if (hasGames) out.push(['game', t('movies.filters.media.game.label')])
    return out
  }, [hasShows, hasGames])
  // The gate is on the whole catalogue rather than the filtered view, so the row
  // cannot vanish underneath the filter that is using it.
  const showTypeRow = hasShows || hasGames
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
  // Every actor with a line saved from them, in alphabetical order — the same
  // names the credit chips on a line are drawn from, split the same way, so the
  // dropdown cannot offer "Ford, Hauer" as one person.
  //
  // Most-common-first is what the genre select does, and is wrong here: a genre
  // list is short and a cast list is not, so the useful ordering is the one you
  // can scan for a name you already have in mind.
  const actorNames = useMemo(() => {
    const s = new Set()
    for (const m of movies || []) for (const raw of m.actors || []) for (const n of splitCredits(raw, creditSeps)) s.add(n)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [movies, creditSeps])

  const shown = useMemo(() => {
    let list = movies || []
    if (mediaType) list = list.filter((m) => (m.media_type || 'movie') === mediaType)
    if (genre) list = list.filter((m) => (m.genres || []).includes(genre))
    if (series) list = list.filter((m) => (m.series || '') === series)
    // Exact name against the SPLIT credit, not a substring of the raw string: a
    // line credits its actors as one field ("Ford, Hauer") and the dropdown
    // offers the split names, so `includes(actor)` on the raw string would let
    // "Ford" match a film credited only to "Harrison Fordham". splitCredits uses
    // the reader's own separators, the same ones the credit chips are drawn from.
    if (actor) list = list.filter((m) => (m.actors || []).some((a) => splitCredits(a, creditSeps).includes(actor)))
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
  }, [movies, mediaType, genre, series, fav, tagged, noted, actor, states, wish, sort, creditSeps])

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
            creditResidual: t('movies.group.residual.director.label'),
            year: (m) => m.release_year,
            genres: (m) => m.genres || [],
            series: (m) => m.series,
            seps: creditSeps,
            sortMembers: (items, dim) => (dim === 'series' ? [...items].sort(bySeries) : items),
          }),
    [shown, groupBy, creditSeps],
  )
  // The Catalogue is the same board as the Library's and pays the same price for
  // mounting all of it; both windows live here rather than inside the grid,
  // because the flat board is a Reveal rather than a component of its own.
  const flatWin = useBoardWindow(shown.length, shown)
  const groupWin = useBoardWindow(grouped ? grouped.length : 0, grouped, 12)

  const films = movies ? movies.length : 0
  const lines = movies ? movies.reduce((n, m) => n + (m.dialogue_count || 0), 0) : 0
  const counts = movies
    ? t('movies.header.counts', {
        a: countOf(films, 'unit.title'),
        b: countOf(lines, 'unit.dialogue'),
      })
    : null

  return (
    <WorkListScaffold
      mobile={mobile}
      title={t('movies.header.title')}
      counts={counts}
      error={error}
      onExport={() => setExporting(true)}
      headerAside={
        <MonoLabel className="hidden sm:inline">
          {t(tmdbSource === 'none' ? 'movies.header.nokey.label' : 'movies.header.lookup.label')}
        </MonoLabel>
      }
      loaded={movies != null}
      hasItems={!!(movies && movies.length > 0)}
      shownCount={shown.length}
      emptyText={t('movies.board.empty')}
      noMatchText={t('movies.board.nomatch')}
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
      noun={t('unit.title.one')}
      nounPlural={t('unit.title.other')}
      seriesNames={seriesNames}
      series={series}
      setSeries={setSeries}
      sort={sort}
      setSort={setSort}
      creditNames={actorNames}
      credit={actor}
      setCredit={setActor}
      creditNoun={t('unit.actor.one')}
      creditNounPlural={t('unit.actor.other')}
      seriesNoun={t('unit.collection.one')}
      seriesNounPlural={t('unit.collection.other')}
      sortOptions={[
        ['recent', t('movies.sort.recent.label')],
        ['title', t('movies.sort.title.label')],
        ['year', t('movies.sort.year.label')],
        ['series', t('movies.sort.series.label')],
        ['read', t('movies.sort.read.label')],
      ]}
      // The catalogue can hold two in-progress words at once, so the shelf-state
      // filter lists both rather than only the film's.
      activeStates={hasGames ? ['watching', 'playing'] : ['watching']}
      leading={
        showTypeRow &&
        typeChips.map(([k, label]) => (
          <button key={k} className={filterChipClass(mediaType === k)} onClick={() => setMediaType(k)}>
            {label}
          </button>
        ))
      }
      leadingMobile={
        showTypeRow && (
          <div>
            <MonoLabel className="mb-2 block">type</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              {typeChips.map(([k, label]) => (
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
          <MonoLabel>{t('common.mono.group.label')}</MonoLabel>
          <Select
            ariaLabel={t('common.filters.group.aria')}
            value={groupBy}
            onChange={setGroupBy}
            options={groupOptions()}
          />
        </label>
      }
      trailingMobile={
        <div>
          <MonoLabel className="mb-2 block">group</MonoLabel>
          <Select ariaLabel={t('common.filters.group.aria')} value={groupBy} onChange={setGroupBy} options={groupOptions()} />
        </div>
      }
      onReset={() => { setFilters([]); setGroupBy('none'); setSort('recent') }}
      exportDialog={
        <ConfirmDialog
          open={exporting}
          title={t('movies.export.confirm.title')}
          body={(() => {
            // Counted per type rather than "everything that is not a show", which
            // is what this was: games would have been tallied as movies and the
            // dialog would have said "3 movies" over a selection holding one.
            const shows = shown.filter((m) => (m.media_type || 'movie') === 'show').length
            const games = shown.filter((m) => m.media_type === 'game').length
            const films = shown.length - shows - games
            const parts = [
              films > 0 && t('movies.export.count.movies', { count: films, n: films }),
              shows > 0 && t('movies.export.count.shows', { count: shows, n: shows }),
              games > 0 && t('movies.export.count.games', { count: games, n: games }),
            ].filter(Boolean)
            return t('movies.export.confirm.body', { a: parts.join(' · ') || t('movies.export.count.none') })
          })()}
          confirmLabel={t('common.action.export.label')}
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
          title={t('film.form.edit.title')}
          onDone={() => {
            setEditWork(null)
            afterBulk()
          }}
          onCancel={() => setEditWork(null)}
        />
      )}
      {grouped ? (
        <div className="space-y-10">
          {grouped.slice(0, groupWin.count).map((g) => (
            <MovieGroup
              key={g.key}
              group={g}
              coverSize={coverSize}
              onOpen={onOpen}
              directorMap={directorMap}
              creditSeps={creditSeps}
              selection={selection}
              afterBulk={afterBulk}
              setEditWork={setEditWork}
            />
          ))}
          {groupWin.more && <div ref={groupWin.sentinel} aria-hidden="true" className="h-px" />}
        </div>
      ) : (
        <Reveal
          className="grid gap-x-5 gap-y-8"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}
        >
          {shown.slice(0, flatWin.count).map((m) => (
            <WorkCard key={m.id} kind="movie" item={m} onOpen={onOpen} people={directorMap} seps={creditSeps} selection={selection} onChanged={afterBulk} onEdit={setEditWork} />
          ))}
          {flatWin.more && <div ref={flatWin.sentinel} aria-hidden="true" className="h-px" />}
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
              <NameScroll as="p" className="text-sm font-semibold">
                {e.title}
                {e.release_year ? (
                  <span className="ml-2 font-normal" style={{ color: 'var(--soft)' }}>
                    {e.release_year}
                  </span>
                ) : null}
              </NameScroll>
              <p className="truncate text-xs" style={{ color: 'var(--faint)' }}>
                {[
                  t('movies.duplicate.dialogues', { count: e.dialogue_count, n: e.dialogue_count }),
                  t(e.has_poster ? 'movies.duplicate.poster.yes' : 'movies.duplicate.poster.no'),
                ].join(' · ')}
              </p>
            </div>
            <GhostButton icon={<IconMetadata />} type="button" className="shrink-0" disabled={busy} onClick={() => onEnrich(e.id)}>
              {t('movies.duplicate.enrich.label')}
            </GhostButton>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="tp-btn tp-btn-primary" disabled={busy} onClick={onAddSeparate}>
          {t('movies.duplicate.separate.label')}
        </button>
        <GhostButton type="button" disabled={busy} onClick={onCancel}>
          {t('common.action.cancel.label')}
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
  // GAMES ONLY (0042). A film has a distributor and a show has a network, and the
  // column is deliberately open to both — but neither is a field anybody has
  // asked to type, so the box appears where the distinction has actually been
  // getting stated wrongly.
  const [publisher, setPublisher] = useState('')
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
  const isGame = mediaType === 'game'

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError(t('error.validate.title-required.lower'))
    onBusy?.(true)
    setError('')
    const r = await json('POST', '/movies', {
      title: title.trim(),
      media_type: mediaType,
      director: director.trim() || undefined,
      publisher: isGame ? publisher.trim() : undefined,
      release_year: year ? parseYearInput(year).year : undefined,
      release_circa: year ? parseYearInput(year).circa : undefined,
      genres,
      series: series.trim() || undefined,
      series_index: Number(seriesIndex) || 0,
      description: description.trim() || undefined,
    })
    onBusy?.(false)
    if (r.ok) onAdded(r.data) // hand back the created title (capture targets it)
    else setError(errText(r, t('error.add.title')))
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <NameInput placeholder={t('film.form.title.placeholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <NameInput
          placeholder={creditNounFor(mediaType)}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        {isGame && (
          <NameInput
            placeholder={t('film.form.publisher.placeholder')}
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
        )}
        <input className="tp-input" placeholder={t('film.form.year.placeholder')} inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder={t('common.field.genres.placeholder')} ariaLabel={t('common.field.genres.label')} transform={titleCaseGenre} />
        <NameInput placeholder={t('film.form.series.placeholder')} value={series} onChange={(e) => setSeries(e.target.value)} />
        <input
          className="tp-input"
          placeholder={t('film.form.series-no.placeholder')}
          inputMode="decimal"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
      </div>
      <textarea className="tp-input" rows="3" placeholder={t('film.form.description.placeholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      {/* Title is the one must-fill field. The ✓ in the popup header stays greyed
          until it has one rather than accepting the press and answering with an
          error; this line says why, because a disabled icon cannot. */}
      {!title.trim() && <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('film.form.missing.hint')}</p>}
    </form>
  )
}

// MediaTypeToggle — the Movie | Show | Game switch, reused by the add + edit
// forms. All three are movies rows split by media_type: TV was folded in by
// 0006 and games by 0040, for the same reason both times.
export function MediaTypeToggle({ value, onChange }) {
  return (
    <Toggle
      ariaLabel={t('film.form.media.aria')}
      value={value}
      onChange={onChange}
      options={[
        ['movie', t('film.form.media.movie.label')],
        ['show', t('vocab.kind.show.label')],
        ['game', t('vocab.kind.game.label')],
      ]}
    />
  )
}

// ---- movie detail (§8.7): poster header + filmstrip of dialogues ----

// MovieDetail — the catalogue's work page, which is WorkDetail with `side`
// set. Everything that used to be here is in WorkDetail.jsx now, because it was
// the books side's screen typed out a second time and the two had drifted: no
// two-column frame, no doors on the year or the series, a credit row that was a
// sentence rather than people, a back link naming a board this app renamed.
//
// The BOARD is still this file's — `Dialogues` is folded next — so it comes in
// as a render prop. A film, a show and a game all arrive here: which one it is
// comes off `media_type` on the loaded row, so nothing above this line has to
// know, and every kind fact is a row in workKinds.js.
function MovieDetail(props) {
  return (
    <WorkDetail
      {...props}
      side="movie"
      stateBuilder={(movie, fields) => ({ ...movieState(movie), ...fields })}
      renderBoard={({ item, seps, mobileFilter, setMobileFilter, onStats, onAdd, dataNonce, openCharacter }) => (
        <Dialogues
          movieId={item.id}
          cast={item.cast || []}
          movie={item}
          creditSeps={seps}
          onStats={onStats}
          onOpenCharacter={openCharacter}
          mobileFilterOpen={mobileFilter}
          onMobileFilterOpen={setMobileFilter}
          onAdd={onAdd}
          dataNonce={dataNonce}
        />
      )}
    />
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
  const [publisher, setPublisher] = useState(movie.publisher || '')
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
  const isGame = mediaType === 'game'

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError(t('error.validate.title-required.lower'))
    setBusy(true)
    setError('')
    // THE RECORD FIRST, THE FORM ON TOP — see EditBook's submit for why. Here it
    // is `imdb_id` that the hand-written list forgot: a plain full-state string
    // (unlike the two ids below, which are pointers), so saving this form used to
    // clear the IMDb id every time.
    const r = await json('PUT', `/movies/${movie.id}`, {
      ...movieState(movie),
      title: title.trim(),
      media_type: mediaType,
      director: director.trim(),
      // Sent whatever the medium is, because this is a full-state PUT: hiding the
      // BOX for a film must not clear a value the row already holds.
      publisher: publisher.trim(),
      release_year: year ? parseYearInput(year).year : undefined,
      release_circa: year ? parseYearInput(year).circa : undefined,
      genres,
      series: series.trim(),
      series_index: Number(seriesIndex) || 0,
      description: description.trim(),
      // An emptied field sends 0, which is how the API spells "clear it". These
      // two are POINTERS server-side, so they are the form's to send and are
      // deliberately not in movieState.
      tmdb_id: idNum(tmdbId),
      tvdb_id: idNum(tvdbId),
      poster_url: posterUrl || undefined,
      clear_cover: clearCover || undefined,
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setError(errText(r, t('error.save.generic')))
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
    else setError(errText(r, t('error.sync.source')))
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
          <MonoLabel className="mb-1.5 block">{t('film.resync.pick.label')}</MonoLabel>
          <MovieLookupPicker auto title={title} year={year} mediaType={mediaType} tmdbId={tmdbId} tvdbId={tvdbId} onPick={resync} />
        </div>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <NameInput placeholder={t('film.form.title.placeholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <NameInput
          placeholder={creditNounFor(mediaType)}
          value={director}
          onChange={(e) => setDirector(e.target.value)}
        />
        {isGame && (
          <NameInput
            placeholder={t('film.form.publisher.placeholder')}
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
        )}
        <input className="tp-input" placeholder={t('film.form.year.placeholder')} inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder={t('common.field.genres.placeholder')} ariaLabel={t('common.field.genres.label')} transform={titleCaseGenre} />
        <NameInput placeholder={t('film.form.series.placeholder')} value={series} onChange={(e) => setSeries(e.target.value)} />
        <input
          className="tp-input"
          placeholder={t('film.form.series-no.placeholder')}
          inputMode="decimal"
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
        {/* Digits only: both ids are the bare number out of the supplier's URL,
            and pasting the whole URL is the obvious mistake to absorb rather
            than reject. Emptying a field clears that id. */}
        <input
          className="tp-input"
          placeholder={t('film.form.tmdb-id.placeholder')}
          inputMode="numeric"
          value={tmdbId}
          onChange={(e) => setTmdbId(e.target.value.replace(/\D/g, '').slice(0, 12))}
        />
        <input
          className="tp-input"
          placeholder={t('film.form.tvdb-id.placeholder')}
          inputMode="numeric"
          value={tvdbId}
          onChange={(e) => setTvdbId(e.target.value.replace(/\D/g, '').slice(0, 12))}
        />
      </div>
      <textarea className="tp-input" rows="4" placeholder={t('film.form.description.placeholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
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
    // THE REST OF WHAT THE ROW STORES, and the comment above this function says
    // why they have to be here: a field missing from this object is a field the
    // request CLEARS. The ♥, the colour dots and the selection bar all save
    // through it, so without these a recolour used to throw away an episode's
    // title and a game line's act and quest (0047) — and would have thrown away
    // the translation (0051) exactly the same way. utteranceState names the same
    // trap on the third kind.
    episode_name: d.episode_name || '',
    act: d.act || '',
    quest: d.quest || '',
    translation: d.translation || '',
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
function Dialogues({ movieId, cast, movie, creditSeps, onStats, mobileFilterOpen, onMobileFilterOpen, onAdd, dataNonce, onOpenCharacter }) {
  // Only a series carries an episode locator: a film is one runtime, so its
  // timestamp already says where a line is. Drives the form fields, the Episode
  // column, and nothing else — the credit line reads the row's own numbers, so a
  // leftover pair from a work that used to be a show is still visible.
  const show = movie?.media_type === 'show'
  // The other medium whose lines are located differently: a game has no runtime,
  // so its line's edit form asks for the act and the quest instead of a timestamp
  // (see DialogueForm). Derived here beside `show` and passed the same way, so the
  // two answers to "what kind of work is this" cannot disagree.
  const game = movie?.media_type === 'game'
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
  // THE BOARD IS NOT THE WINDOW, and measuring the window is what put four
  // ~170px columns of syllables on a 1080p screen — the owner's report, twice:
  // "i see 4 columns in the board tile, all very skinny... the annotations need
  // at least double the width". useColumnsAt reads window.innerWidth, which was
  // the same question as "how wide is the container" for as long as every board
  // sat in the page's one centred container. This one does not: it is the window
  // MINUS the rail MINUS the hero column, then capped at 880px for measure, so
  // at 1920 the ladder asked for FIVE columns inside 880px.
  //
  // Both the fix and its ladder were written when that was first diagnosed and
  // NEITHER WAS EVER WIRED — useColumnsIn and QUOTE_COLUMNS_IN sat as dead
  // exports with no call site anywhere, which is why the board kept doing the
  // thing its own comment says it must not. Measured against the board, 880px is
  // two columns of ~430, which is the ~400 a quote wants to be read at.
  const [tileCols, boardRef] = useColumnsIn(QUOTE_COLUMNS_IN)
  const reqSeq = useRef(0)
  const base = useFrameBase() // frame codes regenerate per mount (§6)
  const toggleSort = (col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  const mobile = useIsMobileScreen()

  const { stickers, reload: reloadStickers } = useStickers()
  const { map: actorMap, reload: reloadActors } = usePeople('actor') // name→metadata, for actor face icons
  // THE FACES THIS BOARD DRAWS, fetched once if they are not local yet. A line's
  // chip shows the character in costume where there is one (2.2.0), and nothing
  // had ever asked for those bytes outside the People panel — so a reader who
  // never opened that panel saw the actor fallback for ever. Costs no request at
  // all when the work's art is already stored. See cast.jsx.
  useCharacterArt('movie', movieId, cast, () => load())
  // AND THE OTHER PICTURE. The chip draws the actor wherever a role has no art of
  // its own, which is most roles — so the same argument that fetches the character
  // art fetches the headshot behind it. Free when they are all stored already.
  const boardActors = useMemo(
    () => [...new Set(cast.map((c) => (c.actor || '').trim()).filter(Boolean))],
    [cast],
  )
  usePortraitFill('actor', boardActors, actorMap, reloadActors)
  const castListId = `cast-characters-${movieId}`
  const characters = [...new Set(cast.map((c) => c.character).filter(Boolean))]
  const tagMap = Object.fromEntries(tags.map((row) => [row.name, row]))
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
    if (!r.ok) return errText(r, t('error.save.dialogue'))
    setEditingId(null)
    load()
    loadTags()
    return null
  }

  // Asked in the app's voice, and asked on every door: the registry calls
  // ctx.remove(item), so handing it the asker is what makes the confirm
  // unskippable rather than one path out of three.
  const [asking, setAsking] = useState(null)
  async function remove(d) {
    setAsking(null)
    const r = await deleteWithUndo(`/dialogues/${d.id}`, { reload: load })
    if (r.ok) { setExpandedId(null); load() } // collapse before the shorter set re-packs
    else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (♥ clicks).
  //
  // THE THIRD BOARD, and it was left out when the other two stopped refetching.
  // The reply carries the updated row; asking the server for every line on the
  // screen to learn what it just said is the second of two serialised round trips
  // on the most frequent interaction there is. `patchMovesTheRow` is the shared
  // rule — a refetch is still right when the change takes the row out of the
  // filter being looked through — rather than a third hand-rolled copy of it.
  async function patch(d, fields) {
    const r = await json('PUT', `/dialogues/${d.id}`, { ...dialogueState(d), ...fields })
    if (!r.ok) return setError(errText(r, t('error.save.dialogue')))
    setError('')
    if (patchMovesTheRow(fields, { fav, color, tag })) load()
    else setItems((cur) => (cur || []).map((x) => (x.id === d.id ? { ...x, ...r.data } : x)))
  }

  const filtering = tag || fav || color

  // Build the normalised share payload from the chosen dialogue + its movie.
  const sharePayload = (d) =>
    movieShare({
      quote: d.quote,
      note: d.note,
      translation: d.translation,
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
      characterImages: d.character_images,
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
          title={t('film.lines.filter.title')}
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
                placeholder={t('film.lines.filter.placeholder')}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>
            <div>
              <MonoLabel className="mb-2 block">show only</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title={t('common.favourite.filter.tip')}>
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
            <button onClick={() => setFav(!fav)} className={filterChipClass(fav)} title={t('common.favourite.filter.tip')}>
              ♥ Favourites
            </button>
            <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
            {tags.length > 0 && (
              <Select
                ariaLabel={t('common.filters.tag.aria')}
                value={tag}
                onChange={setTag}
                options={[['', t('film.lines.filter.tag.all.label')], ...tags.map((row) => [row.name, row.name])]}
              />
            )}
            <ViewToggle value={view} onChange={setView} />
            {/* Both form factors now open the ONE Add surface, on Capture with
                this title as the target — the shell's ＋ knows which page it is
                on. This is the desktop route to it; the phone's is the ＋ in the
                detail bar above. */}
            <GhostButton onClick={() => onAdd?.('quote', { type: 'movie', id: movieId })}>{t('film.lines.capture.label')}</GhostButton>
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
          {t(filtering ? 'film.lines.nomatch' : 'film.lines.empty')}
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
          <Masonry boardRef={boardRef} columns={tileCols} gap={12} seed={boardSeed} lockOrder={expandedId != null} order="source">
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
                game={game}
                cast={cast}
                onEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(fields) => save(d.id, fields)}
                onPatch={(fields) => patch(d, fields)}
                onDelete={() => setAsking(d)}
                onCopy={() => copyOne(d)}
                onShare={() => setShareTarget(d)}
                onOpenPerson={setPerson}
                onOpenCharacter={onOpenCharacter}
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
                game={game}
                cast={cast}
                onEdit={() => setEditingId(d.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(fields) => save(d.id, fields)}
                onPatch={(fields) => patch(d, fields)}
                onDelete={() => setAsking(d)}
                onCopy={() => copyOne(d)}
                onShare={() => setShareTarget(d)}
                onOpenPerson={setPerson}
                onOpenCharacter={onOpenCharacter}
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
          remove={setAsking}
          show={show}
          game={game}
          cast={cast}
          actorMap={actorMap}
          onCopy={copyOne}
          onShare={setShareTarget}
        />
      )}

      {shareTarget && <ShareDialog share={sharePayload(shareTarget)} seen={{ kind: 'screen', id: shareTarget.id }} onClose={() => setShareTarget(null)} />}
      {/* Shows the LINE rather than naming the row, because that is the only
          thing that says whether the row under your finger was the one you
          meant. */}
      <ConfirmDialog
        open={!!asking}
        title={t('film.lines.delete.confirm')}
        body={<p className="microcopy line-clamp-3">“{asking?.quote || ''}”</p>}
        confirmLabel={t('common.action.delete.label')}
        onConfirm={() => remove(asking)}
        onCancel={() => setAsking(null)}
      />
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
    { key: 'quote', label: t('film.table.quote.label') },
    { key: 'character', label: t('film.table.character.label') },
    show ? { key: 'episode', label: t('film.table.episode.label') } : null,
    { key: 'timestamp', label: t('film.table.time.label') },
    { key: 'favorite', label: t('film.table.favourite.label') },
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
function DialogueTable({ rows, tagMap, stickers = [], reloadStickers, sort, onSort, editingId, setEditingId, save, remove, show = false, game = false, cast = [], actorMap = {}, onCopy, onShare }) {
  const arrow = (k) => (sort.col === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')
  const editingRow = rows.find((d) => d.id === editingId)
  return (
    <Scroller className="ann-table-wrap">
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
                <Tooltip label={t('book.table.sort.tip')} side="bottom">
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
                <ExpandableText text={d.quote} lines={2} style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic' }} />
                {d.tags?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {d.tags.map((name) => {
                      const tag = tagMap[name]
                      return (
                        <TagChip key={name} color={tag?.color} style={tag?.style}>
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
                  noun={t('unit.line.one')}
                  nounPlural={t('unit.line.other')}
                  onCopy={onCopy && (() => onCopy(d))}
                  onShare={onShare && (() => onShare(d))}
                  onEdit={() => setEditingId(d.id)}
                  onDelete={() => setAsking(d)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <FormModal open={!!editingRow} onClose={() => setEditingId(null)} title={t('common.dialogue.edit.title')}>
        {editingRow && (
          <DialogueForm initial={editingRow} onSubmit={(fields) => save(editingRow.id, fields)} onCancel={() => setEditingId(null)} submitLabel={t('common.action.save.label')} show={show} game={game} cast={cast} actorMap={actorMap} tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
        )}
      </FormModal>
    </Scroller>
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
export function Frame({ d, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, show = false, game = false, cast = [], onEdit, onCancelEdit, onSave, onPatch, onDelete, onCopy, onShare, onOpenPerson, actorMap = {}, seps, actionsAlwaysVisible = false, editInline = false, wrapClass = 'mx-4 my-1.5', quoteLines = 6, expanded, onToggleExpand, selection, selectKind = 'dialogue', onOpenCharacter }) {
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
  // Select first, which is what makes the menu and multiselect one feature, with
  // Select all under it — one helper, so the three boards cannot disagree.
  const menuItems = [
    ...selectionMenuItems(selection, d.id, selectKind),
    ...acts.map((x) => ({ ...x, onClick: x.run })),
  ]
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
    <DialogueForm initial={d} onSubmit={onSave} onCancel={onCancelEdit} submitLabel={t('common.action.save.label')} show={show} game={game} cast={cast} actorMap={actorMap} tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} />
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
        {t('film.credit.actor.label')}{' '}
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
  // WHO SAID IT, AS A CHIP, when the stored link resolves to a character record —
  // the same three conditions the book card applies, for the same three reasons.
  // See AnnotationCard, and quote_speaker.go for why `speaker_cast` is not
  // `character`.
  const sp = d.speaker_cast
  // THE CHARACTER'S PICTURE, AND THE ACTOR'S ONLY AS A FALLBACK — the owner's
  // ruling, and it is what this card already did with a separate row of discs
  // (CharacterFaces, then CreditFaces). Folding it into the chip means one face on
  // the row instead of a face beside a face: the still of the role if the work or
  // the record has one, the performer's headshot if not, and the hashed silhouette
  // under both, which is the ladder cast.jsx climbs.
  const spActor = sp ? actorMap[sp.actor] || actorMap[d.actor] : null
  const speakerFace = sp?.image
    ? coverImgURL(sp.image)
    : spActor?.image_path ? personImgURL(spActor.image_path) : ''
  const speakerChip = sp && sp.character_id && onOpenCharacter ? (
    <PersonChip
      kind="character"
      name={sp.name}
      faceName={sp.record_name || sp.name}
      faceSrc={speakerFace}
      // THE ACTOR ON THE SECOND LINE. This card drew the performer beside the
      // chip as loose text; stacked inside the pill it reads as the caption to
      // the character rather than as a second, unrelated name on the row.
      sub={sp.actor || d.actor || ''}
      title={t('common.quote.speaker.tip', { name: sp.name })}
      onPress={() => onOpenCharacter(sp)}
    />
  ) : null
  // Coarse to fine: which episode, who says it, then where in the runtime.
  //
  // THE ACTOR STAYS BESIDE THE CHIP and only the character text goes. They are two
  // different people — the role and the performer — which is 0056's whole point,
  // and this frame has always drawn both. What the chip replaces is the character
  // TEXT, because that is the one thing it now says better.
  const creditParts = [
    episodeLabel(d) || null,
    speakerChip ? null : d.character || null,
    actorCredit,
    d.timestamp || null,
  ].filter(Boolean)
  // Attached sticker → corner seal the line flows around (same as book
  // annotations). Nothing else competes for the top-right corner: the favourite
  // ♥ lives in the action row at the foot of the frame, where a book
  // annotation has always kept it (Library's ActionRow).
  const sticker = d.sticker_id != null ? stickerMap[d.sticker_id] : null
  const quoteStyle = { fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 'var(--type-display-17)', lineHeight: 1.5, color: 'var(--ink)' }
  return (
    <>
      <FormModal open={editing} onClose={onCancelEdit} title={t('common.dialogue.edit.title')}>
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
        <PickMark picked={picked} label={t('common.dialogue.pick.label')} onChange={() => selection.toggle(d.id, selectKind)} />
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
      {/* ITS OWN LINE, ABOVE THE CREDIT ROW — see AnnotationCard, which does the
          same and for the same reason: a 38px pill sharing a row with two 8px dots
          and a line of mono text makes the tallest object set the height of the
          quietest one, and pushes the runtime off to the right of a name. Above
          it, the frame reads down the way it is written: the line, then who said
          it, then where in the runtime. */}
      {speakerChip && <Scroller axis="x" className="mt-1.5 block">{speakerChip}</Scroller>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2">
          {/* THE CHARACTER'S FACE, NOT THE ACTOR'S (2.2.0). A line is spoken by a
              character, so the picture beside it should be the one in costume —
              Amanda Waller rather than Viola Davis. The actor is still named a few
              words along on the credit line, and their own page still shows their
              own face.

              FALLING BACK TO THE ACTOR, which is what TheTVDB's own site does for
              a role with no image: most roles have none, and TMDB has none for
              anybody. `character_images` is absent rather than empty when there is
              nothing stored, so this tells "no picture" from "no character" and a
              library with no character art looks exactly as it did before. */}
          {/* ONLY WHERE THE CHIP IS NOT ALREADY DRAWING ONE. A line with a stored
              speaker has one, and the chip carries their face and their name — so
              these discs beside it were the same person twice, once labelled and
              once not. They stay for the lines the chip cannot speak for: an
              ensemble line names several characters and the linker refuses to
              guess between them, and then this row is the only thing that says
              who is in it. */}
          {!speakerChip && (d.character_images?.length ? (
            <CharacterFaces images={d.character_images} size={24} ring="var(--card)" />
          ) : (
            <CreditFaces names={actorNames} map={actorMap} size={24} ring="var(--card)" />
          ))}
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
            const tag = tagMap[name] // tag objects carry the user's colour + style
            return (
              <TagChip key={name} color={tag?.color} style={tag?.style}>
                {name}
              </TagChip>
            )
          })}
        </div>
      )}
      {/* Above the pasted note, for the reason AnnotationCard gives: the
          translation belongs to the line, the note is a thought about it. */}
      {d.translation && <TranslationLine>{d.translation}</TranslationLine>}
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
            ariaLabel={t('common.colour.category.aria')}
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
//
// `game` REPLACES THE TIMESTAMP WITH THE ACT AND THE QUEST, and that is a fix
// rather than an addition. A game has no runtime: normalizeLocator CLEARS a
// timestamp on a game's line, so the box this form drew for one was asking a
// question whose answer the server threw away without a word. Act and quest are
// what a game's line IS located by, they are in its dedupe hash (0047) — a bark
// reused in two quests is two quotes — and until now this form carried them through
// untouched, so the only ways to set them were an import and a bulk edit.
//
// Exported for Home's favourite-tile inline edit (same form, same contract).
export function DialogueForm({ initial, onSubmit, onCancel, submitLabel, show = false, game = false, cast = [], actorMap = {}, tagSuggestions = [], stickers = [], reloadStickers }) {
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
  // 0047's two, which this form has carried through and never offered.
  const [act, setAct] = useState(initial?.act || '')
  const [quest, setQuest] = useState(initial?.quest || '')
  // Kept as strings: '' is unset and '0' is season 0, and a number field cannot
  // hold both. ?? not ||, so a stored 0 seeds as "0" rather than blank.
  const [season, setSeason] = useState(initial?.season ?? '')
  const [episode, setEpisode] = useState(initial?.episode ?? '')
  const [note, setNote] = useState(initial?.note || '')
  const [translation, setTranslation] = useState(initial?.translation || '')
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
    ? t('error.validate.line-required')
    : episodeFields && episodeVal != null && seasonNum == null
      ? t('error.validate.season-required')
      : ''
  // Joins the dialog's header ✓ when there is one — see FormHostContext.
  const host = useFormHost(busy ? t('common.action.save.busy') : missing)

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
      // A GAME SENDS NO TIMESTAMP. The server clears one on a game's line anyway
      // (normalizeLocator), and this form no longer shows the box — so sending the
      // stale value back would be asserting something it does not display.
      timestamp: game ? '' : timestamp.trim(),
      translation: translation.trim(),
      // An episode's title is carried through — it has no box here — and a game's
      // act and quest are EDITED now, from the two fields below. Both must be SENT
      // either way: omitting a field would clear it on every save, which is the same
      // reason `actor` above is carried rather than blanked.
      episode_name: initial?.episode_name || '',
      act: game ? act.trim() : initial?.act || '',
      quest: game ? quest.trim() : initial?.quest || '',
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
      // The quest clears and the ACT does not, for the reason season and episode
      // stay put below: you add a run of lines from one act, and a quest changes as
      // often as a timestamp does.
      setQuest('')
      // Season and episode deliberately stay put: you add a run of lines from
      // the episode you are watching, so re-typing both every time would be the
      // wrong default. The timestamp above does clear — it changes every line.
      setNote('')
      setTranslation('')
      setTags([])
      setStickerId(null)
    }
  }

  return (
    <form id={host?.formId} onSubmit={submit} className="space-y-2.5">
      <textarea
        className="tp-input"
        rows="3"
        placeholder={t('film.line.form.quote.placeholder')}
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      <div>
        <TokenInput
          value={characters}
          onChange={setCharacters}
          suggestions={charSuggestions}
          placeholder={t('film.line.form.characters.placeholder')}
          ariaLabel={t('film.line.form.characters.aria')}
          nameCase
        />
        {/* The cast maps each character to who plays them — shown here so the
            credit is what you see. Derived, not editable. */}
        {derivedActors.length > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <CreditFaces names={derivedActors} map={actorMap} size={20} ring="var(--card)" />
            <span style={{ ...amberMono, fontSize: 'var(--type-ui-11)' }}>played by {derivedActors.join(', ')}</span>
          </div>
        )}
      </div>
      {/* Episode locator, coarse to fine: a series line says which episode, then
          where in it. Season 0 is legal — it is where specials live — so the
          fields are min=0 and blank means "not recorded". */}
      {/* A GAME'S LINE IS PLACED BY ITS ACT AND ITS QUEST, and never by a
          timestamp — see the note on `game` above. Both are free text: "Act II" and
          "Prologue" are both real answers, and a quest has a name rather than an
          index. */}
      {game ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            className="tp-input"
            placeholder={t('film.line.form.act.placeholder')}
            title={t('film.line.form.act.tip')}
            aria-label={t('common.field.act.label')}
            value={act}
            onChange={(e) => setAct(e.target.value)}
          />
          <input
            className="tp-input"
            placeholder={t('film.line.form.quest.placeholder')}
            title={t('film.line.form.quest.tip')}
            aria-label={t('common.field.quest.label')}
            value={quest}
            onChange={(e) => setQuest(e.target.value)}
          />
        </div>
      ) : episodeFields ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            className="tp-input"
            type="number"
            min="0"
            max="999"
            placeholder={t('film.line.form.season.placeholder')}
            title={t('film.line.form.season.tip')}
            aria-label={t('common.field.season.label')}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
          <input
            className="tp-input"
            type="number"
            min="0"
            max="9999"
            placeholder={t('film.line.form.episode.placeholder')}
            title={t('film.line.form.episode.tip')}
            aria-label={t('common.field.episode.label')}
            value={episode}
            onChange={(e) => setEpisode(e.target.value)}
          />
          {/* Full width under the pair on a phone, third column from sm up. */}
          <input
            className="tp-input col-span-2 sm:col-span-1"
            placeholder={t('film.line.form.timestamp.placeholder')}
            title={t('film.line.form.timestamp.tip')}
            aria-label={t('common.field.timestamp.label')}
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
          />
        </div>
      ) : (
        <input
          className="tp-input"
          placeholder={t('film.line.form.timestamp.placeholder')}
          title={t('film.line.form.timestamp.tip')}
          aria-label={t('common.field.timestamp.label')}
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
        />
      )}
      {/* What the line says, above what you thought about it — the order the frame
          draws them in, and the order the book form uses. */}
      <textarea className="tp-input" rows="2" placeholder={t('common.field.translation.placeholder')}
                aria-label={t('common.field.translation.label')}
                value={translation} onChange={(e) => setTranslation(e.target.value)} />
      <textarea className="tp-input" rows="2" placeholder={t('common.field.note.label')} value={note} onChange={(e) => setNote(e.target.value)} />
      <TokenInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder={t('common.field.tags.placeholder')} ariaLabel={t('common.field.tags.label')} />
      <div className="flex items-center gap-3">
        <MonoLabel>{t('common.mono.colour.label')}</MonoLabel>
        <ColorSwatches value={color} onChange={setColor} ariaLabel={t('common.colour.category.aria')} />
      </div>
      <div>
        <MonoLabel className="mb-1.5 block">{t('common.field.sticker.label')}</MonoLabel>
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
