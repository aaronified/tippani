import { useState } from 'react'
import { json, errText } from './api.js'
import { Card, ErrorText, Field, GhostButton, IconKey, IconLogout, IconSwitchUser, InfoDot, MonoLabel, NameInput, StickerButton } from './ui.jsx'
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from './secret.js'
import { t, tNodes } from './i18n.js'
import { UserAvatar } from './avatar.jsx'

// The display name's ceiling. Not a security bound — just the width the greeting
// can lay out without wrapping into two lines.
const NAME_MAX = 40

// Account.jsx — the ONE chip-reached account surface: Profile. On desktop it
// renders inside a pop-up (see AccountOverlay in App.jsx); on mobile it fills a
// page. It is a plain content component; the overlay owns the framing + close.
//
// 1.4.1 collapsed a menu into this screen. The avatar chip used to open a
// dropdown offering Profile, User management (admins) and Log out, and the
// drawer repeated the same three rows — so "my account" was a menu of screens
// rather than a screen. The chip now opens Profile directly and everything that
// menu offered is a section here: switching accounts and logging out. One tap
// instead of two, and one place to look.

function FieldLabel({ children }) {
  return <MonoLabel className="mb-1.5 block">{children}</MonoLabel>
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
export function PasswordForm({ onDone } = {}) {
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
      onDone?.()
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
              <UserAvatar user={me || {}} />
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

// MaintenanceCard (admin only) — the search-index rebuild, the fix for "search
// failed / internal error" from a corrupt full-text index. Non-destructive. The
// factory reset that used to sit beside it is cut from the web app (ADR-0936).
function MaintenanceCard() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function reindex() {
    setBusy(true)
    setErr('')
    setMsg('')
    const r = await json('POST', '/admin/search/reindex')
    setBusy(false)
    if (r.ok && r.data.ok) setMsg(t('account.reindex.done'))
    else if (r.ok)
      setErr(t('account.reindex.partial', { failed: (r.data.failed || []).join(', ') }))
    else setErr(errText(r, t('error.reindex.failed')))
  }

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
          <GhostButton disabled={busy} onClick={reindex}>
            {busy ? t('account.reindex.busy') : t('account.reindex.action')}
          </GhostButton>
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
      <Card pad="p-5"><NameForm user={user} onUser={onUser} /></Card>
      {/* Session: switching accounts and logging out. */}
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
      {user?.is_admin && <MaintenanceCard />}
    </div>
  )
}

