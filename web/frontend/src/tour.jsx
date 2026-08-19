import { useEffect, useMemo, useRef, useState } from 'react'
import { json } from './api.js'
import { visibleSections } from './routes.js'
import { t, tNodes } from './i18n.js'
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
    get quote() { return t('tour.demo.book.quote.prose') },
    get title() { return t('tour.demo.book.title') },
    get author() { return t('tour.demo.book.author.label') },
    get meta() { return t('tour.demo.book.meta.label') },
  },
  movie: {
    get quote() { return t('tour.demo.film.quote.prose') },
    get title() { return t('tour.demo.film.title') },
    year: 1942,
    get character() { return t('tour.demo.film.character.label') },
    get actor() { return t('tour.demo.film.actor.label') },
    get meta() { return t('tour.demo.film.meta.label') },
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
// EVERY FIELD BELOW IS A GETTER, and that is not decoration. This array is built
// at module scope — before a locale has been applied — and Settings spreads it
// ({...s} in tourFeatures) at render time. A getter is what makes the copy resolve
// then rather than now, and makes it follow a language change afterwards.
//
// A step with no `name` still has no name: tourFeatures filters on its presence,
// so welcome and done deliberately have no name getter at all.
const TOUR_STEPS = [
  {
    key: 'welcome',
    tab: 'home',
    get title() { return t('tour.step.welcome.title') },
    get body() { return t('tour.step.welcome.prose') },
    get more() { return t('tour.step.welcome.more') },
  },
  {
    key: 'add',
    anchor: '[data-tour="add"]',
    get name() { return t('tour.step.add.name') },
    get blurb() { return t('tour.step.add.blurb') },
    get title() { return t('tour.step.add.title') },
    get body() {
      return tNodes('tour.step.add.prose', {
        em1: <b key="em1">{t('tour.step.add.em1.label')}</b>,
        em2: <b key="em2">{t('tour.step.add.em2.label')}</b>,
        em3: <b key="em3">{t('tour.step.add.em3.label')}</b>,
        em4: <b key="em4">{t('tour.step.add.em4.label')}</b>,
      })
    },
    get more() { return t('tour.step.add.more') },
  },
  {
    key: 'library',
    tab: 'library',
    demo: 'book',
    get name() { return t('tour.step.library.name') },
    get blurb() { return t('tour.step.library.blurb') },
    get title() { return t('tour.step.library.title') },
    get body() { return t('tour.step.library.prose') },
    get more() { return t('tour.step.library.more') },
  },
  {
    key: 'catalogue',
    tab: 'movies',
    demo: 'movie',
    get name() { return t('tour.step.catalogue.name') },
    get blurb() { return t('tour.step.catalogue.blurb') },
    get title() { return t('tour.step.catalogue.title') },
    get body() { return t('tour.step.catalogue.prose') },
    get more() { return t('tour.step.catalogue.more') },
  },
  {
    key: 'share',
    get name() { return t('tour.step.share.name') },
    get blurb() { return t('tour.step.share.blurb') },
    get title() { return t('tour.step.share.title') },
    get body() {
      return tNodes('tour.step.share.prose', {
        em1: <b key="em1">{t('tour.step.share.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.share.more') },
  },
  {
    key: 'quiz',
    tab: 'home',
    get name() { return t('tour.step.quiz.name') },
    get blurb() { return t('tour.step.quiz.blurb') },
    get title() { return t('tour.step.quiz.title') },
    get body() { return t('tour.step.quiz.prose') },
    get more() { return t('tour.step.quiz.more') },
  },
  {
    key: 'search',
    anchor: '[data-tour="search"]',
    get name() { return t('tour.step.search.name') },
    get blurb() { return t('tour.step.search.blurb') },
    get title() { return t('tour.step.search.title') },
    get body() {
      return tNodes('tour.step.search.prose', {
        em1: <b key="em1">{t('tour.step.search.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.search.more') },
  },
  {
    key: 'tags',
    tab: 'tags',
    get name() { return t('tour.step.tags.name') },
    get blurb() { return t('tour.step.tags.blurb') },
    get title() { return t('tour.step.tags.title') },
    get body() {
      return tNodes('tour.step.tags.prose', {
        em1: <b key="em1">{t('tour.step.tags.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.tags.more') },
  },
  {
    key: 'metadata',
    tab: 'metadata',
    get name() { return t('tour.step.metadata.name') },
    get blurb() { return t('tour.step.metadata.blurb') },
    get title() { return t('tour.step.metadata.title') },
    get body() {
      return tNodes('tour.step.metadata.prose', {
        em1: <b key="em1">{t('tour.step.metadata.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.metadata.more') },
  },
  {
    key: 'stats',
    tab: 'stats',
    get name() { return t('tour.step.stats.name') },
    get blurb() { return t('tour.step.stats.blurb') },
    get title() { return t('tour.step.stats.title') },
    get body() { return t('tour.step.stats.prose') },
    get more() { return t('tour.step.stats.more') },
  },
  {
    key: 'appearance',
    tab: 'settings',
    anchor: '[data-tour="appearance"]',
    get name() { return t('tour.step.appearance.name') },
    get blurb() { return t('tour.step.appearance.blurb') },
    get title() { return t('tour.step.appearance.title') },
    get body() { return t('tour.step.appearance.prose') },
  },
  {
    key: 'keys',
    tab: 'settings',
    anchor: '[data-tour="metadata-keys"]',
    admin: true,
    get name() { return t('tour.step.keys.name') },
    get blurb() { return t('tour.step.keys.blurb') },
    get title() { return t('tour.step.keys.title') },
    get body() { return t('tour.step.keys.prose') },
    get more() { return t('tour.step.keys.more') },
  },
  {
    key: 'backup',
    tab: 'settings',
    anchor: '[data-tour="backup"]',
    admin: true,
    get name() { return t('tour.step.backup.name') },
    get blurb() { return t('tour.step.backup.blurb') },
    get title() { return t('tour.step.backup.title') },
    get body() {
      return tNodes('tour.step.backup.prose', {
        em1: <b key="em1">{t('tour.step.backup.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.backup.more') },
  },
  {
    key: 'account',
    anchor: '[data-tour="account"]',
    get name() { return t('tour.step.account.name') },
    get blurb() { return t('tour.step.account.blurb') },
    get title() { return t('tour.step.account.title') },
    get body() {
      return tNodes('tour.step.account.prose', {
        em1: <b key="em1">{t('tour.step.account.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.account.more') },
  },
  {
    key: 'done',
    get title() { return t('tour.step.done.title') },
    get body() {
      return tNodes('tour.step.done.prose', {
        em1: <b key="em1">{t('tour.step.done.em1.label')}</b>,
        em2: <b key="em2">{t('tour.step.done.em2.label')}</b>,
      })
    },
  },
]

// tourSteps — the steps a given user actually sees (admin-only steps drop out
// for everyone else). tourFeatures — the named subset, for the Settings section
// picker.
//
// EACH FEATURE CARRIES `at`, ITS INDEX IN tourSteps, and that index is taken
// before the filter rather than after it. The two lists are not the same length:
// `welcome` and `done` have no name, so the nth feature is not the nth step, and
// `admin` drops two more steps for a non-admin. Settings starts the tour by
// index (onStartTour(step) → FeatureTour startStep), so a picker built on the
// filtered list would open the wrong screen for every feature after the first —
// silently, because every index is still a valid step.
// `sections` FILTERS ON THE SAME RULE AS THE NAV, and it has to go through the
// same function the index is taken from. A tour step whose `tab` names a section
// the reader has switched off (Settings → Features) is two failures at once: the
// Settings picker offering it is a door into a hidden section, and the step itself
// spotlights a nav tab that is not rendered — findVisible returns nothing and the
// reader gets a caption pointing at empty space.
//
// Dropping steps shifts every index after them, which is exactly the trap the
// paragraph above describes for `admin`. It is safe here for one reason only:
// `at` is computed by tourFeatures over the SAME filtered list, so both callers
// pass both arguments and neither can see a different list from the other. Settings
// and FeatureTour derive `sections` from the same user.preferences bag rather than
// being handed it, so there is no prop to get out of step.
export const tourSteps = (isAdmin, sections) =>
  TOUR_STEPS.filter((s) => (!s.admin || isAdmin) && (!s.tab || sections?.[s.tab] !== false))
export const tourFeatures = (isAdmin, sections) =>
  tourSteps(isAdmin, sections).map((s, at) => ({ ...s, at })).filter((s) => s.name)

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
        {kind === 'book'
          ? tNodes('tour.demo.book.credit.label', {
              name: q.author,
              title: <i key="title">{q.title}</i>,
              meta: q.meta,
            })
          : tNodes('tour.demo.film.credit.label', {
              character: q.character,
              actor: q.actor,
              title: <i key="title">{q.title}</i>,
              year: q.year,
              meta: q.meta,
            })}
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
  const sections = useMemo(() => visibleSections(user.preferences), [user.preferences])
  const steps = useMemo(() => tourSteps(user.is_admin, sections), [user.is_admin, sections])
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
    toast(t('tour.toast.done'))
  }
  function skip() {
    put({ tour: 'skipped', tourStep: 0 })
    onClose()
    toast(t('tour.toast.skipped'))
  }
  function later() {
    put({ tour: 'postponed', tourStep: i })
    onClose()
    toast(t('tour.toast.postponed'))
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
          <MonoLabel>{t('tour.progress.label', { done: i + 1, total: steps.length })}</MonoLabel>
          <button type="button" className="tp-link" onClick={later}>{t('tour.later.label')}</button>
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
          <button type="button" className="tp-link" onClick={skip}>{t('tour.skip.label')}</button>
          <span className="flex-1" />
          {i > 0 && (
            <FieldIconButton
              icon={<IconBack />}
              ariaLabel={t('tour.back.aria')}
              onClick={back}
            />
          )}
          <StickerButton onClick={next}>{t(i >= steps.length - 1 ? 'tour.finish.label' : 'tour.next.label')}</StickerButton>
        </div>
      </section>
    </>
  )
}
