// Shared cover/poster editing + metadata look-up used by the book and movie
// edit views. Three ways to set a cover (§ user request): pick from an API
// match, paste an image URL, or upload a file. Amazon covers are derived from
// the ASIN with no cookie needed.
import { useEffect, useState } from 'react'
import { coverImgURL, json, upload, errText } from './api.js'
import {
  ErrorText,
  GhostButton,
  IconDelete,
  IconLink,
  IconMetadata,
  IconPlus,
  IconSearch,
  IconUpload,
  MonoLabel,
  Placeholder,
  SourceIcon,
  Tooltip,
  normName,
} from './ui.jsx'

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
// `compact` is for the narrow in-row thumb (the look-up candidate list): the
// "preview blocked" note is unreadable at ~36px, so there a failed load falls
// back to the plain striped Placeholder instead.
export function CoverPreview({ url, label, showRes = false, compact = false, className = 'w-20 shrink-0' }) {
  const [broke, setBroke] = useState(false)
  const [dim, setDim] = useState(null)
  if (url && !broke) {
    const lowRes = dim && dim.w > 0 && dim.w < LOW_RES_W
    const img = (
      <img
        src={url}
        alt=""
        loading="lazy"
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
  if (url && broke && !compact) {
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
  onFetchMeta, fetchMetaOpen, search,
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
        {/* §7 declutter: cover controls collapse to icon buttons with tooltips
            (upload · fetch metadata · paste URL · search covers · remove) so the
            edit form stops burning a whole labelled row on them. */}
        <div className="cover-ctl-row">
          <Tooltip label={busy ? 'Uploading…' : `Upload a ${label.toLowerCase()} image`}>
            <label className={'cover-icon-btn tactile' + (busy ? ' is-busy' : '')} aria-label={`Upload ${label.toLowerCase()} image`}>
              <IconUpload />
              <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
            </label>
          </Tooltip>
          {onFetchMeta && (
            <Tooltip label="Fetch metadata — pick the right edition to fill the fields below">
              <button
                type="button"
                className={'cover-icon-btn tactile' + (fetchMetaOpen ? ' is-active' : '')}
                aria-label="Fetch metadata"
                aria-pressed={!!fetchMetaOpen}
                onClick={onFetchMeta}
              >
                <IconMetadata />
              </button>
            </Tooltip>
          )}
          <Tooltip label="Paste an image URL">
            <button
              type="button"
              className={'cover-icon-btn tactile' + (urlOpen ? ' is-active' : '')}
              aria-label="Paste image URL"
              aria-pressed={urlOpen}
              onClick={() => setUrlOpen((v) => !v)}
            >
              <IconLink />
            </button>
          </Tooltip>
          <Tooltip
            label={kind === 'movies'
              ? 'Search TMDB & TheTVDB for high-quality posters'
              : 'Search Google Books, Open Library & Amazon for high-quality covers'}
          >
            <button
              type="button"
              className={'cover-icon-btn tactile' + (searching ? ' is-busy' : '')}
              aria-label={`Search ${label.toLowerCase()}s`}
              onClick={searchCovers}
              disabled={searching}
            >
              <IconSearch />
            </button>
          </Tooltip>
          {(currentPath || coverUrl) && !clearCover && (
            <Tooltip label={`Remove ${label.toLowerCase()}`}>
              <button
                type="button"
                className="cover-icon-btn cover-icon-btn-danger tactile"
                aria-label={`Remove ${label.toLowerCase()}`}
                onClick={onClear}
              >
                <IconDelete />
              </button>
            </Tooltip>
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

// ---- look-up candidate rows (shared by the Add surface and the edition picker) ----

// groupEditions folds a flat candidate list into per-work groups. /books/lookup
// merges Google + Open Library (+ Amazon on the ASIN path) and returns one row
// per printing, so five editions of Dune arrive as five rows.
//
// The rule is STRICT, as asked: identical title AND identical author once folded
// by normName (case, diacritics and punctuation only). "Dune" and "Dune: Book
// One" deliberately do NOT group — loosening this to match on a subtitle prefix
// would fuse genuinely different works, and un-fusing is the unrecoverable
// direction. A candidate whose folded title or author is empty always stands
// alone: normName is Latin-only, so a Bengali or CJK title folds to "" and would
// otherwise sweep every non-Latin result into one bucket, and Google volumes
// with no `authors` array all fold to the same empty author.
//
// Order is preserved: groups appear at the position of their first (best-ranked)
// member, and that member is the representative. The group's cover is the first
// member that has one, so a coverless best match still shows art.
export function groupEditions(cands) {
  const out = []
  const byKey = new Map()
  for (const c of cands || []) {
    const nt = normName(c.title)
    const na = normName(c.author)
    const key = nt && na ? `${nt} ${na}` : null
    const hit = key && byKey.get(key)
    if (hit) {
      hit.editions.push(c)
      if (!hit.cover_url) hit.cover_url = c.cover_url || ''
      continue
    }
    const g = { rep: c, editions: [c], cover_url: c.cover_url || '' }
    if (key) byKey.set(key, g)
    out.push(g)
  }
  return out
}

// CandidateRow — one compact look-up match, shared by the Add surface and the
// edition picker. The old row spent ~145px of a ~256px phone row on a
// "GOOGLE BOOKS" text pill plus a bordered "Add" button and truncated the title
// to nothing, so: a real cover thumb (the payload has carried cover_url all
// along, and the CDNs are already CSP-allowlisted), the source as a 16px mark,
// and a borderless "+" disc. Everything freed goes to title + author.
//
// `count` > 1 marks a group of editions. The cue is deliberately subtle — a
// mono edition count where a single row shows nothing — because a group is not
// a different kind of thing, just a tidier row.
export function CandidateRow({ cover, title, sub, source, sourceDetail, count = 1, expanded, onAdd, addLabel = 'Add', busy = false }) {
  const group = count > 1
  return (
    <li className="sheen-raised flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--line)' }}>
      <CoverPreview url={cover} label="" compact className="w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={title}>{title}</p>
        <p className="truncate text-xs" style={{ color: 'var(--soft)' }}>{sub}</p>
      </div>
      {group ? (
        <MonoLabel style={{ flex: 'none', fontSize: 9.5 }}>{count} eds</MonoLabel>
      ) : (
        <SourceIcon source={source} detail={sourceDetail} />
      )}
      <button
        type="button"
        className="cand-add tactile"
        onClick={onAdd}
        disabled={busy}
        aria-label={group ? `Choose an edition of ${title}` : `${addLabel} ${title}`}
        aria-expanded={group ? !!expanded : undefined}
      >
        {group ? <IconChevron open={!!expanded} /> : <IconPlus />}
      </button>
    </li>
  )
}

// IconChevron — the group row's affordance: a "+" would promise an immediate
// add, but a group opens its editions instead.
function IconChevron({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={open ? 'M6 14.5 12 8.5l6 6' : 'M6 9.5 12 15.5l6-6'} />
    </svg>
  )
}

// BookLookupPicker queries POST /books/lookup with the current isbn/title/asin
// and lists matches with a real cover thumbnail. Picking one hands the whole
// candidate back so the form can adopt its fields + cover.
// `auto` runs the lookup as soon as the picker opens (§7: "Fetch metadata"
// opens this edition picker instead of silently applying a guess, folding in the
// old "Browse other matches" button). `onClose` dismisses the opened picker.
export function BookLookupPicker({ isbn, title, author, asin, onPick, auto = false, onClose }) {
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

  // Auto-search on open (the picker is mounted only while open, so re-opening
  // after editing the title re-runs with the fresh fields).
  useEffect(() => {
    if (auto) look()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-2">
      {auto ? (
        <div className="flex items-center justify-between gap-2">
          <MonoLabel className="block">
            {busy ? 'finding editions…' : 'pick the right edition — replaces the fields below'}
          </MonoLabel>
          {onClose && (
            <GhostButton type="button" onClick={onClose}>
              Close
            </GhostButton>
          )}
        </div>
      ) : (
        <GhostButton type="button" onClick={look} disabled={busy}>
          {busy ? 'Looking up…' : 'Browse other matches…'}
        </GhostButton>
      )}
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
export function MovieLookupPicker({ title, year, mediaType = 'movie', onPick, auto = false }) {
  const [q, setQ] = useState(title || '')
  const [yr, setYr] = useState(year ? String(year) : '')
  const [cands, setCands] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // §7: opening the edition picker (from the Fetch-metadata icon) auto-runs the
  // search with the current title/year; the inline field still lets you refine.
  useEffect(() => {
    if (auto && (title || '').trim()) look()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
