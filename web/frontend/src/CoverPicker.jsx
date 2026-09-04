// Shared cover/poster editing + metadata look-up used by the book and movie
// edit views. Three ways to set a cover (§ user request): pick from an API
// match, paste an image URL, or upload a file. Amazon covers are derived from
// the ASIN with no cookie needed.
import { useEffect, useState } from 'react'
import { coverImgURL, json, upload, errText } from './api.js'
import { t } from './i18n.js'
// SectionHead comes from the character screens because that is where the pack's
// section heading was first built; it is the app's one heading for "a named group
// of rows", and the match picker is one.
import { SectionHead, SegHead } from './characterRows.jsx'
import {
  COVER_MIN_W,
  ErrorText,
  FieldIconButton,
  GhostButton,
  IconButton,
  IconCheck,
  IconChevron,
  IconClose,
  IconDelete,
  IconLink,
  IconMetadata,
  IconPlus,
  IconSearch,
  IconUpload,
  MediaBlock,
  MonoLabel,
  NameScroll,
  normName,
  Placeholder,
  SourceIcon,
  sourceName,
  Tooltip,
} from './ui.jsx'

// amazonCoverURL builds Amazon's public image-CDN URL for a cover from an ASIN
// (mirrors metadata.AmazonCoverURL — keep the two in sync). No size modifier =
// the original full-size scan. No auth required; the server fetches it on save
// via the user-URL path.
export function amazonCoverURL(asin) {
  const a = (asin || '').trim()
  return a ? `https://images-na.ssl-images-amazon.com/images/P/${a}.01.jpg` : ''
}

// resLabel states measured natural dimensions; "" until the image loads (or if
// it fails to). ONE SPELLING, shared with the media block: a candidate badge
// reading "1000×1500" beside a block reading "1000×1500 px" is the same fact in
// two hands, and the pair drift the first time either is touched.
function resLabel(dim) {
  return dim && dim.w ? t('media.dims', { w: dim.w, h: dim.h }) : ''
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
    const lowRes = dim && dim.w > 0 && dim.w < COVER_MIN_W
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

// sourceName moved to ui.jsx when per-field provenance began naming suppliers on every
// field row: the table was here, the new callers are there, and two tables of supplier
// names is how a picker and a field row come to call one company two things.

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

  // THE FOUR VERBS, IN THE PACK'S ORDER — Fetch, Search, Upload, Paste URL —
  // which is roughly the order of effort: ask the catalogue that already knows
  // this edition, then ask every source at once, then go and find a file, then
  // type an address. Remove is a fifth and deliberately not one of the four: it
  // is not a way of ACQUIRING a picture, and a destructive verb sitting in a
  // 2x2 of constructive ones is where a mis-click costs a cover. It appears
  // only when there is something to remove, so the common case is the 2x2.
  //
  // AND THEY WEAR THEIR WORDS. Four boxed glyphs beside a picture was the shape
  // the pack redrew, and the report that ended it was "i dont see the buttons
  // beside the hero images" — which is what four 34px wireframe squares in a
  // corner of a form look like. The words are short because the grid is two
  // columns and the artwork's height decides how tall it may be; the tooltip
  // keeps the sentence.
  //
  // THE DETAILS PANEL'S SET IS EXACTLY THE PACK'S FOUR. It passes no
  // `onFetchMeta` — that verb is the panel header's own key there — so what this
  // draws is Fetch · Upload · Paste URL and, once there is a picture, Clear: the
  // 2x2 the pack shows, with the destructive one last and red.
  const verbs = [
    onFetchMeta && (
      <IconButton
        icon={<IconMetadata />}
        label={t('cover.verb.edition.label')}
        ariaLabel={t('cover.fetch-meta.aria')}
        aria-pressed={!!fetchMetaOpen}
        onClick={onFetchMeta}
        tooltip={t('cover.fetch-meta.tip')}
        className={fetchMetaOpen ? 'is-active' : ''}
      />
    ),
    <IconButton
      icon={<IconSearch />}
      label={t('cover.verb.fetch.label')}
      ariaLabel={t('cover.search.aria', { nouns })}
      onClick={searchCovers}
      disabled={searching}
      // NAMED BY WHAT ACTUALLY ANSWERS. A game's lookup goes to IGDB — it has
      // since 0040, and the request below already carries the media type — but
      // the button said "Search TMDB & TheTVDB", which is a promise about a
      // supplier that is never asked.
      tooltip={kind === 'movies' ? coverSourceLabel(search?.mediaType) : t('cover.search.books.tip')}
    />,
    <Tooltip label={busy ? t('common.action.upload.busy') : t('cover.upload.tip', { noun })}>
      {/* A FILE PICKER IS A <label>, NOT A BUTTON — the input has to be inside it
          for a press to open the chooser, so this one wears IconButton's classes by
          hand rather than being one. `has-btn-icon` is what the Button labels
          preference hides the word with, so it opts in like its three neighbours. */}
      <label
        className={'tp-btn tp-btn-ghost tactile flex items-center justify-center rounded-full has-btn-icon' + (busy ? ' is-busy' : '')}
        style={{ height: 44, flexShrink: 0 }}
        aria-label={t('cover.upload.aria', { noun })}
      >
        <span className="btn-icon"><IconUpload /></span>
        <span className="btn-label">{t('cover.verb.upload.label')}</span>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
      </label>
    </Tooltip>,
    <IconButton
      icon={<IconLink />}
      label={t('cover.verb.url.label')}
      ariaLabel={t('cover.url.aria')}
      aria-pressed={urlOpen}
      onClick={() => setUrlOpen((v) => !v)}
      tooltip={t('cover.url.tip')}
      className={urlOpen ? 'is-active' : ''}
    />,
    (currentPath || coverUrl) && !clearCover && (
      <IconButton
        icon={<IconDelete />}
        label={t('cover.verb.clear.label')}
        ariaLabel={t('cover.remove.aria', { noun })}
        onClick={onClear}
        danger
      />
    ),
  ].filter(Boolean)

  return (
    <MediaBlock
      src={previewUrl}
      alt=""
      label={label}
      verbs={verbs}
      // A picture staged by its own address cannot be drawn by a page whose
      // img-src is 'self' — the server fetches it on save. Without this the
      // block would fall back to the hatch and read as "no cover".
      blocked={<span className="tp-media-blocked"><MonoLabel>{t('cover.preview.blocked')}</MonoLabel></span>}
    >
      {urlOpen && (
        <div className="flex gap-2">
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
        <div className="tp-media-strip">
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
    </MediaBlock>
  )
}

// CoverPickThumb is one candidate in the "Search covers" grid: the image, its
// source, and its true pixel size measured on load. A cover below the low-res
// threshold is dimmed and badge-tinted so the user reaches for a bigger one.
function CoverPickThumb({ url, source, noun, onPick }) {
  const [dim, setDim] = useState(null)
  const [hide, setHide] = useState(false)
  if (hide) return null
  const lowRes = dim && dim.w > 0 && dim.w < COVER_MIN_W
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
        <NameScroll as="p" className="text-sm font-semibold" title={title}>{title}</NameScroll>
        <NameScroll as="p" className="text-xs" style={{ color: 'var(--soft)' }}>{sub}</NameScroll>
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
// ---- THE MATCH PICKER'S OWN ROW ------------------------------------------
//
// A CANDIDATE IS A PROPOSAL, NOT AN OVERWRITE, and the pack draws it as a ROW:
// a small piece of artwork, the title, one mono line of what tells it apart, and
// the supplier's own mark. What this replaces is a GRID of cards, each with a
// full-width cover — which on the phone this screen is designed for first put one
// candidate per screenful, so comparing three matches meant scrolling past three
// posters and remembering them.
//
// THE MARK RATHER THAN A LETTERED PILL, which is the pack's word for it and the
// app's own rule: `.tp-chip` reading "TMDB" is a fourth typeface in a row that
// already has three, where SourceIcon is the same glyph this supplier wears on
// every field row and in the Ids strip. It also carries the id in its label, so
// "TMDB · #603" is one hover rather than a second line.
//
// THE PICTURE IS MEASURED, through CoverPreview's own showRes badge — the pack's
// reason in its own words: "the reason to prefer one match over another is often
// only its artwork, and 342 x 513 is the difference between a share card and a
// blur". The badge inks itself --error under the floor, which is the same signal
// the record's own cover wears.
export function MatchRow({ art, title, meta, note, source, detail, onPick, pickTitle, aria }) {
  return (
    <li className="match-row">
      <Tooltip label={pickTitle}>
        <button type="button" className="match-pick" aria-label={aria} onClick={onPick}>
          <CoverPreview url={art} label="" showRes className="match-art" />
          <span className="match-text">
            {/* NameScroll, not a clamp: a title is a name, and the standing rule
                is that it scrolls under a fade rather than being cut. Two matches
                of one film differ in their last few words often enough that the
                end of the line is the part worth reading. */}
            <NameScroll as="span" className="match-title" title={title}>{title}</NameScroll>
            {meta ? <span className="match-meta">{meta}</span> : null}
            {note ? <span className="match-note">{note}</span> : null}
          </span>
          <span className="match-mark" aria-hidden="true">
            <SourceIcon source={source} detail={detail} />
          </span>
        </button>
      </Tooltip>
    </li>
  )
}

// mediaWord — the reader's noun for a medium. `movies.media_type` holds "movie",
// "show" and "game"; the interface has said "film" since 1.0, so the column value
// is not printable as it stands. An unknown value prints nothing rather than
// itself: a raw slug on a candidate row would be the one word on the screen that
// came from the database instead of from the locale.
const MEDIA_UNIT = { movie: 'unit.film.one', show: 'unit.show.one', game: 'unit.game.one' }
function mediaWord(mt) {
  const key = MEDIA_UNIT[String(mt || '').trim().toLowerCase()]
  return key ? t(key) : ''
}

// MatchList — the count, then the rows. The count is the pack's `Matches · 3` and
// it earns its line: a lookup that came back with one hit and a lookup that came
// back with nine look the same until you scroll, and the second is the one where
// the reader should read before pressing.
export function MatchList({ n, children }) {
  return (
    <>
      <SectionHead label={t('lookup.matches.label', { n, count: n })} />
      <ul className="match-list">{children}</ul>
    </>
  )
}

// SearchAgain — the pack's second head on this surface, and the reason it is
// BELOW the results rather than above them: the reader arrived here from a search
// that already ran. The controls that re-run it are what you want after reading
// the matches, not before, and putting them first made the top of the screen a
// form on a screen whose subject is a list.
export function SearchAgain({ children }) {
  return (
    <>
      <SectionHead label={t('lookup.again.label')} />
      {children}
    </>
  )
}

export function BookLookupPicker({ isbn, title, author, asin, onPick, auto = false, onClose }) {
  const [cands, setCands] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // WHAT THE SEARCH IS ABOUT TO USE, read off the same four fields `look` sends —
  // one list rather than two, so the crumb cannot drift from the request.
  const usedBy = [
    isbn && isbn.trim() ? t('common.field.isbn.label') : '',
    title && title.trim() ? t('common.field.title.label') : '',
    author && author.trim() ? t('common.field.author.label') : '',
    asin && asin.trim() ? t('common.field.asin.label') : '',
  ].filter(Boolean)

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
          {/* THE CRUMB: what the search actually used. It was "searching for a
              match", which is true of every search — and a book lookup fires off
              the record's ISBN, title, author and ASIN in whatever combination it
              has, so which of them answered is the difference between a match to
              trust and one to read twice. */}
          <MonoLabel className="block">
            {busy ? t('cover.editions.busy') : t('lookup.searched-by', { by: usedBy.join(' · ') })}
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
        <MatchList n={cands.length}>
          {cands.map((c, i) => (
            <MatchRow
              key={i}
              art={c.cover_url}
              title={c.title}
              // THE LINE THAT TELLS TWO EDITIONS APART: who wrote it and when it
              // came out. The series rides on it too rather than on a third line
              // of its own — "Discworld #22" is the same kind of fact as the year.
              meta={[c.author, c.published_year || null,
                c.series ? `${c.series}${c.series_index ? ` #${c.series_index}` : ''}` : null]
                .filter(Boolean).join(' · ')}
              source={c.source}
              detail={c.isbn13 || c.isbn || ''}
              onPick={() => onPick(c)}
              pickTitle={t('cover.editions.use.exact', { title: c.title })}
              aria={t('cover.editions.use.aria', { title: c.title })}
            />
          ))}
        </MatchList>
      )}
      {/* SEARCH AGAIN, and for a book it is one button rather than two: the
          lookup is driven by the record's own ISBN, title, author and ASIN, so
          there is nothing here to type over. A reader who corrected the title in
          the form behind this screen had no way to re-run without closing the
          picker and opening it again, which is the gap this closes. */}
      {auto && cands && (
        <SearchAgain>
          <div className="match-tools">
            <IconButton
              icon={<IconSearch />}
              label={t('lookup.again.run.label')}
              ariaLabel={t('lookup.again.run.label')}
              onClick={look}
              disabled={busy}
              tooltip={t('lookup.again.run.tip', { by: usedBy.join(' · ') })}
            />
          </div>
        </SearchAgain>
      )}
    </div>
  )
}

export function MovieLookupPicker({ title, year, mediaType = 'movie', tmdbId, tvdbId, onPick, auto = false }) {
  const [q, setQ] = useState(title || '')
  const [yr, setYr] = useState(year ? String(year) : '')
  const [cands, setCands] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [warn, setWarn] = useState('')
  // WHICH WAY THE READER IS SEARCHING AGAIN — the pack's two tools on this
  // surface. It opens on 'title' unless the record is pinned to a supplier id,
  // because an id names one record exactly and is the mode that answers when a
  // title search cannot tell two films of one name apart.
  const [mode, setMode] = useState('title')
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

  // WHAT THE SEARCH USED, which is the pack's crumb for this surface. It named
  // only the pinned ids before ("searching by id · TMDB #603") and said nothing at
  // all on the ordinary case — so a search that quietly fell back to the title had
  // the same silent crumb as one that named a record exactly.
  const usedBy = [
    q.trim() ? t('common.field.title.label') : '',
    yr ? t('common.field.year.label') : '',
    ...pinned,
  ].filter(Boolean)

  return (
    <div className="space-y-2">
      {/* A SUPPLIER THAT REFUSED WHILE THE OTHER ANSWERED. Not an ErrorText: the
          results below it are real, and painting them red would say the opposite.
          The server sends this string only for a rejected key with hits to
          explain — see handleMovieLookup. */}
      {warn && <p className="microcopy" style={{ color: 'var(--error)' }}>{warn}</p>}
      <MonoLabel className="block">
        {busy
          ? t('cover.editions.busy')
          : t('lookup.searched-by', { by: usedBy.join(' · ') || t('lookup.searched-by.nothing') })}
      </MonoLabel>
      <ErrorText>{err}</ErrorText>
      {cands && cands.length === 0 && <p className="microcopy">{t('cover.movie.none')}</p>}
      {cands && cands.length > 0 && (
        <MatchList n={cands.length}>
          {cands.map((c) => (
            <MatchRow
              key={`${c.source}-${c.source_id || c.tmdb_id}`}
              art={c.poster_url}
              title={c.title}
              // THE YEAR AND THE MEDIUM, which is what tells two same-titled
              // matches apart — and the pack's line has a third fact, the
              // director, that is NOT here on purpose. A lookup response carries
              // no credits: TMDB serves them from a second endpoint per title, so
              // naming the director on a list of nine hits is nine extra outbound
              // calls for a line nobody has asked to sort by. The medium does the
              // work it was there for — a film and a game of one name are the
              // pair this list actually has to separate.
              // `unit.*` is the app's noun for a medium, and 'movie' on the wire
              // is 'film' in the interface — the store's column value is not the
              // reader's word for it, which is exactly what a lookup table is for.
              meta={[c.release_year || null, mediaWord(c.media_type)].filter(Boolean).join(' · ')}
              source={c.source || 'tmdb'}
              detail={c.source_id || (c.tmdb_id ? String(c.tmdb_id) : '')}
              onPick={() => onPick(c)}
              pickTitle={t('cover.editions.use.exact', { title: c.title })}
              aria={t('cover.editions.use.aria', { title: c.title })}
            />
          ))}
        </MatchList>
      )}
      {/* SEARCH AGAIN, BELOW THE MATCHES, and two ways rather than one because
          those are the two the reader has: type over the query, or name a record
          exactly. SegHead is the app's control for a choice with two answers —
          "two words rather than a dropdown because there are two answers" — and
          the ids get their own mode because they are the mode that WORKS when the
          title search cannot tell two films apart, which is the whole reason the
          fields are editable. */}
      <SearchAgain>
        <SegHead
          label={t('lookup.again.how.label')}
          options={[['title', t('lookup.again.by-title.label')], ['id', t('lookup.again.by-id.label')]]}
          value={mode}
          onPick={setMode}
        />
        {mode === 'title' ? (
          <div className="flex gap-2">
            <input
              className="tp-input"
              placeholder={t('common.field.title.label')}
              aria-label={t('common.field.title.label')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onEnter}
            />
            <input
              className="tp-input w-24 shrink-0"
              placeholder={t('common.field.year.label')}
              aria-label={t('common.field.year.label')}
              inputMode="numeric"
              value={yr}
              onChange={(e) => setYr(e.target.value)}
              onKeyDown={onEnter}
            />
            <FieldIconButton
              icon={<IconSearch />}
              ariaLabel={t('cover.movie.search.aria')}
              onClick={look}
              disabled={busy}
              tooltip={coverSourceLabel(mediaType)}
              className="shrink-0"
            />
          </div>
        ) : (
          // THE IDS ARE THE RECORD'S, NOT A SECOND COPY. Editing one here would be
          // a third writer of a column the Ids strip already owns, and two editors
          // of one field is how they come to disagree. So this mode SHOWS what the
          // search is pinned to and says where to change it — which is the honest
          // version of the pack's "TMDB, TVDB or IGDB id".
          <div style={{ display: 'grid', gap: 'calc(var(--row) * 0.4)' }}>
            <p className="microcopy">
              {pinned.length
                ? t('lookup.again.by-id.pinned', { ids: pinned.join(' · ') })
                : t('lookup.again.by-id.none')}
            </p>
            <div className="match-tools">
              <IconButton
                icon={<IconSearch />}
                label={t('lookup.again.run.label')}
                ariaLabel={t('lookup.again.run.label')}
                onClick={look}
                disabled={busy || !pinned.length}
                tooltip={t('lookup.again.run.tip', { by: pinned.join(' · ') })}
              />
            </div>
          </div>
        )}
      </SearchAgain>
    </div>
  )
}
