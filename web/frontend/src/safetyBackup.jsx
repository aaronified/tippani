// SafetyBackupStep — the first step of a restore and of a factory reset.
//
// The owner: an admin "must take a backup and download it before this can be
// done (as part of the process of the reset)". So the step is IN the flow rather
// than a suggestion beside it: the server refuses restore and reset until this
// download has finished, and the caller keeps its own destructive button
// disabled until `onDone` has fired, so the refusal is never the first a reader
// hears of it.
//
// THE COPY IS A JOB (3.1.0), because every backup queues — the owner's answer of
// 28 September. The press asks for it (POST /admin/backup/safety), which answers
// at once when the password is wrong; the job then waits its turn and seals the
// copy, and the step says which, in Current jobs' own words — "Waiting — 2 jobs
// ahead", then "Preparing the copy…" — with a Stop that ends it. When the job has
// finished, the step downloads the copy from the address its result names, which
// works once, and only then fires `onDone`. A Stop, a failed job, or a download
// refused or cut short gives the button back, with the reason.
//
// The copy is sealed like any backup — the admin's password, or a passphrase —
// and it is handed to the browser and never kept among the server's backups,
// because the server keeps one archive and a restore from it must not restore
// this.
import { useEffect, useRef, useState } from 'react'
import { apiURL, errText, json } from './api.js'
import { announceJobs, isLive, jobStateLabel, jobWaitingText, pressStop, readJobResult, useJob, useStoppingJobs } from './jobs.js'
import { ErrorText, GhostButton, IconExport, IconStop, MonoLabel, StickerButton } from './ui.jsx'
import { PASSPHRASE_MAX, PASSWORD_MAX, passphraseProblem } from './secret.js'
import { t } from './i18n.js'

// `next` is the field that becomes the question once the copy is down: the
// download leaves focus on a box that is about to be replaced with a sentence,
// so a keyboard reader is handed on rather than left at the top of the page.
export function SafetyBackupStep({ done, onDone, next }) {
  const [usePhrase, setUsePhrase] = useState(false)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // The copy's job once the server has queued it, watched as Current jobs
  // watches one — every second while it moves, every 200 ms after a Stop — and
  // the credential it was asked with, which goes up with the news.
  const [jobId, setJobId] = useState(null)
  // THE JOB AS THE PRESS WAS ANSWERED WITH IT, until the watch has read it: a copy
  // queued behind somebody's fill is waiting from that answer on, and the step
  // says so then, not "Preparing the copy…" for the round trip before the first
  // read. A 409's answer names the job without it, and the step then says only
  // where the copy will download until the read comes back.
  const [posted, setPosted] = useState(null)
  const asked = useRef(null)
  const watched = useJob(jobId)
  const job = watched.job && watched.job.id === jobId ? watched.job : posted && posted.id === jobId ? posted : null
  const stopping = useStoppingJobs()
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  const missing = usePhrase ? passphraseProblem(secret) : secret ? '' : t('error.validate.password-required')

  const settle = (message) => {
    setJobId(null)
    setPosted(null)
    setBusy(false)
    setErr(message)
  }

  async function take(e) {
    e?.preventDefault()
    if (missing || busy) return
    setBusy(true)
    setErr('')
    asked.current = usePhrase ? { passphrase: secret } : { password: secret }
    // A DROPPED CONNECTION IS A FAILURE, NOT A HANG: json() answers one as
    // {ok: false, status: 0}, and the step says so and gives the button back.
    const r = await json('POST', '/admin/backup/safety', asked.current)
    if (!alive.current) return
    // A 202 is the job; a 409 naming one is the same copy already asked for,
    // which this press joins.
    const id = r.status === 202 ? r.data?.job?.id : r.status === 409 ? r.data?.job_id : null
    if (!id) return settle(errText(r, t('error.backup.failed')))
    announceJobs()
    setPosted(r.status === 202 ? r.data.job : null)
    setJobId(id)
  }

  // THE JOB HAS ENDED: download the copy it sealed, or say why there is none.
  const handled = useRef(0)
  useEffect(() => {
    if (!job || isLive(job) || handled.current === job.id) return
    handled.current = job.id
    if (job.state === 'succeeded') download(job.id)
    else settle(job.state === 'stopped' ? t('settings.safety.stopped') : job.error || jobStateLabel(job.state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.state])
  // A job that is not there any more (a restore replaced the queue under it) is
  // not coming back.
  useEffect(() => {
    if (jobId && watched.gone) settle(t('error.backup.failed'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, watched.gone])

  async function download(id) {
    try {
      const res = await readJobResult(id)
      const url = res.ok ? res.result?.url : ''
      if (!alive.current) return
      if (!url) return settle(t('error.backup.failed'))
      const r = await globalThis.fetch(apiURL(url))
      if (!r.ok) {
        const refused = (await r.json().catch(() => ({}))).error
        if (alive.current) settle(refused || t('error.backup.failed'))
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
      if (!alive.current) return
      setJobId(null)
      setPosted(null)
      setBusy(false)
      setSecret('')
      // The credential goes up with the news, so a restore that asks for the same
      // password does not ask for it twice.
      onDone(asked.current)
      next?.current?.focus()
    } catch {
      // A body that stopped arriving, or a fetch the network dropped.
      if (alive.current) settle(t('error.backup.failed'))
    }
  }

  // No toast: the step says "Stopping…" from the press, and why it stopped once
  // the job reads stopped.
  async function stop() {
    const r = await pressStop(jobId)
    if (!r.ok && alive.current) setErr(r.error)
  }

  if (done) return <p className="microcopy">{t('settings.safety.done.prose')}</p>
  // WHILE ITS JOB WAITS OR RUNS the box is shut, and the step says where the copy
  // stands and offers the Stop that ends it.
  const live = !!jobId && (!job || isLive(job))
  const standing = job?.state === 'queued' ? jobWaitingText(job) : job ? t('settings.safety.busy') : ''
  return (
    <div className="space-y-2">
      <p className="microcopy">{t('settings.safety.why.prose')}</p>
      <label className="tp-field">
        <MonoLabel>{t(usePhrase ? 'settings.safety.passphrase.label' : 'settings.safety.password.label')}</MonoLabel>
        <input
          className="tp-input"
          type="password"
          autoFocus
          disabled={live}
          autoComplete={usePhrase ? 'off' : 'current-password'}
          maxLength={usePhrase ? PASSPHRASE_MAX : PASSWORD_MAX}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') take(e) }}
        />
      </label>
      {live ? (
        <>
          <p className="microcopy" role="status">{standing}</p>
          <p className="microcopy">{t('settings.safety.wait.prose')}</p>
          <div>
            {stopping.has(jobId) ? (
              <span className="microcopy">{t('settings.jobs.current.stopping')}</span>
            ) : (
              <GhostButton icon={<IconStop />} keepLabel className="tp-btn-danger" aria-label={t('settings.safety.stop.aria')} onClick={stop}>
                {t('settings.jobs.current.stop.label')}
              </GhostButton>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Each on its own row: side by side at desktop width the link sat below
              the button's middle with only a word space between them. */}
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
        </>
      )}
      <ErrorText>{err}</ErrorText>
    </div>
  )
}
