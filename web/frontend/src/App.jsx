import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react'
import Home from './Home.jsx'
import { applyLanguageMarks } from './languages.jsx'
import { applyFonts, registerUploads } from './fonts.js'
import { applyTypeScale } from './type.js'
import { applyReviewPrefs, tzOffsetMinutes } from './review.jsx'
import { dailyDeck, forgetDailyDeck } from './daily.js'
import { pickEpigraph } from './epigraphs.js'
import { installShortcuts, shortcutFor } from './keys.js'
import AddSurface from './AddSurface.jsx'
// ---- one screen, one chunk -------------------------------------------------
//
// The app compiled to a single 1.8MB file, and a browser cannot render anything
// until it has downloaded, parsed and COMPILED all of it — including the code for
// Settings, Stats and Metadata, which most sessions never open. Every tab screen is
// its own chunk now, fetched the first time it is shown.
//
// Home is deliberately NOT one of them: it is the screen the app opens on, so
// deferring it would not remove its cost, only move it behind a round trip. The
// tabs a reader actually uses are warmed on idle instead (see warmScreens below),
// which is the same trade made the other way round — the chunk is off the critical
// path, and it is already there by the time anybody clicks.
//
// There is no loading state, and that is a house rule rather than an omission: this
// app has never shown a spinner for a screen. The [data-screen-label] wrapper is
// outside the boundary, so the screen still announces itself immediately and only
// its body arrives a beat later.
const Library = lazy(() => import('./Library.jsx'))
const MetadataPage = lazy(() => import('./MetadataPage.jsx'))
const Movies = lazy(() => import('./Movies.jsx'))
const QuotesPage = lazy(() => import('./Quotes.jsx'))
import AnthologiesPage from './anthologies.jsx'
// The shell's own door to a work, provided to everything under it — see
// personOpen.jsx. A leaf module, so this is not a lazy chunk.
import { WorkDoor } from './personOpen.jsx'
const TagsPage = lazy(() => import('./TagsPage.jsx'))
const SearchPage = lazy(() => import('./SearchPage.jsx'))
const StagingPage = lazy(() => import('./StagingPage.jsx'))
const StatsPage = lazy(() => import('./StatsPage.jsx'))
const Settings = lazy(() => import('./Settings.jsx'))
const BinPage = lazy(() => import('./BinPage.jsx'))
const CleanupPage = lazy(() => import('./CleanupPage.jsx'))
const ChecksPage = lazy(() => import('./ChecksPage.jsx'))
import { applyColors, applyTheme } from './theme.js'
import { applyLocale, useLocale } from './i18n.js'
import { LanguagePicker } from './locale.jsx'
import {
  CONTENT_TABS,
  DRAWER_TABS,
  SECTIONS,
  UTILITY_TABS,
  visibleSections,
  visibleTabs,
  addSection,
  helpScreen,
  parsePath,
  screenTitleKey,
  searchScope,
  statePath,
} from './routes.js'
import { navigateBack, pushRoute, seedRoute } from './history.js'
import { DEMO, apiURL, coverImgURL, json, uploadWithProgress } from './api.js'
import {
  useEscape,
  CloseButton,
  EdgeRow,
  ErrorBoundary,
  ErrorText,
  Field,
  FilmButton,
  frameCode,
  GhostButton,
  IconBack,
  IconBin,
  IconBoards,
  IconChevron,
  IconChecks,
  IconMenu,
  IconClose,
  IconPlus,
  IconSearch,
  IconSearchGlobe,
  IconTools,
  Kbd,
  NavIcon,
  ShortcutSheet,
  Sprockets,
  StickerButton,
  ActionMenu,
  buildScreenActions,
  IconHelp,
  IconMore,
  toast,
  ToastHost,
  Toggle,
  Tooltip,
  useBackToClose,
  useBackToTop,
  useBodyScrollLock,
  useCrumbTitle,
  useScreenScroll,
  useEdgeScroll,
  useScreenBarState,
  useFrameBase,
  useHideOnScrollDown,
  useIsMobileScreen,
  usePersistedState,
  useResolvedDark,
} from './ui.jsx'
import { takeSearchSeed } from './facets.js'
import { Profile } from './Account.jsx'
import { PageHelp, ScreenHelpSheet } from './help.jsx'
import { t, tNodes } from './i18n.js'
import { PASSPHRASE_MAX, PASSWORD_MAX, PASSWORD_MIN, passwordProblem, sniffArchiveKey } from './secret.js'
import { FeatureTour } from './tour.jsx'

// DEMO: the read-only GitHub Pages build (VITE_DEMO=1). A fetch shim (demo/
// install.js) serves dummy data and blocks writes; here it just suppresses URL
// history sync (the static site lives under a /tippani/ subpath, so pushing
// "/library" would point off-site) and shows a banner.
export { DEMO } from './api.js'

// App is the auth gate: first-run onboarding, login, then the logged-in shell.
// The grain overlay (§5) sits above every screen, auth included.
// DRAWER_SHORTCUTS maps a drawer destination to the ACTION that reaches it, so
// the row can show its key. Kept here rather than in keys.js: that file knows
// which key runs which action and deliberately nothing about tabs.
const DRAWER_SHORTCUTS = {
  home: 'go-home',
  library: 'go-library',
  movies: 'go-catalogue',
  quotes: 'go-quotes',
  anthologies: 'go-anthologies',
  stats: 'go-stats',
  metadata: 'go-metadata',
  settings: 'go-settings',
  search: 'search',
}

export default function App() {
  // ONE SUBSCRIPTION FOR THE WHOLE TREE, which is what lets t() stay a plain
  // function at every other call site. App owns every screen, so a bump here
  // re-renders all of them; a migration that had to add a hook per component is a
  // migration nobody finishes. The two pickers subscribe as well, because their
  // own coverage numbers change without App having any other reason to move.
  useLocale()
  const [user, setUser] = useState(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  // The kept server-side backup archive, reported by /auth/status only while
  // onboarding is open — offered there as restore-instead-of-signup.
  const [onboardBackup, setOnboardBackup] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch(apiURL('/auth/me'))
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) return setUser(u)
        return fetch(apiURL('/auth/status'))
          .then((r) => r.json())
          .then((s) => {
            setNeedsOnboarding(s.needs_onboarding)
            setOnboardBackup(s.backup || null)
          })
      })
      .finally(() => setChecking(false))
  }, [])

  // Per-user appearance preferences apply on login and reset on logout (§4).
  //
  // applyColors is a SEPARATE call, not a field of applyTheme, and stays that
  // way: Settings' Appearance card re-sends every theme field on any change, so
  // a category riding in that object would be wiped by an unrelated accent
  // click. Same reasoning as the label-density preference.
  useEffect(() => {
    if (user) {
      applyTheme(user.preferences || {})
      applyColors(user.preferences || {})
      // The ACCOUNT is the authority on the language once there is a session, and
      // this is what carries the choice to the reader's other devices. applyLocale
      // writes the device-local mirror as a side effect, so the next boot's
      // pre-session screens open in the same language rather than in the default.
      applyLocale(user.preferences?.locale || '')
      // And the one review preference a themed round cannot be handed as a prop.
      // Same effect on purpose: it runs on login and on every Settings save, so
      // there is no second place that has to remember to keep it current.
      applyReviewPrefs(user.preferences || {})
      applyLanguageMarks(user.preferences || {})
      applyFonts(user.preferences || {})
      // The four size dials. Beside applyFonts rather than inside it, because a
      // size is not a face: the tokens it writes are consumed by every rule in the
      // stylesheet, and the faces are consumed by six.
      applyTypeScale(user.preferences || {})
      // The uploaded faces, if any. Loaded AFTER applyFonts and then applied
      // again: the stacks name the family either way, so the only thing the
      // second call changes is that the face now exists — and a font that never
      // loads leaves its token unresolvable, which falls back to the built-in.
      json('GET', '/fonts').then((r) => {
        if (!r.ok) return
        registerUploads(r.data?.fonts || []).then(() => applyFonts(user.preferences || {}))
      })
    }
  }, [user])

  // Keep the session user's preferences current when Settings saves them, so a
  // re-mounted Settings (and every other screen) reads the live value instead
  // of the stale login-time snapshot — the cause of the aesthetic toggle
  // "snapping back to paper" on navigation.
  const onPreferences = (prefs) =>
    setUser((u) => (u ? { ...u, preferences: { ...u.preferences, ...prefs } } : u))
  // Merge top-level user fields (e.g. avatar_path) so the chip updates live.
  const onUser = (patch) => setUser((u) => (u ? { ...u, ...patch } : u))

  let screen = null
  if (!checking) {
    if (user) {
      screen = (
        <Shell
          user={user}
          // THE DECK IS SOMEBODY'S, and daily.js keys its five-second window on the
          // timezone offset, which two people on one machine share. Signing out has
          // to drop it or the next reader in this tab is served the last one's
          // cards, pending count and streak — every query behind it is scoped by
          // user_id, and a cache in front of one has to be too.
          onLogout={() => { forgetDailyDeck(); setUser(null) }}
          onPreferences={onPreferences}
          onUser={onUser}
        />
      )
    }
    else if (needsOnboarding) screen = <Onboarding onDone={setUser} backup={onboardBackup} />
    else screen = <Login onLogin={setUser} />
  }
  return (
    <>
      {/* Scenic backdrop: paper = book-spines on shelves, film = strips in a
          studio (per aesthetic, in index.css). First in the tree + z-index -1 so
          it sits behind everything; the grain overlay stays on top. */}
      <div className="scene-bg" aria-hidden="true" />
      {DEMO && (
        <div className="demo-ribbon" role="note">
          {tNodes('shell.demo.ribbon.prose', {
            link: <a href="https://github.com/aaronified/tippani">{t('shell.demo.ribbon.link.label')}</a>,
          })}
          {' · '}
          {/* Relative, and deliberately not routed through the SPA, so it
              resolves under the Pages subpath without knowing what that subpath
              is. `../` because the demo now lives one level down at /demo/ —
              the site root is the landing page, which is the only page a search
              engine can read (this one is an empty div until JS runs). */}
          <a href="../roadmap.html">{t('shell.demo.roadmap.link.label')}</a>
        </div>
      )}
      {/* A render error in any screen unmounts to a visible fallback, never a
          blank app (there was no boundary before this branch). */}
      <ErrorBoundary>{screen}</ErrorBoundary>
      <ToastHost />
      <div className="grain-overlay" aria-hidden="true" />
    </>
  )
}

// refreshMe loads the full session user (including is_admin + preferences).
async function refreshMe() {
  const r = await fetch(apiURL('/auth/me'))
  return r.ok ? r.json() : null
}

// CredentialForm is the shared username/password form for login and
// onboarding; `film` picks the film-dark primary button (§6).
function CredentialForm({ header, action, cta, microcopy, film = false, onSuccess }) {
  // Signing up sets a password; logging in only proves one. The rules apply to
  // the former (see `missing` below).
  const signup = action !== '/auth/login'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await fetch(apiURL(action), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (r.ok) {
        const me = await refreshMe()
        if (me) {
          if (action === '/auth/login') toast(t('shell.login.toast.welcome', { name: me.username || t('shell.login.reader.fallback') }))
          return onSuccess(me)
        }
      }
      setError((await r.json().catch(() => ({}))).error || t('error.generic'))
    } finally {
      setBusy(false)
    }
  }

  const Primary = film ? FilmButton : StickerButton
  const missing = !username.trim()
    ? t('error.validate.username-required')
    : !password
      ? t('error.validate.password-required')
      : signup
        ? passwordProblem(password)
        : ''
  return (
    <form onSubmit={submit} className="hand-card w-full max-w-sm px-8 py-9">
      <div className="mb-7 text-center">{header}</div>
      <Field
        label={t('common.field.username.label')}
        placeholder={t('common.field.username.placeholder')}
        value={username}
        autoComplete="username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <Field
        label={t('common.field.password.label')}
        placeholder={signup ? t('shell.login.password.range.placeholder', { a: PASSWORD_MIN, b: PASSWORD_MAX }) : t('common.field.password.placeholder')}
        type="password"
        value={password}
        autoComplete={signup ? 'new-password' : 'current-password'}
        maxLength={PASSWORD_MAX}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      {/* Greyed with the reason on it until both fields can be accepted. Logging
          IN only needs something typed — an old password that predates the
          1.4.1 rules still has to be usable — but CREATING an account is held to
          them, because that is the password an archive will be encrypted with. */}
      <Primary className="mt-4 w-full" disabled={busy || !!missing} title={missing || undefined}>
        {cta}
      </Primary>
      {missing && password.length > 0 && <p className="microcopy mt-2 text-center">{t('common.form.reason.sentence', { reason: missing })}</p>}
      {microcopy && <p className="microcopy mt-5 text-center">{microcopy}</p>}
    </form>
  )
}

// Onboarding — paper-light centered card; first account becomes admin (§8.1).
// When the server holds a backup archive (backup ≠ null, from /auth/status), or
// the operator has one on disk, restoring it is offered instead — the
// moving-to-a-new-box path.
//
// Since 1.4.1 an archive is sealed, so restoring here needs its key even though a
// fresh box has nothing to lose: nothing-to-lose is about the overwrite, not about
// the reading. /auth/status therefore reports how the kept archive is keyed, and a
// chosen FILE is sniffed client-side (sniffArchiveKey, secret.js) for the same
// reason — there is no session here to infer an account from, so the operator has
// to be told whose password to type rather than guess.
//
// The two restore cards are one card with a source picker now, mirroring the
// Settings twin. Two nearly identical cards, each with its own paragraph, was the
// first thing a new operator saw.
// Exported for the mount smoke test only — see test/dom/screens-mount.test.jsx.
// These two are the screens with the widest blast radius in the app (a throw here
// locks everybody out, including the operator who would fix it) and they were the
// only two that no test could reach.
export function Onboarding({ onDone, backup }) {
  const [source, setSource] = useState(backup ? 'server' : 'file')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | uploading | restoring
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')
  // Credentials, asked for according to what the chosen archive wants. No account
  // field: since 1.4.2 the key is the password alone, and the name in the header
  // is a label saying whose password to reach for.
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const fileRef = useRef(null)
  useEffect(() => {
    applyTheme({ materialSet: 'manuscript', theme: 'light' })
  }, [])

  const target = source === 'file' ? (file ? { ...fileKey, name: file.name } : null) : backup
  const key = target?.key || (target ? 'none' : '')

  async function chooseFile(f) {
    setFile(f)
    setError('')
    setFileKey(f ? await sniffArchiveKey(f) : null)
  }

  const missing = !target
    ? t(source === 'file' ? 'error.validate.backup-file-required' : 'error.validate.backup-absent')
    : key === 'passphrase'
      ? passphrase ? '' : t('error.validate.archive-passphrase-required')
      : key === 'password'
        ? password ? '' : t('error.validate.archive-password-required')
        : '' // pre-1.4.1 plain archive: no key, and nothing here to lose

  const creds = () => (key === 'passphrase' ? { passphrase } : key === 'password' ? { password } : {})

  async function restore() {
    if (missing || phase !== 'idle') return
    setError('')
    setPhase(source === 'file' ? 'uploading' : 'restoring')
    setPct(0)
    try {
      let r
      if (source === 'file') {
        const form = new FormData()
        for (const [k, v] of Object.entries(creds())) form.append(k, v)
        form.append('file', file)
        r = await uploadWithProgress('/auth/restore/upload', form, (f) => {
          setPct(Math.round(f * 100))
          if (f >= 1) setPhase('restoring')
        })
      } else {
        r = await json('POST', '/auth/restore', creds())
      }
      if (!r.ok) {
        setPhase('idle')
        return setError((r.data && r.data.error) || t('error.restore.failed'))
      }
      toast(t('shell.restore.toast.done'))
      // Reload → /auth/status now reports onboarding closed → the login screen.
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      // A large restore can outlive the connection even when it succeeds
      // server-side; reload to re-check /auth/status rather than freeze here.
      setTimeout(() => window.location.reload(), 1200)
    }
  }

  const busyLabel = phase === 'uploading' ? t('shell.restore.uploading.busy', { percent: pct }) : phase === 'restoring' ? t('common.action.apply.busy') : ''

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10"
      data-screen-label="onboarding"
    >
      {/* THE LANGUAGE, FIRST, and before the account form rather than after it.
          This is the first screen anybody ever sees and there is no session yet to
          hold a preference, so if it is not asked here the operator's first act is
          creating an admin account in a language they may not read. The choice is
          device-local until the account exists; Settings then carries it onto the
          account (design §4). */}
      <div className="hand-card w-full max-w-sm px-8 py-6">
        <LanguagePicker titleKey="onboarding.language.title" width={230} />
      </div>
      <CredentialForm
        header={
          <>
            <img src="/mark.svg" alt="" width="46" height="46" className="mx-auto mb-3" />
            <h1 className="display-title text-2xl">{t('shell.onboarding.title')}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--soft)' }}>
              {t('shell.onboarding.subtitle.prose')}
            </p>
          </>
        }
        action="/auth/signup"
        cta={t('shell.onboarding.cta.label')}
        microcopy={t('shell.onboarding.microcopy.prose')}
        onSuccess={onDone}
      />
      {/* One restore, two sources — the kept archive or a file off another box. */}
      <div className="hand-card w-full max-w-sm px-8 py-6">
        <p className="mono-label mb-2 text-center">{t('shell.restore.title')}</p>
        <p className="mb-3 text-sm" style={{ color: 'var(--soft)' }}>
          {t('shell.restore.what.prose')}
        </p>
        <Toggle
          ariaLabel={t('shell.restore.source.aria')}
          value={source}
          onChange={(v) => { setSource(v); setError('') }}
          options={[['server', t('shell.restore.source.server.label')], ['file', t('shell.restore.source.file.label')]]}
        />
        {source === 'server' && (
          <p className="microcopy mt-2">
            {backup
              ? tNodes('shell.restore.server.dated.prose', {
                  date: <b>{new Date(backup.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</b>,
                })
              : t('shell.restore.server.empty.prose')}
          </p>
        )}
        {source === 'file' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".tpbk,.tar.gz,.tgz,application/gzip,application/octet-stream"
              aria-label={t('shell.restore.file.aria')}
              className="hidden"
              onChange={(e) => chooseFile(e.target.files?.[0] || null)}
            />
            <GhostButton className="mt-3 w-full" onClick={() => fileRef.current?.click()} disabled={phase !== 'idle'}>
              {file ? file.name : t('shell.restore.file.choose.label')}
            </GhostButton>
          </>
        )}
        {/* Exactly the field the chosen archive's own header asks for. */}
        {key === 'passphrase' && (
          <div className="mt-3">
            <Field
              label={t('common.field.passphrase.label')}
              placeholder={t('shell.restore.passphrase.placeholder')}
              type="password"
              value={passphrase}
              maxLength={PASSPHRASE_MAX}
              onChange={(e) => { setPassphrase(e.target.value); setError('') }}
            />
          </div>
        )}
        {key === 'password' && (
          <div className="mt-3">
            <Field
              label={target?.account ? t('shell.restore.password.named.label', { name: target.account }) : t('common.field.password.label')}
              placeholder={t('shell.restore.password.placeholder')}
              type="password"
              value={password}
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
            />
            {/* On a box that still holds the recovery key — a factory reset leaves
                it — any password of the era or since will do, because the key does
                not care which one sealed the archive. There is no session here to
                say whose password this is, so the field asks plainly. */}
            <p className="microcopy">
              {t(target?.recoverable ? 'shell.restore.password.recoverable.prose' : 'shell.restore.password.era.prose')}
            </p>
          </div>
        )}
        {key === 'none' && target && (
          <p className="microcopy mt-2">{t('shell.restore.unkeyed.prose')}</p>
        )}
        <GhostButton className="mt-3 w-full" onClick={restore} disabled={!!missing || phase !== 'idle'} title={missing || undefined}>
          {busyLabel || t('common.action.restore.label')}
        </GhostButton>
        {missing && <p className="microcopy mt-2 text-center">{t('common.form.reason.sentence', { reason: missing })}</p>}
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </main>
  )
}

// Login — film-dark strip with sprockets + frame code + Bengali subtitle (§8.2).
// Exported for the same reason as Onboarding, above.
export function Login({ onLogin }) {
  useEffect(() => {
    applyTheme({ materialSet: 'film-assembly', theme: 'dark' })
  }, [])
  // Picked once per mount rather than per render: re-rolling on every keystroke
  // would make the line flicker while somebody types their password.
  const [epigraph] = useState(pickEpigraph)
  const base = useFrameBase()
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
      data-screen-label="login"
    >
      <div className="film-strip w-full max-w-2xl">
        <Sprockets />
        <EdgeRow left="" code={frameCode(base)} />
        <div className="flex justify-center px-6 py-8">
          <CredentialForm
            film
            header={
              <>
                <img src="/mark-dark.svg" alt="" width="44" height="44" className="mx-auto mb-3" />
                <div className="wordmark" style={{ fontSize: 'var(--type-ui-22)' }}>{t('shell.wordmark.label')}</div>
                <p className="bengali text-sm" aria-hidden="true">টিপ্পনী</p>
                {/* A locked door, and this app's subject is the sentence somebody
                    kept — so it opens with one, and a different one each visit.
                    Unattributed and written for the app: a login screen has no
                    session to fetch a library with, and a bundled list of famous
                    quotes is a bundled list of attributions from memory. See
                    epigraphs.js. */}
                <p className="login-epigraph">{epigraph}</p>
              </>
            }
            action="/auth/login"
            cta={t('shell.login.cta.label')}
            microcopy={t('shell.login.microcopy.prose')}
            onSuccess={onLogin}
          />
        </div>
        <Sprockets />
      </div>
    </main>
  )
}

// Desktop nav (§7 declutter): four content tabs, a divider, then the utility
// tabs (always inline — the old navUtilities "⋯ More" fold is retired); the
// account chip (Profile · User management · Log out) and the "＋ Add" button
// are always separate. Import is no longer a permanent tab — it lives inside
// the "＋ Add" surface (§7 One "＋ Add"). Mobile uses the drawer.
// Search is not a labelled tab: it lives as an icon-only button beside the
// ＋ Add pill (both bars), mirroring the phone top bar. Still a ROUTE_TAB.
//
// The four nav lists themselves live in routes.js, beside the routing table
// they are the other half of, where a test can check they agree about which
// tabs exist without rendering the shell.



// AccountChip — the avatar in both top bars. It opens Profile, full stop.
//
// It used to open a dropdown: Profile · User management (admin) · Log out — and
// the drawer carried the same rows again. Every one of those is a section of
// Profile now (see Account.jsx), so the menu was a list of one screen's parts
// standing between the chip and that screen. One tap, and nothing to learn.
// navBadge — what a destination says about itself, in ONE place.
//
// The drawer has answered this since it was written: a total for the collections, and
// for the three that are not collections, the thing you would actually want to know —
// how many records have a gap, whether the quiz streak is alive, which version is
// running. The rail wanted the same answers, and the wrong way to give it them is a
// second table: two lists of counts is how a rail and a drawer come to disagree about
// how many books there are, on the same screen, at the same moment.
//
// It returns a STRING (or null), not markup, so each caller wears its own class — the
// drawer's badge and the rail's mono count are different sizes of the same fact.
//
// TWO NUMBERS, NOT ONE, on every destination that holds a container and the things
// inside it. "412" on Library answered "how many books" and left the question a
// reader actually has — how much is in there — to a screen they had to open. Now
// each row says both: books and their highlights, titles and their lines, boards
// and their quotes, anthologies and their entries, tags and their stickers.
//
// ONE SEPARATOR FOR ALL FIVE. A rail where some pairs are divided by a bar and
// others by a colon reads as two different kinds of fact, and they are the same
// kind of fact: a container, and its contents.
//
// The three utility rows keep their single answer, because they are not containers
// — a gap count, a streak, a version. Counting them the same way would mean
// inventing a second number for a row that has one thing to say.
// SPACED, and the space is not decoration. "22|13" reads as one token at the
// size a rail count is drawn — a part number, not two facts — and the eye has to
// stop and find the bar. A space either side lets the two numbers be two numbers.
const NAV_PAIR = ' | '
const pair = (a, b) => `${a}${NAV_PAIR}${b}`

// NavCount — the pair, drawn, with the CONTAINER in bold.
//
// The first number is the one the row is named for: Library is a shelf of books
// and the highlights are what is in them. Weighting them equally made the reader
// decide which was which every time, on a surface they are meant to read at a
// glance. So the lead carries the weight and the separator gives it up — the same
// three-value ladder the rest of the app uses for a label, a value and the mark
// between them.
//
// IT TAKES THE STRING navBadge ALREADY RETURNS rather than a pair of numbers.
// navBadge is the single place both navs read and its contract is a string; a
// second entry point returning parts would be a second thing to keep in step, for
// a difference that is presentational and belongs here.
function NavCount({ value, className }) {
  const at = value.indexOf(NAV_PAIR)
  if (at < 0) return <span className={className}>{value}</span>
  return (
    <span className={className}>
      <b className="nav-count-lead">{value.slice(0, at)}</b>
      <span className="nav-count-sep">{NAV_PAIR}</span>
      {value.slice(at + NAV_PAIR.length)}
    </span>
  )
}

// checksBadge — the Checks row's pair, in the same shape and by the same rule.
//
// IT IS NOT IN navBadge because Checks is not a tab: it has no row in
// CONTENT_TABS or UTILITY_TABS, it lives in the rail's foot beside the Bin, and
// its two numbers come from two fetches rather than from `stats`. Putting it in
// that switch would mean giving navBadge a second source and a key that is not a
// tab, to save one exported function.
export function checksBadge(pending, stray) {
  return pair(pending, stray)
}

export function navBadge(key, { stats, metaIssues, streak, version } = {}) {
  if (stats) {
    // stats.quotes counts the utterances table — the standalone quotes, which is
    // exactly what the Quotes row leads to; boards are the named groups they sit
    // in, which is what makes that row's left-hand number a "works" count in the
    // same sense Library's is.
    if (key === 'library') return pair(stats.books, stats.annotations)
    if (key === 'movies') return pair(stats.movies, stats.dialogues)
    if (key === 'quotes') return pair(stats.boards ?? 0, stats.quotes)
    if (key === 'tags') return pair(stats.tags, stats.stickers ?? 0)
    // STILL GUARDED ON null, and the guard has been load-bearing: /stats never
    // sent this key until now, so the row has worn no count at all. An older
    // server behind a newer bundle is the case it goes on covering.
    if (key === 'anthologies' && stats.anthologies != null) {
      return pair(stats.anthologies, stats.anthology_quotes ?? 0)
    }
  }
  if (key === 'metadata' && metaIssues != null) {
    return metaIssues > 0
      ? t('common.count.phrase', { n: metaIssues, noun: t('unit.issue', { count: metaIssues }) })
      : t('shell.drawer.metadata.clear.label')
  }
  if (key === 'stats' && streak > 0) return t('shell.drawer.stats.streak.label', { n: streak })
  if (key === 'settings') return t('shell.drawer.settings.version.label', { version: version || 'dev' })
  return null
}

// ScreenMenu — the ⋯ at the right of both top bars, holding everything the screen
// you are looking at can do.
//
// A MENU BAR, NOT AN OVERFLOW. It lists the whole set, including controls that are
// also drawn on the page — which view you are in, which sort is running, what the
// filters are. An overflow menu holds the leftovers and is therefore different on
// every screen and empty on several; a menu bar is one place a reader can always
// look, and its shape is the same on all twelve. The cost is deliberate
// duplication of the visible controls, and it buys the only thing that makes a
// menu worth opening: you can find something in it without knowing it is there.
//
// ONE CONTROL, BOTH VIEWPORTS. It used to be the phone dock's second seat on a
// work's detail and nowhere at all on a desktop. The dock seat is freed for a verb
// a thumb actually reaches for.
//
// THE ITEMS ARE BUILT WHEN IT OPENS, not when the screen renders — see
// useScreenBar's note. A menu bar's rows carry state, and a list handed over ahead
// of time is a list that ticks the view you left.
// `withHelp` is false where a ? already stands beside this menu. Help is on every
// screen and must be reachable from every screen — but the desktop bar draws it as
// its own pill two controls away, and listing it here as well is the same door
// twice in one corner of one bar. The phone bar has no room for a ? and keeps the
// row, which is why this is a prop the CALLER answers rather than a media query:
// each bar knows what else it is drawing.
function ScreenMenu({ screen, className, glyph = 22, withHelp = true }) {
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const ref = useRef(null)
  // Help is the shell's own row and it is on EVERY screen, appended after whatever
  // the screen published. It is the one action that is never the screen's to
  // offer — and a menu claiming to be complete that omitted it would be wrong on
  // the several screens where the screen itself publishes nothing at all.
  //
  // WHICH IS WHY `withHelp: false` IS A PREFERENCE AND NOT A VETO, and reading it
  // as a veto is what left this menu EMPTY on six screens. The desktop bar passes
  // false because it draws its own ? two controls away, which is right while the
  // screen has published something: listing the same door twice in one corner of
  // one bar is clutter. But Home, Quotes, Search, People, Stats and Settings
  // publish NOTHING on a desktop — their `useScreenBar` rows are `mobile &&`
  // gated, or they only set `sub` — so on half the app the ⋯ opened a floating
  // card with no rows in it at all. An empty menu is worse than the same door
  // twice: the reader pressed a control and got a blank.
  //
  // Found by pressing every control on every screen and asking what changed
  // (`scripts/screenshots/controls.mjs`), which is the only way this was ever
  // going to show up — every screen renders, the button opens, and the defect is
  // the ABSENCE of rows in a card that is one line tall.
  const published = open ? buildScreenActions() : []
  const items = open
    ? [
        ...published,
        ...(withHelp || !published.length
          ? [{ id: 'help', icon: <IconHelp size={24} />, label: t('shell.help.menu.label'), onClick: () => setHelpOpen(true) }]
          : []),
      ]
    : []
  return (
    <div className="relative" ref={ref}>
      {/* THE ? BUTTON'S OWN SKIN ON A DESKTOP, the phone bar's on a phone. One
          component, and each bar dresses it — the same arrangement navBadge uses.
          Caught by looking at a render: the first cut gave this the `.help-btn`
          RING, which is a hairline in --line, and the ? beside it has worn the Add
          button's fill since the top bar was built. A bare glyph between two solid
          controls reads as something bolted on afterwards, whatever it does. */}
      <Tooltip label={t('shell.screen.menu.tip')} side="bottom" className="shrink-0">
        <button
          type="button"
          className={`${className}${open ? ' is-open' : ''}`}
          aria-label={t('shell.screen.menu.aria')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <IconMore size={glyph} />
        </button>
      </Tooltip>
      <ActionMenu open={open} items={items} anchorRef={ref} onClose={() => setOpen(false)} returnFocusTo={ref} />
      <ScreenHelpSheet screen={screen} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

// Breadcrumb — where you are, in the bar the rail left empty.
//
// TWO LEVELS AND NO MORE. This app is never more than two deep: a screen, or a work
// inside one. A crumb trail that can only ever be `root / leaf` is a label with a
// door on it, and pretending otherwise would mean inventing hierarchy the routes do
// not have.
function Breadcrumb({ tab, detail, title, onRoot }) {
  const rootKey = detail?.type === 'movie' ? 'movies' : detail?.type === 'book' ? 'library' : null
  const rootLabel = rootKey ? t(`nav.tab.${rootKey === 'movies' ? 'movies' : 'library'}.label`) : t('shell.wordmark.label')
  const leaf = detail ? title : t(screenTitleKey(tab))
  if (!leaf) return null
  return (
    <nav className="topbar-crumbs" aria-label={t('shell.crumbs.aria')}>
      {/* AND THE ROOT CRUMB SAYS WHEN IT IS WHERE YOU ARE, for the same reason the
          rail's brand does. Standing on a screen with no work open, this crumb's
          destination IS this screen — `onRoot(null)` resolves to 'home' — so the
          press correctly changes nothing, and without the attribute nothing
          distinguishes that from a crumb that has stopped working. */}
      <button
        type="button"
        className="crumb"
        aria-current={!detail && (rootKey || 'home') === tab ? 'page' : undefined}
        onClick={() => onRoot(rootKey)}
      >
        {rootLabel}
      </button>
      <span className="crumb-sep" aria-hidden="true">/</span>
      <span className="crumb-here" title={leaf}>{leaf}</span>
    </nav>
  )
}

// TopBarSearch — a field rather than a key, with the scope worn as a pill you can drop.
//
// DROPPING THE PILL IS GLOBAL SEARCH. Same field, no pill, everything in range — so
// the × sits ON the scope rather than beside it as a second "search everywhere" verb.
// One control, and its presence or absence is the whole state. That replaces the globe
// this bar used to carry, and the standing `tippani:search:global` preference it read:
// a scope you can drop every time you want to is a preference you no longer need to set.
//
// Enter hands the query and the scope to SearchPage through the keys it already reads
// (`tippani:search:q`, `:scope`, `:chips`) rather than through a new channel — the
// search screen is still the thing that searches; this is a better door to it.
function TopBarSearch({ scope, scopeLabel, onSearch, onDropScope }) {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  const scoped = scope !== 'all'
  const submit = (e) => {
    e.preventDefault()
    onSearch(q, scoped ? scope : 'all')
  }
  return (
    <form className="topbar-search" onSubmit={submit} role="search">
      <span className="search-icon" aria-hidden="true"><IconSearch /></span>
      {scoped && (
        <button
          type="button"
          className="scope-pill"
          title={t('shell.search.scope.drop.tip')}
          onClick={onDropScope}
        >
          <span className="scope-key">{t('shell.search.scope.key')}</span>
          <span className="scope-val">{scopeLabel}</span>
          <span className="scope-x" aria-hidden="true"><IconClose size="1em" /></span>
        </button>
      )}
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t(scoped ? 'shell.search.hint.scoped' : 'shell.search.hint.all')}
        aria-label={t(scoped ? 'shell.search.aria.scoped' : 'shell.search.aria.all')}
      />
      <span className="kbd-hint" aria-hidden="true">/</span>
    </form>
  )
}

// NavRail — the design pack's frame: nine destinations down the left edge rather
// than across the top of every page.
//
// WHY A COLUMN AND NOT THE STRIP. A tab strip spends the top of every screen on
// navigation, and the top of a screen is where the thing you came to read starts.
// The rail takes the width nothing else was using and gives the page its top back.
//
// IT READS THE SAME TWO LISTS THE STRIP DID — CONTENT_TABS, a rule, UTILITY_TABS —
// through the same `visibleTabs` filter, so the rail and the drawer and the phone
// bar cannot disagree about what is switched on (Settings → Features). A fifth
// hand-maintained roster is exactly what routes.js warns against.
//
// NOT the app's Toggle, which the desktop strip used. A segmented control is the
// right shape for a row of peers and the wrong one for a column of destinations:
// a segment implies "one of these", and this column also holds a rule, the bin and
// an account. The rows are buttons and the rule is a span — see below.
export function NavRail({ tab, onChange, sections, user, onAccount, onBin, onChecks, brandDot = null, badges = {}, binCount = 0, checkCount = 0, strayCount = 0 }) {
  const dark = useResolvedDark()
  const railRef = useRef(null)
  // Nine destinations in a short window outrun the column, and the app's own rule
  // is that a scroller says so. `v` only: the rail never scrolls sideways.
  useEdgeScroll(railRef, { axis: 'v' })

  const row = ([key, label]) => (
    <button
      key={key}
      type="button"
      className="rail-row"
      // aria-current rather than aria-pressed: these are destinations, not toggles,
      // and "current page" is the thing a reader actually wants announced.
      aria-current={tab === key ? 'page' : undefined}
      title={t(label)}
      onClick={() => onChange(key)}
    >
      <span className="rail-icon"><NavIcon name={key} /></span>
      <span className="rail-label">{t(label)}</span>
      {badges[key] ? <NavCount className="rail-count" value={badges[key]} /> : null}
    </button>
  )

  return (
    <aside className="rail">
      <div className="rail-head">
        {/* Two files rather than one recoloured: a logo is not a glyph that takes
            currentColor, and tinting the light mark for dark mode is the kind of
            "close enough" a brand notices first. */}
        {/* THE BRAND IS A DOOR TO HOME, so on Home it says so — the same
            `aria-current` every row below it has carried since the rail was
            written, on the one control in it that goes somewhere and did not.
            Pressing it there changes nothing, correctly; without the attribute
            there was no way to tell that apart from a control that does nothing,
            which is what the control probe reported and what a screen reader had
            no way to say either. */}
        <button
          type="button"
          className="rail-brand"
          aria-current={tab === 'home' ? 'page' : undefined}
          onClick={() => onChange('home')}
          title={t('nav.bottom.home.aria')}
        >
          <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="34" height="34" />
          <span className="rail-wordmark">{t('shell.wordmark.label')}</span>
          {/* The pending-review dot rode the brand in the top bar. The brand moved, so
              it moves with it — an indicator left behind on a retired control is an
              indicator nobody sees. */}
          {brandDot}
        </button>
      </div>
      <nav ref={railRef} className="rail-nav" aria-label={t('shell.nav.primary.aria')}>
        {visibleTabs(CONTENT_TABS, sections).map(row)}
        <span className="rail-rule" aria-hidden="true" />
        {visibleTabs(UTILITY_TABS, sections).map(row)}
      </nav>
      <div className="rail-foot">
        {/* CHECKS — one door to the two lists that ask something of you: imports
            waiting to be approved, and quotes with something odd left in them. They
            were two tiles buried in Settings, which is where you go to change how the
            app behaves, not to find out it is waiting on you. Deliberately NOT called
            Review: that word is already the quiz and the practice deck. */}
        <button
          type="button"
          className="rail-row"
          title={t('checks.title')}
          aria-current={tab === 'checks' ? 'page' : undefined}
          onClick={onChecks}
        >
          <span className="rail-icon"><IconChecks /></span>
          <span className="rail-label">{t('checks.title')}</span>
          {/* BOTH HALVES, ALWAYS, once either has anything in it. A single number
              on a row that leads to two lists cannot say which list it came
              from, and "0" beside it is the useful half of the answer — the
              queue is clear, the marks are not. */}
          {checkCount > 0 || strayCount > 0 ? (
            <NavCount className="rail-count" value={checksBadge(checkCount, strayCount)} />
          ) : null}
        </button>
        <button
          type="button"
          className="rail-row"
          title={t('bin.title')}
          aria-current={tab === 'bin' ? 'page' : undefined}
          onClick={onBin}
        >
          <span className="rail-icon"><IconBin /></span>
          <span className="rail-label">{t('bin.title')}</span>
          {binCount > 0 ? <span className="rail-count">{binCount}</span> : null}
        </button>
        <button
          type="button"
          className="rail-row rail-acct"
          aria-label={t('shell.account.chip.aria', { name: user.username })}
          onClick={onAccount}
        >
          <span className="user-chip" aria-hidden="true"><UserAvatar user={user} /></span>
          {/* `user.display_name` was read here and `handleMe` has never served it —
              nothing in the schema or the API has that name, so the `||` fell
              through on every render since it was written. A read of a field
              nobody writes is a claim that the app has a display name apart from
              the username; it does not, and `handleUpdateMe` renames the username
              itself. */}
          <span className="rail-acct-name">{user.username}</span>
        </button>
      </div>
    </aside>
  )
}

function AccountChip({ user, onOpen }) {
  return (
    <Tooltip label={t('shell.account.chip.tip')} side="bottom" className="shrink-0">
      <button className="user-chip" data-tour="account" aria-label={t('shell.account.chip.aria', { name: user.username })} onClick={onOpen}>
        <UserAvatar user={user} />
      </button>
    </Tooltip>
  )
}

// AccountOverlay frames Profile: a centered pop-up on desktop, a full-screen page
// on phones. Escape / backdrop / back closes. It framed two views until 1.4.1
// (Profile and User management); the second is a section of the first now, so
// there is one title and one help entry.
function AccountOverlay({ user, onUser, onClose, logout }) {
  const mobile = useIsMobileScreen()
  // Draws its own overlay rather than going through FormModal or MobileSheet, so
  // it asks for the Back entry itself.
  useBackToClose(true, onClose)
  // ONE OWNER FOR ESCAPE — see useEscape in ui.jsx.
  useEscape(true, onClose)
  const body = <Profile user={user} onUser={onUser} logout={logout} />
  if (mobile) {
    return (
      <div className="account-page" role="dialog" aria-label={t('nav.tab.profile.label')}>
        <header className="account-page-bar">
          <Tooltip label={t('shell.account.back.tip')} side="bottom"><button type="button" className="mobile-topbar-btn" onClick={onClose} aria-label={t('common.action.back.label')}><IconBack /></button></Tooltip>
          <span className="account-page-title">{t('nav.tab.profile.label')}</span>
          {/* This page covers the shell bar, so it carries its own "?" — the one
              screen that still does. */}
          <span className="ml-auto"><PageHelp screen="profile" /></span>
        </header>
        <div className="account-page-body">{body}</div>
      </div>
    )
  }
  return (
    <div className="account-scrim" onMouseDown={onClose}>
      {/* hand-card as well as account-modal: this was the ONE dialog in the app
          that was not a card — a flat --card fill with a 14px radius and a plain
          line border, while every other window in the app is a hand-card with a
          material and an aesthetic. It sits directly under the avatar chip, so
          it is also the dialog most likely to be opened by accident and noticed.
          .account-modal keeps only what is genuinely its own: the width cap and
          the overflow clip. */}
      <div className="hand-card account-modal" role="dialog" aria-label={t('nav.tab.profile.label')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="account-modal-bar">
          <h2 className="account-modal-title">{t('nav.tab.profile.label')}</h2>
          <PageHelp screen="profile" />
          <CloseButton onClick={onClose} tooltip={t('shell.account.panel.close.tip')} />
        </div>
        <div className="account-modal-body">{body}</div>
      </div>
    </div>
  )
}

// ---- client-side routing (History API) ----
// Client routes own the root path space (the API lives under /api). A hard
// refresh on /books/42 is served index.html by the server, then Shell restores
// this state from the URL — and back/forward, including the mouse back button,
// just work.
// 'staging' (the pending-import queue) is routable but deliberately NOT a nav
// tab: Import stopped being a permanent destination in 0.4.3, so the queue is
// reached from the ＋ Add surface, its badge, and the Home nudge.
//
// The table itself, and the three shell controls derived from it, are in
// routes.js — pure functions of (tab, detail), testable without rendering the
// shell. Everything below is the part that needs React and the History API.

// Scroll memory: the last TWO list pages keep their scroll position, so
// opening a detail (or hopping tabs) and coming back lands where you left.
// Insertion order makes the Map an LRU; older pages expire to a fresh scroll.
const scrollMem = new Map() // list path → window.scrollY
function rememberScroll(key) {
  scrollMem.delete(key) // re-set moves the key to newest
  scrollMem.set(key, window.scrollY)
  while (scrollMem.size > 2) scrollMem.delete(scrollMem.keys().next().value)
}

// UserAvatar — the squircle chip content, shared by the top bars and drawer.
function UserAvatar({ user }) {
  return user.avatar_path
    ? <img src={coverImgURL(user.avatar_path)} alt="" />
    : (user.username || '?').trim().charAt(0).toLowerCase()
}

// Drawer — the hamburger nav (§7 redesign): primary nav on mobile, opened by
// the ☰ button or the avatar chip. Scrim tap / Escape / any navigation closes
// it. Home carries the pending-review dot; Library/Catalogue show live counts.
export function Drawer({ open, onClose, tab, selectTab, onSearch, onAdd, onAccount, user, stats, pending, pendingImport, streak, metaIssues, dark, onUser, sections, binCount = 0, checkCount = 0, strayCount = 0 }) {
  // Metadata "issues" = items the console flags (a book with no cover or no
  // ids; a film/show with no poster, cast or source) — the same predicate the
  // Metadata page uses. Fetched lazily the first time the drawer opens (it's a
  // whole-library read, wasted on desktop users who never open the drawer).
  // The nav sheet is the surface a phone reader is most likely to press Back
  // on, because it is the surface they opened to go somewhere else.
  useBackToClose(open, onClose)
  // ONE OWNER FOR ESCAPE — see useEscape in ui.jsx.
  useEscape(open, onClose)
  // The open drawer owns the viewport — the page behind it must not scroll.
  useBodyScrollLock(open)
  // Swipe-to-close: a deliberate leftward drag anywhere on the drawer pushes it
  // back out (it slides in from the left). One-shot intent detection — a
  // mostly-vertical first movement is a nav scroll and hands the gesture back
  // to the browser for the rest of the touch. Closing waits for pointerup so a
  // mid-gesture unmount can't ghost-click whatever lands under the finger.
  // Deliberately NO swipe-to-open: the left screen edge belongs to the OS back
  // gesture on phones.
  const swipe = useRef(null)
  const SWIPE_CLOSE = 48 // px of leftward travel that counts as a close
  const SWIPE_SLOP = 10 // dead zone before horizontal-vs-vertical intent is judged
  const onSwipeStart = (e) => { swipe.current = { x: e.clientX, y: e.clientY, intent: null, hit: false } }
  const onSwipeMove = (e) => {
    const s = swipe.current
    if (!s || s.intent === 'scroll') return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.intent === null) {
      if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return
      s.intent = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll'
    }
    if (s.intent === 'swipe' && dx <= -SWIPE_CLOSE) s.hit = true
  }
  const onSwipeEnd = () => {
    const hit = swipe.current?.hit
    swipe.current = null
    if (hit) onClose()
  }
  if (!open) return null

  const badge = (key) => {
    if (key === 'home') {
      return (
        <span className="drawer-badge" style={{ fontSize: 'var(--type-ui-9)' }}>
          {pending > 0 && <span className="review-dot" aria-hidden="true" />}
          quiz · practice
        </span>
      )
    }
    const label = navBadge(key, { stats, metaIssues, streak, version: user.version })
    return label ? <NavCount className="drawer-badge" value={label} /> : null
  }

  return (
    <>
      <button type="button" className="drawer-scrim" aria-label={t('shell.drawer.close.aria')} onClick={onClose} />
      <nav
        className="drawer"
        aria-label={t('shell.nav.primary.aria')}
        onPointerDown={onSwipeStart}
        onPointerMove={onSwipeMove}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => { swipe.current = null }}
      >
        <div className="drawer-header">
          <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="34" height="34" />
          <div className="min-w-0">
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 'var(--type-display-19)', letterSpacing: '-0.02em' }}>
              tippani
            </p>
            <p className="bengali" style={{ fontSize: 'var(--type-display-12)', color: 'var(--amber)' }} aria-hidden="true">
              {t('shell.drawer.tagline.label')}
            </p>
          </div>
        </div>
        <div className="drawer-nav">
          {/* §7 One "＋ Add": the single Add surface leads the drawer. Quote
              capture is the surface's Capture tab (reached from ＋ Add), not a
              separate drawer row — everything is covered by this one entry. */}
          <button
            type="button"
            className="drawer-item drawer-add"
            onClick={() => { onAdd(); onClose() }}
          >
            <IconPlus />
            {t('common.action.add.label')}
            <span className="drawer-badge">{t('shell.drawer.add.badge.label')}</span>
          </button>
          {pendingImport > 0 && (
            <button
              type="button"
              className="drawer-item"
              onClick={() => { selectTab('staging'); onClose() }}
            >
              <NavIcon name="import" />
              {t('shell.drawer.pending.label')}
              <span className="drawer-badge" style={{ color: 'var(--accent-ui)' }}>{pendingImport}</span>
            </button>
          )}
          {visibleTabs(DRAWER_TABS, sections).map((row, i) =>
            row === null ? (
              <div key={`div-${i}`} className="drawer-divider" aria-hidden="true" />
            ) : (
              <button
                key={row[0]}
                type="button"
                className={'drawer-item' + (tab === row[0] ? ' active' : '')}
                aria-current={tab === row[0] ? 'page' : undefined}
                // Search is the one row with more to it than a destination: it
                // drops any scope the top bar's context-aware Search left behind.
                onClick={() => { if (row[0] === 'search' && onSearch) onSearch(); else selectTab(row[0]); onClose() }}
              >
                <NavIcon name={row[0]} />
                {t(row[1])}
                {badge(row[0])}
                {/* The legend, on the row that does the same thing. This is the
                    drawer's whole job — it is the one surface that lists every
                    destination — so it is the natural place to learn that G-then-L
                    exists without having gone looking for a shortcut sheet. */}
                <Kbd keys={shortcutFor(DRAWER_SHORTCUTS[row[0]])} />
              </button>
            ),
          )}
          {/* CHECKS AND BIN, the two rows the rail has had since the rail
              landed and the drawer did not. They were still buried in Settings
              here, so the phone had no door to either — and a waiting import is
              exactly the thing you want to find without going looking for it.
              They sit below the divider with the utility screens because that is
              what they are: places the app is asking something of you. */}
          <div className="drawer-divider" aria-hidden="true" />
          <button
            type="button"
            className={'drawer-item' + (tab === 'checks' ? ' active' : '')}
            aria-current={tab === 'checks' ? 'page' : undefined}
            onClick={() => { selectTab('checks'); onClose() }}
          >
            <IconChecks />
            {t('checks.title')}
            {checkCount > 0 || strayCount > 0 ? (
              <NavCount className="drawer-badge" value={checksBadge(checkCount, strayCount)} />
            ) : null}
          </button>
          <button
            type="button"
            className={'drawer-item' + (tab === 'bin' ? ' active' : '')}
            aria-current={tab === 'bin' ? 'page' : undefined}
            onClick={() => { selectTab('bin'); onClose() }}
          >
            <IconBin />
            {t('bin.title')}
            {binCount > 0 ? <span className="drawer-badge">{binCount}</span> : null}
          </button>
        </div>
        {/* The footer chip IS the way to Profile, exactly as in both top bars —
            the same AccountChip component, so the tooltip, the label and the
            one-tap behaviour cannot drift from the bar's.

            It was a decorative aria-hidden span with a "Profile" row further up
            the drawer, while the comment beside it already claimed profile lived
            behind the avatar. That was true of the bar and false here, so the
            phone had two account entries and the one that looked like the
            account was the one that did nothing. */}
        {/* THE WHOLE FOOTER IS THE DOOR, not a chip beside a link. It opens
            Profile, which carries the log-out — so the separate Log out here was
            a second way to do the one thing behind it, spending a row of a
            drawer that needed the height for Checks and Bin. Tapping a name to
            reach your account is also the gesture every other row in this list
            already uses. */}
        <button
          type="button"
          className="drawer-footer"
          aria-label={t('shell.account.chip.aria', { name: user.username })}
          onClick={() => { onAccount(); onClose() }}
        >
          <span className="user-chip" aria-hidden="true"><UserAvatar user={user} /></span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block" style={{ fontSize: 'var(--type-ui-13)', fontWeight: 600 }}>{user.username}</span>
            <span className="mono-label block" style={{ fontSize: 'var(--type-ui-9)' }}>
              {t(user.is_admin ? 'shell.drawer.role.admin.label' : 'shell.drawer.role.user.label')}
            </span>
          </span>
          {/* THE ONE DESTINATION ON THIS DRAWER THAT DID NOT SPELL ITS KEY OUT.
              `g p` reaches the profile and has since the registry was written;
              every other row here wears its legend and this one did not, so the
              sheet listed a shortcut the surface whose whole job is listing
              destinations kept quiet about. */}
          <Kbd keys={shortcutFor('go-profile')} />
        </button>
      </nav>
    </>
  )
}

// The four screens the phone's floating bar carries. Ids are the real tab keys
// — note 'movies' is the legacy id for the Catalogue tab (statePath maps it to
// /catalogue). Icon-only: NavIcon's glyph is the affordance, the aria-label
// carries the name.
// SEARCH IS NOT HERE, AND THAT IS THE POINT. The mobile top bar has carried
// ＋ · Search · ? · chip since 1.4.1 — the same four the desktop bar carries —
// so a Search entry down here was the same control twice on one screen while
// the third content tab had nowhere to live. The bar now holds the four
// content screens and nothing else.
// MobileDock — the phone's bottom bar, and the only place its verbs live.
//
// IT REPLACED A NAV. Four destinations sat here while the other five were behind
// ☰, so navigation had two doors that disagreed about how many places the app
// has — and every verb a screen owned was crammed into the top edge, which is
// the corner of a phone a thumb reaches last. Now the drawer owns all nine
// destinations and this bar owns what you can do, which is also what frees the
// top bar to be a header.
//
// FIVE KEYS IS THE CEILING. Past five the thumb checks instead of aiming. Back
// and Search are the persistent pair and sit leftmost — they mean the same thing
// on every screen, so they never move — and ＋ is the middle one of five, which
// is arithmetic rather than a preference. That leaves two seats for the screen,
// and a screen wanting a third has a More key for it.
//
// BACK IS RENDERED EVEN WHERE IT IS DEAD. On a top-level screen there is nothing
// behind it, so it is disabled rather than absent: dropping it would slide Search
// into the first seat and break the one promise this row makes.
function MobileDock({ keys, hidden, canBack, onBack, onSearch, onAdd, addLabel, addBadge, searchLabel, searchIcon }) {
  const [focused, setFocused] = useState(false)
  // The bar stays focusable while slid away, so focusing a key must bring it
  // back rather than leave focus on something off-screen.
  const away = hidden && !focused
  const seats = (keys || []).slice(0, 2)
  // A seat the screen renders itself — see useScreenBar. MoreMenu is the reason:
  // it anchors to its own trigger, so the shell cannot draw the button for it.
  const key = (k) => k.node ? <Fragment key={k.id}>{k.node}</Fragment> : (
    <Tooltip key={k.id} label={k.label} side="top">
      <button
        type="button"
        className="mobile-dock-btn"
        aria-label={k.label}
        aria-pressed={k.on === undefined ? undefined : !!k.on}
        disabled={!!k.disabled}
        onClick={k.onClick}
      >
        {k.icon}
      </button>
    </Tooltip>
  )
  return (
    <nav
      className={'mobile-dock' + (away ? ' is-away' : '')}
      aria-label={t('shell.nav.dock.aria')}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {key({
        id: 'back',
        label: t('common.action.back.label'),
        icon: <IconBack />,
        disabled: !canBack,
        onClick: onBack,
      })}
      {key({ id: 'search', label: searchLabel, icon: searchIcon, onClick: onSearch })}
      <Tooltip label={addLabel} side="top">
        <button
          type="button"
          className="mobile-dock-btn is-accent"
          data-tour="add"
          aria-label={addLabel}
          onClick={onAdd}
        >
          <IconPlus />
          {addBadge}
        </button>
      </Tooltip>
      {/* NO RULE AFTER THE ＋ . It was drawn to separate the shell's three fixed
          keys from whatever the screen contributes, but the ＋ already separates
          them — it is the one accent seat in the row, and a hairline beside
          something that loud is a second divider doing the first one's job. The
          owner's call, and the row reads cleaner without it. */}
      {seats.map(key)}
    </nav>
  )
}

// HOME_TOOLS — the three screens ABOUT the library rather than in it, behind the
// dock's second key. Tags is deliberately not among them: a tag is a thing you
// file quotes under, so its page belongs with the boards conceptually and with
// the drawer practically — this key is the settings family, and stretching it to
// four rows would make it "the rest of the drawer" instead of a group.
const HOME_TOOLS = [
  ['settings', 'nav.tab.settings.label'],
  ['stats', 'nav.tab.stats.label'],
  ['metadata', 'nav.tab.metadata.label'],
]

// DockMenu — one dock seat that opens a list instead of going somewhere.
//
// IT DRAWS THE DOCK'S OWN BUTTON rather than reaching for MoreMenu, which renders
// an IconButton: a seat that is 4px shorter than the four beside it is the kind of
// difference nobody can name and everybody sees. ActionMenu underneath is the
// same menu every card and the screen ⋯ opens, so the rows, the arrow keys and
// the dismiss rules are not written twice.
function DockMenu({ icon, label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <div className="relative" ref={ref}>
      <Tooltip label={label} side="top">
        <button
          type="button"
          className="mobile-dock-btn"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {icon}
        </button>
      </Tooltip>
      <ActionMenu open={open} items={items} anchorRef={ref} onClose={() => setOpen(false)} returnFocusTo={ref} />
    </div>
  )
}

// BackToTop — the phone's way back up a long board.
//
// PHONE ONLY, and that is the pack's scoping rather than an oversight: a desk has
// a scrollbar to drag, a Home key, and a window that is usually showing a third
// of the page at once. A thumb has none of those, which is why the key is drawn
// where the thumb is.
//
// IT SITS ABOVE THE DOCK AND DROPS WHEN THE DOCK LEAVES — the pack's own reason:
// "so the corner never holds two things and never sits empty". Both positions are
// measured from the gesture inset, so the key clears a home bar on the hardware
// that has one.
//
// NOT `display: none` WHEN IT IS AWAY. Opacity and pointer-events, so the button
// keeps its place in the layout and its transition has something to animate
// between — and, more to the point, so nothing can tab into a key that is not
// there. A rest state that depended on the transition firing would be the rule
// this repo tests for; disable every animation and the key is still exactly where
// it is, visible or not, because its visibility is a boolean and not a cue.
function BackToTop({ show, dockHidden, onClick }) {
  return (
    <Tooltip label={t('shell.totop.aria')} side="top">
      <button
        type="button"
        className={'to-top' + (show ? ' is-on' : '')}
        aria-label={t('shell.totop.aria')}
        aria-hidden={show ? undefined : true}
        tabIndex={show ? 0 : -1}
        data-dock={dockHidden ? 'away' : 'here'}
        onClick={onClick}
      >
        <IconChevron open size={20} />
      </button>
    </Tooltip>
  )
}

// Shell is the logged-in frame (§7): on desktop a topbar with the (tappable)
// mark + wordmark, tab strip and user-initial chip; on a phone a slim top bar
// whose ☰ drawer owns primary nav — logo taps Home, ＋ captures a quote. A
// {type, id} detail state lets lists and search open detail views; tab +
// detail are mirrored to the URL via the History API.
// warmScreens fetches the chunks a reader is most likely to open next, once the
// page has gone quiet. Splitting alone would trade a slow start for a stutter on
// every first tab click; this puts the chunk on disk before the click happens, so
// the split costs nothing at either end. Idle rather than on mount, because the
// point is to use time the browser is not otherwise using — and best-effort,
// because a failed prefetch is not a failure: the real import will ask again.
const WARM = [
  () => import('./Library.jsx'),
  () => import('./Quotes.jsx'),
  () => import('./Movies.jsx'),
  () => import('./SearchPage.jsx'),
]
function warmScreens() {
  const run = () => {
    for (const load of WARM) load().catch(() => {})
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}

export function Shell({ user, onLogout, onPreferences, onUser }) {
  const initial = parsePath(typeof window !== 'undefined' ? window.location.pathname : '/')
  // /import isn't a tab any more — start on Home and open the Add surface there.
  // Neither /import nor /capture is a tab: both are the Add surface over Home.
  const initialTab = initial.tab === 'import' || initial.tab === 'capture' ? 'home' : initial.tab
  const [tab, setTab] = useState(initialTab)
  useEffect(warmScreens, [])
  const [detail, setDetail] = useState(initial.detail) // {type: 'book' | 'movie', id}
  // WHETHER THE SCREEN IN FRONT IS DOING ITS OWN SCROLLING. Published by the
  // screen (useScreenOwnsScroll), read here, and stamped on <html> so the answer
  // is a CSS state rather than a class this file has to thread into three
  // wrappers. The work detail is the first screen to say yes; see ui.jsx for why
  // it is opt-in rather than a stylesheet rule.
  const screenOwnsScroll = useScreenScroll()
  useEffect(() => {
    const root = document.documentElement
    if (screenOwnsScroll) root.setAttribute('data-scroll', 'screen')
    else root.removeAttribute('data-scroll')
    // Cleared on unmount as well as on change: the attribute outliving the shell
    // is a document that cannot scroll and nothing left to un-say it.
    return () => root.removeAttribute('data-scroll')
  }, [screenOwnsScroll])
  // Profile is one screen with everything in it now (see AccountOverlay), so
  // this is open/closed rather than which-of-two-views.
  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Whether the top bar's Search ignores where you are. A standing preference,
  // so it is persisted rather than per-visit: a reader who searches everything
  // does so every time, and having to re-declare it after each reload would
  // make the gesture worse than the behaviour it replaces. Toggled by
  // right-clicking the search button — see toggleGlobalSearch.
  const [globalSearch, setGlobalSearch] = usePersistedState('tippani:search:global', false)
  // The single "＋ Add" surface (§7 One "＋ Add"): book · film · quote · import.
  // 1.4.1 made it the ONLY one — the Library and Catalogue page headers had their
  // own ＋, and a book's own page had a separate "Add annotation" modal, so there
  // were three surfaces for one job. Those call sites open this, with `sec` and
  // `target` carrying the context they used to imply.
  const [addOpen, setAddOpen] = useState(false)
  // The legend for every binding at once, opened by `?`. Discovery is the help
  // sheet's Keyboard entry, which is in the pointer-only shell list — so it is
  // named on every screen a keyboard is plausible on, and on none where it is not.
  // (This comment used to claim a drawer row opened it too. There has never been
  // one, and the drawer is the phone's shell, which is now the one place the app
  // deliberately says nothing about keys.)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [addSec, setAddSec] = useState('book')
  const [addTarget, setAddTarget] = useState(null) // {type:'book'|'movie', id} | null
  // A DRAFT THE SURFACE OPENS ON, and only Duplicate ever sets one. Everything
  // else opens cold, deliberately — see the work picker's own note on why a
  // silently pre-filled form invites mis-filed quotes.
  const [addFields, setAddFields] = useState(null)
  const openAdd = (sec = 'book', target = null, fields = null) => {
    setAddSec(sec)
    setAddTarget(target)
    setAddFields(fields)
    setAddOpen(true)
  }
  // dataNonce ticks whenever the shell's Add surface writes anything — a work, a
  // quote. Every add form used to live INSIDE the screen that owned the list it
  // changed, so saving could just call that screen's load(); the one surface is a
  // sibling of all of them, and this is how the list that was added to learns to
  // refetch. Deliberately one counter rather than one per kind: a captured quote
  // moves a book's quote count and can retract its Wishlist tag, so the book list
  // wants to hear about it too.
  const [dataNonce, setDataNonce] = useState(0)
  const bumpData = () => setDataNonce((n) => n + 1)
  // pending = cards left in today's review deck; feeds the notification dot on
  // the brand mark and the drawer's Home row. Seeded once here, then kept
  // honest by the Home screen as answers land.
  const [pending, setPending] = useState(0)
  // pendingImport = quotes sitting in the import staging queue. A half-finished
  // import must not be forgettable, so the count badges the ＋ Add control and
  // surfaces on Home until the queue is cleared.
  const [pendingImport, setPendingImport] = useState(0)
  const refreshPendingImport = () => {
    json('GET', '/import/staged?counts=1').then((r) => { if (r.ok) setPendingImport(r.data.pending || 0) })
  }
  useEffect(() => {
    json('GET', '/metadata/library').then((r) => {
      if (!r.ok || !r.data) return
      const books = (r.data.books || []).filter((b) => !b.has_cover || !b.has_ids).length
      const movies = (r.data.movies || []).filter((m) => !m.has_poster || !m.has_cast || !m.has_source).length
      setMetaIssues(books + movies)
    })
    json('GET', '/trash').then((r) => { if (r.ok) setBinCount((r.data?.trash || []).length) })
    // STRAY MARKS, THE SECOND HALF OF THE CHECKS COUNT. ?counts=1 is the arm that
    // does the scan and builds none of the findings — see handleCleanup. Fetched
    // once on mount for the same reason metaIssues is: it is a nudge towards a
    // screen, not a live readout, and the screen recounts when you get there.
    json('GET', '/cleanup?counts=1').then((r) => { if (r.ok) setStrayCount(r.data?.counts?.open || 0) })
  }, [])
  const [streak, setStreak] = useState(0) // daily-quiz streak — drawer Stats subtext
  const [stats, setStats] = useState(null) // drawer counts + Home stat tiles
  // metaIssues — records with a gap in them, badged on the rail's Metadata row and
  // the drawer's. IT LIVED IN THE DRAWER, which could afford to fetch it only when
  // opened; the rail is on screen the whole time, so the fetch had to move up here.
  //
  // ONCE, AND NOT ON EVERY ROUTE CHANGE. /metadata/library returns the whole record
  // set, which is the most expensive thing this shell asks for — on an app that runs
  // itself at GOMEMLIMIT=64MiB beside other people's services, a badge is not worth
  // repeating it for. The number goes stale within a session and that is the right
  // trade: it is a nudge towards a screen, not a live readout.
  const [metaIssues, setMetaIssues] = useState(null)
  // strayCount — quotes with something odd still flagged in them, the right-hand
  // number on the rail's Checks row. Its left-hand number is pendingImport.
  const [strayCount, setStrayCount] = useState(0)
  // binCount — entries waiting in the bin, badged on the rail's Bin row. Cheap
  // enough to ask for once; /trash is a short list by construction, since anything
  // in it is on its way out.
  const [binCount, setBinCount] = useState(0)
  // Update-check result, shared so the mobile drawer's "update available" link
  // mirrors the Settings → Updates card. Populated on demand when an admin runs
  // the check (Tippani never contacts GitHub on its own), then cached here for
  // the rest of the session.
  const [update, setUpdate] = useState(null)
  const dark = useResolvedDark()

  // Guided feature tour (tour.jsx): null | {step}. Auto-opens once per user —
  // preferences.tour is "" until they finish, skip or postpone it — and can be
  // started/resumed from Settings → Onboarding. Not in the demo build (its
  // read-only shim can't persist the "seen" state, so it would nag every load).
  const [tourState, setTourState] = useState(null)
  // Floating phone bottom bar: a second, thumb-reachable route to the four main
  // screens. The mobile gate is only for the scroll listener — the bar's
  // visibility is CSS (display:none above the breakpoint), so rotating a tablet
  // never remounts it. Any shell overlay pins it visible.
  const mobile = useIsMobileScreen()
  // The way back up, on the one form factor with no other one. Reset per route
  // like the dock's own hide is, because a new screen starts at a new offset.
  const { show: showTop, toTop } = useBackToTop({ enabled: mobile })
  const navHidden = useHideOnScrollDown({
    enabled: mobile,
    forceShow: drawerOpen || addOpen || profileOpen || !!tourState,
    resetKey: tab,
  })
  useEffect(() => {
    if (DEMO || user.preferences?.tour) return
    const id = setTimeout(() => setTourState({ step: 0 }), 800)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStats = () => {
    json('GET', '/stats').then((r) => { if (r.ok) setStats(r.data) })
  }
  useEffect(() => {
    refreshStats()
    // The SAME request Home's quiz card makes, shared rather than repeated — see
    // daily.js. The shell wants two numbers off the deck and the card wants the
    // deck; computing it twice on every load is the one duplicate read there was.
    dailyDeck(tzOffsetMinutes()).then((r) => {
      if (r.ok) { setPending((r.data.items || []).length); setStreak(r.data.streak || 0) }
    })
    refreshPendingImport()
    // An old /import link lands here — open the Add surface on Import. /capture is
    // the icon shortcut's URL and does the same for the capture section.
    if (initial.tab === 'import') openAdd('import')
    if (initial.tab === 'capture') openAdd('quote')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // THE INSTALLED APP'S ICON BADGE: cards due plus imports waiting, set by the
  // client whenever either changes.
  //
  // NOTHING SCHEDULED, and that is the point of doing it this way. A real
  // notification needs something that wakes up on its own — a service worker, a push
  // subscription, a server that knows when your day starts — and every one of those
  // is a background job this app does not have and will not add. A badge set on load
  // carries most of the same value: you glance at the home screen, and it says
  // whether there is anything to come back for.
  //
  // Best-effort by construction: the API exists on installed PWAs on some platforms
  // and nowhere else, so the guard is the feature working where it can rather than a
  // capability check the reader ever sees. Zero CLEARS the badge rather than showing
  // a nought, which is what setAppBadge(0) means and why it is not simply skipped.
  useEffect(() => {
    const n = (pending || 0) + (pendingImport || 0)
    try {
      if (n > 0) navigator.setAppBadge?.(n)
      else navigator.clearAppBadge?.()
    } catch {
      /* not installed, or a platform without it — nothing to report */
    }
  }, [pending, pendingImport])

  // Mirror tab/detail ↔ URL. popstate (back/forward) restores state from the
  // path; landing on an unknown path rewrites the bar to the canonical one.
  // Current route for event handlers registered once (the popstate closure
  // below would otherwise record scroll against stale state).
  const routeRef = useRef({ tab, detail })
  useEffect(() => { routeRef.current = { tab, detail } })


  useEffect(() => {
    // The browser's native back/forward restoration can't work here (list
    // heights arrive async) — the scroll-memory effect below owns it instead.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    if (DEMO) return // no URL sync under the static subpath
    const onPop = () => {
      const cur = routeRef.current
      if (!cur.detail) rememberScroll(statePath(cur.tab, null))
      const s = parsePath(window.location.pathname)
      // /import via back/forward opens the Add surface over Home (no import tab).
      if (s.tab === 'import') { setTab('home'); setDetail(null); openAdd('import'); return }
      if (s.tab === 'capture') { setTab('home'); setDetail(null); openAdd('quote'); return }
      setTab(s.tab)
      setDetail(s.detail)
    }
    window.addEventListener('popstate', onPop)
    seedRoute(statePath(initialTab, initial.detail))
    return () => window.removeEventListener('popstate', onPop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore a remembered list scroll once the list is tall enough to hold it
  // (its content refetches async — retry across frames, ~0.7s cap). Everything
  // else — details, expired or never-seen lists — starts fresh at the top
  // instead of inheriting the previous screen's (clamped) position.
  useEffect(() => {
    // INSTANT, BOTH TIMES, and said out loud because the stylesheet now asks for
    // smooth scrolling everywhere else. Gliding to the top of a screen the reader
    // has just arrived at is an animation of a page they have not seen yet, and
    // gliding to a REMEMBERED position is worse: it scrolls the whole board past
    // them to land where they already were. Smooth is for a scroll the reader
    // asked for; neither of these is one.
    // A SCREEN THAT OWNS ITS SCROLL IS NOT THE WINDOW'S TO RESTORE. The work
    // detail locks the document at 100dvh and scrolls its own columns, so
    // scrollHeight - innerHeight is 0 forever: the retry loop below would spin its
    // full ~0.7s of frames on every arrival and then scroll a document that cannot
    // move. It has its own per-column memory (useColumnScroll), which is the only
    // thing that knows there are two positions to keep rather than one.
    if (screenOwnsScroll) return
    const y = detail ? null : scrollMem.get(statePath(tab, null))
    if (y == null) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    let tries = 0
    let stop = false
    const attempt = () => {
      if (stop) return
      if (document.documentElement.scrollHeight - window.innerHeight >= y || tries > 40) {
        window.scrollTo({ top: y, behavior: 'instant' })
        return
      }
      tries++
      requestAnimationFrame(attempt)
    }
    requestAnimationFrame(attempt)
    return () => { stop = true }
  }, [tab, detail, screenOwnsScroll])

  // go() updates state AND pushes a history entry so the URL + back/forward track.
  function go(nextTab, nextDetail) {
    if (!detail) rememberScroll(statePath(tab, null)) // leaving a list — keep its place
    setTab(nextTab)
    setDetail(nextDetail)
    if (DEMO) return
    pushRoute(statePath(nextTab, nextDetail))
  }

  // goBack is the in-app Back: the arrow on the phone's detail bar, the one on a
  // quote board, the Bin's, an anthology's. Every one of them used to call
  // go(tab, null), and go PUSHES — so pressing Back left the stack reading
  // shelf → book → shelf and the phone's Back walked into the book again. Why
  // that is one decision and where it lives: history.js.
  function goBack(fallbackTab) {
    // True means the press was handed to the browser, and the popstate handler
    // above is then what sets the tab and the detail — so the arrow and the
    // gesture are one code path rather than two that agree today.
    if (!DEMO && navigateBack(statePath(fallbackTab, null))) return
    if (!detail) rememberScroll(statePath(tab, null))
    setTab(fallbackTab)
    setDetail(null)
  }
  function selectTab(key) { go(key, null) }
  function openBook(id) { go('library', { type: 'book', id }) }
  function openMovie(id) { go('movies', { type: 'movie', id }) }
  // THE SAME TWO DOORS IN THE PANELS' OWN VOCABULARY. A person's screen and a
  // character's list the works they are on and call them `kind` + `work_id`;
  // nothing below the shell can navigate on its own. Provided once through
  // `WorkDoor` rather than passed to each screen — see personOpen.jsx for what
  // the per-screen shape cost.
  function openWork(kind, id) { return kind === 'book' ? openBook(id) : openMovie(id) }

  // searchFor seeds the search screen's persisted state before it mounts (it
  // reads localStorage once) and jumps there — used by Metadata drill-downs and
  // every clickable Stats entity / activity dot. Scope resets so hits aren't
  // hidden by a stale books/movies pick.
  function searchFor(q, scope = 'all') {
    try {
      localStorage.setItem('tippani:search:q', JSON.stringify(q))
      localStorage.setItem('tippani:search:scope', JSON.stringify(scope))
      // Chips are cleared for the same reason the scope is: this is a jump to a
      // NAMED query — an author from Metadata, a day from the Stats calendar —
      // and a leftover chip would silently answer a narrower question than the
      // link promised.
      localStorage.setItem('tippani:search:chips', JSON.stringify([]))
    } catch { /* private mode — search just opens empty */ }
    selectTab('search')
  }
  // searchScoped seeds the scope — and now the chips — SearchPage will read on
  // mount, then goes there. The query is left alone: the box remembers your
  // last one, and clearing it would make an ordinary navigation destructive.
  //
  // The CHIPS are replaced rather than merged, which is the opposite call to
  // the query and deliberately so. A chip says where you were searching from,
  // so carrying the Library's `shelf:reading` into a search started from the
  // Catalogue would narrow films by a shelf no film is on — a search that
  // matches nothing and reads as broken. Every seeded chip is removable, so
  // widening is one click.
  function searchScoped(scope, chips = []) {
    try {
      localStorage.setItem('tippani:search:scope', JSON.stringify(scope))
      localStorage.setItem('tippani:search:chips', JSON.stringify(chips))
    } catch { /* private mode — the box keeps whatever it had */ }
    selectTab('search')
  }
  // The top bar's Search lands scoped to whatever you were looking at (Library →
  // Books, Catalogue → Movies) AND filtered the way that screen was filtered,
  // because a search started from a list is nearly always a search of that list.
  // The drawer's Search clears both instead — see the Shell's drawer row, which
  // calls searchScoped('all') with no chips.
  //
  // Unless you have said otherwise. `globalSearch` is the standing preference
  // for the minority of readers whose every search is a search of everything,
  // and it makes the top-bar button behave like the drawer's: no scope, no
  // seeded chips, a globe in the lens.
  const openSearch = () =>
    globalSearch ? searchScoped('all') : searchScoped(searchScope(tab, detail), takeSearchSeed())

  // THE DISPATCHER. keys.js knows which key means which ACTION and nothing about
  // what an action does; this is the other half, and it is deliberately a plain
  // table rather than a chain of ifs — an action with no case here does nothing,
  // which is the right behaviour for a binding whose screen is not open.
  //
  // The review actions are NOT here: a grade only means something to the card in
  // front of you, so QuizRunner owns those and this dispatcher never sees them.
  useEffect(() => installShortcuts((id) => {
    switch (id) {
      case 'search': openSearch(); break
      case 'capture': openAdd('quote'); break
      case 'go-home': go('home'); break
      case 'go-library': go('library'); break
      case 'go-catalogue': go('movies'); break
      case 'go-quotes': go('quotes'); break
      case 'go-anthologies': go('anthologies'); break
      case 'go-stats': go('stats'); break
      case 'go-metadata': go('metadata'); break
      case 'go-settings': go('settings'); break
      // Profile is a panel rather than a tab — the account chip opens it in both
      // bars — so this opens the panel rather than navigating.
      case 'go-profile': setProfileOpen(true); break
      case 'help': setShortcutsOpen(true); break
      default: break
    }
  }), [tab, detail, globalSearch]) // eslint-disable-line react-hooks/exhaustive-deps
  // RIGHT-CLICK ONLY, WITH NO ON-SCREEN AFFORDANCE, and that cost is accepted
  // rather than overlooked: a visible switch for this would be a permanent
  // control in the busiest row of the app, answering a question most readers
  // never ask. It is documented where the app documents its other invisible
  // gestures — help.jsx and the UI glossary. The globe is the feedback: once it
  // is on, the button says so every time you look at it.
  const toggleGlobalSearch = () => {
    setGlobalSearch((g) => {
      toast(g ? 'searching where you are' : 'searching everything')
      return !g
    })
  }

  async function logout() {
    await fetch(apiURL('/auth/logout'), { method: 'POST' })
    onLogout()
  }

  const brandDot = pending > 0 && <span className="review-dot" aria-hidden="true" />
  // The ＋ Add pill carries the staging count, because that is where imports
  // start and where the queue is reached from.
  const importBadge = pendingImport > 0 && <span className="add-badge">{pendingImport}</span>
  // Which sections this reader has left switched on (Settings → Features),
  // resolved once per render beside the three route-derived controls. It is read
  // from the same preference bag every applier reads, so the strip, the drawer,
  // the phone bar, Home, the ＋, the scope chips and the shortcut legend all
  // answer one question with one answer.
  const sections = visibleSections(user.preferences)
  // The Go-to keys whose destination has no visible door. The KEY still works —
  // hiding is cosmetic and G-then-C is the URL typed — it just stops being
  // advertised in a legend beside a tab that is not on screen. This is the only
  // place that knows both halves: DRAWER_SHORTCUTS maps a tab to its action, and
  // keys.js deliberately knows nothing about tabs.
  const omitShortcuts = new Set(
    SECTIONS.filter((sec) => !sections[sec.tab]).map((sec) => DRAWER_SHORTCUTS[sec.tab]).filter(Boolean),
  )
  // The three context-aware shell controls, resolved once per render off the
  // route (see helpScreen / addSection / searchScope above the Shell).
  const help = helpScreen(tab, detail)
  const addKind = addSection(tab, detail)
  // A work you have open is the capture target the ＋ pre-fills. openAdd takes
  // the target rather than reading `detail` itself, so the drawer's Add — which
  // must default to nothing — can call the same function with no target.
  //
  // A WORK, AND ONLY A WORK. `detail` also names a board and an anthology now, and
  // neither of those ids is a work id — CaptureQuote reads any non-movie target as
  // a BOOK (see initialTarget), so handing it a board or an anthology would pre-fill
  // whichever book happens to share the number. A positive list rather than an
  // exclusion, so the next detail type cannot inherit the bug by default.
  const addFor = detail?.type === 'book' || detail?.type === 'movie' ? { type: detail.type, id: detail.id } : null
  const addLabel = t(addKind === 'quote' ? 'shell.add.quote.label' : addKind === 'film' ? 'shell.add.film.label' : 'shell.add.work.label')

  // The bar's search field, and what its pill says. The scope comes from the SAME
  // function the old button used, so the field and the search screen cannot disagree
  // about what "here" means.
  const detailTitle = useCrumbTitle()
  // The phone header's sub-line and the dock's two screen seats, published by
  // whichever screen owns them. Both are null on a screen that publishes neither,
  // which is the resting state and draws nothing.
  const { sub: barSub, keys: barKeys } = useScreenBarState()
  // ── HOME'S TWO SEATS, and Home is the one screen that publishes none of its
  // own — it is where a session starts and where a thumb has nothing to reach
  // for but Back, Search and ＋ .
  //
  // NAVIGATION AND TOOLS, in that order, because that is the order of consequence:
  // one goes to the boards this reader keeps things in, the other to the three
  // screens ABOUT those things. The drawer holds both lists and always has; the
  // point of these is that the ☰ is at the top of a phone and the thumb is at the
  // bottom.
  //
  // THE FIRST KEY COLLAPSES. With one section switched on there is nothing to
  // choose between, so the key becomes that section's own door — its own rail
  // glyph, filled, because at that point it names a place rather than a list of
  // them — and a menu of one is the dead control this repo keeps arguing against.
  const boardRows = SECTIONS.filter((sec) => sections[sec.tab])
  // THE WAY TO THE OTHER BOARDS, as one seat. Built here rather than by the
  // screens because only the shell knows which sections are switched on and only
  // the shell can change tab — a screen that wanted this would have to be handed
  // both, which is two props to every screen for one key.
  const boardsKey =
    boardRows.length === 1
      ? {
          id: 'boards',
          label: t(boardRows[0].label),
          icon: <NavIcon name={boardRows[0].tab} />,
          onClick: () => selectTab(boardRows[0].tab),
        }
      : {
          id: 'boards',
          node: (
            <DockMenu
              icon={<IconBoards />}
              label={t('shell.dock.boards.label')}
              items={boardRows.map((sec) => ({
                id: sec.tab,
                icon: <NavIcon name={sec.tab} />,
                label: t(sec.label),
                onClick: () => selectTab(sec.tab),
              }))}
            />
          ),
        }
  const toolsKey = {
    id: 'tools',
    node: (
      <DockMenu
        icon={<IconTools />}
        label={t('shell.dock.tools.label')}
        items={HOME_TOOLS.map(([key, label]) => ({
          id: key,
          icon: <NavIcon name={key} />,
          label: t(label),
          onClick: () => selectTab(key),
        }))}
      />
    ),
  }

  // WHAT THE DOCK'S TWO SEATS HOLD, and the answer is now the same everywhere by
  // default rather than on Home alone.
  //
  // The owner's rule: "for locations that do not have context menu, just use the
  // home context menu in mobile." A screen with nothing of its own to offer used
  // to publish nothing and get two EMPTY seats — on the Bin, on Tags, on Checks,
  // on every screen that is a list and no more. Two blanks beside Back, Search
  // and ＋ is not restraint, it is a dock with holes in it, and the two keys Home
  // already has are the two that are useful from anywhere: where else can I go,
  // and what is this library's own machinery.
  //
  // A SCREEN MAY ASK FOR THE NAV SEAT BY NAME. `{ id: 'nav' }` in a screen's own
  // keys is a placeholder the shell swaps for the boards key above — which is how
  // the Library, the Catalogue and the Quotes page keep their filter in the first
  // seat and get the way out in the second, without being handed `sections` and
  // `selectTab` to build it themselves.
  const dockKeys = (barKeys || [boardsKey, toolsKey]).map((k) =>
    k && k.id === 'nav' ? boardsKey : k,
  )
  // Back is dead on the first screen of a session. It is still drawn — see
  // MobileDock — so Search never slides into the seat it always occupies.
  const canGoBack = (window.history.state?.tpDepth || 0) > 0 || !!detail
  const barScope = searchScope(tab, detail)
  const scopeLabel = (sc) => t(
    sc === 'books' ? (detail ? 'shell.search.scope.thisbook' : 'nav.tab.library.label')
      : sc === 'movies' ? (detail ? 'shell.search.scope.thisfilm' : 'nav.tab.movies.label')
      : sc === 'quotes' ? 'nav.tab.quotes.label'
      : 'shell.search.scope.all',
  )
  // Enter writes the query and the scope to the keys SearchPage already reads, then
  // goes there. `q` is null when the pill's × is what called this — dropping a scope
  // must not also wipe a query you have not typed yet.
  const runSearch = (q, sc) => {
    try {
      if (q !== null) localStorage.setItem('tippani:search:q', JSON.stringify(q))
    } catch { /* private mode — the box keeps whatever it had */ }
    searchScoped(sc, sc === 'all' ? [] : takeSearchSeed())
  }

  return (
    <WorkDoor open={openWork}>
    <div className="min-h-screen has-mobile-topbar">
      {/* THE RAIL OWNS THE BRAND, THE DESTINATIONS AND THE ACCOUNT now; the bar keeps
          the four verbs that act on the screen you are looking at. Neither list is
          restated — both read routes.js through visibleTabs. */}
      <NavRail
        tab={tab}
        onChange={selectTab}
        sections={sections}
        user={user}
        onAccount={() => setProfileOpen(true)}
        onBin={() => go('bin', null)}
        onChecks={() => go('checks', null)}
        brandDot={brandDot}
        // Through visibleTabs like every other nav list: a badge computed for a
        // section the reader has switched off is work done for a row that will not
        // be drawn, and features-nav.test.js is right to refuse the bare list.
        badges={Object.fromEntries(
          [...visibleTabs(CONTENT_TABS, sections), ...visibleTabs(UTILITY_TABS, sections)]
            .map(([k]) => [k, navBadge(k, { stats, metaIssues, streak, version: user.version })])
            .filter(([, v]) => v),
        )}
        binCount={binCount}
        // The import queue only. THE STRAY-MARKS COUNT IS DELIBERATELY ABSENT: that
        // scan reads every quote in the library, and running it on every page load to
        // draw one badge is exactly the kind of standing cost this app refuses. It is
        // counted when you open Checks, where you are about to read it anyway.
        checkCount={pendingImport}
        strayCount={strayCount}
      />
      <header className="topbar">
        <div className="topbar-inner">
          <Breadcrumb tab={tab} detail={detail} title={detailTitle} onRoot={(key) => selectTab(key || 'home')} />
          <TopBarSearch
            scope={barScope}
            scopeLabel={scopeLabel(barScope)}
            onSearch={(q, sc) => runSearch(q, sc)}
            onDropScope={() => runSearch(null, 'all')}
          />
          {/* Add · Search · Help · chip — the same four, in the same order, as the
              phone bar below. Each of the first three reads the current route
              (addSection / searchScope / helpScreen). */}
          <div className="ml-auto flex items-center gap-2.5">
            {/* §7 One "＋ Add", now context-aware: on Library it adds a book, on
                the Catalogue a film or show, and on a work's own page it captures
                a quote against that work. */}
            <Tooltip
              side="bottom"
              className="shrink-0"
              label={pendingImport > 0 ? t('shell.add.pending.tip', { n: pendingImport }) : addLabel}
            >
              <button
                type="button"
                className="topbar-add-btn tactile"
                data-tour="add"
                aria-label={addLabel}
                onClick={() => openAdd(addKind, addFor)}
              >
                <IconPlus />
                <span>{t('common.action.add.label')}</span>
                {importBadge}
              </button>
            </Tooltip>
            <PageHelp screen={help} variant="pill" />
            {/* ＋ Add · ? · ⋯ — the thing you do most, the thing that explains the
                screen, and everything else. Help keeps its own pill rather than
                folding into the menu: it is one press from every screen today and
                a menu row would make it two — and for the same reason it is NOT
                also a row inside the menu, which would be the same door twice
                within three controls of itself. The phone's bar has no pill and
                keeps the row. */}
            <ScreenMenu screen={help} className="topbar-add-btn tactile icon-only" glyph={18} withHelp={false} />
          </div>
        </div>
      </header>
      <main className="container-tp">
        {/* THE PHONE'S TOP BAR IS A HEADER NOW, on every screen including a
            detail — which is why the detail screens' own back+title bar is gone.
            ☰ and the title, and under the title a line of whatever the screen
            knows about itself: a year, a count, an author. The four glyphs it
            used to carry (＋, search, help, the avatar) moved to the dock or the
            drawer, and the space they freed is what the title and its sub-line
            are made of. */}
        <header className="mobile-topbar">
          <Tooltip label={t('shell.drawer.open.tip')} side="bottom" className="shrink-0">
            <button type="button" className="mobile-topbar-btn" aria-label={t('shell.drawer.open.aria')} onClick={() => setDrawerOpen(true)}>
              <IconMenu />
              {brandDot}
            </button>
          </Tooltip>
          <span className="mobile-topbar-titles">
            <span className="mobile-topbar-title">{detailTitle || t(screenTitleKey(tab))}</span>
            {barSub ? <span className="mobile-topbar-sub">{barSub}</span> : null}
          </span>
          {/* The same ⋯ as the desktop bar, in the phone bar's own dress. It used
              to be the dock's second seat on a work's detail and nowhere at all on
              every other screen; the dock seat it vacates goes to a verb a thumb
              actually reaches for. */}
          <ScreenMenu screen={help} className="mobile-topbar-btn" />
        </header>
        <ErrorBoundary key={tab} label={t('shell.error.boundary.screen.label', { name: tab })}>
        <div className="tab-panel">
        {/* One boundary for every screen, INSIDE the error boundary: a chunk that
            fails to arrive is an error the screen should report, not a blank tab. */}
        <Suspense fallback={null}>
        {tab === 'home' && (
          <div data-screen-label="home">
            {/* THE THREE onGo* PROPS ARE DOORS, and each is passed only while the
                section it opens has one (Settings → Features). Home draws every
                one of those controls on the PROP being there, so an absent
                callback removes the tile or the glyph rather than leaving a card
                that answers a tap with nothing. onOpenBook / onOpenMovie beside
                them are CONTENT LINKS and are never gated: a favourite still
                opens the book it came from however the nav is configured. */}
            <Home
              user={user}
              stats={stats}
              onOpenBook={openBook}
              onOpenMovie={openMovie}
              onGoLibrary={sections.library ? () => selectTab('library') : null}
              onGoMovies={sections.movies ? () => selectTab('movies') : null}
              onGoQuotes={sections.quotes ? () => selectTab('quotes') : null}
              onPending={setPending}
              pendingImport={pendingImport}
              onReviewImport={() => selectTab('staging')}
            />
          </div>
        )}
        {tab === 'library' && (
          <div data-screen-label="library">
            <Library
              openId={detail?.type === 'book' ? detail.id : null}
              onOpen={openBook}
              onClose={() => goBack('library')}
              onOpenMovie={openMovie}
              creditSeparators={user.preferences?.creditSeparators}
              onAdd={openAdd}
              onSearch={openSearch}
              // THE CHIP-SEEDING VERB, threaded explicitly because the one above
              // is a different question. `openSearch` opens the search screen
              // scoped to where you are and takes no argument; the character
              // sheet's counts need "this character, in this work" as removable
              // chips, which only searchScoped can express.
              onSeedSearch={searchScoped}
              dataNonce={dataNonce}
            />
          </div>
        )}
        {tab === 'movies' && (
          <div data-screen-label="movies">
            <Movies
              openId={detail?.type === 'movie' ? detail.id : null}
              onOpen={openMovie}
              onClose={() => goBack('movies')}
              creditSeparators={user.preferences?.creditSeparators}
              onAdd={openAdd}
              onSearch={openSearch}
              // THE CHIP-SEEDING VERB, threaded explicitly because the one above
              // is a different question. `openSearch` opens the search screen
              // scoped to where you are and takes no argument; the character
              // sheet's counts need "this character, in this work" as removable
              // chips, which only searchScoped can express.
              onSeedSearch={searchScoped}
              dataNonce={dataNonce}
            />
          </div>
        )}
        {tab === 'metadata' && (
          <div data-screen-label="metadata">
            <MetadataPage
              user={user}
              onOpenBook={openBook}
              onOpenMovie={openMovie}
              onSearch={searchFor}
              onPreferences={onPreferences}
            />
          </div>
        )}
        {tab === 'search' && (
          <div data-screen-label="search">
            <SearchPage onOpenBook={openBook} onOpenMovie={openMovie} creditSeparators={user.preferences?.creditSeparators} sections={sections} />
          </div>
        )}
        {tab === 'quotes' && (
          <div data-screen-label="quotes">
            <QuotesPage
              openId={detail?.type === 'board' ? detail.id : null}
              onOpen={(id) => go('quotes', { type: 'board', id })}
              onClose={() => goBack('quotes')}
              creditSeparators={user.preferences?.creditSeparators}
            />
          </div>
        )}
        {tab === 'anthologies' && (
          <div data-screen-label="anthologies">
            {/* NOT GATED ON `sections`, like every other screen here. Hiding a
                section takes away the DOORS and never the route, so /anthologies
                still opens for a bookmark taken before the switch was turned off. */}
            <AnthologiesPage
              openId={detail?.type === 'anthology' ? detail.id : null}
              onOpen={(id) => go('anthologies', { type: 'anthology', id })}
              onClose={() => goBack('anthologies')}
              onOpenBook={openBook}
              onOpenMovie={openMovie}
            />
          </div>
        )}
        {tab === 'tags' && (
          <div data-screen-label="tags">
            <TagsPage />
          </div>
        )}
        {tab === 'stats' && (
          <div data-screen-label="stats">
            <StatsPage onSearch={searchFor} />
          </div>
        )}
        {tab === 'staging' && (
          <div data-screen-label="staging">
            <StagingPage
              onPending={setPendingImport}
              onOpenBook={openBook}
              onOpenMovie={openMovie}
              onApproved={refreshStats}
            />
          </div>
        )}
        {/* CHECKS — the rail and the drawer have carried a counted row to this
            screen since the rail landed, and until now it went nowhere: 'checks'
            was in no route table and no render branch, so the row opened a blank
            page. One screen, two sections, both of which already existed. */}
        {tab === 'checks' && (
          <div data-screen-label="checks">
            <ChecksPage
              onPending={setPendingImport}
              onOpenBook={openBook}
              onOpenMovie={openMovie}
              onApproved={refreshStats}
              onOpenQuotes={() => go('quotes', null)}
            />
          </div>
        )}
        {tab === 'settings' && (
          <div data-screen-label="settings">
            <Settings
              user={user}
              onPreferences={onPreferences}
              update={update}
              onUpdateInfo={setUpdate}
              onStartTour={(step) => setTourState({ step })}
            />
          </div>
        )}
        {/* The bin is in no tab list — see ROUTE_TABS. It routes so that it
            bookmarks and survives a refresh, and its only door in is the tile in
            Settings, which is where its Back goes. */}
        {tab === 'bin' && (
          <div data-screen-label="bin">
            <BinPage />
          </div>
        )}
        {/* Stray marks, the bin's neighbour in every sense: one door in from
            Settings, a URL so it survives a refresh, and no tab. Its rows open
            the work a quote lives in, which is where it can be edited — this page
            never writes. */}
        {tab === 'cleanup' && (
          <div data-screen-label="cleanup">
            <CleanupPage
              onOpenBook={openBook}
              onOpenMovie={openMovie}
              onOpenQuotes={() => go('quotes', null)}
            />
          </div>
        )}
        </Suspense>
        </div>
        </ErrorBoundary>
      </main>
      {/* Drawn unconditionally and hidden by CSS above the breakpoint, exactly as
          the dock beside it is and for the dock's own stated reason: "the bar's
          visibility is CSS, so rotating a tablet never remounts it". Only the
          scroll listener is gated on the viewport — there is no point measuring a
          page for a key that cannot be drawn. */}
      <BackToTop show={showTop} dockHidden={navHidden} onClick={toTop} />
      <MobileDock
        keys={dockKeys}
        hidden={navHidden}
        canBack={canGoBack}
        onBack={() => window.history.back()}
        onSearch={openSearch}
        searchLabel={t(globalSearch ? 'shell.search.global.aria' : 'nav.tab.search.label')}
        searchIcon={globalSearch ? <IconSearchGlobe /> : <IconSearch />}
        onAdd={() => openAdd(addKind, addFor)}
        addLabel={addLabel}
        addBadge={importBadge}
      />
      <Drawer
        metaIssues={metaIssues}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tab={tab}
        selectTab={selectTab}
        sections={sections}
        // The drawer is the deliberately CONTEXT-FREE route to both: its Add
        // opens the plain look-up card with nothing pre-filled, and its Search
        // clears the scope rather than inheriting the last page's. The top bar's
        // pair is the context-aware one; having both behave the same way would
        // leave no way to escape a scope you did not choose.
        onSearch={() => searchScoped('all')}
        onAdd={() => openAdd('book')}
        onAccount={() => setProfileOpen(true)}
        user={user}
        stats={stats}
        pending={pending}
        pendingImport={pendingImport}
        streak={streak}
        binCount={binCount}
        checkCount={pendingImport}
        strayCount={strayCount}
        dark={dark}
        onUser={onUser}
      />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} omit={omitShortcuts} />
      <AddSurface
        open={addOpen}
        initialSection={addSec}
        initialTarget={addTarget}
        initialFields={addFields}
        pendingImport={pendingImport}
        sections={sections}
        onReviewImport={() => { setAddOpen(false); selectTab('staging') }}
        onStaged={refreshPendingImport}
        onClose={() => setAddOpen(false)}
        onAdded={(what) => {
          setAddOpen(false)
          refreshStats()
          bumpData()
          // Land on the list for what was just added so it's visible. When that is
          // the list you were already on, go() changes no state and nothing
          // remounts — which is exactly why bumpData() above is not optional.
          //
          // UNLESS THAT SECTION IS HIDDEN, which is the one door that filtering a
          // list could never have caught: a reader standing on /library by URL
          // with the Library switched off would otherwise be walked into it by a
          // save. They stay where they are; bumpData has already refreshed what
          // is on screen.
          const landing = what === 'film' ? 'movies' : 'library'
          if (sections[landing] !== false) go(landing, null)
        }}
        onCaptured={() => {
          // A captured quote closes the surface but stays put — capture is a
          // jot-and-return gesture, not a navigation. On a work's own page that
          // page has to refetch, though, or the quote you just wrote is missing
          // from the list you are looking at (see dataNonce).
          setAddOpen(false)
          refreshStats()
          bumpData()
        }}
        onWorkCreated={refreshStats}
        onOpenMovie={openMovie}
      />
      {profileOpen && (
        <AccountOverlay user={user} onUser={onUser} logout={logout} onClose={() => setProfileOpen(false)} />
      )}
      {tourState && (
        <FeatureTour
          user={user}
          startStep={tourState.step}
          onNavigate={selectTab}
          onPreferences={onPreferences}
          onClose={() => setTourState(null)}
        />
      )}
    </div>
    </WorkDoor>
  )
}
