import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import { ErrorText, Field, GhostButton, MonoLabel, Placeholder } from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary'

export function personImgURL(path) {
  return path ? `/api/covers/${path}` : ''
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

// PersonModal — the metadata panel for one author/actor, opened by clicking a
// name. Loads the saved row (or drops straight into an empty edit form), lets
// you view / edit / delete. Auto-fetch (Open Library / Amazon / TMDB / TheTVDB)
// is layered on in the lookups stage.
export function PersonModal({ kind, name, onClose, onSaved }) {
  const [person, setPerson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let stale = false
    setLoading(true)
    json('GET', `/people?${new URLSearchParams({ kind, name })}`).then((r) => {
      if (stale) return
      setLoading(false)
      if (!r.ok) return setError(errText(r))
      if (r.data.exists) {
        setPerson(r.data.person)
        setEditing(false)
      } else {
        setPerson(null)
        setEditing(true) // nothing saved yet → straight to the form
      }
    })
    return () => {
      stale = true
    }
  }, [kind, name])

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
      <div role="dialog" aria-modal="true" aria-label={name} className="hand-card hc-r2 mx-auto w-full max-w-lg px-6 py-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <MonoLabel>{kind}</MonoLabel>
            <h2 className="display-title truncate text-xl">{name}</h2>
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
            onCancel={person ? () => setEditing(false) : onClose}
            onSaved={(p) => {
              setPerson(p)
              setEditing(false)
              onSaved && onSaved()
            }}
          />
        ) : (
          <PersonView person={person} onEdit={() => setEditing(true)} onDelete={remove} />
        )}
      </div>
    </div>
  )
}
