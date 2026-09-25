// SafetyBackupStep — the first step of a restore and of a factory reset.
//
// The owner: an admin "must take a backup and download it before this can be
// done (as part of the process of the reset)". So the step is IN the flow rather
// than a suggestion beside it: the server refuses restore and reset until this
// download has finished (POST /admin/backup/safety), and the caller keeps its own
// destructive button disabled until `onDone` has fired, so the refusal is never
// the first a reader hears of it.
//
// The copy is sealed like any backup — the admin's password, or a passphrase —
// and it is streamed to the browser and not kept on the server, because the
// server keeps one archive and a restore from it must not restore this.
import { useState } from 'react'
import { apiURL } from './api.js'
import { ErrorText, IconExport, MonoLabel, StickerButton } from './ui.jsx'
import { PASSPHRASE_MAX, PASSWORD_MAX, passphraseProblem } from './secret.js'
import { t } from './i18n.js'

export function SafetyBackupStep({ done, onDone }) {
  const [usePhrase, setUsePhrase] = useState(false)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const missing = usePhrase ? passphraseProblem(secret) : secret ? '' : t('error.validate.password-required')

  async function take(e) {
    e?.preventDefault()
    if (missing || busy) return
    setBusy(true)
    setErr('')
    const creds = usePhrase ? { passphrase: secret } : { password: secret }
    // A DROPPED CONNECTION IS A FAILURE, NOT A HANG. Without the catch a rejected
    // fetch or a body that stops arriving left the button on "Preparing…" for good.
    try {
      const r = await globalThis.fetch(apiURL('/admin/backup/safety'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      })
      if (!r.ok) {
        setErr((await r.json().catch(() => ({}))).error || t('error.backup.failed'))
        return
      }
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'tippani-backup.tpbk'
      const href = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = href
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 60_000)
      setSecret('')
      // The credential goes up with the news, so a restore that asks for the same
      // password does not ask for it twice.
      onDone(creds)
    } catch {
      setErr(t('error.backup.failed'))
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p className="microcopy">{t('settings.safety.done.prose')}</p>
  return (
    <div className="space-y-2">
      <p className="microcopy">{t('settings.safety.why.prose')}</p>
      <label className="tp-field">
        <MonoLabel>{t(usePhrase ? 'settings.safety.passphrase.label' : 'settings.safety.password.label')}</MonoLabel>
        <input
          className="tp-input"
          type="password"
          autoFocus
          autoComplete={usePhrase ? 'off' : 'current-password'}
          maxLength={usePhrase ? PASSPHRASE_MAX : PASSWORD_MAX}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') take(e) }}
        />
      </label>
      {/* Each on its own row: side by side at desktop width the link sat below the
          button's middle with only a word space between them. */}
      <div>
        <button type="button" className="tp-link" onClick={() => { setUsePhrase((v) => !v); setSecret('') }}>
          {t(usePhrase ? 'settings.backup.use-password.label' : 'settings.backup.use-passphrase.label')}
        </button>
      </div>
      <div>
        <StickerButton type="button" icon={<IconExport />} keepLabel disabled={!!missing || busy} title={missing || undefined} onClick={take}>
          {busy ? t('settings.safety.busy') : t('settings.safety.action')}
        </StickerButton>
      </div>
      <ErrorText>{err}</ErrorText>
    </div>
  )
}
