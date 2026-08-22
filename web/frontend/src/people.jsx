import { useEffect, useRef, useState } from 'react'
import { json, errText } from './api.js'
import { t } from './i18n.js'
import { personImgURL, PersonPortrait, usePeople } from './credits.jsx'
import { usePractice } from './review.jsx'
import { useBodyScrollLock, CloseButton, ErrorText, ExpandableDescription, Field, GhostButton, IconCheck, IconClose, IconDelete, IconEdit, IconMerge, IconPlus, IconQuiz, IconRefresh, IconSearch, isPartialDate, Lightbox, MonoLabel, NameInput, PartialDateField, Placeholder, Tooltip } from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary'

// The person primitives — portrait, credit splitting, the saved-people map —
// live in credits.jsx so the quiz card can draw a face without importing this
// panel. Re-exported here because this is still where a reader looks for them.
export { DEFAULT_CREDIT_SEPS, parseCreditSeps, personImgURL, PersonPortrait, splitCredits, usePeople } from './credits.jsx'


// The external references a person can link out to, in display order. A saved
// link is recognised by hostname; everything else renders as a plain URL row.
// The middle column is the KEY that names the provider, not the name itself:
// vocab.source.* already carries these five for the metadata screens, and a
// provider has one name in this app wherever it is drawn.
export const PROVIDERS = [
  ['imdb', 'vocab.source.imdb.label', /(^|\.)imdb\.com$/i],
  ['tmdb', 'vocab.source.tmdb.label', /(^|\.)themoviedb\.org$/i],
  ['tvdb', 'vocab.source.tvdb.label', /(^|\.)thetvdb\.com$/i],
  ['wikipedia', 'vocab.source.wikipedia.label', /(^|\.)wikipedia\.org$/i],
  ['openlibrary', 'vocab.source.openlibrary.label', /(^|\.)openlibrary\.org$/i],
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
      {items.map(([slug, labelKey]) => (
        <a key={slug} className="tp-chip tp-chip-btn" href={known[slug]} target="_blank" rel="noopener noreferrer">
          {t(labelKey)}
        </a>
      ))}
    </span>
  )
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


// CreditFaces — the round-portrait chip for a credit line, sized like a book's
// author face. When a credit names more than one person (co-authors, a film's
// director + creator), the portraits OVERLAP like set intersections with the
// FIRST credited name on top; a ring in the surface colour cuts each disc out
// from the one beneath so the overlap reads as stacked, not merged. Only names
// with a saved photo appear, and it renders nothing when none do. `names` takes
// a single name or an array; `map` is the usePeople name→row map; `ring` must
// match the surface the chip sits on (a lone disc then shows no visible ring).
export function CreditFaces({ names, map = {}, size = 24, ring = 'var(--bg)', className = '' }) {
  const list = Array.isArray(names) ? names : names ? [names] : []
  const people = list.map((n) => map?.[n]).filter((p) => p?.image_path)
  if (people.length === 0) return null
  const overlap = Math.round(size * 0.34)
  return (
    <span className={('inline-flex items-center ' + className).trim()} style={{ flex: 'none' }}>
      {people.map((p, i) => (
        <span
          key={p.id ?? p.name ?? i}
          style={{
            position: 'relative',
            marginLeft: i === 0 ? 0 : -overlap,
            zIndex: people.length - i, // first credited name sits on top
            borderRadius: '50%',
            boxShadow: `0 0 0 2px ${ring}`,
            lineHeight: 0,
          }}
        >
          <PersonPortrait person={p} size={size} />
        </span>
      ))}
    </span>
  )
}

// PersonCredit — the canonical person-in-a-credit-line: a round portrait (when
// one is saved) beside the name as a button that opens the metadata panel. ONE
// class for every credited person, so author / actor / director / creator
// displays place and style identically wherever a credit line names someone;
// `kind` is the subclass handed to onOpen. `person` is the resolved metadata row
// (a usePeople map lookup); pass nameClassName / nameStyle to match the host
// line's type (e.g. the amber-mono voice on the film pages).
export function PersonCredit({ kind, name, person, size = 28, onOpen, nameClassName, nameStyle, className = '' }) {
  if (!name) return null
  return (
    <span className={('inline-flex items-center gap-1.5 ' + className).trim()} style={{ verticalAlign: 'middle' }}>
      <PersonPortrait person={person} size={size} />
      <PersonName kind={kind} name={name} onOpen={onOpen} className={nameClassName} style={nameStyle} />
    </span>
  )
}

// lifespanLabel renders a person's years: "1920 – 2001" when both are known,
// the bare birth year when only born is set, "d. 2001" when only died is.
//
// Born/died are partial dates (§3f), so a record may hold a full day. The
// lifespan line still shows only the YEAR of each: a person's years are what this
// line is for, and "4 Mar 1920 – 12 Nov 2001" reads as a gravestone next to a
// title. The full precision is kept, and shows in the edit form.
function lifespanLabel(p) {
  const year = (v) => (v || '').trim().slice(0, 4)
  const b = year(p?.born)
  const d = year(p?.died)
  if (b && d) return t('people.lifespan.range', { born: b, died: d })
  if (b) return b
  if (d) return t('people.lifespan.died', { died: d })
  return ''
}

function PersonView({ person, name, onEdit, onDelete, onPractise }) {
  const [zoom, setZoom] = useState(false)
  // Passport-ratio photo (7:9) FLOATED so the bio + born + links wrap around it
  // and continue below — no dead space beside a short photo. Click → full screen.
  const photo = person.image_path ? (
    // The float rides the Tooltip's wrapper span, not the button inside it —
    // left on the button it would float within the span and the text would
    // stop wrapping around the photo.
    <Tooltip label={t('people.photo.zoom.tip')} side="bottom" className="person-photo-btn float-left mt-[2px] mr-[14px] mb-[8px]">
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label={t('people.photo.zoom.aria', { name })}
        style={{ width: 104, padding: 0, background: 'none', border: 'none', cursor: 'zoom-in' }}
      >
        <img
          src={personImgURL(person.image_path)}
          alt={name}
          style={{ display: 'block', width: '100%', aspectRatio: '7 / 9', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--ink-border)' }}
        />
      </button>
    </Tooltip>
  ) : (
    <div style={{ float: 'left', width: 104, margin: '2px 14px 8px 0' }}>
      <Placeholder kind="" style={{ width: '100%', aspectRatio: '7 / 9' }} />
    </div>
  )
  return (
    <div className="space-y-3">
      <div style={{ overflow: 'hidden' }}> {/* establishes a float context (clears) */}
        {photo}
        <div className="min-w-0 space-y-1.5">
          {lifespanLabel(person) && <MonoLabel className="block">{lifespanLabel(person)}</MonoLabel>}
          {person.bio && <ExpandableDescription text={person.bio} lines={5} />}
          {person.links && (
            <div className="space-y-1">
              <MonoLabel className="block" style={{ color: 'var(--faint)' }}>{t('people.links.heading')}</MonoLabel>
              <PersonLinksDetail links={person.links} />
            </div>
          )}
          {person.source && person.source !== 'manual' && (
            <MonoLabel className="block" style={{ color: 'var(--faint)' }}>
              {t('people.source.via', { source: person.source })}
            </MonoLabel>
          )}
        </div>
      </div>
      {zoom && <Lightbox path={person.image_path} title={name} onClose={() => setZoom(false)} />}
      {/* WRAPS ON A NARROW SCREEN. Three buttons with `mr-auto` on the first is a
          layout that assumes the row is wider than its contents — true on a
          desktop, false on a phone, where Practise / Delete / Edit ran into each
          other and sat at three different widths against the panel edge.
          flex-wrap plus a gap that applies in both directions lets them fall onto
          a second line intact instead of being squeezed. */}
      <div className="flex flex-wrap items-center justify-end gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {/* FIRST IN THE ROW, and away from Delete. "Quiz me on Austen" is the one
            thing you might want from this panel repeatedly; editing a bio is
            something you do once. It reads across every role the person holds —
            author, actor, director, speaker — because the server matches all
            four on one field, and a reader who has quoted someone's films and
            their memoir means both. */}
        <GhostButton onClick={onPractise} className="mr-auto inline-flex items-center gap-1.5">
          <IconQuiz /> {t('common.action.practise.label')}
        </GhostButton>
        <GhostButton
          onClick={onDelete}
          className="inline-flex items-center gap-1.5"
          style={{ color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 55%, transparent)' }}
        >
          <IconDelete /> {t('common.action.delete.label')}
        </GhostButton>
        <button className={PRIMARY + ' inline-flex items-center gap-1.5'} onClick={onEdit}>
          <IconEdit /> {t('common.action.edit.label')}
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
      {items.map(([slug, labelKey]) => (
        <a key={slug} className="tp-chip tp-chip-btn" href={known[slug]} target="_blank" rel="noopener noreferrer">
          {t(labelKey)}
        </a>
      ))}
      {/* `tok`, not `t` — a local t here would shadow the resolver imported
          above, silently and legally. locale-shadow.test.js fails the build over
          exactly this, and the name parseLinks already uses is the right one. */}
      {extra.map((tok) =>
        /^https?:\/\//i.test(tok) ? (
          <a key={tok} className="tp-chip tp-chip-btn" href={tok} target="_blank" rel="noopener noreferrer">
            {tok.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ) : (
          <span key={tok} className="tp-chip">{tok}</span>
        ),
      )}
    </span>
  )
}

function PersonForm({ kind, name, initial, onCancel, onSaved, onRenamed }) {
  const [bio, setBio] = useState(initial?.bio || '')
  const [born, setBorn] = useState(initial?.born || '')
  const [died, setDied] = useState(initial?.died || '')
  const [links, setLinks] = useState(initial?.links || '')
  const [imageUrl, setImageUrl] = useState('')
  const [clearImage, setClearImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [renameTo, setRenameTo] = useState(name)
  const [renaming, setRenaming] = useState(false)
  // What this person is counted in. A translator and an editor are credited on
  // BOOKS, like an author — so all three say "books", and only actors, directors
  // and speakers differ.
  const BOOK_ROLES = kind === 'author' || kind === 'translator' || kind === 'editor'
  const nounKey = BOOK_ROLES
    ? 'unit.book'
    : kind === 'speaker'
      ? 'unit.quote'
      : kind === 'studio'
        ? 'unit.game'
        : 'unit.film'
  const noun = t(nounKey, { count: 2 })
  // The row that carries the credit, per kind: a book's author, translator or
  // editor, a dialogue's actor, a film's director/creator, a game's studio, a
  // standalone quote's speaker.
  // unit.dialogue, so a film line is called a film line here too. This line
  // said 'dialogue' while the rest of the app said 'film line' — one thing, two
  // words, and the migration is the moment to settle it.
  const entityKey = BOOK_ROLES
    ? 'unit.book'
    : kind === 'actor'
      ? 'unit.dialogue'
      : kind === 'speaker'
        ? 'unit.quote'
        : kind === 'studio'
          ? 'unit.game'
          : 'unit.film'
  const entity = t(entityKey, { count: 1 })

  // A STUDIO IS NOT A PERSON, and three labels on this form said otherwise. It
  // is not born and it does not die; it is founded, and it closes. Its picture
  // is a logo rather than a photograph. Small words, but they are the ones on
  // screen when somebody opens Electronic Arts and is asked when it died.
  const isOrg = kind === 'studio'

  // rename rewrites this name across every book/film that uses it (and folds the
  // saved metadata onto the new spelling) — the fix for two transliterations of
  // one person. Library-wide, so it confirms first.
  async function rename() {
    const to = renameTo.trim()
    if (!to || to === name) return
    if (!confirm(t('people.rename.confirm', { from: name, to, noun, entity }))) return
    setRenaming(true)
    setError('')
    const r = await json('POST', '/people/rename', { kind, from: name, to })
    setRenaming(false)
    if (r.ok) onRenamed && onRenamed(to)
    else setError(errText(r, t('error.rename.generic')))
  }

  async function submit(e) {
    e.preventDefault()
    // Born/died are partial dates (§3f): a year, a year-month, or a full day —
    // whatever is actually known. Same rule and same picker as a read's dates.
    if (born.trim() && !isPartialDate(born.trim())) {
      return setError(t('error.validate.born-date'))
    }
    if (died.trim() && !isPartialDate(died.trim())) {
      return setError(t('error.validate.died-date'))
    }
    setBusy(true)
    setError('')
    const r = await json('PUT', '/people', {
      kind,
      name,
      bio: bio.trim(),
      born: born.trim(),
      died: died.trim(),
      links: links.trim(),
      source: initial?.source || 'manual',
      source_id: initial?.source_id || '',
      image_url: imageUrl.trim() || undefined,
      clear_image: clearImage || undefined,
    })
    setBusy(false)
    if (r.ok) onSaved(r.data)
    else setError(errText(r, t('error.save.generic')))
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {initial?.image_path && !clearImage && (
        <div className="flex items-center gap-3">
          <img src={personImgURL(initial.image_path)} alt="" className="w-16 rounded object-cover" style={{ aspectRatio: '3 / 4' }} />
          <button
            type="button"
            className="tp-link tp-link-danger tp-link-icon"
            onClick={() => setClearImage(true)}
          >
            <IconDelete />
            <span>{t('people.form.photo.remove')}</span>
          </button>
        </div>
      )}
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.bio.label')}</MonoLabel>
        <textarea className="tp-input" rows="4" value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      {/* Partial dates: type a year and stop, or pick a month and day from the
          calendar when the record actually says one. The lifespan line above shows
          just the years either way. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PartialDateField
          label={isOrg ? t('people.form.founded.label') : t('common.field.born.label')}
          value={born}
          onChange={setBorn}
          placeholder={t('people.form.born.placeholder')}
        />
        <PartialDateField
          label={isOrg ? t('people.form.closed.label') : t('common.field.died.label')}
          value={died}
          onChange={setDied}
          placeholder={isOrg ? t('people.form.closed.placeholder') : t('people.form.died.placeholder')}
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <MonoLabel>
            {isOrg ? t('people.form.logo-url.label') : t('people.form.photo-url.label')}
          </MonoLabel>
          {/* No keyless portrait API, so offer a web image search: find one,
              copy its address, paste it here (this field also takes any cover
              image URL). */}
          <button
            type="button"
            className="tp-link tp-link-icon"
            style={{ fontSize: 11 }}
            onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name + ' ' + kind)}`, '_blank', 'noopener')}
          >
            {/* The magnifier, not IconOpen: the ACTION is a search, and the ↗ this
                replaces was carrying "opens a tab" — which every other outbound
                chip in this modal states with no arrow at all. */}
            <IconSearch />
            <span>{t('people.form.image-search')}</span>
          </button>
        </div>
        <input
          className="tp-input"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value)
            setClearImage(false)
          }}
          placeholder={t('people.form.image-url.placeholder')}
        />
      </div>
      <label className="block">
        <MonoLabel className="mb-1.5 block">{t('common.field.links.label')}</MonoLabel>
        <textarea className="tp-input" rows="3" value={links} onChange={(e) => setLinks(e.target.value)} placeholder={[t('people.form.links.placeholder.1'), t('people.form.links.placeholder.2')].join('\n')} />
        <p className="microcopy mt-1">{t('people.form.links.hint')}</p>
      </label>
      <div className="space-y-1.5" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <MonoLabel>{t('people.rename.label')}</MonoLabel>
        <div className="flex flex-wrap items-center gap-2">
          <NameInput
            style={{ flex: 1, minWidth: 160 }}
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            placeholder={name}
          />
          {/* keepLabel: renaming a name across the whole library is not a thing
              anybody should have to have learned a glyph for. */}
          <GhostButton
            type="button"
            icon={<IconMerge />}
            keepLabel
            disabled={renaming || !renameTo.trim() || renameTo.trim() === name}
            onClick={rename}
          >
            {renaming ? t('people.rename.busy') : t('people.rename.action')}
          </GhostButton>
        </div>
        {/* `entity`, not `noun`: this reads "on every ___", so it needs the
            singular. It has said "on every films" for as long as the line has
            existed. */}
        <p className="microcopy">
          {t(isOrg ? 'people.rename.hint.org' : 'people.rename.hint.person', { entity })}
        </p>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onCancel}>
          <IconClose /> {t('common.action.cancel.label')}
        </GhostButton>
        <button className={PRIMARY + ' inline-flex items-center gap-1.5'} disabled={busy}>
          <IconCheck /> {t('common.action.save.label')}
        </button>
      </div>
    </form>
  )
}

// PersonModal — opened by clicking any author/actor name. One details view:
// bio · photo · born · labelled reference-page chips (IMDb / TMDB / TheTVDB /
// Wikipedia / Open Library), auto-fetched on first open when nothing is saved
// yet. (The old links-only redirect view is retired — the chips here already
// link out.)
export function PersonModal({ kind, name, onClose, onSaved }) {
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)

 const [person, setPerson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchNote, setFetchNote] = useState('')
  const [error, setError] = useState('')
  const enriched = useRef(false)
  const { practise, practiceDialog } = usePractice()

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
        return setFetchNote(errText(r, t('error.lookup.failed')))
      }
      map = r.data.links
    }
    const merged = mergeLinks(current?.links, map)
    if (!merged) {
      setFetching(false)
      return setFetchNote(t('error.lookup.none'))
    }
    if (merged !== (current?.links || '')) {
      const s = await json('PUT', '/people', {
        kind,
        name,
        bio: current?.bio || '',
        born: current?.born || '',
        died: current?.died || '',
        links: merged,
        source: current?.source || 'lookup',
        source_id: current?.source_id || '',
      })
      if (s.ok) {
        setPerson(s.data)
        onSaved && onSaved()
      } else {
        setFetchNote(errText(s, t('error.save.links')))
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
  // identity the portrait fetch just pinned: fetch the portrait first (when the
  // photo OR the bio is still missing), then fill links (only when none are),
  // preferring the identity-resolved links the portrait returned. The bio check
  // matters for actors: their photo comes from the stored cast (no bio), while
  // the bio needs the one TMDB person call inside the portrait fetch — so an
  // actor with a cast photo but no bio would never get one if we only gated on
  // a missing photo. The backend upsert fills an empty bio and never overwrites
  // a set one, so re-running is safe.
  useEffect(() => {
    if (loading || enriched.current) return
    enriched.current = true
    ;(async () => {
      let p = person
      let resolvedLinks = null
      if (!p?.image_path || !p?.bio) {
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
    if (!person || !confirm(t('people.delete.confirm', { kind: t(`common.field.${kind}.label`), name }))) return
    const r = await json('DELETE', `/people/${person.id}`)
    if (r.ok) {
      onSaved && onSaved()
      onClose()
    } else setError(errText(r))
  }

  return (
    <div
      className="tp-scrim fixed inset-0 z-50 overflow-y-auto px-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={name} className="hand-card hc-r2 mx-auto w-full max-w-md px-6 py-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PersonPortrait person={person} size={40} />
            <div className="min-w-0">
              <MonoLabel>{t(`common.field.${kind}.label`)}</MonoLabel>
              <h2 className="display-title truncate text-xl">{name}</h2>
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <ErrorText>{error}</ErrorText>
        {loading ? (
          <p className="microcopy">{t('common.state.loading')}</p>
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
            onRenamed={() => {
              // The identity changed, so this modal (keyed by the old name) is
              // stale — reload the parent list and close.
              onSaved && onSaved()
              onClose()
            }}
          />
        ) : (
          <div className="space-y-3">
            {person ? (
              <PersonView
                person={person}
                name={name}
                onEdit={() => setEditing(true)}
                onDelete={remove}
                onPractise={() => practise({ person: name, label: name })}
              />
            ) : (
              <>
                <p className="microcopy">{t('people.state.nothing-saved')}</p>
                <div className="flex justify-end">
                  <button className={PRIMARY + ' inline-flex items-center gap-1.5'} onClick={() => setEditing(true)}>
                    <IconPlus /> {t('people.add-details')}
                  </button>
                </div>
              </>
            )}
            {/* Auto-enrich feedback + the manual recovery path when the first
                lookup failed or found a namesake. */}
            {fetching && <p className="microcopy">{t('people.links.fetching')}</p>}
            {!fetching && fetchNote && <p className="microcopy">{fetchNote}</p>}
            <button className="tp-link tp-link-icon" disabled={fetching} onClick={() => fetchLinks(person)}>
              <IconRefresh />
              <span>{t('people.links.refetch')}</span>
            </button>
          </div>
        )}
      </div>
      {practiceDialog}
    </div>
  )
}
