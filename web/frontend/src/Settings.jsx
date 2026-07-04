import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import { ACCENTS, applyTheme } from './theme.js'
import {
  ErrorText,
  GhostButton,
  MonoLabel,
  PageHeader,
  StickerButton,
  frameCode,
  useFrameBase,
} from './ui.jsx'

// Settings (§8.11): Appearance, Metadata sources, Library stats, Change
// password, and (admin only) Users. Appearance applies instantly via
// applyTheme and persists via PUT /auth/me/preferences.
export default function Settings({ user }) {
  return (
    <section className="space-y-6">
      <PageHeader title="Settings" counts={user.is_admin ? 'admin' : user.username} />
      <Appearance user={user} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Metadata user={user} />
        <Stats />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <PasswordForm />
        {user.is_admin && <AdminUsers me={user} />}
      </div>
    </section>
  )
}

// ---- shared bits ----

function Card({ className = '', children }) {
  return <div className={'hand-card p-6 ' + className}>{children}</div>
}

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

function Segmented({ label, value, options, onChange }) {
  return (
    <div>
      <MonoLabel className="mb-2 block">{label}</MonoLabel>
      <div
        role="group"
        style={{
          display: 'inline-flex',
          gap: 3,
          padding: 4,
          background: 'var(--card)',
          border: '1.4px solid var(--line)',
          borderRadius: 11,
        }}
      >
        {options.map(([val, lbl]) => {
          const on = value === val
          return (
            <button
              key={val}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(val)}
              className={on ? 'sheen-accent' : ''}
              style={{
                minHeight: 36,
                padding: '6px 15px',
                fontFamily: 'var(--font-ui)',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                background: on ? undefined : 'transparent',
                color: on ? undefined : 'var(--soft)',
              }}
            >
              {lbl}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Four static palette previews rendered with hardcoded §4 palette colours; the
// live accent is threaded through so all four update when the accent changes.
const PREVIEWS = [
  { label: 'PAPER · LIGHT', def: true, film: false, dark: false, card: 'linear-gradient(180deg,#FFFFFC,#FCF8ED)', ink: '#221C16', border: 'rgba(41,38,29,.5)', line: '#E4DAC7' },
  { label: 'PAPER · DARK', def: false, film: false, dark: true, card: 'linear-gradient(180deg,#352D23,#2C251E)', ink: '#EFE6D4', border: 'rgba(239,230,212,.32)', line: '#453B2D' },
  { label: 'FILM · LIGHT', def: false, film: true, dark: false, card: 'linear-gradient(180deg,#FDFAF3,#F7F2E4)', ink: '#2A241C', border: 'rgba(185,138,68,.45)', line: '#DFD6C4', strip: '#E9E1CC', holes: '#F7F2E6', amber: '#B98A44' },
  { label: 'FILM · DARK', def: true, film: true, dark: true, card: 'linear-gradient(180deg,#251E16,#1D1710)', ink: '#ECE3D1', border: 'rgba(214,162,92,.3)', line: '#322A20', strip: '#0F0B07', holes: 'rgba(236,227,209,.5)', amber: '#D6A25C' },
]

function PalettePreview({ spec, accentHex, code }) {
  const accent = spec.dark ? `color-mix(in oklab, ${accentHex}, white 20%)` : accentHex
  return (
    <div>
      <div
        style={{
          background: spec.film ? spec.strip : 'transparent',
          border: `1px solid ${spec.line}`,
          borderRadius: spec.film ? 12 : '13px 10px 14px 9px / 9px 14px 10px 13px',
          padding: spec.film ? 8 : 10,
        }}
      >
        {spec.film && (
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <span className="flex gap-1.5" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} style={{ width: 6, height: 6, borderRadius: 2, background: spec.holes, display: 'block' }} />
              ))}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, letterSpacing: '.25em', color: `color-mix(in srgb, ${spec.amber} 60%, transparent)` }}>
              {code} ▸
            </span>
          </div>
        )}
        <div
          style={{
            background: spec.card,
            border: `1px solid ${spec.border}`,
            borderRadius: spec.film ? 8 : '10px 7px 11px 8px / 8px 11px 7px 10px',
            borderLeft: `3px solid ${accent}`,
            padding: '12px 13px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.4, color: spec.ink }}>
            the margins, wider than the text…
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, display: 'block' }} />
            <span style={{ flex: 1, height: 4, borderRadius: 2, background: `color-mix(in srgb, ${spec.ink} 22%, transparent)` }} />
          </div>
        </div>
      </div>
      <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>
        {spec.label}
        {spec.def && <span style={{ color: 'var(--accent-ui)' }}> — default</span>}
      </p>
    </div>
  )
}

function Appearance({ user }) {
  const p = user.preferences || {}
  const [aesthetic, setAesthetic] = useState(p.aesthetic || 'paper')
  const [theme, setTheme] = useState(p.theme || 'system')
  const [accent, setAccent] = useState(p.accent || 'terracotta')
  const base = useFrameBase()

  // update applies the change to the live DOM immediately (§4) and persists it;
  // the persisted set is the source of truth on the next login.
  function update(next) {
    const merged = { aesthetic, theme, accent, ...next }
    setAesthetic(merged.aesthetic)
    setTheme(merged.theme)
    setAccent(merged.accent)
    applyTheme(merged)
    json('PUT', '/auth/me/preferences', merged)
  }

  return (
    <Card>
      <SectionTitle>Appearance</SectionTitle>
      <div className="flex flex-wrap gap-x-10 gap-y-5">
        <Segmented
          label="Aesthetic"
          value={aesthetic}
          onChange={(v) => update({ aesthetic: v })}
          options={[['paper', 'Paper'], ['film', 'Film']]}
        />
        <Segmented
          label="Theme"
          value={theme}
          onChange={(v) => update({ theme: v })}
          options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']]}
        />
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
                  onClick={() => update({ accent: name })}
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
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {PREVIEWS.map((spec, i) => (
          <PalettePreview key={spec.label} spec={spec} accentHex={ACCENTS[accent]} code={frameCode(base, i)} />
        ))}
      </div>
    </Card>
  )
}

// ---- 2. Metadata sources (§2, mockup 27) ----

function Metadata({ user }) {
  const admin = user.is_admin
  const [status, setStatus] = useState(null)
  const [tmdbKey, setTmdbKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [keys, setKeys] = useState(null) // {tmdb_key_set, google_books_key_set}
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refetch, setRefetch] = useState(null) // {fetched, failed}
  const [refetching, setRefetching] = useState(false)

  async function loadStatus() {
    const r = await json('GET', '/metadata/status')
    if (r.ok) setStatus(r.data)
  }
  useEffect(() => {
    loadStatus()
    if (admin) json('GET', '/admin/metadata-keys').then((r) => r.ok && setKeys(r.data))
  }, [admin])

  const source = status?.tmdb?.source
  const lookup = status?.books_lookup
  const booksTone = lookup?.ok === false ? 'error' : lookup?.ok === true ? 'ok' : 'muted'
  const booksLabel = lookup?.ok === false ? 'Lookup failing' : lookup?.ok === true ? 'OK' : 'Untested'
  const tmdbTone = source === 'none' ? 'error' : 'active'
  const tmdbLabel =
    source === 'builtin' ? 'Built-in key · active'
      : source === 'custom' ? 'Custom key'
        : source === 'env' ? 'Env key'
          : 'No key'

  // Both keys persist together (PUT takes both; "" clears). Fields are
  // write-only — GET reports only whether a key is stored.
  async function saveKeys() {
    setSaving(true)
    setError('')
    const r = await json('PUT', '/admin/metadata-keys', { tmdb_key: tmdbKey, google_books_key: googleKey })
    setSaving(false)
    if (r.ok) {
      setTmdbKey('')
      setGoogleKey('')
      loadStatus()
      json('GET', '/admin/metadata-keys').then((rr) => rr.ok && setKeys(rr.data))
    } else {
      setError(errText(r, 'could not save keys'))
    }
  }

  async function doRefetch() {
    setRefetching(true)
    setRefetch(null)
    const r = await json('POST', '/covers/refetch')
    setRefetching(false)
    if (r.ok) {
      setRefetch(r.data)
      loadStatus()
    } else {
      setError(errText(r, 'could not re-fetch covers'))
    }
  }

  return (
    <Card>
      <SectionTitle>Metadata sources</SectionTitle>

      {/* Books */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <MonoLabel>Books</MonoLabel>
          <span style={{ fontWeight: 600 }}>Google Books + Open Library</span>
          <StatusChip tone="muted">No key needed</StatusChip>
        </div>
        <div className="mt-2">
          <StatusChip tone={booksTone}>{booksLabel}</StatusChip>
        </div>
        <p className="mt-2.5" style={{ fontSize: 13.5, color: 'var(--soft)', lineHeight: 1.5 }}>
          Merged best-effort, on demand. Manual entry always works. Optional key (only past ~1,000
          lookups/day): console.cloud.google.com → enable Books API → paste below.
        </p>
        {lookup?.ok === false && lookup.error && (
          <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--error)' }}>
            last error: {lookup.error}
          </p>
        )}
        {admin && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="tp-input"
              style={{ maxWidth: 300 }}
              placeholder={keys?.google_books_key_set ? 'Google Books key saved — type to replace' : 'Google Books API key — optional'}
              value={googleKey}
              autoComplete="off"
              onChange={(e) => setGoogleKey(e.target.value)}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)' }}>~1,000/day free</span>
          </div>
        )}
      </div>

      {/* Movies */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <MonoLabel>Movies</MonoLabel>
          <span style={{ fontWeight: 600 }}>TMDB</span>
          <StatusChip tone={tmdbTone}>{tmdbLabel}</StatusChip>
        </div>
        <p className="mt-2.5" style={{ fontSize: 13.5, color: 'var(--soft)', lineHeight: 1.5 }}>
          Working. Get your own key: themoviedb.org → Settings → API → request a free v3 key, paste
          below (or set TIPPANI_TMDB_API_KEY). Without any key, lookup answers 503 — manual entry keeps
          working.
        </p>
        {admin && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="tp-input"
              style={{ maxWidth: 300 }}
              placeholder={keys?.tmdb_key_set ? 'Custom key saved — type to replace' : 'Custom v3 key or v4 token — overrides built-in'}
              value={tmdbKey}
              autoComplete="off"
              onChange={(e) => setTmdbKey(e.target.value)}
            />
            <StickerButton onClick={saveKeys} disabled={saving}>Save</StickerButton>
          </div>
        )}
        {admin && (
          <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--faint)' }}>
            saving stores both keys; leave a field blank to clear it
          </p>
        )}
      </div>

      {/* Covers */}
      <div>
        <MonoLabel className="block">Covers</MonoLabel>
        <p className="mt-2" style={{ fontSize: 13.5, color: 'var(--soft)', lineHeight: 1.5 }}>
          Covers live in MediaCover/, fetched once, served locally (arr-style).
        </p>
        {admin && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <GhostButton onClick={doRefetch} disabled={refetching}>Re-fetch missing</GhostButton>
            {refetch && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--soft)' }}>
                {refetch.fetched} fetched · {refetch.failed} failed
              </span>
            )}
          </div>
        )}
      </div>

      <ErrorText>{error}</ErrorText>
    </Card>
  )
}

// ---- 3. Library stats (§10, mockup 27) ----

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// formatMonth turns "YYYY-MM" into "Month YYYY".
function formatMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const name = MONTHS[Number(m) - 1]
  return name ? `${name} ${y}` : ym
}

function StatTile({ n, label, heart }) {
  return (
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>
        {n}
        {heart && <span style={{ color: 'var(--accent-ui)', fontSize: 16 }}> ♥</span>}
      </div>
      <MonoLabel className="mt-2 block">{label}</MonoLabel>
    </div>
  )
}

function StatRow({ label, title, count, amber }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <MonoLabel>{label}</MonoLabel>
      <span className="text-right" style={{ fontSize: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{title || '—'}</span>
        {count != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: amber ? 'var(--amber)' : 'var(--accent-ui)' }}>
            {'  ·  '}{count}
          </span>
        )}
      </span>
    </div>
  )
}

function Stats() {
  const [s, setS] = useState(null)
  useEffect(() => {
    json('GET', '/stats').then((r) => r.ok && setS(r.data))
  }, [])

  return (
    <Card>
      <SectionTitle>Library stats</SectionTitle>
      {!s ? (
        <p className="tp-empty" style={{ padding: '24px 0' }}>loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile n={s.books} label="Books" />
            <StatTile n={s.annotations} label="Quotes" />
            <StatTile n={s.movies} label="Films" />
            <StatTile n={s.dialogues} label="Dialogues" />
            <StatTile n={s.tags} label="Tags" />
            <StatTile n={s.favorites} label="Favourites" heart />
          </div>
          <div className="mt-5" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <StatRow label="Most annotated" title={s.most_annotated?.title} count={s.most_annotated?.count} />
            <StatRow label="Most quoted film" title={s.most_quoted?.title} count={s.most_quoted?.count} />
            <StatRow
              label="Busiest month"
              title={s.busiest_month ? formatMonth(s.busiest_month.month) : null}
              count={s.busiest_month ? `${s.busiest_month.count} saved` : null}
              amber
            />
          </div>
        </>
      )}
    </Card>
  )
}

// ---- 4. Change password (§8.11) ----

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
    if (next !== repeat) {
      setError('new passwords do not match')
      return
    }
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
    <Card>
      <SectionTitle>Change password</SectionTitle>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="tp-input"
          placeholder="current password"
          type="password"
          value={current}
          autoComplete="current-password"
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          className="tp-input"
          placeholder="new password (min 8)"
          type="password"
          value={next}
          autoComplete="new-password"
          onChange={(e) => setNext(e.target.value)}
        />
        <input
          className="tp-input"
          placeholder="repeat new password"
          type="password"
          value={repeat}
          autoComplete="new-password"
          onChange={(e) => setRepeat(e.target.value)}
        />
        <ErrorText>{error}</ErrorText>
        {done && <p style={{ fontSize: 13.5, color: 'var(--soft)' }}>Password updated.</p>}
        <StickerButton className="w-full" disabled={busy}>Update password</StickerButton>
        <p className="microcopy">changing your password signs out every other session</p>
      </form>
    </Card>
  )
}

// ---- 5. Users (§8.11, admin only) ----

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
              {(u.username || '?').trim().charAt(0).toLowerCase()}
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
