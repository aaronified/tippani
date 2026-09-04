// THE ROW VOCABULARY OF THE CHARACTER AND PERSON SCREENS — the design pack's own,
// nine kinds, and the reason the pack's five sheets are five SCOPES of one object
// rather than five screens.
//
// WHAT THE SCOPES ARE. The identity (a character out of any one work), the same
// character local to a book, to a film and to a game, and the person behind a
// credit. The scope decides the header's art, the locator vocabulary (a page, a
// timestamp, a quest) and the performer pairing (none, actor, voice); everything
// under the identity heading is the same object in all of them. So the rows are
// built once here and the scopes are lists of them.
//
// PRESENTATION ONLY, DELIBERATELY. Every one of these takes its words as props
// and resolves no locale key of its own. The scopes carry the copy, because the
// copy is what differs between them — "Called here" on a book and "Credited as"
// on a film are one row kind and two sentences — and a vocabulary that reached
// for `t()` would have to be told which scope it was in.
//
// TWO OWNER-RULED DEPARTURES FROM THE PACK ARE LANDED HERE, both recorded in
// docs/PLAN.md:
//
//   NO NAME ENDS IN AN ELLIPSIS. The pack sets `text-overflow: ellipsis` on a
//   row's label, a credit's name and the header title; the standing rule forbids
//   it, because a shortened name and a short name look alike. They wear
//   NameScroll, which holds the row height exactly as nowrap does — so a credit
//   row still cannot reflow and shove its neighbours, which was the pack's own
//   reason for nowrap.
//
//   THE STRIP'S FADE IS MEASURED, not counted. The pack fades at four tiles or
//   more; Scroller fades when the row actually overflows, which is right in both
//   cases a count gets wrong, and is the app's standing rule.
import { useEffect, useState } from 'react'
import { coverImgURL } from './api.js'
import { t } from './i18n.js'
import { Silhouette } from './silhouette.jsx'
import { NameScroll, ProviderMark, Scroller, Tooltip } from './ui.jsx'

// ---- the header -------------------------------------------------------------

// ScreenHead — the scope's art, the name, and the crumb under it.
//
// THE GLYPH SITS ON THE WORK'S OWN COVER on a local scope. The medium is the
// first thing a reader needs and the work is the second, and one 32×44 thumbnail
// with the glyph laid on it says both in the slot a back key would otherwise
// hold. A global scope keeps a bare globe, because a globe has no cover to sit on.
//
// NO QUALIFIER CHIP, the owner's ruling: the pack prints one reading `char-film`
// or `people-global`, which are its own screen ids, and it exists there because
// its four sheets sit side by side. In the app you see one, and the crumb plus
// the cover already say the scope.
export function ScreenHead({ title, crumb, glyph, art, artKind, scopeTitle }) {
  return (
    <div className="cs-head">
      <span className="cs-scope-slot" title={scopeTitle}>
        {art ? (
          <span className={'cs-scope-art' + (artKind === 'book' ? ' is-book' : '')}>
            <img src={coverImgURL(art)} alt="" loading="lazy" />
            <span className="cs-scope-overlay">{glyph}</span>
          </span>
        ) : (
          <span className="cs-scope-globe">{glyph}</span>
        )}
      </span>
      <span className="cs-head-names">
        {/* THE TITLE SCROLLS RATHER THAN CLIPPING. A character's name is the one
            thing this screen exists to show. */}
        <NameScroll className="cs-title">{title}</NameScroll>
        {crumb ? <span className="cs-crumb">{crumb}</span> : null}
      </span>
    </div>
  )
}

// ---- the portrait block -----------------------------------------------------

// Face is the round picture every scope leads with, at whichever size its box
// gives it. A missing one is the silhouette — hashed by name, so one character
// keeps one face across every screen — and never the cover hatch, which means a
// picture nobody has supplied for a WORK.
export function Face({ src, name, className = 'cs-face' }) {
  return (
    <span className={className}>
      {src ? <img src={coverImgURL(src)} alt="" loading="lazy" /> : <Silhouette name={name} />}
    </span>
  )
}

// PortraitBlock — the face, its REAL pixel size, and the ways a picture arrives.
//
// THE PIXELS ARE STATED BECAUSE A PICTURE FIELD CANNOT BE JUDGED FROM A
// THUMBNAIL. A 266-wide portrait is not "a portrait", it is a portrait that will
// look soft on a share card, and the app says so rather than letting the reader
// find out on the card. The pack prints "266 × 350 px · under 400 × 400, soft on
// a share card" and the second half only when the first earns it.
//
// MEASURED HERE, WHICH REVERSES THIS COMPONENT'S OWN EARLIER NOTE. It used to say
// `soft` was "the caller's measurement, not a guess here" — correct in principle
// and the reason the feature was never built: no caller had a measurement to
// give, so both global sheets passed a constant string and `soft` unconditionally,
// and every portrait in the app claimed to be too small for a share card whatever
// its size. The picture is the only thing that knows, this component owns the
// picture, and `naturalWidth` is a measurement rather than a guess. A caller may
// still override `px` for a slot where the file is not the subject.
//
// SOFT_FLOOR is the pack's own 400 × 400. It is a share-card threshold and not a
// type measurement, so it stays a number in px.
const SOFT_FLOOR = 400

export function PortraitBlock({ src, name, px, soft, actions }) {
  const [dim, setDim] = useState(null)
  // A new src is a new measurement — without this the previous picture's numbers
  // stay under the new one, which is worse than showing none.
  useEffect(() => { setDim(null) }, [src])
  const measured = dim
    ? t('identity.portrait.px', { w: dim.w, h: dim.h })
      + (dim.w < SOFT_FLOOR || dim.h < SOFT_FLOOR
        ? ' · ' + t('identity.portrait.soft', { n: SOFT_FLOOR })
        : '')
    : px
  const isSoft = dim ? dim.w < SOFT_FLOOR || dim.h < SOFT_FLOOR : !!soft
  return (
    <div className="cs-portrait">
      <span className="cs-face">
        {src
          ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              onLoad={(e) => setDim({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
            />
          )
          : <Silhouette name={name} />}
      </span>
      <span className="cs-portrait-side">
        <span className={'cs-px' + (isSoft ? ' is-soft' : '')}>{measured}</span>
        <span className="cs-face-actions">{actions}</span>
      </span>
    </div>
  )
}

// ---- the rows ---------------------------------------------------------------

// SectionHead — a heading, and the prose that sometimes belongs under it.
export function SectionHead({ label, note }) {
  return (
    <div className="cs-head-row">
      <span className="cs-section">{label}</span>
      {note ? <span className="cs-section-note">{note}</span> : null}
    </div>
  )
}

// SegHead — THE HEADING IS THE CONTROL, on the one section with exactly two
// answers. A heading, a paragraph and a row of buttons stacked three deep is what
// this replaces; two words rather than a dropdown because there are two answers.
export function SegHead({ label, options, value, onPick }) {
  return (
    <div className="cs-seg">
      <span className="cs-section">{label}</span>
      {options.map(([key, word]) => (
        <button
          key={key}
          type="button"
          className="cs-seg-opt tactile"
          aria-pressed={value === key}
          onClick={() => onPick(key)}
        >
          {word}
        </button>
      ))}
    </div>
  )
}

// ScreenRow — the ordinary row: an icon or a face, a label over a subtitle, and a
// badge or a count at the far end.
//
// `trailing` is for the keys a row carries beside itself — a note pencil, a
// remove — which sit OUTSIDE the row's own button rather than inside it, because
// a button inside a button is not a thing and a reader who meant the pencil must
// not open the row.
export function ScreenRow({
  label, sub, meta, monoMeta, badge, icon, face, faceName, danger, tinted, onClick, trailing, title,
}) {
  return (
    <div className="cs-row-wrap">
      <button
        type="button"
        className={'cs-row tactile' + (danger ? ' is-danger' : '') + (tinted ? ' is-tinted' : '')}
        title={title}
        onClick={onClick}
      >
        {icon ? <span className="cs-row-icon">{icon}</span> : null}
        {face !== undefined ? <Face src={face} name={faceName} className="cs-credit-face" /> : null}
        <span className="cs-row-body">
          {/* Never truncated: it scrolls. See the header note. */}
          <NameScroll className="cs-row-label">{label}</NameScroll>
          {sub ? <span className="cs-row-sub">{sub}</span> : null}
        </span>
        {badge ? <span className="cs-row-badge">{badge}</span> : null}
        {meta ? <span className={'cs-row-meta' + (monoMeta ? ' is-mono' : '')}>{meta}</span> : null}
      </button>
      {trailing}
    </div>
  )
}

// FactsRow — three short answers on one line. A part, a locator and an age given
// a row each took 150px of height and read as three unrelated decisions, each
// needing a sentence to explain why it was there. Side by side they are what they
// are, and the label carries the meaning the prose was carrying.
export function FactsRow({ cells }) {
  return (
    <div className="cs-facts">
      {cells.map((c) => (
        <button key={c.label} type="button" className="cs-fact tactile" onClick={c.onClick}>
          <span className="cs-fact-label">{c.label}</span>
          <NameScroll className="cs-fact-value">{c.value}</NameScroll>
        </button>
      ))}
    </div>
  )
}

// PairRow — two counts. ONE LINE AND NOT A STACKED CARD: three short things — a
// glyph, a number and its unit — stacked into 78px of height read as a tile with
// something missing. Side by side they read as the sentence they are: 37 quotes.
export function PairRow({ cells }) {
  return (
    <div className="cs-pair">
      {cells.map((c) => (
        <button key={c.label} type="button" className="cs-count tactile" onClick={c.onClick} title={c.title}>
          {c.icon ? <span className="cs-count-icon">{c.icon}</span> : null}
          <span className="cs-count-fig">{c.figure}</span>
          <span className="cs-count-cap">{c.label}</span>
        </button>
      ))}
    </div>
  )
}

// PillRow — the links, wearing each site's own mark.
//
// "LINKS · 4 · WIKIPEDIA · FANDOM" WAS A ROW THAT COULD ONLY BE READ: you could
// not tell which four, could not open one, and the subtitle truncated the moment a
// fifth arrived. A pill per link is the whole set at a glance and one tap to any
// of them. A site with no mark takes the globe rather than a hand-drawn lookalike
// — the honest signal for "somewhere else on the web".
//
// ROUND MEANS A VALUE HERE, so the add control takes the 9px corner and a dashed
// border and cannot be mistaken for a fifth link.
export function PillRow({ pills, addLabel, addIcon, addTitle, onAdd }) {
  return (
    <div className="cs-pills">
      {pills.map((p) => (
        <a
          key={p.url}
          className="cs-pill tactile"
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          title={p.url}
        >
          <span className="cs-pill-mark">
            {p.slug ? <ProviderMark source={p.slug} /> : p.fallbackIcon}
          </span>
          <span>{p.name}</span>
        </a>
      ))}
      {onAdd ? (
        <button type="button" className="cs-pill is-add tactile" title={addTitle} onClick={onAdd}>
          <span className="cs-pill-mark">{addIcon}</span>
          <span>{addLabel}</span>
        </button>
      ) : null}
    </div>
  )
}

// CreditRow — A PERFORMER CREDIT IS THREE TARGETS IN ONE ROW, and there can be
// several of them.
//
// One "Played by" row with one name was wrong twice over. A character can be
// played by more than one performer in the same work — a de-aged shot, a stunt
// double, a voice over a body — so credits are a LIST with an add row rather than
// a field. And a name that both changes the casting and opens the person is one
// hit target doing two unrelated jobs.
//
// So the row splits where the two jobs split: the PORTRAIT picks who it is (it is
// the thing being replaced, and it wears a caret to say so), the NAME opens that
// person's own record, the pencil notes what is peculiar about this credit, and
// the ✕ takes it off. A credit with nobody named is a legitimate state — a mute
// animated short performs nobody — so it draws in faint rather than being hidden.
export function CreditRow({
  name, note, face, empty, pickTitle, openTitle, noteTitle, removeTitle,
  noteIcon, removeIcon, caret, onPick, onOpen, onNote, onRemove,
}) {
  return (
    <div className="cs-credit">
      <button type="button" className="cs-credit-pick tactile" title={pickTitle} onClick={onPick}>
        <Face src={face} name={name} className="cs-credit-face" />
        <span className="cs-credit-caret">{caret}</span>
      </button>
      <button type="button" className="cs-credit-name tactile" title={openTitle} onClick={onOpen}>
        <NameScroll className={'cs-credit-text' + (empty ? ' is-empty' : '')}>{name}</NameScroll>
        {note ? <span className="cs-credit-note">{note}</span> : null}
      </button>
      <Tooltip label={noteTitle} side="top">
        <button
          type="button"
          className="cs-credit-key tactile"
          aria-label={noteTitle}
          onClick={onNote}
        >
          {noteIcon}
        </button>
      </Tooltip>
      <Tooltip label={removeTitle} side="top">
        <button
          type="button"
          className="cs-credit-key is-danger tactile"
          aria-label={removeTitle}
          onClick={onRemove}
        >
          {removeIcon}
        </button>
      </Tooltip>
    </div>
  )
}

// AppearanceStrip — the works, as covers.
//
// A WORK IS A COVER BEFORE IT IS A ROW OF TEXT, and seventeen of them as list
// rows is four screens of scrolling in a panel that also has to hold the
// identity. So the works are one strip: the caption under the art, and the fade
// at the edge is the whole signal that there is more — no arrows and no counter.
//
// IN RELEASE ORDER, one strip and not one per medium. Four strips under four
// medium headings said "a book is one kind of thing and a film is another", which
// is the phone's Library/Catalogue split and not this screen's subject: here the
// subject is one identity's whole life across media, and the honest reading of it
// is chronological. The medium is on every tile — badge and cover shape — so it
// never needed a heading of its own.
// `onAdd` PUTS A PLUS CARD AT THE END OF THE STRIP, and only the global scopes
// pass one — the owner's instruction. It belongs there and nowhere else: on a
// global record "add a work" means linking this identity to another work in the
// library, which is a thing the identity owns. On a LOCAL scope the strip is the
// same identity's other appearances seen from inside one work, and an add there
// would read as adding a work to the book you are already in.
//
// AT THE END RATHER THAN THE START, because the strip's order is the release
// order and a control at the front would claim a place in it. It is the last
// thing you reach, which is where you are when you have looked at all of them and
// found the one you wanted missing.
export function AppearanceStrip({ tiles, hint, onAdd, addLabel, addTitle, addIcon = '+' }) {
  return (
    <div className="cs-strip">
      <Scroller className="cs-tiles">
        {tiles.map((w) => (
          <div className="cs-tile" key={w.key}>
            <button
              type="button"
              className={'cs-tile-art' + (w.kind === 'book' ? ' is-book' : '')}
              title={w.artTitle}
              onClick={w.onOpen}
            >
              {w.cover ? <img src={coverImgURL(w.cover)} alt="" loading="lazy" /> : null}
              <span className="cs-tile-badge">{w.badge}</span>
              {/* NO CHIP WHERE THERE IS NO PERSON-IN-THE-WORK. On a work somebody
                  WROTE they are the maker, not somebody inside it, and a
                  silhouette there would claim a character nobody has named. */}
              {w.face !== false ? (
                <span className="cs-tile-chip" title={w.faceTitle}>
                  {w.face ? <img src={coverImgURL(w.face)} alt="" loading="lazy" /> : <Silhouette name={w.faceName} />}
                </span>
              ) : null}
            </button>
            <button type="button" className="cs-tile-cap" onClick={w.onOpen}>
              <span className="cs-tile-title">{w.title}</span>
              {w.meta ? <span className="cs-tile-meta">{w.meta}</span> : null}
              {w.count ? <span className="cs-tile-count">{w.count}</span> : null}
            </button>
          </div>
        ))}
        {onAdd ? (
          <button type="button" className="cs-tile cs-tile-add tactile" title={addTitle} onClick={onAdd}>
            {/* THE SHAPE OF A CONTROL, NOT OF A COVER. It takes the tile's width
                so the row keeps its rhythm, and a dashed square corner rather
                than a work's own — the same distinction the links panel draws
                between a link and "add a link": round means a value, and this is
                not one. */}
            <span className="cs-tile-add-art" aria-hidden="true">{addIcon}</span>
            {/* THE COPY HAS A DEFAULT so a second caller cannot invent a second
                wording for one control. The TIP is the caller's, because it is
                the only part that differs: a character appears in a work, a
                person is credited on one. */}
            <span className="cs-tile-add-label">{addLabel || t('identity.works.add.label')}</span>
          </button>
        ) : null}
      </Scroller>
      {hint ? <span className="cs-strip-hint">{hint}</span> : null}
    </div>
  )
}

// NamesRow is the one field that holds a name and every other name — line one
// prints, the rest are the spellings search will find. It is a ScreenRow whose
// value is the printing name and whose subtitle is the rest, opening the field.
//
// SHOWN AS THE SPLIT IT PRODUCES so the reader can see what saving did: the name
// on the right where a value goes, the spellings underneath. A single joined
// string would leave them guessing which line was the one that prints.
export function NamesRow({ label, lines, empty, onOpen }) {
  const [first, ...rest] = lines.length ? lines : ['']
  return (
    <ScreenRow
      label={label}
      meta={first}
      sub={rest.length ? rest.join(' · ') : empty}
      onClick={onOpen}
    />
  )
}

// ScreenBody is the column every scope is drawn into, so the padding is stated
// once rather than per screen.
export function ScreenBody({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 6px 16px' }}>{children}</div>
}
