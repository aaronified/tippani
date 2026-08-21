import { useEffect, useRef, useState } from 'react'
import { DEMO, json, errText, coverImgURL, copyText, apiURL, upload as uploadFile, uploadWithProgress } from './api.js'
import { ACCENTS, applyColors, applyLabels, applyTheme, CAT_NAME_MAX, CATEGORY_PALETTE, categoryState, getResolvedTheme, LABELS_KEY, labelsPref, UNSET_LABEL } from './theme.js'
import {
  applyLanguageMarks,
  currentLanguageEntries,
  LANGUAGE_NAME_MAX_RUNES,
  languageMarksBlob,
  languageMarksState,
  LanguageMark,
  MARK_MAX_RUNES,
  MAX_CUSTOM_MARKS,
} from './languages.jsx'
import {
  applyFonts,
  fontState,
  prefKey,
  registerUploads,
  serialiseFontStyles,
  stylePrefKey,
  stylesFor,
  uploadedFonts,
  verifyUpload,
} from './fonts.js'
import { SECTIONS, visibleSections } from './routes.js'
import { LanguagePicker } from './locale.jsx'
import { tourFeatures, tourSteps } from './tour.jsx'
import { lockedOff, parseQuestions, parseTuning, questionsBlob, questionsFor, REVIEW_DECKS, toggle as toggleQuestion, TUNING_FIELDS, tuningBlob, tuningProblem } from './quiz.js'
import { createPortal } from 'react-dom'
import { t, tNodes } from './i18n.js'
import { PASSPHRASE_MAX, PASSPHRASE_MIN, PASSWORD_MAX, passphraseProblem, sniffArchiveKey } from './secret.js'
import {
  Card,
  CloseButton,
  ConfirmDialog,
  ErrorText,
  Field,
  FieldIconButton,
  FormModal,
  IconChevron,
  filterChipClass,
  frameCode,
  GhostButton,
  IconArchive,
  IconBookmark,
  IconCheck,
  IconClose,
  IconCopy,
  IconDelete,
  IconDevice,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconExport,
  IconKey,
  IconLanguages,
  IconPlus,
  IconQuiz,
  IconRefresh,
  IconRestore,
  IconRevert,
  IconTour,
  IconType,
  IconUpload,
  IconUserPlus,
  InfoDot,
  MobileSheet,
  MonoLabel,
  PageHeader,
  Select,
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
// Language marks and Type are NOT here. They are two buttons on the Appearance
// card and a pop-up apiece (1.15.2) — see the note above `Appearance`.
export const SETTINGS_CARDS = ['onboard', 'features', 'meta', 'colors', 'sr', 'devices', 'trash', 'upd', 'backup']

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
// Colours sits directly under Metadata in every layout, and that is a rule
// rather than an arrangement: both are about what a quote is LABELLED with —
// where the facts about a work come from, and what the colour on a highlight is
// called — so reading down one column reads as one subject. Language marks was
// the third card in that family and is now a pop-up off Appearance, which is the
// same argument reaching its conclusion: what a proverb WEARS is a matter of
// appearance, and settings-layout.test.js still pins the pair that remain.
export const SETTINGS_LAYOUT = {
  1: [SETTINGS_CARDS],
  2: [
    ['meta', 'colors', 'onboard', 'features'],
    ['sr', 'devices', 'trash', 'upd', 'backup'],
  ],
  3: [
    ['meta', 'colors'], // the tall one, and the card that belongs under it
    ['sr', 'onboard', 'features'],
    ['devices', 'trash', 'upd', 'backup'],
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

export default function Settings({ user, onPreferences, update, onUpdateInfo, onStartTour, onOpenBin }) {
  const mobile = useIsMobileScreen()
  const ncols = useColumnCount()
  const cards = {
    onboard: <OnboardingCard user={user} onStartTour={onStartTour} />,
    features: <FeaturesCard prefs={user.preferences} onSaved={onPreferences} />,
    meta: <Metadata user={user} onPreferences={onPreferences} />,
    sr: <SRSettings user={user} onPreferences={onPreferences} />,
    colors: <ColourCategoriesCard prefs={user.preferences} onSaved={onPreferences} />,
    devices: <DevicesCard />,
    // Every account has a bin, so this is not admin-gated — unlike the two cards
    // below it. It sits beside Backup because that is the corner of Settings you
    // come to when something has gone wrong. The list itself is a page now, and
    // this tile is its only door.
    trash: <BinTile onOpen={onOpenBin} />,
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
        <PageHeader title={t('nav.tab.settings.label')} counts={user.is_admin ? 'admin' : user.username} />
      </div>
      <Appearance prefs={user.preferences} onPreferences={onPreferences} />
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
// the People console. Stored as the creditSeparators pref
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
    const raw = String(v || '').trim()
    if (!raw) return new Set(CREDIT_SEP_OPTIONS.map(([k]) => k)) // unset = all on
    if (raw.toLowerCase() === 'none') return new Set()
    return new Set(raw.split(',').map((s) => s.trim()).filter((s) => CREDIT_SEP_OPTIONS.some(([k]) => k === s)))
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
        <MonoLabel>{t('settings.credits.title')}</MonoLabel>
        <InfoDot title={t('settings.credits.info.title')} text={t('settings.credits.info.body')} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {CREDIT_SEP_OPTIONS.map(([key, label]) => (
          <Tooltip key={key} label={t('settings.credits.chip.tip')} side="top">
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
        <p className="microcopy mt-2">{t('settings.credits.off.prose')}</p>
      )}
    </div>
  )
}

// Slider — a labelled range that commits on release (pointer/key up), so a drag
// is one PUT, not one per step. Mirrors its `value` prop if it changes upstream.
// A FORMAT KEY, NOT A UNIT SUFFIX. The readout used to be `{show}{unit}` with the
// unit written as ' days' — a leading space no locale line can carry, since the
// parser trims both halves, and a word order English happens to share with the
// number. So the whole readout is one string: `{n} days`, `{n}×`, whatever the
// language puts where. `count` rides along so a language with a singular form gets
// it (`{n} day` at 1).
function Slider({ label, hideLabel = false, min, max, step, value, format = '', decimals = 0, onCommit }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const num = decimals ? v.toFixed(decimals) : String(v)
  const show = format ? t(format, { n: num, count: v }) : num
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        {hideLabel ? <span /> : <MonoLabel>{label}</MonoLabel>}
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 12, color: 'var(--faint)' }}>{show}</span>
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
        info={t('settings.colours.info.body')}
      >
        {t('settings.colours.title')}
      </SectionTitle>
      <div>
        {rows.map((row) => (
          <div key={row.token} className="inline-field">
            <div className={'inline-field-head' + (picking === row.slot ? '' : ' is-flush')} style={{ gap: 10 }}>
              <Tooltip label={row.fixed ? t('settings.colours.fixed.tip') : t('settings.colours.recolour.tip', { name: row.label })}>
                <button
                  type="button"
                  className="color-dot-btn"
                  aria-label={t('settings.colours.recolour.tip', { name: row.label })}
                  aria-expanded={picking === row.slot}
                  onClick={() => setPicking(picking === row.slot ? null : row.slot)}
                >
                  <span className="color-dot active" style={{ background: `var(--hl-${row.slot})` }} />
                </button>
              </Tooltip>
              {row.fixed ? (
                <div className="min-w-0 flex-1">
                  <span style={{ fontWeight: 600 }}>{t(UNSET_LABEL)}</span>
                  <InfoDot title={t('settings.colours.fixed.info.title')} text={t('settings.colours.fixed.info.body')} />
                </div>
              ) : (
                <input
                  className="tp-input"
                  style={{ flex: 1, minWidth: 0 }}
                  value={row.name}
                  maxLength={CAT_NAME_MAX}
                  placeholder={row.defaultName}
                  aria-label={t('settings.colours.name.aria', { name: row.token })}
                  onChange={(e) => setRows(rows.map((r) => (r.slot === row.slot ? { ...r, name: e.target.value } : r)))}
                  onBlur={() => save({})}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                />
              )}
              {!row.fixed && (
                <FieldIconButton
                  icon={row.hidden ? <IconEyeOff /> : <IconEye />}
                  ariaLabel={row.hidden ? t('settings.colours.offer.aria') : t('settings.colours.hide.aria')}
                  aria-pressed={row.hidden}
                  disabled={!row.hidden && visible <= 2}
                  onClick={() => save({ [`catHidden${row.slot}`]: !row.hidden })}
                  tooltip={row.hidden ? t('settings.colours.offer.tip') : visible <= 2 ? t('settings.colours.keep-two.tip') : t('settings.colours.hide.tip')}
                  active={row.hidden}
                />
              )}
              {row.custom && (
                <FieldIconButton
                  icon={<IconRevert />}
                  ariaLabel={t('settings.colours.reset.aria')}
                  onClick={() => save({ [`catColor${row.slot}`]: '' })}
                  tooltip={t('settings.colours.reset.tip')}
                />
              )}
            </div>
            {picking === row.slot && (
              <div className="cat-palette" role="listbox" aria-label={t('settings.colours.palette.aria', { name: row.label })}>
                {CATEGORY_PALETTE.map(([hex, nameKey]) => (
                  <Tooltip key={hex} label={t(nameKey)}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={row.hex.toLowerCase() === hex.toLowerCase()}
                      aria-label={t(nameKey)}
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
//
// THE CHIPS ARE NAMED AFTER THE SCREENS THEY DRAW FROM (1.15.2), not after the
// kind of thing on them. "Books" and "Films & shows" described the media; the
// nav strip two inches away says Library, Catalogue and Quotes, and a setting
// that renames the reader's own screens makes them work out which is which. The
// second was also wrong on its face after 1.15.1: the Catalogue holds games too,
// and their lines have always joined the deck through the same 'movies' scope,
// so "Films & shows" undercounted what the chip actually turned off. The STORED
// keys are untouched — they are a wire format the server parses (scopeFlags),
// and renaming them would empty the deck of every account that had set one.
const REVIEW_MEDIA = [
  // The stored key, then the SCREEN's own name, then what that screen's quotes
  // are. Both words are keys; the key on the left is a wire format and never moves.
  ['books', 'nav.tab.library.label', 'settings.review-scope.books.tip'],
  ['movies', 'nav.tab.movies.label', 'settings.review-scope.movies.tip'],
  ['quotes', 'nav.tab.quotes.label', 'settings.review-scope.quotes.tip'],
]

export function parseScope(value) {
  const raw = String(value || '').toLowerCase()
  // 'both' predates the third medium and means everything; so does anything
  // unrecognised, matching the server, because a scope that fails to parse must
  // never silently empty the deck.
  const toks = raw.split(',').map((tok) => tok.trim()).filter(Boolean)
  const keys = new Set()
  for (const tok of toks) {
    if (tok === 'both' || tok === 'all') return REVIEW_MEDIA.map((m) => m[0])
    if (tok === 'screen') keys.add('movies')
    else if (REVIEW_MEDIA.some((m) => m[0] === tok)) keys.add(tok)
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
        <MonoLabel>{t('settings.review-scope.title')}</MonoLabel>
        <InfoDot title={t('settings.review-scope.info.title')} text={t('settings.review-scope.info.body')} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {REVIEW_MEDIA.map(([key, label, hint]) => {
          const picked = on.includes(key)
          const stuck = picked && last
          return (
            <Tooltip key={key} label={stuck ? t('settings.review-scope.stuck.tip') : t(hint)}>
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
                {/* t(), like the hint beside it. The comment on REVIEW_MEDIA says
                    "both words are keys" and only one of them was resolved, so
                    these three chips read `nav.tab.library.label` and its two
                    siblings on screen — inside the review card itself. */}
                {t(label)}
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

// TypeSettings — Appearance → Type. Every face the app uses, doing its actual
// job. A POP-UP off the Appearance card since 1.15.2 rather than a card of its
// own: eleven roles, each with a specimen, a face picker and a row of style
// chips, is the tallest thing on the settings page by a wide margin, and it was
// standing open in a column beside cards you can read at a glance. It renders
// its own body only — the dialog carries the heading and the close.
//
// EACH ROW SETS ITS OWN ROLE'S REAL TEXT, not a specimen sentence. A type list
// that puts "The quick brown fox" in every face tells you nothing about the one
// question worth asking, which is how it looks doing THIS — the quote face
// setting a quote, the label face setting a locator, the hand face setting a
// margin note. It is also the only honest way to show the Bengali and Devanagari
// rows, whose whole point is a script the specimen sentence does not contain.
//
// Every alternate is BUNDLED, not fetched. Tippani never contacts the network on
// its own, and a type picker that loaded Google Fonts would be the first thing
// in the app that did — on a screen about how your own words look. All OFL-1.1.
function TypeSettings({ prefs, onSaved }) {
  const [rows, setRows] = useState(fontState)
  const [openRole, setOpenRole] = useState(null)
  const [err, setErr] = useState('')
  const [mine, setMine] = useState(uploadedFonts)
  const [busy, setBusy] = useState(false)
  // What the script check said about the face just assigned, per role. A
  // WARNING and never a refusal — see hasScript.
  const [warn, setWarn] = useState({})

  useEffect(() => { setRows(fontState()) }, [prefs])

  async function reloadUploads() {
    const r = await json('GET', '/fonts')
    if (!r.ok) return
    await registerUploads(r.data?.fonts || [])
    setMine(uploadedFonts())
    applyFonts(prefs || {})
    setRows(fontState())
  }

  // upload sends the file, registers the face, and assigns it to the role that
  // asked — then checks whether it can actually draw that role's script.
  async function upload(roleKey, file) {
    if (!file) return
    setBusy(true)
    setErr('')
    // The multipart helper, not json(): json() stringifies its body, which
    // would post the string "[object FormData]" and get a 400 nobody could read.
    const r = await uploadFile('/fonts', file)
    setBusy(false)
    if (!r.ok) return setErr(errText(r, 'could not upload that font'))
    await reloadUploads()
    await save({ [prefKey(roleKey)]: r.data.token })
    checkScript(roleKey)
  }

  // THE VERIFIER, and it runs after the assignment rather than before it. The
  // check needs the face LOADED to measure it, and the honest thing to report is
  // what the reader is now looking at — not a prediction about it.
  function checkScript(roleKey) {
    const face = fontState().find((x) => x.key === roleKey)?.chosen
    const ok = face ? verifyUpload(face.family, roleKey) : null
    setWarn((wmap) => ({ ...wmap, [roleKey]: ok }))
  }

  async function removeFont(f) {
    if (!confirm(t('settings.type.font.remove.confirm', { name: t(f.name) }))) return
    const r = await json('DELETE', `/fonts/${f.id}`)
    if (!r.ok) return setErr(errText(r, t('error.delete.font')))
    await reloadUploads()
  }

  // save applies FIRST and asks after, like every other card here: the whole
  // point of a type picker is seeing the change, and a round trip between the
  // tap and the type is long enough to make the control feel broken.
  async function save(patch) {
    applyFonts({ ...(prefs || {}), ...collectFonts(rows), ...patch })
    setRows(fontState())
    const r = await json('PUT', '/auth/me/preferences', patch)
    if (!r.ok) {
      setErr(errText(r, 'could not save'))
      applyFonts(prefs || {})
      setRows(fontState())
      return
    }
    setErr('')
    onSaved?.(patch)
  }

  return (
    <>
      <p className="microcopy mb-3">
        {t('settings.type.intro.prose')}
      </p>
      <div>
        {rows.map((row) => {
          const open = openRole === row.key
          return (
            <div key={row.key} className="inline-field">
              <div className={'inline-field-head' + (open ? '' : ' is-flush')} style={{ gap: 10 }}>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="tp-link"
                    aria-expanded={open}
                    onClick={() => setOpenRole(open ? null : row.key)}
                    style={{ fontWeight: 600 }}
                  >
                    {t(row.label)}
                  </button>
                  <MonoLabel className="block" style={{ color: 'var(--faint)' }}>
                    {t(row.chosen.name)}
                  </MonoLabel>
                </div>
              </div>
              {/* The specimen, always visible: the row's own job, in the face
                  currently set, so the list reads as a page of type rather than
                  as a list of names. */}
              <p
                className="mb-1"
                style={{
                  fontFamily: `var(${row.prop})`,
                  fontStyle: row.italic ? 'italic' : 'normal',
                  fontSize: row.key === 'mono' ? 12.5 : 17,
                  letterSpacing: row.key === 'mono' ? '.08em' : 0,
                  lineHeight: 1.45,
                  color: 'var(--ink)',
                  overflowWrap: 'anywhere',
                }}
              >
                {t(row.sample)}
              </p>
              {open && (
                <div className="space-y-2 pb-2">
                  <p className="microcopy">{t(row.what)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.faces.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={row.chosen.id === f.id}
                        className={'tp-filter-chip tactile' + (row.chosen.id === f.id ? ' active' : '')}
                        title={t(f.note)}
                        onClick={() => save({ [prefKey(row.key)]: f.id })}
                        style={{ fontFamily: `'${f.family}'` }}
                      >
                        {t(f.name)}
                      </button>
                    ))}
                    {/* YOUR OWN FACES ARE OFFERED ON EVERY ROLE, because only you
                        know what you uploaded one for. The script check below is
                        what tells you whether it suits the role you picked. */}
                    {mine.map((f) => (
                      <span key={f.id} className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-pressed={row.chosen.id === f.token}
                          className={'tp-filter-chip tactile' + (row.chosen.id === f.token ? ' active' : '')}
                          onClick={() => { save({ [prefKey(row.key)]: f.token }); checkScript(row.key) }}
                          style={{ fontFamily: `'${f.family}'` }}
                        >
                          {f.name}
                        </button>
                        <FieldIconButton
                          icon={<IconDelete />}
                          ariaLabel={t('common.action.remove.aria', { name: f.name })}
                          onClick={() => removeFont(f)}
                          tooltip={t('settings.type.font.remove.tip')}
                          danger
                        />
                      </span>
                    ))}
                    <label className="tp-filter-chip tactile" style={{ cursor: 'pointer' }}>
                      {busy ? t('common.action.upload.busy') : t('settings.type.upload.label')}
                      <input
                        type="file"
                        accept=".woff2,.woff,.otf,.ttf,font/woff2,font/woff,font/otf,font/ttf"
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => { upload(row.key, e.target.files?.[0]); e.target.value = '' }}
                      />
                    </label>
                  </div>
                  {/* THE SCRIPT CHECK. Replace the Bengali face with something
                      that has no Bengali in it and every Bengali quote turns into
                      boxes, silently, with nothing on this screen to say why.

                      It measures rather than parses — see hasScript — so it can
                      be fooled both ways, and it is a warning rather than a
                      refusal. Refusing somebody's own font on the strength of a
                      metrics heuristic is worse than telling them what looks
                      wrong. `null` means it could not tell, and says nothing at
                      all rather than guessing discouragingly. */}
                  {warn[row.key] === false && (
                    <p className="microcopy" style={{ color: 'var(--error)' }}>
                      {t('settings.type.script-warning.prose', { field: t(row.script ? row.label : 'vocab.script.latin.label') })}
                    </p>
                  )}
                  <div>
                    <MonoLabel className="mb-1 block" style={{ color: 'var(--faint)' }}>{t('settings.type.style.title')}</MonoLabel>
                    <div className="flex flex-wrap gap-2">
                      {stylesFor(row.key).map((st) => {
                        const on = row.styles.includes(st.id)
                        return (
                          <button
                            key={st.id}
                            type="button"
                            aria-pressed={on}
                            className={'tp-filter-chip tactile' + (on ? ' active' : '')}
                            onClick={() =>
                              save({
                                [stylePrefKey(row.key)]: serialiseFontStyles(
                                  on ? row.styles.filter((x) => x !== st.id) : [...row.styles, st.id],
                                ),
                              })
                            }
                          >
                            {t(st.label)}
                          </button>
                        )
                      })}
                    </div>
                    {/* NO PARAGRAPH ABOUT MONOSPACE. Whether a face is monospaced
                        is still a property of how it was drawn and there is still
                        no switch for it — but the mono row's style list showed
                        that paragraph every time it was opened, as an answer to a
                        question the reader had not asked and could not see the
                        subject of. The reasoning survives where reasoning goes,
                        in fonts.js beside the style table it explains. */}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <ErrorText>{err}</ErrorText>
    </>
  )
}

// collectFonts turns the rendered rows back into the preference shape, so an
// optimistic apply carries every role rather than only the one being changed.
function collectFonts(rows) {
  const out = {}
  for (const r of rows) {
    out[prefKey(r.key)] = r.chosen.id
    out[stylePrefKey(r.key)] = serialiseFontStyles(r.styles)
  }
  return out
}

// LanguageMarksSettings — what a proverb wears where every other quote wears a
// face. A POP-UP off the Appearance card since 1.15.2, for the same reason Type
// is: a row per language, each opening a tray, is a long list standing open
// beside cards you can read at a glance, and a mark is a matter of appearance.
// It renders its own body only — the dialog carries the heading.
//
// NO FLAGS (1.16.0). The tray used to offer twenty-four of them, first and in a
// grid, on the reasoning that offering is not mapping — nothing in the code ever
// said which flag belonged to which language. The reasoning held and the screen
// still did the thing it was defending against: a grid of flags at the top of a
// language's tray is a recommendation whoever wrote it, and it made the picker a
// geography quiz whose right answer did not exist. A flag is still one keystroke
// away, by typing it, which is the difference between a tool and a suggestion.
//
// WHAT A LANGUAGE OFFERS NOW IS ITS OWN SCRIPT: four letters, from the script it
// is written in. Below them sit the reader's OWN marks — up to four, per
// language — which is where a typed flag, symbol or emoji lands and stays, so
// picking it again next month is a tap rather than a hunt for the character map.
//
// THE WHOLE ROW OPENS THE TRAY. It was a 22px disc, which is a target you have
// to aim at next to a name you cannot press — the name being the thing that
// looks like the subject. The row is the button now and the disc is what it
// draws; only the reset glyph stays a separate control, because "put this back"
// is not "let me look at this".
function LanguageMarksSettings({ prefs, onSaved }) {
  const [rows, setRows] = useState(() => languageMarksState())
  const [picking, setPicking] = useState(null) // the language whose tray is open
  const [draft, setDraft] = useState('') // the "add your own" box, per open tray
  const [adding, setAdding] = useState('') // the new-language box, '' = closed
  const [err, setErr] = useState('')

  // Re-seed when the session prefs change under us — another tab, or the account
  // switching. Reads the APPLIED marks, so this stays in step with what is on
  // screen rather than with a stale prop, exactly as the colour card does.
  useEffect(() => { setRows(languageMarksState()) }, [prefs])

  // save takes the WHOLE next entry rather than a mark, because every control in
  // the tray changes a different field of one row and a mark-shaped save would
  // have to be three of them.
  async function save(key, patch) {
    const all = currentLanguageEntries()
    const cur = all[key] || { mark: '', customs: [], name: '' }
    all[key] = { ...cur, ...patch }
    const blob = languageMarksBlob(all)
    applyLanguageMarks({ languageMarks: blob })
    setRows(languageMarksState(Object.keys(all)))
    const r = await json('PUT', '/auth/me/preferences', { languageMarks: blob })
    if (!r.ok) {
      setErr(errText(r, 'could not save'))
      // Back to what the server still believes, so the panel can never show a
      // mark that was refused.
      applyLanguageMarks(prefs || {})
      setRows(languageMarksState())
      return
    }
    setErr('')
    onSaved?.({ languageMarks: blob })
  }

  // addCustom appends to this language's own marks and selects it. Selecting is
  // not a convenience: somebody who has just typed a mark has said which one they
  // want, and leaving it unselected would make adding a two-step act with an
  // invisible second step.
  function addCustom(row, raw) {
    const g = String(raw || '').trim()
    setDraft('')
    if (!g) return
    if (row.customs.includes(g)) return save(row.key, { mark: g })
    if (row.customs.length >= MAX_CUSTOM_MARKS) {
      setErr(t('error.validate.marks-full', { name: row.name, n: MAX_CUSTOM_MARKS }))
      return
    }
    return save(row.key, { customs: [...row.customs, g], mark: g })
  }

  // Removing the mark currently in use falls back to the script letter rather
  // than leaving the row drawing something it no longer offers.
  function removeCustom(row, g) {
    const customs = row.customs.filter((c) => c !== g)
    return save(row.key, { customs, mark: row.mark === g ? '' : row.mark })
  }

  function addLanguage(raw) {
    const name = String(raw || '').trim()
    setAdding('')
    if (!name) return
    const key = name.toLowerCase()
    if (rows.some((r) => r.key === key)) {
      setPicking(key)
      return
    }
    // A language is added by being GIVEN something to store — a display name is
    // the only field an unmarked language has, and without one the entry would
    // serialise to nothing and the row would vanish on the next reload.
    setPicking(key)
    return save(key, { name })
  }

  return (
    <>
      <p className="microcopy mb-3">
        A proverb has nobody to credit, so its card leads with its language instead of a face. Each
        language offers four letters from its own script; anything else you type — a symbol, a flag,
        an emoji — is kept as one of that language’s own marks.
      </p>
      <div>
        {rows.map((row) => {
          const open = picking === row.key
          const full = row.customs.length >= MAX_CUSTOM_MARKS
          return (
            <div key={row.key} className="inline-field">
              {/* THE ROW IS THE TRIGGER. The mark and the name are inside one
                  button that fills the row; the reset stays outside it, because
                  a control nested in a control is invalid markup and, worse,
                  ambiguous to press. */}
              <div className={'inline-field-head' + (open ? '' : ' is-flush')} style={{ gap: 6 }}>
                <button
                  type="button"
                  className="lang-row-btn"
                  aria-expanded={open}
                  // Named explicitly, because the mark inside it carries its own
                  // "in Bengali" label for the quote cards and a row announcing
                  // "in Bengali Bengali" is the glyph's label leaking into a
                  // context it was not written for.
                  aria-label={row.name}
                  onClick={() => { setPicking(open ? null : row.key); setDraft('') }}
                >
                  <LanguageMark languages={[row.canonical]} size={22} ring="var(--card)" />
                  <span className="min-w-0 flex-1 text-left" style={{ fontWeight: 600 }}>{row.name}</span>
                  {/* The canonical name stays visible on a renamed row. Quotes
                      are still stored and matched under it, so hiding it would
                      make "why does my Bangla board say Bengali" unanswerable. */}
                  {row.renamed && <MonoLabel style={{ color: 'var(--faint)' }}>{row.canonical}</MonoLabel>}
                  <IconChevron open={open} size={18} />
                </button>
                {(row.mark || row.renamed) && (
                  <FieldIconButton
                    icon={<IconRevert />}
                    ariaLabel={t('settings.languages.reset.aria', { name: row.canonical })}
                    onClick={() => save(row.key, { mark: '', name: '' })}
                    tooltip={t('settings.languages.reset.tip')}
                  />
                )}
              </div>
              {open && (
                <div className="space-y-3 pb-2">
                  {row.glyphs.length > 0 ? (
                    <div>
                      <MonoLabel className="mb-1 block" style={{ color: 'var(--faint)' }}>{t('settings.languages.script.title')}</MonoLabel>
                      <div className="cat-palette" role="listbox" aria-label={t('settings.languages.glyphs.aria', { name: row.canonical })}>
                        {row.glyphs.map((g, i) => (
                          <button
                            key={g}
                            type="button"
                            role="option"
                            // The first is the default, so an unset mark selects
                            // it: the row is already drawing it.
                            aria-selected={row.mark === g || (!row.mark && i === 0)}
                            aria-label={g}
                            className={'cat-swatch' + (row.mark === g || (!row.mark && i === 0) ? ' is-on' : '')}
                            style={{ background: 'var(--raised)', fontSize: 15, lineHeight: 1 }}
                            onClick={() => save(row.key, { mark: i === 0 ? '' : g })}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // A language the app has never heard of has no script to
                    // offer, and guessing one would put a Latin A on a board of
                    // Yoruba proverbs. It gets the custom bar and nothing else.
                    <p className="microcopy">
                      {t('settings.languages.no-script.prose', { name: row.canonical })}
                    </p>
                  )}

                  <div>
                    <MonoLabel className="mb-1 block" style={{ color: 'var(--faint)' }}>
                      {t('settings.languages.customs.title', { done: row.customs.length, total: MAX_CUSTOM_MARKS })}
                    </MonoLabel>
                    {row.customs.length > 0 && (
                      <div className="cat-palette" role="listbox" aria-label={t('settings.languages.customs.aria', { name: row.canonical })}>
                        {row.customs.map((g) => (
                          <span key={g} className="lang-custom">
                            <button
                              type="button"
                              role="option"
                              aria-selected={row.mark === g}
                              aria-label={g}
                              className={'cat-swatch' + (row.mark === g ? ' is-on' : '')}
                              style={{ background: 'var(--raised)', fontSize: 15, lineHeight: 1 }}
                              onClick={() => save(row.key, { mark: g })}
                            >
                              {g}
                            </button>
                            <FieldIconButton
                              icon={<IconClose />}
                              ariaLabel={t('settings.languages.mark.remove.aria', { name: g, field: row.canonical })}
                              onClick={() => removeCustom(row, g)}
                              tooltip={t('settings.languages.mark.remove.tip')}
                              danger
                            />
                          </span>
                        ))}
                      </div>
                    )}
                    {/* The box goes away when the bar is full rather than
                        refusing on submit: a field you can type into and cannot
                        save from is worse than no field. */}
                    {full ? (
                      <p className="microcopy">
                        {t('settings.languages.full.prose', { name: row.canonical, n: MAX_CUSTOM_MARKS })}
                      </p>
                    ) : (
                      <Field
                        label={t('settings.languages.add-mark.label')}
                        value={draft}
                        placeholder={t('settings.languages.add-mark.placeholder')}
                        maxLength={MARK_MAX_RUNES}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={(e) => addCustom(row, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                      />
                    )}
                  </div>

                  {/* RENAMING IS A DISPLAY NAME AND NOTHING ELSE. The quote keeps
                      the language it was stored with, so calling Bengali "বাংলা"
                      cannot orphan a quote, cannot break the board form's
                      matching, and round-trips through an export untouched —
                      the same rule the colour categories have always followed. */}
                  <Field
                    label={t('settings.languages.rename.label', { name: row.canonical })}
                    defaultValue={row.name}
                    key={`name-${row.key}-${row.name}`}
                    placeholder={row.canonical}
                    maxLength={LANGUAGE_NAME_MAX_RUNES}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== row.name) save(row.key, { name: v })
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Adding a language, because the ten built in are the ten most spoken and
          not the ten anybody's library is in. A board form already accepts any
          language as free text; this is the same list reached from the side that
          edits it, so a language typed there can be marked here without having
          to go and find a quote in it first. */}
      <div className="mt-3">
        {adding === null ? null : adding === '' ? (
          <GhostButton icon={<IconPlus />} onClick={() => setAdding(' ')}>{t('settings.languages.add.label')}</GhostButton>
        ) : (
          <Field
            label={t('settings.languages.name.label')}
            autoFocus
            value={adding.trimStart()}
            placeholder={t('settings.languages.name.placeholder')}
            maxLength={LANGUAGE_NAME_MAX_RUNES}
            onChange={(e) => setAdding(e.target.value || ' ')}
            onBlur={(e) => addLanguage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setAdding('') }}
          />
        )}
      </div>
      <ErrorText>{err}</ErrorText>
    </>
  )
}

// SRSettings — the spaced-repetition knobs (v0.5.0 Daily Quiz & Practice): the
// daily deck size, what the review covers (books / films & shows / both),
// whether Practice is allowed to move the schedule, and which of the two
// scheduling rules is in force. The default is still the fixed ladder
// (7 → 30 → 100 days, review_handlers.go); adaptive is opt-in and its real
// subject is the lapse, which shortens instead of resetting. Each knob persists
// via the partial-merge preferences PUT.
function SRSettings({ user, onPreferences }) {
  const p = user.preferences || {}
  const [deep, setDeep] = useState(false)
  function set(patch) {
    onPreferences?.(patch)
    json('PUT', '/auth/me/preferences', patch)
  }
  return (
    <Card>
      <SectionTitle
        right={
          <InfoDot text={t('settings.quiz.info.body')} />
        }
      >
        Daily quiz &amp; practice
      </SectionTitle>
      {/* TWO CONTROLS ON THE CARD, the rest behind the door.

          The deck size and what it covers are the two a reader changes and then
          stops thinking about. Everything else — which questions get asked, how
          the ladder behaves, whether Practice counts — is worth having and is
          not worth scrolling past every time you come here to change a font. */}
      <div className="space-y-5">
        <Slider label={t('settings.quiz.per-day.label')} min={2} max={10} step={1} value={p.srDaily || 8} onCommit={(v) => set({ srDaily: v })} />
        <ReviewScope value={p.srReviewScope} onChange={(v) => set({ srReviewScope: v })} />
        <Tooltip label={t('settings.quiz.in-depth.tip')}>
          <GhostButton icon={<IconQuiz />} keepLabel onClick={() => setDeep(true)}>{t('settings.quiz.in-depth.label')}</GhostButton>
        </Tooltip>
      </div>
      {deep && (
        <FormModal title={t('settings.quiz.panel.title')} onClose={() => setDeep(false)} maxWidth={620}>
          <SRDeepControls p={p} set={set} onClose={() => setDeep(false)} />
        </FormModal>
      )}
    </Card>
  )
}

// SRDeepControls — everything the two decks can be told, in one pop-up.
//
// WHAT IS NEW HERE IS THE REPERTOIRE. Until 1.16.0 the deck's question types
// were a constant: `directionsForMode` returned the same table for everybody,
// and the only thing a reader could say about the review loop was how many cards
// and which medium. That is a strange place to draw the line in the one part of
// this app with no equivalent elsewhere — somebody who cannot bear multiple
// choice, or who wants the daily deck to be nothing but fill-in-the-blank, had
// no way to say so.
//
// THE RULES REFUSE RATHER THAN REVERT. quiz.js mirrors the server's normaliser,
// so a switch that would leave a deck with no question it can ask of a book is
// disabled WITH ITS REASON on screen. The alternative — accept it, PUT it, and
// have the server hand back the defaults — is a control that flips back under
// your finger and explains nothing.
function SRDeepControls({ p, set, onClose }) {
  const [qs, setQs] = useState(() => parseQuestions(p.srQuestions))
  const [tune, setTune] = useState(() => parseTuning(p.srTuning))
  const commit = (next) => {
    setQs(next)
    set({ srQuestions: questionsBlob(next) })
  }
  // THE LADDER HAS TO CLIMB, and the server reverts one that does not — silently,
  // which would be three sliders that move and then do nothing. So the panel
  // refuses and says why, the same way a question toggle does, and the PUT is
  // simply not sent until it is legal again.
  const tuneErr = tuningProblem(tune)
  const commitTune = (key, v) => {
    const next = { ...tune, [key]: v }
    setTune(next)
    if (!tuningProblem(next)) set({ srTuning: tuningBlob(next) })
  }
  const reset = () => {
    setQs(parseQuestions(''))
    setTune(parseTuning(''))
    // Every review preference, not only the questions: a reader who presses
    // "Back to defaults" inside the in-depth panel means the panel, and leaving
    // three switches behind would make it the least trustworthy button here.
    set({
      srQuestions: '',
      srTuning: '',
      srPracticeCounts: false,
      srSubmit: false,
      srAdaptive: false,
      srSeen: 1,
    })
  }
  return (
    <div className="space-y-6">
      {REVIEW_DECKS.map(([deck, deckLabel]) => (
        <div key={deck}>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>{t('settings.quiz.deck.title', { name: deckLabel })}</MonoLabel>
            <InfoDot
              text={
                deck === 'daily'
                  ? t('settings.quiz.deck.daily.info.body')
                  : t('settings.quiz.deck.practice.info.body')
              }
            />
          </div>
          <div className="space-y-2">
            {questionsFor(deck).map((q) => {
              const on = qs[deck].includes(q.id)
              const locked = lockedOff(qs, deck, q.id)
              return (
                <div key={q.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{q.label}</span>
                    <InfoDot text={locked ? t('settings.quiz.question.locked.hint', { hint: q.hint, reason: locked }) : q.hint} />
                  </span>
                  <Toggle
                    ariaLabel={t('settings.quiz.question.aria', { name: deckLabel, field: q.label })}
                    disabled={!!locked}
                    value={on ? 'on' : 'off'}
                    onChange={() => commit(toggleQuestion(qs, deck, q.id))}
                    options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>{t('settings.quiz.practice-counts.title')}</MonoLabel>
            <InfoDot text={t('settings.quiz.practice-counts.info.body')} />
          </div>
          <Toggle
            ariaLabel={t('settings.quiz.practice-counts.aria')}
            value={p.srPracticeCounts ? 'on' : 'off'}
            onChange={(v) => set({ srPracticeCounts: v === 'on' })}
            options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>{t('settings.quiz.submit.title')}</MonoLabel>
            <InfoDot text={t('settings.quiz.submit.info.body')} />
          </div>
          <Toggle
            ariaLabel={t('settings.quiz.submit.aria')}
            value={p.srSubmit ? 'on' : 'off'}
            onChange={(v) => set({ srSubmit: v === 'on' })}
            options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>{t('settings.quiz.adaptive.title')}</MonoLabel>
            <InfoDot text={t('settings.quiz.adaptive.info.body')} />
          </div>
          <Toggle
            ariaLabel={t('settings.quiz.adaptive.aria')}
            value={p.srAdaptive ? 'on' : 'off'}
            onChange={(v) => set({ srAdaptive: v === 'on' })}
            options={[['off', t('settings.quiz.adaptive.ladder.label')], ['on', t('settings.quiz.adaptive.on.label')]]}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>{t('settings.quiz.seen.title')}</MonoLabel>
            <InfoDot text={t('settings.quiz.seen.info.body')} />
          </div>
          <Slider label={t('settings.quiz.seen.label')} hideLabel min={1} max={1.5} step={0.05} value={p.srSeen || 1} format="common.slider.multiplier.format" decimals={2} onCommit={(v) => set({ srSeen: v })} />
        </div>
      </div>
      {/* The numbers behind the schedule. Sliders rather than boxes because every
          one of them is bounded, and a bounded value typed into a box is a value
          that can be refused after the fact. */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <MonoLabel>{t('settings.quiz.tuning.title')}</MonoLabel>
          <InfoDot text={t('settings.quiz.tuning.info.body')} />
        </div>
        <div className="space-y-4">
          {TUNING_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-center gap-1.5">
                <MonoLabel style={{ fontSize: 10 }}>{f.label}</MonoLabel>
                <InfoDot text={f.hint} />
              </div>
              <Slider
                label={f.label}
                hideLabel
                min={f.min}
                max={f.max}
                step={f.step}
                format={f.format}
                decimals={f.decimals}
                value={tune[f.key]}
                onCommit={(v) => commitTune(f.key, v)}
              />
            </div>
          ))}
        </div>
        <ErrorText>{tuneErr}</ErrorText>
      </div>
      <div className="flex justify-between gap-2 pt-1">
        <Tooltip label={t('settings.quiz.reset.tip')}>
          <GhostButton icon={<IconRevert />} keepLabel onClick={reset}>{t('settings.quiz.reset.label')}</GhostButton>
        </Tooltip>
        <GhostButton onClick={onClose}>{t('common.action.done.label')}</GhostButton>
      </div>
    </div>
  )
}

// UpdatesCard (admin only) — the version + update control. "Check for updates"
// queries GitHub on demand (never automatically); if a newer release exists it
// offers a one-click update when the Docker socket is mounted (pull + recreate
// via a one-shot Watchtower), and otherwise shows the manual command to run.
function UpdatesCard({ user, update, onUpdateInfo }) {
  const current = user?.version || 'dev'
  const [logOpen, setLogOpen] = useState(false)
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
                style={{ fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontWeight: 600 }}
              >
                {current} ↗
              </a>
            </Tooltip>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontWeight: 600 }}>{current}</span>
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
              {/* Beside the check, not instead of the GitHub link above it: the
                  link answers "what is in a version I have not installed", this
                  answers "what is in the one I am running". Different questions,
                  and only the second one works with the network off. */}
              <GhostButton onClick={() => setLogOpen(true)}>Changelog</GhostButton>
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
                        style={{ maxWidth: 140, fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)' }}
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
                      <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 12.5, overflowWrap: 'anywhere' }}>
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
      {/* Mounted only while open: the history is a quarter of a megabyte of
          markdown, and a card that fetched it on render would spend that on every
          visit to Settings for a dialog nobody opened. */}
      {logOpen && <ChangelogDialog current={current} onClose={() => setLogOpen(false)} />}
    </Card>
  )
}

// ---- the changelog --------------------------------------------------------
//
// The release history the running binary was BUILT FROM, out of the binary. See
// internal/changelog for why it is embedded rather than fetched: a changelog that
// is blank on a LAN-only NAS is blank in exactly the situation this app is for.

// MD_SPAN matches the three inline forms this file actually uses — **bold**,
// `code` and [text](url) — in one pass, so the renderer below never has to
// re-scan a string it has already split.
//
// This is deliberately NOT a markdown parser and must not grow into one. There is
// no markdown dependency in this frontend and no dangerouslySetInnerHTML anywhere
// in it; both would be a poor trade for a dialog opened twice a month. Anything
// this does not recognise is shown verbatim, which for a changelog is a perfectly
// honest failure — you see the asterisks.
const MD_SPAN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

function inlineMarkdown(text) {
  return text.split(MD_SPAN).map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      // Only http(s). A changelog is trusted content — it ships inside the binary
      // — but a link scheme is one of those things worth refusing by rule rather
      // than by trust, since the rule costs a line and the trust costs an audit.
      const href = /^https?:\/\//.test(link[2]) ? link[2] : null
      return href ? (
        <a key={i} className="tp-link" href={href} target="_blank" rel="noopener noreferrer">{link[1]}</a>
      ) : (
        <span key={i}>{link[1]}</span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ChangelogEntry — one bullet, whose paragraphs the server kept together.
function ChangelogEntry({ text }) {
  return (
    <li className="cl-entry">
      {text.split('\n\n').map((para, i) => (
        <p key={i}>{inlineMarkdown(para)}</p>
      ))}
    </li>
  )
}

function ChangelogDialog({ current, onClose }) {
  const mobile = useIsMobileScreen()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  // Only the newest is open on arrival. Seventy releases expanded is a scroll bar
  // with no landmarks in it, and the one people came for is at the top anyway.
  const [open, setOpen] = useState(() => new Set())

  useEffect(() => {
    json('GET', '/changelog').then((r) => {
      if (!r.ok) return setError(errText(r, 'could not load the changelog'))
      setData(r.data)
      const first = r.data?.releases?.[0]?.version
      if (first) setOpen(new Set([first]))
    })
  }, [])

  const toggle = (v) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })

  const body = error ? (
    <ErrorText>{error}</ErrorText>
  ) : !data ? (
    <p className="microcopy">loading…</p>
  ) : (
    <div className="cl-list">
      {data.releases.map((rel) => {
        const isOpen = open.has(rel.version)
        const running = rel.version === data.current
        return (
          <section key={rel.version} className={'cl-release' + (running ? ' is-running' : '')}>
            <button
              type="button"
              className="cl-head"
              aria-expanded={isOpen}
              onClick={() => toggle(rel.version)}
            >
              <IconChevron open={isOpen} size={16} />
              <span className="cl-version">{rel.version}</span>
              {rel.date && <span className="cl-date">{rel.date}</span>}
              {/* Which one you are actually running. The whole point of an
                  in-app changelog over a link to GitHub is that it can say so. */}
              {running && <span className="cl-running">running</span>}
            </button>
            {isOpen && (
              <div className="cl-body">
                {rel.sections.map((sec) => (
                  <div key={sec.title} className="cl-section">
                    <MonoLabel>{sec.title}</MonoLabel>
                    <ul>
                      {sec.entries.map((e, i) => (
                        <ChangelogEntry key={i} text={e} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
      {data.current_listed === false && (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>
          You are running <b>{current}</b>, which is not one of the versions above — a build
          made outside a release.
        </p>
      )}
    </div>
  )

  if (mobile) {
    return createPortal(
      <MobileSheet open onClose={onClose} title="Changelog">
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
      aria-label="Changelog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="hand-card hc-r2 w-full" style={{ maxWidth: 640, padding: '18px 20px 20px' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 19 }}>Changelog</h2>
          <Tooltip label="Close" side="bottom">
            <CloseButton onClick={onClose} tooltip="Close the changelog" />
          </Tooltip>
        </div>
        {body}
      </div>
    </div>,
    document.body,
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

// OnboardingCard — the guided tour's home (ROADMAP: onboarding). Starts,
// replays or resumes the tour, and replays ONE step of it. The tour runs by
// itself on a user's first launch; "finish later" parks it here as a Resume
// button. The sample content is built in — onboarding never asks for the user's
// files.
//
// THE LIST OF FEATURES IS GONE (1.15.2), and it is the second time this card has
// tried to be a table of contents. It started as a dozen two-line rows, which
// pushed the Start button off a phone screen; the blurbs went behind InfoDots,
// which left a dozen names each trailing a dot — a list you cannot act on, above
// the one button that does anything. A name in that list answered "is this
// covered?", and nobody arrives at Settings → Onboarding asking that. They
// arrive having forgotten how one screen works.
//
// So the list becomes a PICKER, behind the second button, where choosing a name
// does the thing the name suggested. Same source (tourFeatures, so it still
// cannot drift from the tour), one fewer standing wall of text, and the blurbs
// come back as blurbs rather than as dots — a dialog has the room a 300px column
// did not.
// ---- Features: which sections the app shows you ----
//
// Not everybody keeps films, and not everybody keeps a quote that belongs to no
// book. A tab for something you have never used is a permanent invitation to a
// screen with nothing on it, and until now the strip, the drawer and the phone bar
// were the same eight destinations for everybody.
//
// HIDING IS COSMETIC, AND THAT IS THE WHOLE DESIGN. Nothing is deleted, nothing
// is disabled, no query narrows and no deck changes. What goes is the DOORS: the
// nav lists, Home's count tile, the ＋'s offer of that kind, the search scope
// chips and the shortcut legend. The route still resolves, so a bookmark, a link
// from a quote to the book it came from, and a typed URL all land exactly as
// before — which is what makes "turn it back on and everything is where you left
// it" a promise rather than a hope.
//
// ONE SWITCH CANNOT GO OFF, and the copy says which. An app with no content
// sections has no ＋ that offers anything and no list to stand in — a broken
// screen rather than a preference, and the one state a reader could not click
// their way out of. The server refuses the same set and corrects it on read, so a
// restored archive cannot arrive in it either.
//
// The switches all read POSITIVELY — Show / Hide — while the STORED key is spelled
// whichever way makes `false` that section's default: `hideLibrary` for the three
// that are on until you say otherwise, `showAnthologies` for the one that is off
// until you ask. Every preference default in this app is the zero value, and that
// is the rule those two spellings are both obeying. See the prefs struct.
function FeaturesCard({ prefs, onSaved }) {
  const on = visibleSections(prefs)
  // The last one standing among the CONTENT sections. Anthologies is not one of
  // them — it holds quotes that live in the other three — so it can neither be the
  // last one nor be locked as one, which is exactly the rule the server's validator
  // applies. The two have to agree: this card saves optimistically, so a client that
  // allowed a set the server refuses would move the switch and revert on reload with
  // nothing on screen saying why.
  const lastOne = SECTIONS.filter((sec) => !sec.off && on[sec.tab]).length === 1
  const set = (sec, show) => {
    // THE POLARITY COMES OFF THE ROW. `hideX` stores the opposite of the switch and
    // `showX` stores the switch itself; a hardcoded `!show` was correct for as long
    // as every section was spelled hide* and would send `showAnthologies: false` for
    // Show — a 200 that stores the reverse of what was pressed, since the PUT
    // handler takes the key at its word and the shell updates optimistically.
    const patch = { [sec.pref]: sec.off ? show : !show }
    onSaved?.(patch)
    json('PUT', '/auth/me/preferences', patch)
  }
  return (
    <Card>
      <SectionTitle
        info={t('settings.features.info.body')}
        infoTitle={t('settings.features.info.title')}
      >
        Features
      </SectionTitle>
      <p className="microcopy">
        {t('settings.features.intro.prose')}
      </p>
      <div className="space-y-3 mt-3">
        {SECTIONS.map((sec) => {
          // The last one standing is the one that cannot go, and the reason
          // replaces the microcopy on that row rather than hiding in a tooltip a
          // touch screen has no way to show.
          const locked = lastOne && on[sec.tab] && !sec.off
          return (
            <div key={sec.tab}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <MonoLabel>{t(sec.label)}</MonoLabel>
              </div>
              <Toggle
                ariaLabel={t(sec.label)}
                value={on[sec.tab] ? 'on' : 'off'}
                onChange={(v) => set(sec, v === 'on')}
                disabled={locked}
                options={[['off', t('common.action.hide.label')], ['on', t('common.action.show.label')]]}
              />
              <p className="microcopy mt-1">
                {/* t(), because SECTIONS[].what is a KEY. It was rendered raw
                    here and printed `nav.section.library.what` on screen, while
                    the SAME table resolved correctly forty lines up in the
                    Metadata card — one table, two readings, and only one of them
                    right. */}
                {locked ? t('settings.features.locked.prose') : t(sec.what)}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function OnboardingCard({ user, onStartTour }) {
  const state = user.preferences?.tour || ''
  const step = user.preferences?.tourStep || 0
  const [picking, setPicking] = useState(false)
  // The same two arguments the tour itself passes, derived from the same
  // preference bag — a picker offering a section the reader has hidden is a door
  // into it, and an `at` computed over a different list opens the wrong step.
  const sections = visibleSections(user.preferences)
  const feats = tourFeatures(user.is_admin, sections)
  const total = tourSteps(user.is_admin, sections).length
  // `at` is the feature's index in tourSteps, which is what onStartTour takes —
  // NOT its index in this filtered list. See tourFeatures.
  const start = (at) => { setPicking(false); onStartTour?.(at) }
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
        {/* keepLabel on the primary: it carries the step count when it is a
            Resume, and a bare flag on a phone would drop the only part of that
            button anybody reads. */}
        {state === 'postponed' ? (
          <>
            <StickerButton icon={<IconTour />} keepLabel onClick={() => start(step)}>
              Resume tour · step {Math.min(step + 1, total)} of {total}
            </StickerButton>
            <GhostButton icon={<IconRefresh />} onClick={() => start(0)}>Start over</GhostButton>
          </>
        ) : (
          <StickerButton icon={<IconTour />} keepLabel onClick={() => start(0)}>
            {state ? 'Replay the tour' : 'Start the tour'}
          </StickerButton>
        )}
        {/* keepLabel for the same reason the two Appearance doors have it: this
            is the only way to the picker, and an unlabelled bookmark on a phone
            is a feature nobody finds. "Start over" above keeps none, and should
            not — it is a secondary variant of the labelled button beside it, so
            the row it sits in already says what it is about. */}
        <GhostButton icon={<IconBookmark />} keepLabel onClick={() => setPicking(true)}>Refresh one section</GhostButton>
      </div>
      <FormModal open={picking} onClose={() => setPicking(false)} title="Refresh one section" maxWidth={520}>
        <p className="microcopy mb-3">
          The tour opens on that screen and carries on from there — Next moves to the next section,
          and &ldquo;finish later&rdquo; parks it back here.
        </p>
        <div>
          {feats.map((f) => (
            <button
              key={f.key}
              type="button"
              className="tactile w-full text-left"
              style={{ borderTop: '1px solid var(--line)', padding: '9px 2px' }}
              onClick={() => start(f.at)}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{f.name}</span>
              <span className="microcopy block">{f.blurb}</span>
            </button>
          ))}
        </div>
      </FormModal>
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
              fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)',
              fontSize: 30,
              letterSpacing: '0.18em',
              fontWeight: 600,
            }}
          >
            {pair.code}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FieldIconButton
              icon={<IconCopy />}
              ariaLabel="Copy the pairing code"
              onClick={() => copyText(pair.code)}
              tooltip="Copy the code"
            />
            <FieldIconButton
              icon={<IconCheck />}
              ariaLabel="Done pairing"
              onClick={() => {
                  setPair(null)
                  load()
                }}
              tooltip="Done"
              ok
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <StickerButton icon={<IconDevice />} keepLabel onClick={startPairing} disabled={busy}>
            Pair a device
          </StickerButton>
          {devices?.length > 0 && (
            <FieldIconButton
              icon={<IconDelete />}
              ariaLabel="Unpair every device"
              onClick={revokeAll}
              danger
            />
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
                <FieldIconButton
                  icon={<IconClose />}
                  ariaLabel={`Unpair ${d.name}`}
                  onClick={() => revoke(d)}
                  danger
                />
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
            style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)' }}
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <p className="microcopy">This archive predates 1.4.1 and carries no key, so the typed word is the confirmation.</p>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {/* keepLabel on both, and here it is not a style choice: this button
            replaces every user, library and setting on the server and logs
            everyone out. Nothing about that is to be found out by pressing a
            glyph you half-recognise. */}
        <StickerButton icon={<IconRestore />} keepLabel disabled={!!missing || !!busyLabel} title={missing || undefined}>
          {busyLabel || 'Restore'}
        </StickerButton>
        <GhostButton type="button" icon={<IconClose />} keepLabel disabled={!!busyLabel} onClick={onCancel}>
          Cancel
        </GhostButton>
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
// ---- the bin, as a tile (§ trash-and-undo) ----

// BinTile — the bin's door, and the whole of the bin that Settings keeps.
//
// The list itself moved to a page of its own in 1.11.2 (BinPage.jsx), for a reason
// that is about shape rather than importance. This is a three-column grid of
// CARDS, and a card is a control panel: a label, a control, done. The bin is a
// LIST of unbounded length whose rows expand — and in a 300px grid column beside
// Devices and Updates it had to say what an entry was, when it went, what
// travelled with it and when it is due to go, so it said three of those and
// truncated the fourth.
//
// What stays here is what a settings page should hold about the bin: whether there
// is anything in it, and the way in. The tile is the ONLY way in — the bin is in
// no tab list on purpose (see ROUTE_TABS) — which is why the count is worth
// fetching for it. "Nothing deleted" is an answer, and it is the answer that means
// you do not have to go and look.
function BinTile({ onOpen }) {
  const [items, setItems] = useState(null) // null = still loading

  useEffect(() => {
    let stale = false
    json('GET', '/trash').then((r) => {
      if (!stale) setItems(r.ok ? r.data.trash || [] : [])
    })
    return () => {
      stale = true
    }
  }, [])

  const n = items?.length ?? 0
  const held = (items || []).reduce((sum, e) => sum + (e.child_count || 0), 0)

  return (
    <Card data-tour="trash">
      <SectionTitle
        info="Everything you delete waits here first, and putting one back returns it exactly as it was — quotes, tags, colours, schedule and cover alike. An entry leaves on its own past the window, and that clock only runs while the server does."
        infoTitle="The bin"
      >
        The bin
      </SectionTitle>

      <div className="space-y-3">
        <p className="microcopy">
          {items === null
            ? 'reading the bin…'
            : n === 0
              ? 'nothing deleted — anything you delete waits here first'
              : `${n} ${n === 1 ? 'entry' : 'entries'} waiting${held > 0 ? `, holding ${held} ${held === 1 ? 'quote' : 'quotes'}` : ''} — put any of them back, or empty it`}
        </p>
        {/* keepLabel: the one control on this card, and a lone wastebasket glyph on
            a settings page reads as "delete something" rather than "open the place
            deleted things went". */}
        <GhostButton icon={<IconDelete />} keepLabel onClick={onOpen}>
          Open the bin
        </GhostButton>
      </div>
    </Card>
  )
}


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
      {/* The key this archive will be sealed with is the single most consequential
          choice on this form, so the control that switches it wears the key. */}
      <button type="button" className="tp-link tp-link-icon" onClick={() => setUsePhrase((v) => !v)}>
        <IconKey />
        <span>{usePhrase ? 'Use my account password instead' : 'Set a separate passphrase instead'}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        {/* "Back up" — not "Back up & download", which is what it used to say and
            used to do. The archive is kept on the server; taking a copy is a
            separate act, offered by the toast and by the button on the card. A
            label naming two acts for a button that should only do one is how the
            second one got welded on in the first place. */}
        <StickerButton icon={<IconArchive />} keepLabel disabled={!!missing || busy} title={missing || undefined}>
          {busy ? 'Backing up…' : 'Back up'}
        </StickerButton>
        <GhostButton type="button" icon={<IconClose />} keepLabel disabled={busy} onClick={onCancel}>
          Cancel
        </GhostButton>
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

  // download is the ONE way the archive leaves the server, and it is now only ever
  // reached by asking. Cookie-authed same-origin GET: the browser streams the file
  // itself, which is why this is a location assignment and not a fetch.
  const download = () => {
    window.location.href = apiURL('/admin/backup/download')
  }

  async function create(creds) {
    setBusy(true)
    const r = await json('POST', '/admin/backup', creds)
    setBusy(false)
    if (!r.ok) return toast(errText(r, 'backup failed'))
    setAsking(false)
    setBackup(r.data.backup)
    // IT NO LONGER DOWNLOADS ITSELF. Making a backup and taking a copy of it are
    // two different acts, and welding them together got both of them wrong:
    //
    //   - The archive is KEPT on the server. That is the point of the feature —
    //     one dated archive, ready to restore from, and the restore reads it from
    //     there. Somebody who wanted that got a multi-megabyte file in their
    //     Downloads folder as well, every time, unasked.
    //   - On a phone the navigation is worse than untidy: assigning
    //     window.location while a dialog is closing takes the browser off the page
    //     mid-transition, and what comes back is a download shelf over a Settings
    //     screen that has lost its scroll position.
    //   - And it happened on the FAILURE path's twin — a backup that succeeded but
    //     that you only wanted server-side still cost you the bandwidth.
    //
    // So the toast offers it instead. One tap if you want the copy, nothing if you
    // do not, and the button on the card is there either way.
    toast('backup created', { label: 'Download', onClick: download })
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
        info="One dated, encrypted archive of everything, sealed with your password or a passphrase. Moved to another machine it needs the password that sealed it, and a passphrase archive is recoverable by nothing. Restoring replaces everything here."
        infoTitle="Backup & restore"
      >
        Backup &amp; restore
      </SectionTitle>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <GhostButton
            icon={<IconArchive />}
            keepLabel
            onClick={() => setAsking(true)}
            disabled={busy || phase !== 'idle'}
          >
            {busy ? 'Backing up…' : 'Back up now'}
          </GhostButton>
          {/* THE DOWNLOAD IS A CONTROL NOW, not a `download` word in the corner.
              It was a bare tp-link beside a button, which read as a footnote to the
              backup rather than the other half of it — and it mattered less while
              creating one downloaded it anyway. Now that it does not, this is how a
              copy is taken, so it is the same size and shape as the button beside
              it. Still an anchor rather than a button: a real href is what gives it
              middle-click, "save link as", and a URL you can read before you
              commit to a multi-megabyte file. */}
          {backup && (
            <a
              className="tp-btn tp-btn-ghost tactile inline-flex items-center gap-2"
              href={apiURL('/admin/backup/download')}
            >
              <IconExport />
              Download the last one
            </a>
          )}
        </div>
        {loaded && (
          <p className="microcopy">
            {backup ? (
              <>
                last backup: <b>{fmtWhen(backup.created)}</b> · {fmtSize(backup.size)} · kept on this server until the
                next one replaces it
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
                {/* IconUpload: this file is going TO the server, which is the one
                    thing that tells it apart from the download beside it. */}
                <GhostButton
                  icon={<IconUpload />}
                  keepLabel
                  onClick={() => fileRef.current?.click()}
                  disabled={phase !== 'idle'}
                >
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
        <h2 style={{ fontFamily: 'var(--font-ui)', fontStyle: 'var(--font-ui-style)', fontVariantCaps: 'var(--font-ui-caps)', textTransform: 'var(--font-ui-case)', fontVariantNumeric: 'var(--font-ui-figures)', fontSize: 16.5, fontWeight: 600 }}>{children}</h2>
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
  const skin = tones[tone] || tones.muted
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', fontVariantNumeric: 'var(--font-mono-figures)',
        fontSize: 10.5,
        fontWeight: 500,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: skin.color,
        background: skin.bg,
        border: `1px solid ${skin.bd}`,
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
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 12, color: 'var(--faint)', minWidth: 42 }}>
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
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 7, letterSpacing: '.2em', color: `color-mix(in srgb, ${spec.amber} 60%, transparent)` }}>
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
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 12, lineHeight: 1.35, color: spec.ink }}>
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
      <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: selected ? 'var(--accent-ui)' : 'var(--faint)' }}>
        {spec.label}
      </p>
    </button>
  )
}

const prefersDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

// Appearance — the theme presets, the accent, the two size sliders, the label
// density, and the doors to the two long panels that used to be cards.
//
// TYPE AND LANGUAGE MARKS ARE POP-UPS OFF THIS CARD (1.15.2), not cards in the
// column grid beside it. Both belong to this subject — the faces the app draws
// with, and what a proverb wears where every other quote wears a face — and
// neither is a control panel: Type is eleven roles deep with a specimen apiece,
// and Language marks is a row per language with a tray of flags behind each. The
// settings page is read at a glance, and those two were the whole of two columns
// standing open, permanently, for a choice most readers make once.
//
// So they become two buttons: a glyph and its words, which is what every other
// door in this app is. The panels themselves are unchanged apart from losing
// their card frame and heading, which the dialog now carries.
function Appearance({ prefs, onPreferences }) {
  // Which long panel is open, if either. One piece of state rather than two
  // booleans: they are alternatives, and two flags can both be true.
  const [panel, setPanel] = useState(null)
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
      <SectionTitle>{t('settings.appearance.title')}</SectionTitle>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <MonoLabel>{t('settings.appearance.theme.title')}</MonoLabel>
        <Toggle
          ariaLabel={t('settings.appearance.match.aria')}
          value={syncSystem ? 'auto' : 'manual'}
          onChange={(v) => persist({ syncSystem: v === 'auto' })}
          options={[['manual', t('settings.appearance.manual.label')], ['auto', t('settings.appearance.match.label')]]}
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
          <MonoLabel className="mb-2 block">{t('settings.appearance.accent.title')}</MonoLabel>
          <div className="flex items-center gap-3" style={{ minHeight: 44 }}>
            {Object.entries(ACCENTS).map(([name, hex]) => {
              const on = accent === name
              return (
                <Tooltip key={name} label={t('settings.appearance.accent.tip', { name: t(`vocab.accent.${name}.label`) })} side="top">
                  <button
                    type="button"
                    aria-label={t('settings.appearance.accent.aria', { name: t(`vocab.accent.${name}.label`) })}
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
        <SizeSlider label={t('settings.appearance.book-size.label')} storageKey="tippani:size:books" def={165} />
        <SizeSlider label={t('settings.appearance.film-size.label')} storageKey="tippani:size:movies" def={150} />
        <LabelDensity />
        {/* THE LANGUAGE, AND IT STAYS OUT OF `persist` ABOVE for the reason that
            function documents: the Appearance panel re-sends every theme field on
            any change, so a preference riding in that object would be wiped by an
            unrelated accent click. One writer per concern. LanguagePicker applies
            the choice itself and this supplies the save. */}
        <LanguagePicker
          titleKey="settings.language.title"
          info
          onPick={(code) => {
            onPreferences?.({ locale: code })
            json('PUT', '/auth/me/preferences', { locale: code })
          }}
        />
      </div>

      {/* The two doors, and they KEEP THEIR WORDS at every width.

          Button labels normally lets a glyphed button drop its text on a phone,
          and the buttons that opt out are named ones: primary submits and
          destructive confirms. This is a third case with the same shape. A card
          action that loses its words still sits on a card full of context, and
          the reader can afford to guess; these two are the ONLY way into two
          whole settings panels, so a bare letterform is not a button whose
          meaning is merely unlabelled — it is a screen nobody finds. They were
          headed cards until 1.15.2, which is the standard being kept.

          The tooltips say something the labels do not, which is the only reason
          to carry both. */}
      <div className="mt-7 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <Tooltip label={t('settings.type.open.tip')}>
          <GhostButton icon={<IconType />} keepLabel onClick={() => setPanel('type')}>{t('settings.type.title')}</GhostButton>
        </Tooltip>
        <Tooltip label={t('settings.languages.open.tip')}>
          <GhostButton icon={<IconLanguages />} keepLabel onClick={() => setPanel('marks')}>{t('settings.languages.title')}</GhostButton>
        </Tooltip>
      </div>

      {/* No form registers with either dialog, so neither grows a ✓: both panels
          save on the tap, as they did as cards. The close is the only action. */}
      <FormModal open={panel === 'type'} onClose={() => setPanel(null)} title={t('settings.type.title')} maxWidth={620}>
        <TypeSettings prefs={prefs} onSaved={onPreferences} />
      </FormModal>
      <FormModal open={panel === 'marks'} onClose={() => setPanel(null)} title={t('settings.languages.title')} maxWidth={560}>
        <LanguageMarksSettings prefs={prefs} onSaved={onPreferences} />
      </FormModal>
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
        <MonoLabel>{t('settings.labels.title')}</MonoLabel>
        <InfoDot title={t('settings.labels.info.title')} text={t('settings.labels.info.body')} />
      </div>
      <Toggle
        ariaLabel={t('settings.labels.info.title')}
        value={pref}
        onChange={pick}
        options={[['auto', t('settings.labels.auto.label')], ['on', t('common.action.show.label')], ['off', t('common.action.hide.label')]]}
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
          <FieldIconButton
            icon={<IconEdit />}
            ariaLabel={set ? `Replace the ${label.toLowerCase()}` : `Add a ${label.toLowerCase()}`}
            onClick={() => setEditing(true)}
          />
        ) : (
          <>
            <FieldIconButton
              icon={<IconCheck />}
              ariaLabel={`Save ${label.toLowerCase()}`}
              disabled={busy}
              onClick={commit}
              tooltip={draft.trim() ? 'Save' : 'Save blank — clears this key'}
              ok
            />
            <FieldIconButton
              icon={<IconClose />}
              ariaLabel="Cancel"
              disabled={busy}
              onClick={() => { setEditing(false); setDraft(secret ? '' : value) }}
            />
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
  // NO CHIP FOR "WORKING", AND NONE FOR "NOT YET TRIED" EITHER. A green OK under
  // the heading is a pill that appears when there is nothing to tell you and
  // vanishes the moment there is — the reader learns to read it, and then it is
  // gone exactly when they need it. "Untested" (1.15.2) was the same pill in a
  // duller colour: `books_lookup.ok` is null until the first lookup of the
  // server's life, so a freshly started instance greeted every admin with a word
  // that sounds like a warning, describes no fault, and clears itself the moment
  // anybody uses the app. Nothing was ever wrong and there was nothing to do.
  // Silence is the healthy state; a chip here means something to act on.
  const booksChip = lookup?.ok === false ? ['error', 'Lookup failing'] : null
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
      <SectionTitle info="Books need no key: Google Books and Open Library, merged. Films run on TMDB unless this build ships one (TheTVDB optional), games on an IGDB pair with no built-in behind it. Each field saves on its own, and manual entry always works.">
        Metadata sources
      </SectionTitle>

      {/* No per-source headings. 1.7.2 took away the feature descriptions that
          sat under them ("Books: Google Books + Open Library"), which left three
          MonoLabels each introducing a single field that already names itself —
          "Books" above "Google Books key" is the same word twice.

          What the headings were genuinely carrying is the STATUS: whether
          lookups work at all right now, which no key field can report, because
          a key field only knows whether it is filled. So the chips move up into
          one row and the headings go.

          The chips travel ALONE. Each used to carry its own InfoDot, and two
          dots side by side are not two explanations, they are a puzzle about
          which one answers you; both blurbs are in the heading's dot now, which
          is where a reader looks for what a section is.

          The row itself goes when both chips do: an empty flex box under the
          heading is a gap that reads as a missing element rather than as
          nothing to report. */}
      {(booksChip || tmdbChip) && (
        <div className="flex flex-wrap items-center gap-2">
          {booksChip && <StatusChip tone={booksChip[0]}>{booksChip[1]}</StatusChip>}
          {tmdbChip && <StatusChip tone={tmdbChip[0]}>{tmdbChip[1]}</StatusChip>}
        </div>
      )}
      {lookup?.ok === false && lookup.error && (
        <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 11, color: 'var(--error)' }}>
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
          {/* IGDB IS A PAIR, AND BOTH HALVES GET A ROW. The endpoint has
              accepted these since 1.15.1 and reports the two halves separately —
              its comment says "so the Settings card can point at the half that is
              missing" — but the rows themselves never landed, so the Add sheet
              told you to configure a key on a screen with no field for it, and a
              game lookup 503'd with nowhere to go. There is no built-in fallback
              here as there is for TMDB: IGDB credentials are per-application and
              rate-limited, so a shared key would be a shared quota.

              Write-only like the other secrets. A client id is not secret on its
              own, but it is stored beside its partner and never echoed, so there
              is no value to pre-fill and the saved badge is the whole answer. */}
          <KeyField
            label="IGDB client id"
            hint="Games only, and IGDB authenticates through Twitch: dev.twitch.tv/console → Register Your Application → the client id is shown there. The secret below is the other half; one on its own looks nothing up."
            set={keys?.igdb_client_id_set}
            placeholder="Twitch client id — needed for games"
            busy={saving}
            onSave={(v) => saveKey('igdb_client_id', v)}
          />
          <KeyField
            label="IGDB secret"
            hint="The other half of the pair, from the same Twitch application: press “New Secret” on it. It is shown once. With no key at all, game lookups return 503 — manual entry always works."
            set={keys?.igdb_secret_set}
            placeholder="Twitch client secret — needed for games"
            busy={saving}
            onSave={(v) => saveKey('igdb_secret', v)}
          />
          {/* THE ONE IGDB STATE WORTH INTERRUPTING FOR, and the reason the server
              reports the halves separately rather than as one igdb_key_set.
              Neither set is the ordinary state of an instance with no games in
              it, and a chip for that would be the "Untested" mistake again. Half
              a pair is different: it fails at the Twitch token exchange with
              "invalid client", which surfaces as a lookup failure, so the reader
              is told games are broken when the truth is that one field is blank. */}
          {keys && (!!keys.igdb_client_id_set !== !!keys.igdb_secret_set) && (
            <p className="microcopy mt-1" style={{ color: 'var(--error)' }}>
              IGDB needs both halves — the {keys.igdb_client_id_set ? 'secret' : 'client id'} is still
              blank, so game lookups will fail as if the key were wrong.
            </p>
          )}
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

