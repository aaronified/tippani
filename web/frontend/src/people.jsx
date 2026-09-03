import { useEffect, useRef, useState } from 'react'
import { coverImgURL, json, errText } from './api.js'
import { t } from './i18n.js'
import { personImgURL, PersonPortrait, usePeople } from './credits.jsx'
import { usePractice } from './review.jsx'
import { Silhouette } from './silhouette.jsx'
import { useBodyScrollLock, CloseButton, ErrorText, ExpandableDescription, Field, GhostButton, IconCheck, IconClose, IconDelete, IconEdit, IconMerge, IconPlus, IconQuiz, IconPractise, IconRefresh, IconSearch, isPartialDate, Lightbox, MonoLabel, NameInput, NameScroll, PartialDateField, Placeholder, Scroller, Tooltip, useConfirm, useEscape, useBackToClose } from './ui.jsx'

const PRIMARY = 'tp-btn tp-btn-primary'

// The person primitives — portrait, credit splitting, the saved-people map —
// live in credits.jsx so the quiz card can draw a face without importing this
// panel. Re-exported here because this is still where a reader looks for them.
export { CharacterFaces, CreditFaces, DEFAULT_CREDIT_SEPS, parseCreditSeps, personImgURL, PersonPortrait, splitCredits, useCharacterFaces, usePeople, usePortraitFill } from './credits.jsx'


// The external references a person can link out to, in display order. A saved
// link is recognised by hostname; everything else renders as a plain URL row.
// The middle column is the KEY that names the provider, not the name itself:
// vocab.source.* already carries these five for the metadata screens, and a
// provider has one name in this app wherever it is drawn.
// THE LIST IS WHAT CAN BE RECOGNISED, NOT WHAT MAY BE ADDED. Every one of these
// has a mark in providerMarks.js and a name in vocab.source.*, so a link to one
// is drawn with its own glyph; a URL matching none of them is kept whole and
// wears the globe, which is a legitimate kind of link rather than a failure — a
// review, an author's own site, a scan somebody hosted. Adding a row here buys a
// glyph and a name, and nothing about it decides what a reader may paste.
export const PROVIDERS = [
  ['imdb', 'vocab.source.imdb.label', /(^|\.)imdb\.com$/i],
  ['tmdb', 'vocab.source.tmdb.label', /(^|\.)themoviedb\.org$/i],
  ['tvdb', 'vocab.source.tvdb.label', /(^|\.)thetvdb\.com$/i],
  ['letterboxd', 'vocab.source.letterboxd.label', /(^|\.)letterboxd\.com$/i],
  ['igdb', 'vocab.source.igdb.label', /(^|\.)igdb\.com$/i],
  ['wikipedia', 'vocab.source.wikipedia.label', /(^|\.)wikipedia\.org$/i],
  // FANDOM SITS ALONGSIDE WIKIPEDIA, NOT INSTEAD OF IT. Wikipedia covers the
  // book; a fandom wiki covers what is inside it — characters, places,
  // timelines — and a reader chasing a name and a reader checking a publication
  // date want different pages. `wikia.com` is the old domain and still redirects.
  ['fandom', 'vocab.source.fandom.label', /(^|\.)(fandom|wikia)\.com$/i],
  ['wikidata', 'vocab.source.wikidata.label', /(^|\.)wikidata\.org$/i],
  ['wikimedia', 'vocab.source.wikimedia.label', /(^|\.)wikimedia\.org$/i],
  ['openlibrary', 'vocab.source.openlibrary.label', /(^|\.)openlibrary\.org$/i],
  // Google BOOKS specifically. A plain google.com result is a search, not a
  // record, and filing one under the name of a catalogue would be a lie about
  // what the link is.
  ['google', 'vocab.source.google.label', /(^|\.)books\.google\.[a-z.]+$/i],
  ['amazon', 'vocab.source.amazon.label', /(^|\.)amazon\.[a-z.]+$/i],
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


// CreditFaces / CharacterFaces / FaceStack MOVED TO credits.jsx (see there), and
// are re-exported below so the four screens that draw a face cluster are
// untouched. The reason is the one credits.jsx was split out for in the first
// place: the quiz card wants portraits and this file is a SCREEN — the metadata
// panel, its form, its merge flow — so importing it from review.jsx would close
// a cycle (review → people → review, through usePractice).

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

// PersonChip — one credit, as the design pack draws it: a pill carrying a small
// round face and the whole name, in a row that scrolls sideways under its fade.
//
// A CHIP RATHER THAN A LINK IN A SENTENCE. The hero used to read
// "Herman Melville · translator Anna · 1851 · Whales #2" — one line where a
// person, a role word, a year and a series all looked alike, and the only thing
// separating a name from a number was a middle dot. Each person is an object
// now: their own hit target, their own face, their own door.
//
// NO ELLIPSIS ON A PERSON, which is the standing rule and the reason `flex: none`
// and `white-space: nowrap` are both here. The chip is allowed to be wider than
// the column; the row it sits in scrolls and wears a measured fade. A name cut to
// "Bulgak…" is the row deciding which part of somebody's name did not matter.
//
// THE FACE IS ALWAYS DRAWN, silhouette when there is no photograph — the pack's
// rule, and it is what keeps the chips a column of equal shapes rather than a
// ragged mix of two designs.
// TWO OPTIONAL PROPS, BOTH FOR THE CHARACTER CASE, and neither changes a pixel of
// what a person's chip already draws.
//
// `onPress` — because a character is opened BY ID and a person by name. `onOpen`
// hands back `{kind, name}`, which is what PersonModal takes and what every
// existing caller wants; a `characters` record is reached with its own id, and
// resolving a name to get there is how a reader lands on somebody else's Woland.
//
// `faceName` — WHICH NAME THE FACE IS HASHED FROM, which is not always the name
// printed on the chip. The pack is explicit (handoff 1.8): hash the canonical
// name, never the billing, "otherwise a person changes face between two books". A
// novel billing "the professor" and a film billing "Woland" are one record, and
// the two must wear one face. So the label takes the billing and the silhouette
// takes the record's name, defaulting to the label where there is only one name —
// which is every existing caller, unchanged.
//
// `faceSrc` — AN ALREADY-RESOLVED PICTURE, because a character's is not a person's.
// `person.image_path` goes through personImgURL and a character's still goes
// through the cover builder instead — cast.jsx has always drawn it that way, since
// the two live under different roots. Resolving it at the call site is honest:
// the alternative is this component importing a second URL builder and choosing
// between them on a `kind` string, which is a branch that would be wrong the first
// time a third kind of picture appeared.
// `sub` — A SECOND LINE, and the reason the chip has one. A film line's speaker is
// two facts, the character and whoever played them, and one line held both as
// "Woland — Oleg Basilashvili": long, and on a card beside three other chips it
// read as a single unfamiliar name with punctuation in it. Stacked, the eye takes
// the character first and the actor as the caption it is, which is the order a
// reader wants them in.
//
// `clip` — AND THIS ONE DEPARTS FROM A STANDING RULE, on the owner's instruction.
// "Never truncate a name" is the pack's, and it is right nearly everywhere: a
// shortened name and a short name look alike. Here the chips must not wrap — a row
// that reflows moves every other chip when one name is long — and a scroller per
// chip inside a row of chips is a gesture nobody would find. So a long name ends
// in an ellipsis with the whole of it on the `title`, and this is recorded as a
// departure in PLAN.md rather than left to look like an oversight.
const CHIP_CHARS = 18
const clip = (v) => {
  const s = String(v || '').trim()
  return s.length > CHIP_CHARS ? s.slice(0, CHIP_CHARS - 1).trimEnd() + '…' : s
}

export function PersonChip({ kind, name, person, onOpen, onPress, title, faceName, faceSrc, sub }) {
  if (!name) return null
  const full = sub ? `${name} — ${sub}` : name
  // A CHIP THAT OPENS NOTHING IS A LABEL, NOT A CONTROL — so it is a span, and
  // the keyboard walks past it rather than stopping on a press that never
  // happens. This used to be settled by drawing no chip at all, which was right
  // while a line drew at most one; on a row of chips it would have hidden every
  // name but the linked one, which is the opposite of what the row is for.
  const opens = onPress || onOpen
  const Tag = opens ? 'button' : 'span'
  return (
    <Tag
      type={opens ? 'button' : undefined}
      className={'person-chip' + (opens ? ' tactile' : '') + (sub ? ' is-stacked' : '')}
      title={title || `${full} — details`}
      // NO HANDLER AT ALL ON A LABEL, and that is the point rather than a
      // tidy-up: the handler stops propagation, so a label chip drawn inside
      // something that IS pressable — a favourite tile, whose whole head is one
      // button — would swallow the tile's press and do nothing with it. A chip
      // that opens nothing must let the click reach whatever is behind it.
      onClick={
        opens
          ? (e) => {
              e.stopPropagation()
              if (onPress) onPress()
              else onOpen({ kind, name })
            }
          : undefined
      }
    >
      <span className="person-chip-face" aria-hidden="true">
        {faceSrc || person?.image_path
          ? <img src={faceSrc || personImgURL(person.image_path)} alt="" />
          : <Silhouette name={faceName || name} />}
      </span>
      {sub ? (
        <span className="person-chip-lines">
          <span className="person-chip-name">{clip(name)}</span>
          <span className="person-chip-sub">{clip(sub)}</span>
        </span>
      ) : (
        <span className="person-chip-name">{clip(name)}</span>
      )}
    </Tag>
  )
}

// SpeakerChips — EVERY CHARACTER NAMED ON A LINE GETS A CHIP OF ITS OWN.
//
// WHAT THIS REPLACES, and the code it replaces said so itself: a line with one
// resolvable speaker drew one chip, and an ensemble line — several characters,
// which the linker deliberately refuses to guess between — drew a row of small
// FACELESS DISCS instead. "An ensemble line names several characters, the linker
// refuses to guess between them, and then this row is the only thing saying who
// is in it." A stack of discs says how MANY people are in a line and not one of
// their names, which is the one thing a reader wants from it.
//
// So the row is chips now, one per name, in the order the reader typed them.
//
// NO NEW DATA. `character_images` has ridden the quote payload since the cast
// pass and is already one entry per named character, each with the picture stored
// for them — the server splits on the reader's own separators and folds each name
// against the work's cast, because the fold cannot be done in SQL and must not be
// done twice (cast_images.go). This draws what was already arriving.
//
// THE DOOR STAYS WHERE THERE IS ONE. `speaker_cast` is the stored link — who
// SPOKE the line, exactly one or none — and it is the only entry that carries a
// character record, whoever played them, and therefore a page to open. That chip
// keeps its two lines and its press; the rest are a face and a name, which is
// what the discs were trying to be. A chip that opened nothing would be the dead
// control cast.jsx and the single chip already refuse to draw.
//
// IT SCROLLS UNDER A FADE rather than wrapping. A card's chip row is beside the
// quote, and a row that wraps to three lines pushes the words a reader came for
// down the card — so it is a Scroller, measured, which is the app's standing rule
// for anything that might not fit.
export function SpeakerChips({ images = [], speaker = null, onOpenCharacter = null, className = '' }) {
  const rows = chipRows(images, speaker)
  if (rows.length === 0) return null
  return (
    // A SPAN, because this row draws inside the favourite tile's button on Home
    // and a div is not allowed there. `.speaker-chips` sets `display: flex`, so
    // the element makes no difference to the layout.
    // `className` is the CALLER'S spacing, not the row's: the film frame puts a
    // step above the row and the book card does not, because on the book card the
    // block above it already carries one. The row owns everything inside it and
    // nothing outside it.
    <Scroller as="span" axis="x" className={('speaker-chips ' + className).trim()}>
      {rows.map((r) => (
        <PersonChip
          key={r.key}
          kind="character"
          name={r.name}
          // The billing prints and the RECORD's name is hashed for the
          // silhouette — handoff 1.8, so one character does not change face
          // between a novel and its adaptation.
          faceName={r.faceName}
          faceSrc={r.faceSrc}
          sub={r.sub}
          title={r.title}
          onPress={r.onPress}
        />
      ))}
    </Scroller>
  )
}

// chipRows folds the stored speaker into the list of named characters.
//
// THE SPEAKER LEADS, because who said it is the first thing about a line and the
// rest are who else is in it. It is matched by FOLDED NAME rather than by
// position: the speaker link is stored and the names are typed, so the two agree
// on spelling only after the same fold the server used.
//
// A SPEAKER NAMED NOWHERE ON THE LINE IS STILL DRAWN. It is a stored fact and the
// line's text is free — somebody may have edited the words and left the link — so
// dropping it would hide the one thing about the line the app is sure of.
export function chipRows(images, speaker) {
  const sp = speaker && speaker.name ? speaker : null
  const spKey = sp ? creditKey(sp.name) : ''
  const out = []
  if (sp) {
    out.push({
      key: 'speaker',
      name: sp.name,
      faceName: sp.record_name || sp.name,
      // THE FACE FALLS BACK TO THE ACTOR'S: a character with no picture of their
      // own wears the face of whoever played them rather than no face at all.
      faceSrc: sp.image ? coverImgURL(sp.image) : sp.actor_image ? coverImgURL(sp.actor_image) : '',
      sub: sp.actor || '',
      title: t('common.quote.speaker.tip', { name: sp.name }),
      // Only where the card has a stack to open into and a record to open — the
      // three conditions the single chip already kept.
      onPress: sp.character_id && speaker.onOpen ? () => speaker.onOpen(sp) : undefined,
    })
  }
  // DUPLICATE NAMES FOLD. A reader who typed "Woland, Woland" made a mistake, and
  // two identical chips beside each other look like a rendering fault rather than
  // like their typing. The speaker's key seeds the set, which is also what keeps
  // it from being drawn twice.
  const seen = new Set(spKey ? [spKey] : [])
  for (const c of images || []) {
    const name = (c?.name || '').trim()
    const key = creditKey(name)
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push({
      key: 'named:' + name,
      name,
      faceName: name,
      faceSrc: c.path ? coverImgURL(c.path) : '',
      // NO SECOND LINE HERE, and its absence is information: the two-line chip
      // means "this character, played by that person", which is a fact the app
      // holds only for the stored speaker. A blank second line would claim the
      // others had no performer rather than that nobody has said.
      sub: '',
      title: t('common.quote.named.tip', { name }),
      onPress: undefined,
    })
  }
  return out
}

// creditKey folds a typed name the way the server's store.CastKey does for the
// one comparison this file makes — the speaker against the names on the line.
//
// IT IS NOT store.CastKey AND MUST NOT PRETEND TO BE. That fold is Go's, over
// typographic punctuation and Unicode case, and cast_images.go says in capitals
// why it cannot be reimplemented here. What this needs is narrower: whether two
// strings on ONE line are the same name, where both came from the same reader
// typing. Lowercase and collapsed whitespace answers that, and a miss costs one
// duplicate chip rather than a wrong lookup.
function creditKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
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
          <IconPractise /> {t('common.action.practise.label')}
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
  const { ask, confirmDialog } = useConfirm()
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
  // The picture strip. null = never asked; [] = asked and found nothing.
  const [pics, setPics] = useState(null)
  const [picsBusy, setPicsBusy] = useState(false)
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
    if (!(await ask(t('people.rename.confirm', { from: name, to, noun, entity })))) return
    setRenaming(true)
    setError('')
    const r = await json('POST', '/people/rename', { kind, from: name, to })
    setRenaming(false)
    if (r.ok) onRenamed && onRenamed(to)
    else setError(errText(r, t('error.rename.generic')))
  }

  // findPicture — the one button, doing whatever this install can do.
  //
  // IT USED TO BE A LINK OUT AND NOTHING ELSE: open a web image search in a new
  // tab, find a photograph, copy its address, come back, paste it into the field
  // below. That was the app admitting it had no portrait source for a person —
  // there is no keyless one — and it is a five-step errand for one picture.
  //
  // POST /images/search answers with whatever suppliers are configured, so the
  // strip appears for an install that has a Custom Search key or the Amazon
  // cookie, and an install with neither gets EXACTLY what it got before: the tab.
  // One control either way, because "search for a picture" is one intention and
  // splitting it into two buttons would make the reader work out which of them
  // their server can honour.
  async function findPicture() {
    setPicsBusy(true)
    setError('')
    // THE PERSON ID BUYS THE TOP OF THE LADDER. With it the server can reach
    // whatever supplier this person is pinned to — and, failing that, the
    // TheTVDB person id a cast fetch already stored against their name — instead
    // of handing their name to a search engine. Without it (a person not yet
    // saved) the ladder simply starts lower down.
    const r = await json('POST', '/images/search', {
      kind: 'portrait', name, person_id: initial?.id || 0,
    }).catch(() => ({ ok: false }))
    setPicsBusy(false)
    const images = r.ok ? r.data?.images || [] : []
    // ANY RUNG, NOT THE TWO WE USED TO HAVE. `sources` names every supplier the
    // request could reach, and the ladder added more of them — testing for
    // google-or-amazon by name would send a reader with a working TheTVDB key
    // out to a browser tab.
    const configured = r.ok && Object.values(r.data?.sources || {}).some(Boolean)
    if (!configured) {
      window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(name + ' ' + kind)}`, '_blank', 'noopener')
      return
    }
    setPics(images)
  }

  async function submit(e) {
    e.preventDefault()
    // AND IT STOPS HERE. This form is opened from inside other forms — the work
    // Details panel renders the person editor from its People section — and a
    // React synthetic submit bubbles up the React tree whether or not the DOM
    // nests. Without this, saving a person also submitted whatever form the modal
    // happened to be standing in.
    e.stopPropagation()
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
      {confirmDialog}
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
          {/* IN THE APP WHERE IT CAN BE, AND IN A TAB WHERE IT CANNOT — see
              findPicture. The field below still takes any pasted address, which
              is what the tab route comes back to. */}
          <button
            type="button"
            className="tp-link tp-link-icon"
            style={{ fontSize: 'var(--type-ui-11)' }}
            disabled={picsBusy}
            onClick={findPicture}
          >
            {/* The magnifier, not IconOpen: the ACTION is a search, and the ↗ this
                replaces was carrying "opens a tab" — which every other outbound
                chip in this modal states with no arrow at all. */}
            <IconSearch />
            <span>{picsBusy ? t('common.state.loading') : t('people.form.image-search')}</span>
          </button>
        </div>
        {pics && (
          <div className="mb-1.5 space-y-1.5">
            <MonoLabel className="block">
              {pics.length ? t('people.form.image-pick.prose') : t('people.form.image-pick.none')}
            </MonoLabel>
            <div className="flex flex-wrap gap-2">
              {pics.map((im) => (
                <button
                  key={im.url}
                  type="button"
                  className="cover-pick"
                  aria-label={t('people.form.image-pick.use', { source: im.source })}
                  onClick={() => {
                    // The full-size original is what is stored; the thumbnail was
                    // only ever what the page was allowed to draw.
                    setImageUrl(im.url)
                    setClearImage(false)
                    setPics(null)
                  }}
                >
                  <img src={im.thumb || im.url} alt="" loading="lazy" />
                  <span className="microcopy">{im.source}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
  const { ask, confirmDialog } = useConfirm()
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)

  // ITS OWN BACK ENTRY, or the press that dismisses it dismisses whatever opened
  // it. Reported from the Details panel: open People, tap an actor, dismiss the
  // person — and the People panel went too. usePanelStack pushes a history entry
  // per panel and this surface pushed none, so on a phone the back gesture walked
  // straight past it to the panel underneath. A submenu owes its own entry.
  useBackToClose(true, onClose)

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

  // ONE OWNER FOR ESCAPE — see useEscape in ui.jsx. Mounted only while open, so
  // it registers unconditionally.
  useEscape(true, onClose)

  async function remove() {
    if (!person) return
    if (!(await ask(t('people.delete.confirm', { kind: t(`common.field.${kind}.label`), name })))) return
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
      {/* Portalled to <body> by ConfirmDialog itself, so it lands above this
          scrim: the question is about the record this modal is showing, and the
          click that answers it must not be the click that closes it. */}
      {confirmDialog}
      <div role="dialog" aria-modal="true" aria-label={name} className="hand-card hc-r2 mx-auto w-full max-w-md px-6 py-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PersonPortrait person={person} size={40} />
            <div className="min-w-0">
              <MonoLabel>{t(`common.field.${kind}.label`)}</MonoLabel>
              <h2 className="display-title text-xl"><NameScroll>{name}</NameScroll></h2>
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
