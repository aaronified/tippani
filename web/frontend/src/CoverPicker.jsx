// Shared cover/poster editing + metadata look-up used by the book and movie
// edit views. Three ways to set a cover (§ user request): pick from an API
// match, paste an image URL, or upload a file. Amazon covers are derived from
// the ASIN with no cookie needed.
import { useEffect, useState } from 'react'
import { coverImgURL, json, upload, errText } from './api.js'
import { t } from './i18n.js'
import {
  ErrorText,
  FieldIconButton,
  GhostButton,
  IconCheck,
  IconChevron,
  IconClose,
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
        <MonoLabel style={{ fontSize: 'var(--type-ui-9)', lineHeight: 1.3 }}>{t('cover.preview.blocked')}</MonoLabel>
      </span>
    )
  }
  return <Placeholder kind={label} className={className} />
}

// hiResPoster upgrades a picker-thumbnail URL to the full-size one, so what gets
// stored from a cover search is storage quality rather than preview quality.
// Exported because the work Details merge screen adopts a candidate's poster
// directly and has to make the same upgrade — a match taking the thumbnail
// would store a worse image than the cover search stores for the same title.
//
// IT KNEW ONLY TMDB, AND GAMES ARRIVED THROUGH THE SAME DOOR. IGDB serves its
// sizes as path segments too, and the picker asks for `t_cover_small` — 90×128.
// An IGDB URL therefore fell straight through this replace unchanged, so every
// cover chosen for a game was stored at thumbnail size and looked it everywhere
// afterwards. Nothing failed; the image was simply tiny, which is the kind of
// defect you notice on the board rather than in a log.
//
// One expression per supplier, in the one place the sizes are decided.
export const hiResPoster = (u) =>
  (u || '')
    .replace('/t/p/w342/', '/t/p/original/')
    .replace('/t_cover_small/', '/t_cover_big_2x/')

// SOURCE_BADGE / coverSourceLabel — who answers, per medium and per candidate.
// Both existed as inline ternaries over TMDB and TheTVDB, written before the
// Catalogue held games, and both quietly told a lie about every game.
// Keys, not spellings. This file held TVDB, TMDB, GOOGLE, OPEN LIBRARY and
// AMAZON as literals — three of them a third spelling of a provider vocab.source.*
// already names for the metadata screens.
const SOURCE_KEYS = {
  tvdb: 'vocab.source.tvdb.label',
  tmdb: 'vocab.source.tmdb.label',
  igdb: 'vocab.source.igdb.label',
  wikidata: 'vocab.source.wikidata.label',
  google: 'vocab.source.google.label',
  openlibrary: 'vocab.source.openlibrary.label',
  amazon: 'vocab.source.amazon.label',
}

// sourceName — the reader's name for a candidate's supplier. An unknown slug
// falls through to itself rather than to a missing key.
export const sourceName = (slug) =>
  SOURCE_KEYS[slug] ? t(SOURCE_KEYS[slug]) : String(slug || '')

export function coverSourceLabel(mediaType) {
  // Wikidata is the floor under IGDB rather than a second opinion (see
  // wikidata_games.go), so it is named — a reader whose IGDB key is missing
  // still gets results and should know where from.
  return t(mediaType === 'game' ? 'cover.search.game.tip' : 'cover.search.screen.tip')
}

// idNum reads a supplier id off a form field or a stored record and returns a
// positive number, or 0 for "not set". A field holds a string, a record holds a
// number, and an unset one is any of '', null, undefined or 0 — so every caller
// would otherwise write the same four-way check.
export const idNum = (v) => {
  const n = Number(String(v ?? '').trim())
  return Number.isInteger(n) && n > 0 ? n : 0
}

// CoverControls: preview + set/replace/clear. The parent owns the pending
// {coverUrl, clearCover} that ride along in its Save PUT; file upload is
// immediate (its own endpoint) and calls onUploaded with the refreshed record.
// kind is the route segment: "books" | "movies". `search` carries the live
// form fields the cover search queries with ({isbn,title,asin} for books,
// {title,year,mediaType,tmdbId,tvdbId} for movies).
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
  // WHAT THE PREVIEW DRAWS WHEN THE PENDING URL CANNOT BE DRAWN. A picture from
  // a web image search is staged for saving by its own address, and that host is
  // not on the page's img-src list — so the preview above the controls would be
  // a "blocked" note for the one candidate the reader just chose. The thumbnail
  // that WAS drawable in the strip stands in until the save replaces both with a
  // stored file. Local to the picker: nothing about the parent's pending state
  // changes, and the thing being saved is still the full-size original.
  const [previewFor, setPreviewFor] = useState(null) // {url, thumb}
  // The heading as drawn, and the noun the sentences below take. Two keys
  // rather than one word lower-cased in JavaScript: English casing is not
  // grammar, and Bengali has no case for it to be.
  const label = t(kind === 'movies' ? 'cover.heading.poster' : 'cover.heading.cover')
  const noun = t(kind === 'movies' ? 'cover.noun.poster' : 'cover.noun.cover')
  const nouns = t(kind === 'movies' ? 'cover.noun.poster.plural' : 'cover.noun.cover.plural')

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
    // `thumb`, when given, is what the STRIP draws while `url` is what gets
    // stored — see ImageHit in internal/metadata/image_search.go. A web image
    // search returns pictures from hosts no allowlist can name in advance, so
    // the page previews the supplier's own thumbnail host and the server fetches
    // the original, where no Content-Security-Policy applies.
    const add = (url, source, thumb = '') => {
      if (url && !seen.has(url)) {
        seen.add(url)
        found.push({ url, source, thumb })
      }
    }
    if (kind === 'movies') {
      const r = await json('POST', '/movies/lookup', {
        title: (search?.title || '').trim(),
        year: search?.year ? Number(search.year) : undefined,
        media_type: search?.mediaType || 'movie',
        // The stored ids name the exact record, so its art leads the strip
        // instead of whatever a same-name title happened to match. A game's id
        // is its own — sending only the two film ids meant a game with a pinned
        // IGDB record still searched by title and could come back with the art
        // of a different game of the same name.
        tmdb_id: idNum(search?.tmdbId) || undefined,
        tvdb_id: idNum(search?.tvdbId) || undefined,
        igdb_id: idNum(search?.igdbId) || undefined,
      })
      if (!r.ok) {
        setSearching(false)
        return setErr(errText(r, t('error.lookup.failed')))
      }
      // The badge under each candidate says where it came from, so it has to
      // read the source rather than guess from a two-way ternary — which
      // labelled every IGDB and Wikidata game cover "TMDB".
      for (const c of r.data.candidates || []) add(hiResPoster(c.poster_url), sourceName(c.source || 'tmdb'))
    } else {
      const body = {}
      if (search?.isbn?.trim()) body.isbn = search.isbn.trim()
      if (search?.title?.trim()) body.title = search.title.trim()
      if (search?.author?.trim()) body.author = search.author.trim()
      if (search?.asin?.trim()) body.asin = search.asin.trim()
      const r = await json('POST', '/books/lookup', body)
      if (!r.ok) {
        setSearching(false)
        return setErr(errText(r, t('error.lookup.failed')))
      }
      for (const c of r.data.candidates || [])
        add(c.cover_url, sourceName(c.source === 'openlibrary' || c.source === 'amazon' ? c.source : 'google'))
      if (search?.asin?.trim()) add(amazonCoverURL(search.asin), sourceName('amazon'))
    }
    // THE PICTURE SOURCES, after the catalogue ones and never instead of them.
    // A catalogue hands back the record's own art — the publisher's cover, the
    // distributor's poster — which is the right answer when it has one and no
    // answer at all when it does not: a book Google has under a different
    // edition's jacket, a film whose poster nobody uploaded. /images/search asks
    // the suppliers that search for PICTURES instead (Amazon by ISBN with no
    // configuration at all, a web image search with the reader's own key), so
    // the strip has something in it in exactly the cases the strip was empty.
    //
    // Failures are silent here on purpose: the catalogue results are already on
    // screen, and an error about a supplementary source would read as though the
    // covers above it were suspect.
    const pics = await json('POST', '/images/search', {
      kind: kind === 'movies' ? 'poster' : 'cover',
      title: (search?.title || '').trim() || undefined,
      author: (search?.author || '').trim() || undefined,
      year: search?.year ? Number(search.year) : undefined,
      isbn: (search?.isbn || '').trim() || undefined,
      asin: (search?.asin || '').trim() || undefined,
      media_type: kind === 'movies' ? (search?.mediaType || 'movie') : undefined,
    }).catch(() => ({ ok: false }))
    if (pics.ok) {
      for (const im of pics.data?.images || []) add(im.url, sourceName(im.source), im.thumb)
    }
    setSearching(false)
    setCovers(found)
  }

  // Preview precedence: a pending URL, else the cleared placeholder, else the
  // currently stored file.
  const staged = coverUrl || (!clearCover && currentPath ? coverImgURL(currentPath) : '')
  const previewUrl = coverUrl && previewFor?.url === coverUrl && previewFor.thumb ? previewFor.thumb : staged

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
      setErr(errText(r, t('error.upload.failed')))
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
          <Tooltip label={busy ? t('common.action.upload.busy') : t('cover.upload.tip', { noun })}>
            <label className={'field-icon-btn field-icon-btn-boxed tactile' + (busy ? ' is-busy' : '')} aria-label={t('cover.upload.aria', { noun })}>
              <IconUpload />
              <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
            </label>
          </Tooltip>
          {onFetchMeta && (
            <FieldIconButton
              icon={<IconMetadata />}
              ariaLabel={t('cover.fetch-meta.aria')}
              aria-pressed={!!fetchMetaOpen}
              onClick={onFetchMeta}
              tooltip={t('cover.fetch-meta.tip')}
              boxed
              active={!!fetchMetaOpen}
            />
          )}
          <FieldIconButton
            icon={<IconLink />}
            ariaLabel={t('cover.url.aria')}
            aria-pressed={urlOpen}
            onClick={() => setUrlOpen((v) => !v)}
            tooltip={t('cover.url.tip')}
            boxed
            active={urlOpen}
          />
          <FieldIconButton
            icon={<IconSearch />}
            ariaLabel={t('cover.search.aria', { nouns })}
            onClick={searchCovers}
            disabled={searching}
            // NAMED BY WHAT ACTUALLY ANSWERS. A game's lookup goes to IGDB —
            // it has since 0040, and the request below already carries the
            // media type — but the button said "Search TMDB & TheTVDB", which
            // is a promise about a supplier that is never asked.
            tooltip={kind === 'movies' ? coverSourceLabel(search?.mediaType) : t('cover.search.books.tip')}
            boxed
            busy={searching}
          />
          {(currentPath || coverUrl) && !clearCover && (
            <FieldIconButton
              icon={<IconDelete />}
              ariaLabel={t('cover.remove.aria', { noun })}
              onClick={onClear}
              boxed
              danger
            />
          )}
        </div>
        {urlOpen && (
          <div className="flex gap-2 pt-1">
            <input
              className="tp-input"
              placeholder={t('cover.url.placeholder')}
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
            />
            <FieldIconButton
              icon={<IconCheck />}
              ariaLabel={t('cover.url.use.aria')}
              onClick={() => {
                  if (urlText.trim()) onSetUrl(urlText.trim())
                  setUrlOpen(false)
                  setUrlText('')
                }}
              tooltip={t('cover.url.use.tip')}
              ok
              className="shrink-0"
            />
          </div>
        )}
        {covers && (
          <div className="space-y-1.5 pt-1">
            <MonoLabel className="block">
              {covers.length ? t('cover.pick.prose', { noun }) : t('cover.pick.none', { nouns })}
            </MonoLabel>
            <div className="flex flex-wrap gap-2">
              {covers.map((c) => (
                <CoverPickThumb
                  key={c.url}
                  url={c.thumb || c.url}
                  source={c.source}
                  noun={noun}
                  onPick={() => {
                    onSetUrl(c.url)
                    setPreviewFor({ url: c.url, thumb: c.thumb })
                    setCovers(null)
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {coverUrl && <p className="microcopy">{t('cover.pending', { noun })}</p>}
        {clearCover && (
          <p className="microcopy" style={{ color: 'var(--error)' }}>{t('cover.clearing', { noun })}</p>
        )}
        <ErrorText>{err}</ErrorText>
      </div>
    </div>
  )
}

// CoverPickThumb is one candidate in the "Search covers" grid: the image, its
// source, and its true pixel size measured on load. A cover below the low-res
// threshold is dimmed and badge-tinted so the user reaches for a bigger one.
function CoverPickThumb({ url, source, noun, onPick }) {
  const [dim, setDim] = useState(null)
  const [hide, setHide] = useState(false)
  if (hide) return null
  const lowRes = dim && dim.w > 0 && dim.w < LOW_RES_W
  return (
    <Tooltip
      label={t('cover.pick.use', {
        noun,
        source,
        res: resLabel(dim) || t('common.state.loading'),
      })}
    >
      <button
        type="button"
        className={'cover-pick' + (lowRes ? ' is-low' : '')}
        aria-label={t('cover.pick.use', {
          noun,
          source,
          res: resLabel(dim) || t('common.state.loading'),
        })}
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
    </Tooltip>
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
    // U+0000 joins the two halves because it is the one character normName
    // can never emit, so no title/author pair can forge another pair's key.
    // Written as an escape rather than the raw byte: a literal NUL made
    // ripgrep classify this file as binary and skip it, so every repo-wide
    // search silently missed CoverPicker -- which is how its dead CSS
    // survived a cleanup pass.
    const key = nt && na ? `${nt}\u0000${na}` : null
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
export function CandidateRow({ cover, title, sub, source, sourceDetail, count = 1, expanded, onAdd, addLabel, busy = false }) {
  const action = addLabel || t('cover.candidate.add.label')
  const group = count > 1
  return (
    <li className="sheen-raised flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--line)' }}>
      <CoverPreview url={cover} label="" compact className="w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={title}>{title}</p>
        <p className="truncate text-xs" style={{ color: 'var(--soft)' }}>{sub}</p>
      </div>
      {group ? (
        <MonoLabel style={{ flex: 'none', fontSize: 'var(--type-ui-9)' }}>
          {t('cover.candidate.editions', { n: count })}
        </MonoLabel>
      ) : (
        <SourceIcon source={source} detail={sourceDetail} />
      )}
      <Tooltip
        label={group ? t('cover.candidate.show-editions') : t('cover.candidate.add.tip')}
        className="shrink-0"
      >
        <button
          type="button"
          className="cand-add tactile"
          onClick={onAdd}
          disabled={busy}
          aria-label={
            group
              ? t('cover.candidate.choose-edition.aria', { title })
              : t('cover.candidate.add.aria', { action, title })
          }
          aria-expanded={group ? !!expanded : undefined}
        >
          {group ? <IconChevron open={!!expanded} /> : <IconPlus />}
        </button>
      </Tooltip>
    </li>
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
      return setErr(t('error.validate.lookup-fields'))
    }
    const r = await json('POST', '/books/lookup', body)
    setBusy(false)
    if (r.ok) setCands(r.data.candidates)
    else setErr(errText(r, t('error.lookup.failed')))
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
            {busy ? t('cover.editions.busy') : t('cover.editions.prose')}
          </MonoLabel>
          {onClose && (
            <FieldIconButton
              icon={<IconClose />}
              ariaLabel={t('cover.editions.close.aria')}
              onClick={onClose}
            />
          )}
        </div>
      ) : (
        <GhostButton type="button" onClick={look} disabled={busy}>
          {busy ? t('cover.editions.looking') : t('cover.editions.browse')}
        </GhostButton>
      )}
      <ErrorText>{err}</ErrorText>
      {cands && cands.length === 0 && <p className="microcopy">{t('cover.editions.none')}</p>}
      {cands && cands.length > 0 && (
        <ul className="lookup-grid">
          {cands.map((c, i) => (
            <li key={i} className="lookup-card">
              <Tooltip label={t('cover.editions.use.tip')}>
                <button type="button" className="lookup-card-cover" aria-label={t('cover.editions.use.aria', { title: c.title })} onClick={() => onPick(c)}>
                  <CoverPreview url={c.cover_url} label="" showRes className="w-full" />
                </button>
              </Tooltip>
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
                <span className="tp-chip shrink-0" style={{ fontSize: 'var(--type-ui-9)' }}>{sourceName(c.source)}</span>
                <FieldIconButton
                  icon={<IconCheck />}
                  ariaLabel={t('cover.editions.use.aria', { title: c.title })}
                  onClick={() => onPick(c)}
                  tooltip={t('cover.editions.use.exact', { title: c.title })}
                  ok
                  className="shrink-0"
                />
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
//
// `tmdbId` / `tvdbId` are the ids stored on the title, and they ride along with
// the title rather than replacing it: the server fetches each named record and
// lists it first, then the title hits underneath. They are props, not fields —
// like the ISBN on the book picker, they are edited where they live.
export function MovieLookupPicker({ title, year, mediaType = 'movie', tmdbId, tvdbId, onPick, auto = false }) {
  const [q, setQ] = useState(title || '')
  const [yr, setYr] = useState(year ? String(year) : '')
  const [cands, setCands] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [warn, setWarn] = useState('')
  const pinned = [idNum(tmdbId) && `TMDB #${idNum(tmdbId)}`, idNum(tvdbId) && `TVDB #${idNum(tvdbId)}`].filter(Boolean)

  // §7: opening the edition picker (from the Fetch-metadata icon) auto-runs the
  // search with the current title/year; the inline field still lets you refine.
  // A stored id is reason enough to search on open even with no title, since it
  // names one record exactly.
  useEffect(() => {
    if (auto && ((title || '').trim() || pinned.length)) look()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // NB: this picker lives inside the movie edit <form>, so it must NOT render a
  // nested <form> of its own — a nested form's submit escapes to the outer form
  // and reloads the page (the "search bounces to the homepage" bug). Search is a
  // plain button + Enter handler instead.
  async function look() {
    if (!q.trim() && !pinned.length) return
    setBusy(true)
    setErr('')
    setCands(null)
    const body = { title: q.trim(), media_type: mediaType }
    if (yr) body.year = Number(yr)
    if (idNum(tmdbId)) body.tmdb_id = idNum(tmdbId)
    if (idNum(tvdbId)) body.tvdb_id = idNum(tvdbId)
    const r = await json('POST', '/movies/lookup', body)
    setBusy(false)
    if (r.ok) {
      setCands(r.data.candidates)
      // A SUPPLIER THAT REFUSED WHILE THE OTHER ANSWERED. The server sends this
      // only for a rejected key and only when there are results to explain, so it
      // is never an error — the hits below it are real. Without it, a TheTVDB key
      // that does not work is indistinguishable from one that does: results
      // appear, and they are TMDB's.
      setWarn(r.data.warning || '')
    } else {
      setWarn('')
      setErr(errText(r, t('error.lookup.failed')))
    }
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
        <input className="tp-input" placeholder={t('common.field.title.label')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onEnter} />
        <input className="tp-input w-24 shrink-0" placeholder={t('common.field.year.label')} inputMode="numeric" value={yr} onChange={(e) => setYr(e.target.value)} onKeyDown={onEnter} />
        <FieldIconButton
          icon={<IconSearch />}
          ariaLabel={t('cover.movie.search.aria')}
          onClick={look}
          disabled={busy}
          tooltip={coverSourceLabel(mediaType)}
          className="shrink-0"
        />
      </div>
      {/* A SUPPLIER THAT REFUSED WHILE THE OTHER ANSWERED. Not an ErrorText: the
          results below it are real, and painting them red would say the opposite.
          The server sends this string only for a rejected key with hits to
          explain — see handleMovieLookup. */}
      {warn && <p className="microcopy" style={{ color: 'var(--error)' }}>{warn}</p>}
      {/* Says why a match you did not search for is sitting at the top. */}
      {pinned.length > 0 && (
        <MonoLabel className="block">{t('cover.movie.by-id', { ids: pinned.join(' · ') })}</MonoLabel>
      )}
      <ErrorText>{err}</ErrorText>
      {cands && cands.length === 0 && <p className="microcopy">{t('cover.movie.none')}</p>}
      {cands && cands.length > 0 && (
        <ul className="lookup-grid">
          {cands.map((c) => (
            <li key={`${c.source}-${c.source_id || c.tmdb_id}`} className="lookup-card">
              <Tooltip label={t('cover.movie.use.tip')}>
                <button type="button" className="lookup-card-cover" aria-label={t('cover.editions.use.aria', { title: c.title })} onClick={() => onPick(c)}>
                  <CoverPreview url={c.poster_url} label="" showRes className="w-full" />
                </button>
              </Tooltip>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={c.title}>{c.title}</p>
                {c.release_year ? <p className="truncate text-xs" style={{ color: 'var(--soft)' }}>{c.release_year}</p> : null}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="tp-chip shrink-0" style={{ color: 'var(--amber)', fontSize: 'var(--type-ui-9)' }}>
                  {sourceName(c.source || 'tmdb')}
                </span>
                <FieldIconButton
                  icon={<IconCheck />}
                  ariaLabel={t('cover.editions.use.aria', { title: c.title })}
                  onClick={() => onPick(c)}
                  tooltip={t('cover.editions.use.exact', { title: c.title })}
                  ok
                  className="shrink-0"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
