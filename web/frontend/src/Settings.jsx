import LibraryFoldersGroup from './libraryFolders.jsx'
import { ScanShortcuts } from './SourceFilesConsole.jsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RuleSlider } from './sources.jsx'
import { coverImgURL, DEMO, json, errText, copyText, apiURL, upload as uploadFile, uploadWithProgress } from './api.js'
import { coversThatFit } from './coverFit.js'
import { useRowReorder } from './reorder.js'
import { ACCENTS, GROUNDS, PHYS, paletteFor, parseTweaks, physDirty, physFor, applyColors, applyContrast, applyLabels, applyTheme, CAT_NAME_MAX, CATEGORY_PALETTE, categoryState, contrastPrefValue, getResolvedTheme, LABELS_KEY, labelsPref, MAT_SET_LABELS, MAT_SETS, SLOT_PREFS, SLOTS, surfaceStyle, TILE_NAMES, UNSET_LABEL } from './theme.js'
import { QUOTE_LEADING_DEFAULT, QUOTE_LEADINGS, QUOTE_MEASURE_DEFAULT, QUOTE_MEASURES, SIZE_ROLES, TYPE_FACTORS, applyTypeScale, clampLeading, clampMeasure, factorsFrom, globalOf, renormalise, sizePrefKey } from './type.js'
import {
  ALL_FACES,
  applyFonts,
  faceFor,
  fontPatch,
  fontStateFor,
  quoteFaceFor,
  quoteFontPatch,
  quoteFonts,
  registerUploads,
  scriptProbe,
  serialiseFontStyles,
  specimenSample,
  stylesFor,
  uploadedFonts,
  verifyUpload,
} from './fonts.js'
import { FaceSelect } from './fontPicker.jsx'
import PREF_DEFAULTS from './prefDefaults.json'
import { CardHead, PrefColumns, PrefGroup, PrefRow } from './prefRow.jsx'
import { glassDialsFor } from './glassLens.js'
import { applyFields, fromFile, parseSaved, removeTheme, SAVED_THEME_CAP, saveTheme, toFile } from './savedThemes.js'
import { SECTIONS, sectionOrder, visibleSections } from './routes.js'
import { RESTART_FAILED, RESTART_NEW, RESTART_SAME, waitForRestart } from './update.js'
import { LanguagePicker } from './locale.jsx'
import { languageMarksState } from './languages.jsx'
import { languageFor, scriptOf } from './iso639.js'
import { cachedVocabulary, primeSearchVocabulary } from './vocabulary.js'
import { createPortal } from 'react-dom'
import { fullKeys, localeActive, localeCatalogue, t, tNodes } from './i18n.js'
import { PASSPHRASE_MAX, PASSPHRASE_MIN, PASSWORD_MAX, passphraseProblem, sniffArchiveKey } from './secret.js'
import { SafetyBackupStep } from './safetyBackup.jsx'
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
  IconCheck,
  IconChevron,
  IconClose,
  IconCopy,
  IconDelete,
  IconDevice,
  IconExport,
  IconJobs,
  IconEye,
  IconEyeOff,
  IconKey,
  IconOpen,
  IconLanguages,
  IconMoveTo,
  IconPalette,
  IconUpdate,
  IconRestore,
  IconReset,
  IconSliders,
  IconLayers,
  IconType,
  FilePick,
  IconUpload,
  InfoDot,
  isPartialDate,
  MobileSheet,
  MonoLabel,
  PageHeader,
  Placeholder,
  SCRIM_CENTERED,
  SectionTitle,
  Select,
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
  CheckBox,
  IconGrip,
  useScreenBar,
  useScreenSearch,
  usePersistedState,
} from './ui.jsx'
import {  } from './people.jsx'
import {  } from './personOpen.jsx'
import { SectionRail } from './sectionRail.jsx'
import { JobsCurrentCard, JobsPastCard, SystemLogsCard } from './jobsSection.jsx'
import { CommonJobsCard } from './commonJobs.jsx'
import { jobWaitingText, queueNotice, readJobsSummary, useKindJob } from './jobs.js'

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
const WIKI_BASE = 'https://github.com/aaronified/tippani/wiki/'

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
// DEVICES IS BACK. It was hidden ("hide the devices settings. that was created for
// the app. not required right now"), with the card, its strings and every
// `/auth/devices` route kept so that putting it back was one word. The Android
// app exists now (aaronified/tippani-app) and pairs with a code from this card, so
// it is registered again, on the Server section, for EVERY reader: pairing a phone
// is an account act and not an admin one, unlike the rest of that section.
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
// THE FOUR JOBS CARDS ARE THE LAST FOUR, and 'logs' is built for an admin only,
// exactly as 'server' is: registering it is what draws it, and a reader has no
// business with the server's own log.
export const SETTINGS_CARDS = ['features', 'server', 'devices', 'jobs-current', 'jobs-common', 'jobs-past', 'logs']

// ---- THE SIX SECTIONS -------------------------------------------------------
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
  ['sections', 'settings.section.sections.label', 'move'],
  ['server', 'settings.section.server.label', 'device'],
  // JOBS IS FOR EVERY READER, and last. Everybody's fills and lookups are jobs
  // now, so everybody has a queue to look at and a Stop to press; an admin's copy
  // of the section adds the system logs and everyone's queue rather than being a
  // different section.
  ['jobs', 'settings.section.jobs.label', 'jobs'],
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
  move: <IconMoveTo />,
  device: <IconDevice />,
  jobs: <IconJobs />,
}

export const SECTION_CARDS = {
  theme: ['appearance'],
  lang: ['language'],
  sections: ['features'],
  // DEVICES AFTER THE ADMIN CARD, and drawn for everyone: a reader who is not an admin has no Server
  // card, so for them this section is the pairing card alone.
  server: ['server', 'devices'],
  // COMMON JOBS SECOND, under what is running now: it is where a reader starts
  // the jobs they run most, and what they start there appears in the card above.
  jobs: ['jobs-current', 'jobs-common', 'jobs-past', 'logs'],
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
// ALL_SECTIONS — the `resetting` state's value for "every section", and a name
// rather than a bare '*' because it travels through three places: the menu row
// that sets it, the confirm that words itself from it, and the reset that reads
// which keys it means. A section id it could collide with would be a section
// called '*'.
export const ALL_SECTIONS = '*'

export const SECTION_PREFS = {
  theme: [
    'theme', 'accent', 'contrast', 'materialSet',
    'groundLight', 'groundDark', 'texTweak', 'trueGlass', 'savedThemes',
    'tileGround', 'tileShell', 'tileCard', 'tileCover',
    'quoteLeading', 'quoteMeasure',
  ],
  lang: [
    'locale', 'localeFallback', 'textOrder', 'readLanguages', 'languageMarks',
    'fontsByLanguage', 'fontsByLocale', 'voicesByLanguage',
    'fontDisplay', 'fontUi', 'fontMono', 'fontHand', 'fontBengali', 'fontDevanagari',
    'fontDisplayStyle', 'fontUiStyle', 'fontMonoStyle', 'fontHandStyle',
    'fontBengaliStyle', 'fontDevanagariStyle',
    'sizeDisplay', 'sizeUi', 'sizeMono', 'sizeHand',
  ],
  sections: [
    'hideLibrary', 'hideCatalogue', 'hideQuotes', 'showAnthologies', 'sectionOrder',
  ],
  // SERVER OWNS NONE. `trashDays` was listed here and is not a Server control at
  // all — it is set on the Bin, which is where a reader changes how long the bin
  // keeps things. Counting it here put a "1 changed" on a tab for something not on
  // it, and Reset section would have silently reset the Bin's retention from a
  // screen that never showed it. What Server holds are ACTS (check, back up,
  // restore) and one admin setting the server keeps itself (the release channel,
  // via /admin/update/channel) — none of them a user preference this table is for.
  server: [],
  // JOBS OWNS NONE EITHER, for Server's reason: what it holds are acts — stop,
  // run again, export — and a filter on a list, none of them a stored preference.
  jobs: [],
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
  // `trashDays` IS SET ON THE BIN, NOT IN SETTINGS. It was listed under the Server
  // section, which owns no screen it appears on: the reader changes how long the
  // bin keeps things from the Bin itself. Counting it there put a "1 changed" on a
  // tab for something not on it, and Reset section would have reached across and
  // silently reset the Bin's retention. It is excused here rather than moved,
  // because there is no Settings section it belongs to — the screen that owns it
  // is not one of these five.
  'trashDays',
  'tour', 'tourStep', 'defaultBoardId', 'creditSeparators',
  // THE REVIEW SCHEDULE'S OWN SETTINGS, stored by the server and read by it. The
  // Review section that wrote them is cut from the web app (ADR-0936), so no screen
  // here sets them and nothing here can reset them. Excused rather than dropped, so
  // the server's keys stay accounted for by this file.
  'srDaily', 'srReviewScope', 'srQuestions', 'srTuning', 'srSeen',
  'srPracticeCounts', 'srLadder', 'srTier', 'srStart', 'srSubmit',
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

// changedEverywhere — the same count over every section at once, which is what a
// whole-screen reset is offering to undo.
//
// OVER SECTION_PREFS AND NOT OVER `prefs`. A reset can only clear keys some
// section claims, so counting anything else would arm the row for a preference
// the press cannot touch. Sections are disjoint by construction — a key in two of
// them would be counted twice here and cleared twice by the reset, which is the
// same no-op — so this is a sum rather than a union.
export function changedEverywhere(prefs) {
  return Object.keys(SECTION_PREFS).reduce((a, id) => a + changedIn(prefs, id), 0)
}

// resetKeysEverywhere — every key a whole-screen reset clears. Deduplicated,
// because the route deletes by name and sending one twice is a longer body saying
// the same thing.
export function resetKeysEverywhere() {
  return [...new Set(Object.values(SECTION_PREFS).flat())]
}

// sectionPill — the number as the reader reads it, AND NOTHING WHERE THERE IS NO
// NUMBER. It used to answer "all default" for a section with nothing set, on the
// reasoning that a zero invites you to look for the nine things that are not zero.
// The owner, looking at it on a screen: *"The difference count 'all default' can be
// absent (it says nothing of worth)."* They are right, and the reasoning was half a
// thought: a pill that reads "all default" on four sections out of five is a pill a
// reader stops reading, which costs the fifth one its meaning. The count is worth a
// place only when there is something to undo.
export function sectionPill(n) {
  return n > 0 ? t('settings.changed.count', { n }) : null
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
  // THREE PREFIXES FOR ONE CARD. Server is a single tile holding Updates, Backup
  // and What changed, as the pack draws it — so the words a reader might search
  // for live under three roots, and a card that could only declare one would go
  // missing the moment somebody typed "backup".
  server: ['settings.updates.', 'settings.backup.', 'settings.changelog.'],
  devices: 'settings.devices.',
  // One root per jobs card, so typing "stop" finds the card whose Stop all it is
  // and "export" the two that export.
  'jobs-current': 'settings.jobs.current.',
  'jobs-common': 'settings.jobs.common.',
  'jobs-past': 'settings.jobs.past.',
  logs: 'settings.logs.',
}

// settingsMatches — does this card answer to what was typed?
//
// EXPORTED AND PURE, because it is the one part of this that is a function rather
// than a screen: given a card and a query it either matches or it does not, and that
// is checkable without mounting Settings at all.
export function settingsMatches(cardKey, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const declared = SETTINGS_PREFIX[cardKey]
  if (!declared) return false
  const prefixes = Array.isArray(declared) ? declared : [declared]
  for (const key of fullKeys()) {
    if (!prefixes.some((p) => key.startsWith(p))) continue
    if (!key.endsWith('.title') && !key.endsWith('.label')) continue
    if (t(key).toLowerCase().includes(q)) return true
  }
  return false
}

export default function Settings({ user, onPreferences, update, onUpdateInfo, section: routed = null, onSection = null, onGo = null, onReviewJob = null }) {
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
  // THE SECTION IS THE ADDRESS, AND THE LAST ONE IS REMEMBERED. Two facts, and
  // they used to be one: the section lived only in localStorage, so it pushed no
  // history — the dock's Back key walked out of the whole screen and the page grew
  // its own second back arrow to make up for it, which is the second header the
  // owner reported. It is a route now (`/settings/<section>`), so Back walks out of a
  // section into the index and a section can be linked to.
  //
  // THE REMEMBERED ONE IS WHAT A BARE ADDRESS RESOLVES TO, not a replacement for
  // the address: "somewhere you come back to, usually for the thing you were last
  // looking at" is still true, and landing on Theme every time is the scroll the rail
  // was supposed to have removed. So the address wins where there is one, the
  // memory answers where there is not, and every change writes both.
  const [remembered, remember] = usePersistedState('tippani:settings:section', 'theme')
  const known = (id) => SETTINGS_SECTIONS.some(([k]) => k === id)
  const section = known(routed) ? routed : known(remembered) ? remembered : 'theme'
  const setSection = (id) => { remember(id); if (onSection) onSection(id) }
  const [backupNow, setBackupNow] = useState(false)
  const [updateNow, setUpdateNow] = useState(false)
  // WHAT THE SHELL'S FIELD IS ASKING ABOUT WHILE THIS SCREEN IS UP.
  const [q, setQ] = useState('')
  // …EXCEPT ON JOBS, FOR AN ADMIN, WHERE IT SEARCHES THE SYSTEM LOGS. The omnibar
  // rule is that the bar searches what you are looking at, and on that section
  // what an admin is looking at is a log with a keyword filter. So the keyword
  // lives HERE, and this screen publishes one context or the other — never both:
  // two publishers of one bar settle on whichever effect ran last, which is a
  // child before its parent on every render and the reverse on some.
  //
  // "OPEN" MEANS ON SCREEN. On a desk the remembered section is drawn beside the
  // tabs; on a phone the index is drawn until a section is routed, and the bar
  // over the index is still Settings' own.
  const [logsQ, setLogsQ] = useState('')
  const logsHere = !!user.is_admin && (mobile ? routed === 'jobs' : section === 'jobs')
  useScreenSearch(logsHere
    ? { key: 'settings-logs', label: t('shell.search.where.logs'), onQuery: setLogsQ }
    : { key: 'settings', label: t('shell.search.where.settings'), onQuery: setQ })
  // The bar empties itself when its context changes (App's TopBarSearch), so the
  // context it left must empty too: a Settings filter still holding "backup" would
  // go on hiding sections behind a field that no longer shows the word.
  useEffect(() => {
    if (logsHere) setQ('')
    else setLogsQ('')
  }, [logsHere])
  useScreenBar({
    // WHO YOU ARE, UNDER THE WORD "SETTINGS". It was a mono label inside
    // .page-header, and on a phone that header has its <h1> visually hidden —
    // so "admin" became the only thing left in it and took a whole sticky row to
    // say one word. The shell's own bar already draws the screen's name with a
    // sub-line under it, which is where a caption for a title belongs.
    sub: mobile ? (user.is_admin ? t('account.users.admin.chip') : user.username) : null,
    keys: mobile && user.is_admin ? [
      { id: 'backup', label: t('settings.backup.now.label'), icon: <IconArchive />, onClick: () => setBackupNow(true) },
      { id: 'update', label: t('settings.updates.now.label'), icon: <IconUpdate />, onClick: () => setUpdateNow(true) },
    ] : null,
    // RESET EVERY SECTION — the one verb this screen has that no card can carry,
    // because it is about all five of them at once. The tab row's Reset section is
    // scoped to the tab you are on and the phone has no tab row at all, so before
    // this there was no way to undo a whole configuration except five presses and
    // five confirms.
    //
    // ⋯ RATHER THAN A BUTTON ON THE SCREEN, and the rule is the repo's own: what
    // is genuinely rare goes behind a door. A reader resets everything once, if
    // ever; a control for it standing on the index would be the most prominent
    // thing on a screen whose job is the five doors under it.
    //
    // ABSENT, NOT DISABLED, WHEN NOTHING IS SET. Same reasoning as the tab row's:
    // it is the one row here that DOES something, and a greyed row a reader cannot
    // press is a row they have to read to find that out. The menu still has Help,
    // so it is never the empty card the shell's note warns about.
    //
    // ON EVERY SECTION PAGE AS WELL AS THE INDEX, because this builder belongs to
    // the screen and the sections are not screens — they are this one, routed. The
    // count in the row is app-wide either way, which is the point: from inside
    // Review it says how much is set everywhere, not how much is set here.
    actions: () => {
      const n = changedEverywhere(user.preferences || {})
      return n > 0
        ? [{
            id: 'reset-all',
            icon: <IconReset size={24} />,
            label: t('settings.reset.all.label'),
            danger: true,
            onClick: () => setResetting(ALL_SECTIONS),
          }]
        : []
    },
  })
  const cards = {
    features: <FeaturesCard prefs={user.preferences} onSaved={onPreferences} />,
    // THE BIN AND STRAY-MARKS TILES ARE GONE FROM HERE. Both were doors and
    // nothing else — a count, a state, and a button to a page that already showed
    // both. The rail and the ☰ menu now carry a counted row to each (stray marks
    // as half of Checks), which is a door visible from every screen rather than
    // one you have to remember lives in Settings. A tile that restates a page's
    // own summary is a second copy to keep in step, and this pair had already
    // drifted: the tile counted /cleanup's open bucket while the page counted
    // whichever bucket you last looked at.
    // EVERY READER'S QUEUE, and the past thirty days of it. The backup prompt is
    // handed in so a backup run again asks for its credential through the prompt
    // that sealed it the first time, not a second copy of it.
    // PAIRING IS EVERY READER'S: the code is minted for the signed-in account, and revoking a phone is the
    // account's own act. See SETTINGS_CARDS.
    devices: <DevicesCard />,
    'jobs-current': <JobsCurrentCard user={user} />,
    // The four a reader runs most, each in a place of its own; Back up now asks
    // for its credential through the same prompt the Server card uses.
    'jobs-common': <CommonJobsCard user={user} credentialPrompt={(props) => <BackupPrompt {...props} />} />,
    'jobs-past': <JobsPastCard user={user} onReview={onReviewJob} credentialPrompt={(props) => <BackupPrompt {...props} />} />,
    ...(user.is_admin
      ? {
          server: (
            <ServerCard
              user={user}
              update={update}
              onUpdateInfo={onUpdateInfo}
              updateAsking={updateNow}
              onUpdateAsking={setUpdateNow}
              backupAsking={backupNow}
              onBackupAsking={setBackupNow}
            />
          ),
          logs: <SystemLogsCard q={logsQ} onQuery={setLogsQ} />,
        }
      : {}),
  }
  const cardsByKey = { appearance: <Appearance prefs={user.preferences} onPreferences={onPreferences} part="theme" />,
    // onGo IS THE DOOR OUT, and only this half has one: Language and font carries
    // the pack's door to Metadata, because what the interface is written in and
    // what your library is written in are two questions a reader confuses until
    // one of them says where the other lives.
    language: <Appearance prefs={user.preferences} onPreferences={onPreferences} part="lang" onGo={onGo} />,
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
  // AND IT WRITES — TO THE ROUTE THAT CAN CLEAR, WHICH THE ORDINARY PUT CANNOT.
  //
  // This called `onPreferences` and stopped: that is App's local `setUser`, so
  // the press emptied the screen and kept nothing. Set How hard to Hard, press
  // Reset section, reload, and Hard was back.
  //
  // ADDING THE ORDINARY PUT DID NOT FIX IT, and the reason is worth keeping. Its
  // convention is that an empty value means "leave this alone" — `if in.SRDaily
  // != nil && *in.SRDaily != 0`, and the same guard on every string and number —
  // which is exactly what lets one card write its own field without clobbering
  // another's, and exactly what makes it unable to clear. Sending "" for ten keys
  // was a no-op for six of them and a 400 for the whole body because of the other
  // four: `srSeen` is a float and `srPracticeCounts`, `srLadder` and `srSubmit`
  // are bools, and none of them unmarshals from a string. So nothing was written,
  // which is how a green suite and a working-looking button coexisted.
  //
  // The reset route DELETES the keys, and `loadPrefs` supplies each default on
  // read — one home for every default, rather than a table of them here that
  // would start lying the day one moved.
  //
  // `'*'` IS EVERY SECTION AT ONCE — the ⋯ menu's row. One function rather than
  // two because the only difference between the two resets is which keys are
  // named: the write, the local patch and the confirm are identical, and written
  // twice the day one of them learns something the other would not.
  const resetSection = (id) => {
    const keys = id === ALL_SECTIONS ? resetKeysEverywhere() : (SECTION_PREFS[id] || [])
    // THE LOCAL PATCH IS THE DEFAULT, NOT AN EMPTY STRING, AND THAT WAS A BUG THIS
    // CONTROL MADE VISIBLE. `changedIn` counts a key as changed when its value
    // differs from `PREF_DEFAULTS[k]` — and `''` differs from `"system"`, so
    // clearing a key locally made it read as SET. The screen therefore went on
    // offering the reset it had just performed, over a confirm reading "9
    // preferences go back to their defaults" with nothing set, and the tab row's
    // pill read "9 changed" for a section that was stock. It corrected itself on
    // the next load, which is the shape of defect a reload hides: both `gone`
    // assertions were written after a `goto` and passed straight over it.
    //
    // WHAT THE SERVER WILL HAND BACK IS THE ONLY RIGHT VALUE HERE. The route
    // DELETES the keys and `loadPrefs` supplies each default on read, so the local
    // state that agrees with the server is the default — `''` only for the keys
    // that have none, where the zero value IS the default.
    const patch = {}
    for (const k of keys) patch[k] = k in PREF_DEFAULTS ? PREF_DEFAULTS[k] : ''
    onPreferences?.(patch)
    json('POST', '/auth/me/preferences/reset', { keys })
    setResetting(null)
  }

  const matching = (key) => settingsMatches(key === 'language' ? 'appearance' : key, q)
  const liveSections = SETTINGS_SECTIONS.filter(([id]) =>
    (SECTION_CARDS[id] || []).some((k) => cardsByKey[k] && matching(k)))
  const current = liveSections.some(([id]) => id === section) ? section : (liveSections[0] || [])[0]
  const shown = current ? (SECTION_CARDS[current] || []).filter((k) => cardsByKey[k] && matching(k)) : []

  // ── WHAT EACH SECTION PUTS ON THE PHONE'S INDEX ─────────────────────────────
  //
  // The owner's ask, and the standing rule behind it: "use the space available,
  // think like the user, whatever will be used more needs to be up front." The
  // phone's Settings home was five doors and then most of a screen's height of
  // nothing under them, so the handful of controls a reader actually opens
  // Settings FOR sat one press behind an empty surface.
  //
  // PHONE ONLY, AND THE DESKTOP IS UNTOUCHED. A desk has the tab row and the
  // section beside it in one view, so the same controls would be the same rows
  // drawn twice on one screen — which is the "a row says a thing once" rule
  // broken by a shortcut to something already visible.
  //
  // THE SECTION PAGE IS UNCHANGED TOO. These are shortcuts, not a move: every
  // control here is still where it was, with everything around it that did not
  // fit. A card that replaced the section would have cost the rows it cannot
  // carry.
  //
  // EACH SLICE IS RENDERED BY THE COMPONENT THAT OWNS THE CONTROL, never by a
  // copy of it here. That is the repo's "two things that look the same behave the
  // same" — a second mode toggle written in this file would be right on the day
  // it was written and quietly wrong from the first time the real one changed. So
  // the four cards take a `compact` prop and answer with their own two or three
  // rows; Server is the exception only because its verbs were already separate
  // components and already wired to this screen's own prompts.
  const sectionActions = mobile ? {
    theme: <Appearance prefs={prefs} onPreferences={onPreferences} compact />,
    lang: <Appearance prefs={prefs} onPreferences={onPreferences} part="lang" compact />,
    sections: <FeaturesCard prefs={prefs} onSaved={onPreferences} compact />,
    // THE SAME TWO VERBS THE DOCK CARRIES, through the same state, so the
    // confirm a reader meets is the one they would have met from the dock. The
    // version rides with them because it is the fact those two presses are about
    // — "am I behind?" is the question, and a button with no version beside it
    // cannot answer it.
    ...(user.is_admin ? {
      server: (
        <>
          {/* `keepLabel`, MATCHING THE SECTION'S OWN COPIES OF THESE TWO VERBS.
              The Server section draws Back up now with `keepLabel` on the standing
              reasoning that a primary or destructive act keeps its words at every
              width — "neither 'save this' nor 'delete this permanently' is
              something a person should have to have learned already". The same
              verb on the index is the same decision, and the repo's rule is that
              two things that look the same behave the same. Without it these two
              would collapse to glyphs under the label preference while their twins
              one press away kept their words. */}
          <div className="section-index-verbs">
            <GhostButton icon={<IconArchive />} keepLabel onClick={() => setBackupNow(true)}>
              {t('settings.backup.now.label')}
            </GhostButton>
            <GhostButton icon={<IconUpdate />} keepLabel onClick={() => setUpdateNow(true)}>
              {t('settings.updates.now.label')}
            </GhostButton>
          </div>
          <p className="microcopy">
            {t('settings.updates.version.now', { v: user?.version || t('settings.updates.version.dev') })}
          </p>
          {/* THE LIBRARY GROUP'S TWO SHORTCUTS, the same component Metadata's index draws:
              Scan the folders, and the findings waiting on Checks. */}
          <ScanShortcuts />
        </>
      ),
    } : {}),
    // THE OWNER'S TILE: one red Stop all with its confirm, and how many jobs are
    // running and how many queued (F11, ruled 28 September) — the Current jobs
    // card itself, asked for its compact face, so the counts, the confirm and the
    // request are the ones inside the section.
    jobs: <JobsCurrentCard user={user} compact />,
  } : {}

  return (
    <section className="space-y-6">
      {/* NO PAGE HEADER AT ALL, on any width. It went from a phone first, for
          being a sticky row restating the bar directly above it; the same was true
          on a desk and took longer to see, because what survived there was a lone
          word — "ADMIN" — floating over the tabs. The owner, looking at it: "there
          is still a second header bar with 'admin'… Neither of which were in the
          prototype."

          THE PACK HAS NOTHING HERE: its desktop frame goes from the top bar
          straight into the tab row (settings-restructured.dc.html:120-122), and
          the shell's own breadcrumb already says Settings. A role is not a page
          title, and the users list is where somebody looks up who is an admin. */}
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
            countWord: t('settings.rail.count.word'),
            info: t(sectionInfoKey(id)),
            pill: sectionPill(changedIn(prefs, id)),
            // Drawn under the row on a phone's index and nowhere else — the rail
            // ignores it on a desk, where the section itself is already on screen.
            actions: sectionActions[id] || null,
          }))}
          value={current}
          // CONTROLLED ONLY WHERE THERE IS AN ADDRESS TO CONTROL IT WITH. Passing
          // `!!routed` unconditionally pinned the rail shut on every mount that has
          // no navigator — a test, a screen rendered on its own — because `false`
          // is a controlled value and `undefined` is the ask to keep your own.
          // Nine suites' worth of the phone flow reported the index where a section
          // should have been, which is exactly what a reader would have got.
          open={onSection ? !!routed : undefined}
          onChange={setSection}
          ariaLabel={t('settings.section.aria')}
          total={sectionPill(liveSections.reduce((a, [id]) => a + changedIn(prefs, id), 0))}
          // ONE CONTROL ON THE TAB ROW NOW, NOT TWO. The pack puts the info dot and
          // "Reset section" together at the right-hand end of the tab row
          // (settings-restructured.dc.html:134-138), and the dot was there because
          // nothing else named the section. The crumb names it now and carries the
          // dot with the name, which is where a reader looks for it; a second dot at
          // the far end of a tab row is a dot beside nothing.
          //
          // RESET STAYS, and only when there is something to reset. It is the one
          // control on this row that DOES anything.
          aside={current && {
            action: changedIn(prefs, current) > 0 && (
              <Tooltip label={t('settings.section.reset.tip', { section: t(liveSections.find(([id]) => id === current)[1]) })}>
                <GhostButton icon={<IconReset />} onClick={() => setResetting(current)}>
                  {t('settings.section.reset.label')}
                </GhostButton>
              </Tooltip>
            ),
          }}
        >
          <div className="space-y-6">
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
        title={resetting === ALL_SECTIONS
          ? t('settings.reset.all.confirm.title')
          : t('settings.section.reset.confirm.title', { section: resetting ? t(SETTINGS_SECTIONS.find(([id]) => id === resetting)[1]) : '' })}
        body={resetting === ALL_SECTIONS
          ? t('settings.reset.all.confirm.body', { count: changedEverywhere(prefs) })
          : t('settings.section.reset.confirm.body')}
        confirmLabel={resetting === ALL_SECTIONS
          ? t('settings.reset.all.confirm.verb')
          : t('settings.section.reset.confirm.verb')}
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
  const { ask, confirmDialog } = useConfirm()

  // Re-seed when the session prefs change under us — another tab, or the
  // account switching. categoryState reads the applied values, so this stays in
  // step with what is on screen rather than with a stale prop.
  useEffect(() => { setRows(categoryState()) }, [prefs])

  // `from` — WHICH ROWS TO COLLECT, because `unmake` clears a name in state and
  // then saves in the same tick: `rows` is still the old array inside this
  // closure, so collecting from it would put the cleared name straight back.
  async function save(patch, from = rows) {
    const next = { ...collect(from), ...patch }
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

  // unmake — one save, not three. `save` merges a patch over `collect(rows)`, so
  // the name has to be cleared in the ROWS as well as in the patch: collect reads
  // the live input value, and a patch alone would be overwritten by the field the
  // reader has not touched.
  async function unmake(row) {
    if (!(await ask(t('settings.colours.unmake.confirm.title', { name: row.label }), {
      body: t('settings.colours.unmake.confirm.body'),
      confirmLabel: t('settings.colours.unmake.cta'),
      danger: true,
      // NOTHING ABOUT A QUOTE CHANGES, so this is not the one-way act the bin
      // glyph otherwise promises — and the dialog's own reversibility line is
      // where the app says that everywhere else.
      reversible: true,
    }))) return
    const cleared = rows.map((r) => (r.slot === row.slot ? { ...r, name: '' } : r))
    setRows(cleared)
    await save({
      [`catName${row.slot}`]: '',
      [`catColor${row.slot}`]: '',
      [`catHidden${row.slot}`]: false,
    }, cleared)
  }

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
    <Card pad="" className="pref-group">
      {/* ITS HEAD IS "COLOURS", beside Tags and Stickers in Metadata's
          Categories section — the one thing that mounts this card. It was
          "Colour categories" under a tab that said "Colours"; the tab says
          Categories now, and this names which kind of category. */}
      <CardHead title={t('metadata.categories.colours.title')} />
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
                  icon={<IconReset />}
                  ariaLabel={t('settings.colours.reset.aria')}
                  onClick={() => save({ [`catColor${row.slot}`]: '' })}
                  tooltip={t('settings.colours.reset.tip')}
                />
              )}
              {/* ── UN-MAKE THE CATEGORY, which the pack draws as a trash act on
                  every non-fixed row (metadata.dc.html:741) and this card had no
                  verb for at all.

                  A CATEGORY IS A SLOT, NOT A ROW, so there is nothing to remove —
                  eight positions exist whether or not you have used them. What a
                  reader means by "delete this one" is that it stops being one they
                  MADE: its name, its colour and its hiding all go back to what the
                  app shipped. That took three separate acts, one of which was
                  selecting the text in a field and deleting it.

                  IT IS OFFERED ONLY ON A SLOT SOMEBODY HAS TOUCHED, because on an
                  untouched one it would do nothing — and a row of controls that do
                  nothing is what teaches a reader the controls here are inert.

                  AND NO QUOTE CHANGES, which is why the confirm says so rather than
                  the bin implying otherwise. The stored value never moves — this
                  section's own dot promises exactly that, so exports round-trip —
                  and a quote filed under this colour goes on being filed under it,
                  wearing the app's default name again. */}
              {!row.fixed && (row.name || row.custom || row.hidden) && (
                <FieldIconButton
                  icon={<IconDelete />}
                  danger
                  ariaLabel={t('settings.colours.unmake.aria', { name: row.label })}
                  onClick={() => unmake(row)}
                  tooltip={t('settings.colours.unmake.tip')}
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
      {confirmDialog}
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

// ── THE FACES, ON THE SCREEN A READER OPENS TO CHOOSE ONE ────────────────────
//
// THE TYPE PANEL IS GONE, AND THAT IS THE POINT OF THIS BLOCK. Every face the app
// uses lived behind a door on Language and font: the section itself showed four
// specimens that PICKED NOTHING — pressing one opened a modal, where a reader then
// expanded a role, then opened a list, then chose. Four presses to change a face,
// three to upload one, four to delete one. The pack draws all of it on the section
// (settings-restructured.dc.html:2649-2668): your own faces as pills in group 2,
// the interface's faces as rows with a picker apiece in group 3, and no door
// anywhere. That is what this is.
//
// WHAT THE PANEL HAD THAT THE PACK DOES NOT DRAW, kept rather than dropped: the
// per-language scope, the per-role size dials, the style modifiers and the script
// check. The pack has nowhere to put them because it never had them — so they sit
// on the rows they belong to, and only the modifiers are behind anything (one
// press, on the row itself, because five chips × six rows is a wall and a chip
// nobody presses is still a chip everybody reads).
//
// EACH ROW SETS ITS OWN ROLE'S REAL TEXT, not a specimen sentence. A type list
// that puts "The quick brown fox" in every face tells you nothing about the one
// question worth asking, which is how it looks doing THIS — the quote face
// setting a quote, the label face setting a locator, the hand face setting a
// margin note. It is also the only honest way to show the Bengali and Devanagari
// rows, whose whole point is a script the specimen sentence does not contain.
//
// Every alternate is BUNDLED, not fetched. The browser talks to nobody but this
// server, and a type picker that loaded Google Fonts would be the first thing in
// the app to reach a third party from it — on a screen about how your own words
// look. All OFL-1.1.

// FontRow — one role: its name, what it is for, the face it is set in, and the
// face doing that job underneath.
//
// THE SPECIMEN IS THE ROW'S SECOND LINE and not a door. It is the one part of a
// type list that cannot be read as a name, so it belongs beside the control that
// changes it rather than one press away from it.
function FontRow({ row, scope, script, factor, mine, warn, onFace, onStyle, onSize, onRevert }) {
  const [stylesOpen, setStylesOpen] = useState(false)
  const styles = stylesFor(row.key)
  // A MEASUREMENT IS NOT AN ANSWER UNTIL THE FONT IS LOADED, and the specimen
  // below is decided by one. `hasScript` asks the canvas how wide this face sets
  // a line of the script — and a canvas does not load a webfont, it only
  // measures what is already there. So the face a reader has just chosen
  // measures as though it had no Bengali in it, the row keeps its Latin line,
  // and nothing re-renders to correct that: a journey that uploaded a Bengali
  // face, gave it the interface and switched the app into Bengali watched the
  // specimen stay in English, which is the bug this state exists to end.
  //
  // `document.fonts.load` IS THE ONLY THING THAT ASKS FOR IT. Bumping a counter
  // when it resolves re-renders the row, which re-measures — so the rest state
  // is correct on its own and the load merely arrives at it sooner. A browser
  // with no font-loading API, or a face that fails to load, leaves the Latin
  // line standing, which is the honest answer to "could not tell".
  const [, setMeasured] = useState(0)
  const family = row.chosen?.family
  useEffect(() => {
    if (!family || !script || typeof document === 'undefined' || !document.fonts?.load) return
    let alive = true
    document.fonts
      .load(`40px "${family}"`, scriptProbe(script))
      .then(() => { if (alive) setMeasured((n) => n + 1) })
      .catch(() => {})
    return () => { alive = false }
  }, [family, script])
  return (
    <PrefRow
      label={t(row.label)}
      sub={t(row.what)}
      // A ROW WITH SOMETHING OF ITS OWN, and only under a named language: the
      // inherited scope IS the answer every language falls back to, so there is
      // nothing above it for a row to differ from.
      changed={!!scope && !!row.own}
      control={
        /* ONE ROW, AND THE BUTTONS STAY IN IT. This wrapped, so on a phone the
           style gear and the revert dropped onto a line of their own under the
           chooser — the owner: "the settings button should stay in the same row".
           The chooser is the only part that can give up width, so it is the only
           part that flexes; everything else holds its size and the row stays one
           row. */
        <div className="font-row-controls">
          {/* THE SAME CONTROL THE LANGUAGE TABLE USES for the same question —
              `FaceSelect`, drawing every option in its own face. The repo's
              directive is that a control on two screens lives in one function
              both call; this section used to answer the question with a button
              into a panel instead, which is how one of them goes on being right
              while the other quietly stops. */}
          {/* THE SCRIPT THE LIST IS BEING CHOSEN FOR — and, today, it names
              nothing here. Every face offered for a Latin role is Latin-only and
              has no entry in FACE_NAME_IN, so deleting this prop changes no pixel
              and no test; a rating found exactly that and it is worth saying
              rather than leaving a green suite to be read as proof. It stays
              because the rule is the same rule the quote rows use, and the day a
              face with a native name is offered for a role is the day a missing
              prop would be a silent gap. `no-latin-role-has-a-native-name` in
              test/pure/font-script-names.test.js fails on that day and points
              here. */}
          <FaceSelect
            className="font-row-face"
            faces={row.faces}
            uploads={mine}
            script={script}
            value={row.chosen.id}
            /* THE NAME A SCREEN READER HEARS, and for one row it is not the
               label. "Every language" heads the quote table and reads right
               under that heading — but an accessible name carries no heading with
               it, so on its own it says nothing about quotes while the rows under
               it all say "Typeface for quotes in German". `aria` on the role is
               that one row's fuller name; every other row has none and uses its
               label, which is already the whole answer. */
            ariaLabel={t('settings.type.face.aria', { name: t(row.aria || row.label) })}
            onChange={onFace}
          />
          {/* THE SIZE DIAL IGNORES THE SCOPE BESIDE IT, which is why that row says
              these FACES are for. A size is a reader's eyesight and their screen;
              a face is a taste about a language. Only the four roles that own a
              size have one: a script's glyphs take the size of the element they
              are drawn in. */}
          {SIZE_ROLES.includes(row.key) && (
            <SizeDial
              value={factor}
              ariaLabel={t('settings.type.size.aria', { name: t(row.label) })}
              onChange={onSize}
            />
          )}
          {/* ONE PRESS, AND ONLY FOR THE ROW YOU ARE WORKING ON. Bold, italic,
              small caps, all caps and tabular figures on all six rows at once is
              thirty chips on a screen whose job is showing four typefaces. */}
          <FieldIconButton
            icon={<IconSliders />}
            ariaLabel={t('settings.type.style.aria', { name: t(row.label) })}
            tooltip={t('settings.type.style.title')}
            aria-expanded={stylesOpen}
            onClick={() => setStylesOpen((v) => !v)}
          />
          {/* THE REVERT, AND ONLY WHERE THERE IS SOMETHING TO REVERT — the same
              glyph and the same condition the language rows and the text-order
              field already use, because "put this back" is one verb. A scope row
              with nothing of its own SHOWS what it would inherit, so a set row and
              an unset one look alike; this is what tells them apart. */}
          {scope && row.own && (
            <FieldIconButton
              icon={<IconReset />}
              ariaLabel={t('settings.type.scope.revert.aria', { name: t(row.label) })}
              onClick={onRevert}
              tooltip={t('settings.type.scope.revert.tip')}
            />
          )}
        </div>
      }
      said={
        /* dir="auto" and nothing else: the sample is the role's own words in
           whatever language this scope is for, and the first strong character
           decides which way it reads — in markup, which is W3C i18n's rule and
           what makes form controls and :dir() behave. */
        <p
          className="font-specimen"
          dir="auto"
          style={{
            // THE SCOPE'S OWN STACK, not `var(--font-quote-base)`. This section can
            // edit the faces for a UI language the reader is not in, and the
            // custom property is what the app is actually drawing — so a specimen
            // reading it would show English while the row above said Bengali.
            fontFamily: row.family,
            fontStyle: row.italic ? 'italic' : 'normal',
            // THE SPECIMEN ANSWERS THIS ROW'S OWN DIAL, which is what makes it a
            // preview rather than a picture: turn Labels up and the label
            // specimen grows while the others hold still.
            fontSize: specimenSize(row.key),
            letterSpacing: row.key === 'mono' ? '.08em' : 0,
          }}
        >
          {/* THE SPECIMEN FOLLOWS THE LANGUAGE, and only as far as the face can
              carry it. The owner's report was that changing the interface language
              left these lines in English. They are keys and always followed the
              interface — what was missing is that a LATIN-ONLY FACE CANNOT SHOW
              BENGALI: a Bengali line set in Newsreader draws the fallback's
              letterforms under Newsreader's name, which says something false about
              the face being chosen. So the line switches to the script being
              chosen for only where hasScript MEASURES that the face can draw it.

              AND THE LATIN SAMPLES IN bn.txt STAY LATIN, deliberately. An earlier
              draft of this comment claimed they had been translated; they have
              not, and a rating caught the claim. Translating
              vocab.font-role.display.sample into Bengali would put a Bengali
              sentence on a row whose three faces are Latin-only, which is the
              exact lie the rule above exists to prevent. `mono`'s is already
              Bengali and that is why it is the one row a Bengali reader sees
              change. */}
          {t(specimenSample(row, row.chosen?.family, script))}
        </p>
      }
    >
      {/* THE SCRIPT CHECK. Replace the Bengali face with something that has no
          Bengali in it and every Bengali quote turns into boxes, silently, with
          nothing on this screen to say why. It measures rather than parses — see
          hasScript — so it can be fooled both ways, and it is a warning rather
          than a refusal. Refusing somebody's own font on the strength of a metrics
          heuristic is worse than telling them what looks wrong. */}
      {warn === false && (
        <p className="microcopy" style={{ flexBasis: '100%', color: 'var(--error)' }}>
          {t('settings.type.script-warning.prose', { field: t(row.script ? row.label : 'vocab.script.latin.label') })}
        </p>
      )}
      {stylesOpen && (
        <div className="font-styles">
          {styles.map((st) => {
            const on = row.styles.includes(st.id)
            return (
              <button
                key={st.id}
                type="button"
                aria-pressed={on}
                className={'tp-filter-chip tactile' + (on ? ' active' : '')}
                onClick={() => onStyle(on ? row.styles.filter((x) => x !== st.id) : [...row.styles, st.id])}
              >
                {t(st.label)}
              </button>
            )
          })}
        </div>
      )}
    </PrefRow>
  )
}

// ── QUOTE FACES, ONE PER LANGUAGE ────────────────────────────────────────────
//
// THE OWNER'S FEATURE, in their own words: "a user like me, who grew up with
// Asterix, may want different languages shown in different fonts. To me, German
// should always have serif, while english is sans serif… And this is only for the
// quotes themselves. All else go by the ui fonts section."
//
// WHERE IT IS CHOSEN MOVED TWICE. A pop-up behind a button, then a group on
// this screen, and now a column of the language table in Metadata — the one list
// of languages there is. What stays here is the writer and the pieces the table
// draws with, so the save path is still this file's.

// useQuoteFaces — the one writer for a language's quote face, shared by the
// language table in Metadata, which is where the faces are chosen now. It was the
// body of a Settings group; the owner moved the choosing ("the quote font
// selection can be added to the metadata language screen") and a second copy of
// the save would be the second place a face is written.
//
// Applied first and asked after, like every other type control: the point of a
// face picker is watching the type move.
export function useQuoteFaces(prefs, onSaved) {
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState('')
  const live = draft || prefs || {}
  useEffect(() => { setDraft(null) }, [prefs])
  async function saveFace(key, token) {
    const patch = quoteFontPatch(live, key, token)
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
  return { live, err, saveFace, faceFor: (key) => quoteFaceFor(live, key) }
}

// THE SAMPLE IS THE LANGUAGE'S OWN NAME FOR ITSELF, drawn in the face being
// chosen: Deutsch in the serif you gave German, বাংলা in the Bengali face. It is
// the same test the script check makes and a reader can make it by eye — a face
// with no Bengali in it draws that row as boxes, on the row where it was picked.
export function QuoteFaceSample({ languageKey, name, face }) {
  // The autonym where this app knows one, and what the reader calls the language
  // where it does not: a sample has to be IN the script to say anything.
  const sample = languageFor(languageKey)?.autonym || name
  return (
    <span
      className="font-specimen quote-face-sample"
      dir="auto"
      style={{ fontFamily: face ? `'${face.family}'` : undefined }}
    >
      {sample}
    </span>
  )
}

// QuoteFaceSelect — which face one language's quotes are set in. THE LANGUAGE'S
// OWN SCRIPT, FROM ITS ISO TAG: this list is chosen for ONE language, so a face
// that can write it says so in the script it writes, and one that cannot does not
// pretend by wearing a Latin name beside the others.
export function QuoteFaceSelect({ languageKey, name, value, onChange }) {
  return (
    <FaceSelect
      faces={ALL_FACES}
      script={scriptOf(languageKey)}
      value={value || ''}
      inheritLabel={t('settings.languages.face.inherit')}
      ariaLabel={t('settings.languages.face.aria', { name })}
      onChange={onChange}
    />
  )
}

// QuoteFontsLink — what is left of the quote-face group on Settings: the door.
// The owner: "in settings, the quote font card will only carry the link to
// metadata/languages (on desktop, a half width card)." A face is a fact about a
// language, and the languages live in one table; two lists of them would disagree
// the first time a language was added to one.
function QuoteFontsLink({ onGo }) {
  return (
    <PrefGroup title={t('settings.quote-faces.title')}>
      <PrefRow
        label={t('settings.quote-faces.link.prose')}
        control={
          <GhostButton icon={<IconOpen />} keepLabel onClick={() => onGo?.('metadata', 'languages')}>
            {t('settings.quote-faces.add.open')}
          </GhostButton>
        }
      />
    </PrefGroup>
  )
}

// FontSections — groups 2, 3 and 4 of Language and font: your own faces, the
// faces the interface is set in, and the quote face each language carries.
//
// THE SCRIPT ROWS HAVE NO GROUP, and an earlier draft of this comment gave them
// one — which is the failure mode a comment has that code does not: it went on
// describing a group the same change deleted. Bengali and Devanagari are answered
// by the two controls below instead. A reader who wants Bengali set their own way
// picks the Bengali UI language in the scope, or the Bengali quote face in the
// panel; "which face draws this script, in general, everywhere" is the question
// neither of those is, and it is the one with no good answer.
export function FontSections({ prefs, onSaved, onGo, compact = false, quoteDefault = false }) {
  const { ask, confirmDialog } = useConfirm()
  const [err, setErr] = useState('')
  const [mine, setMine] = useState(uploadedFonts)
  const [busy, setBusy] = useState(false)
  // What the script check said about the face just assigned, per role. A WARNING
  // and never a refusal — see hasScript.
  const [warn, setWarn] = useState({})
  // WHICH LANGUAGE'S INTERFACE THESE FACES ARE FOR — AND IT IS THE ONE YOU ARE
  // READING IN, never a chooser of its own. The owner's ask: "the interface faces
  // do not need a 'these faces are for' because the language is selected above
  // anyway." It is right, and the row it removes was the redundancy: a picker of
  // languages sitting under a picker of languages, on a screen whose whole first
  // group is choosing one.
  //
  // THE SPEC IT STILL ANSWERS: "tippani is meant to be highly translatable… any
  // language that the user adds in via translation files should have a full ui
  // font picker." Every language still gets one — you reach it by BEING in that
  // language, which is also the only state in which the specimens below tell the
  // truth about what you will be reading.
  //
  // `localeActive()` AND NOT `localePref()`: a stored preference can name a
  // translation the operator has since removed, and the app then renders a
  // built-in. Editing the faces of a language nothing is drawn in would be a
  // control with no visible effect.
  const scope = localeActive()
  // THE SCRIPT THESE FACES ARE BEING CHOSEN FOR, which is what makes a name and a
  // specimen answerable: a face is named in Bengali on a Bengali interface if it
  // can draw Bengali, and in Latin if it cannot. `scriptOf` answers for all
  // ninety-one languages; most come back 'latin', where nothing changes.
  const script = scriptOf(scope)
  // WHAT THE READER CALLS THIS LANGUAGE, from the same catalogue the picker above
  // draws from — so the two always say the same word for the same locale.
  const scopeName = localeCatalogue().find((l) => l.code === scope)?.name || scope
  // The optimistic copy, cleared when the parent's prefs catch up with it. A
  // change is applied before the PUT answers — the whole point of a type picker is
  // watching the type move — and the rows are derived from prefs rather than held
  // as state, so without this they would snap back for one round trip.
  const [draft, setDraft] = useState(null)
  const live = draft || prefs || {}
  const rows = fontStateFor(live, scope)
  // THE SCRIPT ROWS ARE NOT DRAWN, and their absence is the point rather than an
  // oversight. Bengali and Devanagari were this app's first attempt at "my German
  // should be a serif": one face per SCRIPT, which cannot tell German from Swedish
  // and cannot tell a quote from a button. The owner's ruling on seeing the two
  // sitting beside the per-language panel — "the bengali and devnagari doesn't
  // need to be anywhere, right? because they will get added in metadata and show
  // up in the language wise font picker anyway."
  //
  // THE ROLES THEMSELVES STAY IN fonts.js, because they are still the tail of
  // every stack — a Bengali letter in a Latin-faced label has to land on
  // something, and that is what they are. What has gone is a CONTROL for them: a
  // reader who wants Bengali set their own way picks the Bengali UI language in
  // the scope above, or the Bengali quote face in the panel below, and both of
  // those are questions with an answer. "Which face draws this script, in general,
  // everywhere" is not.
  //
  // ── AND THE QUOTE ROW IS NOT ONE OF THEM. It sat here labelled "Quotes",
  // under a group headed "The interface's own faces", writing the variable that
  // every heading and the top bar read. The owner: "Why is there still a quote
  // font? This has to be through the quote fonts section… the interface font is
  // atkinson hyperlegible next. Why is the top bar using newsreader, which is set
  // as the quote font".
  //
  // BOTH HALVES OF THAT ARE ONE FAULT, and it was in the stylesheet rather than
  // here: one variable doing the quote job and the title job under the quote
  // job's name (see `--font-quote-base` in index.css). Chrome reads `--font-ui`
  // now, so the group above is what the interface is set in and nothing else
  // leaks into it — and this row goes where its question is asked, at the head of
  // the per-language quote table, as the answer every language falls back to.
  const uiRows = rows.filter((r) => !r.script && r.key !== 'display')
  const quoteBaseRow = rows.find((r) => r.key === 'display')

  useEffect(() => { setDraft(null) }, [prefs])

  // The four dials, read from the preferences this section was handed rather than
  // held as state of their own: the global dial in the accessibility group writes
  // the same four fields, and two copies of one number is how two controls come to
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

  // UPLOADING IS NOT ASSIGNING, and it used to be. The button was a fourth control
  // on every role row and it set the face it uploaded — which is why there were
  // six of it, and why the list of what you had uploaded was reachable only by
  // opening a role you did not want to change. A face is a thing you own; the rows
  // above are where you decide what to do with it.
  async function upload(file) {
    if (!file) return
    setBusy(true)
    setErr('')
    // The multipart helper, not json(): json() stringifies its body, which would
    // post the string "[object FormData]" and get a 400 nobody could read.
    const r = await uploadFile('/fonts', file)
    setBusy(false)
    if (!r.ok) return setErr(errText(r, t('error.upload.font')))
    await reloadUploads()
  }

  // THE VERIFIER, and it runs after the assignment rather than before it. The
  // check needs the face LOADED to measure it, and the honest thing to report is
  // what the reader is now looking at — not a prediction about it.
  // THE TOKEN RATHER THAN THE LIVE STATE, because a face can be assigned to a
  // scope the app is not rendering. Reading fontState() would measure whatever the
  // interface happens to be set to — which is unchanged when the scope is another
  // language, so an uploaded face with no Bengali in it would pass the check and
  // turn every Bengali label into boxes with nothing on screen to say why.
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

  // save applies FIRST and asks after, like every other control here: the whole
  // point of a type picker is seeing the change, and a round trip between the tap
  // and the type is long enough to make the control feel broken.
  //
  // ONE CALLER SHAPE FOR BOTH SCOPES. `field` is a role key, or a role key plus
  // "Style"; fontPatch turns it into the flat preference field or into this
  // locale's entry in the blob, and nothing here has to know which. `null` clears,
  // which is what the revert glyph sends and is not the same as "".
  //
  // AND IT IS ALWAYS APPLIED AGAINST THE RENDERING LOCALE, never against `scope`.
  // Editing Bengali's faces while the interface is in English must change nothing
  // on screen — applyFonts composes flat plus the ACTIVE locale's overlay, so it
  // already does exactly that, and the specimen is what shows the scope.
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

  const fontRow = (row) => (
    <FontRow
      key={row.key}
      row={row}
      scope={scope}
      // THE SCRIPT WAS COMPUTED HERE AND NEVER HANDED DOWN, which made both
      // halves of the script work dead on these rows: `script` was undefined
      // inside FontRow, so every face kept its Latin name and every specimen its
      // Latin line whatever language the reader was in. Nothing failed — the
      // rows look identical when the answer is "could not tell" — and it took a
      // journey uploading a real Bengali face to show it.
      script={script}
      factor={factors[row.key]}
      mine={mine}
      warn={warn[row.key]}
      onFace={(id) => {
        save({ [row.key]: id })
        if (String(id).startsWith('upload:')) checkScript(row.key, id)
      }}
      onStyle={(next) => save({ [row.key + 'Style']: serialiseFontStyles(next) })}
      onSize={(n) => saveSize({ [sizePrefKey(row.key)]: n })}
      onRevert={() => save({ [row.key]: null, [row.key + 'Style']: null })}
    />
  )

  // THE PHONE INDEX'S SLICE: the interface face, and only that one.
  //
  // THE OWNER NAMED IT — "language select + interface font" — and of the four
  // faces it is the right one to lift: it is the face the reader is looking AT,
  // on every screen, so the effect of changing it is immediate and total. The
  // quote face matters more to how a quote reads and is a choice made while
  // looking at quotes, which is what the section is for.
  //
  // THE SAME `FontRow` THE SECTION DRAWS, through the same `save`, `saveSize` and
  // script check — so an uploaded face is still warned about here, and the
  // optimistic apply still happens before the PUT answers, which is the whole
  // point of a type picker. A second, simpler face picker would have been a
  // picker that silently stopped warning.
  if (compact) {
    const ui = rows.find((r) => r.key === 'ui')
    return ui ? fontRow(ui) : null
  }
  // THE DEFAULT QUOTE FACE, FOR THE LANGUAGE TABLE. Metadata › Languages draws it
  // at the head of its table, beside the default for how much of the original a
  // quote shows — the owner's "default font selection will be in the top area".
  // The same `fontRow`, so its size dial, style chips and revert come with it and
  // through this section's one save path.
  if (quoteDefault) {
    return quoteBaseRow ? <>{fontRow(quoteBaseRow)}<ErrorText>{err}</ErrorText></> : null
  }

  return (
    <>
      {confirmDialog}
      {/* YOUR OWN FACES, WHICH EVERY LIST BELOW IS DRAWN FROM — so they come
          first, as the pack has them (group 2, beside the language rows). */}
      <PrefGroup title={t('settings.type.own.title')}>
        <PrefRow label={t('settings.type.added.title')} sub={t('settings.type.added.sub')}>
          <div className="font-pills" style={{ flexBasis: '100%' }}>
            {mine.length === 0 && <p className="microcopy">{t('settings.type.added.none')}</p>}
            {mine.map((f) => (
              <span key={f.id} className="font-pill">
                {/* THE NAME IN THE FACE IT NAMES. A list of uploads set in the
                    interface font is a list of strings; this is the only place
                    that says what you actually have. */}
                <span className="font-pill-name" style={{ fontFamily: `'${f.family}'` }}>{f.name}</span>
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
        </PrefRow>
        <PrefRow
          label={t('settings.type.add.title')}
          sub={t('settings.type.add.sub')}
          control={
            <FilePick
              className="tp-btn tp-btn-ghost tactile"
              accept=".woff2,.woff,.otf,.ttf,font/woff2,font/woff,font/otf,font/ttf"
              disabled={busy}
              onFiles={(f) => upload(f)}
            >
              <IconUpload />
              <span>{busy ? t('common.action.upload.busy') : t('settings.type.add.action')}</span>
            </FilePick>
          }
        />
      </PrefGroup>

      {/* THE INTERFACE'S OWN FACES. Full measure — the pack marks this group
          `wide: true`, and a specimen squeezed into half a column is a specimen
          you cannot judge. */}
      {/* WHOSE INTERFACE — SAID, NOT ASKED. It was a row with a language picker
          on it, under a group whose own first card picks the language; the owner's
          ask was to drop it, and what is left is the fact itself as subtext, the
          same shape the cover cards' "this device only" takes. */}
      <PrefGroup
        title={t('settings.type.faces.title')}
        sub={t('settings.type.faces.sub', { language: scopeName })}
        wide
      >
        {uiRows.map(fontRow)}
      </PrefGroup>

      {/* WHAT A QUOTE IS SET IN IS A QUESTION ABOUT ITS LANGUAGE, and the
          languages are one table in Metadata — so this group is only the door to
          it, half width, and the faces are chosen beside the rest of each
          language's settings. */}
      <QuoteFontsLink onGo={onGo} />
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


// UpdatesCard (admin only) — the version + update control. "Check for updates"
// queries GitHub on demand (never automatically); if a newer release exists it
// offers a one-click update when the Docker socket is mounted (pull + recreate
// via a one-shot Watchtower), and otherwise shows the manual command to run.
// Exported for `update-released.test.jsx`, which drives the card from the fields
// /auth/me actually sends. Mounting the whole Settings screen to read one row
// would make the case fail for a dozen reasons that are not this row.
// ── SERVER: ONE PANEL, THREE GROUPS, WHICH IS WHAT THE PACK DRAWS.
//
// WHAT THIS REPLACED. Server was the only section in Settings drawn as TWO tiles —
// Updates and Backup, each with its own border and its own SectionTitle — where
// every other section is one card of numbered groups and the pack draws this one
// the same way: Updates, Backup, and "What changed" at the foot
// (settings-restructured.dc.html:2749, :2754, :2760). Two bordered boxes for one
// subject is the "tabbed vs single tile" call the owner's rule gives to the
// prototype.
//
// AND IT IS ONE CARD KEY NOW, not two. The search index keys off a card's i18n
// prefix, so a single tile covering three subjects declares three prefixes —
// otherwise typing "backup" would hide the panel that holds it, which is the
// disappearance `test/rules/settings-search-prefix.test.js` exists to catch.
//
// THE ADMIN GATE STAYS WHERE IT WAS: this whole panel is registered only for an
// admin, the same as the two cards it replaces. Nothing here is drawn for anybody
// else, so nothing here has to ask again.
function ServerCard({ user, update, onUpdateInfo, updateAsking, onUpdateAsking, backupAsking, onBackupAsking }) {
  const current = user?.version || t('settings.updates.version.dev')
  return (
    <Card>
      <PrefColumns>
        <UpdatesCard
          user={user}
          update={update}
          onUpdateInfo={onUpdateInfo}
          asking={updateAsking}
          onAsking={onUpdateAsking}
        />
        <BackupCard user={user} asking={backupAsking} onAsking={onBackupAsking} />
        {/* The folders the library already lives in, mounted read-only, and whether a backup
            carries the files attached to works (libraryFolders.jsx). */}
        <LibraryFoldersGroup />
        {/* WIDE, because a release log is prose at full measure. A column of
            entries broken to half a card is a changelog nobody finishes. */}
        <PrefGroup title={t('settings.changelog.title')} wide>
          <ChangelogList current={current} />
        </PrefGroup>
      </PrefColumns>
    </Card>
  )
}

export function UpdatesCard({ user, update, onUpdateInfo, asking = false, onAsking }) {
  const current = user?.version || t('settings.updates.version.dev')
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

  // A GROUP, NOT A CARD OF ITS OWN. Server used to be the only section drawn as
  // two tiles — Updates and Backup, each with its own border and its own
  // SectionTitle — where the pack draws one panel of three groups and every other
  // section here is already one card. `ServerCard` is that panel; this returns its
  // first group.
  return (
    <>
      {updatePrompt}
      <PrefGroup title={t('settings.updates.title')}>
        {/* THE PACK'S TWO ROWS, IN THE SHAPE EVERY OTHER SECTION USES. It draws
            Updates as a Version row carrying its own state and a Check now
            button, then a Channel row (settings-restructured.dc.html:2749-2753);
            this was a stack of bare divs and MonoLabels inside a group — the last
            block on Settings that had not been given rows. What the pack has no
            place for and this keeps: the release date, the roadmap line, and the
            apply flow, which are this app's and sit under the rows they belong
            to. */}
        <PrefRow
          label={t('settings.updates.version.label')}
          said={
            <div className="space-y-1">
        <div className="flex items-baseline gap-2">
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
            </div>
          }
          control={
            <GhostButton onClick={check} disabled={busy || phase === 'applying'}>
              {busy ? t('settings.updates.check.busy') : t('settings.updates.check.label')}
            </GhostButton>
          }
        >
          {/* WHAT THE LAST CHECK SAID, under the row it is about — the pack's
              "Up to date · checked four minutes ago". It was a MonoLabel beside
              the button, which reads as a second control. */}
          {info && !info.update_available && !info.check_error && (
            <p className="microcopy" style={{ flexBasis: '100%', color: 'var(--ok)' }}>
              {t('settings.updates.current.label')}
            </p>
          )}
        </PrefRow>
        <div className="space-y-3">

        {/* What shipped is in the release notes above; what is still ahead — and where to
            ask for something, or say what is broken — is the roadmap. It belongs here
            rather than only under Reference, because "what version am I on" and "what is
            coming" are the same question asked twice. */}
        {/* tNodes, because the sentence carries a link and markup never goes in
            a locale value: the {roadmap} hole takes the anchor. */}
        <p className="microcopy" style={{ fontSize: 'var(--type-ui-13)' }}>
          {tNodes('settings.updates.roadmap.prose', {
            roadmap: (
              <a key="roadmap" className="tp-link" href={`${WIKI_BASE}Roadmap`} target="_blank" rel="noreferrer">
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
            {/* THE CHANGELOG BUTTON IS GONE, and the log it opened is a group at
                the foot of this panel. It answered "what is in the version I am
                running" — a question a reader on the Server screen is already
                asking, on a screen with room under it. A door with one thing
                behind it, next to the thing it is about, is a press for nothing. */}
            {/* Only after a check: before one, there is nothing to say which
                line this build is on, and a toggle that guesses would be
                asserting the very thing the check is for. */}
            {info && (
              <PrefRow
                label={t('settings.updates.channel.title')}
                info={t('settings.updates.channel.info.body')}
                sub={!info.channel_explicit
                  ? t(channel === 'prerelease'
                    ? 'settings.updates.channel.implied.prerelease.prose'
                    : 'settings.updates.channel.implied.stable.prose')
                  : null}
                control={
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
                }
              />
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
      </PrefGroup>
    </>
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

// THE RELEASE LOG, ON THE SCREEN. It was behind a button called "Changelog" that
// opened a dialog; the pack gives it a group of its own at the foot of Server —
// "What changed", a log column (settings-restructured.dc.html:2760). A door with
// one thing behind it, on a screen with room under it, is the shape this sweep has
// been taking apart everywhere else: "what is genuinely rare goes behind a door;
// what is merely detailed goes lower on the same screen."
//
// IT STILL FETCHES ONLY WHEN IT IS DRAWN, which was the dialog's own reason for
// being lazy — the history is a quarter of a megabyte of markdown. It is drawn
// only on the Server section, which is admin-only and is not where Settings opens,
// so the cost is the same as it was: paid by the reader who came to look.
// HOW MANY RELEASES STAND AT REST. The pack's own tour of Server says it: "The
// last two releases, with the rest behind Show more."
const LOG_AT_REST = 2

function ChangelogList({ current }) {
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

  // AN ANSWER WITH NO RELEASES IN IT IS NOT A CRASH, and this was one until the
  // log came out from behind its door. `!data` caught a response that had not
  // arrived; it did not catch one that arrived shaped differently, so `{}` fell
  // through to `data.releases.map` and threw. As a dialog that was survivable —
  // nothing rendered until somebody pressed the button, and a reader who never
  // pressed it never met the throw. On the screen it renders on every visit to
  // Server, so an old build, a proxy returning an empty object or a changelog
  // that failed to parse would take the whole section down rather than show one
  // line saying there is nothing to show.
  const releases = Array.isArray(data?.releases) ? data.releases : null
  // TWO RELEASES, AND THE REST BEHIND A PRESS — the pack's own shape for this
  // group, stated in its tour of Server ("The last two releases, with the rest
  // behind Show more") and drawn as a "Read the whole log" button under the list
  // (settings-restructured.dc.html:614, :3111).
  //
  // IT IS ALSO WHAT LETS THE LIST STOP SCROLLING ITSELF. As a dialog body this had
  // `max-height: 62vh; overflow-y: auto`, which was the dialog. On a page that is a
  // bare nested scroller with no fade and no way out — a hundred entries in 523px
  // inside a phone that already scrolls. Bounding the list is the repair the rule
  // asks for: what is merely detailed goes lower on the same screen, and what is
  // long gets a control rather than a second scrollbar.
  const [wholeLog, setWholeLog] = useState(false)
  const shown = releases ? (wholeLog ? releases : releases.slice(0, LOG_AT_REST)) : []
  const more = releases ? releases.length - shown.length : 0
  const body = error ? (
    <ErrorText>{error}</ErrorText>
  ) : !data ? (
    <p className="microcopy">{t('common.state.loading')}</p>
  ) : !releases || releases.length === 0 ? (
    <p className="microcopy">{t('settings.changelog.empty.prose')}</p>
  ) : (
    <div className="cl-list">
      {shown.map((rel) => {
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
    <>
      {body}
      {/* Only when there is something folded away. A button reading "Read the whole
          log" over a log that is already whole is a press that does nothing. */}
      {(more > 0 || wholeLog) && (
        <GhostButton
          icon={<IconChevron open={wholeLog} size={16} />}
          keepLabel
          className="wraps-to-fit"
          onClick={() => setWholeLog((v) => !v)}
        >
          {wholeLog ? t('settings.changelog.fold.label') : t('settings.changelog.more.label', { n: more })}
        </GhostButton>
      )}
    </>
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
      <div className="hand-card hc-r2 w-full" style={{ maxWidth, padding: '20px' }}>
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
function FeaturesCard({ prefs, onSaved, compact = false }) {
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

  // THE READER'S OWN FIRST THREE OF EACH, for the size specimens below. The pack
  // does the same and falls back to invented works; this has a real library to hand
  // and there is no reason to show somebody a stranger's shelf when their own answers
  // the question better — a cover they recognise at 96px tells them something an
  // invented one cannot.
  //
  // ONE SMALL FETCH, AND THE SPECIMEN SIMPLY DOES NOT DRAW UNTIL IT LANDS. An empty
  // library draws nothing rather than a row of hatches pretending to be a shelf.
  const [shelf, setShelf] = useState({ book: [], poster: [] })
  useEffect(() => {
    let alive = true
    const load = async () => {
      const [b, m] = await Promise.all([json('GET', '/books?limit=3'), json('GET', '/movies?limit=3')])
      if (!alive) return
      const asWork = (w, metaOf) => ({
        id: w.id,
        title: w.title,
        meta: metaOf(w),
        cover: w.cover_path || w.poster_path ? coverImgURL(w.cover_path || w.poster_path) : '',
      })
      setShelf({
        book: ((b.ok && b.data.books) || []).map((w) => asWork(w, (x) => x.author || '')),
        poster: ((m.ok && m.data.movies) || []).map((w) => asWork(w, (x) => x.director || '')),
      })
    }
    load()
    return () => { alive = false }
  }, [])

  const mobile = useIsMobileScreen()
  // DRAG TO SORT, and on a phone it is the only way. `moveTo` is the general form
  // — take the row out and put it back at an index — where `move` below swaps a
  // pair, which is all the up/down buttons can express.
  const moveTo = (a, b) => {
    if (a === b || a < 0 || b < 0 || a >= order.length || b >= order.length) return
    const next = order.slice()
    const [row] = next.splice(a, 1)
    next.splice(b, 0, row)
    const patch = { sectionOrder: next.join(',') }
    onSaved?.(patch)
    json('PUT', '/auth/me/preferences', patch)
  }
  const drag = useRowReorder(moveTo)

  // THE PHONE INDEX'S SLICE: which sections the app offers, as one row of chips.
  //
  // THE OWNER NAMED THE SHAPE — "text buttons on/off per section (like the quiz's
  // 'what to ask')" — so this is `ChipSwitches`, the control that row already
  // uses, and not a second thing that looks like it. A set of on/off choices is
  // what a lit chip states and what a column of switches makes you read one line
  // at a time; five of these on the index would be five rows and most of a card.
  //
  // IT SHARES `set` AND `lastOne` WITH THE SECTION PAGE, which is the whole reason
  // this branch lives inside the component rather than beside it. The polarity
  // rule (`hideX` stores the opposite, `showX` stores the switch) and the last-one-
  // standing lock are both subtle enough that a second copy would be right on the
  // day it was written and quietly wrong after the next section arrives. What is
  // written twice here is the arrangement; the verb is written once.
  //
  // NO REORDERING HERE. Dragging five rows into an order is not a shortcut — it
  // needs the rows, the grips and the room to aim — so it stays on the section,
  // which is what the chevron beside this card is for.
  if (compact) {
    return (
      <ChipSwitches
        ariaLabel={t('settings.features.order.title')}
        options={order.map((tab) => {
          const sec = SECTIONS.find((x) => x.tab === tab)
          if (!sec) return null
          return {
            key: tab,
            label: t(sec.label),
            on: !!on[sec.tab],
            locked: lastOne && on[sec.tab] && !sec.off ? t('settings.features.locked.prose') : '',
            hint: t(sec.what),
          }
        }).filter(Boolean)}
        onToggle={(tab) => {
          const sec = SECTIONS.find((x) => x.tab === tab)
          if (sec) set(sec, !on[sec.tab])
        }}
      />
    )
  }

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
      {/* THE SECTION IS THE HEADING — see AppearanceCard. What this dot said that
          the rail's did not — that hiding a section takes away its tab and its
          tile and NOTHING else — moved into the section's own words, because that
          is the fact a reader wants before they press anything here. */}
      {/* ONE LIST, NOT TWO, which is what the pack draws — `sectionRows()` at
          settings-restructured.dc.html:2477 returns one row per section carrying
          its name, its sub-line, `kind: 'toggle'` AND `sortable: true`. This card
          had a row of chips for on-and-off and, under it, a second list of the
          same four names for the order: the same four things written twice, so a
          reader wanting the Catalogue off and second looked in two places and
          counted eight controls for four sections.

          The owner: "Why have you added separate enable button and sorter? The
          prototype had both together, right? Always try to make things simpler.
          Not more cluttered."

          ARROWS RATHER THAN A DRAG, which is the one thing kept from the version
          that had its own list. A drag needs a pointer that can hover to discover
          it is draggable, a keyboard equivalent invented from nothing, and a touch
          target that does not fight the page's own scroll. Two buttons answer every
          input the app supports, and there is no drag-to-sort anywhere else here
          to be consistent with.

          AND THIS ORDER IS THE RAIL, THE DRAWER AND THE + MENU, because all four
          read routes.js through one `visibleTabs`, which orders as well as
          filters. */}
      <PrefColumns>
      {/* THE ORDER LIST SPANS, AND THE TUNERS PAIR BENEATH IT — the pack's own
          rule, which the first cut of this screen had exactly backwards. It
          special-cases this one group: `(g.wide || (s.id === 'sections' && i ===
          0))` at settings-restructured.dc.html:3311, with the reason written
          beside it — "The list of sections is a list of rows with controls at
          their ends: it reads across the whole measure, and the tuners pair
          beneath it."

          MARKING THE SLIDERS WIDE INSTEAD LEFT A HOLE. Measured at 1280: the
          order group drew 457px and the two specimen groups 954px stacked under
          it, so about 480×344 of the card's right half stood empty beside the
          list — on the screen the "use the space available" ruling is for. */}
      {/* A SUB-LINE, NOT A DOT. Two short sentences that say what reordering these
          rows actually DOES — it is the rail, the drawer and what ＋ offers, and
          the top one is where the app opens — which is the consequence a reader
          needs BEFORE they drag, not after they think to press something. A dot
          asks to be pressed; a sub-line is already read. It is short enough to
          stand, which is the test for moving a dot's words onto the screen rather
          than onto the control below it. */}
      <PrefGroup title={t('settings.features.order.title')} sub={t('settings.features.order.prose')} rowsRef={drag.listRef} wide>
        {order.map((tab, i) => {
          const sec = SECTIONS.find((x) => x.tab === tab)
          if (!sec) return null
          // The last one standing is the one that cannot go. Anthologies is never
          // one of them (see lastOne), so the lock cannot spill onto it.
          const locked = lastOne && on[sec.tab] && !sec.off
          return (
            <PrefRow
              key={tab}
              label={t(sec.label)}
              sub={locked ? t('settings.features.locked.prose') : t(sec.what)}
              changed={!!on[sec.tab] !== !sec.off || sectionOrder({}).indexOf(tab) !== i}
              rowProps={drag.rowProps(i)}
              // THE GRIP IS THE LEAD, at the row's left edge, because that is where
              // a list says "take hold of me here", and because a sorter at the far
              // right competes with the control that says what the row IS.
              lead={
                <button
                  type="button"
                  className="tp-grip"
                  aria-label={t('settings.features.order.drag.aria', { name: t(sec.label) })}
                  title={t('settings.features.order.drag.aria', { name: t(sec.label) })}
                  {...drag.gripProps(i)}
                >
                  <IconGrip />
                </button>
              }
              control={
                <span className="flex items-center gap-2">
                  {/* THE ARROWS ARE A DESK AFFORDANCE NOW. They stay there because
                      they are the KEYBOARD's way to reorder — a grip is a pointer
                      gesture and answers no key — and because a desk has the room.
                      A phone has neither: two arrows, two words of toggle and the
                      section's own name do not fit 390px, so the row wrapped and
                      the list ran twice the height of the screen. The owner asked
                      for exactly this split: "On phone, the drag bar will be the
                      only sorter, no up down buttons are needed." */}
                  {!mobile && (
                    <>
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
                    </>
                  )}
                  {/* A BOX ON A PHONE, THE NAMED PAIR ON A DESK. Hide/Show spells
                      both states out, which is the better control where there is
                      room for it; where there is not, a tick is the same decision
                      in a quarter of the width. */}
                  {mobile ? (
                    <CheckBox
                      checked={!!on[sec.tab]}
                      onChange={(v) => set(sec, v)}
                      disabled={locked}
                      ariaLabel={t(sec.label)}
                    />
                  ) : (
                    <Toggle
                      ariaLabel={t(sec.label)}
                      value={on[sec.tab] ? 'on' : 'off'}
                      onChange={(v) => set(sec, v === 'on')}
                      disabled={locked}
                      options={[
                        ['off', t('settings.features.hide.label')],
                        ['on', t('settings.features.show.label')],
                      ]}
                    />
                  )}
                </span>
              }
            />
          )
        })}
      </PrefGroup>
      {/* HOW BIG THE THINGS IN THOSE SECTIONS ARE DRAWN — one group per shelf, as
          the pack draws it (settings-restructured.dc.html:2729 and :2734). The two
          sliders sat at the foot of the theme section among the accent and the
          text size — "cover, poster height should be in sections" — and moving
          them here was only half the job: they arrived as a hand-rolled block with
          a rule above it, a MonoLabel, an info dot and both sliders side by side,
          which is the one part of this screen that never became rows.

          A GROUP EACH, BECAUSE THE GROUP TITLE IS THE LABEL. The pack gives each
          slider `label: ''` and names the shelf in the heading above it, so
          "Library covers" is said once instead of once as a heading and again as
          "Library cover size" on the row under it. That is also why `SizeSlider`
          no longer draws a label of its own — it keeps the words only as the
          range's accessible name, which a heading cannot supply.

          THEY ARE DEVICE-LOCAL, and the pack says so in an aside rather than an
          info dot: "this device", at the far end of each heading. A phone and a
          desk want different cover sizes, so these live in this browser's storage
          and never in the account — which is also why they carry no changed mark,
          the section's count being of preferences the server holds. The dot that
          used to explain all that is gone: the aside is the fact, and a dot
          repeating it is the repetition this sweep is about.

          NEITHER IS WIDE, AND THE ORDER LIST ABOVE IS — which is the pack's own
          rule and the opposite of what this comment said for one commit. It
          spans the first group on this screen and pairs the tuners beneath it
          (settings-restructured.dc.html:3311): "The list of sections is a list of
          rows with controls at their ends: it reads across the whole measure, and
          the tuners pair beneath it." The earlier reasoning — that a sample is
          three covers at 240px so half a card cannot hold one — assumed the count
          was fixed at three. It is not: the sample sizes itself to whatever column
          it is given, which is what makes pairing them possible at all. */}
      <PrefGroup title={t('settings.features.covers.title')} sub={t('settings.features.sizes.aside')}>
        <SizeSlider ariaLabel={t('settings.features.book-size.label')} storageKey="tippani:size:books" def={165} kind="book" works={shelf.book} />
      </PrefGroup>
      <PrefGroup title={t('settings.features.posters.title')} sub={t('settings.features.sizes.aside')}>
        <SizeSlider ariaLabel={t('settings.features.film-size.label')} storageKey="tippani:size:movies" def={150} kind="poster" works={shelf.poster} />
      </PrefGroup>
      </PrefColumns>
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
// The code is shown as text rather than a QR: the QR only saves typing. The Android app
// (aaronified/tippani-app) takes the code typed; a QR is a later nicety, and would need
// a QR library against this repo's dependency budget (ADR-0005).
// EXPORTED so `device-revoke.test.jsx` can mount it on its own; Settings draws it on the Server section.
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
      {/* ── THE LAST CARD IN SETTINGS DRAWING ITS OWN HEADING, and it kept a dot
          up there with it. Every other card became `PrefGroup`s when the sections
          were built; this one was missed, so the screen carried a heading in a
          shape nothing else on it used, and a dot at the level the SECTION dot
          already occupies.

          THE DOT DID NOT GO — IT MOVED DOWN. What it says is a rule nobody can
          see ("changing your password signs out browsers but deliberately leaves
          phones alone"), and that rule is about the pairing control, not about a
          heading. A dot on a heading is a dot nobody presses; a dot on the thing
          it is about is read by the person deciding whether to press it. The
          count moved to the group's aside, which is where a fact you glance at
          goes. */}
      <PrefGroup
        title={t('settings.devices.title')}
        aside={devices?.length ? t('settings.devices.paired.count', { n: devices.length }) : null}
      >

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
        <PrefRow
          label={t('settings.devices.pair.label')}
          info={t('settings.devices.info.body')}
          control={
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
          }
        />
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
      </PrefGroup>
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
function RestorePrompt({ meta, me, busyLabel, safe, onSafe, onCancel, onConfirm }) {
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
  // STEP ONE IS A COPY OF WHAT IS HERE NOW — see SafetyBackupStep. Held by the
  // card, so a refusal from the server (the copy is older than it accepts) can
  // send the reader back to this step.
  // The copy's password fills the restore's only when it can open the archive
  // (`recoverable`): an archive sealed in another era wants THAT password, and a
  // box filled with the wrong one reads as already answered.
  const tookCopy = (creds) => {
    onSafe(true)
    if (key === 'password' && recoverable && creds?.password) setPassword(creds.password)
  }
  // The field the step hands focus to once the copy is down — see SafetyBackupStep.
  const nextRef = useRef(null)
  // THE QUEUE, READ WHEN THE PROMPT OPENS. A restore swaps the database under the
  // job queue, so the server refuses it while a job runs and ends the ones still
  // waiting — and a reader should learn that here, above step one, rather than
  // from a refusal after downloading a safety copy.
  const [queue, setQueue] = useState(null)
  useEffect(() => {
    let alive = true
    readJobsSummary().then((r) => { if (alive && r.ok) setQueue(r) })
    return () => { alive = false }
  }, [])
  const busyQueue = queueNotice(queue, { running: 'settings.restore.queue.running', waiting: 'settings.restore.queue.waiting' })

  // The same three validate reasons the onboarding twin uses (App.jsx), through
  // the same keys: two dialogs for one operation should not own two vocabularies
  // for "you have not typed the thing yet".
  const missing = !safe ? t('settings.safety.first.reason') :
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
      {busyQueue && <p className="microcopy" role="status">{busyQueue}</p>}
      <SafetyBackupStep done={safe} onDone={tookCopy} next={nextRef} />
      {key === 'passphrase' && (
        <label className="tp-field">
          <MonoLabel>{t('common.field.passphrase.label')}</MonoLabel>
          <input
            className="tp-input"
            type="password"
            ref={nextRef}
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
            ref={nextRef}
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
            ref={nextRef}
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
  const [busy, setBusy] = useState(false) // asking the server for the backup job
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
  const [safe, setSafe] = useState(false) // step one of the restore, see SafetyBackupStep
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

  // A BACKUP IS A JOB ON THE SERVER (3.1.0). The request that sealed the archive
  // used to hold this card for as long as the seal took, and a reader who left
  // the screen left with nothing to say whether it had worked. Now the press asks
  // for a `backup` job — the server checks the credential there and then, so a
  // wrong password is refused before anything queues — and the prompt closes;
  // the card watches the job and says how it ended. Leaving does not stop it:
  // Settings › Jobs has it, with its log.
  //
  // THE DOCK'S KEY AND THE PHONE INDEX'S BUTTON OPEN THIS SAME PROMPT, so all
  // three presses are this one function.
  const backupJob = useKindJob('backup', {
    onSettled: async (job) => {
      if (job.state === 'failed') return toast(job.error || t('error.backup.failed'))
      if (job.state !== 'succeeded') {
        return toast(t(job.state === 'stopped' ? 'settings.backup.toast.stopped' : 'settings.backup.toast.interrupted'))
      }
      // The card's own read of the kept archive, now that there is a new one.
      const r = await json('GET', '/admin/backup')
      if (r.ok) setBackup(r.data.backup)
      // IT DOES NOT DOWNLOAD ITSELF. Making a backup and taking a copy of it are
      // two different acts, and welding them together got both of them wrong:
      //
      //   - The archive is KEPT on the server. That is the point of the feature —
      //     one dated archive, ready to restore from, and the restore reads it from
      //     there. Somebody who wanted that got a multi-megabyte file in their
      //     Downloads folder as well, every time, unasked.
      //   - On a phone the navigation is worse than untidy: assigning
      //     window.location while a dialog is closing takes the browser off the
      //     page mid-transition, and what comes back is a download shelf over a
      //     Settings screen that has lost its scroll position.
      //   - And it happened on the FAILURE path's twin — a backup that succeeded
      //     but that you only wanted server-side still cost you the bandwidth.
      //
      // So the toast offers it instead. One tap if you want the copy, nothing if
      // you do not, and the button on the card is there either way.
      toast(t('settings.backup.toast.created'), { label: t('common.action.download.label'), onClick: download })
    },
  })
  const backingUp = busy || backupJob.live

  async function create(creds) {
    setBusy(true)
    const r = await backupJob.start(creds, { reuse: false })
    setBusy(false)
    if (!r.ok) return toast(r.error)
    setAsking(false)
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
        // 428: the server has no note of a recent download (it restarted, or the
        // copy is older than it accepts), so the reader is back at step one.
        if (r.status === 428) setSafe(false)
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

  // THE SECOND GROUP OF THE SERVER PANEL — see UpdatesCard for why this is a group
  // and no longer a card of its own. `data-tour` sits on the rows rather than the
  // group, so the tour's halo frames the controls and not the heading above them;
  // an earlier draft of this comment said it had moved to the group, which it had
  // not.
  return (
    <>
      <PrefGroup
        title={t('settings.backup.title')}
      >
      <div data-tour="backup">
        {/* THE PACK'S THREE ROWS. It draws Backup as "Make a backup", "Nightly
            backup" and "Restore from an archive", each a row with its own
            sub-line and its own control (settings-restructured.dc.html:2754-2759);
            this was two stacks of divs under one heading. The middle row is NOT
            here and its absence is recorded rather than faked: a nightly backup
            needs something that wakes up at four in the morning, and this repo's
            standing invariant is that nothing wakes on a timer. See
            docs/wiki/Plan-Nightly-Backup.md. */}
        {/* THE DOT CAME DOWN FROM THE HEADING. What it says — one dated encrypted
            archive, a passphrase one recoverable by nothing, and a restore that
            replaces everything — is about the act this row performs, and it is the
            kind of thing a reader wants in front of them at the moment they are
            deciding to press, not one level up beside a title. */}
        <PrefRow
          label={t('settings.backup.make.label')}
          info={t('settings.backup.info.body')}
          said={loaded && (
            <>
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
              {/* BEHIND ANOTHER JOB, where it stands — a busy button with no reason
                  beside it reads as a stuck one. */}
              {backupJob.job?.state === 'queued' && <p className="microcopy">{jobWaitingText(backupJob.job)}</p>}
            </>
          )}
          control={
        <div className="flex flex-wrap items-center gap-3">
          <GhostButton
            icon={<IconArchive />}
            keepLabel
            onClick={() => setAsking(true)}
            disabled={backingUp || phase !== 'idle'}
          >
            {backingUp ? t('settings.backup.now.busy') : t('settings.backup.now.label')}
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
          }
        />

        {/* One label, no second dot. What this one said — restoring replaces
            everything and logs everyone out — is said twice more already: once
            in the heading's dot above, and once in red inside RestorePrompt,
            which is the moment it applies and the only place it is certain to
            be read. A card that explains the same consequence three times is
            not being three times as careful. */}
        <PrefRow label={t('settings.backup.restore-from.label')}>
          <div className="space-y-2" style={{ flexBasis: '100%', minWidth: 0 }}>
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
              disabled={!target || backingUp || phase !== 'idle'}
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
        </PrefRow>
      </div>
      </PrefGroup>

      {asking && (
        <BackupPrompt me={user.username} busy={busy} onCancel={() => setAsking(false)} onConfirm={create} />
      )}
      {prompt && target && (
        <RestorePrompt
          meta={target}
          me={user.username}
          busyLabel={busyLabel}
          safe={safe}
          onSafe={setSafe}
          onCancel={() => { setPrompt(false); setPhase('idle'); setSafe(false) }}
          onConfirm={restore}
        />
      )}
    </>
  )
}

// ---- shared bits ----

// ---- 1. Appearance (§4, mockup 26) ----

// SizeSlider — a plain range that sets a catalogue grid's cell size, persisted
// per screen in localStorage via useCoverSize. The Library and Catalogue grids
// read the same key on mount, so changing it here resizes their posters/covers.
// (Replaces the old reel "roll" slider that sat in the toolbars — and never even
// drove the movie grid.)
// A SIZE YOU CAN SEE, which is the whole of what the pack's slider is and what this
// one was not.
//
// WHAT WAS MISSING. The pack's two cover sliders carry `spec: 'book'` and
// `spec: 'poster'` and draw three works beside the handle at the size the handle is
// set to — cover, title and credit line, all of it scaling together
// (settings-restructured.dc.html:2886-2913). This drew a bare range and the number
// "165px". Nobody knows what 165px is. The owner: "Where are the sample cover
// pictures? If i need to tell you everything, why have i made the prototype???" It
// was in this branch's own divergence audit as a major finding and was neither built
// nor raised.
//
// AND THERE IS NO ARTWORK TO SHIP. The pack's specimens are not photographs: the
// cells are drawn from the material tile and the hatch, both of which this app
// already has — `Placeholder` and its `.ph` class are the same hatch the pack
// defines inline. So a reader's OWN first three works are drawn where they have
// covers, and the hatch stands in where they do not, which is also the honest
// picture: a shelf is mostly covers and some gaps.
//
// THE TYPE SCALES WITH THE COVER, because that is the part a number cannot tell you.
// At 96px a title wraps to four lines and the credit line disappears into it; at
// 240px it does not. The ratios are the pack's: 1.52 for a book, 1.5 for a poster.
function CoverSpecimen({ size, kind, works, reserve = false }) {
  const ratio = kind === 'poster' ? 1.5 : 1.52
  // AS MANY AS FIT, NEVER A SCROLL — the pack's own note, and for a while this was
  // the note rather than the code. It took `works.slice(0, 3)` directly underneath
  // it: three cells always, at up to 240px each, whatever the room. The owner
  // reported it from their own phone — "we have 3 posters for the poster size
  // panel, when no mobile screen can hold three at the lowest size even" — and the
  // reason nothing here showed it is that `.cover-specimen` wraps, so the third
  // cover does not overflow, it drops to a second line. That is not the failure
  // the comment promised to avoid, and it is not what the pack draws either: a row
  // of three at 96px that becomes two-and-one at 165px is a specimen whose SHAPE
  // changes as you drag, on the one control whose whole job is showing you a shape.
  //
  // MEASURED, NOT GUESSED. The element reports its own width and the stylesheet's
  // own gap, so this asks the same question the browser just answered rather than
  // hard-coding a breakpoint that a card, a column or a font change would falsify.
  // Before the first measurement it draws one — the honest floor, since one cover
  // fits any width this app supports, and a first paint of three that immediately
  // becomes one is the flicker the measurement exists to avoid.
  // A CALLBACK REF, NOT A REF PLUS AN EFFECT, and the difference was a real defect
  // this screen's own measurement caught. The shelf arrives from the network, so
  // the FIRST render has no works and returns null — at which point a `useEffect`
  // with an empty dependency list has already run, found `ref.current` null, and
  // attached nothing. The works land, the element mounts, and the effect never
  // runs again: the measured room stays 0 for ever and the specimen draws one
  // cover on a 954px desk. A callback ref fires when the node itself appears,
  // which is the question being asked.
  // AND THE GAP IS ASKED FOR, NOT REMEMBERED. It was the literal 14 with a comment
  // pointing at `.cover-specimen` in index.css — two copies of one number, joined
  // by nothing a tool can check, so a stylesheet edit would leave every count
  // quietly one cover out. The element knows its own gap; `column-gap` resolves to
  // pixels in a computed style, so this asks it.
  const [box0, setBox] = useState({ room: 0, gap: 0 })
  const seen = useRef(null)
  const box = useCallback((el) => {
    if (seen.current) { seen.current.disconnect(); seen.current = null }
    if (!el) return
    const read = () => setBox({
      room: el.getBoundingClientRect().width,
      gap: parseFloat(getComputedStyle(el).columnGap) || 0,
    })
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    seen.current = ro
  }, [])
  const cells = works.slice(0, coversThatFit(box0.room, size, box0.gap, 3))
  if (works.length === 0) return null
  return (
    <div
      className="cover-specimen"
      ref={box}
      aria-hidden="true"
      // THE TALLEST BOX THIS SPECIMEN COULD NEED, held only while the slider is in
      // use — see SizeSlider for the measurement that made it necessary. 240 is
      // the slider's own maximum and the title block under a cover runs to two
      // lines, so this is the real ceiling rather than a guess with slack in it.
      style={reserve ? { minHeight: `calc(${Math.round(240 * ratio)}px + 3.6em)` } : undefined}
    >
      {cells.map((w, i) => (
        <span key={w.id ?? i} className="cover-specimen-cell" style={{ width: size }}>
          {w.cover ? (
            <img src={w.cover} alt="" style={{ width: size, height: Math.round(size * ratio), borderRadius: 3, objectFit: 'cover', border: '1px solid var(--line)' }} />
          ) : (
            <Placeholder style={{ width: size, height: Math.round(size * ratio), borderRadius: 3 }} />
          )}
          <span className="cover-specimen-title" style={{ fontFamily: 'var(--font-quote-base)', fontSize: Math.max(11, Math.round(size / 12)), fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>
            {w.title}
          </span>
          {w.meta && (
            /* THE CLIP IS IN THE STYLESHEET, NOT IN THIS ATTRIBUTE, and that is the
               whole of the change. This line holds an AUTHOR'S NAME and ended it in
               an ellipsis from a style attribute — so the repo's own scanner for
               exactly that, `no-truncated-names.test.js`, could not see it: it reads
               index.css, and nothing in `test/rules` reads a style prop. An
               argued exception in the stylesheet is a decision; the same clip
               written here is a decision nothing can find. Only the SIZE stays,
               because only the size is computed. */
            <span className="cover-specimen-credit" style={{ fontSize: Math.max(9, Math.round(size / 17)) }}>
              {w.meta}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

// NO LABEL OF ITS OWN — the group heading above it names the shelf, which is how
// the pack draws it (`label: ''` on both slider rows, the shelf named in the
// group title). This drew a MonoLabel reading "Library cover size" under a
// heading reading "Library covers", which is one fact twice. The words stay as
// the range's ACCESSIBLE name, because a heading is not one: a screen reader
// moving control to control would otherwise meet two unnamed sliders.
function SizeSlider({ ariaLabel, storageKey, def, kind, works }) {
  const [size, setSize] = useCoverSize(storageKey, def)
  // ── THE SLIDER MUST NOT MOVE WHILE IT IS BEING USED ─────────────────────────
  //
  // THE DEFECT, MEASURED. On a phone, with the page scrolled to its foot — which
  // is exactly where the poster slider is, being the last thing on the screen —
  // dragging from 150 to 95 shortened the page from 1298 to 1227. The browser has
  // to clamp `scrollTop` when the document gets shorter than the current scroll
  // position, so it fell 390 → 383 and the slider rose 7px OUT FROM UNDER THE
  // FINGER. The owner: "the screen re-adjusts to accomodate the posters/covers.
  // This moves the slider bar. That is a bad ux."
  //
  // IT IS NOT THE SPECIMEN PUSHING THE SLIDER. The specimen is below it, so its
  // growth pushes what is under it and never the row above — and at mid-screen the
  // slider measured rock still at 414px through a 250px swing in page height. It
  // is only the clamp, and only at the bottom, which is why this took a
  // measurement rather than a reading of the markup to find.
  //
  // SO THE PAGE DOES NOT SHORTEN WHILE THE CONTROL IS IN USE. While the reader is
  // holding the slider — pointer down, or the keyboard focused on it — the
  // specimen reserves the tallest box it could ever need, so the document's height
  // is constant no matter which way the handle goes. Nothing clamps, nothing
  // moves. Let go and it relaxes to the size actually chosen.
  //
  // RESERVING RATHER THAN CLIPPING, and the difference matters: a frozen box with
  // `overflow: hidden` would hold the slider still and cut the top off the cover
  // you are in the middle of judging, which defeats the specimen. Reserving makes
  // the page LONGER at the moment of grabbing, and growth at the foot of a
  // document moves nothing — only shrinking does.
  const [holding, setHolding] = useState(false)
  const hold = () => setHolding(true)
  const release = () => setHolding(false)
  return (
    <div>
      <div className="flex items-center gap-3" style={{ minHeight: 36 }}>
        {/* THE PACK'S STEP, ON A FLOOR THAT MAKES IT REACHABLE. Its rows say
            `min: 96, max: 240, step: 5` and then compare against defaults of 165
            and 150 — but HTML steps from the MINIMUM, and 165 − 96 = 69 and
            150 − 96 = 54 are not multiples of 5, so on the pack's own ladder
            neither of the pack's own defaults can be selected. A browser snaps an
            out-of-step value, so copying it exactly would have moved every stored
            size and made the default unreachable.

            A floor of 95 fixes it rather than dropping the step: 95, 100 … 150,
            165 … 240 all land, the phone's own 100 lands, and the cost is one
            pixel on a minimum nobody can perceive. That is a smaller departure
            from the pack than losing the coarse drag it asked for. */}
        <input
          type="range"
          min={95}
          max={240}
          step={5}
          value={size}
          aria-label={ariaLabel}
          onChange={(e) => setSize(Number(e.target.value))}
          onPointerDown={hold}
          onPointerUp={release}
          onPointerCancel={release}
          // THE KEYBOARD HOLDS IT TOO. Arrowing a range fires the same reflow, and
          // a reader stepping it one rung at a time would watch the page twitch
          // under every press.
          onFocus={hold}
          onBlur={release}
          style={{ width: 190, accentColor: 'var(--accent-ui)', cursor: 'pointer' }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-mono-weight)', fontStyle: 'var(--font-mono-style)', fontVariantCaps: 'var(--font-mono-caps)', textTransform: 'var(--font-mono-case)', fontVariantNumeric: 'var(--font-mono-figures)', fontSize: 'var(--type-mono-12)', color: 'var(--faint)', minWidth: 42 }}>
          {t('settings.type.size.format', { n: size })}
        </span>
      </div>
      <CoverSpecimen size={size} kind={kind} works={works} reserve={holding} />
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
// materials most of which are not on screen.
//
// AND THE WAY TO PUT ONE ON A SLOT IS NOT BUILT. This said "the control one row
// up", which does not exist on any screen: the pack draws it
// (settings-restructured.dc.html:2597-2607 — "Change one surface yourself → Open
// the 27 tiles") and the machinery is already here, `TILE_NAMES` exported with no
// caller, applyTheme reading tileDesk/tileShell/tilePage/tileBinding, a saved look
// carrying them — but nothing draws the picker. It is a pack feature this sweep
// has not built, and it is written down in docs/wiki/Plan-Tile-Slots.md rather than
// left as a sentence pointing at nothing.
//
// A DIAL IS A Slider, WHICH COMMITS ON RELEASE. A drag across a range would
// otherwise be one PUT per step, and this preference is a whole JSON object.
// THE TWO DIAL TABLES, AT MODULE SCOPE. They were built inside `MaterialPhysics`
// on every render, which was harmless until the door's row needed to COUNT them:
// a count derived from a copy is a count that is right until somebody adds a dial
// to one of the two lists. One list, two readers.
const PHYS_DIALS = [
  ['hard', 'settings.appearance.phys.hard.label'],
  ['sss', 'settings.appearance.phys.sss.label'],
  ['diff', 'settings.appearance.phys.diff.label'],
  ['refl', 'settings.appearance.phys.refl.label'],
]
// THE FIVE GLASS DIALS — six, with blur — AND THEY APPEAR ONLY WITH THE LENS.
// They configure a renderer: with true glass off there is nothing for clarity,
// refraction, bevel, fringe or gain to act on, and a control that does nothing is
// worse than a missing one because it teaches the reader that the controls here
// are inert. That was the owner's ruling when the cost of the lens was put to
// them — the glass dials ship with the toggle or not at all.
const GLASS_DIALS = [
  ['clarity', 'settings.appearance.glass.clarity.label', 100],
  ['refract', 'settings.appearance.glass.refract.label', 200],
  ['bevel', 'settings.appearance.glass.bevel.label', 200],
  ['fringe', 'settings.appearance.glass.fringe.label', 200],
  ['gain', 'settings.appearance.glass.gain.label', 200],
  ['blur', 'settings.appearance.glass.blur.label', 400],
]

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
function Appearance({ prefs, onPreferences, part = 'all', onGo = null, compact = false }) {
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
    // The shell's copy of the account's preferences is what it re-applies when anything else changes, so it has to hear
    // of this too, or choosing a surface's material would put the glass back to its sign-in value on screen.
    onPreferences?.({ trueGlass: on })
    json('PUT', '/auth/me/preferences', { trueGlass: on })
  }
  // The reader's edits to what each material does with light. NOT in `persist`,
  // and for the reason that function documents about contrast: it re-sends every
  // theme field on any change, so a preference riding in that object is wiped by
  // an unrelated accent click. One writer per concern.
  const [texTweak, setTexTweak] = useState(() => getResolvedTheme().texTweak)
  // THE FOUR SURFACES' OWN MATERIALS, in SLOTS order, '' where the set's own is worn. One write per change, to the
  // preference the server already stores it under.
  const [slotTiles, setSlotTiles] = useState(() => getResolvedTheme().tiles)
  function saveSlot(slot, name) {
    const key = SLOT_PREFS[SLOTS.indexOf(slot)]
    const next = slotTiles.slice()
    next[SLOTS.indexOf(slot)] = name
    setSlotTiles(next)
    const fields = { ...getResolvedTheme(), [key]: name }
    applyTheme(fields)
    onPreferences?.({ [key]: name })
    json('PUT', '/auth/me/preferences', { [key]: name })
  }
  const [slotsOpen, setSlotsOpen] = useState(false)
  function saveTweaks(next) {
    setTexTweak(next)
    applyTheme({ ...getResolvedTheme(), texTweak: JSON.stringify(next) })
    onPreferences?.({ texTweak: JSON.stringify(next) }) // see saveGlass
    json('PUT', '/auth/me/preferences', { texTweak: JSON.stringify(next) })
  }
  // WHICH OF THE THREE COLOUR DOORS IS OPEN, or null. One panel and not three:
  // they ask the same question about three different things, and three components
  // would be three places for that question to drift.
  const [colourDoor, setColourDoor] = useState(null)
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
    // The slot overrides ride along (read off what is applied), or the full-state applyTheme below would put every
    // slot back on the set's own material.
    const { tileGround, tileShell, tileCard, tileCover } = getResolvedTheme()
    const s = { materialSet, theme: themePref, accent, groundLight, groundDark, tileGround, tileShell, tileCard, tileCover, ...next }
    setMaterialSet(s.materialSet)
    setThemePref(s.theme)
    setAccent(s.accent)
    setGroundLight(s.groundLight)
    setGroundDark(s.groundDark)
    applyTheme(s)
    onPreferences?.(s)
    json('PUT', '/auth/me/preferences', s)
  }

  // ── THE THREE COLOUR DOORS, LIFTED OUT OF THE ROW ──────────────────────────
  //
  // Out of the Colours row's `control` so the phone index's Theme card can draw
  // the SAME three doors rather than a second set beside them. The repo's rule:
  // a control on two screens lives in one function, and where a screen needs
  // something the other does not it passes that fact IN. Nothing here asks which
  // screen is calling — the doors, the panel they open and the `persist` they
  // write through are one implementation, so the day a fourth door arrives it
  // arrives on both.
  // ── THE PHONE INDEX'S TWO SLICES ────────────────────────────────────────────
  //
  // Declared before `colourDoors` is USED but after it is defined, which is why
  // this branch sits below the helper rather than at the top of the component:
  // an early return above a `const` arrow would reach it in its own dead zone.
  //
  // THEME: the mode and the colours, which are the two rows this section exists
  // for. Everything else here — the material set, its five physics dials, the
  // saved looks, the cover sizes — is either a once-ever decision or a
  // fine-tuning pass, and neither is what a reader opens Settings on a phone to
  // do. The owner named exactly this pair: "dark/light/match toggle + accent
  // colour".
  //
  // LANGUAGE: the interface language and the face it is drawn in. `FontSections`
  // answers for the face, with its own `compact`, so the row a reader gets is the
  // section's row — uploads, script warning and optimistic apply included.
  const compactSlice = () => part === 'lang' ? (
    <>
      <PrefRow
        label={t('settings.language.title')}
        control={
          <LanguagePicker
            bare
            onPick={(code) => {
              onPreferences?.({ locale: code })
              json('PUT', '/auth/me/preferences', { locale: code })
            }}
          />
        }
      />
      <FontSections prefs={prefs} onSaved={onPreferences} onGo={onGo} compact />
    </>
  ) : (
    <>
      <PrefRow
        label={t('settings.appearance.theme.title')}
        changed={themePref !== 'system'}
        control={
          <Toggle
            ariaLabel={t('settings.appearance.match.aria')}
            value={themePref}
            onChange={(v) => persist({ theme: v })}
            options={[
              ['system', t('settings.appearance.match.label')],
              ['light', t('settings.appearance.theme.light.label')],
              ['dark', t('settings.appearance.theme.dark.label')],
            ]}
          />
        }
      />
      <PrefRow
        label={t('settings.appearance.group.material.title')}
        changed={materialSet !== 'manuscript'}
        control={
          <Select
            ariaLabel={t('settings.appearance.group.material.title')}
            value={materialSet}
            onChange={(v) => persist({ materialSet: v })}
            options={Object.keys(MAT_SETS).map((name) => [name, t(MAT_SET_LABELS[name])])}
          />
        }
      />
      <PrefRow
        label={t('settings.appearance.colours.title')}
        changed={groundLight !== 'cream' || groundDark !== 'night' || accent !== 'terracotta'}
        control={colourDoors()}
      >
        {/* THE ANSWER, WHICH THE FIRST CUT OF THIS CARD LEFT BEHIND. The doors
            were rendered and the panel they open was not, so pressing one set a
            state nothing drew — "Clicking on those colours in the theme area does
            nothing", and it was exactly that. A control and the thing it opens
            travel together. */}
        {colourPanel()}
      </PrefRow>
    </>
  )

  // ── THE PANEL THE DOORS OPEN, AS A HELPER ─────────────────────────────────
  //
  // OUT OF THE ROW FOR THE SAME REASON `colourDoors` WAS, AND BECAUSE LEAVING IT
  // BEHIND WAS A BUG THE OWNER FOUND: "Clicking on those colours in the theme
  // area does nothing." They were right and the cause was exactly this — the
  // phone card rendered the doors through `colourDoors()` and nothing else, while
  // the panel that answers them was a CHILD of the section's PrefRow, which the
  // card's early return never reaches. So every door set its state and no screen
  // drew the result: three controls that looked live and were inert.
  //
  // A control and the thing it opens are one decision, so they are one pair of
  // helpers now, and a caller that draws the first without the second is the
  // shape of mistake this split exists to make impossible to repeat quietly.
  const colourPanel = () => (
    colourDoor && (
        <div className="colour-panel">
          <div className="colour-panel-head">
            <MonoLabel>{t(`settings.appearance.colours.${colourDoor}.title`)}</MonoLabel>
            {/* ITS OWN NAME, WHICH THE PACK ALSO GIVES IT (aria-label="Hide the
                options", settings-restructured.dc.html:444). "Hide" alone is
                the word on a label-density option three groups down, so the
                section had two controls a reader — or a journey — could not
                tell apart by name. */}
            <GhostButton
              icon={<IconChevron open />}
              aria-label={t('settings.appearance.colours.hide.aria')}
              onClick={() => setColourDoor(null)}
            >
              {t('common.action.hide.label')}
            </GhostButton>
          </div>
          <div className="colour-choices">
            {colourDoor === 'accent'
              ? Object.entries(ACCENTS).map(([name, hex]) => {
                  const on = accent === name
                  return (
                    <button
                      key={name}
                      type="button"
                      className={'colour-choice' + (on ? ' is-on' : '')}
                      aria-pressed={on}
                      onClick={() => persist({ accent: name })}
                    >
                      <span
                        className="accent-swatch"
                        aria-hidden="true"
                        style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${hex}, white 14%), ${hex})` }}
                      />
                      <span className="colour-choice-name">{t(`vocab.accent.${name}.label`)}</span>
                    </button>
                  )
                })
              : Object.entries(GROUNDS[colourDoor === 'dark' ? 'dark' : 'light']).map(([key, g]) => {
                  const dark = colourDoor === 'dark'
                  const on = (dark ? groundDark : groundLight) === key
                  const pal = paletteFor(dark, dark ? { groundDark: key } : { groundLight: key })
                  return (
                    <button
                      key={key}
                      type="button"
                      className={'colour-choice' + (on ? ' is-on' : '')}
                      aria-pressed={on}
                      onClick={() => persist(dark ? { groundDark: key } : { groundLight: key })}
                    >
                      <span
                        className="ground-swatch"
                        aria-hidden="true"
                        style={{ background: pal.bg, boxShadow: `inset 0 0 0 1px ${pal.line}` }}
                      >
                        <span style={{ background: pal.raised }} />
                        <span style={{ background: pal.card }} />
                      </span>
                      <span className="colour-choice-name">{t(g.label)}</span>
                    </button>
                  )
                })}
          </div>
        </div>
    )
  )

  const colourDoors = () => (
        /* THREE DOORS, WHICH IS WHAT THE ROW'S OWN SUB-LINE HAS BEEN PROMISING:
           "Light ground · dark ground · accent. Each one opens its own options."
           It drew the palette inline instead — the four grounds of whichever
           mode was on screen, then every accent beside them — so the sentence
           was describing a control that did not exist, and the row carried
           eight or nine swatches where the pack carries three
           (settings-restructured.dc.html:2590, "Tap a colour for its options").

           AND BOTH GROUNDS ARE REACHABLE NOW. Offering only the mode you are
           standing in was defensible — a swatch is an honest preview only in
           the ground it selects — but it also meant a reader on a dark screen
           could not set their day look without switching the app to daylight
           first. A door is not a preview, so it can offer the pair; the swatch
           on each door is still drawn in the ground it stands for. */
        <div className="colour-doors">
          {[['light', false, groundLight], ['dark', true, groundDark]].map(([id, dark, key]) => {
            // THE SWATCH IS DRAWN FROM THE PALETTE THE GROUND PRODUCES, not from
            // the ground's own override set. A ground is `{ label, tokens }` and
            // two of the eight carry NO tokens at all — Cream and Night are the
            // shipped palettes, which is the whole point of them — so a swatch
            // reading `g.bg` painted every ground transparent and the shipped
            // one hardest of all. `paletteFor` is the same merge `applyTheme`
            // does, so the swatch is the ground rather than an opinion about it.
            const pal = paletteFor(dark, dark ? { groundDark: key } : { groundLight: key })
            return (
              <button
                key={id}
                type="button"
                className={'colour-door' + (colourDoor === id ? ' is-open' : '')}
                // A SECOND PRESS CLOSES IT, which is what the pack does
                // (settings-restructured.dc.html:3127) and what a door that
                // shows no state cannot afford not to do: pressing the open one
                // again was a dead press, and the only way out was Hide.
                onClick={() => setColourDoor(colourDoor === id ? null : id)}
                aria-expanded={colourDoor === id}
                aria-label={t(`settings.appearance.colours.${id}.aria`, { name: t(GROUNDS[dark ? 'dark' : 'light'][key].label) })}
              >
                <span
                  className="ground-swatch"
                  aria-hidden="true"
                  style={{ background: pal.bg, boxShadow: `inset 0 0 0 1px ${pal.line}` }}
                >
                  <span style={{ background: pal.raised }} />
                  <span style={{ background: pal.card }} />
                </span>
                <MonoLabel>{t(`settings.appearance.colours.${id}.label`)}</MonoLabel>
              </button>
            )
          })}
          <button
            type="button"
            className={'colour-door' + (colourDoor === 'accent' ? ' is-open' : '')}
            onClick={() => setColourDoor(colourDoor === 'accent' ? null : 'accent')}
            aria-expanded={colourDoor === 'accent'}
            aria-label={t('settings.appearance.colours.accent.aria', { name: t(`vocab.accent.${accent}.label`) })}
          >
            <span
              className="accent-swatch"
              aria-hidden="true"
              style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${ACCENTS[accent]}, white 14%), ${ACCENTS[accent]})` }}
            />
            <MonoLabel>{t('settings.appearance.colours.accent.label')}</MonoLabel>
          </button>
        </div>
  )

  return compactSlice()
}

// THE LEADING IS NAMED AND THE MEASURE IS COUNTED, and that difference is not an
// inconsistency. "1.55" is a ratio between a line box and a font size, which is
// nothing a reader is holding in their head; "66 characters" is the thing the
// typographic rule is actually stated in and the thing they can see on the page.
// So one control shows five names and the other shows the number, because that is
// which half of each is legible.
const LEADING_NAMES = ['tight', 'snug', 'normal', 'relaxed', 'loose']

// ContextGlobalFields — the reader's own pair for how much of a work's file shows around a
// quote opened in context: the outermost tier, under a work's or board's rule and a quote's
// own. The leftmost stop is "inherited", i.e. the built-in default, not 0.
export function ContextGlobalFields() {
  const [rule, setRule] = useState(null)
  useEffect(() => {
    let live = true
    json('GET', '/context-rules/global').then((r) => {
      if (live && r.ok) setRule({ before: r.data?.before ?? null, after: r.data?.after ?? null })
    })
    return () => {
      live = false
    }
  }, [])
  if (!rule) return null
  const set = async (half, v) => {
    if (v === rule[half]) return
    const next = { ...rule, [half]: v }
    const r = await json('PUT', '/context-rules/global', next)
    if (r.ok) setRule(next)
  }
  return (
    <>
      {['before', 'after'].map((half) => (
        <PrefRow
          key={half}
          label={t(`settings.context.${half}.label`)}
          info={t(`settings.context.${half}.info.body`)}
          changed={rule[half] != null}
          control={<RuleSlider label={t(`settings.context.${half}.label`)} value={rule[half]} onCommit={(v) => set(half, v)} />}
        />
      ))}
    </>
  )
}

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
  // A ROW, for the reason TextSizeField's own note gives: these three are the
  // accessibility group of a section made of rows, and a label-over-control stack
  // beside them is the one control that did not get the message.
  const dial = (key, value, onChange, options, changed) => (
    <PrefRow
      label={t(`settings.appearance.${key}.label`)}
      info={t(`settings.appearance.${key}.info.body`)}
      changed={changed}
      control={
        <Select
          value={String(value)}
          onChange={(v) => onChange(Number(v))}
          options={options}
          ariaLabel={t(`settings.appearance.${key}.aria`)}
          width={124}
        />
      }
    />
  )

  return (
    <>
      {dial(
        'quote-leading',
        clampLeading(prefs?.quoteLeading),
        (n) => set({ quoteLeading: n }),
        QUOTE_LEADINGS.map((n, i) => [String(n), t(`settings.appearance.quote-leading.${LEADING_NAMES[i]}`)]),
        clampLeading(prefs?.quoteLeading) !== QUOTE_LEADING_DEFAULT,
      )}
      {dial(
        'quote-measure',
        clampMeasure(prefs?.quoteMeasure),
        (n) => set({ quoteMeasure: n }),
        QUOTE_MEASURES.map((n) => [
          String(n),
          n ? t('settings.appearance.quote-measure.chars', { n }) : t('settings.appearance.quote-measure.full'),
        ]),
        clampMeasure(prefs?.quoteMeasure) !== QUOTE_MEASURE_DEFAULT,
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
    /* A ROW, LIKE THE ROWS AROUND IT. It drew its own label-over-control stack
       while every other control in the section had become a row with its name on
       the left and its answer on the right — so the one control this group is
       named after was the one that did not look like it belonged in it. */
    <PrefRow
      label={t('settings.labels.title')}
      info={t('settings.labels.info.body')}
      infoTitle={t('settings.labels.info.title')}
      changed={pref !== 'auto'}
      control={
        <Toggle
          ariaLabel={t('settings.labels.info.title')}
          value={pref}
          onChange={pick}
          options={[['auto', t('settings.labels.auto.label')], ['on', t('common.action.show.label')], ['off', t('common.action.hide.label')]]}
        />
      }
    />
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

