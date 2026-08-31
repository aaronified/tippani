// help.jsx — the per-screen glossary behind every "?" button (§ declutter).
//
// The screens themselves no longer carry standing explanatory paragraphs: the
// dense bits moved into InfoDots beside the control they describe, and the
// "what is everything on this page" answer lives here, one entry per control.
// Keeping it in one file rather than scattered through the screens is the point
// — it is the same list docs/ui-glossary.html holds by hand, close enough to the
// components that adding a control and forgetting its help is a visible gap.
//
// AN ENTRY IS A KEY AND A SHAPE, NOT WORDS. The registry below says which control
// each row is about and which of the four text fields that row has; the words
// themselves are in the locale files under <place>.help.<control>.<field>. So the
// list is still one place to read what the app documents — 167 rows, in the order
// they appear on screen — and it is now readable in whichever language the reader
// chose.
//
// `icon` draws the actual glyph the screen uses, so the row is recognisable before
// the words are read. `asset` is a picture that is part of the answer.
import {
  HelpButton,
  HelpList,
  HelpSheet,
  IconArchive,
  IconCalendar,
  IconCopy,
  IconDelete,
  IconDetails,
  IconEdit,
  IconExport,
  IconFilter,
  IconGrid,
  IconHelp,
  IconLanguages,
  IconMenu,
  IconMetadata,
  IconMore,
  IconPlus,
  IconQuote,
  IconReading,
  IconRevert,
  IconSearch,
  IconShare,
  IconType,
  IconUpload,
  useIsMobileScreen,
} from './ui.jsx'
import { Gesture } from './gestures.jsx'
import { t } from './i18n.js'

// ---- assets ----------------------------------------------------------------
//
// Two rules decide what an asset is allowed to be, and both come from what goes
// stale. A LIVE CONTROL is first choice because it is not a picture of the app, it
// IS the app: it reads the same variables the screen reads, so a reader who renamed
// their categories or picked their own colours sees theirs. A SCHEMATIC is second,
// because it describes a relationship rather than an appearance and a restyle cannot
// make it wrong. A screenshot is last and cropped, and there are none here yet.

// HelpSwatches — the reader's own six category colours, live.
//
// var(--hl-N) is what a quote card's left bar is painted with, so this row is the
// actual palette rather than a remembered one. `.color-dot` is the app's own class,
// which is the second half of the same idea: no help-only styling to drift.
function HelpSwatches() {
  return (
    <span className="help-swatches" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <span key={n} className="color-dot active" style={{ background: `var(--hl-${n})` }} />
      ))}
    </span>
  )
}

// HelpImportFlow — the one fact about importing that a picture of a screen cannot
// carry: the queue is a gate, and nothing is in your library until you open it.
//
// currentColor throughout, so it is legible in both themes with no second copy; a
// viewBox with no fixed height, so it scales with the panel rather than fighting it.
//
// ITS FOUR WORDS ARE KEYED SEPARATELY from the sentences they illustrate, because
// they sit in fixed 52-68px boxes: they are labels on a diagram rather than prose,
// and a language needs to be able to abbreviate them without abbreviating the entry.
function HelpImportFlow() {
  const box = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, rx: 4, opacity: 0.5 }
  const label = { fontSize: 'var(--type-mono-9)', fill: 'currentColor', fontFamily: 'var(--font-mono)' }
  return (
    <svg viewBox="0 0 240 46" width="240" role="img"
         aria-label={t('capture.help.import.flow.aria')}>
      <rect x="1" y="12" width="52" height="18" {...box} />
      <text x="27" y="24" {...label} textAnchor="middle">{t('capture.help.import.flow.file.label')}</text>
      <rect x="86" y="12" width="68" height="18" {...box} />
      <text x="120" y="24" {...label} textAnchor="middle">{t('capture.help.import.flow.pending.label')}</text>
      <rect x="187" y="12" width="52" height="18" {...box} />
      <text x="213" y="24" {...label} textAnchor="middle">{t('capture.help.import.flow.library.label')}</text>
      {/* Two arrows, and the second is the whole point: it is the one you press. */}
      <path d="M55 21 H84" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <path d="M78 18 l6 3 -6 3" fill="currentColor" opacity="0.5" />
      <path d="M156 21 H185" stroke="currentColor" strokeWidth="1.4" />
      <path d="M179 18 l6 3 -6 3" fill="currentColor" />
      <text x="170" y="10" {...label} textAnchor="middle" opacity="0.85">{t('capture.help.import.flow.approve.label')}</text>
    </svg>
  )
}

// ---- the registry's two shapes ---------------------------------------------

// def defines one lazily-read property. See entry() for why they are all lazy.
const def = (obj, name, get) => Object.defineProperty(obj, name, { get, enumerable: true })

// entry — one row of a help panel: `base` names the control it documents and the
// options say which of the four text fields that control's row has.
//
// THE WORDS ARE READ WHEN THEY ARE DRAWN, NOT WHEN THIS FILE LOADS, which is the
// only reason these are getters rather than four calls to t(). This registry is
// built at import — before applyLocale() has run, and long before a reader can
// change the language in Settings — so a resolved string here would be frozen in
// whatever language the module happened to load in, and help would be the one
// screen in the app that never translated.
//
// `how` is an ORDERED list, so its lines are numbered keys (.how.1, .how.2) and
// the option is how many there are: the numbering is the reading order, and a
// language that needs a different order still has three lines in one place.
// `key` AND `roles` ARE THE ROW'S OWN NAME, carried rather than inferred. The panel
// never reads either; test/pure/help-budget.test.js does, and it is what lets the
// copy budgets be measured against internal/i18n/en.txt instead of against the
// English that used to sit here. A test that had to re-derive which of the four
// fields each row has would be a second copy of this registry.
function entry(base, opts = {}) {
  const { icon, asset, more = false, how = 0 } = opts
  const row = { key: base, roles: ['term', 'what', ...Array.from({ length: how }, (_, i) => `how.${i + 1}`), ...(more ? ['more'] : [])] }
  if (icon) row.icon = icon
  if (asset) row.asset = asset
  def(row, 'term', () => t(`${base}.term`))
  def(row, 'what', () => t(`${base}.what`))
  if (how) def(row, 'how', () => Array.from({ length: how }, (_, i) => t(`${base}.how.${i + 1}`)))
  if (more) def(row, 'more', () => t(`${base}.more`))
  return row
}

// section — one screen's list, and its heading.
//
// THE HEADING IS USUALLY AN ALIAS. Nine of these sixteen screens are named by a
// tab, and a screen has one name: the section points at nav.tab.<screen>.label
// rather than holding a second copy of the word, which is the same invariant
// routes.js keeps one layer up. The seven that pass a key of their own are the ones
// whose heading is not any tab's word — "Tags & stickers" against the tab's "Tags",
// the two work pages, and the four screens no tab list reaches.
function section(titleKey, entries) {
  const s = { entries, titleKey }
  def(s, 'title', () => t(titleKey))
  return s
}

// Controls the shell puts on every screen — appended to each page's own list so
// the bars are explained wherever you happen to ask.
//
// TWO LISTS, because the two shells are not the same shell. A phone has a ☰
// drawer and a floating bottom bar; a desktop or tablet has neither — it has an
// always-visible tab strip instead. Describing the drawer to someone who cannot
// see one is worse than saying nothing: they go looking for it. So the shared
// controls live in SHELL_COMMON and each form factor adds only what it actually
// has. helpFor() picks by the same breakpoint the components render against.
//
// The top bar is ＋ · Search · ? · your avatar, in that order, on both — and the
// first three read the screen you are on.
const SHELL_COMMON = [
  entry('common.help.topbar.add', { icon: <IconPlus />, more: true }),
  entry('common.help.topbar.search', { icon: <IconSearch /> }),
  entry('common.help.topbar.help', { icon: <IconHelp />, more: true }),
  entry('common.help.topbar.avatar'),
  entry('common.help.selecting', { how: 3, more: true }),
  entry('common.help.favourite', { more: true }),
  entry('common.help.cover-menu', { more: true }),
  entry('common.help.skip-in-quiz', { more: true }),
  entry('common.help.fill-gaps', { more: true }),
  entry('common.help.info-dots', { more: true }),
]

// Phone only: the drawer, the floating bottom bar, and the long-press label.
const SHELL_TOUCH = [
  entry('common.help.installed-app', { more: true }),
  entry('common.help.topbar.menu', { icon: <IconMenu />, asset: <Gesture kind="swipe-left" />, more: true }),
  entry('common.help.bottom-bar', { more: true }),
  entry('common.help.long-press', { asset: <Gesture kind="long-press" />, more: true }),
]

// Pointer only: the tab strip that stands in for the drawer, hover labels, and
// the keyboard.
//
// THE KEYBOARD ENTRY LIVES HERE, not on the Search screen where it started. It
// describes the whole shell rather than one screen, so on a desktop it now answers
// from every "?" instead of only the one nobody opens looking for keys — and on a
// phone it goes, along with every key cap the app used to draw. Telling somebody
// with no keyboard to press ? for the full list is the same fault as describing the
// drawer to somebody who has a tab strip.
const SHELL_POINTER = [
  entry('common.help.keyboard', { more: true }),
  entry('common.help.tab-strip', { more: true }),
  entry('common.help.hover-labels'),
  entry('common.help.card-menu', { more: true }),
]

export const HELP = {
  home: section('nav.tab.home.label', [
    entry('home.help.greeting'),
    entry('home.help.daily-quiz', { more: true }),
    entry('home.help.practice'),
    entry('home.help.practise', { more: true }),
    entry('home.help.grade'),
    entry('home.help.fix-or-tag', { more: true }),
    entry('home.help.language-mark', { more: true }),
    entry('home.help.status-dot'),
    entry('home.help.favourites', { more: true }),
  ]),
  library: section('nav.tab.library.label', [
    entry('library.help.filters', { icon: <IconFilter /> }),
    entry('library.help.translator-editor', { more: true }),
    entry('library.help.wishlist'),
    entry('library.help.fold-wishlist', { more: true }),
    entry('library.help.shelf-state', { icon: <IconReading /> }),
    entry('library.help.sort', { more: true }),
    entry('library.help.group-by'),
    entry('library.help.view', { icon: <IconGrid /> }),
    entry('library.help.export', { icon: <IconExport />, more: true }),
  ]),
  movies: section('nav.tab.movies.label', [
    entry('movies.help.media-types', { more: true }),
    entry('movies.help.filters', { icon: <IconFilter /> }),
    entry('movies.help.actor', { more: true }),
    entry('movies.help.shelf-state', { more: true }),
    entry('movies.help.collection'),
    entry('movies.help.sort', { more: true }),
    entry('movies.help.group-by'),
    entry('movies.help.export', { icon: <IconExport /> }),
  ]),
  'book-detail': section('book.help.title', [
    entry('book.help.details', { icon: <IconDetails />, more: true }),
    entry('book.help.counts', { more: true }),
    entry('book.help.hearts'),
    entry('book.help.state-chip'),
    entry('book.help.add-annotation', { icon: <IconPlus /> }),
    entry('book.help.colour-category', { asset: <HelpSwatches />, more: true }),
    entry('book.help.copy', { icon: <IconCopy />, more: true }),
    entry('book.help.share', { icon: <IconShare />, more: true }),
    entry('book.help.export', { icon: <IconExport /> }),
    entry('book.help.more-menu', { icon: <IconMore /> }),
  ]),
  'movie-detail': section('film.help.title', [
    entry('film.help.studio', { more: true }),
    entry('film.help.publisher', { more: true }),
    entry('film.help.voice-cast', { more: true }),
    entry('film.help.details', { icon: <IconDetails />, more: true }),
    entry('film.help.counts', { more: true }),
    entry('film.help.state-chip', { more: true }),
    entry('film.help.add-dialogue', { icon: <IconPlus />, more: true }),
    entry('film.help.cast'),
    entry('film.help.copy', { icon: <IconCopy />, more: true }),
    entry('film.help.share', { icon: <IconShare />, more: true }),
  ]),
  search: section('nav.tab.search.label', [
    entry('search.help.exact-phrase', { more: true }),
    entry('search.help.box', { icon: <IconSearch /> }),
    entry('search.help.filters', { icon: <IconFilter />, more: true }),
    entry('search.help.colon', { how: 3, more: true }),
    entry('search.help.escaped-colon', { more: true }),
    entry('search.help.two-chips', { more: true }),
    entry('search.help.colour-names', { more: true }),
    entry('search.help.arriving-narrowed', { more: true }),
    entry('search.help.global-scope', { more: true }),
    entry('search.help.scope-chips', { more: true }),
    entry('search.help.sections'),
    entry('search.help.characters', { how: 1, more: true }),
    entry('search.help.dates', { more: true }),
    entry('search.help.select'),
  ]),
  quotes: section('nav.tab.quotes.label', [
    entry('quotes.help.what-lives-here'),
    entry('quotes.help.boards', { more: true }),
    entry('quotes.help.starters', { more: true }),
    entry('quotes.help.board-kind', { more: true }),
    entry('quotes.help.languages', { more: true }),
    entry('quotes.help.all-quotes', { more: true }),
    entry('quotes.help.hide-board', { more: true }),
    entry('quotes.help.delete-board', { more: true }),
    entry('quotes.help.occasion'),
    entry('quotes.help.speaker', { more: true }),
    entry('quotes.help.when'),
    entry('quotes.help.no-attribution'),
    entry('quotes.help.speaker-credit', { more: true }),
    entry('quotes.help.copy', { icon: <IconCopy />, more: true }),
    entry('quotes.help.share', { icon: <IconShare />, more: true }),
    entry('quotes.help.filters', { icon: <IconFilter />, more: true }),
    entry('quotes.help.group-by', { more: true }),
    entry('quotes.help.export', { icon: <IconExport /> }),
  ]),
  anthologies: section('nav.tab.anthologies.label', [
    entry('anthologies.help.what-lives-here', { more: true }),
    entry('anthologies.help.not-a-board'),
    entry('anthologies.help.new', { icon: <IconPlus />, more: true }),
    entry('anthologies.help.adding', { more: true }),
    entry('anthologies.help.entry-note', { more: true }),
    entry('anthologies.help.reorder', { more: true }),
    entry('anthologies.help.remove', { icon: <IconDelete /> }),
    entry('anthologies.help.delete', { icon: <IconDelete />, more: true }),
    entry('anthologies.help.export', { icon: <IconExport />, more: true }),
    entry('anthologies.help.feature-switch', { more: true }),
  ]),
  tags: section('tags.help.title', [
    entry('tags.help.tags'),
    entry('tags.help.style'),
    entry('tags.help.stickers', { icon: <IconUpload />, more: true }),
  ]),
  metadata: section('nav.tab.metadata.label', [
    entry('metadata.help.coverage'),
    entry('metadata.help.fetch', { icon: <IconMetadata /> }),
    entry('metadata.help.reverify'),
    entry('metadata.help.duplicates'),
    entry('metadata.help.speakers'),
    entry('metadata.help.people'),
    entry('metadata.help.bulk-edit', { icon: <IconEdit /> }),
  ]),
  stats: section('nav.tab.stats.label', [
    entry('stats.help.calendar', { icon: <IconCalendar />, more: true }),
    entry('stats.help.memory'),
    entry('stats.help.breakdowns', { more: true }),
    entry('stats.help.timeline', { more: true }),
    entry('stats.help.superlatives'),
    entry('stats.help.counts', { more: true }),
  ]),
  staging: section('staging.help.title', [
    entry('staging.help.why'),
    entry('staging.help.bulk-fix', { icon: <IconEdit /> }),
    entry('staging.help.approve'),
  ]),
  bin: section('bin.help.title', [
    entry('bin.help.what-is-here', { more: true }),
    entry('bin.help.getting-here', { more: true }),
    entry('bin.help.row', { more: true }),
    entry('bin.help.restore', { icon: <IconRevert />, more: true }),
    entry('bin.help.purge', { icon: <IconDelete /> }),
    entry('bin.help.kinds', { more: true }),
    entry('bin.help.keep-for', { more: true }),
    entry('bin.help.empty-now', { icon: <IconDelete /> }),
  ]),
  // Stray marks sits next to the bin in this table the way it does in Settings:
  // both are pages you are sent to rather than pages you browse.
  cleanup: section('cleanup.help.title', [
    entry('cleanup.help.what-is-here', { more: true }),
    entry('cleanup.help.no-fix', { more: true }),
    entry('cleanup.help.getting-here', { more: true }),
    entry('cleanup.help.row', { more: true }),
    entry('cleanup.help.filter', { icon: <IconFilter />, more: true }),
    entry('cleanup.help.names', { more: true }),
    entry('cleanup.help.cap', { more: true }),
  ]),
  // CHECKS. Its two sections are documented on their own screens too, because
  // both still have their own URLs — so this entry answers what the SCREEN is
  // for and leaves what each list means to the pages that own them.
  checks: section('checks.title', [
    entry('checks.help.what-is-here', { more: true }),
    entry('checks.help.imports', { more: true }),
    entry('checks.help.marks', { more: true }),
    entry('checks.help.not-review', { more: true }),
  ]),
  settings: section('nav.tab.settings.label', [
    entry('settings.help.colour-categories', { asset: <HelpSwatches />, more: true }),
    entry('settings.help.appearance', { more: true }),
    entry('settings.help.button-labels', { more: true }),
    entry('settings.help.features', { more: true }),
    entry('settings.help.onboarding', { more: true }),
    entry('settings.help.users', { more: true }),
    entry('settings.help.metadata-sources', { more: true }),
    entry('settings.help.igdb', { more: true }),
    entry('settings.help.type', { icon: <IconType />, more: true }),
    entry('settings.help.language-marks', { icon: <IconLanguages />, more: true }),
    entry('settings.help.upload-font', { more: true }),
    entry('settings.help.review', { more: true }),
    entry('settings.help.in-depth', { more: true }),
    entry('settings.help.credit-separators', { more: true }),
    entry('settings.help.devices'),
    entry('settings.help.bin', { more: true }),
    entry('settings.help.cleanup', { more: true }),
    entry('settings.help.backup', { more: true }),
    entry('settings.help.backup-now', { icon: <IconArchive />, more: true }),
    entry('settings.help.backup-download', { icon: <IconExport />, more: true }),
    entry('settings.help.changelog', { more: true }),
    entry('settings.help.updates'),
  ]),
  profile: section('profile.help.title', [
    entry('profile.help.photo', { icon: <IconUpload /> }),
    entry('profile.help.display-name'),
    entry('profile.help.switch-account', { more: true }),
    entry('profile.help.log-out'),
    entry('profile.help.password', { more: true }),
    entry('profile.help.users', { icon: <IconPlus />, more: true }),
    entry('profile.help.maintenance'),
  ]),
  capture: section('capture.help.title', [
    entry('capture.help.no-work'),
    entry('capture.help.book'),
    entry('capture.help.film', { more: true }),
    entry('capture.help.quote', { icon: <IconQuote />, more: true }),
    entry('capture.help.save', { more: true }),
    entry('capture.help.import', { icon: <IconUpload />, asset: <HelpImportFlow />, more: true }),
  ]),
}

// helpFor returns { title, entries } for a screen key, with the shell controls
// appended so the bars are always explained — the phone's set or the pointer's,
// never both (see SHELL_TOUCH / SHELL_POINTER). Unknown keys yield null, and
// HelpButton renders nothing for an empty list.
//
// Still here, and still per-screen, because two callers want exactly one screen's
// list: the work-detail ⋯ row, and every test that asks what a screen documents.
// The shell's own "?" opens helpGuide instead.
export function helpFor(key, touch = false) {
  const h = HELP[key]
  if (!h) return null
  return { title: h.title, entries: [...h.entries, ...SHELL_COMMON, ...(touch ? SHELL_TOUCH : SHELL_POINTER)] }
}

// GUIDE_ORDER — the rail, in the order somebody meets the app rather than the order
// HELP happens to be written in.
//
// FIXED, NOT DERIVED from Object.keys(HELP): a rail whose order comes from object
// insertion is a rail that reorders itself the day somebody adds a screen in the
// middle of the file, and the reader's memory of "Sharing is near the bottom" is
// worth more than the convenience. A screen missing from this list is a screen
// missing from the rail, which the test catches.
const GUIDE_ORDER = [
  'home',
  'library',
  // Each work's own page sits directly under the board it opens from, which is how
  // it is reached. Missing from the first cut of this list, and the rail test caught
  // both — the exact failure the fixed order was chosen to make visible.
  'book-detail',
  'movies',
  'movie-detail',
  'quotes',
  // Directly under Quotes, because that is where an anthology is composed from:
  // the door in is the selection bar on the screens that hold the lines.
  'anthologies',
  'search',
  'capture',
  // Checks sits above the two sections it is made of. Both keep their own rails
  // entries because both keep their own URLs — this one answers what the SCREEN
  // is, and each of those answers what its list means.
  'checks',
  'staging',
  'tags',
  'metadata',
  'stats',
  'bin',
  'cleanup',
  'settings',
  'profile',
]

// helpGuide is the whole panel: one section per screen, then the shell's own.
//
// EVERY SECTION, NOT JUST YOURS. That is the change — the panel used to be the
// current screen's list and nothing else, so finding out how sharing worked meant
// guessing which screen owned it and pressing "?" there. Now the rail names all of
// them and `active` is where the panel opens, so it is still contextual without
// being a dead end.
//
// The shell goes LAST, under "Everywhere". It is the longest section and the least
// screen-specific, and putting it first is what made every panel open on four
// paragraphs about the selection bar.
export function helpGuide(touch = false) {
  // `titleKey` rides along beside the resolved title for the same reason a row
  // carries its key: the heading is a fact about which screen this is, and a test
  // that asserted it against the English word could not tell a copy edit from a
  // routing bug. Resolved here rather than held lazily because a section object
  // lives for one render.
  const sections = GUIDE_ORDER.filter((k) => HELP[k]).map((k) => ({
    id: k,
    title: HELP[k].title,
    titleKey: HELP[k].titleKey,
    entries: HELP[k].entries,
  }))
  sections.push({
    id: 'everywhere',
    title: t('common.help.title'),
    titleKey: 'common.help.title',
    entries: [...SHELL_COMMON, ...(touch ? SHELL_TOUCH : SHELL_POINTER)],
  })
  return sections
}

// PageHelp — the "?" the shell's top bar carries. `variant` is passed through to
// HelpButton: "pill" makes it match the Search button it sits beside in the
// desktop bar.
export function PageHelp({ screen, side = 'bottom', variant = 'ring' }) {
  const mobile = useIsMobileScreen()
  const h = helpFor(screen, mobile)
  if (!h) return null
  // The whole guide, opened at this screen. The title still names the screen,
  // because that is what the button promised before it opened.
  return (
    <HelpButton
      title={h.title}
      sections={helpGuide(mobile)}
      active={HELP[screen] ? screen : 'everywhere'}
      side={side}
      variant={variant}
    />
  )
}

// ScreenHelpSheet — the same panel, opened by something other than the "?".
// The book and film detail screens use it: their phone top bar already carries a
// back arrow, a filter, a ＋ and a ⋯ , and a fifth 44px control would leave the
// title about eighty pixels to live in. Help becomes a ⋯ row there instead, which
// costs the bar nothing.
export function ScreenHelpSheet({ screen, open, onClose }) {
  const mobile = useIsMobileScreen()
  const h = helpFor(screen, mobile)
  if (!h || !open) return null
  return (
    <HelpSheet open title={h.title} onClose={onClose}>
      <HelpList entries={h.entries} />
    </HelpSheet>
  )
}
