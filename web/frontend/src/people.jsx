import { useEffect, useRef, useState } from 'react'
import { coverImgURL, json, errText } from './api.js'
import { ErrorText, Field, GhostButton, IconCheck, IconClose, IconDelete, IconEdit, MonoLabel, Placeholder } from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary'

export function personImgURL(path) {
  return coverImgURL(path)
}

// The external references a person can link out to, in display order. A saved
// link is recognised by hostname; everything else renders as a plain URL row.
export const PROVIDERS = [
  ['imdb', 'IMDb', /(^|\.)imdb\.com$/i],
  ['tmdb', 'TMDB', /(^|\.)themoviedb\.org$/i],
  ['tvdb', 'TheTVDB', /(^|\.)thetvdb\.com$/i],
  ['wikipedia', 'Wikipedia', /(^|\.)wikipedia\.org$/i],
  ['openlibrary', 'Open Library', /(^|\.)openlibrary\.org$/i],
]

// parseLinks splits the stored free-text links field into recognised provider
// pages (slug → url, first hit per provider wins) plus the unrecognised rest.
export function parseLinks(text) {
  const known = {}
  const extra = []
  for (const tok of String(text || '').split(/[\s\n]+/).filter(Boolean)) {
    let host = ''
    try {
      host = new URL(tok).hostname
    } catch {
      extra.push(tok)
      continue
    }
    const p = PROVIDERS.find(([, , re]) => re.test(host))
    if (p && !known[p[0]]) known[p[0]] = tok
    else extra.push(tok)
  }
  return { known, extra }
}

// mergeLinks folds freshly-fetched provider links into the stored free-text
// field without disturbing anything the user added by hand: providers land in
// canonical order, existing URLs win, extras keep their place at the end.
export function mergeLinks(text, fetched) {
  const { known, extra } = parseLinks(text)
  const merged = { ...known }
  for (const [slug, url] of Object.entries(fetched || {})) {
    if (url && !merged[slug]) merged[slug] = url
  }
  return [...PROVIDERS.map(([slug]) => merged[slug]).filter(Boolean), ...extra].join('\n')
}

// ProviderChips — the compact inline form of the link set (Metadata console
// cells): one small anchor chip per recognised provider.
export function ProviderChips({ links }) {
  const { known } = parseLinks(links)
  const items = PROVIDERS.filter(([slug]) => known[slug])
  if (items.length === 0) return <span className="microcopy">—</span>
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {items.map(([slug, label]) => (
        <a key={slug} className="tp-chip tp-chip-btn" href={known[slug]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ))}
    </span>
  )
}

// usePeople loads every saved metadata row for a kind ('author'|'actor') and
// returns a name→row map (for group-by portraits + quick presence checks) plus
// a reload to call after a save/delete.
export function usePeople(kind) {
  const [map, setMap] = useState({})
  async function reload() {
    const r = await json('GET', `/people?kind=${kind}`)
    if (r.ok) setMap(Object.fromEntries((r.data.people || []).map((p) => [p.name, p])))
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])
  return { map, reload }
}

// PersonName renders a name as a link that opens the metadata panel. onOpen is
// given { kind, name } — parents keep a single [person,setPerson] + PersonModal.
export function PersonName({ kind, name, onOpen, className = 'tp-link', style, children }) {
  if (!name) return null
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={(e) => {
        e.stopPropagation()
        onOpen({ kind, name })
      }}
      title={`${name} — details`}
    >
      {children || name}
    </button>
  )
}

// PersonPortrait — the small round portrait for a group-by heading (renders
// nothing when there's no saved image).
export function PersonPortrait({ person, size = 30 }) {
  if (!person?.image_path) return null
  return (
    <img
      src={personImgURL(person.image_path)}
      alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--ink-border)', flex: 'none' }}
    />
  )
}

function PersonView({ person, onEdit, onDelete }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {person.image_path ? (
          <img
            src={personImgURL(person.image_path)}
            alt=""
            className="w-24 shrink-0 rounded-lg object-cover"
            style={{ aspectRatio: '3 / 4', border: '1px solid var(--ink-border)' }}
          />
        ) : (
          <Placeholder kind="" className="w-24 shrink-0" />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          {person.born && <MonoLabel className="block">{person.born}</MonoLabel>}
          {person.bio && <p style={{ fontSize: 14, lineHeight: 1.55 }}>{person.bio}</p>}
          {person.links && (
            <div className="space-y-1">
              <MonoLabel className="block" style={{ color: 'var(--faint)' }}>reference pages</MonoLabel>
              <PersonLinksDetail links={person.links} />
            </div>
          )}
          {person.source && person.source !== 'manual' && (
            <MonoLabel className="block" style={{ color: 'var(--faint)' }}>via {person.source}</MonoLabel>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <GhostButton
          onClick={onDelete}
          className="inline-flex items-center gap-1.5"
          style={{ color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 55%, transparent)' }}
        >
          <IconDelete /> Delete
        </GhostButton>
        <button className={PRIMARY + ' inline-flex items-center gap-1.5'} onClick={onEdit}>
          <IconEdit /> Edit
        </button>
      </div>
    </div>
  )
}

// PersonLinksDetail renders the saved links for the details view: recognised
// providers as labelled chips (Open Library, IMDb, …), and anything else as a
// chip showing the bare link text — "wrapping like Open Library for known
// links, for unknown just show the link text".
function PersonLinksDetail({ links }) {
  const { known, extra } = parseLinks(links)
  const items = PROVIDERS.filter(([slug]) => known[slug])
  if (items.length === 0 && extra.length === 0) return <span className="microcopy">—</span>
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {items.map(([slug, label]) => (
        <a key={slug} className="tp-chip tp-chip-btn" href={known[slug]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ))}
      {extra.map((t) =>
        /^https?:\/\//i.test(t) ? (
          <a key={t} className="tp-chip tp-chip-btn" href={t} target="_blank" rel="noopener noreferrer">
            {t.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ) : (
          <span key={t} className="tp-chip">{t}</span>
        ),
      )}
    </span>
  )
}

function PersonForm({ kind, name, initial, onCancel, onSaved }) {
  const [bio, setBio] = useState(initial?.bio || '')
  const [born, setBorn] = useState(initial?.born || '')
  const [links, setLinks] = useState(initial?.links || '')
  const [imageUrl, setImageUrl] = useState('')
  const [clearImage, setClearImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    // Born is a year: 4 digits, or blank. (Same rule the year fields use.)
    if (born.trim() && !/^\d{4}$/.test(born.trim())) {
      return setError('born must be a 4-digit year (e.g. 1920)')
    }
    setBusy(true)
    setError('')
    const r = await json('PUT', '/people', {
      kind,
      name,
      bio: bio.trim(),
      born: born.trim(),
      links: links.trim(),
      source: initial?.source || 'manual',
      source_id: initial?.source_id || '',
      image_url: imageUrl.trim() || undefined,
      clear_image: clearImage || undefined,
    })
    setBusy(false)
    if (r.ok) onSaved(r.data)
    else setError(errText(r, 'could not save'))
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {initial?.image_path && !clearImage && (
        <div className="flex items-center gap-3">
          <img src={personImgURL(initial.image_path)} alt="" className="w-16 rounded object-cover" style={{ aspectRatio: '3 / 4' }} />
          <button type="button" className="tp-link tp-link-danger" onClick={() => setClearImage(true)}>
            remove photo
          </button>
        </div>
      )}
      <label className="block">
        <MonoLabel className="mb-1.5 block">Bio</MonoLabel>
        <textarea className="tp-input" rows="4" value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Born"
          value={born}
          onChange={(e) => setBorn(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="e.g. 1920"
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <MonoLabel>Photo URL</MonoLabel>
            {/* No keyless portrait API, so offer a web image search: find one,
                copy its address, paste it here (this field also takes any cover
                image URL). */}
            <button
              type="button"
              className="tp-link"
              style={{ fontSize: 11 }}
              onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name + ' ' + kind)}`, '_blank', 'noopener')}
            >
              search images ↗
            </button>
          </div>
          <input
            className="tp-input"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value)
              setClearImage(false)
            }}
            placeholder="https://… paste an image link"
          />
        </div>
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Links</MonoLabel>
        <textarea className="tp-input" rows="3" value={links} onChange={(e) => setLinks(e.target.value)} placeholder={'https://en.wikipedia.org/wiki/…\nhttps://openlibrary.org/authors/…'} />
        <p className="microcopy mt-1">one link per line — known sites (Wikipedia, Open Library, IMDb, TMDB, TheTVDB) are labelled automatically; anything else shows as-is.</p>
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onCancel}>
          <IconClose /> Cancel
        </GhostButton>
        <button className={PRIMARY + ' inline-flex items-center gap-1.5'} disabled={busy}>
          <IconCheck /> Save
        </button>
      </div>
    </form>
  )
}

// PersonLinkRows — the redirect menu itself: one full-width row per saved
// reference page, opening in a new tab. Unrecognised URLs trail as plain rows.
function PersonLinkRows({ links }) {
  const { known, extra } = parseLinks(links)
  const items = PROVIDERS.filter(([slug]) => known[slug])
  return (
    <>
      {items.map(([slug, label]) => (
        <a key={slug} className="person-link-row" href={known[slug]} target="_blank" rel="noopener noreferrer">
          <span>{label}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
      {extra.map((url) => (
        <a key={url} className="person-link-row" href={url} target="_blank" rel="noopener noreferrer">
          <span className="truncate">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </>
  )
}

// PersonModal — opened by clicking any author/actor name. Primarily a redirect
// menu: the person's saved reference pages (IMDb / TMDB / TheTVDB / Wikipedia /
// Open Library), auto-fetched on first open when nothing is saved yet. The
// bio/photo details live behind a secondary "Details" view.
export function PersonModal({ kind, name, onClose, onSaved }) {
  const [person, setPerson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  // Details (bio · photo · born · labelled links) is the default view when a
  // name is clicked; the compact links-only redirect menu is one tap away.
  const [details, setDetails] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [fetchNote, setFetchNote] = useState('')
  const [error, setError] = useState('')
  const enriched = useRef(false)

  useEffect(() => {
    let stale = false
    setLoading(true)
    json('GET', `/people?${new URLSearchParams({ kind, name })}`).then((r) => {
      if (stale) return
      setLoading(false)
      if (!r.ok) return setError(errText(r))
      setPerson(r.data.exists ? r.data.person : null)
      setEditing(false)
    })
    return () => {
      stale = true
    }
  }, [kind, name])

  // fetchLinks saves the person's reference pages, merged over anything already
  // there (other saved fields carried through untouched). `provided` skips the
  // /people/lookup call and uses the given map — that is how an author's links,
  // resolved from the SAME confident identity as the portrait, get stored
  // instead of a fresh (possibly namesake) lookup.
  async function fetchLinks(current, provided) {
    setFetching(true)
    setFetchNote('')
    let map = provided
    if (!map) {
      const r = await json('POST', '/people/lookup', { kind, name })
      if (!r.ok) {
        setFetching(false)
        return setFetchNote(errText(r, 'lookup failed'))
      }
      map = r.data.links
    }
    const merged = mergeLinks(current?.links, map)
    if (!merged) {
      setFetching(false)
      return setFetchNote('no reference pages found for this name')
    }
    if (merged !== (current?.links || '')) {
      const s = await json('PUT', '/people', {
        kind,
        name,
        bio: current?.bio || '',
        born: current?.born || '',
        links: merged,
        source: current?.source || 'lookup',
        source_id: current?.source_id || '',
      })
      if (s.ok) {
        setPerson(s.data)
        onSaved && onSaved()
      } else {
        setFetchNote(errText(s, 'could not save links'))
      }
    }
    setFetching(false)
  }

  // fetchPortrait pins the person to a stable identity and stores their photo,
  // resolved from the library itself (an actor from the film's stored cast, an
  // author via Open Library disambiguated by the books they wrote). Returns the
  // identity-resolved links, if any, so the caller can store those rather than a
  // fresh lookup. Best-effort — a miss just leaves the manual Photo URL field.
  async function fetchPortrait() {
    const r = await json('POST', '/people/portrait', { kind, name })
    if (!r.ok) return { person: null, links: null }
    if (r.data.person && r.data.person.id) {
      setPerson(r.data.person)
      onSaved && onSaved()
    }
    return { person: r.data.person, links: r.data.links }
  }

  // Auto-enrich on first open, sequenced so the links save can't clobber the
  // identity the portrait fetch just pinned: fetch the photo first (only when
  // one isn't saved), then fill links (only when none are), preferring the
  // identity-resolved links the portrait returned.
  useEffect(() => {
    if (loading || enriched.current) return
    enriched.current = true
    ;(async () => {
      let p = person
      let resolvedLinks = null
      if (!p?.image_path) {
        const out = await fetchPortrait()
        if (out.person && out.person.id) p = out.person
        if (out.links && Object.keys(out.links).length > 0) resolvedLinks = out.links
      }
      if (Object.keys(parseLinks(p?.links).known).length === 0) {
        await fetchLinks(p, resolvedLinks || undefined)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, person])

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  async function remove() {
    if (!person || !confirm(`Remove saved ${kind} metadata for “${name}”?`)) return
    const r = await json('DELETE', `/people/${person.id}`)
    if (r.ok) {
      onSaved && onSaved()
      onClose()
    } else setError(errText(r))
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      style={{ background: 'rgba(21,16,12,.55)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={name} className="hand-card hc-r2 mx-auto w-full max-w-md px-6 py-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PersonPortrait person={person} size={40} />
            <div className="min-w-0">
              <MonoLabel>{kind}</MonoLabel>
              <h2 className="display-title truncate text-xl">{name}</h2>
            </div>
          </div>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </div>
        <ErrorText>{error}</ErrorText>
        {loading ? (
          <p className="microcopy">loading…</p>
        ) : editing ? (
          <PersonForm
            kind={kind}
            name={name}
            initial={person}
            onCancel={() => setEditing(false)}
            onSaved={(p) => {
              setPerson(p)
              setEditing(false)
              onSaved && onSaved()
            }}
          />
        ) : details ? (
          <div className="space-y-3">
            {person ? (
              <PersonView person={person} onEdit={() => setEditing(true)} onDelete={remove} />
            ) : (
              <>
                <p className="microcopy">nothing saved yet</p>
                <div className="flex justify-end">
                  <button className={PRIMARY} onClick={() => setEditing(true)}>Add details</button>
                </div>
              </>
            )}
            <button className="tp-link" onClick={() => setDetails(false)}>← back to links</button>
          </div>
        ) : (
          <div className="space-y-2">
            <PersonLinkRows links={person?.links} />
            {fetching && <p className="microcopy">looking up reference pages…</p>}
            {!fetching && fetchNote && <p className="microcopy">{fetchNote}</p>}
            {!fetching && !fetchNote && Object.keys(parseLinks(person?.links).known).length === 0 && (
              <p className="microcopy">no reference pages saved yet</p>
            )}
            <div className="flex items-center justify-between gap-2 pt-2" style={{ borderTop: '1px solid var(--line)' }}>
              <button className="tp-link" onClick={() => setDetails(true)}>details…</button>
              <button className="tp-link" disabled={fetching} onClick={() => fetchLinks(person)}>
                refetch links
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
