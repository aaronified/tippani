import { useEffect, useRef, useState } from 'react'
import { DEMO, json, errText, coverImgURL, copyText, apiURL, upload as uploadFile, uploadWithProgress } from './api.js'
import { ACCENTS, applyColors, applyLabels, applyTheme, CAT_NAME_MAX, CATEGORY_PALETTE, categoryState, getResolvedTheme, LABELS_KEY, labelsPref, MAT_SET_LABELS, MAT_SETS, surfaceStyle, UNSET_LABEL } from './theme.js'
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
import { SIZE_ROLES, TYPE_FACTORS, applyTypeScale, factorsFrom, globalOf, renormalise, sizePrefKey } from './type.js'
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
import { lockedOff, parseQuestions, parseTuning, questionsBlob, questionsFor, REVIEW_DECKS, taxonomy, toggle as toggleQuestion, TUNING_FIELDS, tuningBlob, tuningProblem } from './quiz.js'
import { createPortal } from 'react-dom'
import { t, tNodes } from './i18n.js'
import { PASSPHRASE_MAX, PASSPHRASE_MIN, PASSWORD_MAX, passphraseProblem, sniffArchiveKey } from './secret.js'
import {
  Card,
  ChipSwitches,
  CloseButton,
  ConfirmDialog,
  ErrorText,
  Field,
  FieldIconButton,
  FormModal,
  IconChevron,
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
  IconRuler,
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
// Type and Language marks are NOT here. Each is a button with a pop-up behind
// it (1.15.2) — Type on the Appearance card, Language marks on Metadata. See the
// note above `Appearance` for why they are doors, and the door itself on
// Metadata for why the marks moved.
// 'clean' (Stray marks) sits directly after 'trash' for the same reason colours
// sits under metadata: both are the corner of Settings you come to when something
// has gone wrong — one for what you deleted, one for what a page left in your
// quotes — and each is a tile in front of a page of its own.
export const SETTINGS_CARDS = ['onboard', 'features', 'meta', 'colors', 'sr', 'devices', 'trash', 'clean', 'upd', 'backup']

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
// BALANCING IS BY MEASUREMENT, not by eye, and here is the measurement. Rendered
// heights at three columns, in a browser, with every card an admin has:
//
//   meta 780  colors 422 | sr 283  onboard 136  features 189  upd 265
//   devices 167  trash 165  clean 182  backup 321          (24px between cards)
//
// Quiz, Onboarding and Features all lost height when they were tightened, which
// left the middle column at 657px between two of about 1,200 — the page read as
// an inverted U, two tall sides around a short middle. Moving Updates into it
// gives 1226 / 945 / 907. Updates rather than Backup because Backup belongs
// beside the bin (see above) and Updates belongs with the cards about the app
// itself; and because Updates is the card a NON-ADMIN does not have, so their
// three columns come out exactly as they did before this was rebalanced rather
// than being rebalanced around a card they cannot see.
//
// Re-measure before moving anything: any card that changes height changes the
// answer, and the numbers above are the whole argument.
//
// Colours sits directly under Metadata in every layout, and that is a rule
// rather than an arrangement: both are about what a quote is LABELLED with —
// where the facts about a work come from, and what the colour on a highlight is
// called — so reading down one column reads as one subject. Language marks was
// the third card in that family and is a pop-up now, but it is a pop-up off
// METADATA rather than off Appearance: a language mark is what a quote with
// nobody to credit says it is, which is this family's subject and not the
// theme's. settings-layout.test.js pins the pair of cards.
export const SETTINGS_LAYOUT = {
  1: [SETTINGS_CARDS],
  2: [
    ['meta', 'colors', 'onboard', 'features'],
    ['sr', 'devices', 'trash', 'clean', 'upd', 'backup'],
  ],
  3: [
    ['meta', 'colors'], // the tall one, and the card that belongs under it
    ['sr', 'onboard', 'features', 'upd'],
    ['devices', 'trash', 'clean', 'backup'],
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

export default function Settings({ user, onPreferences, update, onUpdateInfo, onStartTour, onOpenBin, onOpenCleanup }) {
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
    // Beside the bin, and a tile for the same reason: the list behind it is
    // unbounded and its rows carry a snippet, which a 300px grid column truncates
    // exactly where the evidence is.
    clean: <CleanupTile onOpen={onOpenCleanup} />,
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
        {/* 'admin' is a ROLE, and the users list already names it — so this
            draws that same word rather than a second copy of it. The username
            beside it is data, not copy. */}
        <PageHeader title={t('nav.tab.settings.label')} counts={user.is_admin ? t('account.users.admin.chip') : user.username} />
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
// Three columns now: the stored token, the SYMBOL the chip draws, and the key
// that names it aloud. The symbol is not copy — it is the character the splitter
// matches, and “and” is the English word an author line actually contains, so
// translating either would name a separator nothing splits on. The screen-reader
// name IS copy, and it used to be the stored token read out raw.
// Three columns, and the middle one is now a KEY like the third. The symbol is
// still not copy — its value is the same in every language — but it goes through
// the resolver so the pseudo-locale gate can see it, rather than standing on the
// screen as the one untokenised string on the card.
const CREDIT_SEP_OPTIONS = [
  ['comma', 'settings.credits.sep.comma.symbol', 'settings.credits.sep.comma.aria'],
  ['semicolon', 'settings.credits.sep.semicolon.symbol', 'settings.credits.sep.semicolon.aria'],
  ['amp', 'settings.credits.sep.amp.symbol', 'settings.credits.sep.amp.aria'],
  ['and', 'settings.credits.sep.and.symbol', 'settings.credits.sep.and.aria'],
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
        {CREDIT_SEP_OPTIONS.map(([key, symbol, aria]) => (
          <Tooltip key={key} label={t('settings.credits.chip.tip')} side="top">
            <button
              type="button"
              className={'tp-filter-chip' + (active.has(key) ? ' active' : '')}
              aria-pressed={active.has(key)}
              aria-label={t(aria)}
              onClick={() => toggle(key)}
            >
              {t(symbol)}
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
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-12)', color: 'var(--faint)' }}>{show}</span>
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
      setErr(errText(r, t('error.save.generic')))
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
      {/* THE CHIPS THEMSELVES ARE SHARED NOW. They were hand-rolled here from
          filterChipClass and a Tooltip, and then the question toggles and the
          Features switches became the same control — three copies of one widget,
          one of which had already shipped a bug (t() around the hint and not
          around the label). ChipSwitches holds the mechanism; this holds the
          rule about which media a deck may be emptied of.

          t() on BOTH slots. The comment on REVIEW_MEDIA says "both words are
          keys" and only one of them was resolved, so these three chips read
          `nav.tab.library.label` and its two siblings on screen — inside the
          review card itself. */}
      <ChipSwitches
        ariaLabel={t('settings.review-scope.title')}
        options={REVIEW_MEDIA.map(([key, label, hint]) => ({
          key,
          label: t(label),
          on: on.includes(key),
          hint: t(hint),
          locked: on.includes(key) && last ? t('settings.review-scope.stuck.tip') : '',
        }))}
        onToggle={(key, next) => {
          const picked = next ? [...on, key] : on.filter((k) => k !== key)
          onChange(REVIEW_MEDIA.map((m) => m[0]).filter((k) => picked.includes(k)).join(','))
        }}
      />
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
// SizeDial — one role's scaling factor, or the global one.
//
// A Select rather than a slider, and rather than six chips. A slider suggests a
// continuum and there are six positions; six chips is a row wider than the label
// it belongs to, on a panel that already has a row of face chips under every
// heading. A dropdown says "one of these" in the width of its longest option.
//
// `mixed` is offered as a READABLE value and not as a choosable one — it is what
// the global reads when the four roles disagree, and picking it would mean nothing.
// Select needs the current value to be in its options or it renders empty, so the
// em dash is appended exactly when it applies.
function SizeDial({ value, onChange, ariaLabel, width = 108 }) {
  const options = TYPE_FACTORS.map((n) => [String(n), t('settings.type.size.factor', { n })])
  if (!TYPE_FACTORS.includes(value)) options.unshift(['0', t('settings.type.size.mixed')])
  return (
    <Select
      value={String(value)}
      onChange={(v) => v !== '0' && onChange(Number(v))}
      options={options}
      ariaLabel={ariaLabel}
      width={width}
    />
  )
}

// faceOptions — one role's whole list, each option drawn in the face it names.
//
// Select takes [value, label] pairs and a label may be a node, which is what lets
// the specimen BE the option: a list of type names set in one typeface answers no
// question anybody has.
const faceOptions = (row, uploads) => [
  ...row.faces.map((f) => [
    f.id,
    <span key={f.id} style={{ fontFamily: `'${f.family}'` }}>{t(f.name)}</span>,
    t(f.name), // what typing searches, since the label itself is an element
  ]),
  ...uploads.map((f) => [
    f.token,
    <span key={f.token} style={{ fontFamily: `'${f.family}'` }}>{f.name}</span>,
    f.name,
  ]),
]

// specimenSize — the token a role's specimen is drawn at. Mono is set smaller
// because a label IS smaller; the two script rows borrow the reading face's dial,
// since that is the size their glyphs are drawn at on a real screen.
const specimenSize = (roleKey) => {
  if (roleKey === 'mono') return 'var(--type-mono-13)'
  return SIZE_ROLES.includes(roleKey) ? `var(--type-${roleKey}-17)` : 'var(--type-display-17)'
}

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

  // The four dials, read from the preferences the card was handed rather than held
  // as state of their own: the global dial on the Appearance card writes the same
  // four fields, and two copies of one number is how the two panels come to
  // disagree about what the size is.
  const factors = factorsFrom(prefs)

  // Applied FIRST and asked after, exactly like save() below and for the same
  // reason: the point of a size dial is watching the type move.
  async function saveSize(patch) {
    applyTypeScale({ ...(prefs || {}), ...patch })
    const r = await json('PUT', '/auth/me/preferences', patch)
    if (!r.ok) {
      setErr(errText(r, t('error.save.generic')))
      applyTypeScale(prefs || {})
      return
    }
    setErr('')
    onSaved?.(patch)
  }

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
    if (!r.ok) return setErr(errText(r, t('error.upload.font')))
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
      setErr(errText(r, t('error.save.generic')))
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
                {/* THE SIZE DIAL SITS IN THE HEAD, not behind the disclosure, so
                    the four of them read as a column you can compare down — and
                    so the one control a reader is most likely to want is not two
                    taps away. Only the four roles that OWN a size have one: a
                    script's glyphs take the size of the element they are drawn in.
                */}
                {SIZE_ROLES.includes(row.key) && (
                  <SizeDial
                    value={factors[row.key]}
                    ariaLabel={t('settings.type.size.aria', { name: t(row.label) })}
                    onChange={(n) => saveSize({ [sizePrefKey(row.key)]: n })}
                  />
                )}
              </div>
              {/* The specimen, always visible: the row's own job, in the face
                  currently set, so the list reads as a page of type rather than
                  as a list of names. */}
              <p
                className="mb-1"
                style={{
                  fontFamily: `var(${row.prop})`,
                  fontStyle: row.italic ? 'italic' : 'normal',
                  // THE SPECIMEN ANSWERS THIS ROW'S OWN DIAL, which is what makes
                  // it a preview rather than a picture: turn Labels up and the
                  // label specimen grows while the others hold still. The token
                  // carries the factor, so nothing here does arithmetic.
                  //
                  // The two SCRIPT rows borrow the reading face's dial, because
                  // that is the size their glyphs are actually drawn at: a Bengali
                  // quote is a display element with Bengali codepoints in it.
                  fontSize: specimenSize(row.key),
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
                  {/* THE FACE PICKER IS A TYPEABLE DROPDOWN, and it stopped
                      being a row of chips for a reason that arrives with use: it
                      was three bundled faces per role, and it is three plus
                      everything you have ever uploaded. A chip row grows sideways
                      until it wraps to three lines under a heading that already
                      has a specimen above it, and there is no way to find a name
                      in it but to read all of them.

                      EVERY OPTION IS DRAWN IN ITS OWN FACE. That is the only
                      question the list is asked — a name set in the interface font
                      tells you nothing about what you are choosing.

                      AND YOUR OWN FACES ARE OFFERED ON EVERY ROLE, because only
                      you know what you uploaded one for. The script check below is
                      what tells you whether it suits the role you picked. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      filter
                      width={228}
                      value={row.chosen.id}
                      ariaLabel={t('settings.type.face.aria', { name: t(row.label) })}
                      filterPlaceholder={t('settings.type.face.filter.placeholder')}
                      onChange={(id) => {
                        save({ [prefKey(row.key)]: id })
                        if (String(id).startsWith('upload:')) checkScript(row.key)
                      }}
                      options={faceOptions(row, mine)}
                    />
                    {/* UPLOAD IS ITS OWN BUTTON. It was a fourth chip beside three
                        typefaces, which reads as a fourth typeface — and it is not
                        a face, it is a way of getting one. */}
                    <label className="tp-btn tp-btn-ghost tactile" style={{ cursor: 'pointer' }}>
                      <IconUpload />
                      <span>{busy ? t('common.action.upload.busy') : t('settings.type.upload.label')}</span>
                      <input
                        type="file"
                        accept=".woff2,.woff,.otf,.ttf,font/woff2,font/woff,font/otf,font/ttf"
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => { upload(row.key, e.target.files?.[0]); e.target.value = '' }}
                      />
                    </label>
                  </div>
                  {/* Removing an uploaded face is managing YOUR FONTS, not picking
                      this role's — so it is listed once, here, rather than as a bin
                      beside the same face in all six rows. */}
                  {mine.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {mine.map((f) => (
                        <span key={f.id} className="inline-flex items-center gap-1">
                          <MonoLabel style={{ color: 'var(--faint)' }}>{f.name}</MonoLabel>
                          <FieldIconButton
                            icon={<IconDelete />}
                            ariaLabel={t('common.action.remove.aria', { name: f.name })}
                            onClick={() => removeFont(f)}
                            tooltip={t('settings.type.font.remove.tip')}
                            danger
                          />
                        </span>
                      ))}
                    </div>
                  )}
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
      setErr(errText(r, t('error.save.generic')))
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
        {t('settings.languages.intro.prose')}
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
                            style={{ background: 'var(--raised)', fontSize: 'var(--type-ui-15)', lineHeight: 1 }}
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
                              style={{ background: 'var(--raised)', fontSize: 'var(--type-ui-15)', lineHeight: 1 }}
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
        {t('settings.quiz.title')}
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
          {/* ONE ROW OF CHIPS, NOT FIVE ROWS OF YES/NO (1.17.0). Nine labelled
              rows, each with its own segmented switch and its own dot, filled
              this pop-up top to bottom — and the question they answered is a set
              ("which of these does it ask?"), which a lit chip states and a
              column of switches makes you read one line at a time. The dots went
              with the rows: a chip's hint is its tooltip, which is what the
              review-scope chips three lines up have always done.

              The lock still speaks IN WORDS, under the row. lockedOff returns
              the reason rather than a boolean precisely so it can be shown, and
              only one chip per deck can ever be locked — the last universal
              question standing — so one line says it without naming which. */}
          <ChipSwitches
            ariaLabel={t('settings.quiz.deck.title', { name: deckLabel })}
            options={questionsFor(deck).map((q) => ({
              key: q.id,
              label: q.label,
              on: qs[deck].includes(q.id),
              // The hint, then the two axes the question sits on. Seven chips in
              // a row is a list you read as arbitrary unless something says which
              // of them are the same question asked another way — see taxonomy.
              hint: q.hint + '\n\n' + taxonomy(q),
              locked: lockedOff(qs, deck, q.id),
            }))}
            onToggle={(id) => commit(toggleQuestion(qs, deck, id))}
          />
          {(() => {
            const stuck = questionsFor(deck).map((q) => lockedOff(qs, deck, q.id)).find(Boolean)
            return stuck ? <p className="microcopy mt-1.5">{stuck}</p> : null
          })()}
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
                <MonoLabel style={{ fontSize: 'var(--type-ui-11)' }}>{f.label}</MonoLabel>
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
  const current = user?.version || t('settings.updates.version.dev')
  const [logOpen, setLogOpen] = useState(false)
  const [info, setInfo] = useState(update || null) // check result (seeded from the shared session cache)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [phase, setPhase] = useState('idle') // idle | applying | restarting | failed

  // WHICH RELEASE LINE THIS BOX FOLLOWS. Not read from a preference the client
  // owns: the server decides the default from the version it is running (a
  // branch or rc build is already on the pre-release line), so the control
  // shows what the last check reported and only sends when it is moved.
  const channel = info?.channel || 'stable'

  async function setChannel(next) {
    setBusy(true)
    const r = await json('POST', '/admin/update/channel', { channel: next })
    if (r.ok) {
      setInfo((prev) => (prev ? { ...prev, ...r.data } : prev))
      // Re-check straight away: changing the line changes the answer, and
      // leaving the old one on screen under the new label is how somebody ends
      // up reading "up to date" about a line they just left.
      const c = await json('GET', '/admin/update/check')
      if (c.ok) {
        setInfo(c.data)
        onUpdateInfo?.(c.data)
      }
    } else toast(t('error.check.updates'))
    setBusy(false)
  }

  async function check() {
    setBusy(true)
    const r = await json('GET', '/admin/update/check')
    setBusy(false)
    if (r.ok) {
      setInfo(r.data)
      onUpdateInfo?.(r.data) // share up so the mobile drawer's badge mirrors this
    } else toast(t('error.check.updates'))
  }

  async function apply() {
    if (confirm !== 'UPDATE') return
    setPhase('applying')
    const r = await json('POST', '/admin/update/apply', { confirm: 'UPDATE' })
    if (!r.ok) {
      setPhase('failed')
      toast(r.data?.error || t('error.update.start'))
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
    toast(t('settings.updates.toast.reload'))
  }

  const copyCmd = async () => {
    const ok = await copyText(info?.guided_command || '')
    toast(ok ? t('settings.updates.toast.copied') : t('error.copy.manual'))
  }

  return (
    <Card>
      <SectionTitle>{t('settings.updates.title')}</SectionTitle>
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <MonoLabel>{t('settings.updates.version.label')}</MonoLabel>
          {user?.releases_url ? (
            <Tooltip label={t('settings.updates.releases.tip')} side="bottom">
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
        {/* tNodes, because the sentence carries a link and markup never goes in
            a locale value: the {roadmap} hole takes the anchor. */}
        <p className="microcopy" style={{ fontSize: 'var(--type-ui-13)' }}>
          {tNodes('settings.updates.roadmap.prose', {
            roadmap: (
              <a key="roadmap" className="tp-link" href={`${DOCS_BASE}roadmap.html`} target="_blank" rel="noreferrer">
                {t('settings.updates.roadmap.link.label')}
              </a>
            ),
          })}
        </p>

        {phase === 'restarting' ? (
          <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
            {t('settings.updates.restarting.prose')}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <GhostButton onClick={check} disabled={busy || phase === 'applying'}>
                {busy ? t('settings.updates.check.busy') : t('settings.updates.check.label')}
              </GhostButton>
              {/* Beside the check, not instead of the GitHub link above it: the
                  link answers "what is in a version I have not installed", this
                  answers "what is in the one I am running". Different questions,
                  and only the second one works with the network off. */}
              <GhostButton onClick={() => setLogOpen(true)}>{t('settings.changelog.title')}</GhostButton>
              {info && !info.update_available && !info.check_error && (
                <MonoLabel style={{ color: 'var(--ok)' }}>{t('settings.updates.current.label')}</MonoLabel>
              )}
            </div>

            {/* Only after a check: before one, there is nothing to say which
                line this build is on, and a toggle that guesses would be
                asserting the very thing the check is for. */}
            {info && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <MonoLabel>{t('settings.updates.channel.title')}</MonoLabel>
                  <InfoDot text={t('settings.updates.channel.info.body')} />
                </div>
                <Toggle
                  ariaLabel={t('settings.updates.channel.aria')}
                  disabled={busy || phase === 'applying'}
                  value={channel}
                  onChange={setChannel}
                  options={[
                    ['stable', t('settings.updates.channel.stable.label')],
                    ['prerelease', t('settings.updates.channel.prerelease.label')],
                  ]}
                />
                {!info.channel_explicit && (
                  <p className="microcopy" style={{ marginTop: 6, color: 'var(--soft)' }}>
                    {t(channel === 'prerelease'
                      ? 'settings.updates.channel.implied.prerelease.prose'
                      : 'settings.updates.channel.implied.stable.prose')}
                  </p>
                )}
              </div>
            )}

            {info?.check_error && (
              <p className="microcopy" style={{ color: 'var(--soft)' }}>
                {t('settings.updates.unreachable.prose', { error: info.check_error })}
              </p>
            )}

            {info?.update_available && (
              <div className="space-y-3">
                <p className="microcopy">
                  {tNodes('settings.updates.available.prose', {
                    version: <strong key="version">{info.latest}</strong>,
                    current,
                  })}{' '}
                  {info.notes_url && (
                    <a href={info.notes_url} target="_blank" rel="noopener noreferrer" className="tp-link">
                      {t('settings.updates.notes.label')}
                    </a>
                  )}
                </p>

                {info.can_self_update ? (
                  <div className="space-y-2">
                    {/* UPDATE is not copy: it is the word the server compares
                        byte for byte, so it stays Latin in every language and is
                        supplied as a node rather than living in the value. */}
                    <p className="microcopy">
                      {tNodes('settings.updates.confirm.prose', {
                        word: <b key="word">UPDATE</b>,
                        version: info.latest,
                      })}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* The placeholder is the typed confirmation itself, not a
                          label — see above. */}
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
                        {phase === 'applying' ? t('settings.updates.apply.busy') : t('settings.updates.apply.label')}
                      </StickerButton>
                    </div>
                    {phase === 'failed' && (
                      <p className="microcopy" style={{ color: 'var(--error)' }}>
                        {t('settings.updates.failed.prose')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="microcopy">
                      {t('settings.updates.manual.prose')}
                    </p>
                    {/* WHAT IT ACTUALLY LOOKED FOR. The sentence above is the
                        same one whether the socket was never mounted, was
                        mounted where this user cannot read it, or is being
                        hunted for under a path with a ":ro" left on it — and
                        the operator has no way to tell which from here. The
                        server's own words, in mono, because it is a path. */}
                    {info.socket_error && (
                      <p
                        className="microcopy"
                        style={{ color: 'var(--soft)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-mono-11)', overflowWrap: 'anywhere' }}
                      >
                        {info.socket_error}
                      </p>
                    )}
                    <div
                      className="flex items-center justify-between gap-2"
                      style={{ background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px' }}
                    >
                      <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-13)', overflowWrap: 'anywhere' }}>
                        {info.guided_command}
                      </code>
                      <button type="button" className="tp-link" onClick={copyCmd} style={{ whiteSpace: 'nowrap' }}>
                        {t('settings.updates.copy.label')}
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
      if (!r.ok) return setError(errText(r, t('error.load.changelog')))
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
    <p className="microcopy">{t('common.state.loading')}</p>
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
              {running && <span className="cl-running">{t('settings.changelog.running.label')}</span>}
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
      {/* tNodes: the version is bold, and markup never goes in a locale value. */}
      {data.current_listed === false && (
        <p className="microcopy" style={{ color: 'var(--faint)' }}>
          {tNodes('settings.changelog.unlisted.prose', {
            version: <b key="version">{current}</b>,
          })}
        </p>
      )}
    </div>
  )

  if (mobile) {
    return createPortal(
      <MobileSheet open onClose={onClose} title={t('settings.changelog.title')}>
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
      aria-label={t('settings.changelog.title')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="hand-card hc-r2 w-full" style={{ maxWidth: 640, padding: '18px 20px 20px' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 'var(--type-ui-19)' }}>{t('settings.changelog.title')}</h2>
          <Tooltip label={t('common.action.close.label')} side="bottom">
            <CloseButton onClick={onClose} tooltip={t('settings.changelog.close.tip')} />
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
        {t('settings.features.title')}
      </SectionTitle>
      <p className="microcopy">
        {t('settings.features.intro.prose')}
      </p>
      {/* FOUR CHIPS, NOT FOUR ROWS (1.17.0). A section is shown when its chip is
          lit, which is one line for the whole card where there were four blocks
          of name-plus-switch-plus-blurb — and this card is read far more often
          than it is changed, so the standing cost was the whole cost.

          THE BLURBS GO INTO THE CHIPS' TOOLTIPS, resolved here, because
          SECTIONS[].what is a KEY — it was rendered raw once and printed
          `nav.section.library.what` on screen, while the SAME table resolved
          correctly forty lines up in the Metadata card.

          THE LOCK STILL SPEAKS IN WORDS, under the row rather than in a bubble.
          Only one section can ever be the last one standing, so one line says it;
          a reader who cannot turn something off is owed the reason on the screen
          they are looking at. */}
      <ChipSwitches
        className="mt-3"
        ariaLabel={t('settings.features.title')}
        options={SECTIONS.map((sec) => ({
          key: sec.tab,
          label: t(sec.label),
          on: !!on[sec.tab],
          hint: t(sec.what),
          // The last one standing is the one that cannot go. Anthologies is never
          // one of them (see lastOne), so the lock cannot spill onto it.
          locked: lastOne && on[sec.tab] && !sec.off ? t('settings.features.locked.prose') : '',
        }))}
        onToggle={(tab, next) => set(SECTIONS.find((sec) => sec.tab === tab), next)}
      />
      {lastOne && <p className="microcopy mt-2">{t('settings.features.locked.prose')}</p>}
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
        right={state === 'done' && <MonoLabel style={{ color: 'var(--ok)' }}>{t('settings.onboarding.done.label')}</MonoLabel>}
        info={t('settings.onboarding.info.body')}
        infoTitle={t('settings.onboarding.title')}
      >
        {t('settings.onboarding.title')}
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        {/* keepLabel on the primary: it carries the step count when it is a
            Resume, and a bare flag on a phone would drop the only part of that
            button anybody reads. */}
        {state === 'postponed' ? (
          <>
            <StickerButton icon={<IconTour />} keepLabel onClick={() => start(step)}>
              {t('settings.onboarding.resume.label', { n: Math.min(step + 1, total), total })}
            </StickerButton>
            <GhostButton icon={<IconRefresh />} onClick={() => start(0)}>{t('settings.onboarding.restart.label')}</GhostButton>
          </>
        ) : (
          <StickerButton icon={<IconTour />} keepLabel onClick={() => start(0)}>
            {t(state ? 'settings.onboarding.replay.label' : 'settings.onboarding.start.label')}
          </StickerButton>
        )}
        {/* keepLabel for the same reason the two Appearance doors have it: this
            is the only way to the picker, and an unlabelled bookmark on a phone
            is a feature nobody finds. "Start over" above keeps none, and should
            not — it is a secondary variant of the labelled button beside it, so
            the row it sits in already says what it is about. */}
        <GhostButton icon={<IconBookmark />} keepLabel onClick={() => setPicking(true)}>{t('settings.onboarding.pick.label')}</GhostButton>
      </div>
      <FormModal open={picking} onClose={() => setPicking(false)} title={t('settings.onboarding.pick.label')} maxWidth={520}>
        <p className="microcopy mb-3">
          {t('settings.onboarding.pick.prose')}
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
              <span style={{ fontSize: 'var(--type-ui-13)', fontWeight: 600 }}>{f.name}</span>
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
    else setErr(errText(r, t('error.load.devices')))
  }
  useEffect(() => {
    load()
  }, [])

  async function startPairing() {
    setBusy(true)
    const r = await json('POST', '/auth/devices/pair')
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.pair.device')))
    setErr('')
    setPair(r.data)
  }

  async function revoke(d) {
    if (!confirm(t('settings.devices.revoke.confirm', { name: d.name }))) return
    const r = await json('DELETE', `/auth/devices/${d.id}`)
    if (!r.ok) return setErr(errText(r, t('error.revoke.device')))
    setErr('')
    toast(t('settings.devices.toast.unpaired'))
    load()
  }

  async function revokeAll() {
    if (!confirm(t('settings.devices.revoke-all.confirm'))) return
    const r = await json('POST', '/auth/devices/revoke-all')
    if (!r.ok) return setErr(errText(r, t('error.revoke.devices')))
    setErr('')
    toast(t('settings.devices.toast.all-unpaired'))
    load()
  }

  return (
    <Card>
      <SectionTitle
        right={devices?.length ? <MonoLabel>{t('settings.devices.paired.count', { n: devices.length })}</MonoLabel> : null}
        info={t('settings.devices.info.body')}
        infoTitle={t('settings.devices.title')}
      >
        {t('settings.devices.title')}
      </SectionTitle>

      {pair ? (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="flex items-center gap-1.5">
            <MonoLabel>{t('settings.devices.code.label')}</MonoLabel>
            <InfoDot title={t('settings.devices.code.info.title')} text={t('settings.devices.code.info.body')} />
          </div>
          <div
            className="mt-1 select-all"
            style={{
              fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)',
              fontSize: 'var(--type-mono-30)',
              letterSpacing: '0.18em',
              fontWeight: 600,
            }}
          >
            {pair.code}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FieldIconButton
              icon={<IconCopy />}
              ariaLabel={t('settings.devices.code.copy.aria')}
              onClick={() => copyText(pair.code)}
              tooltip={t('settings.devices.code.copy.tip')}
            />
            <FieldIconButton
              icon={<IconCheck />}
              ariaLabel={t('settings.devices.code.done.aria')}
              onClick={() => {
                  setPair(null)
                  load()
                }}
              tooltip={t('common.action.done.label')}
              ok
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <StickerButton icon={<IconDevice />} keepLabel onClick={startPairing} disabled={busy}>
            {t('settings.devices.pair.label')}
          </StickerButton>
          {devices?.length > 0 && (
            <FieldIconButton
              icon={<IconDelete />}
              ariaLabel={t('settings.devices.revoke-all.aria')}
              onClick={revokeAll}
              danger
            />
          )}
        </div>
      )}

      {devices?.length > 0 && (
        <ul className="mt-4 space-y-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-3" style={{ fontSize: 'var(--type-ui-13)' }}>
              <span>
                <b>{d.name}</b>
                <span style={{ color: 'var(--soft)' }}>
                  {' — '}
                  {d.last_seen_at
                    ? t('settings.devices.last-seen.label', { when: fmtStamp(d.last_seen_at) })
                    : t('settings.devices.never.label')}
                </span>
              </span>
              <span className="ml-auto">
                <FieldIconButton
                  icon={<IconClose />}
                  ariaLabel={t('settings.devices.revoke.aria', { name: d.name })}
                  onClick={() => revoke(d)}
                  danger
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      {devices?.length === 0 && !pair && (
        <p className="microcopy mt-3" style={{ fontSize: 'var(--type-ui-12)', color: 'var(--soft)' }}>
          {t('settings.devices.empty.prose')}
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

  // The same three validate reasons the onboarding twin uses (App.jsx), through
  // the same keys: two dialogs for one operation should not own two vocabularies
  // for "you have not typed the thing yet".
  const missing =
    key === 'passphrase'
      ? passphrase ? '' : t('error.validate.archive-passphrase-required')
      : key === 'password'
        ? password ? '' : t('error.validate.password-required')
        : confirm !== 'RESTORE'
          ? t('error.validate.restore-word')
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
      {/* TWO WHOLE SENTENCES RATHER THAN ONE WITH A HOLE IN IT. The date clause
          lands in the middle of the warning, and a locale value cannot begin with
          the space that would need — the parser trims both halves — so the dated
          and undated forms are two keys instead of a fragment glued in. */}
      <p className="microcopy" style={{ color: 'var(--error)' }}>
        {meta?.created
          ? t('settings.restore.warn.dated.prose', { date: fmtWhen(meta.created) })
          : t('settings.restore.warn.prose')}
      </p>
      {key === 'passphrase' && (
        <label className="tp-field">
          <MonoLabel>{t('common.field.passphrase.label')}</MonoLabel>
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
          <MonoLabel>{t('settings.restore.password.label')}</MonoLabel>
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
              ? t('settings.restore.password.recoverable.prose')
              : era
                ? t('settings.restore.password.named.prose', { name: meta.account })
                : t('settings.restore.password.era.prose')}
          </p>
        </label>
      )}
      {key !== 'passphrase' && key !== 'password' && (
        <label className="tp-field">
          {/* RESTORE stays Latin in every language: it is the word the server
              compares byte for byte. */}
          <MonoLabel>{t('settings.restore.confirm.label')}</MonoLabel>
          <input
            className="tp-input"
            style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)' }}
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <p className="microcopy">{t('settings.restore.confirm.prose')}</p>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {/* keepLabel on both, and here it is not a style choice: this button
            replaces every user, library and setting on the server and logs
            everyone out. Nothing about that is to be found out by pressing a
            glyph you half-recognise. */}
        <StickerButton icon={<IconRestore />} keepLabel disabled={!!missing || !!busyLabel} title={missing || undefined}>
          {busyLabel || t('common.action.restore.label')}
        </StickerButton>
        <GhostButton type="button" icon={<IconClose />} keepLabel disabled={!!busyLabel} onClick={onCancel}>
          {t('common.action.cancel.label')}
        </GhostButton>
      </div>
      {/* The stop belongs to the sentence, not to the reason — Bengali ends on a
          danda, which is why the frame is a key and not a '.' in the JSX. */}
      {missing && <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('common.form.reason.sentence', { reason: missing })}</p>}
    </form>
  )

  if (mobile) {
    return createPortal(
      <MobileSheet open onClose={busyLabel ? () => {} : onCancel} title={t('settings.restore.title')} dismissOnScrim={false}>
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
      aria-label={t('settings.restore.title')}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busyLabel) onCancel() }}
    >
      <div className="hand-card hc-r2 w-full" style={{ maxWidth: 460, padding: '18px 20px 20px' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 'var(--type-ui-19)' }}>{t('settings.restore.title')}</h2>
          <Tooltip label={t('common.action.cancel.label')} side="bottom">
            <CloseButton onClick={onCancel} label={t('common.action.cancel.label')} tooltip={t('settings.prompt.close.tip')} disabled={!!busyLabel} />
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
      {/* The name and the two states the page shares with the tile are the
          page's own keys (bin.*) — one bin, one vocabulary. Only the dot and the
          count line are the tile's own. */}
      <SectionTitle
        info={t('settings.bin.info.body')}
        infoTitle={t('bin.info.title')}
      >
        {t('bin.title')}
      </SectionTitle>

      <div className="space-y-3">
        {/* REAL PLURALS. This line was two JavaScript ternaries picking between
            entry/entries and quote/quotes, which is English grammar in code and
            has no answer in a language with different plural rules. Both counts
            go through unit.* and common.count.phrase now, and whether anything is
            held picks between two whole sentences rather than splicing a clause
            in. */}
        <p className="microcopy">
          {items === null
            ? t('bin.state.loading')
            : n === 0
              ? t('bin.state.empty')
              : t(held > 0 ? 'settings.bin.tile.holding.prose' : 'settings.bin.tile.prose', {
                  count: t('common.count.phrase', { n, noun: t('unit.entry', { count: n }) }),
                  held: t('common.count.phrase', { n: held, noun: t('unit.quote', { count: held }) }),
                })}
        </p>
        {/* keepLabel: the one control on this card, and a lone wastebasket glyph on
            a settings page reads as "delete something" rather than "open the place
            deleted things went". */}
        <GhostButton icon={<IconDelete />} keepLabel onClick={onOpen}>
          {t('settings.bin.open.label')}
        </GhostButton>
      </div>
    </Card>
  )
}


// CleanupTile — the door to Stray marks, and the whole of that page Settings keeps.
//
// SAME SHAPE AS THE BIN ABOVE, and for the same reasons argued there: the list is
// of unbounded length and every row carries a snippet of the quote, which is the
// one fact a narrow grid column cannot show. So the tile holds what a settings
// page should hold about it — whether there is anything worth looking at, and the
// way in.
//
// "NOTHING TO LOOK AT" IS THE ANSWER WORTH FETCHING FOR. It is the same argument
// the bin's count makes: this page is in no tab list, so the tile is the only
// thing that can tell you not to bother opening it. The sweep reads the whole
// library, which is why this asks for it once on mount and never again.
function CleanupTile({ onOpen }) {
  const [items, setItems] = useState(null) // null = still loading

  useEffect(() => {
    let stale = false
    json('GET', '/cleanup').then((r) => {
      if (!stale) setItems(r.ok ? r.data.items || [] : [])
    })
    return () => {
      stale = true
    }
  }, [])

  const n = items?.length ?? 0

  return (
    <Card>
      {/* The page's own name and its clean state come from cleanup.* — one
          feature, one vocabulary — and only the dot and the count line here are
          Settings' own. */}
      <SectionTitle info={t('settings.cleanup.info.body')} infoTitle={t('cleanup.info.title')}>
        {t('cleanup.title')}
      </SectionTitle>

      <div className="space-y-3">
        <p className="microcopy">
          {items === null
            ? t('cleanup.state.loading')
            : n === 0
              ? t('settings.cleanup.tile.clean.prose')
              : t('settings.cleanup.tile.prose', {
                  count: t('common.count.phrase', { n, noun: t('unit.quote', { count: n }) }),
                })}
        </p>
        {/* keepLabel, like the bin's: an eye on a settings page reads as "show
            something", not "go and look at what got into your quotes". */}
        <GhostButton icon={<IconEye />} keepLabel onClick={onOpen}>
          {t('settings.cleanup.open.label')}
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
  const missing = usePhrase ? passphraseProblem(passphrase) : password ? '' : t('error.validate.password-required')

  const submit = (e) => {
    e.preventDefault()
    if (missing || busy) return
    onConfirm(usePhrase ? { passphrase } : { password })
  }

  const body = (
    <form onSubmit={submit} className="space-y-3">
      <p className="microcopy">
        {t('settings.backup.what.prose')}
      </p>
      {!usePhrase ? (
        <label className="tp-field">
          <MonoLabel>{t('settings.restore.password.label')}</MonoLabel>
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
            {t('settings.backup.password.prose')}
          </p>
        </label>
      ) : (
        <label className="tp-field">
          <MonoLabel>{t('settings.backup.passphrase.label', { min: PASSPHRASE_MIN, max: PASSPHRASE_MAX })}</MonoLabel>
          <input
            className="tp-input"
            type="password"
            autoFocus
            maxLength={PASSPHRASE_MAX}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <p className="microcopy">{t('settings.backup.passphrase.prose')}</p>
        </label>
      )}
      {/* The key this archive will be sealed with is the single most consequential
          choice on this form, so the control that switches it wears the key. */}
      <button type="button" className="tp-link tp-link-icon" onClick={() => setUsePhrase((v) => !v)}>
        <IconKey />
        <span>{t(usePhrase ? 'settings.backup.use-password.label' : 'settings.backup.use-passphrase.label')}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        {/* "Back up" — not "Back up & download", which is what it used to say and
            used to do. The archive is kept on the server; taking a copy is a
            separate act, offered by the toast and by the button on the card. A
            label naming two acts for a button that should only do one is how the
            second one got welded on in the first place. */}
        <StickerButton icon={<IconArchive />} keepLabel disabled={!!missing || busy} title={missing || undefined}>
          {busy ? t('settings.backup.now.busy') : t('settings.backup.prompt.title')}
        </StickerButton>
        <GhostButton type="button" icon={<IconClose />} keepLabel disabled={busy} onClick={onCancel}>
          {t('common.action.cancel.label')}
        </GhostButton>
      </div>
      {missing && <p className="microcopy" style={{ color: 'var(--faint)' }}>{t('common.form.reason.sentence', { reason: missing })}</p>}
    </form>
  )

  if (mobile) {
    return createPortal(
      <MobileSheet open onClose={busy ? () => {} : onCancel} title={t('settings.backup.prompt.title')} dismissOnScrim={false}>
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
      aria-label={t('settings.backup.prompt.title')}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
    >
      <div className="hand-card hc-r2 w-full" style={{ maxWidth: 460, padding: '18px 20px 20px' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 'var(--type-ui-19)' }}>{t('settings.backup.prompt.title')}</h2>
          <Tooltip label={t('common.action.cancel.label')} side="bottom">
            <CloseButton onClick={onCancel} label={t('common.action.cancel.label')} tooltip={t('settings.prompt.close.tip')} disabled={busy} />
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
    if (!r.ok) return toast(errText(r, t('error.backup.failed')))
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
    toast(t('settings.backup.toast.created'), { label: t('common.action.download.label'), onClick: download })
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
        return toast(errText(r, t('error.restore.intact')))
      }
      toast(t('settings.backup.toast.restored'))
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      // A large restore can outlive the connection even when it succeeds
      // server-side; reload rather than freeze on 'Applying…'.
      setTimeout(() => window.location.reload(), 1200)
    }
  }

  // The onboarding twin's own busy labels (App.jsx) — one upload, one word for
  // it, whichever screen you started it from.
  const busyLabel = phase === 'uploading' ? t('shell.restore.uploading.busy', { percent: pct }) : phase === 'restoring' ? t('common.action.apply.busy') : ''
  // What the chosen source will ask for, said before you commit to it — so the
  // prompt is never a surprise, and a file whose passphrase you do not have is
  // obvious before the upload starts.
  // An archive with no account named in its header used to read "asks for the
  // password ‘it’ had" — a pronoun assembled in code, standing in for a name that
  // is not there. It gets its own sentence now instead of a quoted 'it'.
  const asks =
    !target
      ? ''
      : target.key === 'passphrase'
        ? t('settings.backup.asks.passphrase')
        : target.key === 'password'
          ? target.recoverable
            ? t('settings.backup.asks.password')
            : target.account
              ? t('settings.backup.asks.password.named', { name: target.account })
              : t('settings.backup.asks.password.era')
          : target.key === 'unknown'
            ? t('settings.backup.asks.unknown')
            : t('settings.backup.asks.unkeyed')

  return (
    <Card data-tour="backup">
      <SectionTitle
        info={t('settings.backup.info.body')}
        infoTitle={t('settings.backup.title')}
      >
        {t('settings.backup.title')}
      </SectionTitle>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <GhostButton
            icon={<IconArchive />}
            keepLabel
            onClick={() => setAsking(true)}
            disabled={busy || phase !== 'idle'}
          >
            {busy ? t('settings.backup.now.busy') : t('settings.backup.now.label')}
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
              {t('settings.backup.download.label')}
            </a>
          )}
        </div>
        {loaded && (
          <p className="microcopy">
            {backup ? (
              // tNodes: the date is bold, so the sentence carries a node. fmtSize
              // renders MB/KB, which are symbols rather than words (§8) and stay.
              tNodes('settings.backup.last.prose', {
                when: <b key="when">{fmtWhen(backup.created)}</b>,
                size: fmtSize(backup.size),
              })
            ) : (
              t('settings.backup.empty.prose')
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
          <MonoLabel>{t('settings.backup.restore-from.label')}</MonoLabel>
          {/* One control, two sources. Choosing the source is the whole difference
              between what used to be two separate restore blocks. */}
          {/* The picker's own words are the onboarding twin's (shell.restore.*):
              it is one control rendered on two screens, and it should not read as
              two features. The stored values never move. */}
          <Toggle
            ariaLabel={t('shell.restore.source.aria')}
            value={source}
            onChange={setSource}
            options={[['server', t('shell.restore.source.server.label')], ['file', t('shell.restore.source.file.label')]]}
          />
          {/* Just what it will ask for. "the archive kept here" was the Toggle's
              own "This server" said again in different words, one line below it. */}
          {source === 'server' && (
            <p className="microcopy">{backup ? asks : t('settings.backup.server.empty.prose')}</p>
          )}
          {source === 'file' && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".tpbk,.tar.gz,.tgz,application/gzip,application/octet-stream"
                className="hidden"
                aria-label={t('shell.restore.file.aria')}
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
                  {t(file ? 'settings.backup.file.replace.label' : 'settings.backup.file.choose.label')}
                </GhostButton>
                <span className="microcopy">
                  {file
                    ? t('settings.backup.file.chosen.label', { name: file.name, size: fmtSize(file.size) })
                    : t('settings.backup.file.none.label')}
                </span>
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
              title={!target ? t(source === 'file' ? 'error.validate.backup-file-required' : 'error.validate.backup-absent') : undefined}
            >
              {t('settings.backup.restore.label')}
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
        <h2 style={{ fontFamily: 'var(--font-ui)', fontStyle: 'var(--font-ui-style)', fontVariantCaps: 'var(--font-ui-caps)', textTransform: 'var(--font-ui-case)', fontVariantNumeric: 'var(--font-ui-figures)', fontSize: 'var(--type-ui-17)', fontWeight: 600 }}>{children}</h2>
        {info && <InfoDot text={info} title={infoTitle || (typeof children === 'string' ? children : t('settings.card.info.title'))} />}
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
        fontSize: 'var(--type-mono-11)',
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
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-12)', color: 'var(--faint)', minWidth: 42 }}>
          {t('settings.type.size.format', { n: size })}
        </span>
      </div>
    </div>
  )
}

// The seven material sets, each drawn in what it is made of.
//
// WHAT THIS REPLACED, AND WHY IT IS NOT THE SAME CONTROL WITH MORE CARDS. There were
// four preset cards and they WERE the theme selector: each one set an aesthetic and a
// theme together, because an aesthetic carried its own palette and the two could not
// be chosen apart. Light/dark is its own control now, so these cards choose one thing.
//
// AND THEY ARE NOT DRAWN BY HAND. The old cards carried hardcoded §4 hexes — four
// copies of the palette, in a file that is not the palette — so a colour changed in
// theme.js stayed wrong here until somebody noticed. Every surface below comes from
// surfaceStyle(), the same function that dresses the app, so a specimen cannot drift
// from what choosing it does. That is also why there is no `spec` table any more:
// there is nothing left to tabulate that theme.js does not already know.
function MaterialCard({ name, dark, accentHex, code, selected, onClick }) {
  const accent = dark ? `color-mix(in oklab, ${accentHex}, white 20%)` : accentHex
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={t(MAT_SET_LABELS[name])}
      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
    >
      <div
        style={{
          ...surfaceStyle(name, 'shell', dark, accentHex),
          position: 'relative',
          height: 120,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--line)',
          borderRadius: '13px 10px 14px 9px / 9px 14px 10px 13px',
          padding: 10,
          boxShadow: selected ? `0 0 0 2px var(--card), 0 0 0 4px ${accent}` : 'none',
        }}
      >
        <div className="flex items-center justify-end" style={{ height: 12, marginBottom: 6 }} aria-hidden="true">
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-9)', letterSpacing: '.2em', color: 'color-mix(in srgb, var(--faint) 70%, transparent)' }}>
            {code} ▸
          </span>
        </div>
        <div
          style={{
            ...surfaceStyle(name, 'card', dark, accentHex),
            flex: 1,
            border: '1px solid var(--ink-border)',
            borderLeft: `3px solid ${accent}`,
            borderRadius: '10px 7px 11px 8px / 8px 11px 7px 10px',
            padding: '10px 11px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--font-display-weight)', fontVariantCaps: 'var(--font-display-caps)', textTransform: 'var(--font-display-case)', fontVariantNumeric: 'var(--font-display-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-12)', lineHeight: 1.35, color: 'var(--ink)' }}>
            {t('settings.appearance.preset.specimen.label')}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, display: 'block' }} />
            <span style={{ flex: 1, height: 4, borderRadius: 2, background: 'color-mix(in srgb, var(--ink) 22%, transparent)' }} />
          </div>
        </div>
        {selected && (
          <span
            aria-hidden="true"
            style={{ position: 'absolute', top: -9, right: -9, width: 22, height: 22, borderRadius: 999, background: accent, color: 'var(--on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--type-ui-12)', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,.45)' }}
          >
            ✓
          </span>
        )}
      </div>
      <p className="mt-2" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-9)', letterSpacing: '.14em', textTransform: 'uppercase', color: selected ? 'var(--accent-ui)' : 'var(--faint)' }}>
        {t(MAT_SET_LABELS[name])}
      </p>
    </button>
  )
}

const prefersDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

// Appearance — the theme presets, the accent, the two size sliders, the label
// density, and the door to Type.
//
// TYPE IS A POP-UP OFF THIS CARD (1.15.2), not a card in the column grid beside
// it. It belongs to this subject — the faces the app draws with — and it is not
// a control panel: it is eleven roles deep with a specimen apiece, and the
// settings page is read at a glance. A whole column standing permanently open
// for a choice most readers make once. So it becomes a button: a glyph and its
// words, which is what every other door in this app is.
//
// LANGUAGE MARKS USED TO BE THE SECOND DOOR HERE, on the argument that what a
// proverb WEARS is a matter of appearance. That reading is now overruled by the
// reader whose app it is, and their reading is better: the mark is how a quote
// with nobody to credit says what it IS, which is the same question the rest of
// the Metadata card answers. Where it is drawn is appearance; what it says is a
// fact about the quote. It is a door on Metadata now, unchanged apart from which
// card it hangs off.
function Appearance({ prefs, onPreferences }) {
  const [typeOpen, setTypeOpen] = useState(false)
  // Seed from the appearance actually applied (getResolvedTheme reads the concrete
  // material set off the DOM + the raw theme preference).
  //
  // THE THEME PREFERENCE IS NOW THE CONTROL'S OWN VALUE, and that deleted two pieces
  // of state. It used to be split into syncSystem + manualTheme because the four cards
  // chose light or dark and a separate toggle chose whether to obey them — so 'system'
  // had to be reassembled from two booleans on every save, and a card had to know
  // whether clicking it should also turn syncing off. One three-way control maps
  // 1:1 onto what is stored: light, dark, system.
  const applied = getResolvedTheme()
  const [materialSet, setMaterialSet] = useState(applied.materialSet)
  const [themePref, setThemePref] = useState(applied.theme)
  const [sysTheme, setSysTheme] = useState(prefersDark() ? 'dark' : 'light')
  const [accent, setAccent] = useState(applied.accent)
  const base = useFrameBase()

  // Track the OS theme live so the specimens follow it while set to match system.
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const m = matchMedia('(prefers-color-scheme: dark)')
    const fn = () => setSysTheme(m.matches ? 'dark' : 'light')
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])

  const effectiveDark = themePref === 'system' ? sysTheme === 'dark' : themePref === 'dark'

  // persist applies the change to the live DOM immediately (§4), lifts it to App so
  // the session user stays current, and PUTs it. Every field rides along so changing
  // one never resets another — a full-state save means a field left out is a field
  // cleared.
  function persist(next) {
    const s = { materialSet, theme: themePref, accent, ...next }
    setMaterialSet(s.materialSet)
    setThemePref(s.theme)
    setAccent(s.accent)
    applyTheme(s)
    onPreferences?.(s)
    json('PUT', '/auth/me/preferences', s)
  }

  return (
    <Card data-tour="appearance">
      <SectionTitle>{t('settings.appearance.title')}</SectionTitle>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonoLabel>{t('settings.appearance.theme.title')}</MonoLabel>
        <Toggle
          ariaLabel={t('settings.appearance.match.aria')}
          value={themePref}
          onChange={(v) => persist({ theme: v })}
          options={[
            ['light', t('settings.appearance.theme.light.label')],
            ['dark', t('settings.appearance.theme.dark.label')],
            ['system', t('settings.appearance.match.label')],
          ]}
        />
      </div>
      <MonoLabel className="mb-2 block">{t('settings.appearance.material.title')}</MonoLabel>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        {Object.keys(MAT_SETS).map((name, i) => (
          <MaterialCard
            key={name}
            name={name}
            dark={effectiveDark}
            accentHex={ACCENTS[accent]}
            code={frameCode(base, i)}
            selected={name === materialSet}
            onClick={() => persist({ materialSet: name })}
          />
        ))}
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
        {/* THE GLOBAL TEXT SIZE, beside the two cover sliders because it is the
            same kind of control — how big the thing you are looking at is — and
            because "in appearance section itself" is where it was asked for.

            IT RENORMALISES RATHER THAN MULTIPLYING (type.js): moving it writes
            itself into all four kinds of text, so 150% means every kind is at
            150%. Tune one in Type afterwards and this reads as an em dash, which
            is the honest answer — there is no longer a single number that
            describes the four. It is derived from them and never stored, so the
            two panels cannot disagree about the size. */}
        <TextSizeField prefs={prefs} onPreferences={onPreferences} />
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

      {/* The door, and it KEEPS ITS WORDS at every width.

          Button labels normally lets a glyphed button drop its text on a phone,
          and the buttons that opt out are named ones: primary submits and
          destructive confirms. This is a third case with the same shape. A card
          action that loses its words still sits on a card full of context, and
          the reader can afford to guess; this is the ONLY way into a whole
          settings panel, so a bare letterform is not a button whose meaning is
          merely unlabelled — it is a screen nobody finds. It was a headed card
          until 1.15.2, which is the standard being kept. Metadata's door to
          Language marks is the same case and does the same thing.

          The tooltip says something the label does not, which is the only reason
          to carry both. */}
      <div className="mt-7 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <Tooltip label={t('settings.type.open.tip')}>
          <GhostButton icon={<IconType />} keepLabel onClick={() => setTypeOpen(true)}>{t('settings.type.title')}</GhostButton>
        </Tooltip>
      </div>

      {/* No form registers with this dialog, so it grows no ✓: the panel saves on
          the tap, as it did as a card. The close is the only action. */}
      <FormModal open={typeOpen} onClose={() => setTypeOpen(false)} title={t('settings.type.title')} maxWidth={620}>
        <TypeSettings prefs={prefs} onSaved={onPreferences} />
      </FormModal>
    </Card>
  )
}

// TextSizeField — the global dial, in the shape of the fields around it.
//
// It writes the same four preference fields the Type panel's four dials write, so
// there is exactly one place the size lives. Applied before the request, like every
// other control on this card: a round trip between the tap and the type is long
// enough to make a size control feel broken.
function TextSizeField({ prefs, onPreferences }) {
  const factors = factorsFrom(prefs)
  const current = globalOf(factors)

  async function set(n) {
    const patch = renormalise(n)
    applyTypeScale({ ...(prefs || {}), ...patch })
    const r = await json('PUT', '/auth/me/preferences', patch)
    if (!r.ok) {
      applyTypeScale(prefs || {})
      return
    }
    onPreferences?.(patch)
  }

  return (
    <div>
      <MonoLabel className="mb-1.5 flex items-center gap-1">
        {t('settings.appearance.text-size.label')}
        <InfoDot text={t('settings.appearance.text-size.info.body')} title={t('settings.appearance.text-size.label')} />
      </MonoLabel>
      <SizeDial
        value={current}
        ariaLabel={t('settings.appearance.text-size.label')}
        onChange={set}
        width={124}
      />
    </div>
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
//
// `label` ARRIVES WHOLE AND IS NEVER RESHAPED HERE. The three aria-labels used
// to be built out of it in code — `Add a ${label.toLowerCase()}` — which is an
// English sentence assembled from two pieces: not translatable, and not even
// right in English once IGDB arrived ("a IGDB client id"). Each frame is its own
// key now and the name goes into it unaltered.
// NEED_TONE maps a row's consequence to the chip palette. `bundled` is 'active'
// and not 'ok' on purpose: it is a live fact about what is answering right now,
// the same tone the built-in chips beside the heading already use.
const NEED_TONE = { bundled: 'active', required: 'error', optional: 'muted', closed: 'muted' }

// LITERAL KEYS IN A MAP, never t('prefix.' + x + '.label'). locale-complete.test.js
// verifies statically that every key the code asks for exists and that every key
// in en.txt is asked for, and a key assembled at runtime defeats both halves: the
// scan reads the prefix as a missing key and the four real ones as orphans. Same
// shape as SOURCE_KEYS in CoverPicker.jsx, for the same reason.
const NEED_LABEL = {
  bundled: 'settings.keys.need.bundled.label',
  required: 'settings.keys.need.required.label',
  optional: 'settings.keys.need.optional.label',
  closed: 'settings.keys.need.closed.label',
}

function KeyField({ label, hint, set, placeholder, secret = true, value = '', onSave, busy, need }) {
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
        {/* WHAT FILLING THIS IN ACTUALLY BUYS, said before the reader goes and
            registers for anything.

            The card listed nine credential fields in one flat run and told you
            nothing about which of them you NEED. Two of them ship with the app and
            a key there only replaces what is already working; one pair is the
            difference between games working and not; the rest are optional
            improvements to something that already answers. A reader looking at
            that list reasonably concludes the app needs nine API registrations
            before it is useful, and most of them are not obtainable in five
            minutes.

            So each row says which it is, in one word, before the label's own
            tooltip has to be opened. The wording is about CONSEQUENCE and not
            about status — "built in" rather than "configured" — because the
            question being answered is "must I do something about this". */}
        {need && (
          <StatusChip tone={NEED_TONE[need]}>{t(NEED_LABEL[need])}</StatusChip>
        )}
        {hint && <InfoDot text={hint} title={label} />}
        {!secret && !editing && (
          <span className={'inline-field-inline' + (value ? '' : ' is-empty')}>{value || t('settings.keys.unset.label')}</span>
        )}
        <span className="flex-1" />
        {saved && !editing && (
          <Tooltip label={t('settings.keys.saved.tip')}>
            <span className="field-badge" role="img" aria-label={t('settings.keys.saved.aria', { name: label })}>
              <IconSaved />
            </span>
          </Tooltip>
        )}
        {!editing ? (
          <FieldIconButton
            icon={<IconEdit />}
            ariaLabel={t(set ? 'settings.keys.replace.aria' : 'settings.keys.add.aria', { name: label })}
            onClick={() => setEditing(true)}
          />
        ) : (
          <>
            <FieldIconButton
              icon={<IconCheck />}
              ariaLabel={t('common.action.save.field.aria', { field: label })}
              disabled={busy}
              onClick={commit}
              tooltip={draft.trim() ? t('common.action.save.label') : t('settings.keys.save.blank.tip')}
              ok
            />
            <FieldIconButton
              icon={<IconClose />}
              ariaLabel={t('common.action.cancel.label')}
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

// keyLabel composes a field's name out of the supplier and the noun beside it:
// "Google Books key", "IGDB client id", "Amazon domain". The supplier names are
// PROPER NOUNS and already live in vocab.source.*, so seven hardcoded labels
// would be seven more copies of a word the app spells in a dozen other places.
// Called during render, never at module scope.
const keyLabel = (source, noun) =>
  t('settings.keys.field.label', {
    source: t(`vocab.source.${source}.label`),
    noun: t(`settings.keys.noun.${noun}`),
  })

function Metadata({ user, onPreferences }) {
  const admin = user.is_admin
  const [marksOpen, setMarksOpen] = useState(false)
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
  // Tone, then the KEY that names it — resolved where the chip is drawn.
  const booksChip = lookup?.ok === false ? ['error', 'settings.metadata.books.failing.label'] : null
  // A CHIP ONLY WHERE THE KEY FIELDS CANNOT ANSWER. "Custom key" beside TMDB
  // said exactly what the saved badge on the TMDB field says one line below it,
  // and "No key (optional)" beside TheTVDB said nothing at all — an optional key
  // you have not set is the ordinary state of the app, not a status worth a pill.
  // What survives is the pair a key field genuinely cannot report: that lookups
  // are running on the shared built-in key even though you have set nothing, and
  // that they are running on nothing at all and will 503.
  const tmdbChip =
    source === 'builtin' ? ['active', 'settings.metadata.tmdb.builtin.label']
      : source === 'none' ? ['error', 'settings.metadata.tmdb.none.label']
        : null
  // THE SAME FACT ABOUT THE DEFAULT SOURCE. TheTVDB has a built-in slot too now,
  // and "you have set nothing and lookups are running anyway" is precisely the
  // thing a key field cannot report. There is no `none` chip beside it: an unset
  // optional key is the ordinary state of a self-built binary, not a fault — the
  // TMDB chip already says when there is nothing at all to look in.
  const tvdbChip =
    status?.tvdb?.source === 'builtin' ? ['active', 'settings.metadata.tvdb.builtin.label'] : null

  // THE ONE-TIME NOTICE THAT THE DEFAULT FILM SOURCE MOVED (2.2.0), and it earns
  // a chip under this section's own rule — "a chip here means something to act
  // on" — because there is a specific action: re-verify those titles and their
  // cast gains a picture per character, which is the whole reason the default
  // moved to TheTVDB.
  //
  // The server decides whether it applies, not this component. It is shown only
  // to an instance that EXISTED before the change (a one-time pass wrote the
  // marker) and only while that reader still has titles pinned to TMDB alone — so
  // it clears itself as they work through them and needs no dismiss button, and no
  // stored dismissal to go stale. A fresh install never sees it at all, because a
  // notice about a change you never lived through is a sentence the app made up.
  const moved = status?.film_source_notice
  const filmSourceChip = moved
    ? ['active', 'settings.metadata.filmsource.moved.label', { n: moved.tmdb_pinned }]
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
      setError(errText(r, t('error.save.generic')))
      return false
    }
    await Promise.all([loadStatus(), loadKeys()])
    toast(value.trim() ? t('common.toast.saved') : t('settings.keys.toast.cleared'))
    return true
  }

  return (
    <Card data-tour="metadata-keys">
      <SectionTitle info={t('settings.metadata.info.body')}>
        {t('settings.metadata.title')}
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
      {(booksChip || tmdbChip || tvdbChip || filmSourceChip) && (
        <div className="flex flex-wrap items-center gap-2">
          {booksChip && <StatusChip tone={booksChip[0]}>{t(booksChip[1])}</StatusChip>}
          {tvdbChip && <StatusChip tone={tvdbChip[0]}>{t(tvdbChip[1])}</StatusChip>}
          {tmdbChip && <StatusChip tone={tmdbChip[0]}>{t(tmdbChip[1])}</StatusChip>}
          {filmSourceChip && <StatusChip tone={filmSourceChip[0]}>{t(filmSourceChip[1], filmSourceChip[2])}</StatusChip>}
        </div>
      )}
      {/* The chip says how many; this says what to do about them. Same shape as
          the lookup error below it, and for the same reason: a count with no
          instruction is a number somebody has to come and ask about. */}
      {filmSourceChip && (
        <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)' }}>
          {t('settings.metadata.filmsource.moved.prose')}
        </p>
      )}
      {lookup?.ok === false && lookup.error && (
        <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-11)', color: 'var(--error)' }}>
          {t('settings.metadata.last-error.prose', { error: lookup.error })}
        </p>
      )}

      {/* One flat list. Every field says which service it is for, so grouping
          them added a heading and two rows of air per group and no meaning. */}
      {admin && (
        <div className="mt-3">
          <KeyField
            label={keyLabel('google', 'key')}
            hint={t('settings.keys.google.hint')}
              need="optional"
            set={keys?.google_books_key_set}
            placeholder={t('settings.keys.google.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('google_books_key', v)}
          />
          <KeyField
            label={keyLabel('tmdb', 'key')}
            hint={t('settings.keys.tmdb.hint')}
              need={keys?.tmdb_builtin ? 'bundled' : 'required'}
            set={keys?.tmdb_key_set}
            placeholder={t('settings.keys.tmdb.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('tmdb_key', v)}
          />
          {/* THE KEY FIRST AND THE PIN UNDER IT, which is both the order they
              are needed in and the order the copy has always claimed.

              THE PIN WAS ON TOP, so the first TheTVDB thing on the card was a
              SUBSCRIBER PIN — and the reader's reasonable conclusion is that
              TheTVDB wants a subscription. It does not: a project key, which is
              the kind bundled with the app and the kind Jellyfin ships,
              authenticates on its own and never sends a pin at all (see login()
              in tvdb.go, which omits the field when it is empty). Only the free
              user-supported key needs one.

              The hint on the key row said "the PIN below" while the PIN sat
              above it, so the copy was already describing this arrangement and
              the fields were the thing that was wrong. */}
          <KeyField
            label={keyLabel('tvdb', 'key')}
            hint={t('settings.keys.tvdb.hint')}
              need={keys?.tvdb_builtin ? 'bundled' : 'required'}
            set={keys?.tvdb_key_set}
            placeholder={t('settings.keys.tvdb.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('tvdb_key', v)}
          />
          <KeyField
            label={keyLabel('tvdb', 'pin')}
            hint={t('settings.keys.tvdb-pin.hint')}
              need="optional"
            set={keys?.tvdb_pin_set}
            placeholder={t('settings.keys.tvdb-pin.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('tvdb_pin', v)}
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
            label={keyLabel('igdb', 'client-id')}
            hint={t('settings.keys.igdb-id.hint')}
              need="required"
            set={keys?.igdb_client_id_set}
            placeholder={t('settings.keys.igdb-id.placeholder')}
            busy={saving}
            onSave={(v) => saveKey('igdb_client_id', v)}
          />
          <KeyField
            label={keyLabel('igdb', 'secret')}
            hint={t('settings.keys.igdb-secret.hint')}
              need="required"
            set={keys?.igdb_secret_set}
            placeholder={t('settings.keys.igdb-secret.placeholder')}
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
              {t('settings.metadata.igdb.half.prose', {
                half: t(keys.igdb_client_id_set ? 'settings.keys.noun.secret' : 'settings.keys.noun.client-id'),
              })}
            </p>
          )}
        </div>
      )}

      {/* Amazon (advanced): cover-by-ASIN needs nothing; the optional cookie
          adds description/genres by scraping the product page. */}
      {admin && (
        <div>
          <div>
            {/* .caveat, NOT .hint, and deliberately: this one runs to 440
                characters and the 240-character dot budget measures .hint in both
                languages. It is a security warning with a procedure in it —
                fragile, against Amazon's terms, grants account access, and here
                is where the header is — and none of those clauses can be dropped
                to fit a cap. So it is named for what it is. */}
            <KeyField
              label={keyLabel('amazon', 'cookie')}
              hint={t('settings.keys.amazon-cookie.caveat')}
              need="optional"
              set={keys?.amazon_cookie_set}
              placeholder={t('settings.keys.amazon-cookie.placeholder')}
              busy={saving}
              onSave={(v) => saveKey('amazon_cookie', v)}
            />
            {/* GOOGLE'S PROGRAMMABLE SEARCH PAIR STOOD HERE. Google closed that
                API to new customers and retires it on 1 January 2027, so the two
                fields asked readers to register for something they could not get
                and would then lose. What is left of Google is the toggle below,
                which needs no credential at all — which is why it is a setting
                rather than a key, and why it sits under Amazon's cookie beside
                the other thing the reader has to agree to rather than obtain. */}
            {/* THE SCRAPE'S OPT-IN, and the only control on this card that is
                not a credential.

                Every other switch here is implicit in a secret: you cannot use
                the Amazon scrape without storing the cookie that says you meant
                to, so the key field IS the consent. Scraping Google's image
                results needs nothing at all, which leaves the consent with
                nowhere to live — hence a setting, and hence a control, because a
                setting with no control is a feature nobody can reach.

                It sits under the Programmable Search pair because it is the same
                index read a worse way, and anybody who fills in the two fields
                above never reaches it. */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5">
                <MonoLabel>{t('settings.keys.google-scrape.title')}</MonoLabel>
                <InfoDot text={t('settings.keys.google-scrape.info.body')} />
              </div>
              <Toggle
                ariaLabel={t('settings.keys.google-scrape.aria')}
                value={keys?.google_scrape ? 'on' : 'off'}
                onChange={async (v) => {
                  setSaving(true)
                  setError('')
                  const r = await json('PUT', '/admin/metadata-keys', { google_scrape: v === 'on' })
                  setSaving(false)
                  if (!r.ok) { setError(errText(r, t('error.save.generic'))); return }
                  await Promise.all([loadStatus(), loadKeys()])
                  toast(t('common.toast.saved'))
                }}
                options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
              />
            </div>
            <KeyField
              label={keyLabel('amazon', 'domain')}
              hint={t('settings.keys.amazon-domain.hint')}
              need="optional"
              secret={false}
              value={keys?.amazon_domain || ''}
              set={!!keys?.amazon_domain}
              placeholder={t('settings.keys.amazon-domain.placeholder')}
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

      {/* And the door to Language marks, which hung off Appearance from 1.15.2
          until the reader moved it here.

          WHY IT BELONGS ON THIS CARD. Everything above is about where the facts
          about a work come from and what they are called. A language mark is the
          same kind of fact: a proverb has nobody to credit, so its card leads
          with its LANGUAGE, and the mark is that language's stand-in. Appearance
          decides how the app looks; this decides what a quote says about itself.
          The old argument — that what a proverb wears is a matter of appearance —
          was about the drawing rather than the datum.

          Still a door rather than a section, for the reason 1.15.2 gave: it is a
          row per language with a tray behind each, and standing that open on a
          page read at a glance is a column spent on a choice made once. Two
          sections deep on one card would also read as part of the credit
          separators above it, which it is not. */}
      <div className="mt-7 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <Tooltip label={t('settings.languages.open.tip')}>
          <GhostButton icon={<IconLanguages />} keepLabel onClick={() => setMarksOpen(true)}>{t('settings.languages.title')}</GhostButton>
        </Tooltip>
      </div>
      <FormModal open={marksOpen} onClose={() => setMarksOpen(false)} title={t('settings.languages.title')} maxWidth={560}>
        <LanguageMarksSettings prefs={user.preferences} onSaved={onPreferences} />
      </FormModal>
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

