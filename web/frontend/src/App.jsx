import { useEffect, useState } from 'react'
import Library from './Library.jsx'
import Movies from './Movies.jsx'
import SearchPage from './SearchPage.jsx'
import Settings from './Settings.jsx'
import { cardClass, inputClass, buttonClass, ErrorText } from './ui.jsx'

// App is the auth gate: first-run onboarding, login, then the logged-in shell.
export default function App() {
  const [user, setUser] = useState(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) return setUser(u)
        return fetch('/auth/status')
          .then((r) => r.json())
          .then((s) => setNeedsOnboarding(s.needs_onboarding))
      })
      .finally(() => setChecking(false))
  }, [])

  if (checking) return null
  if (user) return <Shell user={user} onLogout={() => setUser(null)} />
  if (needsOnboarding) return <Onboarding onDone={setUser} />
  return <Login onLogin={setUser} />
}

// refreshMe loads the full session user (including is_admin) after auth.
async function refreshMe() {
  const r = await fetch('/auth/me')
  return r.ok ? r.json() : null
}

// CredentialForm is the shared username/password form for login and onboarding.
function CredentialForm({ title, subtitle, action, cta, onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await fetch(action, {
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <form onSubmit={submit} className={cardClass + ' w-80 space-y-4 p-6'}>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
        </div>
        <input
          className={inputClass}
          placeholder="Username"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Password"
          type="password"
          value={password}
          autoComplete={action === '/auth/login' ? 'current-password' : 'new-password'}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        <button className={buttonClass + ' w-full'} disabled={busy}>
          {cta}
        </button>
      </form>
    </main>
  )
}

function Login({ onLogin }) {
  return <CredentialForm title="Tippani" action="/auth/login" cta="Log in" onSuccess={onLogin} />
}

function Onboarding({ onDone }) {
  return (
    <CredentialForm
      title="Welcome to Tippani"
      subtitle="Create the admin account to get started."
      action="/auth/signup"
      cta="Create admin account"
      onSuccess={onDone}
    />
  )
}

const TABS = [
  ['library', 'Library'],
  ['movies', 'Movies'],
  ['search', 'Search'],
  ['settings', 'Settings'],
]

// Shell is the logged-in frame: header with tab nav + logout, and a
// {type, id} detail state so lists and search can open detail views (no router).
function Shell({ user, onLogout }) {
  const [tab, setTab] = useState('library')
  const [detail, setDetail] = useState(null) // {type: 'book' | 'movie', id}

  function selectTab(t) {
    setTab(t)
    setDetail(null)
  }
  function openBook(id) {
    setTab('library')
    setDetail({ type: 'book', id })
  }
  function openMovie(id) {
    setTab('movies')
    setDetail({ type: 'movie', id })
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <h1 className="text-base font-semibold">Tippani</h1>
          <nav className="flex gap-1 text-sm">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => selectTab(key)}
                className={
                  'rounded px-3 py-1.5 ' +
                  (tab === key
                    ? 'bg-neutral-100 dark:bg-neutral-800 font-medium'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100')
                }
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            onClick={logout}
            className="ml-auto text-sm text-neutral-500 dark:text-neutral-400 underline hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Log out ({user.username})
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {tab === 'library' && (
          <Library
            openId={detail?.type === 'book' ? detail.id : null}
            onOpen={openBook}
            onClose={() => setDetail(null)}
          />
        )}
        {tab === 'movies' && (
          <Movies
            openId={detail?.type === 'movie' ? detail.id : null}
            onOpen={openMovie}
            onClose={() => setDetail(null)}
          />
        )}
        {tab === 'search' && <SearchPage onOpenBook={openBook} onOpenMovie={openMovie} />}
        {tab === 'settings' && <Settings user={user} />}
      </main>
    </div>
  )
}
