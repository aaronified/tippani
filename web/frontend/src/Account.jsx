import { useEffect, useState } from 'react'
import { json, errText, coverImgURL, upload } from './api.js'
import { Card, ErrorText, Field, FieldIconButton, GhostButton, IconDelete, IconKey, IconLogout, IconSwitchUser, IconUserPlus, InfoDot, MonoLabel, NameInput, StickerButton, Tooltip } from './ui.jsx'
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from './secret.js'
import { t, tNodes } from './i18n.js'

// The display name's ceiling. Not a security bound — just the width the greeting
// and the user list can lay out without wrapping into two lines.
const NAME_MAX = 40

// Account.jsx — the ONE chip-reached account surface: Profile. On desktop it
// renders inside a pop-up (see AccountOverlay in App.jsx); on mobile it fills a
// page. It is a plain content component; the overlay owns the framing + close.
//
// 1.4.1 collapsed a menu into this screen. The avatar chip used to open a
// dropdown offering Profile, User management (admins) and Log out, and the
// drawer repeated the same three rows — so "my account" was a menu of screens
// rather than a screen. The chip now opens Profile directly and everything that
// menu offered is a section here: switching accounts, logging out, and, for an
// admin, the user list. One tap instead of two, and one place to look.

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
    else setErr(r.data?.error || t('error.upload.failed'))
  }
  async function remove() {
    const r = await json('DELETE', '/auth/me/avatar')
    if (r.ok) onUser({ avatar_path: '' })
    else setErr(errText(r, t('error.remove.photo')))
  }
  return (
    <div className="flex items-center gap-4">
      <span className="user-chip" style={{ width: 56, height: 56, fontSize: 'var(--type-ui-22)' }} aria-hidden="true">
        {user.avatar_path ? <img src={coverImgURL(user.avatar_path)} alt="" /> : (user.username || '?').trim().charAt(0).toLowerCase()}
      </span>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="tp-btn tp-btn-primary" style={{ cursor: 'pointer' }}>
            {busy
              ? t('common.action.upload.busy')
              : user.avatar_path
                ? t('account.photo.change')
                : t('account.photo.upload')}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
          <InfoDot title={t('account.photo.info.title')} text={t('account.photo.info.body')} />
          {user.avatar_path && (
            <FieldIconButton
              icon={<IconDelete />}
              ariaLabel={t('account.photo.remove.aria')}
              onClick={remove}
              tooltip={t('account.photo.remove.tip')}
              danger
            />
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
    if (!name.trim()) return setErr(t('error.validate.name-cannot-be-blank'))
    setBusy(true)
    const r = await json('PUT', '/auth/me', { username: name.trim() })
    setBusy(false)
    if (r.ok) {
      onUser({ username: r.data.username })
      setName(r.data.username)
      setDone(true)
    } else {
      setErr(errText(r, t('error.save.name')))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <FieldLabel>{t('account.name.label')}</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <NameInput
          style={{ flex: 1, minWidth: 160 }}
          value={name}
          autoComplete="off"
          maxLength={NAME_MAX}
          onChange={(e) => { setName(e.target.value); setDone(false) }}
        />
        <StickerButton
          disabled={busy || !dirty || !name.trim()}
          title={!name.trim() ? t('error.validate.name-required') : undefined}
        >
          {busy ? t('common.action.save.busy') : t('account.name.save')}
        </StickerButton>
      </div>
      {done && <p style={{ fontSize: 'var(--type-ui-13)', color: 'var(--soft)' }}>{t('account.name.done')}</p>}
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

  // Every must-fill rule, in one expression the guard and the button share, so
  // the button cannot be pressable in a state the handler would refuse.
  const missing = !current
    ? t('error.validate.password-current-required')
    : passwordProblem(next) || (next !== repeat ? t('error.validate.password-mismatch') : '')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (missing) return setError(missing)
    setBusy(true)
    const r = await json('POST', '/auth/password', { current, new: next })
    setBusy(false)
    if (r.ok) {
      setCurrent('')
      setNext('')
      setRepeat('')
      setDone(true)
    } else {
      setError(errText(r, t('error.save.password')))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <span className="flex items-center gap-1.5">
        <FieldLabel>{t('account.password.label')}</FieldLabel>
        <InfoDot
          title={t('account.password.info.title')}
          text={t('account.password.info.body', { min: PASSWORD_MIN, max: PASSWORD_MAX })}
        />
      </span>
      <input className="tp-input" placeholder={t('account.password.current.placeholder')} type="password" value={current} autoComplete="current-password" maxLength={PASSWORD_MAX} onChange={(e) => setCurrent(e.target.value)} />
      <input className="tp-input" placeholder={t('account.password.new.placeholder', { min: PASSWORD_MIN, max: PASSWORD_MAX })} type="password" value={next} autoComplete="new-password" maxLength={PASSWORD_MAX} onChange={(e) => setNext(e.target.value)} />
      <input className="tp-input" placeholder={t('account.password.repeat.placeholder')} type="password" value={repeat} autoComplete="new-password" maxLength={PASSWORD_MAX} onChange={(e) => setRepeat(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      {done && <p style={{ fontSize: 'var(--type-ui-13)', color: 'var(--soft)' }}>{t('account.password.done')}</p>}
      {/* Greyed with the reason on it, rather than pressable and answering with
          an error a moment later. */}
      <StickerButton icon={<IconKey />} keepLabel className="w-full" disabled={busy || !!missing} title={missing || undefined}>
        {t('account.password.submit')}
      </StickerButton>
      {missing && next.length > 0 && <p className="microcopy" style={{ color: 'var(--faint)' }}>{missing}.</p>}
    </form>
  )
}

// SwitchAccount — sign in as someone else without going out through the login
// screen. It is a real re-authentication, not an impersonation: the password is
// checked by POST /auth/login exactly as it is at the front door, and the server
// retires the session you arrived with once the new one is issued. A wrong
// password changes nothing, which is why this can live one tap inside Profile.
function SwitchAccount({ me }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const sameUser = username.trim() === (me?.username || '')
  const missing = !username.trim()
    ? t('error.validate.switch-name-required')
    : sameUser
      ? t('error.validate.switch-same')
      : !password
        ? t('error.validate.switch-password-required')
        : ''

  async function submit(e) {
    e.preventDefault()
    if (missing) return setErr(missing)
    setBusy(true)
    setErr('')
    const r = await json('POST', '/auth/login', { username: username.trim(), password })
    if (r.ok) {
      // A whole new user's library, preferences and theme — a reload is the
      // honest way to get all of it, rather than patching a dozen caches.
      window.location.href = '/'
      return
    }
    setBusy(false)
    setErr(errText(r, t('error.switch.account')))
  }

  const close = () => { setOpen(false); setUsername(''); setPassword(''); setErr('') }

  return (
    <div>
      {/* THE SAME ROW SHAPE AS LOG OUT, which sits directly beneath it: label
          and dot on the left, the action on the right. They are two ways out of
          this account and they were laid out as two different kinds of thing —
          a heading over a full-width button here, a right-aligned button there
          — inside one card, which is the whole reason this section read badly.
          Nothing about the mechanism changed. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <p className="text-sm font-semibold">{t('account.switch.title')}</p>
          <InfoDot title={t('account.switch.info.title')} text={t('account.switch.info.body')} />
        </div>
        {!open && (
          <GhostButton icon={<IconSwitchUser />} keepLabel onClick={() => setOpen(true)}>
            {t('account.switch.action')}
          </GhostButton>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="switch-panel">
          {/* WHO YOU ARE LEAVING. The one fact this form is about, and it was
              nowhere on it — on a server where several accounts have the same
              small avatar and adjacent names, "switch" with no subject is a
              question about a thing you cannot see. */}
          <p className="switch-from">
            <span className="user-chip" style={{ width: 24, height: 24, fontSize: 'var(--type-ui-11)' }} aria-hidden="true">
              {me?.avatar_path ? <img src={coverImgURL(me.avatar_path)} alt="" /> : (me?.username || '?').trim().charAt(0).toLowerCase()}
            </span>
            <span>
              {tNodes('account.switch.leaving', { name: <b>{me?.username}</b> })}
            </span>
          </p>
          {/* Real labels, not placeholders. A placeholder is gone the moment you
              type into it, which leaves two identical boxes and a password
              manager's guess about which is which. */}
          <Field
            label={t('account.switch.name.label')}
            value={username}
            autoFocus
            autoComplete="username"
            onChange={(e) => { setUsername(e.target.value); setErr('') }}
          />
          <Field
            label={t('account.switch.password.label')}
            type="password"
            value={password}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
            onChange={(e) => { setPassword(e.target.value); setErr('') }}
          />
          <ErrorText>{err}</ErrorText>
          <div className="flex flex-wrap items-center gap-2">
            <StickerButton disabled={busy || !!missing} title={missing || undefined}>
              {busy ? t('account.switch.busy') : t('account.switch.submit')}
            </StickerButton>
            <GhostButton type="button" onClick={close}>{t('common.action.cancel.label')}</GhostButton>
            {/* The reason the button is grey, in the place you are looking when
                you wonder — rather than only in a title attribute a touch screen
                has no way to show. */}
            {missing && !err && <span className="microcopy" style={{ color: 'var(--faint)' }}>{missing}</span>}
          </div>
        </form>
      )}
    </div>
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
    if (r.ok && r.data.ok) setMsg(t('account.reindex.done'))
    else if (r.ok)
      setErr(t('account.reindex.partial', { failed: (r.data.failed || []).join(', ') }))
    else setErr(errText(r, t('error.reindex.failed')))
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
    setErr(errText(r, t('error.reset.failed')))
  }

  // Both explanations moved into InfoDots. The reset one is deliberately still
  // long — a wall of consequences is the right amount of words for a button that
  // deletes an instance — but it now sits one tap behind a dot instead of
  // standing permanently between you and the harmless button above it.
  return (
    <Card pad="p-5">
      <FieldLabel>{t('account.maintenance.label')}</FieldLabel>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <p className="text-sm font-semibold">{t('account.reindex.title')}</p>
            <InfoDot
              title={t('account.reindex.info.title')}
              text={t('account.reindex.info.body')}
            />
          </div>
          <GhostButton disabled={busy === 'reindex'} onClick={reindex}>
            {busy === 'reindex' ? t('account.reindex.busy') : t('account.reindex.action')}
          </GhostButton>
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed var(--line)' }} />

        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold" style={{ color: 'var(--error)' }}>
              {t('account.reset.title')}
            </p>
            <InfoDot
              title={t('account.reset.info.title')}
              text={t('account.reset.info.body')}
            />
          </div>
          {!showReset ? (
            <GhostButton icon={<IconDelete />} keepLabel className="mt-2" onClick={() => setShowReset(true)}>
              {t('account.reset.open')}
            </GhostButton>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="microcopy">
                {/* RESET is the word the server compares — never translated. */}
                {tNodes('account.reset.confirm.prose', { word: <b>RESET</b> })}
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
                  {busy === 'reset' ? t('account.reset.busy') : t('account.reset.submit')}
                </button>
                <GhostButton onClick={() => { setShowReset(false); setConfirm('') }}>
                  {t('common.action.cancel.label')}
                </GhostButton>
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

// Profile — everything about "you on this server", in the order you would ask
// it: who you are, then which account you are in, then your password, then (for
// an admin) everyone else's accounts and the recovery tools.
export function Profile({ user, onUser, logout }) {
  return (
    <div className="space-y-5">
      <Card pad="p-5"><AvatarRow user={user} onUser={onUser} /></Card>
      <Card pad="p-5"><NameForm user={user} onUser={onUser} /></Card>
      {/* Session: the two things the avatar chip's dropdown used to be for. */}
      <Card pad="p-5">
        <div className="space-y-4">
          <SwitchAccount me={user} />
          <hr style={{ border: 'none', borderTop: '1px dashed var(--line)' }} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <p className="text-sm font-semibold">{t('account.logout.title')}</p>
              <InfoDot title={t('account.logout.info.title')} text={t('account.logout.info.body')} />
            </div>
            {logout && (
              <GhostButton icon={<IconLogout />} keepLabel onClick={logout}>
                {t('account.logout.action')}
              </GhostButton>
            )}
          </div>
        </div>
      </Card>
      <Card pad="p-5"><PasswordForm /></Card>
      {/* Admin sections. User management was its own chip-menu destination until
          1.4.1; it is a section here because "the accounts on this server" is
          part of the same answer as "my account", and a menu of two screens is
          not worth a menu. */}
      {user?.is_admin && (
        <Card pad="p-5">
          <span className="flex items-center gap-1.5">
            <FieldLabel>{t('account.users.label')}</FieldLabel>
            <InfoDot title={t('account.users.info.title')} text={t('account.users.info.body')} />
          </span>
          <UserManagement me={user} />
        </Card>
      )}
      {user?.is_admin && <MaintenanceCard />}
    </div>
  )
}

// ---- User management (admin only): add / remove / grant-revoke admin ----
// Rendered as a section INSIDE Profile (see above), so it supplies no card of
// its own — the heading and the surrounding Card belong to its host.

export function UserManagement({ me }) {
  const [users, setUsers] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    const r = await json('GET', '/admin/users')
    if (r.ok) setUsers(r.data.users)
    else setError(errText(r, t('error.load.users')))
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
      setError(errText(r, t('error.add.user')))
    }
  }

  async function setAdmin(u, is_admin) {
    setError('')
    setBusyId(u.id)
    const r = await json('PATCH', `/admin/users/${u.id}`, { is_admin })
    setBusyId(null)
    if (r.ok) load()
    else setError(errText(r, t('error.save.role')))
  }

  async function removeUser(u) {
    if (!confirm(t('account.users.delete.confirm', { name: u.username }))) return
    setError('')
    const r = await json('DELETE', `/admin/users/${u.id}`)
    if (r.ok) load()
    else setError(errText(r, t('error.delete.user')))
  }

  // A new account needs both fields, and the password has to be one the server
  // will take — greying the button is how that is said, rather than a 400.
  const addMissing = !username.trim()
    ? t('error.validate.username-required-add')
    : passwordProblem(password)

  return (
    <div>
      <ul className="space-y-1">
        {users.map((u) => {
          const isMe = u.id === me.id
          const lastAdmin = u.is_admin && adminCount <= 1
          // Granting is something you do to others; revoking is something you
          // do to yourself. So the button on an admin row is only ever yours,
          // and an admin row that is not yours carries no role control and no
          // delete — their account can only be removed once they have stepped
          // down. The server enforces all three; this is so the page stops
          // offering actions it is about to be refused for.
          const canSetRole = u.is_admin ? isMe && !lastAdmin : true
          const canDelete = !isMe && !u.is_admin
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
              <span className="user-chip" style={{ width: 30, height: 30, fontSize: 'var(--type-ui-13)' }} aria-hidden="true">
                {u.avatar_path ? <img src={coverImgURL(u.avatar_path)} alt="" /> : (u.username || '?').trim().charAt(0).toLowerCase()}
              </span>
              <span style={{ fontWeight: 600 }}>{u.username}</span>
              {u.is_admin && (
                <span className="tp-chip" style={{ color: 'var(--accent-ui)' }}>
                  {t('account.users.admin.chip')}
                </span>
              )}
              {isMe && <span className="mono-label">{t('account.users.you.chip')}</span>}
              <span className="ml-auto flex items-center gap-2">
                {canSetRole ? (
                  <button
                    type="button"
                    className="tp-chip tp-chip-btn"
                    disabled={busyId === u.id}
                    title={
                      u.is_admin
                        ? t('account.users.step-down.tip')
                        : t('account.users.make-admin.tip', { name: u.username })
                    }
                    onClick={() => setAdmin(u, !u.is_admin)}
                  >
                    {u.is_admin ? t('account.users.step-down') : t('account.users.make-admin')}
                  </button>
                ) : (
                  u.is_admin && (
                    <span className="mono-label" style={{ color: 'var(--faint)' }}>
                      {lastAdmin && isMe ? t('account.users.only-admin') : t('account.users.their-own')}
                    </span>
                  )
                )}
                {canDelete && (
                  <Tooltip label={t('account.users.delete.tip', { name: u.username })} side="top">
                    <button
                      type="button"
                      onClick={() => removeUser(u)}
                      aria-label={t('account.users.delete.aria', { name: u.username })}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 'var(--type-ui-17)', padding: 4, lineHeight: 1, cursor: 'pointer' }}
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
        <input className="tp-input" style={{ flex: 1, minWidth: 130 }} placeholder={t('common.field.username.placeholder')} value={username} autoComplete="off" onChange={(e) => setUsername(e.target.value)} />
        <input
          className="tp-input"
          style={{ flex: 1, minWidth: 130 }}
          placeholder={t('account.password.new.placeholder', { min: PASSWORD_MIN, max: PASSWORD_MAX })}
          type="password"
          value={password}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          onChange={(e) => setPassword(e.target.value)}
        />
        <StickerButton icon={<IconUserPlus />} keepLabel disabled={!!addMissing} title={addMissing || undefined}>
          {t('account.users.add')}
        </StickerButton>
      </form>
      {addMissing && password.length > 0 && (
        <p className="microcopy mt-1" style={{ color: 'var(--faint)' }}>{addMissing}.</p>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
