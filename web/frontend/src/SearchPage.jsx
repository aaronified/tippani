import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import {
  EmptyState,
  ErrorText,
  filterChipClass,
  GhostButton,
  HandCard,
  HandNote,
  HighlightSpan,
  MonoLabel,
  Placeholder,
  SortableTh,
  splitCommas,
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

// SearchPage (§8.9): one big Newsreader box + scope chips. Results are grouped
// by their parent book / movie, each group headed by the cover / poster —
// annotations sit under their book, dialogues under their movie. 200 ms debounce
// with a stale-guard; GET /search?q=&scope=.
export default function SearchPage({ onOpenBook, onOpenMovie }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = usePersistedState('tippani:searchview', 'tiles') // tiles | list | table
  const [nonce, setNonce] = useState(0) // bump to re-run the search after a bulk action
  const reload = () => setNonce((n) => n + 1)

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

  const terms = queryTerms(q)
  const bookGroups = results ? groupBooks(results) : []
  const movieGroups = results ? groupMovies(results) : []
  const empty = results && bookGroups.length === 0 && movieGroups.length === 0

  return (
    <section className="space-y-5 pt-4">
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
          <span className="ml-auto">
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

      {/* table view flattens the raw hits into sortable tables; tiles/list keep
          the grouped media cards (masonry vs single column). Sort lives only in
          the table view — tiles/list follow the server's bm25 relevance order. */}
      {results && !empty && view === 'table' ? (
        <SearchTables results={results} terms={terms} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} reload={reload} />
      ) : (
        <>
          {bookGroups.length > 0 && (
            <section className="space-y-3">
              <MonoLabel className="block">Books · {bookGroups.length}</MonoLabel>
              <div className={view === 'tiles' ? 'columns-1 gap-3 md:columns-2' : 'space-y-3'}>
                {bookGroups.map((g) => (
                  <div key={`b${g.id}`} className={view === 'tiles' ? 'mb-3 break-inside-avoid' : ''}>
                    <MediaGroup
                      kind="COVER"
                      cover={g.cover_path}
                      title={g.title}
                      terms={terms}
                      subtitle={[g.author, g.genres && g.genres.slice(0, 3).join(' · ')].filter(Boolean).join('  ·  ')}
                      onOpen={() => onOpenBook(g.id)}
                    >
                      {g.annotations.map((a) => (
                        <ChildHit key={a.id} onClick={() => onOpenBook(g.id)}>
                          {a.quote && (
                            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.5 }}>
                              <Highlight text={a.quote} terms={terms} />
                            </p>
                          )}
                          {a.note && (
                            <HandNote>
                              <Highlight text={a.note} terms={terms} />
                            </HandNote>
                          )}
                        </ChildHit>
                      ))}
                    </MediaGroup>
                  </div>
                ))}
              </div>
            </section>
          )}

          {movieGroups.length > 0 && (
            <section className="space-y-3">
              <MonoLabel className="block">Movies · {movieGroups.length}</MonoLabel>
              <div className={view === 'tiles' ? 'columns-1 gap-3 md:columns-2' : 'space-y-3'}>
                {movieGroups.map((g) => (
                  <div key={`m${g.id}`} className={view === 'tiles' ? 'mb-3 break-inside-avoid' : ''}>
                    <MediaGroup
                      kind="POSTER"
                      cover={g.poster_path}
                      title={g.title}
                      terms={terms}
                      subtitle={[g.director, g.release_year || null].filter(Boolean).join('  ·  ')}
                      onOpen={() => onOpenMovie(g.id)}
                    >
                      {g.dialogues.map((d) => (
                        <ChildHit key={d.id} onClick={() => onOpenMovie(g.id)}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1.5 }}>
                            “<Highlight text={d.quote} terms={terms} />”
                          </p>
                          <MonoLabel className="mt-1 block">
                            {d.character && <Highlight text={d.character} terms={terms} />}
                            {d.character && d.actor ? ' · ' : ''}
                            {d.actor && <Highlight text={d.actor} terms={terms} />}
                            {d.timestamp ? `  ·  ${d.timestamp}` : ''}
                          </MonoLabel>
                        </ChildHit>
                      ))}
                    </MediaGroup>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
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
        <BulkBar
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

// BulkBar — the action strip for a table's current selection. Tag kinds add
// tags; field kinds set author/director + series + genres. Posts to the kind's
// bulk endpoint, then clears + reloads the search.
function BulkBar({ n, ids, bulk, onClear, onDone }) {
  const [text, setText] = useState('') // tags (tag kind) or "field=value; …" not used — see below
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
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
      style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--line))' }}
    >
      <MonoLabel style={{ color: 'var(--accent-ui)' }}>{n} selected</MonoLabel>
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
      <GhostButton onClick={onClear}>Clear</GhostButton>
      {err && <span className="microcopy" style={{ color: 'var(--error)' }}>{err}</span>}
    </div>
  )
}

// MediaGroup: one book / movie as a card — cover or poster on the left, title +
// subtitle, and its matching children (annotations / dialogues) stacked below.
function MediaGroup({ kind, cover, title, subtitle, terms, onOpen, children }) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children)
  return (
    <HandCard className="flex gap-4 p-4">
      <button type="button" onClick={onOpen} className="shrink-0" title={title} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        {cover ? (
          <img
            src={`/api/covers/${cover}`}
            alt=""
            className="block w-16 object-cover"
            style={{ aspectRatio: '2 / 3', borderRadius: 6, border: '1px solid var(--ink-border)' }}
          />
        ) : (
          <Placeholder kind={kind} className="w-16" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block text-left"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <p className="display-title text-[16.5px] leading-snug">
            <Highlight text={title} terms={terms} />
          </p>
          {subtitle && <MonoLabel className="mt-0.5 block">{subtitle}</MonoLabel>}
        </button>
        {hasChildren && <div className="mt-2.5 space-y-2">{children}</div>}
      </div>
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

// groupBooks merges matched books and matched annotations into per-book groups,
// preserving bm25 order (matched books first, then annotation-only books).
function groupBooks(r) {
  const order = []
  const byId = new Map()
  const ensure = (id, seed) => {
    let g = byId.get(id)
    if (!g) {
      g = { id, title: '', author: '', cover_path: '', genres: [], annotations: [], ...seed }
      byId.set(id, g)
      order.push(g)
    }
    return g
  }
  for (const b of r.books || []) {
    ensure(b.id, { title: b.title, author: b.author, cover_path: b.cover_path, genres: b.genres })
  }
  for (const a of r.annotations || []) {
    const g = ensure(a.book_id, { title: a.book_title, cover_path: a.book_cover_path })
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
      g = { id, title: '', director: '', release_year: 0, poster_path: '', dialogues: [], ...seed }
      byId.set(id, g)
      order.push(g)
    }
    return g
  }
  for (const m of r.movies || []) {
    ensure(m.id, { title: m.title, director: m.director, release_year: m.release_year, poster_path: m.poster_path })
  }
  for (const d of r.dialogues || []) {
    const g = ensure(d.movie_id, { title: d.movie_title, poster_path: d.movie_poster_path })
    g.dialogues.push(d)
  }
  return order
}

// Highlight wraps query terms in the §6 accent highlight span. Pure text
// splitting — no HTML injection. Case-insensitive; FTS accent-folding
// (Bronte→Brontë) is server-side only, so accented matches render unhighlighted.
function Highlight({ text, terms }) {
  if (!text || terms.length === 0) return text || null
  const pattern = new RegExp(
    '(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'gi'
  )
  const parts = String(text).split(pattern)
  return parts.map((part, i) => (i % 2 === 1 ? <HighlightSpan key={i}>{part}</HighlightSpan> : part))
}

// queryTerms splits the search input into highlightable tokens.
function queryTerms(q) {
  return q.trim().split(/\s+/).filter(Boolean)
}
