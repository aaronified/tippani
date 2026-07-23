import { useEffect, useMemo, useState } from 'react'
import { coverImgURL, json, errText } from './api.js'
import { AnnotationCard, annotationState, annDate, fmtDate } from './Library.jsx'
import { Frame, dialogueState } from './Movies.jsx'
import { ShareDialog, bookShare, movieShare } from './share.jsx'
import { CreditFaces, PersonCredit, PersonModal, PersonPortrait, parseCreditSeps, splitCredits, usePeople } from './people.jsx'
import { groupWorks } from './works.jsx'
import { useStickers } from './stickers.jsx'
import {
  BulkBar,
  EmptyState,
  ErrorText,
  filterChipClass,
  GhostButton,
  HandCard,
  HandNote,
  HighlightSpan,
  Masonry,
  MonoLabel,
  Placeholder,
  Select,
  SortableTh,
  splitCommas,
  useColumnsAt,
  useIsMobileScreen,
  usePersistedState,
  useSort,
  ViewToggle,
} from './ui.jsx'

const SCOPES = [
  ['all', 'All'],
  ['books', 'Books'],
  ['annotations', 'Annotations'],
  ['movies', 'Movies'],
  ['dialogues', 'Dialogues'],
]

// SearchPage (§8.9, § sectioned search): one big Newsreader box + scope chips.
// Results come back from the server faceted by WHAT matched and render as one
// section per facet (only the non-empty ones): Books · Movies · Authors ·
// Directors · Actors · Annotations · Dialogues · Notes · Tags · Genres — plus
// "Added on …" for a date query (the Stats calendar links here) and "Decade"
// for a "1990s" query. Work hits are grouped cards headed by the cover /
// poster; quote hits sit under their parent work. 200 ms debounce with a
// stale-guard; GET /search?q=&scope=.
export default function SearchPage({ onOpenBook, onOpenMovie, creditSeparators }) {
  // Persisted so leaving Search (into a book/film, another tab) and coming back
  // restores the last query, scope, and view instead of resetting to empty.
  const [q, setQ] = usePersistedState('tippani:search:q', '')
  const [scope, setScope] = usePersistedState('tippani:search:scope', 'all')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:searchview', 'tiles') // tiles | list | table
  const [group, setGroup] = usePersistedState('tippani:search:group', 'none') // none|series|author|decade|genre (tiles/list)
  const [nonce, setNonce] = useState(0) // bump to re-run the search after a bulk action
  const reload = () => setNonce((n) => n + 1)
  const [quote, setQuote] = useState(null) // { kind, hit } — a single quote opened from a result
  const authors = usePeople('author') // name→metadata for author portraits/chips
  const directors = usePeople('director') // name→metadata for director/creator chips
  const actors = usePeople('actor') // name→metadata for actor chips on dialogue hits
  const [person, setPerson] = useState(null) // { kind, name } open in the metadata panel
  const mobile = useIsMobileScreen()
  const creditSeps = useMemo(() => parseCreditSeps(creditSeparators), [creditSeparators])

  useEffect(() => {
    const query = q.trim()
    if (!query) {
      setResults(null)
      setError('')
      return
    }
    let stale = false
    const t = setTimeout(async () => {
      const r = await json('GET', `/search?${new URLSearchParams({ q: query, scope })}`)
      if (stale) return
      if (r.ok) {
        setResults(r.data)
        setError('')
      } else {
        setError(errText(r, 'search failed'))
      }
    }, 200)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [q, scope, nonce])

  // Highlight the words the results actually came from: the server-corrected
  // query on a fuzzy (zero-hit) pass, else the raw input (PLAN §4).
  const terms = queryTerms(results?.corrected || q)
  // One group list per facet section. groupBooks/groupMovies fold quote hits
  // under their parent work; the work-only facets pass empty child lists.
  const r = results || {}
  const bookGroups = results ? groupBooks({ books: r.books, annotations: [] }) : []
  const movieGroups = results ? groupMovies({ movies: r.movies, dialogues: [] }) : []
  const annGroups = results ? groupBooks({ books: [], annotations: r.annotations }) : []
  const dlgGroups = results ? groupMovies({ movies: [], dialogues: r.dialogues }) : []
  const noteAnnGroups = results ? groupBooks({ books: [], annotations: r.notes?.annotations || [] }) : []
  const noteDlgGroups = results ? groupMovies({ movies: [], dialogues: r.notes?.dialogues || [] }) : []
  const total = results
    ? [r.books, r.annotations, r.movies, r.dialogues, r.authors, r.directors, r.actors,
       r.notes?.annotations, r.notes?.dialogues, r.tags, r.genres]
        .reduce((n, a) => n + (a?.length || 0), 0) +
      (r.decade ? 1 : 0) + (r.date_added ? 1 : 0)
    : 0
  const empty = results && total === 0

  // The two card renderers every section shares (a group in, a keyed card out).
  const renderBook = (g) => (
    <WorkResult key={`b${g.id}`} kind="book" g={g} view={view} terms={terms} onOpen={onOpenBook} onOpenQuote={setQuote} onOpenPerson={setPerson} people={authors.map} creditSeps={creditSeps} />
  )
  const renderMovie = (g) => (
    <WorkResult key={`m${g.id}`} kind="movie" g={g} view={view} terms={terms} onOpen={onOpenMovie} onOpenQuote={setQuote} onOpenPerson={setPerson} people={directors.map} actorMap={actors.map} creditSeps={creditSeps} />
  )

  return (
    <section className="space-y-5">
      {mobile && (
        <div className="mobile-sticky-bar">
          <input
            className="tp-input"
            style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1, padding: '10px 14px', width: '100%' }}
            placeholder="Search titles, authors, genres, quotes, notes…"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      {!mobile && (
        <input
          className="tp-input"
          // lineHeight:1 tightens the display serif's tall line box so the UA
          // centres the glyphs in the field instead of seating them high.
          style={{ fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1, padding: '14px 18px' }}
          placeholder="Search titles, authors, genres, quotes, notes…"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filterChipClass(scope === value)}
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
          >
            {label}
          </button>
        ))}
        {results && !empty && (
          <span className="ml-auto flex items-center gap-3 view-toggle-row">
            {view !== 'table' && (
              <label className="flex items-center gap-2">
                <MonoLabel>group</MonoLabel>
                <Select
                  ariaLabel="Group by"
                  value={group}
                  onChange={setGroup}
                  options={[['none', 'None'], ['series', 'Series'], ['author', 'Author'], ['decade', 'Decade'], ['genre', 'Genre']]}
                />
              </label>
            )}
            <ViewToggle value={view} onChange={setView} />
          </span>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      {!results && !error && (
        <EmptyState>type to search your books, annotations, movies, and dialogues</EmptyState>
      )}
      {empty && (
        <div className="flex flex-col items-center gap-4 py-10">
          <p className="tp-empty" style={{ padding: 0 }}>
            no results for “{q.trim()}”{scope !== 'all' ? ` in ${scope}` : ''}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <GhostButton onClick={() => setQ('')}>Clear search</GhostButton>
            {scope !== 'all' && <GhostButton onClick={() => setScope('all')}>Search everything</GhostButton>}
          </div>
        </div>
      )}
      {/* Silent typo correction (PLAN §4): the server ran the fuzzy pass because
          the exact query had no hits. Tell the reader which query these came from. */}
      {!empty && results?.corrected && (
        <p className="microcopy">
          no exact matches — showing results for “{results.corrected}”
        </p>
      )}

      {/* One section per facet, only when it has hits. The structured facets
          (date, decade) and the credit / notes / tag / genre facets have no
          flat-table form, so they render as cards in EVERY view — only the plain
          Books / Movies / Annotations / Dialogues switch to sortable tables in
          table view (tiles/list keep the grouped media cards). This keeps a
          facet-only result (e.g. a date or author query) from rendering a blank
          screen under the table view. */}
      {results && !empty && (
        <>
          {results?.date_added && (
            <DateSection d={results.date_added} view={view} renderBook={renderBook} renderMovie={renderMovie} />
          )}
          {results?.decade && (
            <section className="space-y-3">
              <MonoLabel className="block">
                Decade · {results.decade.label} · {(results.decade.books?.length || 0) + (results.decade.movies?.length || 0)}
              </MonoLabel>
              <Board view={view}>
                {[
                  ...groupBooks({ books: results.decade.books || [], annotations: [] }).map(renderBook),
                  ...groupMovies({ movies: results.decade.movies || [], dialogues: [] }).map(renderMovie),
                ]}
              </Board>
            </section>
          )}
          {view === 'table' ? (
            <SearchTables results={results} terms={terms} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} reload={reload} />
          ) : (
            <>
              {bookGroups.length > 0 && (
                <ResultSection
                  label="Books"
                  groups={bookGroups}
                  group={group}
                  view={view}
                  isMovie={false}
                  people={authors.map}
                  onOpenPerson={setPerson}
                  creditSeps={creditSeps}
                  renderItem={renderBook}
                />
              )}
              {movieGroups.length > 0 && (
                <ResultSection
                  label="Movies"
                  groups={movieGroups}
                  group={group}
                  view={view}
                  isMovie
                  people={directors.map}
                  onOpenPerson={setPerson}
                  renderItem={renderMovie}
                />
              )}
              {annGroups.length > 0 && (
                <ResultSection
                  label="Annotations"
                  groups={annGroups}
                  group={group}
                  view={view}
                  isMovie={false}
                  people={authors.map}
                  onOpenPerson={setPerson}
                  creditSeps={creditSeps}
                  renderItem={renderBook}
                  count={r.annotations?.length || 0}
                />
              )}
              {dlgGroups.length > 0 && (
                <ResultSection
                  label="Dialogues"
                  groups={dlgGroups}
                  group={group}
                  view={view}
                  isMovie
                  people={directors.map}
                  onOpenPerson={setPerson}
                  renderItem={renderMovie}
                  count={r.dialogues?.length || 0}
                />
              )}
            </>
          )}
          {results?.authors?.length > 0 && (
            <PeopleSection
              label="Authors"
              kind="author"
              entries={results.authors.map((a) => ({ name: a.name, count: a.books.length, groups: groupBooks({ books: a.books, annotations: [] }) }))}
              people={authors.map}
              onOpenPerson={setPerson}
              view={view}
              render={renderBook}
            />
          )}
          {results?.directors?.length > 0 && (
            <PeopleSection
              label="Directors"
              kind="director"
              entries={results.directors.map((d) => ({ name: d.name, count: d.movies.length, groups: groupMovies({ movies: d.movies, dialogues: [] }) }))}
              people={directors.map}
              onOpenPerson={setPerson}
              view={view}
              render={renderMovie}
            />
          )}
          {results?.actors?.length > 0 && (
            <PeopleSection
              label="Actors"
              kind="actor"
              entries={results.actors.map((a) => ({ name: a.name, count: a.dialogues.length, groups: groupMovies({ movies: [], dialogues: a.dialogues }) }))}
              people={actors.map}
              onOpenPerson={setPerson}
              view={view}
              render={renderMovie}
            />
          )}
          {(noteAnnGroups.length > 0 || noteDlgGroups.length > 0) && (
            <section className="space-y-3">
              <MonoLabel className="block">
                Notes · {(r.notes?.annotations?.length || 0) + (r.notes?.dialogues?.length || 0)}
              </MonoLabel>
              <Board view={view}>{[...noteAnnGroups.map(renderBook), ...noteDlgGroups.map(renderMovie)]}</Board>
            </section>
          )}
          {results?.tags?.length > 0 && (
            <TagSection tags={results.tags} terms={terms} onOpenQuote={setQuote} />
          )}
          {results?.genres?.length > 0 && (
            <GenreSection genres={results.genres} view={view} renderBook={renderBook} renderMovie={renderMovie} />
          )}
        </>
      )}

      {quote && (
        <QuoteModal
          kind={quote.kind}
          hit={quote.hit}
          authorMap={authors.map}
          actorMap={actors.map}
          seps={creditSeps}
          onOpenBook={onOpenBook}
          onOpenMovie={onOpenMovie}
          onOpenPerson={setPerson}
          onClose={() => setQuote(null)}
          onChanged={reload}
        />
      )}
      {person && (
        <PersonModal
          kind={person.kind}
          name={person.name}
          onClose={() => setPerson(null)}
          onSaved={() => {
            authors.reload()
            directors.reload()
            actors.reload()
          }}
        />
      )}
    </section>
  )
}

// QuoteModal — opening a single annotation / dialogue from a search result. It
// loads the full row (search hits are lean) + its parent (for share
// attribution) + tags, then renders the SAME AnnotationCard / Frame used on the
// detail pages, so share / edit / delete behave identically. Edits and deletes
// re-run the search via onChanged.
function QuoteModal({ kind, hit, authorMap = {}, actorMap = {}, seps, onOpenBook, onOpenMovie, onOpenPerson, onClose, onChanged }) {
  const isBook = kind === 'book'
  const parentId = isBook ? hit.book_id : hit.movie_id
  const childPath = isBook ? `/annotations?book_id=${parentId}` : `/dialogues?movie_id=${parentId}`
  const childKey = isBook ? 'annotations' : 'dialogues'
  const itemPath = isBook ? '/annotations' : '/dialogues'
  const parentPath = isBook ? `/books/${parentId}` : `/movies/${parentId}`
  const stateFn = isBook ? annotationState : dialogueState

  const [row, setRow] = useState(null)
  const [parent, setParent] = useState(null)
  const [tags, setTags] = useState([])
  const [editing, setEditing] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [error, setError] = useState('')
  const [gone, setGone] = useState(false)
  const { stickers, reload: reloadStickers } = useStickers()

  async function loadRow() {
    const r = await json('GET', childPath)
    if (!r.ok) return setError(errText(r))
    const found = (r.data[childKey] || []).find((x) => x.id === hit.id)
    if (!found) return setGone(true)
    setRow(found)
  }
  useEffect(() => {
    loadRow()
    json('GET', parentPath).then((r) => { if (r.ok) setParent(r.data) })
    json('GET', '/tags').then((r) => { if (r.ok) setTags(r.data.tags) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit.id, kind])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !shareOpen) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, shareOpen])

  const tagMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t])), [tags])
  const stickerMap = useMemo(() => Object.fromEntries(stickers.map((s) => [s.id, s])), [stickers])

  async function save(id, fields) {
    const r = await json('PUT', `${itemPath}/${id}`, fields)
    if (!r.ok) return errText(r, 'could not save')
    setEditing(false)
    await loadRow()
    onChanged && onChanged()
    return null
  }
  async function patch(x, fields) {
    const r = await json('PUT', `${itemPath}/${x.id}`, { ...stateFn(x), ...fields })
    if (!r.ok) return setError(errText(r, 'could not save'))
    setError('')
    await loadRow()
    onChanged && onChanged()
  }
  async function remove(x) {
    if (!confirm(isBook ? 'Delete this annotation?' : 'Delete this dialogue?')) return
    const r = await json('DELETE', `${itemPath}/${x.id}`)
    if (r.ok) { onChanged && onChanged(); onClose() }
    else setError(errText(r))
  }

  const title = isBook ? parent?.title || hit.book_title : parent?.title || hit.movie_title
  // The credited people for the header chip row: a book's author(s) (split), a
  // dialogue's actor. Portraits come from the people maps — the "image chips"
  // the detail pages show but the search popup was missing.
  const creditKind = isBook ? 'author' : 'actor'
  const creditMap = isBook ? authorMap : actorMap
  const creditNames = splitCredits(isBook ? parent?.author : row?.actor, seps)
  const sharePayload = () =>
    isBook
      ? bookShare({ quote: row.quote, note: row.note, author: parent?.author, title, published: parent?.published_year, chapter: row.chapter, location: row.location, date: fmtDate(annDate(row)), tags: row.tags, color: row.color, people: authorMap, seps })
      : movieShare({ quote: row.quote, note: row.note, title, year: parent?.release_year, character: row.character, actor: row.actor, timestamp: row.timestamp, tags: row.tags, tmdbId: parent?.tmdb_id, tvdbId: parent?.tvdb_id, people: actorMap, seps })

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      style={{ background: 'rgba(21,16,12,.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div role="dialog" aria-modal="true" aria-label="Quote" className="mx-auto w-full max-w-2xl">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0" style={{ maxWidth: '60%' }}>
            <MonoLabel className="block truncate">{title || 'Quote'}</MonoLabel>
            {/* Author / actor portrait chips (split) — click one to open the
                person panel, same as the detail pages. */}
            {creditNames.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {creditNames.map((n) => (
                  <PersonCredit key={n} kind={creditKind} name={n} person={creditMap[n]} size={22} onOpen={onOpenPerson} nameStyle={{ fontSize: 13 }} />
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <GhostButton onClick={() => (isBook ? onOpenBook(parentId) : onOpenMovie(parentId))}>
              Open {isBook ? 'book' : 'film'}
            </GhostButton>
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        {gone ? (
          <HandCard className="p-5"><EmptyState>this quote no longer exists</EmptyState></HandCard>
        ) : !row ? (
          <HandCard className="p-5"><p className="microcopy">loading…</p></HandCard>
        ) : isBook ? (
          <AnnotationCard
            a={row}
            variant={0}
            tagMap={tagMap}
            stickerMap={stickerMap}
            stickers={stickers}
            reloadStickers={reloadStickers}
            editing={editing}
            setEditingId={(id) => setEditing(id != null)}
            save={save}
            patch={patch}
            remove={remove}
            onShare={() => setShareOpen(true)}
            quoteLines={40}
            tagSuggestions={Object.keys(tagMap)}
            actionsAlwaysVisible
            editInline
          />
        ) : (
          <Frame
            d={row}
            tagMap={tagMap}
            stickerMap={stickerMap}
            stickers={stickers}
            reloadStickers={reloadStickers}
            editing={editing}
            onEdit={() => setEditing(true)}
            onCancelEdit={() => setEditing(false)}
            onSave={(fields) => save(row.id, fields)}
            onPatch={(fields) => patch(row, fields)}
            onDelete={() => remove(row)}
            onShare={() => setShareOpen(true)}
            quoteLines={40}
            actionsAlwaysVisible
            editInline
          />
        )}
      </div>
      {shareOpen && row && <ShareDialog share={sharePayload()} seen={{ kind: isBook ? 'book' : 'screen', id: row.id }} onClose={() => setShareOpen(false)} />}
    </div>
  )
}

// SearchTables — the table view: one sortable, flat table per result kind that
// has hits. Rows open their parent book/movie; rows can also be selected for a
// bulk action (tag annotations/dialogues, field-correct books/movies). Sorting
// is table-only.
function SearchTables({ results, terms, onOpenBook, onOpenMovie, reload }) {
  const r = results
  return (
    <div className="space-y-6">
      {r.books?.length > 0 && (
        <ResultTable
          label={`Books · ${r.books.length}`}
          rows={r.books}
          terms={terms}
          onOpen={(row) => onOpenBook(row.id)}
          bulk={{ endpoint: '/books/bulk', kind: 'book-fields' }}
          reload={reload}
          cols={[
            { key: 'title', label: 'Title', val: (b) => b.title, highlight: true, main: true },
            { key: 'author', label: 'Author', val: (b) => b.author || '', mono: true },
            { key: 'genres', label: 'Genres', val: (b) => (b.genres || []).join(', '), mono: true, sort: false },
          ]}
        />
      )}
      {r.annotations?.length > 0 && (
        <ResultTable
          label={`Annotations · ${r.annotations.length}`}
          rows={r.annotations}
          terms={terms}
          onOpen={(row) => onOpenBook(row.book_id)}
          bulk={{ endpoint: '/annotations/bulk', kind: 'tag' }}
          reload={reload}
          cols={[
            { key: 'quote', label: 'Quote', val: (a) => a.quote || a.note || '', highlight: true, main: true },
            { key: 'book', label: 'Book', val: (a) => a.book_title || '', mono: true },
          ]}
        />
      )}
      {r.movies?.length > 0 && (
        <ResultTable
          label={`Movies · ${r.movies.length}`}
          rows={r.movies}
          terms={terms}
          onOpen={(row) => onOpenMovie(row.id)}
          bulk={{ endpoint: '/movies/bulk', kind: 'movie-fields' }}
          reload={reload}
          cols={[
            { key: 'title', label: 'Title', val: (m) => m.title, highlight: true, main: true },
            { key: 'director', label: 'Director', val: (m) => m.director || '', mono: true },
            { key: 'year', label: 'Year', val: (m) => m.release_year || 0, mono: true },
          ]}
        />
      )}
      {r.dialogues?.length > 0 && (
        <ResultTable
          label={`Dialogues · ${r.dialogues.length}`}
          rows={r.dialogues}
          terms={terms}
          onOpen={(row) => onOpenMovie(row.movie_id)}
          bulk={{ endpoint: '/dialogues/bulk', kind: 'tag' }}
          reload={reload}
          cols={[
            { key: 'quote', label: 'Quote', val: (d) => d.quote || '', highlight: true, main: true },
            { key: 'character', label: 'Character', val: (d) => d.character || '', mono: true },
            { key: 'timestamp', label: 'Time', val: (d) => d.timestamp || '', mono: true },
            { key: 'movie', label: 'Film', val: (d) => d.movie_title || '', mono: true },
          ]}
        />
      )}
    </div>
  )
}

function ResultTable({ label, rows, cols, terms, onOpen, bulk, reload }) {
  const { sort, toggle, apply } = useSort(cols[0].key, 'asc')
  const [sel, setSel] = useState(() => new Set())
  const valueFns = Object.fromEntries(cols.filter((c) => c.sort !== false).map((c) => [c.key, (row) => {
    const v = c.val(row)
    return typeof v === 'string' ? v.toLowerCase() : v
  }]))
  const sorted = apply(rows, valueFns)
  const ids = rows.map((row) => row.id)
  const allSel = ids.length > 0 && ids.every((id) => sel.has(id))
  const toggleId = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(() => (allSel ? new Set() : new Set(ids)))
  const selectedIds = ids.filter((id) => sel.has(id))

  return (
    <section className="space-y-2">
      <MonoLabel className="block">{label}</MonoLabel>
      {bulk && selectedIds.length > 0 && (
        <SearchBulkForm
          n={selectedIds.length}
          ids={selectedIds}
          bulk={bulk}
          onClear={() => setSel(new Set())}
          onDone={() => { setSel(new Set()); reload && reload() }}
        />
      )}
      <div className="ann-table-wrap">
        <table className="ann-table">
          <thead>
            <tr>
              {bulk && (
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={allSel} onChange={toggleAll} aria-label="Select all" />
                </th>
              )}
              {cols.map((c) =>
                c.sort === false ? (
                  <th key={c.key}>{c.label}</th>
                ) : (
                  <SortableTh key={c.key} col={c.key} label={c.label} sort={sort} onSort={toggle} />
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                {bulk && (
                  <td className="col-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.has(row.id)} onChange={() => toggleId(row.id)} aria-label="Select row" />
                  </td>
                )}
                {cols.map((c) => (
                  <td key={c.key} className={c.main ? 'col-quote' : 'col-mono'} style={{ cursor: 'pointer' }} onClick={() => onOpen(row)}>
                    {c.highlight ? <Highlight text={String(c.val(row))} terms={terms} /> : c.val(row) || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// SearchBulkForm — the action controls for a table's current selection, hosted
// inside the shared BulkBar strip. Tag kinds add tags; field kinds set
// author/director + series + genres. Posts to the kind's bulk endpoint, then
// clears + reloads the search.
function SearchBulkForm({ n, ids, bulk, onClear, onDone }) {
  const [text, setText] = useState('') // tags (tag kind) or genres (field kind)
  const [series, setSeries] = useState('')
  const [nameField, setNameField] = useState('') // author or director
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const isTag = bulk.kind === 'tag'
  const isBook = bulk.kind === 'book-fields'

  async function apply() {
    const body = { ids }
    if (isTag) {
      const tags = splitCommas(text)
      if (!tags.length) return setErr('type at least one tag')
      body.add_tags = tags
    } else {
      const genres = splitCommas(text)
      if (nameField.trim()) body[isBook ? 'author' : 'director'] = nameField.trim()
      if (series.trim()) body.series = series.trim()
      if (genres.length) body.add_genres = genres
      if (!body.author && !body.director && !body.series && !body.add_genres) return setErr('set a field first')
    }
    setBusy(true)
    setErr('')
    const r = await json('POST', bulk.endpoint, body)
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'bulk action failed'))
    onDone()
  }

  return (
    <BulkBar n={n} onClear={onClear}>
      {!isTag && (
        <input className="tp-input w-auto" style={{ minWidth: 130 }} placeholder={isBook ? 'set author' : 'set director'} value={nameField} onChange={(e) => setNameField(e.target.value)} />
      )}
      {!isTag && (
        <input className="tp-input w-auto" style={{ minWidth: 110 }} placeholder="set series" value={series} onChange={(e) => setSeries(e.target.value)} />
      )}
      <input
        className="tp-input w-auto"
        style={{ minWidth: 150 }}
        placeholder={isTag ? 'add tags (comma-separated)' : 'add genres (comma-separated)'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply() } }}
      />
      <button className="tp-btn tp-btn-primary" disabled={busy} onClick={apply}>Apply to {n}</button>
      {err && <span className="microcopy" style={{ color: 'var(--error)' }}>{err}</span>}
    </BulkBar>
  )
}

// MediaGroup: one book / movie as a card. TOP ROW — cover/poster on the left,
// then the work title with the author/director credit line (+ face chip) beside
// it, and a single clipped row of genre chips below (cut off at the card edge,
// not wrapped). Its matching children (annotations / dialogues) sit BELOW that
// header, spanning the FULL card width — the quote cards, not indented under the
// cover.
function MediaGroup({ kind, cover, title, mediaTag, credits, genres = [], terms, onOpen, children }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children)
  return (
    <HandCard className="p-4">
      <div className="flex gap-4">
        <button type="button" onClick={onOpen} className="shrink-0" title={title} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          {cover ? (
            <img
              src={coverImgURL(cover)}
              alt=""
              className="block w-16 object-cover"
              style={{ aspectRatio: '2 / 3', borderRadius: 6, border: '1px solid var(--ink-border)' }}
            />
          ) : (
            <Placeholder kind={kind} className="w-16" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          {/* Only the title opens the parent — the credit chips below are their
              own click targets (open the person), so they sit OUTSIDE this button. */}
          <button
            type="button"
            onClick={onOpen}
            className="block w-full text-left"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <p className="display-title text-[16.5px] leading-snug">
              <Highlight text={title} terms={terms} />
              {mediaTag && (
                <span className="mono-label" style={{ marginLeft: 8, fontSize: 9.5, color: 'var(--amber)', verticalAlign: 'middle' }}>
                  {mediaTag}
                </span>
              )}
            </p>
          </button>
          {credits}
          {genres.length > 0 && (
            // One line, clipped at the card boundary (a soft fade marks the cut)
            // rather than wrapping to many rows.
            <div
              className="mt-1.5 flex gap-1.5"
              style={{
                flexWrap: 'nowrap',
                overflow: 'hidden',
                WebkitMaskImage: 'linear-gradient(to right, #000 82%, transparent)',
                maskImage: 'linear-gradient(to right, #000 82%, transparent)',
              }}
            >
              {genres.map((gn) => (
                <span key={gn} className="tp-chip" style={{ flex: 'none' }}>
                  {gn}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {hasChildren && <div className="mt-3 space-y-2">{children}</div>}
    </HandCard>
  )
}

// ChildHit: an annotation / dialogue row inside a group, its own click target.
function ChildHit({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left"
      style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
    >
      {children}
    </button>
  )
}

// WorkResult: one grouped search card for a book or a film — the shared
// MediaGroup (cover/poster + title + split credit chips) plus its matching child
// hits (a book's annotations, a film's dialogues). `kind` is 'book' | 'movie'.
// Clicking a child opens the quote modal; the cover/title opens the parent; a
// credit chip opens that person. `people` is the credit map for the chips
// (authors / directors), `actorMap` the per-dialogue actor chips.
function WorkResult({ kind, g, view, terms, onOpen, onOpenQuote, onOpenPerson, people = {}, actorMap = {}, creditSeps }) {
  const isBook = kind === 'book'
  // Joined credits split into individual, clickable people (ROADMAP §11), the
  // same treatment the detail pages and group-by headings use.
  const creditNames = splitCredits(isBook ? g.author : g.director, creditSeps)
  const creditKind = isBook ? 'author' : 'director'
  const mediaTag = isBook ? null : g.media_type === 'show' ? 'SHOW' : 'FILM'
  const credits = (creditNames.length > 0 || (!isBook && g.release_year)) ? (
    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {creditNames.map((n) => (
        <PersonCredit
          key={n}
          kind={creditKind}
          name={n}
          person={people[n]}
          size={20}
          onOpen={onOpenPerson}
          nameStyle={{ fontSize: 12.5 }}
        />
      ))}
      {!isBook && g.release_year ? <MonoLabel style={{ fontSize: 10.5 }}>{g.release_year}</MonoLabel> : null}
    </div>
  ) : null
  return (
    <div className={view === 'tiles' ? 'mb-3 break-inside-avoid' : ''}>
      <MediaGroup
        kind={isBook ? 'COVER' : 'POSTER'}
        cover={isBook ? g.cover_path : g.poster_path}
        title={g.title}
        terms={terms}
        mediaTag={mediaTag}
        credits={credits}
        genres={g.genres || []}
        onOpen={() => onOpen(g.id)}
      >
        {(isBook ? g.annotations : g.dialogues).map((h) =>
          isBook ? (
            <ChildHit key={h.id} onClick={() => onOpenQuote({ kind: 'book', hit: h })}>
              {h.quote && (
                <MatchWindow text={h.quote} terms={terms} style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.5 }} />
              )}
              {h.note && (
                <HandNote>
                  <Highlight text={h.note} terms={terms} />
                </HandNote>
              )}
            </ChildHit>
          ) : (
            <ChildHit key={h.id} onClick={() => onOpenQuote({ kind: 'movie', hit: h })}>
              <MatchWindow text={h.quote} terms={terms} style={{ fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1.5 }} />
              {/* The margin note (highlighted — this is what a Notes hit matched on). */}
              {h.note && (
                <HandNote>
                  <Highlight text={h.note} terms={terms} />
                </HandNote>
              )}
              <span className="mt-1 flex items-center gap-1.5">
                {/* Actor face on the dialogue hit (when a portrait is saved). */}
                <CreditFaces names={h.actor} map={actorMap} size={22} ring="var(--raised)" />
                <MonoLabel className="block min-w-0 truncate">
                  {h.character && <Highlight text={h.character} terms={terms} />}
                  {h.character && h.actor ? ' · ' : ''}
                  {h.actor && <Highlight text={h.actor} terms={terms} />}
                  {h.timestamp ? `  ·  ${h.timestamp}` : ''}
                </MonoLabel>
              </span>
            </ChildHit>
          ),
        )}
      </MediaGroup>
    </div>
  )
}


// ResultSection renders one kind's groups — flat when group === 'none', else
// bucketed into labelled sub-sections. renderItem(g) returns a keyed card.
// For book author buckets, the heading shows the author portrait (people map)
// and opens the metadata panel on click.
function ResultSection({ label, groups, group, view, isMovie, renderItem, people, onOpenPerson, creditSeps, count }) {
  // The header count defaults to the number of work groups (Books/Movies, where
  // one group == one work), but a caller can override it with the hit count —
  // Annotations/Dialogues fold many quote hits under one parent work, so their
  // count is the number of quotes, matching the table view.
  const n = count ?? groups.length
  // Results stay in bm25 relevance order (Masonry order="source" — no height
  // sort, no jitter), but tiles pack the shared greedy way every other board
  // does: each card lands on the SHORTEST column, so the last hit can't leave
  // one column hanging long. list is a plain vertical stack.
  const tileCols = useColumnsAt([[768, 2]])
  const pack = (items) =>
    view === 'tiles' ? (
      <Masonry columns={tileCols} gap={12} order="source">{items.map(renderItem)}</Masonry>
    ) : (
      <div className="space-y-3">{items.map(renderItem)}</div>
    )
  if (group === 'none') {
    return (
      <section className="space-y-3">
        <MonoLabel className="block">{label} · {n}</MonoLabel>
        {pack(groups)}
      </section>
    )
  }
  return (
    <section className="space-y-4">
      <MonoLabel className="block">{label} · {n}</MonoLabel>
      {groupWorks(groups, group, {
        credit: (g) => (isMovie ? g.director : g.author),
        splitCredit: !isMovie,
        creditResidual: isMovie ? 'Unknown director' : 'Unknown author',
        year: (g) => (isMovie ? g.release_year : g.published_year),
        genres: (g) => g.genres || [],
        series: (g) => g.series,
        seps: creditSeps,
      }).map((b) => {
        // The "by author" dimension maps to the director for movies (see the
        // groupWorks call above), so the same heading opens the People panel: an
        // author for books, a director for movies. Residual buckets ("Unknown …")
        // stay plain text.
        const isPersonGroup = group === 'author' && !b.residual
        const personKind = isMovie ? 'director' : 'author'
        const portrait = isPersonGroup && people ? people[b.label] : null
        return (
          <div key={b.key} className="space-y-2">
            <div className="flex items-center gap-3">
              {portrait && <PersonPortrait person={portrait} size={28} />}
              {isPersonGroup && onOpenPerson ? (
                <button
                  type="button"
                  className="display-title truncate"
                  style={{ fontSize: 16.5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => onOpenPerson({ kind: personKind, name: b.label })}
                  title={`${b.label} — details`}
                >
                  {b.label}
                </button>
              ) : (
                <h3 className="display-title truncate" style={{ fontSize: 16.5 }}>{b.label}</h3>
              )}
              <MonoLabel style={{ color: 'var(--accent-ui)' }}>{b.items.length}</MonoLabel>
              <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
            </div>
            {pack(b.items)}
          </div>
        )
      })}
    </section>
  )
}

// Board — the shared packing for the facet sections: source-order masonry in
// tiles view (same greedy shortest-column fill every other board uses), a
// vertical stack in list view.
function Board({ view, children }) {
  const cols = useColumnsAt([[768, 2]])
  return view === 'tiles' ? (
    <Masonry columns={cols} gap={12} order="source">{children}</Masonry>
  ) : (
    <div className="space-y-3">{children}</div>
  )
}

// PeopleSection — one facet section per credit kind (Authors · Directors ·
// Actors): each matched person renders a portrait + name heading (opens the
// People panel) over the works / dialogues carrying the credit.
function PeopleSection({ label, kind, entries, people, onOpenPerson, view, render }) {
  return (
    <section className="space-y-4">
      <MonoLabel className="block">{label} · {entries.length}</MonoLabel>
      {entries.map((e) => (
        <div key={e.name} className="space-y-2">
          <div className="flex items-center gap-3">
            {people?.[e.name] && <PersonPortrait person={people[e.name]} size={28} />}
            <button
              type="button"
              className="display-title truncate"
              style={{ fontSize: 16.5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
              onClick={() => onOpenPerson({ kind, name: e.name })}
              title={`${e.name} — details`}
            >
              {e.name}
            </button>
            <MonoLabel style={{ color: 'var(--accent-ui)' }}>{e.count}</MonoLabel>
            <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>
          <Board view={view}>{e.groups.map(render)}</Board>
        </div>
      ))}
    </section>
  )
}

// TagSection — matched tags, each a chip heading over the quotes wearing it
// (annotations and dialogues mixed); a child opens the quote modal.
function TagSection({ tags, terms, onOpenQuote }) {
  return (
    <section className="space-y-4">
      <MonoLabel className="block">Tags · {tags.length}</MonoLabel>
      {tags.map((t) => (
        <div key={t.name} className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="tp-chip">{t.name}</span>
            <MonoLabel style={{ color: 'var(--accent-ui)' }}>{t.count}</MonoLabel>
            <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>
          <div className="space-y-2">
            {(t.annotations || []).map((h) => (
              <ChildHit key={`a${h.id}`} onClick={() => onOpenQuote({ kind: 'book', hit: h })}>
                {(h.quote || h.note) && (
                  <MatchWindow text={h.quote || h.note} terms={terms} style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.5 }} />
                )}
                <MonoLabel className="mt-1 block min-w-0 truncate">
                  {[h.book_title, h.book_author].filter(Boolean).join(' · ')}
                </MonoLabel>
              </ChildHit>
            ))}
            {(t.dialogues || []).map((h) => (
              <ChildHit key={`d${h.id}`} onClick={() => onOpenQuote({ kind: 'movie', hit: h })}>
                <MatchWindow text={h.quote} terms={terms} style={{ fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1.5 }} />
                <MonoLabel className="mt-1 block min-w-0 truncate">
                  {[h.movie_title, h.character].filter(Boolean).join(' · ')}
                </MonoLabel>
              </ChildHit>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// GenreSection — matched genres, each a chip heading over the works shelved
// under it (books + films/shows).
function GenreSection({ genres, view, renderBook, renderMovie }) {
  return (
    <section className="space-y-4">
      <MonoLabel className="block">Genres · {genres.length}</MonoLabel>
      {genres.map((g) => (
        <div key={g.name} className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="tp-chip">{g.name}</span>
            <MonoLabel style={{ color: 'var(--accent-ui)' }}>{(g.books?.length || 0) + (g.movies?.length || 0)}</MonoLabel>
            <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
          </div>
          <Board view={view}>
            {[
              ...groupBooks({ books: g.books || [], annotations: [] }).map(renderBook),
              ...groupMovies({ movies: g.movies || [], dialogues: [] }).map(renderMovie),
            ]}
          </Board>
        </div>
      ))}
    </section>
  )
}

// DateSection — everything added on one day (the Stats calendar's dot target):
// the works shelved that day, then the quotes captured that day under their
// parent works.
function DateSection({ d, view, renderBook, renderMovie }) {
  const pretty = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'long' })
  const works = [
    ...groupBooks({ books: d.books || [], annotations: [] }).map(renderBook),
    ...groupMovies({ movies: d.movies || [], dialogues: [] }).map(renderMovie),
  ]
  const quotes = [
    ...groupBooks({ books: [], annotations: d.annotations || [] }).map(renderBook),
    ...groupMovies({ movies: [], dialogues: d.dialogues || [] }).map(renderMovie),
  ]
  const n = (d.books?.length || 0) + (d.movies?.length || 0) + (d.annotations?.length || 0) + (d.dialogues?.length || 0)
  return (
    <section className="space-y-3">
      <MonoLabel className="block">Added on {pretty} · {n}</MonoLabel>
      {works.length > 0 && <Board view={view}>{works}</Board>}
      {quotes.length > 0 && <Board view={view}>{quotes}</Board>}
    </section>
  )
}

// groupBooks merges matched books and matched annotations into per-book groups,
// preserving bm25 order (matched books first, then annotation-only books).
function groupBooks(r) {
  const order = []
  const byId = new Map()
  const ensure = (id, seed) => {
    let g = byId.get(id)
    if (!g) {
      g = { id, title: '', author: '', cover_path: '', genres: [], published_year: 0, series: '', series_index: 0, annotations: [], ...seed }
      byId.set(id, g)
      order.push(g)
    }
    return g
  }
  for (const b of r.books || []) {
    ensure(b.id, { title: b.title, author: b.author, cover_path: b.cover_path, genres: b.genres, published_year: b.published_year, series: b.series, series_index: b.series_index })
  }
  for (const a of r.annotations || []) {
    // Parent-book fields on the annotation hit so an annotation-only group still
    // buckets by author/decade/series/genre.
    const g = ensure(a.book_id, { title: a.book_title, cover_path: a.book_cover_path, author: a.book_author, genres: a.book_genres, published_year: a.book_published_year, series: a.book_series })
    g.annotations.push(a)
  }
  return order
}

// groupMovies mirrors groupBooks for movies + dialogues.
function groupMovies(r) {
  const order = []
  const byId = new Map()
  const ensure = (id, seed) => {
    let g = byId.get(id)
    if (!g) {
      g = { id, title: '', director: '', release_year: 0, poster_path: '', genres: [], series: '', series_index: 0, media_type: 'movie', dialogues: [], ...seed }
      byId.set(id, g)
      order.push(g)
    }
    return g
  }
  for (const m of r.movies || []) {
    ensure(m.id, { title: m.title, director: m.director, release_year: m.release_year, poster_path: m.poster_path, genres: m.genres, series: m.series, series_index: m.series_index, media_type: m.media_type })
  }
  for (const d of r.dialogues || []) {
    const g = ensure(d.movie_id, { title: d.movie_title, poster_path: d.movie_poster_path, director: d.movie_director, release_year: d.movie_release_year, genres: d.movie_genres, series: d.movie_series, media_type: d.movie_media_type })
    g.dialogues.push(d)
  }
  return order
}

// A quote longer than this gets windowed around the match; shorter ones show
// whole. PAD is roughly a card line of characters each side of the term, so the
// window reads as "a line above and below" the match.
const WINDOW_MAX = 200
const WINDOW_PAD = 75

// escapeTerms builds the shared match pattern (also used by Highlight).
function termPattern(terms, flags) {
  return new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', flags)
}

// MatchWindow shows a long quote as a context window: the run of text around
// the first matched term (about a line either side, snapped to word bounds),
// with a chevron above when text is hidden before the window and below when
// hidden after — a compact "there's more, open to read it" cue. Short quotes,
// or quotes with no visible match, render whole (opening the modal shows all).
function MatchWindow({ text, terms, style }) {
  const s = String(text || '')
  const inner = <span style={style}><Highlight text={s} terms={terms} /></span>
  if (!terms.length || s.length <= WINDOW_MAX) return inner
  const m = termPattern(terms, 'i').exec(s)
  if (!m) return inner
  const mi = m.index
  const me = mi + m[0].length
  let start = Math.max(0, mi - WINDOW_PAD)
  let end = Math.min(s.length, me + WINDOW_PAD)
  // Snap the cut points to word boundaries so the window never slices a word.
  if (start > 0) {
    const sp = s.indexOf(' ', start)
    if (sp !== -1 && sp < mi) start = sp + 1
  }
  if (end < s.length) {
    const sp = s.lastIndexOf(' ', end)
    if (sp !== -1 && sp > me) end = sp
  }
  const before = start > 0
  const after = end < s.length
  const chev = (dir) => (
    <span aria-hidden="true" style={{ display: 'block', textAlign: 'center', lineHeight: 1, fontSize: 11, color: 'var(--faint)' }}>
      {dir === 'up' ? '⌃' : '⌄'}
    </span>
  )
  return (
    <span style={{ display: 'block' }}>
      {before && chev('up')}
      <span style={style}><Highlight text={s.slice(start, end)} terms={terms} /></span>
      {after && chev('down')}
    </span>
  )
}

// Highlight wraps query terms in the §6 accent highlight span. Pure text
// splitting — no HTML injection. Case-insensitive; FTS accent-folding
// (Bronte→Brontë) is server-side only, so accented matches render unhighlighted.
function Highlight({ text, terms }) {
  if (!text || terms.length === 0) return text || null
  const parts = String(text).split(termPattern(terms, 'gi'))
  return parts.map((part, i) => (i % 2 === 1 ? <HighlightSpan key={i}>{part}</HighlightSpan> : part))
}

// queryTerms splits the search input into highlightable tokens.
function queryTerms(q) {
  return q.trim().split(/\s+/).filter(Boolean)
}
