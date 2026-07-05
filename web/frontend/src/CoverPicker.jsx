// Shared cover/poster editing + metadata look-up used by the book and movie
// edit views. Three ways to set a cover (§ user request): pick from an API
// match, paste an image URL, or upload a file. Amazon covers are derived from
// the ASIN with no cookie needed.
import { useState } from 'react'
import { json, upload, errText } from './api.js'
import { GhostButton, MonoLabel, Placeholder, ErrorText } from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary'

// amazonCoverURL builds Amazon's public image-CDN URL for a cover from an ASIN
// (mirrors metadata.AmazonCoverURL). No auth required; the server fetches it on
// save via the user-URL path.
export function amazonCoverURL(asin) {
  const a = (asin || '').trim()
  return a ? `https://images-na.ssl-images-amazon.com/images/P/${a}.01._SCLZZZZZZZ_.jpg` : ''
}

// CoverPreview renders a pending remote URL or the locally-stored file at 2:3.
// Remote hosts outside the CSP allowlist can't paint — onError swaps to a note.
function CoverPreview({ url, label }) {
  const [broke, setBroke] = useState(false)
  if (url && !broke) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setBroke(true)}
        className="block w-20 shrink-0 object-cover"
        style={{ aspectRatio: '2 / 3', border: '1px solid var(--ink-border)', borderRadius: 8 }}
      />
    )
  }
  if (url && broke) {
    return (
      <span
        className="flex w-20 shrink-0 items-center justify-center px-1 text-center"
        style={{ aspectRatio: '2 / 3', border: '1px dashed var(--ink-border)', borderRadius: 8 }}
      >
        <MonoLabel style={{ fontSize: 9, lineHeight: 1.3 }}>preview blocked — will fetch on save</MonoLabel>
      </span>
    )
  }
  return <Placeholder kind={label} className="w-20 shrink-0" />
}

// CoverControls: preview + set/replace/clear. The parent owns the pending
// {coverUrl, clearCover} that ride along in its Save PUT; file upload is
// immediate (its own endpoint) and calls onUploaded with the refreshed record.
// kind is the route segment: "books" | "movies".
export function CoverControls({
  kind, id, currentPath, asin,
  coverUrl, clearCover, onSetUrl, onClear, onUploaded,
}) {
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlText, setUrlText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const label = kind === 'movies' ? 'POSTER' : 'COVER'

  // Preview precedence: a pending URL, else the cleared placeholder, else the
  // currently stored file.
  const previewUrl = coverUrl || (!clearCover && currentPath ? `/covers/${currentPath}` : '')

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = '' // allow re-picking the same file
    if (!f) return
    setBusy(true)
    setErr('')
    const r = await upload(`/${kind}/${id}/cover`, f)
    setBusy(false)
    if (r.ok) {
      onClear(true) // reset any pending URL/clear — the upload already applied
      onUploaded(r.data)
    } else {
      setErr(errText(r, 'upload failed'))
    }
  }

  return (
    <div className="flex gap-4" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
      <CoverPreview url={previewUrl} label={label} />
      <div className="min-w-0 flex-1 space-y-2">
        <MonoLabel className="block">{label}</MonoLabel>
        <div className="flex flex-wrap gap-2">
          <label className={PRIMARY} style={{ cursor: 'pointer' }}>
            {busy ? 'Uploading…' : 'Upload file'}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
          <GhostButton type="button" onClick={() => setUrlOpen((v) => !v)}>
            Paste URL
          </GhostButton>
          {asin && asin.trim() && (
            <GhostButton type="button" onClick={() => onSetUrl(amazonCoverURL(asin))} title="Use Amazon's cover image for this ASIN">
              Amazon cover
            </GhostButton>
          )}
          {(currentPath || coverUrl) && !clearCover && (
            <GhostButton
              type="button"
              style={{ color: 'var(--error)' }}
              onClick={onClear}
            >
              Remove
            </GhostButton>
          )}
        </div>
        {urlOpen && (
          <div className="flex gap-2 pt-1">
            <input
              className="tp-input"
              placeholder="https://… direct image link"
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
            />
            <GhostButton
              type="button"
              onClick={() => {
                if (urlText.trim()) onSetUrl(urlText.trim())
                setUrlOpen(false)
                setUrlText('')
              }}
            >
              Set
            </GhostButton>
          </div>
        )}
        {coverUrl && <p className="microcopy">new {label.toLowerCase()} — applies when you Save</p>}
        {clearCover && <p className="microcopy" style={{ color: 'var(--error)' }}>{label.toLowerCase()} will be removed on Save</p>}
        <ErrorText>{err}</ErrorText>
      </div>
    </div>
  )
}

// BookLookupPicker queries POST /books/lookup with the current isbn/title/asin
// and lists matches with a real cover thumbnail. Picking one hands the whole
// candidate back so the form can adopt its fields + cover.
export function BookLookupPicker({ isbn, title, asin, onPick }) {
  const [cands, setCands] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function look() {
    setBusy(true)
    setErr('')
    setCands(null)
    const body = {}
    if (isbn && isbn.trim()) body.isbn = isbn.trim()
    if (title && title.trim()) body.title = title.trim()
    if (asin && asin.trim()) body.asin = asin.trim()
    if (!body.isbn && !body.title && !body.asin) {
      setBusy(false)
      return setErr('enter a title, ISBN, or ASIN first')
    }
    const r = await json('POST', '/books/lookup', body)
    setBusy(false)
    if (r.ok) setCands(r.data.candidates)
    else setErr(errText(r, 'lookup failed'))
  }

  return (
    <div className="space-y-2">
      <GhostButton type="button" onClick={look} disabled={busy}>
        {busy ? 'Looking up…' : 'Look up metadata & cover'}
      </GhostButton>
      <ErrorText>{err}</ErrorText>
      {cands && cands.length === 0 && <p className="microcopy">no matches — try editing the title or ISBN</p>}
      {cands && cands.length > 0 && (
        <ul className="space-y-2">
          {cands.map((c, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{ border: '1px solid var(--line)' }}
            >
              <CoverPreview url={c.cover_url} label="" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <p className="truncate text-xs" style={{ color: 'var(--soft)' }}>
                  {[c.author, c.published_year || null, c.isbn13].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="tp-chip shrink-0">{(c.source || '').toUpperCase()}</span>
              <GhostButton type="button" className="shrink-0" onClick={() => onPick(c)}>
                Use
              </GhostButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// MovieLookupPicker searches TMDB + TVDB (title + year, for the given
// media_type) and, on pick, hands the whole candidate back so the caller can
// re-sync from its source (poster, cast, genres, details).
export function MovieLookupPicker({ title, year, mediaType = 'movie', onPick }) {
  const [q, setQ] = useState(title || '')
  const [yr, setYr] = useState(year ? String(year) : '')
  const [cands, setCands] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function look(e) {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true)
    setErr('')
    setCands(null)
    const body = { title: q.trim(), media_type: mediaType }
    if (yr) body.year = Number(yr)
    const r = await json('POST', '/movies/lookup', body)
    setBusy(false)
    if (r.ok) setCands(r.data.candidates)
    else setErr(errText(r, 'lookup failed'))
  }

  return (
    <div className="space-y-2">
      <form onSubmit={look} className="flex gap-2">
        <input className="tp-input" placeholder="Title" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="tp-input w-24 shrink-0" placeholder="Year" inputMode="numeric" value={yr} onChange={(e) => setYr(e.target.value)} />
        <GhostButton type="submit" className="shrink-0" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </GhostButton>
      </form>
      <ErrorText>{err}</ErrorText>
      {cands && cands.length === 0 && <p className="microcopy">no matches found</p>}
      {cands && cands.length > 0 && (
        <ul style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
          {cands.map((c, i) => (
            <li
              key={`${c.source}-${c.source_id || c.tmdb_id}`}
              className="flex items-center gap-3 px-3 py-2.5"
              style={i > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {c.title}
                  {c.release_year ? <span className="ml-2 font-normal" style={{ color: 'var(--soft)' }}>{c.release_year}</span> : null}
                </p>
                {c.overview && <p className="line-clamp-2 text-xs" style={{ color: 'var(--faint)' }}>{c.overview}</p>}
              </div>
              <span className="tp-chip shrink-0" style={{ color: 'var(--amber)' }}>
                {(c.source || 'tmdb').toUpperCase()} #{c.source === 'tvdb' ? c.source_id : c.tmdb_id || c.source_id}
              </span>
              <GhostButton type="button" className="shrink-0" onClick={() => onPick(c)}>
                Use
              </GhostButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
