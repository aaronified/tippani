import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import { inputClass, buttonClass, cardClass, deleteButtonClass, ErrorText } from './ui.jsx'

// Settings: change password, plus the admin-only user management panel.
export default function Settings({ user }) {
  return (
    <section className="space-y-8">
      <PasswordForm />
      {user.is_admin && <AdminUsers me={user} />}
    </section>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setDone(false)
    const r = await json('POST', '/auth/password', { current, new: next })
    setBusy(false)
    if (r.ok) {
      setCurrent('')
      setNext('')
      setDone(true)
    } else {
      setError(errText(r, 'could not change password'))
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Change password
      </h3>
      <form onSubmit={submit} className={cardClass + ' max-w-sm space-y-3 p-4'}>
        <input
          className={inputClass}
          placeholder="Current password"
          type="password"
          value={current}
          autoComplete="current-password"
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="New password (min 8)"
          type="password"
          value={next}
          autoComplete="new-password"
          onChange={(e) => setNext(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        {done && <p className="text-sm text-neutral-500 dark:text-neutral-400">Password updated.</p>}
        <button className={buttonClass} disabled={busy}>
          Change password
        </button>
      </form>
    </div>
  )
}

// AdminUsers is the minimal in-app user management panel (admin only).
function AdminUsers({ me }) {
  const [users, setUsers] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const r = await json('GET', '/admin/users')
    if (r.ok) setUsers(r.data.users)
  }
  useEffect(() => {
    load()
  }, [])

  async function addUser(e) {
    e.preventDefault()
    setError('')
    const r = await json('POST', '/admin/users', { username, password })
    if (r.ok) {
      setUsername('')
      setPassword('')
      load()
    } else {
      setError(errText(r, 'could not add user'))
    }
  }

  async function removeUser(u) {
    if (!confirm(`Delete user "${u.username}"? Their books and annotations are removed too.`)) return
    const r = await json('DELETE', `/admin/users/${u.id}`)
    if (r.ok) load()
    else setError(errText(r, 'could not delete user'))
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Users
      </h3>
      <ul className={cardClass + ' divide-y divide-neutral-200 dark:divide-neutral-800'}>
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>
              {u.username}
              {u.is_admin && <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">admin</span>}
            </span>
            {u.id !== me.id && (
              <button onClick={() => removeUser(u)} className={deleteButtonClass}>
                delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addUser} className="flex flex-wrap items-start gap-2">
        <input
          className={inputClass + ' min-w-[8rem] flex-1'}
          placeholder="New username"
          value={username}
          autoComplete="off"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={inputClass + ' min-w-[8rem] flex-1'}
          placeholder="Password (min 8)"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className={buttonClass}>Add</button>
      </form>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
