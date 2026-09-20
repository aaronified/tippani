import { useCallback, useEffect, useRef, useState } from 'react'
import { coverImgURL, DEMO, json, errText, copyText, apiURL, upload as uploadFile, uploadWithProgress } from './api.js'
import { coversThatFit } from './coverFit.js'
import { useRowReorder } from './reorder.js'
import { ACCENTS, GROUNDS, PHYS, paletteFor, parseTweaks, physDirty, physFor, applyColors, applyContrast, applyLabels, applyTheme, CAT_NAME_MAX, CATEGORY_PALETTE, categoryState, contrastPrefValue, getResolvedTheme, LABELS_KEY, labelsPref, MAT_SET_LABELS, MAT_SETS, surfaceStyle, UNSET_LABEL } from './theme.js'
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
import { PrefColumns, PrefGroup, PrefRow } from './prefRow.jsx'
import { glassDialsFor } from './glassLens.js'
import { applyFields, fromFile, parseSaved, removeTheme, SAVED_THEME_CAP, saveTheme, toFile } from './savedThemes.js'
import { SECTIONS, sectionOrder, visibleSections } from './routes.js'
import { RESTART_FAILED, RESTART_NEW, RESTART_SAME, waitForRestart } from './update.js'
import { LanguagePicker } from './locale.jsx'
import { languageMarksState } from './languages.jsx'
import { languageFor, scriptOf } from './iso639.js'
import { cachedVocabulary, primeSearchVocabulary } from './vocabulary.js'
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
  Cover,
  GhostButton,
  IconArchive,
  IconArrow,
  IconBookmark,
  IconCheck,
  IconButton,
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
  Placeholder,
  SCRIM_CENTERED,
  Scroller,
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
  CheckBox,
  IconGrip,
  useScreenBar,
  useScreenSearch,
  usePanelStack,
  PanelHost,
  usePersistedState,
} from './ui.jsx'
import { PersonChip, PersonModal } from './people.jsx'
import { usePersonOpener } from './personOpen.jsx'
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
export const SETTINGS_CARDS = ['features', 'sr', 'server']

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
  server: ['server'],
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
  // SERVER OWNS NONE. `trashDays` was listed here and is not a Server control at
  // all — it is set on the Bin, which is where a reader changes how long the bin
  // keeps things. Counting it here put a "1 changed" on a tab for something not on
  // it, and Reset section would have silently reset the Bin's retention from a
  // screen that never showed it. What Server holds are ACTS (check, back up,
  // restore) and one admin setting the server keeps itself (the release channel,
  // via /admin/update/channel) — none of them a user preference this table is for.
  server: [],
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
  sr: 'settings.quiz.',
  // THREE PREFIXES FOR ONE CARD. Server is a single tile holding Updates, Backup
  // and What changed, as the pack draws it — so the words a reader might search
  // for live under three roots, and a card that could only declare one would go
  // missing the moment somebody typed "backup".
  server: ['settings.updates.', 'settings.backup.', 'settings.changelog.'],
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

export default function Settings({ user, onPreferences, update, onUpdateInfo, section: routed = null, onSection = null, onGo = null }) {
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
  const resetSection = (id) => {
    const keys = SECTION_PREFS[id] || []
    const patch = {}
    for (const k of keys) patch[k] = ''
    onPreferences?.(patch)
    json('POST', '/auth/me/preferences/reset', { keys })
    setResetting(null)
  }

  const matching = (key) => settingsMatches(key === 'language' ? 'appearance' : key, q)
  const liveSections = SETTINGS_SECTIONS.filter(([id]) =>
    (SECTION_CARDS[id] || []).some((k) => cardsByKey[k] && matching(k)))
  const current = liveSections.some(([id]) => id === section) ? section : (liveSections[0] || [])[0]
  const shown = current ? (SECTION_CARDS[current] || []).filter((k) => cardsByKey[k] && matching(k)) : []

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
            info: t(sectionInfoKey(id)),
            pill: sectionPill(changedIn(prefs, id)),
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
                <GhostButton icon={<IconRevert />} onClick={() => setResetting(current)}>
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
      {/* THE SECTION IS THE HEADING — see AppearanceCard. This card is mounted by
          exactly one thing, Metadata's Colours section, whose tab had just said
          "Colours" over a card saying "Colour categories". */}
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
    /* A ROW, WITH THE CHIPS AS ITS SECOND LINE. This drew a mono label over a
       wrapping row of chips, which is the shape every control on this section had
       — so Review was the one screen in Settings where nothing lined up with
       anything. The chips go under the name rather than beside it because there
       are three of them and they wrap; the row's control slot is for a control
       that fits. */
    <PrefRow
      label={t('settings.review-scope.title')}
      info={t('settings.review-scope.info.body')}
      infoTitle={t('settings.review-scope.info.title')}
      changed={on.length !== REVIEW_MEDIA.length}
    >
      <div style={{ flexBasis: '100%' }}>
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
    </PrefRow>
  )
}

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
// Every alternate is BUNDLED, not fetched. Tippani never contacts the network on
// its own, and a type picker that loaded Google Fonts would be the first thing in
// the app that did — on a screen about how your own words look. All OFL-1.1.

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
        <div className="flex flex-wrap items-center gap-2">
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
              icon={<IconRevert />}
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
// WHY IT IS A POP-UP AND NOT A GROUP. The list is as long as the reader's library
// has languages — one row each, with no ceiling — and a section that grows without
// bound pushes every fixed row on the screen below the fold. The pack's own note
// says Settings should "read from the metadata language table… rather than keeping
// a second list"; this keeps no list. It reads that table and writes the faces.
//
// AND THE LANGUAGES ARE ADDED SOMEWHERE ELSE, which is why the panel carries a
// door rather than an add box. A language exists because a quote is in it or
// because it was named in Metadata; inventing one here would be a second way to
// create the same row, and the two would disagree the first time anybody used the
// other.
//
// THE SAMPLE IS THE LANGUAGE'S OWN NAME FOR ITSELF, drawn in the face being
// chosen: Deutsch in the serif you gave German, বাংলা in the Bengali face. It is
// the same test the script check makes and a reader can make it by eye — a face
// with no Bengali in it draws that row as boxes, on the row where it was picked.
function QuoteFaces({ prefs, onSaved, onGo, index, defaultRow = null }) {
  // What the library holds, seeded from the cache so a second opening draws the
  // rows on the first paint — this list arrives over the network, and a table that
  // lands a frame late reads as a panel with nothing in it.
  const [inLibrary, setInLibrary] = useState(() => cachedVocabulary()?.languages || [])
  useEffect(() => {
    primeSearchVocabulary().then((v) => setInLibrary(v?.languages || [])).catch(() => {})
  }, [])
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState('')
  const live = draft || prefs || {}
  useEffect(() => { setDraft(null) }, [prefs])
  const rows = languageMarksState(inLibrary)

  // Applied first and asked after, like every other type control here: the point
  // of a face picker is watching the type move.
  async function saveFace(row, token) {
    const patch = quoteFontPatch(live, row.key, token)
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
    <PrefGroup index={index} title={t('settings.quote-faces.title')} sub={t('settings.quote-faces.intro.prose')} wide>
      {/* WHAT EVERY LANGUAGE FALLS BACK TO, at the head of the table it is the
          default for. A per-language table with no default is a table that cannot
          answer "what are my quotes set in" — only "what is my German set in" —
          and the answer used to live two groups up under a heading about the
          interface. */}
      {defaultRow}
      {rows.length === 0 && <p className="microcopy">{t('settings.quote-faces.none')}</p>}
      {rows.map((row) => {
        const chosen = quoteFaceFor(live, row.key)
        // The autonym where this app knows one, and what the reader calls the
        // language where it does not: a sample has to be IN the script to say
        // anything about a face that draws it.
        const sample = languageFor(row.key)?.autonym || row.name
        return (
          <PrefRow
            key={row.key}
            label={row.name}
            changed={!!chosen}
            said={
              <p
                className="font-specimen"
                dir="auto"
                style={{ fontFamily: chosen ? `'${chosen.family}'` : undefined, fontSize: 'var(--type-display-17)' }}
              >
                {sample}
              </p>
            }
            control={
              <FaceSelect
                faces={ALL_FACES}
                // THE LANGUAGE'S OWN SCRIPT, FROM ITS ISO TAG — the owner's ask,
                // and the place it matters most: this list is being chosen for
                // ONE language, so a face that can write it should say so in the
                // script it writes, and one that cannot should not pretend by
                // wearing a Latin name beside the others.
                script={scriptOf(row.key)}
                value={chosen?.id || ''}
                inheritLabel={t('settings.languages.face.inherit')}
                ariaLabel={t('settings.languages.face.aria', { name: row.name })}
                onChange={(id) => saveFace(row, id)}
              />
            }
          />
        )
      })}
      {/* THE DOOR, AT THE FOOT OF THE LIST IT EXPLAINS. A language missing from
          this panel is missing because nothing in the library is in it and nobody
          has named it — which is a thing to do on Metadata, not here. */}
      {/* THE DOOR, AT THE FOOT OF THE LIST IT EXPLAINS. A language missing from
          this list is missing because nothing in the library is in it and nobody
          has named it — which is a thing to do on Metadata, not here.

          THE LANGUAGE TABLE, NOT METADATA'S FRONT DOOR. A reader sent here wants
          to add a language, and Metadata is eight sections; landing them on the
          overview and letting them find Languages is the difference between a
          door and a direction. */}
      <PrefRow
        label={t('settings.quote-faces.add.prose')}
        control={
          <GhostButton icon={<IconOpen />} keepLabel onClick={() => onGo?.('metadata', 'languages')}>
            {t('settings.quote-faces.add.open')}
          </GhostButton>
        }
      />
      <ErrorText>{err}</ErrorText>
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
function FontSections({ prefs, onSaved, onGo, index }) {
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

  return (
    <>
      {confirmDialog}
      {/* YOUR OWN FACES, WHICH EVERY LIST BELOW IS DRAWN FROM — so they come
          first, as the pack has them (group 2, beside the language rows). */}
      <PrefGroup index={index} title={t('settings.type.own.title')}>
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
        index={index + 1}
        title={t('settings.type.faces.title')}
        sub={t('settings.type.faces.sub', { language: scopeName })}
        wide
      >
        {uiRows.map(fontRow)}
      </PrefGroup>

      {/* WHAT A QUOTE IS SET IN, WHICH IS A QUESTION ABOUT ITS LANGUAGE and not
          about this app's interface — AND IT IS ON THE SCREEN NOW. The owner's
          ask: "why is there still a quotes typeface chooser? That should have been
          folded into fonts by language." It is the same argument the rest of this
          pass has been making: the panel behind that button existed because
          Settings was one long column where an unbounded list pushed everything
          under it off the screen, and Language is its own screen now with a card
          per subsection.

          THE LIST IS STILL AS LONG AS YOUR LIBRARY HAS LANGUAGES, and that is why
          this group is the one that grows rather than a fixed card above it. */}
      <QuoteFaces
        prefs={prefs}
        onSaved={onSaved}
        onGo={onGo}
        index={index + 2}
        /* THE DEFAULT ROW, DRAWN BY THE SAME FUNCTION AS EVERY OTHER FACE ROW.
           `fontRow` carries the size dial, the style modifiers and the revert
           glyph; a hand-rolled copy here would be the second place a face is
           chosen, and the repo's directive is that a control on two screens lives
           in one function both call. It is handed in rather than looked up inside
           QuoteFaces because the save path is this section's — one preferences
           object, one writer. */
        defaultRow={quoteBaseRow ? fontRow(quoteBaseRow) : null}
      />
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
  // WHETHER THE TEN NUMBERS HAVE BEEN MOVED, which is what the door's own dot
  // answers. The blob is empty until somebody edits one, so its presence IS the
  // change — no table of defaults to keep in step, which is the trap `changedIn`
  // documents for the section counts.
  const tuningTouched = !!String(p.srTuning || '').trim()
  function set(patch) {
    onPreferences?.(patch)
    json('PUT', '/auth/me/preferences', patch)
  }
  return (
    <Card>
      {/* THE SECTION IS THE HEADING — see AppearanceCard. The dot's words, which
          are about how an interval moves, are on the rows they are about
          (Adaptive intervals, The numbers behind the schedule) and in the section's own
          dot; a third copy over the whole card is the thing being consolidated. */}
      {/* EVERY CONTROL THIS SECTION HAS IS ON THIS SCREEN. There is no door left.
          It began as two controls and a door — the right answer to a question that
          has since changed: Settings was one column of nine cards, where every
          extra row was a scroll past on the way to the fonts. Review is its own
          screen now.

          THE OWNER'S RULING, NOW THE REPO'S MANTRA: "Use the space available.
          Think like the user. Whatever will be used more needs to be up front."

          THE LINE MOVED TWICE. First the four switches came out of the door, on
          the argument that "the schedule is one decision made once" is true of the
          ten multipliers and not of them — "start new lines at mastered" is a
          decision about a library you have already read, and "practice moves the
          schedule" is one people change the first time practice stops feeling
          free. Then the ten went too, because the surviving argument for keeping
          them was about how OFTEN they are used, and the rule turns on something
          else: what is genuinely RARE goes behind a door, what is merely DETAILED
          goes lower on the same screen. The pack draws a door here
          (settings-restructured.dc.html: "The numbers behind the schedule → Open
          the numbers") and this screen does not; the pack's own reason for it was
          the long scroll, which is the constraint this whole pass removed. */}
      <PrefColumns>
      {/* THE PACK'S TWO COLUMNS AND ITS THREE GROUPS: what the deck asks on the
          left, how the schedule moves on the right, and what is never asked at
          full width under both. This section was one column of stacked
          label-over-control blocks — the only Settings section that had not been
          given rows at all. */}
      {/* THE DAILY DECK TAKES THE WHOLE WIDTH, on the owner's ask. It is the
          longest group on the section — a slider, a scope chooser, a row of
          question chips and the tier — and half a desktop column made every one
          of those wrap where the schedule group beside it had rows to spare. */}
      <PrefGroup index={1} title={t('settings.quiz.group.deck.title')} wide>
        {/* 5 TO 20, widened from 2 to 10 on the owner's instruction; the v3 pack
            draws 5 to 60. An account already holding 2, 3 or 4 keeps it — the
            server validates what is written and rewrites nothing — but cannot get
            back below five through this control. */}
        <PrefRow
          label={t('settings.quiz.per-day.label')}
          changed={(p.srDaily || 8) !== 8}
          control={
            <Slider
              label={t('settings.quiz.per-day.label')}
              hideLabel
              min={5}
              max={20}
              step={1}
              value={p.srDaily || 8}
              onCommit={(v) => set({ srDaily: v })}
            />
          }
        />
        <ReviewScope value={p.srReviewScope} onChange={(v) => set({ srReviewScope: v })} />
        {/* THE PACK'S ORDER, WHICH THIS HAD INVERTED: what it draws from, then
            what it asks, then how hard it asks it (settings-restructured.dc.html
            :2688-2695). Difficulty came second here, which puts the narrowest
            decision above the one that decides what there is to be asked about. */}
        <QuestionKinds p={p} set={set} only="daily" />
        <HowItAsks p={p} set={set} />
      </PrefGroup>
      <PrefGroup index={2} title={t('settings.quiz.group.schedule.title')}>
        <ScheduleRows p={p} set={set} />
      </PrefGroup>
      {/* PRACTICE IS ITS OWN GROUP, because the heading has to name everything
          under it. These two rows sat under "Schedule" — a heading that names
          one of the three things it held — which is the same defect this pass
          had already fixed once in group 1 and then reintroduced here to keep
          the columns even. The pack's group 2 is the schedule and nothing else
          (settings-restructured.dc.html:2698-2712); it has no practice deck to
          place, because it has one deck and this app has two. So the second deck
          gets a heading of its own rather than borrowing one that is not about
          it. Column balance is not a reason to file a row under the wrong name:
          a reader looking for what practice asks would not look under Schedule,
          and a reader reading Schedule is told a thing that is not the schedule. */}
      <PrefGroup index={3} title={t('settings.quiz.group.practice.title')}>
        <PracticeCounts p={p} set={set} />
        <QuestionKinds p={p} set={set} only="practice" />
      </PrefGroup>
      {/* ── THE NUMBERS, ON THE SCREEN. THE DOOR IS GONE ──
          It held the ten schedule numbers, and the paragraph that stood here
          argued it had earned that: "one decision, how the interval moves… a
          reader who has made it does not come back". That argument is about how
          OFTEN a control is used, and the repo's rule turns on something else —
          the owner's, now the mantra: "Use the space available. Think like the
          user. Whatever will be used more needs to be up front." What is GENUINELY
          RARE goes behind a door; what is merely DETAILED goes lower on the same
          screen. Ten sliders are detailed. They are not rare enough to cost four
          presses, and there was half a screen of empty ground under the card that
          hid them.

          THE DOOR WAS A CONSTRAINT'S SHADOW. It was built when Settings was one
          column of nine cards, where every extra row was a scroll past on the way
          to the fonts. Review is its own screen now. CLAUDE.md names this exact
          door as the worked example of one that survived the reason for it.

          LAST, AND WIDE, WHICH IS WHERE DETAIL BELONGS. It is the group a reader
          scrolls TO rather than past — everything above it is what they came for
          — and at full measure each row is a name, a range and a readout on one
          line instead of a slider wrapping under its own label.

          AND THE PANEL'S "Done" WENT WITH THE PANEL. It closed the door; there is
          no door. Every row here commits on release, as every other row in
          Settings does, so there was never anything for it to confirm. */}
      <PrefGroup
        index={4}
        title={t('settings.quiz.panel.title')}
        sub={t('settings.quiz.in-depth.tip')}
        info={t('settings.quiz.tuning.info.body')}
        aside={tuningTouched ? t('settings.quiz.tuning.changed.aside') : null}
        wide
      >
        <SRTuning p={p} set={set} />
      </PrefGroup>
      {/* NEVER ASKED ABOUT: not a dial but a list of decisions the reader has
          already made and may want back, and the only reason to look for it is
          not remembering making them. It has never been behind a door, for the
          same reason nothing here is now. */}
      <PrefGroup
        index={5}
        title={t('settings.quiz.skipped.title')}
        info={t('settings.quiz.skipped.info.body')}
        aside={t('settings.quiz.skipped.aside')}
        wide
      >
        <NeverAsked />
      </PrefGroup>
      </PrefColumns>
    </Card>
  )
}

// ScheduleRows — how the interval moves, on the section rather than behind the
// door.
//
// THE PACK PUTS THEM ON THE SCREEN (settings-restructured.dc.html: group "2 ·
// Schedule" — adaptive, practice, where a new line starts, how soon a seen one
// comes back) and keeps ONE thing behind a door: the ten numbers, under "The
// numbers behind the schedule → Open the numbers". This app had drawn the line
// further out, with every schedule control inside the panel on the reasoning that
// the schedule is "one decision a reader makes once and then lives inside".
//
// THAT READING LOSES THE FOUR CONTROLS SOMEBODY ACTUALLY COMES BACK FOR. "Start
// new lines at mastered" is a decision about a library you have already read;
// "practice moves the schedule" is one people change when practice stops feeling
// free.
//
// AND THE TEN WENT OUT AFTER THEM, so this file no longer has a door at all —
// see the head of the section. This paragraph ended "which is where the pack
// puts it and where it stays", and it did not stay: the pack's door was drawn
// against a single scrolling column, and that column is gone.
function ScheduleRows({ p, set }) {
  return (
    <>
      <PrefRow
        label={t('settings.quiz.adaptive.title')}
        info={t('settings.quiz.adaptive.info.body')}
        changed={!!p.srLadder}
        control={
          /* THE STORED FLAG IS THE LADDER, not adaptive, so the zero value is the
             default the way it is for every other switch here. `srAdaptive` was a
             flat bool in a JSON blob with no omitempty, so every account already
             carried `false` whether the reader chose the ladder or never opened
             this panel — a default that cannot be flipped. The two option values
             stay in the reader's terms: off is adaptive. */
          <Toggle
            ariaLabel={t('settings.quiz.adaptive.aria')}
            value={p.srLadder ? 'ladder' : 'adaptive'}
            onChange={(v) => set({ srLadder: v === 'ladder' })}
            options={[['adaptive', t('settings.quiz.adaptive.on.label')], ['ladder', t('settings.quiz.adaptive.ladder.label')]]}
          />
        }
      />
      {/* WHERE A LINE ENTERS, which is not how hard it is asked. The tier row says
          what KIND of question a line in the rotation gets; this says what rung a
          line you have never been asked about starts on. The pack draws both and
          this app had only the first — an audit of the two paired them as the same
          control, which they are not.

          TWO RUNGS, NOT THE PACK'S THREE. The pack offers Fresh, Known and
          Mastered; the owner's ruling is "either at not seen or mastered (first
          tier)", so the middle one is not offered — a reader who wants a line
          treated as half known can answer it once. */}
      <PrefRow
        label={t('settings.quiz.start.title')}
        info={t('settings.quiz.start.info.body')}
        changed={(p.srStart || 'unseen') !== 'unseen'}
        control={
          <Toggle
            ariaLabel={t('settings.quiz.start.title')}
            value={p.srStart || 'unseen'}
            onChange={(v) => set({ srStart: v })}
            options={[
              ['unseen', t('settings.quiz.start.unseen.label')],
              ['mastered', t('settings.quiz.start.mastered.label')],
            ]}
          />
        }
      />
      <PrefRow
        label={t('settings.quiz.seen.title')}
        info={t('settings.quiz.seen.info.body')}
        changed={(p.srSeen || 1) !== 1}
        control={
          <Slider
            label={t('settings.quiz.seen.label')}
            hideLabel
            min={1}
            max={1.5}
            step={0.05}
            value={p.srSeen || 1}
            format="common.slider.multiplier.format"
            decimals={2}
            onCommit={(v) => set({ srSeen: v })}
          />
        }
      />
    </>
  )
}

// SRTuning — the ten numbers the schedule is made of, as rows on the section.
//
// IT WAS `SRDeepControls` AND IT WAS A POP-UP. Both halves of that name were
// already stale before this change: the "controls" it held were down to the ten
// numbers — the tier, the confirm switch, both repertoires, adaptive and the seen
// multiplier had each moved out to a row of their own — and "deep" described a
// door that no longer needed to exist. A name that describes where something used
// to live is how the next reader learns the wrong shape of the screen.
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
// ── NEVER ASKED ABOUT: every quote you have told the deck to skip.
//
// WHY THE SCREEN EXISTS. Excluding a quote is a decision made one at a time, on a
// card the reader may never open again, and its only trace afterwards is a card
// that stops coming round. A deck that feels thin has either run out of material
// or been narrowed by twenty decisions nobody remembers making, and until now
// nothing on any screen could tell those apart. The v3 pack draws it here, under
// Review, grouped by work.
//
// IT UNDOES THROUGH THE SAME ENDPOINT THAT DID IT. `review.jsx` excludes a card
// with POST /<kind>s/bulk {ids, review:false}; this sends the same call with
// `review: true`, for one quote or for a whole work's worth. A second writer for
// one column is how the two come to disagree about what "excluded" means — which
// is the exact failure 0033's own header records from the first time this flag
// had two readers.
//
// A WORK IS A ROW, AND THE QUOTES ARE BEHIND IT. The pack draws each work with
// its cover or poster, the people behind it, a count, and a chevron
// (settings-restructured.dc.html:381-403); this drew a mono label and nothing
// else, which asks a reader to recognise their own books from a column of
// strings. The tick boxes are the other half of the same ask: one press per
// quote was the only way to put back a run of them, and a reader who skipped a
// chapter's worth has no verb for what they actually want to say.
function NeverAsked() {
  const [groups, setGroups] = useState(null)
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  // WHICH WORKS ARE OPEN, AND NONE ARE AT FIRST. The pack draws this collapsed
  // (settings-restructured.dc.html:2965) and the reason is the shape of the data:
  // a reader who skipped forty quotes across six works meets six rows they can
  // recognise, not forty lines of prose they have to read to find the one.
  const [open, setOpen] = useState(() => new Set())
  // THE PICKED SET IS QUOTES, NOT WORKS, even though a work's box ticks all of
  // them. What the button does is restore quotes; a selection of works would
  // have to be expanded into quotes before it could act, and then a work whose
  // rows changed under it would restore something the reader never ticked.
  const [picked, setPicked] = useState(() => new Set())
  // A CREDIT IS A DOOR, everywhere in this app — the standing directive, and
  // `person-router.test.jsx` holds every screen that draws one to it. A chip that
  // named an author and did nothing would be the same picture as one that opens
  // them, which is the failure that rule exists to prevent.
  const personStack = usePanelStack()
  const [person, setPerson] = useState(null)
  const openPerson = usePersonOpener(personStack, setPerson)

  const load = useCallback(async () => {
    const r = await json('GET', '/review/excluded')
    if (r.ok) {
      setGroups(r.data.groups || [])
      setTotal(r.data.total || 0)
    }
  }, [])
  useEffect(() => { load() }, [load])

  // The endpoint is per kind, and a group is all one kind, so a work's worth is
  // one call. `kind` comes back on the row rather than being derived from the
  // shape of it — the server already knows which source a row came from and
  // guessing here would be a fourth place that has to learn about a new quote
  // kind.
  const KIND_PATH = { book: 'annotations', screen: 'dialogues', utterance: 'quotes' }
  // WHAT THE NAME UNDER A TITLE IS, per source: a book's is its author, a film's
  // its director, and a standalone quote's the person who said it. The person
  // screen is reached by kind and name, so a wrong kind here opens the wrong
  // record rather than failing visibly.
  const CREDIT_KIND = { book: 'author', screen: 'director', utterance: 'speaker' }
  const restore = async (pairs) => {
    setBusy(true)
    // ONE CALL PER KIND, because the bulk route is per kind. A selection can
    // span a book and a film, and sending the film's ids to /annotations/bulk
    // would be a 404 on rows that exist — the scoping is by source table.
    const byKind = new Map()
    for (const [kind, id] of pairs) {
      if (!byKind.has(kind)) byKind.set(kind, [])
      byKind.get(kind).push(id)
    }
    for (const [kind, ids] of byKind) await json('POST', `/${KIND_PATH[kind]}/bulk`, { ids, review: true })
    setPicked(new Set())
    await load()
    setBusy(false)
  }

  const mark = (g) => `${g.kind}:${g.work_id}:${g.quotes[0].id}`
  const qMark = (q) => `${q.kind}:${q.id}`
  const pick = (marks, on) => setPicked((was) => {
    const next = new Set(was)
    for (const m of marks) { if (on) next.add(m); else next.delete(m) }
    return next
  })
  const chosen = () => [...picked].map((m) => {
    const [kind, id] = m.split(':')
    return [kind, Number(id)]
  })

  if (groups === null) return <p className="microcopy">{t('common.state.loading')}</p>
  if (groups.length === 0) return <p className="microcopy">{t('settings.quiz.skipped.none')}</p>

  return (
    <div className="space-y-4">
      {/* THE COUNT STAYS WHEN A SELECTION STARTS, and the chosen figure joins it
          rather than replacing it. "12 chosen" alone cannot say chosen out of
          what, and this list's whole job is telling a reader how much they have
          quietly switched off. */}
      <div className="skipped-bar">
        <p className="microcopy">{t('settings.quiz.skipped.count', { n: total })}</p>
        {picked.size > 0 && (
          <>
            <span className="grow" />
            <span className="microcopy">{t('settings.quiz.skipped.chosen', { n: picked.size })}</span>
            <GhostButton icon={<IconRevert />} disabled={busy} onClick={() => restore(chosen())}>
              {t('settings.quiz.skipped.restore-work.label', { n: picked.size })}
            </GhostButton>
            <GhostButton icon={<IconClose />} disabled={busy} onClick={() => setPicked(new Set())}>
              {t('settings.quiz.skipped.clear.label')}
            </GhostButton>
          </>
        )}
      </div>
      {groups.map((g) => {
        const gk = mark(g)
        const shown = open.has(gk)
        const marks = g.quotes.map(qMark)
        const all = marks.every((m) => picked.has(m))
        // A STANDALONE QUOTE HAS NO WORK TO BE UNDER, and saying so is better
        // than printing an empty heading that reads as a bug.
        const title = g.title || t('settings.quiz.skipped.standalone')
        return (
          <div key={gk} className="skipped-group">
            <div className="skipped-work">
              <CheckBox
                checked={all}
                disabled={busy}
                ariaLabel={t('settings.quiz.skipped.pick-work.aria', { title })}
                onChange={(on) => pick(marks, on)}
              />
              {/* THE ART IS THE APP'S OWN COVER, hatch and all — a film's
                  placeholder says POSTER and a book's says COVER, which is the
                  one word that tells a reader what is missing. A standalone
                  quote has no artwork at all and is sent none. */}
              <Cover
                path={g.art}
                title={g.title}
                badge={g.kind === 'screen' ? 'common.badge.poster' : 'common.badge.cover'}
              />
              <div className="skipped-work-said">
                {/* THE TITLE IS THE DOOR. One control per row: a chevron beside a
                    pressable title would be two ways to do one thing, and the
                    repo's rule is that a control drawn twice is drawn once. */}
                <button
                  type="button"
                  className="skipped-work-open"
                  aria-expanded={shown}
                  onClick={() => setOpen((was) => {
                    const next = new Set(was)
                    if (next.has(gk)) next.delete(gk); else next.add(gk)
                    return next
                  })}
                >
                  <span className="skipped-work-title">{title}</span>
                  <span className="skipped-work-count">{t('settings.quiz.skipped.count', { n: g.quotes.length })}</span>
                  <span className="skipped-work-chev" aria-hidden="true"><IconChevron open={shown} /></span>
                </button>
                {/* THE CHIPS SIT OUTSIDE THE BUTTON, not inside it as the pack
                    draws them: a chip is itself a button here, and a button
                    inside a button is markup no browser agrees about. */}
                {(g.people || []).length > 0 && (
                  <Scroller axis="x" className="skipped-work-people">
                    {g.people.map((name) => (
                      <PersonChip key={name} kind={CREDIT_KIND[g.kind]} name={name} onOpen={openPerson} />
                    ))}
                  </Scroller>
                )}
              </div>
            </div>
            {shown && (
              <>
                {g.quotes.map((q) => (
                  <div key={q.id} className="skipped-row">
                    <CheckBox
                      checked={picked.has(qMark(q))}
                      disabled={busy}
                      ariaLabel={t('settings.quiz.skipped.pick-one.aria')}
                      onChange={(on) => pick([qMark(q)], on)}
                    />
                    {/* dir="auto": a skipped quote is in whatever language it was
                        written in, and the first strong character decides. */}
                    <p className="skipped-quote" dir="auto">{q.text}</p>
                    <IconButton
                      icon={<IconRevert />}
                      ariaLabel={t('settings.quiz.skipped.restore-one.aria')}
                      tooltip={t('settings.quiz.skipped.restore-one.aria')}
                      disabled={busy}
                      onClick={() => restore([[q.kind, q.id]])}
                    />
                  </div>
                ))}
                {/* A WORK'S BUTTON IS NOT THE WORK'S FLAG. It clears the quotes
                    listed under it, one bulk call with their ids, because that is
                    what "put these back" means to somebody reading this list.
                    Clearing the work's own column as well would also change what
                    happens to quotes they add to it TOMORROW, which they have not
                    asked for and could not see here. */}
                <div className="skipped-work-foot">
                  <GhostButton
                    icon={<IconRevert />}
                    disabled={busy}
                    onClick={() => restore(g.quotes.map((q) => [q.kind, q.id]))}
                  >
                    {t('settings.quiz.skipped.restore-work.label', { n: g.quotes.length })}
                  </GhostButton>
                </div>
              </>
            )}
          </div>
        )
      })}
      <PanelHost stack={personStack} />
      {person && (
        <PersonModal
          kind={person.kind}
          name={person.name}
          onClose={() => setPerson(null)}
          onSaved={() => setPerson(null)}
        />
      )}
    </div>
  )
}

// QuestionKinds — WHICH QUESTIONS EACH DECK MAY ASK, and it is on the Review
// screen rather than behind a door.
//
// THE OWNER'S RULING, MADE THE REPO'S MANTRA: "Use the space available. Think like
// the user. Whatever will be used more needs to be up front." This was the first
// block inside "In-depth controls", and that door exists because Settings used to
// be one column of nine cards where every extra row was a scroll past. Review is
// its own screen now with most of a phone's height standing empty under three
// controls — so the door was hiding things behind a constraint that no longer
// exists.
//
// AND IT IS THE BLOCK WITH THE BEST CLAIM TO THE SPACE. Its own commit says why:
// until 1.16.0 the deck's question types were a constant, so "somebody who cannot
// bear multiple choice, or who wants the daily deck to be nothing but fill-in-the-
// blank, had no way to say so." That is a want people actually have, and it was two
// presses and a scroll away.
//
// ITS OWN COPY OF THE QUESTION SET, derived from the preferences it is handed —
// which is what makes it drawable in two places without the two disagreeing. The
// in-depth panel's "back to defaults" clears `srQuestions`, the optimistic apply
// puts the cleared value on `p`, and this re-derives.
function QuestionKinds({ p, set, only = null }) {
  // ONE SOURCE OF TRUTH, DERIVED, AND THIS COST A READER THEIR CHANGE. It held
  // the whole question map — both decks — in a useState initialised once from the
  // preferences and never re-derived. That was survivable while ONE of these was
  // drawn; the moment the daily row and the practice row became two instances,
  // each held its own copy of BOTH decks and each wrote the whole blob. So
  // toggling a daily question and then a practice one PUT a daily list that had
  // never heard about the first press: the reader's first change came back, in
  // silence, and the chip on screen went on saying it had been made.
  //
  // `p` is the parent's preferences and `set` lifts every change into them, so
  // deriving per render is both correct and optimistic — the same thing every
  // other row on this section already does with p.srTier, p.srSubmit and the
  // rest. There is nothing left for two instances to disagree about.
  const qs = parseQuestions(p.srQuestions)
  const commit = (next) => set({ srQuestions: questionsBlob(next) })
  return (
    <>
      {REVIEW_DECKS.filter(([deck]) => !only || deck === only).map(([deck, deckLabel]) => (
        /* A ROW PER DECK, with its chips as the row's own second line — the shape
           every other control on this section now has, and the shape the pack
           draws ("What you get asked"). It was a mono label over a wrapping chip
           row, twice, which read as two unlabelled blocks of accent. */
        <PrefRow
          key={deck}
          label={t('settings.quiz.deck.title', { name: deckLabel })}
          info={
            deck === 'daily'
              ? t('settings.quiz.deck.daily.info.body')
              : t('settings.quiz.deck.practice.info.body')
          }
          changed={qs[deck].length !== questionsFor(deck).length}
        >
          <div style={{ flexBasis: '100%' }}>
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
              // THE DECK IS PART OF THE NAME, because the words alone are not
              // unique on this screen: the same six questions are offered to the
              // daily deck and to practice, in two columns.
              ariaLabel: t('settings.quiz.deck.question.aria', { question: q.label, name: deckLabel }),
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
        </PrefRow>
      ))}
    </>
  )
}

// HowItAsks — the three dials about the QUESTION, on the screen rather than behind
// the door. See QuestionKinds for the ruling; these are the same argument.
//
// "How hard the questions are" is the control a reader reaches for the moment the
// deck feels wrong in either direction, and it was three presses away. "Confirm
// each answer" is how the quiz FEELS under the thumb, set once on the first day.
// "Practice counts" is the one question somebody asks before they practise at all.
// None of the three is schedule maths, which is what is left behind the door.
function HowItAsks({ p, set }) {
  return (
    <>
      {/* A THIRD AXIS, and not the same as either of the others: srQuestions says
          WHICH questions may be asked, srTuning says how much an answer moves the
          schedule, and neither makes the same card easier or harder to get right.
          Medium is what the quiz has always done. */}
      <PrefRow
        label={t('settings.quiz.tier.title')}
        info={t('settings.quiz.tier.info.body')}
        changed={(p.srTier || 'medium') !== 'medium'}
        control={
          <Toggle
            ariaLabel={t('settings.quiz.tier.title')}
            value={p.srTier || 'medium'}
            onChange={(v) => set({ srTier: v })}
            options={REVIEW_TIERS.map((k) => [k, t(`settings.quiz.tier.${k}.label`)])}
          />
        }
      >
        {/* A LINE FOR WHICHEVER TIER IS CHOSEN, on the owner's ask. Only Easy
            carried one, which left three of the four options as adjectives: a
            reader on Hard could read the whole row and not learn that it means
            typing. The info dot says what the four are; this says what THIS one
            does, which is the question a reader has while their finger is on the
            control.

            THE COST STAYS ON EASY'S LINE. Close wrong answers teach more than
            obvious ones (Little et al., 2012); Easy gives that up on purpose, and
            a tier that only advertised its benefit would be selling the reader
            something. */}
        <p className="microcopy" style={{ flexBasis: '100%', lineHeight: 1.6 }}>
          {t(`settings.quiz.tier.${p.srTier || 'medium'}.note`)}
        </p>
      </PrefRow>
      <PrefRow
        label={t('settings.quiz.submit.title')}
        info={t('settings.quiz.submit.info.body')}
        changed={!!p.srSubmit}
        control={
          <Toggle
            ariaLabel={t('settings.quiz.submit.aria')}
            value={p.srSubmit ? 'on' : 'off'}
            onChange={(v) => set({ srSubmit: v === 'on' })}
            options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
          />
        }
      />
    </>
  )
}

// PracticeCounts — whether answering in Practice moves the schedule at all. It
// is the switch people reach for the first time practice stops feeling free.
//
// IT IS IN THE PRACTICE GROUP, NOT THE SCHEDULE'S. This comment said the
// opposite, and was left saying it for a commit after the row moved: the
// argument was that a row about the schedule belongs with the schedule, which
// reads well until you notice it puts the word "practice" under a heading that
// says "Schedule". The row is about what PRACTICE does, and a reader looking for
// it looks under practice.
function PracticeCounts({ p, set }) {
  return (
    <PrefRow
      label={t('settings.quiz.practice-counts.title')}
      info={t('settings.quiz.practice-counts.info.body')}
      changed={!!p.srPracticeCounts}
      control={
        <Toggle
          ariaLabel={t('settings.quiz.practice-counts.aria')}
          value={p.srPracticeCounts ? 'on' : 'off'}
          onChange={(v) => set({ srPracticeCounts: v === 'on' })}
          options={[['off', t('vocab.no.label')], ['on', t('vocab.yes.label')]]}
        />
      }
    />
  )
}

function SRTuning({ p, set }) {
  // THE QUESTION MAP LEFT WITH THE REPERTOIRES. This panel held a copy of it long
  // after the chips moved onto the section, along with the writer that went with
  // it — a second writer for `srQuestions` that nothing on screen could reach,
  // which is the shape of thing that comes back to life the day somebody adds a
  // row here.
  const [tune, setTune] = useState(() => parseTuning(p.srTuning))
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
    setTune(parseTuning(''))
    // WHAT THIS GROUP HOLDS, AND NOTHING ELSE. It used to clear every review
    // preference on the reasoning that "a reader who presses Back to defaults
    // inside the in-depth panel means the panel" — which was true when the panel
    // held the tier, the confirm switch, both repertoires, adaptive, the seen
    // multiplier and the ten numbers. The panel is the ten numbers now; the rest
    // are rows on the section, each with its own changed dot, and the section has
    // its own Reset. A button that reached out of its panel and turned five
    // visible rows back would be the least trustworthy control on the screen —
    // which is the same sentence as before, pointing the other way.
    //
    // AND "THE SECTION HAS ITS OWN RESET" WAS NOT TRUE WHEN THIS WAS WRITTEN.
    // The button existed; the write behind it did not — `resetSection` cleared
    // the keys into App's local state and sent no PUT, so pressing it restored
    // nothing past the next load. Narrowing this reset on the strength of that
    // sentence left five review preferences with no working restore at all. The
    // sentence is true now because the PUT was added, not because it was
    // checked; it is recorded here because the cost of the next unchecked
    // "something else covers this" is the same.
    set({ srTuning: '' })
  }
  return (
    <div className="space-y-6">
      {/* THE ROOM IS ROWS TOO, which is where the last pass stopped. Sliders
          rather than boxes because every one of these is bounded, and a bounded
          value typed into a box is a value that can be refused after the fact —
          but each one was drawn as an ALL-CAPS mono label over a full-width
          slider, the exact label-over-block shape this section was just rid of,
          ten times in a column. The pack draws them as rows: name in the UI face
          at the left, the range beside it, the readout in mono at the end
          (settings-restructured.dc.html:657-661). `PrefRow` is that shape and is
          already what the section outside this door uses, so the room and the
          screen it opened from now read as one thing.

          AND THE GROUP HEADING IS GONE. "The numbers behind it" stood over its
          only content, inside a panel already titled "The numbers behind the
          schedule" — the same fact three times on one press. The panel's own
          title is the heading; the door's info dot carries what the dot here
          carried. The pack has no inner heading either, for the same reason. */}
      <div>
        {TUNING_FIELDS.map((f) => (
          <PrefRow
            key={f.key}
            label={f.label}
            info={f.hint}
            control={
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
            }
          />
        ))}
        <ErrorText>{tuneErr}</ErrorText>
      </div>
      {/* THE RESET STAYS AND THE "Done" DOES NOT. Done closed the door, and there
          is no door — every row here commits on release, the way every other row
          in Settings does, so it never confirmed anything. The reset still has
          work: ten sliders are ten things to put back by hand, and the blob's
          absence is what lets a later change to the defaults reach an account
          that never edited them. It sits at the start of the row rather than
          across from a button that is gone. */}
      <div className="flex gap-2 pt-1">
        <Tooltip label={t('settings.quiz.reset.tip')}>
          <GhostButton icon={<IconRevert />} keepLabel onClick={reset}>{t('settings.quiz.reset.label')}</GhostButton>
        </Tooltip>
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
        {/* WIDE, because a release log is prose at full measure. A column of
            entries broken to half a card is a changelog nobody finishes. */}
        <PrefGroup index={3} title={t('settings.changelog.title')} wide>
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
      <PrefGroup index={1} title={t('settings.updates.title')}>
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
      <PrefGroup index={1} title={t('settings.features.order.title')} info={t('settings.features.order.prose')} rowsRef={drag.listRef} wide>
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
      <PrefGroup index={2} title={t('settings.features.covers.title')} sub={t('settings.features.sizes.aside')}>
        <SizeSlider ariaLabel={t('settings.features.book-size.label')} storageKey="tippani:size:books" def={165} kind="book" works={shelf.book} />
      </PrefGroup>
      <PrefGroup index={3} title={t('settings.features.posters.title')} sub={t('settings.features.sizes.aside')}>
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

  // THE SECOND GROUP OF THE SERVER PANEL — see UpdatesCard for why this is a group
  // and no longer a card of its own. `data-tour` sits on the rows rather than the
  // group, so the tour's halo frames the controls and not the heading above them;
  // an earlier draft of this comment said it had moved to the group, which it had
  // not.
  return (
    <>
      <PrefGroup
        index={2}
        title={t('settings.backup.title')}
        info={t('settings.backup.info.body')}
      >
      <div data-tour="backup">
        {/* THE PACK'S THREE ROWS. It draws Backup as "Make a backup", "Nightly
            backup" and "Restore from an archive", each a row with its own
            sub-line and its own control (settings-restructured.dc.html:2754-2759);
            this was two stacks of divs under one heading. The middle row is NOT
            here and its absence is recorded rather than faked: a nightly backup
            needs something that wakes up at four in the morning, and this repo's
            standing invariant is that no goroutine outlives its request. See
            docs/plans/nightly-backup.md. */}
        <PrefRow
          label={t('settings.backup.make.label')}
          said={loaded && (
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
          control={
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
          onCancel={() => { setPrompt(false); setPhase('idle') }}
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: Math.max(9, Math.round(size / 17)), letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
// has not built, and it is written down in docs/plans/tile-slots.md rather than
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

// physDialCount — how many sliders the door hides, so its row can say so.
//
// IT COUNTS THE SAME WAY `MaterialPhysics` DRAWS, and that is the whole point of
// it being here rather than a number typed into a locale string: the set's slots
// de-duplicated (a set may put one material on two of them, and two identical
// rows would be one control drawn twice), `flat` dropped because Atrium's
// material is none, four dials each, and the six glass dials only when the lens
// is on. A count written by hand is a count that goes stale the first time a set
// gains a slot, and nothing would fail.
export function physDialCount(tiles, glass = false) {
  const names = [...new Set(tiles)].filter((n) => n !== 'flat')
  return names.length * PHYS_DIALS.length + (glass ? GLASS_DIALS.length : 0)
}

function MaterialPhysics({ tiles, tweaks, onChange, glass = false }) {
  // The slots in order, de-duplicated: a set may put the same material on two of
  // them, and two identical rows is the same control drawn twice. The same two
  // lines are `physDialCount` above, which is why they are the same two lines.
  const names = [...new Set(tiles)].filter((n) => n !== 'flat')
  const set = (name, key, value) => onChange({ ...tweaks, [name]: { ...(tweaks[name] || {}), [key]: value } })
  const reset = (name) => {
    const next = { ...tweaks }
    delete next[name]
    onChange(next)
  }
  const g = glassDialsFor(tweaks)
  const setGlass = (key, value) => onChange({ ...tweaks, glass: { ...(tweaks.glass || {}), [key]: value } })
  const glassBlock = glass ? (
    <div>
      <MonoLabel className="mb-2 block">{t('settings.appearance.glass.dials.title')}</MonoLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {GLASS_DIALS.map(([key, label, max]) => (
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
              {PHYS_DIALS.map(([key, label]) => (
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
          // In em as well as px, because a box that holds text has to grow with
          // the reader's type dial — the standing rule, and this box holds a
          // specimen.
          height: 'max(96px, 7em)',
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
          <p style={{ fontFamily: 'var(--font-quote-base)', fontWeight: 'var(--font-quote-base-weight)', fontVariantCaps: 'var(--font-quote-base-caps)', textTransform: 'var(--font-quote-base-case)', fontVariantNumeric: 'var(--font-quote-base-figures)', fontStyle: 'italic', fontSize: 'var(--type-display-12)', lineHeight: 1.35, color: 'var(--ink)' }}>
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
function Appearance({ prefs, onPreferences, part = 'all', onGo = null }) {
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
      {/* NO CARD HEADING: THE SECTION IS THE HEADING. The rail had just drawn
          "Theme" with its own info dot and this card answered with "Appearance"
          and nothing new — two headings, two words for one thing, and on the
          phone they sat one line apart. The owner: "In a lot of places, you have
          two levels of headers, each with their own infodots. Consolidate as much
          as possible." A section holding exactly ONE card draws one heading, and
          the rail owns it; where a section holds two (Server), the inner titles
          are what tells them apart and they stay. */}
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
      {/* NO ASIDE ON THE HEAD ANY MORE. It read "set as a pair" and sat directly
          above the mode toggle, so it looked like a fact about the mode — which is
          the one control here that is emphatically NOT a pair: you pick one of
          three. The owner: "the header row says 'set as a pair'. That seems
          misplaced. User only selects one." The words moved onto the Colours row,
          which is where the pair actually is, and say what the mode row does to it. */}
      {/* FOUR CARDS, TWO OF THEM HALF A ROW. The pack's own shape and the owner's
          instruction for this screen: "In desktop, some cards will be full width
          (like 'light and dark' and 'what is it made of' in the theme section),
          and some half (like 'a theme of your own' and 'accessibility')." The two
          full-width ones each hold a grid that needs the measure — three colour
          doors and their options panel, eight material tiles. The two half ones
          hold rows, and rows do not need 954px: "They do not need the width." */}
      <PrefColumns>
      <PrefGroup index={1} title={t('settings.appearance.group.light.title')} wide>
      <PrefRow
        label={t('settings.appearance.theme.title')}
        sub={t('settings.appearance.theme.hint')}
        changed={themePref !== 'system'}
        control={
          <Toggle
            ariaLabel={t('settings.appearance.match.aria')}
            value={themePref}
            onChange={(v) => persist({ theme: v })}
            // SYSTEM FIRST, WHICH IS THE PACK'S ORDER AND THE DEFAULT'S PLACE
            // (settings-restructured.dc.html:2586). It was last, so the option
            // every new account is already on sat at the far end of the control
            // that is supposed to say where you are.
            options={[
              ['system', t('settings.appearance.match.label')],
              ['light', t('settings.appearance.theme.light.label')],
              ['dark', t('settings.appearance.theme.dark.label')],
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
      {/* ONE ROW CALLED COLOURS, which is what the pack draws
          (settings-restructured.dc.html:2590): light ground, dark ground and
          accent together, under one heading, each swatch opening its own options.

          IT WAS TWO, AND THE SECOND WAS AN INVENTION. A row labelled "Ground" sat
          here and the accent lived twenty rows down among the size dials. "Ground"
          appears nowhere in the pack as a control's name — only inside this row's
          own sub-line — so a word describing the choice had been promoted into the
          name of half of it. The owner: "Do not deviate so much that you start
          randomly inventing new stuff."

          The triads themselves are not the invention: four light and four dark
          were asked for and approved. Where they SIT was. */}
      <PrefRow
        label={t('settings.appearance.colours.title')}
        sub={t('settings.appearance.colours.hint')}
        info={t('settings.appearance.ground.info.body')}
        changed={groundLight !== 'cream' || groundDark !== 'night' || accent !== 'terracotta'}
        control={
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
        }
      >
        {/* THE ANSWER SITS IN THE ROW THAT ASKED IT, which is how the pack draws
            it: a full-measure panel under the doors with its own Hide
            (settings-restructured.dc.html:439-452), not a dialog over the page.

            AND THAT IS NOT A STYLE PREFERENCE. Choosing a ground is a comparison —
            you try one, look at the material under it, try the next — and a
            full-screen dialog is a scrim over the very thing being compared. The
            first cut of this used a FormModal and a rating caught it against the
            pack; what the modal was buying, room for the names, the row gives
            anyway, because the panel runs the full measure. */}
        {colourDoor && (
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
        )}
      </PrefRow>
      </PrefGroup>
      {/* THE GROUP'S HEADING IS THE ONLY HEADING. "2 · What it is made of" sat
          directly above a MonoLabel reading "Material", which is one thing said
          twice — the standing rule, and visible as two stacked labels the moment
          the groups landed. */}
      <PrefGroup index={2} title={t('settings.appearance.group.material.title')} aside={t(MAT_SET_LABELS[materialSet])} wide>
      {/* AS MANY AS FIT, NOT FOUR. Eight sets in a four-column grid on a 1280px
          card drew cards three times the size the pack draws them
          (settings-restructured.dc.html:2600-2620 fits seven across with room for
          a ninth), and on a phone it meant two enormous cards a scroll apart. A
          set is recognised by its material and its colour, both of which read
          at a glance; the size was spending a screen to say so. auto-fill lets
          the same rule give seven on a desk and three on a phone. */}
      {/* THE PACK NAMES THIS ROW (settings-restructured.dc.html:2596) and this app
          drew the grid bare under the group heading — so the control the group
          exists for was the only thing on the section with no name and no line
          saying what it is. */}
      <PrefRow
        label={t('settings.appearance.matset.title')}
        sub={t('settings.appearance.matset.hint')}
        info={t('settings.appearance.matset.info.body')}
        changed={materialSet !== 'manuscript'}
      >
      <div className="material-grid">
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

      </PrefRow>

      {/* TRUE GLASS SITS WITH THE MATERIALS, because it is one: a lens is what a
          surface does with the light behind it, and the group it was in is named
          "how much a control SAYS" — which is about words on buttons. It rode
          there because that group had become the place for whatever was left over,
          and the same sweep that emptied it of the cover sliders and the type
          dials should have moved this too. */}
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
      {/* A DOOR IS A ROW HERE, like the one on Language and font and like the
          pack's own (settings-restructured.dc.html:2620): its name on the left,
          what it is for under that, and the way in at the right-hand edge. It was
          a button floating under the grid with an info dot beside it, which is the
          shape every control on this section has stopped having. */}
      {/* ── AND THIS IS THE ONE DOOR IN SETTINGS THAT STAYS. Every other went
          when its section stopped being a card on a long scroll; the Review
          section's ten numbers were the last, and the reasoning that took them
          out is what keeps this one in.

          THE RULE IS RARE VERSUS DETAILED, not "how many rows". What is merely
          detailed goes lower on the same screen; what is genuinely rare goes
          behind a door. Ten schedule numbers are detailed. This is rare AND
          large: MEASURED, a set is four slots over three or four distinct
          materials, four dials each, plus six more when the lens is on — twelve
          to twenty-two sliders, on a section that already carries three groups,
          three colour doors, an eight-tile grid and the saved looks. Unfolding it
          would put the densest thing in Settings under the second densest.

          AND IT IS REACHED FOR ONCE OR NEVER. The answer to "less shiny" is
          almost always about ONE material, which is why an edit is stored per
          tile rather than as a global multiplier — a reader who has made that
          edit has made it.

          THE COUNT IS ON THE ROW, because "a door with four presses behind it
          costs more than the rows it hides" cuts both ways: a reader deciding
          whether to press deserves to know what is back there, and the number
          moves with the set they have chosen. */}
      {/* THE COUNT IS IN THE SUB-LINE, AND THE FIRST CUT PUT IT IN AN `aside` — a
          prop `PrefGroup` has and `PrefRow` does not, so React dropped it and the
          row drew exactly as before. Nothing failed; the number simply was not
          there. `door-count.test.jsx` found it on its first run, which is the
          whole argument for writing the guard before believing the control. */}
      <PrefRow
        label={t('settings.appearance.phys.title')}
        sub={(() => {
          const n = physDialCount(MAT_SETS[materialSet], trueGlass)
          return t('settings.appearance.phys.open.sub', {
            what: t('settings.appearance.phys.open.tip'),
            dials: t('settings.appearance.phys.count.aside', { count: n, n }),
          })
        })()}
        info={t('settings.appearance.phys.info.body')}
        changed={MAT_SETS[materialSet].some((tile) => physDirty(tile, texTweak))}
        control={
          <GhostButton icon={<IconSliders />} keepLabel onClick={() => setPhysOpen(true)}>
            {t('settings.appearance.phys.open.label')}
          </GhostButton>
        }
      />
      <FormModal open={physOpen} onClose={() => setPhysOpen(false)} title={t('settings.appearance.phys.title')} maxWidth={620}>
        <MaterialPhysics
          tiles={MAT_SETS[materialSet]}
          tweaks={texTweak}
          onChange={saveTweaks}
          glass={trueGlass}
        />
      </FormModal>

      </PrefGroup>
      <PrefGroup
        index={3}
        title={t('settings.appearance.group.saved.title')}
        info={t('settings.appearance.saved.info.body')}
        aside={t('settings.appearance.group.saved.aside', { n: saved.length, cap: SAVED_THEME_CAP })}
      >
      {/* THE LOOKS YOU HAVE SAVED. Six fields travel together in one — both
          grounds, the accent, the material set, the tiles and the dials — because
          a ground chosen against one accent is a different decision against
          another, so switching between two looks is one press instead of six.

          FOUR IS THE CAP AND IT IS THE DESIGN. A fifth turns a set of looks you
          switch between into a list you maintain: naming them, tidying them,
          wondering which of two near-identical ones is the good one. */}
      {/* NO SECOND HEADING. "3 · A theme of your own" was followed by a mono label
          reading "Your saved looks", which is the same thing said twice at two
          sizes — the group heading names the group, and the standing rule is that
          a row says a thing once. What the reader needs here is not another title
          but the looks themselves, so the list IS the group's first row. */}
      {/* TWO ROWS, WHICH IS WHAT THE PACK DRAWS HERE (settings-restructured.dc.html
          :2604-2609): the looks you have saved, and the file you can carry one out
          in. They were a stack of loose controls under a second heading — chips,
          then a box and a button, then two more buttons — on a section where
          everything else had become a row with a name. */}
      <PrefRow
        label={t('settings.appearance.saved.title')}
        sub={t('settings.appearance.saved.hint')}
        changed={saved.length > 0}
        control={
          <div className="flex flex-wrap items-center gap-2">
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
        }
      >
        {/* THE LOOKS THEMSELVES, at the row's full width: they are what the row is
            about, and a name is as long as somebody's name for it. */}
        <div className="flex flex-wrap items-center gap-2" style={{ flexBasis: '100%' }}>
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
          {saved.length >= SAVED_THEME_CAP && <p className="microcopy">{t('settings.appearance.saved.full')}</p>}
        </div>
      </PrefRow>
      {/* THE FILE. Export is ONE theme — what you are wearing — rather than the
          list, because a file called "my theme" that turns out to hold four is a
          file nobody can share a look with. */}
      <PrefRow
        label={t('settings.appearance.saved.file.title')}
        sub={t('settings.appearance.saved.file.hint')}
        control={
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton icon={<IconExport />} onClick={exportTheme}>{t('settings.appearance.saved.export.label')}</GhostButton>
            <GhostButton icon={<IconRestore />} onClick={() => importPick.open()}>{t('settings.appearance.saved.import.label')}</GhostButton>
            {importPick.input}
          </div>
        }
      />
      {importError && <ErrorText>{t(`settings.appearance.saved.import.${importError}`)}</ErrorText>}

      </PrefGroup>
      {/* GROUP 4 IS THE PACK'S "HOW MUCH A CONTROL SAYS", AND IT CARRIES MORE THAN
          THE PACK PUT IN IT. The pack's fourth group is label density alone. This
          app's theme section also holds true glass, the two cover-size sliders, the
          text size and the two quote-reading dials — none of which the pack's theme
          section has, because the pack never had them. They are all answers to "how
          much, and how big", which is what this group is about, so they are here
          rather than in a fifth group invented to hold them. */}
      {/* THE ACCESSIBILITY DIALS OF THIS SECTION, under their own heading, AT THE END. The
          owner's: "Put them in an accessibility subsection under each relevant
          section." Contrast is this section's one — `§6 access`, added before the
          remake and not in the pack at all.

          IT SAT BETWEEN GROUPS 1 AND 2, unnumbered, which made the numbering read
          as a mistake: 1, a nameless interruption, 2. Numbered and last, it is
          where Language and font already puts its own, so a reader who learns
          where accessibility lives on one section knows where it is on the
          other. */}
      <PrefGroup index={4} title={t('settings.group.access.title')}>
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
      {/* HOW MUCH A CONTROL SAYS, WHICH IS AN ACCESSIBILITY DIAL AND HAD A GROUP OF
          ITS OWN. It was the pack's group 4 and it is one row — a heading, a
          number and a full card's width for a single switch about whether controls
          carry their words. The owner: "Button label toggle can go under
          accessibility." It is the same kind of thing as contrast: neither changes
          what the app can do, both change how much of itself it spells out. */}
      <LabelDensity />
      </PrefGroup>
      </PrefColumns>
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
        <PrefColumns>
          {/* 1 · WHAT THE INTERFACE SPEAKS. Three rows, and the pack's own three
              (settings-restructured.dc.html:2635-2648): the language, what stands
              in where it has not been translated, and the door to the other half
              of this question — what your LIBRARY is written in, which is metadata
              and has its own screen. */}
          <PrefGroup index={1} title={t('settings.lang.group.interface.title')}>
            {/* THE LANGUAGE, AND IT STAYS OUT OF `persist` ABOVE for the reason
                that function documents: the Appearance panel re-sends every theme
                field on any change, so a preference riding in that object would be
                wiped by an unrelated accent click. One writer per concern.
                LanguagePicker applies the choice itself and this supplies the
                save. */}
            <PrefRow
              label={t('settings.language.title')}
              info={t('settings.language.info.body')}
              infoTitle={t('settings.language.info.title')}
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
            {/* WHERE A MISSING LINE FALLS BACK TO, which the pack draws and this
                app did not offer at all. A translation is never complete on the
                day it lands, so every interface language has a second one standing
                behind it; the app has always had that behaviour and never a way to
                say which. */}
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
                  // A LANGUAGE NAMES ITSELF. Both labels are the same in en.txt
                  // and bn.txt on purpose — the point of the pair is that a reader
                  // recognises the one they want, and "Bengali" on a Bengali
                  // screen helps nobody.
                  options={[
                    ['en', t('settings.language.fallback.en.label')],
                    ['bn', t('settings.language.fallback.bn.label')],
                  ]}
                />
              }
            />
            {/* THE PACK'S SECOND METADATA DOOR IS NOT DRAWN, and the owner's
                ruling is why. It draws `metaDoor` here — "What your library is
                made of", opening Metadata whole (proto:2643) — and the panel
                below now carries a door of its own to the language TABLE, which
                is what a reader on this screen is actually going to Metadata for:
                "this sheet needs a window to the metadata languages section, not
                entire metadata. And that gate should be in the language fonts
                section, don't you think?"

                TWO DOORS TO ONE SCREEN IS THE REPEAT the same session asked not
                to make — and the general one is the weaker of the pair twice
                over: Metadata is a destination in the navigation already, which
                this row cannot say better, and it lands a reader on an overview
                rather than on the table they wanted. So the specific door stays
                and the general one goes. This is a departure from the pack,
                recorded in Design-decisions.md rather than left to be rediscovered
                as an omission. */}
          </PrefGroup>

          {/* 2, 3 AND 4 — your own faces, the faces the interface is set in, and
              the quote face each language carries. They are one component because
              they are one preferences object and one writer; see FontSections. */}
          <FontSections prefs={prefs} onSaved={onPreferences} onGo={onGo} index={2} />

          {/* THE ACCESSIBILITY DIALS OF THIS SECTION, under their own heading —
              the owner's: "Put them in an accessibility subsection under each
              relevant section."

              THEY ARE HERE AND NOT UNDER THEME because all three are typesetting:
              how big the interface's text is, and how a QUOTE is set when you read
              one — the leading between its lines, and how wide its column runs
              before it wraps. They sat at the foot of the theme section among the
              cover-size sliders, where "quote line length" read as a phrase nobody
              could place. Beside the faces, they are obviously about the same
              thing the faces are about. */}
          {/* NOT `wide`, AND THAT IS THE POINT OF HAVING THE FLAG. Three short
              rows across a whole card put every control an arm's length from its
              own label; in a column they sit beside it, and Quote fonts takes the
              other half of the same line instead of a run of empty texture. */}
          <PrefGroup index={5} title={t('settings.group.access.title')}>
            <TextSizeField prefs={prefs} onPreferences={onPreferences} />
            <QuoteReadingFields prefs={prefs} onPreferences={onPreferences} />
          </PrefGroup>
        </PrefColumns>
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

  // A ROW LIKE THE ROWS AROUND IT. It drew its own label-over-control stack —
  // a MonoLabel and a Select under it — which is the shape every card here used
  // before `PrefRow` existed, and next to a section of rows it read as the one
  // control that had been left behind. The standing rule is that two things which
  // look the same behave the same; the inverse is the defect it was in.
  return (
    <PrefRow
      label={t('settings.appearance.text-size.label')}
      info={t('settings.appearance.text-size.info.body')}
      changed={current !== 100}
      control={
        <SizeDial
          value={current}
          ariaLabel={t('settings.appearance.text-size.label')}
          onChange={set}
          width={124}
        />
      }
    />
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

