// Home — the landing screen (mobile handoff §7 redesign, ROADMAP №2): a date +
// greeting, the Daily Review card, a quick-capture tile, two stat tiles, and
// the two most recent favourites. Reached by tapping the logo (every bar) or
// landing on "/". One narrow column on every screen size — the ritual reads
// the same on a phone and a desktop.
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

// reviewSource — the mono attribution line under a review quote:
// "{Title} · {Author} · CH. {n}". Chapter is free text — only prefix "CH."
// when it's a bare number (imports often store "Ch. 3" or a chapter name).
function reviewSource(item) {
  const ch = (item.chapter || '').trim()
  return [item.book_title, item.book_author, ch && (/^\d/.test(ch) ? `CH. ${ch}` : ch)]
    .filter(Boolean)
    .join(' · ')
}

// DailyReviewCard drives the day's deck: due cards first, then unseen ones,
// capped server-side so the ritual stays at ~2–3 minutes. Got it / Forgot
// nudge each card's half-life (the schedule lives server-side); skip benches
// the card for the rest of the day. `onPending` keeps the shell's
// notification dot honest as the deck drains.
function DailyReviewCard({ onPending }) {
  const [deck, setDeck] = useState(null) // today's remaining cards, fetched once per mount
  const [idx, setIdx] = useState(0)
  const [tally, setTally] = useState({ got: 0, forgot: 0 })
  const [states, setStates] = useState(null) // revision-state counts
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false) // the deck fetch itself errored
  const [showHelp, setShowHelp] = useState(false) // "how these levels work" explainer

  useEffect(() => {
    json('GET', `/annotations/daily-review?offset=${tzOffsetMinutes()}`).then((r) => {
      // A failed fetch must NOT masquerade as "all caught up" — show an error
      // and leave the pending dot as the shell seeded it (don't clear it).
      if (!r.ok) return setFailed(true)
      setDeck(r.data.items || [])
      setTally({ got: r.data.got_today || 0, forgot: r.data.forgot_today || 0 })
      setStates(r.data.states || null)
      onPending((r.data.items || []).length)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = deck ? deck.length : 0
  const cur = deck ? deck[idx] : null

  async function answer(result) {
    if (!cur || busy) return
    setBusy(true)
    const r = await json('POST', `/annotations/${cur.id}/review`, {
      result,
      offset: tzOffsetMinutes(),
    })
    setBusy(false)
    // Only advance and count on a confirmed save — a failed POST leaves the
    // card in place to retry rather than inflating the tally / clearing the
    // dot with recalls the server never recorded.
    if (!r.ok) return toast('couldn’t save — check your connection and try again')
    setIdx((i) => i + 1)
    if (result === 'got') setTally((t) => ({ ...t, got: t.got + 1 }))
    if (result === 'forgot') setTally((t) => ({ ...t, forgot: t.forgot + 1 }))
    onPending(r.data.remaining) // server is authoritative for the pending dot
  }

  return (
    <HandCard variant={0} style={{ padding: '16px 18px 14px' }}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <MonoLabel style={{ color: 'var(--accent-ui)' }}>Daily review</MonoLabel>
        <span className="mono-label" style={{ letterSpacing: '.06em' }}>
          {cur ? `${idx + 1} of ${total}` : `${total} of ${total}`}
        </span>
      </div>
      {failed ? (
        <p className="microcopy py-6 text-center" style={{ color: 'var(--error)' }}>
          couldn’t load today’s review — reload to try again
        </p>
      ) : deck == null ? (
        <p className="microcopy py-6 text-center">gathering today’s quotes…</p>
      ) : cur ? (
        // Re-keyed per card so the entrance replays on each advance.
        <div key={cur.id} className="review-card-body">
          <blockquote
            className="mb-2.5"
            style={{
              borderLeft: `4px solid ${ANNOTATION_HEX[cur.color] || ANNOTATION_HEX.yellow}`,
              padding: '2px 0 2px 12px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 17.5,
                lineHeight: 1.5,
                overflowWrap: 'anywhere',
              }}
            >
              {cur.quote || cur.note}
            </p>
          </blockquote>
          <MonoLabel className="mb-3.5 block" style={{ fontSize: 11 }}>
            {reviewSource(cur)}
          </MonoLabel>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="tp-btn tp-btn-primary tactile flex-1"
              disabled={busy}
              onClick={() => answer('got')}
            >
              Got it
            </button>
            <GhostButton className="flex-1" disabled={busy} onClick={() => answer('forgot')}>
              Forgot
            </GhostButton>
            <button type="button" className="tp-link" disabled={busy} onClick={() => answer('skip')}>
              skip
            </button>
          </div>
        </div>
      ) : (
        <div className="review-card-body py-4 text-center" style={{ padding: '18px 6px 12px' }}>
          <p
            aria-hidden="true"
            style={{
              fontFamily: 'var(--font-hand)',
              fontSize: 24,
              color: 'var(--accent-ui)',
              transform: 'rotate(-1.2deg)',
            }}
          >
            all caught up ✓
          </p>
          <p className="mono-label mt-1" style={{ letterSpacing: '.06em' }}>
            {tally.got} recalled · {tally.forgot} to resurface · back tomorrow
          </p>
        </div>
      )}
      {states && states.total > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }} className="mt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="mono-label" style={{ color: 'var(--faint)' }}>where you stand</span>
            <ReviewStatePip label="unseen" n={states.unseen} />
            <ReviewStatePip label="soon" n={states.soon} />
            <ReviewStatePip label="later" n={states.later} />
            <ReviewStatePip label="someday" n={states.someday} />
            <button type="button" className="tp-link" style={{ fontSize: 11, marginLeft: 'auto' }} onClick={() => setShowHelp((v) => !v)}>
              how these work
            </button>
          </div>
          {showHelp && (
            <p className="microcopy mt-2" style={{ lineHeight: 1.6 }}>
              Each quote carries a memory “half-life” that grows every time you recall it and
              shrinks when you forget — the classic{' '}
              <a href="https://en.wikipedia.org/wiki/Forgetting_curve" target="_blank" rel="noopener noreferrer" className="tp-link">
                forgetting curve
              </a>{' '}
              behind{' '}
              <a href="https://en.wikipedia.org/wiki/Spaced_repetition" target="_blank" rel="noopener noreferrer" className="tp-link">
                spaced repetition
              </a>. A quote is <strong>unseen</strong> until first reviewed, then <strong>soon</strong>{' '}
              (half-life under a week), <strong>later</strong> (one to four weeks), and{' '}
              <strong>someday</strong> (a month or more). It resurfaces for review once its recall
              odds dip past 50%.
            </p>
          )}
        </div>
      )}
    </HandCard>
  )
}

// ReviewStatePip — one revision-state count (unseen / soon / later / someday)
// in the "where you stand" readout: a mono count + label, dimmed at zero.
function ReviewStatePip({ label, n }) {
  return (
    <span className="mono-label" style={{ fontSize: 10.5, opacity: n ? 1 : 0.45 }}>
      <span style={{ color: n ? 'var(--accent-ui)' : 'var(--faint)', fontWeight: 600 }}>{n}</span> {label}
    </span>
  )
}

// QuizCard — a recall quiz built from your own library. Pick the right book for
// a quote (or the actor for a line); each answer also counts as a revision, so
// the quiz feeds the same schedule as the daily review. Unlimited rounds; the
// running score can be flushed.
function QuizCard() {
  const [phase, setPhase] = useState('idle') // idle | active | done
  const [qs, setQs] = useState([])
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null) // index chosen for the current question
  const [answers, setAnswers] = useState([]) // {id, kind, correct}
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    json('GET', '/annotations/quiz/stats').then((r) => { if (r.ok) setStats(r.data) })
  }, [])

  async function start() {
    setBusy(true)
    const r = await json('GET', '/annotations/quiz?count=6')
    setBusy(false)
    const items = r.ok ? r.data.questions || [] : []
    if (items.length === 0) return toast('add a few more quotes first — the quiz needs some to work with')
    setQs(items)
    setI(0)
    setPicked(null)
    setAnswers([])
    setPhase('active')
  }

  function pick(idx) {
    if (picked != null) return // one shot per question
    setPicked(idx)
    const q = qs[i]
    setAnswers((a) => [...a, { id: q.id, kind: q.kind, correct: idx === q.answer }])
  }

  async function next() {
    if (i + 1 < qs.length) {
      setI(i + 1)
      setPicked(null)
      return
    }
    setBusy(true)
    const r = await json('POST', '/annotations/quiz/submit', { answers })
    setBusy(false)
    if (r.ok) setStats(r.data.stats)
    setPhase('done')
  }

  async function flush() {
    await json('DELETE', '/annotations/quiz/results')
    setStats({ taken: 0, total: 0, correct: 0, accuracy: 0 })
    toast('quiz scores cleared')
  }

  const roundScore = answers.filter((a) => a.correct).length

  return (
    <HandCard variant={3} style={{ padding: '16px 18px 14px' }}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <MonoLabel style={{ color: 'var(--accent-ui)' }}>Quiz</MonoLabel>
        {phase === 'active' && (
          <span className="mono-label" style={{ letterSpacing: '.06em' }}>{i + 1} of {qs.length}</span>
        )}
      </div>

      {phase === 'idle' && (
        <div className="review-card-body">
          <p className="microcopy mb-3">
            match a quote to its book, or a line to who said it — every answer counts as a revision too.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={start}>
              {busy ? 'Loading…' : 'Start a quiz'}
            </button>
            {stats && stats.taken > 0 && (
              <>
                <MonoLabel style={{ fontSize: 10.5 }}>
                  {stats.taken} taken · {Math.round(stats.accuracy * 100)}% correct
                </MonoLabel>
                <button type="button" className="tp-link" onClick={flush}>clear scores</button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'active' && qs[i] && (
        <div key={i} className="review-card-body">
          <MonoLabel className="mb-1.5 block">{qs[i].ask}</MonoLabel>
          <blockquote
            className="mb-3"
            style={{ borderLeft: '4px solid var(--accent-ui)', padding: '2px 0 2px 12px' }}
          >
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
              {qs[i].prompt}
            </p>
          </blockquote>
          <div className="flex flex-col gap-2">
            {qs[i].options.map((opt, idx) => {
              const isAnswer = idx === qs[i].answer
              const chosen = picked === idx
              let border = 'var(--line)'
              let bg = 'var(--raised)'
              if (picked != null && isAnswer) { border = 'var(--accent-ui)'; bg = 'color-mix(in srgb, var(--accent) 14%, transparent)' }
              else if (chosen && !isAnswer) { border = 'var(--error)'; bg = 'color-mix(in srgb, var(--error) 12%, transparent)' }
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={picked != null}
                  onClick={() => pick(idx)}
                  className="text-left"
                  style={{
                    minHeight: 44, padding: '9px 13px', borderRadius: 9,
                    border: `1.4px solid ${border}`, background: bg,
                    fontFamily: 'var(--font-ui)', fontSize: 14.5,
                  }}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {picked != null && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <MonoLabel style={{ color: picked === qs[i].answer ? 'var(--accent-ui)' : 'var(--error)' }}>
                {picked === qs[i].answer ? 'correct' : 'not quite'}
              </MonoLabel>
              <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={next}>
                {i + 1 < qs.length ? 'Next' : 'Finish'}
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="review-card-body py-2 text-center">
          <p aria-hidden="true" style={{ fontFamily: 'var(--font-hand)', fontSize: 24, color: 'var(--accent-ui)', transform: 'rotate(-1.2deg)' }}>
            {roundScore} / {answers.length}
          </p>
          <p className="mono-label mt-1 mb-3" style={{ letterSpacing: '.06em' }}>
            {roundScore === answers.length ? 'perfect round' : 'counted toward your revisions'}
          </p>
          <button type="button" className="tp-btn tp-btn-primary tactile" disabled={busy} onClick={start}>
            Another round
          </button>
        </div>
      )}
    </HandCard>
  )
}

const FAVS_INITIAL = 5 // shown before "show more"

export default function Home({ user, stats, onOpenBook, onGoLibrary, onGoMovies, onCapture, onPending }) {
  const [favs, setFavs] = useState([])
  const [favsShown, setFavsShown] = useState(FAVS_INITIAL)
  const [openFav, setOpenFav] = useState(null) // annotation id expanded in place

  useEffect(() => {
    // All favourites, newest first (capped generously); the list shows a few
    // and reveals the rest on demand rather than shipping nothing.
    json('GET', '/annotations?favorite=1&limit=200').then((r) => {
      if (r.ok) setFavs(r.data.annotations || [])
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

      <DailyReviewCard onPending={onPending} />

      <QuizCard />

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
          <div className="flex flex-col gap-2.5">
            {favs.slice(0, favsShown).map((a, i) => (
              <FavouriteCard
                key={a.id}
                a={a}
                variant={i + 1}
                open={openFav === a.id}
                onToggle={() => setOpenFav((id) => (id === a.id ? null : a.id))}
                onOpenBook={() => onOpenBook(a.book_id)}
              />
            ))}
          </div>
          {favsShown < favs.length && (
            <div className="mt-3 text-center">
              <GhostButton onClick={() => setFavsShown((n) => n + 10)}>
                Show more ({favs.length - favsShown})
              </GhostButton>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// FavouriteCard — a favourite on the Home list. Collapsed it shows the quote +
// source; tapping expands it in place (full quote, note, tags) with a button to
// open the book. Tapping again collapses.
function FavouriteCard({ a, variant, open, onToggle, onOpenBook }) {
  return (
    <HandCard variant={variant} colorBar={a.color} style={{ padding: '12px 15px' }}>
      <button type="button" className="block w-full text-left" style={{ background: 'none', border: 'none', padding: 0 }} onClick={onToggle}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 15.5,
            lineHeight: 1.5,
            ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
          }}
        >
          “{a.quote || a.note}”
        </p>
        <MonoLabel className="mt-1.5 block" style={{ fontSize: 10.5 }}>
          {[a.book_title, a.book_author].filter(Boolean).join(' · ')}
          {[a.chapter && `CH. ${a.chapter}`, a.location && `P. ${a.location}`].filter(Boolean).length > 0 &&
            ' · ' + [a.chapter && `CH. ${a.chapter}`, a.location && `P. ${a.location}`].filter(Boolean).join(' · ')}
        </MonoLabel>
      </button>
      {open && (
        <div className="mt-2.5 space-y-2">
          {a.note && <HandNote>{a.note}</HandNote>}
          {a.tags && a.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {a.tags.map((t) => <span key={t} className="tp-chip">{t}</span>)}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="tp-btn tp-btn-primary tactile" onClick={onOpenBook}>
              Open book →
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
