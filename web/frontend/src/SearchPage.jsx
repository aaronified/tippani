import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import { inputClass, cardClass, chipClass, ErrorText, EmptyState, Chips } from './ui.jsx'

const SCOPES = [
  ['all', 'All'],
  ['books', 'Books'],
  ['annotations', 'Annotations'],
  ['movies', 'Movies'],
  ['dialogues', 'Dialogues'],
]

// SearchPage: debounced (200ms) unified search over GET /search.
// Book/annotation hits open the book detail; movie/dialogue hits the movie detail.
export default function SearchPage({ onOpenBook, onOpenMovie }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

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

  return (
    <section className="space-y-4">
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Search titles, authors, genres, quotes, notes…"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={inputClass + ' w-auto shrink-0'}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          {SCOPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <ErrorText>{error}</ErrorText>

      {!results && !error && (
        <EmptyState>Type to search your books, annotations, movies, and dialogues.</EmptyState>
      )}
      {empty && <EmptyState>No results for “{q.trim()}”.</EmptyState>}

      {results?.books?.length > 0 && (
        <ResultGroup title="Books">
          {results.books.map((b) => (
            <ResultRow key={b.id} onClick={() => onOpenBook(b.id)}>
              <p className="text-sm font-medium">{b.title}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{b.author}</p>
              <Chips items={b.genres} className="mt-1" />
            </ResultRow>
          ))}
        </ResultGroup>
      )}

      {results?.annotations?.length > 0 && (
        <ResultGroup title="Annotations">
          {results.annotations.map((a) => (
            <ResultRow key={a.id} onClick={() => onOpenBook(a.book_id)}>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{a.book_title}</p>
              {a.quote && <p className="text-sm">{a.quote}</p>}
              {a.note && <p className="text-sm text-neutral-500 dark:text-neutral-400">{a.note}</p>}
            </ResultRow>
          ))}
        </ResultGroup>
      )}

      {results?.movies?.length > 0 && (
        <ResultGroup title="Movies">
          {results.movies.map((m) => (
            <ResultRow key={m.id} onClick={() => onOpenMovie(m.id)}>
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {[m.director, m.release_year].filter(Boolean).join(' · ')}
              </p>
            </ResultRow>
          ))}
        </ResultGroup>
      )}

      {results?.dialogues?.length > 0 && (
        <ResultGroup title="Dialogues">
          {results.dialogues.map((d) => (
            <ResultRow key={d.id} onClick={() => onOpenMovie(d.movie_id)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{d.movie_title}</span>
                {d.timestamp && <span className={chipClass + ' font-mono'}>{d.timestamp}</span>}
                {(d.character || d.actor) && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {[d.character, d.actor].filter(Boolean).join(' — ')}
                  </span>
                )}
              </div>
              <p className="text-sm">{d.quote}</p>
            </ResultRow>
          ))}
        </ResultGroup>
      )}
    </section>
  )
}

function ResultGroup({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      <ul className={cardClass + ' divide-y divide-neutral-200 dark:divide-neutral-800'}>{children}</ul>
    </div>
  )
}

function ResultRow({ onClick, children }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full space-y-0.5 px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      >
        {children}
      </button>
    </li>
  )
}
