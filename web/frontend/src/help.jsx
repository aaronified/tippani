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
function HelpImportFlow() {
  const box = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, rx: 4, opacity: 0.5 }
  const label = { fontSize: 8, fill: 'currentColor', fontFamily: 'var(--font-mono)' }
  return (
    <svg viewBox="0 0 240 46" width="240" role="img"
         aria-label="A file goes to Pending import, and reaches your library only when you approve it">
      <rect x="1" y="12" width="52" height="18" {...box} />
      <text x="27" y="24" {...label} textAnchor="middle">file</text>
      <rect x="86" y="12" width="68" height="18" {...box} />
      <text x="120" y="24" {...label} textAnchor="middle">pending</text>
      <rect x="187" y="12" width="52" height="18" {...box} />
      <text x="213" y="24" {...label} textAnchor="middle">library</text>
      {/* Two arrows, and the second is the whole point: it is the one you press. */}
      <path d="M55 21 H84" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <path d="M78 18 l6 3 -6 3" fill="currentColor" opacity="0.5" />
      <path d="M156 21 H185" stroke="currentColor" strokeWidth="1.4" />
      <path d="M179 18 l6 3 -6 3" fill="currentColor" />
      <text x="170" y="10" {...label} textAnchor="middle" opacity="0.85">approve</text>
    </svg>
  )
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
  { term: 'Add (＋)', icon: <IconPlus />, what: 'The single way in, and it knows where you are: a book on Library, a film or show on the Catalogue, and a quote against the work whose page you have open.', more: 'Look-up, capture and bulk import are all tabs of the one surface. A badge on it counts imports waiting for review. After you save one, the next capture starts where that one left off — the same colour and the same tags, and the same work for the next half-hour, so a sitting of six quotes off one page is not six full re-entries. The words themselves never carry over.' },
  { term: 'Search', icon: <IconSearch />, what: 'Typo-tolerant search across titles, people, quotes, notes, tags and genres. Started from Library or the Catalogue it lands scoped to that side.' },
  { term: 'Help (?)', icon: <IconHelp />, what: 'This list — the controls on whichever screen you are looking at, with the shell’s own appended.', more: 'It sits in the top bar rather than in each page’s header, so it is in the same place on every screen.' },
  { term: 'Avatar chip', what: 'Opens your profile directly: photo, display name, password, switching accounts, logging out — and, for an admin, the user list and the recovery tools.' },
  {
    term: 'Selecting several',
    what: 'Act on several cards at once — quotes, books, films and shows alike.',
    how: [
      'Tick a card’s corner, Ctrl-click it, or Select from its own menu.',
      'Shift-click extends the run. Select all takes what is on screen, never what a filter hid.',
      'A bar appears: three glyphs in the row, the rest behind its ⋯. Hold one to read it.',
    ],
    more:
      'Over QUOTES: colour, ♥ and the quiz toggle in the row; tags, one sticker, another board and delete behind the ⋯. Over BOOKS, FILMS AND SHOWS: fill gaps, move to a shelf, the quiz toggle, delete behind the ⋯. Pick exactly one and Edit appears; pick a second and it goes. The bar holds until you dismiss it, even at zero. Deleting asks you to type what it will do, and lands the lot in the bin as one entry with one Undo.',
  },
  { term: 'Favourite one thing', what: 'Right-click a quote (or long-press it on a phone) and Favourite is in the menu, beside Edit and Delete.', more: 'The ♥ on the card does the same thing, but it only appears when you hover — so on a phone this is the way in, and favouriting is the most common thing anybody does to a quote. The menu item says what pressing it will do, so it reads Unfavourite once the quote already is one.' },
  { term: 'A cover’s own menu', what: 'Right-click a book, film or show on its board — long-press on a phone — and it offers Select, Fill gaps, the quiz toggle, Edit and Delete.', more: 'Everything there is something the selection bar could already do to exactly one thing you had picked, which is the point: the bar and the cover now read the same list. Delete asks first and says how many quotes go with the work, and the toast that follows has an Undo.' },
  { term: 'Skip in quiz', what: 'Some things you keep are not things to be tested on — a shopping list saved as a quote, a reference manual whose highlights are all page numbers.', more: 'Select them and press Skip in quiz and the Daily Quiz stops drawing on them, without deleting anything. Do it to a BOOK and it covers every highlight you add to that book afterwards too. The button says Add to quiz when the selection is already skipped, so you can always read which way round it is.' },
  { term: 'Fill gaps', what: 'Over a selection of books, films or shows: fetches each one’s metadata and writes only the fields that are EMPTY.', more: 'A description you wrote, a year you corrected, a cover you chose — none of them are touched, which is why this needs no preview. Re-verify (Metadata) is the other half: it shows you every difference and waits for you to tick the ones you believe.' },
  { term: 'Info dots', what: 'The small circled “i” beside a control carries the explanation that used to sit under it as a paragraph.', more: 'Hover one on a desktop and it opens on its own; click it and it stays open until you click it again. On a phone, tap.' },
]

// Phone only: the drawer, the floating bottom bar, and the long-press label.
const SHELL_TOUCH = [
  { term: 'Installed app', what: 'Add Tippani to your home screen and three things come with it. Long-press the icon for Capture a quote, Daily quiz or Pending imports.', more: 'Tap a .md, a My Clippings.txt or a Bookcision .json in your file manager and it opens straight into import staging, in the window you already have. And the icon carries a badge of cards due plus imports waiting — set when the app loads rather than by anything running in the background, because nothing here wakes up on its own.' },
  { term: 'Menu (☰)', icon: <IconMenu />, asset: <Gesture kind="swipe-left" />, what: 'The drawer: every screen, your profile, and the pending-import queue.', more: 'Its Add and Search are the deliberately context-free pair — they open with nothing pre-filled, whatever page you came from. Swipe it left or tap outside to close.' },
  { term: 'Bottom bar', what: 'The thumb-reachable screens — Home, Library, Catalogue and Quotes, or whichever of those you have left switched on in Settings → Features.', more: 'Search is not among them; it is in the top bar, within the same thumb’s reach and one row up. It slides away as you scroll down and comes back as you scroll up.' },
  { term: 'Long press', asset: <Gesture kind="long-press" />, what: 'Three different things, decided by what is under your thumb.', more: 'On a CONTROL it shows that control’s label — there is no hover on a phone — and the hold swallows the tap, so holding Delete to find out what it does never deletes anything. On the WORDS OF A QUOTE it does nothing at all, which is deliberate: that is how your phone selects text, and this is an app for keeping other people’s sentences.' },
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
  { term: 'Keyboard', what: 'Press ? anywhere for the full list. / searches, N captures a quote, and G then H, L, C, Q or S goes Home or to the Library, the Catalogue, Quotes or Stats.', more: 'In a quiz, 1 and 2 grade and Space reveals a flip card. Every shortcut is also written on the button that does the same thing, so you never have to memorise one to find it.' },
  { term: 'Tab strip', what: 'Every screen, always visible in the top bar: Home, Library, Catalogue and Quotes, then the tools — Tags, Metadata, Stats, Settings.', more: 'The first four are what Settings → Features governs, so the strip is as long as you want it to be. It collapses to icons when the window is too narrow for the labels, and each one names itself on hover.' },
  { term: 'Hover labels', what: 'Every glyph-only control says what it is when you hover or tab to it, in a small bubble anchored to the control itself.' },
  { term: 'Right-click a card', what: 'A quote card answers a right-click with its own menu — copy, share, edit, delete — opened where you pressed.', more: 'Shift+F10 or the Menu key does the same from the keyboard, and Escape closes it and hands focus back. If you have selected text inside the card, the browser’s own menu wins instead: you wanted Copy, or Look Up, and those are not ours to take away.' },
]

export const HELP = {
  home: {
    title: 'Home',
    entries: [
      { term: 'Greeting', what: 'The date, and a greeting picked for your local time of day, the weekend, or a holiday. It changes on every reload.' },
      { term: 'Daily Quiz', what: 'A short multiple-choice round over your own quotes, scheduled on the forgetting curve — each card comes back right as you would start to lose it.', more: 'Answering moves that quote’s memory half-life.' },
      { term: 'Practice', what: 'The unlimited, skippable twin of the quiz. It keeps its own score and, by default, never touches your review schedule (Settings can change that).' },
      { term: 'Practise', what: 'A round about one thing.', more: 'It sits in a book or film’s own menu, on a person’s panel, beside a tag, and on the colour rows in Stats — wherever that thing is already named. The round opens over the screen you were on and hands you back to it. The Daily Quiz has no themed version on purpose: that deck is the schedule, and filtering it would leave the cards actually due unasked while the streak still counted the day.' },
      { term: 'Reveal / Got it / Missed', what: 'Reveal shows the answer; then say honestly whether you had it. The honest answer is what makes the schedule work.' },
      { term: 'Fix or tag this', what: 'On an answered card: correct a typo, change its tags, or ♥ it — without leaving the round.', more: 'It appears only once you have answered, because an edit form shows the quote and its source, which on most cards is the answer. A cloze card keeps its blank afterwards: the words you were asked for are the server’s to hide, not the card’s to redraw.' },
      { term: 'Language mark', what: 'A proverb has nobody to credit, so its card leads with its language where every other quote leads with a face.', more: 'The built-in is a letter from that language’s own script; Settings offers flags and anything else you can type. No language arrives wearing a flag — a flag is a country, and a language is not.' },
      { term: 'Status dot', what: 'Every quote wears one: remembered, forgetting, probably forgotten, or not yet reviewed. Hover or tap it for the memory half-life.' },
      { term: 'Favourites', what: 'The lines you marked with ♥ — book highlights, film dialogue and standalone quotes together, reshuffled on every visit.', more: 'It is a re-surfacing wall rather than a feed, which is why the order changes. Tap one open and it carries the same row as every other quote card — ♥, copy, share, colour, then the ⋯ — led by a glyph that takes you where the quote lives: the Library for a highlight, the Catalogue for a film line, Quotes for one that belongs to neither.' },
    ],
  },
  library: {
    title: 'Library',
    entries: [
      { term: 'Filters', icon: <IconFilter />, what: 'Genre, wishlist scope, favourites, tagged, has-notes, shelf state, series and sort. On a phone they open as a full-screen sheet with a live result count.' },
      { term: 'Translator · Editor', what: 'The other two people a book is by.', more: 'Both are real people here \u2014 they get a portrait, a life, links and a page, exactly as an author does, and one human can be an author on one book and a translator on another without becoming two records. Multiple names split on the same separators the author line uses.\n\nThey show on the BOOK\u2019S OWN PAGE, marked tr. and ed. so a second face is never mistaken for a second author \u2014 and nowhere else.' },
      { term: 'Wishlist / annotated', what: 'A book with nothing quoted yet counts as wishlist. Show everything, only those, or hide them to see what you have actually quoted.' },
      { term: 'Fold wishlist', what: 'Puts every book you have nothing from yet into ONE tile at the front of the board, wearing a collage of the first four covers.', more: 'Nothing moves and nothing is stored \u2014 opening it is the same wishlist chip, and a book leaves the folder by itself the moment you save a quote from it. Off until you turn it on, and it stays on. It applies to the flat board only: inside the wishlist chip there is nothing to fold away from, and a Wishlist folder sitting inside the bucket for one author would mean something different in every group it appeared in.' },
      { term: 'Shelf state', icon: <IconReading />, what: 'Reading, paused, abandoned, completed — the coloured bar under each cover. Set it from the state chip on a book’s page.' },
      { term: 'Sort', what: 'Recent, Title, Author, Series, or Last read — the date you last had it in your hands, whether you finished it, are still in it, or gave up on it.', more: 'Books you have never logged a read for sit at the end, in alphabetical order, because most of a library that exists to hold quotes has never been logged.' },
      { term: 'Group by', what: 'Break the grid into sections by series, author, decade or genre.' },
      { term: 'View', icon: <IconGrid />, what: 'Packed masonry, a plain list, or a sortable table.' },
      { term: 'Export', icon: <IconExport />, what: 'What is in view, as Obsidian-friendly Markdown that imports back cleanly. Filter first and you export that shelf; filter nothing and you export the library.', more: 'It asks before it writes, and the count it quotes is the count you will get.' },
    ],
  },
  movies: {
    title: 'Catalogue',
    entries: [
      { term: 'Films / shows / games', what: 'All three live here. The media-type chips narrow to one; a show’s dialogue carries season and episode, and a game’s credit is its studio rather than a director.', more: 'A chip only appears once the catalogue holds that type.' },
      { term: 'Filters', icon: <IconFilter />, what: 'Genre, wishlist scope, favourites, tagged, has-notes, shelf state, actor, collection and sort — as a full-screen sheet on a phone.' },
      { term: 'Actor', what: 'Narrows the board to the titles you have quoted a line from, spoken by one person.', more: 'It lists who is QUOTED, not the whole cast — a film whose cast you fetched and whose lines you have not saved is not under anybody, because the point of the filter is to find what somebody said. That is also what makes it agree with the search box: press Search from a board filtered to an actor and the same name goes with it, and search answers with that actor’s lines, grouped under the films they are from.' },
      { term: 'Shelf state', what: 'Watching, paused, abandoned, watched — the coloured bar under each poster.', more: 'A game is playing rather than watching, and played rather than watched; both words appear in the filter once you have a game.' },
      { term: 'Collection', what: 'A franchise or series grouping, the film side of the Library’s "series".' },
      { term: 'Sort', what: 'Recent, Title, Year, Collection, or Last watched — the date you last had it on, finished or not.', more: 'Anything you have never logged a watch for sits at the end, alphabetically.' },
      { term: 'Group by', what: 'Break the grid into sections by collection, director, decade or genre.' },
      { term: 'Export', icon: <IconExport />, what: 'The titles in view and their dialogue as Markdown. It asks first and names the count.' },
    ],
  },
  'book-detail': {
    title: 'Book',
    entries: [
      { term: 'Details', icon: <IconDetails />, what: 'Every stored field — title, author, year, series, ISBN, ASIN, genres, description, cover.', more: 'Read it there, edit any one field with its pencil, or fetch fresh metadata and choose field by field what to take. Edits do not have to go one at a time: open as many fields as you like and the ✓ in the header saves the lot in one go, which is also the only way that is safe — each field otherwise writes the whole record back, so saving them one after another would undo the ones before it.' },
      { term: 'Counts', what: 'Under the author, what this book is holding: how many quotes, and how many of those are favourites, carry a note, or are tagged.', more: 'The three breakdowns only appear when there is something in them — a row of zeroes is nothing to act on — and a book with nothing saved yet says so plainly, because that is the same state the Wishlist tag reports. They count everything on the book, not what a filter has left on screen, so narrowing to one colour cannot make the book look emptier than it is.' },
      { term: 'Hearts', what: 'Mark the book a favourite. It is stored per user.' },
      { term: 'State chip', what: 'The shelf: start reading, pause, abandon, finish — and, while reading, your page or percentage. A finished book keeps a ×N re-read count.' },
      { term: 'Add annotation', icon: <IconPlus />, what: 'Capture a highlight: the quote, an optional note, the chapter (its number, its name, or both) and where on the page, a colour and tags.' },
      { term: 'Colour category', asset: <HelpSwatches />, what: 'The left bar on each quote card, and the top of the hierarchy: tags say what a quote is about, its colour says what KIND of note it is.', more: 'Six of them, named in Settings — a fact, a line you disagreed with, something to come back to — and every picker, filter and breakdown in the app uses your words. The first one is the odd one out: it is what a quote gets when nobody picks, and what an import writes when the source named no colour, so it cannot be named without labelling every unmarked quote you own.' },
      { term: 'Copy', icon: <IconCopy />, what: 'The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end.', more: 'The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.' },
      { term: 'Share', icon: <IconShare />, what: 'A picture of the line, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit.', more: 'The image is drawn locally in whichever of the four skins you pick and never leaves the machine. The image can carry a portrait backdrop — the author’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. It rides the same Author tick as the credit itself, so turning that off takes the backdrop with it.' },
      { term: 'Export .md', icon: <IconExport />, what: 'This book and all its quotes as Markdown.' },
      { term: 'More (⋯)', icon: <IconMore />, what: 'Where the shelf action, export, details and delete live on a phone.' },
    ],
  },
  'movie-detail': {
    title: 'Film, show or game',
    entries: [
      { term: 'Studio', what: 'A game credits its studio where a film credits its director — the same slot, with the studio’s logo in place of a face.', more: 'Fetching a game pins its IGDB id and takes the DEVELOPER, the company that made it. If the source names no developer the slot stays empty rather than borrowing the publisher’s name, which is what it used to do.' },
      { term: 'Publisher', what: 'Who put the game out, which is usually not who made it: Electronic Arts published Mass Effect and BioWare developed it.', more: 'It sits after the studio on the credit line, as PUB., and it is a plain name rather than a link — a publisher has no page of its own here the way a studio does. A game added before 1.17.0 has this empty and may be crediting its publisher as its studio, because the two used to share one field; re-fetching it under Fetch metadata separates them. Films and shows do not show it.' },
      { term: 'Voice cast', what: 'Fetched from Wikidata, the only free structured source for game voice credits — and a thin one: ten of 24 titles checked had a usable cast.', more: 'A game with no credits on file shows an honest blank rather than a failed lookup, and the cast is hand-editable either way, so you can type what you know. Cast photos need no key.' },
      { term: 'Details', icon: <IconDetails />, what: 'Every stored field — title, director or creator, year, collection, TMDB and TheTVDB ids, genres, description, poster.', more: 'Edit one field at a time, or open several and save them together with the ✓ in the header. Re-sync from the source to choose field by field what to take. The two ids can be typed as well as fetched, and once set every later search fetches that exact record first. There is a third, the IMDb id, and it is the odd one: nothing is fetched with it, because IMDb has no public API.' },
      { term: 'Counts', what: 'Under the credit, what this title is holding: how many lines, and how many of those are favourites, carry a note, or are tagged.', more: 'The breakdowns appear only when there is something in them, and a title with nothing saved says so — the same state the Wishlist tag reports. They count every line on the title rather than what a filter has left on screen.' },
      { term: 'State chip', what: 'The shelf: start watching, pause, abandon, finish — with a ×N re-watch count.', more: 'A game reads start playing and played, and three can be in progress at once where a film allows two.' },
      { term: 'Add dialogue', icon: <IconPlus />, what: 'A line with its timestamp, the character, and the actor auto-filled from the cast. Shows also take season and episode.', more: 'A game’s timestamp is free text, so a chapter or an area name goes there.' },
      { term: 'Cast', what: 'Pulled from the source when you fetch metadata; it is what fills the actor on a new line.' },
      { term: 'Copy', icon: <IconCopy />, what: 'The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end.', more: 'The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.' },
      { term: 'Share', icon: <IconShare />, what: 'A picture of the line, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit.', more: 'The image can carry a portrait backdrop — the actor’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. Two credited actors take a side each, with the line between them, which is the shape a scene has. The small portrait disc steps aside when the backdrop is on: the portrait is already the face.' },
    ],
  },
  search: {
    title: 'Search',
    entries: [
      { term: 'An exact phrase', what: 'Put it in quotation marks — “to be or not to be” — and it is searched as one phrase rather than as six words in any order.', more: 'Everything outside the quotes still matches as you type. A quotation mark you did not close is not an error: those words simply search loosely.' },
      { term: 'The box', icon: <IconSearch />, what: 'Typo-tolerant and instant. Your last search is remembered.' },
      { term: 'Filters', icon: <IconFilter />, what: 'The colon grammar with nothing to remember: every field, every value your library uses, and whether a second pick narrows or widens.', more: 'Pressing a value makes exactly the chip typing it would make, so the two are the same thing seen from different ends. Each value carries how many hits it would give under the search you are running now — so a number of 0 goes grey rather than disappearing, which tells you which chip to take off.' },
      {
        term: 'What a colon does',
        what: 'Type a field name and a colon, and a dropdown offers the words your own library actually uses.',
        how: [
          'tag: author: colour: speaker: actor: character: director: genre: series: shelf:',
          'year: favourite: note: wishlist: book: movie: — five offered at a time, More for the rest.',
          'Choosing one lifts it into a chip below, so the box goes back to being free text.',
        ],
        more:
          'The dropdown narrows as you type and forgives a typo. A search made only of chips is a whole search: the box is allowed to be empty. Backspace on an empty box takes the last chip off, the same as every tag field in the app.',
      },
      { term: 'When you meant the word', what: 'Thirteen ordinary words are field names now, and “note:” is a thing people write.', more: 'Put a backslash before the colon — note\\: to self — and it stays plain text: no dropdown, and the words are searched exactly as they read. Only that colon is affected, so a backslash anywhere else in the query is still a character you are looking for.' },
      { term: 'Two chips of one field', what: 'Two tags narrow: tag:stoicism tag:death finds the quotes wearing both, because narrowing by a second tag is what pressing a second chip is for.', more: 'Two colours widen: a quote has one colour, so asking for two would be asking for something nothing is, and that query would come back empty forever and look broken. The same goes for a shelf, a series, a year and any credit — one each, so a second means "or". It depends on the field because one rule cannot serve both.' },
      { term: 'Colours by their names', what: 'A colour chip reads the word you gave the slot — colour:doubt, not colour:blue — and searching runs on that word too.', more: 'The stored colour is not what is on screen, so it is not what you type.' },
      { term: 'Arriving already narrowed', what: 'Searching from a filtered shelf searches that shelf — genre, series, shelf, favourites and wishlist arrive as chips.', more: 'Every chip is removable, so narrowing costs nothing — widening is one click. The filter sheet and these chips are the same state, so they cannot disagree.' },
      { term: 'A globe in the lens', what: 'Right-click the search button and every search becomes a search of everything, with a small globe on the magnifier to say so.', more: 'Right-click again to put it back. The drawer’s Search has always been global; this makes the top bar’s behave the same way if that is what you want.' },
      { term: 'Scope chips', what: 'Where to look: everything, or only books, annotations, films, dialogues or quotes.', more: 'Each one carries a glyph — the Library and Catalogue chips wear their own tabs’ marks, so the scope looks like the screen it searches — and the words beside them come and go with the Button labels setting in Appearance, which hides them on a phone where six of them stop fitting. All keeps its word at every width: it is the default and the way back, and that is not something to have to have learned a glyph for.' },
      { term: 'Sections', what: 'Results arrive grouped by what matched: books, films, people, characters, annotations, dialogues, notes, tags, genres.' },
      {
        term: 'Characters',
        what: 'A character’s lines gather under their name rather than scattering under the films they came from.',
        how: ['Press the name to narrow the search to that character.'],
        more:
          'So “everything this character says” is one section rather than something you assemble yourself. It carries no photograph, because a character is not a person and the actor’s face would be answering a different question. Films, shows and games alike.',
      },
      { term: 'Dates & decades', what: 'A decade ("1990s", "90s", "380s BCE") finds the works from it. A day ("2026-07-14") finds what you captured then.', more: 'The Stats timeline’s decade ticks come here.' },
      { term: 'Select', what: 'Tick a set of results for a bulk tag or field edit.' },
    ],
  },
  quotes: {
    title: 'Quotes',
    entries: [
      { term: 'What lives here', what: 'Lines that belong to no book and no film: a speech, a letter, an interview, a song, a proverb, something a friend said.' },
      { term: 'Boards', what: 'This screen lists BOARDS, the way the Library lists books — you open one to read what is on it.', more: 'They are yours: name them, colour them, describe them, give them a picture, make as many as you like. Proverbs, Speeches and Others are simply the three you started with, and nothing in the app treats those names as special, so rename or delete them freely.' },
      { term: 'Starting from one of the three', what: 'New board offers Proverbs, Speeches and Others.', more: 'Pressing one fills the form in — a name, a colour, and what it holds — and stops there, so it is yours to rename before you create it. They stay on offer rather than disappearing once you have one, because a board you renamed is one this app can no longer recognise, and the name box refuses a duplicate either way.' },
      { term: 'What it holds', what: 'A board is either ordinary quotes or proverbs, and that is a setting rather than a name.', more: 'A proverb board puts the language and the English translation first, because those are the fields that carry a proverb and are noise on a board of speeches. Rename a proverb board to anything you like and it stays one; call an ordinary board Proverbs and nothing about it changes.' },
      { term: 'Languages on a proverb board', what: 'Chosen when you make it and editable after: the short list the quote form offers instead of a box you have to spell the same way twice.', more: 'Any language, not only the three the starter proverbs come in. Group by Language then breaks the board into a section per language, which is a way of reading the shelf rather than a set of folders — nothing moves, and every other view still shows the whole board.' },
      { term: 'All quotes', what: 'Pinned above the boards and not a board itself: every quote you have, whatever it is filed under, so the collection stays readable as a whole.', more: 'It cannot be renamed, hidden or deleted.' },
      { term: 'Hiding a board', what: 'Folds it out of the list without touching what is on it — its quotes are still under All quotes, still in search, still in the review deck.', more: 'A board is hidden only when you hide it; an empty one stays put, because a board you have just made is empty and vanishing at that moment would be the opposite of helpful.' },
      { term: 'Deleting a board', what: 'Asks where its quotes go and will not proceed until you say.', more: 'Nothing is deleted with the shelf — a board is where you filed something, and unfiling should not destroy it. An empty board goes without a question. The one thing this cannot do is delete your only board while quotes are on it, because there would be nowhere to move them.' },
      { term: 'Occasion', what: 'Where the words were said. It is the locator, and unlike a page number it tells two quotes apart — the same line on two occasions is two quotes, not one.' },
      { term: 'Speaker', what: 'Who said it. It stands where a book’s author stands, it is what the review deck asks you to recall, and it takes a portrait and a bio like any other person.', more: 'Two names separated by one of your credit separators are two speakers, here as everywhere else.' },
      { term: 'When', what: 'A partial date: a year on its own is a complete answer, so nothing is padded to a day nobody recorded.' },
      { term: 'A quote with no attribution', what: 'Perfectly fine to save, and it stays out of the review deck — there is nothing to recall but the words already in front of you.' },
      { term: 'Speaker credit', what: 'The name under a line is a doorway, the way an author is on a book: their portrait sits beside it, and tapping it opens who they were.', more: 'A line credited to two people shows both faces and two doorways.' },
      { term: 'Copy', icon: <IconCopy />, what: 'The quote and its credit straight onto the clipboard, plain — no markdown, no asterisks, nothing to strip out at the other end.', more: 'The same words the share sheet’s plain-text format writes, and it holds back the same two parts the sheet does: the page or timestamp, and the day you saved it.' },
      { term: 'Share', icon: <IconShare />, what: 'A picture of the quote, which is what it opens on — or the words as Markdown, WhatsApp, plain text or Reddit.', more: 'The image can carry a portrait backdrop — the speaker’s photo bled in from the card’s edge, tinted with the quote’s own colour and faded out before the words start. Two speakers take a side each with the words between them, which is the shape a conversation has. The small portrait disc steps aside when the backdrop is on: the portrait is already the face.' },
      { term: 'Filters', icon: <IconFilter />, what: 'Colour, favourites, tagged, has-notes, then a tag, speaker or medium — the last two built from what you have saved.', more: 'On a phone they open as a full-screen sheet with a live result count.' },
      { term: 'Group by', what: 'Break the grid into sections by speaker, medium, place or decade.', more: 'A line missing that field lands in a bucket that says which field it is missing, because a quote with no speaker, no medium and no date is a perfectly ordinary proverb.' },
      { term: 'Export', icon: <IconExport />, what: 'The quotes in view as Markdown, which imports back cleanly. It asks first and names the count.' },
    ],
  },
  tags: {
    title: 'Tags & stickers',
    entries: [
      { term: 'Tags', what: 'Cut across books and films alike. Rename one here and every quote follows.' },
      { term: 'Tag style', what: 'Sticker, banner, flyout, tape or reel — how the tag draws on a quote card.' },
      { term: 'Stickers', icon: <IconUpload />, what: 'A heart, a star and three faces to start with, plus any transparent PNG or SVG you upload.', more: 'Pin one to a quote as a seal the text flows around, and drag it where you like. The five that came with the app are ordinary stickers — rename them, or delete the ones you will never use and they stay gone.' },
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
      { term: 'Calendar', icon: <IconCalendar />, what: 'A dot per day you captured something. Tapping a day opens exactly those captures in Search.', more: 'Switch it to Quiz or Practice and it counts answers instead — those days report how many you got right as well as how many you answered, because a dot shaded by volume alone reads a day you got everything wrong exactly like a day you got everything right. Resetting your practice score empties that stream outright, so nothing stale is left behind to hover over.' },
      { term: 'Memory', what: 'Health straight from the quiz: how many quotes are remembered, slipping, or probably gone, and your streak.' },
      { term: 'Breakdowns', what: 'The authors, speakers, actors, directors and tags your library leans on — plus People, one row each however you credited them.', more: 'Everything is a doorway — tap through to the works.' },
      { term: 'Timeline', what: 'When your works are from, not when you saved them.', more: 'Readable by decade, century or year, because a library holding something from 380 BCE and something from last year needs different bucket sizes to make sense.' },
      { term: 'Superlatives', what: 'The most annotated book, the most quoted film, the person you quote most, your busiest month, and who keeps slipping away.' },
      { term: 'Counts', what: 'All three kinds counted separately: annotations from books, dialogues from films and shows, quotes from no work at all.', more: 'The header total is the three added up.' },
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
  bin: {
    title: 'The bin',
    entries: [
      { term: 'What is here', what: 'Everything you delete waits here first — a book with all its quotes, a film with its lines, or one highlight on its own.', more: 'Putting one back returns it exactly as it was: the same quotes, the same tags, the same colours, the same review schedule, and the cover picture too, which waits in a corner of the image store rather than being thrown away. Deleting an account is kept the same way, whole, in the bin of whichever admin deleted it.' },
      { term: 'Getting here', what: 'The tile in Settings, and nothing else.', more: 'This page has a URL, so it bookmarks and survives a refresh, but it is in no menu on purpose: a permanent tab for things you have deleted would be a standing invitation to browse them.' },
      { term: 'A row', what: 'What kind of thing it was, what it was called, when it went, how many quotes went with it, whether its picture is still held, and when it is due to go for good.', more: 'Open a row that is holding something to read the lines inside it, each with its own colour. It is read-only — the two things you can do to an entry are put it back and get rid of it.' },
      { term: 'Restore', icon: <IconRevert />, what: 'Puts the whole entry back in one go, exactly as it was.', more: 'The buttons are never hidden until you point at them, unlike every other repeated row in the app: you came here having already lost something.' },
      { term: 'Remove for good', icon: <IconDelete />, what: 'Throws that one entry away now, with its pictures. There is no undo behind this one.' },
      { term: 'Kinds', what: 'Once there is more than one kind in the bin, chips appear to show one kind at a time.', more: 'Like the search scopes they lose their words to the Button labels setting in Appearance.' },
      { term: 'Keep for', what: '7, 30 or 90 days, or never.', more: 'The clock runs on server time and only while the server is up, so an instance that spends a week switched off has not spent a week of anybody’s thirty days — which is why a row says the date it is DUE to go rather than counting down to it. “Never” keeps everything until you empty the bin yourself.' },
      { term: 'Empty now', icon: <IconDelete />, what: 'Removes every entry and the pictures they were holding. It asks first, and it is the one act in this feature with nothing behind it.' },
    ],
  },
  settings: {
    title: 'Settings',
    entries: [
      { term: 'Colour categories', asset: <HelpSwatches />, what: 'What the six highlight colours are called. They arrive as Fact, Disagreed, Inspirational, Funny and Meta, and all are yours to rename.', more: 'Renaming one changes nothing but the words on your screen — the stored value stays yellow, blue, pink or orange, so exports and imports round-trip exactly as before. Hiding one takes it out of the pickers without touching a single quote already wearing it, and the palette deliberately shares no colour with the app’s own accents.' },
      { term: 'Appearance', what: 'Paper or film, light or dark or match-the-OS, four accents, and your own cover sizes. Every user keeps their own.', more: 'If your system asks for more contrast or less transparency, Tippani drops every texture — the page grain, the backdrop, the card and shell tiles — and leaves the borders, colours and layout exactly where they were.' },
      { term: 'Button labels', what: 'Whether a control that has a glyph also shows its words. Auto shows them on a desktop and hides them on a phone, where the row stops fitting.', more: 'It governs the filter chips as well as the buttons — the search screen’s scope row is six controls above a search box, and six words do not fit a phone. Hiding them never hides them from a screen reader, and every glyph still names itself on hover or long-press. A few controls opt out and keep their words at every width: primary submits, destructive confirms, and search’s All.' },
      { term: 'Features', what: 'Which sections of the app you want to see — the Library, the Catalogue, Quotes.', more: 'Turn one off and its tab goes from the strip, the drawer and the phone bar, its tile goes from Home, its chip goes from Search’s scope row, and ＋ stops offering that kind. Nothing else changes: every book, film and quote stays exactly where it is, the review deck still draws on it, and a link or a bookmark still opens it — so turning it back on finds everything where you left it.' },
      { term: 'Onboarding', what: 'The guided tour of every feature.', more: 'Start, replay or resume the whole thing, or pick one section and replay only that — the tour opens on that screen and carries on from there. It used to list every section on the card itself; a list you cannot press answers "is this covered?", which is not the question anybody arrives here with.' },
      { term: 'Users', what: 'Everyone on this instance, admin only.', more: 'Add an account, remove one, or hand over admin — deliberately asymmetric: any member can be made an admin, and an admin can step down, and that is all. Nobody can take another admin’s rights away, and nobody can delete another admin’s account either, because that would be the same thing with their whole library attached. The last remaining admin cannot step down, so the instance always has one.' },
      { term: 'Metadata sources', what: 'The API keys lookups run on.', more: 'Each field edits and saves on its own, and a floppy-with-a-tick beside a field means that key is stored — secrets are write-only, so nothing can ever show you one back. Press edit and a box appears below the row; save it blank to clear the key.' },
      { term: 'IGDB client id & secret', what: 'The games pair, and it is a pair — IGDB authenticates through Twitch, so one field on its own cannot look anything up.', more: 'Register an application at dev.twitch.tv/console for the client id, then press “New Secret” on it for the other half. Unlike films there is no shared built-in to fall back on: the credentials are per-application and rate-limited, so a key shipped with the app would be a queue everybody stands in.' },
      { term: 'Type', icon: <IconType />, what: 'Every face the app uses, each shown doing its own job — the quote face setting a quote, the label face setting a locator.', more: 'Two alternates apiece, bundled with the app and free to use; nothing is fetched from anywhere. Bold, italic, small caps, all caps and lining figures are per role.' },
      { term: 'Language marks', icon: <IconLanguages />, what: 'The other button on the Appearance card. A proverb has nobody to credit, so its card leads with its language instead of a face, and this is what that mark is.', more: 'The built-in is a letter from the language’s own script; the tray offers flags and a flag is never assumed, because a flag is a country and a language is not — Bengali is spoken either side of a border and Hindi has no flag of its own. Anything typable works, so a script the tray has no flag for is still yours to mark.' },
  { term: 'Upload a font', what: 'Beside the three bundled faces on every row. It is stored on your own server and never parsed there — the browser is the only thing that reads it.', more: 'A check then measures whether the face actually draws that row’s script, because swapping the Bengali face for one with no Bengali in it turns every Bengali quote into boxes. It is a warning and not a refusal: it can be fooled either way, and it is your font.' },
  { term: 'Review', what: 'The card keeps the two you set once — how many cards a day, and which of the three kinds of quote it draws from. Everything else is behind In-depth controls.', more: 'The three media are independent — books and standalone quotes without film dialogue is a valid answer. A quote with no speaker and no occasion stays out whatever you pick, and so does anything saved in the last week.' },
  { term: 'In-depth controls', what: 'Which questions each deck may ask, one switch per type per deck — plus adaptive intervals, the confirm step, and what a look is worth.', more: 'Back to defaults at the bottom puts every one of them back, not most of them. Three things it will not do: the daily quiz never offers a self-marked card, because a score that mixes marked and self-marked answers can be read as neither; a question type it does not recognise is ignored rather than refused, so a backup from a newer version still restores; and no deck can be left with nothing to ask.' },
      { term: 'Multi-author credits', what: 'Which separators split "Gaiman & Pratchett" into two people, at the bottom of the Metadata sources card.', more: 'The author line on each book is never rewritten, so this is safe to change at any time.' },
      { term: 'Devices', what: 'Pair the Android app with this account, and unpair it again.' },
      { term: 'The bin', what: 'A tile, and a page behind it.', more: 'Everything you delete waits in the bin first — a book with all its quotes, a film with its lines, or one highlight on its own — and the tile says whether there is anything in it and opens it. The list moved off this screen in 1.11.2: a settings card is a control panel, and the bin is a list of unbounded length whose rows expand, which in a 300px column had to leave one of its four facts out.' },
      { term: 'Backup & restore', what: 'Admin only: one dated, encrypted archive of everything — restored in place, or from a file taken off another Tippani.', more: 'On the server that made it, your current password opens it whichever password sealed it. Carried elsewhere, it needs the password it was sealed with. A passphrase archive is tied to no login and recoverable by nothing.' },
      { term: 'Back up now', icon: <IconArchive />, what: 'Makes the archive and keeps it here, on the server, ready to restore from.', more: 'It does NOT download it any more: making a backup and taking a copy of it are two different things, and doing both every time put a multi-megabyte file in your downloads whether you wanted one or not. The toast that says it worked offers the copy if you want it.' },
      { term: 'Download the last one', icon: <IconExport />, what: 'Hands you the archive that is on the server. It is a real link, so middle-click and “save link as” work on it.', more: 'Only the newest archive is kept — a new backup replaces it.' },
      { term: 'Changelog', what: 'Every release, newest first, out of the binary itself \u2014 so it works with the network off, on a LAN-only box, and behind a firewall.', more: 'Only the newest is open when it appears; the rest fold. The version you are actually running is marked, which is the one thing a link to GitHub cannot tell you. It stops at the build you have: for what is in a version you have NOT installed, the version number above it links to the releases page.' },
      { term: 'Updates', what: 'Admin only, checked on demand — never in the background.' },
    ],
  },
  profile: {
    title: 'Profile',
    entries: [
      { term: 'Photo', icon: <IconUpload />, what: 'Your avatar chip. A square image reads best.' },
      { term: 'Display name', what: 'What the greeting and the user list call you.' },
      { term: 'Switch account', what: 'Sign in as another user on this server.', more: 'It asks for that account’s password every time — being an admin does not let you in without one — and each account has a fully separate library. The form names the account you are leaving, because on a server with several adjacent names “switch” with no subject is a question about something you cannot see.' },
      { term: 'Log out', what: 'Ends this browser session only. Other browsers stay signed in; a paired phone keeps its own token until you unpair it.' },
      { term: 'Password', what: '8–20 characters — letters, digits and punctuation, no accents.', more: 'That narrow alphabet is deliberate: your password is also the key to your backup archives, so it has to be typeable on another machine months later. Changing it signs out every other browser session but deliberately leaves paired phones alone, and since 1.4.2 it no longer orphans your backups: on this server your current password opens every archive this server made.' },
      { term: 'Users on this server', icon: <IconPlus />, what: 'Admin only: add an account, grant or revoke admin, or delete an account and everything in its library.', more: 'To hand over, grant another user admin first, then revoke your own.' },
      { term: 'Maintenance', what: 'Admin only: rebuild the search index if search starts failing, or reset the whole instance back to first run.' },
    ],
  },
  capture: {
    title: 'Add & capture',
    entries: [
      { term: 'no book or film', what: 'Saves the line on its own, with who said it and on what occasion instead of a chapter and a page. It lands on the Quotes screen.' },
      { term: 'Book', what: 'Look one up by title, author or ISBN — covers and details come with it. Manual entry always works, key or no key.' },
      { term: 'Film or show', what: 'Looked up on TMDB and TheTVDB by title and year — or by a TMDB/TheTVDB id you type in Details, which names one record exactly where a title cannot.', more: 'Picking a match pulls the poster, cast and details.' },
      { term: 'Capture quote', icon: <IconQuote />, what: 'A line against any work you already have, without leaving the screen you were on.', more: 'Opened from a book or film’s own page, that work is already filled in — it is the same surface either way, and the only add form there is.' },
      { term: 'Save (✓)', what: 'In the title bar, not at the foot of the form, so it is reachable on a phone without scrolling past every field.', more: 'It stays greyed until the must-fill fields are filled, and says which one is missing.' },
      { term: 'Import', icon: <IconUpload />, asset: <HelpImportFlow />, what: 'Markdown and Readest exports, Kindle Bookcision and your Kindle notebook, Goodreads and Hardcover pages, IMDb quote pages.', more: 'Everything lands in Pending import first.' },
    ],
  },
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
  'search',
  'capture',
  'staging',
  'tags',
  'metadata',
  'stats',
  'bin',
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
  const sections = GUIDE_ORDER.filter((k) => HELP[k]).map((k) => ({
    id: k,
    title: HELP[k].title,
    entries: HELP[k].entries,
  }))
  sections.push({
    id: 'everywhere',
    title: 'Everywhere',
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
