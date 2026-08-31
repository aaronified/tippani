import { lazy, Suspense, useEffect, useRef, useState } from 'react'
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
const TagsPage = lazy(() => import('./TagsPage.jsx'))
const SearchPage = lazy(() => import('./SearchPage.jsx'))
const StagingPage = lazy(() => import('./StagingPage.jsx'))
const StatsPage = lazy(() => import('./StatsPage.jsx'))
const Settings = lazy(() => import('./Settings.jsx'))
const BinPage = lazy(() => import('./BinPage.jsx'))
const CleanupPage = lazy(() => import('./CleanupPage.jsx'))
import { applyColors, applyTheme } from './theme.js'
import { applyLocale, useLocale } from './i18n.js'
import { LanguagePicker } from './locale.jsx'
import {
  BOTTOM_TABS,
  CONTENT_TABS,
  DRAWER_TABS,
  SECTIONS,
  UTILITY_TABS,
  visibleSections,
  visibleTabs,
  addSection,
  helpScreen,
  parsePath,
  searchScope,
  statePath,
} from './routes.js'
import { navigateBack, pushRoute, seedRoute } from './history.js'
import { DEMO, apiURL, coverImgURL, json, uploadWithProgress } from './api.js'
import {
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
  IconChecks,
  IconMenu,
  IconPlus,
  IconSearch,
  IconSearchGlobe,
  Kbd,
  NavIcon,
  ShortcutSheet,
  Sprockets,
  StickerButton,
  toast,
  ToastHost,
  Toggle,
  Tooltip,
  useBackToClose,
  useBodyScrollLock,
  useCrumbTitle,
  useEdgeScroll,
  useFrameBase,
  useHideOnScrollDown,
  useIsMobileScreen,
  usePersistedState,
  useResolvedDark,
} from './ui.jsx'
import { takeSearchSeed } from './facets.js'
import { Profile } from './Account.jsx'
import { PageHelp } from './help.jsx'
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
export function navBadge(key, { stats, metaIssues, streak, version } = {}) {
  if (stats) {
    // stats.quotes counts the utterances table — the standalone quotes, which is
    // exactly what that row leads to. The other two count works, not quotes.
    if (key === 'library') return String(stats.books)
    if (key === 'movies') return String(stats.movies)
    if (key === 'quotes') return String(stats.quotes)
    if (key === 'tags') return String(stats.tags)
    if (key === 'anthologies' && stats.anthologies != null) return String(stats.anthologies)
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

// Breadcrumb — where you are, in the bar the rail left empty.
//
// TWO LEVELS AND NO MORE. This app is never more than two deep: a screen, or a work
// inside one. A crumb trail that can only ever be `root / leaf` is a label with a
// door on it, and pretending otherwise would mean inventing hierarchy the routes do
// not have.
function Breadcrumb({ tab, detail, title, onRoot }) {
  const rootKey = detail?.type === 'movie' ? 'movies' : detail?.type === 'book' ? 'library' : null
  const rootLabel = rootKey ? t(`nav.tab.${rootKey === 'movies' ? 'movies' : 'library'}.label`) : t('shell.wordmark.label')
  const leaf = detail ? title : t(`nav.tab.${tab}.label`)
  if (!leaf) return null
  return (
    <nav className="topbar-crumbs" aria-label={t('shell.crumbs.aria')}>
      <button type="button" className="crumb" onClick={() => onRoot(rootKey)}>{rootLabel}</button>
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
          <span className="scope-x" aria-hidden="true">×</span>
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
function NavRail({ tab, onChange, sections, user, onAccount, onBin, onChecks, brandDot = null, badges = {}, binCount = 0, checkCount = 0 }) {
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
      {badges[key] ? <span className="rail-count">{badges[key]}</span> : null}
    </button>
  )

  return (
    <aside className="rail">
      <div className="rail-head">
        {/* Two files rather than one recoloured: a logo is not a glyph that takes
            currentColor, and tinting the light mark for dark mode is the kind of
            "close enough" a brand notices first. */}
        <button type="button" className="rail-brand" onClick={() => onChange('home')} title={t('nav.bottom.home.aria')}>
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
          {checkCount > 0 ? <span className="rail-count">{checkCount}</span> : null}
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
          <span className="rail-acct-name">{user.display_name || user.username}</span>
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
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
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
function Drawer({ open, onClose, tab, selectTab, onSearch, onAdd, onAccount, user, stats, pending, pendingImport, streak, metaIssues, update, logout, dark, onUser, sections }) {
  // Metadata "issues" = items the console flags (a book with no cover or no
  // ids; a film/show with no poster, cast or source) — the same predicate the
  // Metadata page uses. Fetched lazily the first time the drawer opens (it's a
  // whole-library read, wasted on desktop users who never open the drawer).
  // The nav sheet is the surface a phone reader is most likely to press Back
  // on, because it is the surface they opened to go somewhere else.
  useBackToClose(open, onClose)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
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
    return label ? <span className="drawer-badge">{label}</span> : null
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
        </div>
        {/* The footer chip IS the way to Profile, exactly as in both top bars —
            the same AccountChip component, so the tooltip, the label and the
            one-tap behaviour cannot drift from the bar's.

            It was a decorative aria-hidden span with a "Profile" row further up
            the drawer, while the comment beside it already claimed profile lived
            behind the avatar. That was true of the bar and false here, so the
            phone had two account entries and the one that looked like the
            account was the one that did nothing. */}
        <div className="drawer-footer">
          <AccountChip user={user} onOpen={() => { onAccount(); onClose() }} />
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 'var(--type-ui-13)', fontWeight: 600 }}>{user.username}</p>
            <p className="mono-label" style={{ fontSize: 'var(--type-ui-9)' }}>
              {t(user.is_admin ? 'shell.drawer.role.admin.label' : 'shell.drawer.role.user.label')}
            </p>
          </div>
          <button type="button" className="tp-link" onClick={logout}>
            {t('shell.drawer.logout.label')}
          </button>
        </div>
        {/* Version → changelog (ABS-style corner). The update link only appears
            once a check has found a newer release (admin-run, on demand). */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-3 pt-2"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <Tooltip label={t('shell.drawer.changelog.tip')} side="top">
            <a
              href={user.releases_url || 'https://github.com/aaronified/tippani/releases'}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label"
              style={{ fontSize: 'var(--type-ui-11)', letterSpacing: '.04em', color: 'var(--faint)' }}
            >
              {t('shell.drawer.changelog.label', { version: user.version || 'dev' })}
            </a>
          </Tooltip>
          {update?.update_available && update.notes_url && (
            <a
              href={update.notes_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label"
              style={{ fontSize: 'var(--type-ui-11)', fontWeight: 700, color: 'var(--accent-ui)' }}
              title={t('shell.drawer.update.tip', { version: update.latest })}
            >
              {t('shell.drawer.update.label', { version: update.latest })}
            </a>
          )}
        </div>
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
// MobileBottomNav — the floating phone nav: four thumb-reachable icons, hovering
// clear of the bottom edge so the Android gesture pill keeps its own strip. It's
// an ADDITION, not a replacement — the ☰ drawer still owns the utility tabs,
// ＋ Add and the account rows, and is untouched.
//
// Deliberately carries no data-tour attribute. tour.jsx's findVisible picks the
// first match with a non-zero box, and .is-away only sets opacity — the slid-away
// bar still measures, so a data-tour here could spotlight an invisible control.
//
// aria-label is "Quick navigation", not "Primary": the drawer already claims
// that landmark name and both can be mounted at once.
function MobileBottomNav({ tab, selectTab, hidden, sections }) {
  // The bar stays focusable while slid away, so focusing a button must bring it
  // back rather than leave focus on something off-screen.
  const [focused, setFocused] = useState(false)
  const away = hidden && !focused
  return (
    <nav
      className={'mobile-bottom-nav' + (away ? ' is-away' : '')}
      aria-label={t('shell.nav.quick.aria')}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {visibleTabs(BOTTOM_TABS, sections).map(([key, label, tip]) => {
        const active = tab === key
        return (
          <Tooltip key={key} label={t(tip)} side="top">
            <button
              type="button"
              className={'mobile-bottom-nav-btn' + (active ? ' active' : '')}
              aria-label={t(label)}
              aria-current={active ? 'page' : undefined}
              onClick={() => selectTab(key)}
            >
              <NavIcon name={key} />
              <span className="mobile-bottom-nav-mark" aria-hidden="true" />
            </button>
          </Tooltip>
        )
      })}
    </nav>
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

function Shell({ user, onLogout, onPreferences, onUser }) {
  const initial = parsePath(typeof window !== 'undefined' ? window.location.pathname : '/')
  // /import isn't a tab any more — start on Home and open the Add surface there.
  // Neither /import nor /capture is a tab: both are the Add surface over Home.
  const initialTab = initial.tab === 'import' || initial.tab === 'capture' ? 'home' : initial.tab
  const [tab, setTab] = useState(initialTab)
  useEffect(warmScreens, [])
  const [detail, setDetail] = useState(initial.detail) // {type: 'book' | 'movie', id}
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
  const openAdd = (sec = 'book', target = null) => {
    setAddSec(sec)
    setAddTarget(target)
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
  }, [tab, detail])

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
    <div className={'min-h-screen' + (!detail ? ' has-mobile-topbar' : '')}>
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
          </div>
        </div>
      </header>
      <main className="container-tp">
        {/* Mobile shell bar (hidden on desktop): drawer · logo→Home · ＋ ·
            search · avatar. Detail screens drop it — their own back+title bar
            (inside the page) takes over the top edge instead. */}
        {!detail && (
          <header className="mobile-topbar">
            <Tooltip label={t('shell.drawer.open.tip')} side="bottom" className="shrink-0">
              <button type="button" className="mobile-topbar-btn" aria-label={t('shell.drawer.open.aria')} onClick={() => setDrawerOpen(true)}>
                <IconMenu />
              </button>
            </Tooltip>
            <Tooltip shortcut="go-home" label={t('nav.bottom.home.aria')} side="bottom" className="min-w-0">
              <button type="button" className="brand" onClick={() => selectTab('home')}>
                <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="26" height="26" />
                <span className="wordmark">{t('shell.wordmark.label')}</span>
                {brandDot}
              </button>
            </Tooltip>
            <span className="flex-1" />
            {/* ＋ · Search · ? · chip — the same four the desktop bar carries, in
                the same order, all reading the current route. */}
            <Tooltip shortcut="capture" label={pendingImport > 0 ? t('shell.add.pending.tip', { n: pendingImport }) : addLabel} side="bottom" className="shrink-0">
              <button type="button" className="mobile-topbar-btn" data-tour="add" aria-label={addLabel} onClick={() => openAdd(addKind, addFor)}>
                <IconPlus />
                {importBadge}
              </button>
            </Tooltip>
            {/* The glyph follows the preference here too, but the GESTURE does
                not: a phone has no right-click, and long-press is already the
                Tooltip's. So this bar reports the mode and cannot change it,
                which is the honest arrangement — the button behaves the way its
                glyph says, and the one place that can flip it is the one place
                the gesture exists. The drawer's Search below stays global
                unconditionally, as it always has. */}
            <Tooltip shortcut="search" label={t(globalSearch ? 'shell.search.global.tip' : 'nav.tab.search.label')} side="bottom" className="shrink-0">
              <button
                type="button"
                className="mobile-topbar-btn"
                data-tour="search"
                data-global={globalSearch ? 'on' : undefined}
                aria-label={t(globalSearch ? 'shell.search.global.aria' : 'nav.tab.search.label')}
                onClick={openSearch}
              >
                {globalSearch ? <IconSearchGlobe /> : <IconSearch />}
              </button>
            </Tooltip>
            <PageHelp screen={help} />
            <AccountChip user={user} onOpen={() => setProfileOpen(true)} />
          </header>
        )}
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
        {tab === 'settings' && (
          <div data-screen-label="settings">
            <Settings
              user={user}
              onPreferences={onPreferences}
              update={update}
              onUpdateInfo={setUpdate}
              onStartTour={(step) => setTourState({ step })}
              onOpenBin={() => go('bin', null)}
              onOpenCleanup={() => go('cleanup', null)}
            />
          </div>
        )}
        {/* The bin is in no tab list — see ROUTE_TABS. It routes so that it
            bookmarks and survives a refresh, and its only door in is the tile in
            Settings, which is where its Back goes. */}
        {tab === 'bin' && (
          <div data-screen-label="bin">
            <BinPage onClose={() => goBack('settings')} />
          </div>
        )}
        {/* Stray marks, the bin's neighbour in every sense: one door in from
            Settings, a URL so it survives a refresh, and no tab. Its rows open
            the work a quote lives in, which is where it can be edited — this page
            never writes. */}
        {tab === 'cleanup' && (
          <div data-screen-label="cleanup">
            <CleanupPage
              onClose={() => goBack('settings')}
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
      <MobileBottomNav tab={tab} selectTab={selectTab} hidden={navHidden} sections={sections} />
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
        update={update}
        logout={logout}
        dark={dark}
        onUser={onUser}
      />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} omit={omitShortcuts} />
      <AddSurface
        open={addOpen}
        initialSection={addSec}
        initialTarget={addTarget}
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
  )
}
