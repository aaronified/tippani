// help.jsx — the per-screen glossary behind every "?" button (§ declutter).
//
// The screens themselves no longer carry standing explanatory paragraphs: the
// dense bits moved into InfoDots beside the control they describe, and the
// "what is everything on this page" answer lives here, one entry per control.
// Keeping it in one file rather than scattered through the screens is the point
// — it is the same list docs/ui-glossary.html holds by hand, close enough to the
// components that adding a control and forgetting its help is a visible gap.
//
// An entry is { term, what, icon? }. `icon` draws the actual glyph the screen
// uses, so the row is recognisable before the words are read.
import {
  HelpButton,
  HelpList,
  HelpSheet,
  IconCalendar,
  IconDelete,
  IconDetails,
  IconEdit,
  IconExport,
  IconFilter,
  IconGrid,
  IconMenu,
  IconMetadata,
  IconMore,
  IconPlus,
  IconQuote,
  IconReading,
  IconSearch,
  IconShare,
  IconUpload,
} from './ui.jsx'

// Controls the shell puts on every screen — prepended to each page's own list so
// the phone bars are explained wherever you happen to ask.
const SHELL = [
  { term: 'Menu (☰)', icon: <IconMenu />, what: 'The drawer: every screen, your profile, and the pending-import queue. Swipe it left or tap outside to close.' },
  { term: 'Add (＋)', icon: <IconPlus />, what: 'The single way in — add a book, a film or show, capture a quote against any work, or bulk-import highlights. A badge on it counts imports waiting for review.' },
  { term: 'Search', icon: <IconSearch />, what: 'Typo-tolerant search across titles, people, quotes, notes, tags and genres.' },
  { term: 'Bottom bar', what: 'Four thumb-reachable screens — Search, Home, Library, Catalogue. It slides away as you scroll down and comes back as you scroll up.' },
  { term: 'Avatar chip', what: 'Your profile — photo, display name, password — and, for admins, user management.' },
]

export const HELP = {
  home: {
    title: 'Home',
    entries: [
      { term: 'Greeting', what: 'The date, and a greeting picked for your local time of day, the weekend, or a holiday. It changes on every reload.' },
      { term: 'Daily Quiz', what: 'A short multiple-choice round over your own quotes, scheduled on the forgetting curve — each card comes back right as you would start to lose it. Answering moves that quote’s memory half-life.' },
      { term: 'Practice', what: 'The unlimited, skippable twin of the quiz. It keeps its own score and, by default, never touches your review schedule (Settings can change that).' },
      { term: 'Reveal / Got it / Missed', what: 'Reveal shows the answer; then say honestly whether you had it. The honest answer is what makes the schedule work.' },
      { term: 'Status dot', what: 'Every quote wears one: remembered, forgetting, probably forgotten, or not yet reviewed. Hover or tap it for the memory half-life.' },
      { term: 'Favourites', what: 'The most recent lines you marked with ♥, mixing book highlights and film dialogue.' },
    ],
  },
  library: {
    title: 'Library',
    entries: [
      { term: 'Filters', icon: <IconFilter />, what: 'Genre, wishlist scope, favourites, tagged, has-notes, shelf state, series and sort. On a phone they open as a full-screen sheet with a live result count.' },
      { term: 'Wishlist / annotated', what: 'A book with nothing quoted yet counts as wishlist. Show everything, only those, or hide them to see just what you have actually quoted.' },
      { term: 'Shelf state', icon: <IconReading />, what: 'Reading, paused, abandoned, completed — the coloured bar under each cover. Set it from the state chip on a book’s page.' },
      { term: 'Group by', what: 'Break the grid into sections by series, author, decade or genre.' },
      { term: 'View', icon: <IconGrid />, what: 'Packed masonry, a plain list, or a sortable table.' },
      { term: 'Export all', icon: <IconExport />, what: 'The whole library as Obsidian-friendly Markdown, which imports back cleanly.' },
    ],
  },
  movies: {
    title: 'Catalogue',
    entries: [
      { term: 'Films / shows', what: 'Both live here. The media-type chips narrow to one or the other; a show’s dialogue carries season and episode.' },
      { term: 'Filters', icon: <IconFilter />, what: 'Genre, wishlist scope, favourites, tagged, has-notes, shelf state, collection and sort — as a full-screen sheet on a phone.' },
      { term: 'Shelf state', what: 'Watching, paused, abandoned, watched — the coloured bar under each poster.' },
      { term: 'Collection', what: 'A franchise or series grouping, the film side of the Library’s "series".' },
      { term: 'Export all', icon: <IconExport />, what: 'Every title and its dialogue as Markdown.' },
    ],
  },
  'book-detail': {
    title: 'Book',
    entries: [
      { term: 'Details', icon: <IconDetails />, what: 'Every stored field — title, author, year, series, ISBN, ASIN, genres, description, cover. Read it there, edit any one field with its pencil, or fetch fresh metadata and choose field by field what to take.' },
      { term: 'Hearts', what: 'Mark the book a favourite. It is stored per user.' },
      { term: 'State chip', what: 'The shelf: start reading, pause, abandon, finish — and, while reading, your page or percentage. A finished book keeps a ×N re-read count.' },
      { term: 'Add annotation', icon: <IconPlus />, what: 'Capture a highlight: the quote, an optional note, chapter and location, a colour and tags.' },
      { term: 'Highlight colour', what: 'Yellow, blue, pink or orange — the left bar on each quote card. Filter by it.' },
      { term: 'Share', icon: <IconShare />, what: 'A line as Markdown, WhatsApp, plain text, Reddit, or an image card rendered locally in your current skin.' },
      { term: 'Export .md', icon: <IconExport />, what: 'This book and all its quotes as Markdown.' },
      { term: 'More (⋯)', icon: <IconMore />, what: 'Where the shelf action, export, details and delete live on a phone.' },
    ],
  },
  'movie-detail': {
    title: 'Film or show',
    entries: [
      { term: 'Details', icon: <IconDetails />, what: 'Every stored field — title, director or creator, year, collection, TMDB and TheTVDB ids, genres, description, poster. Edit one field at a time, or re-sync from the source and choose what to take.' },
      { term: 'State chip', what: 'The shelf: start watching, pause, abandon, finish — with a ×N re-watch count.' },
      { term: 'Add dialogue', icon: <IconPlus />, what: 'A line with its timestamp, the character, and the actor auto-filled from the cast. Shows also take season and episode.' },
      { term: 'Cast', what: 'Pulled from the source when you fetch metadata; it is what fills the actor on a new line.' },
      { term: 'Share', icon: <IconShare />, what: 'The line as Markdown, WhatsApp, plain text, Reddit, or an image card.' },
    ],
  },
  search: {
    title: 'Search',
    entries: [
      { term: 'The box', icon: <IconSearch />, what: 'Typo-tolerant and instant. Your last search is remembered.' },
      { term: 'Sections', what: 'Results arrive grouped by what matched: books, films, people, annotations, dialogues, notes, tags, genres.' },
      { term: 'Dates & decades', what: 'A decade ("1990s") or a day ("2026-07-14") is a valid search — it finds what you captured then.' },
      { term: 'Select', what: 'Tick a set of results for a bulk tag or field edit.' },
    ],
  },
  tags: {
    title: 'Tags & stickers',
    entries: [
      { term: 'Tags', what: 'Cut across books and films alike. Rename one here and every quote follows.' },
      { term: 'Tag style', what: 'Sticker, banner, flyout, tape or reel — how the tag draws on a quote card.' },
      { term: 'Stickers', icon: <IconUpload />, what: 'Your own transparent PNG or SVG images. Pin one to a quote as a seal the text flows around, and drag it where you like.' },
    ],
  },
  metadata: {
    title: 'Metadata',
    entries: [
      { term: 'Coverage', what: 'How many books and titles are missing each field. On a desktop the tiles are buttons: tapping one filters the list below to exactly those rows.' },
      { term: 'Fetch covers & metadata', icon: <IconMetadata />, what: 'Fills what is missing across the whole library — covers, posters, author, description, year, genres. It never replaces what you already have.' },
      { term: 'Re-verify', what: 'Re-checks pinned works against the live sources and shows you every proposed change before any of it is applied.' },
      { term: 'Duplicates', what: 'Finds near-identical titles and merges them, moving the quotes onto the survivor.' },
      { term: 'Speakers', what: 'Bulk-remaps a character label across a title’s dialogue, and can refill the actors from the cast.' },
      { term: 'People', what: 'Authors, actors and directors with portraits and reference links, resolved from the sources.' },
      { term: 'Bulk edit', icon: <IconEdit />, what: 'Applies an author, series or set of genres to every selected row at once.' },
    ],
  },
  stats: {
    title: 'Stats',
    entries: [
      { term: 'Calendar', icon: <IconCalendar />, what: 'A dot per day you captured something. Tapping a day opens exactly those captures in Search.' },
      { term: 'Memory', what: 'Health straight from the quiz: how many quotes are remembered, slipping, or probably gone, and your streak.' },
      { term: 'Breakdowns', what: 'The authors, actors, directors and tags your library leans on. Everything is a doorway — tap through to the works.' },
    ],
  },
  staging: {
    title: 'Pending import',
    entries: [
      { term: 'Why this exists', what: 'An import lands here first and stays until you okay it, so a bad parse never reaches your library.' },
      { term: 'Fix in bulk', icon: <IconEdit />, what: 'Correct chapters and locations across many rows at once, or move quotes onto the right book or film.' },
      { term: 'Approve / discard', what: 'Approving files the quotes; discarding drops them. Re-importing the same file never duplicates.' },
    ],
  },
  settings: {
    title: 'Settings',
    entries: [
      { term: 'Appearance', what: 'Paper or film, light or dark or match-the-OS, four accents, and your own cover sizes. Every user keeps their own.' },
      { term: 'Onboarding', what: 'The guided tour of every feature. Start, replay or resume it here.' },
      { term: 'Metadata sources', what: 'The API keys lookups run on. Each field edits and saves on its own; secrets are write-only and show masked once stored.' },
      { term: 'Review', what: 'The knobs on the daily quiz: how many cards, whether covers show, whether Practice moves the schedule, and how much a look lengthens a half-life.' },
      { term: 'Multi-author credits', what: 'Which separators split "Gaiman & Pratchett" into two people. The author line on each book is never rewritten.' },
      { term: 'Devices', what: 'Pair the Android app with this account, and unpair it again.' },
      { term: 'Backup & restore', what: 'Admin only: a dated archive of everything, restored in place or from another Tippani server.' },
      { term: 'Updates', what: 'Admin only, checked on demand — never in the background.' },
    ],
  },
  profile: {
    title: 'Profile',
    entries: [
      { term: 'Photo', icon: <IconUpload />, what: 'Your avatar chip. A square image reads best.' },
      { term: 'Display name', what: 'What the greeting and the user list call you.' },
      { term: 'Password', what: 'Changing it signs out every other browser session — but deliberately leaves paired phones alone.' },
      { term: 'Maintenance', what: 'Admin only: rebuild the search index if search starts failing, or reset the whole instance back to first run.' },
    ],
  },
  users: {
    title: 'User management',
    entries: [
      { term: 'Add user', icon: <IconPlus />, what: 'Every user gets a fully separate library.' },
      { term: 'Make / revoke admin', what: 'Admins manage users, keys, backups and updates. The last admin cannot be demoted.' },
      { term: 'Delete', icon: <IconDelete />, what: 'Removes the account and everything in its library.' },
      { term: 'Handing over', what: 'Grant another user admin first, then revoke your own.' },
    ],
  },
  capture: {
    title: 'Add & capture',
    entries: [
      { term: 'Book', what: 'Look one up by title, author or ISBN — covers and details come with it. Manual entry always works, key or no key.' },
      { term: 'Film or show', what: 'Looked up on TMDB and TheTVDB by title and year; picking a match pulls the poster, cast and details.' },
      { term: 'Capture quote', icon: <IconQuote />, what: 'A line against any work you already have, without leaving the screen you were on.' },
      { term: 'Import', icon: <IconUpload />, what: 'Markdown and Readest exports, Kindle Bookcision and your Kindle notebook, Goodreads and Hardcover pages, IMDb quote pages. Everything lands in Pending import first.' },
    ],
  },
}

// helpFor returns { title, entries } for a screen key, with the shell controls
// appended so the phone bars are always explained. Unknown keys yield null, and
// HelpButton renders nothing for an empty list.
export function helpFor(key) {
  const h = HELP[key]
  if (!h) return null
  return { title: h.title, entries: [...h.entries, ...SHELL] }
}

// PageHelp — the "?" a screen drops into its header. One call site per screen,
// so adding a screen is one entry above and one tag in its header.
export function PageHelp({ screen, side = 'bottom' }) {
  const h = helpFor(screen)
  if (!h) return null
  return <HelpButton title={h.title} entries={h.entries} side={side} />
}

// ScreenHelpSheet — the same panel, opened by something other than the "?".
// The book and film detail screens use it: their phone top bar already carries a
// back arrow, a filter, a ＋ and a ⋯ , and a fifth 44px control would leave the
// title about eighty pixels to live in. Help becomes a ⋯ row there instead, which
// costs the bar nothing.
export function ScreenHelpSheet({ screen, open, onClose }) {
  const h = helpFor(screen)
  if (!h || !open) return null
  return (
    <HelpSheet open title={h.title} onClose={onClose}>
      <HelpList entries={h.entries} />
    </HelpSheet>
  )
}
