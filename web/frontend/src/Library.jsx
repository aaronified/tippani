import { useEffect, useMemo, useRef, useState } from 'react'
import { coverImgURL, json, errText, downloadPost } from './api.js'
import { chapterLabel, chapterPatch } from './text.js'
import { locatorMeta } from './attribution.js'
import { usePersonOpener } from './personOpen.jsx'
import { CastCombo, LanguageCombo, OfferChip, SuggestCombo, useWorkSuggestions } from './suggest.jsx'
import { CoverControls, BookLookupPicker } from './CoverPicker.jsx'
import { FlowQuote } from './flow.jsx'
import { StickerImg, StickerPicker, useStickers } from './stickers.jsx'
import { ShareDialog, bookShare } from './share.jsx'
import { deleteWithUndo } from './undo.jsx'
import { ActionRow, actionsFor } from './actions.jsx'
import { QuoteContext, contextKind, useInContext } from './sources.jsx'
import { PeopleChips, SpeakerChips, chipRows, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { useTextOrder } from './textOrderHost.jsx'
import { BoardHead } from './boardHead.jsx'
import { annDate, sortAnnotations } from './boardOrder.js'
import {
  WorkCard,
  WorkListScaffold,
  countQuotes,
  minusQuote,
  patchMovesTheRow,
  pinInProgress,
  useBoardWindow,
  ANNOTATION_PAGE,
} from './works.jsx'
import WorkDetail from './WorkDetail.jsx'
import { QUOTE_TEXT } from './fonts.js'
import { t } from './i18n.js'
import { BookDuplicateConfirm } from './bookDuplicate.jsx'
import { ProseArea } from './proseField.jsx'
import {
  fmtDate,
  ColorSwatches,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  ExpandableText,
  Field,
  FormModal,
  GhostButton,
  HandCard,
  HandNote,
  MonoLabel,
  parseYearInput,
  YearField,
  yearInputValue,
  QuizSkipMark,
  TagChip,
  titleCaseGenre,
  TokenInput,
  TranslationLine,
  useCardMenu,
  useCoverSize,
  useFormHost,
  useIsMobileScreen,
  usePersistedState,
  PanelHost,
  usePanelStack,
} from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary' // aesthetic-aware primary (§6)
const QUOTE_STYLE = { ...QUOTE_TEXT, fontSize: 'var(--type-display-17)' }

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
    // 0073, and here for the reason every field above it is: the server's UPDATE
    // writes `text_order` unconditionally, so a ♥ that does not name it clears
    // the reader's choice about which text leads on this book. This list's own
    // test (full-state-put.test.js) named it before the control existed, which is
    // the first time that file has caught a column on the way IN rather than
    // after a reader lost something.
    text_order: b.text_order || '',
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
function BookGrid({ books, coverSize, onOpen, authorMap = {}, seps, leadingTile, onChanged, onEdit }) {
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
          <WorkCard kind="book" item={b} index={i} onOpen={onOpen} people={authorMap} seps={seps} onChanged={onChanged} onEdit={onEdit} />
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
  const [fav, setFav] = useState(false)
  const [sort, setSort] = useState('recent')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [coverSize] = useCoverSize('tippani:size:books', 165) // set from Settings
  const mobile = useIsMobileScreen()
  const authors = usePeople('author') // name→metadata, for author-group portraits
  // THE PERSON'S OWN SCREEN, REACHABLE FROM HERE AT LAST. A shelf's author credits
  // was handed `setPerson` straight, so it opened the older panel whatever the
  // person's record held — this screen had no panel host at all, which is why the
  // pack's person screen looked absent rather than unreachable. See
  // personOpen.jsx: the id decides which of the two surfaces answers.
  const personStack = usePanelStack()
  const openPerson = usePersonOpener(personStack)


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

  const shown = useMemo(() => {
    const list = fav ? (books || []).filter((b) => b.favorite) : [...(books || [])]
    // Default view = server order (created_at DESC) with what you're reading
    // floated to the top; an explicit sort takes over completely.
    if (sort === 'recent') return pinInProgress(list, 'book')
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [books, fav, sort])

  // Edit one book from the bar, when exactly one is picked (1.12.0). The id
  // rather than the row: what this board holds is a LIST row, and the list
  // endpoint does not carry the description or the genres. Handing that to a
  // full-state form would save blanks over the two fields it never had.
  const [editWork, setEditWork] = useState(null)
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])
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
      fav={fav}
      setFav={setFav}
      sort={sort}
      setSort={setSort}
      sortOptions={[
        ['recent', t('library.sort.recent.label')],
        ['title', t('library.sort.title.label')],
      ]}
      onReset={() => { setFav(false); setSort('recent') }}
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
          <PanelHost stack={personStack} />
          {editWork != null && (
            <EditWorkModal
              kind="books"
              id={editWork}
              title={t('book.form.edit.title')}
              onDone={() => {
                setEditWork(null)
                load()
              }}
              onCancel={() => setEditWork(null)}
            />
          )}
        </>
      }
    >
      <BookGrid
        books={shown}
        coverSize={coverSize}
        onOpen={onOpen}
        authorMap={authors.map}
        seps={creditSeps}
        onChanged={load}
        onEdit={setEditWork}
      />
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
  // A same-title book the server held for a decision: the look-alikes, until the reader chooses.
  const [held, setHeld] = useState(null)

  async function submit(e, confirmNew = false) {
    e?.preventDefault?.()
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
      check_duplicates: true,
      confirm_new: confirmNew || undefined,
      title: title.trim(),
      author: author.trim() || undefined,
      isbn: isbn.trim() || undefined,
      published_year: publishedYear,
      published_circa: publishedCirca,
    })
    onBusy?.(false)
    if (r.ok) return onAdded(r.data) // hand back the created book (capture targets it)
    if (r.status === 409 && r.data?.needs_confirm) return setHeld(r.data.existing || [])
    setError(errText(r, t('error.add.book')))
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-3">
      <Field label={t('common.field.title.label')} nameCase value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
      <Field label={t('common.field.author.label')} nameCase value={author} onChange={(e) => setAuthor(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <YearField
          label={t('common.field.year.label')}
          value={year}
          onChange={setYear}
          circaLabel={t('common.field.year.circa.label')}
        />
        <Field label={t('common.field.isbn.label')} value={isbn} onChange={(e) => setIsbn(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      {held && (
        <BookDuplicateConfirm
          title={title.trim()}
          existing={held}
          onAddSeparate={() => { setHeld(null); submit(null, true) }}
          onCancel={() => setHeld(null)}
        />
      )}
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
      renderBoard={({ item, seps, creditMaps, onStats, onAdd, dataNonce, openCharacter }) => (
        <Annotations
          bookId={item.id}
          book={item}
          authorMap={creditMaps[0]}
          seps={seps}
          onStats={onStats}
          onOpenCharacter={openCharacter}
          onAdd={onAdd}
          dataNonce={dataNonce}
        />
      )}
    />
  )
}


// EditWorkModal — the work's own edit form, opened from a card's ⋯ menu when
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
  const [year, setYear] = useState(yearInputValue(book.published_year, book.published_circa))
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
  const [coverSource, setCoverSource] = useState('') // the supplier a picked cover is credited to
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
  // WHAT A MATCH PUT IN EACH BOX, and whose it was: at the save, a box still
  // holding exactly that value is credited to the supplier; a box the reader
  // retyped is theirs.
  const taken = useRef({})
  function applyCandidate(c, overwrite = false) {
    const has = (x) => x != null && String(x).trim() !== ''
    const take = overwrite ? (v, next) => (has(next) ? next : v) : keep
    const from = (f) => c.sources?.[f] || c.source
    taken.current = {
      title: [from('title'), c.title], author: [from('author'), c.author], isbn: [from('isbn'), c.isbn13],
      published_year: [from('published_year'), c.published_year ? String(c.published_year) : ''],
      description: [from('description'), c.description], series: [from('series'), c.series],
      series_index: [from('series_index'), c.series_index ? String(c.series_index) : ''],
      genres: [from('genres'), (c.genres || []).join('\n')],
    }
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
      setCoverSource(c.sources?.cover || c.source || '')
      setClearCover(false)
    }
  }

  // §7: "Fetch metadata" no longer silently applies a guess — it opens the
  // edition picker (below) so you pick the right match, folding in what used to
  // be a separate "Browse other matches" button.
  const [pickerOpen, setPickerOpen] = useState(false)

  function matchSources() {
    const now = {
      title: title.trim(), author: author.trim(), isbn: isbn.trim(), published_year: year.trim(),
      description: description.trim(), series: series.trim(), series_index: String(seriesIndex || ''),
      genres: genres.join('\n'),
    }
    const out = {}
    for (const [f, [src, value]] of Object.entries(taken.current)) {
      if (src && value && String(value).trim() === now[f]) out[f] = src
    }
    if (coverUrl && coverSource) out.cover = coverSource
    return out
  }

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
      sources: matchSources(),
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
        onSetUrl={(u, src) => {
          setCoverUrl(u)
          setCoverSource(src || '')
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
        <YearField
          label={t('common.field.year.label')}
          value={year}
          onChange={setYear}
          circaLabel={t('common.field.year.circa.label')}
        />
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
    // by the request — and the ♥ on a card and the colour dots all save through it. `character` (0047) was missing from here for four
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

// RE-EXPORTED RATHER THAN MOVED AT EVERY CALL SITE. `fmtDate` lives in ui.jsx and
// `annDate` and `sortAnnotations` in boardOrder.js, beside the
// film board that is now their second caller. Home, Quotes, Search and four test
// files import them from this file and there is no reason for a fold to touch
// their import lists: one definition is the point, not one path to it.
export { fmtDate }
export { annDate, sortAnnotations } from './boardOrder.js'
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
  rows, tagMap, stickerMap, stickers, reloadStickers, editingId, setEditingId,
  save, patch, remove, onShare, onOpenCharacter,
}) {
  const card = (a, i) => (
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
      onShare={onShare}
      quoteLines={5}
      tagSuggestions={Object.keys(tagMap)}
      onOpenCharacter={onOpenCharacter}
    />
  )
  return <div className="space-y-4">{rows.map((a, i) => card(a, i))}</div>
}

// quoteTexts / quoteBody / showsTranslationLine LIVE IN text.js and are
// re-exported here, because this is where a reader looks for them and four test
// files import them from this module. They moved for the reason the person
// primitives moved into credits.jsx: the film frame asks the same question and a
// card importing another SCREEN to answer it is a cycle.
export { quoteBody, quoteTexts, showsTranslationLine } from './text.js'
// AND IMPORTED, because a re-export is not a local binding: `export … from` makes
// the name available to importers and leaves this module without it. Both names
// are read in this file — the card asks quoteTexts and the table's two-line cell
// asks quoteBody — and both threw at render with only the re-export. The build was
// happy either way; `no-free-names.test.js` exists for exactly this and named the
// second one after the DOM test caught the first.
import { quoteBody, quoteTexts } from './text.js'

// ActionRow MOVED TO actions.jsx, where the registry it renders already lives.
// Movies' Frame kept a second copy of this row and a comment promising it matched
// this one exactly; it did, and the two class lists did not. See the note there —
// the `pt-1.5` this screen has always worn is passed in rather than deleted, so
// the deduplication changes no pixels.

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
export function AnnotationCard({ a, variant, tagMap, stickerMap = {}, stickers = [], reloadStickers, editing, setEditingId, save, patch, remove, onShare, quoteLines = 6, tagSuggestions = [], actionsAlwaysVisible = false, editInline = false, expanded, onToggleExpand, meta, form: Form = AnnotationForm, selectKind = 'annotation', textOrder = null, onOpenCharacter, people = {}, onOpenPerson = null, seps }) {
  const sticker = a.sticker_id != null ? stickerMap[a.sticker_id] : null
  // PROVIDED, NOT THREADED — see textOrderHost.jsx. The board's own text menu
  // reached a card by being handed down two components that did nothing but pass
  // it on, and a capability threaded that way goes missing wherever one of them
  // forgets a prop. The menu is gone; the reason it went that way is not.
  // ONE OF FOUR STATES, resolved from the reader's settings and this row's own
  // two facts. `canRead` was a predicate a caller could hand in; a test that wants
  // a particular state passes the state now, which is one indirection fewer
  // between what a case says and what it asserts.
  //
  // THE HOOK RUNS UNCONDITIONALLY and the prop is preferred afterwards. Written as
  // `textOrder || useTextOrder(...)` this skips the hook whenever a prop is given,
  // which changes the hook order between renders of the same component — the one
  // thing React's rules forbid outright, and it would have broken on the first
  // card that was handed an explicit state after being rendered without one.
  const resolved = useTextOrder({ language: a?.language })
  const order = textOrder || resolved
  // AND WHICH FACE EACH OF THE TWO IS SET IN. A Bengali quote drawn in a Latin
  // text face is the app choosing a fallback the reader can see, on the one screen
  // whose entire subject is somebody's own words — and the faces have been in
  // Settings since the type dials shipped, with nothing but the wordmark wearing
  // them. `quoteTexts` says which slot holds the QUOTE, so it says which slot the
  // language applies to; under "translations first" that is the second line.
  const { body, second, bodyScript, secondScript } = quoteTexts(a, order)
  // Accordion mode (tiles board): the parent owns which quote is open, so one
  // expands at a time. Elsewhere (list, search modal) each card keeps its own.
  const accordion = typeof onToggleExpand === 'function'
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
          // ONE LOCATOR, AND NO CAPTURE DATE. The owner, from their phone: "the
          // book annotations in the book details view do not need to show page
          // number if chapter details are available", and "date of capture is not
          // needed on any card." The chapter/page rule lives in `locatorMeta`
          // because four screens wrote it four times and no two agreed — see the
          // note there. The date simply goes: it is a fact about the reader's
          // filing rather than about the words, it is on the table view's own
          // sortable Date column for anyone who wants it, and the share dialog
          // has defaulted it off since it had toggles at all.
          locatorMeta(a),
        ].filter(Boolean).join(' · ')
      : meta
  // THE QUOTE IN ITS FILE. A highlight is a book's and a standalone quote is not, and
  // this card draws both (`selectKind` says which), so the kind decides which list to ask.
  const inContext = useInContext(contextKind(selectKind), a.book_id, a.id)
  const editForm = (
    <Form initial={a} onSubmit={(fields) => save(a.id, fields)} onCancel={() => setEditingId(null)} submitLabel={t('common.action.save.label')} tagSuggestions={tagSuggestions} stickers={stickers} reloadStickers={reloadStickers} bookId={a.book_id ?? null} />
  )
  // Right-click, long-press or Shift+F10 anywhere on the card opens the SAME list
  // the row and the ⋯ render (actions.jsx), so the gesture can never offer
  // something the buttons do not — which is the whole reason the registry exists.
  const acts = actionsFor('annotation', a, {
    share: onShare,
    edit: (row) => setEditingId(row.id),
    // The same patch the card's own ♥ runs, so the two cannot disagree about
    // what favouriting is. `favourited` only decides the wording.
    favourite: (row) => patch(row, { favorite: !row.favorite }),
    favourited: !!a.favorite,
    // Absent unless this quote has stored context: nothing to show is nothing to offer.
    inContext: inContext.open,
    remove,
  })
  const { cardProps, menuClass, menu } = useCardMenu(acts.map((x) => ({ ...x, onClick: x.run })))
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
      className={`px-5 py-4 ${menuClass}`}
      {...cardProps}
    >
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
                className={bodyScript}
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
                className={bodyScript}
                lines={quoteLines}
                style={QUOTE_STYLE}
                open={accordion ? !!expanded : undefined}
                onToggle={accordion ? onToggleExpand : undefined}
              />
            ))}
          {/* THE OTHER HALF OF THE BODY, directly under the words and above every
              line that describes them. The owner's card shape: "quote,
              translation: these will form the card body. both separately
              expandable" — and then the chip, the attribution, the note, the tags,
              the actions, in that order, "adhered for all annotation cards across
              the app."
              It was drawn below the attribution, which put half the card's own text
              underneath a line of metadata about the other half: a bilingual card
              read the words, then who said them, then where, and only then what the
              words mean. WHICH OF THE TWO LEADS is `quoteTexts`' answer, not this
              site's — the reader's dial and the row's own language decide it, and a
              work's or board's rule will override both (task 83). */}
          {second && <TranslationLine className={secondScript}>{second}</TranslationLine>}
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
          <ActionRow acts={acts} item={a} kind="book" color={color} onColor={pickColor} onFavourite={(v) => patch(a, { favorite: v })} actionsAlwaysVisible={actionsAlwaysVisible} className="pt-1.5" />
        </div>
      {menu}
      {inContext.node}
    </HandCard>
  )
}

// The columns are the kind table's; the getter is what keeps a label out of
// module-load time, so it resolves in whichever language is applied when the
// header is drawn rather than the one that happened to load first.
// Annotations is the per-book quote list: the sort bar and hand-drawn cards.
// pinToTop floats just-added annotations to the front of the order the list is in,
// preserving pinnedIds' order (most-recent add first). Ids that are not present
// are skipped. Returns the input unchanged when there is nothing to pin.
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

function Annotations({ bookId, book, authorMap = {}, seps, onStats, onAdd, dataNonce, onOpenCharacter }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([]) // tag objects: {id, name, color, style, …}
  const [shareTarget, setShareTarget] = useState(null) // annotation being shared
  const [fav, setFav] = useState(false)
  const [editingId, setEditingId] = useState(null)
  // The same unfiltered set, counted four ways for the hero (see countQuotes).
  // Kept beside `total` rather than replacing it: this toolbar's label pairs the
  // unfiltered total with the number SHOWN, which is a fact about the filter, and
  // the hero's line is a fact about the book. Two labels, two jobs, one fetch.
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  // ONE ORDER FOR EVERY VIEW. This was `table only`, and the two card views —
  // which is where a reader actually reads — had no order to choose at all and no
  // way to group. A board of three hundred highlights in the order they happened
  // to be saved is a board you scroll rather than read.
  const [sort, setSort] = usePersistedState('tippani:annsort', { col: 'default', dir: 'asc' })
  // 0 is Auto — the measured answer — and not "no columns". See columnActions.
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
  const filtering = fav
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
  // The chosen order, in every view — see sortAnnotations, which is where the
  // dimensions and their tie-breaks live.
  const sortedRows = useMemo(() => sortAnnotations(items || [], sort), [items, sort])
  // What every view actually renders: the current order (server-recent for
  // list/tiles, the chosen column for table) with freshly-added items pinned on
  // top. sortedRows already returns a server-order copy of items for non-table
  // views, so this is the single source of truth for all three.
  const displayRows = useMemo(() => pinToTop(sortedRows, pinned), [sortedRows, pinned])

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


  async function loadTags() {
    const r = await json('GET', '/tags')
    if (r.ok) setTags(r.data.tags)
  }
  async function load() {
    // Sequence guard: rapid filter toggling fires overlapping requests, so only
    // the newest response is allowed to render (a slow earlier one is dropped).
    const seq = ++reqSeq.current
    const params = new URLSearchParams({ book_id: bookId })
    if (fav) params.set('favorite', '1')
    const r = await json('GET', `/annotations?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) {
      setItems(r.data.annotations)
      if (!fav) {
        setStats(countQuotes(r.data.annotations))
      }
    } else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [bookId, fav])
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
      // The hero's counts go down with it, subtracting what THIS row contributed
      // rather than only the total — see minusQuote. Without it the hero sits one
      // ahead of the toolbar for as long as a filter is on.
      setStats((s) => minusQuote(s, a))
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
    if (patchMovesTheRow(fields, { fav })) load()
    else setItems((cur) => (cur || []).map((x) => (x.id === a.id ? { ...x, ...r.data } : x)))
    return true
  }

  // Build the normalised share payload from the chosen annotation + its book.
  const sharePayload = (a) =>
    bookShare({
      quote: a.quote,
      note: a.note,
      translation: a.translation,
      language: a.language,
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



  const board = {
    onOpenCharacter,
    tagMap,
    stickerMap,
    stickers,
    reloadStickers,
    editingId,
    setEditingId,
    save,
    patch,
    remove: setAsking,
    onShare: setShareTarget,
  }

  return (
    <div className="space-y-4">
      <BoardHead
        sort={sort}
        onSort={setSort}
        sortOptions={[['default', t('board.sort.default.label')], ['date', t('board.sort.date.label')]]}
        fav={fav}
        onFav={setFav}
        captureLabel={t('book.quotes.capture.label')}
        onCapture={() => onAdd?.('quote', { type: 'book', id: bookId })}
      />
      <ErrorText>{error}</ErrorText>

      {items && items.length === 0 && (
        <EmptyState>
          {t(filtering ? 'book.quotes.nomatch' : 'book.quotes.empty')}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <>
          <AnnotationBoard {...board} rows={shownRows} />
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
  // 0071 PUT `language` ON THIS TABLE AND THIS FORM NEVER GREW A BOX FOR IT — so
  // on a full-state PUT every edit of a highlight cleared it. A Bengali couplet
  // quoted inside an English novel is in Bengali while the book is in English,
  // which is the whole reason the column is on the LINE, and it is what decides
  // whether the translation below leads. `edit-parity.test.js` walks the add
  // surface's field table against this form's payload now.
  const [language, setLanguage] = useState(initial?.language || '')
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

  // The pairing and its offer, in the shape the add surface uses — one slot, since
  // the two boxes are one pairing and only one of them can be the counterpart at a
  // time. `offer.field` says which box the chip belongs under, so it can never
  // appear beside the box that caused it.
  const [offer, setOffer] = useState(null)
  const pairChapter = (which, typed) => {
    const { patch, offer: next } = chapterPatch(which, typed, which === 'name' ? chapterNo : chapter, suggest.chapters)
    if (patch.chapter !== undefined) setChapter(patch.chapter)
    if (patch.chapter_no !== undefined) setChapterNo(patch.chapter_no)
    setOffer(next)
  }

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
      language: language.trim(),
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
        {/* Spell-checked while it is being edited, in the language this form
            already carries — see proseField.jsx. */}
        <ProseArea language={language} className="tp-input" rows="3" value={quote} onChange={(e) => setQuote(e.target.value)} />
      </label>
      {/* The lines around this highlight in its book's file, under the words they surround. */}
      <QuoteContext kind="annotation" id={initial?.id} subject="book" workId={initial?.book_id ?? bookId} />
      {/* WHAT THE LINE IS IN, immediately above the translation because it is the
          fact that RANKS the two texts: without it the app cannot decide which of
          them leads. A name, so it takes the capital hint. */}
      <LanguageCombo
        label={t('common.field.language.label')}
        placeholder={t('common.field.language.placeholder')}
        value={language}
        onChange={setLanguage}
      />

      {/* A TEXTAREA AND NOT A ONE-LINE BOX, like the quote it translates and unlike
          every locator below it: a translated passage is a passage, and the server
          caps neither. */}
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.translation.label')}</MonoLabel>
        <ProseArea language={language} className="tp-input" rows="2" placeholder={t('common.field.translation.placeholder')}
                  value={translation} onChange={(e) => setTranslation(e.target.value)} />
      </label>

      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.note.label')}</MonoLabel>
        <ProseArea language={language} className="tp-input" rows="2" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {/* Number, then name, then where on the page — the order somebody reads a
          chapter in. Both chapter fields are optional and independent: a numbered
          book fills the first, an essay collection the second. The number box takes
          a decimal, because 12.5 is where an interlude goes. */}
      {/* BOTH CHAPTER BOXES REMEMBER THIS BOOK, commonest chapter first, and the
          fill runs BOTH WAYS — the owner's correction: "chapter number auto
          populates from chapter name now, but not vice versa. chapter name from
          number is more useful."
          They are right about which box a reader reaches for first: you are
          holding the book open at chapter 42, so the number is on the page in
          front of you and the name is the thing you would have to flip back to
          find.

          COMBOBOXES, NOT A NATIVE DATALIST, and only since the owner asked for it:
          "tag, character, chapter name, and number will be comboboxes based on the
          available items." A datalist opens only after a keystroke in desktop
          Chrome, so a reader who had typed nothing saw nothing — fatal for a list
          you open the box in order to be REMINDED of. Same control the add surface
          draws, which is the point: this form and that one now differ in nothing.

          AND THE PAIRING RUNS ON COMMIT. The owner found it mid-word: "if i am at
          chapter 15, the chapter name is assigned at typing 1 and then no
          rewrites." A rule that reads the box on every keystroke answers about a
          number nobody has finished typing. Where the pool disagrees with what is
          already in the other box, nothing is written and a chip offers — see
          `chapterPatch` in text.js, the one function this form and the add surface
          both call. */}
      <div className="cl-grid">
        <div className="flex flex-col gap-1.5">
          <SuggestCombo
            label={t('common.field.chapter-no.label')}
            placeholder={t('book.quote.form.chapter-no.placeholder')}
            value={chapterNo}
            options={suggest.chapterNumbers.map((n) => ({ name: String(n) }))}
            nameCase={false}
            inputMode="decimal"
            onChange={(v) => { setOffer(null); setChapterNo(String(v).replace(/[^\d.]/g, '').slice(0, 7)) }}
            onCommit={(v) => pairChapter('no', String(v).replace(/[^\d.]/g, '').slice(0, 7))}
          />
          {offer?.field === 'chapter' && (
            <OfferChip
              label={t('common.field.chapter-name.offer', { name: offer.value })}
              onAccept={() => { setChapter(offer.value); setOffer(null) }}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <SuggestCombo
            label={t('common.field.chapter-name.label')}
            value={chapter}
            options={suggest.chapterNames.map((n) => ({ name: n }))}
            onChange={(v) => { setOffer(null); setChapter(v) }}
            onCommit={(v) => pairChapter('name', v)}
          />
          {offer?.field === 'chapter_no' && (
            <OfferChip
              label={t('common.field.chapter-no.offer', { no: offer.value })}
              onAccept={() => { setChapterNo(offer.value); setOffer(null) }}
            />
          )}
        </div>
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
