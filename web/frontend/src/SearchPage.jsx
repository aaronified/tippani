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
  }, [q, scope])

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
        <SearchTables results={results} terms={terms} onOpenBook={onOpenBook} onOpenMovie={onOpenMovie} />
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
// has hits. Rows open their parent book/movie. Sorting is table-only.
function SearchTables({ results, terms, onOpenBook, onOpenMovie }) {
  const r = results
  return (
    <div className="space-y-6">
      {r.books?.length > 0 && (
        <ResultTable
          label={`Books · ${r.books.length}`}
          rows={r.books}
          terms={terms}
          onOpen={(row) => onOpenBook(row.id)}
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

function ResultTable({ label, rows, cols, terms, onOpen }) {
  const { sort, toggle, apply } = useSort(cols[0].key, 'asc')
  const valueFns = Object.fromEntries(cols.filter((c) => c.sort !== false).map((c) => [c.key, (row) => {
    const v = c.val(row)
    return typeof v === 'string' ? v.toLowerCase() : v
  }]))
  const sorted = apply(rows, valueFns)
  return (
    <section className="space-y-2">
      <MonoLabel className="block">{label}</MonoLabel>
      <div className="ann-table-wrap">
        <table className="ann-table">
          <thead>
            <tr>
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
              <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(row)}>
                {cols.map((c) => (
                  <td key={c.key} className={c.main ? 'col-quote' : 'col-mono'}>
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
