// Uploaded stickers: a user's library of transparent PNG/SVG images, managed on
// the Tags page and attachable one-per-quote in the add/edit forms. An attached
// sticker is the seal the quote text flows around (see flow.jsx / FlowQuote) —
// it replaces the old tag-derived wax seal. Backend: /stickers CRUD + a
// sticker_id column on annotations/dialogues (migrations 0011).
import { useCallback, useEffect, useRef, useState } from 'react'
import { json, upload, errText } from './api.js'
import { EmptyState, ErrorText, GhostButton, HandCard, MonoLabel } from './ui.jsx'

// Stored sticker files are served from the shared cover route (built directly,
// like Cover in ui.jsx — these don't go through the json/upload helpers).
export const stickerURL = (path) => `/api/covers/${path}`

// The file types the browser file-picker offers for a sticker (PNG/SVG first —
// the transparent formats the feature is built around).
const STICKER_ACCEPT = 'image/png,image/svg+xml,image/webp,image/gif,image/jpeg'

// useStickers loads the user's sticker library once and exposes a reload. Shared
// by the Tags-page manager, the add/edit pickers, and the card renderers (which
// map sticker_id → image via a {id: sticker} map the caller builds).
export function useStickers() {
  const [stickers, setStickers] = useState([])
  const reload = useCallback(async () => {
    const r = await json('GET', '/stickers')
    if (r.ok) setStickers(r.data.stickers)
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { stickers, reload }
}

// StickerImg renders an uploaded sticker as a contained transparent image — the
// seal pinned into a quote block. Sizing comes from FlowQuote's wrapper.
export function StickerImg({ sticker }) {
  if (!sticker) return null
  return (
    <img
      className="sticker-img"
      src={stickerURL(sticker.path)}
      alt={sticker.name || 'sticker'}
      draggable="false"
      aria-hidden="true"
    />
  )
}

// StickerPicker — the add/edit-form control: a scrollable strip of the user's
// stickers (click to select), a "none" option, and an upload tile that adds a
// new sticker and selects it. value is a sticker id or null.
export function StickerPicker({ value, onChange, stickers, reload }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = '' // let the same file be re-picked later
    if (!f) return
    setBusy(true)
    setError('')
    const r = await upload('/stickers', f)
    setBusy(false)
    if (!r.ok) return setError(errText(r, 'could not upload sticker'))
    await reload()
    onChange(r.data.id) // select the freshly uploaded sticker
  }

  return (
    <div className="space-y-2">
      <div className="sticker-strip">
        <button
          type="button"
          className={`sticker-opt sticker-none${value == null ? ' is-sel' : ''}`}
          onClick={() => onChange(null)}
          title="No sticker"
          aria-pressed={value == null}
        >
          none
        </button>
        {stickers.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`sticker-opt${value === s.id ? ' is-sel' : ''}`}
            onClick={() => onChange(s.id)}
            title={s.name || 'sticker'}
            aria-pressed={value === s.id}
          >
            <img src={stickerURL(s.path)} alt={s.name || 'sticker'} />
          </button>
        ))}
        <button
          type="button"
          className="sticker-opt sticker-add"
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={busy}
          title="Upload a new sticker"
        >
          {busy ? '…' : '＋'}
        </button>
        <input ref={fileRef} type="file" accept={STICKER_ACCEPT} hidden onChange={onFile} />
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

// StickerManager is the Tags-page section: upload, preview on a transparency
// checkerboard, rename inline, and delete. One sticker attaches per quote.
export function StickerManager() {
  const { stickers, reload } = useStickers()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    setError('')
    const r = await upload('/stickers', f)
    setBusy(false)
    if (!r.ok) return setError(errText(r, 'could not upload sticker'))
    reload()
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
            Stickers
          </h2>
          <p className="text-xs" style={{ color: 'var(--soft)' }}>
            transparent PNG or SVG images — attach one to any quote in its add/edit form
          </p>
        </div>
        <GhostButton type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
          {busy ? 'uploading…' : '＋ Upload sticker'}
        </GhostButton>
        <input ref={fileRef} type="file" accept={STICKER_ACCEPT} hidden onChange={onFile} />
      </div>
      <ErrorText>{error}</ErrorText>
      {stickers.length === 0 ? (
        <EmptyState>no stickers yet — upload a transparent PNG or SVG above</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stickers.map((s, i) => (
            <StickerCard key={s.id} sticker={s} index={i} onChanged={reload} />
          ))}
        </div>
      )}
    </section>
  )
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// StickerCard — one library sticker: preview, inline rename, usage counts, delete.
function StickerCard({ sticker, index, onChanged }) {
  const [name, setName] = useState(sticker.name || '')
  const [error, setError] = useState('')
  const uses = sticker.annotations + sticker.dialogues

  async function saveName() {
    const trimmed = name.trim()
    if (trimmed === (sticker.name || '')) return
    const r = await json('PUT', `/stickers/${sticker.id}`, { name: trimmed })
    if (!r.ok) setError(errText(r, 'could not rename'))
    else onChanged()
  }

  async function remove() {
    const detach = uses > 0 ? ` It will be detached from ${plural(uses, 'quote')} — they keep working, just without the seal.` : ''
    if (!confirm(`Delete this sticker?${detach}`)) return
    const r = await json('DELETE', `/stickers/${sticker.id}`)
    if (r.ok) onChanged()
    else setError(errText(r, 'could not delete sticker'))
  }

  return (
    <HandCard variant={index % 4} className="flex flex-col gap-2.5 p-5">
      <div className="sticker-swatch">
        <img src={stickerURL(sticker.path)} alt={sticker.name || 'sticker'} />
      </div>
      <input
        className="tp-input"
        placeholder="name…"
        maxLength={64}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
      <MonoLabel>{plural(sticker.annotations, 'annotation')} · {plural(sticker.dialogues, 'dialogue')}</MonoLabel>
      <ErrorText>{error}</ErrorText>
      <div className="mt-auto flex gap-3 pt-1">
        <button className="tp-link tp-link-danger" onClick={remove}>
          delete
        </button>
      </div>
    </HandCard>
  )
}
