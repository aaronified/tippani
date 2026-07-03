import { useEffect, useState } from 'react'

// Scaffold shell: first-run onboarding, login, and (for the admin) in-app user
// management. The real UI (library, annotations, search) is built against the
// API in docs/PLAN.md §7.
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
  if (user) return <Home user={user} onLogout={() => setUser(null)} />
  if (needsOnboarding) return <Onboarding onDone={setUser} />
  return <Login onLogin={setUser} />
}

// refreshMe loads the full session user (including is_admin) after auth.
async function refreshMe() {
  const r = await fetch('/auth/me')
  return r.ok ? r.json() : null
}

const cardClass =
  'w-80 space-y-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6'
const inputClass =
  'w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm dark:text-neutral-100'
const buttonClass =
  'w-full rounded bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900 disabled:opacity-50'

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
      <form onSubmit={submit} className={cardClass}>
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className={buttonClass} disabled={busy}>
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

function Home({ user, onLogout }) {
  async function logout() {
    await fetch('/auth/logout', { method: 'POST' })
    onLogout()
  }
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8 text-neutral-900 dark:text-neutral-100">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold">Tippani</h1>
        <button onClick={logout} className="text-sm underline">
          Log out ({user.username})
        </button>
      </div>
      <p className="max-w-2xl mx-auto mt-8 text-sm text-neutral-600 dark:text-neutral-400">
        Logged in. Library, annotations, and search UI land with the next milestones (docs/PLAN.md §9).
      </p>
      {user.is_admin && <AdminUsers me={user} />}
    </main>
  )
}

// AdminUsers is the minimal in-app user management panel (admin only).
function AdminUsers({ me }) {
  const [users, setUsers] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const r = await fetch('/admin/users')
    if (r.ok) setUsers((await r.json()).users)
  }
  useEffect(() => {
    load()
  }, [])

  async function addUser(e) {
    e.preventDefault()
    setError('')
    const r = await fetch('/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (r.ok) {
      setUsername('')
      setPassword('')
      load()
    } else {
      setError((await r.json().catch(() => ({}))).error || 'could not add user')
    }
  }

  async function removeUser(u) {
    if (!confirm(`Delete user "${u.username}"? Their books and annotations are removed too.`)) return
    const r = await fetch(`/admin/users/${u.id}`, { method: 'DELETE' })
    if (r.ok) load()
  }

  return (
    <section className="max-w-2xl mx-auto mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Users
      </h2>
      <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>
              {u.username}
              {u.is_admin && <span className="ml-2 text-xs text-neutral-400">admin</span>}
            </span>
            {u.id !== me.id && (
              <button onClick={() => removeUser(u)} className="text-xs text-red-600 underline">
                delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addUser} className="mt-4 flex flex-wrap items-start gap-2">
        <input
          className={inputClass + ' flex-1 min-w-[8rem]'}
          placeholder="New username"
          value={username}
          autoComplete="off"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={inputClass + ' flex-1 min-w-[8rem]'}
          placeholder="Password (min 8)"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="rounded bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900">
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
