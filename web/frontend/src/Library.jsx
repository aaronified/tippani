import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { coverImgURL, json, errText, downloadPost } from './api.js'
import { chapterLabel } from './text.js'
import { usePersonOpener } from './personOpen.jsx'
import { CastCombo, Datalist, useWorkSuggestions } from './suggest.jsx'
import { CoverControls, BookLookupPicker } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, bookShare, copyQuote } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { actionsFor, atOverflow, atRow } from './actions.jsx'
import { selectionClick, selectionMenuItems, useSelection } from './selection.jsx'
import { facetValue, facetValues, publishSearchSeed, seedableChips, withFacet, withFacetValues } from './facets.js'
import { SelectionBar } from './SelectionBar.jsx'
import { PeopleChips, PersonModal, SpeakerChips, chipRows, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { categoryHidden, categoryName } from './theme.js'
import {
  GroupHeading,
  WorkCard,
  WishlistFolder,
  WorkListScaffold,
  countQuotes,
  groupWorks,
  minusQuote,
  patchMovesTheRow,
  pinInProgress,
  statusFilter,
  useBoardWindow,
  ANNOTATION_PAGE,
  wishFilter,
} from './works.jsx'
import { KINDS, bookGenres } from './workKinds.js'
import WorkDetail from './WorkDetail.jsx'
import { t } from './i18n.js'
import {
  ActionMenu,
  ANNOTATION_COLORS,
  QUOTE_COLUMNS_IN,
  byLastRead,
  bySeries,
  clampSequence,
  ColorSwatches,
  ConfirmDialog,
  Cover,
  EmptyState,
  ErrorText,
  ExpandableText,
  Field,
  FilterChip,
  formatYear,
  FormModal,
  GhostButton,
  HandCard,
  HandNote,
  Hearts,
  IconCheck,
  IconSliders,
  IconSortAsc,
  IconSortDesc,
  Masonry,
  MobileSheet,
  MonoLabel,
  mulberry32,
  parseYearInput,
  PickMark,
  QuizSkipMark,
  QuoteActions,
  QuoteTools,
  ReviewDot,
  Scroller,
  Select,
  StickerButton,
  SheetFooter,
  TableActions,
  TagChip,
  titleCaseGenre,
  TokenInput,
  Tooltip,
  TranslationLine,
  useCardMenu,
  useColumnsIn,
  useCoverSize,
  useFormHost,
  useIsMobileScreen,
  usePersistedState,
  useScreenBar,
  ViewIcon,
  ViewToggle,
  PanelHost,
  usePanelStack,
  IconHeartOn,
} from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary' // aesthetic-aware primary (§6)
const QUOTE_STYLE = { fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-17)', lineHeight: 1.55 }

// Library is the books tab (§8.3): the cover grid, or a single book's detail
// view (§8.5). Adding anything — a book, a highlight, an import — belongs to the
// shell's one ＋ Add surface (`onAdd`), which since 1.4.1 knows it is on this
// page and opens on the right thing; `dataNonce` is how anything saved there
// tells whichever list it changed — the book grid or a book's quotes — to refetch.
export default function Library({ openId, onOpen, onClose, onOpenMovie, creditSeparators, onAdd, onSearch, onSeedSearch, dataNonce }) {
  if (openId) {
    return (
      <BookDetail
        id={openId}
        onClose={onClose}
        creditSeparators={creditSeparators}
        onAdd={onAdd}
        dataNonce={dataNonce} onSearch={onSearch} onSeedSearch={onSeedSearch} />
    )
  }
  return <BookList onOpen={onOpen} onOpenMovie={onOpenMovie} creditSeparators={creditSeparators} dataNonce={dataNonce} />
}

// The five group-by dimensions. A function, not a table: it is read at render.
const groupOptions = () => [
  ['none', t('library.group.none.label')],
  ['series', t('library.group.series.label')],
  ['author', t('library.group.author.label')],
  ['decade', t('library.group.decade.label')],
  ['genre', t('library.group.genre.label')],
]

// countOf is "3 books" / "1 quote", from the shared unit table.
const countOf = (n, unit) => t('common.count.phrase', { n, noun: t(unit, { count: n }) })

// bookState is the full PUT body for a book (PUT is full-state) — used by the
// detail-header ♥ so a single-field change carries every other field intact.
export function bookState(b) {
  return {
    title: b.title,
    author: b.author || '',
    // The other two credits (1.12.0). Missing from here, the ♥ on the detail
    // header — a one-field change that sends the whole book — would clear the
    // translator of every book anybody favourited.
    translator: b.translator || '',
    editor: b.editor || '',
    isbn: b.isbn || '',
    asin: b.asin || '',
    description: b.description || '',
    published_year: b.published_year || 0,
    // THE CIRCA FLAG AND THE TWO LANGUAGES, and the reason is the same for all
    // three: the server's UPDATE writes them unconditionally, so a body that
    // does not name them writes the zero value over whatever was there. The
    // languages have been storable since 0047 and no client has ever sent them,
    // which means a reader whose import filled them lost both the first time
    // they pressed the ♥ — and "c. 380 BCE" became "380 BCE" beside it.
    published_circa: !!b.published_circa,
    language: b.language || '',
    orig_language: b.orig_language || '',
    // 0061's three, here for the same reason: unconditional in the server's
    // UPDATE, so an omission is a deletion.
    subtitle: b.subtitle || '',
    publisher: b.publisher || '',
    pages: b.pages || 0,
    links: b.links || '',
    genres: b.genres || [],
    series: b.series || '',
    series_index: b.series_index || 0,
    favorite: !!b.favorite,
    // status / progress / reads are deliberately absent: they belong to
    // PUT /books/:id/status, so an ordinary save can never rewrite the shelf or
    // the read log (see bookDetail in book_handlers.go).
  }
}

// setBookStatus moves one book to a shelf state. Its own endpoint, because the
// transition and the read log have to move together. Returns an error string.
async function setBookStatus(id, body) {
  const r = await json('PUT', `/books/${id}/status`, body)
  return r.ok ? '' : errText(r, t('error.save.generic'))
}

// BookGrid is the cover-tile board, shared by the flat list and each group.
//
// `selection` is threaded through rather than held here, because the board is what
// knows the visible ORDER — Shift-click extends over that, and a per-group hook
// would extend over one bucket while the reader saw the whole board.
function BookGrid({ books, coverSize, onOpen, authorMap = {}, seps, selection, leadingTile, onChanged, onEdit }) {
  // Bounded by what has been scrolled to, not by what the shelf holds; `books`
  // itself is the reset key, because a new array here is a re-filtered board and
  // a re-filtered board starts at its own top. See useBoardWindow.
  const win = useBoardWindow(books.length, books)
  return (
    <ul className="grid gap-x-6 gap-y-9" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${coverSize}px, 1fr))` }}>
      {/* FIRST, not last. The folder is the pile you are not looking at, and a
          pile you have to scroll past forty covers to find is a pile you will
          never open. It also keeps its place as the board is filtered. */}
      {leadingTile && <li>{leadingTile}</li>}
      {books.slice(0, win.count).map((b, i) => (
        <li key={b.id}>
          <WorkCard kind="book" item={b} index={i} onOpen={onOpen} people={authorMap} seps={seps} selection={selection} onChanged={onChanged} onEdit={onEdit} />
        </li>
      ))}
      {/* aria-hidden and empty: this is a scroll position, not content. It sits
          inside the grid so it is laid out with the tiles rather than after a
          row of them, which is what makes "600px from the end" mean the same
          thing at every column count. */}
      {win.more && <li ref={win.sentinel} aria-hidden="true" className="h-px" />}
    </ul>
  )
}

// ---- book list (§8.3, mockups 06–07) ----

function BookList({ onOpen, onOpenMovie, creditSeparators, dataNonce }) {
  const [books, setBooks] = useState(null)
  // ONE LIST, NOT NINE useStates. Every filter this board offers is a chip, in
  // the same shape the search box's chips take — which is what lets the sheet
  // and the search bar be two editors of one thing rather than two ways to say
  // "tagged stoicism" that do not know about each other.
  //
  // The controls below are unchanged: each still gets a value and a setter of
  // exactly the shape it always took, so WorkListScaffold did not have to learn
  // anything. What changed is that there is now one object underneath them, so
  // `onReset` empties a list instead of remembering nine setters, and pressing
  // Search hands over the very state the board was filtered by.
  const [filters, setFilters] = useState([])
  // Derived once per change rather than per render: `states` is a fresh array
  // each time it is read, and the `shown` memo below has it in its dep list —
  // recomputing it every render would re-filter the whole library on every
  // keystroke anywhere on the screen.
  const f = useMemo(() => ({
    genre: facetValue(filters, 'genre'), // '' = All
    series: facetValue(filters, 'series'), // '' = all series
    fav: facetValue(filters, 'favourite') === 'yes',
    tagged: facetValue(filters, 'tagged') === 'yes', // has at least one tagged quote
    noted: facetValue(filters, 'noted') === 'yes', // has at least one quote with a note
    // The board's three-way control over the server's two-way flag: '' = all,
    // 'wishlist' = nothing saved out of it yet, 'annotated' = something was.
    wish: { yes: 'wishlist', no: 'annotated' }[facetValue(filters, 'wishlist')] || '',
    states: facetValues(filters, 'shelf'), // shelf states kept; [] = every state
  }), [filters])
  const { genre, series, fav, tagged, noted, wish, states } = f
  const setGenre = (v) => setFilters((c) => withFacet(c, 'genre', v))
  const setSeries = (v) => setFilters((c) => withFacet(c, 'series', v))
  const setFav = (v) => setFilters((c) => withFacet(c, 'favourite', v ? 'yes' : ''))
  const setTagged = (v) => setFilters((c) => withFacet(c, 'tagged', v ? 'yes' : ''))
  const setNoted = (v) => setFilters((c) => withFacet(c, 'noted', v ? 'yes' : ''))
  const setWish = (v) => setFilters((c) => withFacet(c, 'wishlist', v === 'wishlist' ? 'yes' : v === 'annotated' ? 'no' : ''))
  const setStates = (v) => setFilters((c) => withFacetValues(c, 'shelf', v))
  // Fold the wishlist into one tile. PERSISTED, unlike every filter beside it and
  // unlike `groupBy`, because it is not a question about this visit — it is how you
  // want your board to look, in the same class as the cover size. Which is also why
  // `Reset` leaves it alone: reset clears what you were asking of the library, not
  // how the library is drawn.
  //
  // OFF by default. Turning it on is one tap and reversible; a grid that silently
  // rearranged itself on upgrade is a library that looks like it lost books.
  const [wishFolder, setWishFolder] = usePersistedState('tippani:books:wishFolder', false)
  const [sort, setSort] = useState('recent')
  const [groupBy, setGroupBy] = useState('none') // none | series | author | decade | genre
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:books', 165) // set from Settings
  const mobile = useIsMobileScreen()
  const authors = usePeople('author') // name→metadata, for author-group portraits
  const [person, setPerson] = useState(null) // { kind, name } open in the metadata panel
  // THE PERSON'S OWN SCREEN, REACHABLE FROM HERE AT LAST. A shelf's author credits
  // was handed `setPerson` straight, so it opened the older panel whatever the
  // person's record held — this screen had no panel host at all, which is why the
  // pack's person screen looked absent rather than unreachable. See
  // personOpen.jsx: the id decides which of the two surfaces answers.
  const personStack = usePanelStack()
  const openPerson = usePersonOpener(personStack, setPerson)

  // A search started from a filtered shelf searches the filtered shelf. The
  // board publishes what it is currently showing; the shell reads it at the
  // moment ＋Search is pressed. Cleared on unmount, because a stale seed would
  // narrow a search to a board you had already left.
  useEffect(() => {
    publishSearchSeed(seedableChips(filters))
    return () => publishSearchSeed([])
  }, [filters])

  async function load() {
    const r = await json('GET', '/books')
    if (r.ok) setBooks(r.data.books)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
    // A book added through the shell's Add surface lands server-side without this
    // list knowing — and when the surface was opened FROM here, nothing remounts
    // on the way back, so there is no other moment to refetch at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataNonce])

  // Genres, most-used first (chips promote the common ones), tie-broken
  // alphabetically. bookGenres normalises so "fantasy"/"Fantasy" and a
  // comma-joined "Fiction, Fantasy" all collapse to the same chips.
  const genres = useMemo(() => {
    const counts = new Map()
    for (const b of books || []) for (const g of bookGenres(b)) counts.set(g, (counts.get(g) || 0) + 1)
    return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b))
  }, [books])

  // Unique series names for the series filter dropdown.
  const seriesNames = useMemo(() => {
    const s = new Set()
    for (const b of books || []) if (b.series) s.add(b.series)
    return [...s].sort()
  }, [books])

  const shown = useMemo(() => {
    let list = books || []
    if (genre) list = list.filter((b) => bookGenres(b).includes(genre))
    if (series) list = list.filter((b) => (b.series || '') === series)
    if (fav) list = list.filter((b) => b.favorite)
    if (tagged) list = list.filter((b) => (b.tagged_count || 0) > 0)
    if (noted) list = list.filter((b) => (b.noted_count || 0) > 0)
    list = statusFilter(list, states)
    list = wishFilter(list, wish, (b) => b.annotation_count || 0)
    // Default view = server order (created_at DESC) with what you're reading
    // floated to the top; an explicit sort takes over completely.
    if (sort === 'recent') return pinInProgress(list, 'book')
    list = [...list]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'author') list.sort((a, b) => (a.author || '').localeCompare(b.author || ''))
    else if (sort === 'series') list.sort(bySeries)
    else if (sort === 'read') list.sort(byLastRead)
    return list
  }, [books, genre, series, fav, tagged, noted, states, wish, sort])

  // Folding, and the two piles it makes. Only on the FLAT, unscoped board: inside
  // the wishlist chip there is nothing to fold away from, and a "Wishlist" folder
  // sitting inside the bucket for one author or one series would be a folder that
  // meant something different in every group it appeared in.
  const foldWish = wishFolder && wish === '' && groupBy === 'none'
  const unquoted = (b) => (b.annotation_count || 0) === 0
  const wishBooks = useMemo(() => (foldWish ? shown.filter(unquoted) : []), [foldWish, shown])
  const boardBooks = useMemo(() => (foldWish ? shown.filter((b) => !unquoted(b)) : shown), [foldWish, shown])

  // Over `boardBooks` — what is actually on screen as a tile — so changing a
  // filter, or folding the wishlist away, drops the ids that left rather than
  // leaving the bar reporting a number about books nobody can see (see
  // useSelection). The folder itself is not selectable: a tick on it would have to
  // mean "select the twelve behind it", which is a different act from every other
  // tick on the board and one the bar cannot report a count for.
  const selection = useSelection(boardBooks.map((b) => b.id))
  const afterBulk = () => {
    selection.clear()
    load()
  }
  // Edit one book from the bar, when exactly one is picked (1.12.0). The id
  // rather than the row: what this board holds is a LIST row, and the list
  // endpoint does not carry the description or the genres. Handing that to a
  // full-state form would save blanks over the two fields it never had.
  const [editWork, setEditWork] = useState(null)
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
  // Named for what it DOES rather than for what it is: "Fold wishlist" is an
  // instruction, and the chip beside it that reads "wishlist" is a scope. Two
  // controls with the same word meaning two different things on one row is exactly
  // the confusion this board does not need.
  const wishChip = (
    <FilterChip
      active={wishFolder}
      label={t('library.filters.fold-wishlist.label')}
      tooltip={t('library.filters.fold-wishlist.tip')}
      onClick={() => setWishFolder((v) => !v)}
    />
  )
  const grouped = useMemo(
    () =>
      groupBy === 'none'
        ? null
        : groupWorks(shown, groupBy, {
            credit: (b) => b.author,
            splitCredit: true,
            creditResidual: t('library.group.residual.author.label'),
            year: (b) => b.published_year,
            genres: bookGenres,
            series: (b) => b.series,
            seps: creditSeps,
            sortMembers: (items, dim) => (dim === 'series' ? [...items].sort(bySeries) : items),
          }),
    [shown, groupBy, creditSeps],
  )

  const groupWin = useBoardWindow(grouped ? grouped.length : 0, grouped, 12)

  const quoteTotal = (books || []).reduce((n, b) => n + (b.annotation_count || 0), 0)

  return (
    <WorkListScaffold
      mobile={mobile}
      title={t('nav.tab.library.label')}
      counts={books
        ? t('library.header.counts', {
            a: t('common.count.phrase', { n: books.length, noun: t('unit.book', { count: books.length }) }),
            b: t('common.count.phrase', { n: quoteTotal, noun: t('unit.quote', { count: quoteTotal }) }),
          })
        : ''}
      error={error}
      onExport={() => setExporting(true)}
      headerAside={<MonoLabel className="hidden sm:inline">{t('library.header.lookup.label')}</MonoLabel>}
      loaded={books != null}
      hasItems={!!(books && books.length > 0)}
      shownCount={shown.length}
      emptyText={t('library.board.empty')}
      noMatchText={t('library.board.nomatch')}
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
      kind="book"
      noun={t('unit.book.one')}
      nounPlural={t('unit.book.other')}
      seriesNames={seriesNames}
      series={series}
      setSeries={setSeries}
      sort={sort}
      setSort={setSort}
      sortOptions={[
        ['recent', t('library.sort.recent.label')],
        ['title', t('library.sort.title.label')],
        ['author', t('library.sort.author.label')],
        ['series', t('library.sort.series.label')],
        ['read', t('library.sort.read.label')],
      ]}
      trailing={
        <>
          {wishChip}
          <label className="flex items-center gap-2">
            <MonoLabel>{t('common.mono.group.label')}</MonoLabel>
            <Select
              ariaLabel={t('common.filters.group.aria')}
              value={groupBy}
              onChange={setGroupBy}
              options={groupOptions()}
            />
          </label>
        </>
      }
      trailingMobile={
        <>
          <div>{wishChip}</div>
          <div>
            <MonoLabel className="mb-2 block">group</MonoLabel>
            <Select
              ariaLabel={t('common.filters.group.aria')}
              value={groupBy}
              onChange={setGroupBy}
              options={groupOptions()}
            />
          </div>
        </>
      }
      onReset={() => { setFilters([]); setGroupBy('none'); setSort('recent') }}
      exportDialog={
        <ConfirmDialog
          open={exporting}
          title={t('library.export.confirm.title')}
          body={
            <>
              {t('library.export.confirm.body', {
                a: countOf(shown.length, 'unit.book'),
                b: countOf(shown.reduce((n, b) => n + (b.annotation_count || 0), 0), 'unit.quote'),
              })}
              be exported as a single Markdown file (re-importable into Tippani).
            </>
          }
          confirmLabel={t('common.action.export.label')}
          onCancel={() => setExporting(false)}
          onConfirm={async () => {
            setExporting(false)
            await downloadPost('/export/books', { ids: shown.map((b) => b.id) }, 'tippani-books.md')
          }}
        />
      }
      extraModals={
        <>
          {/* THE HOST FOR THE PERSON'S OWN SCREEN, OUTSIDE the legacy modal's
              guard. Inside it the host mounts only while the OLD panel is open,
              so the new one opens into nothing — a dead press, which is the exact
              failure this whole change is about. */}
          <PanelHost stack={personStack} />
          {person && (
            <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} onSaved={authors.reload} />
          )}
          {editWork != null && (
            <EditWorkModal
              kind="books"
              id={editWork}
              title={t('book.form.edit.title')}
              onDone={() => {
                setEditWork(null)
                afterBulk()
              }}
              onCancel={() => setEditWork(null)}
            />
          )}
        </>
      }
    >
      {/* The MODE, not the count: emptying the selection leaves the bar standing
          so picking a different four does not cost a fresh gesture. */}
      {selection.open && (
        <SelectionBar selection={selection} rows={boardBooks} onDone={afterBulk} onEdit={setEditWork} />
      )}
      {grouped ? (
        <div className="space-y-10">
          {grouped.slice(0, groupWin.count).map((g) => {
            const isAuthor = groupBy === 'author' && !g.residual
            return (
              <section key={g.key}>
                <GroupHeading
                  label={g.label}
                  count={g.items.length}
                  noun={t('unit.book.one')}
                  nounPlural={t('unit.book.other')}
                  person={isAuthor ? authors.map[g.label] : null}
                  onOpenPerson={isAuthor ? () => openPerson({ kind: 'author', name: g.label, person: authors.map[g.label] }) : undefined}
                />
                <BookGrid books={g.items} coverSize={coverSize} onOpen={onOpen} authorMap={authors.map} seps={creditSeps} selection={selection} onChanged={afterBulk} onEdit={setEditWork} />
              </section>
            )
          })}
          {/* Groups are windowed too. Each section's own grid stops at sixty,
              but a hundred small sections is still the whole library mounted —
              the bound has to exist at both levels or neither. */}
          {groupWin.more && <div ref={groupWin.sentinel} aria-hidden="true" className="h-px" />}
        </div>
      ) : (
        <BookGrid
          books={boardBooks}
          coverSize={coverSize}
          onOpen={onOpen}
          authorMap={authors.map}
          seps={creditSeps}
          selection={selection}
          onChanged={afterBulk}
          onEdit={setEditWork}
          leadingTile={
            wishBooks.length > 0 ? (
              // Opening it is switching to the chip that already exists. The folder
              // is a DOOR to a filter rather than a place things live: nothing
              // moves, nothing is stored, and there is no state that can disagree
              // with the count printed on a cover.
              <WishlistFolder kind="book" items={wishBooks} onOpen={() => setWish('wishlist')} />
            ) : null
          }
        />
      )}
    </WorkListScaffold>
  )
}

// ---- add-book forms (§8.4, mockups 10–11) — now hosted by AddSurface (§7) ----

// isIsbn detects a 10- or 13-digit ISBN (hyphens/spaces allowed, trailing X ok).
export function isIsbn(s) {
  const bare = s.replace(/[-\s]/g, '')
  return /^(\d{9}[\dXx]|\d{13})$/.test(bare)
}

// ManualTab — hand-entry for a book. `title` and `busy` are OWNED BY THE HOST,
// not by this form, because the control that commits it is no longer inside it:
// the Add-manually popup carries a ✓ in its header beside the close button, and
// a header button can only know whether there is anything to save if the state
// it depends on lives where both can see it. `formId` is what wires that button
// back to this <form> (the HTML `form=` attribute), so submitting from outside
// still goes through onSubmit and Enter in a field still saves.
// ManualMovie has taken `title`/`setTitle` from its host all along; this is the
// same arrangement, and now the two forms in that popup match.
export function ManualTab({ onAdded, formId, title, setTitle, onBusy }) {
  const [author, setAuthor] = useState('')
  const [year, setYear] = useState('')
  const [isbn, setIsbn] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError(t('error.validate.title-required.lower'))
    // parseYearInput reads "380 BCE" and "c. 1500" as well as "1719", because
    // that is what the field shows when it rests. A bare Number() would read
    // every one of those as NaN and erase the year on save.
    let publishedYear, publishedCirca
    if (year.trim()) {
      const parsed = parseYearInput(year)
      if (!parsed.year) return setError(t('error.validate.year'))
      publishedYear = parsed.year
      publishedCirca = parsed.circa
    }
    onBusy?.(true)
    setError('')
    const r = await json('POST', '/books', {
      title: title.trim(),
      author: author.trim() || undefined,
      isbn: isbn.trim() || undefined,
      published_year: publishedYear,
      published_circa: publishedCirca,
    })
    onBusy?.(false)
    if (r.ok) onAdded(r.data) // hand back the created book (capture targets it)
    else setError(errText(r, t('error.add.book')))
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-3">
      <Field label={t('common.field.title.label')} nameCase value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
      <Field label={t('common.field.author.label')} nameCase value={author} onChange={(e) => setAuthor(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('common.field.year.label')} inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <Field label={t('common.field.isbn.label')} value={isbn} onChange={(e) => setIsbn(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      {/* Title is the one must-fill field. The ✓ in the popup header stays greyed
          until it has one rather than accepting the press and answering with an
          error; this line says why, because a disabled icon cannot. */}
      {!title.trim() && <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('book.form.missing.hint')}</p>}
    </form>
  )
}

// ---- book detail (§8.5, mockups 08–09) ----

// BookDetail — the library's work page, which is WorkDetail with `side` set.
// Everything that used to be here is in WorkDetail.jsx now: this screen was the
// one the merged component was lifted out of, so what moved is unchanged and the
// catalogue side is what gained the two columns, the hero's doors and the rest.
//
// The BOARD is still this file's — `Annotations` is folded next — so it comes in
// as a render prop.
function BookDetail(props) {
  return (
    <WorkDetail
      {...props}
      side="book"
      stateBuilder={(book, fields) => ({ ...bookState(book), ...fields })}
      renderBoard={({ item, seps, creditMaps, mobileFilter, setMobileFilter, onStats, onAdd, dataNonce, openCharacter }) => (
        <Annotations
          bookId={item.id}
          book={item}
          authorMap={creditMaps[0]}
          seps={seps}
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
        <EditBook book={row} onSaved={onDone} onCancel={onCancel} />
      )}
    </FormModal>
  )
}

export function EditBook({ book, onSaved, onCancel }) {
  const [title, setTitle] = useState(book.title || '')
  const [author, setAuthor] = useState(book.author || '')
  const [translator, setTranslator] = useState(book.translator || '')
  const [editor, setEditor] = useState(book.editor || '')
  const [isbn, setIsbn] = useState(book.isbn || '')
  const [asin, setAsin] = useState(book.asin || '')
  const [year, setYear] = useState(formatYear(book.published_year, book.published_circa))
  const [genres, setGenres] = useState(book.genres || [])
  const [genreSuggestions, setGenreSuggestions] = useState([])
  useEffect(() => {
    json('GET', '/genres').then((r) => { if (r.ok) setGenreSuggestions(r.data.genres || []) })
  }, [])
  const [series, setSeries] = useState(book.series || '')
  const [seriesIndex, setSeriesIndex] = useState(book.series_index ? String(book.series_index) : '')
  const [description, setDescription] = useState(book.description || '')
  // Cover: coverPath tracks the stored file (updated on immediate upload);
  // coverUrl / clearCover are the pending change carried in the Save PUT.
  const [coverPath, setCoverPath] = useState(book.cover_path || '')
  const [coverUrl, setCoverUrl] = useState('')
  const [clearCover, setClearCover] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Adopt an API candidate. Two modes:
  //  - overwrite (explicit "Use" on a chosen match): take that match's value for
  //    every field it provides, replacing what's there — that's the whole point
  //    of browsing matches and picking a better one. Fields the match is silent
  //    about are left as-is (never blanked).
  //  - fill-only (one-click "Fetch metadata"): fill only the empty fields so it
  //    can't clobber edits you already made.
  const keep = (v, next) => (String(v).trim() ? v : next || v)
  function applyCandidate(c, overwrite = false) {
    const has = (x) => x != null && String(x).trim() !== ''
    const take = overwrite ? (v, next) => (has(next) ? next : v) : keep
    setTitle((v) => take(v, c.title))
    setAuthor((v) => take(v, c.author))
    setIsbn((v) => take(v, c.isbn13))
    setYear((v) => take(v, c.published_year ? String(c.published_year) : ''))
    setDescription((v) => take(v, c.description))
    setGenres((v) => (overwrite ? (c.genres && c.genres.length ? c.genres : v) : v.length ? v : c.genres || []))
    setSeries((v) => take(v, c.series))
    setSeriesIndex((v) => take(v, c.series_index ? String(c.series_index) : ''))
    if (c.cover_url && (overwrite || (!coverPath && !coverUrl))) {
      setCoverUrl(c.cover_url)
      setClearCover(false)
    }
  }

  // §7: "Fetch metadata" no longer silently applies a guess — it opens the
  // edition picker (below) so you pick the right match, folding in what used to
  // be a separate "Browse other matches" button.
  const [pickerOpen, setPickerOpen] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError(t('error.validate.title-required.lower'))
    // parseYearInput reads "380 BCE" and "c. 1500" as well as "1719", because
    // that is what the field shows when it rests. A bare Number() would read
    // every one of those as NaN and erase the year on save.
    let publishedYear, publishedCirca
    if (year.trim()) {
      const parsed = parseYearInput(year)
      if (!parsed.year) return setError(t('error.validate.year'))
      publishedYear = parsed.year
      publishedCirca = parsed.circa
    }
    setBusy(true)
    setError('')
    // THE RECORD FIRST, THE FORM ON TOP. This body used to be a hand-written list
    // of the boxes this form happens to draw, which is a different list from the
    // one the server writes — so every save through this form cleared the two
    // languages, and `favorite` was carried through only because somebody
    // noticed that one. Spreading bookState makes the two lists the same list,
    // and full-state-put.test.js is watching that one rather than this one.
    const r = await json('PUT', `/books/${book.id}`, {
      ...bookState(book),
      title: title.trim(),
      author: author.trim(),
      translator: translator.trim(),
      editor: editor.trim(),
      isbn: isbn.trim(),
      asin: asin.trim(),
      published_year: publishedYear,
      published_circa: publishedCirca,
      genres,
      series: series.trim(),
      series_index: Number(seriesIndex) || 0,
      description: description.trim(),
      cover_url: coverUrl || undefined,
      clear_cover: clearCover || undefined,
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setError(errText(r, t('error.save.generic')))
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <CoverControls
        kind="books"
        id={book.id}
        currentPath={coverPath}
        asin={asin}
        coverUrl={coverUrl}
        clearCover={clearCover}
        onSetUrl={(u) => {
          setCoverUrl(u)
          setClearCover(false)
        }}
        onClear={(reset) => {
          if (reset === true) {
            setCoverUrl('')
            setClearCover(false)
          } else {
            setClearCover(true)
            setCoverUrl('')
          }
        }}
        onUploaded={(rec) => setCoverPath(rec.cover_path || '')}
        onFetchMeta={() => setPickerOpen((v) => !v)}
        fetchMetaOpen={pickerOpen}
        search={{ isbn, title, author, asin }}
      />
      {pickerOpen && (
        <BookLookupPicker
          auto
          isbn={isbn}
          title={title}
          author={author}
          asin={asin}
          onPick={(c) => {
            applyCandidate(c, true)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('common.field.title.label')} nameCase value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field label={t('common.field.author.label')} nameCase value={author} onChange={(e) => setAuthor(e.target.value)} />
        {/* Below the author, above the identifiers: they are credits, and they
            belong with the credit rather than filed among the catalogue numbers.
            Both split on the same separators the author line uses. */}
        <Field label={t('common.field.translator.label')} nameCase placeholder={t('book.form.translator.placeholder')} value={translator} onChange={(e) => setTranslator(e.target.value)} />
        <Field label={t('common.field.editor.label')} nameCase placeholder={t('book.form.editor.placeholder')} value={editor} onChange={(e) => setEditor(e.target.value)} />
        <Field label={t('common.field.isbn.label')} value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        <Field label={t('common.field.asin.label')} value={asin} onChange={(e) => setAsin(e.target.value)} />
        <Field label={t('common.field.year.label')} inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.genres.label')}</MonoLabel>
        <TokenInput value={genres} onChange={setGenres} suggestions={genreSuggestions} placeholder={t('common.field.genres.placeholder')} ariaLabel={t('common.field.genres.label')} transform={titleCaseGenre} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label={t('common.field.series.label')} nameCase placeholder={t('book.form.series.placeholder')} value={series} onChange={(e) => setSeries(e.target.value)} />
        <Field
          label={t('common.field.series-no.label')}
          inputMode="decimal"
          placeholder={t('book.form.series-no.placeholder')}
          value={seriesIndex}
          onChange={(e) => setSeriesIndex(e.target.value)}
        />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.description.label')}</MonoLabel>
        <textarea className="tp-input" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        {/* Greyed until the must-fill field has a value: an empty title would
            be refused by the handler anyway, so the button says so first. */}
        <button className={PRIMARY} disabled={busy || !title.trim()}>
          Save
        </button>
        <GhostButton type="button" onClick={onCancel}>
          Cancel
        </GhostButton>
      </div>
    </form>
  )
}

// annotationState builds the full PUT body from an annotation row — PUT is
// full-state, so every field must be carried even when only one changes.
export function annotationState(a) {
  return {
    quote: a.quote || '',
    note: a.note || '',
    chapter: a.chapter || '',
    chapter_no: a.chapter_no || 0,
    location: a.location || '',
    // A SILENT-LOSS SITE, named the way utteranceState names its own. Every PUT
    // here is full-state, so a field missing from this object is a field CLEARED
    // by the request — and the ♥ on a card, the colour dots and the selection bar
    // all save through it. `character` (0047) was missing from here for four
    // releases, which meant recolouring a highlight quietly threw away who said
    // it; `translation` (0051) is the same shape of field and would have gone the
    // same way. 0034 records the trap catching `translator` on bookState first.
    character: a.character || '',
    translation: a.translation || '',
    color: a.color || 'yellow',
    tags: a.tags || [],
    favorite: !!a.favorite,
    // carry the attached sticker + its seal position through every full-state
    // PUT so a favourite/drag patch never wipes them (nulls = no sticker /
    // unplaced → top-right default)
    sticker_id: a.sticker_id ?? null,
    sticker_x: a.sticker_x ?? null,
    sticker_y: a.sticker_y ?? null,
  }
}

// ---- annotation views (v3): tiles (resizable board) · list · table ----

// annDate prefers the source/original date (noted_at, set on import or manual
// add) and falls back to the row's created_at.
export function annDate(a) {
  return a.noted_at || a.created_at || ''
}
export function fmtDate(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
// locSortVal pulls the first number out of a location ("p.142" -> 142) so the
// table sorts locations numerically; missing locations sink to the bottom.
function locSortVal(a) {
  const m = String(a.location || '').match(/\d+/)
  return m ? parseInt(m[0], 10) : -1
}
// CategoryFilter — which category the board is filtered to, named rather than
// guessed at from a coloured dot.
//
// The swatch alone cannot say what it is for: a reader names their own categories
// (theme.js), so the blue one might be "Fact" or "Disagree" or nothing at all,
// and a row of six dots asks them to remember which. The dot rides WITH the name
// here, which is what the colour is good at — recognising the one you already
// know — rather than being asked to carry the meaning on its own.
//
// HIDDEN SLOTS STAY HIDDEN, except the one currently chosen: a filter set to a
// category the reader has since retired must still be able to say so, or the
// board is narrowed by something with no entry in its own control.
function CategoryFilter({ value, onChange }) {
  const opt = (tok, label) => [
    tok,
    <span className="cat-opt" key={tok}>
      <span className="cat-opt-dot" style={tok ? { background: `var(--${tok})` } : undefined} aria-hidden="true" />
      <span>{label}</span>
    </span>,
    label,
  ]
  const options = [
    opt('', t('book.category.any.label')),
    ...ANNOTATION_COLORS.filter((c) => !categoryHidden(c) || c === value).map((c) => opt(c, categoryName(c))),
  ]
  return (
    <Select
      ariaLabel={t('common.colour.category.aria')}
      value={value}
      onChange={onChange}
      options={options}
    />
  )
}

// GroupSortField — the board's arrangement, in one field.
//
// GROUPING AND SORTING ARE ONE DECISION MADE TWICE. "By chapter, in reading
// order" is a single thought, and it was two controls plus a direction key
// sitting side by side in the header — three things to press for one intent,
// and the widest group in a row the design pack keeps to a single line.
//
// So the grouping is the field, and the ordering is the row at the end of its
// menu. The pack's words: "the grouping is a field on the page, so the sort is
// the row at the end of its menu rather than a second control competing for the
// header". The field states the current grouping without being opened, which is
// the job a control earns its width with; the ordering states itself as that
// row's value, so one press away is still one glance away.
//
// ONE POPOVER, TWO CONTENTS, rather than a menu that opens a second menu beside
// itself. `pop` says which is showing and the trigger is the anchor for both, so
// going from Group to Sort is the same rectangle changing what it lists — a
// desk's version of the phone pushing a sheet.
//
// A FIELD, NOT A CHIP. It carries the app's Select shape — the inset field with a
// caption and a chevron — because a chip is a filter and this is a setting, and
// the pack spends a paragraph on that exact confusion: grouping "was an
// underlined word sitting in the chip scroller: same size, same row, same species
// as 'favourites'".
function GroupSortField({ groupBy, onGroup, sort, onSort, compact = false }) {
  const [pop, setPop] = useState(null)
  const ref = useRef(null)
  const groupLabel = t(`book.group.${GROUP_DIMS.includes(groupBy) ? groupBy : 'none'}.label`)
  const sortLabel = t(`book.sort.${SORT_DIMS.includes(sort.col) ? sort.col : 'default'}.label`)
  const dirLabel = t(sort.dir === 'desc' ? 'book.sort.dir.desc.label' : 'book.sort.dir.asc.label')
  const items =
    pop === 'sort'
      ? [
          { id: 'h-by', heading: t('common.mono.sort.label') },
          ...SORT_DIMS.map((d) => ({
            id: `s-${d}`,
            label: t(`book.sort.${d}.label`),
            checked: sort.col === d,
            keepOpen: true,
            onClick: () => onSort((cur) => ({ col: d, dir: cur.dir })),
          })),
          // NO DIRECTION SECTION ON A PHONE. The strip beside this trigger carries
          // it as a key, on the pack's own rule — "direction is one bit, so it is
          // one tap and never a sheet" — and a bit that is one tap on the strip
          // must not also be three taps inside a menu.
          ...(compact ? [] : [{ id: 'h-dir', heading: t('book.sort.dir.label') }]),
          ...(compact ? [] : ['asc', 'desc']).map((d) => ({
            id: `d-${d}`,
            // THE BARS ARE THE GIVEAWAY, not the arrow: they grow for ascending
            // and shrink for descending, so the glyph IS the order rather than a
            // direction a reader has to translate.
            icon: d === 'asc' ? <IconSortAsc /> : <IconSortDesc />,
            label: t(`book.sort.dir.${d}.label`),
            checked: sort.dir === d,
            keepOpen: true,
            onClick: () => onSort((cur) => ({ col: cur.col, dir: d })),
          })),
        ]
      : [
          ...GROUP_DIMS.map((d) => ({
            id: `g-${d}`,
            label: t(`book.group.${d}.label`),
            checked: groupBy === d,
            onClick: () => onGroup(d),
          })),
          {
            id: 'sort',
            icon: <IconSliders />,
            label: t('book.sort.menu.label'),
            meta: `${sortLabel} · ${dirLabel}`,
            // The one row that does NOT close the popover — it swaps what the
            // popover is showing. Set after the menu's own close runs, which is
            // why it is a state change and not a second ActionMenu.
            onClick: () => setPop('sort'),
          },
        ]
  // TWO TRIGGERS, ONE MENU. The desk's is the app's inset field with its GROUP
  // caption; the phone's is the pack's underlined word — "a strip that states the
  // count should not be as tall as a toolbar, so both controls lose their boxes
  // and keep only their words". Same rows behind both, so the two viewports
  // cannot end up offering different arrangements.
  //
  // AND THE PHONE'S TRIGGER STATES BOTH HALVES, because it is the only thing on
  // that strip that can: "chapter · location" is the whole arrangement in the
  // width of two words, where the desk has room for a caption and a field.
  return (
    <div className={compact ? 'relative board-strip-sort' : 'tp-select board-head-group'} ref={ref}>
      {compact ? (
        <button
          type="button"
          className="board-strip-trigger"
          aria-haspopup="menu"
          aria-expanded={pop != null}
          aria-label={t('book.group.aria')}
          onClick={() => setPop((p) => (p ? null : 'group'))}
        >
          {groupLabel} · {sortLabel}
        </button>
      ) : (
      <button
        type="button"
        className="tp-select-trigger tactile"
        aria-haspopup="menu"
        aria-expanded={pop != null}
        aria-label={t('book.group.aria')}
        onClick={() => setPop((p) => (p ? null : 'group'))}
      >
        <MonoLabel>{t('common.mono.group.label')}</MonoLabel>
        <span>{groupLabel}</span>
        <svg
          className="tp-select-chev"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      )}
      <ActionMenu
        open={pop != null}
        items={items}
        anchorRef={ref}
        onClose={() => setPop(null)}
        returnFocusTo={ref}
      />
    </div>
  )
}

// AnnotationBoard — one set of quotes, drawn in whichever view is chosen.
//
// IT EXISTS BECAUSE OF GROUPING. A grouped board draws its view once per section,
// so the three renderers had to stop being three blocks in the middle of a
// screen: two copies of "how a quote is drawn" is two places for a card prop to
// go missing, silently, in the view the author was not looking at.
//
// The window and the sentinel stay OUTSIDE it, with the caller — an ungrouped
// board windows its rows and a grouped one windows its sections, which is the
// caller's decision and not this component's.
function AnnotationBoard({
  rows, view, tagMap, stickerMap, stickers, reloadStickers, editingId, setEditingId,
  save, patch, remove, onCopy, onShare, selection, sort, onSort,
  columns, clamp, expandedId, onToggleExpand, boardRef = null, pinnedCount = 0, seed = 1,
  tview = 'both', onDuplicate, onOpenCharacter,
}) {
  if (view === 'table') {
    return (
      <AnnotationTable
        rows={rows}
        tview={tview}
        tagMap={tagMap}
        stickers={stickers}
        reloadStickers={reloadStickers}
        sort={sort}
        onSort={onSort}
        editingId={editingId}
        setEditingId={setEditingId}
        save={save}
        remove={remove}
        onCopy={onCopy}
        onShare={onShare}
      />
    )
  }
  const card = (a, i, lines, expandable) => (
    <AnnotationCard
      key={a.id}
      a={a}
      variant={i % 4}
      tagMap={tagMap}
      stickerMap={stickerMap}
      stickers={stickers}
      reloadStickers={reloadStickers}
      editing={editingId === a.id}
      setEditingId={setEditingId}
      save={save}
      patch={patch}
      remove={remove}
      onCopy={onCopy}
      onShare={onShare}
      quoteLines={lines}
      tagSuggestions={Object.keys(tagMap)}
      selection={selection}
      onOpenCharacter={onOpenCharacter}
      tview={tview}
      onDuplicate={onDuplicate}
      {...(expandable
        ? { expanded: expandedId === a.id, onToggleExpand: () => onToggleExpand(a.id) }
        : null)}
    />
  )
  if (view === 'list') {
    return <div className="space-y-4">{rows.map((a, i) => card(a, i, 5, false))}</div>
  }
  // Masonry board in SOURCE order (newest first; newly-added quotes ride on top
  // via the pinned prefix until refresh) — equal-width columns dealt onto the
  // shortest pile. Each card clamps to a seeded per-card 3–5 lines with no
  // three-in-a-row the same; since the layout keeps source order, those sizes
  // vary the board without banding by height, and a quote shorter than its clamp
  // just shows in full. Clicking a quote expands it; doing so collapses any other
  // and locks the column order so the board never reshuffles under the reader.
  return (
    <Masonry
      boardRef={boardRef}
      columns={columns}
      gap={12}
      seed={seed}
      pinnedCount={pinnedCount}
      lockOrder={expandedId != null}
      order="source"
    >
      {rows.map((a, i) => card(a, i, clamp?.[i], true))}
    </Masonry>
  )
}

// ---- ordering and grouping a board of quotes -------------------------------

// SORT_DIMS — what a board of quotes can be put in order by, and how.
//
// `default` is the order the server sent (created_at DESC), and it stays a named
// option rather than being folded into `date`: it is what pinning rides on — a
// quote saved a moment ago sits on top until something else is chosen — and it is
// the only one of these that is not a property of the quote at all.
//
// The other four are the pack's, plus `chapter`, which the table has sorted by
// since it had a header row and which is the reading order of a book.
// The list itself is the kind table's now, so the film board can offer its own
// six without a second copy of this comment.
export const SORT_DIMS = KINDS.book.sortDims

// sortValue is the comparable for one dimension.
//
// STRINGS THROUGHOUT WHERE A DIMENSION MIXES KINDS, because the comparator uses
// `<` and JavaScript will happily tell you that '' is less than 2. A chapter is
// a number for some quotes and a name for others; encoding the rank in the first
// character keeps "numbered chapters, then named ones" a fact about the value
// rather than a fact about the comparator.
function sortValue(a, col) {
  switch (col) {
    case 'quote': return (a.quote || a.note || '').toLowerCase()
    // Sorted on the NUMBER when there is one, which is the point of splitting it
    // out: text put chapter 10 between 1 and 2. Numbered chapters come first, in
    // order; named ones follow alphabetically, which is the only order they have.
    case 'chapter':
      return a.chapter_no != null
        ? `0${Math.max(0, a.chapter_no).toFixed(4).padStart(16, '0')}`
        : `1${(a.chapter || '').toLowerCase()}`
    case 'location': return locSortVal(a)
    case 'date': return annDate(a)
    case 'favorite': return a.favorite ? 1 : 0
    // LENGTH IS OF THE WORDS, not of the row: a note is not part of how long a
    // quote is, and a two-line quote with a page of notes under it is still a
    // short quote. A note-only row has no quote and sorts as nothing.
    case 'length': return (a.quote || '').length
    // The colour WHEEL's order and not the word's, because the swatches are drawn
    // in that order everywhere else in the app and a category list that ran
    // blue-orange-pink-yellow would be a second answer to "which order are the
    // colours in".
    case 'category': return Math.max(0, ANNOTATION_COLORS.indexOf(a.color || 'yellow'))
    default: return 0
  }
}

// hasValue — whether this quote has anything to be ordered by on this dimension.
//
// MISSING SINKS RATHER THAN FLOATS, AND IN BOTH DIRECTIONS, which is why it is a
// partition and not a sentinel. A quote with no location is not "location zero",
// and a board that opened with every unlocated quote on top would look broken;
// flip the arrow and a sentinel would put them all on top of the OTHER end
// instead, which is the same complaint in a mirror. Three dimensions can be
// absent: a chapter, a locator and a date. A colour and a length always exist.
function hasValue(a, col) {
  if (col === 'chapter') return a.chapter_no != null || !!(a.chapter || '').trim()
  if (col === 'location') return locSortVal(a) >= 0
  if (col === 'date') return !!annDate(a)
  return true
}

// sortAnnotations orders a board. `default` keeps the server's order, reversed
// when the direction is flipped — "recent" ascending is oldest first, which is a
// real thing to ask for and the only honest reading of the arrow.
export function sortAnnotations(rows, sort) {
  const arr = [...rows]
  if (sort.col === 'default') return sort.dir === 'asc' ? arr : arr.reverse()
  const dir = sort.dir === 'asc' ? 1 : -1
  const has = arr.filter((a) => hasValue(a, sort.col))
  const missing = arr.filter((a) => !hasValue(a, sort.col))
  has.sort((a, b) => {
    const x = sortValue(a, sort.col)
    const y = sortValue(b, sort.col)
    if (x < y) return -dir
    if (x > y) return dir
    // The id breaks every tie, so a board with forty quotes on one page is in a
    // stable order rather than whatever the sort happened to do this time.
    return a.id - b.id
  })
  return has.concat(missing)
}

// GROUP_DIMS — what a board of quotes can be bucketed by. Also the kind table's.
export const GROUP_DIMS = KINDS.book.groupDims

// dayOf floors a timestamp to its day. Grouping by the instant a quote was added
// would make every group hold one quote, which is a list with headings.
function dayOf(a) {
  return String(annDate(a) || '').slice(0, 10)
}

// groupAnnotations buckets a board, in the order each dimension is actually read
// in — and that is why this is not groupWorks.
//
// `groupWorks` orders its buckets by LABEL, which is right for a shelf of series
// and authors and wrong for all four of these: chapters run in reading order,
// colours run in the order the swatches are drawn, days run newest first, and
// tags run by how many quotes wear them. Four dimensions, four orders, none of
// them alphabetical — bending groupWorks to take them would have been a fifth
// option on a function that already takes eight, and the result would order a
// shelf and a board by rules neither call site could read off it.
//
// A quote with several tags appears under each of them, exactly as a book with
// several genres does. Everything else is single-valued, and a quote missing the
// value lands in a residual bucket that always sinks to the end.
export function groupAnnotations(rows, dim) {
  if (dim === 'none' || !GROUP_DIMS.includes(dim)) return null
  const map = new Map()
  const add = (key, label, row, order, residual) => {
    let g = map.get(key)
    if (!g) {
      g = { key, label, items: [], order, residual: !!residual }
      map.set(key, g)
    }
    g.items.push(row)
  }
  for (const a of rows) {
    if (dim === 'chapter') {
      const name = (a.chapter || '').trim()
      const n = a.chapter_no
      if (name || n != null) {
        const label = name || t('book.group.chapter.numbered.label', { n })
        // Numbered chapters in reading order; named ones after them, alphabetical.
        add(label, label, a, n != null ? n : Number.MAX_SAFE_INTEGER, false)
      } else add('~none', t('book.group.chapter.none.label'), a, Infinity, true)
    } else if (dim === 'color') {
      const tok = a.color || 'yellow'
      add(tok, categoryName(tok), a, Math.max(0, ANNOTATION_COLORS.indexOf(tok)), false)
    } else if (dim === 'tag') {
      const tags = a.tags || []
      if (tags.length) tags.forEach((tg) => add(tg, tg, a, 0, false))
      else add('~none', t('book.group.tag.none.label'), a, Infinity, true)
    } else {
      const d = dayOf(a)
      if (d) add(d, fmtDate(d), a, -new Date(`${d}T00:00:00`).getTime(), false)
      else add('~none', t('book.group.date.none.label'), a, Infinity, true)
    }
  }
  const out = [...map.values()]
  out.sort((x, y) => {
    if (x.residual !== y.residual) return x.residual ? 1 : -1
    // Tags have no order of their own, so the biggest group leads — the same
    // rule a shelf grouped by genre uses, and for the same reason.
    if (dim === 'tag') return y.items.length - x.items.length || x.label.localeCompare(y.label)
    return x.order - y.order || x.label.localeCompare(y.label)
  })
  return out
}

// ── WHICH TEXT ───────────────────────────────────────────────────────────────
//
// TEXT_VIEWS is the reader's answer to "a quote here is two texts". `both` is the
// board as it has always drawn: the words, then the translation under them.
//
// THE SUB-LINE IS PART OF THE SETTING, not decoration on it. "Quote only" and
// "Translation only" are unambiguous once you know a quote can carry a
// translation, and the whole difficulty is that most readers do not — the second
// line is where that fact is stated, in the one place someone is looking for it.
export const TEXT_VIEWS = ['both', 'quote', 'translation']

// VIEW_KINDS — the three the board actually renders, in the order the menu lists
// them. AnnotationBoard has always drawn all three; only the toggle narrowed it.
export const VIEW_KINDS = KINDS.book.views

// quoteBody — WHICH TEXT GOES IN THE BIG TYPE, given the setting.
//
// A FALLBACK, NOT A BLANK. "Translation only" on a quote with no translation
// falls back to the quote rather than showing an empty card. The alternative —
// honouring the setting exactly — empties every untranslated quote on the board,
// which on a library where translations are the exception is a setting that looks
// like a bug that has deleted your highlights. The setting says which text to
// PREFER; a card still has to say something.
export function quoteBody(a, tview) {
  if (tview === 'translation' && a.translation) return a.translation
  return a.quote
}

// showsTranslationLine — whether the second line under the words is drawn. Only
// in `both`: in `translation` the translation IS the words, and drawing it twice
// is the failure this pair exists to avoid.
export function showsTranslationLine(a, tview) {
  return tview !== 'quote' && tview !== 'translation' && !!a.translation
}

// duplicateSeed — the draft the Add surface opens on when a quote is duplicated.
//
// KEYED BY THE WIRE FIELD NAME, so the form does not have to know which fields a
// duplicate fills: add a key here and the box arrives seeded.
//
// THE WORDS COME ACROSS TOO, and that is the pack's call rather than an
// oversight: "the reader is usually keeping most of a sentence and changing a
// clause, so an empty box would be a worse start than a full one."
//
// WHAT IS NOT HERE IS NOT AN OMISSION. The capture form has no translation, no
// language and no sticker box — those are the edit form's — so seeding them would
// put values in a draft nothing can show and nothing will send. The menu row's
// sub-line names what actually carries, for exactly that reason.
//
// `tags` is a COMMA STRING because that is what the form's box holds; the row
// carries an array. One of the two conversions this function exists to do.
export function duplicateSeed(a) {
  return {
    quote: a.quote || '',
    note: a.note || '',
    chapter: a.chapter || '',
    chapter_no: a.chapter_no == null ? '' : String(a.chapter_no),
    location: a.location || '',
    character: a.character || '',
    color: a.color || 'yellow',
    tags: (a.tags || []).join(', '),
  }
}

function ActionRow({ acts, a, color, onColor, patch, actionsAlwaysVisible }) {
  // `acts` is built by the card, from the registry (actions.jsx) — one list per
  // card, rendered in three places: this row, the ⋯, and the context menu. Built
  // here instead, the gesture and the buttons would be two lists that agree by
  // coincidence.
  // §7 declutter: the favourite ♥ is the card's resting mark, and beside it sit
  // the two things you do WITH a quote — copy it, send it — then the colour
  // quick-pick. Those three hide until the card is hovered on desktop and stand
  // on a phone, where there is no hover to wait for. Only edit and delete are
  // behind the ⋯, at every width (see QuoteActions), so what a resting card
  // shows is its ♥ and one quiet overflow glyph.
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
      {/* FIRST, AND IT IS THE ONE CONTROL HERE THAT IS NOT ONE. Everything else
          in this row does something to the quote; this says what the quote's
          recall is. It leads because it is the card's state — the same position
          the shelf chip takes on a work — and because a state read after four
          verbs reads as a fifth verb. */}
      <ReviewDot item={a} />
      <Hearts value={!!a.favorite} onChange={(v) => patch(a, { favorite: v })} />
      <QuoteTools actions={atRow(acts)} alwaysVisible={actionsAlwaysVisible} />
      {/* shrink-0: the colour dots are one atomic control — the row wraps the ⋯
          cluster to a second line before it splits or squeezes them. (Six of
          them since 1.7.1, collapsing to a single trigger below a 330px card.) */}
      <span className={'card-colors shrink-0' + (actionsAlwaysVisible ? ' is-visible' : '')}>
        <ColorSwatches value={color} onChange={onColor} ariaLabel={t('common.colour.category.aria')} collapsible />
      </span>
      <span className="ml-auto flex items-center">
        <QuoteActions actions={atOverflow(acts)} />
      </span>
    </div>
  )
}

// AnnotationCard is the shared card body for the tiles + list views. An attached
// uploaded sticker becomes the corner seal the quote flows around (pretext); the
// quote clamps to `quoteLines` with an inline show-more.
// AnnotationCard renders one saved quote. It is shared by three kinds, not one:
// a book annotation, and — since §24 — a standalone quote, which has no chapter,
// no page and no parent work but is otherwise the same object.
//
// The two things that differ are passed in rather than branched on:
//
//   meta   the small line under the quote. Defaults to CH./P./date.
//   form   the edit form. Defaults to AnnotationForm.
//
// EXTENDING THIS RATHER THAN WRITING A THIRD CARD IS DELIBERATE. `.card-tools`
// and `.card-colors` are revealed only under `.hand-card:hover/:focus-within`
// and `.film-frame:hover/:focus-within`, `.hand-card::before` is what carries
// the paper/metal material, and the mobile rules that narrow the heart and the
// colour dots are keyed to the same two selectors. A bespoke wrapper would look
// right on a desktop screenshot and silently lose the aesthetic toggle, the
// hover affordances and the 320px layout all at once.
export function AnnotationCard({ a, variant, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, setEditingId, save, patch, remove, onCopy, onShare, quoteLines = 6, tagSuggestions = [], actionsAlwaysVisible = false, editInline = false, expanded, onToggleExpand, meta, form: Form = AnnotationForm, selection, selectKind = 'annotation', onMoveBoard, onDuplicate, tview = 'both', onOpenCharacter, people = {}, onOpenPerson = null, seps }) {
  const sticker = a.sticker_id != null ? stickerMap[a.sticker_id] : null
  const body = quoteBody(a, tview)
  // Accordion mode (tiles board): the parent owns which quote is open, so one
  // expands at a time. Elsewhere (list, search modal) each card keeps its own.
  const accordion = typeof onToggleExpand === 'function'
  const d = fmtDate(annDate(a))
  // Optimistic colour. patch() refetches the whole list before the row comes
  // back changed, so the quick-pick paints the card's bar (and the picked dot)
  // itself the instant it's tapped. The preview clears as soon as the refetched
  // row carries the new colour, and rolls back if the PUT failed.
  const [pendingColor, setPendingColor] = useState(null)
  useEffect(() => { setPendingColor(null) }, [a.color])
  const color = pendingColor || a.color
  const pickColor = async (c) => {
    if (c === color) return // no clear: the server has no "no colour" (validColor)
    setPendingColor(c)
    if ((await patch(a, { color: c })) === false) setPendingColor(null)
  }
  // WHO SAID IT, AS A CHIP RATHER THAN AS TEXT, when the line's speaker resolves
  // to a character record. `speaker_cast` is the stored link — who SPOKE the line —
  // which is a different question from `character`, the text naming everyone the
  // line mentions; see quote_speaker.go on the server.
  //
  // THREE CONDITIONS, AND EACH IS A REAL STATE. No link: an old line, or one whose
  // speaker was never matched, and the text below still names them. No
  // `character_id`: a cast row nothing has linked to a record, so there is no page
  // to open and a chip would be a dead control — cast.jsx settles the same question
  // the same way. No `onOpenCharacter`: this card also draws on Home, in Search and
  // on the standalone board, none of which own a panel stack, and a chip that
  // cannot open anything is worse there than the text they already show.
  // A CHIP PER CHARACTER, and the row scrolls under a fade when it does not fit.
  // The speaker leads and keeps its two lines and its door; everyone else the
  // line names gets a face and a name. See SpeakerChips, which both cards share
  // so that a book's and a film's cannot drift apart — they did once, and that
  // divergence is how the missing-face bug survived.
  const sp = a.speaker_cast
  // NO `onOpen` SPREAD ONTO THE SPEAKER. `chipRows` reads the handler it is
  // passed now, as its named rows always did, so attaching it to the object was
  // one contract kept in two places — and Home keeping only one of them is what
  // left its stacked chip dead.
  const speaker = sp || null
  const chipCount = chipRows(a.character_images, speaker).length
  // AND A STANDALONE QUOTE FALLS BACK TO ITS SPEAKER, which is the whole reason
  // the Quotes screen drew no chip at all where Home drew one for the same line.
  //
  // `SpeakerChips` is built from `character_images` — the work's CAST — and a
  // letter, an essay or a speech has no cast: the person who said it is a
  // `people` record and nothing else. So `chipRows` returned nothing, the card
  // rendered an empty row, and the speaker survived only as text in the meta
  // line. Home has carried the ladder since its tiles were written (chips from
  // the cast, else `PeopleChips` from the names) and this card never learned it.
  //
  // The fallback is gated on there being no cast chips at all, so a film line
  // keeps exactly what it had.
  const fallbackNames = !chipCount && a.speaker ? splitCredits(a.speaker, seps) : []
  const chips = chipCount || !fallbackNames.length ? (
    <SpeakerChips
      images={a.character_images}
      speaker={speaker}
      onOpenCharacter={onOpenCharacter}
    />
  ) : (
    <PeopleChips names={fallbackNames} map={people} kind="speaker" onOpen={onOpenPerson} />
  )
  // `meta` undefined falls back to the book locator; '' means "no line at all",
  // which is why the test is against undefined rather than falsiness.
  const metaLine =
    meta === undefined
      ? [
          // WHO SAID IT, first, because it is the only part of this line that is
          // about the words rather than about where they were. A highlight has
          // carried a character since 0047 and no card showed it, so the box
          // looked like it wrote nowhere — see the share payload, which had the
          // same gap.
          //
          // DROPPED WHEN THE CHIP DRAWS IT, which is the SearchPage precedent
          // (`omitSpeaker`): naming one person twice on one card is the reader
          // reading the same fact twice and wondering what the difference is.
          // OMITTED WHERE A CHIP ALREADY SAYS IT, which is now any line with a
          // chip at all rather than only one with a stored speaker: naming the
          // same people twice on one card is the reader reading the same fact
          // twice and wondering what the difference is.
          chipCount ? null : a.character,
          chapterLabel(a) && t('common.locator.chapter.label', { name: chapterLabel(a) }),
          a.location && t('common.locator.page.short.label', { n: a.location }),
          d,
        ].filter(Boolean).join(' · ')
      : meta
  const editForm = (
    <Form initial={a} onSubmit={(fields) => save(a.id, fields)} onCancel={() => setEditingId(null)} submitLabel={t('common.action.save.label')} tagSuggestions={tagSuggestions} stickers={stickers} reloadStickers={reloadStickers} bookId={a.book_id ?? null} />
  )
  // Right-click, long-press or Shift+F10 anywhere on the card opens the SAME list
  // the row and the ⋯ render (actions.jsx), so the gesture can never offer
  // something the buttons do not — which is the whole reason the registry exists.
  const acts = actionsFor('annotation', a, {
    copy: onCopy,
    share: onShare,
    edit: (row) => setEditingId(row.id),
    // The same patch the card's own ♥ runs, so the two cannot disagree about
    // what favouriting is. `favourited` only decides the wording.
    favourite: (row) => patch(row, { favorite: !row.favorite }),
    favourited: !!a.favorite,
    // Only the Quotes screen passes this — a highlight belongs to its book and has
    // no board — which is what keeps "Move to board" off a Library card without
    // this file knowing anything about boards.
    setBoard: onMoveBoard,
    // Gated on the callback, like setBoard above it: the same card is drawn on
    // four surfaces and only the ones with a route to the Add surface can offer
    // this. A kind test here would be a control that is right about the board
    // and silently absent inside the search modal.
    duplicate: onDuplicate,
    remove,
  })
  // SELECT IS THE FIRST ITEM IN THE MENU, and that is what makes the context menu
  // and multiselect one feature rather than two: the gesture that asks "what can I
  // do to this" is also how you start doing it to several. Select all sits under
  // it, from the same helper every board uses (selection.jsx).
  const menuItems = [
    ...selectionMenuItems(selection, a.id, selectKind),
    ...acts.map((x) => ({ ...x, onClick: x.run })),
  ]
  // A long press on the card's WHITESPACE selects it; a long press on the quote
  // itself is left to the browser, so a thumb can still pull a phrase out of it.
  // Where there is no selection to enter, the press keeps opening the menu.
  const { cardProps, menuClass, menu } = useCardMenu(
    menuItems,
    selection ? { onLongPress: () => selection.toggle(a.id, selectKind) } : undefined,
  )
  const picked = !!selection?.isSelected(a.id)
  // Once a selection exists a plain click TOGGLES rather than opens, on every
  // device. The mode is visible — the bar is up and the cards wear checkboxes — so
  // the change of meaning is not a surprise, and clicking the last one off leaves it.
  const onCardClick = selection
    ? (e) => {
        const what = selectionClick(e, selection)
        if (what === 'open') return
        e.preventDefault()
        e.stopPropagation()
        if (what === 'extend') selection.extendTo(a.id, selectKind)
        else selection.toggle(a.id, selectKind)
      }
    : undefined
  // editInline renders the form in place of the card body — used inside the
  // search QuoteModal, which is itself a pop-up (avoids stacking two overlays).
  // Everywhere else the edit opens in a FormModal, the house style.
  if (editInline && editing) {
    // A card that IS a form gets no card menu: every gesture on it belongs to the
    // inputs inside it.
    return (
      <HandCard variant={variant} colorBar={color} className="px-5 py-4">
        {editForm}
      </HandCard>
    )
  }
  return (
    <HandCard
      variant={variant}
      colorBar={color}
      className={`px-5 py-4 ${menuClass}${picked ? ' is-picked' : ''}${selection?.active ? ' is-selecting' : ''}`}
      {...cardProps}
      onClickCapture={(e) => {
        // The press already acted. Running the click handler too would toggle a
        // second time and undo the long press — see useCardMenu.
        if (cardProps.onClickCapture?.(e)) return
        onCardClick?.(e)
      }}
    >
      {selection && (
        /* The tickmark: a real checkbox under a drawn tick, in the card's corner,
           revealed on hover on a desktop and standing on every card once a selection
           is running. Long-press, Ctrl/Cmd-click and this are three doors into the
           same mode — one you already know from a phone, one from a file manager,
           one you find by looking. */
        <PickMark
          picked={picked}
          label={t('common.quote.pick.label')}
          onChange={() => selection.toggle(a.id, selectKind)}
        />
      )}
      {!editInline && (
        <FormModal open={editing} onClose={() => setEditingId(null)} title={t('common.quote.edit.title')}>
          {editForm}
        </FormModal>
      )}
        <div className="space-y-2">
          {/* WHAT THE BIG TYPE SAYS is the reader's setting, not always the
              original — see quoteBody. Defaulting to 'both' means every other
              surface that renders this card (the search modal, the Catalogue,
              a film's dialogue board) is untouched. */}
          {body &&
            (sticker ? (
              <FlowQuote
                text={body}
                quoteStyle={QUOTE_STYLE}
                stickerKey={`s${sticker.id}`}
                maxLines={quoteLines} /* collapsed → small corner badge; expanded →
                                         full positioned/draggable seal (see flow.jsx) */
                pos={a.sticker_x != null ? { x: a.sticker_x, y: a.sticker_y } : null}
                onMove={(x, y) => patch(a, { sticker_x: x, sticker_y: y })}
                sticker={<StickerImg sticker={sticker} />}
                open={accordion ? !!expanded : undefined}
                onToggle={accordion ? onToggleExpand : undefined}
              />
            ) : (
              <ExpandableText
                text={body}
                lines={quoteLines}
                style={QUOTE_STYLE}
                open={accordion ? !!expanded : undefined}
                onToggle={accordion ? onToggleExpand : undefined}
              />
            ))}
          {/* ITS OWN LINE, ABOVE THE LOCATOR ROW — not inside it. The chip is a
              38px pill and the row beside it holds two 8px dots and a line of mono
              text, so putting them together made the tallest object on the card
              set the height of its quietest line and pushed the locator off to the
              right of a name. Above it, the card reads down the way it is written:
              the words, then who said them, then where they were. */}
          {chips}
          <div className="flex items-center gap-2">
            {/* THE CHARACTER'S FACE, and a book's card is the last place that was
                still printing the name and nothing else. A highlight has carried a
                character since 0047 and `character_images` has ridden the payload
                since the cast pass (annotation_handlers.go), but this card put the
                name in the mono locator line beside the chapter and the page — so
                the one part of that line that is about WHO SPOKE looked exactly
                like the part about which page it was on.

                The Catalogue's card has drawn the face for as long as it has had
                one, and drawing it here off the same component is the point: a
                character is a character whether the words came out of a book or a
                film. FALLING BACK TO NOTHING rather than to a silhouette — the
                film side falls back to the ACTOR, and a book's speaker has no
                actor to stand in for them, so an empty disc would be a picture of
                nobody. */}
            {/* THE DISC ROW IS GONE, and the comment it replaces explains why it
                was there: it drew the ensemble lines the single chip could not
                speak for. A stack of faceless discs says how MANY characters a
                line names and not one of their names, which is the one thing a
                reader wants from it — so those lines get a chip each now, above,
                and there is nothing left for the discs to cover. */}
            {/* THE RECALL MARK IS NOT HERE ANY MORE — it is the first glyph of
                the action row below, on the owner's ruling ("put in the bottom
                row (where the icons are) as the first icon"). It had been the
                only thing on a line of its own on a card with no credits, which
                is what an orphan row is. What stays here is the quiz mark, which
                belongs to the CREDIT line rather than to the actions: it says
                this quote is out of the deck, which is a fact about the quote and
                not something you can do to it.

                This card serves annotations AND standalone quotes; only the
                first has a work to inherit from, so only it names one. */}
            <QuizSkipMark item={a} parent={selectKind === 'annotation' ? 'book' : ''} />
            {metaLine && <MonoLabel className="block">{metaLine}</MonoLabel>}
          </div>
          {/* WHAT IT SAYS, then what you thought — in that order, and the order is
              the argument. The translation belongs to the quote, so it sits under
              the words and above the margin note; putting it after the note would
              read as a second thought about the line rather than the line itself.
              Drawn here rather than inside each kind's `meta` node so that all
              three kinds — and the search modal, which asks utteranceMeta for a
              plain string — show it identically. */}
          {showsTranslationLine(a, tview) && <TranslationLine>{a.translation}</TranslationLine>}
          {a.note && <HandNote>{a.note}</HandNote>}
          {a.tags && a.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {a.tags.map((name) => {
                const tag = tagMap[name]
                return (
                  <TagChip key={name} color={tag?.color} style={tag?.style}>
                    {name}
                  </TagChip>
                )
              })}
            </div>
          )}
          <ActionRow acts={acts} a={a} color={color} onColor={pickColor} patch={patch} actionsAlwaysVisible={actionsAlwaysVisible} />
        </div>
      {menu}
    </HandCard>
  )
}

// The columns are the kind table's; the getter is what keeps a label out of
// module-load time, so it resolves in whichever language is applied when the
// header is drawn rather than the one that happened to load first.
const TABLE_COLS = KINDS.book.tableCols.map((c) => ({
  key: c.key,
  get label() { return t(c.labelKey) },
}))

function AnnotationTable({ rows, tagMap, stickers = [], reloadStickers, sort, onSort, editingId, setEditingId, save, remove, onCopy, onShare, tview = 'both' }) {
  // DRAWN, NOT TYPED. `▲`/`▼` render in the reader's font — solid on one platform,
  // hollow on another, off the baseline the header's letters share — and are the
  // one picture docs/ui-glossary.html cannot document. IconSortAsc/IconSortDesc
  // are the pair every other sort control in this app uses.
  const arrow = (k) => (sort.col !== k ? null
    : sort.dir === 'asc' ? <IconSortAsc size={13} /> : <IconSortDesc size={13} />)
  const editingRow = rows.find((a) => a.id === editingId)
  return (
    <Scroller className="ann-table-wrap">
      <table className="ann-table">
        <thead>
          <tr>
            {TABLE_COLS.map((c) => (
              <th key={c.key} className="sortable" onClick={() => onSort(c.key)} aria-sort={sort.col === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <Tooltip label={t('book.table.sort.tip')} side="bottom">
                  {c.label}
                  {arrow(c.key)}
                </Tooltip>
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="col-quote">
                {/* The table honours the same setting the cards do — it is the
                    one view where the translation was never drawn at all, so a
                    reader who asked for "translation only" here used to get the
                    original back with no sign the setting had done anything. */}
                <ExpandableText text={quoteBody(a, tview) || a.note} lines={2} style={QUOTE_STYLE} />
                {a.tags && a.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.tags.map((name) => {
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
              <td className="col-mono">{chapterLabel(a) || '—'}</td>
              <td className="col-mono">{a.location || '—'}</td>
              <td className="col-mono">{fmtDate(annDate(a)) || '—'}</td>
              <td className="col-center">{a.favorite ? <IconHeartOn size={14} /> : '—'}</td>
              <td className="col-actions">
                <TableActions
                  noun={t('unit.quote.one')}
                  nounPlural={t('unit.quote.other')}
                  onCopy={onCopy && (() => onCopy(a))}
                  onShare={onShare && (() => onShare(a))}
                  onEdit={() => setEditingId(a.id)}
                  onDelete={() => setAsking(a)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <FormModal open={!!editingRow} onClose={() => setEditingId(null)} title={t('common.quote.edit.title')}>
        {editingRow && (
          <AnnotationForm initial={editingRow} onSubmit={(fields) => save(editingRow.id, fields)} onCancel={() => setEditingId(null)} submitLabel={t('common.action.save.label')} tagSuggestions={Object.keys(tagMap)} stickers={stickers} reloadStickers={reloadStickers} bookId={editingRow.book_id ?? null} />
        )}
      </FormModal>
    </Scroller>
  )
}

// Annotations is the per-book annotation section: filter row and hand-drawn
// cards (§8.5). Adding opens in the standard pop-up form (FormModal) — the
// sticky-bar ＋ on phones; the omnipresent top-bar ＋ Add elsewhere.
// pinToTop floats just-added annotations to the front of whatever order the
// view is currently in, preserving pinnedIds' order (most-recent add first) and
// leaving the rest untouched. Ids that aren't present (filtered out, or a stale
// pin) are simply skipped. Returns the input unchanged when there's nothing to
// pin so identity is preserved for memo consumers.
function pinToTop(arr, pinnedIds) {
  if (!pinnedIds.length || !arr || !arr.length) return arr
  const pset = new Set(pinnedIds)
  const top = []
  for (const id of pinnedIds) {
    const found = arr.find((x) => x.id === id)
    if (found) top.push(found)
  }
  if (!top.length) return arr
  return [...top, ...arr.filter((x) => !pset.has(x.id))]
}

function Annotations({ bookId, book, authorMap = {}, seps, onStats, mobileFilterOpen, onMobileFilterOpen, onAdd, dataNonce, onOpenCharacter }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // annotation being shared
  const [color, setColor] = useState('') // filter, '' = all
  const [tag, setTag] = useState('') // filter by NAME, '' = all
  const [fav, setFav] = useState(false)
  // NOTED AND TAGGED, the pack's other two chips (its fourth, "unread", means
  // nothing for a quote). CLIENT-SIDE, unlike colour/tag/favourite: those three
  // are query parameters the server already understands, and adding two more
  // would be a handler change and a store change for a filter over a set that is
  // already in the browser. The unfiltered counts stay correct either way — they
  // are recorded on an unfiltered REQUEST, and these two do not change the
  // request.
  const [noted, setNoted] = useState(false)
  const [tagged, setTagged] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [total, setTotal] = useState(null) // unfiltered count for "N quotes · M shown"
  // The same unfiltered set, counted four ways for the hero (see countQuotes).
  // Kept beside `total` rather than replacing it: this toolbar's label pairs the
  // unfiltered total with the number SHOWN, which is a fact about the filter, and
  // the hero's line is a fact about the book. Two labels, two jobs, one fetch.
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:annview', 'tiles') // list | tiles | table
  // ONE ORDER FOR EVERY VIEW. This was `table only`, and the two card views —
  // which is where a reader actually reads — had no order to choose at all and no
  // way to group. A board of three hundred highlights in the order they happened
  // to be saved is a board you scroll rather than read.
  const [sort, setSort] = usePersistedState('tippani:annsort', { col: 'default', dir: 'asc' })
  const [groupBy, setGroupBy] = usePersistedState('tippani:anngroup', 'none')
  // WHICH TEXT, not which layout — and the two are settings of the same kind, so
  // they sit together in the menu. A translated quote is two texts, and which one
  // a reader wants changes per sitting: the original when they can read it, the
  // translation when they cannot, both when they are comparing them. Nothing on
  // this board could ask for that before; it always drew both.
  const [tview, setTview] = usePersistedState('tippani:anntext', 'both')
  // Ids of annotations added this session, most-recent first. They're floated to
  // the top of the pile (overriding the current order) so the user sees their
  // addition — until they sort, which clears the pin (see toggleSort).
  const [pinned, setPinned] = useState([])
  const reqSeq = useRef(0)
  const mobile = useIsMobileScreen()

  // A quote captured through the shell's Add surface lands server-side without
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

  // Report the unfiltered quote counts up to the detail: the total decides the
  // Wishlist tag, and all four print in the hero. `stats` is only recomputed on an
  // unfiltered load (see load()), for the same reason `total` always was — a
  // colour filter must not make a book look emptier than it is.
  useEffect(() => {
    if (stats) onStats?.(stats)
  }, [stats])

  const { stickers, reload: reloadStickers } = useStickers()
  const filtering = Boolean(color || tag || fav || noted || tagged)
  // THE CHIPS, DECLARED ONCE AND DRAWN TWICE — the desktop row and the phone's
  // filter sheet. Written inline in both places they had already drifted to one
  // chip on each; a screen that offers a different set of filters depending on
  // the device is offering a different board.
  //
  // The pack draws four. Its fourth is "unread", which means nothing for a
  // quote, so three is the whole set here.
  const quoteChips = [
    { on: fav, set: setFav, label: t('common.filters.favourites.label'), tip: t('common.favourite.filter.tip') },
    { on: noted, set: setNoted, label: t('common.filters.noted.label'), tip: t('common.filters.noted.tip', { noun: t('unit.quote.other') }) },
    { on: tagged, set: setTagged, label: t('common.filters.tagged.label'), tip: t('common.filters.tagged.tip', { noun: t('unit.quote.other') }) },
  ]
  // Chips take colour + style from the tag object (name-keyed map).
  const tagMap = useMemo(() => Object.fromEntries(tags.map((row) => [row.name, row])), [tags])
  // Attached stickers resolve id → image for the card seal.
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  function toggleSort(col) {
    // Sorting is the user taking control of the order, so drop the just-added
    // pin and let the new sort decide where those items land.
    setPinned([])
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  }
  // The two client-side chips, applied before the sort so every view and the
  // "N shown" count see the same set.
  const chipRows = useMemo(() => {
    if (!items) return items
    if (!noted && !tagged) return items
    return items.filter(
      (a) => (!noted || (a.note || '').trim().length > 0) && (!tagged || (a.tags || []).length > 0),
    )
  }, [items, noted, tagged])
  // The chosen order, in every view — see sortAnnotations, which is where the
  // dimensions and their tie-breaks live.
  const sortedRows = useMemo(() => sortAnnotations(chipRows || [], sort), [chipRows, sort])
  // What every view actually renders: the current order (server-recent for
  // list/tiles, the chosen column for table) with freshly-added items pinned on
  // top. sortedRows already returns a server-order copy of items for non-table
  // views, so this is the single source of truth for all three.
  const displayRows = useMemo(() => pinToTop(sortedRows, pinned), [sortedRows, pinned])
  // The buckets, when there are any. null when grouping is off, which is what
  // every renderer below tests — one branch rather than a group of one.
  const groups = useMemo(() => groupAnnotations(displayRows, groupBy), [displayRows, groupBy])
  // Groups are windowed like the Library's are: each section's own board stops at
  // the page size, and a hundred small sections is still the whole book mounted,
  // so the bound has to exist at both levels or neither.
  const groupWin = useBoardWindow(groups ? groups.length : 0, groups, 8)
  // Over the visible order, so changing a filter drops the ids that left the board.
  // The table view has no tickmarks — a row is already a row of controls — so the
  // selection is offered on the two CARD views, which is where a long press means
  // anything.
  const selection = useSelection(displayRows.map((a) => a.id))
  const afterBulk = () => {
    selection.clear()
    load()
  }

  // ── WHAT THE BOARD PUTS IN THE SCREEN'S ⋯ .
  //
  // A SECOND SECTION IN THE SAME MENU, published by the board rather than by the
  // page around it, because these are settings of the LIST and the page's own
  // section is about the WORK. buildScreenActions concatenates every publisher for
  // exactly this — "on a composed page" is its own note — and a child's effect
  // runs before its parent's, so this section leads.
  //
  // THE VIEW LIVES HERE NOW, and the design pack's argument is the one that moved
  // it: "on the surface it was the widest group in the header — a 210px
  // three-option strip — and it broke the row onto three lines at 720px. It is
  // also the control changed least often: you pick a view and read for an hour. A
  // setting that costs the most width and earns the least use belongs behind ⋯."
  //
  // AND LIST IS BACK, on this board. ViewToggle dropped it for a reason that was
  // entirely about the switch — "the third option cost a third of the switch's
  // width to offer a fourth of a difference" — and a menu row costs no width at
  // all. The renderer never stopped drawing it; `list` was a setting you could
  // hold and not choose.
  //
  // RADIO ROWS, NOT ROWS THAT OPEN FURTHER MENUS. The pack's ⋯ nests because its
  // popover stack can; this is the shell's menu, whose own note says what it is
  // for — "it names which view you are in, which sort is running, what the filters
  // are". Ticked rows under a heading say that outright, at one press instead of
  // two.
  useScreenBar({
    actions: () => [
      { id: 'h-view', heading: t('common.mono.view.label') },
      ...VIEW_KINDS.map((v) => ({
        id: `view-${v}`,
        icon: <ViewIcon kind={v} />,
        label: t(`common.view.${v}.label`),
        checked: view === v,
        onClick: () => setView(v),
      })),
      { id: 'h-text', heading: t('book.text.menu.label') },
      ...TEXT_VIEWS.map((k) => ({
        id: `text-${k}`,
        label: t(`book.text.${k}.label`),
        sub: t(`book.text.${k}.sub`),
        checked: tview === k,
        onClick: () => setTview(k),
      })),
      // THE THIRD DOOR INTO SELECTING, and the only one that can be found by
      // looking. The other two — a long press and a Ctrl-click — are gestures a
      // reader has to already know, on a board where nothing says the mode exists.
      // Hidden while the mode is running: a row offering to start what is already
      // started is the dead control the selection menu's own note argues against.
      ...(selection.active
        ? []
        : [{ id: 'select', icon: <IconCheck />, label: t('book.select.menu.label'), onClick: () => selection.begin('annotation') }]),
    ],
  })

  // Tiles are a height-packed masonry (1/2/3 cols by width). Newly-added quotes
  // (the pinned prefix of displayRows) stay glued to the top of the board.
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
  const pinnedShown = useMemo(
    () => (!pinned.length || !items ? 0 : pinned.filter((id) => items.some((x) => x.id === id)).length),
    [pinned, items],
  )
  // THE DETAIL PAGE IS A BOARD TOO, and it was the last one still mounting everything
  // it had. A book with three hundred highlights rendered three hundred cards before
  // the reader had seen the first screen of them — the same defect the quotes board
  // had, on the page a reader actually spends their time on.
  //
  // The count is floored at the pinned prefix: pinToTop puts newly-added quotes at the
  // front, and a window that cut below them would hide the very rows that were pinned
  // there to be seen.
  const rowsWin = useBoardWindow(displayRows.length, displayRows, ANNOTATION_PAGE)
  const shownRows = useMemo(
    () => displayRows.slice(0, Math.max(rowsWin.count, pinnedShown)),
    [displayRows, rowsWin.count, pinnedShown],
  )

  // HOW MANY THE FILTERS ARE HOLDING BACK. displayRows is what passes them;
  // `total` is the unfiltered count the fetch reported. Not shownRows, which is
  // the WINDOW — a board that has only drawn its first page is not a board that
  // is hiding the rest, and saying so would report a filter nobody set.
  const hidden = total != null ? Math.max(0, total - displayRows.length) : 0

  // One board seed drives both the masonry jitter and each card's clamp height,
  // so the two stay in step and a given book always lays out the same way.
  const boardSeed = book?.id || bookId || 1
  // Per-card clamp: uniform 3–5 lines with no three-adjacent the same, seeded off
  // the book so it's stable across reloads. The tiles board is laid out in source
  // order (newest first, new pins on top), so these clamp sizes land in that same
  // order — the no-3-in-a-row rule reads that way on the board too.
  const clampLines = useMemo(
    () => clampSequence(displayRows.length, mulberry32(boardSeed)),
    [displayRows.length, boardSeed],
  )
  // Tiles run a one-open-at-a-time accordion: expanding a quote collapses any
  // other, and the masonry order locks while one is open so columns don't jump.
  const [expandedId, setExpandedId] = useState(null)
  const toggleExpanded = useCallback((id) => setExpandedId((cur) => (cur === id ? null : id)), [])
  // Keep expandedId honest: if the open quote leaves the set (un-favourited or
  // edited out of the active filter via patch/save, which don't reset it), clear
  // it — a dangling id keeps the board's lockOrder stuck true and defeats the
  // masonry's rising-edge freeze on the next expand.
  useEffect(() => {
    if (expandedId != null && items && !items.some((x) => x.id === expandedId)) setExpandedId(null)
  }, [items, expandedId])
  // A column-count change (responsive breakpoint / rotation) re-opens masonry
  // packing; collapse any open quote at the cross so the board re-packs and
  // re-freezes off collapsed heights, not around the still-expanded card.
  useEffect(() => { setExpandedId(null) }, [tileCols])

  async function loadTags() {
    const r = await json('GET', '/tags')
    if (r.ok) setTags(r.data.tags)
  }
  async function load() {
    // Sequence guard: rapid filter toggling fires overlapping requests, so only
    // the newest response is allowed to render (a slow earlier one is dropped).
    const seq = ++reqSeq.current
    const params = new URLSearchParams({ book_id: bookId })
    if (color) params.set('color', color)
    if (tag) params.set('tag', tag)
    if (fav) params.set('favorite', '1')
    const r = await json('GET', `/annotations?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) {
      setItems(r.data.annotations)
      if (!color && !tag && !fav) {
        setTotal(r.data.annotations.length)
        setStats(countQuotes(r.data.annotations))
      }
    } else setError(errText(r))
  }
  useEffect(() => {
    // A book switch or filter change swaps the tile set, so collapse any open
    // quote first: it keeps the masonry's column lock from being latched around
    // an expanded card while the set changes underneath it (see Masonry).
    setExpandedId(null)
    load()
  }, [bookId, color, tag, fav])
  useEffect(() => {
    loadTags()
  }, [bookId])

  async function save(id, fields) {
    const r = await json('PUT', `/annotations/${id}`, fields)
    if (!r.ok) return errText(r, t('error.save.annotation'))
    setEditingId(null)
    load()
    loadTags()
    return null
  }

  // Asked in the app's own voice rather than the browser's — the last native
  // confirm() on this screen. It keeps the same friction it had: a question, not
  // a typed phrase, because the row is right there and the toast carries an Undo.
  const [asking, setAsking] = useState(null)
  async function remove(a) {
    setAsking(null)
    const r = await deleteWithUndo(`/annotations/${a.id}`, { reload: load })
    if (r.ok) {
      setTotal((n) => (n == null ? n : n - 1))
      // The hero's counts go down with it, subtracting what THIS row contributed
      // rather than only the total — see minusQuote. Without it the hero sits one
      // ahead of the toolbar for as long as a filter is on.
      setStats((s) => minusQuote(s, a))
      setExpandedId(null) // collapse before the shorter set re-packs
      load()
    } else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (♥ clicks, the
  // colour quick-pick, sticker drags). Resolves false when the save failed, so
  // an optimistic caller can roll its preview back.
  //
  // IT TAKES THE REPLY RATHER THAN ASKING AGAIN. The PUT answers with the updated
  // row, and this used to throw that away and refetch the whole board — so the
  // most frequent interaction in the app, hearting a quote, cost two serialised
  // round trips where one had all the information. On a phone over a VPN that is
  // the difference the owner reported as "terribly unresponsive", and the release
  // that measured it concluded there was exactly one duplicate read. There were
  // two, and this was the hotter.
  //
  // THE REFETCH IS STILL RIGHT WHEN THE FILTER READS THE FIELD, which is why this
  // is a guard and not a deletion: the filters are applied by the SERVER, so
  // un-hearting a row while the favourites filter is on has to take it off the
  // board, and splicing it back in would leave it sitting there.
  async function patch(a, fields) {
    const r = await json('PUT', `/annotations/${a.id}`, { ...annotationState(a), ...fields })
    if (!r.ok) {
      setError(errText(r, t('error.save.annotation')))
      return false
    }
    setError('')
    if (patchMovesTheRow(fields, { fav, color, tag })) load()
    else setItems((cur) => (cur || []).map((x) => (x.id === a.id ? { ...x, ...r.data } : x)))
    return true
  }

  // Build the normalised share payload from the chosen annotation + its book.
  const sharePayload = (a) =>
    bookShare({
      quote: a.quote,
      note: a.note,
      translation: a.translation,
      author: book?.author,
      title: book?.title,
      published: book?.published_year,
      chapter: chapterLabel(a),
      location: a.location,
      character: a.character,
      date: fmtDate(annDate(a)),
      tags: a.tags,
      color: a.color,
      people: authorMap,
      seps,
      characterImages: a.character_images,
    })

  // The card's copy glyph writes out the same quote the share dialog's plain-text
  // format would — same payload, same default ticks — so the two cannot disagree
  // about whether a copied quote carries its author.
  const copyOne = (a) => copyQuote(sharePayload(a))

  const countsLabel = !items
    ? ''
    : filtering && total != null
      ? t('book.quotes.counts.shown', { a: countOf(total, 'unit.quote'), n: items.length })
      : countOf(items.length, 'unit.quote')

  // ONE RENDERER FOR THE THREE VIEWS, and the reason is grouping: a grouped board
  // draws the same view once per section, and two copies of "how a quote is drawn"
  // is two places for a card prop to go missing. Everything a board needs that
  // does not change per section is bundled here.
  const board = {
    view,
    tview,
    // Undefined on every surface but a work's own page, and the card checks: a
    // chip that cannot open anything is worse than the text it would replace.
    onOpenCharacter,
    // DUPLICATE OPENS THE SHELL'S ONE ADD SURFACE, on Capture, with this book as
    // the target and the copied quote in the boxes. Nothing is written until Save
    // — a duplicate you abandon is a duplicate that never existed — which is why
    // it is a form and not a POST with an undo behind it.
    onDuplicate: onAdd ? (row) => onAdd('quote', { type: 'book', id: bookId }, duplicateSeed(row)) : undefined,
    tagMap,
    stickerMap,
    stickers,
    reloadStickers,
    editingId,
    setEditingId,
    save,
    patch,
    remove: setAsking,
    onCopy: copyOne,
    onShare: setShareTarget,
    selection,
    sort,
    onSort: toggleSort,
    columns: tileCols,
    expandedId,
    onToggleExpand: toggleExpanded,
  }

  return (
    <div className="space-y-4">
      {mobile && (
        <MobileSheet
          open={mobileFilterOpen}
          onClose={() => onMobileFilterOpen?.(false)}
          title={t('book.quotes.filter.title')}
          footer={
            <SheetFooter
              count={countsLabel}
              onReset={() => { setColor(''); setTag(''); setFav(false) }}
              onDone={() => onMobileFilterOpen?.(false)}
            />
          }
        >
          <div className="space-y-5">
            <div>
              <MonoLabel className="mb-2 block">color</MonoLabel>
              <ColorSwatches value={color} onChange={(c) => setColor(c === color ? '' : c)} />
            </div>
            {tags.length > 0 && (
              <div>
                <MonoLabel className="mb-2 block">tag</MonoLabel>
                <Select
                  ariaLabel={t('common.filters.tag.aria')}
                  value={tag}
                  onChange={setTag}
                  options={[['', t('common.filters.tag.all.label')], ...tags.map((row) => [row.name, row.name])]}
                />
              </div>
            )}
            <div>
              {/* The same three the desktop row draws — see there for why they
                  are FilterChips. A phone that offers one filter and a desktop
                  that offers three is the divergence this screen keeps finding
                  in itself; the list is written once and read twice. */}
              <MonoLabel className="mb-2 block">show only</MonoLabel>
              <div className="flex flex-wrap items-center gap-2">
                {quoteChips.map((c) => (
                  <FilterChip key={c.label} active={c.on} label={c.label} tooltip={c.tip} onClick={() => c.set(!c.on)} />
                ))}
              </div>
            </div>
            <div>
              <MonoLabel className="mb-2 block">view</MonoLabel>
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>
        </MobileSheet>
      )}
      {/* THE BOARD'S HEAD IS ONE ROW, and the pack switches wrapping OFF rather
          than tolerating it: "nothing left in it is wide enough to need a second
          line". It used to wrap into two — a FILTER caption, six colour dots, a
          tag select and a favourites chip on one line, then the count, the view
          switch and Add on the next — which is two bands of chrome above the
          quotes somebody came to read.

          THE STRUCTURE IS THE PACK'S. A settings field and the category control
          sit OUTSIDE the scroller, so a setting cannot scroll out of sight while
          the chips do; the chip row is `flex: 1; min-width: 0` and takes all the
          overflow, because it is the only part that can afford to lose its right
          edge; the verbs are `flex: none` on the end.

          THE COUNT IS GONE FROM HERE. "3 quotes" is a property of the WORK, and
          the hero already states it beside how many are favourites, noted and
          tagged — this was the same fact twice on one screen, and the pack moves
          it to the hero for exactly that reason.

          THE CAPTION IS GONE TOO. Six coloured dots under the word FILTER did not
          need the word; the controls say what they are. The pack drops captions
          first when the row is tight, and this row is tight at 1180 by design. */}
      {/* ── THE PHONE'S ARRANGEMENT STRIP, and the hole it closes is not cosmetic.
          The whole board-head is desktop-only, and GroupSortField had exactly one
          call site inside it — so a reader on a phone could not group by chapter,
          could not change the sort column and could not flip the direction AT
          ALL. The values sat in localStorage at whatever a desktop session last
          left them, which for a phone-only reader means permanently at the
          defaults. Sorting and grouping were shipped and then reachable from one
          of the two viewports.

          THE PACK'S OWN BAND, between the hero and the stream: "a strip that
          states the count should not be as tall as a toolbar, so both controls
          lose their boxes and keep only their words". A hairline above and below,
          the arrangement underlined on the right, and the direction as a key —
          "direction is one bit, so it is one tap and never a sheet".

          IT STATES WHAT IS HIDDEN RATHER THAN WHAT EXISTS. The pack's strip
          carries "142 quotes", and the app's hero already says that beside how
          many are favourites, noted and tagged — the same fact twice on one
          screen, which is why the desktop head dropped it. What the hero cannot
          say is that a filter is currently hiding half the board, so that is what
          this says, and only while something is actually hidden. */}
      {mobile && (
        <div className="board-strip">
          {/* UNCONDITIONAL NOW, and the note above says why it was not. It read
              "the hero already says that beside how many are favourites, noted and
              tagged" — true until the header stopped saying it on a phone, which
              is the pack's own arrangement: the count belongs in this strip and
              the header belongs to the book. What is still conditional is the
              SHAPE: a plain count at rest, and how many of how many while a filter
              is hiding some, because that second fact has nowhere else to appear. */}
          <MonoLabel>
            {hidden > 0
              ? t('book.strip.shown.label', { n: displayRows.length, total })
              : countOf(displayRows.length, 'unit.quote')}
          </MonoLabel>
          <GroupSortField groupBy={groupBy} onGroup={setGroupBy} sort={sort} onSort={setSort} compact />
          <button
            type="button"
            className="board-strip-dir"
            aria-label={t(sort.dir === 'asc' ? 'book.sort.dir.asc.label' : 'book.sort.dir.desc.label')}
            onClick={() => setSort((cur) => ({ col: cur.col, dir: cur.dir === 'asc' ? 'desc' : 'asc' }))}
          >
            {sort.dir === 'asc' ? <IconSortAsc size={16} /> : <IconSortDesc size={16} />}
          </button>
        </div>
      )}
      {!mobile && (
        <div className="board-head">
          <div className="board-head-left">
            {/* HOW IT IS ARRANGED COMES FIRST, before what it is filtered to: the
                pack's left group is "what you are looking at and how it is
                grouped", and the grouping is the part that changes what the whole
                page looks like. Outside the scroller, because a setting that can
                scroll out of sight is a page arranged by something nothing on
                screen still says. */}
            <GroupSortField groupBy={groupBy} onGroup={setGroupBy} sort={sort} onSort={setSort} />
            <span className="board-head-rule" aria-hidden="true" />
            {/* A COLOUR IS A FILING DECISION WITH SIX VALUES, SO IT OPENS A LIST
                rather than sitting there as six toggles — which is what this
                comment has said since the row was drawn, over a control that was
                six toggles. Six dots side by side are six switches a reader has
                to try; one control that names the category it is filtering by
                answers "what am I looking at" without being pressed, and it is
                the only thing here that can, because the swatch has no word.

                A control rather than a chip, so it keeps its own place beside the
                grouping instead of scrolling away among the filters. */}
            <CategoryFilter value={color} onChange={setColor} />
            {tags.length > 0 && (
              <>
                <span className="board-head-rule" aria-hidden="true" />
                <Select
                  ariaLabel={t('common.filters.tag.aria')}
                  value={tag}
                  onChange={setTag}
                  options={[['', t('common.filters.tag.all.label')], ...tags.map((row) => [row.name, row.name])]}
                />
              </>
            )}
            {/* THREE CHIPS, NOT ONE, and every one of them announces its state.
                The pack draws four; its fourth is "unread", which means nothing
                for a quote, so three is the whole set here.

                FilterChip rather than a hand-rolled <button>: it sets
                aria-pressed, and its own comment says why — "a toggle that only
                announces its state in one of the two states is a toggle a screen
                reader reads as a plain button half the time". The one that was
                here was that button, and it carried its ♥ as a CHARACTER in the
                label, so the mark sized and coloured as text and was read out as
                a word.

                ON-CHIPS FIRST. A switched-on filter that has scrolled out of
                sight under the fade is a board quietly hiding rows for a reason
                nothing on screen still says. */}
            <Scroller axis="x" className="board-head-chips">
              {quoteChips
                .slice()
                .sort((a, b) => Number(b.on) - Number(a.on))
                .map((c) => (
                  <FilterChip key={c.label} active={c.on} label={c.label} tooltip={c.tip} onClick={() => c.set(!c.on)} />
                ))}
            </Scroller>
          </div>
          <div className="board-head-verbs">
            {/* Both form factors now open the ONE Add surface, on Capture with
                this book as the target — the shell's ＋ knows which page it is
                on. This is the desktop route to it; the phone's is the ＋ in the
                detail bar above. */}
            {/* THE ACCENT BELONGS TO THE ONE CONTROL THAT ADDS SOMETHING — the
                pack's own words about this row, in the comment on a view toggle
                it decided not to draw here at all. Add was a ghost button while
                the toggle beside it wore the accent gradient, so the row's
                loudest element was a lens. (The toggle's own accent is
                .tp-toggle-thumb, which every toggle in the app shares; moving
                View into the ⋯ is the pack's answer and is a separate change.) */}
            <StickerButton onClick={() => onAdd?.('quote', { type: 'book', id: bookId })}>{t('book.quotes.capture.label')}</StickerButton>
          </div>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {items && items.length === 0 && (
        <EmptyState>
          {t(filtering ? 'book.quotes.nomatch' : 'book.quotes.empty')}
        </EmptyState>
      )}
      {selection.open && (
        <SelectionBar
          selection={selection}
          rows={displayRows}
          onDone={afterBulk}
          tagSuggestions={Object.keys(tagMap)}
          onEdit={setEditingId}
        />
      )}
      {/* GROUPED, AND THE HEADINGS ARE THE SAME HEADINGS the shelf uses — a
          reader who has grouped a library by author and a book by chapter has met
          one control, not two. Each section holds the view the reader chose, so
          grouping is orthogonal to it: a control that worked in one view and
          silently did nothing in another would be worse than no control. */}
      {/* GROUPED, AND THE HEADINGS ARE THE SAME HEADINGS the shelf uses — a
          reader who has grouped a library by author and a book by chapter has met
          one control, not two. Each section holds the view the reader chose, so
          grouping is orthogonal to it: a control that worked in one view and
          silently did nothing in another would be worse than no control. */}
      {items && items.length > 0 && groups && (
        // Spaced from the constant rather than from a typed step: a section break
        // is two and a half rows, and the row is `--row` wherever it is measured.
        <div className="ann-groups" style={{ display: 'grid', gap: 'calc(var(--row) * 2.5)' }}>
          {groups.slice(0, groupWin.count).map((g) => (
            <section key={g.key}>
              <GroupHeading
                label={g.label}
                count={g.items.length}
                noun={t('unit.quote.one')}
                nounPlural={t('unit.quote.other')}
              />
              <AnnotationBoard {...board} rows={g.items.slice(0, ANNOTATION_PAGE)} clamp={clampLines} seed={boardSeed} />
            </section>
          ))}
          {groupWin.more && <div ref={groupWin.sentinel} aria-hidden="true" className="h-px" />}
        </div>
      )}
      {items && items.length > 0 && !groups && (
        <>
          <AnnotationBoard {...board} rows={shownRows} clamp={clampLines} seed={boardSeed} boardRef={boardRef} pinnedCount={pinnedShown} />
          {/* aria-hidden and empty: a scroll position, not content. See BookGrid.
              OUTSIDE the board, because the tiles view positions its children
              absolutely — a sentinel inside it would be placed as a card and never
              reach the bottom. */}
          {rowsWin.more && <div ref={rowsWin.sentinel} aria-hidden="true" className="h-px" />}
        </>
      )}

      {shareTarget && <ShareDialog share={sharePayload(shareTarget)} seen={{ kind: 'book', id: shareTarget.id }} onClose={() => setShareTarget(null)} />}
      {/* The quote's own delete, asked in the app's voice. It shows the WORDS
          rather than naming the row by number, because that is the only thing
          that tells you whether the row under your finger was the one you
          meant. */}
      <ConfirmDialog
        open={!!asking}
        title={t('book.quotes.delete.confirm')}
        body={<p className="microcopy line-clamp-3">“{asking?.quote || ''}”</p>}
        confirmLabel={t('common.action.delete.label')}
        onConfirm={() => remove(asking)}
        onCancel={() => setAsking(null)}
      />
    </div>
  )
}

// AnnotationForm serves both add (no initial) and inline edit (initial set).
// onSubmit receives the full field state and returns an error string or null.
// Exported for Home's favourite-tile inline edit (same form, same contract).
// bookId is what lets the locator boxes remember this book's own chapters and its
// cast. OPTIONAL, and absent is a working form: the search modal's inline editor and
// Home's favourite-tile edit render this without one, and they get the boxes with no
// dropdowns rather than no boxes — the fields are free text, and the list is a
// memory aid.
export function AnnotationForm({ initial, onSubmit, onCancel, submitLabel, tagSuggestions = [], stickers = [], reloadStickers, bookId = null }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [note, setNote] = useState(initial?.note || '')
  const [translation, setTranslation] = useState(initial?.translation || '')
  const [chapter, setChapter] = useState(initial?.chapter || '')
  // The chapter's NUMBER, kept as a string so the box can be empty. Number(...)||0
  // at submit is the same shape the work forms use for Series #, and 0 is how the
  // server spells "no number".
  const [chapterNo, setChapterNo] = useState(initial?.chapter_no ? String(initial.chapter_no) : '')
  const [location, setLocation] = useState(initial?.location || '')
  // 0047 gave a book highlight a `character` column, and the API has accepted one
  // ever since — but no form had a box for it, so the only ways to fill it were the
  // bulk field editor and an import. A novel has speakers; this is where you say so.
  const [character, setCharacter] = useState(initial?.character || '')
  const [color, setColor] = useState(initial?.color || 'yellow')
  const [tags, setTags] = useState(initial?.tags || [])
  const [stickerId, setStickerId] = useState(initial?.sticker_id ?? null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // What this book already knows: the chapters its own highlights name, and its
  // cast. Keyed on the book, so it is one fetch per book rather than one per
  // keystroke; with no bookId it answers empty and the boxes simply have no lists.
  const suggest = useWorkSuggestions(bookId ? { kind: 'book', id: bookId } : null)
  const listId = `ann-${bookId || 0}`

  // The must-fill rule, stated once: the guard below and the greyed-out button
  // read the same value, so the button is never pressable in a state the
  // handler would refuse.
  const missing = !quote.trim() && !note.trim() ? t('error.validate.quote-or-note') : ''
  // Joins the dialog's header ✓ when there is one, and tells it why it cannot
  // save yet. Null when this form is rendered inline.
  const host = useFormHost(busy ? t('common.action.save.busy') : missing)

  async function submit(e) {
    e.preventDefault()
    if (missing) return setError(missing.toLowerCase())
    setBusy(true)
    setError('')
    const err = await onSubmit({
      quote: quote.trim(),
      note: note.trim(),
      translation: translation.trim(),
      chapter: chapter.trim(),
      chapter_no: Number(chapterNo.trim()) || 0,
      location: location.trim(),
      // EDITED HERE NOW, and the line that used to carry it through is gone. It was
      // still below this one for one release: two `character` keys in one object
      // literal, so the later carry-through won and the box above wrote nothing.
      // Vite says "Duplicate key" and the build goes on, which is exactly how a
      // control ships inert.
      character: character.trim(),
      color,
      tags,
      // favorite is edited on the card, not in the form — but PUT is
      // full-state, so carry the existing value through.
      favorite: !!initial?.favorite,
      // sticker: id is chosen here; position is dragged on the card, so carry
      // the existing coords through unchanged (full-state PUT).
      sticker_id: stickerId,
      sticker_x: initial?.sticker_x ?? null,
      sticker_y: initial?.sticker_y ?? null,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setQuote('')
      setNote('')
      setTranslation('')
      setChapter('')
      setLocation('')
      setCharacter('')
      setColor('yellow')
      setTags([])
      setStickerId(null)
    }
  }

  return (
    <form id={host?.formId} onSubmit={submit} className="ann-form space-y-3">
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.quote.label')}</MonoLabel>
        <textarea className="tp-input" rows="3" value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      {/* A TEXTAREA AND NOT A ONE-LINE BOX, like the quote it translates and unlike
          every locator below it: a translated passage is a passage, and the server
          caps neither. */}
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.translation.label')}</MonoLabel>
        <textarea className="tp-input" rows="2" placeholder={t('common.field.translation.placeholder')}
                  value={translation} onChange={(e) => setTranslation(e.target.value)} />
      </label>
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.note.label')}</MonoLabel>
        <textarea className="tp-input" rows="2" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {/* Number, then name, then where on the page — the order somebody reads a
          chapter in. Both chapter fields are optional and independent: a numbered
          book fills the first, an essay collection the second. The number box takes
          a decimal, because 12.5 is where an interlude goes. */}
      {/* BOTH CHAPTER BOXES REMEMBER THIS BOOK, commonest chapter first. Choosing a
          NAME fills an empty number box with the number typed beside it last time;
          it never overwrites a number already there, because a suggestion that
          edits what you have just typed is the form arguing with you. The reverse
          direction is deliberately absent — filling a name from a number would be
          guessing what somebody meant by "42". */}
      <div className="cl-grid">
        <Field label={t('common.field.chapter-no.label')} inputMode="decimal" placeholder={t('book.quote.form.chapter-no.placeholder')} value={chapterNo}
               list={suggest.chapterNumbers.length ? `${listId}-chno` : undefined}
               onChange={(e) => setChapterNo(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} />
        <Field
          label={t('common.field.chapter-name.label')}
          value={chapter}
          list={suggest.chapterNames.length ? `${listId}-chname` : undefined}
          onChange={(e) => {
            const name = e.target.value
            const no = suggest.chapterNoFor(name)
            setChapter(name)
            if (no && !String(chapterNo).trim()) setChapterNo(String(no))
          }}
        />
        <Datalist id={`${listId}-chno`} options={suggest.chapterNumbers} />
        <Datalist id={`${listId}-chname`} options={suggest.chapterNames} />
      </div>
      <div className="cl-grid">
        <Field label={t('common.field.location.label')} placeholder={t('book.quote.form.location.placeholder')} value={location} onChange={(e) => setLocation(e.target.value)} />
        {/* Who said it, from the book's own cast — rows with a character and nobody
            beside them, which is what a book's cast list is (0048). Free text, so a
            speaker the list has never heard of is typed straight in. */}
        <CastCombo
          label={t('common.field.character.label')}
          placeholder={t('book.quote.form.character.placeholder')}
          value={character}
          onChange={setCharacter}
          cast={suggest.cast}
        />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.tags.label')}</MonoLabel>
        <TokenInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder={t('common.field.tags.placeholder')} ariaLabel={t('common.field.tags.label')} />
      </label>
      <div className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.sticker.label')}</MonoLabel>
        <StickerPicker value={stickerId} onChange={setStickerId} stickers={stickers} reload={reloadStickers} />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <MonoLabel>{t('common.mono.colour.label')}</MonoLabel>
        <ColorSwatches value={color} onChange={setColor} />
        {/* Hosted in a dialog, yes and no live together in its header — see
            FormHostContext. Inline (the search modal's editor, the capture
            surface) there is no header, so the footer stays. */}
        {!host && (
          <div className="ml-auto flex gap-2">
            {onCancel && (
              <GhostButton type="button" onClick={onCancel}>
                {t('common.action.cancel.label')}
              </GhostButton>
            )}
            <button className={PRIMARY} disabled={busy || !!missing} title={missing || undefined}>
              {submitLabel}
            </button>
          </div>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
