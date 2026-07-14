// Home — the landing screen (mobile handoff §7 redesign, ROADMAP №2): a date +
// greeting, the Daily Quiz card, the Practice card, a quick-capture tile, two
// stat tiles, and the most recent favourites. Reached by tapping the logo
// (every bar) or landing on "/". One narrow column on every screen size — the
// ritual reads the same on a phone and a desktop.
import { useEffect, useState } from 'react'
import { errText, json } from './api.js'
import {
  ANNOTATION_HEX,
  ColorSwatches,
  ErrorText,
  GhostButton,
  HandCard,
  HandNote,
  MobileSheet,
  MonoLabel,
  Select,
  STATUS_META,
  toast,
  useIsMobileScreen,
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

// SourceLines — the attribution side of a card (title + author/character etc.):
// the revealed answer for "source", the prompt for "quote".
function SourceLines({ card }) {
  let meta
  if (card.kind === 'screen') {
    const media = card.media_type === 'show' ? 'Show' : 'Film'
    meta = [media, card.character, card.timestamp].filter(Boolean).join(' · ')
  } else {
    const ch = (card.chapter || '').trim()
    meta = [
      card.author,
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
    onAnswered?.(correct, r.data)
  }

  const isSource = card.direction === 'source'
  const answered = picked != null
  return (
    <div key={i} className="review-card-body">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <MonoLabel>{askLine(card)}</MonoLabel>
        <span className="mono-label" style={{ letterSpacing: '.06em' }}>{i + 1} of {cards.length}</span>
      </div>
      {isSource ? <QuoteBlock card={card} /> : <SourceLines card={card} />}
      <div className="mt-3 flex flex-col gap-2">
        {(card.options || []).map((opt, idx) => {
          const isAnswer = idx === card.answer
          const chosen = picked === idx
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
          fall past half — which is when the Daily Quiz brings it back. Hover a quote’s dot anywhere to
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
function DailyQuizCard({ onPending }) {
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

      {data && (
        <StatesRow states={data.states} help={help} onToggleHelp={() => setHelp((v) => !v)} />
      )}
    </HandCard>
  )
}

// PracticeCard — unlimited retrieval practice (ROADMAP №2): the same reveal/grade
// flow as the Daily Quiz, but skippable and, by default, schedule-neutral (a
// setting opts it into moving half-lives). Its score is separate and can be
// reset without touching learning history.
function PracticeCard() {
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

  function onAnswered(result) {
    setRound((t) => ({
      got: t.got + (result === 'got' ? 1 : 0),
      forgot: t.forgot + (result === 'forgot' ? 1 : 0),
    }))
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
  }
}

export default function Home({ user, stats, onOpenBook, onOpenMovie, onGoLibrary, onGoMovies, onCapture, onPending }) {
  const [favs, setFavs] = useState([])
  const [favsShown, setFavsShown] = useState(FAVS_INITIAL)
  const [openFav, setOpenFav] = useState(null) // favourite key expanded in place

  useEffect(() => {
    // Favourites across both media — books (annotations) and films/shows
    // (dialogues) — merged newest-first. A few show as tiles; the rest wait
    // behind "view more". Movies are fetched once to attribute each dialogue to
    // its title (the dialogues list carries only movie_id).
    Promise.all([
      json('GET', '/annotations?favorite=1&limit=200'),
      json('GET', '/dialogues?favorite=1'),
      json('GET', '/movies'),
    ]).then(([ra, rd, rm]) => {
      const movieMap = {}
      if (rm.ok) for (const m of rm.data.movies || []) movieMap[m.id] = m
      const list = []
      if (ra.ok) for (const a of ra.data.annotations || []) list.push(bookFav(a))
      if (rd.ok) for (const d of rd.data.dialogues || []) list.push(screenFav(d, movieMap))
      list.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''))
      setFavs(list)
    })
  }, [])

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

      <DailyQuizCard onPending={onPending} />

      <PracticeCard />

      <button
        type="button"
        className="w-full text-center"
        style={{ border: '1.6px dashed var(--ink-border)', borderRadius: 12, padding: '15px 18px', background: 'transparent' }}
        onClick={onCapture}
      >
        <span className="font-semibold" style={{ color: 'var(--accent-ui)' }}>＋ Capture a quote</span>
        <span className="microcopy ml-3">quote · note · colour · tags</span>
      </button>

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
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {favs.slice(0, favsShown).map((f, i) => (
              <FavouriteTile
                key={f.key}
                f={f}
                variant={i + 1}
                open={openFav === f.key}
                onToggle={() => setOpenFav((k) => (k === f.key ? null : f.key))}
                onOpen={() => (f.kind === 'book' ? onOpenBook(f.workId) : onOpenMovie(f.workId))}
              />
            ))}
          </div>
          {favsShown < favs.length && (
            <div className="mt-3 text-center">
              <GhostButton onClick={() => setFavsShown((n) => n + 8)}>
                View more ({favs.length - favsShown})
              </GhostButton>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// FavouriteTile — one favourite in the Home grid, book or screen. Collapsed it
// shows a media tag, the quote (clamped) and its source; tapping expands it in
// place (full quote, note, tags) and widens the tile to the full row, with a
// button to open the parent book / film / show. The colour bar is the highlight
// colour for books, amber for screen quotes (the film voice). Tapping again
// collapses.
function FavouriteTile({ f, variant, open, onToggle, onOpen }) {
  const isBook = f.kind === 'book'
  return (
    <HandCard
      variant={variant}
      colorBar={isBook ? f.color : 'var(--amber)'}
      className={open ? 'sm:col-span-2' : ''}
      style={{ padding: '12px 15px' }}
    >
      <button type="button" className="block w-full text-left" style={{ background: 'none', border: 'none', padding: 0 }} onClick={onToggle}>
        <MonoLabel className="mb-1.5 block" style={{ fontSize: 9.5, color: isBook ? 'var(--accent-ui)' : 'var(--amber)' }}>
          {isBook ? 'BOOK' : f.media}
        </MonoLabel>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: 1.5,
            ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
          }}
        >
          “{f.text}”
        </p>
        <MonoLabel className="mt-1.5 block" style={{ fontSize: 10.5 }}>
          {open ? f.meta : f.source}
        </MonoLabel>
      </button>
      {open && (
        <div className="mt-2.5 space-y-2">
          {f.note && <HandNote>{f.note}</HandNote>}
          {f.tags && f.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {f.tags.map((t) => <span key={t} className="tp-chip">{t}</span>)}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="tp-btn tp-btn-primary tactile" onClick={onOpen}>
              {f.openLabel}
            </button>
          </div>
        </div>
      )}
    </HandCard>
  )
}

// QuickCapture — the top-bar "+" / Home-tile capture sheet: jot a quote or
// note against any book without leaving where you are. Full-screen sheet on a
// phone; a centered card on desktop (same form either way). Tags are
// comma-separated names — unknown ones are auto-created server-side.
export function QuickCapture({ open, onClose, onSaved }) {
  const isMobile = useIsMobileScreen()
  const [books, setBooks] = useState(null)
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setErr('')
    setDraft({ bookId: '', quote: '', note: '', chapter: '', location: '', tags: '', color: 'yellow' })
    json('GET', '/books').then((r) => {
      const list = r.ok ? r.data.books || [] : []
      setBooks(list)
      setDraft((d) => (d && !d.bookId && list[0] ? { ...d, bookId: String(list[0].id) } : d))
    })
  }, [open])

  if (!open || !draft) return null

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  async function save() {
    if (!draft.quote.trim() && !draft.note.trim()) return setErr('quote or note is required')
    if (!draft.bookId) return setErr('add a book first — the Library is empty')
    setBusy(true)
    const r = await json('POST', '/annotations', {
      book_id: Number(draft.bookId),
      quote: draft.quote.trim(),
      note: draft.note.trim(),
      chapter: draft.chapter.trim(),
      location: draft.location.trim(),
      color: draft.color,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setBusy(false)
    if (!r.ok) return setErr(errText(r))
    toast('annotation captured')
    onSaved?.()
    onClose()
  }

  const body = (
    <div className="flex flex-col gap-3.5">
      <label className="tp-field">
        <MonoLabel>Book</MonoLabel>
        {books && books.length === 0 ? (
          <p className="microcopy mt-1">no books yet — add one in the Library first</p>
        ) : (
          <Select
            ariaLabel="Book"
            value={draft.bookId}
            onChange={(v) => set({ bookId: v })}
            options={(books || []).map((b) => [
              String(b.id),
              [b.title, b.author].filter(Boolean).join(' · '),
            ])}
          />
        )}
      </label>
      <label className="tp-field">
        <MonoLabel>Quote</MonoLabel>
        <textarea
          className="tp-input"
          rows={4}
          placeholder="the line worth keeping…"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, lineHeight: 1.55 }}
          value={draft.quote}
          onChange={(e) => set({ quote: e.target.value })}
        />
      </label>
      <label className="tp-field">
        <MonoLabel>Note</MonoLabel>
        <textarea
          className="tp-input"
          rows={2}
          placeholder="your margin note (renders handwritten)"
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="tp-field">
          <MonoLabel>Chapter</MonoLabel>
          <input className="tp-input" placeholder="e.g. 3" value={draft.chapter} onChange={(e) => set({ chapter: e.target.value })} />
        </label>
        <label className="tp-field">
          <MonoLabel>Location</MonoLabel>
          <input className="tp-input" placeholder="e.g. 142" value={draft.location} onChange={(e) => set({ location: e.target.value })} />
        </label>
      </div>
      <label className="tp-field">
        <MonoLabel>Tags · comma separated</MonoLabel>
        <input
          className="tp-input"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          placeholder="memory, craft"
          value={draft.tags}
          onChange={(e) => set({ tags: e.target.value })}
        />
      </label>
      <div className="flex items-center gap-3">
        <MonoLabel>colour</MonoLabel>
        <ColorSwatches value={draft.color} onChange={(c) => set({ color: c })} />
      </div>
      <ErrorText>{err}</ErrorText>
    </div>
  )

  const saveBtn = (
    <button type="button" className="tp-btn tp-btn-primary tactile ml-auto" style={{ minWidth: 120 }} disabled={busy} onClick={save}>
      Save
    </button>
  )

  if (isMobile) {
    return (
      <MobileSheet open onClose={onClose} title="Capture a quote" footer={saveBtn}>
        {body}
      </MobileSheet>
    )
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-12"
      style={{ background: 'rgba(21,16,12,.5)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Capture a quote"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <HandCard variant={2} className="w-full max-w-xl px-7 py-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="display-title text-xl">Capture a quote</h2>
          {saveBtn}
        </div>
        {body}
      </HandCard>
    </div>
  )
}
