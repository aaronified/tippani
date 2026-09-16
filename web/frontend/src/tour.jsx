import { useEffect, useMemo, useRef, useState } from 'react'
import { json } from './api.js'
import { visibleSections } from './routes.js'
import { t, tNodes } from './i18n.js'
import { ariaLabelText, FieldIconButton, IconBack, InfoDot, MonoLabel, StickerButton, toast, useIsMobileScreen, useEscape } from './ui.jsx'

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
// ({...s} when a step is rendered) at render time. A getter is what makes the copy resolve
// then rather than now, and makes it follow a language change afterwards.
//
// A step with no `name` is tour-only: welcome and done deliberately have no name
// getter at all, because nothing lists them.
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
    // NO `tab`, BECAUSE THE BOX IS IN THE SHELL and is on every screen already — but
    // the screen it leads to is the one whose help should offer this.
    screen: 'search',
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
    // TAGS IS A SECTION OF THE METADATA CONSOLE NOW, so this step navigates there and
    // joins that screen's own walk. Left as `tab: 'tags'` it would still have worked —
    // /tags redirects — but the per-screen walk is keyed on what `helpScreen` answers,
    // which for that section is 'metadata', and the step would have belonged to a
    // screen no "?" can name.
    tab: 'metadata',
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
    // NO `screen: 'profile'`, AND THE REASON IS WORTH THE LINES because it looked
    // like an oversight and was tried.
    //
    // Profile is a DIALOG over a screen, not a screen. Its overlay takes a history
    // marker (`useBackToClose`) and gives it back on unmount with `history.back()`
    // — and that pop is asynchronous, so it arrives AFTER a tour opened in the same
    // press has pushed its own marker, and closes it. The walk button drew, the
    // press landed, and the tour vanished on the way in.
    //
    // Deferring the open would be racing one scheduler against another. Not closing
    // the panel is worse: this step spotlights the avatar chip in the shell's own
    // bar, which the panel's scrim is sitting on top of — a caption pointing at
    // something the reader cannot see.
    //
    // So the step stays where it works: in the welcome tour, anchored to a control
    // that is on every screen. Profile's "?" keeps its glossary, which is what a
    // dialog's help should be.
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
    key: 'boards',
    tab: 'quotes',
    get name() { return t('tour.step.boards.name') },
    get blurb() { return t('tour.step.boards.blurb') },
    get title() { return t('tour.step.boards.title') },
    get body() {
      return tNodes('tour.step.boards.prose', {
        em1: <b key="em1">{t('tour.step.boards.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.boards.more') },
  },
  {
    key: 'anthologies',
    tab: 'anthologies',
    get name() { return t('tour.step.anthologies.name') },
    get blurb() { return t('tour.step.anthologies.blurb') },
    get title() { return t('tour.step.anthologies.title') },
    get body() {
      return tNodes('tour.step.anthologies.prose', {
        em1: <b key="em1">{t('tour.step.anthologies.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.anthologies.more') },
  },
  {
    key: 'filters',
    tab: 'search',
    get name() { return t('tour.step.filters.name') },
    get blurb() { return t('tour.step.filters.blurb') },
    get title() { return t('tour.step.filters.title') },
    get body() {
      return tNodes('tour.step.filters.prose', {
        em1: <b key="em1">{t('tour.step.filters.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.filters.more') },
  },
  {
    key: 'bin',
    tab: 'bin',
    get name() { return t('tour.step.bin.name') },
    get blurb() { return t('tour.step.bin.blurb') },
    get title() { return t('tour.step.bin.title') },
    get body() {
      return tNodes('tour.step.bin.prose', {
        em1: <b key="em1">{t('tour.step.bin.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.bin.more') },
  },
  {
    key: 'checks',
    tab: 'checks',
    get name() { return t('tour.step.checks.name') },
    get blurb() { return t('tour.step.checks.blurb') },
    get title() { return t('tour.step.checks.title') },
    get body() {
      return tNodes('tour.step.checks.prose', {
        em1: <b key="em1">{t('tour.step.checks.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.checks.more') },
  },
  {
    key: 'cleanup',
    tab: 'cleanup',
    get name() { return t('tour.step.cleanup.name') },
    get blurb() { return t('tour.step.cleanup.blurb') },
    get title() { return t('tour.step.cleanup.title') },
    get body() {
      return tNodes('tour.step.cleanup.prose', {
        em1: <b key="em1">{t('tour.step.cleanup.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.cleanup.more') },
  },
  {
    key: 'staging',
    tab: 'staging',
    get name() { return t('tour.step.staging.name') },
    get blurb() { return t('tour.step.staging.blurb') },
    get title() { return t('tour.step.staging.title') },
    get body() {
      return tNodes('tour.step.staging.prose', {
        em1: <b key="em1">{t('tour.step.staging.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.staging.more') },
  },
  // THE TWO SCREENS THAT ARE NOT TABS. `helpScreen` answers 'book-detail' and
  // 'movie-detail' for a work you have open, so that is what their walks are keyed
  // to — and `fullTour: false` keeps them out of the welcome sequence, which has
  // nowhere to navigate a reader who has no book open. Library and Catalogue already
  // carry that ground in the sequence.
  {
    key: 'book',
    screen: 'book-detail',
    fullTour: false,
    get name() { return t('tour.step.book.name') },
    get blurb() { return t('tour.step.book.blurb') },
    get title() { return t('tour.step.book.title') },
    get body() {
      return tNodes('tour.step.book.prose', {
        em1: <b key="em1">{t('tour.step.book.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.book.more') },
  },
  {
    key: 'film',
    screen: 'movie-detail',
    fullTour: false,
    get name() { return t('tour.step.film.name') },
    get blurb() { return t('tour.step.film.blurb') },
    get title() { return t('tour.step.film.title') },
    get body() {
      return tNodes('tour.step.film.prose', {
        em1: <b key="em1">{t('tour.step.film.em1.label')}</b>,
      })
    },
    get more() { return t('tour.step.film.more') },
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

// tourSteps — the steps a given user actually sees (admin-only steps drop out for
// everyone else, and so do the screens they have switched off).
//
// `tourFeatures` WAS HERE AND IS GONE WITH ITS ONLY CALLER. It carried each named
// step's INDEX into this list so the Settings picker could start the tour at a
// chosen feature, and the index had to be taken before the name filter rather than
// after it — `welcome` and `done` have no name, so the nth feature was never the
// nth step. That trap cost a paragraph to explain and a test to hold, and both were
// in service of a picker the owner has since removed ("no need for a global
// onboarding settings"). Help starts a tour by SCREEN now, not by index, so there
// is no index to get wrong.
//
// `sections` FILTERS ON THE SAME RULE AS THE NAV. A tour step whose `tab` names a
// section the reader has switched off spotlights a nav tab that is not rendered —
// findVisible returns nothing and the reader gets a caption pointing at empty
// space. FeatureTour derives `sections` from the same user.preferences bag the nav
// does rather than being handed it, so there is no prop to get out of step.
//
// `fullTour: false` IS HOW A STEP OPTS OUT OF THIS WALK WITHOUT LEAVING THE LIST.
// The whole-app tour NAVIGATES, and it navigates by `tab`; a step about a book's own
// page names no tab it could send anybody to, and the shelf it would land on already
// has a step of its own. So those two live here for the per-screen walk and are not
// in the sequence. It is a flag rather than a derived rule because the derived rule
// wanted an exception immediately: `account` also names no tab, and belongs in the
// welcome tour, because the control it spotlights is in the shell's own bar and is
// therefore already on whatever screen the reader is standing on.
export const tourSteps = (isAdmin, sections) =>
  TOUR_STEPS.filter((s) => s.fullTour !== false && (!s.admin || isAdmin) && (!s.tab || sections?.[s.tab] !== false))

// tourStepsForTab — the walk through ONE screen, which is what Help offers.
//
// The owner: "the help section shall have the onboarding journey for each screen
// separately. a button in the help screen that will go you through the features in
// that screen." The steps already carry the screen they belong to — `tab` is what
// navigates the shell when a step opens — so a per-screen tour is a filter over the
// list that exists rather than a second list to keep in step with it. A second list
// is how the whole-app tour and the per-screen one would come to disagree about
// what a screen's features are.
//
// IT RETURNS [] FOR A SCREEN WITH NO STEPS, and the caller draws no button rather
// than an empty tour: a tour that opens and says nothing is worse than an absent
// control, because the reader presses it twice before deciding it is broken. That
// used to be seven screens — Quotes, Search, Anthologies, the Bin, Checks, Cleanup
// and the import queue — and it is none of them now.
//
// `screen` OVERRIDES `tab`, AND MOST STEPS HAVE NO `screen` AT ALL. The two say
// different things and the difference only shows where a screen is not a tab: `tab`
// is where the whole-app tour NAVIGATES, `screen` is whose help offers this step. A
// book's own page, a film's own page and the Profile panel are all screens with a
// "?" of their own and no tab to their name, so `helpScreen` is what they answer to
// and `screen` is how a step says so.
//
// IT IS NOT FILTERED BY `sections`, which `tourSteps` still does for the tab steps
// it wraps. A reader can only ask for the walk through a screen they are already
// standing on.
export const tourStepsForTab = (isAdmin, sections, tab) =>
  TOUR_STEPS.filter((s) => (!s.admin || isAdmin) && (s.screen || s.tab) === tab)

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
      <blockquote style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-15)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {kind === 'book' ? `“${q.quote}”` : q.quote}
      </blockquote>
      <figcaption
        className="mt-2"
        style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)', letterSpacing: '.06em', color: 'var(--faint)' }}
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
export function FeatureTour({ user, startStep = 0, onlyTab = null, onNavigate, onPreferences, onClose }) {
  const sections = useMemo(() => visibleSections(user.preferences), [user.preferences])
  // `onlyTab` IS WHAT MAKES THIS THE HELP TOUR RATHER THAN THE FIRST-RUN ONE. Same
  // component, same steps, same spotlight — one screen's worth. A second component
  // would be two tours to keep true about what a feature is.
  const steps = useMemo(
    () => (onlyTab ? tourStepsForTab(user.is_admin, sections, onlyTab) : tourSteps(user.is_admin, sections)),
    [user.is_admin, sections, onlyTab],
  )
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
  // A SCREEN'S OWN WALK DOES NOT DECIDE WHETHER THE FIRST-RUN TOUR HAS HAPPENED.
  // Reaching the end of Help's three Settings steps is not "I have seen the app",
  // and postponing one is not a resume point for the whole thing — `tourStep` is an
  // index into the UNFILTERED list, so writing one from here would resume the
  // first-run tour at whatever position this screen's third step happened to hold.
  // So in per-screen mode these two simply close. `skip` still writes, because it
  // means the same thing wherever it is pressed.
  function finish() {
    if (!onlyTab) put({ tour: 'done', tourStep: 0 })
    onClose()
    if (!onlyTab) toast(t('tour.toast.done'))
  }
  function skip() {
    put({ tour: 'skipped', tourStep: 0 })
    onClose()
    toast(t('tour.toast.skipped'))
  }
  function later() {
    if (!onlyTab) put({ tour: 'postponed', tourStep: i })
    onClose()
    if (!onlyTab) toast(t('tour.toast.postponed'))
  }
  // THE WAY BACK, from wherever they are. The owner: "if he has already skipped, on
  // any one of them they should be able to manually enable them as well." The empty
  // string is the never-seen state App auto-opens on, so this is not a fourth value
  // to teach anything about — it is the tour put back where it started.
  function unskip() {
    put({ tour: '', tourStep: 0 })
    toast(t('tour.toast.reenabled'))
  }
  const next = () => (i >= steps.length - 1 ? finish() : setI(i + 1))
  const back = () => i > 0 && setI(i - 1)

  // Escape = finish later (the gentlest exit: nothing lost, resume in Settings).
  // ONE OWNER FOR ESCAPE — see useEscape in ui.jsx.
  useEscape(true, later)

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
        aria-label={ariaLabelText(step.title)}
        className={'tour-card hand-card p-5' + (mobile ? ' mobile' : '')}
        style={style}
      >
        <div className="flex items-baseline justify-between gap-3">
          <MonoLabel>{t('tour.progress.label', { done: i + 1, total: steps.length })}</MonoLabel>
          <button type="button" className="tp-link" onClick={later}>{t('tour.later.label')}</button>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <h2 style={{ fontFamily: 'var(--font-ui)', fontStyle: 'var(--font-ui-style)', fontVariantCaps: 'var(--font-ui-caps)', textTransform: 'var(--font-ui-case)', fontVariantNumeric: 'var(--font-ui-figures)', fontSize: 'var(--type-ui-17)', fontWeight: 600 }}>
            {step.title}
          </h2>
          {step.more && <InfoDot title={step.title} text={step.more} />}
        </div>
        <div className="mt-2" style={{ fontSize: 'var(--type-ui-13)', lineHeight: 1.55, color: 'var(--soft)' }}>
          {step.body}
        </div>
        {step.demo && <DemoQuote kind={step.demo} />}
        <div className="mt-4 flex items-center gap-2">
          {/* SKIP ALL IS ON EVERY STEP, whichever tour this is — the owner's "on any
              of the onboarding screens the user can skip all". And where they
              already have, the same slot is how they put it back rather than a
              setting they would have to go and find. One control, two states,
              because the reader's question in both is "do I want these or not". */}
          {user.preferences?.tour === 'skipped' ? (
            <button type="button" className="tp-link" onClick={unskip}>{t('tour.reenable.label')}</button>
          ) : (
            <button type="button" className="tp-link" onClick={skip}>{t('tour.skip.label')}</button>
          )}
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
