import { useEffect, useRef, useState } from 'react'
import { coverImgURL, json, errText } from './api.js'
import { ErrorText, Field, GhostButton, MonoLabel, Placeholder } from './ui.jsx'

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
          {person.links && <PersonLinks links={person.links} />}
          {person.source && person.source !== 'manual' && (
            <MonoLabel className="block" style={{ color: 'var(--faint)' }}>via {person.source}</MonoLabel>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <GhostButton
          onClick={onDelete}
          style={{ color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 55%, transparent)' }}
        >
          Delete
        </GhostButton>
        <button className={PRIMARY} onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  )
}

// PersonLinks renders whitespace/newline-separated tokens; URL-looking ones
// become anchors (new tab, rel-safe), the rest plain text.
function PersonLinks({ links }) {
  const parts = String(links).split(/[\s\n]+/).filter(Boolean)
  return (
    <p className="text-[13px]" style={{ color: 'var(--soft)' }}>
      {parts.map((t, i) =>
        /^https?:\/\//i.test(t) ? (
          <a key={i} href={t} target="_blank" rel="noopener noreferrer" className="tp-link" style={{ marginRight: 8 }}>
            {t.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ) : (
          <span key={i} style={{ marginRight: 8 }}>{t}</span>
        ),
      )}
    </p>
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
        <Field label="Born" value={born} onChange={(e) => setBorn(e.target.value)} placeholder="e.g. 1920" />
        <Field
          label="Photo URL"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value)
            setClearImage(false)
          }}
          placeholder="https://…"
        />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">Links</MonoLabel>
        <textarea className="tp-input" rows="2" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="homepage · wikipedia · …" />
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onCancel}>
          Cancel
        </GhostButton>
        <button className={PRIMARY} disabled={busy}>
          Save
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
  const [details, setDetails] = useState(false) // secondary bio/photo view
  const [fetching, setFetching] = useState(false)
  const [fetchNote, setFetchNote] = useState('')
  const [error, setError] = useState('')
  const autoFetched = useRef(false)

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

  // fetchLinks resolves the person's reference pages and saves the merged
  // links (other saved fields carried over untouched).
  async function fetchLinks(current) {
    setFetching(true)
    setFetchNote('')
    const r = await json('POST', '/people/lookup', { kind, name })
    if (!r.ok) {
      setFetching(false)
      return setFetchNote(errText(r, 'lookup failed'))
    }
    const merged = mergeLinks(current?.links, r.data.links)
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

  // Autofetch wherever possible: first open with no provider links saved.
  useEffect(() => {
    if (loading || autoFetched.current) return
    if (Object.keys(parseLinks(person?.links).known).length > 0) return
    autoFetched.current = true
    fetchLinks(person)
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
