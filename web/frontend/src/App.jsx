import { useEffect, useRef, useState } from 'react'
import Home, { QuickCapture, tzOffsetMinutes } from './Home.jsx'
import AddSurface from './AddSurface.jsx'
import Library from './Library.jsx'
import MetadataPage from './MetadataPage.jsx'
import Movies from './Movies.jsx'
import TagsPage from './TagsPage.jsx'
import SearchPage from './SearchPage.jsx'
import Settings from './Settings.jsx'
import { applyTheme } from './theme.js'
import { DEMO, apiURL, coverImgURL, json, upload } from './api.js'
import {
  EdgeRow,
  ErrorBoundary,
  ErrorText,
  Field,
  FilmButton,
  GhostButton,
  IconBack,
  IconMenu,
  IconPlus,
  IconSearch,
  Sprockets,
  StickerButton,
  ToastHost,
  Toggle,
  frameCode,
  toast,
  useBodyScrollLock,
  useFrameBase,
  useIsMobileScreen,
  useResolvedDark,
} from './ui.jsx'
import { Profile, UserManagement } from './Account.jsx'

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
  useEffect(() => {
    if (user) applyTheme(user.preferences || {})
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
          Demo · dummy data, read-only · <a href="https://github.com/aaronified/tippani">the real, self-hosted app →</a>
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
        placeholder="password"
        type="password"
        value={password}
        autoComplete={action === '/auth/login' ? 'current-password' : 'new-password'}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <Primary className="mt-4 w-full" disabled={busy}>
        {cta}
      </Primary>
      {microcopy && <p className="microcopy mt-5 text-center">{microcopy}</p>}
    </form>
  )
}

// Onboarding — paper-light centered card; first account becomes admin (§8.1).
// When the server holds a backup archive (backup ≠ null, from /auth/status),
// a second card offers restoring it instead — the moving-to-a-new-box path.
function Onboarding({ onDone, backup }) {
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState('')
  useEffect(() => {
    applyTheme({ aesthetic: 'paper', theme: 'light' })
  }, [])

  async function restore() {
    setRestoring(true)
    setRestoreError('')
    try {
      const r = await json('POST', '/auth/restore')
      if (!r.ok) {
        setRestoring(false)
        return setRestoreError((r.data && r.data.error) || 'restore failed')
      }
      toast('restore complete — log in with your account from the backup')
      // Reload → /auth/status now reports onboarding closed → the login screen.
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      // A large restore can outlive the connection even when it succeeds
      // server-side; reload to re-check /auth/status rather than freeze here.
      setTimeout(() => window.location.reload(), 1200)
    }
  }

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
      {backup && (
        <div className="hand-card w-full max-w-sm px-8 py-6 text-center">
          <p className="mono-label mb-2">or restore a backup</p>
          <p className="text-sm" style={{ color: 'var(--soft)' }}>
            This server has a backup from{' '}
            <b>{new Date(backup.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</b>.
            Restoring loads everything in it — accounts, libraries and settings — then you log in
            with the credentials from that backup.
          </p>
          <GhostButton className="mt-4 w-full" onClick={restore} disabled={restoring}>
            {restoring ? 'Restoring…' : 'Restore this backup'}
          </GhostButton>
          <div className="mt-2">
            <ErrorText>{restoreError}</ErrorText>
          </div>
        </div>
      )}
    </main>
  )
}

// Login — film-dark strip with sprockets + frame code + Bengali subtitle (§8.2).
function Login({ onLogin }) {
  useEffect(() => {
    applyTheme({ aesthetic: 'film', theme: 'dark' })
  }, [])
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
const CONTENT_TABS = [
  ['home', 'Home'],
  ['library', 'Library'],
  ['movies', 'Catalogue'],
  ['search', 'Search'],
]
const UTILITY_TABS = [
  ['tags', 'Tags'],
  ['metadata', 'Metadata'],
  ['settings', 'Settings'],
]

// TabIcon — a small line glyph per nav tab (§7). Stroke is currentColor so the
// active-tab accent tint flows through it. Keyed by the tab key in TABS; the
// Catalogue reel reuses the drawing salvaged from the retired cover-size slider.
function TabIcon({ name }) {
  const p = {
    width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2.0, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }
  switch (name) {
    case 'home': // house
      return (
        <svg {...p}>
          <path d="M4 11.2 12 4.5l8 6.7" />
          <path d="M6 9.8V19a1 1 0 0 0 1 1h3.4v-4.6a1.6 1.6 0 0 1 3.2 0V20H17a1 1 0 0 0 1-1V9.8" />
        </svg>
      )
    case 'library': // open book
      return (
        <svg {...p}>
          <path d="M12 6c-1.5-1-4-1.6-6.5-1.6V17c2.5 0 5 .6 6.5 1.6 1.5-1 4-1.6 6.5-1.6V4.4C16 4.4 13.5 5 12 6Z" />
          <path d="M12 6v12.6" />
        </svg>
      )
    case 'movies': // film reel
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="6.4" r="1" />
          <circle cx="17.6" cy="12" r="1" />
          <circle cx="12" cy="17.6" r="1" />
          <circle cx="6.4" cy="12" r="1" />
        </svg>
      )
    case 'metadata': // stacked records
      return (
        <svg {...p}>
          <rect x="4.5" y="8.5" width="11.5" height="10" rx="2" />
          <path d="M7.5 6.2h8A2.5 2.5 0 0 1 18 8.7v7.8" />
        </svg>
      )
    case 'import': // tray + down arrow
      return (
        <svg {...p}>
          <path d="M5 13.5V17a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 17v-3.5" />
          <path d="M12 4v9" />
          <path d="m8.5 9.5 3.5 3.5 3.5-3.5" />
        </svg>
      )
    case 'search': // magnifier
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.7-4.7" />
        </svg>
      )
    case 'tags': // tag
      return (
        <svg {...p}>
          <path d="M4 12.7V5.5A1.5 1.5 0 0 1 5.5 4h7.2a2 2 0 0 1 1.4.6l6 6a1.8 1.8 0 0 1 0 2.5l-6.4 6.4a1.8 1.8 0 0 1-2.5 0l-6-6a2 2 0 0 1-.6-1.4Z" />
          <circle cx="8.8" cy="8.8" r="1.2" />
        </svg>
      )
    case 'settings': // sliders
      return (
        <svg {...p}>
          <path d="M4 8h9" />
          <path d="M17 8h3" />
          <circle cx="15" cy="8" r="2" />
          <path d="M4 16h3" />
          <path d="M11 16h9" />
          <circle cx="9" cy="16" r="2" />
        </svg>
      )
    default:
      return null
  }
}

// AvatarControl uploads / clears the user's avatar image from the user-chip
// menu. Upload is immediate (its own endpoint, ≤5 MB); on success the new path
// is lifted to App so the chip re-renders. The image is served from /covers.
function AvatarControl({ user, onUser }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function onFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = '' // allow re-picking the same file
    if (!f) return
    setBusy(true)
    setErr('')
    const r = await upload('/auth/me/avatar', f)
    setBusy(false)
    if (r.ok) onUser({ avatar_path: r.data.avatar_path })
    else setErr(r.data?.error || 'upload failed')
  }
  async function remove() {
    const r = await json('DELETE', '/auth/me/avatar')
    if (r.ok) onUser({ avatar_path: '' })
  }
  return (
    <div className="mb-2 flex flex-col gap-0.5">
      <label className="menu-item" style={{ cursor: 'pointer' }}>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        <span aria-hidden="true">☺</span>
        {busy ? 'Uploading…' : user.avatar_path ? 'Change photo' : 'Upload photo'}
      </label>
      {user.avatar_path && (
        <button className="menu-item" onClick={remove}>
          <span aria-hidden="true">⌫</span>
          Remove photo
        </button>
      )}
      {err && <p className="tp-error px-1" style={{ fontSize: 12 }}>{err}</p>}
    </div>
  )
}

// NavToggle/UserMenu render in both the topbar (desktop) and bottom-nav
// (mobile) — CSS shows only one at a time, but both stay mounted, so these are
// real components (not inline closures in Shell) to avoid remounting the
// Toggle's measured DOM state and the avatar upload state on every render.
// tabOptions renders a [key,label] list as Toggle segments (icon + label).
function tabOptions(pairs) {
  return pairs.map(([key, label]) => [key, <><TabIcon name={key} /> <span className="tab-label">{label}</span></>])
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

// AccountMenu — the avatar chip and its dropdown: Profile · User management
// (admin) · Log out. Self-contained (own open state + outside-click). Profile /
// User management open via onOpenView; AccountOverlay decides pop-up vs page.
// Avatar upload + password now live inside Profile, not here.
function AccountMenu({ user, onOpenView, logout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const openView = (v) => { setOpen(false); onOpenView(v) }
  return (
    <div className="relative user-menu" ref={ref}>
      <button className="user-chip" title={user.username} aria-haspopup="true" aria-expanded={open} aria-label="Account" onClick={() => setOpen((m) => !m)}>
        <UserAvatar user={user} />
      </button>
      {open && (
        <div className="hand-card hc-r2 user-menu-panel z-50 min-w-48 px-3 py-3 text-left" style={{ right: 0 }}>
          <p className="mono-label mb-2 px-1">{user.username}{user.is_admin ? ' · admin' : ''}</p>
          <div className="mb-2 flex flex-col gap-0.5">
            <button className="menu-item" onClick={() => openView('profile')}>
              <span aria-hidden="true">☺</span> Profile
            </button>
            {user.is_admin && (
              <button className="menu-item" onClick={() => openView('users')}>
                <span aria-hidden="true">⚐</span> User management
              </button>
            )}
          </div>
          <GhostButton className="w-full" onClick={logout}>Log out</GhostButton>
        </div>
      )}
    </div>
  )
}

// AccountOverlay frames Profile / User management: a centered pop-up on desktop
// (few options), a full-screen page on phones. Escape / backdrop / back closes.
function AccountOverlay({ view, user, onUser, onClose }) {
  const mobile = useIsMobileScreen()
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const title = view === 'users' ? 'User management' : 'Profile'
  const body = view === 'users' ? <UserManagement me={user} /> : <Profile user={user} onUser={onUser} />
  if (mobile) {
    return (
      <div className="account-page" role="dialog" aria-label={title}>
        <header className="account-page-bar">
          <button type="button" className="mobile-topbar-btn" onClick={onClose} aria-label="Back"><IconBack /></button>
          <span className="account-page-title">{title}</span>
        </header>
        <div className="account-page-body">{body}</div>
      </div>
    )
  }
  return (
    <div className="account-scrim" onMouseDown={onClose}>
      <div className="account-modal" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="account-modal-bar">
          <h2 className="account-modal-title">{title}</h2>
          <button type="button" className="account-close" onClick={onClose} aria-label="Close">×</button>
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
const ROUTE_TABS = ['search', 'tags', 'metadata', 'settings']
function parsePath(pathname) {
  const [a, b] = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  // "/" is the Home screen (daily review); unknown paths land there too.
  if (!a) return { tab: 'home', detail: null }
  if (a === 'books' && b) return { tab: 'library', detail: { type: 'book', id: Number(b) } }
  // The catalogue tab's canonical URL is /catalogue (matching its label); /movies
  // is still accepted so old links/bookmarks keep working.
  if ((a === 'catalogue' || a === 'movies') && b) return { tab: 'movies', detail: { type: 'movie', id: Number(b) } }
  if (a === 'library') return { tab: 'library', detail: null }
  if (a === 'movies' || a === 'catalogue') return { tab: 'movies', detail: null }
  // /import is no longer a tab (§7 One "＋ Add"); an old link opens the Add
  // surface on its Import section over Home — handled by the Shell.
  if (a === 'import') return { tab: 'import', detail: null }
  if (ROUTE_TABS.includes(a)) return { tab: a, detail: null }
  return { tab: 'home', detail: null }
}
function statePath(tab, detail) {
  if (detail?.type === 'book') return `/books/${detail.id}`
  if (detail?.type === 'movie') return `/catalogue/${detail.id}`
  if (tab === 'home') return '/'
  if (tab === 'library') return '/library'
  if (tab === 'movies') return '/catalogue'
  return `/${tab}`
}

// Scroll memory: the last TWO list pages keep their scroll position, so
// opening a detail (or hopping tabs) and coming back lands where you left.
// Insertion order makes the Map an LRU; older pages expire to a fresh scroll.
const scrollMem = new Map() // list path → window.scrollY
function rememberScroll(key) {
  scrollMem.delete(key) // re-set moves the key to newest
  scrollMem.set(key, window.scrollY)
  while (scrollMem.size > 2) scrollMem.delete(scrollMem.keys().next().value)
}

// The drawer's nav rows, in order; null marks the divider between the primary
// screens and the utility group (Tags · Metadata · Settings — the same trio,
// in the same order, as the desktop navbar's utility cluster).
const DRAWER_TABS = [
  ['home', 'Home'],
  ['library', 'Library'],
  ['movies', 'Catalogue'],
  ['search', 'Search'],
  null,
  ['tags', 'Tags'],
  ['metadata', 'Metadata'],
  ['settings', 'Settings'],
]

// UserAvatar — the squircle chip content, shared by the top bars and drawer.
function UserAvatar({ user }) {
  return user.avatar_path
    ? <img src={coverImgURL(user.avatar_path)} alt="" />
    : (user.username || '?').trim().charAt(0).toLowerCase()
}

// Drawer — the hamburger nav (§7 redesign): primary nav on mobile, opened by
// the ☰ button or the avatar chip. Scrim tap / Escape / any navigation closes
// it. Home carries the pending-review dot; Library/Catalogue show live counts.
function Drawer({ open, onClose, tab, selectTab, onAdd, user, stats, pending, update, logout, dark, onUser }) {
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
          review · capture
        </span>
      )
    }
    if (key === 'library' && stats) return <span className="drawer-badge">{stats.books}</span>
    if (key === 'movies' && stats) return <span className="drawer-badge">{stats.movies}</span>
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
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' }}>
              tippani
            </p>
            <p className="bengali" style={{ fontSize: 11.5, color: 'var(--amber)' }} aria-hidden="true">
              টিপ্পনী · a marginal annotation
            </p>
          </div>
        </div>
        <div className="drawer-nav">
          {/* §7 One "＋ Add": Import is no longer a nav row — the single Add
              surface (book · film · import) leads the drawer instead. */}
          <button
            type="button"
            className="drawer-item drawer-add"
            onClick={() => { onAdd(); onClose() }}
          >
            <IconPlus />
            Add
            <span className="drawer-badge">book · film · import</span>
          </button>
          {DRAWER_TABS.map((t, i) =>
            t === null ? (
              <div key={`div-${i}`} className="drawer-divider" aria-hidden="true" />
            ) : (
              <button
                key={t[0]}
                type="button"
                className={'drawer-item' + (tab === t[0] ? ' active' : '')}
                aria-current={tab === t[0] ? 'page' : undefined}
                onClick={() => { selectTab(t[0]); onClose() }}
              >
                <TabIcon name={t[0]} />
                {t[1]}
                {badge(t[0])}
              </button>
            ),
          )}
        </div>
        <div className="drawer-footer">
          <span className="user-chip" aria-hidden="true">
            <UserAvatar user={user} />
          </span>
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 13.5, fontWeight: 600 }}>{user.username}</p>
            <p className="mono-label" style={{ fontSize: 9 }}>
              {user.is_admin ? 'admin · self-hosted' : 'self-hosted'}
            </p>
          </div>
          {/* Profile / photo / password live behind the avatar chip now. */}
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
          <a
            href={user.releases_url || 'https://github.com/aaronified/tippani/releases'}
            target="_blank"
            rel="noopener noreferrer"
            className="mono-label"
            style={{ fontSize: 10, letterSpacing: '.04em', color: 'var(--faint)' }}
            title="Release notes & changelog on GitHub"
          >
            v{user.version || 'dev'} · changelog ↗
          </a>
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

// Shell is the logged-in frame (§7): on desktop a topbar with the (tappable)
// mark + wordmark, tab strip and user-initial chip; on a phone a slim top bar
// whose ☰ drawer owns primary nav — logo taps Home, ＋ captures a quote. A
// {type, id} detail state lets lists and search open detail views; tab +
// detail are mirrored to the URL via the History API.
function Shell({ user, onLogout, onPreferences, onUser }) {
  const initial = parsePath(typeof window !== 'undefined' ? window.location.pathname : '/')
  // /import isn't a tab any more — start on Home and open the Add surface there.
  const initialTab = initial.tab === 'import' ? 'home' : initial.tab
  const [tab, setTab] = useState(initialTab)
  const [detail, setDetail] = useState(initial.detail) // {type: 'book' | 'movie', id}
  const [accountView, setAccountView] = useState(null) // null | 'profile' | 'users'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  // The single "＋ Add" surface (§7 One "＋ Add"): book · film · import.
  const [addOpen, setAddOpen] = useState(false)
  const [addSection, setAddSection] = useState('book')
  const openAdd = (section = 'book') => {
    setAddSection(section)
    setAddOpen(true)
  }
  // pending = cards left in today's review deck; feeds the notification dot on
  // the brand mark and the drawer's Home row. Seeded once here, then kept
  // honest by the Home screen as answers land.
  const [pending, setPending] = useState(0)
  const [stats, setStats] = useState(null) // drawer counts + Home stat tiles
  // Update-check result, shared so the mobile drawer's "update available" link
  // mirrors the Settings → Updates card. Populated on demand when an admin runs
  // the check (Tippani never contacts GitHub on its own), then cached here for
  // the rest of the session.
  const [update, setUpdate] = useState(null)
  const dark = useResolvedDark()
  const [navRef, navIconOnly] = useIconOnlyNav()

  const refreshStats = () => {
    json('GET', '/stats').then((r) => { if (r.ok) setStats(r.data) })
  }
  useEffect(() => {
    refreshStats()
    json('GET', `/review/daily?offset=${tzOffsetMinutes()}`).then((r) => {
      if (r.ok) setPending((r.data.items || []).length)
    })
    // An old /import link lands here — open the Add surface on Import.
    if (initial.tab === 'import') openAdd('import')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function logout() {
    await fetch(apiURL('/auth/logout'), { method: 'POST' })
    onLogout()
  }

  const brandDot = pending > 0 && <span className="review-dot" aria-hidden="true" />

  return (
    <div className={'min-h-screen' + (!detail ? ' has-mobile-topbar' : '')}>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" title="Home — daily review" onClick={() => selectTab('home')}>
            {/* the mark matches the 28px nav tab icons so the row reads level */}
            <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="28" height="28" />
            <span className="wordmark">tippani</span>
            {brandDot}
          </button>
          <nav ref={navRef} aria-label="Primary" className={'topbar-nav' + (navIconOnly ? ' icon-only' : '')}>
            <DesktopNav tab={tab} onChange={selectTab} />
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            {/* §7 One "＋ Add": the single way to add a book, a film, or import. */}
            <button
              type="button"
              className="topbar-add-btn tactile"
              onClick={() => openAdd('book')}
              title="Add a book or film, or import highlights"
            >
              <IconPlus />
              <span>Add</span>
            </button>
            <AccountMenu user={user} onOpenView={setAccountView} logout={logout} />
          </div>
        </div>
      </header>
      <main className="container-tp">
        {/* Mobile shell bar (hidden on desktop): drawer · logo→Home · ＋ ·
            search · avatar. Detail screens drop it — their own back+title bar
            (inside the page) takes over the top edge instead. */}
        {!detail && (
          <header className="mobile-topbar">
            <button type="button" className="mobile-topbar-btn" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
              <IconMenu />
            </button>
            <button type="button" className="brand" title="Home — daily review" onClick={() => selectTab('home')}>
              <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="26" height="26" />
              <span className="wordmark">tippani</span>
              {brandDot}
            </button>
            <span className="flex-1" />
            {/* §7 One "＋ Add": same surface as the desktop pill — book · film ·
                import toggle. Quote capture lives on the Home capture tile. */}
            <button type="button" className="mobile-topbar-btn" aria-label="Add a book or film, or import highlights" onClick={() => openAdd('book')}>
              <IconPlus />
            </button>
            <button type="button" className="mobile-topbar-btn" aria-label="Search" onClick={() => selectTab('search')}>
              <IconSearch />
            </button>
            <AccountMenu user={user} onOpenView={setAccountView} logout={logout} />
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
              onCapture={() => setCaptureOpen(true)}
              onPending={setPending}
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
            />
          </div>
        )}
        {tab === 'movies' && (
          <div data-screen-label="movies">
            <Movies
              openId={detail?.type === 'movie' ? detail.id : null}
              onOpen={openMovie}
              onClose={() => go('movies', null)}
            />
          </div>
        )}
        {tab === 'metadata' && (
          <div data-screen-label="metadata">
            <MetadataPage
              user={user}
              onOpenBook={openBook}
              onOpenMovie={openMovie}
              onSearch={(q) => {
                // Seed the search screen's persisted state before it mounts (it
                // reads localStorage once); scope resets so hits aren't hidden
                // by a stale books/movies pick.
                try {
                  localStorage.setItem('tippani:search:q', JSON.stringify(q))
                  localStorage.setItem('tippani:search:scope', JSON.stringify('all'))
                } catch { /* private mode — search just opens empty */ }
                selectTab('search')
              }}
            />
          </div>
        )}
        {tab === 'search' && (
          <div data-screen-label="search">
            <SearchPage onOpenBook={openBook} onOpenMovie={openMovie} creditSeparators={user.preferences?.creditSeparators} />
          </div>
        )}
        {tab === 'tags' && (
          <div data-screen-label="tags">
            <TagsPage />
          </div>
        )}
        {tab === 'settings' && (
          <div data-screen-label="settings">
            <Settings user={user} onPreferences={onPreferences} update={update} onUpdateInfo={setUpdate} />
          </div>
        )}
        </div>
        </ErrorBoundary>
      </main>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tab={tab}
        selectTab={selectTab}
        onAdd={() => openAdd('book')}
        user={user}
        stats={stats}
        pending={pending}
        update={update}
        logout={logout}
        dark={dark}
        onUser={onUser}
      />
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} onSaved={refreshStats} />
      <AddSurface
        open={addOpen}
        initialSection={addSection}
        onClose={() => setAddOpen(false)}
        onAdded={(what) => {
          setAddOpen(false)
          refreshStats()
          // Land on the list for what was just added so it's visible.
          go(what === 'film' ? 'movies' : 'library', null)
        }}
        onOpenMovie={openMovie}
      />
      {accountView && (
        <AccountOverlay view={accountView} user={user} onUser={onUser} onClose={() => setAccountView(null)} />
      )}
    </div>
  )
}
