// review.jsx — the quiz card itself: one runner behind the Daily Quiz, Practice,
// and a themed round started from anywhere in the app.
//
// IT LIVES HERE RATHER THAN IN Home.jsx BECAUSE OF THE IMPORT GRAPH, and that is
// the whole reason for the move. Themed practice ("quiz me on this book, this
// tag, this person, this colour") is started from a work tile, a person panel, a
// tag card and the Stats colour breakdown — and every one of those modules sits
// BELOW Home.jsx: Home imports Library and Movies, which import works.jsx, which
// draws the tiles. A dialog exported from Home and imported by works.jsx would
// have closed that loop. So the runner moved down to a module whose own imports
// are all leaves (ui, api, people, bulkOps, theme, text), and Home imports it
// like everybody else.
//
// The runner itself is unchanged by the move. Its behaviour is described where
// it is defined, below.
import { useEffect, useRef, useState } from 'react'
import { categoryVar } from './theme.js'
import { errText, json } from './api.js'
import { episodeLabel } from './text.js'
import { DEFAULT_CREDIT_SEPS, PersonPortrait, splitCredits, usePeople } from './credits.jsx'
import { REVIEW_BULK_KIND } from './bulkOps.jsx'
import {
  ClampMore,
  ErrorText,
  Field,
  FieldIconButton,
  FormModal,
  HandNote,
  IconEdit,
  IconHeart,
  MonoLabel,
  toast,
} from './ui.jsx'

// tzOffsetMinutes — the client's UTC offset, east positive, sent with every
// review call so "today" is the reviewer's local day (the server stores UTC).
export function tzOffsetMinutes() {
  return -new Date().getTimezoneOffset()
}

// ---- the one preference a themed round cannot be handed -------------------
//
// srSubmit (the confirm step) reaches the Daily Quiz and Practice as a prop, from
// the session user App already holds. A themed round has no such path: it opens
// from a work tile, a tag card, a person panel — surfaces that know nothing about
// the reader and have no business learning. Threading `user` through four screens
// to reach one boolean would put a review preference in the signature of every
// card in the app.
//
// So App pushes it here, in the same effect that already applies the theme and
// the colour categories, and this module reads it when it builds a round.
//
// THE PROP PATH STAYS the reactive one — Home re-renders with the new value the
// moment Settings saves, and a module variable cannot do that. This is not a
// second source of truth: both read `preferences.srSubmit` from the same object
// at the same moment, and effects flush before paint, so no dialog can open on a
// value older than the render that drew the button opening it.
let reviewPrefs = { submitStep: false }

export function applyReviewPrefs(prefs) {
  reviewPrefs = { submitStep: !!prefs?.srSubmit }
}

export const submitStepPref = () => reviewPrefs.submitStep

// The date line and the greeting both come from greetings.js now — the device's
// clock, date and IANA time zone pick the pool (time of day, weekend, or a
// holiday in the reader's region) and one line is drawn from it at random.

// ---- shared quiz pieces (Daily Quiz + Practice) ----

// workNoun — what to call a card's source in the question line. A standalone
// quote has no work behind it, so its source is the occasion it was said on
// (the backend falls back to the speaker when there is none); "book" is the
// default only because books were the first kind, so every new kind has to be
// named here or it inherits the wrong noun silently.
function workNoun(card) {
  if (card.kind === 'screen') return card.media_type === 'show' ? 'show' : 'film'
  if (card.kind === 'utterance') return 'occasion'
  return 'book'
}

// askLine — the multiple-choice prompt for a card's direction. "source" shows
// the quote and asks which work it's from (options are titles); "quote" shows
// the work and asks which quote is from it (options are quotes).
function askLine(card) {
  switch (card.direction) {
    case 'source':
      return `Which ${workNoun(card)} is this quote from?`
    case 'quote':
      return `Which quote is from this ${workNoun(card)}?`
    case 'cloze':
      return 'Fill in the blank'
    case 'speaker':
      return 'Who says this?'
    default:
      // Flip, and any direction a newer server sends that this client has never
      // heard of. Both are asked the same way, because both are answered the
      // same way: read it, remember what it came from, then check yourself.
      return 'Where is this from?'
  }
}

// CLOZE_BLANK — the character the server leaves where the words were. The client
// splits on it rather than searching for underscores, which could be the quote's
// own punctuation.
const CLOZE_BLANK = '￼'

const isClozeCard = (card) => (card.quote || card.note || '').includes(CLOZE_BLANK)

// isFlipCard — a card the reader grades themselves.
//
// KEYED ON THE ABSENCE OF OPTIONS, not on the direction string, and that is
// deliberate: it makes an unknown direction from a newer server degrade to the
// one card type that always works instead of rendering as a multiple choice with
// nothing to choose. A card with options is a question this client understands
// how to grade; a card without them is not.
function isFlipCard(card) {
  return !isClozeCard(card) && !(card.options || []).length
}

// QuoteBlock — the quote side of a card (used as prompt for "source", as the
// revealed answer for "quote").
function QuoteBlock({ card }) {
  return (
    <blockquote
      style={{
        borderLeft: `4px solid ${categoryVar(card.color) || 'var(--accent-ui)'}`,
        padding: '2px 0 2px 12px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)',
          fontStyle: 'italic',
          fontSize: 17,
          lineHeight: 1.5,
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap', // honour the quote's own line breaks / paragraphs
        }}
      >
        {ClozeText(card.quote || card.note)}
      </p>
      {card.note && card.quote && <HandNote className="mt-2">{card.note}</HandNote>}
    </blockquote>
  )
}

// ClozeText renders the masked quote with the blank drawn as a gap rather than
// as a stray glyph nobody's font has. Split on the mark, not on underscores: the
// quote's own punctuation is not ours to reinterpret.
function ClozeText(text) {
  const s = text || ''
  if (!s.includes(CLOZE_BLANK)) return s
  const parts = s.split(CLOZE_BLANK)
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span
            key={i}
            aria-label="blank"
            style={{
              display: 'inline-block',
              minWidth: 84,
              borderBottom: '2px solid var(--accent-ui)',
              verticalAlign: 'baseline',
            }}
          />,
          part,
        ],
  )
}

// QUIZ_OPTION_LINES — how many lines of a quote option show before it clamps.
// The server used to cut the text itself at 140 runes and send an ellipsis, so
// the rest was simply gone; it sends the whole quote now and the limit is a
// display choice again, which is the only kind of choice it should ever have
// been.
const QUIZ_OPTION_LINES = 4

// QuizOption — one multiple-choice answer, clamped, with its own expander.
//
// The expander is a SEPARATE button beside the option rather than a tap
// anywhere on it, and that is the whole point of the control. Choosing an
// option answers the question, there is one shot per card (`pick` returns early
// if `picked != null`), and the grade posts immediately. An expand gesture
// sharing a hit area with that would eventually grade a card because someone
// wanted to finish reading it — and the reader would have no way to undo it.
//
// Whether the text actually overflows is MEASURED rather than guessed from a
// character count: four lines is a different number of characters on a phone
// and on a wide desktop card. The measurement is skipped while open (the clamp
// is off then, so it would always report "fits" and the control would vanish
// mid-read), which leaves the flag latched at its last closed value.
function QuizOption({ opt, om, personMaps, isSource, disabled, onPick, style }) {
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  const textRef = useRef(null)
  useEffect(() => {
    const el = textRef.current
    if (!el || open) return
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [opt, open])
  const clamp = open
    ? {}
    : { display: '-webkit-box', WebkitLineClamp: QUIZ_OPTION_LINES, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
  return (
    <div className="flex items-start gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className="min-w-0 flex-1 text-left"
        style={style}
      >
        <span ref={textRef} style={{ display: 'block', ...clamp }}>
          {opt}
        </span>
        {om?.person && (
          <span className="mt-1.5 flex" style={{ fontStyle: 'normal' }}>
            <PersonChip name={om.person} person={personMaps[om.kind]?.[om.person]} size={18} />
          </span>
        )}
      </button>
      {/* Only when there is something hidden. A control that is always there but
          does nothing three times out of four teaches you to ignore it. */}
      {(clipped || open) && (
        <FieldIconButton
          icon={<ClampMore open={open} />}
          ariaLabel={open ? 'Collapse this option' : 'Expand this option'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          tooltip={open ? 'Show less' : 'Show the whole quote'}
        />
      )}
    </div>
  )
}

// PersonChip — a display-only person credit (portrait + name pill) for quiz
// prompts and options: the answer buttons own the tap, so unlike PersonCredit
// nothing here is clickable. Renders the pill even without a saved portrait.
function PersonChip({ name, person, size = 20 }) {
  if (!name) return null
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 9px 2px 4px', maxWidth: '100%' }}
    >
      <PersonPortrait person={person} size={size} />
      <span className="mono-label" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
    </span>
  )
}

// SourceLines — the attribution side of a card (title + author/character etc.):
// the revealed answer for "source", the prompt for "quote". The people carry
// face chips — a book's author(s), a screen quote's actor; `maps` are the
// usePeople kind→(name→row) lookups for portraits.
function SourceLines({ card, maps = {} }) {
  let people
  if (card.kind === 'screen') people = card.actor ? [{ name: card.actor, kind: 'actor' }] : []
  else if (card.kind === 'utterance')
    // The title already IS the speaker when a quote has no occasion; showing the
    // name again underneath it would just read as a stutter.
    people = card.speaker && card.speaker !== card.title ? [{ name: card.speaker, kind: 'speaker' }] : []
  else people = splitCredits(card.author, DEFAULT_CREDIT_SEPS).map((n) => ({ name: n, kind: 'author' }))
  let meta
  if (card.kind === 'screen') {
    const media = card.media_type === 'show' ? 'Show' : 'Film'
    meta = [media, episodeLabel(card), card.character, card.timestamp].filter(Boolean).join(' · ')
  } else if (card.kind === 'utterance') {
    // A quote's date is partial by design — a year alone is a complete answer.
    meta = card.occasion_date || ''
  } else {
    // The author lives in the chips row now; the meta line keeps the location.
    const ch = (card.chapter || '').trim()
    meta = [
      ch && (/^\d/.test(ch) ? `CH. ${ch}` : ch),
      card.location && `P. ${card.location}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>
        {card.title}
      </p>
      {people.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {people.map((p) => (
            <PersonChip key={p.kind + p.name} name={p.name} person={maps[p.kind]?.[p.name]} />
          ))}
        </div>
      )}
      {meta && <MonoLabel className="mt-1 block" style={{ fontSize: 11 }}>{meta}</MonoLabel>}
    </div>
  )
}

// ---- in-card actions (ROADMAP §2) -----------------------------------------
//
// “Review is exactly when you notice the typo, the missing tag, or that you
// love it, and it is the one screen from which you can do nothing about any of
// that.” Three things, one panel.
//
// IT OPENS ONLY AFTER THE CARD IS GRADED, and that is not a nicety — it is what
// makes the whole feature safe. An edit form carries the quote, the title and the
// credit, which on a “source” card IS the answer, and on a cloze card is the
// masked words in full. A pencil beside an unanswered question would be a way to
// read the answer without answering. The gate is one line in QuizRunner, beside
// the other things that wait for `answered`.
//
// That gate also disposes of two bugs the specification pass flagged as living
// between features: folding an edited row back onto a card was going to un-mask a
// cloze card, and to write a film title into the answer slot of a speaker card
// whose options are actor names. Both were about revealing something early. Once
// nothing folds back before the grade, the remaining rule is small enough to
// state in one place — see foldEdit.

// CARD_ROWS crosses from the schedule's kind vocabulary to the CRUD routes, one
// row per kind: where to read the full row, and what that list calls its rows.
// REVIEW_BULK_KIND already crosses to the bulk routes and deliberately stays
// separate — one is “which list”, the other is “which bulk endpoint”, and a
// single map claiming to be both is how a rename breaks the half nobody was
// looking at.
const CARD_ROWS = {
  book: { list: '/annotations', rows: 'annotations' },
  screen: { list: '/dialogues', rows: 'dialogues' },
  utterance: { list: '/quotes', rows: 'utterances' },
}

// foldEdit puts a saved row back onto the card on screen, and it is deliberately
// a SHORT list rather than a merge.
//
// The note folds. The quote folds unless this is a cloze card, whose text is the
// server's mask and not the row's words — re-deriving the blank here would be a
// second implementation of clozeSpan in another language, and folding the raw
// quote in would print the answer over the question that was just asked.
//
// The options and the answer index NEVER fold. They were the question. Rewriting
// the chosen option after grading would leave the mark sitting on different words
// from the ones the reader picked, and on a speaker card the answer slot holds an
// actor's name — nothing an edit to the quote has any business writing.
function foldEdit(card, row) {
  return {
    ...card,
    note: row.note ?? card.note,
    quote: isClozeCard(card) ? card.quote : (row.quote ?? card.quote),
  }
}

function CardTools({ card, onPatch }) {
  const src = CARD_ROWS[card.kind]
  const [open, setOpen] = useState(false)
  const [row, setRow] = useState(null) // the full row; null while loading
  const [quote, setQuote] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [fav, setFav] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Fetched when the panel OPENS, not when the card is answered. A deck of
  // twelve would otherwise make twelve requests for rows nobody looked at.
  useEffect(() => {
    if (!open || !src) return
    let live = true
    setRow(null)
    setErr('')
    json('GET', `${src.list}?id=${card.id}`).then((r) => {
      if (!live) return
      const found = r.ok ? (r.data?.[src.rows] || [])[0] : null
      if (!found) return setErr('couldn’t load this quote')
      setRow(found)
      setQuote(found.quote || '')
      setNote(found.note || '')
      setTags((found.tags || []).join(', '))
      setFav(!!found.favorite)
    })
    return () => { live = false }
  }, [open, card.kind, card.id])

  // FULL STATE, FROM THE ROW ITSELF. The PUT is full-state for every kind, and
  // the row carries every field of it under the same names — so the payload is
  // the row with the edited fields over it, rather than a hand-built object that
  // has to remember `board_id` on a standalone quote and the sticker's
  // coordinates on all three. A field forgotten here is a field silently blanked.
  async function save() {
    if (!row || busy) return
    setBusy(true)
    setErr('')
    const r = await json('PUT', `${src.list}/${card.id}`, {
      ...row,
      quote,
      note,
      favorite: fav,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }).catch(() => ({ ok: false }))
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'couldn’t save'))
    onPatch(foldEdit(card, { quote, note }))
    setOpen(false)
    toast('saved')
  }

  if (!src) return null
  return (
    <div className="mt-3" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      {!open ? (
        <button type="button" className="tp-link tp-link-icon" onClick={() => setOpen(true)}>
          <IconEdit />
          <span>fix or tag this</span>
        </button>
      ) : row == null && !err ? (
        <MonoLabel style={{ color: 'var(--faint)' }}>loading…</MonoLabel>
      ) : (
        <div className="space-y-2">
          <Field label="Quote" value={quote} onChange={(e) => setQuote(e.target.value)} />
          <Field label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          {/* The WHOLE set, comma separated, because the PUT is full-state and
              this is re-tagging rather than adding — taking a wrong tag off has to
              be possible from the same box that puts one on. */}
          <Field label="Tags" value={tags} placeholder="comma separated" onChange={(e) => setTags(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="tp-btn tactile inline-flex items-center gap-1.5"
              aria-pressed={fav}
              style={fav ? { color: 'var(--accent-ui)', borderColor: 'var(--accent-ui)' } : undefined}
              onClick={() => setFav((v) => !v)}
            >
              <IconHeart /> {fav ? 'Favourited' : 'Favourite'}
            </button>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" className="tp-link" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy || !row} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </span>
          </div>
        </div>
      )}
      {err && <div className="mt-2"><ErrorText>{err}</ErrorText></div>}
    </div>
  )
}

// QuizRunner — the shared multiple-choice flow. The caller supplies the deck
// and whether skipping is allowed (Practice only) and is told each result — a
// correct pick counts as "got", a wrong one as "forgot" — so the quiz feeds the
// same schedule as before, only auto-graded. A correct save is required before
// advancing; skip (Practice) advances locally, touching neither schedule nor
// score.
export function QuizRunner({ mode, cards, allowSkip, startIndex = 0, onIndex, onAnswered, onDone, submitStep = false }) {
  // startIndex seeds the position (Practice restores it from a persisted
  // session on reload); onIndex reports each advance so the host can persist it.
  const [i, setI] = useState(startIndex)
  const [picked, setPicked] = useState(null) // chosen option index for the current card
  // A flip card has no options to pick, so revealing its answer and grading it
  // are two separate acts. `shown` is the first; `graded` is the second, and it
  // holds 'got' | 'forgot' so the footer can report what was recorded.
  const [shown, setShown] = useState(false)
  const [graded, setGraded] = useState(null)
  // The grade's own reply, kept for the one thing the card cannot already know:
  // the lapse count AFTER this answer, and whether it has just crossed into
  // leech territory.
  const [lastResp, setLastResp] = useState(null)
  // Whether the pick has been COMMITTED. Without the submit step a pick is a
  // commit, so this follows `picked` — see `committed` below. It is a separate
  // piece of state rather than a derived one because with the step on there is a
  // real interval between the two, and every reveal in the body has to read the
  // commit rather than the selection. `picked != null` used to mean both.
  const [committedFlag, setCommittedFlag] = useState(false)
  const [attempt, setAttempt] = useState('') // what was typed into a cloze blank
  const [dismissed, setDismissed] = useState(false) // "Keep asking", this session
  const [setAside, setSetAside] = useState(false)   // it is out of the deck now
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('') // the grade didn't reach the server
  // posRef is the card on screen right now, readable from a settled request's
  // closure: a slow reply must not paint its error onto a card the reader has
  // already moved past. inflight lets "Finish" wait for the last grade to land,
  // so Practice's done screen can't snapshot the round one answer short.
  const posRef = useRef(startIndex)
  const inflight = useRef(null)
  // Portrait lookups for the person chips on prompts and options (the server
  // names each option's author/actor/director in option_meta).
  const { map: authorMap } = usePeople('author')
  const { map: actorMap } = usePeople('actor')
  const { map: directorMap } = usePeople('director')
  const personMaps = { author: authorMap, actor: actorMap, director: directorMap }
  // What an in-card edit changed, keyed by position. The deck belongs to the host
  // — and Practice persists it to localStorage — so a card fixed here is patched
  // over the one that was handed in rather than written back into it.
  const [patched, setPatched] = useState({})
  const base = cards[i]
  if (!base) return null
  const card = patched[i] || base

  // The three facts every handler and every reveal below is written against.
  // Declared together, above them, because they answer one question between
  // them: what KIND of card is this, and how far through answering it are we.
  const flip = isFlipCard(card)
  const cloze = isClozeCard(card)
  // Only multiple choice has two steps to separate. Typing an answer and
  // pressing Check is already a submit step, and revealing a flip card then
  // saying whether you had it is already two acts; a confirmation on either
  // would be asking twice.
  // Typing an answer and pressing Check is already a submit step, so cloze is
  // exempt too — a confirmation on top would be asking twice.
  const twoStep = submitStep && !flip && !cloze
  // A pick IS a commit unless the submit step is on. Written once, here, so no
  // reveal below has to remember which mode it is in.
  const committed = cloze ? graded != null : twoStep ? committedFlag : picked != null
  const setCommitted = setCommittedFlag

  async function advance() {
    posRef.current = i + 1
    setSaving(false) // a still-flying grade must never gate the next card
    setSaveErr('')
    if (i + 1 < cards.length) {
      setI(i + 1)
      onIndex?.(i + 1)
      setPicked(null)
      setAttempt('')
      setCommittedFlag(false)
      setShown(false)
      setGraded(null)
      setLastResp(null)
      setDismissed(false)
      setSetAside(false)
      return
    }
    // Last card: let the grade settle before the host reads the round's tally.
    await inflight.current
    onDone?.()
  }

  // grade posts one result for the card on screen. Both card types end here —
  // an MCQ derives got/forgot from the pick, a flip card is told by the reader —
  // so there is one request, one error path and one tally, not two.
  async function grade(result, typed = null) {
    const at = i
    setSaving(true)
    setSaveErr('')
    // .catch is belt-and-braces over api.js's own guard: `saving` gates the
    // options, and awaiting a rejected promise in advance() would throw.
    const req = json('POST', '/review/answer', {
      kind: card.kind,
      id: card.id,
      result,
      mode,
      offset: tzOffsetMinutes(),
      // Only on a cloze card, and when present the SERVER decides the grade —
      // `result` above is ignored. The answer never travelled to the browser, so
      // the browser is not in a position to mark it.
      ...(typed != null ? { attempt: typed } : {}),
    }).catch(() => ({ ok: false, status: 0, data: null }))
    inflight.current = req
    const r = await req
    const here = posRef.current === at
    if (here) setSaving(false)
    // A failed save used to revert the pick — but with the answer already
    // revealed and skip off (Daily), that removed the Next button outright and
    // stranded the reader on a dead card. Keep the reveal, say plainly that the
    // grade didn't land, and let them move on.
    if (!r.ok) {
      if (here) setSaveErr('couldn’t save — this answer won’t count towards your schedule')
      return
    }
    // The result string, not the raw boolean — both cards' tallies compare
    // against 'got'/'forgot' (a boolean never matched, so the session tallies
    // silently stayed at zero).
    if (here) setLastResp(r.data)
    // For a cloze card the server's own verdict is the truth — `result` was a
    // placeholder. Everything downstream (the tally, the status dot) reads what
    // came back.
    const settled = r.data?.result || result
    if (here && typed != null) setGraded(settled)
    onAnswered?.(settled, r.data)
  }

  // Two ways out of a card that keeps being forgotten. Neither is automatic.
  function keepGoing() {
    setDismissed(true)
  }

  // "Set it aside" writes the quote's own review_excluded — the same column, and
  // the same endpoint, the card menu's "Skip in quiz" uses. Since 1.15.0 the
  // deck reads that flag and nothing else, so this genuinely stops the asking
  // rather than half-stopping it.
  async function setItAside() {
    const bulkKind = REVIEW_BULK_KIND[card.kind]
    if (!bulkKind) return
    setSetAside(true) // optimistic: the offer should go the moment it is taken
    const r = await json('POST', `/${bulkKind}s/bulk`, { ids: [card.id], review: false })
      .catch(() => ({ ok: false }))
    if (!r.ok) {
      setSetAside(false)
      toast('couldn’t set it aside')
      return
    }
    toast('out of the quiz')
  }

  // WITH THE SUBMIT STEP ON, a tap SELECTS and nothing is posted; Submit
  // commits. With it off this is exactly what it always was — one tap, one
  // grade — and that path is the one every reader is on by default.
  //
  async function pick(idx) {
    if (committed || saving) return
    if (twoStep) {
      setPicked(idx) // selected, not answered: nothing leaves the browser yet
      return
    }
    setPicked(idx)
    await grade(idx === card.answer ? 'got' : 'forgot')
  }

  async function submit() {
    if (picked == null || committed || saving) return
    setCommitted(true)
    await grade(picked === card.answer ? 'got' : 'forgot')
  }

  // A cloze card: type it, then check. The server grades it.
  async function checkCloze() {
    if (graded != null || saving || !attempt.trim()) return
    await grade('forgot', attempt)
  }

  // A flip card: reveal, then say whether you had it. The reveal is not an
  // answer and posts nothing — which is what makes the self-grade honest rather
  // than a button you press to make the card go away.
  async function selfGrade(result) {
    if (graded != null || saving) return
    setGraded(result)
    await grade(result)
  }

  const isSource = card.direction === 'source'
  // A cloze verdict is right or wrong like an MCQ, not self-graded like a flip
  // card, so it takes the same two words.
  const clozeRight = graded === 'got'
  // The card's own flag, or the fresher one the grade came back with — the
  // answer that MAKES a card a leech also pushes it a week out of the deck, so
  // waiting for the flag to arrive on a future deck would surface the offer a
  // week after the frustration that earned it.
  const leech = !dismissed && (lastResp?.leech ?? card.leech)
  // One name for "this card has been graded", whichever way it was graded. Every
  // reveal in the body below reads this rather than `picked != null`, which is
  // true only for the multiple-choice half.
  const answered = flip || cloze ? graded != null : committed
  return (
    <div key={i} className="review-card-body">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <MonoLabel>{askLine(card)}</MonoLabel>
        <span className="mono-label" style={{ letterSpacing: '.06em' }}>{i + 1} of {cards.length}</span>
      </div>
      {/* THE PROMPT SIDE. Only a "quote" card shows the attribution — every other
          direction shows the words.

          This was `isSource ? QuoteBlock : SourceLines`, which sent EVERY
          direction that was not "source" down the attribution path. With two
          directions that was the same thing; with more it is an answer leak,
          because SourceLines prints the actor as a face chip and the character
          in its meta line. A card asking who said a line would have shown the
          right actor directly above its own four options. */}
      {card.direction === 'quote'
        ? <SourceLines card={card} maps={personMaps} />
        : <QuoteBlock card={card} />}
      {/* A CLOZE CARD: type the missing words, then check. The answer is graded
          on the server — it never travelled here, because unlike an option index
          the words ARE the thing being recalled. */}
      {cloze && (
        <div className="mt-3">
          {graded == null ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                checkCloze()
              }}
            >
              <Field
                label="The missing words"
                hideLabel
                value={attempt}
                placeholder="type what belongs in the blank"
                autoFocus
                onChange={(e) => setAttempt(e.target.value)}
              />
              <button type="submit" className="tp-btn tp-btn-primary tactile" disabled={saving || !attempt.trim()}>
                Check
              </button>
            </form>
          ) : (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <MonoLabel style={{ color: 'var(--faint)' }}>the missing words</MonoLabel>
              <p className="mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontSize: 17, fontStyle: 'italic' }}>
                {lastResp?.answer || attempt}
              </p>
            </div>
          )}
        </div>
      )}
      {/* A FLIP CARD: the source is hidden until asked for, then you say whether
          you had it. Nothing is posted by the reveal — pressing "Show me" is not
          an answer, and treating it as one would turn self-grading into a button
          you press to make the card go away. */}
      {flip && (
        <div className="mt-3">
          {shown ? (
            <>
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <SourceLines card={card} maps={personMaps} />
              </div>
              {graded == null ? (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="tp-btn tactile"
                    disabled={saving}
                    onClick={() => selfGrade('forgot')}
                  >
                    Forgot
                  </button>
                  <button
                    type="button"
                    className="tp-btn tp-btn-primary tactile"
                    disabled={saving}
                    onClick={() => selfGrade('got')}
                  >
                    Got it
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <button type="button" className="tp-btn tp-btn-primary tactile" onClick={() => setShown(true)}>
              Show me
            </button>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {(card.options || []).map((opt, idx) => {
          const isAnswer = idx === card.answer
          const chosen = picked === idx
          // Work-title options carry a person chip (author / actor / director).
          // A face under the option: a work's author/actor/director on a source
          // card, and the actor themselves on a speaker card, where every option
          // IS a person.
          const om = isSource || card.direction === 'speaker' ? card.option_meta?.[idx] : null
          let border = 'var(--line)'
          let bg = 'var(--raised)'
          if (answered && isAnswer) {
            border = 'var(--ok)'
            bg = 'color-mix(in srgb, var(--ok) 16%, transparent)'
          } else if (answered && chosen && !isAnswer) {
            // `answered &&` is not redundant, and leaving it out is an answer
            // leak. This line read `chosen && !isAnswer`, which was safe only
            // because a chosen option was necessarily a graded one. With the
            // submit step there is an interval between the two — and without the
            // guard, merely SELECTING a wrong option paints it red before
            // Submit, which tells you the answer while you can still change it.
            border = 'var(--error)'
            bg = 'color-mix(in srgb, var(--error) 12%, transparent)'
          } else if (chosen) {
            // Selected and not yet committed: marked as chosen, and saying
            // nothing whatever about whether it is right.
            border = 'var(--accent-ui)'
            bg = 'color-mix(in srgb, var(--accent-ui) 10%, transparent)'
          }
          return (
            <QuizOption
              key={idx}
              opt={opt}
              om={om}
              personMaps={personMaps}
              isSource={isSource}
              disabled={committed || saving}
              onPick={() => pick(idx)}
              style={{
                minHeight: 44,
                padding: '9px 13px',
                borderRadius: 9,
                border: `1.4px solid ${border}`,
                background: bg,
                // A title and a person's name are set as text; a quote is set as
                // a quote. Only the "which quote?" card offers quotes.
                fontFamily: card.direction === 'quote' ? 'var(--font-display)' : 'var(--font-ui)',
                fontStyle: card.direction === 'quote' ? 'italic' : 'normal',
                fontSize: 14.5,
                lineHeight: 1.4,
                overflowWrap: 'anywhere',
              }}
            />
          )
        })}
      </div>
      {/* THE LEECH OFFER. A card forgotten five times over is costing a slot in
          every deck and giving nothing back, and until now the only way to stop
          being asked was to delete the quote — which is the app telling somebody
          their note-keeping is wrong.

          It appears only AFTER the answer, never instead of it: the card is
          still asked, and the offer is what you do with the answer once it is
          in. And it is an offer — nothing is suspended automatically, because a
          card vanishing because a counter reached five is a decision nobody
          asked the app to make. */}
      {answered && leech && (
        <div className="mt-3" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          {setAside ? (
            <MonoLabel style={{ color: 'var(--faint)' }}>out of the quiz</MonoLabel>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <MonoLabel style={{ color: 'var(--faint)' }}>
                forgotten {lastResp?.lapse_count ?? card.lapse_count} times
              </MonoLabel>
              <button type="button" className="tp-link" style={{ marginLeft: 'auto' }} onClick={keepGoing}>
                Keep asking
              </button>
              <button type="button" className="tp-btn tactile" onClick={setItAside}>
                Set it aside
              </button>
            </div>
          )}
        </div>
      )}
      {/* AFTER THE ANSWER, never instead of it — see CardTools. */}
      {answered && <CardTools card={card} onPatch={(next) => setPatched((p) => ({ ...p, [i]: next }))} />}
      {answered ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          {/* A flip card was not right or wrong — it was recalled or it was not,
              and the reader is the one who said so. Reporting "correct" over
              their own judgement would be the app marking their homework. */}
          <MonoLabel
            style={{
              color: (flip ? graded === 'got' : cloze ? clozeRight : picked === card.answer)
                ? 'var(--ok)'
                : 'var(--error)',
            }}
          >
            {flip
              ? (graded === 'got' ? 'recalled' : 'noted')
              : (cloze ? clozeRight : picked === card.answer)
                ? 'correct'
                : 'not quite'}
          </MonoLabel>
          {/* Never disabled: the grade saves in the background, and a slow or
              failed save must not hold the reader on a card they've answered. */}
          <span className="flex items-center gap-2.5">
            {saving && <MonoLabel style={{ color: 'var(--faint)' }}>saving…</MonoLabel>}
            <button type="button" className="tp-btn tp-btn-primary tactile" onClick={advance}>
              {i + 1 < cards.length ? 'Next' : 'Finish'}
            </button>
          </span>
        </div>
      ) : twoStep && picked != null ? (
        /* Chosen, not yet committed. The reader can still change their mind by
           tapping another option — which is the whole feature. */
        <div className="mt-3 flex items-center justify-between gap-3">
          <MonoLabel style={{ color: 'var(--faint)' }}>tap another to change</MonoLabel>
          <button type="button" className="tp-btn tp-btn-primary tactile" disabled={saving} onClick={submit}>
            Submit
          </button>
        </div>
      ) : allowSkip && !(flip && shown) ? (
        // Skip goes once a flip card's answer is on screen. Skipping there would
        // be a way to read the answer and move on without ever saying whether
        // you knew it, which is the one thing self-grading cannot survive.
        <div className="mt-3 text-right">
          <button type="button" className="tp-link" onClick={advance}>skip</button>
        </div>
      ) : null}
      {saveErr && <div className="mt-2"><ErrorText>{saveErr}</ErrorText></div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// themed practice — "quiz me on this book / tag / colour / person"
// ---------------------------------------------------------------------------
//
// The server side shipped in 1.15.0 and is described in review_theme.go. The
// short version: a theme narrows the CANDIDATE pool for a practice round, and
// only for practice. The Daily Quiz is deliberately not themeable, because the
// daily deck IS the schedule — filtering it would leave the cards that are
// actually due unasked while the streak still counted the day as cleared.
//
// WHERE THE BUTTONS ARE is the design, and it is contextual rather than central.
// There is no "pick a theme" screen: you are already looking at the book, the
// tag, the person or the colour when you want to be asked about it, and a picker
// would mean choosing a book from a list of books one screen after leaving the
// list of books. So the entry points ride the surfaces that already name the
// thing — the work tile's own menu, the person panel, the tag card, and the
// colour rows in Stats.
//
// A theme is `{book}` | `{movie}` | `{tag}` | `{color}` | `{person}` plus a
// `label` saying what to call the round. The label is the caller's, not derived:
// only the caller knows whether "Austen" is an author, a director or a speaker,
// and the server matches all three on purpose.

// themeQuery turns a theme into the query string handlePractice parses. Empty
// fields are omitted rather than sent blank — an empty `tag=` is a theme the
// server would read as "no tag", which is what the whole round already means.
export function themeQuery(theme) {
  const q = new URLSearchParams()
  for (const k of ['book', 'movie', 'tag', 'color', 'person']) {
    if (theme?.[k]) q.set(k, String(theme[k]))
  }
  return q.toString()
}

// ThemedPracticeDialog — one themed round in a modal, over whatever screen it
// was started from. Deliberately not a route: the round is a detour, and coming
// back to the shelf you were on is the whole shape of it.
export function ThemedPracticeDialog({ theme, onClose }) {
  const [cards, setCards] = useState(null) // null = still loading
  const [tally, setTally] = useState({ got: 0, forgot: 0 })
  const [done, setDone] = useState(false)
  // A round is identified by a counter rather than by its contents, so "Another
  // round" remounts QuizRunner and resets every piece of per-card state in it.
  // Handing a fresh deck to a mounted runner would keep the old position.
  const [round, setRound] = useState(0)

  useEffect(() => {
    let live = true
    setCards(null)
    setDone(false)
    setTally({ got: 0, forgot: 0 })
    const qs = themeQuery(theme)
    json('GET', `/review/practice${qs ? `?${qs}` : ''}`).then((r) => {
      if (!live) return
      setCards(r.ok ? r.data.items || [] : [])
    })
    return () => { live = false }
  }, [round, theme?.book, theme?.movie, theme?.tag, theme?.color, theme?.person])

  const empty = cards != null && cards.length === 0
  return (
    <FormModal open onClose={onClose} title={theme?.label || 'Practice'} maxWidth={560}>
      <div className="review-card-body">
        {cards == null && <MonoLabel style={{ color: 'var(--faint)' }}>loading…</MonoLabel>}
        {/* NOT AN ERROR, and worth the sentence. A theme with nothing behind it
            is the ordinary answer for a book you have not quoted yet, or a
            colour you stopped using — and every quote it would have asked about
            may simply be one you set aside. Saying so beats an empty card. */}
        {empty && (
          <div className="py-2 text-center">
            <p className="tp-empty">no quotes here to practise</p>
            <button type="button" className="tp-btn tactile mt-3" onClick={onClose}>Close</button>
          </div>
        )}
        {cards != null && cards.length > 0 && !done && (
          <>
            <QuizRunner
              key={round}
              mode="practice"
              cards={cards}
              allowSkip
              submitStep={submitStepPref()}
              onAnswered={(result) =>
                setTally((t) => ({
                  got: t.got + (result === 'got' ? 1 : 0),
                  forgot: t.forgot + (result === 'forgot' ? 1 : 0),
                }))
              }
              onDone={() => setDone(true)}
            />
            <div className="mt-2 text-right">
              <button type="button" className="tp-link" onClick={onClose}>End round</button>
            </div>
          </>
        )}
        {done && (
          <div className="py-2 text-center">
            <p
              aria-hidden="true"
              style={{ fontFamily: 'var(--font-hand)', fontWeight: 'var(--font-hand-weight)', fontStyle: 'var(--font-hand-style)', fontVariantCaps: 'var(--font-hand-caps)', textTransform: 'var(--font-hand-case)', fontVariantNumeric: 'var(--font-hand-figures)', fontSize: 24, color: 'var(--accent-ui)', transform: 'rotate(-1.2deg)' }}
            >
              {tally.got} / {tally.got + tally.forgot}
            </p>
            <p className="mono-label mt-1 mb-3" style={{ letterSpacing: '.06em' }}>
              {tally.got} recalled · {tally.forgot} missed
            </p>
            <div className="flex items-center justify-center gap-2">
              <button type="button" className="tp-btn tactile" onClick={onClose}>Done</button>
              <button type="button" className="tp-btn tp-btn-primary tactile" onClick={() => setRound((n) => n + 1)}>
                Another round
              </button>
            </div>
          </div>
        )}
      </div>
    </FormModal>
  )
}

// usePractice — what a screen wires up to offer a themed round: a function that
// starts one, and the dialog to render.
//
// A HOOK RATHER THAN A GLOBAL, so the dialog belongs to the screen that opened it
// and unmounts with it. A round left running behind a screen the reader navigated
// away from would keep posting grades against a schedule they thought they had
// stopped touching.
//
//   const { practise, practiceDialog } = usePractice()
//   ...
//   <button onClick={() => practise({ book: id, label: title })}>Practise</button>
//   {practiceDialog}
export function usePractice() {
  const [theme, setTheme] = useState(null)
  return {
    practise: (t) => setTheme(t),
    practiceDialog: theme ? <ThemedPracticeDialog theme={theme} onClose={() => setTheme(null)} /> : null,
  }
}
