import { useEffect, useRef, useState } from 'react'
import Home from './Home.jsx'
import { applyLanguageMarks } from './languages.jsx'
import { applyFonts, registerUploads } from './fonts.js'
import { applyReviewPrefs, tzOffsetMinutes } from './review.jsx'
import { pickEpigraph } from './epigraphs.js'
import AddSurface from './AddSurface.jsx'
import Library from './Library.jsx'
import MetadataPage from './MetadataPage.jsx'
import Movies from './Movies.jsx'
import QuotesPage from './Quotes.jsx'
import TagsPage from './TagsPage.jsx'
import SearchPage from './SearchPage.jsx'
import StagingPage from './StagingPage.jsx'
import StatsPage from './StatsPage.jsx'
import Settings from './Settings.jsx'
import BinPage from './BinPage.jsx'
import { applyColors, applyTheme } from './theme.js'
import {
  BOTTOM_TABS,
  CONTENT_TABS,
  DRAWER_TABS,
  UTILITY_TABS,
  addSection,
  helpScreen,
  parsePath,
  searchScope,
  statePath,
} from './routes.js'
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
  IconMenu,
  IconPlus,
  IconSearch,
  IconSearchGlobe,
  NavIcon,
  Sprockets,
  StickerButton,
  toast,
  ToastHost,
  Toggle,
  Tooltip,
  useBodyScrollLock,
  useFrameBase,
  useHideOnScrollDown,
  useIsMobileScreen,
  usePersistedState,
  useResolvedDark,
} from './ui.jsx'
import { takeSearchSeed } from './facets.js'
import { Profile } from './Account.jsx'
import { PageHelp } from './help.jsx'
import { PASSPHRASE_MAX, PASSWORD_MAX, PASSWORD_MIN, passwordProblem, sniffArchiveKey } from './secret.js'
import { FeatureTour } from './tour.jsx'

// DEMO: the read-only GitHub Pages build (VITE_DEMO=1). A fetch shim (demo/
// install.js) serves dummy data and blocks writes; here it just suppresses URL
// history sync (the static site lives under a /tippani/ subpath, so pushing
// "/library" would point off-site) and shows a banner.
export { DEMO } from './api.js'

// App is the auth gate: first-run onboarding, login, then the logged-in shell.
// The grain overlay (§5) sits above every screen, auth included.
export default function App() {
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
      // And the one review preference a themed round cannot be handed as a prop.
      // Same effect on purpose: it runs on login and on every Settings save, so
      // there is no second place that has to remember to keep it current.
      applyReviewPrefs(user.preferences || {})
      applyLanguageMarks(user.preferences || {})
      applyFonts(user.preferences || {})
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
    if (user) screen = <Shell user={user} onLogout={() => setUser(null)} onPreferences={onPreferences} onUser={onUser} />
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
          Demo · dummy data, read-only · rougher than the real thing — <a href="https://github.com/aaronified/tippani">the self-hosted app is more polished →</a>
          {' · '}
          {/* Relative, and deliberately not routed through the SPA, so it
              resolves under the Pages subpath without knowing what that subpath
              is. `../` because the demo now lives one level down at /demo/ —
              the site root is the landing page, which is the only page a search
              engine can read (this one is an empty div until JS runs). */}
          <a href="../roadmap.html">roadmap →</a>
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
          if (action === '/auth/login') toast(`welcome back, ${me.username || 'reader'}`)
          return onSuccess(me)
        }
      }
      setError((await r.json().catch(() => ({}))).error || 'something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const Primary = film ? FilmButton : StickerButton
  const missing = !username.trim()
    ? 'Enter your username'
    : !password
      ? 'Enter your password'
      : signup
        ? passwordProblem(password)
        : ''
  return (
    <form onSubmit={submit} className="hand-card w-full max-w-sm px-8 py-9">
      <div className="mb-7 text-center">{header}</div>
      <Field
        label="Username"
        placeholder="username"
        value={username}
        autoComplete="username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <Field
        label="Password"
        placeholder={signup ? `password (${PASSWORD_MIN}–${PASSWORD_MAX})` : 'password'}
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
      {missing && password.length > 0 && <p className="microcopy mt-2 text-center">{missing}.</p>}
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
    applyTheme({ aesthetic: 'paper', theme: 'light' })
  }, [])

  const target = source === 'file' ? (file ? { ...fileKey, name: file.name } : null) : backup
  const key = target?.key || (target ? 'none' : '')

  async function chooseFile(f) {
    setFile(f)
    setError('')
    setFileKey(f ? await sniffArchiveKey(f) : null)
  }

  const missing = !target
    ? source === 'file' ? 'Choose a backup file' : 'No backup on this server'
    : key === 'passphrase'
      ? passphrase ? '' : 'Enter the archive\u2019s passphrase'
      : key === 'password'
        ? password ? '' : 'Enter the password it was sealed with'
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
        return setError((r.data && r.data.error) || 'restore failed')
      }
      toast('restored · log in again')
      // Reload → /auth/status now reports onboarding closed → the login screen.
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      // A large restore can outlive the connection even when it succeeds
      // server-side; reload to re-check /auth/status rather than freeze here.
      setTimeout(() => window.location.reload(), 1200)
    }
  }

  const busyLabel = phase === 'uploading' ? `Uploading… ${pct}%` : phase === 'restoring' ? 'Applying…' : ''

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10"
      data-screen-label="onboarding"
    >
      <CredentialForm
        header={
          <>
            <img src="/mark.svg" alt="" width="46" height="46" className="mx-auto mb-3" />
            <h1 className="display-title text-2xl">Welcome to tippani</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--soft)' }}>
              This first account becomes the admin.
            </p>
          </>
        }
        action="/auth/signup"
        cta="Create admin account"
        microcopy="onboarding closes once a user exists"
        onSuccess={onDone}
      />
      {/* One restore, two sources — the kept archive or a file off another box. */}
      <div className="hand-card w-full max-w-sm px-8 py-6">
        <p className="mono-label mb-2 text-center">or restore a backup</p>
        <p className="mb-3 text-sm" style={{ color: 'var(--soft)' }}>
          Loads everything in it — accounts, libraries and settings — then you log in with the credentials
          from that backup.
        </p>
        <Toggle
          ariaLabel="Restore from"
          value={source}
          onChange={(v) => { setSource(v); setError('') }}
          options={[['server', 'This server'], ['file', 'A file']]}
        />
        {source === 'server' && (
          <p className="microcopy mt-2">
            {backup
              ? <>archive from <b>{new Date(backup.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</b></>
              : 'nothing in this server\u2019s backups folder'}
          </p>
        )}
        {source === 'file' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".tpbk,.tar.gz,.tgz,application/gzip,application/octet-stream"
              aria-label="Choose a backup file to restore"
              className="hidden"
              onChange={(e) => chooseFile(e.target.files?.[0] || null)}
            />
            <GhostButton className="mt-3 w-full" onClick={() => fileRef.current?.click()} disabled={phase !== 'idle'}>
              {file ? file.name : 'Choose backup file…'}
            </GhostButton>
          </>
        )}
        {/* Exactly the field the chosen archive's own header asks for. */}
        {key === 'passphrase' && (
          <div className="mt-3">
            <Field
              label="Passphrase"
              placeholder="the archive’s passphrase"
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
              label={target?.account ? `Password for ‘${target.account}’` : 'Password'}
              placeholder="the password it was sealed with"
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
              {target?.recoverable
                ? 'If this server made the archive, its recovery key opens it and any password of that account will do.'
                : 'The password that account had when the archive was made.'}
            </p>
          </div>
        )}
        {key === 'none' && target && (
          <p className="microcopy mt-2">this archive predates 1.4.1 and carries no key</p>
        )}
        <GhostButton className="mt-3 w-full" onClick={restore} disabled={!!missing || phase !== 'idle'} title={missing || undefined}>
          {busyLabel || 'Restore'}
        </GhostButton>
        {missing && <p className="microcopy mt-2 text-center">{missing}.</p>}
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
    applyTheme({ aesthetic: 'film', theme: 'dark' })
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
                <div className="wordmark" style={{ fontSize: 22 }}>tippani</div>
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
            cta="Sign in"
            microcopy="locked out? an admin can reset your password"
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


// DesktopNav renders in the topbar. It is a real component (not an inline
// closure in Shell) so a Shell re-render does not remount the Toggle and lose the
// DOM measurements its sliding thumb is positioned from.
// tabOptions renders a [key, label, tip] list as Toggle segments (icon + label),
// carrying the tip through as the segment's hover label.
function tabOptions(rows) {
  return rows.map(([key, label, tip]) => [
    key,
    <><NavIcon name={key} /> <span className="tab-label">{label}</span></>,
    tip,
  ])
}

// DesktopNav: content tabs · divider · utility tabs, all inline.
function DesktopNav({ tab, onChange }) {
  return (
    <div className="topbar-nav-group">
      <Toggle className="nav-toggle" ariaLabel="Primary" value={tab} onChange={onChange} options={tabOptions(CONTENT_TABS)} />
      <span className="nav-divider" aria-hidden="true" />
      <Toggle className="nav-toggle" ariaLabel="Tools" value={tab} onChange={onChange} options={tabOptions(UTILITY_TABS)} />
    </div>
  )
}

// useIconOnlyNav — the intermediate-width fallback for the always-inline nav:
// desktop windows come in every size, so the seven labelled tabs collapse to
// icon-only WHEN they actually start clipping (scrollWidth outgrows the space
// the bar gives the nav), not at a fixed breakpoint. The full-label width is
// remembered so the labels come back once the bar is genuinely wide enough
// again (with a small hysteresis margin so a boundary width can't flap).
// Requires .topbar-nav { flex: 1 } so clientWidth tracks the AVAILABLE space
// rather than the (already collapsed) content, and .topbar-nav-group
// { flex: none } so a tight bar overflows the nav (measurable) instead of
// squeezing the overflow:hidden toggles, which clips labels mid-glyph without
// ever tripping the scrollWidth check.
function useIconOnlyNav() {
  const ref = useRef(null)
  const [iconOnly, setIconOnly] = useState(false)
  const state = useRef({ iconOnly: false, fullWidth: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const s = state.current
      if (!s.iconOnly) {
        if (el.scrollWidth > el.clientWidth + 1) {
          s.fullWidth = el.scrollWidth
          s.iconOnly = true
          setIconOnly(true)
        }
      } else if (el.clientWidth >= s.fullWidth + 8) {
        s.iconOnly = false
        setIconOnly(false)
      }
    }
    check()
    // Re-check when the available width changes, and once the bundled fonts
    // land (they change label widths without resizing the nav element).
    const ro = new ResizeObserver(check)
    ro.observe(el)
    document.fonts?.ready?.then(check)
    return () => ro.disconnect()
  }, [])
  return [ref, iconOnly]
}

// AccountChip — the avatar in both top bars. It opens Profile, full stop.
//
// It used to open a dropdown: Profile · User management (admin) · Log out — and
// the drawer carried the same rows again. Every one of those is a section of
// Profile now (see Account.jsx), so the menu was a list of one screen's parts
// standing between the chip and that screen. One tap, and nothing to learn.
function AccountChip({ user, onOpen }) {
  return (
    <Tooltip label="Your profile" side="bottom" className="shrink-0">
      <button className="user-chip" data-tour="account" aria-label={`Profile — ${user.username}`} onClick={onOpen}>
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
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const body = <Profile user={user} onUser={onUser} logout={logout} />
  if (mobile) {
    return (
      <div className="account-page" role="dialog" aria-label="Profile">
        <header className="account-page-bar">
          <Tooltip label="Close and go back" side="bottom"><button type="button" className="mobile-topbar-btn" onClick={onClose} aria-label="Back"><IconBack /></button></Tooltip>
          <span className="account-page-title">Profile</span>
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
      <div className="hand-card account-modal" role="dialog" aria-label="Profile" onMouseDown={(e) => e.stopPropagation()}>
        <div className="account-modal-bar">
          <h2 className="account-modal-title">Profile</h2>
          <PageHelp screen="profile" />
          <CloseButton onClick={onClose} tooltip="Close this panel" />
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
function Drawer({ open, onClose, tab, selectTab, onSearch, onAdd, onAccount, user, stats, pending, pendingImport, streak, update, logout, dark, onUser }) {
  // Metadata "issues" = items the console flags (a book with no cover or no
  // ids; a film/show with no poster, cast or source) — the same predicate the
  // Metadata page uses. Fetched lazily the first time the drawer opens (it's a
  // whole-library read, wasted on desktop users who never open the drawer).
  const [metaIssues, setMetaIssues] = useState(null)
  useEffect(() => {
    if (!open || metaIssues !== null) return
    json('GET', '/metadata/library').then((r) => {
      if (!r.ok || !r.data) return
      const books = (r.data.books || []).filter((b) => !b.has_cover || !b.has_ids).length
      const movies = (r.data.movies || []).filter((m) => !m.has_poster || !m.has_cast || !m.has_source).length
      setMetaIssues(books + movies)
    })
  }, [open, metaIssues])
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
        <span className="drawer-badge" style={{ fontSize: 9 }}>
          {pending > 0 && <span className="review-dot" aria-hidden="true" />}
          quiz · practice
        </span>
      )
    }
    if (key === 'library' && stats) return <span className="drawer-badge">{stats.books}</span>
    if (key === 'movies' && stats) return <span className="drawer-badge">{stats.movies}</span>
    // stats.quotes counts the utterances table — the standalone quotes, which is
    // exactly what this row leads to. The other two count works, not quotes.
    if (key === 'quotes' && stats) return <span className="drawer-badge">{stats.quotes}</span>
    if (key === 'tags' && stats) return <span className="drawer-badge">{stats.tags}</span>
    if (key === 'metadata' && metaIssues !== null) {
      return <span className="drawer-badge">{metaIssues > 0 ? `${metaIssues} ${metaIssues === 1 ? 'issue' : 'issues'}` : 'all clear'}</span>
    }
    if (key === 'stats' && streak > 0) return <span className="drawer-badge">{streak}-day streak</span>
    if (key === 'settings') return <span className="drawer-badge">v{user.version || 'dev'}</span>
    return null
  }

  return (
    <>
      <button type="button" className="drawer-scrim" aria-label="Close menu" onClick={onClose} />
      <nav
        className="drawer"
        aria-label="Primary"
        onPointerDown={onSwipeStart}
        onPointerMove={onSwipeMove}
        onPointerUp={onSwipeEnd}
        onPointerCancel={() => { swipe.current = null }}
      >
        <div className="drawer-header">
          <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="34" height="34" />
          <div className="min-w-0">
            <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'var(--font-display-style)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' }}>
              tippani
            </p>
            <p className="bengali" style={{ fontSize: 11.5, color: 'var(--amber)' }} aria-hidden="true">
              টিপ্পনী · a marginal annotation
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
            Add
            <span className="drawer-badge">work · quote · import</span>
          </button>
          {pendingImport > 0 && (
            <button
              type="button"
              className="drawer-item"
              onClick={() => { selectTab('staging'); onClose() }}
            >
              <NavIcon name="import" />
              Pending import
              <span className="drawer-badge" style={{ color: 'var(--accent-ui)' }}>{pendingImport}</span>
            </button>
          )}
          {DRAWER_TABS.map((t, i) =>
            t === null ? (
              <div key={`div-${i}`} className="drawer-divider" aria-hidden="true" />
            ) : (
              <button
                key={t[0]}
                type="button"
                className={'drawer-item' + (tab === t[0] ? ' active' : '')}
                aria-current={tab === t[0] ? 'page' : undefined}
                // Search is the one row with more to it than a destination: it
                // drops any scope the top bar's context-aware Search left behind.
                onClick={() => { if (t[0] === 'search' && onSearch) onSearch(); else selectTab(t[0]); onClose() }}
              >
                <NavIcon name={t[0]} />
                {t[1]}
                {badge(t[0])}
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
            <p style={{ fontSize: 13.5, fontWeight: 600 }}>{user.username}</p>
            <p className="mono-label" style={{ fontSize: 9 }}>
              {user.is_admin ? 'admin · self-hosted' : 'self-hosted'}
            </p>
          </div>
          <button type="button" className="tp-link" onClick={logout}>
            log out
          </button>
        </div>
        {/* Version → changelog (ABS-style corner). The update link only appears
            once a check has found a newer release (admin-run, on demand). */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-3 pt-2"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <Tooltip label="Release notes on GitHub" side="top">
            <a
              href={user.releases_url || 'https://github.com/aaronified/tippani/releases'}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label"
              style={{ fontSize: 10, letterSpacing: '.04em', color: 'var(--faint)' }}
            >
              v{user.version || 'dev'} · changelog ↗
            </a>
          </Tooltip>
          {update?.update_available && update.notes_url && (
            <a
              href={update.notes_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label"
              style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-ui)' }}
              title={`Update to ${update.latest}`}
            >
              ↑ update to {update.latest}
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
function MobileBottomNav({ tab, selectTab, hidden }) {
  // The bar stays focusable while slid away, so focusing a button must bring it
  // back rather than leave focus on something off-screen.
  const [focused, setFocused] = useState(false)
  const away = hidden && !focused
  return (
    <nav
      className={'mobile-bottom-nav' + (away ? ' is-away' : '')}
      aria-label="Quick navigation"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {BOTTOM_TABS.map(([key, label, tip]) => {
        const active = tab === key
        return (
          <Tooltip key={key} label={tip} side="top">
            <button
              type="button"
              className={'mobile-bottom-nav-btn' + (active ? ' active' : '')}
              aria-label={label}
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
function Shell({ user, onLogout, onPreferences, onUser }) {
  const initial = parsePath(typeof window !== 'undefined' ? window.location.pathname : '/')
  // /import isn't a tab any more — start on Home and open the Add surface there.
  // Neither /import nor /capture is a tab: both are the Add surface over Home.
  const initialTab = initial.tab === 'import' || initial.tab === 'capture' ? 'home' : initial.tab
  const [tab, setTab] = useState(initialTab)
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
  const [streak, setStreak] = useState(0) // daily-quiz streak — drawer Stats subtext
  const [stats, setStats] = useState(null) // drawer counts + Home stat tiles
  // Update-check result, shared so the mobile drawer's "update available" link
  // mirrors the Settings → Updates card. Populated on demand when an admin runs
  // the check (Tippani never contacts GitHub on its own), then cached here for
  // the rest of the session.
  const [update, setUpdate] = useState(null)
  const dark = useResolvedDark()
  const [navRef, navIconOnly] = useIconOnlyNav()
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
    const t = setTimeout(() => setTourState({ step: 0 }), 800)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStats = () => {
    json('GET', '/stats').then((r) => { if (r.ok) setStats(r.data) })
  }
  useEffect(() => {
    refreshStats()
    json('GET', `/review/daily?offset=${tzOffsetMinutes()}`).then((r) => {
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
    const want = statePath(initialTab, initial.detail)
    if (window.location.pathname !== want) window.history.replaceState({}, '', want)
    return () => window.removeEventListener('popstate', onPop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore a remembered list scroll once the list is tall enough to hold it
  // (its content refetches async — retry across frames, ~0.7s cap). Everything
  // else — details, expired or never-seen lists — starts fresh at the top
  // instead of inheriting the previous screen's (clamped) position.
  useEffect(() => {
    const y = detail ? null : scrollMem.get(statePath(tab, null))
    if (y == null) {
      window.scrollTo(0, 0)
      return
    }
    let tries = 0
    let stop = false
    const attempt = () => {
      if (stop) return
      if (document.documentElement.scrollHeight - window.innerHeight >= y || tries > 40) {
        window.scrollTo(0, y)
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
    const path = statePath(nextTab, nextDetail)
    if (path !== window.location.pathname) window.history.pushState({}, '', path)
  }
  function selectTab(t) { go(t, null) }
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
  // The three context-aware shell controls, resolved once per render off the
  // route (see helpScreen / addSection / searchScope above the Shell).
  const help = helpScreen(tab, detail)
  const addKind = addSection(tab, detail)
  // A work you have open is the capture target the ＋ pre-fills. openAdd takes
  // the target rather than reading `detail` itself, so the drawer's Add — which
  // must default to nothing — can call the same function with no target.
  const addFor = detail ? { type: detail.type, id: detail.id } : null
  const addLabel = addKind === 'quote' ? 'Capture a quote' : addKind === 'film' ? 'Add a film or show' : 'Add or import'

  return (
    <div className={'min-h-screen' + (!detail ? ' has-mobile-topbar' : '')}>
      <header className="topbar">
        <div className="topbar-inner">
          <Tooltip label="Go home to today's review" side="bottom" className="shrink-0">
            <button type="button" className="brand" onClick={() => selectTab('home')}>
              {/* the mark matches the 28px nav tab icons so the row reads level */}
              <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="28" height="28" />
              <span className="wordmark">tippani</span>
              {brandDot}
            </button>
          </Tooltip>
          <nav ref={navRef} aria-label="Primary" className={'topbar-nav' + (navIconOnly ? ' icon-only' : '')}>
            <DesktopNav tab={tab} onChange={selectTab} />
          </nav>
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
              label={pendingImport > 0 ? `${pendingImport} imports awaiting review` : addLabel}
            >
              <button
                type="button"
                className="topbar-add-btn tactile"
                data-tour="add"
                aria-label={addLabel}
                onClick={() => openAdd(addKind, addFor)}
              >
                <IconPlus />
                <span>Add</span>
                {importBadge}
              </button>
            </Tooltip>
            {/* Search rides beside ＋ Add as an icon-only pill in the same
                accent texture — the phone top bar already works this way.
                (Quote capture lives inside the ＋ Add surface's Capture tab —
                no separate top-bar pill.) */}
            <Tooltip
              label={globalSearch ? 'Searching everything' : 'Search'}
              side="bottom"
              className="shrink-0"
              onContextMenu={toggleGlobalSearch}
            >
              <button
                type="button"
                className="topbar-add-btn tactile icon-only"
                data-tour="search"
                data-global={globalSearch ? 'on' : undefined}
                onClick={openSearch}
                aria-label={globalSearch ? 'Search everything' : 'Search'}
              >
                {globalSearch ? <IconSearchGlobe /> : <IconSearch />}
              </button>
            </Tooltip>
            {/* Help moved out of the page headers and into the bar in 1.4.1: it
                is a shell control like the other three, it was drawn in eleven
                different places, and on a phone it was competing for the one row
                a page title also needs. `pill` skins it as the Search button
                beside it — they are peers in this row and should look it. */}
            <PageHelp screen={help} variant="pill" />
            <AccountChip user={user} onOpen={() => setProfileOpen(true)} />
          </div>
        </div>
      </header>
      <main className="container-tp">
        {/* Mobile shell bar (hidden on desktop): drawer · logo→Home · ＋ ·
            search · avatar. Detail screens drop it — their own back+title bar
            (inside the page) takes over the top edge instead. */}
        {!detail && (
          <header className="mobile-topbar">
            <Tooltip label="Open the navigation menu" side="bottom" className="shrink-0">
              <button type="button" className="mobile-topbar-btn" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
                <IconMenu />
              </button>
            </Tooltip>
            <Tooltip label="Go home to today's review" side="bottom" className="min-w-0">
              <button type="button" className="brand" onClick={() => selectTab('home')}>
                <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="26" height="26" />
                <span className="wordmark">tippani</span>
                {brandDot}
              </button>
            </Tooltip>
            <span className="flex-1" />
            {/* ＋ · Search · ? · chip — the same four the desktop bar carries, in
                the same order, all reading the current route. */}
            <Tooltip label={pendingImport > 0 ? `${pendingImport} imports awaiting review` : addLabel} side="bottom" className="shrink-0">
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
            <Tooltip label={globalSearch ? 'Searching everything' : 'Search'} side="bottom" className="shrink-0">
              <button
                type="button"
                className="mobile-topbar-btn"
                data-tour="search"
                data-global={globalSearch ? 'on' : undefined}
                aria-label={globalSearch ? 'Search everything' : 'Search'}
                onClick={openSearch}
              >
                {globalSearch ? <IconSearchGlobe /> : <IconSearch />}
              </button>
            </Tooltip>
            <PageHelp screen={help} />
            <AccountChip user={user} onOpen={() => setProfileOpen(true)} />
          </header>
        )}
        <ErrorBoundary key={tab} label={`The ${tab} screen`}>
        <div className="tab-panel">
        {tab === 'home' && (
          <div data-screen-label="home">
            <Home
              user={user}
              stats={stats}
              onOpenBook={openBook}
              onOpenMovie={openMovie}
              onGoLibrary={() => selectTab('library')}
              onGoMovies={() => selectTab('movies')}
              onGoQuotes={() => selectTab('quotes')}
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
              onClose={() => go('library', null)}
              onOpenMovie={openMovie}
              creditSeparators={user.preferences?.creditSeparators}
              onAdd={openAdd}
              dataNonce={dataNonce}
            />
          </div>
        )}
        {tab === 'movies' && (
          <div data-screen-label="movies">
            <Movies
              openId={detail?.type === 'movie' ? detail.id : null}
              onOpen={openMovie}
              onClose={() => go('movies', null)}
              creditSeparators={user.preferences?.creditSeparators}
              onAdd={openAdd}
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
            <SearchPage onOpenBook={openBook} onOpenMovie={openMovie} creditSeparators={user.preferences?.creditSeparators} />
          </div>
        )}
        {tab === 'quotes' && (
          <div data-screen-label="quotes">
            <QuotesPage
              openId={detail?.type === 'board' ? detail.id : null}
              onOpen={(id) => go('quotes', { type: 'board', id })}
              onClose={() => go('quotes', null)}
              creditSeparators={user.preferences?.creditSeparators}
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
            />
          </div>
        )}
        {/* The bin is in no tab list — see ROUTE_TABS. It routes so that it
            bookmarks and survives a refresh, and its only door in is the tile in
            Settings, which is where its Back goes. */}
        {tab === 'bin' && (
          <div data-screen-label="bin">
            <BinPage onClose={() => go('settings', null)} />
          </div>
        )}
        </div>
        </ErrorBoundary>
      </main>
      <MobileBottomNav tab={tab} selectTab={selectTab} hidden={navHidden} />
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tab={tab}
        selectTab={selectTab}
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
      <AddSurface
        open={addOpen}
        initialSection={addSec}
        initialTarget={addTarget}
        pendingImport={pendingImport}
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
          go(what === 'film' ? 'movies' : 'library', null)
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
