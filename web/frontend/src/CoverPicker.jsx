// Shared cover/poster editing + metadata look-up used by the book and movie
// edit views. Three ways to set a cover (§ user request): pick from an API
// match, paste an image URL, or upload a file. Amazon covers are derived from
// the ASIN with no cookie needed.
import { useState } from 'react'
import { coverImgURL, json, upload, errText } from './api.js'
import { GhostButton, MonoLabel, Placeholder, ErrorText } from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary'

// amazonCoverURL builds Amazon's public image-CDN URL for a cover from an ASIN
// (mirrors metadata.AmazonCoverURL — keep the two in sync). No size modifier =
// the original full-size scan. No auth required; the server fetches it on save
// via the user-URL path.
export function amazonCoverURL(asin) {
  const a = (asin || '').trim()
  return a ? `https://images-na.ssl-images-amazon.com/images/P/${a}.01.jpg` : ''
}

// LOW_RES_W mirrors the server's refetch threshold (lowResCoverWidth): covers
// narrower than this are the thumbnail-sized ones worth avoiding when a bigger
// option is on offer.
const LOW_RES_W = 500

// resLabel formats measured natural dimensions as "W×H"; "" until the image
// loads (or if it fails to).
function resLabel(dim) {
  return dim && dim.w ? `${dim.w}×${dim.h}` : ''
}

// CoverPreview renders a pending remote URL or the locally-stored file at 2:3.
// Remote hosts outside the CSP allowlist can't paint — onError swaps to a note.
// `showRes` overlays the image's true pixel size once it loads, and tints the
// badge when it's below the low-res threshold, so a small scan is obvious.
export function CoverPreview({ url, label, showRes = false, className = 'w-20 shrink-0' }) {
  const [broke, setBroke] = useState(false)
  const [dim, setDim] = useState(null)
  if (url && !broke) {
    const lowRes = dim && dim.w > 0 && dim.w < LOW_RES_W
    const img = (
      <img
        src={url}
        alt=""
        onError={() => setBroke(true)}
        onLoad={showRes ? (e) => setDim({ w: e.target.naturalWidth, h: e.target.naturalHeight }) : undefined}
        className={'block w-full object-cover'}
        style={{ aspectRatio: '2 / 3', border: '1px solid var(--ink-border)', borderRadius: 8 }}
      />
    )
    if (!showRes) return <span className={'block ' + className}>{img}</span>
    return (
      <span className={'relative block ' + className}>
        {img}
        {resLabel(dim) && (
          <span className={'cover-res-badge' + (lowRes ? ' is-low' : '')}>{resLabel(dim)}</span>
        )}
      </span>
    )
  }
  if (url && broke) {
    return (
      <span
        className={'flex items-center justify-center px-1 text-center ' + className}
        style={{ aspectRatio: '2 / 3', border: '1px dashed var(--ink-border)', borderRadius: 8 }}
      >
        <MonoLabel style={{ fontSize: 9, lineHeight: 1.3 }}>preview blocked — will fetch on save</MonoLabel>
      </span>
    )
  }
  return <Placeholder kind={label} className={className} />
}

// hiResPoster upgrades a TMDB picker-thumbnail URL (w342) to the original so
// what gets stored from a cover search is full quality, not the preview size.
const hiResPoster = (u) => (u || '').replace('/t/p/w342/', '/t/p/original/')

// CoverControls: preview + set/replace/clear. The parent owns the pending
// {coverUrl, clearCover} that ride along in its Save PUT; file upload is
// immediate (its own endpoint) and calls onUploaded with the refreshed record.
// kind is the route segment: "books" | "movies". `search` carries the live
// form fields the cover search queries with ({isbn,title,asin} for books,
// {title,year,mediaType} for movies).
export function CoverControls({
  kind, id, currentPath, asin,
  coverUrl, clearCover, onSetUrl, onClear, onUploaded,
  onFetchMeta, fetchingMeta, search,
}) {
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlText, setUrlText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [covers, setCovers] = useState(null) // null = closed; [] = searched, none found
  const [searching, setSearching] = useState(false)
  const label = kind === 'movies' ? 'POSTER' : 'COVER'

  // searchCovers queries every metadata source for this item and collects the
  // candidate covers at storage quality: Google Books (hi-res render) / Open
  // Library (-L) / Amazon (full-size by ASIN) for books; TMDB (original) and
  // TheTVDB art for films & shows. Picking one stages it like Paste URL does.
  async function searchCovers() {
    setSearching(true)
    setErr('')
    setCovers(null)
    const found = []
    const seen = new Set()
    const add = (url, source) => {
      if (url && !seen.has(url)) {
        seen.add(url)
        found.push({ url, source })
      }
    }
    if (kind === 'movies') {
      const r = await json('POST', '/movies/lookup', {
        title: (search?.title || '').trim(),
        year: search?.year ? Number(search.year) : undefined,
        media_type: search?.mediaType || 'movie',
      })
      if (!r.ok) {
        setSearching(false)
        return setErr(errText(r, 'lookup failed'))
      }
      for (const c of r.data.candidates || []) add(hiResPoster(c.poster_url), c.source === 'tvdb' ? 'TVDB' : 'TMDB')
    } else {
      const body = {}
      if (search?.isbn?.trim()) body.isbn = search.isbn.trim()
      if (search?.title?.trim()) body.title = search.title.trim()
      if (search?.author?.trim()) body.author = search.author.trim()
      if (search?.asin?.trim()) body.asin = search.asin.trim()
      const r = await json('POST', '/books/lookup', body)
      if (!r.ok) {
        setSearching(false)
        return setErr(errText(r, 'lookup failed'))
      }
      for (const c of r.data.candidates || [])
        add(c.cover_url, c.source === 'openlibrary' ? 'OPEN LIBRARY' : c.source === 'amazon' ? 'AMAZON' : 'GOOGLE')
      if (search?.asin?.trim()) add(amazonCoverURL(search.asin), 'AMAZON')
    }
    setSearching(false)
    setCovers(found)
  }

  // Preview precedence: a pending URL, else the cleared placeholder, else the
  // currently stored file.
  const previewUrl = coverUrl || (!clearCover && currentPath ? coverImgURL(currentPath) : '')

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
    <div className="flex items-start gap-4" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
      <CoverPreview url={previewUrl} label={label} />
      <div className="min-w-0 flex-1 space-y-2">
        <MonoLabel className="block">{label}</MonoLabel>
        <div className="flex flex-wrap gap-2">
          <label className={PRIMARY} style={{ cursor: 'pointer' }}>
            {busy ? 'Uploading…' : 'Upload file'}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
          {onFetchMeta && (
            <GhostButton type="button" onClick={onFetchMeta} disabled={fetchingMeta} title="Fetch title, author, year, genres, series & cover from the metadata providers">
              {fetchingMeta ? 'Fetching…' : 'Fetch metadata'}
            </GhostButton>
          )}
          <GhostButton type="button" onClick={() => setUrlOpen((v) => !v)}>
            Paste URL
          </GhostButton>
          <GhostButton
            type="button"
            onClick={searchCovers}
            disabled={searching}
            title={kind === 'movies'
              ? 'Search TMDB and TheTVDB for high-quality posters to pick from'
              : 'Search Google Books, Open Library and Amazon for high-quality covers to pick from'}
          >
            {searching ? 'Searching…' : 'Search covers'}
          </GhostButton>
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
        {covers && (
          <div className="space-y-1.5 pt-1">
            <MonoLabel className="block">
              {covers.length ? `pick a ${label.toLowerCase()} — resolution shown; larger is sharper` : `no ${label.toLowerCase()}s found`}
            </MonoLabel>
            <div className="flex flex-wrap gap-2">
              {covers.map((c) => (
                <CoverPickThumb
                  key={c.url}
                  url={c.url}
                  source={c.source}
                  label={label}
                  onPick={() => {
                    onSetUrl(c.url)
                    setCovers(null)
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {coverUrl && <p className="microcopy">new {label.toLowerCase()} — applies when you Save</p>}
        {clearCover && <p className="microcopy" style={{ color: 'var(--error)' }}>{label.toLowerCase()} will be removed on Save</p>}
        <ErrorText>{err}</ErrorText>
      </div>
    </div>
  )
}

// CoverPickThumb is one candidate in the "Search covers" grid: the image, its
// source, and its true pixel size measured on load. A cover below the low-res
// threshold is dimmed and badge-tinted so the user reaches for a bigger one.
function CoverPickThumb({ url, source, label, onPick }) {
  const [dim, setDim] = useState(null)
  const [hide, setHide] = useState(false)
  if (hide) return null
  const lowRes = dim && dim.w > 0 && dim.w < LOW_RES_W
  return (
    <button
      type="button"
      className={'cover-pick' + (lowRes ? ' is-low' : '')}
      title={`${source} · ${resLabel(dim) || 'loading…'} — use this ${label.toLowerCase()}`}
      onClick={onPick}
    >
      <span className="relative block">
        <img
          src={url}
          alt=""
          loading="lazy"
          onLoad={(e) => setDim({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          onError={() => setHide(true)}
        />
        {resLabel(dim) && <span className={'cover-res-badge' + (lowRes ? ' is-low' : '')}>{resLabel(dim)}</span>}
      </span>
      <span className="microcopy">{source}</span>
    </button>
  )
}

// BookLookupPicker queries POST /books/lookup with the current isbn/title/asin
// and lists matches with a real cover thumbnail. Picking one hands the whole
// candidate back so the form can adopt its fields + cover.
export function BookLookupPicker({ isbn, title, author, asin, onPick }) {
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
    if (author && author.trim()) body.author = author.trim()
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
        {busy ? 'Looking up…' : 'Browse other matches…'}
      </GhostButton>
      <ErrorText>{err}</ErrorText>
      {cands && cands.length === 0 && <p className="microcopy">no matches — try editing the title or ISBN</p>}
      {cands && cands.length > 0 && (
        <ul className="lookup-grid">
          {cands.map((c, i) => (
            <li key={i} className="lookup-card">
              <button type="button" className="lookup-card-cover" onClick={() => onPick(c)} title={`Use: ${c.title}`}>
                <CoverPreview url={c.cover_url} label="" showRes className="w-full" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={c.title}>{c.title}</p>
                <p className="truncate text-xs" style={{ color: 'var(--soft)' }}>
                  {[c.author, c.published_year || null].filter(Boolean).join(' · ')}
                </p>
                {c.series && (
                  <p className="truncate text-xs" style={{ color: 'var(--accent-ui)' }}>
                    {c.series}{c.series_index ? ` #${c.series_index}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="tp-chip shrink-0" style={{ fontSize: 9.5 }}>{(c.source || '').toUpperCase()}</span>
                <GhostButton type="button" className="shrink-0" onClick={() => onPick(c)}>
                  Use
                </GhostButton>
              </div>
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

  // NB: this picker lives inside the movie edit <form>, so it must NOT render a
  // nested <form> of its own — a nested form's submit escapes to the outer form
  // and reloads the page (the "search bounces to the homepage" bug). Search is a
  // plain button + Enter handler instead.
  async function look() {
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
  const onEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      look()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="tp-input" placeholder="Title" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onEnter} />
        <input className="tp-input w-24 shrink-0" placeholder="Year" inputMode="numeric" value={yr} onChange={(e) => setYr(e.target.value)} onKeyDown={onEnter} />
        <GhostButton type="button" className="shrink-0" onClick={look} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </GhostButton>
      </div>
      <ErrorText>{err}</ErrorText>
      {cands && cands.length === 0 && <p className="microcopy">no matches found</p>}
      {cands && cands.length > 0 && (
        <ul className="lookup-grid">
          {cands.map((c) => (
            <li key={`${c.source}-${c.source_id || c.tmdb_id}`} className="lookup-card">
              <button type="button" className="lookup-card-cover" onClick={() => onPick(c)} title={`Use: ${c.title}`}>
                <CoverPreview url={c.poster_url} label="" showRes className="w-full" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={c.title}>{c.title}</p>
                {c.release_year ? <p className="truncate text-xs" style={{ color: 'var(--soft)' }}>{c.release_year}</p> : null}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="tp-chip shrink-0" style={{ color: 'var(--amber)', fontSize: 9.5 }}>
                  {(c.source || 'tmdb').toUpperCase()}
                </span>
                <GhostButton type="button" className="shrink-0" onClick={() => onPick(c)}>
                  Use
                </GhostButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
