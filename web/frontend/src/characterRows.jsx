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
import { useEffect, useRef, useState } from 'react'
import { coverImgURL } from './api.js'
import { t } from './i18n.js'
import { Silhouette } from './silhouette.jsx'
import { useSlowArrival } from './imageWait.js'
import { IconChevron, IconClose, IconEdit, IconPlus, Lightbox, NameScroll, ProviderMark, Scroller, Tooltip, usePanelHead } from './ui.jsx'

// ---- the header -------------------------------------------------------------

// ScreenHead — the scope's art, the name, and the crumb under it. It renders
// NOTHING; it hands the panel its header.
//
// WHY IT DRAWS NOTHING NOW. It used to draw a header bar as the first thing in a
// panel BODY — its own `border-bottom`, its own `--card-top` ground, and the
// record's name — directly beneath a panel head that had already drawn that name
// and a ✕. Two header bars, stacked, one of them repeating the other's only word.
// The pack has ONE (`character-popup.dc.html:33`), and it is the panel's: cover,
// name over crumb, ✕. So this publishes upward and the head draws it.
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
  const slot = (
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
  )
  // INSIDE A PANEL IT PUBLISHES; OUTSIDE ONE IT DRAWS. `usePanelHead` returns
  // false when there is no host, which is the same "rendered inline" case
  // `useFormHost` has always recognised — a sheet rendered on its own still needs
  // a header, and a sheet rendered in a panel must not add a second one. Making
  // the fix conditional on the host rather than unconditional is also what keeps
  // every test that renders a body bare asserting the same things it always did.
  const published = usePanelHead({ title, crumb, art, artKind, slot })
  if (published) return null
  return (
    <div className="cs-head">
      {slot}
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
// Face — a person's picture, or the glyph that stands in for one.
//
// A PICTURE THAT DOES NOT ARRIVE IS NOT A PICTURE, and the browser's own answer
// to that is a torn-page mark that reads as "the server is broken". The owner
// photographed one on a work tile: "the character chip (delia sturridge) on the V
// for vendetta poster is a missing image glyph that looks like server has broke.
// it should be simply a random person glyph, as used in the actual delia
// sturridge character page." A row that HAS no picture already draws that glyph;
// a row whose picture failed drew something worse than nothing.
//
// A PATH IS NOT A PICTURE — that is the whole of the confusion. The record stores
// a path, so every one of these sites branched on whether a path was stored and
// none of them on whether the file behind it arrived. The two are different
// questions and only the second one the reader can see.
//
// `url` IS PASSED IN because the sites genuinely differ: a portrait under
// `personImgURL`, a work's art under `coverImgURL`, and an already-built address
// under neither. What they must NOT keep their own copy of is the fallback, which
// is why it lives here.
export function Face({ src, name, className = 'cs-face', imgClass, url = coverImgURL, title, onLoad, onBroken, loading = 'lazy', fallback, style, imgRef }) {
  const [broken, setBroken] = useState(false)
  const path = String(src || '')
  // A NEW PATH DESERVES ITS OWN CHANCE. Without this a row that fails once keeps
  // the glyph after the picture is replaced, because React reuses the component
  // and the flag outlives the src it was set for.
  const [arrived, setArrived] = useState(false)
  // AND A CACHED PICTURE NEVER FIRES `load` — the same fact `PortraitBlock` states
  // twenty lines down and works around for its MEASUREMENT, which this flag did
  // not. The consequence was not a missing caption but a permanent animation: the
  // sweep below is `1.1s linear infinite`, it is gated on this flag, and a picture
  // already in the browser's cache never fires the event that clears it. So the
  // hero portrait on a character or a person sheet swept for as long as the panel
  // stayed open, on every visit after the first. The owner: "i keep on getting
  // flickers even long after the popup is opened… and i never saw anything pending
  // to load." Nothing WAS pending; that was the whole of it.
  //
  // `complete` MEANS FINISHED, NOT SUCCEEDED, so `naturalWidth` decides which:
  // a cached FAILURE is complete with a zero width and fires no `error` either,
  // which left the zoom button live over a picture that was never coming.
  const own = useRef(null)
  const hold = (node) => {
    own.current = node
    if (typeof imgRef === 'function') imgRef(node)
    else if (imgRef) imgRef.current = node
  }
  useEffect(() => {
    setBroken(false)
    setArrived(false)
    const img = own.current
    if (!img || !img.complete) return
    if (img.naturalWidth > 0) setArrived(true)
    else { setBroken(true); onBroken?.() }
    // `onBroken` is the caller's and is read rather than tracked: adding it to the
    // deps would re-run this on every render that hands a fresh closure, which is
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  const empty = !path || broken
  // A MARK ONLY WHERE THE BROWSER IS ACTUALLY FETCHING. `loading` defaults to
  // lazy here, and a lazy picture that is off-screen has not been REQUESTED —
  // a "still coming" mark over it would describe a wait nobody is having, on
  // ninety rows at once, and animate all ninety against §8's idle-CPU budget.
  // Eager is one caller (PortraitBlock, which measures its picture and says so),
  // and that is also the only place a face is large enough for the mark to be
  // information rather than a twitch. The lazy ones keep the reserved box they
  // already had.
  const waiting = useSlowArrival(!empty && !arrived && loading === 'eager')
  // `is-empty` IS DRAWN FROM WHAT IS DRAWN, not from what is stored. Three
  // stylesheets set that class from the presence of a PATH — the grey plate a
  // silhouette sits on, its padding, its colour — so a picture that failed to
  // arrive drew an unstyled glyph in a row of styled ones, which is a second
  // way of saying the same thing the fallback exists to stop. The one place
  // that knows whether a stand-in is on the screen is the thing drawing it.
  // WHAT STANDS IN IS THE CALLER'S, WHERE IT GENUINELY DIFFERS. Most slots want
  // the silhouette — a person, unphotographed — and that is the default. A few
  // are ORNAMENTS that draw nothing when there is no picture: a portrait beside a
  // group heading, the thumbnail next to "remove the picture". Giving those a
  // glyph would put a face where the design draws none, so they pass `null` and
  // a failed picture leaves the same gap an absent one does. What they may NOT do
  // is keep their own idea of when a picture has failed, which is the whole point
  // of this function.
  const stand = fallback === undefined ? <Silhouette name={name} /> : fallback
  if (empty && stand === null) return null
  return (
    <span className={empty ? `${className} is-empty` : className} title={title} style={style}>
      {empty
        ? stand
        : (
          <img
            // THE CALLER MAY NEED THE PICTURE, not a way to go looking for it.
            // A block that MEASURES its portrait used to find it with
            // `querySelector('img')` over its own subtree — and that subtree
            // holds the picture editor, whose provider strip is a row of
            // thumbnails. So a slot with no portrait (this function draws a
            // silhouette, not an `<img>`) measured the first thumbnail in the
            // editor instead and captioned somebody else's 180×270 as the
            // record's own. A ref cannot pick the wrong element: where there is
            // no picture there is nothing to point at.
            ref={hold}
            src={url(path)}
            // SOME STYLESHEETS DRESS THE PICTURE AND NOT ITS BOX — a board's
            // tile, a binned record's face — and those callers keep their class
            // on the picture rather than being rewritten around this one. The
            // wrapper then carries `display: contents` and adds nothing.
            className={[imgClass, waiting ? 'img-wait' : ''].filter(Boolean).join(' ') || undefined}
            alt=""
            loading={loading}
            // AND THE CALLER MAY NEED TO KNOW, not to decide. A slot whose whole
            // purpose is the picture — a button that zooms one — has nothing left
            // to be once it has gone, and a control that does nothing is the
            // defect `make controls` exists to catch. The judgement of WHETHER a
            // picture failed stays here; what a screen does about it is its own.
            onError={() => { setBroken(true); onBroken?.() }}
            // THE ARRIVAL IS THIS FUNCTION'S AND WHAT TO DO ABOUT IT IS THE
            // CALLER'S — the same split `onBroken` above already makes.
            onLoad={(e) => { setArrived(true); onLoad?.(e) }}
          />
        )}
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
// LOW CONTRAST, MEASURED RATHER THAN ASSERTED. `identity.portrait.soft` has read
// "low contrast" since it was written, and the code that showed it tested
// `w < 400 || h < 400` — a SIZE. So a small picture was labelled low contrast and
// a washed-out one said nothing, which the owner spotted from the screen: "the
// character/actor cards do not say the size of the image or whether they are low
// contrast". The words and the measurement now agree, and they are two facts
// rather than one.
//
// THE MEASUREMENT: luminance over a 32×32 downsample, and the spread between the
// 5th and 95th percentiles. Percentiles rather than min and max because one white
// pixel of background or one black eyelash decides a min/max range and neither is what a
// reader means by contrast. 0.32 of the 0–1 range is about where a portrait stops
// having a readable face in it; a flat scan of a newspaper photograph sits near
// 0.2 and a lit studio headshot near 0.7.
//
// AN ABSOLUTE SPREAD RATHER THAN A RATIO, deliberately. Michelson contrast —
// (max−min)/(max+min) — says a portrait whose whole range is 0.02 to 0.25 has
// high contrast, and on its own terms it does. But these are drawn on this app's
// dark ground, where that portrait is a smudge: the question the caption answers
// is "will a reader see a face", not "does this file use its range well". A dark
// picture flagged here is not a false alarm.
const CONTRAST_FLOOR = 0.32
// THE SHAPE THE APP DRAWS PORTRAITS AT. The pack's slots are 2:3, and everything
// wider or squarer is centre-cropped by `object-fit: cover` — silently, so half a
// face can be outside the circle with nothing on the screen to say so.
const PORTRAIT_RATIO = 2 / 3
// AND THE TOLERANCE IS ON WHAT IS LOST, not on the difference between two
// ratios. Eight hundredths of raw `w/h` sounds generous and is not evenly
// generous: 600×1000 is 0.6 against 0.667, a difference of 0.067, and passed —
// while `cover` was taking TEN PER CENT off the top and bottom of it. The same
// 0.067 nearer 1:1 is a couple of per cent. So the question asked here is the
// reader's — how much of this picture is not on the screen — and two per cent is
// where it stops being worth a word.
const CROP_SLACK = 0.02
// THE SAMPLE GRID, and the floor under the contrast measurement. A picture
// smaller than the grid is UPSCALED into it, so a 1×1 file fills all 1,024
// samples with one colour and reports a spread of zero: arithmetically true,
// and an invention. A file with fewer pixels than the grid gets no answer.
const SAMPLE = 32

// The measured contrast, or null where it cannot be measured — a canvas tainted
// by a remote file, or an engine without one. Null prints nothing: a guess about
// somebody's portrait is worse than silence.
function contrastOf(img) {
  try {
    const n = SAMPLE
    // A SOURCE SMALLER THAN THE GRID IS NOT MEASURED. `drawImage` will happily
    // scale a 1×1 up to 32×32, and the spread of one colour is zero — so the
    // caption called a one-pixel file low contrast, which is the sort of true
    // sentence that teaches a reader to stop reading the line.
    if (img.naturalWidth < n || img.naturalHeight < n) return null
    const c = document.createElement('canvas')
    c.width = n
    c.height = n
    const g = c.getContext('2d')
    if (!g) return null
    g.drawImage(img, 0, 0, n, n)
    const { data } = g.getImageData(0, 0, n, n)
    const lum = []
    for (let i = 0; i < data.length; i += 4) {
      // TRANSPARENT PIXELS ARE NOT BLACK ONES. A cut-out PNG's transparency reads
      // as (0,0,0,0) here, which is a luminance of zero — so a flat portrait on a
      // transparent ground took a full-range spread out of its own background and
      // was never flagged. Anything under a quarter opaque is not part of the
      // picture a reader sees.
      if (data[i + 3] < 64) continue
      lum.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255)
    }
    // NOTHING TO MEASURE IS NOT LOW CONTRAST. A frame with almost nothing opaque
    // in it gets no answer, and no answer prints nothing.
    if (lum.length < 16) return null
    lum.sort((a, b) => a - b)
    const at = (q) => lum[Math.min(lum.length - 1, Math.floor(q * lum.length))]
    return at(0.95) - at(0.05)
  } catch {
    return null
  }
}

// The share of the picture `object-fit: cover` will not show, filling a 2:3
// slot. Whichever axis is long loses the overflow off both ends, so the visible
// share is the smaller ratio over the larger and the loss is the rest.
export function croppedShare({ w, h }) {
  if (!w || !h) return 0
  const r = w / h
  return 1 - Math.min(r, PORTRAIT_RATIO) / Math.max(r, PORTRAIT_RATIO)
}

// The picture's shape, said as a ratio, only where enough of it is being cut to
// matter. `gcd` so 1000×1500 reads as 2:3 and 1024×1024 as 1:1 rather than as
// four digits a reader has to divide.
function ratioOf({ w, h }) {
  if (!w || !h) return ''
  if (croppedShare({ w, h }) <= CROP_SLACK) return ''
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const d = gcd(w, h) || 1
  return t('identity.portrait.ratio', { a: Math.round(w / d), b: Math.round(h / d) })
}

export function PortraitBlock({ src, name, px, soft, from = '', actions, editor = null }) {
  const [dim, setDim] = useState(null)
  const [spread, setSpread] = useState(null)
  // THE PICTURE OPENS FULL SCREEN, on the owner's report that it used to: "the
  // people/detail screen hero picture (the one at the top) should be clickable and
  // show the picture in full screen (this behaviour was there in the old picture
  // screen)." That screen is `people.jsx`, which has carried its own `Lightbox`
  // since before this block existed — so THREE screens lost the behaviour when
  // they moved onto the shared block (a character's own record, a character in one
  // work, and a person's record), and putting it here is what stops a fourth
  // losing it.
  const [zoom, setZoom] = useState(false)
  // AND A PICTURE THAT DID NOT ARRIVE IS NOT ONE TO OPEN. `src` says a path is
  // stored; it does not say the file behind it came back. Gating the press on the
  // path alone leaves a live button over the silhouette `Face` drew instead — and
  // pressing it opens a viewer onto the same broken address, which is the dead
  // control `make controls` exists to catch. `Face` judges whether the picture
  // failed and hands the fact over; what the screen does about it is here.
  const [broken, setBroken] = useState(false)
  // THE PICTURE ITSELF, not the first `<img>` under this block. The editor lands
  // inside `.cs-portrait` and its provider strip is a row of thumbnails, so a
  // subtree query measured one of those whenever the slot had no portrait of its
  // own — captioning an editor thumbnail's 180×270 as the record's picture.
  const pic = useRef(null)
  const read = (img) => {
    if (!img?.naturalWidth) return
    setDim({ w: img.naturalWidth, h: img.naturalHeight })
    setSpread(contrastOf(img))
  }
  // A new src is a new measurement — without this the previous picture's numbers
  // stay under the new one, which is worse than showing none.
  //
  // AND A CACHED PICTURE NEVER FIRES `load`. The measurement rode on that event
  // alone, so the size appeared on a first visit and the caption fell back to
  // "the record's own picture" on every visit after — which is the screen the
  // owner sent, a loaded portrait with no size under it. An image that is already
  // `complete` is measured here instead of waited for.
  useEffect(() => {
    setDim(null)
    setSpread(null)
    // A NEW PATH DESERVES ITS OWN CHANCE — the same reasoning `Face` states for
    // its own flag. Without this a slot whose picture failed once stays unpressable
    // after the reader replaces it.
    setBroken(false)
    const img = pic.current
    if (img?.complete) read(img)
  }, [src])
  // THREE FACTS, EACH EARNED, and the size is the only one that is always true.
  // The others are problems, and a caption that lists a problem the picture does
  // not have is a caption a reader stops reading.
  const notes = []
  // AND A CROP IS NOT A FAULT. The caption goes red on `is-soft`, which is the
  // app's way of saying "this picture is not good enough" — and a flawless
  // 2000×2000 studio portrait is not that, it is a portrait the slot will frame.
  // Painting the whole line red for it warns about the one fact in it that is
  // nobody's mistake, and the two facts that ARE lose their colour by sharing it.
  let fault = false
  if (dim) {
    if (dim.w < SOFT_FLOOR || dim.h < SOFT_FLOOR) {
      notes.push(t('identity.portrait.small', { n: SOFT_FLOOR }))
      fault = true
    }
    if (spread != null && spread < CONTRAST_FLOOR) {
      notes.push(t('identity.portrait.soft'))
      fault = true
    }
    const shape = ratioOf(dim)
    if (shape) notes.push(shape)
  }
  const measured = dim
    ? [t('identity.portrait.px', { w: dim.w, h: dim.h }), ...notes].join(' · ')
    : px
  const isSoft = dim ? fault : !!soft
  // HOISTED, so the pressable branch and the plain one cannot drift. Two copies of
  // a picture's props is how one keeps `loading="eager"` and the other quietly
  // stops being measured.
  const face = (
    <Face
      src={src}
      name={name}
      url={(x) => x}
      // EAGER, BECAUSE THIS ONE IS MEASURED. `loading="lazy"` is right for a face
      // in a list of ninety and wrong for the one picture on the screen whose
      // dimensions the block prints: a deferred load defers the measurement, and
      // the caption sits on the caller's guess until the reader scrolls something
      // that is already in view.
      loading="eager"
      imgRef={pic}
      onLoad={(e) => read(e.target)}
      // CLOSING THE VIEWER TOO, not just retiring the button. A picture can fail
      // while it is already open — the viewer renders its own `<img>` at the same
      // address — and leaving a full-screen overlay of a torn-page mark up is the
      // worse half of the same defect.
      onBroken={() => { setBroken(true); setZoom(false) }}
    />
  )
  return (
    <div className="cs-portrait">
      {/* THE SCREEN THE OWNER NAMED AS THE MODEL — "a random person glyph, as used
          in the actual delia sturridge character page" — and it was branching on
          the stored path like the rest. `Face` owns the fallback; the measurement
          is this block's own and rides along on the load. */}
      {/* THE PRESS IS A SIBLING OF THE PICTURE AND NOT ITS PARENT, which is not a
          styling preference. It was written as a wrapper — `<button>{face}</button>`
          where there is a picture and a bare `{face}` where there is not — and
          that makes the two branches two React positions: the moment a picture
          FAILS and the button is retired, the face lands at a different position,
          remounts, forgets that it failed, and asks the server for the same
          missing file again. As a sibling the face never moves, so `Face`'s own
          judgement survives the button being taken away.

          PRESSABLE ONLY WHERE A PICTURE ARRIVED — both halves, and see `broken`
          above for the second. A silhouette means "a person, unphotographed", so
          pressing it would open a viewer onto nothing, which is the dead control
          `make controls` exists to catch. The button carries no chrome of its own:
          it covers the face's circle exactly and the picture is the affordance. */}
      <span className="cs-portrait-face">
        {face}
        {src && !broken ? (
          <button
            type="button"
            className="cs-portrait-zoom"
            aria-label={t('identity.portrait.zoom.aria', { name })}
            onClick={() => setZoom(true)}
          />
        ) : null}
      </span>
      {/* `src`, NOT `path` — this block's URL is already resolved. See the `url`
          prop above and Lightbox's own note on why the two are named apart. */}
      {zoom && src && <Lightbox src={src} title={name} onClose={() => setZoom(false)} />}
      <span className="cs-portrait-side">
        {/* AND NOTHING WHERE THERE IS NOTHING TO MEASURE. An empty span is still a
            child of an 8px-gap column, so a slot with no picture drew a line of
            air above the caption that explains why. */}
        {measured ? <span className={'cs-px' + (isSoft ? ' is-soft' : '')}>{measured}</span> : null}
        {/* WHOSE PICTURE THIS IS, when it is not the one this slot is about. Only
            drawn when the caller has something to say: a picture that IS the
            slot's own needs no caption, and a caption under every portrait is a
            caption nobody reads. */}
        {from ? <span className="cs-px-from">{from}</span> : null}
        <span className="cs-face-actions">{actions}</span>
      </span>
      {/* THE EDITOR IS NOT A VERB, and putting it among them cost it its width.
          `usePicturePicker` returns a pair — the verbs are the trigger, the editor
          is the URL field, the upload and the provider strip the trigger reveals —
          and every caller passed both through `actions`, which lands inside
          `.cs-portrait-side`: the column left over beside a `max(96px, 7.4em)`
          face. Measured at 320px on a character sheet, the URL input was **45px
          wide** and the panel body scrolled sideways, 325px of content in 294px.
          A field for a URL that fits eight characters is a field nobody can read
          what they typed into. On its own line, at the block's full width. */}
      {editor ? <span className="cs-portrait-editor">{editor}</span> : null}
    </div>
  )
}

// ---- the rows ---------------------------------------------------------------

// SectionHead — a heading, the prose that sometimes belongs under it, and the one
// control that belongs BESIDE it.
//
// `action` IS THE PACK'S OWN SLOT, not an extension of it: every `head()` in
// `work-details-popup.dc.html` takes a second argument, and the cast's is
// `addTo('TMDB')`. A section whose whole content is a list has nowhere else to
// put "and here is how you change this list" — a row under the list reads as a
// member of it, and a control above the heading belongs to the screen rather
// than to the section.
//
// ONE ACTION WHERE THE PACK HAS TWO, and the departure is the app's own earlier
// decision rather than a shortcut. `addTo(src)` is `[Add, Fetch]`; the app puts
// its cast fetches on the FETCH screen with the metadata fetch, deliberately —
// "offers them where the other fetch is, not inside the People panel", which is
// a test — so a second key here would be a door to a screen two presses away
// wearing the word for something that happens in one. Add lives in the cast
// editor, which is what this one key opens.
export function SectionHead({ label, note, action, actionLabel, actionTitle }) {
  return (
    <div className="cs-head-row">
      {/* THE HEADING AND ITS CONTROL SHARE A LINE; the prose keeps its own. The
          row is a column so that a note sits under the heading rather than
          beside it, which is why the two that DO sit side by side are wrapped. */}
      <div className="cs-head-top">
        <span className="cs-section">{label}</span>
        {action ? (
          <button type="button" className="cs-section-action" title={actionTitle} onClick={action}>
            <IconEdit size={13} />
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </div>
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
//
// `edit` MARKS A ROW AS A DOOR TO AN EDITOR, and it is the owner's ruling: "there
// are no edit pencils on the fields." A row printing `Born  1942` with nothing
// else on it reads as a stated fact, and it is a control — the reader has no way
// to know the value is theirs to change short of pressing every row to find out.
//
// A DEPARTURE FROM THE PACK, argued here rather than found later. The pack's
// `row()` puts a glyph in a LEFT slot and uses it for a row's subject (`Note` is
// `icon:'edit'`, merge is `icon:'merge'`, remove is `icon:'trash'`) — the
// identity rows pass none, so their labels start at the edge. Three identical
// pencils stacked in that slot would push `Name`, `Sort name` and `Born` right to
// make room for a glyph that says the same thing three times, and would collide
// with the rows whose left glyph is their subject. At the trailing edge it reads
// as what it is: a mark on the rows that open something, absent from the rows
// that do not — which is the distinction the owner is asking to see.
//
// INSIDE THE BUTTON AND `aria-hidden`, unlike `trailing`. It is not a second
// target: the whole row already opens the editor, and a pencil beside it that
// does the same thing is two controls for one act. Screen readers get the row's
// own label and title, which already say what pressing it does.
export function ScreenRow({
  label, sub, meta, monoMeta, badge, icon, face, faceName, danger, tinted, onClick, trailing, title, edit,
}) {
  return (
    <div className="cs-row-wrap">
      <button
        type="button"
        className={'cs-row tactile' + (danger ? ' is-danger' : '') + (tinted ? ' is-tinted' : '')}
        title={title}
        // A ROW WITH NOWHERE TO GO SAYS SO — `AppearanceStrip`'s rule, which a row
        // needs for the same reason a tile does. `aria-disabled` rather than
        // `disabled`, so the row stays readable and its title still explains: a
        // performer the library has no record for is worth listing on the
        // character they played, and a press that changes nothing and gives no
        // reason is the defect class the control probe exists for.
        aria-disabled={onClick ? undefined : 'true'}
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
        {/* THE VALUE SCROLLS TOO, AND IT HAS TO GIVE WAY. It was `flex: none` with
            no scroller, so a long one — a per-work description is free text — took
            its whole width out of the row and squeezed the LABEL's scroller until
            "In this work" clipped to "In this wor". The reported clip was fixed by
            shortening the string beside it, which is the repair CLAUDE.md names as
            wrong: "If text clips, grow the box." The box gives way now, and what
            does not fit scrolls under the fade rather than being cut — this value
            is a NAME on some rows (the character a work bills) and the standing
            rule binds it. */}
        {meta ? (
          <NameScroll className={'cs-row-meta' + (monoMeta ? ' is-mono' : '')}>{meta}</NameScroll>
        ) : null}
        {edit ? (
          <span className="cs-row-pencil" aria-hidden="true"><IconEdit size={15} /></span>
        ) : null}
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
        // A CELL WITH NOWHERE TO GO SAYS SO — `AppearanceStrip`'s rule, applied
        // here for the reason `PairRow` below records: these are drawn from a
        // handler the caller may not have, and a button given `onClick={undefined}`
        // is a live control that does nothing.
        <button key={c.label} type="button" className="cs-fact tactile" aria-disabled={c.onClick ? undefined : 'true'} onClick={c.onClick}>
          <span className="cs-fact-label">{c.label}</span>
          <span className="cs-fact-line">
            <NameScroll className="cs-fact-value">{c.value}</NameScroll>
            {/* A PENCIL, BECAUSE THE CELL OPENS AN EDITOR AND SAID SO NOWHERE.
                The owner, over a work-level character sheet: "the part, first
                appears, age here: these fields do not have the pencil to mark
                that they are editable." Every other editable row on this screen
                wears one — Credited as, In this work, the credit's name — so
                three cells that open the same kind of editor and wear none are
                the app signalling one behaviour two ways.

                IT IS A SIGN AND NOT A SECOND TARGET. The whole cell is the
                button, which is the owner's own ruling about the sheet's grab
                bar: "the bar is there just to make it intuitive." A 14px pencil
                inside a 118px cell would be a worse tap target than the cell.

                ON THE VALUE'S LINE, NOT THE LABEL'S. `FIRST APPEARS` at mono-9
                with .13em of tracking is about 85px of a ~98px content box, so a
                pencil beside it would clip the label; the values here are short
                ("not set", "00:02:14") and the long ones scroll under the fade
                `NameScroll` already gives them.

                AND ONLY WHERE THERE IS AN EDITOR. A cell the caller gave no
                handler draws no pencil — promising an editor that is not there
                is the same defect as a control that does nothing. */}
            {/* WRAPPED, the way `.cs-row-pencil` is: `IconEdit` takes a size and
                nothing else, so a className handed to it is silently dropped — and
                the span is where `aria-hidden` belongs anyway. The cell's
                accessible name is its label and its value; a screen reader
                announcing "edit" after them would be describing the drawing. */}
            {c.onClick
              ? <span className="cs-fact-pen" aria-hidden="true"><IconEdit size={13} /></span>
              : null}
          </span>
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
        // THE COUNTS ARE DOORS INTO SEARCH AND THE CALLER MAY NOT HAVE ONE. The
        // panel's own comment already promised the honest degradation — "a caller
        // without one gets the counts as figures, which is the honest degradation:
        // a number nobody can open is still the number" — and nothing implemented
        // it: `onClick={undefined}` draws a button that presses and does nothing,
        // which is the one outcome the promise was written to avoid. Measured on a
        // real library: two of the three dead controls on this screen were these.
        <button key={c.label} type="button" className="cs-count tactile" aria-disabled={c.onClick ? undefined : 'true'} onClick={c.onClick} title={c.title}>
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
// A PILL WITHOUT A URL IS STILL A PILL, and that is why the anchor is
// conditional. A work's ids row draws one per id the record HOLDS, and not every
// id names a page the app can build an address for — an ASIN does, an IGDB
// numeric id does not — so the pill without one keeps its mark and its value and
// gives up only the following. An `<a>` with no href is not a link with nothing
// behind it; it is a span the keyboard still stops on.
//
// `title` is per pill rather than always the address, because the address is the
// wrong sentence for an id: "Open on Open Library" says what pressing it does,
// where a raw URL says what it is. It falls back to the url, which is what every
// caller that has only that still wants.
export function PillRow({ pills, addLabel, addIcon, addTitle, onAdd }) {
  return (
    <div className="cs-pills">
      {pills.map((p) => {
        const inner = (
          <>
            <span className="cs-pill-mark">
              {p.slug ? <ProviderMark source={p.slug} /> : p.fallbackIcon}
            </span>
            <span>{p.name}</span>
          </>
        )
        // `mono` for a pill whose label is a NUMBER rather than a name — an
        // ISBN, an ASIN, a TMDB id. Those are read character by character when
        // they are read at all, and the mono voice is what the app uses wherever
        // it prints one.
        const cls = 'cs-pill tactile' + (p.mono ? ' cs-pill-id' : '')
        return p.url ? (
          <a
            key={p.key || p.url}
            className={cls}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            title={p.title || p.url}
          >
            {inner}
          </a>
        ) : (
          <span key={p.key || p.name} className={cls + ' is-flat'} title={p.title || ''}>
            {inner}
          </span>
        )
      })}
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
// THE GLYPHS ARE THE APP'S, drawn here rather than taken as props. They arrived
// as `'✎'`, `'✕'` and `'▾'` — three literal characters from the caller, which the
// standing rule forbids in as many words: "A screen's glyphs are the app's own,
// never an emoji. NavIcon, Icon* in ui.jsx, and nothing hand-picked beside them."
// A character renders in whatever font the reader has, sits off the baseline the
// real glyphs share, and cannot be documented by the generated glossary. Taking
// them as props is what made passing the wrong thing possible, so the props go.
export function CreditRow({
  name, note, face, empty, pickTitle, openTitle, noteTitle, removeTitle,
  onPick, onOpen, onNote, onRemove,
}) {
  return (
    <div className="cs-credit">
      <button type="button" className="cs-credit-pick tactile" title={pickTitle} onClick={onPick}>
        <Face src={face} name={name} className="cs-credit-face" />
        <span className="cs-credit-caret" aria-hidden="true"><IconChevron size={14} /></span>
      </button>
      <button
        type="button"
        className="cs-credit-name tactile"
        title={openTitle}
        aria-disabled={onOpen ? undefined : true}
        onClick={onOpen || undefined}
      >
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
          <IconEdit size={16} />
        </button>
      </Tooltip>
      <Tooltip label={removeTitle} side="top">
        <button
          type="button"
          className="cs-credit-key is-danger tactile"
          aria-label={removeTitle}
          onClick={onRemove}
        >
          <IconClose size={16} />
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
// `addIcon` DEFAULTS TO THE APP'S OWN DRAWING, not to a typed `+`. CLAUDE.md:
// "A screen's glyphs are the app's own, never an emoji… it changes with the
// reader's font, sits off the baseline every other glyph shares, and is the one
// picture docs/ui-glossary.html cannot document." U+002B is not an emoji, but it
// is the platform's font drawing a plus beside the app's own drawings of
// everything else — two pictures of one thing, which is the same defect.
// inReleaseOrder — the order the strip's own line promises, applied where the
// promise is made.
//
// THE REPORT, the owner's: "the works say it is release order, and it was. but
// then i rectified a metadata problem in gardens of the moon (which released in
// 1999, not 2009 as my backup suggested). this should have automatically taken it
// to the front. but it didn't."
//
// IT NEVER WAS. `PersonCredits` orders by role then TITLE and `castWhere` by
// title alone, and neither shape carried a year at all — so a strip of Erikson's
// nine novels opened with Deadhouse Gates, Dust of Dreams, Gardens of the Moon,
// which is the alphabet reading like a series a reader half-remembers. Correcting
// a year could not move a tile because no tile had ever been placed by one.
//
// HERE AND NOT IN THE TWO CALLERS. A person's strip is what they PLAYED
// concatenated with what they MADE — two queries, two lists — so a sort in either
// one leaves the join in neither order. And "similar things should act similarly"
// is this repo's directive: the strip that prints the line is the thing that owns
// the order, so a third caller cannot get the line without the order.
//
// AN UNDATED WORK GOES LAST, not first. 0 is the library saying it does not know,
// and sorting it as a number opens the strip with everything nobody has dated —
// asserting they are the earliest, which is the one thing the value cannot mean.
//
// THE SORT IS STABLE, which is how "what they played leads" survives inside a
// single year: `Array.prototype.sort` has been required to be stable since ES2019
// and the two lists arrive already concatenated in that order.
export function inReleaseOrder(tiles) {
  // `tile` and not `t`: this file imports the translator under that name, and a
  // local binding of it is the shadow `locale-shadow.test.js` exists to stop.
  const when = (tile) => (Number(tile?.year) > 0 ? Number(tile.year) : Infinity)
  return [...(tiles || [])].sort((a, b) => when(a) - when(b))
}

export function AppearanceStrip({ tiles, hint, onAdd, addLabel, addTitle, addIcon = <IconPlus size={18} /> }) {
  return (
    <div className="cs-strip">
      <Scroller className="cs-tiles">
        {inReleaseOrder(tiles).map((w) => (
          <div className="cs-tile" key={w.key}>
            {/* A TILE WITH NOWHERE TO GO SAYS SO. `aria-disabled` rather than
                `disabled`, so the cover stays readable and the tooltip still
                explains — a work you are credited on is worth seeing even on a
                screen that cannot open it. Silence here is the defect class the
                control probe exists for: a press that changes nothing and gives
                no reason. */}
            <button
              type="button"
              className={'cs-tile-art' + (w.kind === 'book' ? ' is-book' : '')}
              /* THE MEDIUM'S WORD LIVES HERE NOW. The badge holds the app's own
                 drawing, which a reader looks at; the word is what they get when
                 they ask, and it is the one place a glyph cannot answer. */
              title={w.badgeWord ? `${w.artTitle} · ${w.badgeWord}` : w.artTitle}
              aria-disabled={w.onOpen ? undefined : true}
              onClick={w.onOpen || undefined}
            >
              {w.cover ? <img src={coverImgURL(w.cover)} alt="" loading="lazy" /> : null}
              <span className="cs-tile-badge">{w.badge}</span>
              {/* NO CHIP WHERE THERE IS NO PERSON-IN-THE-WORK. On a work somebody
                  WROTE they are the maker, not somebody inside it, and a
                  silhouette there would claim a character nobody has named. */}
              {w.face !== false ? (
                <Face src={w.face} name={w.faceName} className="cs-tile-chip" title={w.faceTitle} />
              ) : null}
            </button>
            <button
              type="button"
              className="cs-tile-cap"
              aria-disabled={w.onOpen ? undefined : true}
              onClick={w.onOpen || undefined}
            >
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

// FaceStrip — the pack's cast carousel: a circular face per member of a work's
// cast, the character's name under it and the performer's under that.
// `work-details-popup.dc.html:784-800`, drawn at `:1092`, `:1116` and `:1160`
// under a `Cast · N` head, between the work's fields and its ids.
//
// WHY A SECOND STRIP AND NOT AppearanceStrip. They answer opposite questions.
// AppearanceStrip is one CHARACTER across many works, so its tile is a cover —
// the thing a reader recognises a work by — with the face as a corner chip. This
// is one WORK across many people, where the cover is the same for every tile and
// therefore says nothing, and the face is the whole of what tells them apart.
// Round means a person everywhere in this app; the pack draws it at 60px.
//
// TWO PACK DEPARTURES, both the standing rules' rather than this component's:
//
//   THE NAMES WRAP. The pack clamps each caption to two lines with
//   `max-height: calc(2 * 1.3em); overflow: hidden`, which cuts a long name
//   without even an ellipsis to say it was cut — and the app's rule is that a
//   name is never shortened, because a shortened name and a short name look
//   alike. A third line is cheap here: the tile is in a row that scrolls
//   sideways, so a taller tile costs nothing that a reader has to scroll past.
//
//   THE FADE IS MEASURED. The pack masks the strip's edges when it holds five
//   tiles or more; Scroller masks when the row actually overflows, which is the
//   app's standing rule and is right in both cases a count gets wrong — four
//   long names that do overflow, and six short ones that do not.
export function FaceStrip({ tiles, hint }) {
  return (
    <div className="cs-strip">
      <Scroller className="cs-faces">
        {tiles.map((m) => (
          <button
            type="button"
            key={m.key}
            className="cs-face-tile"
            title={m.title}
            /* A TILE WITH NOWHERE TO GO SAYS SO, AppearanceStrip's rule: the face
               and both names are worth seeing on a row that cannot open them, so
               the tile stays readable and only the press is declined. */
            aria-disabled={m.onOpen ? undefined : true}
            onClick={m.onOpen || undefined}
          >
            <Face src={m.face} name={m.faceName || m.name} className="cs-face-round" />
            <span className="cs-face-name">{m.name}</span>
            {/* THE PACK SAYS SO RATHER THAN LEAVING A GAP, on both media and in
                two different words: a film's unvoiced dub is `not named`
                (`work-details-popup.dc.html:1123`) and every tile of its BOOK
                strip is `no performer` (`:1092-1097`). Which words is the
                caller's, because only the caller knows the medium; that there
                ARE words is not optional, and this note has been wrong about it
                twice — first arguing against a blank line nobody proposed, then
                dropping the book's line as "a sentence repeated under every
                tile", which is verbatim what the pack draws. */}
            {m.by ? <span className="cs-face-by">{m.by}</span> : null}
          </button>
        ))}
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
// `empty` IS "NO OTHER SPELLINGS", NOT "NO NAME". The component was right and the
// string was wrong: the global sheets passed `identity.row.canonical.empty` —
// "No name yet" — into this slot, so a record with exactly one name, which is
// nearly all of them, printed "No name yet" directly under its own name. The
// local sheet has always passed the right sentence here ("The only name this
// work uses"); the two globals were the odd ones out.
export function NamesRow({ label, lines, empty, onOpen }) {
  const [first, ...rest] = lines.length ? lines : ['']
  return (
    <ScreenRow
      label={label}
      meta={first}
      sub={rest.length ? rest.join(' · ') : empty}
      onClick={onOpen}
      edit
    />
  )
}

// ScreenBody is the column every scope is drawn into, so the padding is stated
// once rather than per screen.
// `minWidth: 0` IS LOad-BEARING, and its absence is what made a nine-work strip
// stretch the whole sheet. A flex item defaults to `min-width: auto`, which
// refuses to shrink below its content — so the works row, 1248px of covers,
// sized this box, this box sized the grid above it (whose single column resolved
// to 1260px), and every row on the sheet was dragged out to match. The strip
// never scrolled because it was never narrower than its contents; `useEdgeScroll`
// measured `scrollWidth === clientWidth` and correctly drew no fade. Measured, at
// 390px: body scrollWidth 1266 against clientWidth 364.
export function ScreenBody({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: '14px 6px 16px' }}>
      {children}
    </div>
  )
}
