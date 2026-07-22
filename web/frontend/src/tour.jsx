import { useEffect, useMemo, useRef, useState } from 'react'
import { json } from './api.js'
import { GhostButton, MonoLabel, StickerButton, toast, useIsMobileScreen } from './ui.jsx'

// The guided feature tour (Settings → Onboarding). It auto-opens once per user
// on their first launch (App.jsx checks preferences.tour === ''), and can be
// replayed or resumed from the Settings Onboarding card. State lives in the
// per-user preferences: tour = done | skipped | postponed (+ tourStep, the
// 0-based resume point while postponed).
//
// The tour never asks for the user's files — the two SAMPLE_QUOTES below are
// the built-in demo content (both public domain), rendered inline on the
// Library and Catalogue steps so an empty library still shows what a captured
// quote looks like.

export const SAMPLE_QUOTES = {
  book: {
    quote:
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    meta: 'Chapter 1',
  },
  movie: {
    quote: "Here's looking at you, kid.",
    title: 'Casablanca',
    year: 1942,
    character: 'Rick Blaine',
    actor: 'Humphrey Bogart',
    meta: '01:15:00',
  },
}

// One entry per feature. `name` + `blurb` feed the Settings feature list
// (welcome/done have no name and are tour-only); `tab` navigates the Shell
// there when the step opens; `anchor` spotlights the first VISIBLE match
// (desktop and mobile render separate buttons for the same control); `admin`
// hides a step from non-admins (they can't act on it); `demo` renders a
// built-in sample quote under the copy.
const TOUR_STEPS = [
  {
    key: 'welcome',
    title: 'Welcome to tippani',
    tab: 'home',
    body: (
      <>
        Tippani is a home for the lines worth keeping — book highlights and film dialogues, with
        covers, tags, instant search and a daily memory quiz. This tour walks through every
        feature. <b>Next</b> moves on step by step, <b>skip tour</b> ends it, and{' '}
        <b>finish later</b> saves your place — a Resume button waits in Settings → Onboarding.
        Nothing in the tour needs your files: the examples are built in.
      </>
    ),
  },
  {
    key: 'add',
    name: 'Add & import',
    blurb: 'one ＋ pill adds books, films & shows, or bulk-imports highlights',
    title: 'One ＋ Add for everything',
    anchor: '[data-tour="add"]',
    body: (
      <>
        The ＋ pill is the single way in: add a <b>book</b> by title, author or ISBN (covers and
        metadata fetched for you), a <b>film or show</b> from TMDB/TheTVDB — or <b>bulk-import</b>{' '}
        highlights: Markdown &amp; Readest exports, Kindle Bookcision &amp; your Kindle notebook,
        Goodreads and Hardcover pages, IMDb quote pages. Re-imports are idempotent — syncing twice
        never duplicates. No file needed today; a built-in sample quote rides along on the next
        steps.
      </>
    ),
  },
  {
    key: 'library',
    name: 'Library — books & annotations',
    blurb: 'covers, series, highlight colours, tags, favourites; masonry/list/table + group-by',
    title: 'The Library',
    tab: 'library',
    demo: 'book',
    body: (
      <>
        Books live here with real covers and series &amp; reading order. Every annotation carries a
        highlight colour, tags, chapter/location and a favourite ♥. Browse as a packed masonry, a
        list or a sortable table; filter by anything and <b>group by series, author, decade or
        genre</b>. A book highlight looks like this:
      </>
    ),
  },
  {
    key: 'catalogue',
    name: 'Catalogue — films & dialogues',
    blurb: 'memorable lines with timestamp, character and auto-filled actor',
    title: 'The Catalogue',
    tab: 'movies',
    demo: 'movie',
    body: (
      <>
        Films &amp; shows keep their dialogues the same way — each line with a timestamp, the
        character, and the actor <b>auto-filled from the cast</b>. Same tags, favourites, views and
        group-bys as the Library. A dialogue looks like this:
      </>
    ),
  },
  {
    key: 'share',
    name: 'Share & export',
    blurb: 'share sheet (WhatsApp/Markdown/image cards) + Obsidian-friendly export',
    title: 'Share a line, export the lot',
    body: (
      <>
        Any quote shares in one tap: rich Markdown, WhatsApp, plain text or Reddit — or a{' '}
        <b>shareable image</b> rendered locally in your paper/film skin, with a live preview.
        Export any work, a filtered set, or the whole library as Obsidian-friendly Markdown that
        round-trips cleanly back through the importer.
      </>
    ),
  },
  {
    key: 'quiz',
    name: 'Daily Quiz & Practice',
    blurb: 'spaced repetition over your quotes — cards resurface as you start to forget',
    title: 'The daily ritual',
    tab: 'home',
    body: (
      <>
        Home deals a short multiple-choice quiz over your own quotes, scheduled on the forgetting
        curve — each card resurfaces right as you&rsquo;d forget it, and every quote wears a status
        dot (remembered · forgetting · probably forgotten). <b>Practice</b> is the unlimited,
        skippable twin that by default never moves the schedule. The capture tile saves a stray
        quote in seconds. Two to three minutes a day; the knobs live in Settings.
      </>
    ),
  },
  {
    key: 'search',
    name: 'Instant search',
    blurb: 'typo-tolerant full-text search across quotes, works, people and notes',
    title: 'Find any line again',
    anchor: '[data-tour="search"]',
    body: (
      <>
        Instant, <b>typo-tolerant</b> search across titles, authors, directors, genres, series,
        quotes, notes and dialogue — find a line by its text, its character or its actor. Group
        results like the Library, open a hit in place to share or edit, or select a set for a bulk
        tag/field edit. Your last search is remembered.
      </>
    ),
  },
  {
    key: 'tags',
    name: 'Tags & stickers',
    blurb: 'cross-cutting tags with styles; pin your own PNG/SVG stickers to quotes',
    title: 'Tags & stickers',
    tab: 'tags',
    body: (
      <>
        Tags cut across books and films alike, each with its own look. <b>Stickers</b> are your own
        transparent PNG/SVG images — manage them here, pin one to any quote as a seal the text
        flows around, and drag it wherever you like.
      </>
    ),
  },
  {
    key: 'metadata',
    name: 'Metadata console & People',
    blurb: 'coverage per field, bulk fixes, duplicate merges; people with portraits & links',
    title: 'Keep the shelves tidy',
    tab: 'metadata',
    body: (
      <>
        The console shows per-field coverage, filters by what&rsquo;s missing, bulk-corrects a
        selection and merges duplicates; <b>fetch missing covers &amp; metadata</b> runs in chunks
        behind a real progress bar. <b>People</b> get portraits and IMDb · TMDB · Wikipedia · Open
        Library links resolved automatically — tap any author or actor name anywhere.
      </>
    ),
  },
  {
    key: 'stats',
    name: 'Stats',
    blurb: 'capture calendar, memory health, and author/actor/director/tag breakdowns',
    title: 'Your library in numbers',
    tab: 'stats',
    body: (
      <>
        A GitHub-style calendar of your captures, memory health straight from the quiz, and
        breakdowns of the people and tags your library leans on.
      </>
    ),
  },
  {
    key: 'appearance',
    name: 'Appearance',
    blurb: 'paper or film, light/dark/system, four accents — per user',
    title: 'Make it yours',
    tab: 'settings',
    anchor: '[data-tour="appearance"]',
    body: (
      <>
        Paper or film, light or dark or match-the-OS, four accents, and your own cover sizes —
        every user keeps their own combination.
      </>
    ),
  },
  {
    key: 'keys',
    name: 'Metadata keys & Amazon cookie',
    blurb: 'TMDB/TheTVDB/Google Books keys and the optional Amazon cookie (admin)',
    title: 'Metadata keys & the Amazon cookie',
    tab: 'settings',
    anchor: '[data-tour="metadata-keys"]',
    admin: true,
    body: (
      <>
        Lookups run on keys saved in the highlighted card — you can paste them now (the tour
        waits) or press Next and add them later:
        <ul className="mt-2 space-y-1.5" style={{ paddingLeft: 16, listStyle: 'disc' }}>
          <li>
            <b>TMDB</b> (films &amp; shows) — usually active out of the box on the shared built-in
            key; for your own free v3 key: <b>themoviedb.org → Settings → API</b>.
          </li>
          <li>
            <b>TheTVDB</b> (optional, better show coverage) — <b>thetvdb.com → Dashboard → API
            keys</b>.
          </li>
          <li>
            <b>Google Books</b> (optional — only if you pass ~1,000 lookups/day) —{' '}
            <b>console.cloud.google.com → enable the Books API → create a key</b>.
          </li>
          <li>
            <b>Amazon cookie</b> (optional, advanced) — adds description + genres for Kindle/ASIN
            books. Sign in to Amazon, then DevTools (F12) → Network → any amazon request → copy the
            whole <b>cookie:</b> header, and set your marketplace domain. Fragile, against
            Amazon&rsquo;s terms, and stored write-only — the card has the full walkthrough.
          </li>
        </ul>
        <p className="mt-2">
          Books need no key at all — Google Books + Open Library lookups work without one, and
          manual entry always works.
        </p>
      </>
    ),
  },
  {
    key: 'backup',
    name: 'Backup, restore & updates',
    blurb: 'one-click dated archive, in-place or cross-server restore, on-demand updates (admin)',
    title: 'Sleep well',
    tab: 'settings',
    anchor: '[data-tour="backup"]',
    admin: true,
    body: (
      <>
        One click builds a dated archive of everything — database, images, users, settings — and
        downloads it; the newest stays on the server. Restore it in place, or upload a backup from
        another Tippani box to move house. Updates are checked <b>on demand only</b> in the card
        above; with the Docker socket mounted, applying one is a single click.
      </>
    ),
  },
  {
    key: 'account',
    name: 'Profile & users',
    blurb: 'photo, display name, password; per-user libraries; admin user management',
    title: 'Yours, and everyone else’s',
    anchor: '[data-tour="account"]',
    body: (
      <>
        Behind the avatar chip: your <b>Profile</b> — photo, display name, password. Every user
        gets a fully separate library. Admins also manage users there — add, remove, grant, revoke
        or hand over admin (the last admin is protected).
      </>
    ),
  },
  {
    key: 'done',
    title: 'That’s the tour',
    body: (
      <>
        You&rsquo;ve seen everything. Replay this tour anytime from <b>Settings → Onboarding</b> —
        the feature list there doubles as a cheat-sheet. Enjoy the margins.
      </>
    ),
  },
]

// tourSteps — the steps a given user actually sees (admin-only steps drop out
// for everyone else). tourFeatures — the named subset for the Settings list.
export const tourSteps = (isAdmin) => TOUR_STEPS.filter((s) => !s.admin || isAdmin)
export const tourFeatures = (isAdmin) => tourSteps(isAdmin).filter((s) => s.name)

// findVisible — the first match that actually renders (desktop and mobile
// top bars both mount the same controls; CSS hides one set).
function findVisible(sel) {
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect()
    if (r.width > 4 && r.height > 4) return el
  }
  return null
}

// DemoQuote — the built-in sample rendered as a quote callout, so the Library
// and Catalogue steps demonstrate a captured quote without touching (or
// needing) the user's data.
function DemoQuote({ kind }) {
  const q = SAMPLE_QUOTES[kind]
  return (
    <figure className="tour-demo">
      <blockquote style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.5 }}>
        “{q.quote}”
      </blockquote>
      <figcaption
        className="mt-2"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.06em', color: 'var(--faint)' }}
      >
        {kind === 'book' ? (
          <>— {q.author}, <i>{q.title}</i> · {q.meta}</>
        ) : (
          <>— {q.character} ({q.actor}), <i>{q.title}</i> ({q.year}) · {q.meta}</>
        )}
      </figcaption>
    </figure>
  )
}

// FeatureTour — the overlay itself. A rAF loop tracks the current step's
// anchor (retrying while the target screen mounts, following it through
// scroll/resize/layout shifts); the spotlight is a ring whose giant box-shadow
// dims everything else while staying pointer-events: none, so the highlighted
// UI stays fully usable (the keys step invites pasting keys mid-tour).
export function FeatureTour({ user, startStep = 0, onNavigate, onPreferences, onClose }) {
  const steps = useMemo(() => tourSteps(user.is_admin), [user.is_admin])
  const [i, setI] = useState(() => Math.min(Math.max(0, startStep), steps.length - 1))
  const step = steps[i]
  const mobile = useIsMobileScreen()
  const [rect, setRect] = useState(null)
  const cardRef = useRef(null)

  // Entering a step: navigate its tab, then focus the card so screen readers
  // and the keyboard land on the new copy.
  useEffect(() => {
    if (step.tab) onNavigate(step.tab)
    cardRef.current?.focus({ preventScroll: true })
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // Anchor tracking: seek (the target screen may still be mounting), scroll it
  // into view once, then re-measure every frame — one getBoundingClientRect per
  // frame is negligible and follows fonts/images/masonry settling for free.
  useEffect(() => {
    setRect(null)
    if (!step.anchor) return
    let raf
    let el = null
    let stop = false
    const last = { t: -1, l: -1, w: -1, h: -1 }
    const loop = () => {
      if (stop) return
      if (!el || !el.isConnected) {
        el = findVisible(step.anchor)
        if (el) {
          try { el.scrollIntoView({ block: 'center' }) } catch { /* older browsers */ }
        }
      }
      if (el) {
        const r = el.getBoundingClientRect()
        if (
          Math.abs(r.top - last.t) > 0.5 || Math.abs(r.left - last.l) > 0.5 ||
          Math.abs(r.width - last.w) > 0.5 || Math.abs(r.height - last.h) > 0.5
        ) {
          last.t = r.top; last.l = r.left; last.w = r.width; last.h = r.height
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { stop = true; cancelAnimationFrame(raf) }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // Every exit persists a state, so the tour never auto-opens twice.
  function put(patch) {
    onPreferences?.(patch)
    json('PUT', '/auth/me/preferences', patch)
  }
  function finish() {
    put({ tour: 'done', tourStep: 0 })
    onClose()
    toast('tour complete — replay it anytime from Settings → Onboarding')
  }
  function skip() {
    put({ tour: 'skipped', tourStep: 0 })
    onClose()
    toast('tour skipped — start it anytime from Settings → Onboarding')
  }
  function later() {
    put({ tour: 'postponed', tourStep: i })
    onClose()
    toast('place saved — resume from Settings → Onboarding')
  }
  const next = () => (i >= steps.length - 1 ? finish() : setI(i + 1))
  const back = () => i > 0 && setI(i - 1)

  // Escape = finish later (the gentlest exit: nothing lost, resume in Settings).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') later() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop placement: under the anchor, else above it, else beside/centered;
  // anchorless steps center. Mobile placement is pure CSS (a bottom sheet).
  const style = {}
  if (!mobile) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const W = Math.min(400, vw - 24)
    const EST = 340 // estimated card height for the flip decision; overflow scrolls
    if (rect) {
      style.left = Math.max(12, Math.min(rect.left, vw - W - 12))
      if (rect.top + rect.height + 14 + EST < vh) {
        style.top = rect.top + rect.height + 14
      } else if (rect.top - EST - 14 > 0) {
        style.bottom = vh - rect.top + 14
      } else {
        style.top = '50%'
        style.transform = 'translateY(-50%)'
        style.left = Math.max(12, Math.min(rect.left + rect.width + 18, vw - W - 12))
      }
    } else {
      style.left = '50%'
      style.top = '50%'
      style.transform = 'translate(-50%, -50%)'
    }
  }

  return (
    <>
      {rect ? (
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : (
        !step.anchor && <div className="tour-scrim" aria-hidden="true" />
      )}
      <section
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-label={step.title}
        className={'tour-card hand-card p-5' + (mobile ? ' mobile' : '')}
        style={style}
      >
        <div className="flex items-baseline justify-between gap-3">
          <MonoLabel>{i + 1} of {steps.length}</MonoLabel>
          <button type="button" className="tp-link" onClick={later}>finish later</button>
        </div>
        <h2 className="mt-1.5" style={{ fontFamily: 'var(--font-ui)', fontSize: 16.5, fontWeight: 600 }}>
          {step.title}
        </h2>
        <div className="mt-2" style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--soft)' }}>
          {step.body}
        </div>
        {step.demo && <DemoQuote kind={step.demo} />}
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="tp-link" onClick={skip}>skip tour</button>
          <span className="flex-1" />
          {i > 0 && <GhostButton onClick={back}>Back</GhostButton>}
          <StickerButton onClick={next}>{i >= steps.length - 1 ? 'Finish' : 'Next'}</StickerButton>
        </div>
      </section>
    </>
  )
}
