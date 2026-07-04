import { useEffect, useRef, useState } from 'react'
import { json, errText } from './api.js'
import {
  inputClass,
  buttonClass,
  ghostButtonClass,
  cardClass,
  chipClass,
  linkButtonClass,
  deleteButtonClass,
  splitCommas,
  filterChipClass,
  ErrorText,
  EmptyState,
  Chips,
  Cover,
  FavoriteStar,
  RatingStars,
  MinRatingSelect,
} from './ui.jsx'

// Movies is the movies tab: list + add, or a single movie's detail view.
// It mirrors Library — dialogues mirror annotations (PLAN §3b).
export default function Movies({ openId, onOpen, onClose }) {
  if (openId) return <MovieDetail id={openId} onClose={onClose} />
  return <MovieList onOpen={onOpen} />
}

function MovieList({ onOpen }) {
  const [movies, setMovies] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const r = await json('GET', '/movies')
    if (r.ok) setMovies(r.data.movies)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Movies</h2>
        <button className={buttonClass + ' ml-auto'} onClick={() => setAdding(!adding)}>
          {adding ? 'Close' : 'Add movie'}
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
      {adding && (
        <AddMovie
          onAdded={() => {
            setAdding(false)
            load()
          }}
        />
      )}
      {movies && movies.length === 0 && (
        <EmptyState>No movies yet — look one up or add it manually.</EmptyState>
      )}
      {movies && movies.length > 0 && (
        <ul className={cardClass + ' divide-y divide-neutral-200 dark:divide-neutral-800'}>
          {movies.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => onOpen(m.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <Cover path={m.poster_path} title={m.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.title}</span>
                  <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {[m.director, m.release_year].filter(Boolean).join(' · ')}
                  </span>
                  <Chips items={m.genres} className="mt-1" />
                </span>
                <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                  {m.dialogue_count} dialogue{m.dialogue_count === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AddMovie({ onAdded }) {
  const [mode, setMode] = useState('lookup')
  const [lookupError, setLookupError] = useState('') // 503: shown above manual form
  const tabClass = (active) =>
    'rounded px-3 py-1.5 text-sm ' +
    (active
      ? 'bg-neutral-100 dark:bg-neutral-800 font-medium'
      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100')

  return (
    <div className={cardClass + ' space-y-4 p-4'}>
      <div className="flex gap-1">
        <button className={tabClass(mode === 'lookup')} onClick={() => setMode('lookup')}>
          Lookup
        </button>
        <button className={tabClass(mode === 'manual')} onClick={() => setMode('manual')}>
          Manual
        </button>
      </div>
      {mode === 'lookup' ? (
        <LookupMovie
          onAdded={onAdded}
          onUnavailable={(msg) => {
            // TMDB key not configured — surface the error and fall back to manual entry.
            setLookupError(msg)
            setMode('manual')
          }}
        />
      ) : (
        <>
          <ErrorText>{lookupError}</ErrorText>
          <ManualMovie onAdded={onAdded} />
        </>
      )}
    </div>
  )
}

function LookupMovie({ onAdded, onUnavailable }) {
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function search(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError('')
    setCandidates(null)
    const body = { title: title.trim() }
    if (year) body.year = Number(year)
    const r = await json('POST', '/movies/lookup', body)
    setBusy(false)
    if (r.ok) return setCandidates(r.data.candidates)
    if (r.status === 503) return onUnavailable(errText(r, 'movie lookup is unavailable'))
    setError(errText(r, 'lookup failed'))
  }

  async function add(c) {
    setError('')
    const r = await json('POST', '/movies', { tmdb_id: c.tmdb_id })
    if (r.ok) onAdded()
    else setError(errText(r, 'could not add movie'))
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={inputClass + ' w-24 shrink-0'}
          placeholder="Year"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <button className={buttonClass + ' shrink-0'} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>
      <ErrorText>{error}</ErrorText>
      {candidates && candidates.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No matches found.</p>
      )}
      {candidates && candidates.length > 0 && (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded border border-neutral-200 dark:border-neutral-800">
          {candidates.map((c) => (
            <li key={c.tmdb_id} className="flex items-start gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {c.title}
                  {c.release_year ? (
                    <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      {c.release_year}
                    </span>
                  ) : null}
                  <span className="ml-2 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    TMDB
                  </span>
                </p>
                {c.overview && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-400 dark:text-neutral-500">{c.overview}</p>
                )}
              </div>
              <button className={ghostButtonClass + ' shrink-0'} onClick={() => add(c)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ManualMovie({ onAdded }) {
  const [title, setTitle] = useState('')
  const [director, setDirector] = useState('')
  const [year, setYear] = useState('')
  const [genres, setGenres] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    setBusy(true)
    setError('')
    const r = await json('POST', '/movies', {
      title: title.trim(),
      director: director.trim() || undefined,
      release_year: year ? Number(year) : undefined,
      genres: splitCommas(genres),
      description: description.trim() || undefined,
    })
    setBusy(false)
    if (r.ok) onAdded()
    else setError(errText(r, 'could not add movie'))
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={inputClass} placeholder="Director" value={director} onChange={(e) => setDirector(e.target.value)} />
        <input className={inputClass} placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        <input className={inputClass} placeholder="Genres (comma-separated)" value={genres} onChange={(e) => setGenres(e.target.value)} />
      </div>
      <textarea className={inputClass} rows="3" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <button className={buttonClass} disabled={busy}>
        Add movie
      </button>
    </form>
  )
}

function MovieDetail({ id, onClose }) {
  const [movie, setMovie] = useState(null)
  const [editing, setEditing] = useState(false)
  const [showCast, setShowCast] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const r = await json('GET', `/movies/${id}`)
    if (r.ok) setMovie(r.data)
    else setError(errText(r))
  }
  useEffect(() => {
    setMovie(null)
    setEditing(false)
    setShowCast(false)
    load()
  }, [id])

  async function remove() {
    if (!confirm(`Delete "${movie.title}" and all its dialogues?`)) return
    const r = await json('DELETE', `/movies/${id}`)
    if (r.ok) onClose()
    else setError(errText(r))
  }

  const cast = movie?.cast || []

  return (
    <section className="space-y-4">
      <button onClick={onClose} className={linkButtonClass}>
        ← Movies
      </button>
      <ErrorText>{error}</ErrorText>
      {movie && (
        <div className={cardClass + ' p-4'}>
          {editing ? (
            <EditMovie
              movie={movie}
              onSaved={() => {
                setEditing(false)
                load()
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="flex items-start gap-4">
              <Cover path={movie.poster_path} title={movie.title} large />
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-lg font-semibold">{movie.title}</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {[movie.director, movie.release_year].filter(Boolean).join(' · ')}
                </p>
                <Chips items={movie.genres} className="pt-1" />
                {movie.description && (
                  <p className="pt-2 text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">
                    {movie.description}
                  </p>
                )}
                {cast.length > 0 && (
                  <div className="pt-2">
                    <button className={linkButtonClass} onClick={() => setShowCast(!showCast)}>
                      {showCast ? 'hide cast' : `cast (${cast.length})`}
                    </button>
                    {showCast && (
                      <ul className="mt-2 space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        {cast.map((c, i) => (
                          <li key={i}>
                            {[c.character, c.actor].filter(Boolean).join(' — ')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button className={linkButtonClass} onClick={() => setEditing(true)}>
                    edit
                  </button>
                  <button
                    className={linkButtonClass}
                    onClick={() => (window.location.href = `/movies/${movie.id}/export`)}
                  >
                    export .md
                  </button>
                  <button className={deleteButtonClass} onClick={remove}>
                    delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {movie && <Dialogues movieId={movie.id} cast={cast} />}
    </section>
  )
}

function EditMovie({ movie, onSaved, onCancel }) {
  const [title, setTitle] = useState(movie.title || '')
  const [director, setDirector] = useState(movie.director || '')
  const [year, setYear] = useState(movie.release_year ? String(movie.release_year) : '')
  const [genres, setGenres] = useState((movie.genres || []).join(', '))
  const [description, setDescription] = useState(movie.description || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return setError('title is required')
    setBusy(true)
    setError('')
    const r = await json('PUT', `/movies/${movie.id}`, {
      title: title.trim(),
      director: director.trim(),
      release_year: year ? Number(year) : undefined,
      genres: splitCommas(genres),
      description: description.trim(),
    })
    setBusy(false)
    if (r.ok) onSaved()
    else setError(errText(r, 'could not save'))
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={inputClass} placeholder="Director" value={director} onChange={(e) => setDirector(e.target.value)} />
        <input className={inputClass} placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        <input className={inputClass} placeholder="Genres (comma-separated)" value={genres} onChange={(e) => setGenres(e.target.value)} />
      </div>
      <textarea className={inputClass} rows="4" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <button className={buttonClass} disabled={busy}>
          Save
        </button>
        <button type="button" className={ghostButtonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// dialogueState builds the full PUT body from a dialogue row — PUT is
// full-state, so every field must be carried even when only one changes.
function dialogueState(d) {
  return {
    quote: d.quote || '',
    note: d.note || '',
    character: d.character || '',
    actor: d.actor || '',
    timestamp: d.timestamp || '',
    tags: d.tags || [],
    favorite: !!d.favorite,
    rating: d.rating || 0,
  }
}

// Dialogues is the per-movie dialogue section: filters, add form, list.
// Server orders by (timestamp IS NULL), timestamp, id — rendered as served.
function Dialogues({ movieId, cast }) {
  const [items, setItems] = useState(null)
  const [tags, setTags] = useState([])
  const [tag, setTag] = useState('') // filter, '' = all
  const [fav, setFav] = useState(false) // filter: favorites only
  const [minRating, setMinRating] = useState('') // filter, '' = any
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const reqSeq = useRef(0)

  const castListId = `cast-characters-${movieId}`
  const characters = [...new Set(cast.map((c) => c.character).filter(Boolean))]

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
    if (minRating) params.set('min_rating', minRating)
    const r = await json('GET', `/dialogues?${params}`)
    if (seq !== reqSeq.current) return
    if (r.ok) setItems(r.data.dialogues)
    else setError(errText(r))
  }
  useEffect(() => {
    load()
  }, [movieId, tag, fav, minRating])
  useEffect(() => {
    loadTags()
  }, [movieId])

  async function add(fields) {
    const r = await json('POST', '/dialogues', { movie_id: movieId, ...fields })
    if (!r.ok) return errText(r, 'could not add dialogue')
    load()
    loadTags()
    return null
  }

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
    const r = await json('DELETE', `/dialogues/${d.id}`)
    if (r.ok) load()
    else setError(errText(r))
  }

  // patch PUTs a row's full current state with one field changed (star clicks).
  async function patch(d, fields) {
    const r = await json('PUT', `/dialogues/${d.id}`, { ...dialogueState(d), ...fields })
    if (!r.ok) return setError(errText(r, 'could not save dialogue'))
    setError('')
    load()
  }

  const filtering = tag || fav || minRating

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Dialogues
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFav(!fav)}
            className={filterChipClass(fav)}
            title="Only favorites"
          >
            ★ Favorites
          </button>
          <MinRatingSelect value={minRating} onChange={setMinRating} />
          {tags.length > 0 && (
            <select
              className={inputClass + ' w-auto py-1'}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {characters.length > 0 && (
        <datalist id={castListId}>
          {characters.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}

      <div className={cardClass + ' p-4'}>
        <DialogueForm onSubmit={add} submitLabel="Add dialogue" castListId={castListId} />
      </div>

      <ErrorText>{error}</ErrorText>
      {items && items.length === 0 && (
        <EmptyState>
          {filtering ? 'No dialogues match the filters.' : 'No dialogues yet — capture your first line above.'}
        </EmptyState>
      )}
      {items && items.length > 0 && (
        <ul className={cardClass + ' divide-y divide-neutral-200 dark:divide-neutral-800'}>
          {items.map((d) => (
            <li key={d.id} className="px-4 py-3">
              {editingId === d.id ? (
                <DialogueForm
                  initial={d}
                  onSubmit={(fields) => save(d.id, fields)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save"
                  castListId={castListId}
                />
              ) : (
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {d.timestamp && <span className={chipClass + ' font-mono'}>{d.timestamp}</span>}
                      {(d.character || d.actor) && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {[d.character, d.actor].filter(Boolean).join(' — ')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{d.quote}</p>
                    {d.note && (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 whitespace-pre-wrap">{d.note}</p>
                    )}
                    <Chips items={d.tags} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <FavoriteStar value={!!d.favorite} onChange={(v) => patch(d, { favorite: v })} />
                      <RatingStars value={d.rating || 0} onChange={(v) => patch(d, { rating: v })} />
                    </div>
                    <div className="flex gap-2">
                      <button className={linkButtonClass} onClick={() => setEditingId(d.id)}>
                        edit
                      </button>
                      <button className={deleteButtonClass} onClick={() => remove(d)}>
                        delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// DialogueForm serves both add (no initial) and inline edit (initial set).
// Leaving actor blank lets the server auto-fill it from the movie's cast.
function DialogueForm({ initial, onSubmit, onCancel, submitLabel, castListId }) {
  const [quote, setQuote] = useState(initial?.quote || '')
  const [character, setCharacter] = useState(initial?.character || '')
  const [actor, setActor] = useState(initial?.actor || '')
  const [timestamp, setTimestamp] = useState(initial?.timestamp || '')
  const [note, setNote] = useState(initial?.note || '')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!quote.trim()) return setError('quote is required')
    setBusy(true)
    setError('')
    const err = await onSubmit({
      quote: quote.trim(),
      note: note.trim(),
      character: character.trim(),
      actor: actor.trim(),
      timestamp: timestamp.trim(),
      tags: splitCommas(tags),
      // favorite/rating are edited on the row, not in the form — but PUT is
      // full-state, so carry the existing values through.
      favorite: !!initial?.favorite,
      rating: initial?.rating || 0,
    })
    setBusy(false)
    if (err) return setError(err)
    if (!initial) {
      setQuote('')
      setCharacter('')
      setActor('')
      setTimestamp('')
      setNote('')
      setTags('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        className={inputClass}
        rows="3"
        placeholder="Quote (required)"
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Character"
          list={castListId}
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="auto-filled from cast"
          title="Actor"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="HH:MM:SS"
          title="Timestamp"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
        />
      </div>
      <textarea
        className={inputClass}
        rows="2"
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Tags (comma-separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" className={ghostButtonClass} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className={buttonClass} disabled={busy}>
          {submitLabel}
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  )
}
