import { useEffect, useRef, useState } from 'react'
import { DEMO, json, errText, coverImgURL, copyText, apiURL, uploadWithProgress } from './api.js'
import { ACCENTS, applyColors, applyLabels, applyTheme, CAT_NAME_MAX, CATEGORY_PALETTE, categoryState, getResolvedTheme, LABELS_KEY, labelsPref, UNSET_LABEL } from './theme.js'
import { tourFeatures, tourSteps } from './tour.jsx'
import { createPortal } from 'react-dom'
import { PASSPHRASE_MAX, PASSPHRASE_MIN, PASSWORD_MAX, passphraseProblem, sniffArchiveKey } from './secret.js'
import {
  Card,
  CloseButton,
  ErrorText,
  filterChipClass,
  frameCode,
  GhostButton,
  IconCheck,
  IconClose,
  IconCopy,
  IconDelete,
  IconDevice,
  IconEdit,
  IconRefresh,
  IconRestore,
  IconRevert,
  IconUserPlus,
  InfoDot,
  MobileSheet,
  MonoLabel,
  PageHeader,
  StickerButton,
  toast,
  Toggle,
  Tooltip,
  useCoverSize,
  useFrameBase,
  useIsMobileScreen,
  useBodyScrollLock,
} from './ui.jsx'

// Settings (§8.11): Appearance, Metadata sources, review/credits prefs, and
// (admin only) Updates + Backup. Library stats now live on their own Stats page
// (StatsPage.jsx). Appearance applies instantly via applyTheme and persists via
// PUT /auth/me/preferences.
// Where the roadmap lives. It is a self-contained static page under docs/ and is
// NOT embedded in the binary, so a self-hosted instance cannot serve it from its
// own origin — it links out to the published copy. The demo uses a relative path
// so it works whatever the Pages subpath is, and that path climbs one level:
// the demo is published at /demo/ and the docs sit at the site root beside the
// landing page.
const DOCS_BASE = DEMO ? '../' : 'https://aaronified.github.io/tippani/'

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

// SETTINGS_CARDS — every card, in the order a single column shows them. This is
// the canonical list; SETTINGS_LAYOUT below has to agree with it, and a test
// says so.
export const SETTINGS_CARDS = ['onboard', 'meta', 'colors', 'sr', 'devices', 'upd', 'backup']

// SETTINGS_LAYOUT — which column each card sits in, at each column count,
// decided here rather than measured.
//
// Settings used the height-packing Masonry that every board uses, and this is
// the one screen where that is the wrong tool. Masonry places cards
// TALLEST-FIRST onto the currently-shortest column, off their real rendered
// heights. Two cards on this page change height after they load: Updates grows
// when a check finds a release, and Backup grows when an archive exists.
//
// So the page rearranges itself under you. The worst case is the one that
// sounds like it should be safe — a phone, where there is only one column and
// the columns therefore cannot change. The tallest-first ORDER still can: you
// tap "check for updates", the answer arrives, the card grows, and it is
// re-sorted somewhere else on the page while you are reading it. You then have
// to go and find the thing you just asked for.
//
// A board of quotes has no natural order, so packing by height costs nothing
// and buys a tidy board. A settings page has a natural order and seven cards.
// The order is worth more than the packing.
//
// ADDING A CARD: put its key in SETTINGS_CARDS and in one column of every
// layout below. It will not render until you do — the render walks the layout,
// not the card list — which is a loud failure rather than a card appearing
// somewhere unpredictable. settings-layout.test.js checks the three agree.
// Colours sit directly under Metadata in every layout, and that is a rule rather
// than an arrangement: both are about what a quote is LABELLED with — where the
// facts about a work come from, and what the colour on a highlight is called —
// so reading down one column reads as one subject.
export const SETTINGS_LAYOUT = {
  1: [SETTINGS_CARDS],
  2: [
    ['meta', 'colors', 'onboard'],
    ['sr', 'devices', 'upd', 'backup'],
  ],
  3: [
    ['meta', 'colors'], // the tall one, and the card that belongs under it
    ['sr', 'onboard'],
    ['devices', 'upd', 'backup'],
  ],
}

// settingsColumns resolves the fixed layout against the cards actually present:
// a non-admin has no Updates and no Backup, and their columns simply come up
// shorter rather than everything below sliding up into the gap.
export function settingsColumns(ncols, presentKeys) {
  const layout = SETTINGS_LAYOUT[ncols] || SETTINGS_LAYOUT[1]
  const present = new Set(presentKeys)
  return layout.map((col) => col.filter((k) => present.has(k)))
}

export default function Settings({ user, onPreferences, update, onUpdateInfo, onStartTour }) {
  const mobile = useIsMobileScreen()
  const ncols = useColumnCount()
  const cards = {
    onboard: <OnboardingCard user={user} onStartTour={onStartTour} />,
    meta: <Metadata user={user} onPreferences={onPreferences} />,
    sr: <SRSettings user={user} onPreferences={onPreferences} />,
    colors: <ColourCategoriesCard prefs={user.preferences} onSaved={onPreferences} />,
    devices: <DevicesCard />,
    ...(user.is_admin
      ? {
          upd: <UpdatesCard user={user} update={update} onUpdateInfo={onUpdateInfo} />,
          backup: <BackupCard user={user} />,
        }
      : {}),
  }
  const columns = settingsColumns(ncols, Object.keys(cards))
  return (
    <section className="space-y-6">
      <div className={mobile ? 'mobile-sticky-bar' : ''}>
        <PageHeader title="Settings" counts={user.is_admin ? 'admin' : user.username} />
      </div>
      <Appearance onPreferences={onPreferences} />
      {/* align-items:start so a short column stays short instead of stretching
          its last card to match the tallest column. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          gap: 24,
          alignItems: 'start',
        }}
      >
        {columns.map((col, i) => (
          <div key={i} className="space-y-6">
            {col.map((k) => (
              <div key={k}>{cards[k]}</div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

// CreditSeparators — which separators split a joined multi-author credit
// ("Gaiman & Pratchett") into distinct people, across group-by headings and
// the People console (ROADMAP §11). Stored as the creditSeparators pref
// ("none" = splitting off). The author string stored on each book is never
// rewritten — only the people views split — so this is safe to flip freely.
// Chips show the bare symbol; the key doubles as the screen-reader name.
//
// A SECTION OF THE METADATA CARD, not a card of its own. Four chips and a label
// is not a subject; it is a footnote to one, and the subject is the card it now
// sits at the bottom of. A lookup returns "Gaiman & Pratchett" as one string and
// this decides whether that is one person or two, so the question only arises
// because of the sources above it — and a card with four chips in it was
// claiming the same share of a settings page as the keys every lookup runs on.
const CREDIT_SEP_OPTIONS = [
  ['comma', ','],
  ['semicolon', ';'],
  ['amp', '&'],
  ['and', '“and”'],
]
function CreditSeparators({ user, onPreferences }) {
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
    <div className="settings-subsection">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MonoLabel>Multi-author credits</MonoLabel>
        <InfoDot title="Multi-author credits" text="A credit like “Gaiman & Pratchett” lists as two people — in group-by headings and the People console — split on the separators picked here. The author line stored on each book stays untouched, so this is safe to change at any time. Turn the comma off if your library stores authors as “Last, First”." />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CREDIT_SEP_OPTIONS.map(([key, label]) => (
          <Tooltip key={key} label="Split credits on this separator" side="top">
            <button
              type="button"
              className={'tp-filter-chip' + (active.has(key) ? ' active' : '')}
              aria-pressed={active.has(key)}
              aria-label={key}
              onClick={() => toggle(key)}
            >
              {label}
            </button>
          </Tooltip>
        ))}
      </div>
      {active.size === 0 && (
        <p className="microcopy mt-2">splitting is off — every credit stays one person</p>
      )}
    </div>
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

// ---- colour categories --------------------------------------------------

// CAT_NAME_MAX comes from theme.js, which is also where the Stats breakdown gets
// it — one number, so the input's cap and the column cut to hold it cannot drift
// apart. The server REFUSES a longer name rather than truncating it, so the
// maxLength below is the courtesy that stops anyone reaching that: the input will
// not take a 16th character, and the rejection path stays there for a client that
// is not this one.

// ColourCategoriesCard — what the four highlight colours are CALLED.
//
// A quote's colour is the top of the hierarchy: tags say what it is about, the
// colour says what kind of note it is. Naming them is the difference between
// filtering by "blue" and filtering by "Fact".
//
// THE STORED TOKEN NEVER CHANGES. Everything here is presentation, which is why
// a rename cannot break a Markdown export or an import — and why the Go side has
// a test whose whole job is to prove that.
//
// THE FIRST SLOT IS NOT A CATEGORY. It is the default: the column default is
// yellow and an import with no colour writes yellow too, so a yellow quote may
// be yellow because you chose it or because nobody chose anything. Naming it
// would relabel every unmarked quote you have ever imported, so the field is not
// offered and the server refuses it. Its colour is presentation and stays yours.
function ColourCategoriesCard({ prefs, onSaved }) {
  const [rows, setRows] = useState(categoryState)
  const [picking, setPicking] = useState(null) // slot whose palette is open
  const [err, setErr] = useState('')

  // Re-seed when the session prefs change under us — another tab, or the
  // account switching. categoryState reads the applied values, so this stays in
  // step with what is on screen rather than with a stale prop.
  useEffect(() => { setRows(categoryState()) }, [prefs])

  async function save(patch) {
    const next = { ...collect(rows), ...patch }
    applyColors({ ...prefs, ...next })
    setRows(categoryState())
    const r = await json('PUT', '/auth/me/preferences', next)
    if (!r.ok) {
      setErr(errText(r, 'could not save'))
      // Put the screen back to what the server still believes, so the card can
      // never show a name that was refused.
      applyColors(prefs || {})
      setRows(categoryState())
      return
    }
    setErr('')
    onSaved?.(next)
  }

  const visible = rows.filter((r) => !r.hidden).length

  return (
    // The dot goes THROUGH SectionTitle rather than beside it. Wrapping the
    // title in another flex row put the heading's own 16px bottom margin between
    // the two, so the dot floated above the baseline of the words it belongs to;
    // SectionTitle already lays a dot out on the heading's own line, which is
    // where it was wanted, and it carries the standing copy that a line of
    // microcopy underneath was repeating in shorter words.
    <Card data-tour="categories">
      <SectionTitle
        info="The six highlight colours, named. Tags say what a quote is about; its colour says what kind of note it is — a fact, a line you disagreed with, something to come back to. Renaming one changes nothing but the words on your screen: the stored value stays yellow, blue, pink or orange, so exports and imports round-trip exactly as before. Hiding a category takes it out of the pickers without touching a single quote already wearing it."
      >
        Colour categories
      </SectionTitle>
      <div>
        {rows.map((row) => (
          <div key={row.token} className="inline-field">
            <div className={'inline-field-head' + (picking === row.slot ? '' : ' is-flush')} style={{ gap: 10 }}>
              <Tooltip label={row.fixed ? 'The default colour' : `Recolour ${row.label}`}>
                <button
                  type="button"
                  className="color-dot-btn"
                  aria-label={`Recolour ${row.label}`}
                  aria-expanded={picking === row.slot}
                  onClick={() => setPicking(picking === row.slot ? null : row.slot)}
                >
                  <span className="color-dot active" style={{ background: `var(--hl-${row.slot})` }} />
                </button>
              </Tooltip>
              {row.fixed ? (
                <div className="min-w-0 flex-1">
                  <span style={{ fontWeight: 600 }}>{UNSET_LABEL}</span>
                  <InfoDot
                    title="Why this one has no name"
                    text="This is the colour a quote gets when nobody picks one — it is the column default, and an import with no colour written in it lands here too. So a quote is this colour either because you chose it or because nothing was ever chosen, and those cannot be told apart. Naming it would put a label on every unmarked quote you have imported. Its colour is still yours to change."
                  />
                </div>
              ) : (
                <input
                  className="tp-input"
                  style={{ flex: 1, minWidth: 0 }}
                  value={row.name}
                  maxLength={CAT_NAME_MAX}
                  placeholder={row.defaultName}
                  aria-label={`Name for the ${row.token} category`}
                  onChange={(e) => setRows(rows.map((r) => (r.slot === row.slot ? { ...r, name: e.target.value } : r)))}
                  onBlur={() => save({})}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
              )}
              {!row.fixed && (
                <Tooltip label={row.hidden ? 'Offer this again' : visible <= 2 ? 'Keep two categories' : 'Stop offering this'}>
                  <button
                    type="button"
                    className={'field-icon-btn tactile' + (row.hidden ? ' is-active' : '')}
                    aria-label={row.hidden ? 'Offer this category' : 'Hide this category'}
                    aria-pressed={row.hidden}
                    disabled={!row.hidden && visible <= 2}
                    onClick={() => save({ [`catHidden${row.slot}`]: !row.hidden })}
                  >
                    {row.hidden ? <IconEyeOff /> : <IconEye />}
                  </button>
                </Tooltip>
              )}
              {row.custom && (
                <Tooltip label="Back to the original">
                  <button
                    type="button"
                    className="field-icon-btn tactile"
                    aria-label="Reset this colour"
                    onClick={() => save({ [`catColor${row.slot}`]: '' })}
                  >
                    <IconRevert />
                  </button>
                </Tooltip>
              )}
            </div>
            {picking === row.slot && (
              <div className="cat-palette" role="listbox" aria-label={`Colour for ${row.label}`}>
                {CATEGORY_PALETTE.map(([hex, name]) => (
                  <Tooltip key={hex} label={name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={row.hex.toLowerCase() === hex.toLowerCase()}
                      aria-label={name}
                      className={'cat-swatch' + (row.hex.toLowerCase() === hex.toLowerCase() ? ' is-on' : '')}
                      style={{ background: hex }}
                      onClick={() => { setPicking(null); save({ [`catColor${row.slot}`]: hex }) }}
                    />
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <ErrorText>{err}</ErrorText>
    </Card>
  )
}

// collect turns the card's rows back into the flat preference fields. Flat
// because the Go struct is flat, and the Go struct is flat because ui_test.go
// compares it with != and a struct holding a map is not comparable.
function collect(rows) {
  const out = {}
  for (const r of rows) {
    if (!r.fixed) {
      out[`catName${r.slot}`] = r.name.trim()
      out[`catHidden${r.slot}`] = r.hidden
    }
    out[`catColor${r.slot}`] = r.custom ? r.hex : ''
  }
  return out
}

// The eye pair: whether a category is offered in the pickers. Not a delete —
// nothing about a quote changes — so an eye rather than a bin.
function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  )
}
function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 5.9A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8" />
      <path d="M6.3 7.7A17.6 17.6 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.6-.7" />
      <path d="M4 4l16 16" />
    </svg>
  )
}

// ReviewScope — which media the deck draws from, as three independent choices.
//
// It was a three-way Toggle: Books, Films & shows, and a third option labelled
// "Both". Two things were wrong with that. "Both" named THREE media — standalone
// quotes have been in the deck since they existed, and the server has accepted a
// "quotes" scope all along — so the label undercounted what it did and there was
// no way to ask for quotes at all. And because the choices were exclusive, "books
// and quotes but not films" was unsayable: narrowing away one medium cost you
// another one you had not mentioned.
//
// Chips rather than a dropdown, because three toggles are three toggles and a
// popover to hold them is a click in the way. The stored value is a
// comma-separated list, which the server has understood since this release and
// which keeps every legacy single-word value working.
//
// You cannot turn the last one off. An empty scope is a deck with nothing in it,
// which looks exactly like a deck you have finished — so the last remaining chip
// says why it will not budge instead of leaving you to discover it.
const REVIEW_MEDIA = [
  ['books', 'Books', 'Your book highlights'],
  ['movies', 'Films & shows', 'Dialogue from the catalogue'],
  ['quotes', 'Quotes', 'Speeches, letters, anything else'],
]

export function parseScope(value) {
  const raw = String(value || '').toLowerCase()
  // 'both' predates the third medium and means everything; so does anything
  // unrecognised, matching the server, because a scope that fails to parse must
  // never silently empty the deck.
  const toks = raw.split(',').map((t) => t.trim()).filter(Boolean)
  const keys = new Set()
  for (const t of toks) {
    if (t === 'both' || t === 'all') return REVIEW_MEDIA.map((m) => m[0])
    if (t === 'screen') keys.add('movies')
    else if (REVIEW_MEDIA.some((m) => m[0] === t)) keys.add(t)
  }
  if (keys.size === 0) return REVIEW_MEDIA.map((m) => m[0])
  return REVIEW_MEDIA.map((m) => m[0]).filter((k) => keys.has(k))
}

export function ReviewScope({ value, onChange }) {
  const on = parseScope(value)
  const last = on.length === 1
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <MonoLabel>Review covers</MonoLabel>
        <InfoDot
          title="Review covers"
          text="Which of the three kinds of quote the Daily Quiz and Practice draw from. They are independent: you can review books and standalone quotes without film dialogue, which the old three-way switch could not say. A quote with no speaker and no occasion never joins the deck whatever this says — there is nothing to recall but the words already in front of you — and nothing you have saved in the last week does either."
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {REVIEW_MEDIA.map(([key, label, hint]) => {
          const picked = on.includes(key)
          const stuck = picked && last
          return (
            <Tooltip key={key} label={stuck ? 'The deck needs one' : hint}>
              <button
                type="button"
                className={filterChipClass(picked)}
                aria-pressed={picked}
                onClick={() => {
                  if (stuck) return
                  const next = picked ? on.filter((k) => k !== key) : [...on, key]
                  onChange(REVIEW_MEDIA.map((m) => m[0]).filter((k) => next.includes(k)).join(','))
                }}
              >
                {label}
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

// SRSettings — the spaced-repetition knobs (v0.5.0 Daily Quiz & Practice): the
// daily deck size, what the review covers (books / films & shows / both), and
// whether Practice is allowed to move the schedule. The review intervals
// themselves are a fixed ladder (7 → 30 → 100 days, review_handlers.go)
// and not tunable. Each knob persists via the partial-merge preferences PUT.
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
          <InfoDot text="These settings drive both the Daily Quiz and Practice. A card's review interval climbs a fixed ladder — 7, 30, then 100 days — one step per correct recall; one lapse drops it straight back to 7. Every quote carries a status dot — remembered, forgetting or probably forgotten — with its half-life on hover." />
        }
      >
        Daily quiz &amp; practice
      </SectionTitle>
      <div className="space-y-5">
        <Slider label="Daily quiz cards / day" min={2} max={10} step={1} value={p.srDaily || 8} onCommit={(v) => set({ srDaily: v })} />
        <ReviewScope value={p.srReviewScope} onChange={(v) => set({ srReviewScope: v })} />
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
    toast('reload in a moment')
  }

  const copyCmd = async () => {
    const ok = await copyText(info?.guided_command || '')
    toast(ok ? 'command copied' : 'copy failed — select it manually')
  }

  return (
    <Card>
      <SectionTitle>Updates</SectionTitle>
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <MonoLabel>version</MonoLabel>
          {user?.releases_url ? (
            <Tooltip label="Release notes on GitHub" side="bottom">
              <a
                href={user.releases_url}
                target="_blank"
                rel="noopener noreferrer"
                className="tp-link"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              >
                {current} ↗
              </a>
            </Tooltip>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{current}</span>
          )}
        </div>

        {/* What shipped is in the release notes above; what is still ahead — and where to
            ask for something, or say what is broken — is the roadmap. It belongs here
            rather than only under Reference, because "what version am I on" and "what is
            coming" are the same question asked twice. */}
        <p className="microcopy" style={{ fontSize: 12.5 }}>
          What is still ahead is on the{' '}
          <a className="tp-link" href={`${DOCS_BASE}roadmap.html`} target="_blank" rel="noreferrer">
            roadmap ↗
          </a>{' '}
          — including the bugs I already know about, which is worth a look before you
          report one. Requests and bug reports both start there too.
        </p>

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
                      One-click update needs the Docker socket mounted, or a socket proxy configured
                      (see the README). To update by hand, run on your host:
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

// BackupCard (admin only) — server-side backup & restore (§ backup). Exactly one
// dated, ENCRYPTED archive of the whole data dir is kept in <data>/backups: "Back
// up now" builds a fresh one (older ones are dropped once it exists) and starts
// the download; restoring replaces EVERYTHING on the server with its contents,
// in-process — no Docker socket.
//
// 1.4.1 rewrote this card around three complaints, all of them fair.
//
// It was TWO restores. One button restored the archive on the server, a second
// restored an archive from disk, each with its own warning paragraph and its own
// typed confirmation — two of everything for one operation whose only real
// variable is where the file is. It is one control now with a source picker: the
// kept archive, or a file. Everything downstream reads that one choice.
//
// It was a WALL OF TEXT. Three red paragraphs saying much the same thing, above
// the buttons, on a screen already dense. The consequences have not changed and
// are not softened — but they are one line each now, in the dialog you are
// standing in when they apply, which is where a warning is actually read.
//
// And it needs a KEY. The archive is sealed (backup_crypto.go), so backing up
// asks for your password (or a passphrase you set), and restoring asks for
// whatever the chosen archive's own header says it wants — which is why the
// source picker resolves `keyOf` before the prompt opens rather than guessing.
// The Reference card — two link-out buttons to the hand-written UI glossary and
// the roadmap — was removed here and from the demo. The glossary it pointed at
// is the one thing on this screen the "?" button on every screen now does
// better: help that sits beside the control, cannot 404, and cannot lag the code
// by a release. The roadmap link survives, in the Updates card, where "what
// version am I on" and "what is coming" are the same question asked twice.

// OnboardingCard — the guided tour's home (ROADMAP: onboarding). Lists every
// feature (the same tourFeatures the tour walks, so the list can't drift), and
// starts / replays / resumes the tour. The tour runs by itself on a user's
// first launch; "finish later" parks it here as a Resume button. The sample
// content is built in — onboarding never asks for the user's files.
//
// The card's own explanation and each feature's blurb are InfoDots now: the
// blurbs made a wall of ~12 two-line rows that pushed the Start button off a
// phone screen, and the feature NAMES are the part worth scanning.
function OnboardingCard({ user, onStartTour }) {
  const state = user.preferences?.tour || ''
  const step = user.preferences?.tourStep || 0
  const feats = tourFeatures(user.is_admin)
  const total = tourSteps(user.is_admin).length
  return (
    <Card>
      <SectionTitle
        right={state === 'done' && <MonoLabel style={{ color: 'var(--ok)' }}>✓ completed</MonoLabel>}
        info="A guided tour of every feature. It runs once on first launch and never needs your files — a sample book quote and film dialogue are built in. Next skips a step, “finish later” parks it, and you pick it back up here."
        infoTitle="Onboarding"
      >
        Onboarding
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        {state === 'postponed' ? (
          <>
            <StickerButton onClick={() => onStartTour?.(step)}>
              Resume tour · step {Math.min(step + 1, total)} of {total}
            </StickerButton>
            <GhostButton icon={<IconRefresh />} onClick={() => onStartTour?.(0)}>Start over</GhostButton>
          </>
        ) : (
          <StickerButton onClick={() => onStartTour?.(0)}>
            {state ? 'Replay the tour' : 'Start the tour'}
          </StickerButton>
        )}
      </div>
      <ul className="mt-4 space-y-1.5" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        {feats.map((f) => (
          <li key={f.key} className="flex items-center gap-1.5" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            <span>{f.name}</span>
            <InfoDot title={f.name} text={f.blurb} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

// DevicesCard — pair a phone with this account, and revoke one.
//
// A paired device carries a bearer token, not a session cookie: no expiry, and
// a password change deliberately does NOT revoke it (see auth.DeviceTokens), so
// rotating your password can't silently unpair a phone with no signal on the
// device. Revoking is its own explicit act, which is what this card is for.
//
// The code is shown as text rather than a QR: the QR only saves typing, and
// there is no app to point a camera at it yet. It lands with the app.
function DevicesCard() {
  const [devices, setDevices] = useState(null)
  const [pair, setPair] = useState(null) // {code, expires_at} while pairing
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const r = await json('GET', '/auth/devices')
    if (r.ok) setDevices(r.data.devices)
    else setErr(errText(r, 'could not load devices'))
  }
  useEffect(() => {
    load()
  }, [])

  async function startPairing() {
    setBusy(true)
    const r = await json('POST', '/auth/devices/pair')
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'could not start pairing'))
    setErr('')
    setPair(r.data)
  }

  async function revoke(d) {
    if (!confirm(`Unpair “${d.name}”? It will stop working immediately.`)) return
    const r = await json('DELETE', `/auth/devices/${d.id}`)
    if (!r.ok) return setErr(errText(r, 'could not revoke device'))
    setErr('')
    toast('device unpaired')
    load()
  }

  async function revokeAll() {
    if (!confirm('Unpair every device? Each will stop working immediately.')) return
    const r = await json('POST', '/auth/devices/revoke-all')
    if (!r.ok) return setErr(errText(r, 'could not revoke devices'))
    setErr('')
    toast('all devices unpaired')
    load()
  }

  return (
    <Card>
      <SectionTitle
        right={devices?.length ? <MonoLabel>{devices.length} paired</MonoLabel> : null}
        info="Pairs the Android app with this account. A device stays paired until you unpair it here — changing your password signs out browsers but deliberately leaves phones alone, so a routine password change can’t silently unpair them."
      >
        Devices
      </SectionTitle>

      {pair ? (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="flex items-center gap-1.5">
            <MonoLabel>pairing code</MonoLabel>
            <InfoDot title="Pairing code" text="Enter it in the app within five minutes. It works once, then expires — start another pairing for a second device." />
          </div>
          <div
            className="mt-1 select-all"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 30,
              letterSpacing: '0.18em',
              fontWeight: 600,
            }}
          >
            {pair.code}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tooltip label="Copy the code">
              <button type="button" className="field-icon-btn tactile" aria-label="Copy the pairing code" onClick={() => copyText(pair.code)}>
                <IconCopy />
              </button>
            </Tooltip>
            <Tooltip label="Done">
              <button
                type="button"
                className="field-icon-btn field-icon-btn-ok tactile"
                aria-label="Done pairing"
                onClick={() => {
                  setPair(null)
                  load()
                }}
              >
                <IconCheck />
              </button>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <StickerButton icon={<IconDevice />} keepLabel onClick={startPairing} disabled={busy}>
            Pair a device
          </StickerButton>
          {devices?.length > 0 && (
            <Tooltip label="Unpair every device">
              <button type="button" className="field-icon-btn field-icon-btn-danger tactile" aria-label="Unpair every device" onClick={revokeAll}>
                <IconDelete />
              </button>
            </Tooltip>
          )}
        </div>
      )}

      {devices?.length > 0 && (
        <ul className="mt-4 space-y-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-3" style={{ fontSize: 12.5 }}>
              <span>
                <b>{d.name}</b>
                <span style={{ color: 'var(--soft)' }}>
                  {' — '}
                  {d.last_seen_at ? `last seen ${fmtStamp(d.last_seen_at)}` : 'never used'}
                </span>
              </span>
              <span className="ml-auto">
                <Tooltip label={`Unpair ${d.name}`}>
                  <button
                    type="button"
                    className="field-icon-btn field-icon-btn-danger tactile"
                    aria-label={`Unpair ${d.name}`}
                    onClick={() => revoke(d)}
                  >
                    <IconClose />
                  </button>
                </Tooltip>
              </span>
            </li>
          ))}
        </ul>
      )}
      {devices?.length === 0 && !pair && (
        <p className="microcopy mt-3" style={{ fontSize: 12, color: 'var(--soft)' }}>
          No devices paired yet.
        </p>
      )}
      <ErrorText>{err}</ErrorText>
    </Card>
  )
}

// fmtStamp renders a SQLite "YYYY-MM-DD HH:MM:SS" (UTC) as a local date-time.
function fmtStamp(s) {
  const d = new Date(String(s).replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// RestorePrompt — the one dialog every restore goes through. Full-screen on a
// phone (it is a form with a password in it, and a cramped centred card is how
// people mistype passwords), a centred card on desktop, cancellable from either.
//
// It asks for exactly what the chosen archive needs and nothing else:
//
//   passphrase   one field.
//   account, mine    one field — my password. The account is already known.
//   account, theirs  two — whose account, and its password.
//   none (pre-1.4.1) the typed RESTORE, because there is no key to stand for it.
//
// The consequence line lives here rather than on the card: this is the moment it
// applies, and a warning you have to scroll past on the way to something else is
// a warning nobody reads.
function RestorePrompt({ meta, me, busyLabel, onCancel, onConfirm }) {
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)
 const mobile = useIsMobileScreen()
  const key = meta?.key || 'none'
  // `recoverable` (from the server for the kept archive, sniffed from the header
  // for a chosen file) means this box can open it with YOUR current password,
  // whatever password sealed it. That is the difference between asking for a
  // password and asking someone to remember one from six months ago, so it is
  // worth saying out loud rather than letting them find out by trying.
  const recoverable = !!meta?.recoverable
  const era = key === 'password' && meta.account && meta.account !== me
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')

  const missing =
    key === 'passphrase'
      ? passphrase ? '' : 'Enter the passphrase this archive was sealed with'
      : key === 'password'
        ? password ? '' : 'Enter your password'
        : confirm !== 'RESTORE'
          ? 'Type RESTORE to confirm'
          : ''

  const submit = (e) => {
    e.preventDefault()
    if (missing || busyLabel) return
    onConfirm(
      key === 'passphrase' ? { passphrase } : key === 'password' ? { password } : { confirm: 'RESTORE' },
    )
  }

  const body = (
    <form onSubmit={submit} className="space-y-3">
      <p className="microcopy" style={{ color: 'var(--error)' }}>
        Replaces everything on this server{meta?.created ? ` with the backup from ${fmtWhen(meta.created)}` : ''} — every
        user, library and setting. Everyone is logged out. The data being replaced is kept on the server as one
        recovery copy.
      </p>
      {key === 'passphrase' && (
        <label className="tp-field">
          <MonoLabel>Passphrase</MonoLabel>
          <input
            className="tp-input"
            type="password"
            autoFocus
            maxLength={PASSPHRASE_MAX}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </label>
      )}
      {key === 'password' && (
        <label className="tp-field">
          <MonoLabel>Your password</MonoLabel>
          <input
            className="tp-input"
            type="password"
            autoFocus
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="microcopy">
            {recoverable
              ? 'This server made this archive, so your current password opens it — even if it is not the one it was sealed with.'
              : era
                ? `Sealed by \u2018${meta.account}\u2019 on another server, so it needs that account\u2019s password as it was then.`
                : 'Not made on this server, so it needs the password that was current when it was made.'}
          </p>
        </label>
      )}
      {key !== 'passphrase' && key !== 'password' && (
        <label className="tp-field">
          <MonoLabel>Type RESTORE</MonoLabel>
          <input
            className="tp-input"
            style={{ fontFamily: 'var(--font-mono)' }}
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <p className="microcopy">This archive predates 1.4.1 and carries no key, so the typed word is the confirmation.</p>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <StickerButton disabled={!!missing || !!busyLabel} title={missing || undefined}>
          {busyLabel || 'Restore'}
        </StickerButton>
        <GhostButton type="button" disabled={!!busyLabel} onClick={onCancel}>Cancel</GhostButton>
      </div>
      {missing && <p className="microcopy" style={{ color: 'var(--faint)' }}>{missing}.</p>}
    </form>
  )

  if (mobile) {
    return createPortal(
      <MobileSheet open onClose={busyLabel ? () => {} : onCancel} title="Restore" dismissOnScrim={false}>
        {body}
      </MobileSheet>,
      document.body,
    )
  }
  return createPortal(
    <div
      className="tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Restore"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busyLabel) onCancel() }}
    >
      <div className="hand-card hc-r2 w-full" style={{ maxWidth: 460, padding: '18px 20px 20px' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 19 }}>Restore</h2>
          <Tooltip label="Cancel" side="bottom">
            <CloseButton onClick={onCancel} label="Cancel" tooltip="Cancel and close" disabled={!!busyLabel} />
          </Tooltip>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  )
}

// BackupPrompt — the twin on the way in: seal this archive with my password, or
// with a passphrase. Same framing as RestorePrompt, deliberately: the two are one
// operation seen from either end, and they should not look like different
// features.
function BackupPrompt({ me, busy, onCancel, onConfirm }) {
   // The page behind an overlay does not move. Without this a wheel or a swipe
  // running past the end of the dialog scrolls the page you cannot see, which is
  // still scrolled when you close this. Ref-counted, so a dialog opened from
  // inside a sheet does not unlock the sheet on its way out.
  useBodyScrollLock(true)
 const mobile = useIsMobileScreen()
  const [usePhrase, setUsePhrase] = useState(false)
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const missing = usePhrase ? passphraseProblem(passphrase) : password ? '' : 'Enter your password'

  const submit = (e) => {
    e.preventDefault()
    if (missing || busy) return
    onConfirm(usePhrase ? { passphrase } : { password })
  }

  const body = (
    <form onSubmit={submit} className="space-y-3">
      <p className="microcopy">
        The archive holds every user, library, password hash and API key, so it is encrypted before it leaves the
        server. Keep the key: it is what opens the archive on any other machine.
      </p>
      {!usePhrase ? (
        <label className="tp-field">
          <MonoLabel>Your password</MonoLabel>
          <input
            className="tp-input"
            type="password"
            autoFocus
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="microcopy">
            This password opens the archive on any Tippani. On THIS server your current password always will, even
            after you change it.
          </p>
        </label>
      ) : (
        <label className="tp-field">
          <MonoLabel>Passphrase · {PASSPHRASE_MIN}–{PASSPHRASE_MAX} characters</MonoLabel>
          <input
            className="tp-input"
            type="password"
            autoFocus
            maxLength={PASSPHRASE_MAX}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <p className="microcopy">Not tied to any account — and not recoverable. Lose it and the archive is lost.</p>
        </label>
      )}
      <button type="button" className="tp-link block" onClick={() => setUsePhrase((v) => !v)}>
        {usePhrase ? 'Use my account password instead' : 'Set a separate passphrase instead'}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <StickerButton disabled={!!missing || busy} title={missing || undefined}>
          {busy ? 'Backing up…' : 'Back up & download'}
        </StickerButton>
        <GhostButton type="button" disabled={busy} onClick={onCancel}>Cancel</GhostButton>
      </div>
      {missing && <p className="microcopy" style={{ color: 'var(--faint)' }}>{missing}.</p>}
    </form>
  )

  if (mobile) {
    return createPortal(
      <MobileSheet open onClose={busy ? () => {} : onCancel} title="Back up" dismissOnScrim={false}>
        {body}
      </MobileSheet>,
      document.body,
    )
  }
  return createPortal(
    <div
      className="tp-scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Back up"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
    >
      <div className="hand-card hc-r2 w-full" style={{ maxWidth: 460, padding: '18px 20px 20px' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 19 }}>Back up</h2>
          <Tooltip label="Cancel" side="bottom">
            <CloseButton onClick={onCancel} label="Cancel" tooltip="Cancel and close" disabled={busy} />
          </Tooltip>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  )
}

const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const fmtSize = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

function BackupCard({ user }) {
  const [backup, setBackup] = useState(null) // {name, created, size, key, account} | null
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false) // creating
  const [asking, setAsking] = useState(false) // backup prompt open
  // ONE restore, with a source. 'server' = the archive kept here; 'file' = one
  // chosen from disk (from this server or another). The two used to be separate
  // blocks with separate warnings and separate confirmations.
  const [source, setSource] = useState('server')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(null) // sniffArchiveKey result for `file`
  const [prompt, setPrompt] = useState(false) // restore prompt open
  const [phase, setPhase] = useState('idle') // idle | uploading | restoring
  const [pct, setPct] = useState(0)
  const fileRef = useRef(null)

  useEffect(() => {
    json('GET', '/admin/backup').then((r) => {
      if (r.ok) setBackup(r.data.backup)
      setLoaded(true)
    })
  }, [])

  async function chooseFile(f) {
    setFile(f)
    setFileKey(f ? await sniffArchiveKey(f) : null)
  }

  async function create(creds) {
    setBusy(true)
    const r = await json('POST', '/admin/backup', creds)
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'backup failed'))
    setAsking(false)
    setBackup(r.data.backup)
    toast('backup created — downloading')
    // Cookie-authed same-origin GET: the browser streams the file itself.
    window.location.href = apiURL('/admin/backup/download')
  }

  // The archive the restore prompt is about, and therefore which credential it
  // asks for: the kept one's metadata comes from the server, a chosen file's from
  // its own first bytes.
  const target = source === 'file' ? (file ? { ...fileKey, name: file.name } : null) : backup

  async function restore(creds) {
    if (!target) return
    setPhase(source === 'file' ? 'uploading' : 'restoring')
    setPct(0)
    try {
      let r
      if (source === 'file') {
        const form = new FormData()
        for (const [k, v] of Object.entries(creds)) form.append(k, v)
        form.append('file', file)
        r = await uploadWithProgress('/admin/restore/upload', form, (f) => {
          setPct(Math.round(f * 100))
          if (f >= 1) setPhase('restoring') // upload done, server applying
        })
      } else {
        r = await json('POST', '/admin/restore', creds)
      }
      if (!r.ok) {
        setPhase('idle')
        return toast(errText(r, 'restore failed — data intact'))
      }
      toast('restored · logging you out')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      // A large restore can outlive the connection even when it succeeds
      // server-side; reload rather than freeze on 'Applying…'.
      setTimeout(() => window.location.reload(), 1200)
    }
  }

  const busyLabel = phase === 'uploading' ? `Uploading… ${pct}%` : phase === 'restoring' ? 'Applying…' : ''
  // What the chosen source will ask for, said before you commit to it — so the
  // prompt is never a surprise, and a file whose passphrase you do not have is
  // obvious before the upload starts.
  const asks =
    !target
      ? ''
      : target.key === 'passphrase'
        ? 'asks for its passphrase'
        : target.key === 'password'
          ? target.recoverable
            ? 'asks for your password'
            : `asks for the password ‘${target.account || 'it'}’ had when it was made`
          : target.key === 'unknown'
            ? 'unreadable, or written by a newer Tippani'
            : 'predates 1.4.1 · no key, asks you to type RESTORE'

  return (
    <Card data-tour="backup">
      <SectionTitle
        info="One dated, encrypted archive of everything — your library, images, users and settings, including password hashes and API keys. Only the newest is kept on the server. It is sealed with your account password, or a passphrase you choose. On the server that made it your CURRENT password opens it, whichever password sealed it — that is a key kept in the data directory, never inside the archive. Carried to another machine it needs the password it was sealed with, so keep that. A passphrase archive is tied to nothing and recoverable by nothing: lose the passphrase and it is lost. Restoring goes the other way and replaces everything here — every user, library and setting — and logs everyone out; what it replaced is kept as one recovery copy in the data directory until the next restore. Restoring a file taken off another Tippani is how you move to a new box, and the archive must not come from a newer version than this server."
        infoTitle="Backup & restore"
      >
        Backup &amp; restore
      </SectionTitle>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <GhostButton onClick={() => setAsking(true)} disabled={busy || phase !== 'idle'}>
            {busy ? 'Backing up…' : 'Back up now'}
          </GhostButton>
          {backup && (
            <a className="tp-link" href={apiURL('/admin/backup/download')}>
              download
            </a>
          )}
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

        <div className="space-y-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {/* One label, no second dot. What this one said — restoring replaces
              everything and logs everyone out — is said twice more already: once
              in the heading's dot above, and once in red inside RestorePrompt,
              which is the moment it applies and the only place it is certain to
              be read. A card that explains the same consequence three times is
              not being three times as careful. */}
          <MonoLabel>restore from</MonoLabel>
          {/* One control, two sources. Choosing the source is the whole difference
              between what used to be two separate restore blocks. */}
          <Toggle
            ariaLabel="Restore from"
            value={source}
            onChange={setSource}
            options={[['server', 'This server'], ['file', 'A file']]}
          />
          {/* Just what it will ask for. "the archive kept here" was the Toggle's
              own "This server" said again in different words, one line below it. */}
          {source === 'server' && (
            <p className="microcopy">{backup ? asks : 'nothing kept here yet'}</p>
          )}
          {source === 'file' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".tpbk,.tar.gz,.tgz,application/gzip,application/octet-stream"
                className="hidden"
                aria-label="Choose a backup file to restore"
                onChange={(e) => chooseFile(e.target.files?.[0] || null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <GhostButton onClick={() => fileRef.current?.click()} disabled={phase !== 'idle'}>
                  {file ? 'Choose a different file…' : 'Choose file…'}
                </GhostButton>
                <span className="microcopy">{file ? `${file.name} · ${fmtSize(file.size)}` : 'no file chosen'}</span>
              </div>
              {file && <p className="microcopy">{asks}</p>}
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <StickerButton
              icon={<IconRestore />}
              keepLabel
              onClick={() => setPrompt(true)}
              disabled={!target || busy || phase !== 'idle'}
              title={!target ? (source === 'file' ? 'Choose a file first' : 'No backup on this server yet') : undefined}
            >
              Restore…
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

      {asking && (
        <BackupPrompt me={user.username} busy={busy} onCancel={() => setAsking(false)} onConfirm={create} />
      )}
      {prompt && target && (
        <RestorePrompt
          meta={target}
          me={user.username}
          busyLabel={busyLabel}
          onCancel={() => { setPrompt(false); setPhase('idle') }}
          onConfirm={restore}
        />
      )}
    </Card>
  )
}

// ---- shared bits ----

// SectionTitle — a settings card's heading. `info` is the paragraph that used to
// sit under it: every card on this screen opened with two or three lines of
// explanation, which on a phone meant scrolling past the prose to reach the one
// control each card exists for.
function SectionTitle({ children, right, info, infoTitle }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 16.5, fontWeight: 600 }}>{children}</h2>
        {info && <InfoDot text={info} title={infoTitle || (typeof children === 'string' ? children : 'About this')} />}
      </div>
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
                <Tooltip key={name} label={`Use the ${name} accent`} side="top">
                  <button
                    type="button"
                    aria-label={`${name} accent`}
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
                </Tooltip>
              )
            })}
          </div>
        </div>
        <SizeSlider label="Library cover size" storageKey="tippani:size:books" def={165} />
        <SizeSlider label="Catalogue poster size" storageKey="tippani:size:movies" def={150} />
        <LabelDensity />
      </div>
    </Card>
  )
}

// LabelDensity — whether a button that has a glyph also shows its words.
//
// Device-local, like the two cover-size sliders it sits beside and unlike
// everything else on this card: how much room a row of buttons has is a
// property of the screen you are looking at, not of the account. Signing in on
// a phone should not inherit the density you chose for a 27-inch monitor, and
// riding it on the account would mean exactly that.
//
// It also has to stay out of `persist` above, which re-sends every theme field
// on any change — a label preference in that object would be wiped by an
// unrelated accent click. This writes its own key and calls applyLabels
// directly; theme.js owns the attribute either way.
//
// Auto is the default and resolves against the same 768px breakpoint the CSS
// uses: words on a desktop, glyphs on a phone. The override exists in both
// directions because both are real — a dense desktop user wants the row back,
// and someone who has not learned the glyphs yet wants the words on a phone
// more than they want the space.
export function LabelDensity() {
  const [pref, setPref] = useState(labelsPref)
  function pick(v) {
    setPref(v)
    applyLabels(v)
    try {
      localStorage.setItem(LABELS_KEY, JSON.stringify(v))
    } catch {
      // Private mode: the choice still applies to this session, it just will
      // not survive a reload. Nothing to report — losing a density preference
      // is not worth an error message.
    }
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <MonoLabel>Button labels</MonoLabel>
        <InfoDot
          title="Button labels"
          text="Buttons that carry a glyph can show their words beside it or drop them for the glyph alone. Auto shows them on a desktop and hides them on a phone, where the row genuinely stops fitting. Hiding the words never hides them from a screen reader, and every glyph still names itself on hover or long-press — so this trades a little learning for a lot of room, and nothing else."
        />
      </div>
      <Toggle
        ariaLabel="Button labels"
        value={pref}
        onChange={pick}
        options={[['auto', 'Auto'], ['on', 'Show'], ['off', 'Hide']]}
      />
    </div>
  )
}

// ---- 2. Metadata sources (§2, mockup 27) ----

// KeyField — one metadata secret, edited and saved on its own.
//
// It used to be a "saved" chip with an Edit pill, and a single "Save keys"
// button at the bottom of the card that wrote whichever fields happened to be
// visible. That coupling was the whole problem: the card had to reason about
// which inputs were shown so a revealed field couldn't wipe an unrelated one.
// Now each field owns its write — the API takes pointers, so a PUT carrying one
// key leaves every other untouched — and the icons match the work Details panel:
// pencil to edit, ✓ to save, ✕ to back out.
//
// A stored secret is never echoed by the server, so editing always starts from
// an empty box: saving a blank clears the key, which is how you remove one.
// IconSaved — a floppy disk with a tick: this key is stored.
//
// A BADGE, NOT A BUTTON. It reports; there is nothing to press. So it is a span
// with role="img" and a real label rather than a disabled button, which would be
// a tab stop that does nothing and would announce itself as an action.
//
// The disk's outline stops short of its bottom-right corner and the tick sits in
// the gap. Two closed shapes overlapping at 18px read as one smudge, and the
// whole point of the glyph is to be legible at a glance in a row of controls.
function IconSaved() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.2 19.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5h8.3L19.5 9.7v2.9" />
      <path d="M9 4.5v3.7h5.4V4.5" />
      <path d="M13.9 17.9l2.1 2.1 4-4.6" />
    </svg>
  )
}

// KeyField — one API key, on ONE LINE until you ask to change it.
//
// It used to carry a permanent second row reading "•••••••••• saved", which is a
// full line of vertical space per key spent restating what it does not say: the
// dots are not the key, they are not even the right NUMBER of characters, and a
// secret is write-only here precisely so that nothing can reveal it. Six keys
// meant six such lines. The badge beside the edit button carries the same one bit
// — stored, or not — in no space at all, and the field for typing a new one
// appears below the row only while you are typing it.
//
// A NON-SECRET KEY IS DIFFERENT and keeps its value visible, inline on the same
// row. The Amazon domain is not a secret, it is a setting whose whole content is
// "www.amazon.de", and hiding that behind a badge saying "saved" would be
// withholding the answer to the only question the field asks.
function KeyField({ label, hint, set, placeholder, secret = true, value = '', onSave, busy }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(secret ? '' : value)
  useEffect(() => { if (!editing) setDraft(secret ? '' : value) }, [value, editing, secret])

  async function commit() {
    const ok = await onSave(draft)
    if (ok) setEditing(false)
  }

  const saved = secret ? !!set : !!value

  return (
    <div className="inline-field">
      <div className={'inline-field-head' + (editing ? '' : ' is-flush')}>
        <MonoLabel>{label}</MonoLabel>
        {hint && <InfoDot text={hint} title={label} />}
        {!secret && !editing && (
          <span className={'inline-field-inline' + (value ? '' : ' is-empty')}>{value || 'not set'}</span>
        )}
        <span className="flex-1" />
        {saved && !editing && (
          <Tooltip label="Saved">
            <span className="field-badge" role="img" aria-label={`${label}: saved`}>
              <IconSaved />
            </span>
          </Tooltip>
        )}
        {!editing ? (
          <Tooltip label={set ? `Replace the ${label.toLowerCase()}` : `Add a ${label.toLowerCase()}`}>
            <button
              type="button"
              className="field-icon-btn tactile"
              aria-label={set ? `Replace the ${label.toLowerCase()}` : `Add a ${label.toLowerCase()}`}
              onClick={() => setEditing(true)}
            >
              <IconEdit />
            </button>
          </Tooltip>
        ) : (
          <>
            <Tooltip label={draft.trim() ? 'Save' : 'Save blank — clears this key'}>
              <button
                type="button"
                className="field-icon-btn field-icon-btn-ok tactile"
                aria-label={`Save ${label.toLowerCase()}`}
                disabled={busy}
                onClick={commit}
              >
                <IconCheck />
              </button>
            </Tooltip>
            <Tooltip label="Cancel">
              <button
                type="button"
                className="field-icon-btn tactile"
                aria-label="Cancel"
                disabled={busy}
                onClick={() => { setEditing(false); setDraft(secret ? '' : value) }}
              >
                <IconClose />
              </button>
            </Tooltip>
          </>
        )}
      </div>
      {editing && (
        <input
          className="tp-input"
          placeholder={placeholder}
          value={draft}
          autoFocus
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setDraft(secret ? '' : value) }
          }}
        />
      )}
    </div>
  )
}

function Metadata({ user, onPreferences }) {
  const admin = user.is_admin
  const [status, setStatus] = useState(null)
  const [keys, setKeys] = useState(null) // {tmdb_key_set, google_books_key_set, amazon_cookie_set, amazon_domain}
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadStatus() {
    const r = await json('GET', '/metadata/status')
    if (r.ok) setStatus(r.data)
  }
  async function loadKeys() {
    const r = await json('GET', '/admin/metadata-keys')
    if (r.ok) setKeys(r.data)
  }
  useEffect(() => {
    loadStatus()
    if (admin) loadKeys()
  }, [admin])

  const source = status?.tmdb?.source
  const lookup = status?.books_lookup
  const booksTone = lookup?.ok === false ? 'error' : lookup?.ok === true ? 'ok' : 'muted'
  const booksLabel = lookup?.ok === false ? 'Lookup failing' : lookup?.ok === true ? 'OK' : 'Untested'
  // A CHIP ONLY WHERE THE KEY FIELDS CANNOT ANSWER. "Custom key" beside TMDB
  // said exactly what the saved badge on the TMDB field says one line below it,
  // and "No key (optional)" beside TheTVDB said nothing at all — an optional key
  // you have not set is the ordinary state of the app, not a status worth a pill.
  // What survives is the pair a key field genuinely cannot report: that lookups
  // are running on the shared built-in key even though you have set nothing, and
  // that they are running on nothing at all and will 503.
  const tmdbChip =
    source === 'builtin' ? ['active', 'Built-in key']
      : source === 'none' ? ['error', 'No key']
        : null

  // saveKey writes exactly one field. The endpoint decodes every key as a
  // pointer, so an omitted field is left alone and a present-but-empty one is
  // cleared — which is what makes a per-field save correct here rather than a
  // convenience that quietly wipes its neighbours. Secrets are write-only: GET
  // reports only whether each is set, never the value.
  async function saveKey(field, value) {
    setSaving(true)
    setError('')
    const r = await json('PUT', '/admin/metadata-keys', { [field]: value.trim() })
    setSaving(false)
    if (!r.ok) {
      setError(errText(r, 'could not save'))
      return false
    }
    await Promise.all([loadStatus(), loadKeys()])
    toast(value.trim() ? 'saved' : 'cleared')
    return true
  }

  return (
    <Card data-tour="metadata-keys">
      <SectionTitle info="The keys lookups run on. Every field here edits and saves on its own — a ✓ writes just that key and leaves the others alone. Saved secrets show masked and can never be revealed; save a blank field to clear one.">
        Metadata sources
      </SectionTitle>

      {/* No per-source headings. 1.7.2 took away the feature descriptions that
          sat under them ("Books: Google Books + Open Library"), which left three
          MonoLabels each introducing a single field that already names itself —
          "Books" above "Google Books key" is the same word twice.

          What the headings were genuinely carrying is the STATUS: whether
          lookups work at all right now, which no key field can report, because
          a key field only knows whether it is filled. So the chips move up into
          one row and the headings go. */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={booksTone}>{booksLabel}</StatusChip>
        <InfoDot title="Book lookups" text="Google Books and Open Library, queried together and merged field by field — the first-publication year from one, the larger cover and the description from the other. No key is needed, and manual entry always works." />
        {tmdbChip && <StatusChip tone={tmdbChip[0]}>{tmdbChip[1]}</StatusChip>}
        <InfoDot title="Film & show lookups" text="TMDB and TheTVDB. Both cover films and shows, and a lookup merges them; each key goes in its own field below. TMDB ships with a shared built-in key, so lookups work before you set anything — TheTVDB has none, and is optional." />
      </div>
      {lookup?.ok === false && lookup.error && (
        <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--error)' }}>
          last error: {lookup.error}
        </p>
      )}

      {/* One flat list. Every field says which service it is for, so grouping
          them added a heading and two rows of air per group and no meaning. */}
      {admin && (
        <div className="mt-3">
          <KeyField
            label="Google Books key"
            hint="Optional, and only if you exceed roughly 1,000 lookups a day: console.cloud.google.com → enable the Books API → create a key. Books work with no key at all."
            set={keys?.google_books_key_set}
            placeholder="Google Books API key — optional"
            busy={saving}
            onSave={(v) => saveKey('google_books_key', v)}
          />
          <KeyField
            label="TMDB key"
            hint="themoviedb.org → Settings → API → a free v3 key (a v4 read token also works). Overrides the built-in shared key. With no key at all, lookups return 503 — manual entry still works."
            set={keys?.tmdb_key_set}
            placeholder="TMDB v3 key or v4 token — overrides built-in"
            busy={saving}
            onSave={(v) => saveKey('tmdb_key', v)}
          />
          <KeyField
            label="TheTVDB key"
            hint="Optional, and usually better for long-running shows: thetvdb.com → Dashboard → API keys."
            set={keys?.tvdb_key_set}
            placeholder="TheTVDB v4 API key — optional"
            busy={saving}
            onSave={(v) => saveKey('tvdb_key', v)}
          />
        </div>
      )}

      {/* Amazon (advanced): cover-by-ASIN needs nothing; the optional cookie
          adds description/genres by scraping the product page. */}
      {admin && (
        <div>
          <div>
            <KeyField
              label="Amazon cookie"
              hint={
                'Optional. Covers already work from an ASIN with no setup at all; the cookie only adds description and genres by reading the product page. ' +
                'It is fragile, it is against Amazon’s terms, and it grants access to your account — it is stored write-only and never shown. ' +
                'To get it: sign in to Amazon on the marketplace your books live on, open DevTools (F12) → Network → click any amazon request → Request Headers, and copy the whole "cookie:" value.'
              }
              set={keys?.amazon_cookie_set}
              placeholder="Amazon session cookie — optional"
              busy={saving}
              onSave={(v) => saveKey('amazon_cookie', v)}
            />
            <KeyField
              label="Amazon domain"
              hint="The marketplace your books were bought on, e.g. www.amazon.com or www.amazon.de. Not a secret, so this one shows its value."
              secret={false}
              value={keys?.amazon_domain || ''}
              set={!!keys?.amazon_domain}
              placeholder="www.amazon.com"
              busy={saving}
              onSave={(v) => saveKey('amazon_domain', v)}
            />
          </div>
        </div>
      )}

      <ErrorText>{error}</ErrorText>

      {/* Last, and a section rather than a card: a lookup hands back one credit
          string and this decides whether it names one person or two. */}
      <CreditSeparators user={user} onPreferences={onPreferences} />
    </Card>
  )
}

// ---- 4. Users (§8.11, admin only) ----
//
// DELETED, not moved. This file carried a second AdminUsers component with no
// call site: a users list that could add and delete accounts and knew nothing
// about who may take whose rights away. Account.jsx's UserManagement is the
// one that renders, and the one the rules live in. Dead code that duplicates a
// live screen is worse than none — it reads as the implementation, and the
// next person to wire it up gets a page with none of the guards.

