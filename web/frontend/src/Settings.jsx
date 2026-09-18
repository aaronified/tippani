import { useEffect, useRef, useState } from 'react'
import { DEMO, json, errText, copyText, apiURL, upload as uploadFile, uploadWithProgress } from './api.js'
import { ACCENTS, GROUNDS, PHYS, paletteFor, parseTweaks, physDirty, physFor, applyColors, applyContrast, applyLabels, applyTheme, CAT_NAME_MAX, CATEGORY_PALETTE, categoryState, contrastPrefValue, getResolvedTheme, LABELS_KEY, labelsPref, MAT_SET_LABELS, MAT_SETS, surfaceStyle, UNSET_LABEL } from './theme.js'
import { QUOTE_LEADINGS, QUOTE_MEASURES, SIZE_ROLES, TYPE_FACTORS, applyTypeScale, clampLeading, clampMeasure, factorsFrom, globalOf, renormalise, sizePrefKey } from './type.js'
import {
  applyFonts,
  faceFor,
  fontPatch,
  fontStateFor,
  registerUploads,
  serialiseFontStyles,
  stylesFor,
  uploadedFonts,
  verifyUpload,
} from './fonts.js'
import { FaceSelect } from './fontPicker.jsx'
import PREF_DEFAULTS from './prefDefaults.json'
import { PrefGroup, PrefRow } from './prefRow.jsx'
import { glassDialsFor } from './glassLens.js'
import { applyFields, fromFile, parseSaved, removeTheme, SAVED_THEME_CAP, saveTheme, toFile } from './savedThemes.js'
import { SECTIONS, sectionOrder, visibleSections } from './routes.js'
import { RESTART_FAILED, RESTART_NEW, RESTART_SAME, waitForRestart } from './update.js'
import { LanguagePicker } from './locale.jsx'
import { languageMarksState } from './languages.jsx'
import { lockedOff, parseQuestions, parseTuning, questionsBlob, questionsFor, REVIEW_DECKS, REVIEW_TIERS, taxonomy, toggle as toggleQuestion, TUNING_FIELDS, tuningBlob, tuningProblem } from './quiz.js'
import { createPortal } from 'react-dom'
import { fullKeys, localeActive, localeCatalogue, t, tNodes } from './i18n.js'
import { PASSPHRASE_MAX, PASSPHRASE_MIN, PASSWORD_MAX, passphraseProblem, sniffArchiveKey } from './secret.js'
import {
  ariaLabelText,
  backdropClose,
  Card,
  ChipSwitches,
  CloseButton,
  ErrorText,
  FieldIconButton,
  formatPartialDate,
  FormModal,
  frameCode,
  ConfirmDialog,
  GhostButton,
  IconArchive,
  IconArrow,
  IconBookmark,
  IconCheck,
  IconChevron,
  IconClose,
  IconCopy,
  IconDelete,
  IconDevice,
  IconExport,
  IconEye,
  IconEyeOff,
  IconKey,
  IconOpen,
  IconLanguages,
  IconMoveTo,
  IconPalette,
  IconQuiz,
  IconRefresh,
  IconRestore,
  IconRevert,
  IconSliders,
  IconTour,
  IconType,
  FilePick,
  IconUpload,
  InfoDot,
  isPartialDate,
  MobileSheet,
  MonoLabel,
  PageHeader,
  SCRIM_CENTERED,
  SectionTitle,
  Select,
  Slider,
  StickerButton,
  toast,
  Toggle,
  Tooltip,
  useBackToClose,
  useBodyScrollLock,
  useConfirm,
  useCoverSize,
  useFrameBase,
  useFilePick,
  useIsMobileScreen,
  useScreenBar,
  useScreenSearch,
  usePersistedState,
} from './ui.jsx'
import { SectionRail } from './sectionRail.jsx'

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
// ONBOARDING IS NOT IN THIS LIST EITHER, and for a different reason from Devices.
// The owner: "no need for a global onboarding settings". The walkthrough did not go
// away — it moved to where a reader asks for it, which is the "?" on the screen that
// confused them, one screen's worth at a time. A card replaying the whole tour from
// Settings was a door to the app's least-wanted journey, six cards down a scroll.
// `OnboardingCard` is deleted rather than unregistered: unlike Devices, nothing is
// coming back for it — Help's own button is a replacement, not a relocation.
//
// DEVICES IS NOT IN THIS LIST AND ITS CARD IS STILL IN THIS FILE. The owner: "hide
// the devices settings. that was created for the app. not required right now (keep
// the code and the backend, just no need to let it hog the screen space)." So the
// card stops being registered and stops taking a column slot; `DevicesCard` below,
// its strings, and every `/auth/devices` route are untouched, and putting it back is
// this one word. Registering it is what draws it — the same mechanism that leaves a
// non-admin without Updates and Backup.
// 'trash' AND 'clean' LEFT THIS LIST, AND THEY LEFT THE PAGE LONG AGO. The note
// above still explains why the bin and stray-marks TILES were removed; the two ids
// stayed behind in this list and in the layout below, naming cards the `cards` object
// has not built since. Harmless, because `settingsColumns` places only what is
// present — and so invisible, which is why they outlived the tiles by several
// releases. Found by the scanner that pairs this list against the search prefixes:
// two ids with nowhere to look them up.
// 'colors' LEFT THIS LIST FOR THE METADATA CONSOLE. A colour category says what
// KIND of note a quote is, which is a fact about the library rather than a
// preference about the app — the same reason the language table and the tags are
// over there. The card itself is unchanged and is exported from this file.
export const SETTINGS_CARDS = ['features', 'sr', 'upd', 'backup']

// ---- THE FIVE SECTIONS ------------------------------------------------------
//
// Settings was one scrolling grid of cards and the v3 pack makes it five named
// screens behind a rail. The reason is not tidiness: the page had grown to where
// the only way to find a preference was to scroll past every other one, and the
// pack's own note for it is that a setting you cannot find is a setting you do
// not have.
//
// THE RAIL IS `sectionRail.jsx`, WHICH METADATA ALSO DRAWS. One control, one
// behaviour, per the repo's directive — tabs across a desk, a field on a phone.
//
// THE CARDS ARE NOT REWRITTEN TO GET HERE, and that is deliberate. Every control
// on this page keeps working exactly as it did; what changed is which screen it
// is on. Decomposing a card into the pack's row grammar is worth doing and is
// worth doing one section at a time, with the page working in between — a
// rewrite of five cards and a shell in one step is a page nobody can bisect.
//
// `id` is a route-stable key: it is in the URL and in a bookmark, so renaming one
// breaks somebody's link. The LABEL is a locale key and may be renamed freely.
export const SETTINGS_SECTIONS = [
  ['theme', 'settings.section.theme.label', 'palette'],
  ['lang', 'settings.section.lang.label', 'languages'],
  ['review', 'settings.section.review.label', 'quiz'],
  ['sections', 'settings.section.sections.label', 'move'],
  ['server', 'settings.section.server.label', 'device'],
]

// What each section's info dot says. Derived from the id rather than kept as a
// sixth column, because a column that is `'settings.section.' + id + '.info.body'`
// for every row is a rule, not data — and a rule typed five times is five chances
// to typo one of them into a key that resolves to nothing.
export const sectionInfoKey = (id) => `settings.section.${id}.info.body`

// Which cards each section draws, in order. A card named here that the `cards`
// object has not built — Updates and Backup for a non-admin — simply does not
// appear, exactly as the column layout already behaved.
// The rail's glyphs, resolved here rather than held as JSX in SETTINGS_SECTIONS:
// that table is a plain data table a test can read, and an element in it would
// make it a render.
export const SECTION_GLYPH = {
  palette: <IconPalette />,
  languages: <IconLanguages />,
  quiz: <IconQuiz />,
  move: <IconMoveTo />,
  device: <IconDevice />,
}

export const SECTION_CARDS = {
  theme: ['appearance'],
  lang: ['language'],
  review: ['sr'],
  sections: ['features'],
  server: ['upd', 'backup'],
}

// ── WHICH PREFERENCES EACH SECTION OWNS, and why this table exists at all.
//
// THE PACK PUTS A NUMBER ON EVERY TAB — "3 changed" — and a tab you are not
// standing on draws no rows, so the count cannot be collected from what rendered.
// It has to be computable from the stored preferences alone, which means knowing
// which keys belong to which section.
//
// CHANGED MEANS SET, NOT DIFFERENT. A preference the reader has never touched is
// ABSENT from the object the server sends; every card in this file reads its value
// as `p.srDaily || 8`, with the default written at the point of use. Counting
// "present" rather than "differs from default" therefore needs no second copy of
// those defaults — and a second copy is exactly the thing that goes stale and
// makes the badge state a number nobody can account for. The cost is that setting
// a value back to its default still counts as changed, which is defensible: the
// reader did go and set it.
//
// EVERY SERVER-STORED KEY IS NAMED HERE OR EXCLUDED BY NAME. `settings-prefs.test.js`
// reads the Go struct and fails when a key is in neither list, so a preference
// added later cannot quietly stop being counted.
export const SECTION_PREFS = {
  theme: [
    'theme', 'accent', 'contrast', 'materialSet',
    'groundLight', 'groundDark', 'texTweak', 'trueGlass', 'savedThemes',
    'tileGround', 'tileShell', 'tileCard', 'tileCover',
    'quoteLeading', 'quoteMeasure',
  ],
  lang: [
    'locale', 'localeFallback', 'textOrder', 'readLanguages', 'languageMarks',
    'fontsByLanguage', 'fontsByLocale',
    'fontDisplay', 'fontUi', 'fontMono', 'fontHand', 'fontBengali', 'fontDevanagari',
    'fontDisplayStyle', 'fontUiStyle', 'fontMonoStyle', 'fontHandStyle',
    'fontBengaliStyle', 'fontDevanagariStyle',
    'sizeDisplay', 'sizeUi', 'sizeMono', 'sizeHand',
  ],
  review: [
    'srDaily', 'srReviewScope', 'srQuestions', 'srTuning', 'srSeen',
    'srPracticeCounts', 'srLadder', 'srTier', 'srStart', 'srSubmit',
  ],
  sections: [
    'hideLibrary', 'hideCatalogue', 'hideQuotes', 'showAnthologies', 'sectionOrder',
  ],
  server: ['trashDays'],
}

// NOT A SETTING A READER CHOSE, so not counted anywhere. Each of these is stored
// on the same object and belongs to something other than a settings row:
//
// - `tour`/`tourStep` are where a reader got to in a tour, which is progress.
// - `defaultBoardId` is chosen on the board, not here.
// - `creditSeparators` is a Metadata-screen decision about how credits are written.
// - the `cat*` triples are the colour categories, which left Settings for the
//   Metadata console — counting them under Theme would put a number on a tab that
//   has nothing to do with the screen the reader changed them on.
export const UNCOUNTED_PREFS = [
  'tour', 'tourStep', 'defaultBoardId', 'creditSeparators',
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`catName${n}`, `catColor${n}`, `catHidden${n}`]),
]

// changedIn — how many of a section's preferences the reader has set. Pure, so it
// is checkable without mounting a screen, which is the half of this a render can
// never prove.
export function changedIn(prefs, section) {
  const keys = SECTION_PREFS[section] || []
  return keys.filter((k) => {
    const v = (prefs || {})[k]
    // A PREFERENCE HAS A DEFAULT WHERE THE SERVER GIVES IT ONE, and for the rest
    // the default is the zero value it marshals.
    //
    // THIS WAS WRONG TWICE AND EACH VERSION LOOKED RIGHT. The first counted any
    // value present; only two of the Go struct's seventy-four fields carry
    // `omitempty`, so every untouched preference arrives as `""`, `0` or `false`
    // and a fresh account read "7 changed". The second stopped counting those, and
    // a fresh account still read "4 changed" per section — because `loadPrefs`
    // FILLS DEFAULTS IN ON READ, so what reaches the browser for a reader who has
    // never opened Settings is `theme: "system"`, `accent: "terracotta"`,
    // `srDaily: 8`. The fact "they never set this" is destroyed on the server, on
    // purpose, because every other consumer wants the effective value.
    //
    // SO THE DEFAULTS COME BACK AS DATA. `prefDefaults.json` holds the ones
    // loadPrefs applies, and `pref_defaults_test.go` in the Go package reads that
    // same file and fails the moment the two disagree — in either direction,
    // including a field that starts being defaulted and has no entry here. Two
    // copies of one fact that cannot be collapsed (Go cannot import a React module
    // and a browser cannot call loadPrefs), so the next best thing is a test that
    // will not let them drift.
    //
    // NEITHER SCREEN NOR SUITE CAUGHT EITHER VERSION. A capture did, both times.
    if (k in PREF_DEFAULTS) return v !== undefined && v !== null && v !== PREF_DEFAULTS[k]
    return !(v === undefined || v === null || v === '' || v === '{}' || v === '[]' || v === false || v === 0)
  }).length
}

// sectionPill — the number as the reader reads it. "all default" rather than
// "0 changed", because a zero invites you to look for the nine things that are not
// zero, and what the reader wants to know is that there is nothing here to undo.
export function sectionPill(n) {
  return n > 0 ? t('settings.changed.count', { n }) : t('settings.changed.none')
}

// Which section a card lives in, derived rather than kept beside SECTION_CARDS:
// two lists that have to agree is the shape this repo keeps having to pull apart.
export function sectionOfCard(cardKey) {
  for (const [sec, keys] of Object.entries(SECTION_CARDS)) {
    if (keys.includes(cardKey)) return sec
  }
  return null
}

// SETTINGS_LAYOUT AND settingsColumns ARE GONE, and what replaced them is
// SECTION_CARDS above. They answered "which of nine cards does a reader scroll
// past first" — a per-column-count table, plus a paragraph of rendered card
// heights defending the balance, all in service of one long page. The page is
// five named sections now and each draws its own cards in one column, so there is
// no packing left to decide. Deleted rather than left unregistered: unlike the
// Devices card, nothing is coming back for it.

// ---- searching Settings from the shell's own field --------------------------
//
// THE OWNER NAMED THIS SCREEN: "in metadata, it will search in metadata, in settings
// it will search within settings as well. it should behave like an omnibar." So the
// bar's field narrows this page as it is typed, and the words it matches are the
// card's OWN words.
//
// DERIVED FROM THE CATALOGUE, NOT A LIST KEPT BESIDE IT. The obvious shape is a map
// of card id -> search terms, and it is the shape this repo keeps writing warnings
// about: it agrees with the screen on the day it is written and drifts on the next
// rename, silently, because nothing renders it. Every string a card can draw already
// lives under that card's own prefix, so the prefix IS the term list — rename a
// label and the search follows it, add a control and the search finds it, with
// nothing to keep in step.
//
// `.title` AND `.label` ONLY, which is the difference between searching an interface
// and searching its prose. The explanatory paragraphs under these headings are where
// most of the words on this page are; matching them would find "backup" on four
// cards that merely mention it, and a filter that returns most of the page has told
// the reader nothing.
const SETTINGS_PREFIX = {
  appearance: 'settings.appearance.',
  features: 'settings.features.',
  sr: 'settings.quiz.',
  upd: 'settings.updates.',
  backup: 'settings.backup.',
}

// settingsMatches — does this card answer to what was typed?
//
// EXPORTED AND PURE, because it is the one part of this that is a function rather
// than a screen: given a card and a query it either matches or it does not, and that
// is checkable without mounting Settings at all.
export function settingsMatches(cardKey, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const prefix = SETTINGS_PREFIX[cardKey]
  if (!prefix) return false
  for (const key of fullKeys()) {
    if (!key.startsWith(prefix)) continue
    if (!key.endsWith('.title') && !key.endsWith('.label')) continue
    if (t(key).toLowerCase().includes(q)) return true
  }
  return false
}

export default function Settings({ user, onPreferences, update, onUpdateInfo }) {
  const mobile = useIsMobileScreen()
  const ncols = useColumnCount()
  // ── THE PHONE'S TWO SEATS, and they are the two verbs on this page.
  //
  // Everything else in Settings is a preference — you change it where it is
  // drawn, and a dock key pointing at a toggle would be a door to a switch. These
  // two are ACTS: make an archive now, install the release now. Both live in
  // admin-only cards six cards down a scroll on a phone, which is the distance
  // this pair closes.
  //
  // THE KEY DOES NOT SKIP THE DECISION. Backup still asks for the credential that
  // seals the archive and the update still asks for the word UPDATE typed out —
  // a one-tap update on a phone is precisely the accident that confirmation
  // exists to prevent. What the key skips is the scrolling.
  // WHICH SECTION YOU WERE ON, KEPT. Metadata's rail does the same: a settings
  // screen is somewhere you come back to, usually for the thing you were last
  // looking at, and landing on Theme every time is a scroll the rail was supposed
  // to have removed.
  const [section, setSection] = usePersistedState('tippani:settings:section', 'theme')
  const [backupNow, setBackupNow] = useState(false)
  const [updateNow, setUpdateNow] = useState(false)
  // WHAT THE SHELL'S FIELD IS ASKING ABOUT WHILE THIS SCREEN IS UP.
  const [q, setQ] = useState('')
  useScreenSearch({ key: 'settings', label: t('shell.search.where.settings'), onQuery: setQ })
  useScreenBar({
    // WHO YOU ARE, UNDER THE WORD "SETTINGS". It was a mono label inside
    // .page-header, and on a phone that header has its <h1> visually hidden —
    // so "admin" became the only thing left in it and took a whole sticky row to
    // say one word. The shell's own bar already draws the screen's name with a
    // sub-line under it, which is where a caption for a title belongs.
    sub: mobile ? (user.is_admin ? t('account.users.admin.chip') : user.username) : null,
    keys: mobile && user.is_admin ? [
      { id: 'backup', label: t('settings.backup.now.label'), icon: <IconArchive />, onClick: () => setBackupNow(true) },
      { id: 'update', label: t('settings.updates.now.label'), icon: <IconRefresh />, onClick: () => setUpdateNow(true) },
    ] : null,
  })
  const cards = {
    features: <FeaturesCard prefs={user.preferences} onSaved={onPreferences} />,
    sr: <SRSettings user={user} onPreferences={onPreferences} />,
    // THE BIN AND STRAY-MARKS TILES ARE GONE FROM HERE. Both were doors and
    // nothing else — a count, a state, and a button to a page that already showed
    // both. The rail and the ☰ menu now carry a counted row to each (stray marks
    // as half of Checks), which is a door visible from every screen rather than
    // one you have to remember lives in Settings. A tile that restates a page's
    // own summary is a second copy to keep in step, and this pair had already
    // drifted: the tile counted /cleanup's open bucket while the page counted
    // whichever bucket you last looked at.
    ...(user.is_admin
      ? {
          upd: <UpdatesCard user={user} update={update} onUpdateInfo={onUpdateInfo} asking={updateNow} onAsking={setUpdateNow} />,
          backup: <BackupCard user={user} asking={backupNow} onAsking={setBackupNow} />,
        }
      : {}),
  }
  const cardsByKey = { appearance: <Appearance prefs={user.preferences} onPreferences={onPreferences} part="theme" />,
    language: <Appearance prefs={user.preferences} onPreferences={onPreferences} part="lang" />,
    ...cards }

  // WHAT THE TYPED WORD DOES TO A SECTIONED PAGE, and it is not what it did to a
  // grid. Narrowing a single scroll meant hiding cards; narrowing five screens
  // means some sections have nothing left in them, and a rail offering a door to
  // an empty room is worse than no rail. So a section whose cards all fail the
  // query drops out of the rail entirely, and if the section you were on is one of
  // them you are moved to the first that survived — because the alternative is
  // standing in the empty room you were just told about.
  const prefs = user.preferences || {}

  // RESETTING A SECTION IS UNSENDING EVERY DECISION IN IT, so it asks first. The
  // repo's rule is that a destructive act wears a confirm, and this one is exactly
  // as destructive as it looks: a reader who spent an evening on their theme can
  // undo the evening with one press.
  //
  // IT SENDS EMPTY, NOT DEFAULTS. Every card reads its value as `p.x || <default>`
  // with the default written at the point of use, so clearing a key is what
  // restores it — and it is the only way to restore it that cannot disagree with
  // the card. Sending a table of defaults would be a second copy of all of them.
  const [resetting, setResetting] = useState(null)
  const resetSection = (id) => {
    const patch = {}
    for (const k of SECTION_PREFS[id] || []) patch[k] = ''
    onPreferences?.(patch)
    setResetting(null)
  }

  const matching = (key) => settingsMatches(key === 'language' ? 'appearance' : key, q)
  const liveSections = SETTINGS_SECTIONS.filter(([id]) =>
    (SECTION_CARDS[id] || []).some((k) => cardsByKey[k] && matching(k)))
  const current = liveSections.some(([id]) => id === section) ? section : (liveSections[0] || [])[0]
  const shown = current ? (SECTION_CARDS[current] || []).filter((k) => cardsByKey[k] && matching(k)) : []

  return (
    <section className="space-y-6">
      {/* NO PAGE HEADER ON A PHONE, not even an empty one. The shell's bar draws
          "Settings" with a sub-line under it, and this header's <h1> is hidden
          there — so once the caption moved to that sub-line, a whole sticky row
          was being spent to say nothing, directly under the row that says it.
          'admin' is a ROLE and the users list already names it, so the desktop
          counts draws that same word rather than a second copy of it. */}
      {!mobile && (
        <PageHeader
          title={t('nav.tab.settings.label')}
          counts={user.is_admin ? t('account.users.admin.chip') : user.username}
        />
      )}
      {/* SAY SO RATHER THAN GO BLANK. A page that empties under a typed word looks
          like a page that broke, and the reader's next move is to reload rather than
          to correct the word. */}
      {liveSections.length === 0 && <p className="microcopy">{t('settings.search.none', { q })}</p>}
      {liveSections.length > 0 && (
        <SectionRail
          sections={liveSections.map(([id, label, glyph]) => ({
            id,
            label: t(label),
            icon: SECTION_GLYPH[glyph],
            // A COUNT OF PREFERENCES YOU HAVE SET, and it is never a warning — a
            // reader who has configured six things has not got six problems, so
            // `warn` stays off and the number wears the ordinary count colour.
            count: changedIn(prefs, id) || null,
            info: t(sectionInfoKey(id)),
            pill: sectionPill(changedIn(prefs, id)),
          }))}
          value={current}
          onChange={setSection}
          ariaLabel={t('settings.section.aria')}
          total={sectionPill(liveSections.reduce((a, [id]) => a + changedIn(prefs, id), 0))}
        >
          <div className="space-y-6">
            {/* THE SECTION'S OWN HEADER, above its cards: what this section is for,
                and the way back out of every decision in it. The pack puts both
                here and not on the tab, because a tab is a place to go and this is
                a thing to do to the place you are in. */}
            {current && (
              <div className="section-head">
                <MonoLabel>{t(liveSections.find(([id]) => id === current)[1])}</MonoLabel>
                <InfoDot title={t(liveSections.find(([id]) => id === current)[1])} text={t(sectionInfoKey(current))} />
                <span className="grow" />
                <span className="section-head-pill">{sectionPill(changedIn(prefs, current))}</span>
                {changedIn(prefs, current) > 0 && (
                  <Tooltip label={t('settings.section.reset.tip', { section: t(liveSections.find(([id]) => id === current)[1]) })}>
                    <GhostButton icon={<IconRevert />} onClick={() => setResetting(current)}>
                      {t('settings.section.reset.label')}
                    </GhostButton>
                  </Tooltip>
                )}
              </div>
            )}
            {shown.map((k) => <div key={k}>{cardsByKey[k]}</div>)}
          </div>
        </SectionRail>
      )}
      {/* REVERSIBLE IS LEFT OUT DELIBERATELY. Nothing is destroyed — the section
          goes back to what a new account sees, and every choice can be made again
          in the place it was made. Saying "cannot be undone" over that would put
          the bin's words on a settings screen. */}
      <ConfirmDialog
        open={!!resetting}
        title={t('settings.section.reset.confirm.title', { section: resetting ? t(SETTINGS_SECTIONS.find(([id]) => id === resetting)[1]) : '' })}
        body={t('settings.section.reset.confirm.body')}
        confirmLabel={t('settings.section.reset.confirm.verb')}
        onConfirm={() => resetSection(resetting)}
        onCancel={() => setResetting(null)}
      />
    </section>
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
// Slider MOVED TO ui.jsx. The Metadata screen's per-language rows need the same
// control — a stepped range that commits on release — and the repo's directive is
// that a control drawn on two screens lives in one function both call, not in a
// line each. It gained one option there (`readout`), because these stops are named
// states rather than numbers.

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
// EXPORTED, BECAUSE IT IS A SECTION OF THE METADATA CONSOLE NOW. A colour
// category is not a preference — it is what KIND of note a quote is, which is a
// fact about the library in exactly the way a tag or a language is. It sat in
// Settings because Settings was where everything went; the v3 pack files it with
// the rest of what the library is made of, beside Tags and Languages.
export function ColourCategoriesCard({ prefs, onSaved }) {
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
    //
    // NO `data-tour` HERE ANY MORE. This card carried `data-tour="categories"` and
    // no step ever named it — an anchor with nothing on the other end, which is the
    // same defect as the tour step that named `[data-tour="search"]` after the
    // element lost it, seen from the opposite side. Both cost nothing and do
    // nothing, and neither the build nor any test says a word. If the colour
    // categories ever earn a step, the attribute comes back with it.
    <Card>
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

// faceOptions MOVED TO fontPicker.jsx, with the Select it fills. Three surfaces
// ask for a list of faces now — a role, a UI language, and a quote language — and
// the repo's directive is that a control drawn on more than one screen lives in
// one function they all call.

// specimenSize — the token a role's specimen is drawn at. Mono is set smaller
// because a label IS smaller; the two script rows borrow the reading face's dial,
// since that is the size their glyphs are drawn at on a real screen.
const specimenSize = (roleKey) => {
  if (roleKey === 'mono') return 'var(--type-mono-13)'
  return SIZE_ROLES.includes(roleKey) ? `var(--type-${roleKey}-17)` : 'var(--type-display-17)'
}

// THE FOUR FACES THE INTERFACE IS SET IN, drawn where a reader chooses them.
//
// IT PICKS NOTHING ITSELF. Pressing a specimen opens the Type panel, which is
// where a face is actually chosen along with everything that goes with choosing
// one — the style modifiers, the script check, the per-language scope, the
// uploads. Two places that both assign a face would be two writers for one
// preference, and the repo has spent enough commits pulling those apart.
//
// SO WHAT IS IT FOR. Seeing. The section listed no faces at all, so the answer to
// "what is this app set in" was behind a button, and the answer to "what would it
// look like if I changed it" was behind a button inside that button. A specimen is
// the one part of this that has to be on the page, because it is the part that
// cannot be read as a name.
function FaceSpecimens({ prefs, onOpen }) {
  // '' is the scope every UI language inherits — the flat preference fields —
  // which is what the interface is wearing now, as against a per-language
  // override the panel's own scope picker reaches.
  const rows = fontStateFor(prefs || {}, '').filter((r) => !r.script)
  return (
    <div className="face-specimens">
      {rows.map((r) => (
        <button key={r.key} type="button" className="face-specimen" onClick={onOpen}>
          <span className="face-specimen-role">
            <MonoLabel>{t(r.label)}</MonoLabel>
            {/* THE FACE'S OWN NAME, because the specimen says what it looks like
                and this says what to ask for. A row that showed only the drawing
                could not be talked about. */}
            <span className="face-specimen-name">{r.chosen.name}</span>
          </span>
          {/* dir="auto" and nothing else: the sample is the role's own words in
              whatever language the interface is in, and the first strong character
              decides which way it reads. */}
          <span
            className="face-specimen-sample"
            dir="auto"
            style={{ fontFamily: r.family, fontStyle: r.italic ? 'italic' : undefined }}
          >
            {t(r.sample)}
          </span>
        </button>
      ))}
    </div>
  )
}

function TypeSettings({ prefs, onSaved }) {
  const { ask, confirmDialog } = useConfirm()
  const [openRole, setOpenRole] = useState(null)
  const [err, setErr] = useState('')
  const [mine, setMine] = useState(uploadedFonts)
  const [busy, setBusy] = useState(false)
  // What the script check said about the face just assigned, per role. A
  // WARNING and never a refusal — see hasScript.
  const [warn, setWarn] = useState({})
  // WHICH LANGUAGE'S INTERFACE THESE FACES ARE FOR. '' is the answer every UI
  // language inherits — the six flat preference fields the app has always had —
  // and a code is that language's own.
  //
  // THE OWNER'S SPEC: "tippani is meant to be highly translatable… any language
  // can become the ui language… Any language that the user adds in via translation
  // files should have a full ui font picker (revamp the font picker in settings
  // for that)." So the picker did not gain a second copy per language; it gained a
  // scope, and the six rows under it are the same six rows.
  const [scope, setScope] = useState('')
  // The optimistic copy, cleared when the parent's prefs catch up with it. The card
  // applies a change before the PUT answers — the whole point of a type picker is
  // watching the type move — and the rows are derived from prefs now rather than
  // held as state, so without this they would snap back for one round trip.
  const [draft, setDraft] = useState(null)
  const live = draft || prefs || {}
  const rows = fontStateFor(live, scope)

  useEffect(() => { setDraft(null) }, [prefs])

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
    applyFonts(live, localeActive())
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
    await save({ [roleKey]: r.data.token })
    checkScript(roleKey, r.data.token)
  }

  // THE VERIFIER, and it runs after the assignment rather than before it. The
  // check needs the face LOADED to measure it, and the honest thing to report is
  // what the reader is now looking at — not a prediction about it.
  // THE TOKEN RATHER THAN THE LIVE STATE, because the card can now assign a face
  // to a scope the app is not rendering. Reading fontState() would measure
  // whatever the interface happens to be set to — which is unchanged when the
  // scope is another language, so an uploaded face with no Bengali in it would
  // pass the check and turn every Bengali label into boxes with nothing on screen
  // to say why.
  function checkScript(roleKey, token) {
    const face = faceFor(roleKey, token)
    const ok = face ? verifyUpload(face.family, roleKey) : null
    setWarn((wmap) => ({ ...wmap, [roleKey]: ok }))
  }

  async function removeFont(f) {
    if (!(await ask(t('settings.type.font.remove.confirm', { name: t(f.name) }), { danger: true, reversible: false }))) return
    const r = await json('DELETE', `/fonts/${f.id}`)
    if (!r.ok) return setErr(errText(r, t('error.delete.font')))
    await reloadUploads()
  }

  // save applies FIRST and asks after, like every other card here: the whole
  // point of a type picker is seeing the change, and a round trip between the
  // tap and the type is long enough to make the control feel broken.
  //
  // ONE CALLER SHAPE FOR BOTH SCOPES. `field` is a role key, or a role key plus
  // "Style"; fontPatch turns it into the flat preference field or into this
  // locale's entry in the blob, and nothing here has to know which. `null` clears,
  // which is what the revert glyph sends and is not the same as "".
  //
  // AND IT IS ALWAYS APPLIED AGAINST THE RENDERING LOCALE, never against `scope`.
  // Editing Bengali's faces while the interface is in English must change nothing
  // on screen — applyFonts composes flat plus the ACTIVE locale's overlay, so it
  // already does exactly that, and the specimen below is what shows the scope.
  async function save(changes) {
    const patch = fontPatch(live, scope, changes)
    const next = { ...live, ...patch }
    setDraft(next)
    applyFonts(next, localeActive())
    const r = await json('PUT', '/auth/me/preferences', patch)
    if (!r.ok) {
      setErr(errText(r, t('error.save.generic')))
      setDraft(null)
      applyFonts(prefs || {}, localeActive())
      return
    }
    setErr('')
    onSaved?.(patch)
  }

  return (
    <>
      {confirmDialog}
      <p className="microcopy mb-3">
        {t('settings.type.intro.prose')}
      </p>
      {/* WHOSE INTERFACE, and it is one row above the six rather than a second
          copy of them per language. The app ships with two languages and takes any
          number from data/Locales, so a picker that repeated itself per language
          would be a card that grows with somebody's translations folder.

          THE FIRST OPTION IS THE ANSWER EVERY LANGUAGE INHERITS, not "English".
          Naming it English would be wrong twice over: it is what a reader with no
          per-language opinion sees in EVERY language, and English itself can take
          an answer of its own that overrules it. */}
      <div className="mb-3">
        <MonoLabel className="mb-1 block" style={{ color: 'var(--faint)' }}>{t('settings.type.scope.title')}</MonoLabel>
        <Select
          value={scope}
          ariaLabel={t('settings.type.scope.title')}
          width={230}
          // THE WARNING GOES WITH THE SCOPE. It says something about the face
          // assigned to one language's role, and a role key alone cannot tell two
          // scopes apart — so switching scope drops it rather than leaving a
          // sentence about a face this scope does not use.
          onChange={(v) => { setScope(v); setWarn({}) }}
          options={[
            ['', t('settings.type.scope.all')],
            ...localeCatalogue().map((l) => [l.code, l.name]),
          ]}
        />
      </div>
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
                {/* THE REVERT, AND ONLY WHERE THERE IS SOMETHING TO REVERT — the
                    same glyph and the same condition the language rows and the
                    text-order field already use, because "put this back" is one
                    verb. A scope row with nothing of its own SHOWS what it would
                    inherit, so a set row and an unset one look alike; this is what
                    tells them apart. The inherited scope itself has nothing above
                    it to fall back to, so it never draws one. */}
                {scope && row.own && (
                  <FieldIconButton
                    icon={<IconRevert />}
                    ariaLabel={t('settings.type.scope.revert.aria', { name: t(row.label) })}
                    onClick={() => save({ [row.key]: null, [row.key + 'Style']: null })}
                    tooltip={t('settings.type.scope.revert.tip')}
                  />
                )}
                {/* THE SIZE DIAL SITS IN THE HEAD, not behind the disclosure, so
                    the four of them read as a column you can compare down — and
                    so the one control a reader is most likely to want is not two
                    taps away. Only the four roles that OWN a size have one: a
                    script's glyphs take the size of the element they are drawn in.

                    AND IT IGNORES THE SCOPE ABOVE IT, which is why that row says
                    "these FACES are for". A size is a reader's eyesight and their
                    screen; a face is a taste about a language. The Appearance
                    card's global dial writes the same four fields, so making them
                    per-language here would give one number two homes and no way to
                    tell which one a screen was obeying. */}
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
                  // THE SCOPE'S OWN STACK, not `var(--font-display)`. The card can
                  // edit the faces for a UI language the reader is not in, and the
                  // custom property is what the app is actually drawing — so a
                  // specimen reading it would show English while the row above it
                  // said Bengali. fontStateFor composes this one per scope.
                  fontFamily: row.family,
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
                    <FaceSelect
                      faces={row.faces}
                      uploads={mine}
                      value={row.chosen.id}
                      ariaLabel={t('settings.type.face.aria', { name: t(row.label) })}
                      onChange={(id) => {
                        save({ [row.key]: id })
                        if (String(id).startsWith('upload:')) checkScript(row.key, id)
                      }}
                    />
                    {/* UPLOAD IS ITS OWN BUTTON. It was a fourth chip beside three
                        typefaces, which reads as a fourth typeface — and it is not
                        a face, it is a way of getting one. */}
                    <FilePick
                      className="tp-btn tp-btn-ghost tactile"
                      accept=".woff2,.woff,.otf,.ttf,font/woff2,font/woff,font/otf,font/ttf"
                      disabled={busy}
                      onFiles={(f) => upload(row.key, f)}
                    >
                      <IconUpload />
                      <span>{busy ? t('common.action.upload.busy') : t('settings.type.upload.label')}</span>
                    </FilePick>
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
                                [row.key + 'Style']: serialiseFontStyles(
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

// collectFonts IS GONE, and what replaced it is the reason. It rebuilt the whole
// preference shape from the rendered rows so an optimistic apply carried every
// role rather than only the one being changed — necessary while the rows were the
// source of truth. They are derived from `prefs` now, so the optimistic copy is
// the preferences themselves (`draft`), and applyFonts reads them the same way a
// fresh login does. One shape, not two that have to agree.


// SRSettings — the spaced-repetition knobs (v0.5.0 Daily Quiz & Practice): the
// daily deck size, what the review covers (books / films & shows / both),
// whether Practice is allowed to move the schedule, and which of the two
// scheduling rules is in force. THE DEFAULT IS ADAPTIVE since 3.1.0 — a recall
// multiplies the half-life by 2.5 and a lapse HALVES it, which is the real
// subject of the rule; the fixed ladder (7 → 30 → 100 → 365 days,
// review_handlers.go) is the opt-in, and the stored preference is srLadder
// rather than srAdaptive for the reason that field's comment gives. Each knob
// persists via the partial-merge preferences PUT.
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
        {/* 5 TO 20, widened from 2 to 10 on the owner's instruction; the v3 pack
            draws 5 to 60. An account already holding 2, 3 or 4 keeps it — the
            server validates what is written and rewrites nothing — but cannot get
            back below five through this control. */}
        <Slider label={t('settings.quiz.per-day.label')} min={5} max={20} step={1} value={p.srDaily || 8} onCommit={(v) => set({ srDaily: v })} />
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
      srLadder: false,
      srTier: 'medium',
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
          {/* THE STORED FLAG IS THE LADDER, not adaptive, so the zero value is
              the default the way it is for every other switch here. `srAdaptive`
              was a flat bool in a JSON blob with no omitempty, so every account
              already carried `false` whether the reader chose the ladder or never
              opened this panel — a default that cannot be flipped. The two option
              values stay 'off'/'on' in the reader's terms: off is adaptive. */}
          <Toggle
            ariaLabel={t('settings.quiz.adaptive.aria')}
            value={p.srLadder ? 'ladder' : 'adaptive'}
            onChange={(v) => set({ srLadder: v === 'ladder' })}
            options={[['adaptive', t('settings.quiz.adaptive.on.label')], ['ladder', t('settings.quiz.adaptive.ladder.label')]]}
          />
        </div>
        {/* HOW HARD THE QUESTIONS ARE — a third axis, and not the same as either
            of the two beside it: srQuestions says WHICH questions may be asked,
            srTuning says how much an answer moves the schedule, and neither makes
            the same card easier or harder to get right. Medium is what the quiz
            has always done, so an account that never opens this sees no change. */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>{t('settings.quiz.tier.title')}</MonoLabel>
            <InfoDot text={t('settings.quiz.tier.info.body')} />
          </div>
          <Toggle
            ariaLabel={t('settings.quiz.tier.title')}
            value={p.srTier || 'medium'}
            onChange={(v) => set({ srTier: v })}
            options={REVIEW_TIERS.map((k) => [k, t(`settings.quiz.tier.${k}.label`)])}
          />
          {/* THE COST OF THE FLOOR, SAID OUT LOUD. Close wrong answers teach more
              than obvious ones (Little et al., 2012); Easy gives that up on
              purpose, and a tier that only advertised its benefit would be
              selling the reader something. */}
          {(p.srTier || 'medium') === 'easy' && (
            <p className="microcopy mt-2" style={{ lineHeight: 1.6 }}>{t('settings.quiz.tier.easy.note')}</p>
          )}
        </div>
        {/* WHERE A LINE ENTERS, which is not how hard it is asked. The tier above
            says what KIND of question a line in the rotation gets; this says what
            rung a line you have never been asked about starts on. The v3 pack
            draws both and this app had only the first — and an audit of the two
            paired them as the same control, which they are not.

            TWO RUNGS, NOT THE PACK'S THREE. The pack offers Fresh, Known and
            Mastered; the owner's ruling is "either at not seen or mastered (first
            tier)", so the middle one is not offered — a reader who wants a line
            treated as half known can answer it once. */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <MonoLabel>{t('settings.quiz.start.title')}</MonoLabel>
            <InfoDot text={t('settings.quiz.start.info.body')} />
          </div>
          <Toggle
            ariaLabel={t('settings.quiz.start.title')}
            value={p.srStart || 'unseen'}
            onChange={(v) => set({ srStart: v })}
            options={[
              ['unseen', t('settings.quiz.start.unseen.label')],
              ['mastered', t('settings.quiz.start.mastered.label')],
            ]}
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
// Exported for `update-released.test.jsx`, which drives the card from the fields
// /auth/me actually sends. Mounting the whole Settings screen to read one row
// would make the case fail for a dozen reasons that are not this row.
export function UpdatesCard({ user, update, onUpdateInfo, asking = false, onAsking }) {
  const current = user?.version || t('settings.updates.version.dev')
  const [logOpen, setLogOpen] = useState(false)
  const [info, setInfo] = useState(update || null) // check result (seeded from the shared session cache)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [phase, setPhase] = useState('idle') // idle | applying | restarting | failed
  // The step the server said it stopped at, in its own words. Kept on the card
  // rather than only in a toast: a toast is gone in four seconds and this is the
  // one sentence the operator has to act on — and, often enough, to paste
  // somewhere. Empty when the failure had nothing to say.
  const [failure, setFailure] = useState('')

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
    // NO RESPONSE IS NOT A REFUSAL. The apply pulls two images and creates a
    // container before it writes a byte, which on a slow line is minutes — and a
    // request that sends nothing for minutes is exactly the one an intermediary
    // gives up on: a sleeping phone, a Wi-Fi roam, a reverse proxy's own read
    // timeout. The server no longer cares (it detached the work from this
    // connection), so the update is very likely running right now, and telling
    // the reader it failed would be a lie that invites a second apply.
    //
    // status 0 is send()'s "the fetch never came back at all"; a real refusal
    // arrives with a status and a reason and is still reported as one.
    if (!r.ok && r.status !== 0) {
      setPhase('failed')
      toast(r.data?.error || t('error.update.start'))
      return
    }
    // WAIT FOR THE VERSION TO CHANGE, NOT FOR THE SERVER TO ANSWER. This used to
    // reload on the first successful ping — and the first ping is three seconds
    // after the apply, while THIS container is still up and answering, because
    // Watchtower has not stopped it yet. So it reloaded onto the build it was
    // already running, every time: "it says updating, then refreshes, and nothing
    // has changed" is exactly what that looks like from the outside.
    //
    // AND A RESTART IS NOT A SUCCESS. The check can offer an update on a branch
    // build because the BRANCH moved, while the IMAGE that tag points at has not
    // been rebuilt yet — pull, recreate, same version. The reader is told that
    // happened rather than left to compare two version strings themselves.
    setPhase('restarting')
    // THE WAIT IS ITS OWN MODULE, and it had to become one: this is the third fix
    // to it and the first two shipped unproven because twenty lines inside a click
    // handler cannot be tested against a server that has gone away. See update.js
    // for the three bounds and why each is needed; test/pure/update-wait.test.js
    // holds the case that mattered — every poll hangs and the loop still ends.
    // ASKING THE SERVER WHAT IT DID, not just whether it is up. /admin/update/state
    // is the apply's own record of which step it reached (update_progress.go) and
    // the version answering right now, in one reply — so the two cannot disagree
    // about whether this is a different box yet. It is the only thing that can end
    // this wait honestly: the apply's own answer almost never arrives.
    const { outcome, why } = await waitForRestart({
      ping: async () => {
        const r = await json('GET', '/admin/update/state', undefined, { timeoutMs: 8000 })
        return {
          ok: r.ok,
          version: r.data?.current || '',
          phase: r.data?.phase || '',
          error: r.data?.error || '',
        }
      },
      sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
      was: user?.version || '',
    })
    if (outcome === RESTART_NEW) return window.location.reload()
    setPhase('failed')
    // THE SERVER'S OWN WORDS WHERE THERE ARE ANY. "Something went wrong, try
    // reloading" is what this said for every one of four different failures, and
    // three of them are things only the operator can fix — a socket that is not
    // mounted, a container the Engine cannot identify by hostname, an image that
    // 404s. Naming the step is the difference between a bug report and a fix.
    if (outcome === RESTART_FAILED) {
      setFailure(why || '')
      return toast(why || t('settings.updates.toast.reload'))
    }
    setFailure('')
    toast(t(outcome === RESTART_SAME ? 'settings.updates.toast.same' : 'settings.updates.toast.reload'))
  }

  const copyCmd = async () => {
    const ok = await copyText(info?.guided_command || '')
    toast(ok ? t('settings.updates.toast.copied') : t('error.copy.manual'))
  }

  // ── THE DOCK'S "UPDATE NOW", WHICH IS THIS CARD SEEN FROM A THUMB.
  //
  // A phone reaches Settings and then scrolls past six cards to find out whether
  // there is anything to install. The key skips the scroll; it does NOT skip the
  // decision. The confirmation is the same typed word the card asks for, because
  // that word is compared byte for byte by the server and a one-tap update on a
  // phone is exactly the accident it exists to prevent.
  //
  // IT ALWAYS CHECKS, and the `!info` that used to be in this condition is the
  // bug it fixes. "Check first if it has to" meant: only when nothing had been
  // fetched yet — so the FIRST press checked and every press after it opened on
  // whatever the last check had said, however long ago. The card is on screen for
  // as long as a Settings visit lasts and this key is reached from every screen,
  // so the stale case was the common one: press it, read "you are up to date",
  // and be told that about a release that shipped an hour earlier.
  //
  // A key called "Update now" that answers from cache is the key lying about the
  // one thing it is for. The check is a single request against GitHub, which is
  // cheaper than a reader pressing twice to learn the same fact — and cheaper
  // still than trusting the wrong answer.
  //
  // Not while one is already in flight, and not while an apply is running: the
  // phases below drive the prompt's own copy, and re-checking under them would
  // replace "pulling the new image" with a version comparison nobody asked for.
  useEffect(() => {
    if (asking && !busy && phase !== 'applying' && phase !== 'restarting') check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking])

  const canApply = !!(info?.update_available && info?.can_self_update)

  // THE TYPED CONFIRMATION, written once and drawn twice — on the card and in the
  // sheet the dock's key opens. They already shared `confirm` and `apply`; sharing
  // the markup too is what stops one of them growing a fix the other does not get,
  // which is exactly what happened to the busy state below.
  //
  // A RUNNING UPDATE IS NOT A BUTTON. "Pulling the new image — this can take a few
  // minutes…" was the button's LABEL, so a control 140px wide on a phone was
  // asked to hold a sentence and pushed the row off the screen. It is prose now,
  // and the form goes: once the pull has started there is nothing on this row
  // left to decide, so a disabled input and a disabled button are two dead
  // controls under a sentence that has replaced them.
  // RESTARTING COUNTS AS RUNNING. The two phases are one thing to a reader — the
  // update is happening — and only the sentence differs; offering the form back
  // between them would be a second Update button under a page that is already
  // waiting for the box to come back.
  const running = phase === 'applying' || phase === 'restarting'
  const confirmUpdate = (
    <div style={{ display: 'grid', gap: 'calc(var(--row) * 0.6)' }}>
      {/* UPDATE is not copy: it is the word the server compares byte for byte, so
          it stays Latin in every language and is supplied as a node rather than
          living in the value. */}
      <p className="microcopy">
        {tNodes('settings.updates.confirm.prose', { word: <b key="word">UPDATE</b>, version: info?.latest })}
      </p>
      {running ? (
        <p className="microcopy" style={{ color: 'var(--accent-ui)' }}>
          {t(phase === 'restarting' ? 'settings.updates.restarting.prose' : 'settings.updates.apply.busy')}
        </p>
      ) : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); apply() }}>
          {/* The placeholder is the typed confirmation itself, not a label. */}
          <input
            className="tp-input"
            style={{ maxWidth: 140, fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)' }}
            placeholder="UPDATE"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <StickerButton disabled={confirm !== 'UPDATE'}>
            {t('settings.updates.apply.label')}
          </StickerButton>
        </form>
      )}
      {phase === 'failed' && (
        <p className="microcopy" style={{ color: 'var(--error)' }}>{t('settings.updates.failed.prose')}</p>
      )}
    </div>
  )
  const updatePrompt = asking && (
    <PromptFrame
      title={t('settings.updates.now.label')}
      closeLabel={t('common.action.cancel.label')}
      closeTip={t('settings.prompt.close.tip')}
      busy={phase === 'applying' || phase === 'restarting'}
      dismissOnScrim={false}
      onClose={() => onAsking?.(false)}
    >
      <div style={{ display: 'grid', gap: 'var(--row)' }}>
        {busy && <p className="microcopy">{t('settings.updates.check.busy')}</p>}
        {!busy && info && !info.update_available && !info.check_error && (
          <p className="microcopy">{t('settings.updates.current.label')}</p>
        )}
        {!busy && info?.check_error && (
          <p className="microcopy">{t('settings.updates.unreachable.prose', { error: info.check_error })}</p>
        )}
        {/* AN UPDATE THIS BOX CANNOT INSTALL ITSELF sends the reader to the card,
            which is where the command to run is printed. Repeating it here would
            be a second copy of a shell line somebody has to get exactly right. */}
        {!busy && info?.update_available && !info.can_self_update && (
          <p className="microcopy">{t('settings.updates.manual.prose')}</p>
        )}
        {canApply && confirmUpdate}
      </div>
    </PromptFrame>
  )

  return (
    <Card>
      {updatePrompt}
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
                {current} <IconOpen size={12} />
              </a>
            </Tooltip>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontWeight: 600 }}>{current}</span>
          )}
        </div>

        {/* WHEN THAT BUILD CAME OUT. The version number says WHICH build you have
            and nothing about how old it is, which is the question somebody opens
            this card to answer.

            "RELEASED", NOT "UPDATED", and the whole row turns on that word. The
            server cannot know when THIS BOX was last updated — the settings row
            that would record it travels inside a backup archive, so a restore
            would print the date of the machine the archive came from; a local
            build's version is `dev` for ever, so the stamp would never advance;
            a NAS with a dead clock would write 1970 and keep it; and a downgrade
            would be called an update. The release date is a fact about the BUILD,
            so it is right offline, right after a restore, and right after a
            downgrade, and nothing is stored for any of those to corrupt.

            THE ROW IS ALWAYS DRAWN, including on a build with no date — a dev
            build, a branch image, a release candidate. A missing row is
            indistinguishable from a field that failed to arrive, and every render
            a developer or CI ever sees is the dev build, so hiding it would mean
            the shipped shape is the one nobody looks at. The same reasoning the
            server already applies to `current_listed`. */}
        <div className="flex items-baseline gap-2">
          <MonoLabel>{t('settings.updates.released.label')}</MonoLabel>
          <span style={{ fontFamily: 'var(--font-mono)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)' }}>
            {/* Guarded here as well as on the server: the field's contract is
                `YYYY-MM-DD` or empty, and a client that formats whatever arrives
                is one bad heading away from printing NaN. */}
            {isPartialDate(user?.version_date || '')
              ? formatPartialDate(user.version_date)
              : t('settings.updates.released.unknown.label')}
          </span>
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

        {/* WHERE IT STOPPED, in the server's own words. Four different failures
            used to arrive as one sentence about reloading, and three of them are
            things only the operator can fix — a socket that was never mounted, a
            container the Engine cannot find by hostname, an image reference that
            404s. It stays on the card after the toast has gone, because this is
            the line that gets pasted into an issue. */}
        {failure && phase === 'failed' && (
          <p className="microcopy" style={{ color: 'var(--error)', whiteSpace: 'pre-wrap' }}>
            {failure}
          </p>
        )}

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
                  confirmUpdate
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

  return (
    <PromptFrame
      title={t('settings.changelog.title')}
      closeLabel={t('common.action.close.label')}
      closeTip={t('settings.changelog.close.tip')}
      maxWidth={640}
      onClose={onClose}
    >
      {body}
    </PromptFrame>
  )
}

// PromptFrame — the shape all four of this page's dialogs already were.
//
// FOUR COPIES OF ONE FRAME. The changelog, the restore prompt, the backup prompt
// and now the update prompt each ended with the same forty lines: a MobileSheet
// on a phone, a scrim with a hand-card and a 640/460 cap on a desk, a display
// title, a CloseButton with a tooltip. They drifted in exactly the way that
// costs nothing until it costs everything — one of them locks body scroll, one
// takes Escape, one refuses a scrim dismiss while busy — so the differences are
// PARAMETERS here rather than four independent decisions.
//
// It lives in this file rather than in ui.jsx on purpose. There are five of these
// frames in the app; the other one is inside ui.jsx's own FormModal, which has a
// registered form and a ✓ in its header and is a different thing wearing the same
// coat. Pulling all five together is a change to every dialog in the app, and this
// is a change to one page.
function PromptFrame({ title, closeLabel, closeTip, busy = false, maxWidth = 460, dismissOnScrim = true, onClose, children }) {
  const mobile = useIsMobileScreen()
  // ITS OWN BACK ENTRY — see PersonModal — and desktop-only, because the mobile
  // branch is a MobileSheet which takes one for itself. Above the early return,
  // or it would be a hook behind a condition. `busy` is honoured the way the
  // sheet honours it one line below: a back press during an apply must not
  // dismiss the thing reporting the apply.
  useBackToClose(!mobile, () => { if (!busy) onClose?.() })
  if (mobile) {
    return createPortal(
      <MobileSheet open onClose={busy ? () => {} : onClose} title={title} dismissOnScrim={dismissOnScrim && !busy}>
        {children}
      </MobileSheet>,
      document.body,
    )
  }
  return createPortal(
    <div
      className={SCRIM_CENTERED}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabelText(title)}
      onMouseDown={backdropClose(onClose, !busy)}
    >
      <div className="hand-card hc-r2 w-full" style={{ maxWidth, padding: '18px 20px 20px' }}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display-title flex-1" style={{ fontSize: 'var(--type-ui-19)' }}>{title}</h2>
          <Tooltip label={closeLabel} side="bottom">
            <CloseButton onClick={onClose} label={closeLabel} tooltip={closeTip} disabled={busy} />
          </Tooltip>
        </div>
        {children}
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
  // The order, and the one verb that changes it. Read through `sectionOrder` so a
  // preference written before a section existed still places the ones it knows
  // and leaves the new one where the table puts it.
  const order = sectionOrder(prefs)
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = order.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    // A STRING, NOT AN ARRAY. Every other preference this endpoint takes is a
    // scalar, and a list would be the only one needing its own shape on both
    // sides; the keys are short and the set is closed, so a comma-separated line
    // is the whole of it.
    const patch = { sectionOrder: next.join(',') }
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
      {/* AND THE ORDER THEY COME IN, which the chips above cannot express: a chip
          row says which sections exist and a reader dragging one would be guessing
          whether they had moved it or switched it off. So the order is its own
          list, with a pair of arrows per row.

          ARROWS RATHER THAN A DRAG. A drag needs a pointer that can hover to
          discover it is draggable, a keyboard equivalent invented from nothing,
          and a touch target that does not fight the page's own scroll. Two
          buttons are the same answer, reachable by every input the app supports,
          and the repo has no drag-to-sort anywhere else to be consistent with.

          THIS ORDER IS THE RAIL, THE DRAWER AND THE + MENU, because all four read
          routes.js through one `visibleTabs` — which now orders as well as
          filters, for the reason that file already gives about four lists that
          have to agree. */}
      <p className="mono-label mt-5">{t('settings.features.order.title')}</p>
      <p className="microcopy">{t('settings.features.order.prose')}</p>
      <ul className="mt-2" style={{ display: 'grid', gap: 2 }}>
        {order.map((tab, i) => {
          const sec = SECTIONS.find((x) => x.tab === tab)
          if (!sec) return null
          return (
            <li key={tab} className="flex items-center gap-2" style={{ padding: '4px 0' }}>
              <span className="grow min-w-0">{t(sec.label)}</span>
              <FieldIconButton
                icon={<IconArrow dir="up" />}
                ariaLabel={t('settings.features.order.up.aria', { name: t(sec.label) })}
                tooltip={t('settings.features.order.up.aria', { name: t(sec.label) })}
                onClick={() => move(i, -1)}
                disabled={i === 0}
              />
              <FieldIconButton
                icon={<IconArrow dir="down" />}
                ariaLabel={t('settings.features.order.down.aria', { name: t(sec.label) })}
                tooltip={t('settings.features.order.down.aria', { name: t(sec.label) })}
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
              />
            </li>
          )
        })}
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
// EXPORTED THOUGH NOTHING IN THIS FILE RENDERS IT. The card is hidden rather than
// deleted (see SETTINGS_CARDS), and a hidden card with no test is a card that rots
// quietly until somebody puts it back. `device-revoke.test.jsx` mounts it directly.
export function DevicesCard() {
  const { ask, confirmDialog } = useConfirm()
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
    if (!(await ask(t('settings.devices.revoke.confirm', { name: d.name }), { danger: true, reversible: false }))) return
    const r = await json('DELETE', `/auth/devices/${d.id}`)
    if (!r.ok) return setErr(errText(r, t('error.revoke.device')))
    setErr('')
    toast(t('settings.devices.toast.unpaired'))
    load()
  }

  async function revokeAll() {
    if (!(await ask(t('settings.devices.revoke-all.confirm'), { danger: true, reversible: false }))) return
    const r = await json('POST', '/auth/devices/revoke-all')
    if (!r.ok) return setErr(errText(r, t('error.revoke.devices')))
    setErr('')
    toast(t('settings.devices.toast.all-unpaired'))
    load()
  }

  return (
    <Card>
      {confirmDialog}
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

  return (
    <PromptFrame
      title={t('settings.restore.title')}
      closeLabel={t('common.action.cancel.label')}
      closeTip={t('settings.prompt.close.tip')}
      busy={!!busyLabel}
      dismissOnScrim={false}
      onClose={onCancel}
    >
      {body}
    </PromptFrame>
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

  return (
    <PromptFrame
      title={t('settings.backup.prompt.title')}
      closeLabel={t('common.action.cancel.label')}
      closeTip={t('settings.prompt.close.tip')}
      busy={busy}
      dismissOnScrim={false}
      onClose={onCancel}
    >
      {body}
    </PromptFrame>
  )
}

const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const fmtSize = (n) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

function BackupCard({ user, asking = false, onAsking }) {
  const [backup, setBackup] = useState(null) // {name, created, size, key, account} | null
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false) // creating
  // CONTROLLED, because the phone's dock opens it too. "Back up now" is one of
  // the two things somebody comes to this page on a phone to do, and it was six
  // cards down a scroll.
  const setAsking = (v) => onAsking?.(v)
  // ONE restore, with a source. 'server' = the archive kept here; 'file' = one
  // chosen from disk (from this server or another). The two used to be separate
  // blocks with separate warnings and separate confirmations.
  const [source, setSource] = useState('server')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(null) // sniffArchiveKey result for `file`
  const [prompt, setPrompt] = useState(false) // restore prompt open
  const [phase, setPhase] = useState('idle') // idle | uploading | restoring
  const [pct, setPct] = useState(0)
  // The restore picker, through the shared primitive: one input, one place the
  // value is cleared so the same archive can be chosen twice.
  const restorePick = useFilePick({
    accept: '.tpbk,.tar.gz,.tgz,application/gzip,application/octet-stream',
    ariaLabel: t('shell.restore.file.aria'),
    onFiles: (f) => chooseFile(f || null),
  })

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
              {restorePick.input}
              <div className="flex flex-wrap items-center gap-2">
                {/* IconUpload: this file is going TO the server, which is the one
                    thing that tells it apart from the download beside it. */}
                <GhostButton
                  icon={<IconUpload />}
                  keepLabel
                  onClick={restorePick.open}
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
// MaterialPhysics — the four dials, per tile, for the tiles the chosen set uses.
//
// FOUR SLOTS, NOT TWENTY-SEVEN TILES. The set you are wearing puts one material
// on each of the desk, the furniture, the page and the binding, and those four
// are what you are looking at. Offering all twenty-seven would be a list of
// materials most of which are not on screen — and the way to reach one that is
// not is to put it on a slot first, which is the control one row up.
//
// A DIAL IS A Slider, WHICH COMMITS ON RELEASE. A drag across a range would
// otherwise be one PUT per step, and this preference is a whole JSON object.
function MaterialPhysics({ tiles, tweaks, onChange, glass = false }) {
  const DIALS = [
    ['hard', 'settings.appearance.phys.hard.label'],
    ['sss', 'settings.appearance.phys.sss.label'],
    ['diff', 'settings.appearance.phys.diff.label'],
    ['refl', 'settings.appearance.phys.refl.label'],
  ]
  // The slots in order, de-duplicated: a set may put the same material on two of
  // them, and two identical rows is the same control drawn twice.
  const names = [...new Set(tiles)].filter((n) => n !== 'flat')
  const set = (name, key, value) => onChange({ ...tweaks, [name]: { ...(tweaks[name] || {}), [key]: value } })
  const reset = (name) => {
    const next = { ...tweaks }
    delete next[name]
    onChange(next)
  }
  // THE FIVE GLASS DIALS, AND THEY APPEAR ONLY WITH THE LENS. They configure a
  // renderer: with true glass off there is nothing for clarity, refraction, bevel,
  // fringe or gain to act on, and a control that does nothing is worse than a
  // missing one because it teaches the reader that the controls here are inert.
  // That was the owner's ruling when the cost of the lens was put to them — the
  // glass dials ship with the toggle or not at all.
  const GLASS = [
    ['clarity', 'settings.appearance.glass.clarity.label', 100],
    ['refract', 'settings.appearance.glass.refract.label', 200],
    ['bevel', 'settings.appearance.glass.bevel.label', 200],
    ['fringe', 'settings.appearance.glass.fringe.label', 200],
    ['gain', 'settings.appearance.glass.gain.label', 200],
    ['blur', 'settings.appearance.glass.blur.label', 400],
  ]
  const g = glassDialsFor(tweaks)
  const setGlass = (key, value) => onChange({ ...tweaks, glass: { ...(tweaks.glass || {}), [key]: value } })
  const glassBlock = glass ? (
    <div>
      <MonoLabel className="mb-2 block">{t('settings.appearance.glass.dials.title')}</MonoLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {GLASS.map(([key, label, max]) => (
          <Slider
            key={key}
            label={t(label)}
            min={0}
            max={max}
            step={1}
            value={g[key]}
            format="settings.appearance.phys.readout"
            onCommit={(v) => setGlass(key, v)}
          />
        ))}
      </div>
    </div>
  ) : null

  if (!names.length) {
    // Atrium's material is none, so there is nothing for a dial to act on. Say so
    // rather than draw an empty panel, which reads as a screen that failed to load.
    return (
      <div className="space-y-6">
        <p className="microcopy">{t('settings.appearance.phys.none')}</p>
        {glassBlock}
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {glassBlock}
      {names.map((name) => {
        const p = physFor(name, tweaks)
        const dirty = physDirty(name, tweaks)
        return (
          <div key={name}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <MonoLabel>{t(`vocab.tile.${name}.label`)}</MonoLabel>
              {/* OFFERED ONLY WHERE THERE IS SOMETHING TO UNDO. A reset beside an
                  untouched material is a control that does nothing, and a row of
                  them teaches the reader that the controls here are inert. */}
              {dirty && (
                <FieldIconButton
                  icon={<IconRevert />}
                  ariaLabel={t('settings.appearance.phys.reset.aria', { name: t(`vocab.tile.${name}.label`) })}
                  tooltip={t('settings.appearance.phys.reset.aria', { name: t(`vocab.tile.${name}.label`) })}
                  onClick={() => reset(name)}
                />
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {DIALS.map(([key, label]) => (
                <Slider
                  key={key}
                  label={t(label)}
                  min={0}
                  max={100}
                  step={1}
                  value={p[key]}
                  format="settings.appearance.phys.readout"
                  onCommit={(v) => set(name, key, v)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
            {code} <IconArrow size={10} />
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
            <IconCheck size={13} />
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
// `part` — 'theme', 'lang' or both. The v3 pack splits Settings into named
// sections, and what the interface is WRITTEN IN belongs under its own heading
// rather than beside what it LOOKS like. Both halves read this card's one
// preferences object and go through its one writer, so the screen passes which
// half it wants IN; there is no second component holding a copy of the other.
function Appearance({ prefs, onPreferences, part = 'all' }) {
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
  // Read from what is APPLIED rather than from a prop, for the reason labelsPref
  // exists: a control initialised from a prop can be a render behind what the
  // reader is looking at.
  const [contrast, setContrast] = useState(contrastPrefValue())
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
  // Seeded from the appearance actually applied, like the material set above it,
  // so the control mirrors the screen rather than a prop that may be stale.
  const [physOpen, setPhysOpen] = useState(false)
  const [saved, setSaved] = useState(() => parseSaved(prefs?.savedThemes))
  const [themeName, setThemeName] = useState('')
  const [importError, setImportError] = useState('')
  function saveList(next) {
    setSaved(next)
    json('PUT', '/auth/me/preferences', { savedThemes: JSON.stringify(next) })
  }
  function wearTheme(entry) {
    const fields = applyFields(entry, getResolvedTheme())
    applyTheme(fields)
    onPreferences?.(fields)
    json('PUT', '/auth/me/preferences', fields)
    setMaterialSet(fields.materialSet)
    setAccent(fields.accent)
    setGroundLight(fields.groundLight)
    setGroundDark(fields.groundDark)
    setTexTweak(parseTweaks(fields.texTweak))
  }
  function exportTheme() {
    const blob = new Blob([toFile(getResolvedTheme(), themeName.trim() || t('settings.appearance.saved.export.default'))], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tippani-theme.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importPick = useFilePick({
    accept: 'application/json,.json',
    ariaLabel: t('settings.appearance.saved.import.label'),
    onFiles: async (files) => {
      setImportError('')
      const file = files && files[0]
      if (!file) return
      const got = fromFile(await file.text(), t('settings.appearance.saved.import.unnamed'))
      if (got.error) return setImportError(got.error)
      wearTheme(got.theme)
    },
  })
  // Its own writer, for the reason `saveContrast` documents: `persist` re-sends
  // every theme field on any change, so a preference travelling in that object is
  // wiped by an unrelated accent click.
  const [trueGlass, setTrueGlass] = useState(() => prefs?.trueGlass === true)
  function saveGlass(on) {
    setTrueGlass(on)
    applyTheme({ ...getResolvedTheme(), texTweak: JSON.stringify(texTweak), trueGlass: on })
    json('PUT', '/auth/me/preferences', { trueGlass: on })
  }
  // The reader's edits to what each material does with light. NOT in `persist`,
  // and for the reason that function documents about contrast: it re-sends every
  // theme field on any change, so a preference riding in that object is wiped by
  // an unrelated accent click. One writer per concern.
  const [texTweak, setTexTweak] = useState(() => getResolvedTheme().texTweak)
  function saveTweaks(next) {
    setTexTweak(next)
    applyTheme({ ...getResolvedTheme(), texTweak: JSON.stringify(next) })
    json('PUT', '/auth/me/preferences', { texTweak: JSON.stringify(next) })
  }
  const [groundLight, setGroundLight] = useState(() => getResolvedTheme().groundLight)
  const [groundDark, setGroundDark] = useState(() => getResolvedTheme().groundDark)

  // persist applies the change to the live DOM immediately (§4), lifts it to App so
  // the session user stays current, and PUTs it. Every field rides along so changing
  // one never resets another — a full-state save means a field left out is a field
  // cleared.
  // CONTRAST DOES NOT RIDE IN persist, and the reason is one line below it: that
  // function re-sends every theme field on any change, so a preference travelling
  // in the same object is wiped by an unrelated accent click. applyLabels' own
  // note says the same thing about the same hazard. The endpoint takes a partial
  // — its patch shape is pointers — so sending the one field changes the one
  // field.
  function saveContrast(v) {
    setContrast(v)
    applyContrast(v)
    json('PUT', '/auth/me/preferences', { contrast: v })
  }

  // THE GROUNDS RIDE IN persist, AND THEY HAVE TO. That function re-sends every
  // theme field on any change and then calls applyTheme with the result — so a
  // ground left out of the object would be read back as unset and fall to the
  // shipped one, which means picking Sepia and then clicking an accent would put
  // you back on Cream with nothing saying why. Contrast escapes this by not going
  // through persist at all; the grounds cannot, because they are part of the same
  // full-state save the theme is.
  function persist(next) {
    const s = { materialSet, theme: themePref, accent, groundLight, groundDark, ...next }
    setMaterialSet(s.materialSet)
    setThemePref(s.theme)
    setAccent(s.accent)
    setGroundLight(s.groundLight)
    setGroundDark(s.groundDark)
    applyTheme(s)
    onPreferences?.(s)
    json('PUT', '/auth/me/preferences', s)
  }

  return (
    <Card data-tour="appearance">
      <SectionTitle>{t(part === 'lang' ? 'settings.language.title' : 'settings.appearance.title')}</SectionTitle>
      {part !== 'lang' && (
      <>
      {/* THE PACK'S FOUR NUMBERED GROUPS. The section was one flat run of rows and
          the pack draws it as four, each numbered and each with an aside stating
          the one fact about the group a heading cannot: which pair is set
          together, which material set is on, how many looks are saved.

          NOTHING FOLDS. The pack marks group 2 foldable; the owner chose the
          headings without the fold, and the reason holds — a fold that hides the
          material picker is a fold on the control most readers meet once, and a
          collapsed group is a group nobody knows is there.

          THE NUMBER IS DRAWN FROM POSITION, not typed, because a hand-typed
          ordinal is what goes wrong the day a group is inserted. */}
      <PrefGroup index={1} title={t('settings.appearance.group.light.title')} aside={t('settings.appearance.group.light.aside')}>
      <PrefRow
        label={t('settings.appearance.theme.title')}
        changed={themePref !== 'system'}
        control={
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
        }
      />
      {/* THE GROUND, AND ONLY THE ONE YOU ARE LOOKING AT. Light and dark are
          chosen independently — a reader who likes Sepia by day has said nothing
          about their night — but offering both sets at once is eight swatches for
          a choice about the four you can see. So the row follows the mode that is
          actually on screen, which is also what makes each swatch an honest
          preview: it is drawn in the ground it selects.

          A SWATCH IS THE TRIAD, NOT A COLOUR. Each one draws all three surfaces
          stacked — desk behind, furniture over it, page on top — because that is
          what is being chosen, and a single square would show a third of it. */}
      <PrefRow
        label={t('settings.appearance.ground.title')}
        info={t('settings.appearance.ground.info.body')}
        changed={(effectiveDark ? groundDark : groundLight) !== (effectiveDark ? 'night' : 'cream')}
        control={
          <div className="flex flex-wrap gap-2">
          {Object.entries(GROUNDS[effectiveDark ? 'dark' : 'light']).map(([key, g]) => {
            const on = (effectiveDark ? groundDark : groundLight) === key
            // THE SWATCH IS DRAWN FROM THE PALETTE THE GROUND PRODUCES, not from
            // the ground's own override set. A ground is `{ label, tokens }` and
            // two of the eight carry NO tokens at all — Cream and Night are the
            // shipped palettes, which is the whole point of them — so a swatch
            // reading `g.bg` painted every ground transparent and the shipped one
            // hardest of all. `paletteFor` is the same merge `applyTheme` does, so
            // the swatch is the ground, rather than a second opinion about it.
            const pal = paletteFor(effectiveDark, effectiveDark ? { groundDark: key } : { groundLight: key })
            return (
              <Tooltip key={key} label={t(g.label)}>
                <button
                  type="button"
                  className="ground-swatch"
                  aria-pressed={on}
                  aria-label={t(g.label)}
                  onClick={() => persist(effectiveDark ? { groundDark: key } : { groundLight: key })}
                  style={{
                    background: pal.bg,
                    boxShadow: on
                      ? `0 0 0 2px var(--card), 0 0 0 4px var(--accent-ui)`
                      : `inset 0 0 0 1px ${pal.line}`,
                  }}
                >
                  <span aria-hidden="true" style={{ background: pal.raised }} />
                  <span aria-hidden="true" style={{ background: pal.card }} />
                </button>
              </Tooltip>
            )
          })}
          </div>
        }
      />
      {/* §6 access. Beside the theme because it answers the same kind of question
          about the same surfaces, and it borrows the theme's own "Match system"
          wording rather than inventing a second phrase for one idea. */}
      <PrefRow
        label={t('settings.appearance.contrast.title')}
        sub={t('settings.appearance.contrast.hint')}
        changed={contrast !== 'auto'}
        control={
          <Toggle
            ariaLabel={t('settings.appearance.contrast.aria')}
            value={contrast}
            onChange={saveContrast}
            options={[
              ['auto', t('settings.appearance.match.label')],
              ['more', t('settings.appearance.contrast.more.label')],
            ]}
          />
        }
      />
      </PrefGroup>
      {/* THE GROUP'S HEADING IS THE ONLY HEADING. "2 · What it is made of" sat
          directly above a MonoLabel reading "Material", which is one thing said
          twice — the standing rule, and visible as two stacked labels the moment
          the groups landed. */}
      <PrefGroup index={2} title={t('settings.appearance.group.material.title')} aside={t(MAT_SET_LABELS[materialSet])}>
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

      {/* WHAT THE MATERIALS DO WITH LIGHT, behind a door. Four dials per tile and
          twenty-seven tiles is a hundred and eight numbers, and standing them open
          under a picker most readers will use once would bury the accent and the
          sizes below them. The door names the tile it is about, because the answer
          to "less shiny" is almost always about ONE material rather than all of
          them — which is also why an edit is stored per tile rather than as a
          global multiplier.

          THE FIVE GLASS DIALS ARE NOT HERE. Clarity, refraction, bevel, fringe and
          gain only mean anything with the lens, and the lens ships with the
          true-glass toggle or not at all. */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip label={t('settings.appearance.phys.open.tip')}>
            <GhostButton icon={<IconSliders />} keepLabel onClick={() => setPhysOpen(true)}>
              {t('settings.appearance.phys.title')}
            </GhostButton>
          </Tooltip>
          <InfoDot title={t('settings.appearance.phys.title')} text={t('settings.appearance.phys.info.body')} />
        </div>
      </div>
      <FormModal open={physOpen} onClose={() => setPhysOpen(false)} title={t('settings.appearance.phys.title')} maxWidth={620}>
        <MaterialPhysics
          tiles={MAT_SETS[materialSet]}
          tweaks={texTweak}
          onChange={saveTweaks}
          glass={trueGlass}
        />
      </FormModal>

      </PrefGroup>
      <PrefGroup index={3} title={t('settings.appearance.group.saved.title')} aside={t('settings.appearance.group.saved.aside', { n: saved.length, cap: SAVED_THEME_CAP })}>
      {/* THE LOOKS YOU HAVE SAVED. Six fields travel together in one — both
          grounds, the accent, the material set, the tiles and the dials — because
          a ground chosen against one accent is a different decision against
          another, so switching between two looks is one press instead of six.

          FOUR IS THE CAP AND IT IS THE DESIGN. A fifth turns a set of looks you
          switch between into a list you maintain: naming them, tidying them,
          wondering which of two near-identical ones is the good one. */}
      <div className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonoLabel>{t('settings.appearance.saved.title')}</MonoLabel>
          <InfoDot title={t('settings.appearance.saved.title')} text={t('settings.appearance.saved.info.body')} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {saved.map((s2) => (
            <span key={s2.name} className="flex items-center gap-1">
              <GhostButton onClick={() => wearTheme(s2)}>{s2.name}</GhostButton>
              <FieldIconButton
                icon={<IconDelete />}
                danger
                ariaLabel={t('settings.appearance.saved.remove.aria', { name: s2.name })}
                tooltip={t('settings.appearance.saved.remove.aria', { name: s2.name })}
                onClick={() => saveList(removeTheme(saved, s2.name))}
              />
            </span>
          ))}
          {saved.length === 0 && <p className="microcopy">{t('settings.appearance.saved.none')}</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="tp-input"
            style={{ maxWidth: '18ch' }}
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            placeholder={t('settings.appearance.saved.name.placeholder')}
            aria-label={t('settings.appearance.saved.name.aria')}
            maxLength={24}
          />
          {/* THE BUTTON IS DEAD UNTIL THERE IS A NAME, because a look saved as ""
              draws a nameless row nobody can press. */}
          <GhostButton
            disabled={!themeName.trim() || (saved.length >= SAVED_THEME_CAP && !saved.some((x) => x.name === themeName.trim()))}
            onClick={() => { saveList(saveTheme(saved, getResolvedTheme(), themeName.trim())); setThemeName('') }}
          >
            {t('settings.appearance.saved.save.label')}
          </GhostButton>
        </div>
        {saved.length >= SAVED_THEME_CAP && <p className="microcopy mt-1">{t('settings.appearance.saved.full')}</p>}
        {/* THE FILE. Export is ONE theme — what you are wearing — rather than the
            list, because a file called "my theme" that turns out to hold four is a
            file nobody can share a look with. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <GhostButton icon={<IconExport />} onClick={exportTheme}>{t('settings.appearance.saved.export.label')}</GhostButton>
          <GhostButton icon={<IconRestore />} onClick={() => importPick.open()}>{t('settings.appearance.saved.import.label')}</GhostButton>
          {importPick.input}
        </div>
        {importError && <ErrorText>{t(`settings.appearance.saved.import.${importError}`)}</ErrorText>}
      </div>

      </PrefGroup>
      {/* GROUP 4 IS THE PACK'S "HOW MUCH A CONTROL SAYS", AND IT CARRIES MORE THAN
          THE PACK PUT IN IT. The pack's fourth group is label density alone. This
          app's theme section also holds true glass, the two cover-size sliders, the
          text size and the two quote-reading dials — none of which the pack's theme
          section has, because the pack never had them. They are all answers to "how
          much, and how big", which is what this group is about, so they are here
          rather than in a fifth group invented to hold them. */}
      <PrefGroup index={4} title={t('settings.appearance.group.density.title')}>
      {/* TRUE GLASS, AND IT IS OFF UNTIL ASKED FOR. A pane that really refracts
          needs a displacement field per surface, re-evaluated whenever anything
          behind it moves — and this repository already measured what that costs:
          ONE `blur(10px)` on the sheet scrim blew the frame budget on a phone and
          made the sheet drag stop tracking the finger. So it is a control rather
          than a default, and the app is complete without it.

          THE SWITCH IS NOT THE LAST WORD. A reader who has asked the system for
          reduced motion does not get it whatever this says, because a lens that
          warps the page as it scrolls underneath is exactly the load that
          preference is about — and that preference is a standing instruction
          where this toggle was set once. */}
      <PrefRow
        label={t('settings.appearance.glass.title')}
        sub={t('settings.appearance.glass.hint')}
        info={t('settings.appearance.glass.info.body')}
        changed={trueGlass}
        control={
          <Toggle
            ariaLabel={t('settings.appearance.glass.title')}
            value={trueGlass ? 'on' : 'off'}
            onChange={(v) => saveGlass(v === 'on')}
            options={[
              ['off', t('settings.appearance.glass.off.label')],
              ['on', t('settings.appearance.glass.on.label')],
            ]}
          />
        }
      />

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
        {/* §6 access, and beside the text size because they are the third and
            fourth answers to the same question — how easy is this to read. They
            set the QUOTE and nothing else: a reader narrowing a column of prose
            is not asking for a narrower app, and the interface already has its
            own dial one row up. */}
        <QuoteReadingFields prefs={prefs} onPreferences={onPreferences} />
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
        {/* WHICH LANGUAGES YOU CAN READ WAS HERE, and it is gone rather than
            moved. The owner's ruling absorbed it: the four text-order states say
            what the declaration said — declared meant the quotation leads,
            undeclared meant the translation did — plus two things a yes/no could
            not spell at all ("no translation", "no quotations"). Keeping both
            would be one fact with two controls, and the second would silently
            lose to the first.
            The table that replaced it lives with the language marks on Metadata,
            because that panel already is a row per language and a second list of
            the same languages would be two to keep in step. An account that still
            has the old preference is migrated on read — see textOrderFrom. */}
      </div>
      </PrefGroup>
      </>
      )}

      {/* THE LANGUAGE AND THE TYPE DOOR ARE THE `lang` PART, and they are drawn
          from this same function rather than from a second one. The v3 pack splits
          Settings into named sections and puts what the interface is WRITTEN IN
          under its own heading, away from what it LOOKS like — but the two halves
          share this card's preferences object and its one writer, so copying them
          into a `LanguageCard` beside this would be the second copy the repo's own
          directive exists to prevent. The screen passes which part it wants IN; it
          does not keep its own verb. */}
      {part !== 'theme' && (
        <>
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
            {/* WHICH LANGUAGES YOU CAN READ WAS HERE, and it is gone rather than
                moved. The owner's ruling absorbed it: the four text-order states say
                what the declaration said — declared meant the quotation leads,
                undeclared meant the translation did — plus two things a yes/no could
                not spell at all ("no translation", "no quotations"). Keeping both
                would be one fact with two controls, and the second would silently
                lose to the first.
                The table that replaced it lives with the language marks on Metadata,
                because that panel already is a row per language and a second list of
                the same languages would be two to keep in step. An account that still
                has the old preference is migrated on read — see textOrderFrom. */}
          {/* THE FOUR FACES ON THE PAGE, each with the words it will be set in.
              The pack draws them here; this app had every one of them behind the
              Type door, so the section a reader opens to choose a face showed a
              language picker and a button. A specimen you cannot see is a face you
              cannot choose, and choosing by name is choosing by reputation.

              WHAT STAYS BEHIND THE DOOR is everything else it holds — uploading a
              face, the per-role style modifiers, the size dials, the script check,
              and the per-language scope. That is the owner's split: the faces come
              out, the rest stays in, and the section stays a section rather than
              becoming the panel with a heading.

              THE ROWS ARE `fontStateFor`'s, THE SAME FUNCTION THE PANEL USES. It
              is pure and exported and already returns each role with the face
              chosen and the stack that role would draw with, so the specimen here
              is the same specimen the panel shows rather than a second opinion
              about what the type looks like.

              AND ONLY THE FOUR THE INTERFACE IS SET IN. The role table also holds
              Bengali and Devanagari, which are what a QUOTE in those scripts is
              set in rather than anything the interface wears — they belong to the
              panel's own scope picker and would read here as two more UI faces. */}
          <FaceSpecimens prefs={prefs} onOpen={() => setTypeOpen(true)} />

          {/* WHERE A MISSING LINE FALLS BACK TO, which the pack draws and this app
              did not offer at all. A translation is never complete on the day it
              lands, so every interface language has a second one standing behind
              it; the app has always had that behaviour and never a way to say
              which. */}
          <PrefRow
            label={t('settings.language.fallback.title')}
            sub={t('settings.language.fallback.hint')}
            changed={!!prefs?.localeFallback && prefs.localeFallback !== 'en'}
            control={
              <Toggle
                ariaLabel={t('settings.language.fallback.title')}
                value={prefs?.localeFallback || 'en'}
                onChange={(v) => {
                  onPreferences?.({ localeFallback: v })
                  json('PUT', '/auth/me/preferences', { localeFallback: v })
                }}
                options={[['en', 'English'], ['bn', 'বাংলা']]}
              />
            }
          />

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
        </>
      )}
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

// THE LEADING IS NAMED AND THE MEASURE IS COUNTED, and that difference is not an
// inconsistency. "1.55" is a ratio between a line box and a font size, which is
// nothing a reader is holding in their head; "66 characters" is the thing the
// typographic rule is actually stated in and the thing they can see on the page.
// So one control shows five names and the other shows the number, because that is
// which half of each is legible.
const LEADING_NAMES = ['tight', 'snug', 'normal', 'relaxed', 'loose']

// QuoteReadingFields — the quote's leading and measure, in the shape of the
// fields around them.
//
// LIKE TextSizeField AND UNLIKE persist: each writes its ONE field. The Appearance
// card's `persist` re-sends every theme field on any change, so a preference
// riding in that object is wiped by an unrelated accent click — the same note
// applyLabels and saveContrast already carry, for the same reason.
export function QuoteReadingFields({ prefs, onPreferences }) {
  // Applied before the request, like every other control on this card: a round
  // trip between the tap and the type is long enough to read as a broken control.
  // The old preferences go back on if the server refuses, so the page never shows
  // a setting the account does not have.
  async function set(patch) {
    applyTypeScale({ ...(prefs || {}), ...patch })
    const r = await json('PUT', '/auth/me/preferences', patch)
    if (!r.ok) {
      applyTypeScale(prefs || {})
      return
    }
    onPreferences?.(patch)
  }

  // EACH EXPLAINS ITSELF WITH AN InfoDot, LIKE BOTH ITS NEIGHBOURS, and the first
  // draft got this wrong in a way only a layout would have shown. The shared
  // sentence under the pair was a bare <p> in a `flex flex-wrap` row whose every
  // other child is a <div>, and `.microcopy` carries no max-width — so a
  // 150-character sentence became an unconstrained flex item, wide enough to force
  // a wrap and push the fields after it onto a new line. The row's own rule is the
  // repo's: a control drawn beside others behaves like them, and the two beside
  // these (`TextSizeField`, `LabelDensity`) answer with a dot rather than prose.
  const dial = (key, value, onChange, options) => (
    <div>
      <MonoLabel className="mb-1.5 flex items-center gap-1">
        {t(`settings.appearance.${key}.label`)}
        <InfoDot
          text={t(`settings.appearance.${key}.info.body`)}
          title={t(`settings.appearance.${key}.label`)}
        />
      </MonoLabel>
      <Select
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={options}
        ariaLabel={t(`settings.appearance.${key}.aria`)}
        width={124}
      />
    </div>
  )

  return (
    <>
      {dial(
        'quote-leading',
        clampLeading(prefs?.quoteLeading),
        (n) => set({ quoteLeading: n }),
        QUOTE_LEADINGS.map((n, i) => [String(n), t(`settings.appearance.quote-leading.${LEADING_NAMES[i]}`)]),
      )}
      {dial(
        'quote-measure',
        clampMeasure(prefs?.quoteMeasure),
        (n) => set({ quoteMeasure: n }),
        QUOTE_MEASURES.map((n) => [
          String(n),
          n ? t('settings.appearance.quote-measure.chars', { n }) : t('settings.appearance.quote-measure.full'),
        ]),
      )}
    </>
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

// ---- 4. Users (§8.11, admin only) ----
//
// DELETED, not moved. This file carried a second AdminUsers component with no
// call site: a users list that could add and delete accounts and knew nothing
// about who may take whose rights away. Account.jsx's UserManagement is the
// one that renders, and the one the rules live in. Dead code that duplicates a
// live screen is worse than none — it reads as the implementation, and the
// next person to wire it up gets a page with none of the guards.

