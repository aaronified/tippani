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
  IconCopy,
  IconDetails,
  IconEdit,
  IconExport,
  IconFilter,
  IconGrid,
  IconHelp,
  IconMenu,
  IconMetadata,
  IconMore,
  IconPlus,
  IconQuote,
  IconReading,
  IconSearch,
  IconShare,
  IconUpload,
  useIsMobileScreen,
} from './ui.jsx'

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
  { term: 'Add (＋)', icon: <IconPlus />, what: 'The single way in, and it knows where you are: a book on Library, a film or show on the Catalogue, and a quote against the work whose page you have open. Look-up, capture and bulk import are all tabs of the one surface. A badge on it counts imports waiting for review.' },
  { term: 'Search', icon: <IconSearch />, what: 'Typo-tolerant search across titles, people, quotes, notes, tags and genres. Started from Library or the Catalogue it lands scoped to that side.' },
  { term: 'Help (?)', icon: <IconHelp />, what: 'This list — the controls on whichever screen you are looking at, with the shell’s own appended. It sits in the top bar rather than in each page’s header, so it is in the same place on every screen.' },
  { term: 'Avatar chip', what: 'Opens your profile directly: photo, display name, password, switching accounts, logging out — and, for an admin, the user list and the recovery tools.' },
  { term: 'Info dots', what: 'The small circled “i” beside a control carries the explanation that used to sit under it as a paragraph. Hover one on a desktop and it opens on its own; click it and it stays open until you click it again. On a phone, tap.' },
]

// Phone only: the drawer, the floating bottom bar, and the long-press label.
const SHELL_TOUCH = [
  { term: 'Menu (☰)', icon: <IconMenu />, what: 'The drawer: every screen, your profile, and the pending-import queue. Its Add and Search are the deliberately context-free pair — they open with nothing pre-filled, whatever page you came from. Swipe it left or tap outside to close.' },
  { term: 'Bottom bar', what: 'Four thumb-reachable screens — Search, Home, Library, Catalogue. It slides away as you scroll down and comes back as you scroll up.' },
  { term: 'Long press', what: 'There is no hover on a phone, so holding any control for half a second shows its label beside it. The hold swallows the tap, so holding Delete to find out what it does never deletes anything.' },
]

// Pointer only: the tab strip that stands in for the drawer, and hover labels.
const SHELL_POINTER = [
  { term: 'Tab strip', what: 'Every screen, always visible in the top bar: Home, Library, Catalogue, then the tools — Tags, Metadata, Stats, Settings. It collapses to icons when the window is too narrow for the labels, and each one names itself on hover.' },
  { term: 'Hover labels', what: 'Every glyph-only control says what it is when you hover or tab to it, in a small bubble anchored to the control itself.' },
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
      { term: 'Favourites', what: 'The lines you marked with ♥ — book highlights, film dialogue and standalone quotes together, reshuffled on every visit. It is a re-surfacing wall rather than a feed, which is why the order changes.' },
    ],
  },
  library: {
    title: 'Library',
    entries: [
      { term: 'Filters', icon: <IconFilter />, what: 'Genre, wishlist scope, favourites, tagged, has-notes, shelf state, series and sort. On a phone they open as a full-screen sheet with a live result count.' },
      { term: 'Wishlist / annotated', what: 'A book with nothing quoted yet counts as wishlist. Show everything, only those, or hide them to see just what you have actually quoted.' },
      { term: 'Shelf state', icon: <IconReading />, what: 'Reading, paused, abandoned, completed — the coloured bar under each cover. Set it from the state chip on a book’s page.' },
      { term: 'Sort', what: 'Recent, Title, Author, Series, or Last read — the date you last had it in your hands, whether you finished it, are still in it, or gave up on it. Books you have never logged a read for sit at the end, in alphabetical order, because most of a library that exists to hold quotes has never been logged.' },
      { term: 'Group by', what: 'Break the grid into sections by series, author, decade or genre.' },
      { term: 'View', icon: <IconGrid />, what: 'Packed masonry, a plain list, or a sortable table.' },
      { term: 'Export', icon: <IconExport />, what: 'What is in view, as Obsidian-friendly Markdown that imports back cleanly. Filter first and you export that shelf; filter nothing and you export the library. It asks before it writes, and the count it quotes is the count you will get.' },
    ],
  },
  movies: {
    title: 'Catalogue',
    entries: [
      { term: 'Films / shows', what: 'Both live here. The media-type chips narrow to one or the other; a show’s dialogue carries season and episode.' },
      { term: 'Filters', icon: <IconFilter />, what: 'Genre, wishlist scope, favourites, tagged, has-notes, shelf state, collection and sort — as a full-screen sheet on a phone.' },
      { term: 'Shelf state', what: 'Watching, paused, abandoned, watched — the coloured bar under each poster.' },
      { term: 'Collection', what: 'A franchise or series grouping, the film side of the Library’s "series".' },
      { term: 'Sort', what: 'Recent, Title, Year, Collection, or Last watched — the date you last had it on, finished or not. Anything you have never logged a watch for sits at the end, alphabetically.' },
      { term: 'Group by', what: 'Break the grid into sections by collection, director, decade or genre.' },
      { term: 'Export', icon: <IconExport />, what: 'The titles in view and their dialogue as Markdown. It asks first and names the count.' },
    ],
  },
  'book-detail': {
    title: 'Book',
    entries: [
      { term: 'Details', icon: <IconDetails />, what: 'Every stored field — title, author, year, series, ISBN, ASIN, genres, description, cover. Read it there, edit any one field with its pencil, or fetch fresh metadata and choose field by field what to take.' },
      { term: 'Hearts', what: 'Mark the book a favourite. It is stored per user.' },
      { term: 'State chip', what: 'The shelf: start reading, pause, abandon, finish — and, while reading, your page or percentage. A finished book keeps a ×N re-read count.' },
      { term: 'Add annotation', icon: <IconPlus />, what: 'Capture a highlight: the quote, an optional note, chapter and location, a colour and tags.' },
      { term: 'Colour category', what: 'The left bar on each quote card, and the top of the hierarchy: tags say what a quote is about, its colour says what KIND of note it is. Six of them, named in Settings — a fact, a line you disagreed with, something to come back to — and every picker, filter and breakdown in the app uses your words. The first one is the odd one out: it is what a quote gets when nobody picks, and what an import writes when the source named no colour, so it cannot be named without labelling every unmarked quote you own.' },
      { term: 'Copy', icon: <IconCopy />, what: 'The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end. The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.' },
      { term: 'Share', icon: <IconShare />, what: 'A picture of the line, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit. The image is drawn locally in whichever of the four skins you pick and never leaves the machine. The image can carry a portrait backdrop — the author’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. It rides the same Author tick as the credit itself, so turning that off takes the backdrop with it. The small portrait disc steps aside when the backdrop is on: the portrait is already the face. A separate switch decides whether the quote’s colour appears in the picture at all — as the stripe beside the words on a plain card, or as the hue of the portrait on a backdrop card, never both. It starts off: a colour category is a note to yourself about what kind of thought a quote is, and whoever you send the picture to has no idea the scheme exists. Words over a backdrop carry a halo of the card’s own colour, so a line cannot disappear into a dark shoulder. Every picture signs itself in the bottom-left corner — the mark, then “made with tippani” — because an image is the one thing here that leaves, and by the third re-post nothing travels with it except what was painted in. What each format produces — its syntax, its sample tokens — lives behind the info dot beside the format picker.' },
      { term: 'Export .md', icon: <IconExport />, what: 'This book and all its quotes as Markdown.' },
      { term: 'More (⋯)', icon: <IconMore />, what: 'Where the shelf action, export, details and delete live on a phone.' },
    ],
  },
  'movie-detail': {
    title: 'Film or show',
    entries: [
      { term: 'Details', icon: <IconDetails />, what: 'Every stored field — title, director or creator, year, collection, TMDB and TheTVDB ids, genres, description, poster. Edit one field at a time, or re-sync from the source and choose what to take. The two ids can be typed as well as fetched, and once set every later search fetches that exact record first.' },
      { term: 'State chip', what: 'The shelf: start watching, pause, abandon, finish — with a ×N re-watch count.' },
      { term: 'Add dialogue', icon: <IconPlus />, what: 'A line with its timestamp, the character, and the actor auto-filled from the cast. Shows also take season and episode.' },
      { term: 'Cast', what: 'Pulled from the source when you fetch metadata; it is what fills the actor on a new line.' },
      { term: 'Copy', icon: <IconCopy />, what: 'The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end. The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.' },
      { term: 'Share', icon: <IconShare />, what: 'A picture of the line, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit. The image can carry a portrait backdrop — the actor’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. Two credited actors take a side each, with the line between them, which is the shape a scene has. The small portrait disc steps aside when the backdrop is on: the portrait is already the face. A separate switch decides whether the quote’s colour appears in the picture at all — as the stripe beside the words on a plain card, or as the hue of the portrait on a backdrop card, never both. It starts off: a colour category is a note to yourself about what kind of thought a quote is, and whoever you send the picture to has no idea the scheme exists. Words over a backdrop carry a halo of the card’s own colour, so a line cannot disappear into a dark shoulder. Every picture signs itself in the bottom-left corner — the mark, then “made with tippani” — because an image is the one thing here that leaves, and by the third re-post nothing travels with it except what was painted in. What each format produces — its syntax, its sample tokens — lives behind the info dot beside the format picker.' },
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
  quotes: {
    title: 'Quotes',
    entries: [
      { term: 'What lives here', what: 'Lines that belong to no book and no film: a speech, a letter, an interview, a song, a proverb, something a friend said.' },
      { term: 'Occasion', what: 'Where the words were said. It is the locator, and unlike a page number it tells two quotes apart — the same line on two occasions is two quotes, not one.' },
      { term: 'Speaker', what: 'Who said it. It stands where a book’s author stands, it is what the review deck asks you to recall, and it takes a portrait and a bio like any other person. Two names separated by one of your credit separators are two speakers, here as everywhere else.' },
      { term: 'When', what: 'A partial date: a year on its own is a complete answer, so nothing is padded to a day nobody recorded.' },
      { term: 'A quote with no attribution', what: 'Perfectly fine to save, and it stays out of the review deck — there is nothing to recall but the words already in front of you.' },
      { term: 'Speaker credit', what: 'The name under a line is a doorway, the way an author is on a book: their portrait sits beside it, and tapping it opens who they were. A line credited to two people shows both faces and two doorways.' },
      { term: 'Copy', icon: <IconCopy />, what: 'The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end. The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.' },
      { term: 'Share', icon: <IconShare />, what: 'A picture of the quote, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit. The image can carry a portrait backdrop — the speaker’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. Two speakers take a side each with the words between them, which is the shape a conversation has. The small portrait disc steps aside when the backdrop is on: the portrait is already the face. A separate switch decides whether the quote’s colour appears in the picture at all — as the stripe beside the words on a plain card, or as the hue of the portrait on a backdrop card, never both. It starts off: a colour category is a note to yourself about what kind of thought a quote is, and whoever you send the picture to has no idea the scheme exists. Words over a backdrop carry a halo of the card’s own colour, so a line cannot disappear into a dark shoulder. Every picture signs itself in the bottom-left corner — the mark, then “made with tippani” — because an image is the one thing here that leaves, and by the third re-post nothing travels with it except what was painted in. What each format produces — its syntax, its sample tokens — lives behind the info dot beside the format picker.' },
      { term: 'Filters', icon: <IconFilter />, what: 'Colour, favourites, tagged, has-notes, and then a tag, a speaker or a medium — the last two built from what you have actually saved, not from a fixed vocabulary. On a phone they open as a full-screen sheet with a live result count.' },
      { term: 'Group by', what: 'Break the grid into sections by speaker, medium, place or decade. A line missing that field lands in a bucket that says which field it is missing, because a quote with no speaker, no medium and no date is a perfectly ordinary proverb.' },
      { term: 'Export', icon: <IconExport />, what: 'The quotes in view as Markdown, which imports back cleanly. It asks first and names the count.' },
    ],
  },
  tags: {
    title: 'Tags & stickers',
    entries: [
      { term: 'Tags', what: 'Cut across books and films alike. Rename one here and every quote follows.' },
      { term: 'Tag style', what: 'Sticker, banner, flyout, tape or reel — how the tag draws on a quote card.' },
      { term: 'Stickers', icon: <IconUpload />, what: 'A heart, a star and three faces to start with, plus any transparent PNG or SVG you upload. Pin one to a quote as a seal the text flows around, and drag it where you like. The five that came with the app are ordinary stickers — rename them, or delete the ones you will never use and they stay gone.' },
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
      { term: 'Calendar', icon: <IconCalendar />, what: 'A dot per day you captured something. Tapping a day opens exactly those captures in Search. Switch it to Quiz or Practice and it counts answers instead — those days report how many you got right as well as how many you answered, because a dot shaded by volume alone reads a day you got everything wrong exactly like a day you got everything right. Resetting your practice score empties that stream outright, so nothing stale is left behind to hover over.' },
      { term: 'Memory', what: 'Health straight from the quiz: how many quotes are remembered, slipping, or probably gone, and your streak.' },
      { term: 'Breakdowns', what: 'The authors, speakers, actors, directors and tags your library leans on — plus People, which is all of them at once, one row per person however you credited them. Everything is a doorway — tap through to the works.' },
      { term: 'Timeline', what: 'When your works are from, not when you saved them. Readable by decade, century or year, because a library holding something from 380 BCE and something from last year needs different bucket sizes to make sense. Empty stretches are drawn, so a long gap looks like one. Each period gets two columns of dots from the same floor — the quotes you kept, and the works they came from — never added together, because a work and a quote are not two of the same thing. A standalone quote raises the quote column and not the work one: it came from no book and no film. When a library grows past one dot each, the key says what one dot is worth.' },
      { term: 'Superlatives', what: 'The most annotated book, the most quoted film, the person you quote and heart most, the busiest month and the decade you return to — plus who you remember best and who keeps slipping away.' },
      { term: 'Counts', what: 'All three kinds of quote, counted separately: annotations are the lines you kept from books, dialogues the ones from films and shows, and quotes the standalone ones that came from no work at all. The header total is the three added up.' },
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
      { term: 'Colour categories', what: 'What the six highlight colours are called and what they look like — they arrive as Fact, Disagreed, Inspirational, Funny and Meta, and all of them are yours to rename. Renaming one changes nothing but the words on your screen — the stored value stays yellow, blue, pink or orange, so exports and imports round-trip exactly as before. Hiding one takes it out of the pickers without touching a single quote already wearing it, and the palette deliberately shares no colour with the app’s own accents.' },
      { term: 'Appearance', what: 'Paper or film, light or dark or match-the-OS, four accents, and your own cover sizes. Every user keeps their own. If your system asks for more contrast or less transparency, Tippani drops every texture — the page grain, the backdrop, the card and shell tiles — and leaves the borders, colours and layout exactly where they were.' },
      { term: 'Button labels', what: 'Whether a button that has a glyph also shows its words. Auto shows them on a desktop and hides them on a phone, where the row stops fitting. Hiding them never hides them from a screen reader, and every glyph still names itself on hover or long-press. Like the two size sliders it sits beside, it belongs to this screen rather than to your account — how much room a row has is a property of the monitor, not the reader.' },
      { term: 'Onboarding', what: 'The guided tour of every feature. Start, replay or resume it here.' },
      { term: 'Users', what: 'Everyone on this instance, admin only. Add an account, remove one, or hand over admin — which is deliberately asymmetric: you can make any member an admin, and you can step down, and that is all. Nobody can take another admin’s rights away, and nobody can delete another admin’s account either, because that would be the same thing with their whole library attached. The last remaining admin cannot step down, so the instance always has one.' },
      { term: 'Metadata sources', what: 'The API keys lookups run on. Each field edits and saves on its own, and a floppy-with-a-tick beside a field means that key is stored — secrets are write-only, so nothing can ever show you one back. Press edit and a box appears below the row; save it blank to clear the key. Which services those keys are for, and what the status chips above them mean, is in the info dot on the card’s heading — one dot for the card, rather than one beside each chip. Multi-author credits sit at the bottom of the same card, because a lookup hands back one credit string and that setting decides whether it names one person or two.' },
      { term: 'Review', what: 'The knobs on the daily quiz: how many cards, which of the three kinds of quote it draws from, whether Practice moves the schedule, and how much a look lengthens a half-life. The three media are independent — books and standalone quotes without film dialogue is a valid answer. A quote with no speaker and no occasion stays out whatever you pick, and so does anything saved in the last week.' },
      { term: 'Multi-author credits', what: 'Which separators split "Gaiman & Pratchett" into two people, at the bottom of the Metadata sources card. The author line on each book is never rewritten, so this is safe to change at any time.' },
      { term: 'Devices', what: 'Pair the Android app with this account, and unpair it again.' },
      { term: 'Backup & restore', what: 'Admin only: one dated, encrypted archive of everything — restored in place, or from a file taken off another Tippani. On the server that made it, your current password opens it whichever password sealed it. Carried elsewhere, it needs the password it was sealed with. A passphrase archive is tied to no login and recoverable by nothing.' },
      { term: 'Updates', what: 'Admin only, checked on demand — never in the background.' },
    ],
  },
  profile: {
    title: 'Profile',
    entries: [
      { term: 'Photo', icon: <IconUpload />, what: 'Your avatar chip. A square image reads best.' },
      { term: 'Display name', what: 'What the greeting and the user list call you.' },
      { term: 'Switch account', what: 'Sign in as another user on this server. It asks for that account’s password every time — being an admin does not let you in without one — and each account has a fully separate library. The form names the account you are leaving, because on a server with several adjacent names “switch” with no subject is a question about something you cannot see.' },
      { term: 'Log out', what: 'Ends this browser session only. Other browsers stay signed in; a paired phone keeps its own token until you unpair it.' },
      { term: 'Password', what: '8–20 characters — letters, digits and punctuation, no accents. That narrow alphabet is deliberate: your password is also the key to your backup archives, so it has to be typeable on another machine months later. Changing it signs out every other browser session but deliberately leaves paired phones alone, and since 1.4.2 it no longer orphans your backups: on this server your current password opens every archive this server made.' },
      { term: 'Users on this server', icon: <IconPlus />, what: 'Admin only, and part of this screen rather than its own: add an account, grant or revoke admin (the last admin cannot be demoted), or delete an account and everything in its library. To hand over, grant another user admin first, then revoke your own.' },
      { term: 'Maintenance', what: 'Admin only: rebuild the search index if search starts failing, or reset the whole instance back to first run.' },
    ],
  },
  capture: {
    title: 'Add & capture',
    entries: [
      { term: 'no book or film', what: 'Saves the line on its own, with who said it and on what occasion instead of a chapter and a page. It lands on the Quotes screen.' },
      { term: 'Book', what: 'Look one up by title, author or ISBN — covers and details come with it. Manual entry always works, key or no key.' },
      { term: 'Film or show', what: 'Looked up on TMDB and TheTVDB by title and year — or by a TMDB/TheTVDB id you type in Details, which names one record exactly where a title cannot. Picking a match pulls the poster, cast and details.' },
      { term: 'Capture quote', icon: <IconQuote />, what: 'A line against any work you already have, without leaving the screen you were on. Opened from a book or film’s own page, that work is already filled in — it is the same surface either way, and the only add form there is.' },
      { term: 'Save (✓)', what: 'In the title bar, not at the foot of the form, so it is reachable on a phone without scrolling past every field. It stays greyed until the must-fill fields are filled, and says which one is missing.' },
      { term: 'Import', icon: <IconUpload />, what: 'Markdown and Readest exports, Kindle Bookcision and your Kindle notebook, Goodreads and Hardcover pages, IMDb quote pages. Everything lands in Pending import first.' },
    ],
  },
}

// helpFor returns { title, entries } for a screen key, with the shell controls
// appended so the bars are always explained — the phone's set or the pointer's,
// never both (see SHELL_TOUCH / SHELL_POINTER). Unknown keys yield null, and
// HelpButton renders nothing for an empty list.
export function helpFor(key, touch = false) {
  const h = HELP[key]
  if (!h) return null
  return { title: h.title, entries: [...h.entries, ...SHELL_COMMON, ...(touch ? SHELL_TOUCH : SHELL_POINTER)] }
}

// PageHelp — the "?" the shell's top bar carries. `variant` is passed through to
// HelpButton: "pill" makes it match the Search button it sits beside in the
// desktop bar.
export function PageHelp({ screen, side = 'bottom', variant = 'ring' }) {
  const mobile = useIsMobileScreen()
  const h = helpFor(screen, mobile)
  if (!h) return null
  return <HelpButton title={h.title} entries={h.entries} side={side} variant={variant} />
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
