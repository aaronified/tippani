import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { categoryVar } from './theme.js'
import { episodeLabel } from './text.js'
import { coverImgURL, json, errText, downloadPost } from './api.js'
import { CoverControls, MovieLookupPicker, idNum } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, copyQuote, movieShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { ActionRow, actionsFor } from './actions.jsx'
import { ANTHOLOGY_KIND, useGatherDoor } from './anthologyGather.jsx'
import { QuoteContext, episodeKey, useInContext } from './sources.jsx'
import { useCastArt } from './cast.jsx'
import { LanguageCombo, SuggestCombo, useWorkSuggestions } from './suggest.jsx'
import { CreditFaces, PersonName, SpeakerChips, chipRows, creditsNotOnChips, parseCreditSeps, personImgURL, splitCredits, usePeople } from './people.jsx'
import {
  WorkCard,
  WorkListScaffold,
  capKeyFor,
  countQuotes,
  creditNounFor,
  moveLabel,
  patchMovesTheRow,
  pinInProgress,
  useBoardWindow,
} from './works.jsx'
import { KINDS } from './workKinds.js'
import { BoardHead } from './boardHead.jsx'
import { sortAnnotations } from './boardOrder.js'
import WorkDetail from './WorkDetail.jsx'
import { QUOTE_TEXT } from './fonts.js'
import { t } from './i18n.js'
import { ProseArea } from './proseField.jsx'
import { quoteTexts } from './text.js'
import { useTextOrder } from './textOrderHost.jsx'
import { usePersonOpener } from './personOpen.jsx'
import {
  ColorSwatches,
  ConfirmDialog,
  EdgeRow,
  EmptyState,
  ErrorText,
  ExpandableText,
  FormModal,
  FrameCode,
  frameCode,
  GhostButton,
  HandNote,
  IconMetadata,
  MonoLabel,
  NameInput,
  NameScroll,
  parseYearInput,
  YearField,
  yearInputValue,
  QuizSkipMark,
  Sprockets,
  TagChip,
  titleCaseGenre,
  Toggle,
  TokenInput,
  TranslationLine,
  useCardMenu,
  useCoverSize,
  useFormHost,
  useFrameBase,
  useIsMobileScreen,
  useReveal,
  PanelHost,
  usePanelStack,
  Tally,
  IconNavQuotes,
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
export default function Movies({ openId, onOpen, onClose, creditSeparators, onAdd, onSearch, onSeedSearch, dataNonce }) {
  if (openId) {
    return (
      <MovieDetail
        id={openId}
        onClose={onClose}
        creditSeparators={creditSeparators}
        onAdd={onAdd}
        dataNonce={dataNonce} onSearch={onSearch} onSeedSearch={onSeedSearch} />
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
    // 0073 — see bookState's note. Unconditional in the server's UPDATE, so an
    // omission is a deletion.
    text_order: m.text_order || '',
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

function MovieList({ onOpen, creditSeparators, dataNonce }) {
  const [movies, setMovies] = useState(null)
  const { map: directorMap } = usePeople('director') // name→metadata, for director/creator face chips
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
  const [status, setStatus] = useState(null) // GET /metadata/status → Add-movie is status-aware
  const [fav, setFav] = useState(false)
  const [sort, setSort] = useState('recent')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [editWork, setEditWork] = useState(null)
  const [coverSize] = useCoverSize('tippani:size:movies', 150) // set from Settings
  const mobile = useIsMobileScreen()

  async function load() {
    const r = await json('GET', '/movies')
    if (r.ok) setMovies(r.data.movies)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
    // A title added through the shell's Add surface lands server-side without this
    // list knowing — the surface ticks dataNonce when it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataNonce])
  useEffect(() => {
    json('GET', '/metadata/status').then((r) => {
      if (r.ok) setStatus(r.data)
    })
  }, [])

  const tmdbSource = status?.tmdb?.source

  // Favourites, then the sort. The default is server order with what you are
  // watching floated to the top; an explicit sort takes over completely.
  const shown = useMemo(() => {
    const list = fav ? (movies || []).filter((m) => m.favorite) : [...(movies || [])]
    if (sort === 'recent') return pinInProgress(list, 'movie')
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [movies, fav, sort])

  const flatWin = useBoardWindow(shown.length, shown)

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
      fav={fav}
      setFav={setFav}
      sort={sort}
      setSort={setSort}
      sortOptions={[
        ['recent', t('movies.sort.recent.label')],
        ['title', t('movies.sort.title.label')],
      ]}
      onReset={() => { setFav(false); setSort('recent') }}
      exportDialog={
        <ConfirmDialog
          open={exporting}
          title={t('movies.export.confirm.title')}
          body={(() => {
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
      {editWork != null && (
        <EditWorkModal
          kind="movies"
          id={editWork}
          title={t('film.form.edit.title')}
          onDone={() => {
            setEditWork(null)
            load()
          }}
          onCancel={() => setEditWork(null)}
        />
      )}
      <Reveal
        className="grid gap-x-5 gap-y-8"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}
      >
        {shown.slice(0, flatWin.count).map((m) => (
          <WorkCard key={m.id} kind="movie" item={m} onOpen={onOpen} people={directorMap} seps={creditSeps} onChanged={load} onEdit={setEditWork} />
        ))}
        {flatWin.more && <div ref={flatWin.sentinel} aria-hidden="true" className="h-px" />}
      </Reveal>
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
                <Tally n={e.dialogue_count} word={t('unit.dialogue', { count: e.dialogue_count })} icon={<IconNavQuotes />} />
                {' · '}
                {t(e.has_poster ? 'movies.duplicate.poster.yes' : 'movies.duplicate.poster.no')}
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
        <YearField
          value={year}
          onChange={setYear}
          placeholder={t('film.form.year.placeholder')}
          circaLabel={t('common.field.year.circa.label')}
        />
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
      renderBoard={({ item, seps, onStats, onAdd, dataNonce, openCharacter }) => (
        <Dialogues
          movieId={item.id}
          cast={item.cast || []}
          movie={item}
          creditSeps={seps}
          onStats={onStats}
          onOpenCharacter={openCharacter}
          onAdd={onAdd}
          dataNonce={dataNonce}
        />
      )}
    />
  )
}


// EditWorkModal — the work's own edit form, opened from a card's ⋯ menu.
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
  const [year, setYear] = useState(yearInputValue(movie.release_year, movie.release_circa))
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
  const [posterSource, setPosterSource] = useState('') // the supplier a picked poster is credited to
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
      ...(posterUrl && posterSource ? { sources: { poster: posterSource } } : {}),
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
        onSetUrl={(u, src) => {
          setPosterUrl(u)
          setPosterSource(src || '')
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
        <YearField
          value={year}
          onChange={setYear}
          placeholder={t('film.form.year.placeholder')}
          circaLabel={t('common.field.year.circa.label')}
        />
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
    // request CLEARS. The ♥ and the colour dots all save
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
// DialogueBoard — one set of lines, drawn as the film strip. It is the only view:
// the grid and the table were the same lines arranged two more ways, and a board
// with one view has nothing to switch.
function DialogueBoard({
  rows, tagMap, stickerMap, stickers, reloadStickers, editingId, setEditingId,
  save, patch, setAsking, copyOne, setShareTarget, openPerson, onOpenCharacter,
  actorMap, creditSeps, show, game, cast, base,
}) {
  return (
    <Reveal className="film-strip">
      <Sprockets count={15} />
      <EdgeRow code={frameCode(base)} />
      {rows.map((d, i) => (
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
            onOpenPerson={openPerson}
            onOpenCharacter={onOpenCharacter}
            actorMap={actorMap}
            seps={creditSeps}
            quoteLines={5}
          />
        </Fragment>
      ))}
      <Sprockets count={15} />
    </Reveal>
  )
}

function Dialogues({ movieId, cast, movie, creditSeps, onStats, onAdd, dataNonce, onOpenCharacter }) {
  const show = movie?.media_type === 'show'
  const game = movie?.media_type === 'game'
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // dialogue being shared
  const personStack = usePanelStack()
  const openPerson = usePersonOpener(personStack)
  const [fav, setFav] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  // Favourites, then the order: the default is the order the lines are in (by
  // episode on a show), and the other is the time of the line.
  const [sort, setSort] = useState({ col: show ? 'episode' : 'timestamp', dir: 'asc' })
  const reqSeq = useRef(0)
  const base = useFrameBase() // frame codes regenerate per mount (§6)
  const mobile = useIsMobileScreen()
  const { stickers, reload: reloadStickers } = useStickers()
  const { map: actorMap, reload: reloadActors } = usePeople('actor') // name→metadata, for actor face icons
  const boardActors = useMemo(
    () => [...new Set(cast.map((c) => (c.actor || '').trim()).filter(Boolean))],
    [cast],
  )
  useCastArt('movie', movieId, {
    cast,
    names: boardActors,
    people: actorMap,
    onFilled: ({ characters, portraits }) => {
      if (characters) load()
      if (portraits) reloadActors()
    },
  })
  const tagMap = Object.fromEntries(tags.map((row) => [row.name, row]))
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  const firstNonce = useRef(true)
  useEffect(() => {
    if (firstNonce.current) { firstNonce.current = false; return }
    load()
    loadTags() // a capture can invent a tag
  }, [dataNonce])
  async function loadTags() {
    const r = await json('GET', '/tags')
    if (r.ok) setTags(r.data.tags)
  }
  async function load() {
    const seq = ++reqSeq.current
    const params = new URLSearchParams({ movie_id: movieId })
    if (fav) params.set('favorite', '1')
    const r = await json('GET', `/dialogues?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) setItems(r.data.dialogues)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [movieId, fav])
  useEffect(() => {
    loadTags()
  }, [movieId])
  useEffect(() => {
    if (items && !fav) onStats?.(countQuotes(items))
  }, [items, fav])

  async function save(id, fields) {
    const r = await json('PUT', `/dialogues/${id}`, fields)
    if (!r.ok) return errText(r, t('error.save.dialogue'))
    setEditingId(null)
    load()
    loadTags()
    return null
  }
  const [asking, setAsking] = useState(null)
  async function remove(d) {
    setAsking(null)
    const r = await deleteWithUndo(`/dialogues/${d.id}`, { reload: load })
    if (r.ok) load()
    else setError(errText(r))
  }
  async function patch(d, fields) {
    const r = await json('PUT', `/dialogues/${d.id}`, { ...dialogueState(d), ...fields })
    if (!r.ok) return setError(errText(r, t('error.save.dialogue')))
    setError('')
    if (patchMovesTheRow(fields, { fav })) load()
    else setItems((cur) => (cur || []).map((x) => (x.id === d.id ? { ...x, ...r.data } : x)))
  }
  const sortedRows = useMemo(() => sortAnnotations(items || [], sort), [items, sort])
  const sharePayload = (d) =>
    movieShare({
      quote: d.quote,
      note: d.note,
      translation: d.translation,
      language: d.language,
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
  const copyOne = (d) => copyQuote(sharePayload(d))

  return (
    <div className="space-y-4">
      {mobile && (
        <div className="board-strip">
          <MonoLabel>{countOf(sortedRows.length, 'unit.line')}</MonoLabel>
        </div>
      )}
      <BoardHead
        sort={sort}
        onSort={setSort}
        sortOptions={[['default', t('board.sort.default.label')], ['date', t('board.sort.date.label')]]}
        fav={fav}
        onFav={setFav}
        captureLabel={t('film.lines.capture.label')}
        onCapture={() => onAdd?.('quote', { type: 'movie', id: movieId })}
      />
      <ErrorText>{error}</ErrorText>
      {items && items.length === 0 && (
        <EmptyState>
          {t(fav ? 'film.lines.nomatch' : 'film.lines.empty')}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <DialogueBoard
          rows={sortedRows}
          tagMap={tagMap}
          stickerMap={stickerMap}
          stickers={stickers}
          reloadStickers={reloadStickers}
          editingId={editingId}
          setEditingId={setEditingId}
          save={save}
          patch={patch}
          setAsking={setAsking}
          copyOne={copyOne}
          setShareTarget={setShareTarget}
          openPerson={openPerson}
          onOpenCharacter={onOpenCharacter}
          actorMap={actorMap}
          creditSeps={creditSeps}
          show={show}
          game={game}
          cast={cast}
          base={base}
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
      {/* THE HOST FOR THE PERSON'S OWN SCREEN. Without it the router above opens a
          panel into nothing, which is a dead press. */}
      <PanelHost stack={personStack} />
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
export function Frame({ d, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, show = false, game = false, cast = [], onEdit, onCancelEdit, onSave, onPatch, onDelete, onCopy, onShare, onOpenPerson, actorMap = {}, seps, actionsAlwaysVisible = false, editInline = false, wrapClass = 'mx-4 my-1.5', quoteLines = 6, expanded, onToggleExpand, onOpenCharacter }) {
  // wrapClass carries the frame's outer spacing: the strip (list) view indents
  // frames from the film edges (mx-4 my-1.5); the masonry (tiles) view drops it
  // so the card fills its column slot and the masonry gap does the spacing.
  const frameClass = ['film-frame', wrapClass, 'px-5 py-4'].filter(Boolean).join(' ')
  // From the registry, like every other card (actions.jsx). A dialogue is an
  // annotation with different credits, so it gets the same set in the same places.
  const gather = useGatherDoor()
  // The line in its subtitle: stored context, so absent where there is none.
  const inContext = useInContext('dialogue', d.movie_id, d.id)
  const acts = actionsFor('dialogue', d, {
    inContext: inContext.open,
    copy: onCopy && (() => onCopy()),
    share: onShare && (() => onShare()),
    edit: onEdit && (() => onEdit()),
    // The same immediate PUT the frame's own ♥ runs, so the two cannot disagree
    // about what favouriting is.
    favourite: onPatch && (() => onPatch({ favorite: !d.favorite })),
    favourited: !!d.favorite,
    // A film line gathers exactly as a highlight does — "a dialogue is an
    // annotation with different credits", as this file's own comment has it, and
    // the registry would be lying about that if only one of them could be kept.
    addToAnthology: () => gather.open({ items: [{ kind: ANTHOLOGY_KIND.dialogue, item_id: d.id }], count: 1 }),
    remove: onDelete && (() => onDelete()),
  })
  // The same list the row and the ⋯ render, on a right-click or Shift+F10; a long
  // press on the frame's whitespace SELECTS it, and a long press on the line itself
  // is left to the browser so a thumb can still pull a phrase out (useCardMenu).
  // Select first, which is what makes the menu and multiselect one feature, with
  // Select all under it — one helper, so the three boards cannot disagree.
  const { cardProps, menuClass, menu } = useCardMenu(acts.map((x) => ({ ...x, onClick: x.run })))
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
  // A BUILDER RATHER THAN A VALUE, because which names belong on this line is not
  // known until the chips below have been folded — the line carries the ones the
  // chips do NOT already print, and nothing when that is none.
  const actorCreditFor = (names) =>
    names.length > 0 ? (
      <span key="actor">
        {t('film.credit.actor.label')}{' '}
        {names.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && ', '}
            {onOpenPerson ? (
              // `actorMap` is already in hand for the faces below; handing it to
              // the name too is what makes this credit open the person's own
              // screen rather than the modal that predates it.
              <PersonName kind="actor" name={n} person={actorMap[n]} onOpen={onOpenPerson} className="" style={actorInherit}>
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
  // WHICH TEXT LEADS, from the same pair the annotation card asks. THE FILM FRAME
  // DREW ITS OWN: it took `d.quote` for the big type and `d.translation` for the
  // line below, unconditionally. A dialogue is an annotation with different
  // credits, and the two cards should not answer the same question two ways.
  //
  // IT CHANGED NOTHING THE DAY IT LANDED, AND THAT WAS THE POINT — but the reason
  // has since expired and the comment outlived it. It said `dialogues` had "a
  // `translation` column but no `language` one (0051)", so the pair came back in
  // the order the old code hard-wired; 0071 added `language` to annotations and
  // dialogues both, under the ask "it is needed everywhere". The line below has
  // been reading `d.language` ever since. So the structural change did exactly what
  // it was built for: the frame inherited the behaviour on the day the column
  // arrived, without anyone having to come back and find it.
  const frameOrder = useTextOrder({ language: d?.language })
  // NO TEXT MENU ON THIS SCREEN, so 'both' — which is not "show both in a fixed
  // order" but "let the language decide" (quoteTexts).
  //
  // AND THE FACE EACH LINE IS SET IN, off the same answer. A film line in Bengali
  // is a quote in Bengali; the frame drawing it in the Latin text face while the
  // book card beside it draws its own in Noto Serif Bengali is the two cards
  // disagreeing about the same question, which is what asking the shared function
  // exists to prevent.
  const { body: frameBody, second: frameSecond, bodyScript, secondScript } = quoteTexts(d, frameOrder)
  const sp = d.speaker_cast
  // THE CHARACTER'S PICTURE, AND THE ACTOR'S ONLY AS A FALLBACK — the owner's
  // ruling, and it is what this card already did with a separate row of discs
  // (CharacterFaces, then CreditFaces). Folding it into the chip means one face on
  // the row instead of a face beside a face: the still of the role if the work or
  // the record has one, the performer's headshot if not, and the hashed silhouette
  // under both, which is the ladder cast.jsx climbs.
  const spActor = sp ? actorMap[sp.actor] || actorMap[d.actor] : null
  // A CHIP PER CHARACTER, the speaker leading. Shared with the book card so the
  // two cannot drift — they did once, and that divergence is how the
  // missing-face bug survived on one side after being fixed on the other.
  //
  // THE FILM SIDE HANDS IN ITS OWN SPEAKER FACE, because its ladder has a rung
  // the book's has not: this page holds the work's actors in `actorMap`, so a
  // character with no still of their own can wear the performer's headshot. The
  // other named characters have no performer the card knows of, so they take the
  // hashed silhouette — which is the honest answer rather than somebody else's
  // face.
  const speaker = sp
    ? {
        ...sp,
        image: sp.image || '',
        actor_image: !sp.image && spActor?.image_path ? spActor.image_path : sp.actor_image || '',
        actor: sp.actor || d.actor || '',
        // `onOpen` is no longer spread here: chipRows reads the handler it is
        // given, which is the prop below, so the object carries data only.
      }
    : null
  const chipCount = chipRows(d.character_images, speaker).length
  // Coarse to fine: which episode, who says it, then where in the runtime.
  //
  // THE ACTOR STAYS BESIDE THE CHIP and only the character text goes. They are two
  // different people — the role and the performer — which is 0056's whole point,
  // and this frame has always drawn both. What the chip replaces is the character
  // TEXT, because that is the one thing it now says better.
  // WHAT THE CHIP ALREADY SAYS DOES NOT GET A LINE OF ITS OWN. The chip carries
  // the character and the performer under it, so both the character text and the
  // PLAYED BY line are the same two names a second time — "still 2 lines
  // everywhere instead of the actor in the pill".
  //
  // NAME BY NAME, not line or no line. A line may credit several performers —
  // they are typed like genres — while the chips resolve only the ones the work's
  // cast knows, so an all-or-nothing test kept the whole line for one unmatched
  // name and printed the other two performers twice. What the chips cover goes;
  // what they do not stays, on a line with just those names on it.
  const uncredited = creditsNotOnChips(actorNames, d.character_images, speaker, seps)
  const creditParts = [
    episodeLabel(d) || null,
    chipCount ? null : d.character || null,
    actorCreditFor(uncredited),
    d.timestamp || null,
  ].filter(Boolean)
  // Attached sticker → corner seal the line flows around (same as book
  // annotations). Nothing else competes for the top-right corner: the favourite
  // ♥ lives in the action row at the foot of the frame, where a book
  // annotation has always kept it (Library's ActionRow).
  const sticker = d.sticker_id != null ? stickerMap[d.sticker_id] : null
  const quoteStyle = { ...QUOTE_TEXT, fontSize: 'var(--type-display-17)', color: 'var(--ink)' }
  return (
    <>
      <FormModal open={editing} onClose={onCancelEdit} title={t('common.dialogue.edit.title')}>
        {editForm}
      </FormModal>
    <article
      className={`${frameClass} ${menuClass}`}
      style={frameStyle}
      {...cardProps}
    >
      {frameBody &&
        (sticker ? (
          <FlowQuote
            text={frameBody}
            className={bodyScript}
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
            text={frameBody}
            className={bodyScript}
            lines={quoteLines}
            style={quoteStyle}
            open={accordion ? !!expanded : undefined}
            onToggle={accordion ? onToggleExpand : undefined}
          />
        ))}
      {/* THE OTHER HALF OF THE BODY, and it sat four bands lower than that for a
          release. It was drawn after the chips, the credit row AND the tag row —
          under a comment reading "for the reason AnnotationCard gives", which is
          the reason for putting it ABOVE THE NOTE and says nothing about putting
          it below everything else. So a bilingual line read the words, who said
          them, where, its tags, and only then what the words mean.

          A RULE CITED RATHER THAN CALLED IS A RULE WITH TWO READINGS. The owner's
          card shape is one order for every annotation card in the app — "quote,
          translation: these will form the card body. both separately expandable",
          then the chip, the attribution, the note, the tags, the actions — and
          `AnnotationCard` has drawn it that way since. This is the twin catching
          up, not a new decision. WHICH OF THE TWO LEADS is `quoteTexts`' answer
          and not this site's. */}
      {frameSecond && <TranslationLine className={secondScript}>{frameSecond}</TranslationLine>}
      {/* ITS OWN LINE, ABOVE THE CREDIT ROW — see AnnotationCard, which does the
          same and for the same reason: a 38px pill sharing a row with two 8px dots
          and a line of mono text makes the tallest object set the height of the
          quietest one, and pushes the runtime off to the right of a name. Above
          it, the frame reads down the way it is written: the line, then who said
          it, then where in the runtime. */}
      <SpeakerChips
        images={d.character_images}
        speaker={speaker}
        onOpenCharacter={onOpenCharacter}
        className="mt-1.5"
        // THE PERFORMER GOES UNDER THE CHARACTER, IN THE CHIP. The owner has now
        // said this twice — "the actor is named below, not in the pill", and then
        // "still 2 lines everywhere instead of the actor in the pill" — and the
        // first time I read it the other way round and took the performer OUT of
        // the chip, which is the opposite of what was asked. The duplication was
        // real; the half that had to go was the LINE, not the subtitle.
      />
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
          {/* THE CHARACTER DISCS ARE GONE and the ACTOR DISCS STAY, which is the
              distinction the old pair of branches was reaching for. A stack of
              faceless discs says how MANY characters a line names and not one of
              their names, and every one of those lines now has a chip each above.
              The actors are a different fact — the performers rather than the
              roles, which is 0056's whole point — so they still stand in on the
              lines where no character resolves at all. */}
          {chipCount === 0 && (
            <CreditFaces names={actorNames} map={actorMap} size={24} ring="var(--card)" />
          )}
          {/* THE RECALL MARK MOVED TO THE ACTION ROW — see AnnotationCard's note
              at the same place. What stays is the quiz mark, which is a fact
              about the line rather than something you do to it. */}
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
      {/* THE NOTE ABOVE THE TAGS, which is bands 4 and 5 of the owner's card shape
          and which this card had the other way round. The book card has always
          drawn it this way; a guard comparing the two is what found it, after a
          guard checking this card alone would have passed — it was internally
          consistent, just not the same as its twin. */}
      {d.note && <HandNote className="mt-2">{d.note}</HandNote>}
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
      {/* §7 declutter: the ♥ is the frame's resting mark and leads this row, then
          copy and share, then the colour quick-pick — the three reveal on hover
          (desktop) and stand on a phone. Edit and delete are behind the ⋯ at
          every width.

          IT IS LIBRARY'S ROW AND NOT A COPY OF IT NOW. This block used to end
          with a promise — "Order and contents match Library's ActionRow exactly"
          — and it was a promise two readers had to keep by hand. They did keep
          the order and the contents; what had already drifted was the spacing,
          Library's row wearing a `pt-1.5` this one never had. One function both
          screens call is the repo's answer to exactly that, and the frame passes
          the one thing it differs in (no top padding) rather than keeping its own
          copy of the verb. See actions.jsx. */}
      <ActionRow
        acts={acts}
        item={d}
        kind="screen"
        color={d.color || 'yellow'}
        onColor={(c) => onPatch({ color: c })}
        onFavourite={(v) => onPatch({ favorite: v })}
        actionsAlwaysVisible={actionsAlwaysVisible}
      />
      {menu}
      {gather.node}
      {inContext.node}
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
  // A GAME FOR ITS PACKS, OR ANY WORK WHOSE HOST HANDED US NO CAST.
  //
  // The first half is the saving: `useWorkSuggestions` fetches the cast alongside
  // the pack list, and a work PAGE already hands this form a cast — so on a film
  // or a show opened from there, this would be two requests for nothing.
  //
  // THE SECOND HALF IS THE HOST THAT HANDS US NOTHING, and it is why this form
  // asks rather than only accepting. The favourites editor (Home.jsx) renders this
  // through a per-kind registry and passes no `cast` at all, so editing a line
  // from there offered no character while editing the SAME line from its work page
  // offered the whole cast. That is the repo's rule about two things that look the
  // same, failing at the seam between a form and its hosts — and the fix belongs
  // here rather than in each host, because a fourth host would arrive with the
  // same gap. `AnnotationForm` has always worked this way: it takes a `bookId` and
  // fetches its own pool (Library.jsx), which is the pattern this now matches.
  //
  // `/movies/{id}/cast` runs `adoptQuoteCharacters`, so what comes back is the
  // provider's cast UNION every character this work's own lines already name — a
  // character typed by hand on one line is offered on the next.
  const suggest = useWorkSuggestions(
    initial?.movie_id && (game || !cast.length) ? { kind: 'screen', id: initial.movie_id } : null)
  // The prop wins when there is one: a work page has already paid for that list,
  // and re-reading the fetched copy would flicker the box as it arrived.
  //
  // NO TEST PINS THE ORDER, AND THAT IS NOT AN OMISSION. Flipping this ternary
  // changes nothing observable, because the gate above makes "both lists non-empty"
  // reachable in exactly one case — a GAME opened from its work page, which is
  // handed a cast and fetches anyway for the pack list — and there the two lists are
  // the same rows from the same endpoint. Everywhere else one of them is empty and
  // both orderings pick the other. A mutation was written for this and could not be
  // made to fail; it is recorded here rather than replaced with a contrived case,
  // because a test that pins an arbitrary choice teaches the next reader that the
  // choice mattered.
  const castPool = cast.length ? cast : suggest.cast
  // character↔actor lookups from the movie's cast (case-insensitive keys), off
  // `castPool` rather than the prop — see it for which of the two this is.
  const charActor = useMemo(() => {
    const m = new Map()
    for (const c of castPool) if (c.character) m.set(c.character.trim().toLowerCase(), (c.actor || '').trim())
    return m
  }, [castPool])
  const charSuggestions = useMemo(() => [...new Set(castPool.map((c) => c.character).filter(Boolean))], [castPool])

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
  // 0070/0071's THREE, AND THIS FORM HAD NONE OF THEM. The add surface drew all
  // three from the day the migrations landed and this form drew none, which on a
  // full-state PUT is not "not offered" — it is CLEARED on every save. Editing a
  // game's line wiped its pack; editing a film's line wiped where the line stops;
  // editing anything wiped what the line is in. `edit-parity.test.js` now walks
  // the add surface's own field table against this payload so a fourth cannot be
  // added to one side alone.
  const [timestampEnd, setTimestampEnd] = useState(initial?.timestamp_end || '')
  const [dlc, setDlc] = useState(initial?.dlc || '')
  const [language, setLanguage] = useState(initial?.language || '')

  // THE PACKS THIS GAME'S OWN LINES ALREADY NAME, so the DLC box offers them here
  // exactly as it does on the add surface. The owner's audit: "both should offer
  // the same entry support for the same fields."
  //
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
      // Both ends together, and both cleared on a game for the same reason: the
      // server discards a runtime a game's line does not have, so sending a stale
      // one would be asserting something this form does not show.
      timestamp_end: game ? '' : timestampEnd.trim(),
      // A PACK IS A GAME'S ALONE. A film or a show has no DLC column to fill, and
      // the server refuses one — so it goes out empty rather than carrying whatever
      // was there, exactly as `timestamp` does in the other direction.
      dlc: game ? dlc.trim() : '',
      language: language.trim(),
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
      {/* Spell-checked while it is being edited — see proseField.jsx. */}
      <ProseArea
        language={language}
        className="tp-input"
        rows="3"
        placeholder={t('film.line.form.quote.placeholder')}
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      {/* The lines around this line in its subtitle file. */}
      <QuoteContext kind="dialogue" id={initial?.id} subject="screen" workId={initial?.movie_id} episode={episodeKey(initial)} />
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
        <>
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
            // A quest has a NAME — see ui.jsx's "name casing". This form lays out
            // its own inputs rather than using Field, so the hint is spelled here.
            autoCapitalize="words"
            placeholder={t('film.line.form.quest.placeholder')}
            title={t('film.line.form.quest.tip')}
            aria-label={t('common.field.quest.label')}
            value={quest}
            onChange={(e) => setQuest(e.target.value)}
          />
        </div>
        {/* THE PACK THE ACT AND QUEST SIT INSIDE (0071), and a name like every
            other box on this row. Under the pair rather than beside it: a DLC name
            is long — "Blood and Wine", "Far Harbor" — and this row is already two
            columns on a phone. */}
        <SuggestCombo
          ariaLabel={t('common.field.dlc.label')}
          placeholder={t('add.form.dlc.placeholder')}
          value={dlc}
          options={suggest.packs.map((n) => ({ name: n }))}
          onChange={setDlc}
        />
        </>
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
          {/* WHERE THE LINE STOPS (0070). Beside the start, because a stretch of
              runtime is one fact with two ends and reading them apart is reading
              neither. */}
          <input
            className="tp-input col-span-2 sm:col-span-1"
            placeholder={t('add.form.timestamp-end.placeholder')}
            aria-label={t('common.field.timestamp-end.label')}
            value={timestampEnd}
            onChange={(e) => setTimestampEnd(e.target.value)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input
            className="tp-input"
            placeholder={t('film.line.form.timestamp.placeholder')}
            title={t('film.line.form.timestamp.tip')}
            aria-label={t('common.field.timestamp.label')}
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
          />
          <input
            className="tp-input"
            placeholder={t('add.form.timestamp-end.placeholder')}
            aria-label={t('common.field.timestamp-end.label')}
            value={timestampEnd}
            onChange={(e) => setTimestampEnd(e.target.value)}
          />
        </div>
      )}
      {/* What the line says, above what you thought about it — the order the frame
          draws them in, and the order the book form uses. */}
      {/* WHAT THE LINE IS IN (0071), immediately above the translation because it
          is the fact that RANKS the two texts — the app cannot decide which of them
          leads without it. A name, so it takes the capital hint. */}
      {/* NO VISIBLE LABEL, because its neighbours have none — this form is a stack of
          bare inputs carrying aria-labels, and a single labelled row would read as the
          one field that mattered. LanguageCombo draws no MonoLabel when it is given
          only an ariaLabel.

          THE `.tp-field` WRAPPER COSTS NOTHING HERE, which is worth saying because it
          is the one language site that was not already a Field. index.css:1800-1801
          gives it `display: block` and a 14px top margin ONLY between two adjacent
          `.tp-field`s; this one's neighbours are a `div.grid` and a `textarea`, so
          there is no adjacency and no margin to gain. */}
      <LanguageCombo
        placeholder={t('common.field.language.placeholder')}
        ariaLabel={t('common.field.language.label')}
        value={language}
        onChange={setLanguage}
      />
      <ProseArea language={language} className="tp-input" rows="2" placeholder={t('common.field.translation.placeholder')}
                aria-label={t('common.field.translation.label')}
                value={translation} onChange={(e) => setTranslation(e.target.value)} />
      <ProseArea language={language} className="tp-input" rows="2" placeholder={t('common.field.note.label')} value={note} onChange={(e) => setNote(e.target.value)} />
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
