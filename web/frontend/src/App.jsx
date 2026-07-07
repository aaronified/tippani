import { useEffect, useRef, useState } from 'react'
import ImportPage from './ImportPage.jsx'
import Library from './Library.jsx'
import MetadataPage from './MetadataPage.jsx'
import Movies from './Movies.jsx'
import TagsPage from './TagsPage.jsx'
import SearchPage from './SearchPage.jsx'
import Settings from './Settings.jsx'
import { applyTheme } from './theme.js'
import { apiURL, json, upload } from './api.js'
import {
  ErrorText,
  Field,
  FilmButton,
  GhostButton,
  Sprockets,
  EdgeRow,
  StickerButton,
  Toggle,
  frameCode,
  useFrameBase,
  useResolvedDark,
} from './ui.jsx'

// DEMO: the read-only GitHub Pages build (VITE_DEMO=1). A fetch shim (demo/
// install.js) serves dummy data and blocks writes; here it just suppresses URL
// history sync (the static site lives under a /tippani/ subpath, so pushing
// "/library" would point off-site) and shows a banner.
export const DEMO = import.meta.env.VITE_DEMO === '1'

// App is the auth gate: first-run onboarding, login, then the logged-in shell.
// The grain overlay (§5) sits above every screen, auth included.
export default function App() {
  const [user, setUser] = useState(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch(apiURL('/auth/me'))
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) return setUser(u)
        return fetch(apiURL('/auth/status'))
          .then((r) => r.json())
          .then((s) => setNeedsOnboarding(s.needs_onboarding))
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
    else if (needsOnboarding) screen = <Onboarding onDone={setUser} />
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
      {screen}
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
        if (me) return onSuccess(me)
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
function Onboarding({ onDone }) {
  useEffect(() => {
    applyTheme({ aesthetic: 'paper', theme: 'light' })
  }, [])
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
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

// Primary nav lives in the shell; the utility screens move under the user-chip
// menu so the nav stays focused on the four content areas.
const PRIMARY_TABS = [
  ['library', 'Library'],
  ['movies', 'Catalogue'],
  ['search', 'Search'],
  ['tags', 'Tags'],
]
const MENU_TABS = [
  ['import', 'Import'],
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

// ---- client-side routing (History API) ----
// Client routes own the root path space (the API lives under /api). A hard
// refresh on /books/42 is served index.html by the server, then Shell restores
// this state from the URL — and back/forward, including the mouse back button,
// just work.
const ROUTE_TABS = ['search', 'tags', 'import', 'metadata', 'settings']
function parsePath(pathname, home) {
  const [a, b] = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (!a) return { tab: home, detail: null }
  if (a === 'books' && b) return { tab: 'library', detail: { type: 'book', id: Number(b) } }
  // The catalogue tab's canonical URL is /catalogue (matching its label); /movies
  // is still accepted so old links/bookmarks keep working.
  if ((a === 'catalogue' || a === 'movies') && b) return { tab: 'movies', detail: { type: 'movie', id: Number(b) } }
  if (a === 'library') return { tab: 'library', detail: null }
  if (a === 'movies' || a === 'catalogue') return { tab: 'movies', detail: null }
  if (ROUTE_TABS.includes(a)) return { tab: a, detail: null }
  return { tab: home, detail: null }
}
function statePath(tab, detail) {
  if (detail?.type === 'book') return `/books/${detail.id}`
  if (detail?.type === 'movie') return `/catalogue/${detail.id}`
  if (tab === 'library') return '/library'
  if (tab === 'movies') return '/catalogue'
  return `/${tab}`
}

// Shell is the logged-in frame (§7): topbar with mark + wordmark + tabs +
// user-initial chip, and a {type, id} detail state so lists and search can open
// detail views. Tab + detail are mirrored to the URL via the History API.
function Shell({ user, onLogout, onPreferences, onUser }) {
  // The landing tab follows the URL, falling back to the start-page pref (§4).
  const home = user.preferences?.home === 'movies' ? 'movies' : 'library'
  const initial = parsePath(typeof window !== 'undefined' ? window.location.pathname : '/', home)
  const [tab, setTab] = useState(initial.tab)
  const [detail, setDetail] = useState(initial.detail) // {type: 'book' | 'movie', id}
  const [menuOpen, setMenuOpen] = useState(false)
  const dark = useResolvedDark()
  const menuRef = useRef(null)

  // Mirror tab/detail ↔ URL. popstate (back/forward) restores state from the
  // path; landing on "/" rewrites the bar to the resolved start page.
  useEffect(() => {
    if (DEMO) return // no URL sync under the static subpath
    const onPop = () => {
      const s = parsePath(window.location.pathname, home)
      setTab(s.tab)
      setDetail(s.detail)
    }
    window.addEventListener('popstate', onPop)
    const want = statePath(initial.tab, initial.detail)
    if (window.location.pathname !== want) window.history.replaceState({}, '', want)
    return () => window.removeEventListener('popstate', onPop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  // go() updates state AND pushes a history entry so the URL + back/forward track.
  function go(nextTab, nextDetail) {
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

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <img src={dark ? '/mark-dark.svg' : '/mark.svg'} alt="" width="24" height="24" />
            <span className="wordmark-mobile-hidden">tippani</span>
          </span>
          <nav aria-label="Primary" className="topbar-nav">
            <Toggle
              className="nav-toggle"
              ariaLabel="Primary"
              value={tab}
              onChange={selectTab}
              options={PRIMARY_TABS.map(([key, label]) => [key, <><TabIcon name={key} /> <span className="tab-label">{label}</span></>])}
            />
          </nav>
          <div className="relative ml-auto" ref={menuRef}>
            <button
              className="user-chip"
              title={user.username}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((m) => !m)}
            >
              {user.avatar_path
                ? <img src={`/api/covers/${user.avatar_path}`} alt="" />
                : (user.username || '?').trim().charAt(0).toLowerCase()}
            </button>
            {menuOpen && (
              <div className="hand-card hc-r2 absolute right-0 z-50 mt-2 min-w-48 px-3 py-3 text-left">
                <p className="mono-label mb-2 px-1">
                  {user.username}
                  {user.is_admin ? ' · admin' : ''}
                </p>
                <AvatarControl user={user} onUser={onUser} />
                <div className="mb-2 flex flex-col gap-0.5">
                  {MENU_TABS.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { selectTab(key); setMenuOpen(false) }}
                      className={'menu-item' + (tab === key ? ' active' : '')}
                      aria-current={tab === key ? 'page' : undefined}
                    >
                      <TabIcon name={key} />
                      {label}
                    </button>
                  ))}
                </div>
                <GhostButton className="w-full" onClick={logout}>
                  Log out
                </GhostButton>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Primary">
        <Toggle
          className="nav-toggle"
          ariaLabel="Primary"
          value={tab}
          onChange={selectTab}
          options={PRIMARY_TABS.map(([key, label]) => [key, <><TabIcon name={key} /> <span className="tab-label">{label}</span></>])}
        />
      </nav>
      <main className="container-tp">
        <div className="tab-panel" key={tab}>
        {tab === 'library' && (
          <div data-screen-label="library">
            <Library
              openId={detail?.type === 'book' ? detail.id : null}
              onOpen={openBook}
              onClose={() => go('library', null)}
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
            <MetadataPage user={user} onOpenBook={openBook} onOpenMovie={openMovie} />
          </div>
        )}
        {tab === 'import' && (
          <div data-screen-label="import">
            <ImportPage onOpenMovie={openMovie} />
          </div>
        )}
        {tab === 'search' && (
          <div data-screen-label="search">
            <SearchPage onOpenBook={openBook} onOpenMovie={openMovie} />
          </div>
        )}
        {tab === 'tags' && (
          <div data-screen-label="tags">
            <TagsPage />
          </div>
        )}
        {tab === 'settings' && (
          <div data-screen-label="settings">
            <Settings user={user} onPreferences={onPreferences} />
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
