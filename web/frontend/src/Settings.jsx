import { useEffect, useRef, useState } from 'react'
import { json, errText, coverImgURL, copyText, apiURL, uploadWithProgress } from './api.js'
import { ACCENTS, applyTheme, getResolvedTheme } from './theme.js'
import { tourFeatures, tourSteps } from './tour.jsx'
import {
  Card,
  ErrorText,
  GhostButton,
  InfoDot,
  Masonry,
  MonoLabel,
  PageHeader,
  StickerButton,
  Toggle,
  toast,
  frameCode,
  useCoverSize,
  useFrameBase,
  useIsMobileScreen,
} from './ui.jsx'

// Settings (§8.11): Appearance, Metadata sources, review/credits prefs, and
// (admin only) Updates + Backup. Library stats now live on their own Stats page
// (StatsPage.jsx). Appearance applies instantly via applyTheme and persists via
// PUT /auth/me/preferences.
// useColumnCount tracks how many masonry columns fit: 1 (mobile) / 2 / 3 (wide).
function useColumnCount() {
  const mobile = useIsMobileScreen()
  const read = () => {
    if (mobile) return 1
    return typeof window === 'undefined' ? 2 : window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1
  }
  const [n, setN] = useState(read)
  useEffect(() => {
    const fn = () => setN(read())
    window.addEventListener('resize', fn)
    fn()
    return () => window.removeEventListener('resize', fn)
  }, [mobile])
  return n
}

export default function Settings({ user, onPreferences, update, onUpdateInfo, onStartTour }) {
  const mobile = useIsMobileScreen()
  // Height-minimising masonry: on wide screens the cards are packed into 3/2/1
  // columns by their real rendered heights (Masonry measures and drops each card
  // onto the currently-shortest column), so the tall Metadata card sits beside
  // the short ones with no dead gap instead of dominating a column. Non-admins
  // lose Metadata's bulk plus the Updates/Backup cards.
  const ncols = useColumnCount()
  const cards = [
    <OnboardingCard key="onboard" user={user} onStartTour={onStartTour} />,
    <Metadata key="meta" user={user} />,
    <SRSettings key="sr" user={user} onPreferences={onPreferences} />,
    <CreditSepsCard key="credits" user={user} onPreferences={onPreferences} />,
    user.is_admin && <UpdatesCard key="upd" user={user} update={update} onUpdateInfo={onUpdateInfo} />,
    user.is_admin && <BackupCard key="backup" />,
  ].filter(Boolean)
  return (
    <section className="space-y-6">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader title="Settings" counts={user.is_admin ? 'admin' : user.username} />
      </div>
      <Appearance onPreferences={onPreferences} />
      <Masonry columns={ncols} gap={24}>{cards}</Masonry>
    </section>
  )
}

// CreditSepsCard — which separators split a joined multi-author credit
// ("Gaiman & Pratchett") into distinct people, across group-by headings and
// the People console (ROADMAP §11). Stored as the creditSeparators pref
// ("none" = splitting off). The author string stored on each book is never
// rewritten — only the people views split — so this is safe to flip freely.
// Chips show the bare symbol; the key doubles as the screen-reader name.
const CREDIT_SEP_OPTIONS = [
  ['comma', ','],
  ['semicolon', ';'],
  ['amp', '&'],
  ['and', '“and”'],
]
function CreditSepsCard({ user, onPreferences }) {
  const parse = (v) => {
    const t = String(v || '').trim()
    if (!t) return new Set(CREDIT_SEP_OPTIONS.map(([k]) => k)) // unset = all on
    if (t.toLowerCase() === 'none') return new Set()
    return new Set(t.split(',').map((s) => s.trim()).filter((s) => CREDIT_SEP_OPTIONS.some(([k]) => k === s)))
  }
  const [active, setActive] = useState(() => parse(user.preferences?.creditSeparators))
  function toggle(key) {
    const next = new Set(active)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setActive(next)
    // Canonical order, "none" as the explicit off switch (an empty string
    // would read as "unset" and fall back to the default on the server).
    const value = next.size === 0 ? 'none' : CREDIT_SEP_OPTIONS.map(([k]) => k).filter((k) => next.has(k)).join(',')
    onPreferences?.({ creditSeparators: value })
    json('PUT', '/auth/me/preferences', { creditSeparators: value })
  }
  return (
    <Card>
      <SectionTitle>Multi-author credits</SectionTitle>
      <div className="mb-2 flex items-center gap-2">
        <MonoLabel>Split joined credits on</MonoLabel>
        <InfoDot text="A credit like “Gaiman & Pratchett” lists as two people — in group-by headings and the People console — split on the separators picked here. The author line stored on each book stays untouched. Turn the comma off if your library stores authors as “Last, First”." />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CREDIT_SEP_OPTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={'tp-filter-chip' + (active.has(key) ? ' active' : '')}
            aria-pressed={active.has(key)}
            aria-label={key}
            onClick={() => toggle(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {active.size === 0 && (
        <p className="microcopy mt-2">splitting is off — every credit stays one person</p>
      )}
    </Card>
  )
}

// Slider — a labelled range that commits on release (pointer/key up), so a drag
// is one PUT, not one per step. Mirrors its `value` prop if it changes upstream.
function Slider({ label, hideLabel = false, min, max, step, value, unit = '', decimals = 0, onCommit }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const show = decimals ? v.toFixed(decimals) : String(v)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        {hideLabel ? <span /> : <MonoLabel>{label}</MonoLabel>}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)' }}>{show}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v} aria-label={label}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => onCommit(Number(Number(v).toFixed(2)))}
        onKeyUp={() => onCommit(Number(Number(v).toFixed(2)))}
        style={{ width: '100%', accentColor: 'var(--accent-ui)', cursor: 'pointer' }}
      />
    </div>
  )
}

// SRSettings — the spaced-repetition knobs (v0.5.0 Daily Quiz & Practice): the
// daily deck size, what the review covers (books / films & shows / both), the
// half-life growth + lapse factors (kept in a deliberately narrow band), and
// whether Practice is allowed to move the schedule. Each persists via the
// partial-merge preferences PUT.
function SRSettings({ user, onPreferences }) {
  const p = user.preferences || {}
  function set(patch) {
    onPreferences?.(patch)
    json('PUT', '/auth/me/preferences', patch)
  }
  return (
    <Card>
      <SectionTitle
        right={
          <InfoDot text="These settings drive both the Daily Quiz and Practice. Recall grows a card's memory half-life; a lapse shrinks it (kept in a narrow band). Every quote carries a status dot — remembered, forgetting or probably forgotten — with its half-life on hover." />
        }
      >
        Daily quiz &amp; practice
      </SectionTitle>
      <div className="space-y-5">
        <Slider label="Daily quiz cards / day" min={2} max={10} step={1} value={p.srDaily || 8} onCommit={(v) => set({ srDaily: v })} />
        <div>
          <MonoLabel className="mb-2 block">Review covers</MonoLabel>
          <Toggle
            ariaLabel="Review scope"
            value={p.srReviewScope || 'both'}
            onChange={(v) => set({ srReviewScope: v })}
            options={[['books', 'Books'], ['movies', 'Films & shows'], ['both', 'Both']]}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>Practice moves the schedule</MonoLabel>
            <InfoDot text="By default Practice is study only. Turn this on to let correct Practice answers stretch half-lives just like the Daily Quiz does." />
          </div>
          <Toggle
            ariaLabel="Practice affects schedule"
            value={p.srPracticeCounts ? 'on' : 'off'}
            onChange={(v) => set({ srPracticeCounts: v === 'on' })}
            options={[['off', 'No'], ['on', 'Yes']]}
          />
        </div>
        <Slider label="Recall grows half-life by" min={1.5} max={4} step={0.1} value={p.srGrow || 2.5} unit="×" decimals={1} onCommit={(v) => set({ srGrow: v })} />
        <Slider label="A lapse keeps" min={0.1} max={0.6} step={0.05} value={p.srShrink || 0.25} unit="×" decimals={2} onCommit={(v) => set({ srShrink: v })} />
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>Seeing lengthens half-life by</MonoLabel>
            <InfoDot text="“Seeing” a quote — practising it (not skipping), sharing it, or favouriting it — nudges its half-life up a little, separate from Daily Quiz recall. Leave at 1.0× to turn this off." />
          </div>
          <Slider label="Seeing lengthens half-life by" hideLabel min={1} max={1.5} step={0.05} value={p.srSeen || 1} unit="×" decimals={2} onCommit={(v) => set({ srSeen: v })} />
        </div>
      </div>
    </Card>
  )
}

// UpdatesCard (admin only) — the version + update control. "Check for updates"
// queries GitHub on demand (never automatically); if a newer release exists it
// offers a one-click update when the Docker socket is mounted (pull + recreate
// via a one-shot Watchtower), and otherwise shows the manual command to run.
function UpdatesCard({ user, update, onUpdateInfo }) {
  const current = user?.version || 'dev'
  const [info, setInfo] = useState(update || null) // check result (seeded from the shared session cache)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [phase, setPhase] = useState('idle') // idle | applying | restarting | failed

  async function check() {
    setBusy(true)
    const r = await json('GET', '/admin/update/check')
    setBusy(false)
    if (r.ok) {
      setInfo(r.data)
      onUpdateInfo?.(r.data) // share up so the mobile drawer's badge mirrors this
    } else toast('couldn’t check for updates')
  }

  async function apply() {
    if (confirm !== 'UPDATE') return
    setPhase('applying')
    const r = await json('POST', '/admin/update/apply', { confirm: 'UPDATE' })
    if (!r.ok) {
      setPhase('failed')
      toast(r.data?.error || 'update failed to start')
      return
    }
    // Watchtower will stop + recreate this container; poll until the new one
    // answers, then reload onto the fresh version.
    setPhase('restarting')
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 3000))
      const ping = await json('GET', '/auth/me')
      if (ping.ok) return window.location.reload()
    }
    setPhase('failed')
    toast('the app didn’t come back automatically — reload the page in a moment')
  }

  const copyCmd = async () => {
    const ok = await copyText(info?.guided_command || '')
    toast(ok ? 'command copied' : 'couldn’t copy — select the command and copy manually')
  }

  return (
    <Card>
      <SectionTitle>Updates</SectionTitle>
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <MonoLabel>version</MonoLabel>
          {user?.releases_url ? (
            <a
              href={user.releases_url}
              target="_blank"
              rel="noopener noreferrer"
              className="tp-link"
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              title="Release notes & changelog on GitHub"
            >
              {current} ↗
            </a>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{current}</span>
          )}
        </div>

        {phase === 'restarting' ? (
          <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
            updating & restarting — this page will reload automatically when Tippani is back…
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <GhostButton onClick={check} disabled={busy || phase === 'applying'}>
                {busy ? 'Checking…' : 'Check for updates'}
              </GhostButton>
              {info && !info.update_available && !info.check_error && (
                <MonoLabel style={{ color: 'var(--ok)' }}>✓ up to date</MonoLabel>
              )}
            </div>

            {info?.check_error && (
              <p className="microcopy" style={{ color: 'var(--soft)' }}>
                couldn’t reach GitHub ({info.check_error}) — check your connection and try again
              </p>
            )}

            {info?.update_available && (
              <div className="space-y-3">
                <p className="microcopy">
                  <strong>{info.latest}</strong> is available (you’re on {current}).{' '}
                  {info.notes_url && (
                    <a href={info.notes_url} target="_blank" rel="noopener noreferrer" className="tp-link">
                      release notes ↗
                    </a>
                  )}
                </p>

                {info.can_self_update ? (
                  <div className="space-y-2">
                    <p className="microcopy">
                      Type <b>UPDATE</b> to pull {info.latest} and restart the container:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="tp-input"
                        style={{ maxWidth: 140, fontFamily: 'var(--font-mono)' }}
                        placeholder="UPDATE"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                      <StickerButton
                        onClick={apply}
                        disabled={confirm !== 'UPDATE' || phase === 'applying'}
                      >
                        {phase === 'applying' ? 'Starting…' : 'Update & restart now'}
                      </StickerButton>
                    </div>
                    {phase === 'failed' && (
                      <p className="microcopy" style={{ color: 'var(--error)' }}>
                        update didn’t start — check the container logs, or update by hand below
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="microcopy">
                      One-click update needs the Docker socket mounted (see the README). To update by
                      hand, run on your host:
                    </p>
                    <div
                      className="flex items-center justify-between gap-2"
                      style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px' }}
                    >
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, overflowWrap: 'anywhere' }}>
                        {info.guided_command}
                      </code>
                      <button type="button" className="tp-link" onClick={copyCmd} style={{ whiteSpace: 'nowrap' }}>
                        copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// BackupCard (admin only) — server-side backup & restore (§ backup). Exactly
// one dated tar.gz of the whole data dir is kept in <data>/backups: "Back up
// now" builds a fresh one (older ones are dropped once it exists) and starts
// the download; the restore block shows that backup's date and replaces
// EVERYTHING on the server with its contents, in-process — no Docker socket.
// A second restore path uploads a backup file (from this or ANOTHER Tippani
// server), the move-to-a-new-box / point-in-time path.
// OnboardingCard — the guided tour's home (ROADMAP: onboarding). Lists every
// feature (the same tourFeatures the tour walks, so the list can't drift), and
// starts / replays / resumes the tour. The tour runs by itself on a user's
// first launch; "finish later" parks it here as a Resume button. The sample
// content is built in — onboarding never asks for the user's files.
function OnboardingCard({ user, onStartTour }) {
  const state = user.preferences?.tour || ''
  const step = user.preferences?.tourStep || 0
  const feats = tourFeatures(user.is_admin)
  const total = tourSteps(user.is_admin).length
  return (
    <Card>
      <SectionTitle
        right={state === 'done' && <MonoLabel style={{ color: 'var(--ok)' }}>✓ completed</MonoLabel>}
      >
        Onboarding
      </SectionTitle>
      <p className="microcopy" style={{ fontSize: 12.5 }}>
        A guided tour of every feature — it runs once on first launch and never needs your files
        (a sample book quote and film dialogue are built in). Skip a step with Next, park it with
        “finish later”, and pick it back up here.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === 'postponed' ? (
          <>
            <StickerButton onClick={() => onStartTour?.(step)}>
              Resume tour · step {Math.min(step + 1, total)} of {total}
            </StickerButton>
            <GhostButton onClick={() => onStartTour?.(0)}>Start over</GhostButton>
          </>
        ) : (
          <StickerButton onClick={() => onStartTour?.(0)}>
            {state ? 'Replay the tour' : 'Start the tour'}
          </StickerButton>
        )}
      </div>
      <ul className="mt-4 space-y-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {feats.map((f) => (
          <li key={f.key} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            <b>{f.name}</b>
            <span style={{ color: 'var(--soft)' }}> — {f.blurb}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function BackupCard() {
  const [backup, setBackup] = useState(null) // {name, created, size} | null
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [restoring, setRestoring] = useState(false)
  // Upload-restore: a backup file the admin chooses from disk.
  const [file, setFile] = useState(null)
  const [upConfirm, setUpConfirm] = useState('')
  const [phase, setPhase] = useState('idle') // idle | uploading | restoring
  const [pct, setPct] = useState(0)
  const fileRef = useRef(null)

  useEffect(() => {
    json('GET', '/admin/backup').then((r) => {
      if (r.ok) setBackup(r.data.backup)
      setLoaded(true)
    })
  }, [])

  async function create() {
    setBusy(true)
    const r = await json('POST', '/admin/backup')
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'backup failed'))
    setBackup(r.data.backup)
    toast('backup created — downloading')
    // Cookie-authed same-origin GET: the browser streams the file itself.
    window.location.href = apiURL('/admin/backup/download')
  }

  async function restore() {
    if (confirm !== 'RESTORE' || !backup || restoring) return
    setRestoring(true)
    try {
      const r = await json('POST', '/admin/restore', { confirm: 'RESTORE' })
      if (!r.ok) {
        setRestoring(false)
        return toast(errText(r, 'restore failed — the current data is intact'))
      }
      toast('restore complete — logging you out')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      // A large restore can outlive the connection even when it succeeds
      // server-side; reload rather than freeze on 'Restoring…'.
      setTimeout(() => window.location.reload(), 1200)
    }
  }

  async function restoreUpload() {
    if (!file || upConfirm !== 'RESTORE' || phase !== 'idle') return
    setPhase('uploading')
    setPct(0)
    const form = new FormData()
    form.append('confirm', 'RESTORE') // the admin "type RESTORE" guard, sent alongside the file
    form.append('file', file)
    try {
      const r = await uploadWithProgress('/admin/restore/upload', form, (f) => {
        setPct(Math.round(f * 100))
        if (f >= 1) setPhase('restoring') // upload done, server applying
      })
      if (!r.ok) {
        setPhase('idle')
        return toast(errText(r, 'restore failed — the current data is intact'))
      }
      toast('restore complete — logging you out')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      // A large restore can outlive the connection even when it succeeds
      // server-side; reload rather than freeze on 'Applying…'.
      setTimeout(() => window.location.reload(), 1200)
    }
  }

  const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const fmtSize = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

  return (
    <Card data-tour="backup">
      <SectionTitle>Backup &amp; restore</SectionTitle>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <GhostButton onClick={create} disabled={busy || restoring}>
            {busy ? 'Backing up…' : 'Back up now'}
          </GhostButton>
          {backup && (
            <a className="tp-link" href={apiURL('/admin/backup/download')}>
              download
            </a>
          )}
          <InfoDot text="A complete archive of your library, images, users and settings — including password hashes and API keys, so store the download somewhere safe. The server keeps only the most recent backup." />
        </div>
        {loaded && (
          <p className="microcopy">
            {backup ? (
              <>
                last backup: <b>{fmtWhen(backup.created)}</b> · {fmtSize(backup.size)}
              </>
            ) : (
              'no backup on this server yet'
            )}
          </p>
        )}
        {backup && (
          <div className="space-y-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <p className="microcopy" style={{ color: 'var(--error)' }}>
              Restoring replaces everything on this server with the backup from{' '}
              <b>{fmtWhen(backup.created)}</b> — all current users, libraries and settings are
              overwritten, and everyone is logged out.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="tp-input"
                style={{ maxWidth: 140, fontFamily: 'var(--font-mono)' }}
                placeholder="RESTORE"
                aria-label="Type RESTORE to confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <StickerButton onClick={restore} disabled={confirm !== 'RESTORE' || restoring || busy}>
                {restoring ? 'Restoring…' : 'Restore this backup'}
              </StickerButton>
            </div>
          </div>
        )}
        <div className="space-y-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <p className="microcopy" style={{ color: 'var(--error)' }}>
            Or restore from a backup <b>file</b> — one downloaded from this or another Tippani
            server. This replaces everything here with the file's contents; everyone is logged out.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".tar.gz,.tgz,application/gzip"
            className="hidden"
            aria-label="Choose a backup file to restore"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => fileRef.current?.click()} disabled={phase !== 'idle'}>
              {file ? 'Choose a different file…' : 'Choose backup file…'}
            </GhostButton>
            <span className="microcopy">{file ? `${file.name} · ${fmtSize(file.size)}` : 'no file chosen'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="tp-input"
              style={{ maxWidth: 140, fontFamily: 'var(--font-mono)' }}
              placeholder="RESTORE"
              aria-label="Type RESTORE to confirm the upload restore"
              value={upConfirm}
              onChange={(e) => setUpConfirm(e.target.value)}
              disabled={phase !== 'idle'}
            />
            <StickerButton
              onClick={restoreUpload}
              disabled={!file || upConfirm !== 'RESTORE' || phase !== 'idle' || restoring || busy}
            >
              {phase === 'uploading' ? `Uploading… ${pct}%` : phase === 'restoring' ? 'Applying…' : 'Restore from file'}
            </StickerButton>
          </div>
          {phase === 'uploading' && (
            <div
              aria-hidden="true"
              style={{ height: 6, maxWidth: 280, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}
            >
              <div style={{ height: '100%', width: `${pct}%`, background: 'currentColor', transition: 'width .15s' }} />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ---- shared bits ----

function SectionTitle({ children, right }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 16.5, fontWeight: 600 }}>{children}</h2>
      {right}
    </div>
  )
}

// StatusChip — small mono pill; tone drives the palette (§2 chips).
function StatusChip({ tone = 'muted', children }) {
  const tones = {
    active: { color: 'var(--accent-ui)', bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', bd: 'color-mix(in srgb, var(--accent) 45%, transparent)' },
    ok: { color: 'var(--accent-ui)', bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', bd: 'color-mix(in srgb, var(--accent) 45%, transparent)' },
    error: { color: 'var(--error)', bg: 'color-mix(in srgb, var(--error) 14%, transparent)', bd: 'color-mix(in srgb, var(--error) 50%, transparent)' },
    muted: { color: 'var(--faint)', bg: 'var(--raised)', bd: 'var(--line)' },
  }
  const t = tones[tone] || tones.muted
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: 5,
        padding: '3px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// ---- 1. Appearance (§4, mockup 26) ----

// SizeSlider — a plain range that sets a catalogue grid's cell size, persisted
// per screen in localStorage via useCoverSize. The Library and Catalogue grids
// read the same key on mount, so changing it here resizes their posters/covers.
// (Replaces the old reel "roll" slider that sat in the toolbars — and never even
// drove the movie grid.)
function SizeSlider({ label, storageKey, def }) {
  const [size, setSize] = useCoverSize(storageKey, def)
  return (
    <div>
      <MonoLabel className="mb-2 block">{label}</MonoLabel>
      <div className="flex items-center gap-3" style={{ minHeight: 36 }}>
        <input
          type="range"
          min={96}
          max={240}
          value={size}
          aria-label={label}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ width: 190, accentColor: 'var(--accent-ui)', cursor: 'pointer' }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)', minWidth: 42 }}>
          {size}px
        </span>
      </div>
    </div>
  )
}

// The four presets ARE the theme selector: clicking one sets aesthetic + theme
// together. Rendered with hardcoded §4 palette colours (each shows its own combo
// regardless of the live theme); the live accent is threaded through so the
// callout edge/dot + selection ring all follow the chosen accent.
const PRESETS = [
  { aesthetic: 'paper', theme: 'light', label: 'Paper · Light', card: 'linear-gradient(180deg,#FFFFFC,#FCF8ED)', ink: '#221C16', border: 'rgba(41,38,29,.5)', line: '#E4DAC7' },
  { aesthetic: 'paper', theme: 'dark', label: 'Paper · Dark', card: 'linear-gradient(180deg,#352D23,#2C251E)', ink: '#EFE6D4', border: 'rgba(239,230,212,.32)', line: '#453B2D' },
  { aesthetic: 'film', theme: 'light', label: 'Film · Light', card: 'linear-gradient(180deg,#FDFAF3,#F7F2E4)', ink: '#2A241C', border: 'rgba(185,138,68,.45)', line: '#DFD6C4', strip: '#E9E1CC', holes: '#F7F2E6', amber: '#B98A44' },
  { aesthetic: 'film', theme: 'dark', label: 'Film · Dark', card: 'linear-gradient(180deg,#251E16,#1D1710)', ink: '#ECE3D1', border: 'rgba(214,162,92,.3)', line: '#322A20', strip: '#0F0B07', holes: 'rgba(236,227,209,.5)', amber: '#D6A25C' },
]

// PresetCard — one clickable combo. Fixed height across all four (a reserved
// header row keeps film's sprocket bar from making it taller), real material
// texture on the callout, and a selection state: solid accent ring + ✓ when
// chosen manually, dashed ring + ⟳ when it's the OS-matched card in sync mode.
// Off-theme cards dim while syncing.
function PresetCard({ spec, accentHex, code, selected, auto, dimmed, onClick }) {
  const film = spec.aesthetic === 'film'
  const dark = spec.theme === 'dark'
  const accent = dark ? `color-mix(in oklab, ${accentHex}, white 20%)` : accentHex
  const texClass = (film ? 'tex-film' : 'tex-paper') + (dark ? ' dark-combo' : '')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${spec.label}${auto ? ' (matches system)' : ''}`}
      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', opacity: dimmed ? 0.45 : 1, transition: 'opacity .2s ease' }}
    >
      <div
        style={{
          position: 'relative',
          height: 120,
          display: 'flex',
          flexDirection: 'column',
          background: film ? spec.strip : 'transparent',
          border: `1px solid ${spec.line}`,
          borderRadius: film ? 12 : '13px 10px 14px 9px / 9px 14px 10px 13px',
          padding: film ? 8 : 10,
          boxShadow: selected && !auto ? `0 0 0 2px var(--card), 0 0 0 4px ${accent}` : 'none',
          outline: auto ? `2px dashed ${accent}` : 'none',
          outlineOffset: 2,
        }}
      >
        {/* reserved header row → uniform height whether or not sprockets show */}
        <div className="flex items-center justify-between" style={{ height: 12, marginBottom: 6 }} aria-hidden="true">
          {film && (
            <>
              <span className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <i key={i} style={{ width: 5, height: 5, borderRadius: 2, background: spec.holes, display: 'block' }} />
                ))}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '.2em', color: `color-mix(in srgb, ${spec.amber} 60%, transparent)` }}>
                {code} ▸
              </span>
            </>
          )}
        </div>
        <div
          className={`preset-callout ${texClass}`}
          style={{
            flex: 1,
            background: spec.card,
            border: `1px solid ${spec.border}`,
            borderLeft: `3px solid ${accent}`,
            borderRadius: film ? 8 : '10px 7px 11px 8px / 8px 11px 7px 10px',
            padding: '10px 11px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12, lineHeight: 1.35, color: spec.ink }}>
            the margins, wider than the text…
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, display: 'block' }} />
            <span style={{ flex: 1, height: 4, borderRadius: 2, background: `color-mix(in srgb, ${spec.ink} 22%, transparent)` }} />
          </div>
        </div>
        {selected && (
          <span
            aria-hidden="true"
            style={{ position: 'absolute', top: -9, right: -9, width: 22, height: 22, borderRadius: 999, background: accent, color: '#FFF9EC', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,.45)' }}
          >
            {auto ? '⟳' : '✓'}
          </span>
        )}
      </div>
      <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: selected ? 'var(--accent-ui)' : 'var(--faint)' }}>
        {spec.label}
      </p>
    </button>
  )
}

const prefersDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

function Appearance({ onPreferences }) {
  // Seed from the appearance actually applied (getResolvedTheme reads the
  // concrete aesthetic off the DOM + the raw theme preference). The stored
  // theme pref maps to this panel's model: 'system' ⇒ syncSystem; 'light'/'dark'
  // ⇒ that manualTheme.
  const applied = getResolvedTheme()
  const [aesthetic, setAesthetic] = useState(applied.aesthetic)
  const [syncSystem, setSyncSystem] = useState(applied.theme === 'system')
  const [manualTheme, setManualTheme] = useState(applied.theme === 'system' ? (prefersDark() ? 'dark' : 'light') : applied.theme)
  const [sysTheme, setSysTheme] = useState(prefersDark() ? 'dark' : 'light')
  const [accent, setAccent] = useState(applied.accent)
  const base = useFrameBase()

  // Track the OS theme live so the auto-matched card follows it while syncing.
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const m = matchMedia('(prefers-color-scheme: dark)')
    const fn = () => setSysTheme(m.matches ? 'dark' : 'light')
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])

  const effectiveTheme = syncSystem ? sysTheme : manualTheme

  // persist applies the change to the live DOM immediately (§4), lifts it to App
  // so the session user stays current, and PUTs it. The stored theme token is
  // 'system' while syncing, else the explicit light/dark. Every field rides
  // along so changing one never resets another.
  function persist(next) {
    const s = { aesthetic, syncSystem, manualTheme, accent, ...next }
    setAesthetic(s.aesthetic)
    setSyncSystem(s.syncSystem)
    setManualTheme(s.manualTheme)
    setAccent(s.accent)
    const merged = { aesthetic: s.aesthetic, theme: s.syncSystem ? 'system' : s.manualTheme, accent: s.accent }
    applyTheme(merged)
    onPreferences?.(merged)
    json('PUT', '/auth/me/preferences', merged)
  }

  // Clicking a preset: in sync mode, a card whose theme matches the OS just
  // switches aesthetic (stays auto); the opposite-theme card is an explicit
  // choice that turns sync off and locks that theme. In manual mode it sets both.
  function selectPreset(cardA, cardT) {
    if (syncSystem && cardT === sysTheme) persist({ aesthetic: cardA })
    else persist({ aesthetic: cardA, manualTheme: cardT, syncSystem: false })
  }

  return (
    <Card data-tour="appearance">
      <SectionTitle>Appearance</SectionTitle>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <MonoLabel>Theme</MonoLabel>
        <Toggle
          ariaLabel="Match system theme"
          value={syncSystem ? 'auto' : 'manual'}
          onChange={(v) => persist({ syncSystem: v === 'auto' })}
          options={[['manual', 'Manual'], ['auto', 'Match system']]}
        />
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        {PRESETS.map((spec, i) => {
          const selected = spec.aesthetic === aesthetic && spec.theme === effectiveTheme
          return (
            <PresetCard
              key={spec.label}
              spec={spec}
              accentHex={ACCENTS[accent]}
              code={frameCode(base, i)}
              selected={selected}
              auto={syncSystem && selected}
              dimmed={syncSystem && spec.theme !== sysTheme}
              onClick={() => selectPreset(spec.aesthetic, spec.theme)}
            />
          )
        })}
      </div>

      {/* Accent + the two size sliders share one wrapping row on desktop;
          flex-wrap stacks them on narrow screens. */}
      <div className="mt-7 flex flex-wrap gap-x-10 gap-y-5">
        <div>
          <MonoLabel className="mb-2 block">Accent</MonoLabel>
          <div className="flex items-center gap-3" style={{ minHeight: 44 }}>
            {Object.entries(ACCENTS).map(([name, hex]) => {
              const on = accent === name
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-pressed={on}
                  onClick={() => persist({ accent: name })}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: `linear-gradient(180deg, color-mix(in oklab, ${hex}, white 14%), ${hex})`,
                    border: '1.4px solid var(--ink-border)',
                    boxShadow: on ? '0 0 0 2px var(--card), 0 0 0 4px var(--accent-ui)' : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>
        <SizeSlider label="Library cover size" storageKey="tippani:size:books" def={165} />
        <SizeSlider label="Catalogue poster size" storageKey="tippani:size:movies" def={150} />
      </div>
    </Card>
  )
}

// ---- 2. Metadata sources (§2, mockup 27) ----

// SecretField masks a stored write-only secret. When set and not being edited
// it shows a "saved" chip + Edit button; there is no way to reveal the value.
function SecretField({ set, editing, onEdit, value, onChange, placeholder }) {
  if (set && !editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="tp-chip" title="stored — cannot be shown">•••••••••• saved</span>
        {/* Edit is a pill to sit in line with the "saved" chip (not a full button). */}
        <button type="button" className="tp-chip tp-chip-btn" onClick={onEdit}>Edit</button>
      </div>
    )
  }
  return (
    <input
      className="tp-input"
      style={{ maxWidth: 320 }}
      placeholder={placeholder}
      value={value}
      autoComplete="off"
      onChange={onChange}
    />
  )
}

function Metadata({ user }) {
  const admin = user.is_admin
  const [status, setStatus] = useState(null)
  const [tmdbKey, setTmdbKey] = useState('')
  const [tvdbKey, setTvdbKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [amazonCookie, setAmazonCookie] = useState('')
  const [amazonDomain, setAmazonDomain] = useState('')
  // Which secret fields are being edited (a saved secret is masked until then).
  const [edit, setEdit] = useState({}) // {tmdb, google, amazon}
  const [amazonHelp, setAmazonHelp] = useState(false)
  const [keys, setKeys] = useState(null) // {tmdb_key_set, google_books_key_set, amazon_cookie_set, amazon_domain}
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadStatus() {
    const r = await json('GET', '/metadata/status')
    if (r.ok) setStatus(r.data)
  }
  async function loadKeys() {
    const r = await json('GET', '/admin/metadata-keys')
    if (r.ok) {
      setKeys(r.data)
      setAmazonDomain(r.data.amazon_domain || '')
    }
  }
  useEffect(() => {
    loadStatus()
    if (admin) loadKeys()
  }, [admin])

  const source = status?.tmdb?.source
  const lookup = status?.books_lookup
  const booksTone = lookup?.ok === false ? 'error' : lookup?.ok === true ? 'ok' : 'muted'
  const booksLabel = lookup?.ok === false ? 'Lookup failing' : lookup?.ok === true ? 'OK' : 'Untested'
  const tmdbTone = source === 'none' ? 'error' : 'active'
  const tmdbLabel =
    source === 'builtin' ? 'Built-in key · active'
      : source === 'custom' ? 'Custom key'
        : 'No key'
  const tvdbSource = status?.tvdb?.source
  const tvdbTone = tvdbSource === 'none' || !tvdbSource ? 'muted' : 'active'
  const tvdbLabel = tvdbSource === 'custom' ? 'Custom key' : 'No key (optional)'

  // Secrets are write-only: GET reports only whether each is set, never the
  // value. Only fields the admin actually edited are sent (the PUT leaves any
  // omitted field untouched), so revealing one field to change it can't wipe
  // the others. The Amazon domain is not secret, so it always rides along.
  async function saveKeys() {
    setSaving(true)
    setError('')
    // Send a secret whenever its input is visible — it isn't set yet (and the
    // key-state has loaded), or its Edit button was clicked. A masked field is
    // omitted so it stays untouched. The `keys &&` guard matters: before the
    // state loads, sending a blank field would clear an already-saved key.
    const shown = (setFlag, editing) => editing || (keys && !setFlag)
    const body = { amazon_domain: amazonDomain.trim() }
    if (shown(keys?.tmdb_key_set, edit.tmdb)) body.tmdb_key = tmdbKey
    if (shown(keys?.tvdb_key_set, edit.tvdb)) body.tvdb_key = tvdbKey
    if (shown(keys?.google_books_key_set, edit.google)) body.google_books_key = googleKey
    if (shown(keys?.amazon_cookie_set, edit.amazon)) body.amazon_cookie = amazonCookie
    const r = await json('PUT', '/admin/metadata-keys', body)
    setSaving(false)
    if (r.ok) {
      setTmdbKey('')
      setTvdbKey('')
      setGoogleKey('')
      setAmazonCookie('')
      setEdit({})
      loadStatus()
      loadKeys()
    } else {
      setError(errText(r, 'could not save keys'))
    }
  }

  return (
    <Card data-tour="metadata-keys">
      <SectionTitle>Metadata sources</SectionTitle>

      {/* Books */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <MonoLabel>Books</MonoLabel>
          <span style={{ fontWeight: 600 }}>Google Books + Open Library</span>
          <StatusChip tone={booksTone}>{booksLabel}</StatusChip>
          <InfoDot text="Merged best-effort, on demand — manual entry always works. Optional Google Books key only if you exceed ~1,000 lookups/day: console.cloud.google.com → enable Books API → paste it below." />
        </div>
        {lookup?.ok === false && lookup.error && (
          <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--error)' }}>
            last error: {lookup.error}
          </p>
        )}
        {admin && (
          <div className="mt-2.5">
            <SecretField
              set={keys?.google_books_key_set}
              editing={edit.google}
              onEdit={() => setEdit((e) => ({ ...e, google: true }))}
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="Google Books API key — optional"
            />
          </div>
        )}
      </div>

      {/* Movies & Shows */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <MonoLabel>Movies &amp; Shows</MonoLabel>
          <span style={{ fontWeight: 600 }}>TMDB</span>
          <StatusChip tone={tmdbTone}>{tmdbLabel}</StatusChip>
          <span style={{ fontWeight: 600 }}>+ TheTVDB</span>
          <StatusChip tone={tvdbTone}>{tvdbLabel}</StatusChip>
          <InfoDot text="Both cover movies and shows; lookup merges them. TMDB: themoviedb.org → Settings → API → free v3 key (or set TIPPANI_TMDB_API_KEY). TheTVDB optional: thetvdb.com → account → API key (or TIPPANI_TVDB_API_KEY). No key ⇒ lookup 503; manual entry still works." />
        </div>
        {admin && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SecretField
                set={keys?.tmdb_key_set}
                editing={edit.tmdb}
                onEdit={() => setEdit((e) => ({ ...e, tmdb: true }))}
                value={tmdbKey}
                onChange={(e) => setTmdbKey(e.target.value)}
                placeholder="TMDB v3 key or v4 token — overrides built-in"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SecretField
                set={keys?.tvdb_key_set}
                editing={edit.tvdb}
                onEdit={() => setEdit((e) => ({ ...e, tvdb: true }))}
                value={tvdbKey}
                onChange={(e) => setTvdbKey(e.target.value)}
                placeholder="TheTVDB v4 API key — optional"
              />
            </div>
          </div>
        )}
      </div>

      {/* Amazon (advanced): cover-by-ASIN needs nothing; the optional cookie
          adds description/genres by scraping the product page. */}
      {admin && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <MonoLabel>Amazon</MonoLabel>
            <span style={{ fontWeight: 600 }}>Kindle / ASIN</span>
            <StatusChip tone={keys?.amazon_cookie_set ? 'ok' : 'muted'}>
              {keys?.amazon_cookie_set ? 'Cookie saved' : 'Covers only'}
            </StatusChip>
          </div>
          <p className="mt-2" style={{ fontSize: 13, color: 'var(--soft)', lineHeight: 1.5 }}>
            Covers work from an ASIN with no setup. Optional cookie adds description + genres.{' '}
            <InfoDot text="The cookie is fragile, against Amazon's terms, and grants access to your account — stored write-only and never shown." />{' '}
            <button type="button" className="tp-link" onClick={() => setAmazonHelp((v) => !v)}>
              {amazonHelp ? 'hide' : 'how to get the cookie'}
            </button>
          </p>
          {amazonHelp && (
            <ol className="mt-2 space-y-1" style={{ fontSize: 12.5, color: 'var(--soft)', paddingLeft: 18, listStyle: 'decimal' }}>
              <li>Sign in to Amazon in your browser, on the marketplace your books live on.</li>
              <li>Open DevTools (F12) → <b>Application</b> (Chrome) or <b>Storage</b> (Firefox) → Cookies → the amazon domain.</li>
              <li>Copy the <b>Cookie header</b>: easiest is the Network tab → click any amazon request → Request Headers → copy the whole <code>cookie:</code> value.</li>
              <li>Paste it below and set the domain (e.g. <code>www.amazon.com</code> or <code>www.amazon.de</code>).</li>
            </ol>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SecretField
              set={keys?.amazon_cookie_set}
              editing={edit.amazon}
              onEdit={() => setEdit((e) => ({ ...e, amazon: true }))}
              value={amazonCookie}
              onChange={(e) => setAmazonCookie(e.target.value)}
              placeholder="Amazon session cookie — optional"
            />
            <input
              className="tp-input"
              style={{ maxWidth: 200 }}
              placeholder="www.amazon.com"
              value={amazonDomain}
              autoComplete="off"
              onChange={(e) => setAmazonDomain(e.target.value)}
            />
          </div>
        </div>
      )}

      {admin && (
        <div className="flex items-center gap-2">
          <StickerButton onClick={saveKeys} disabled={saving}>{saving ? 'Saving…' : 'Save keys'}</StickerButton>
          <InfoDot text="Secrets are write-only — saved keys show masked. Edit to replace, or save a blank field to clear." />
        </div>
      )}

      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

// ---- 4. Users (§8.11, admin only) ----

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
    <Card>
      <SectionTitle right={<MonoLabel>admin only</MonoLabel>}>Users</SectionTitle>
      <ul className="space-y-1">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="user-chip" style={{ width: 30, height: 30, fontSize: 13 }} aria-hidden="true">
              {u.avatar_path
                ? <img src={coverImgURL(u.avatar_path)} alt="" />
                : (u.username || '?').trim().charAt(0).toLowerCase()}
            </span>
            <span style={{ fontWeight: 600 }}>{u.username}</span>
            {u.is_admin && <StatusChip tone="active">admin</StatusChip>}
            <span className="ml-auto flex items-center gap-3">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)' }}>
                joined {(u.created_at || '').slice(0, 10)}
              </span>
              {u.id === me.id ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--soft)' }}>you</span>
              ) : (
                <button
                  onClick={() => removeUser(u)}
                  title={`Delete ${u.username}`}
                  aria-label={`Delete ${u.username}`}
                  style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: 16, padding: 4, lineHeight: 1 }}
                >
                  ✕
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={addUser} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="tp-input"
          style={{ flex: 1, minWidth: 130 }}
          placeholder="username"
          value={username}
          autoComplete="off"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="tp-input"
          style={{ flex: 1, minWidth: 130 }}
          placeholder="password (min 8)"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <StickerButton>Add user</StickerButton>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  )
}
