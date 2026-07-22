// Home — the landing screen (mobile handoff §7 redesign, ROADMAP №2): a date +
// greeting, the Daily Quiz card, the Practice card, two stat tiles, and the
// most recent favourites. Reached by tapping the logo (every bar) or landing
// on "/". One narrow column on every screen size — the ritual reads the same
// on a phone and a desktop. Quote capture is NOT here any more — it's the
// "Capture quote" tab of the single ＋ Add surface (top bar + drawer).
import { useEffect, useMemo, useState } from 'react'
import { errText, json } from './api.js'
import { AnnotationForm, annotationState, annDate, fmtDate } from './Library.jsx'
import { DialogueForm, dialogueState } from './Movies.jsx'
import {
  CreditFaces,
  DEFAULT_CREDIT_SEPS,
  PersonCredit,
  PersonModal,
  PersonPortrait,
  parseCreditSeps,
  splitCredits,
  usePeople,
} from './people.jsx'
import { ShareDialog, bookShare, movieShare } from './share.jsx'
import { useStickers } from './stickers.jsx'
import {
  ANNOTATION_HEX,
  ClampMore,
  clampSequence,
  GhostButton,
  FormModal,
  HandCard,
  HandNote,
  Hearts,
  Masonry,
  MonoLabel,
  QuoteActions,
  STATUS_META,
  toast,
  useColumnsAt,
} from './ui.jsx'

// tzOffsetMinutes — the client's UTC offset, east positive, sent with every
// review call so "today" is the reviewer's local day (the server stores UTC).
export function tzOffsetMinutes() {
  return -new Date().getTimezoneOffset()
}

function todayLabel() {
  const now = new Date()
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' })
  const date = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  return `${weekday} · ${date}`
}

function greeting(username) {
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${part}, ${username || 'reader'}`
}

// ---- shared quiz pieces (Daily Quiz + Practice) ----

// workNoun — what to call a card's source in the question line.
function workNoun(card) {
  if (card.kind === 'screen') return card.media_type === 'show' ? 'show' : 'film'
  return 'book'
}

// askLine — the multiple-choice prompt for a card's direction. "source" shows
// the quote and asks which work it's from (options are titles); "quote" shows
// the work and asks which quote is from it (options are quotes).
function askLine(card) {
  return card.direction === 'source'
    ? `Which ${workNoun(card)} is this quote from?`
    : `Which quote is from this ${workNoun(card)}?`
}

// QuoteBlock — the quote side of a card (used as prompt for "source", as the
// revealed answer for "quote").
function QuoteBlock({ card }) {
  return (
    <blockquote
      style={{
        borderLeft: `4px solid ${ANNOTATION_HEX[card.color] || 'var(--accent-ui)'}`,
        padding: '2px 0 2px 12px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 17,
          lineHeight: 1.5,
          overflowWrap: 'anywhere',
        }}
      >
        {card.quote || card.note}
      </p>
      {card.note && card.quote && <HandNote className="mt-2">{card.note}</HandNote>}
    </blockquote>
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
  const people =
    card.kind === 'screen'
      ? (card.actor ? [{ name: card.actor, kind: 'actor' }] : [])
      : splitCredits(card.author, DEFAULT_CREDIT_SEPS).map((n) => ({ name: n, kind: 'author' }))
  let meta
  if (card.kind === 'screen') {
    const media = card.media_type === 'show' ? 'Show' : 'Film'
    meta = [media, card.character, card.timestamp].filter(Boolean).join(' · ')
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
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>
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

// QuizRunner — the shared multiple-choice flow. The caller supplies the deck
// and whether skipping is allowed (Practice only) and is told each result — a
// correct pick counts as "got", a wrong one as "forgot" — so the quiz feeds the
// same schedule as before, only auto-graded. A correct save is required before
// advancing; skip (Practice) advances locally, touching neither schedule nor
// score.
function QuizRunner({ mode, cards, allowSkip, onAnswered, onDone }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null) // chosen option index for the current card
  const [busy, setBusy] = useState(false)
  // Portrait lookups for the person chips on prompts and options (the server
  // names each option's author/actor/director in option_meta).
  const { map: authorMap } = usePeople('author')
  const { map: actorMap } = usePeople('actor')
  const { map: directorMap } = usePeople('director')
  const personMaps = { author: authorMap, actor: actorMap, director: directorMap }
  const card = cards[i]
  if (!card) return null

  function advance() {
    if (i + 1 >= cards.length) return onDone?.()
    setI(i + 1)
    setPicked(null)
  }

  async function pick(idx) {
    if (picked != null || busy) return // one shot per question
    const correct = idx === card.answer
    setPicked(idx)
    setBusy(true)
    const r = await json('POST', '/review/answer', {
      kind: card.kind,
      id: card.id,
      result: correct ? 'got' : 'forgot',
      mode,
      offset: tzOffsetMinutes(),
    })
    setBusy(false)
    // A failed save reverts the pick so the card can be retried rather than
    // silently missing from the tally / schedule.
    if (!r.ok) {
      setPicked(null)
      return toast('couldn’t save — check your connection and try again')
    }
    // The result string, not the raw boolean — both cards' tallies compare
    // against 'got'/'forgot' (a boolean never matched, so the session tallies
    // silently stayed at zero).
    onAnswered?.(correct ? 'got' : 'forgot', r.data)
  }

  const isSource = card.direction === 'source'
  const answered = picked != null
  return (
    <div key={i} className="review-card-body">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <MonoLabel>{askLine(card)}</MonoLabel>
        <span className="mono-label" style={{ letterSpacing: '.06em' }}>{i + 1} of {cards.length}</span>
      </div>
      {isSource ? <QuoteBlock card={card} /> : <SourceLines card={card} maps={personMaps} />}
      <div className="mt-3 flex flex-col gap-2">
        {(card.options || []).map((opt, idx) => {
          const isAnswer = idx === card.answer
          const chosen = picked === idx
          // Work-title options carry a person chip (author / actor / director).
          const om = isSource ? card.option_meta?.[idx] : null
          let border = 'var(--line)'
          let bg = 'var(--raised)'
          if (answered && isAnswer) {
            border = 'var(--ok)'
            bg = 'color-mix(in srgb, var(--ok) 16%, transparent)'
          } else if (chosen && !isAnswer) {
            border = 'var(--error)'
            bg = 'color-mix(in srgb, var(--error) 12%, transparent)'
          }
          return (
            <button
              key={idx}
              type="button"
              disabled={answered || busy}
              onClick={() => pick(idx)}
              className="text-left"
              style={{
                minHeight: 44,
                padding: '9px 13px',
                borderRadius: 9,
                border: `1.4px solid ${border}`,
                background: bg,
                fontFamily: isSource ? 'var(--font-ui)' : 'var(--font-display)',
                fontStyle: isSource ? 'normal' : 'italic',
                fontSize: 14.5,
                lineHeight: 1.4,
                overflowWrap: 'anywhere',
              }}
            >
              {opt}
              {om?.person && (
                <span className="mt-1.5 flex" style={{ fontStyle: 'normal' }}>
                  <PersonChip name={om.person} person={personMaps[om.kind]?.[om.person]} size={18} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {answered ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <MonoLabel style={{ color: picked === card.answer ? 'var(--ok)' : 'var(--error)' }}>
            {picked === card.answer ? 'correct' : 'not quite'}
          </MonoLabel>
          <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={advance}>
            {i + 1 < cards.length ? 'Next' : 'Finish'}
          </button>
        </div>
      ) : allowSkip ? (
        <div className="mt-3 text-right">
          <button type="button" className="tp-link" onClick={advance}>skip</button>
        </div>
      ) : null}
    </div>
  )
}

// StatesRow — the "where you stand" breakdown: a count per repetition status
// with its coloured dot, plus a toggle for the explainer.
function StatesRow({ states, help, onToggleHelp }) {
  if (!states || states.total === 0) return null
  const pips = [
    ['remembered', states.remembered],
    ['forgetting', states.forgetting],
    ['probably-forgotten', states.probably_forgotten],
    ['unseen', states.unseen],
  ]
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }} className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="mono-label" style={{ color: 'var(--faint)' }}>where you stand</span>
        {pips.map(([key, n]) => (
          <span key={key} className="mono-label inline-flex items-center gap-1.5" style={{ fontSize: 10.5, opacity: n ? 1 : 0.45 }}>
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                border: `1.5px solid ${STATUS_META[key].color}`,
                background: STATUS_META[key].filled ? STATUS_META[key].color : 'transparent',
              }}
            />
            <span style={{ fontWeight: 600 }}>{n}</span> {STATUS_META[key].label.toLowerCase()}
          </span>
        ))}
        <button type="button" className="tp-link" style={{ fontSize: 11, marginLeft: 'auto' }} onClick={onToggleHelp}>
          how these work
        </button>
      </div>
      {help && (
        <p className="microcopy mt-2" style={{ lineHeight: 1.6 }}>
          Each quote carries a memory “half-life” that grows every time you recall it and shrinks when
          you forget — the classic{' '}
          <a href="https://en.wikipedia.org/wiki/Forgetting_curve" target="_blank" rel="noopener noreferrer" className="tp-link">
            forgetting curve
          </a>{' '}
          behind{' '}
          <a href="https://en.wikipedia.org/wiki/Spaced_repetition" target="_blank" rel="noopener noreferrer" className="tp-link">
            spaced repetition
          </a>. A quote is <strong>remembered</strong> while your odds of recalling it stay high,{' '}
          <strong>forgetting</strong> as they slip, and <strong>probably forgotten</strong> once they
          fall past half — which is when the Daily Quiz brings it back. A quote you’ve just saved counts
          as remembered for its first week, then joins the rotation. Hover a quote’s dot anywhere to
          see its half-life.
        </p>
      )}
    </div>
  )
}

// DailyQuizCard — the scheduled spaced-repetition session (ROADMAP №2): every
// card due today, no skips, each grade folded into the schedule. Got it / Forgot
// move the card's half-life; the deck drains as you go and the pending dot
// follows. Records a permanent daily score + streak.
function DailyQuizCard({ onPending, states, onStates }) {
  const [data, setData] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | active | done | error
  const [tally, setTally] = useState({ got: 0, forgot: 0 })
  const [help, setHelp] = useState(false)

  useEffect(() => {
    json('GET', `/review/daily?offset=${tzOffsetMinutes()}`).then((r) => {
      // A failed fetch must NOT masquerade as "all caught up" — show an error and
      // leave the pending dot as the shell seeded it.
      if (!r.ok) return setPhase('error')
      setData(r.data)
      setTally({ got: r.data.got_today || 0, forgot: r.data.forgot_today || 0 })
      onStates?.(r.data.states)
      const n = (r.data.items || []).length
      onPending(n)
      setPhase(n ? 'active' : 'done')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onAnswered(result, res) {
    setTally((t) => ({
      got: t.got + (result === 'got' ? 1 : 0),
      forgot: t.forgot + (result === 'forgot' ? 1 : 0),
    }))
    if (res && typeof res.remaining === 'number') onPending(res.remaining)
    // Every answer carries fresh library-wide status counts, so "where you
    // stand" ticks live instead of waiting for the next Home visit.
    if (res?.states) onStates?.(res.states)
  }

  const streak = data?.streak || 0
  return (
    <HandCard variant={0} style={{ padding: '16px 18px 14px' }}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <MonoLabel style={{ color: 'var(--accent-ui)' }}>Daily quiz</MonoLabel>
        {streak > 0 && (
          <span className="mono-label" style={{ letterSpacing: '.06em' }}>{streak}-day streak</span>
        )}
      </div>

      {phase === 'error' ? (
        <p className="microcopy py-6 text-center" style={{ color: 'var(--error)' }}>
          couldn’t load today’s quiz — reload to try again
        </p>
      ) : phase === 'loading' ? (
        <p className="microcopy py-6 text-center">gathering today’s cards…</p>
      ) : phase === 'active' ? (
        <QuizRunner
          mode="daily"
          cards={data.items}
          allowSkip={false}
          onAnswered={onAnswered}
          onDone={() => setPhase('done')}
        />
      ) : (
        <div className="review-card-body py-4 text-center" style={{ padding: '18px 6px 12px' }}>
          <p
            aria-hidden="true"
            style={{ fontFamily: 'var(--font-hand)', fontSize: 24, color: 'var(--accent-ui)', transform: 'rotate(-1.2deg)' }}
          >
            {tally.got || tally.forgot ? 'all caught up ✓' : 'nothing due today'}
          </p>
          <p className="mono-label mt-1" style={{ letterSpacing: '.06em' }}>
            {tally.got || tally.forgot
              ? `${tally.got} recalled · ${tally.forgot} to resurface · back tomorrow`
              : 'add or review more quotes to build your schedule'}
          </p>
        </div>
      )}

      {states && (
        <StatesRow states={states} help={help} onToggleHelp={() => setHelp((v) => !v)} />
      )}
    </HandCard>
  )
}

// PracticeCard — unlimited retrieval practice (ROADMAP №2): the same reveal/grade
// flow as the Daily Quiz, but skippable and, by default, schedule-neutral (a
// setting opts it into moving half-lives). Its score is separate and can be
// reset without touching learning history.
function PracticeCard({ onStates }) {
  const [phase, setPhase] = useState('idle') // idle | active | done
  const [cards, setCards] = useState([])
  const [score, setScore] = useState(null) // lifetime practice score
  const [round, setRound] = useState({ got: 0, forgot: 0 })
  const [busy, setBusy] = useState(false)

  function loadScore() {
    json('GET', `/review/scores?offset=${tzOffsetMinutes()}`).then((r) => {
      if (r.ok) setScore(r.data.practice)
    })
  }
  useEffect(() => { loadScore() }, [])

  async function start() {
    setBusy(true)
    const r = await json('GET', '/review/practice')
    setBusy(false)
    const items = r.ok ? r.data.items || [] : []
    if (!items.length) return toast('add a few more quotes first — practice needs some to work with')
    setCards(items)
    setRound({ got: 0, forgot: 0 })
    setPhase('active')
  }

  function onAnswered(result, res) {
    setRound((t) => ({
      got: t.got + (result === 'got' ? 1 : 0),
      forgot: t.forgot + (result === 'forgot' ? 1 : 0),
    }))
    // Practice answers refresh the Daily card's "where you stand" row too — the
    // server returns the counts on every answer (they move when practice is set
    // to touch the schedule, and stay honest either way).
    if (res?.states) onStates?.(res.states)
  }

  async function reset() {
    await json('DELETE', '/review/practice')
    loadScore()
    toast('practice score cleared')
  }

  return (
    <HandCard variant={3} style={{ padding: '16px 18px 14px' }}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <MonoLabel style={{ color: 'var(--accent-ui)' }}>Practice</MonoLabel>
        {phase === 'active' && <span className="mono-label" style={{ letterSpacing: '.06em' }}>unlimited</span>}
      </div>

      {phase === 'idle' && (
        <div className="review-card-body">
          <p className="microcopy mb-3">
            free retrieval practice across your whole library — recall the source of a quote, or a quote
            from a work. Skippable, and it won’t touch your schedule unless you turn that on in settings.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={start}>
              {busy ? 'Loading…' : 'Start practice'}
            </button>
            {score && score.answered > 0 && (
              <>
                <MonoLabel style={{ fontSize: 10.5 }}>
                  {score.answered} answered · {Math.round(score.accuracy * 100)}% recalled
                </MonoLabel>
                <button type="button" className="tp-link" onClick={reset}>reset score</button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'active' && (
        <QuizRunner
          mode="practice"
          cards={cards}
          allowSkip
          onAnswered={onAnswered}
          onDone={() => { loadScore(); setPhase('done') }}
        />
      )}

      {phase === 'done' && (
        <div className="review-card-body py-2 text-center">
          <p aria-hidden="true" style={{ fontFamily: 'var(--font-hand)', fontSize: 24, color: 'var(--accent-ui)', transform: 'rotate(-1.2deg)' }}>
            {round.got} / {round.got + round.forgot}
          </p>
          <p className="mono-label mt-1 mb-3" style={{ letterSpacing: '.06em' }}>
            practice round done — {round.got} recalled · {round.forgot} missed
          </p>
          <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={start}>
            Another round
          </button>
        </div>
      )}
    </HandCard>
  )
}

const FAVS_INITIAL = 4 // tiles shown before "view more"

// bookFav / screenFav flatten a book annotation and a screen dialogue into one
// favourite-tile shape so the Home grid can mix both media. `text` is the line
// shown (the quote, or the note for note-only captures); `note` is the margin
// note, surfaced on expand only when there's a separate quote (so it never
// duplicates the text).
function bookFav(a) {
  const ch = (a.chapter || '').trim()
  const meta = [
    a.book_title,
    a.book_author,
    ch && (/^\d/.test(ch) ? `CH. ${ch}` : ch),
    a.location && `P. ${a.location}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    key: `book:${a.id}`,
    kind: 'book',
    color: a.color,
    text: a.quote || a.note,
    note: a.quote ? a.note : '',
    tags: a.tags || [],
    source: [a.book_title, a.book_author].filter(Boolean).join(' · '),
    meta,
    createdAt: a.created_at,
    openLabel: 'Open book →',
    workId: a.book_id,
    raw: a, // the untouched row — share/edit/delete need the full state
  }
}

function screenFav(d, movieMap) {
  const m = movieMap[d.movie_id] || {}
  const isShow = (m.media_type || 'movie') === 'show'
  return {
    key: `screen:${d.id}`,
    kind: 'screen',
    media: isShow ? 'SHOW' : 'FILM',
    text: d.quote || d.note,
    note: d.quote ? d.note : '',
    tags: d.tags || [],
    source: [m.title, d.character].filter(Boolean).join(' · '),
    meta: [m.title, d.character, d.timestamp].filter(Boolean).join(' · '),
    createdAt: d.created_at,
    openLabel: isShow ? 'Open show →' : 'Open film →',
    workId: d.movie_id,
    raw: d, // the untouched row — share/edit/delete need the full state
    movie: m, // parent title/year for the share payload
  }
}

export default function Home({ user, stats, onOpenBook, onOpenMovie, onGoLibrary, onGoMovies, onPending }) {
  const [favs, setFavs] = useState([])
  const favCols = useColumnsAt([[640, 2]]) // favourites masonry: 1 col < sm, 2 ≥ sm
  const [favsShown, setFavsShown] = useState(FAVS_INITIAL)
  const [openFav, setOpenFav] = useState(null) // favourite key expanded in place
  const [editingFav, setEditingFav] = useState(null) // favourite key being edited in place
  const [shareFav, setShareFav] = useState(null) // favourite being shared, or null
  const [tagNames, setTagNames] = useState([]) // suggestions for the edit forms
  const { map: authorMap } = usePeople('author') // author faces: favourite chips + share payloads
  const { map: actorMap } = usePeople('actor') // actor faces: favourite chips + share payloads
  const [person, setPerson] = useState(null) // {kind, name} open in the metadata panel
  const seps = parseCreditSeps(user?.preferences?.creditSeparators)
  // "Where you stand" lives in the Daily Quiz card but is fed by BOTH cards —
  // every /review/answer response carries fresh counts, so the row ticks live.
  const [states, setStates] = useState(null)
  const { stickers, reload: reloadStickers } = useStickers()

  // Favourites across both media — books (annotations) and films/shows
  // (dialogues) — merged newest-first. A few show as tiles; the rest wait
  // behind "view more". Movies are fetched once to attribute each dialogue to
  // its title (the dialogues list carries only movie_id). Reloaded after any
  // tile mutation (edit · delete · un-heart).
  function loadFavs() {
    Promise.all([
      json('GET', '/annotations?favorite=1&limit=200'),
      json('GET', '/dialogues?favorite=1'),
      json('GET', '/movies'),
    ]).then(([ra, rd, rm]) => {
      // Guard .data, not just .ok: a 2xx response with a non-JSON/empty body
      // (an SPA/HTML fallback from a reverse proxy, or a session-expiry redirect
      // resolved to a 200 page) leaves .data null. Dereferencing .data.movies
      // then throws and — with no catch — silently blanked the ENTIRE favourites
      // section while the rest of Home rendered. Guard each, and catch below.
      const movieMap = {}
      if (rm.ok && rm.data) for (const m of rm.data.movies || []) movieMap[m.id] = m
      const list = []
      if (ra.ok && ra.data) for (const a of ra.data.annotations || []) list.push(bookFav(a))
      if (rd.ok && rd.data) for (const d of rd.data.dialogues || []) list.push(screenFav(d, movieMap))
      // Favourites shuffle on every load (Fisher–Yates) — the section is a
      // re-surfacing wall, not a chronological feed, so each visit reorders it.
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
      setFavs(list)
    }).catch((e) => {
      console.error('favourites load failed', e)
    })
  }
  useEffect(() => {
    loadFavs()
    json('GET', '/tags').then((r) => {
      if (r.ok && r.data) setTagNames((r.data.tags || []).map((t) => t.name))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Per-load clamp sizes (3–5 lines, no three-in-a-row). Favourites are shuffled
  // each load and laid out in that (source) order, so the clamps land in the same
  // order the reader sees. Recomputed each load (favs identity changes).
  const favClamps = useMemo(() => clampSequence(favs.length, Math.random), [favs])

  // Share/edit/delete mirror the handlers in Library/Movies/SearchPage: PUTs
  // are full-state (annotationState/dialogueState carry every field), deletes
  // confirm first, and every success reloads the favourites list.
  const itemPath = (f) => (f.kind === 'book' ? '/annotations' : '/dialogues')
  async function saveFav(f, fields) {
    const r = await json('PUT', `${itemPath(f)}/${f.raw.id}`, fields)
    if (!r.ok) return errText(r, 'could not save')
    setEditingFav(null)
    loadFavs()
    return null
  }
  async function patchFav(f, fields) {
    const stateFn = f.kind === 'book' ? annotationState : dialogueState
    const r = await json('PUT', `${itemPath(f)}/${f.raw.id}`, { ...stateFn(f.raw), ...fields })
    if (!r.ok) return toast(errText(r, 'could not save'))
    loadFavs()
  }
  async function removeFav(f) {
    if (!confirm(f.kind === 'book' ? 'Delete this annotation?' : 'Delete this dialogue?')) return
    const r = await json('DELETE', `${itemPath(f)}/${f.raw.id}`)
    if (!r.ok) return toast(errText(r, 'could not delete'))
    if (openFav === f.key) setOpenFav(null)
    if (editingFav === f.key) setEditingFav(null)
    loadFavs()
  }
  const sharePayloadFor = (f) =>
    f.kind === 'book'
      ? bookShare({
          quote: f.raw.quote, note: f.raw.note, author: f.raw.book_author, title: f.raw.book_title,
          chapter: f.raw.chapter, location: f.raw.location, date: fmtDate(annDate(f.raw)),
          tags: f.raw.tags, color: f.raw.color, people: authorMap,
        })
      : movieShare({
          quote: f.raw.quote, note: f.raw.note, title: f.movie?.title, year: f.movie?.release_year,
          character: f.raw.character, actor: f.raw.actor, timestamp: f.raw.timestamp, tags: f.raw.tags,
          people: actorMap,
        })

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pt-4" data-screen-label="home-body">
      <div className="px-0.5">
        <MonoLabel>{todayLabel()}</MonoLabel>
        <h1
          className="mt-0.5"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
          }}
        >
          {greeting(user?.username)}
        </h1>
      </div>

      <DailyQuizCard onPending={onPending} states={states} onStates={setStates} />

      <PracticeCard onStates={setStates} />

      <div className="grid grid-cols-2 gap-2.5">
        <HandCard variant={1} className="cursor-pointer" style={{ padding: '13px 15px' }} onClick={onGoLibrary} role="button" tabIndex={0}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24 }}>
            {stats ? stats.books : '–'}
          </p>
          <MonoLabel style={{ fontSize: 11 }}>books · {stats ? stats.annotations : '–'} quotes</MonoLabel>
        </HandCard>
        <HandCard variant={2} className="cursor-pointer" style={{ padding: '13px 15px' }} onClick={onGoMovies} role="button" tabIndex={0}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24 }}>
            {stats ? stats.movies : '–'}
          </p>
          <MonoLabel style={{ fontSize: 11, color: 'var(--amber)' }}>
            films · {stats ? stats.dialogues : '–'} dialogues
          </MonoLabel>
        </HandCard>
      </div>

      {favs.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center gap-3">
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18 }}>
              Favourites
            </h2>
            <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--line)' }} />
            <MonoLabel>♥ {favs.length}</MonoLabel>
          </div>
          <Masonry columns={favCols} gap={10} order="source">
            {favs.slice(0, favsShown).map((f, i) => (
              <FavouriteTile
                key={f.key}
                f={f}
                variant={i + 1}
                clampLines={favClamps[i] || 3}
                open={openFav === f.key}
                editing={editingFav === f.key}
                onToggle={() => {
                  // Collapsing (or expanding another tile) always cancels an
                  // in-place edit — a half-hidden form is worse than a reset one.
                  setEditingFav(null)
                  setOpenFav((k) => (k === f.key ? null : f.key))
                }}
                onOpen={() => (f.kind === 'book' ? onOpenBook(f.workId) : onOpenMovie(f.workId))}
                onEditStart={() => setEditingFav(f.key)}
                onEditCancel={() => setEditingFav(null)}
                onSave={(fields) => saveFav(f, fields)}
                onPatch={(fields) => patchFav(f, fields)}
                onDelete={() => removeFav(f)}
                onShare={() => setShareFav(f)}
                tagSuggestions={tagNames}
                stickers={stickers}
                reloadStickers={reloadStickers}
                authorMap={authorMap}
                actorMap={actorMap}
                seps={seps}
                onOpenPerson={setPerson}
              />
            ))}
          </Masonry>
          {favsShown < favs.length && (
            <div className="mt-3 text-center">
              <GhostButton onClick={() => setFavsShown((n) => n + 8)}>
                View more ({favs.length - favsShown})
              </GhostButton>
            </div>
          )}
        </section>
      )}

      {shareFav && (
        <ShareDialog
          share={sharePayloadFor(shareFav)}
          seen={{ kind: shareFav.kind === 'book' ? 'book' : 'screen', id: shareFav.raw.id }}
          onClose={() => setShareFav(null)}
        />
      )}
      {person && <PersonModal kind={person.kind} name={person.name} onClose={() => setPerson(null)} />}
    </div>
  )
}

// FavouriteTile — one favourite in the Home masonry, book or screen. Collapsed
// it shows a media tag, the quote (clamped) and its source; tapping expands it
// in place (full quote, note, tags) within its column — the board re-packs
// around the taller tile — with a button to open the parent book / film / show
// plus the same ♥ · share · edit ·
// delete affordances the detail-screen cards carry (hover-revealed on desktop,
// a ⋯ menu on phones — QuoteActions handles both). Edit swaps the tile body for
// the same inline form the detail screens use. The colour bar is the highlight
// colour for books, amber for screen quotes (the film voice). Tapping again
// collapses.
function FavouriteTile({
  f, variant, clampLines = 3, open, editing, onToggle, onOpen,
  onEditStart, onEditCancel, onSave, onPatch, onDelete, onShare,
  tagSuggestions, stickers, reloadStickers,
  authorMap = {}, actorMap = {}, seps, onOpenPerson,
}) {
  const isBook = f.kind === 'book'
  // The credited people: a book's author(s) (split per the user's separator
  // prefs), a dialogue's actor. Faces ride the collapsed source line
  // (display-only — the whole head is the expand button); the expanded tile
  // makes them full clickable PersonCredit chips.
  const peopleNames = isBook
    ? splitCredits(f.raw.book_author, seps)
    : (f.raw.actor ? [f.raw.actor] : [])
  const peopleMap = isBook ? authorMap : actorMap
  return (
    <HandCard
      variant={variant}
      colorBar={isBook ? f.color : 'var(--amber)'}
      style={{ padding: '12px 15px' }}
    >
      <FormModal open={editing} onClose={onEditCancel} title={isBook ? 'Edit quote' : 'Edit dialogue'} maxWidth={520}>
        {isBook ? (
          <AnnotationForm
            initial={f.raw}
            onSubmit={onSave}
            onCancel={onEditCancel}
            submitLabel="Save"
            tagSuggestions={tagSuggestions}
            stickers={stickers}
            reloadStickers={reloadStickers}
          />
        ) : (
          <DialogueForm
            initial={f.raw}
            onSubmit={onSave}
            onCancel={onEditCancel}
            submitLabel="Save"
            tagSuggestions={tagSuggestions}
            stickers={stickers}
            reloadStickers={reloadStickers}
          />
        )}
      </FormModal>
        <>
          {/* Click anywhere on the tile head to expand — a chevron is the only
              affordance (no "show more"); the quote clamps to a per-card 3–5. */}
          <button type="button" className="clampable is-clickable block w-full text-left" style={{ background: 'none', border: 'none', padding: 0 }} onClick={onToggle} aria-expanded={open}>
            <MonoLabel className="mb-1.5 block" style={{ fontSize: 9.5, color: isBook ? 'var(--accent-ui)' : 'var(--amber)' }}>
              {isBook ? 'BOOK' : f.media}
            </MonoLabel>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 15,
                lineHeight: 1.5,
                margin: 0,
                ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
              }}
            >
              “{f.text}”
            </p>
            <span className="mt-1.5 flex items-center gap-1.5">
              <CreditFaces names={peopleNames} map={peopleMap} size={18} ring="var(--card)" />
              <MonoLabel style={{ fontSize: 10.5 }}>{open ? f.meta : f.source}</MonoLabel>
            </span>
            <ClampMore open={open} />
          </button>
          {open && (
            <div className="mt-2.5 space-y-2">
              {f.note && <HandNote>{f.note}</HandNote>}
              {peopleNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {peopleNames.map((n) => (
                    <PersonCredit
                      key={n}
                      kind={isBook ? 'author' : 'actor'}
                      name={n}
                      person={peopleMap[n]}
                      size={24}
                      onOpen={onOpenPerson}
                    />
                  ))}
                </div>
              )}
              {f.tags && f.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {f.tags.map((t) => <span key={t} className="tp-chip">{t}</span>)}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                <button type="button" className="tp-btn tp-btn-primary tactile" onClick={onOpen}>
                  {f.openLabel}
                </button>
                {/* Un-hearting removes the tile — this IS the favourites list. */}
                <Hearts value={!!f.raw.favorite} onChange={(v) => onPatch({ favorite: v })} />
                <span className="ml-auto flex items-center">
                  <QuoteActions onShare={onShare} onEdit={onEditStart} onDelete={onDelete} />
                </span>
              </div>
            </div>
          )}
        </>
    </HandCard>
  )
}
