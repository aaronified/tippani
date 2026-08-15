import { useEffect, useMemo, useRef, useState } from 'react'
import { json } from './api.js'
import { FieldIconButton, IconBack, InfoDot, MonoLabel, StickerButton, toast, useIsMobileScreen } from './ui.jsx'

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
//
// `body` is the sentence or two a step is actually about; `more` is the detail
// that used to be crammed into it, now behind an InfoDot next to the step title.
// A guided tour is prose by nature and cannot become a wall of dots — but on a
// phone six of these steps were a scrolling paragraph, and the paragraph was the
// part people skipped. What stands is what a first-time reader needs in order to
// press Next; everything else is one tap away and still there.
const TOUR_STEPS = [
  {
    key: 'welcome',
    title: 'Welcome to tippani',
    tab: 'home',
    body: (
      <>
        Tippani is a home for the lines worth keeping — book highlights and film dialogue, with
        covers, tags, instant search and a daily memory quiz. This tour walks through every feature.
      </>
    ),
    more:
      'Next moves on step by step, “skip tour” ends it, and “finish later” saves your place — a Resume button waits in Settings → Onboarding. ' +
      'Nothing here needs your files: every example is built in. ' +
      'The top bar also carries a “?” that lists what every control on whichever screen you are looking at does — this tour is the once-over, that is the reference.',
  },
  {
    key: 'add',
    name: 'Add & import',
    blurb: 'one ＋ pill adds books, films & shows, captures quotes, or bulk-imports highlights',
    title: 'One ＋ Add for everything',
    anchor: '[data-tour="add"]',
    body: (
      <>
        The ＋ pill is the single way in, and it knows where you are: a <b>book</b> on Library, a{' '}
        <b>film or show</b> on the Catalogue, a <b>quote</b> against whichever work you have open.
        Bulk <b>import</b> is a tab of the same surface.
      </>
    ),
    more:
      'Books are looked up by title, author or ISBN and films on TMDB/TheTVDB, with covers and details fetched for you. ' +
      'Import reads Markdown and Readest exports, Kindle Bookcision and your Kindle notebook, Goodreads and Hardcover pages, and IMDb quote pages. ' +
      'An import lands in Pending import first and stays there until you okay it — fix chapters and locations in bulk, move quotes to the right work, then approve or discard. ' +
      'A count on the ＋ pill says how much is waiting, and re-importing the same file never duplicates anything. ' +
      'The drawer’s Add is the context-free twin — it opens with nothing pre-filled, wherever you started from.',
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
        Books live here with their covers, and every highlight you have kept from them. A book
        highlight looks like this:
      </>
    ),
    more:
      'Each annotation carries a highlight colour, tags, a chapter and location, and a favourite ♥. ' +
      'Browse as a packed masonry, a plain list or a sortable table; filter by genre, shelf state, favourites, tags or notes; and group by series, author, decade or genre. ' +
      'Series keep their reading order.',
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
        Films and shows keep their dialogue the same way — each line with its timestamp and
        character. A dialogue looks like this:
      </>
    ),
    more:
      'The actor is auto-filled from the title’s cast, so you only type the character. ' +
      'Shows carry a season and episode too. Everything else matches the Library: the same tags, favourites, views and group-bys.',
  },
  {
    key: 'share',
    name: 'Share & export',
    blurb: 'share sheet (WhatsApp/Markdown/image cards) + Obsidian-friendly export',
    title: 'Share a line, export the lot',
    body: (
      <>
        Any quote shares in one tap — as text, or as an <b>image card</b> drawn in your own skin.
      </>
    ),
    more:
      'Share formats: rich Markdown, WhatsApp, plain text or Reddit, plus a shareable image rendered locally (nothing is uploaded) with a live preview. ' +
      'Export works at any scale — one work, a filtered set, or the whole library — as Obsidian-friendly Markdown that round-trips cleanly back through the importer.',
  },
  {
    key: 'quiz',
    name: 'Daily Quiz & Practice',
    blurb: 'spaced repetition over your quotes — cards resurface as you start to forget',
    title: 'The daily ritual',
    tab: 'home',
    body: (
      <>
        Home deals a short quiz over your own quotes, scheduled so each card comes back right as
        you&rsquo;d start to forget it. Two or three minutes a day.
      </>
    ),
    more:
      'Every quote wears a status dot — remembered, forgetting, or probably forgotten — and answering honestly is what moves it. ' +
      'Practice is the unlimited, skippable twin: it keeps its own score and by default never touches the schedule. ' +
      'How many cards, whether covers show, and how much a look lengthens a half-life all live in Settings.',
  },
  {
    key: 'search',
    name: 'Instant search',
    blurb: 'typo-tolerant full-text search across quotes, works, people and notes',
    title: 'Find any line again',
    anchor: '[data-tour="search"]',
    body: (
      <>
        Instant, <b>typo-tolerant</b> search over everything you have kept, with results sectioned
        by what matched. Started from Library or the Catalogue it arrives scoped to that side;
        the drawer’s Search clears the scope.
      </>
    ),
    more:
      'It searches titles, authors, directors, genres, series, quotes, notes, tags and dialogue, and the sections mirror that: books, films, people, annotations, dialogues, notes, tags, genres. ' +
      'A decade (“1990s”) or a day (“2026-07-14”) is a valid search and finds what you captured then. ' +
      'Group results like the Library, open a hit in place to share or edit, or tick a set for a bulk tag or field edit. Your last search is remembered.',
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
        images, pinned to a quote as a seal.
      </>
    ),
    more:
      'A tag draws as a sticker, banner, flyout, tape or reel, in a colour you choose; renaming one updates every quote carrying it. ' +
      'Stickers are transparent PNG or SVG files you upload. The quote’s text flows around a pinned sticker, and you can drag it wherever you like on the card.',
  },
  {
    key: 'metadata',
    name: 'Metadata console & People',
    blurb: 'coverage per field, bulk fixes, duplicate merges; people with portraits & links',
    title: 'Keep the shelves tidy',
    tab: 'metadata',
    body: (
      <>
        The console shows what is missing across the library and fixes it in bulk. <b>People</b>{' '}
        get portraits and reference links — tap any author or actor name, anywhere.
      </>
    ),
    more:
      'Per-field coverage tiles double as filters: tap “no cover” to list exactly those books. ' +
      'From there you can bulk-correct a selection, merge duplicate titles, remap speaker labels onto a cast, and re-verify pinned works against the live sources before anything is written. ' +
      'Fetching missing covers and metadata runs in chunks behind a real progress bar. People resolve to IMDb, TMDB, TheTVDB, Wikipedia and Open Library.',
  },
  {
    key: 'stats',
    name: 'Stats',
    blurb: 'capture calendar, memory health, and author/actor/director/tag breakdowns',
    title: 'Your library in numbers',
    tab: 'stats',
    body: (
      <>
        A calendar of your captures, memory health from the quiz, and the people and tags your
        library leans on.
      </>
    ),
    more:
      'Everything on this screen is a doorway rather than a read-out: a calendar dot opens that day’s additions in Search, and any book, author, actor, director or tag clicks through the same way.',
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
        Lookups run on keys saved in the highlighted card. Each field there edits and saves on its
        own, and each carries its own info dot with where to get that key. Paste them now — the
        tour waits — or press Next and add them later.
      </>
    ),
    more:
      'TMDB (films & shows) is usually active out of the box on a shared built-in key; your own free v3 key comes from themoviedb.org → Settings → API. ' +
      'TheTVDB is optional and usually better for long-running shows: thetvdb.com → Dashboard → API keys. ' +
      'Google Books is optional and only matters past roughly 1,000 lookups a day. ' +
      'The Amazon cookie is optional and advanced — it only adds description and genres for Kindle/ASIN books, and covers already work without it. ' +
      'Books need no key at all: Google Books and Open Library work without one, and manual entry always works.',
  },
  {
    key: 'backup',
    name: 'Backup, restore & updates',
    blurb: 'one encrypted dated archive, in-place or cross-server restore, on-demand updates (admin)',
    title: 'Sleep well',
    tab: 'settings',
    anchor: '[data-tour="backup"]',
    admin: true,
    body: (
      <>
        One click builds a dated archive of everything and downloads it, <b>encrypted</b> with your
        own password. Restore it here, or restore a file taken off another Tippani to move house.
      </>
    ),
    more:
      'The archive holds the database, images, users and settings — including password hashes and API keys — which is why it is sealed before it leaves the server. ' +
      'Your account name and password are the key, so the same archive opens on any Tippani; set a separate passphrase instead if you would rather it were not tied to a login. ' +
      'Either way the key is never stored anywhere, so keep it: nobody can open the archive without it, including you. ' +
      'Updates are checked on demand only — never in the background — in the card above; with the Docker socket mounted, applying one is a single click.',
  },
  {
    key: 'account',
    name: 'Profile & users',
    blurb: 'photo, display name, password, account switching; per-user libraries; admin user management',
    title: 'Yours, and everyone else’s',
    anchor: '[data-tour="account"]',
    body: (
      <>
        The avatar chip opens your <b>Profile</b> — photo, display name, password, switching to
        another account, logging out. Every user gets a fully separate library.
      </>
    ),
    more:
      'Admins manage users from the same screen: add, remove, grant or revoke admin. The last remaining admin cannot be demoted, so an instance can never be locked out of itself. ' +
      'To hand over, grant another user admin first, then revoke your own. ' +
      'Switching accounts asks for that account’s password every time — being an admin does not let you in without one.',
  },
  {
    key: 'done',
    title: 'That’s the tour',
    body: (
      <>
        You&rsquo;ve seen everything. Replay this tour anytime from <b>Settings → Onboarding</b>,
        and use the <b>?</b> on any screen for what its controls do. Enjoy the margins.
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
      <blockquote style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {kind === 'book' ? `“${q.quote}”` : q.quote}
      </blockquote>
      <figcaption
        className="mt-2"
        style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 10.5, letterSpacing: '.06em', color: 'var(--faint)' }}
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
    toast('tour complete · replay in Settings')
  }
  function skip() {
    put({ tour: 'skipped', tourStep: 0 })
    onClose()
    toast('tour skipped · start in Settings')
  }
  function later() {
    put({ tour: 'postponed', tourStep: i })
    onClose()
    toast('saved · resume in Settings')
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
        <div className="mt-1.5 flex items-center gap-1.5">
          <h2 style={{ fontFamily: 'var(--font-ui)', fontStyle: 'var(--font-ui-style)', fontVariantCaps: 'var(--font-ui-caps)', textTransform: 'var(--font-ui-case)', fontVariantNumeric: 'var(--font-ui-figures)', fontSize: 16.5, fontWeight: 600 }}>
            {step.title}
          </h2>
          {step.more && <InfoDot title={step.title} text={step.more} />}
        </div>
        <div className="mt-2" style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--soft)' }}>
          {step.body}
        </div>
        {step.demo && <DemoQuote kind={step.demo} />}
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="tp-link" onClick={skip}>skip tour</button>
          <span className="flex-1" />
          {i > 0 && (
            <FieldIconButton
              icon={<IconBack />}
              ariaLabel="Previous step"
              onClick={back}
            />
          )}
          <StickerButton onClick={next}>{i >= steps.length - 1 ? 'Finish' : 'Next'}</StickerButton>
        </div>
      </section>
    </>
  )
}
