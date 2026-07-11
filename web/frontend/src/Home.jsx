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
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false) // the deck fetch itself errored

  useEffect(() => {
    json('GET', `/annotations/daily-review?offset=${tzOffsetMinutes()}`).then((r) => {
      // A failed fetch must NOT masquerade as "all caught up" — show an error
      // and leave the pending dot as the shell seeded it (don't clear it).
      if (!r.ok) return setFailed(true)
      setDeck(r.data.items || [])
      setTally({ got: r.data.got_today || 0, forgot: r.data.forgot_today || 0 })
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
    </HandCard>
  )
}

export default function Home({ user, stats, onOpenBook, onGoLibrary, onGoMovies, onCapture, onPending }) {
  const [favs, setFavs] = useState([])

  useEffect(() => {
    // Only the two most recent favourites are shown — cap the fetch so a large
    // favourites set doesn't ship in full on every Home visit.
    json('GET', '/annotations?favorite=1&limit=2').then((r) => {
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
              Recently favourited
            </h2>
            <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--line)' }} />
            {stats && <MonoLabel>♥ {stats.favorites}</MonoLabel>}
          </div>
          <div className="flex flex-col gap-2.5">
            {favs.map((a, i) => (
              <HandCard
                key={a.id}
                variant={i + 1}
                colorBar={a.color}
                className="cursor-pointer"
                style={{ padding: '12px 15px' }}
                onClick={() => onOpenBook(a.book_id)}
                role="button"
                tabIndex={0}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 15.5,
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  “{a.quote || a.note}”
                </p>
                <MonoLabel className="mt-1.5 block" style={{ fontSize: 10.5 }}>
                  {[a.book_title, a.book_author].filter(Boolean).join(' · ')}
                </MonoLabel>
              </HandCard>
            ))}
          </div>
        </section>
      )}
    </div>
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
