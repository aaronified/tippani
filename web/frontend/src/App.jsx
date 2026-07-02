import { useEffect, useState } from 'react'

// Scaffold shell: login + session check. The real UI (library, annotations,
// search) is built against the API in docs/PLAN.md §7.
export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setUser(u))
      .finally(() => setChecking(false))
  }, [])

  if (checking) return null
  return user ? <Home user={user} onLogout={() => setUser(null)} /> : <Login onLogin={setUser} />
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    const r = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (r.ok) onLogin(await r.json())
    else setError((await r.json()).error || 'login failed')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <form onSubmit={submit} className="w-80 space-y-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Tippani</h1>
        <input
          className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm dark:text-neutral-100"
          placeholder="Username" value={username} autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm dark:text-neutral-100"
          placeholder="Password" type="password" value={password} autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900">
          Log in
        </button>
      </form>
    </main>
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
        <button onClick={logout} className="text-sm underline">Log out ({user.username})</button>
      </div>
      <p className="max-w-2xl mx-auto mt-8 text-sm text-neutral-600 dark:text-neutral-400">
        Logged in. Library, annotations, and search UI land with the next milestones (docs/PLAN.md §9).
      </p>
    </main>
  )
}
