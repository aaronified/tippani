import { useEffect, useState } from 'react'
import { apiURL, errText, json } from './api.js'
import { Card, ErrorText, GhostButton, IconCopy, IconDelete, IconKey, IconLink, InfoDot, MonoLabel, StickerButton, Toggle, useConfirm } from './ui.jsx'
import { t } from './i18n.js'

// connections.jsx — the three ways an account reaches outside the app: single
// sign-on, Pushover, and a dashboard widget key. All three are Profile cards,
// by the owner's ruling, because each belongs to the ACCOUNT — every reader has
// their own — and Profile is the account's screen; Settings → Server stays the
// admin's. Nothing here is shared: each card reads and writes the signed-in
// account's own row, and what is server-wide (which provider, a shared Pushover
// token) comes from the operator's environment and is only reported.

function Heading({ label, info }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5">
      <MonoLabel className="block">{label}</MonoLabel>
      <InfoDot title={label} text={info} />
    </span>
  )
}

const soft = { fontSize: 'var(--type-ui-13)', color: 'var(--soft)' }

// takeParam reads a one-shot ?name=… the server's redirect left on the address
// and removes it, so a refresh or a bookmark does not show the same message
// again. replaceState, not a navigation: nothing on the page should move.
function takeParam(name) {
  const loc = globalThis.location
  if (!loc) return ''
  const q = new URLSearchParams(loc.search)
  const v = q.get(name) || ''
  if (v) {
    q.delete(name)
    const rest = q.toString()
    globalThis.history?.replaceState(globalThis.history.state, '', loc.pathname + (rest ? `?${rest}` : '') + loc.hash)
  }
  return v
}

// ---- single sign-on ---------------------------------------------------------

// SingleSignOn links this account to the operator's provider. Linking is a
// navigation, not a fetch: the provider has to see the browser, and it sends
// the browser back to Profile with ?oidc_linked=1 or ?oidc_error=….
export function SingleSignOn({ user }) {
  const { ask, confirmDialog } = useConfirm()
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [linked, setLinked] = useState(!!user?.oidc_linked)
  useEffect(() => {
    const e = takeParam('oidc_error')
    if (e) setError(e)
    if (takeParam('oidc_linked')) {
      setLinked(true)
      setFlash(t('account.sso.linked.flash'))
    }
  }, [])
  if (!user?.oidc) {
    // Only the operator can switch it on, so only an admin is told how.
    if (!user?.is_admin) return null
    return (
      <Card pad="p-5">
        <Heading label={t('account.sso.label')} info={t('account.sso.off.info')} />
        <p style={soft}>{t('account.sso.off')}</p>
      </Card>
    )
  }
  const name = user.oidc.name
  async function unlink() {
    const ok = await ask(t('account.sso.unlink.confirm.title', { name }), {
      body: t('account.sso.unlink.confirm.body'),
      confirmLabel: t('account.sso.unlink.action'),
      danger: true,
      reversible: true,
    })
    if (!ok) return
    const r = await json('DELETE', '/auth/oidc/link')
    if (!r.ok) return setError(errText(r, t('error.generic')))
    setLinked(false)
    setFlash('')
  }
  return (
    <Card pad="p-5">
      <Heading label={t('account.sso.label')} info={t('account.sso.info.body', { name })} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1" style={soft}>
          {linked ? t('account.sso.linked', { name }) : t('account.sso.unlinked', { name })}
        </p>
        {linked ? (
          <GhostButton icon={<IconDelete />} keepLabel onClick={unlink}>{t('account.sso.unlink.action')}</GhostButton>
        ) : (
          <StickerButton icon={<IconLink />} keepLabel onClick={() => globalThis.location.assign(apiURL('/auth/oidc/login?link=1'))}>
            {t('account.sso.link.action', { name })}
          </StickerButton>
        )}
      </div>
      {flash && <p style={soft}>{flash}</p>}
      <ErrorText>{error}</ErrorText>
      {confirmDialog}
    </Card>
  )
}

// ---- dashboard widget -------------------------------------------------------

// WidgetKey issues the read-only key a dashboard (gethomepage's Custom API
// widget) sends to GET /api/widget. The key is shown ONCE, when it is made —
// the server keeps only its hash — so the card offers the whole YAML block to
// copy while it can.
export function WidgetKey() {
  const { ask, confirmDialog } = useConfirm()
  const [exists, setExists] = useState(false)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    json('GET', '/auth/widget-key').then((r) => r.ok && setExists(!!r.data?.exists))
  }, [])
  async function make() {
    if (exists && !(await ask(t('account.widget.rotate.confirm.title'), {
      body: t('account.widget.rotate.confirm.body'),
      confirmLabel: t('account.widget.rotate.action'),
      danger: true,
      reversible: false,
    }))) return
    const r = await json('POST', '/auth/widget-key')
    if (!r.ok) return setError(errText(r, t('error.generic')))
    setKey(r.data.key)
    setExists(true)
    setCopied(false)
  }
  async function revoke() {
    const r = await json('DELETE', '/auth/widget-key')
    if (!r.ok) return setError(errText(r, t('error.generic')))
    setKey('')
    setExists(false)
  }
  const origin = globalThis.location?.origin || ''
  const yaml = [
    '- Tippani:',
    `    href: ${origin}`,
    '    widget:',
    '      type: customapi',
    `      url: ${origin}/api/widget`,
    '      headers:',
    `        X-API-Key: ${key}`,
    '      mappings:',
    `        - { field: works, label: ${t('account.widget.field.works')} }`,
    `        - { field: quotes, label: ${t('account.widget.field.quotes')} }`,
    `        - { field: forgot, label: ${t('account.widget.field.forgot')} }`,
    `        - { field: mastered, label: ${t('account.widget.field.mastered')} }`,
  ].join('\n')
  return (
    <Card pad="p-5">
      <Heading label={t('account.widget.label')} info={t('account.widget.info.body')} />
      <p style={soft}>{exists ? t('account.widget.exists') : t('account.widget.none')}</p>
      {key && (
        <div className="mt-3 space-y-2">
          <p style={soft}>{t('account.widget.once')}</p>
          <pre className="tp-input whitespace-pre-wrap break-all" style={{ fontSize: 'var(--type-ui-12)' }} aria-label={t('account.widget.yaml.aria')}>{yaml}</pre>
          <GhostButton
            icon={<IconCopy />}
            keepLabel
            onClick={() => globalThis.navigator?.clipboard?.writeText(yaml).then(() => setCopied(true), () => {})}
          >
            {copied ? t('account.widget.copied') : t('account.widget.copy')}
          </GhostButton>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <StickerButton icon={<IconKey />} keepLabel onClick={make}>
          {exists ? t('account.widget.rotate.action') : t('account.widget.make.action')}
        </StickerButton>
        {exists && <GhostButton icon={<IconDelete />} keepLabel onClick={revoke}>{t('account.widget.revoke.action')}</GhostButton>}
      </div>
      <ErrorText>{error}</ErrorText>
      {confirmDialog}
    </Card>
  )
}

// ---- Pushover ---------------------------------------------------------------

const EVENTS = ['daily', 'import', 'fetch', 'backup']

// Notifications is the reader's Pushover set-up. The switches save as they
// move, like every other switch in the app; the two keys save together with
// their button, because half a key pair is not a setting.
export function Notifications({ user }) {
  const [state, setState] = useState(null)
  const [userKey, setUserKey] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    json('GET', '/auth/notifications').then((r) => {
      if (!r.ok || !r.data?.settings) return
      setState(r.data)
      setUserKey(r.data.settings.pushover_user)
    })
  }, [])
  if (!state) return null
  async function save(body) {
    setError('')
    setFlash('')
    setBusy(true)
    const r = await json('PUT', '/auth/notifications', body)
    setBusy(false)
    if (!r.ok) {
      setError(errText(r, t('error.generic')))
      return false
    }
    setState(r.data)
    return true
  }
  async function saveKeys(e) {
    e.preventDefault()
    const body = { pushover_user: userKey.trim() }
    if (token.trim()) body.app_token = token.trim()
    if (await save(body)) {
      setToken('')
      setFlash(t('account.notify.saved'))
    }
  }
  // The stored token is write-only, so it cannot be emptied by editing the
  // field; this is the one way to go back to the server's shared token.
  async function clearToken() {
    if (await save({ app_token: '' })) setFlash(t('account.notify.token.cleared'))
  }
  async function test() {
    setError('')
    setFlash('')
    setBusy(true)
    const r = await json('POST', '/auth/notifications/test')
    setBusy(false)
    if (!r.ok) return setError(errText(r, t('error.generic')))
    setFlash(t('account.notify.test.sent'))
  }
  const s = state.settings
  const tokenReady = state.has_app_token || state.server_app_token
  const changed = userKey.trim() !== s.pushover_user || token.trim() !== ''
  return (
    <Card pad="p-5">
      <Heading label={t('account.notify.label')} info={t('account.notify.info.body')} />
      <form onSubmit={saveKeys} className="space-y-3">
        <input
          className="tp-input"
          aria-label={t('account.notify.user.label')}
          placeholder={t('account.notify.user.placeholder')}
          value={userKey}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setUserKey(e.target.value)}
        />
        <input
          className="tp-input"
          type="password"
          aria-label={t('account.notify.token.label')}
          placeholder={state.has_app_token
            ? t('account.notify.token.placeholder.set')
            : state.server_app_token ? t('account.notify.token.placeholder.server') : t('account.notify.token.placeholder')}
          value={token}
          autoComplete="off"
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <StickerButton icon={<IconKey />} keepLabel disabled={busy || !changed}>{t('account.notify.save')}</StickerButton>
          <GhostButton type="button" keepLabel disabled={busy || !s.pushover_user || !tokenReady} onClick={test}>
            {t('account.notify.test.action')}
          </GhostButton>
          {state.has_app_token && (
            <GhostButton type="button" icon={<IconDelete />} keepLabel disabled={busy} onClick={clearToken}>
              {t('account.notify.token.clear')}
            </GhostButton>
          )}
        </div>
      </form>
      {s.pushover_user && (
        <div className="mt-4 space-y-3">
          {EVENTS.filter((ev) => ev !== 'backup' || user?.is_admin).map((ev) => {
            const k = `on_${ev}`
            return (
              <div key={ev} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t(`account.notify.event.${ev}.title`)}</p>
                  <p style={soft}>{t(`account.notify.event.${ev}.sub`)}</p>
                </div>
                <Toggle
                  ariaLabel={t(`account.notify.event.${ev}.title`)}
                  value={s[k] ? 'on' : 'off'}
                  onChange={(v) => save({ [k]: v === 'on' })}
                  options={[['on', t('common.toggle.on.label')], ['off', t('common.toggle.off.label')]]}
                />
              </div>
            )
          })}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      {flash && <p style={soft}>{flash}</p>}
    </Card>
  )
}

