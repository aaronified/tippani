import { useEffect, useState } from 'react'
import { json, errText } from './api.js'
import { ACCENTS, applyTheme, getResolvedTheme } from './theme.js'
import {
  ErrorText,
  GhostButton,
  InfoDot,
  MonoLabel,
  PageHeader,
  StickerButton,
  Toggle,
  frameCode,
  useCoverSize,
  useFrameBase,
} from './ui.jsx'

// Settings (§8.11): Appearance, Metadata sources, Library stats, Change
// password, and (admin only) Users. Appearance applies instantly via
// applyTheme and persists via PUT /auth/me/preferences.
// useColumnCount tracks how many masonry columns fit: 1 (mobile) / 2 / 3 (wide).
function useColumnCount() {
  const read = () => (typeof window === 'undefined' ? 2 : window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1)
  const [n, setN] = useState(read)
  useEffect(() => {
    const fn = () => setN(read())
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return n
}

export default function Settings({ user, onPreferences }) {
  // Masonry that minimises page height. The tall Metadata card is ~40% of the
  // total, so any 2-column split leaves it dominating one column with a long
  // empty gap (the CSS-multicol balancer and a naive round-robin both did this,
  // or worse). Instead: on wide screens use 3 columns and hand-pack the cards
  // greedily — tallest first into the currently-shortest column — so Metadata
  // sits alone while the three short cards fill the other two. Weights are rough
  // relative heights (Metadata collapses for non-admins, who also lack Users).
  const ncols = useColumnCount()
  const cards = [
    { w: user.is_admin ? 5.5 : 1.6, node: <Metadata key="meta" user={user} /> },
    { w: 3, node: <Stats key="stats" /> },
    { w: 2.4, node: <PasswordForm key="pw" /> },
    user.is_admin ? { w: 1.9, node: <AdminUsers key="users" me={user} /> } : null,
  ].filter(Boolean)
  const cols = Array.from({ length: ncols }, () => ({ h: 0, nodes: [] }))
  ;[...cards]
    .sort((a, b) => b.w - a.w)
    .forEach((c) => {
      const target = cols.reduce((m, x) => (x.h < m.h ? x : m), cols[0])
      target.nodes.push(c.node)
      target.h += c.w
    })
  return (
    <section className="space-y-6">
      <PageHeader title="Settings" counts={user.is_admin ? 'admin' : user.username} />
      <Appearance user={user} onPreferences={onPreferences} />
      <div className="grid items-start gap-6" style={{ gridTemplateColumns: `repeat(${ncols}, minmax(0, 1fr))` }}>
        {cols.map((col, i) => (
          <div key={i} className="space-y-6">{col.nodes}</div>
        ))}
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

function Appearance({ user, onPreferences }) {
  const p = user.preferences || {}
  // Seed from the appearance actually applied (getResolvedTheme reads the
  // concrete aesthetic off the DOM + the raw theme preference). The stored
  // theme pref maps to this panel's model: 'system' ⇒ syncSystem; 'light'/'dark'
  // ⇒ that manualTheme. Home isn't a theme token, so it comes from prefs.
  const applied = getResolvedTheme()
  const [aesthetic, setAesthetic] = useState(applied.aesthetic)
  const [syncSystem, setSyncSystem] = useState(applied.theme === 'system')
  const [manualTheme, setManualTheme] = useState(applied.theme === 'system' ? (prefersDark() ? 'dark' : 'light') : applied.theme)
  const [sysTheme, setSysTheme] = useState(prefersDark() ? 'dark' : 'light')
  const [accent, setAccent] = useState(applied.accent)
  const [home, setHome] = useState(p.home || 'library')
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
    const s = { aesthetic, syncSystem, manualTheme, accent, home, ...next }
    setAesthetic(s.aesthetic)
    setSyncSystem(s.syncSystem)
    setManualTheme(s.manualTheme)
    setAccent(s.accent)
    setHome(s.home)
    const merged = { aesthetic: s.aesthetic, theme: s.syncSystem ? 'system' : s.manualTheme, accent: s.accent, home: s.home }
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
    <Card>
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

      <div className="mt-7 flex flex-wrap gap-x-10 gap-y-5">
        <Toggle
          label="Start page"
          value={home}
          onChange={(v) => persist({ home: v })}
          options={[['library', 'Library'], ['movies', 'Catalogue']]}
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
      </div>

      <div className="mt-6 flex flex-wrap gap-x-10 gap-y-5">
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
  const [refetch, setRefetch] = useState(null) // {fetched, failed}
  const [refetching, setRefetching] = useState(false)

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
        : source === 'env' ? 'Env key'
          : 'No key'
  const tvdbSource = status?.tvdb?.source
  const tvdbTone = tvdbSource === 'none' || !tvdbSource ? 'muted' : 'active'
  const tvdbLabel =
    tvdbSource === 'custom' ? 'Custom key' : tvdbSource === 'env' ? 'Env key' : 'No key (optional)'

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
        <div className="mb-6">
          <StickerButton onClick={saveKeys} disabled={saving}>{saving ? 'Saving…' : 'Save keys'}</StickerButton>
          <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--faint)' }}>
            secrets are write-only — saved keys show masked; Edit to replace, or save a blank field to clear
          </p>
        </div>
      )}

      {/* Covers */}
      <div>
        <div className="flex items-center gap-2">
          <MonoLabel>Covers</MonoLabel>
          <InfoDot text="Stored in MediaCover/ (arr-style), fetched once, served locally. Re-fetch tries every cover-less book against Open Library (ISBN) + Amazon (ASIN) — no key needed — plus any poster cached from a lookup." />
        </div>
        {admin && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <GhostButton onClick={doRefetch} disabled={refetching}>
              {refetching ? 'Re-fetching…' : 'Re-fetch missing'}
            </GhostButton>
            {refetch && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--soft)' }}>
                {refetch.fetched} covers · {refetch.enriched || 0} enriched · {refetch.failed} failed
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
    <div style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px', overflow: 'hidden' }}>
      {/* inline-flex baseline group keeps the heart hugging the number and inside
          the tile even in a narrow column (fixes the "favourites out of bounds"). */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        {heart && <span style={{ color: 'var(--accent-ui)', fontSize: 13, lineHeight: 1 }}>♥</span>}
      </div>
      <MonoLabel className="mt-2 block">{label}</MonoLabel>
    </div>
  )
}

// shortMonth turns "2026-02" into "Feb" for the activity dots.
function shortMonth(ym) {
  if (!ym) return ''
  const m = MONTHS[Number(ym.split('-')[1]) - 1]
  return m ? m.slice(0, 3) : ym
}

// ActivityPlot — a row of accent dots (not a grid), one per month for the last
// six, each shaded by how much was saved that month (GitHub-contributions feel).
function ActivityPlot({ data }) {
  if (!data || data.length === 0) return null
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="mt-5" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <MonoLabel className="mb-3 block">Activity · last 6 months</MonoLabel>
      <div className="flex items-end justify-between gap-2">
        {data.map((d) => {
          const frac = d.count / max // 0..1
          // Shade of the accent: quiet months stay a faint ghost, busy months
          // approach full accent. Size nudges up slightly with activity too.
          const pct = d.count === 0 ? 10 : Math.round(28 + 62 * frac)
          const size = d.count === 0 ? 16 : 18 + Math.round(12 * frac)
          return (
            <div key={d.month} className="flex flex-1 flex-col items-center gap-1.5" title={`${shortMonth(d.month)}: ${d.count} saved`}>
              <span
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: `color-mix(in oklab, var(--accent-ui) ${pct}%, transparent)`,
                }}
              />
              <span className="mono-label" style={{ fontSize: 9.5 }}>{shortMonth(d.month)}</span>
              <span className="mono-label" style={{ fontSize: 9.5, color: d.count ? 'var(--accent-ui)' : 'var(--faint)' }}>{d.count}</span>
            </div>
          )
        })}
      </div>
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
          <ActivityPlot data={s.monthly_activity} />
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
