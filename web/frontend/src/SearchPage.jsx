import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import {
  EdgeRow,
  EmptyState,
  ErrorText,
  GhostButton,
  HandNote,
  HighlightSpan,
  MonoLabel,
  Placeholder,
  Sprockets,
  frameCode,
  useFrameBase,
} from './ui.jsx'

const SCOPES = [
  ['all', 'All'],
  ['books', 'Books'],
  ['annotations', 'Annotations'],
  ['movies', 'Movies'],
  ['dialogues', 'Dialogues'],
]

// useAesthetic mirrors ui.jsx's useResolvedDark for the aesthetic axis —
// local on purpose, ui.jsx is shared foundation (see task ownership note).
function useAesthetic() {
  const [aes, setAes] = useState(() => document.documentElement.dataset.aesthetic || 'paper')
  useEffect(() => {
    const fn = (e) => setAes(e.detail.aesthetic)
    window.addEventListener('tippani:theme', fn)
    return () => window.removeEventListener('tippani:theme', fn)
  }, [])
  return aes
}

// SearchPage (§8.9): one big Newsreader box, scope chips, grouped bm25 results.
// 200 ms debounce with a stale-guard; GET /search?q=&scope=.
export default function SearchPage({ onOpenBook, onOpenMovie }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const film = useAesthetic() === 'film'
  const base = useFrameBase()

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

  const empty =
    results &&
    ['books', 'annotations', 'movies', 'dialogues'].every((k) => !results[k] || results[k].length === 0)

  const terms = queryTerms(q)

  return (
    <section className="space-y-5 pt-4">
      <input
        className="tp-input"
        style={{ fontFamily: 'var(--font-display)', fontSize: 19, padding: '13px 18px' }}
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
            className={'tp-filter-chip' + (scope === value ? ' active' : '')}
            style={scope === value ? undefined : { borderColor: 'var(--line)', background: 'var(--card)' }}
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
          >
            {label}
          </button>
        ))}
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
            {scope !== 'all' && (
              <GhostButton onClick={() => setScope('all')}>Search everything</GhostButton>
            )}
          </div>
        </div>
      )}

      {results?.books?.length > 0 && (
        <ResultGroup label="Books" count={results.books.length} film={film} code={frameCode(base, 0)}>
          {results.books.map((b, i) => (
            <ResultCard key={b.id} index={i} onClick={() => onOpenBook(b.id)}>
              <div className="flex items-center gap-4">
                <Placeholder kind="" className="h-14 w-10 shrink-0" />
                <p className="display-title min-w-0 flex-1 text-[16.5px] leading-snug">
                  <Highlight text={b.title} terms={terms} />
                  {b.author && (
                    <span className="font-normal" style={{ color: 'var(--soft)' }}>
                      {' — '}
                      <Highlight text={b.author} terms={terms} />
                    </span>
                  )}
                </p>
                {b.genres?.length > 0 && (
                  <MonoLabel className="hidden shrink-0 sm:block">
                    {b.genres.slice(0, 3).join(' · ')}
                  </MonoLabel>
                )}
              </div>
            </ResultCard>
          ))}
        </ResultGroup>
      )}

      {results?.annotations?.length > 0 && (
        <ResultGroup
          label="Annotations"
          count={results.annotations.length}
          film={film}
          code={frameCode(base, 1)}
        >
          {results.annotations.map((a, i) => (
            <ResultCard key={a.id} index={i + 1} onClick={() => onOpenBook(a.book_id)}>
              {a.quote && (
                <p
                  className="mb-1.5"
                  style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.5 }}
                >
                  <Highlight text={a.quote} terms={terms} />
                </p>
              )}
              {a.note && (
                <HandNote className="mb-1.5">
                  <Highlight text={a.note} terms={terms} />
                </HandNote>
              )}
              <MonoLabel className="block">{a.book_title}</MonoLabel>
            </ResultCard>
          ))}
        </ResultGroup>
      )}

      {results?.movies?.length > 0 && (
        <ResultGroup label="Movies" count={results.movies.length} film={film} code={frameCode(base, 2)}>
          {results.movies.map((m, i) => (
            <ResultCard key={m.id} index={i + 2} onClick={() => onOpenMovie(m.id)}>
              <div className="flex items-center gap-4">
                <Placeholder kind="" className="h-14 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="display-title text-[16.5px] leading-snug">
                    <Highlight text={m.title} terms={terms} />
                  </p>
                  <MonoLabel className="mt-0.5 block">
                    <Highlight text={m.director} terms={terms} />
                    {m.director && m.release_year ? ' · ' : ''}
                    {m.release_year || ''}
                  </MonoLabel>
                </div>
              </div>
            </ResultCard>
          ))}
        </ResultGroup>
      )}

      {results?.dialogues?.length > 0 && (
        <ResultGroup
          label="Dialogues"
          count={results.dialogues.length}
          film={film}
          code={frameCode(base, 3)}
        >
          {results.dialogues.map((d, i) => (
            <ResultCard key={d.id} index={i + 3} onClick={() => onOpenMovie(d.movie_id)}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, lineHeight: 1.5 }}>
                “<Highlight text={d.quote} terms={terms} />”
              </p>
              <MonoLabel className="mt-1.5 block">
                {d.character && <Highlight text={d.character} terms={terms} />}
                {d.character && d.actor ? ' · ' : ''}
                {d.actor && <Highlight text={d.actor} terms={terms} />}
                {d.character || d.actor ? ' — ' : ''}
                {d.movie_title}
                {d.timestamp ? ` · ${d.timestamp}` : ''}
              </MonoLabel>
            </ResultCard>
          ))}
        </ResultGroup>
      )}
    </section>
  )
}

// ResultGroup: mono header + a stack of cards on paper; on film the stack sits
// inside a film strip with sprocket rows and a runtime frame code (§6).
function ResultGroup({ label, count, film, code, children }) {
  return (
    <section className="space-y-2">
      <MonoLabel className="block">
        {label} · {count}
      </MonoLabel>
      {film ? (
        <div className="film-strip">
          <Sprockets />
          <EdgeRow code={code} />
          <div className="space-y-3 px-4 pb-2">{children}</div>
          <Sprockets />
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  )
}

const RADII = ['', 'hc-r1', 'hc-r2', 'hc-r3']

// ResultCard: the whole hit is one click target; radius variant cycles so
// neighbouring paper cards wobble differently (§6).
function ResultCard({ index = 0, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hand-card ${RADII[index % RADII.length]} block w-full px-5 py-4 text-left transition hover:brightness-105`}
    >
      {children}
    </button>
  )
}

// Highlight wraps query terms in the §6 accent highlight span. Pure text
// splitting — no HTML injection. Case-insensitive; FTS accent-folding
// (Bronte→Brontë) is server-side only, so accented matches simply render
// unhighlighted (graceful degradation).
function Highlight({ text, terms }) {
  if (!text || terms.length === 0) return text || null
  const pattern = new RegExp(
    '(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'gi'
  )
  const parts = String(text).split(pattern)
  return parts.map((part, i) =>
    i % 2 === 1 ? <HighlightSpan key={i}>{part}</HighlightSpan> : part
  )
}

// queryTerms splits the search input into highlightable tokens.
function queryTerms(q) {
  return q.trim().split(/\s+/).filter(Boolean)
}
