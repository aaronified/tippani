import { useEffect, useState } from 'react'
import { json, errText, coverImgURL, upload } from './api.js'
import { Card, ErrorText, GhostButton, IconDelete, InfoDot, MonoLabel, StickerButton, Tooltip } from './ui.jsx'

// Account.jsx — the chip-reached account surfaces: Profile (photo · display name
// · password) and User management (admin roles). On desktop these render inside
// a pop-up (see AccountOverlay in App.jsx); on mobile they fill a page. Both are
// plain content components; the overlay owns the framing + close.

function FieldLabel({ children }) {
  return <MonoLabel className="mb-1.5 block">{children}</MonoLabel>
}

// ---- Profile: photo, display name, password ----

// AvatarRow uploads / clears the caller's avatar (≤5 MB). Upload is immediate
// (its own endpoint); on success the new path is lifted to App so the chip and
// every avatar re-render. Moved here from the old chip menu / drawer footer.
function AvatarRow({ user, onUser }) {
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
    else setErr(errText(r, 'could not remove photo'))
  }
  return (
    <div className="flex items-center gap-4">
      <span className="user-chip" style={{ width: 56, height: 56, fontSize: 22 }} aria-hidden="true">
        {user.avatar_path ? <img src={coverImgURL(user.avatar_path)} alt="" /> : (user.username || '?').trim().charAt(0).toLowerCase()}
      </span>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="tp-btn tp-btn-primary" style={{ cursor: 'pointer' }}>
            {busy ? 'Uploading…' : user.avatar_path ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
          <InfoDot title="Profile photo" text="Shown as your avatar chip in the top bar, the drawer and the user list. A square image reads best; up to 5 MB." />
          {user.avatar_path && (
            <Tooltip label="Remove the photo">
              <button type="button" className="field-icon-btn field-icon-btn-danger tactile" aria-label="Remove photo" onClick={remove}>
                <IconDelete />
              </button>
            </Tooltip>
          )}
        </div>
        <ErrorText>{err}</ErrorText>
      </div>
    </div>
  )
}

function NameForm({ user, onUser }) {
  const [name, setName] = useState(user.username || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const dirty = name.trim() !== (user.username || '')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setDone(false)
    if (!name.trim()) return setErr('name cannot be blank')
    setBusy(true)
    const r = await json('PUT', '/auth/me', { username: name.trim() })
    setBusy(false)
    if (r.ok) {
      onUser({ username: r.data.username })
      setName(r.data.username)
      setDone(true)
    } else {
      setErr(errText(r, 'could not change name'))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <FieldLabel>Display name</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="tp-input"
          style={{ flex: 1, minWidth: 160 }}
          value={name}
          autoComplete="off"
          onChange={(e) => { setName(e.target.value); setDone(false) }}
        />
        <StickerButton disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save name'}</StickerButton>
      </div>
      {done && <p style={{ fontSize: 13, color: 'var(--soft)' }}>Name updated.</p>}
      <ErrorText>{err}</ErrorText>
    </form>
  )
}

// PasswordForm — moved verbatim from Settings; changing your password signs out
// every other session (the server re-issues the caller's).
function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (next !== repeat) return setError('new passwords do not match')
    setBusy(true)
    const r = await json('POST', '/auth/password', { current, new: next })
    setBusy(false)
    if (r.ok) {
      setCurrent('')
      setNext('')
      setRepeat('')
      setDone(true)
    } else {
      setError(errText(r, 'could not change password'))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <span className="flex items-center gap-1.5">
        <FieldLabel>Change password</FieldLabel>
        <InfoDot title="Change password" text="Changing your password signs out every other browser session. Paired phones are deliberately left alone, so a routine password change can’t silently unpair a device you can’t easily get to." />
      </span>
      <input className="tp-input" placeholder="current password" type="password" value={current} autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} />
      <input className="tp-input" placeholder="new password (min 8)" type="password" value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
      <input className="tp-input" placeholder="repeat new password" type="password" value={repeat} autoComplete="new-password" onChange={(e) => setRepeat(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      {done && <p style={{ fontSize: 13.5, color: 'var(--soft)' }}>Password updated.</p>}
      <StickerButton className="w-full" disabled={busy}>Update password</StickerButton>
    </form>
  )
}

// MaintenanceCard (admin only) — recovery tools that live in Profile: a
// non-destructive search-index rebuild (the fix for "search failed / internal
// error" from a corrupt full-text index) and the factory reset that wipes
// everything back to first-run onboarding.
function MaintenanceCard() {
  const [busy, setBusy] = useState('') // 'reindex' | 'reset' | ''
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [confirm, setConfirm] = useState('')

  async function reindex() {
    setBusy('reindex')
    setErr('')
    setMsg('')
    const r = await json('POST', '/admin/search/reindex')
    setBusy('')
    if (r.ok && r.data.ok) setMsg('Search index rebuilt — search should work again.')
    else if (r.ok)
      setErr(
        `Some indexes were too damaged to rebuild (${(r.data.failed || []).join(', ')}). ` +
          'If search stays broken, a full reset is the remaining option.',
      )
    else setErr(errText(r, 'could not rebuild the search index'))
  }

  async function reset() {
    if (confirm !== 'RESET') return
    setBusy('reset')
    setErr('')
    setMsg('')
    const r = await json('POST', '/admin/reset', { confirm: 'RESET' })
    if (r.ok) {
      // Fresh, empty database → reload into first-run onboarding.
      window.location.href = '/'
      return
    }
    setBusy('')
    setErr(errText(r, 'could not reset the database'))
  }

  // Both explanations moved into InfoDots. The reset one is deliberately still
  // long — a wall of consequences is the right amount of words for a button that
  // deletes an instance — but it now sits one tap behind a dot instead of
  // standing permanently between you and the harmless button above it.
  return (
    <Card pad="p-5">
      <FieldLabel>Maintenance</FieldLabel>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <p className="text-sm font-semibold">Rebuild search index</p>
            <InfoDot
              title="Rebuild search index"
              text="Fixes “search failed / internal error” by rebuilding the full-text indexes from your library. Non-destructive — no books, quotes or settings are touched."
            />
          </div>
          <GhostButton disabled={busy === 'reindex'} onClick={reindex}>
            {busy === 'reindex' ? 'Rebuilding…' : 'Rebuild'}
          </GhostButton>
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed var(--line)' }} />

        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold" style={{ color: 'var(--error)' }}>
              Reset all data
            </p>
            <InfoDot
              title="Reset all data"
              text="Permanently deletes everything — every account, all books, films, quotes, dialogue, tags, people, stickers, saved covers, metadata keys and preferences — and restarts Tippani at first-run admin-account creation. This cannot be undone, and there is no backup taken on the way."
            />
          </div>
          {!showReset ? (
            <GhostButton className="mt-2" onClick={() => setShowReset(true)}>
              Reset all data…
            </GhostButton>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="microcopy">
                Type <b>RESET</b> to confirm you want to delete everything:
              </p>
              <input
                className="tp-input"
                value={confirm}
                autoFocus
                placeholder="RESET"
                onChange={(e) => setConfirm(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="tp-btn"
                  style={{ background: 'var(--error)', color: '#fff', opacity: confirm === 'RESET' && busy !== 'reset' ? 1 : 0.55 }}
                  disabled={confirm !== 'RESET' || busy === 'reset'}
                  onClick={reset}
                >
                  {busy === 'reset' ? 'Resetting…' : 'Delete everything & restart'}
                </button>
                <GhostButton onClick={() => { setShowReset(false); setConfirm('') }}>Cancel</GhostButton>
              </div>
            </div>
          )}
        </div>

        {msg && <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>{msg}</p>}
        <ErrorText>{err}</ErrorText>
      </div>
    </Card>
  )
}

export function Profile({ user, onUser }) {
  return (
    <div className="space-y-5">
      <Card pad="p-5"><AvatarRow user={user} onUser={onUser} /></Card>
      <Card pad="p-5"><NameForm user={user} onUser={onUser} /></Card>
      <Card pad="p-5"><PasswordForm /></Card>
      {user?.is_admin && <MaintenanceCard />}
    </div>
  )
}

// ---- User management (admin only): add / remove / grant-revoke admin ----

export function UserManagement({ me }) {
  const [users, setUsers] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    const r = await json('GET', '/admin/users')
    if (r.ok) setUsers(r.data.users)
    else setError(errText(r, 'could not load users'))
  }
  useEffect(() => { load() }, [])

  const adminCount = users.filter((u) => u.is_admin).length

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

  async function setAdmin(u, is_admin) {
    setError('')
    setBusyId(u.id)
    const r = await json('PATCH', `/admin/users/${u.id}`, { is_admin })
    setBusyId(null)
    if (r.ok) load()
    else setError(errText(r, 'could not change role'))
  }

  async function removeUser(u) {
    if (!confirm(`Delete user "${u.username}"? Their books and annotations are removed too.`)) return
    setError('')
    const r = await json('DELETE', `/admin/users/${u.id}`)
    if (r.ok) load()
    else setError(errText(r, 'could not delete user'))
  }

  return (
    <Card pad="p-5">
      <ul className="space-y-1">
        {users.map((u) => {
          const isMe = u.id === me.id
          const lastAdmin = u.is_admin && adminCount <= 1
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
              <span className="user-chip" style={{ width: 30, height: 30, fontSize: 13 }} aria-hidden="true">
                {u.avatar_path ? <img src={coverImgURL(u.avatar_path)} alt="" /> : (u.username || '?').trim().charAt(0).toLowerCase()}
              </span>
              <span style={{ fontWeight: 600 }}>{u.username}</span>
              {u.is_admin && <span className="tp-chip" style={{ color: 'var(--accent-ui)' }}>admin</span>}
              {isMe && <span className="mono-label">you</span>}
              <span className="ml-auto flex items-center gap-2">
                {/* Grant/revoke admin. The last admin can't be demoted (server
                    enforces it too); disable the control so it's obvious. */}
                <button
                  type="button"
                  className="tp-chip tp-chip-btn"
                  disabled={busyId === u.id || lastAdmin}
                  title={lastAdmin ? 'the last admin can’t be demoted' : u.is_admin ? 'Revoke admin' : 'Grant admin'}
                  onClick={() => setAdmin(u, !u.is_admin)}
                >
                  {u.is_admin ? 'Revoke admin' : 'Make admin'}
                </button>
                {!isMe && (
                  <Tooltip label={`Delete ${u.username} and their library`} side="top">
                    <button
                      type="button"
                      onClick={() => removeUser(u)}
                      aria-label={`Delete ${u.username}`}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 16, padding: 4, lineHeight: 1, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </Tooltip>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <form onSubmit={addUser} className="mt-4 flex flex-wrap items-center gap-2">
        <input className="tp-input" style={{ flex: 1, minWidth: 130 }} placeholder="username" value={username} autoComplete="off" onChange={(e) => setUsername(e.target.value)} />
        <input className="tp-input" style={{ flex: 1, minWidth: 130 }} placeholder="password (min 8)" type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        <StickerButton>Add user</StickerButton>
        <InfoDot title="Adding users" text="Every user gets a fully separate library — books, quotes, tags, stickers and preferences are never shared. To hand over the primary admin, grant another user admin first, then revoke your own; the last remaining admin cannot be demoted." />
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}
