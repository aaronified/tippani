# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Seven Bengali terms, on the owner's reading of the app.** The Library is a গ্রন্থাগার,
  Stats a পরিসংখ্যান, the quiz a প্রশ্নোত্তর, the practice section অনুশীলন, the daily one
  দৈনিক, an optional field ঐচ্ছিক rather than a sentence saying you may leave it out, and the
  Checks screen তথ্য বিন্যাস. The verb on the practise button stays ঝালিয়ে নিন — the mode is
  renamed, the act is not. হিসেব keeps the one job it was always good at: a record you can
  count, not the screen that shows them.

- **The 341 strings v3 added after the Bengali rewrite now read in the same voice as the
  other 3,331.** They had arrived correct and formal — এটি, সেটি, একটি, সংরক্ষণ — which is a
  different language from the one the rest of the app speaks. গুলি and এবং were left where
  they stood: not every formal word is the wrong one.

- **The quiz, the review and the practice deck stopped sharing words.** English calls two
  of them Quiz and Practice and leaves Review to mean whichever you were thinking of;
  Bengali now names three separate things — the exercise set is an অনুশীলনী, the
  spaced-repetition system behind it is অনুশীলন, the schedule inside that is a দিনপঞ্জি, and
  the unlimited skippable twin is ঝালাই. The two card types took the names that describe
  them: প্রশ্নোত্তর where a question is asked, শূন্যস্থান পূরণ where a phrase is blanked out.

- **The text-size info dot is a small i again.** Every other dot in the app is; that one sat
  inside an uppercased label and inherited it, because the dot's own case rule resolves to
  `inherit` by default. A glyph is not a word and no longer takes the case dial.

- **Nine more Bengali names, and five textures that wanted the spoken word.** রূপচর্চা for
  Appearance, নকশা for Material, যন্ত্রপাতি for Devices, কী বদলেছে for the Changelog, নিয়ম
  for a Stray-marks rule; and ইস্কুল rather than বিদ্যালয়, খাদান rather than পাথরখাদান,
  তাঁতঘর, বাঁধাইয়ের দোকান, চলচ্চিত্রের রিল.

- **A find-and-replace put a non-word on three screens.** Making every কোনো into কোনও also
  reached inside লুকোনো, so the hidden-boards label, the button-labels note and the
  selection help all read লুকোনও — which is not a word. The other seven sweeps were audited
  the same way and are clean: সেটিংস survived its anchor, যতগুলিই and যেকোনো came out right.

- **The search help said thirteen field names where the app has sixteen.** English and
  Bengali both, and the two lines immediately above it list all sixteen — so a reader who
  counted found the panel wrong about the screen it was describing.

- **Twenty-two more Bengali help entries, read without the English this time.** The fault
  a second pass finds is not mistranslation, it is an entry that cannot be worked from: a
  fold that says "switch it to quiz or practice" about a control its own sentence never
  mentioned, a capture panel that says "with a key or without" when nothing there has said
  what key, two search entries whose verb read as *shrinks two tags* rather than *two tags
  narrow the search*, and a `.term` in the index that read as "download the end".

- **Bengali stopped saying that objects wait for you.** অপেক্ষা presumes someone alive
  doing the waiting, so *imports waiting*, *quotes waiting*, *it waits in the bin* and
  *waiting for you to tick* all read as though the app's furniture had feelings. Forty-one
  strings now say বাকি or পড়ে থাকা, and Pending import is যাচাই বাকি ইমপোর্ট.

- **The Checks screen is যাচাইকরণ.** Six more register words settled with it — কোনও,
  প্রতিটা, the টা classifier, যে কোনও, সেভ, গুলো — while ব্যক্তি and চলচ্চিত্র were left
  where they stood. "Credit" gave up কৃতিত্ব, which is credit in the sense of honour, for
  the নাম phrasing fifteen other strings had been using all along.

- **Thirty-one Bengali help entries a rater caught.** The worst of them said the wrong
  thing: the game-cast note told you a game's *name* was missing when the English says its
  credits are, the keyboard shortcut for Stats still named a screen called হিসেব, and the
  whole Checks panel argued about why it is not called "রিভিউ" — a word the Bengali app
  has never used, because the review schedule is রিভিশন. The rest were the seams a
  translation leaves: *waits here* rendered as অপেক্ষা করে where Bengali says জমা থাকে,
  *cut across* carried over word for word, and one entry using উদ্ধৃতি twice in a sentence
  where it had to mean two different things.

- **Duplicate says what it is copying.** The sub-line under it read "a copy with the same
  note, tags, colour and locator" for a book's highlight, a film's line and a proverb
  alike. English can afford that; Bengali names the three separately, so the noun is now a
  slot the locale fills.

### Fixed

- **Expanding a deleted person or character in the bin returned an error.** Their entry's
  payload is a reversal, not a snapshot, and the handler read every entry as a snapshot —
  so the one request the chevron makes failed outright, and the row expanded to nothing with
  no way to tell that anything had gone wrong. Those entries now show what they took: the
  name and the portrait, round, as everywhere else in the app.

### Added

- **A bin entry shows the works inside it, with each one's own count.** A shelf deleted in
  bulk is one entry, and expanding it used to give you a flat list of every quote inside
  every book — 340 lines with nothing saying which book each came from, which is no use to
  someone trying to find one title. It now lists the books and films themselves: cover,
  name, and the number of quotes that went with that one.

- **Prune, in Metadata, for the saved records nothing points at any more.** A person kept
  for their portrait outlives the works that credited them; the per-work character backfill
  makes eight Harry Potters and seven of them end up linked to nothing. There has been no
  way to clear either but one delete at a time. The button sits in both the people and the
  characters console, draws nothing at all when there is nothing stranded, says how many
  when there is, and names both kinds in the confirm — "4 people and 19 characters" is a
  number you can recognise where "23 records" is not. Everything it takes goes to the bin
  as its own entry, so a name comes back on its own.

  A record is stranded only when every number the list shows against it is zero: no
  credits, no cast rows, and no quote pointing at it. A speaker with a standalone quote has
  no work behind them and is emphatically not an orphan.

### Changed

- **Four screens stop drawing a second bar on a phone.** Settings, Metadata, Stats and Bin
  each pinned their own header directly under the shell's — which already names the screen
  and has a line under the name for whatever the screen wants to add. Settings' was the
  clearest waste: on a phone that header's title is hidden and its caption had already moved
  to the shell's sub-line, so the row was pinned to say nothing. The counts they carried are
  now that sub-line, and Metadata's note about being the scaled-down console sits beside the
  section select, which is the thing it explains. Nothing changes on a desk.

### Fixed

- **The Quotes shelf list says when it could not be read.** A failed request left it
  drawing a page that looked like it had worked: a heading counting zero boards, an
  *All quotes* tile claiming zero quotes, and no message anywhere. The three states —
  reading, failed, and genuinely empty — now look like three different things.

- **Home says when your favourites could not be read.** The wall is drawn only when it
  has something on it, so three failed requests took the whole section off the page and
  told nobody. A reader with two hundred hearted lines and an expired session saw exactly
  the Home of a reader who has hearted none.

- **Shuffle answers when you press it.** A failed request left the screen exactly as it
  was, and so did an empty library, so the button read as broken in both cases. It now
  says which one happened.

- **The speaker remap stops answering before it has asked.** Choosing a title showed
  *this title has no cast* and *no speaker labels*, in amber, about a title it had not
  yet read — and then took both back. Choosing a second title left the first one's
  speaker rows underneath the new name, and a failed read was reported as an empty cast,
  which is advice to go and fill in a cast that may already be complete.

- **Home's two count tiles work from the keyboard.** They announce themselves as buttons
  to a screen reader and had no key handler at all, so Enter and Space did nothing.

- **Reset on a quotes board clears every filter.** It called a setter that has not existed
  since the medium column became a kind, so pressing it threw before it reached Kind and
  Language — and those two are remembered per device, so the filters Reset failed to clear
  survived a reload too. Nothing on screen said anything, because the failure was inside
  the press.

- **A game's line keeps what you type into it.** Editing one from Home drew a Timestamp
  box — which the server discards for a game — and hid Act and Quest, the only two fields
  that say where in a game a line happens. Home asked whether a work was a *show* and let
  everything else fall through as a film, so a game's favourite also wore the FILM badge
  and offered "Open this film".

- **The Bin says when it could not read itself.** A failed request drew the empty state:
  *nothing deleted*, on the one screen whose job is to hold what you deleted. It also
  stopped asserting a retention period it never received.

- **Stats says when it could not load.** A failed request left it reading *loading…* for
  as long as the page stayed open, with no way to tell a slow network from a broken one.

- **One face on a quote card, not two.** The speaker's chip and the older row of face
  discs were drawing the same person side by side, once with a name and once without,
  crowded onto the same line as the locator. The chip stands alone now and sits on its own
  line above it; the discs stay for the lines the chip cannot speak for, where several
  characters are named and nothing can say which of them spoke. A film line's chip falls
  back to the performer's headshot when the role has no picture of its own.

- **Names stop being clipped top and bottom.** Every scrolling name in the app sat in a box
  that clipped its own text vertically — a CSS rule about the other axis, which cannot be
  left visible once one axis scrolls. Worst on the Stats superlatives, where a tight line
  height on a display face sheared the tops and tails off the biggest names on the screen.

### Added

- **The search box says what it can parse.** It has understood `tag:`, `author:`, `book:`
  and thirteen more since facets landed, and never told anybody: the placeholder names
  three of them and vanishes the moment you type. Pressing the box now lists every field
  it accepts, each saying whether stacking two of them narrows a search or widens it.
  Typing narrows the list, and picking one hands straight over to its values.

- **The Stats breakdown and Top tags start a practice round, as the colour rows already
  did.** Every person row — authors, directors, actors, speakers — and every tag now
  carries the same practise key beside its count. The rows that cannot narrow a round
  (works, series, characters) draw no key rather than a dead one.

- **A character in the Stats breakdown wears their own picture.** Characters got records
  with pictures some releases ago and this list never read them, so the one breakdown
  about characters was the one with no faces in it.

- **A quote says who spoke it, and pressing the name opens them.** A line's speaker has
  been stored since the character records landed and no screen ever showed it — the app
  could answer "which lines are this character's" from the character's own page and could
  not put a face on the line itself. Now a book highlight and a film line both carry a
  chip: the character as this work bills them, their picture, and a press that opens that
  character on this work.

  Who *said* it is not who is *named* on it. A line can mention a room full of people and
  be spoken by one of them, so the chip is the one stored speaker while the text below
  goes on naming everyone; where a line names two people nothing is attributed at all,
  because a confident wrong answer on a card is worse than none. A film line keeps its
  performer beside the chip — the role and the actor are two different people, which is
  the whole reason both are stored.

  Upgrading fills these in for the works whose cast the app already knows. A work whose
  People panel has never been opened has no cast to point at yet, and its lines go on
  printing the character in text until it is.

### Fixed

- **A character billed twice on one work opens the row you pressed.** A film can list the
  same character with two performers — young and old, a voice beside a face — and both
  rows point at one character record. The page was told only which *work* you came from,
  so it led with whichever billing came first: press the second and you landed on a card
  naming a performer you had not pressed, with the one you did press listed below as
  though it were another work. It is told the row now.

- **Dismissing a dialog no longer dismisses what opened it.** Reported from a work's
  Details: open People, tap an actor, dismiss the person — and the People panel went with
  it. A panel is dismissed by the phone's back gesture, because that is what the panel
  stack listens to, and six dialogs pushed nothing onto that stack at all: back walked
  straight past them to whatever was underneath, and the dialog only vanished because its
  parent unmounted. The person's page, the paste-a-link popup, Add, the re-verify flow, a
  search result's quote, Settings' prompts and the share sheet each own their own step
  now, so one press closes the thing you were looking at.

- **One-click updates work again on a Compose stack whose service and container are
  named differently.** The update's first step asks Docker to inspect this container, and
  it asked by the process's hostname — which Compose sets to the SERVICE name, not the
  container's. Where the two differ no container answers to it, so every update died at
  the first step with `inspect self: docker 404` and the app reported only that the
  update did not start. It reads its own container id out of `/proc` now, which is true
  regardless of what anybody named anything; the hostname stays as the fallback, and when
  neither works the error says which two it looked for.

- **"Update now" in the phone's dock always checks.** It checked only when nothing had
  been fetched yet, so the first press asked GitHub and every press after it answered
  from that first reply — however old. A key called *Update now* that reads from cache is
  a key telling you that you are up to date about a release that shipped an hour ago.

- **The cover strip's fetch and the panel's fetch no longer answer to the same name.**
  Both announced themselves to a screen reader as *Fetch metadata*, on one panel, doing
  two different things to two different subjects — one asks the supplier about this
  edition, the other fetches the record. The first now says what it does: *Fetch metadata
  by edition*, which is what its own tooltip had said all along.

### Changed

- **A work's header on a phone is the one the design pack drew.** It was stacked — a
  132px cover alone on a row with 240px of empty paper beside it, and the title, the
  shelf state and both verbs pushed down by the full height of a 2:3 board. So on the
  screen with the least room, the arrangement spent the most of it. The cover is 96px and
  sits BESIDE its facts now, which is what the pack has always shown: kind, year and
  language on one line, then the title with the ♥, then the genres, then the shelf.

  Four things follow from the room that frees. The title takes the pack's smaller step,
  so it stops running to three lines. The shelf state is one chip — *Reading · 42%* —
  with the last read's date quiet beside it, instead of a chip, a second chip, a
  full-width bar and a percentage on four separate rows; everything is still one tap
  away, in the same popovers. The count moves to the strip above the quotes, where the
  pack puts it. And **Details and Practise are on the phone at last** — the two verbs the
  page exists for were desktop-only and reachable at 390px only through a menu, on the
  device where a menu costs the most. Both are drawn as the pack draws them, neither
  filled: the wide pack asks for "a primary without either going accent", and a solid
  accent slab was the loudest object on the screen.

- **A film, show or game page is the book page now — the same screen, with the type
  differences it actually has.** The two were separate files that had drifted into
  separate screens: on a wide window a book put its cover beside a scrolling column of
  quotes and each column remembered its place, while a film was a page you scrolled past
  the poster to reach the lines. A book's year, series and genre opened a search; a film's
  looked exactly as pressable and did nothing at all. A book's credits were people with
  faces and their own pages; a film's were underlined names in a sentence with a comma
  between them. The way back said *Movies*, a name the board had not carried for
  releases. All of that is one screen from here, so the next improvement to a work page
  arrives on all four kinds at once instead of on whichever one it was written for.

  What each kind still keeps is what actually differs: the noun (quotes, or lines), the
  poster's own placeholder word, the shelf words — a game is *played*, and counted
  against its own three rather than a film's two — the locators, and the credit roles: a
  book's translator and editor, a show's creator, a game's studio and its publisher,
  which is plain text because a publisher has no page to open.

- **Every phone screen has the two navigation keys, and a board's second key is the way
  to the other boards.** The dock seats five and three never move, so the last two are
  the screen's — and a screen with nothing of its own to offer published nothing and got
  two empty seats. On the Bin, on Tags, on Checks, on every screen that is a list and no
  more, the dock had holes in it. Those two seats now hold what Home has always put
  there: where else can I go, and this library's own machinery.

  On the Library, the Catalogue and the Quotes page the second seat was *Export*, and
  both of the reasons it was there had gone — the sort it replaced had moved into the
  filter sheet, and Export is four rows up in the screen's own ⋯ , so it was the one verb
  on the row that already had somewhere else to be. It holds the other boards now, which
  is the thing a thumb cannot otherwise reach: the rail is a desktop control and the
  drawer is at the top of the screen, the far end from where your hand is.

### Added

- **Every cast row says where it came from.** The credit fields in a work's Details have
  worn their supplier for releases — author from Google Books, director from TMDB, the
  ones you typed in the accent — and the cast list directly underneath them wore nothing,
  though the answer has been stored per row all along. Four states, and they are not
  three: a row the supplier listed, a row it listed and you then corrected — which keeps
  the supplier's mark, because that is still where it came from, and says in its label
  that you corrected it — and a row you typed, in the accent like a field you filled in.
  A supplier row whose name was never recorded still says nothing, rather than *unknown*:
  a source named that was never stored is one you would go looking for.

- **A character's name opens the character, on the work you pressed it from.** On a
  work's cast list the character name opened the row's *picture editor* — the right
  answer while a character was flat text with a still attached, and the wrong one since
  the character became a record with a page of its own. A reader pressing V is asking who
  V is. It opens the character now; the picture is still behind the face beside it, which
  was always the more obvious of the two doors. A row nothing has linked to a record yet
  keeps the picture editor, because a link to a page that does not exist is worse than
  the affordance it replaces.

  The page arrives differently depending on where you came from, because the question is
  different. From the metadata console it is "who is this", and it draws every work at
  once, as before. From a film's cast list you have already said which work you mean, so
  that appearance is lifted out and given the first section — inked down its edge, and
  the only section that is — with the rest listed below as *and 3 other works*. The same
  door is on an actor's page, where each role already names its work.

  Each of the three sections now carries a dot saying which grain it is: one row in one
  work's cast, one record across however many works, and the record itself. The sentence
  under each heading has always said what saving there *changes*; the dot says what the
  section *is*, which is the half a reader needs first to read the other one correctly.

- **A phone has a way back to the top of a long board.** A work with a hundred quotes was
  a minute of flicking to get back up: no scrollbar to drag, no Home key to press. The
  key arrives a quarter of the way down — measured against how far there is to come
  back, so a short work never grows one — and drops into the dock's place when the dock
  slides away, so the corner never holds two things and never sits empty.


- **A quote can be duplicated.** *Duplicate* in a quote's ⋯ opens the capture form on a
  copy — the words, the note, the colour, the tags and the locator all carried across —
  titled *Duplicate this quote*, with a line saying that Save writes a new one and the
  original is untouched. Nothing is created until you save: a duplicate you abandon is a
  duplicate that never existed.

- **The metadata page's sections are tabs across the top, and a dropdown on a phone.**
  They were a 13.5rem left column from 900px up — a sixth of a console screen spent on
  five words, in front of content that is almost entirely tables. On a phone the strip
  showed two and a half of five tabs, so the section you were not in sat behind a
  gesture with no arrow; a field states the one you are in and opens the rest.

- **The metadata page's dock carries *Everything that needs work* and *Fetch*.** The
  first opens one list of every gap in the library — the catalogue's, and also the
  people and character problems the desktop coverage tiles have never counted — with
  every row a door to the console that fixes it. Only what is actually wrong is listed.

- **The people console fits a phone.** The links and quotes columns go (the name opens
  the record, which holds both), the roles become glyphs, fetch loses its word, the six
  role chips become a field, and the table stops being a scroller inside a scroller.

- **The characters console filters by work.** The backfill makes one character record
  per work — eight films of a series are eight Harrys — so "everybody in this one film"
  is the list a reader wants, and the only control was a name box. *In no work* is a
  choice too: those rows appear on no work's page by definition.

- **A quote's translation is a reading setting now.** A translated quote is two texts,
  and the board always drew both. **Quote text** in a book's ⋯ chooses which — *Both*,
  *Quote only*, or *Translation only* — and the choice sticks. Asked for the translation
  alone, a quote that has none shows its own words rather than an empty card, and the
  table view honours it, which is the one place the translation was never drawn at all.

- **The list view is reachable again.** The board has always drawn three views; the
  toggle offered two, so *List* was a setting you could hold and not choose. It costs a
  menu row and no header width.

- **Settings has *Back up now* and *Update now* on the phone's dock.** They are the
  page's only two verbs — everything else on it is a preference you change where it is
  drawn — and both live in admin cards six cards down a scroll. Neither key skips the
  decision: the backup still asks for the credential that seals the archive, and the
  update still asks for the word UPDATE typed out, after checking whether there is
  anything to install.

- **The phone's dock has two more seats on Home.** The screen where a session starts
  published none of its own. One opens the boards you keep things in — Library,
  Catalogue, Quotes, Anthologies, whichever are switched on — and collapses into that
  section's own door when only one is. The other opens Settings, Stats and Metadata. The
  ☰ has held both lists all along; the difference is that the drawer is at the top of a
  phone and the thumb is at the bottom.

- **Selecting quotes can be found by looking.** A **Select quotes** row starts the mode
  with nothing picked. The other two ways in — a long press and a Ctrl-click — are
  gestures a reader has to already know.

### Fixed

- **A margin note folds at two lines.** It is a remark beside a quote, not a second
  quote — and unfolded, a paragraph-length note printed in full in 19px hand type was
  routinely taller than the thing it annotates. The quiz card's note still prints whole,
  because there it is what you are reading.


- **A phone can arrange a book's board at all.** The whole board header was
  desktop-only, so grouping, the sort column and the direction were reachable from one
  of two viewports — a phone-only reader sat permanently at the defaults. The pack's own
  band now sits between the description and the quotes: how many rows a filter is
  holding back, the arrangement underlined on the right, and the direction as a key,
  because "direction is one bit, so it is one tap and never a sheet".

- **A book's facts are doors again.** The year, the series and each genre open a search
  filtered to them — the component has taken that callback since it was written and the
  book page passed none, so every fact fell through to a flat caption. The language
  stays flat, and honestly: the server has no language facet, so that door would be a
  control that can only fail.

- **The strip under a cover is the shelf's colour, and it is drawn for every shelf.** It
  was the accent — so a paused book and one you are reading looked identical — and gated
  on having a percentage, so a completed book, an abandoned one and one on the wishlist
  had no strip at all. Those are exactly the three the strip can report best. It carries
  a real label now too ("Reading — 62%").


- **The quiz shows a face for every person a credit names.** A book by two authors asked
  the portrait map for somebody called "Le Guin & Lem" — nobody — so the option lost its
  face entirely, on exactly the card where a face helps most: four options that all look
  like lists of names. It draws the same overlapping cluster the library, the catalogue
  and a quote card do.

- **A phone's Settings header stops spending a row on one word.** "admin" was a label
  inside a page header whose title is hidden on a phone, so it was the only thing left in
  it. It is the shell bar's sub-line now, under the word *Settings*.

- **One-click update: the container is actually recreated now.** The update pulled the
  new image, said the recreater had launched, and left the container running the build
  it started on — on every current Docker host. The one-shot helper was
  `containrrr/watchtower`, whose last release (2023) speaks Engine API 1.25 while a
  modern daemon refuses anything below 1.40; it died before doing any work, and because
  it runs detached and self-removing, Tippani never saw the error. The maintained fork
  is the default now. `TIPPANI_UPDATER_IMAGE` still overrides it, and
  `docs/troubleshoot.md` describes the symptom for anyone on an older build.

- **A merged character's picture reaches every book they are in — on the cast list as
  well as on the quotes.** Setting a character's default picture and then merging that
  record with the same character in another book left the second book drawing no face at
  all. The merge joins the *records* — it deliberately does not copy a per-work picture
  onto every appearance, since "what this character looks like in *this* work" is what
  the per-work column is for — but with no per-work picture, the record's own is now what
  both surfaces show. A work that has its own still wins, and the character's own panel
  still leaves the slot empty on purpose, because "this work has none" is the state you
  open it to fix.

- **A phone's dock key stops looking pressed after you press it.** On a touch screen
  the last-tapped element keeps `:hover` until something else is tapped, so the key
  stayed lit for as long as you looked at what it had done.

- **A running update no longer pushes the Settings card off a phone screen.** "Pulling
  the new image — this can take a few minutes…" was the *label* of a 140px button. It is
  a line of prose now, and the confirmation form goes while the update runs: once the
  pull has started there is nothing on that row left to decide.


### Changed

- **A worklist's phone dock offers Export, and the order moved into the filter sheet.**
  Sorting and filtering are one visit to one surface again: two keys side by side
  opening two sheets that looked identical asked a reader to remember which door held
  the thing they wanted. The screen's ⋯ drops its *show only* and *sort* sections for
  the same reason — both were already reachable twice.

- **The Stats activity card's stream toggle stays put.** It shared a wrapping row with
  a reset link drawn on only one of the three streams, so choosing *practice* on a phone
  moved the toggle out from under the thumb that had just pressed it. The reset sits
  under the grid it empties now, which is where the decision is actually reached.

- **The filter sheet's Reset is a bordered button with a word on it.** It was a 34px
  glyph key in a footer whose other control is a filled primary, so the one thing on the
  sheet that throws work away was also the quietest thing on it.

- **A book's board header is one row of the things that arrange it.** The view moved
  into the screen's ⋯ (it was the widest control in the row and the least often
  changed), and the sort folded into the grouping's menu, where it states the current
  order without being opened. Grouping and ordering are one decision made twice —
  "by chapter, in reading order" — and were three controls side by side.

- **The phone's dock drops the hairline after ＋.** The accent key already separates the
  shell's fixed seats from the screen's.

- **The metadata catalogue shows each work's cover.** The one list whose subject is the
  picture — two of its filters are *no cover* and *low-res* — showed no pictures, so
  checking a flag meant opening every row to see the thing being flagged. A work with
  none keeps the space and marks it, because here the absence is the finding.

- **A character's page lists what they have said.** Every quote in the library filed
  under them, from books and films alike, with the work each came from — and a line
  saying how many further quotes name them *alongside somebody else*, because a quote
  with two speakers is filed under neither and a list that quietly omitted those would
  be wrong about how much somebody has said. A person's page gains the same list.

- **A quote's speaker and a cast row are the same record now.** The app used to work out
  which role a line's speaker was by folding the text and matching it, in three separate
  places, every time it needed the answer — and could not ask the question in reverse at
  all. The link is written where the name is written, so a rename carries it, an emptied
  speaker clears it, and a line naming two characters is filed under neither rather than
  arbitrarily under the first. Libraries already in use are caught up the first time each
  work's cast is opened; nothing to run.

- **What a character is on ONE work is editable at last.** The name a work bills them
  under, the performer, and a description that belongs to that appearance rather than to
  the record — a character reads differently in the novel and in the film, and the columns
  for saying so had existed since records landed with nothing able to write them. The form
  says which scope it is in above its fields, because those fields look exactly like the
  record's two sections down and reach one row instead of every work.

- **A performer can be named while a character is being added to a film.** One box above
  the picker rather than a step after it — and it is dropped for a book rather than sent
  and refused, since a book has characters and not a cast.

- **Where metadata comes from is now a section of the Metadata screen.** The API keys,
  the Google fallback, the separators that decide whether "Gaiman & Pratchett" is one
  person or two, and the mark a proverb wears where a credit would go were a card on the
  Settings page — two clicks from every record they configure, so a reader looking at a
  work filtered by *no source* had to leave the console to fix the reason. Nothing in the
  block changed in the move; what changed is the screen it is on. Settings is shorter by
  its tallest card, and its columns are redealt around what is left.

- **The People section lists records, not spellings.** It used to list one row per
  printed name filtered to one role: Bulgakov spelled four ways was four rows of a
  quarter each, and a record no work prints was not in the list at all. One row per
  person now, with the other spellings named under it and the counts that are actually
  theirs — 12 works, 128 quotes, rather than four rows of three books. The chips start on
  **All**, because a role is derived from a credit and a record nothing credits belongs to
  no role, which is exactly the row a review list exists to surface.

- **A person's name opens their record from the metadata screen.** The credits, the
  characters they have played, the spellings that find them, the merge and the split were
  not reachable from that screen at all; the name opened the enrichment modal instead.
  That modal is still there, reached from the row's own face, which is where a portrait
  belongs.

- **A portrait can be set on the record itself.** It was only ever settable by name, which
  lands on the first of two people who share one — so choosing a face for the second put
  it on the first, silently. The picture control on a person's record is the same one a
  character and a cast row use: search where a supplier is configured, a pasted address
  where none is, and the picture saves as soon as it is chosen.

- **The metadata screen has four sections instead of one long scroll.** Overview, Works,
  People, Characters, behind a rail that says how much is in each — so "is it worth
  opening the character list" is answered before you open it. The number beside Overview
  is a count of *gaps* and is the only one that goes red; a library of 900 books is not a
  warning. **And a phone gets the same four.** It used to get a different screen
  altogether — three maintenance buttons, two summary lines, no browsable record at all —
  so "can I fix this from my phone" answered "some of it, and you cannot see which".

- **Re-verify the whole library is reachable from a desk.** It was drawn inside the
  phone-only half of that screen, so the console built for doing metadata at scale offered
  its one library-scale sweep on phones and nowhere else.

- **The character page is where a character is now finished.** Every work they are in is a
  card wearing that work's own cover, with the picture that work holds of them sitting on
  it, the performer who played them there, and three acts: change this work's picture,
  make one of them the character's own face, or take the work off. A character with no
  picture of their own says so and points at the works that have one — nothing is promoted
  automatically, because eight Harry Potters are eight records until you decide they are
  not, and auto-picking the first still would put a face on that decision.

- **A character can be added to a work from their own page**, which is the other half of
  being able to take one off. It files the row under *this* record rather than under
  whatever the work already spells the same way — the distinction the whole identity model
  exists for, and one a name-based add cannot make.

- **Taking a character off a work is refused while that work's quotes still name them**,
  with the number, and with the two ways forward: rewrite those lines to say somebody
  else, or leave them with no speaker. Doing nothing is not offered because it does not
  work — a character named on a work's own line is put back on its cast every time the
  work is opened. A line that named three characters loses one and keeps the other two.

- **Characters can be merged and spellings split back out from the character page.** The
  endpoints have been there since records landed; only the person page ever offered them,
  so a reader who welded two Wolands together had a way back on one of the two tables.

- **Every field on a record now says who wrote it.** A record is assembled — the ISBN came
  from the scan, the page count from Google Books because Open Library had the wrong
  edition, the description you wrote — and one *Source:* line for the whole record could
  never say that. Each field carries its supplier's own mark instead, or **You** where you
  typed it, or nothing at all where nobody knows. The marks are drawn in the app's ink
  rather than in brand colours, and they are built into the app: nothing is fetched from
  anybody to draw them.

- **The navigation moved to a rail down the left edge.** Nine destinations in a column
  instead of a strip across the top, each with the number that matters to it — how many
  books, how many quotes, how many records still have a gap, whether your quiz streak is
  alive, which version you are running. It gives every screen the top of the page back,
  which is where the thing you came to read starts. Below 1180px the rail keeps its
  glyphs and drops its words; on a phone it stays behind ☰, because nine destinations
  pinned beside a 390px screen would leave 320px of book.

- **The person panel says which of three things you are changing.** How this one book
  prints a name; what the record is called everywhere; or which other spellings should
  find it. Each section says so above its own fields, because those are very different
  acts and the app has no way to ask which one you meant — changing "Mikhail Bulgakov"
  to "M. Bulgakov" on one cover is not the same as deciding that is their name.

- **A person and a character can now be opened as a record.** Every work they are on,
  every other spelling that finds them, the dates, a note of your own, and — for a
  performer — every character they have been linked to, with the work each pairing
  belongs to. A character's page is the mirror of it: every book and film it appears in,
  and who played it in each. **Nothing pairs itself.** An actor is linked to a role
  because you said so, never because two strings matched, which is the difference
  between a library that knows who somebody is and one that has guessed.

- **Two records for one person can be folded into one, and put back.** Say which one
  survives; everything the other was credited on moves across, and its spelling becomes a
  name that *finds* the record it joined — so the next import does not make it again.
  **No cover changes**: every work goes on printing exactly the name it prints today, and
  the bin holds the way back for as long as it holds anything else.

- **And a spelling can be pulled back out** into a record of its own, when the merge was
  wrong or when one name really was two people. It moves no works: the app does not know
  which of them belonged to whom, and guessing would file somebody's books under an author
  who never wrote them. The spelling stops finding the old record and starts finding the
  new one; the works are yours to move.

- **Characters can be folded together and pulled apart too, the same way people can.**
  When the app gave every credit and every cast list a record to point at, it made one
  character record *per work* on purpose — eight films of Harry Potter became eight Harry
  Potters — because the alternative is every "Narrator" in the library silently welding
  into one person across forty books. That was only half a promise: they were visible and
  there was no way to weld the ones that really are the same character. Now there is. Say
  which record survives, and every book and film the other appeared in moves across while
  **going on billing exactly the name it bills today**; the folded-in spelling becomes one
  that *finds* the surviving record, so the next cast import does not make it again; and
  the bin holds the way back for as long as it holds anything else. A spelling can be
  pulled back out into a record of its own, which moves no appearances, for the same
  reason splitting a person moves no works.

- **A performer's record now knows the lines they said.** The link was written when film
  lines and quotes were given records to point at, and nothing read it. Their record lists
  those quotes — each keeping the spelling it was written with, which is not always the
  record's name once two have been merged — and says how many *further* lines name them
  **alongside somebody else**. Those are deliberately left unattached, because a line
  credited to two performers has no honest single speaker; counting them is the difference
  between a panel that is complete and one that is quietly short.

  **Still nothing on screen has changed.** This and the character merge above are the
  record underneath; the screens that draw them are the next piece of work.

- **Deleting a person or a character now goes to the bin.** They used to go for good.
  A cast row on one work is attribution — how *that* film bills somebody — and deleting
  one is still a correction to that film, permanent as it always was. But the record
  behind it is something you wrote: the way it files, the description, the portrait you
  picked, every other spelling you told the app should find it, and every merge those
  spellings remember. Undo brings all of it back, including the cast rows and the quotes
  that had quietly stopped pointing anywhere when it went.

  **A person who is still credited on a work is not deleted at all** — you are told how
  many, and asked to deal with the credits first. Deleting them would have taken their
  credits with them while every cover went on printing their name, which is a library
  that disagrees with itself about who wrote what. A performer who only *speaks* can be
  deleted and put back; nothing is lost either way.

- **A book's page is two columns on a wide screen, and each one scrolls on its own.** The
  cover, the title, the credits and the shelf controls stay where you left them while the
  quotes move beside them — so scrolling to the two-hundredth highlight no longer scrolls
  the book itself off the top. Below 1180px nothing changes: the hero folds back above the
  quotes and the window scrolls, which is what a phone wants and what the desktop had.
  Each column also remembers where you were, so stepping into a quote and coming back
  lands you where you were rather than at the top of both.

- **A cover now tells you how big it actually is.** The picture, its real pixel size under
  it, and the four ways to change it — Fetch, Search, Upload, Paste URL — as one block
  rather than a thumbnail beside a row of buttons. The size goes red when the picture is
  small enough that Fetch would replace it with a better one, which is the *same* test the
  app uses everywhere else: the red is a promise something can be done about it, not an
  opinion about what a good cover looks like. A picture that is still loading, or one your
  browser is not allowed to draw, says nothing rather than claiming to be zero pixels
  wide.

- **The category filter says which category.** It was six coloured dots to try. You name
  your own categories, so a dot on its own cannot say whether the blue one is "Fact" or
  "Disagree" — the control names the one the board is filtered to now, with its colour
  beside the name rather than instead of it.

- **A book's quotes can be put in order and cut into sections.** There was no grouping at
  all, and the only sort was the table view's clickable column headers — so the two card
  views, which is where you actually read, showed three hundred highlights in whatever
  order they happened to be saved with nothing on screen offering another. **Order** by
  date added, chapter, location, length or category, either direction; **group** by
  chapter, category, tag or date, with the same headings the shelf uses.

  Each dimension runs in the order it is actually read in rather than alphabetically:
  chapters in reading order (the number where there is one, then the named ones),
  categories in the order the swatches are drawn, days newest first, tags biggest first.
  A quote missing the thing you sorted by sinks to the bottom whichever way the arrow
  points — it is not "location zero" — and a quote with three tags appears under all
  three. Grouping is not a view: a section holds whichever view you chose.

- **A work can link out.** There was nowhere on a book or a film to keep an address, so a
  reader who wanted its Letterboxd entry, its fandom wiki or a review kept it in the note
  on one of its quotes. Details has a **Links** row now: paste any address from any site
  and it says what it read before it stores it — *"Reads as IMDb — www.imdb.com"* — so a
  field that silently transforms what you typed is not a field you check afterwards. A
  site the app knows is drawn with that site's own mark; anything else is kept whole under
  a globe, which is a kind of link rather than a mistake. Adding is its own small
  screen — the list is what is already there, and adding to it is not another member of
  it. There is deliberately no fixed
  list of slots with "not linked" beside half of it: a novel with a film adaptation
  legitimately wants a TMDB page, and an obscure catalogue is not a special case.

- **A game's publisher survived the import queue at last.** The Markdown parser read it,
  the column existed, and the queue between them had no slot — so importing a catalogue
  export dropped it in silence, reporting a successful import with matching counts.

- **The Details panel shows what you just saved.** It was showing what the record said
  when you opened it: the panel's contents are fixed at the moment it is pushed, so
  saving the title left the row snapping back to the old one — and every later save on
  that panel restated the record as it stood when Details opened, quietly undoing the
  earlier ones. The panel reads the work when it opens now, writes from what it read, and
  tells the page behind it. A field edited in its own sheet is on the row the moment you
  come back.

- **Details is one list in the order a reader looks things up.** Title, subtitle, people,
  description, genres, year, language, publisher, series, pages, ISBN — not sorted by which
  editor a field happens to open, which is the app's problem and not yours, and which had
  buried People and Description under ISBN and ASIN. No headings: "Fields" over a list of
  fields inside a panel called Details is the panel's title said twice.

- **A work's people are one row, and everything about them is behind it.** The three credit
  boxes and the cast list used to sit in two different places — the credits among Year and
  Series as though naming the author were the same size of edit as a series number, and the
  cast above the form, twenty rows of a film's cast between the cover and the first field.
  They are one door now, because "who made this" and "who is in it" is one question.

- **Description and genres get a surface of their own.** A blurb is read while it is being
  corrected, and four rows of a nine-hundred-pixel panel is a slot to type into rather than
  a page to read; genres are a token list with their own filter. Everything that fits on a
  row still edits on the row — the pencil is the same pencil, and the size of the thing
  decides where it opens.

- **A book can hold its subtitle, its publisher and how long it is.** Three facts every
  lookup has always returned and the app threw away on arrival: Google Books sends a
  subtitle, a publisher and a page count on every volume, Open Library sends all three
  too, and there was nowhere to put any of them. They are rows on Details now, they come
  back from a look-up, a re-verify offers them across a whole shelf, and they survive the
  export and the re-import a library is actually rebuilt from. The subtitle is its own
  field rather than part of the title, because two printings of one book differ there and
  are still one book.

- **The two languages are editable at last.** A book has carried "the edition I read" and
  "what it was written in" for four releases; the hero printed them, search could filter
  by them, and the only way to put one there was an import file.

- **Six default faces instead of one.** Everybody without a photograph wore the same
  silhouette, so a People table of ninety names was ninety copies of one drawing — and
  the face, which is the fastest thing in a row to recognise, recognised nothing. There
  are six now, chosen by the person's own name: the same character wears the same face on
  a chip, in the table, on their record and beside their quotes, and it never changes,
  because a face that changes is a face you cannot learn. They are drawn rather than
  loaded, so they take the theme in both modes and can never be mistaken for a photograph
  somebody actually uploaded. An empty cast picture stops being a grey rectangle and
  becomes a person nobody has photographed yet, with the same one press to fix it.

- **The portrait on a person's record lost its label.** A round face with four picture
  verbs under a panel titled with the person's name does not need the word "portrait"
  over it; a cover keeps its label because it sits among eleven other named fields.

### Fixed

- **An imported highlight's speaker was not linked to the cast.** Every other path that
  writes a quote files it under the role that said it; the book importer wrote the name
  and stopped, so a shelf built by import — which is most shelves — had a character page
  listing nothing until somebody happened to open each book's cast list. Both arms are
  covered: the quote that arrives new, and the one that arrives as a duplicate and donates
  the speaker the stored copy was missing.

- **Adding a cast row discarded the description sent with it.** The field was accepted,
  trimmed and length-checked, then left off the insert — so "add this character with this
  note" saved the character, dropped the note, and replied with the empty description it
  had just failed to store. Editing the row afterwards had always worked, which is what
  made it hard to see.

- **Saving an API key threw after it had already been saved.** The metadata sources
  block moved to its own file and left one helper behind its import, so every key save
  and the Google-fallback toggle wrote the value and then crashed — the field simply
  never showed as stored. The sweep that reads every screen for a component it renders
  and never imports now reads shared helper *calls* too, which is the class this
  belonged to and the second time that class has got past it.

- **Fetching links for one of two people with the same name wrote them onto the other.**
  The console saved through the name-keyed upsert, which resolves to the lowest id where a
  name is shared. It writes by record id now.

- **A character stayed on a work its cast row had been removed from.** The work_cast
  table keeps a deleted pair as a tombstone so a provider refetch cannot bring it back,
  and the character page read those tombstones as appearances — so "in 3 works" counted
  rows nothing draws, and a removal changed nothing you could see. The people list already
  excluded them; the two halves of one screen disagreed about how many works a record was
  in.

- **Adding a cast row gave back a row with no record on it.** The reply was assembled from
  the request rather than read back, so the one response that says "here is your new cast
  row" was the one with no way to open the character it had just created.

- **Ordinary saves were quietly throwing away fields you had filled in.** Every save of a
  book or a film sends the whole record back, so anything the app forgot to include was
  erased — and it had forgotten several. Pressing the ♥ on a book cleared **both its
  languages** and turned *c. 1851* into *1851*; the same on a film cleared *c. 1942*.
  Saving a book from the Edit form cleared both languages again; saving a film cleared its
  **IMDb id**.

  **Applying a metadata match was the worst of them, and the only one you could not put
  right.** That screen exists to make a record *more* complete, and it was sending only
  the handful of fields a search result can improve — so the **translator**, the
  **editor**, both languages and the circa flag went every time you used it. The
  translator and editor are people, not text: clearing one deletes the link to that
  person's record, and with it the spelling that book used for them. Retyping the name
  afterwards makes a new link with no spelling of its own, so a deliberate one was gone
  for good.

  All of it is fixed, and the app now checks itself two ways: one guard reads what the
  server stores and fails if any save leaves a field out, and another reads the code and
  fails if a new save is written the old way.

- **A book's name is no longer broken in half by the buttons beside it.** In a window
  around 850–950px wide, the row of actions on a work's page left just enough space on the
  first line for the title to start there and finish underneath — so *Moby-Dick; or, The
  Whale* was drawn as "Moby-", then five buttons, then "Dick; or, The Whale". Nothing was
  missing and nothing overflowed; the name was simply in two places with a toolbar in the
  gap. The title now always starts below the actions, at every width.

- **Updating from Settings now works from any device, not just a browser on the server.**
  Pressing *Update* starts two image downloads before the server has anything to say back,
  and on a slow line that is minutes of silence — which is exactly the kind of request a
  sleeping phone, a Wi-Fi hand-off or a reverse proxy quietly gives up on. When that
  happened the download was abandoned halfway and nothing was updated, with no error
  anywhere to say so; over a cable on the machine itself the connection usually held long
  enough, which is why it looked like it worked *there* and nowhere else. The update no
  longer depends on the browser that asked for it staying connected: once you press the
  button it runs to the end. The page also stops reporting a failure when it merely lost
  the connection — it waits for Tippani to come back on the new version, as it already
  did — and a second press while one is running is refused rather than starting a second
  updater alongside the first.

- **The update page now says where the update stopped, instead of waiting for one
  that never started.** It could not see its own work: pressing *Update* starts two
  image downloads before the server has anything to say back, and a reply that takes
  minutes never reaches the browser at all — so whatever really happened, the page
  had nothing to go on and assumed the update was running. It assumed that when the
  socket was not mounted, when the image reference could not be found, and when
  Tippani could not work out which container it was in — the last of which happens
  before a single download starts, so nothing at all had been asked of Docker.
  Tippani now writes down which step it is on as it goes — checking Docker,
  identifying itself, downloading, handing over to the restarter — and the page
  reads that. A stop is reported the moment it happens, in Docker's own words, and
  the reason stays on the card rather than vanishing with a notification.

- **The update page no longer gets stuck on "updating & restarting…".** After the two
  fixes above it still stopped there for good, on a browser running on the server itself
  as readily as anywhere else — so it was not the connection this time. While it waits,
  the page asks Tippani every three seconds whether it is back yet, and one of those
  questions could go unanswered *without ever failing*: a container being replaced leaves
  its port open with nothing behind it, so the request was accepted and then simply never
  replied to. The page had no time limit on a single question, so it waited on that one
  for ever and stopped asking any more. The wait is now bounded three separate ways, any
  one of which is enough to end it, and it gives up after six minutes with an explanation
  rather than sitting there.

- **Long backups, restores and large uploads can finish.** Three of them said in so many
  words that they had lifted the server's one-minute reply limit for the job, and none of
  them actually had: the call that lifts it was reaching a wrapper that could not pass it
  on, and it failed by doing nothing and saying nothing. So a restore of a big library
  could complete and still report an error, and an upload over about thirty seconds was cut
  off. The limit is now genuinely lifted where those jobs say it is.

- **The bin says what each row is counting.** Every row said "quotes" — right for a binned
  book, which holds its highlights, and wrong for a merge, where the number is the works
  that changed hands: a merged author read "1 quote" for a book. Merges now count works,
  a deleted record shows no number at all (what came off it is its other spellings, its
  roles and its lines together, and there is no honest single word for that), and the
  page's own "N quotes held" no longer adds any of them in.

- **A bin row only offers to expand when there is something inside it.** The expanded row
  lists the quotes an entry is holding; a merge holds a way back rather than quotes, so
  its chevron opened an empty list.

- **A bulk delete's bin row has been showing the raw word `selection` since bulk delete
  shipped.** It now reads *Bulk delete*, in both languages, with the rest of them.

- **The Bin and the Stray marks pages no longer offer "Back to Settings".** Both used to
  be reachable only from there, so both named that door. Neither has lived in Settings
  since Checks was built — the rail, the phone drawer and Checks all reach them now — so
  the arrow pointed at a page that no longer contains them.


- **Six tests that read the source now use the app instead.** Home's favourites wall,
  the shuffled quote card, the "quiz me on this" button and the Shuffle control's
  position were all checked by searching the JavaScript for a function name — which
  passes for code that is present and never runs, and fails for a rename that changes
  nothing a reader sees. They now open the screen, press the control and read what is on
  it. Nothing about the app changed; two of the four found a real gap while being
  written, which is the point of the exercise.

- **A film line's actor and a quote's speaker now point at a record too.** They were the
  last two names in the app that were only ever text, so nothing could tell two performers
  of the same name apart or keep a rename from coming undone. Every quote that names one
  person is now joined to them: rename the record and their quotes follow; fold two records
  together and every line moves across while **going on printing exactly the name it
  printed** — the same promise a cover gets; pull a spelling back out and its quotes come
  with it. A line credited to two performers is left unattached rather than filed under
  whichever came first, because there is no honest single answer to who said it.
  **Nothing on screen has changed yet**: this is the record underneath, and the person
  panel starts listing those quotes when that screen is rebuilt.

- **The duplicate card on the Metadata console merges the two records instead of renaming
  one to the other.** It used to pick a spelling and rewrite it across every work in the
  library, which is a very large edit to make from a small card and nothing you could
  press to undo. Now it says the two are one person and leaves each book, film and quote
  printing what it printed — and the bin holds the way back. It also stops offering the
  merge once you have made it: two spellings of one record look exactly as alike
  afterwards as they did before, and the card used to keep asking.

- **Find and replace works on a standalone quote again.** Its four quote-only fields —
  speaker, occasion, place and medium — were listed as available and answered with an
  error instead, for every one of them, because two parts of the app called that kind of
  quote by different names. Nothing shipped had a button for it yet, which is why nobody
  hit it.

- **Adding somebody to a cast now creates the records, not just the names.** A character
  you type onto a film, one a fetch brings back, or one lifted off a line you saved — each
  one becomes a record you can open, spell another way, and merge. Before this, only the
  one-time upgrade ever made them, so a character added after it existed nowhere and no
  quote could point at it. A character belongs to its work rather than to the library, so
  a Narrator on a fortieth book is a fortieth record: two of them are visible and can be
  joined, whereas one shared Narrator would have hidden thirty-nine people.

- **A ⋯ in the top bar, on every screen, holding everything that screen can do.** It
  lists the whole set rather than the leftovers — which view you are in, which sort is
  running, what the filters are, and the verbs — so there is one place to look on every
  screen instead of a different arrangement of controls on each. The rows that are a
  choice say which one you are on. On a phone it replaces the ⋯ that used to sit in the
  bottom bar on a book's or a film's page, and the seat that frees up now opens that
  work's Details, which is the thing you actually reach for.

- **Every destination in the rail says what is inside it, not just how many.** Library
  read "412" and left you to open it to find out whether that was a lot of reading or a
  lot of shelf. Each row carries the pair now — books and their highlights, titles and
  their lines, boards and their quotes, anthologies and their entries, tags and their
  stickers — and **Checks says both of its lists**, imports waiting and marks still
  open, because one number on a row that leads to two lists cannot say which it counted.
  **The Anthologies row has a count for the first time**: it has been asking for one
  since the menu was written and the app has never sent it, so the row simply drew
  nothing and nobody noticed. **The bin is called Bin.**

- **Deleting a book or a film asks you to type the phrase**, the same one the selection
  bar has always asked for, and from its cover or from its own page it is now one dialog
  rather than two that resemble each other. One is a number you can misread too, when
  the one is a book with two hundred highlights and the tap that destroys it is the tap
  that opens it.

- **A search field in the top bar, with the scope worn as a pill you can drop.** It says
  what it will search — *in this book*, *in Library* — and taking the pill off is how you
  search everything: same field, nothing else to learn. That replaces the magnifier that
  used to sit there and the hidden right-click that widened it.

- **A breadcrumb**, so a screen says where it sits: *Library / Moby-Dick*. Two levels,
  which is as deep as this app goes.

- **Checks**, one place for the two lists that ask something of you — imports waiting to
  be okayed, and quotes with something odd left in them. Both were tiles buried in
  Settings, which is where you go to change how the app behaves, not to find out it is
  waiting on you. The bin moved out of Settings for the same reason and now sits in the
  rail beside it, with its count. **Checks is a screen now rather than a
  count with nowhere to go:** the rail's row has been drawn since the rail landed and
  opened a blank page, because the screen behind it had not been built. It is one page
  with two sections, and both halves keep their own addresses so an old bookmark still
  works. **Nothing about importing has changed** — a file still lands in the queue and
  still waits there until you approve it. What changed is that you can see it waiting.

- **One person is one record, however many ways their name is printed.** Bulgakov is
  "Mikhail Bulgakov" on the Penguin, "M. Bulgakov" on the Vintage, "Михаил Булгаков" on the
  Азбука and "মিখাইল বুলগাকভ" on the Bengali — four spellings, one human being, and until now
  four separate people in your library each holding a quarter of the quotes, with the
  "Works: 6" on every one of them simply wrong. A person is an identity now and their name
  is a label on it, so the four can be one and each book still prints the name that is
  actually on its cover.

  **Characters became records too**, with their own list, and separate from people: a
  picker for who wrote a book never offers a character, and a picker for who says a line
  never offers an author. A character is the same character across every adaptation while
  keeping a different picture in each — same Harry, eight films, eight photographs — and a
  quote can now say who spoke it and show the right face.

  **Nothing you can see has changed yet.** This release lays the record down and moves
  every existing credit onto it; the screens that let you merge two spellings, split one
  back out, or set how a name prints on one particular book come next. Your library is
  read once on the first start after upgrading — a co-authored book becomes two people
  rather than one person with a comma in their name, using the separator setting you
  already have — and it will say so in the log.

- **On a phone, the top bar is a header and the bottom bar is what you can do.** The
  title of whatever you are looking at, with a line under it saying something about it —
  the author, the year, how many quotes — and underneath the screen, a floating row of
  five keys: back, search, ＋, and two the screen chooses. Every verb that used to be
  crammed into the top corners is down there now, where a thumb is, and the title has the
  room those four glyphs were spending.

  Two bars disappeared to make it. A work's page used to draw a **second** top bar of its
  own, inside the page, duplicating the shell's rather than extending it — two rows on the
  device with the least of them. And the four navigation tabs that floated at the bottom
  are gone: they offered four of the nine places the app has while ☰ offered all nine, so
  navigation had two doors that disagreed about how big the app was. ☰ is the one door
  now, and it finally lists **Checks** and **the bin** alongside everything else.

- **Every panel that opens another panel now looks and behaves the same.** A work's
  details could reach about thirty surfaces across seven different kinds — a centred
  dialog, a bottom sheet, a confirm, three sorts of full-screen overlay, popovers, and
  twice the browser's own grey box — and you could meet three of them on one screen. They
  are one surface now: a header of three slots with the title centred in it, a back key
  that names where it goes rather than saying "Back", and a stack you can walk. On a
  phone or a tablet it rises from the bottom edge, where your hand is.

  **The Back gesture walks it.** Every step forward is a step your phone's back button can
  take back, one panel at a time, and closing a panel any other way leaves nothing behind
  for Back to re-open.

- **A scrolling row now says that it scrolls.** Wherever content outruns its box — the
  top bar's tabs on a narrow window, an annotation table, the Stats timeline and its
  year of activity dots, the help rail — the last stretch of it now fades out, and the
  fade moves to whichever end still has something on it. There is no arrow, no
  scrollbar and no counter, because the fade is the whole signal. It is measured in
  pixels sideways and in lines downward: a sideways fade has to clear a thumb, which
  does not change size, while a downward one has to land on the last line, which moves
  the moment you change your type size.

- **Those rows can now be dragged with a mouse.** Sideways scrolling used to be a
  touchpad or touchscreen gesture only, so on a plain mouse the row was simply stuck
  behind a fade promising content it would not give up. Press and drag anywhere on one
  and it follows; a drag swallows the click that ends it, so pulling a row along never
  opens the thing you happened to let go on.

- **Atrium — an eighth material set, with no material in it.** Flat surfaces and the
  accent, nothing composited: the seven others each name four textures and this one names
  none, which makes it the cheapest thing the app can draw and the answer for a machine
  where the grain is costing more than it is worth. It is deliberately a placeholder as
  well: the key is reserved for a glass set — modern, lit from behind — that is a design
  rather than four tiles, and shipping the flat version first means it can land later
  without moving anybody's stored preference twice. "No material" is a choice about the
  set, so it is not offered as a twenty-ninth tile in the per-slot picker.

- **A longest-streak tile in Stats → Memory**, with today's run as the line under it. The
  drawer and the Home card both show the *current* streak and neither can say whether it
  is any good: a run that has ended is invisible to that number by construction, so
  somebody three days into a new one had nothing to measure three against. The record is
  the headline here and the current run is the note, which is the only arrangement where
  both mean something at a glance. The tile appears once the Daily Quiz has been played.

- **A release line to follow, in Settings → Updates.** *Stable* is what the update
  check always did: finished releases only. *Pre-release* also offers release
  candidates and branch builds, for anybody testing a run-up. Nothing installs itself
  on either line — the check is still on demand and the update still needs typing
  `UPDATE`. The line is **not asked for when it can be inferred**: an install that is
  itself a pre-release is already on that line and is set to it, with a note saying so,
  because the alternative was a branch tester being offered the last *stable* release as
  their "update" — a downgrade, one click away.

- **Two questions the quiz never asked, and a second way of asking one it did.**
  "Who wrote this?" did not exist at all — the deck could ask which book a highlight
  came from and never who wrote the book — and "who said this?" existed but was
  screen-only, which was never a fact about the question: a speech has somebody who
  gave it, stored one column over, and a reader with a shelf of speeches had switched
  on a question that could never be asked of them. Both are multiple choice over
  people, with a face on every option; the wrong answers for an author are the authors
  of the books nearest this one, and for a speaker the rest of the film's cast or the
  other people you have quoted. **Fill in the blank now has a with-choices twin**: the
  same hole in the same words, with four phrases to pick between instead of a box to
  type into. The other three are real phrases cut out of your own other quotes by the
  same selector, so they are the right length and the right kind of words. The typed
  one is untouched and is still worth more — it is the only card that tests production
  rather than recognition — but it should not have been the only way to be asked.

  Both new types are on by default, in both decks, and every type's tooltip in
  Settings → Quiz now ends with the two axes it sits on: what is being asked (which
  work, which quote, who is behind it, the words themselves) and how you answer it
  (pick one of four, type it back, mark yourself). Seven chips in a row read as an
  arbitrary list until something says which of them are the same question asked
  differently.

- **A "which quote is from this book?" card now tells you where all four came from.**
  It put three passages from three other works in front of you and, once you had
  answered, said nothing about any of them — the round ended with three quotes read
  and unattributed, which is the opposite of what the deck is for. Each option now
  names its source under it, with that work's own cover or poster, the moment the card
  is graded and never before. **Reading them counts as seeing them**: the other three
  are reported as a "seeing" event, priced by the same *Seeing lengthens half-life by*
  preference that already governs favouriting and sharing — so a reader who has that
  at 1 gets no change at all, and one who has it higher has their half-lives moved by
  quotes they genuinely re-read.

- **An unreleased branch can be pulled as an image.** A release branch now publishes
  `ghcr.io/aaronified/tippani:<branch>` — `:v3` while v3 is in flight — so it can be tried
  on the machine it is built for without installing a Go and Node toolchain there. It
  carries nothing that moves: no `latest`, no `edge`, no series pointer, so nobody
  tracking a release can be moved onto unfinished work by it. It reports its version as
  `3.0.0-edge.<commit>` — a pre-release of the version the branch is *for*. A bare branch
  name reads as the release 3.0.0, which would have made the branch image look like the
  finished thing in Settings and, being newer than every published release, would have
  told its testers they were up to date forever.

- **Films and shows look up with nothing configured.** The published Docker images now
  carry built-in TMDB **and TheTVDB** credentials, the way Jellyfin and friends ship theirs, so a fresh
  install can search TMDB before anybody has been to Settings. A key you save still wins
  over it, and deleting yours now falls back to the built-in instead of to a `503`. It is
  a v4 **read** token — it cannot write to the account behind it — and it is injected at
  build time from repository secrets rather than committed, so a binary you build
  yourself has no built-in unless you pass them (`make build TMDB_TOKEN=… TVDB_TOKEN=…`).
  TheTVDB's built-in is a project key, which authenticates on its own — a subscriber PIN
  belongs to a person's subscription, so the free tier is still configured per install.

- **Suppliers can be mixed: TMDB's metadata with TheTVDB's character pictures.** Both
  halves were already separate controls — a re-sync pulls the record from the source a
  title is pinned to, and *Cast from TheTVDB* pulls only the cast, whatever the pin says
  — but two things stood between them. **A re-fetch erased the other supplier's id.**
  The record is written from one payload, TMDB's details carry no TheTVDB id, so every
  id column was written from a response that could not know two of them: pressing "this
  record is stale" on a TMDB title silently cleared its TheTVDB id, and with it the only
  route to a character in costume (that route needs the id on the row and refuses to
  search for one). The rule already written for the IMDb id — *a supplier is the
  authority on what it knows, never on what it does not* — now covers all four. And **a
  look-up can hand over just the id**: the match you pick proposes its own supplier id
  as a row you can take on its own, so you can keep TMDB's title, year and poster and
  still tell the app which TheTVDB record this is, instead of copying the number off
  their website.

- **A TheTVDB key that does not work no longer looks like one that does.** TheTVDB
  issues two kinds of v4 credential and only one of them logs in with the key alone: a
  paid **project** key authenticates on its own, while the free **user-supported** key
  needs your subscriber **PIN** beside it — and its dashboard describes the key as
  *inactive* until a subscription stands behind it. The app never sent a PIN, so that
  kind of key was refused at login every time. There is now a *TheTVDB PIN* field in
  Settings → Metadata sources (sent only when you have filled it, because a project key
  is refused if an empty one is sent).

  Worse than the refusal was that it was **silent**: when one film supplier fails the
  other's results are deliberately still shown, so a rejected TheTVDB key produced a
  full picker of TMDB hits and no hint that TheTVDB had said no. The lookup now says
  which supplier refused, above the results, whenever there are results to explain.

- **A character can have a picture of the character.** TheTVDB carries an image per
  ROLE — Amanda Waller in costume rather than Viola Davis on a red carpet — and it is
  the only supplier that does, so every TMDB-sourced cast row, every game's typed voice
  cast and every character in a book has never had one available at all. The cast row's
  *search images* now runs the picture search for the role, asking for **"Viola Davis as
  Amanda Waller in Suicide Squad movie 2016"** — the way a still is captioned wherever
  pictures of one are published — and offers what comes back beside the paste-an-address
  field. Where nobody is credited (a book's character, a game's cast) it asks for
  "Elizabeth Bennet character in Pride and Prejudice book" instead. Picking one stores it
  through the same route a pasted address has always taken, so a later refetch leaves it
  alone. With no picture source configured the button opens a web search in a tab,
  exactly as before.

- **A TheTVDB key that does not work no longer looks like one that does.** TheTVDB
  issues two kinds of v4 credential and only one of them logs in with the key alone: a
  paid **project** key authenticates on its own, while the free **user-supported** key
  needs your subscriber **PIN** beside it — and its dashboard describes the key as
  *inactive* until a subscription stands behind it. The app never sent a PIN, so that
  kind of key was refused at login every time. There is now a *TheTVDB PIN* field in
  Settings → Metadata sources (sent only when you have filled it, because a project key
  is refused if an empty one is sent).

  Worse than the refusal was that it was **silent**: when one film supplier fails the
  other's results are deliberately still shown, so a rejected TheTVDB key produced a
  full picker of TMDB hits and no hint that TheTVDB had said no. The lookup now says
  which supplier refused, above the results, whenever there are results to explain.

- **A character can have a picture of the character.** TheTVDB carries an image per
  ROLE — Amanda Waller in costume rather than Viola Davis on a red carpet — and it is
  the only supplier that does, so every TMDB-sourced cast row, every game's typed voice
  cast and every character in a book has never had one available at all. The cast row's
  *search images* now runs the picture search for the role, asking for **"Viola Davis as
  Amanda Waller in Suicide Squad movie 2016"** — the way a still is captioned wherever
  pictures of one are published — and offers what comes back beside the paste-an-address
  field. Where nobody is credited (a book's character, a game's cast) it asks for
  "Elizabeth Bennet character in Pride and Prejudice book" instead. Picking one stores it
  through the same route a pasted address has always taken, so a later refetch leaves it
  alone. With no picture source configured the button opens a web search in a tab,
  exactly as before.

- **Cover, poster and portrait searches can now look for PICTURES, not just
  records.** Every image the app could offer came out of a catalogue lookup — Google
  Books, Open Library, TMDB, TheTVDB, IGDB — which answers with a record that happens
  to carry one piece of art. That is the right answer when the catalogue has your
  edition and no answer at all when it does not, and for a PERSON there was no answer
  ever: the people console opened a web image search in a browser tab and asked you to
  copy an address back into a text field. There is now one route behind all three
  pickers that asks the suppliers that search for pictures:

  **Amazon, with nothing configured at all.** A print ISBN converts to the ISBN-10
  Amazon's image CDN indexes covers by, and an ASIN addresses one directly — so a book
  with an ISBN gets an Amazon cover offered with no key, no cookie and no setup. Each
  candidate is checked before it is shown, because that CDN answers "200 OK" with a
  40-byte placeholder for a book it has never stocked, and an unchecked candidate is a
  blank frame in the strip.

  **Google, with your own key.** Google Programmable Search (the Custom Search API,
  in image mode) takes a key and a search-engine id, both set in Settings → Metadata
  sources; 100 searches a day are free. The query names what it is after — "Heat movie
  poster 1995" rather than "Heat" — because the noun is the difference between a poster
  and a thermodynamics diagram. This is the one that finally answers the portrait
  question: press *search images* on a person and the candidates appear in the app.
  With no key configured that button does exactly what it did before and opens a tab.

  **Amazon's search page, behind the cookie you have already opted into.** The same
  stored session cookie that reads a product page will read a search results page, for
  the posters and box art that have no ISBN.

  One supplier failing never takes the others with it — a spent Google quota or a
  CAPTCHA from Amazon contributes nothing and says nothing, and the strip still shows
  what the others found.

### Fixed

- **One warning in the log had no row in the troubleshooting table.** `TIP-META-016` — a
  speaker remap that rewrote a film line's character and deliberately left its actor
  alone, because the line names a different number of characters than actors. It is
  written down now, along with the fact that it is not a fault. A new check makes a code
  that is logged but never registered fail the build instead of shipping unlookupable.

- **Nothing in the app cuts a name short any more.** Thirty-six places did — a book's
  title under its cover, an author's name on a group heading, a character and the actor
  who played them under a film line, a tag, a series, a person in search results. Each
  ended in an ellipsis, and an ellipsis on a name is the one thing you cannot detect:
  *Bibhutibhushan Bandyop…* and *Bibhuti* look equally like the whole of what was stored.
  They scroll under a soft edge now, and the edge only appears when there is actually
  more to see. The timeline's decade labels grew with the text instead of being cut off
  at the bottom, and the bin's rows stopped shortening what they hold.

- **The text-size dial stops at 175% instead of 200%.** At double size the app was no
  longer the shape it was drawn as — the rail wanted two fifths of the window, and every
  list row had lost the space to show a title. If you were on 200% you are on 175% now;
  nobody is dropped back to the default.

- **The rail keeps its glyphs instead of its words once text is large.** Above 125% the
  labels no longer fit their column, so rather than cut them — or grow until the
  navigation is a third of the screen — it shows the same icons it shows on a narrow
  window, and gives the page back. Measured in both languages: English is the binding
  case, not Bengali.

- **Thirteen "are you sure?" questions were still the browser's own.** Deleting a tag, a
  sticker, a font, a paired device, a person, a user account, a favourite, a quote, a
  search result, a selection of works, or merging duplicates — each asked in a grey
  system box with **OK** and **Cancel** in whatever language the browser was set to,
  regardless of the language Tippani was in. They are the app's own dialog now: the same
  words, in your language, dismissable with Escape, and with the page behind them held
  still. Nothing else about any of them changed.

- **The one-click update reloaded the page before it had updated anything.** It waited
  three seconds and then asked whether Tippani was answering — and it was, because *this*
  copy was still running while the new one was being pulled. So it reloaded onto the build
  it was already on, every time, and the update it had just started finished to an empty
  room. It now waits for the version that answers to be a different one before it reloads.
  And if the container comes back on the same build — which happens when the branch has
  moved but the image behind its tag has not been rebuilt yet — it says so, instead of
  looking like nothing happened.

### Changed

- **A book, a film, a show and a game all draw their page from one place now.** There
  were three headers — one for a wide window, one for a phone, one for the two-column
  layout — and the page picked between them. Three copies of the same nine facts drift
  the way three copies do, and these had: a **film never got the two-column header at
  all**, so on a wide screen a book and a film were laid out differently for no reason
  anybody chose. There is one header now, and where the cover sits is the only thing that
  changes with the width. A film differs from a book in what it is handed — the word
  *Film*, who is credited and in what role, and whether it is watched or played — and in
  nothing else, so a change to one is a change to all of them. **The Catalogue's pages
  gained everything the last change gave a book's:** the line above the title, people as
  chips, the big count, progress on the poster's own foot.

- **Escape closes one thing at a time.** Seventeen different parts of the app were each
  listening for the key independently, and every one of them that recognised it acted —
  so a single press reached all of them at once. Open a book's details, start editing a
  row, type, press Escape: the edit was cancelled *and* the panel closed, so the words
  went and so did the screen you were typing them on. Escape now closes the innermost
  thing that is open, and only that; press it again for the one underneath.

- **Closing a panel with unsaved changes asks first.** Every way out — the ✕, a click
  outside, Escape, the phone's back gesture — used to close without a word, so three
  fields opened and typed into were lost to one stray click. It now says how many are
  unsaved and offers to keep them. The app already knew the number; nothing had ever
  asked it on the way out.

- **The mark beside a margin note is drawn rather than typed.** It was a block-drawing
  character standing in for a rule — which meant it took the note's font, so a reader
  whose handwriting face lacks that character got a small empty box beside every note
  in their library, and the mark's proportions changed with the font rather than with
  the note. It is a 2px rule now, the height of the line it marks.

- **A tag has room to breathe.** Its letters sat about a pixel and a half off the frame
  around them, which reads as cramped on a card beside a quote.

- **A work's description shows more of itself in less space** — four lines at a smaller
  size instead of three at a larger one. It is background to the title above it and was
  competing with it.

- **Scroll a work's details and its cover, title and author follow you.** Past the
  point where the title leaves the top of the column, a small bar takes its place
  carrying the poster, the name and who it is by — so a long set of details never
  leaves you wondering which book you are looking at. It appears only when there is
  something to appear for, and it never moves the page under you.

- **A book's quotes can be filtered by notes and by tags, not just by favourites.**
  Two of the three chips the design calls for were missing; there was one, and on a
  phone the filter sheet offered the same one. All three are on both now, a switched-on
  filter sorts to the front so it cannot scroll out of sight, and each one tells a
  screen reader whether it is on — which none of them did. The button that adds a
  quote also takes the accent it should have had: it was a quiet outline while the
  view switch beside it wore the brightest colour in the row.

- **The quote board stopped cutting itself into columns of syllables.** On a 1080p
  screen a book's quotes were dealt into four columns about 170px wide — a few words
  per line — and on a wider screen, five. The board was asking how wide the *window*
  was, while it actually lives in a column that is the window minus the navigation
  minus the book's own details, and is then held to a comfortable reading width. It
  measures itself now: two columns of about 430px each, which is roughly the width a
  quote wants to be read at. **The table view, meanwhile, now uses the full width of
  the screen** — a table is scanned across, not read down a measure, and holding it
  to one squeezed every column and pushed the rest under a scrollbar.

- **A book's page now looks like the design it was drawn from.** The cover was taking the
  whole 300px column instead of sitting in it at 132 — more than twice as wide, five times
  the area — and everything it pushed down went with it: on a 1440×900 screen the two
  buttons the page exists for, *Details* and *Practise*, had fallen off the bottom. The
  cover is an object in the column again, the buttons are back above the fold, and both
  are now measured in a real browser on every build rather than looked at.

  The rest of the hero changed with it. **Genres sit under the title** as the same kind of
  small underlined fact as the year and the language, instead of as a row of filled pills
  two rows lower that read like filters somebody had applied. **The year, the language and
  the series moved out of the credit line** into a line above the title — that line used
  to read *Herman Melville · translator Anna · 1851 · Whales #2*, one sentence in which a
  person, a role word, a year and a series were all the same size with a middle dot doing
  the distinguishing. **Each credited person is a chip now**, carrying their face and their
  whole name: their own thing to press, their own door, and never an ellipsis through
  somebody's name. **The count is one number and its noun** — *128 quotes*, set large — with
  favourites, notes and tags a tier below rather than beside it at equal weight. Reading
  progress is a strip welded to the foot of the cover instead of a row of its own. The two
  buttons carry two weights, so the row states a preference instead of asking twice.

- **The nav rail is solid now, and a fill has to argue for itself.** Every destination —
  Home, Library, Catalogue, Quotes, Anthologies, Tags, Metadata, Stats, Settings, Search,
  Import, the account and Users — draws a filled glyph, because **solid says "somewhere to
  go" before the word beside it is read**, which is the same thing the shell says one step
  later when the active row wears an accent fill. Everything else in the app stays drawn at
  1.85: a key (tick, plus, close, chevron, the three dots) is a pen mark with nothing inside
  to fill, and a letterform like translate becomes a blob at 19px.

  Four more glyphs earned the exception. **Practise is a mortarboard**, which finally
  separates *the place you go to study* from *the card you are asked* — nine call sites read
  "practise" and drew the quiz card, so the two were the same picture. **The favourite fills
  when it is set**: the quiz card had been flipping its label between on and off while
  drawing one heart, so the state lived in the words and nowhere else. **The colour control
  is a palette** whose wells can hold the six category colours, replacing the ink drop. And
  **a game underway gets a controller** — `ReadingBadge` worked out that a work was a game,
  said so in its accessible name, and then drew the film glyph anyway.

  The glyphs are **[Phosphor Icons](https://github.com/phosphor-icons/core)**, MIT, and each
  one is cropped to its own ink so its long side takes the same share of its box. Straight
  from the pack the film reel filled 0.59 of its box and `users` 0.98 — thirteen tabs at
  thirteen sizes. Eight of the thirteen keep a drawn twin, because a glyph that is also a
  verb somewhere else must not wear the fill that means a place: `IconSearch` alone has
  thirteen such call sites.

- **The UI glossary is generated now, and it had been wrong for a release.**
  [`docs/ui-glossary.html`](docs/ui-glossary.html) — the page that names every part of
  the interface — was 150 entries of hand-written markup, and nothing compared it with
  the app. So it went on offering a **Paper / Film aesthetic** toggle for a whole
  release after 3.0.0 replaced aesthetics with material sets, driving a
  `data-aesthetic` attribute that appears *zero* times in the stylesheet; its topbar
  sample still showed an **Import** tab that is no longer a tab; four of the CSS
  classes it drew had been deleted from the app; and its buttons were missing
  `tactile`, the class that makes a button press. Nobody was careless — a document
  nothing executes has no way to fail.

  It is now built by `make glossary` from the code it describes: entries from a
  catalogue module, samples from the **real components** where one has a `glossary`
  declaration beside it, the constants section from the new `src/tokens.js`, and the
  theme data captured from `theme.js`'s own `applyTheme` rather than mirrored by hand —
  so the toggles now offer all eight material sets, in both modes, under any accent,
  and cannot disagree with the app about what any of them looks like. CI fails when the
  page is stale, and two new test files fail when an entry names a class or a component
  that no longer exists. Every one of the 150 original descriptions was carried over
  word for word: they are long, careful and full of recorded history, and the point was
  to stop them rotting, not to rewrite them.

- **The app no longer downloads itself all at once.** It compiled to a single 1.8MB
  JavaScript file, and a browser can render nothing until it has downloaded, parsed
  and compiled all of it — including Settings, Stats and Metadata, which most sessions
  never open, and including *both* shipped languages, which between them were 870KB of
  text and 58% of the bundle. It is now split: the main file is 953KB (278KB
  compressed, down from 505KB), React is its own cached chunk that a release does not
  invalidate, each tab screen is its own chunk fetched when first shown, and Bengali is
  a chunk of its own. Nothing about what ships changed — both languages are still in
  the box, the picker still offers both, and a Bengali reader's first screen is still
  in Bengali, because that one is awaited at boot when it is the language rendering.
  The tabs a reader is most likely to open next are fetched on idle, so the split costs
  nothing at the first click either.

- **Scrolling that the app does for you now glides.** An anchor, a jump to a section, a
  `scrollIntoView` — the wheel and the trackpad were always the browser's own and are
  unchanged. The two scrolls that must stay instant say so: arriving on a screen, and
  restoring a remembered position. Gliding to a place the reader was already standing in
  is not smoothness, it is a page moving on its own. Off entirely under
  `prefers-reduced-motion`.

- **A work option in the quiz wears its own cover; only a person wears a face.** A
  film title was offered with the portrait of one of its actors under it — picked as
  "the first one we have a line from" — which put a person's name and photograph under
  something that is not a person, on the one card whose whole job is to ask which of
  four things this is. Meanwhile the film, which has a poster on every other screen in
  the app, was the one thing on the card with no picture at all. Now: a work is shown
  by its picture, a person by their chip, and nothing shows both. The slot is reserved
  whether or not a given work has art, so four options line up rather than stepping in
  and out with whichever covers were fetched, and the attribution block on a card that
  reveals its source shows the cover beside the title.

### Added

- **The character's name is a link now, and it leads to the character's picture.** An
  actor and the part they play have been two separate stored pictures for a while —
  the performer is global, the character belongs to one work — but only the actor's
  name was clickable, so both names led to the actor. The character was flat text and
  the only route to its picture was working out that the small round face to its left
  was a button. Same affordance on both names, two destinations, each the one its noun
  implies.

- **A share card can draw the character instead of the actor.** A new *face* control on
  the picture panel, beside *portrait* and *sides*. It appears only when the work has a
  saved picture for both — a toggle that cannot change the picture is a question with
  one answer — and for a line whose whole point is who said it, the performer is often
  the wrong choice: V delivers the speech, and Hugo Weaving is a man in a photograph not
  wearing the mask. Book quotes get this too, which is the half nobody could see: the
  server has been sending a book's character pictures for as long as they have existed
  and no book surface ever read them.

- **Two more places to look for a picture, at the bottom of the ladder.** *Fandom*
  covers the long tail Wikipedia does not: Wikipedia writes about a character when the
  character is notable outside their own story, and Fandom writes about all of them —
  which is most of a cast list. It needs no key, and it is honest about being a guess:
  Fandom is tens of thousands of separate wikis addressed by a slug nobody publishes a
  mapping for, so the wiki is guessed from the work's title. A wrong guess costs one
  404 and offers nothing; a right one is exactly right.

- **Reading Google's image results directly — off by default, in Settings → Metadata
  sources.** The last resort, below Programmable Search, for an install that has
  configured nothing: anybody who fills in the key and engine id above it never reaches
  it. It is a setting rather than a key because it needs no key, and it is *asked* for
  rather than assumed because the requests come from your server — being rate-limited
  or shown a consent wall is a consequence for everyone in the house, not for whoever
  pressed the button.

### Added

- **Fandom finds the right wiki now, which is what makes it work for games.** The wiki
  is named for the *franchise*, not the instalment, and guessing from the title missed
  exactly there — measured over nine real titles, the guess found six, and all three
  misses were the same shape: `witcher3wildhunt` where the wiki is `witcher`,
  `masseffect3` where it is `masseffect`, `elderscrollsvskyrim` where it is
  `elderscrolls`. Those are precisely the works with no other source of character art
  at all, since TheTVDB has no games and Wikipedia writes about a character only when
  they are notable outside their own story.

  The wiki is now found by trying the full name, then without the subtitle, then
  without the instalment number — and the answer is **remembered on the work**, so
  every later search on that title is a single request. You can also **type the wiki
  yourself**, and a typed one is never overwritten by a later guess: Star Wars
  characters live on both `starwars` and `wookieepedia`, and no rule derived from a
  title picks between them.

  Fandom also supplies a work's **characters, with their pictures** — read from the
  wiki's character category, which is a MediaWiki primitive rather than per-wiki
  markup. For a game that is often the only character list in existence. And for a
  game's characters Fandom now goes **first**, ahead of Wikipedia, which was being
  asked before the supplier that actually has them.

- **Letterboxd and Fandom are metadata sources now, not just picture ones.** Both need
  no key, and both appear as columns in the per-field picker on a film you have already
  pinned. *Letterboxd* supplies its synopsis, poster, genres, cast, release year, every
  director (not just the first — a film with two of them had one silently dropped) and
  the lead production company. *Fandom* supplies
  its wiki article's opening paragraph and page image — which is often the only real
  description a long-tail series or game has anywhere.

  Both find their page by **guessing** a slug from the title, so both are offered only
  beside a record that is already identified: you see them next to the pinned
  supplier's answer and can reject a wrong one. An unpinned film is given no guesses at
  all, because a confident wrong record with nothing to check it against is worse than
  none. Fandom is honest about what it cannot know — no director, no year, no cast —
  rather than inventing structure out of an infobox.

- **Take each field from whichever source you prefer, in one pass.** A work pinned to
  two suppliers used to be read from one of them, chosen for the *entire* record by a
  single rule — so "TheTVDB describes it better but TMDB has the right year" was not
  expressible, and you could not even see that the two disagreed. Re-verify now asks
  every supplier a work is pinned to and shows a column per supplier on any field where
  they differ; picking one takes that field from that source. Fields only one supplier
  answers for look exactly as they did.

  A second request is the price, and it is paid only where it buys something: a title
  pinned to one supplier, or on an install with one key, fetches once as before. One
  supplier being down no longer costs you the other's answers — it is only a failure
  when nobody answered.

  This also **retires an asymmetry**: a film's supplier used to be recomputed on the
  server and a book's had to be taken on trust, because one was derivable from the row
  and the other was not. Neither is derivable once you can take the description from one
  place and the year from another, so both kinds now say which source each accepted
  value came from, and both are validated the same way.

- **Books and films both remember which supplier gave them each field.** Until now the app held one
  raw provider blob per work, overwritten by whichever fetch ran last, so "where did this
  description come from" had no answer at all — the closest thing was a notice counting
  titles "still on TMDB", which is the coarsest possible version of the question. Adding
  a film records who supplied its title, director, description, year, genres, series and
  poster; re-verifying records **only the fields you actually ticked**, so a value you
  declined is never attributed to the supplier whose version you rejected.

  Two deliberate silences. A field the supplier returned empty gets **no** entry — an
  entry there would attribute a blank column to whoever was asked last, and you could no
  longer tell "TheTVDB says the director is unknown" from "TheTVDB was never asked".
  And **nothing is backfilled**: every field in an existing library reads as unknown
  until something next writes it, because a guessed provenance is indistinguishable
  from a real one once it is stored, and it would be wrong for exactly the rows you
  have spent time correcting by hand.

  A book typed in by hand records **you** rather than nothing, which is what keeps an
  absent entry meaning "we do not know" instead of quietly filing your own work under
  the same silence as a field nobody has ever fetched.

- **Every key field now says whether you actually need it.** The card listed nine
  credential fields in one flat run and said nothing about which of them the app is
  waiting on — so it read as nine API registrations standing between you and a working
  library. Two of them ship with the app and a key there only *replaces* what is
  already working; one pair is the difference between games working and not; the rest
  are optional improvements to something that already answers. Each row now carries one
  word — **built in**, **needed**, **optional**, **closed to new keys** — chosen to
  answer "must I do something about this" rather than to report status.

### Fixed

- **The rail's destinations open again, and so does everything else you could click
  inside a scrolling row.** Library, Catalogue, Quotes, Tags, Metadata, Stats and
  Settings had stopped answering a click since the rail landed — only Checks, the bin
  and your own name still worked, because those three sit outside the part of the rail
  that scrolls. The same fault reached further than the rail: the rows of every
  annotation table, the days on the Stats calendar and the cast strip on a film were all
  inside a scrolling row too, and all of them had gone quiet. Rows that scroll can be
  dragged with a plain mouse, and the app was claiming the pointer the moment you
  pressed rather than once you actually dragged — which quietly handed it the click as
  well. It now waits until you have moved.

- **Correcting a field by hand now records that you did it.** Until now an edit changed the
  value and left the old supplier's name against it, so a page count you had fixed
  yourself went on claiming Google Books wrote it — and the next refetch treated it as
  the supplier's to overwrite. Only the fields you actually change are re-marked; the
  rest keep their supplier, so a refetch still updates its neighbours.

- **The rail's current row is legible at every accent.** The buttons in this app lift the
  top of their fill with a little white to read as raised, and pay for it in contrast —
  the ＋ Add label has been below the readable floor for as long as it has existed. The
  rail's current row is not a button, so it does not take the lift, and its label clears
  the floor on every accent, in both themes, on all eight material sets.

- **A character's name is no longer cut off.** It ended in an ellipsis when the row was
  narrow, which is the one kind of failure a reader cannot see — a shortened name and a
  short name look exactly alike, so the row was destroying the only thing it was there
  to show. Long names now scroll under the fade. In the suggestion list, where a
  sideways drag would fight the click that picks the row, the name wraps to a second
  line instead.

- **Your avatar's initial was cut off at the top on every screen**, at any type size
  above the default. The letter itself fitted the badge; the line spacing around it did
  not, because the badge was inheriting the page's leading and asking for half again as
  much room as it had.

### Removed

- **The Google Programmable Search key and engine id are gone from Settings.** Google
  closed that API to new customers and retires it on 1 January 2027, so the two fields
  asked readers to register for something they could not get and would then lose.
  *Google image search itself stays* — reading the results page, the toggle in the same
  section, which needs no credential at all and is why its opt-in is a setting rather
  than a key. The picture ladder was already built so this is not load-bearing: TheTVDB,
  Wikimedia and Fandom need no key, and the ladder answers with them alone.

- **TheTVDB's key field stopped reading as though it needed a subscription.** The
  subscriber PIN sat *above* the API key on the Settings card, so the first TheTVDB
  thing anybody saw was a PIN — and the reasonable conclusion is that TheTVDB wants a
  paid subscriber account. It does not. A *project* key authenticates on its own and
  never sends a PIN at all, which is the kind bundled with the app and the same
  arrangement Jellyfin ships; only the free user-supported key needs one. The app knew
  this and said it in the wrong place: "a paid project key needs no PIN" was the last
  line of the *PIN's* own tooltip, which you only open if you already believe you need
  a PIN. The key now comes first, and both tooltips say which kind needs what. The key
  row's hint also said "the PIN below" while the PIN was above it.

- **A film pinned to both TMDB and TheTVDB was still being read from TMDB.** 2.2.0 made
  TheTVDB the default source for films and shows — the lookup route says so, the
  Settings card says so, and a keyless install is told to configure TheTVDB first — but
  the two resolvers that decide *which* supplier a stored title is re-fetched from both
  tried TMDB first. So a title carrying both ids went on reading from TMDB for ever and
  never saw the per-character art the default moved for.

  A title acquires both ids by ordinary use, which is what made this quiet: re-verify
  offers a `tvdb_id` diff whenever TheTVDB's record carries one, so accepting that diff
  was how a reader took their own title *out* of the new default. And the "still on
  TMDB" notice counts only titles with no TheTVDB id, so those rows left the count at
  the same moment — still fetching from TMDB, with the app no longer saying so. Both
  resolvers now defer to one shared rule, so the next time the default moves there is
  one place to change rather than two that can disagree. Where TheTVDB is preferred but
  its key is missing, TMDB still answers — that is a fallback, not a preference.

- **A picture for a character in a book, a game, or any film still pinned to TMDB.**
  TheTVDB has an image per role and needs the work pinned to TheTVDB to find it, which
  leaves out every book character, every game's typed voice cast, and every title that
  has not been re-verified since the default moved — the majority, and the rows the app
  admitted it had "never had one available at all" for. Wikimedia now sits under
  TheTVDB on the ladder and answers them, and because it needs no key it is also the
  first character picture a self-built binary can produce at all.

  **The hard part is not fetching, it is being sure which article.** The search is
  Wikipedia's rather than Wikidata's, because Wikipedia ranks articles and takes free
  text, so the work's title can be handed to it as context — "V V for Vendetta" finds
  V, where a Wikidata label search for "V" finds a letter, a vitamin and a Roman
  numeral. What comes back is then checked, because a search engine always answers:
  the article must name the character, must not *be* the work (whose lead image is the
  poster — a wrong answer that looks entirely right in a strip), and its
  disambiguator has to fit. That last one is not hypothetical: "Trinity" is a
  character in The Matrix and also a nuclear test, and without reading the qualifier
  the strip offers a photograph of an atomic bomb. A portrait is held to the same
  standard in the other direction — every word of the person's name must appear in the
  article title, so "Anna Kavan" is not satisfied by "Kavan (disambiguation)".

  Where a person's record already carries their Wikipedia article — anyone resolved
  through Open Library does — no search happens at all and the namesake problem never
  arises.

- **Character pictures: the strip never asked the one supplier that has them.** Asking
  for a picture of a role reached exactly two suppliers — Google Custom Search, which
  needs a key *and* an engine id, and the Amazon scrape, which sells things. TheTVDB,
  which carries an image per character and is the only source that ever has, was not
  among them; it is why the default film source moved to TheTVDB in the first place. So
  on an ordinary install the strip came back empty and the button fell through to
  opening a browser tab, which is what it did before the strip existed. The suppliers
  are now an ordered ladder rather than a flat merge: for a role TheTVDB goes first and
  a web search fills in beneath it, and for a face TheTVDB then TMDB come before the
  search. The 18-picture cap is therefore spent from the top instead of by whoever
  answered fastest.

  Two things fall out of it. A portrait now reaches TheTVDB with **no new setting and
  no name search** — the person id has been arriving on every cast fetch and being
  discarded, and it is read back from the reader's own rows. And the ladder is asked
  using *our* ids, never a supplier's: the page sends a cast row id or a person id,
  which the server resolves scoped to that reader, so a request cannot name a work in
  somebody else's library.

- **The TMDB and TheTVDB info dots stopped contradicting the card they sit on.** The
  heading's dot has said "films and shows try TheTVDB first, then TMDB" since the
  default moved, while the dot on the TheTVDB key row still opened with "Optional" and
  the one on the TMDB row still said a missing TMDB key means lookups return 503. Both
  described the app as it was before 2.2.0, and they are the two dots somebody actually
  opens while deciding which key is worth going and fetching — so the card's own
  summary was right and the two fields it summarises were wrong. TheTVDB's now says it
  is tried first and is the only source with a picture per character; TMDB's says it is
  the fallback, and that the 503 needs *neither* source keyed.

- **Amazon stopped answering when the picture wanted is a face.** The picture strip
  asked every configured supplier for every kind of image, and one of those suppliers
  is a shop. Asked for a poster or a cover, that is exactly right — somebody sells
  the thing being pictured. Asked for "Hugo Weaving as V", it returns the DVD, a mask and
  a T-shirt; asked for an author, it returns their books. All of them are confident,
  well-lit, entirely wrong, and because they arrive first they crowded the strip's
  cap and pushed out the suppliers that do have faces. Amazon is now consulted for
  covers and posters only. The keyless ISBN/ASIN cover lookup is untouched — it was
  never a search — and the "is a supplier configured?" flag follows the same rule, so
  a portrait strip no longer reports a live Amazon it will never be asked.

- **The share picture's backdrop froze the page for seconds, and it was never the
  photograph.** "Clicking share shows a 'slowing down' message from the browser; the
  backdrop takes 5-10s to render." Measured in Firefox, the entire portrait pipeline —
  the cover-crop of a full-resolution scan, the `color` blend, the wash and the alpha
  mask — costs 13ms and does not care how large the source image is. The cost was the
  halo under the words: a canvas *shadow*, set on the context and paid for once per
  `fillText`, three passes per line and forty-odd lines on a full card. About 120
  separate blurs for one picture, measured at 1,603ms per draw, and the panel drew the
  card twice for every toggle. It was slow only with a backdrop because the photograph
  is what switches the halo on. Every word that wants a halo is now painted once into
  an offscreen layer, blurred **once**, and composited under the words the same three
  times — the same glow, at 177ms. The panel also no longer draws immediately when a
  backdrop is on: that draw paid the highest price and then painted the card *without*
  the picture, because the faces had not loaded yet.

- **The quotes board mounted every quote in the library.** The Library and the
  Catalogue were given a window; this board never was, and there is nothing different
  about quotes — it was simply missed. Four hundred quotes built 28,644 elements and a
  36,230px document before the reader had scrolled past three cards; it now builds
  4,378. The work detail page had the same defect on the page a reader actually spends
  their time on, and both its list and its tile views are windowed too. A quote card is
  not a cover tile — around seventy elements against a handful — so it reveals two
  dozen at a time rather than the shelves' sixty.

- **Revealing more of a board re-sorted the part already on screen.** A window grows by
  appending, which changes both the card count and the key hash — and the masonry read
  that as "a different set of cards" and re-packed the whole board tallest-first. Every
  reveal would have moved the card the reader was reading into another column, which is
  the one thing the board's existing freeze exists to prevent, arriving through the
  other door. An append is now recognised and carried: the cards already placed keep
  their columns and only the new tail is packed.

- **The page repainted its whole background on every scrolled pixel.** The lit surface
  behind the app — a pool of light at the top, a darker floor at the bottom — was two
  radial gradients with a `color-mix` in each, drawn with `background-attachment: fixed`
  on the root. A fixed background does not move with the content, so the browser cannot
  shift the painted page and fill in the newly-exposed strip: it re-rasterises the whole
  viewport against the new scroll offset every frame. It is now a fixed-position layer,
  which is composited once and then simply not moved — the same picture, and what
  "fixed" should have cost all along.

- **The Settings page read as an inverted U.** Tightening the Quiz, Onboarding and
  Features cards left the middle of the three columns at 657px between two of about
  1,200 — two tall sides around a short middle, which is the one arrangement a
  three-column page should never take. Updates moves into the middle column: 1226 /
  946 / 908, measured. Updates rather than Backup, which belongs beside the bin, and
  because Updates is the card a non-admin does not have — so a non-admin's page comes
  out exactly as it did rather than being balanced around a card they cannot see.

- **A shelf of four hundred books asked for thirty-one megabytes of covers to show
  eighteen.** Every tile on the Library board and the Catalogue's carried an eager
  `<img>`, so opening either one fetched the artwork for the whole collection —
  measured in a real browser at 401 requests and 31.1 MB, on a viewport that holds
  about eighteen covers. Covers now load as they are approached: the same board asks
  for 25 of them and 1.9 MB. The 2:3 box was already declared in CSS rather than read
  off the file, so nothing reflows as they arrive.

- **The board mounts a window, not a library.** The same four hundred books built 401
  tiles and 7,492 elements in one 707ms blocking task — each tile carrying a context
  menu, a selection tick and a shelf control — before anything could be clicked. The
  list is still fetched and filtered whole, because every chip, sort, count and
  select-all reads all of it; what is bounded now is how much of it becomes DOM. Sixty
  tiles at rest, growing 600px before the end of the board, so scrolling never waits
  for the decision: 61 tiles and 1,625 elements at rest, all 401 by the time you have
  scrolled to them. Grouped boards are bounded at both levels — twelve sections, sixty
  tiles inside each — because a hundred small sections is still the whole library.

- **751 kilobytes were re-downloaded on every single visit.** Everything the build emits
  under `/assets` is content-hashed — `index-DsRtUZ5f.css`, `caveat-latin-500-normal-B9SDL8cy.woff2`
  — so the name *is* the version, and a changed file is a changed URL. The server sent no
  `Cache-Control`, no `ETag` and no `Last-Modified` for any of them, which leaves a browser
  with no freshness lifetime and nothing to revalidate against. Measured in a real browser
  against a real instance: the bundle, the stylesheet and seven fonts came down on the
  first visit, the second and the third alike. They are now cached for a year and served
  from disk after the first load — 0 KB over the wire on visit two. `index.html`, whose
  name never changes, is deliberately still revalidated. **This is most of the "the app has
  become sluggish" report, and all of the "not even cached" one.**

- **Opening the share picture no longer fetches a third of a megabyte of fonts.** The
  share card is the only thing in the app that asks for the handwriting, Bengali and
  Devanagari faces — nothing else draws with them — and it asked for all three, plus the
  Latin subsets of the two Indic families, whatever language the quote was in. It now asks
  only for the scripts the card is about to set, and narrows each request to the characters
  it will draw. Measured: opening Share went from five font requests to none for an
  English quote already on screen.

- **The tooltip delay tests intent, not arrival.** Moving quickly across the top bar still
  raised bubbles — late, over whatever the pointer had moved on to — because the clock
  started when the pointer arrived and only a `pointerleave` stopped it. When that leave was
  delayed, the clock finished anyway. The delay now measures *rest*: any movement beyond
  eight pixels restarts it, so a sweep cannot complete one however late the events are, and
  a label is never shown for a control the pointer has already left.

- **A branch build now sees that its branch has moved.** Tracking `:v3` (or `:edge`) means
  tracking a moving image tag, and pushing to a branch rebuilds that image without creating
  any GitHub release — so the update check, which could only see releases, correctly and
  uselessly reported "no update" to a box with three commits' worth of image waiting for it.
  A branch build now carries its branch and its commit in its version, and the check asks
  GitHub whether that branch has moved; the link goes to the comparison of the two commits.
  A published release still wins when it genuinely outranks what you are running — an rc, or
  the release itself, is a better answer than another commit on the branch it came from.
  This also stops an `:edge` build being offered the last stable release as its "update",
  which was a downgrade dressed as an upgrade.

- **The page no longer re-composites itself on every scroll frame.** Two fixed,
  full-viewport layers — the paper grain and the scenic background — used `mix-blend-mode`,
  which blends an element with everything *behind* it: for a layer pinned over a scrolling
  page that means reading back and recombining the whole viewport every frame, with no
  JavaScript involved at all. The scenic layer also carried a 14-pixel drift running on a
  66-second loop forever, so the compositor never went idle even on a page nobody was
  touching. Both now composite inside their own element — the grain as a flat veil under a
  noise mask, the background against its own page colour — and the drift is gone. **The
  material set and the accent are untouched by this**: both layers still read the tile and
  the colour the way they always did, and swapping either works exactly as before. A test
  measures the old and new grain against each other across every skin and holds them to
  within a hundredth of a contrast point.

- **A readability inventory for the interface's own text.** Thirty-five ink-on-paper pairs
  — every button and every state it has, chips, the segmented toggle, labels, links, status
  text, menu rows, control borders — measured across all sixty-four skins (eight material
  sets × four accents × two modes). Twelve of the pairs run before every commit, one per
  kind of thing; `TIPPANI_FULL_A11Y=1` runs all thirty-five and every state. Fourteen are
  below their WCAG floor today and are recorded with the number they currently measure, so
  they cannot get worse while they wait to be decided; two more — a disabled primary and a
  disabled danger button — are pinned rather than owed, since 1.4.3 exempts inactive
  controls. The worst is the top bar's **Add** button at 2.62:1, which is an inconsistency
  rather than a palette choice: the primary button switches its ink for the dark theme's
  lighter accent fill and the Add button, wearing the same fill one bar up, does not.

- **And for the labels on the app's textured bars, which nobody had measured.** The
  readability work that came out of the Quarry and Bindery report measured the *selected*
  tab — the one riding the accent thumb — and stopped there. The tabs beside it sit on the
  bar itself, in `--soft`, over the same loud tile, and that pair measures **3.82:1 in
  Quarry** and 3.94 in Bindery against a 4.5 floor. It is the token and not the texture:
  every set fails in light mode, none in dark, and Atrium — which lays no tile at all —
  measures 4.07, so the grain is worth a quarter of a point of the shortfall and the
  palette the rest. Recorded, with a guard beside it that fails if a future tile ever costs
  a bar label more than a fifth of its contrast.

- **The Updates card now says why there is no one-click update, and the README says what
  the socket route actually needs.** Mounting `docker.sock` was never enough on its own —
  the image runs as the non-root user `65532` and the socket is `root:docker` `0660`, so
  the container can see it and not open it — and nothing said so: the card printed the
  same "needs the Docker socket mounted" sentence for a socket that *was* mounted. It now
  prints what it looked for and what the OS said, and for the permission case it prints
  the `group_add` line with **the group id read off your own socket**, because that number
  differs on every host. Two other cases it can now tell apart: no socket at that path,
  and a path with a `:ro` suffix left on it (that belongs on the volume line, not on
  `TIPPANI_DOCKER_SOCK`). The README gained the raw-socket recipe it never had.

- **The Updates card now says why there is no one-click update.** It said "one-click
  update needs the Docker socket mounted, or a socket proxy configured", which is the
  same sentence whether the socket was never mounted, was mounted somewhere the non-root
  user cannot read, or is being looked for under a path with a `:ro` left on it — a
  suffix that belongs on the volume line and not on `TIPPANI_DOCKER_SOCK`. It now prints
  what it looked for and what the OS said about it, including that last case by name.

- **The share picture no longer freezes the page when the backdrop goes on.** Drawing the
  card is not the slow part — it measures about 18ms even with a photograph behind it —
  but it was being done **four times for one change**: once immediately, then once more
  as each of the fonts, the portraits and the material tile resolved. Three of those four
  are identical, and on a backdrop card each one resamples the portrait at its original
  size (the picture search stages the full-size image on purpose) and runs a duotone
  blend across all of it. It is one immediate draw and one finished one now, and the
  faded portrait is built once per shape rather than once per draw. All of this happens
  in your browser; nothing about the picture is computed on the server.

- **The selected tab is readable in Quarry and Bindery.** Every surface in the app
  composites its texture through one operator — a veil of the surface's own colour at
  1 − *strength*, where the strength is measured per tile — and the selection fills (the
  top bar's selected tab, the select thumb, an active filter chip, the drawer's current
  row) were the one place that skipped it: they blended the tile at full weight. That is
  invisible in Manuscript, whose shell is paper, and it is a light label on near-white
  blotches in Bindery and Quarry, whose shells are suede and granite — the two loudest
  in the set library. Measured worst-case contrast on the selected tab was **3.10:1 in
  Bindery and 2.82:1 in Quarry** against 3.36–3.62 everywhere else; all seven sets now
  sit at 3.82–3.89, which is the contrast the same fill has with no texture on it at
  all. The active label also gains a tight halo, which is what holds a stroke together
  over grain — the drop shadow it had only ever defended the underside.

  A new test measures this the way the share card's does: it composites the real tile
  file at the real size, reads the pixels back, and fails if any set, accent or mode puts
  a label below the floor — so tile twenty-nine fails there rather than in a bug report.

- **Character pictures, reachable at last — and the row keeps its face while you edit
  it.** TheTVDB is the only supplier that carries a picture per role, so a library
  matched on TMDB (which is every library upgraded from before 2.2.0) had no route to
  character art at all: *Cast from TheTVDB* refused a title with no TheTVDB id and told
  you to go and use Look up, where you had to notice a second supplier was on offer,
  find the same title again, and take one row out of a merge. It now runs that search
  for you and shows the TheTVDB records for this title; picking one fetches the cast and
  **keeps the id**, so the art stays re-fetchable and nothing else about the record is
  touched. It still will not choose for you — a cast attached to the wrong film reads as
  a correct one — and it will never overwrite an id the row already has.

  Separately, pressing the pencil on a cast row swapped the whole row for two text
  boxes, taking the picture button with it: the reader who opened the editor *because*
  a character's picture was wrong found a form with no picture in it. The face stays
  through editing now, which also stops the row jumping 44px left of its neighbours the
  moment it opens.

- **A pre-release is a run-up to its version, not a successor to it.** Anyone running
  `1.0.0-rc1` was told they were up to date on the day 1.0.0 came out, because the
  version compare stopped at the numbers and read the two as equal. Pre-release
  identifiers are now ordered the way semantic versioning says: having one puts you
  *behind* the release, `rc.9` comes before `rc.10` rather than after it (a string
  compare had that backwards), and fewer identifiers sort first.

- **The container now says what to chown when it cannot start.** A Docker **bind**
  mount whose host directory did not exist is created by Docker as root, and the image
  runs as uid 65532 — so the app could not create its database, exited, and was
  restarted forever. All it printed was SQLite's `unable to open database file`, which
  names neither the directory nor the fix, and it happens before any log code or page
  exists to explain it. It now prints who owns the directory, who Tippani is running as,
  and the exact `chown` to run on the host. `docs/troubleshoot.md` has the case too, in
  a section for the failures that have no error code because nothing is up yet to emit
  one.

- **A work option could still wear somebody's face.** The rule — a work is shown by
  its picture, a person by their chip — was enforced only by the server not filling the
  field: the card drew a portrait whenever one was present, whatever kind of option it
  was. So the two halves of one rule lived on opposite sides of the wire, and either
  half changing would have brought the face back. Found by mutating the code and
  watching the tests not notice.

- **Fill in the blank no longer marks a close synonym wrong — and pays it less than the
  word itself.** Grading measured how far the letters had travelled, which is exactly the
  wrong instrument for recall: "nearly" for "almost" is six edits away and is the same
  sentence, while "fast" for "vast" is one edit away and is not. Words are now compared
  as words first — a British spelling for an American one, a plural for a singular, a
  past tense for a present, and a very short list of pairs that are genuinely
  interchangeable — and only then as spellings.

  **The list is seven pairs and is meant to stay that short.** A pair earns its place
  only if swapping one for the other changes the word and nothing else: not the
  strength, not the register, not the era. So "almost"/"nearly" and "whole"/"entire" are
  in, and "big"/"large", "quiet"/"silent" and "wise"/"clever" are out — one is the word
  a writer chose and the other is the word a reader reaches for, and a quotation is the
  one kind of text where that difference *is* the text. Every spelling fold is anchored,
  so it cannot invent an equivalence out of a substring: "poet" is still not "pet".

  **And a synonym is a third outcome rather than a second.** It counts — the card does
  not lapse — and it earns **half the stretch** an exact recall earns, on a new
  *A synonym is worth* slider in Settings → Quiz → in-depth (0 to 1; at 0 it counts
  without moving the card at all, at 1 the two are equal). The card says which of the
  two it was, under the revealed words, because a discount nobody is told about is a
  schedule moving for reasons you cannot see. The same word spelled differently or in
  another form is **not** a synonym and keeps full credit — nobody has failed to recall
  a line by writing "colour".

- **Share images with a portrait backdrop are readable again.** Turning a credited
  person into the card's backdrop put a photograph behind every word on it, and the
  small print never survived the trip. Measured against the palette, the credit line —
  the author's name, the book's title, the year — came out at **1.35:1** over a dark
  part of the portrait, and the "made with tippani" footer at **1.14:1**, where 4.5:1
  is the floor for body text. Even the quote itself only reached 3.64:1. The tag chips
  fared worst of all: a 12%-accent wash tints whatever is behind it, so over a face
  they stopped being chips. It affected every kind of card equally — a book's
  annotation, a film's dialogue, a standalone quote — because all three are drawn by
  the same renderer.

  The halo around each word was already there and was never going to be enough on its
  own: it gives type back a few pixels of paper, not contrast against the paper it now
  has. So the fix works on all three of the things that were wrong. The **photograph**
  is washed with the card's own surface colour before it is faded, which raises its
  floor in light mode and lowers its ceiling in dark, turning a full-range image into a
  band one ink can beat everywhere rather than in most places; because that happens
  inside the portrait's own buffer, ahead of the alpha mask, it fades out with the face
  instead of ending in a seam. The **secondary inks** step up one on a backdrop card —
  the credit takes the quote's ink, the footer takes the credit's — since the hierarchy
  there was never carried by colour alone, and 27px italic against 11.5px mono caps
  goes on saying which is which. And the **halo** itself is now sized to the type it
  sits under rather than a flat 8px for everything (which was a tight outline on the
  quote and a wash wider than the letters on the meta line, giving the smallest text
  the weakest surround), and painted three times, so it compounds towards opacity
  around each glyph while its outer falloff stays soft. Tag pills get an opaque coat of
  the card's surface under their wash. Measured off the rendered PNGs, the small print
  goes from 3.2–5.5:1 to 6.8–13.1:1 — from under the floor to over it in all four
  combinations of kind and theme.

  The portrait is a little quieter than it was, and the point at which it starts to
  fade moved earlier: the old fade held the photograph at full strength for exactly the
  span the credit line begins in, and had shed under a tenth of it by the first letter.

- **Tag chips on the share picture are legible, and are the app's chips.** They were
  accent-coloured text on a 12% accent wash — a tint of whatever is behind it, which
  measured 4.37:1 on a plain card and 2.39:1 on a dark card over a photograph. The app's
  own `.tag-chip` has never looked like that: it is a filled pill with ink on it. The
  card now draws the same thing in its own palette, which fixes the contrast (9.7:1 and
  10.8:1) and stops the picture disagreeing with the screen it is a picture of.
### Changed

- **The Bengali interface has been written again, from the code rather than from the
  English.** Every one of the 3,385 strings in `bn.txt` was rewritten for what its key
  does — the control it labels, the state it describes, the sentence the English was trying
  to say — in the written Bengali of today: ডিভাইস, ট্যাপ, এনক্রিপ্ট, ফন্ট, স্টাইল, ফরম্যাট,
  রিলোড, লিংক, ডট where the earlier passes had যন্ত্র, ছোঁয়া, তালাবন্ধ, হরফ, ধাঁচ, ফুটকি; one
  word per thing across the whole app where six writers had left two or three (a seal is a
  স্টিকার, a key is a চাবি, the calendar is the ক্যালেন্ডার the help panel already called it);
  the classifier টা throughout, দুটো and কটা without the apostrophe. Where the English is a
  bare label the Bengali may say what the thing is for, because that is the sentence a
  Bengali speaker would use for the same job. The register and orthography in
  `docs/plans/bengali-style.md` stand, and three terms changed at the owner's word: a book
  highlight is an উদ্ধৃতি like any other quote (দাগ, which reads as a stain, is retired), the bin
  is the ডাস্টবিন, and the text of a quote is a বাক্য. Every term that changed is recorded at the
  sheet's foot under "v3 decisions". The tour's demo book is now the
  first song of গীতাঞ্জলি rather than a translated English quotation; the demo film stays
  Casablanca, because a film line is a quotation too.

### Fixed

- **The Type card called its figures option "Lining figures".** The switch applies
  `tabular-nums` — figures that line up in a column — so it now says Tabular figures; the
  Bengali (সারিবদ্ধ সংখ্যা) had said what it does all along.

## [2.2.9] - 2026-08-25

### Fixed

- **High-contrast mode now actually removes the texture.** Asking your operating system
  for more contrast — or for less transparency — has always been meant to strip every
  decorative layer in the app: the page grain that multiplies over every glyph, the
  scenic backdrop, the card tiles, the button grain, the selection fills. The rule that
  does it has been in the stylesheet since the release that added six textured surfaces,
  it names all twenty-three of them, and it did nothing whatsoever. It sat in a CSS layer
  where the dark theme's own grain rule out-specified it, where three later rules with
  identical selectors simply came after it, and where the top bar, the drawer and every
  mobile surface are declared past the end of the last layer — which makes them
  unlayered, which beats a layered rule however specific it is. A reader who asked for
  more contrast got 5.5% of noise standing between them and the text, in both themes, on
  every screen, and nothing on screen said so.

  The block now sits in the first layer with `!important`, which is exactly how the
  reduced-motion rule beside it has always worked: for important declarations the cascade
  **reverses** the layer order, so one rule in the first layer beats the whole file —
  including a rule added tomorrow in a place nobody predicted. Chasing this with more
  specific selectors would only have moved which rule won. Nothing structural changes:
  borders, lifts, colours and layout are untouched, so what is left is the same app with
  the noise taken off rather than a different one.

  **The test that was meant to guard this is why it shipped.** It searched the stylesheet
  for each selector's name inside the block, found every one of them, and reported the
  promise kept. It now parses the stylesheet and resolves the cascade — importance, layer
  order, specificity, source order — and asserts the value a reader ends up with. It also
  derives the list of textured surfaces from the stylesheet instead of carrying a typed
  copy, which immediately found two more (the aesthetic-preview callouts) that the typed
  list could not have named. Two different bugs are now catchable: a texture with no off
  switch, and an off switch that loses.

## [2.2.8] - 2026-08-25

### Changed

- **Name fields no longer capitalise as you type.** "The Wheel of Time" could not be
  typed into a series box for four releases: the rule promoted "of" while it was still
  the one-letter word "o", and its own escape hatch then froze the capital for the rest
  of the edit. Three attempts to make the rule smarter produced three more ways to be
  wrong about somebody's name. The rule is gone. Every name and title field now sets the
  HTML `autocapitalize="words"` hint instead — on a phone the keyboard offers a capital
  at the start of each word and **you press shift when the offer is wrong**, which is a
  control you already know; on a desktop nothing capitalises anything and what you type
  is what is saved. Prose fields — a quote, a note — keep sentence capitalisation, which
  is what you want there.

### Added

- **A character you have quoted is one of the work's people.** Book and game characters
  had to be typed into the People list separately before they appeared anywhere, even
  though you had already named them on the quotes themselves. Every character named on a
  work's own quotes is now on that work's cast list — so the character dropdown offers
  them, the People section can give them a picture, and a film line's "played by" comes
  along where the line named one. Nothing is guessed: a line naming two characters and
  one actor pairs neither.

- **Portraits fetch themselves.** An actor's headshot resolved only when you opened that
  person's panel by hand, one at a time, so a film with twenty credits needed twenty
  visits before its board showed twenty faces. A work's page now fetches the portraits it
  is about to draw — serially, capped, once per name, and not at all when they are
  already stored.

### Fixed

- **You can see and edit a character's picture.** The People section opened collapsed
  behind a button, so the cast was invisible unless you knew to ask for it; and a role
  with no picture drew a blank grey box whose only control was an unlabelled refresh
  arrow. The section now opens with the work, and **the face is the button** — an empty
  one carries a picture mark, a filled one shows it on hover.

- **"Cast from TheTVDB" and "Cast from IMDb" moved to the fetch screen**, beside the
  metadata lookup, where the other two ways of asking a provider for something already
  live. They were inside the People section, two screens away from the button you press
  when you want a provider to fill something in.

- **Deleting a character you have also quoted now stays deleted.** It would have come
  straight back on the next read, for ever, with the delete button looking broken rather
  than declined.

## [2.2.7] - 2026-08-25

### Fixed

- **Edits made in the People section now reach the page.** The last release stopped that
  panel blanking the screen and, in doing so, made its "something changed" signal do
  nothing at all — so adding or renaming a character left the character dropdown, the film
  board's cast list and the line form's suggestions showing the old names until you reloaded
  by hand. The panel hands over the cast it has just reloaded, and the page is given a
  record carrying it.

- **The daily quiz card shows a book highlight's character.** The fourth read of that field
  to be found still dropping it, after three releases each swept three others.

- **The Quotes filter sheet had a missing label.** The control that filters by kind asked for
  a word that existed in neither language file, so on a phone it fell back to a stand-in.

- **Hearting a line on a film's board costs one round trip, not two.** The other two boards
  got that fix a release ago and this one was left out. The rule about when a refetch *is*
  still needed now lives in the module all three share, instead of being written out three
  times.

- **The demo library knows about kinds**, so the tour no longer shows an empty kind filter
  and a single unsorted pile.

- **An essay's source title is capitalised as a title**, not as a person's name.

## [2.2.6] - 2026-08-25

### Fixed

- **Correcting anyone in the new People section blanked the whole page.** Editing a character
  name, adding somebody or removing a row unmounted the film or book page and the dialog
  standing on it — a reload got it back, and nothing had been lost, but nothing said so. The
  panel was telling its host "something changed" through a callback that means "here is the
  new record", so the host was handed nothing and stopped rendering.

- **The actor's own editor closed the instant it opened**, which made "edit both actor and
  character images" unreachable from the section built for it: it closed on a signal the
  person panel also sends when it quietly fetches somebody's details for the first time.

- **A title that was already correct is no longer rewritten by editing another part of it.**
  Two more shapes of the same fault: "Set It Off (1996)" became "Set It off (1996)" because
  the trailing "(1996)" was counted as the last word, and "Bring It On: A Sequel" became
  "Bring It on: A Sequel" because a small word can *end* a clause as well as follow one.
  "Get Up, Stand Up" is right now too. A comma ends a phrase; it does not start one, so "The
  Lion, the Witch and the Wardrobe" is unchanged.

- **Hearting a quote costs one round trip instead of two.** The save already answers with the
  updated row, and both boards were throwing that away and refetching every row on the
  screen to learn what it had just said. The refetch stays exactly where it is needed — when
  the change moves the row out of the filter you are looking through.

- **The in-app help and the Quotes board no longer mention the field that was replaced.** The
  help still described filtering and grouping by "medium" in both languages, and a reader who
  had been grouping by it went on grouping by it — with a control beside them showing no
  selection, because the value no longer exists in the list.

- **A search result carries a quote's kind**, so nothing downstream has to go back for the
  row to find out what it is.

### Added

- **Set fields works on a selection of quotes**, not only works — the speaker of forty
  quotes, the chapter of forty highlights, the kind of every quote an upgrade could not
  read. That last one is why it is here: the switch from "medium" to "kind" leaves a pile of
  quotes to file, and one dialog each is not an answer. Each kind is offered only the columns
  it has.

- **A game's publisher can be set across a selection**, which the endpoint has accepted since
  the bulk editor was written and no control offered.

## [2.2.5] - 2026-08-25

### Fixed

- **Saving a person from the new People panel closed the whole work panel and threw away
  whatever else was open.** The person editor is a form, and it was being rendered inside the
  Details form — so pressing its Save ran both, and the outer one closes. With a field row
  open and changed at that moment it also wrote the record nobody had asked to write. A form
  now only answers a submit that came from itself.

- **A title that was already correct was rewritten by editing any other part of it.** English
  title case capitalises the last word however small it is, and 2.2.4's small-word rule did
  not — so "Bring It On" saved itself as "Bring It on", and "Set It Off" as "Set It off", the
  moment you fixed a typo elsewhere in the same field. No diff, nothing said.

- **The swap in the picture share did nothing at all with one person**, which is the case the
  request named. It was implemented by reversing the list, and reversing a list of one is
  that list — so the portrait went on entering from the left while the toggle claimed
  otherwise, and the preference it saved then reversed your *next* two-person card. It also
  only appeared in Backdrop mode, which is not the default; the chips honour it now too.

- **"The Wheel of Time" still could not be typed on the Film, Show or Game tab.** The fix
  reached books and both Details panels and stopped there, so the same record capitalised
  differently depending on which screen you opened it from.

- **Enter was dead in the cover-URL box and the person form.** 2.2.4's guard against Enter
  closing the panel was too wide and took the key away from the controls inside a nested form,
  which submit on Enter like any form. It now cancels only its own form's.

- **A character name typed into the People panel was thrown away by the tick.** The tick
  promises to commit what is open and close; a cast row saves through its own endpoint and was
  not included in "what is open".

- **A book highlight's character reaches Shuffle, On-this-day and an anthology.** Two server
  reads still dropped it — one of them selected an empty string where the film branch twenty
  lines below selected the column — so the card the missing name was first reported on was
  still showing it blank.

- **Signing out drops the daily deck.** It was cached for five seconds against the timezone,
  which two people on one machine share, so signing straight back in as somebody else could
  serve the previous reader's cards, count and streak.

- **A stray mouse-over no longer changes what Enter does in the character box.** Moving the
  pointer across the list on the way to the tick left a row highlighted, and Enter then
  replaced what you had typed with whatever the pointer last crossed.

- **The tag and genre box tells the phone keyboard to stay out of it**, like every other
  field that capitalises its own text. It was the last one still fighting it underneath.

- **A part-finished character-picture fetch resumes.** If the page refreshed mid-fetch the
  run stopped and marked itself done, so the pictures already downloaded were not shown
  either until the screen was reopened. The cap is also raised to cover a full provider cast.

- **A staged quote's kind shows on the approval line**, which still read the field it
  replaced — so an imported letter or essay showed nothing there.

- **A film's collection is called a Collection in the bulk editor**, as it is everywhere
  else; it said "Series", the other side's word.

## [2.2.4] - 2026-08-25

### Fixed

- **Pressing Enter in the new People panel closed the whole Details panel and threw the
  edit away.** Typing a character's name and pressing Enter — which is the obvious thing to
  do — added nobody and shut the dialog. Same for the character-picture box and the IMDb
  link box. Two changes in 2.2.3 that were each harmless did it together: the header tick
  stopped being greyed, which made it the form's default button, and a form with one is
  submitted by Enter from any text input inside it. Enter now does the local thing — save
  the row, add the character, apply the picture, fetch the cast — and a box added to that
  panel later inherits the guard whether or not anyone thinks about it.

- **"Set fields → Type" could turn every selected show and game into a film.** The
  dropdown offered "(none)" and the line under it said "Empty clears the field", but that
  column has no empty: the server reads a blank as *Film*. A field whose column cannot be
  cleared no longer offers a blank, no longer promises a clear, and will not apply until
  you have picked something. Every other field is unchanged — empty still clears.

- **A name is no longer rewritten by the rule that lets a title keep its small words.**
  2.2.3 made "The Wheel of Time" typeable by keeping English function words small, and
  applied that to every capitalising field — so "Nguyen Van An" came back "Nguyen Van an",
  and so did "Kim So Hyun", "Li In Ho" and "Park By Ul". Half those words are whole names
  somewhere else. Titles and series keep the small-word rule; a person's name goes back to
  the promote-only one it always had.

- **A phone's keyboard no longer capitalises underneath the app.** This is the other half of
  "the capitalisation happens in engine": the keyboard does capitalise, but the *page* tells
  it to, through the HTML `autocapitalize` attribute, whose default for a text input is
  sentence case. So on a phone the keyboard was promoting the first letter of every name
  field before any of the app's own rules ran — which is invisible until you try to type
  "bell hooks", and then the capital is already there and the app leaves it alone because a
  capital is somebody's decision. Fields that capitalise themselves now tell the keyboard to
  stay out of it. Notes and quotes keep sentence case, where it is exactly right.

- **Character pictures are fetched by the screen that draws them.** 2.2.3 fetched them when
  you opened a work's People panel, which is not where character faces actually appear — a
  film's board of lines is. It costs no request at all on a title whose pictures are already
  stored.

- **A quote's kind reaches its anthology caption.** The line under a gathered quote said
  `place · medium`, and every quote saved since the field changed had no medium — so half of
  that caption went quietly blank.

- **A bulk field value is trimmed**, like every other form in the app. A trailing space
  stored across a whole selection is a value that looks right, sorts right, and never
  matches the one you type next time.

### Added

- **A character's picture can be searched for from the panel**, the way a person's photo
  already could — searched by the role and the work, so "Amanda Waller Suicide Squad" finds
  the character in costume rather than the actor.

## [2.2.3] - 2026-08-25

### Added

- **A work's people, with both of their pictures.** Every book, film, show and game's
  Details panel has a **People** section: each character, who plays them, add, correct,
  remove — and the character's picture, which had been fetchable since 2.2.0 and had never
  been fetched. The plumbing shipped across three migrations and no screen ever called it,
  so a library could hold a full cast with a TheTVDB art URL on every row and show you
  neither. Opening the panel now asks for the pictures that are not local yet, one at a
  time. A role with none falls back to the actor's headshot, which is what TheTVDB's own
  site does.

  The character's picture belongs to the ROLE and lives on the cast row; an actor's headshot
  belongs to the PERSON and is shared by every work they are in — so the row shows both and
  the actor's name opens their own page for theirs. Changing Viola Davis's photograph changes
  it on every film she is in, and that has to be visible as such.

- **Cast from TheTVDB, on demand.** A film or show can re-pull its cast — and only its cast —
  from the id already on the record. Separate from "Re-sync everything", which also takes back
  the poster, the genres, the overview and the year: that is the right control for a wrong
  record and the wrong one for a right record with a thin cast, so a reader who has corrected a
  year by hand never pressed it and never got the character art either. Games have no TheTVDB
  record at all, so the button is absent for one rather than shown and refused; IMDb is what a
  game has, and that control moves in beside it.

- **Setting one field across a whole selection of works.** Pick several books or films, ⋯ →
  **Set fields**, choose a field and a value. The series on five books in one press. The
  action, the field tables and the overwrite warning had all been written; the bar simply
  never passed the callback, so the menu item was absent and nothing errored. The warning
  counts only what would be DESTROYED — a field that is empty across the whole selection
  says nothing at all, and a field with values says how many rows and how many *different*
  answers are about to become one.

- **The character box is a real dropdown.** It opens on focus with the work's own cast,
  filters as you type, and names the actor beside each part — so typing "robbie" finds
  Harley Quinn. Ten rows on a desktop, five on a phone. It still takes any name you type,
  including one the cast has never heard of. It was a native `<datalist>`, and what a browser
  actually DOES with one turns out to vary: desktop Chrome opens it only after a keystroke,
  so the box you open in order to be reminded of a name required you to remember it first.

- **The picture share can swap the people over**, and lines up more than two along the
  bottom like a team shot. Three faces used to lose one without a word — a card has two edges
  — and which way round two people should read is a judgement about the line, not something
  the card can know.

### Changed

- **"Other quotes" now say what KIND of thing they are, from a list of five**: speech, letter,
  essay, proverb, other. The free-text **Medium** box is gone. That field was one of the
  dimensions the Quotes board groups by, and grouping on something hand-typed gives you one
  shelf per spelling — "Speech", "speech" and "a speech" are three shelves holding one kind of
  thing, and nothing could tell you they were the same.

  **Nothing is deleted.** An upgrade reads your old mediums across wherever the word IS one of
  the five, folding case and spacing; anything else keeps its text and goes on showing on the
  card, under a kind nobody has set, so you can see what is left to file. It guesses at
  nothing — "radio" is not quietly filed as a speech, and "poem" is not quietly filed as an
  essay — because a synonym table is a silent reclassification of your library with no record
  of what moved.

  A quote nobody has filed says **nothing** rather than "Other": "other" is a decision, and a
  default pretending to be one is a claim the card would then make on your behalf. Exports
  write the kind, imports read it, and a file written before this release has its kind read
  off the old keys the same way an upgrade does.

- **The board picker on the quote form is called Board.** It was called "Kind", with a note
  beside it in the source saying that it was not one.

- **A highlight's character reaches the card and the share.** A book highlight has had a
  Character box for four releases and nothing showed what it held — not the library card, not
  the Home tile, not the share dialog — so the box read as a field that wrote nowhere.

### Fixed

- **A title keeps its small words small.** "The Wheel of Time" could not be typed: every name
  field capitalises as you type, so "of" was promoted while it was still the one-letter word
  "o", and the rule's own escape hatch then froze it as "Of". An English title's small words —
  the articles, the conjunctions, the short prepositions — now stay small anywhere but the
  first word and the word after a full stop or a colon. Type a capital yourself and it is
  yours, as before. Name particles are deliberately left out of the list: "Vincent van Gogh"
  and "Robert De Niro" are both correct, and any list that settled it would quietly rename
  Ursula Le Guin.

- **The tick at the top of a work's Details panel does something.** It was greyed with
  "Nothing to save" unless a row was open with an unsaved edit in it — which is not the state
  the panel is usually in, because every row saves itself. It now means *done*: it commits
  whatever is open and closes the panel. Nothing to save is not an error and writes nothing; a
  refused write leaves the panel up with your drafts and the reason on it.

- **The daily quiz is fetched once per load instead of twice.** It is the most expensive read
  in the app — it scans the library to build the quiz's wrong answers — and two parts of the
  screen were each asking for it: the badge that counts what is due, and the card that shows
  it. The second one is the one you sit watching. Measured on a library of 60 books and 1500
  highlights, the server answers a save in about two milliseconds and the deck in four, so
  what a slow-feeling edit is made of is round trips rather than work — and this was the one
  duplicate there was.

## [2.2.2] - 2026-08-24

### Fixed

- **Two of the eight cleanup rules could destroy real text when accepted, and no longer
  offer to.** `pronunciation` looks for two slashes with something between them, which is a
  fraction, a date and a URL path as often as it is IPA — so accepting it turned *"the ratio
  was 1/2 and then 3/4 of it"* into *"the ratio was 14 of it"*, and `https://example.com/path`
  into `https:/path`. `reference-mark` looks for digits welded to a word, which is a footnote
  index in `conscience12` and a **name** in `Apollo11` and `COVID19`. Both are still **found
  and still listed** — you can see them, and ignore them so they stop filling the list — but
  neither has an accept button, because there is no rewrite that is right more often than it
  is wrong. `space-before-punctuation` keeps its button and now refuses to act across a line
  break, which was joining two lines of a quoted poem whose second line began with a bracket.

  This is the risk the page's original "find, never fix" note was written about. The answer
  is not to fix nothing; it is that a rule earns an accept button only when its rewrite is
  safe on prose it fires on wrongly.

- **The Character box on a book highlight wrote nothing.** The payload had two `character`
  keys and the later one won, so the box added in this release was inert on every save from
  the highlight card and the table. Vite printed "Duplicate key" and the build carried on.

- **The rewrite is now marked where it changed**, in the same context and with the same
  guillemets as the finding above it, instead of printing the whole rewritten field
  unmarked — which in a long quote left you comparing two paragraphs by eye. The reply also
  stopped carrying the full text of every quote twice.

- **The accept-all-of-this-rule button is gone.** It was a press that could rewrite up to
  five hundred fields with their diffs scrolled past rather than read — the control the
  page's own design note argues against, one filter narrower — and it was not asked for.

- **The five fields a proverb, a letter and an essay carry are on the capture form too**, not
  only on the edit form. A letter's recipient is known when it is typed.

## [2.2.1] - 2026-08-24

### Added

- **Stray marks now offers the change, and remembers a no.** The page has listed what a
  page left in your quotes since 2.2.0 and fixed nothing, on the argument that every rule
  has a false positive that is somebody's real writing. That argument was against a
  *fix-all* button — one press over five hundred finds with no diff — and it still holds.
  What it ruled out too much of is the smaller control: **each finding now shows what it
  would become, right under what it is, and you answer it one at a time.**

  **Accept** rewrites that one field by that one rule; nothing else on the quote moves, and
  the server applies the rule itself rather than storing a string the page sent. **Ignore**
  takes the finding off the list and leaves the words exactly as they are — and the refusal
  is *remembered*, in a new table, so the finding that was your real writing is dismissed
  once instead of on every visit. There is an **Ignored** bucket to undo it from, and an
  **Accept every …** for a rule you trust, which touches only what is on screen.

  An ignore is remembered per **finding**, not per field: `reference-mark` can fire twice in
  one note, once on a footnote index that should go and once on a sentence that genuinely
  ends in a numeral. So accepting something else on the same quote does not revive it, while
  editing those very words does — correctly, because it is then a different question about
  different words. **No rule may empty a field**, whatever the reader accepts, and a
  correction that would collide with a quote you already keep is reported rather than
  written.

- **A game's line can finally say which act and which quest it is from, in the form you
  correct it in.** The edit form showed a **Timestamp** box for a game, whose value the
  server discards — a game has no runtime, it has an act and a quest, and those two are in
  its dedupe hash, so a bark reused in two quests is two quotes. The box is gone and the
  pair is there. (The capture surface got the same fix in this release.)

- **The five things a proverb, a letter and an essay carry are on screen at last** — a
  region, a recipient, a source title, a page, and whether the date is approximate. All five
  have been in the schema since 2.1, and their absence from the form was worse than a gap:
  every save from that screen is full-state, so opening a quote to fix a typo — or merely
  hearting it, or recolouring it — silently **cleared** whatever an import had put in them.

### Fixed

- **The Bengali-copy gate had never once read a file on the machine this is written on.** It
  built its path with `new URL(...).pathname`, which keeps the leading slash and
  percent-encodes — so on Windows, in a directory whose name has a space in it, it resolved
  to `/D:/Code%20Projects/...` and threw. With the walk fixed, its allowlist turned out to be
  dead too (`path.split('/')` never splits a backslash), so the three legitimate entries read
  as findings. CI is Linux with no space in the path, which is why it looked green throughout.

- **Every box that asks who said it, or where, now remembers what this work already
  knows.** The film page's edit form has offered a line's character from the work's cast
  since the cast existed; the ＋ Add surface — the form you actually capture a quote in —
  offered nothing, and a book offered nothing anywhere. So: the capture surface's
  **Character** box suggests this work's own cast (and shows who plays them, from the same
  rows), and a book's **Chapter #** and **Chapter name** boxes suggest the chapters its own
  highlights already name, commonest first. Choosing a chapter *name* fills an empty number
  box with the number you typed beside it last time — and never overwrites a number you
  have just typed, because a suggestion that edits your typing is the form arguing with
  you. New endpoint: `GET /books/{id}/chapters`, which answers the actual question in two
  columns instead of the old client-side approach of fetching every quote in the book to
  read a dozen strings out of it.

- **A game can finally say which act and which quest a line is from, and a show can name
  its episode.** Both columns have existed since 0047 and the capture surface had no box
  for either — worse, it showed a **Timestamp** box on a game, whose value the server
  discards outright, because a game is placed by act and quest and has no runtime. A game
  now gets Act and Quest and loses the box that was quietly throwing your answer away.
  A book highlight gets the **Character** box its column has been waiting for since the
  same migration: a novel has speakers, and until now the only ways to fill that field were
  a bulk edit and an import.

- **Cast from IMDb, once, when you ask for it.** Wikidata is the only structured free
  source for a game's voice cast, and it is empty for most games — The Witcher 3, Mass
  Effect 3, Persona 5 and Disco Elysium all return nothing. IMDb has them. So a film, show
  or game's details now carry a **Cast from IMDb** control: paste the IMDb link for the
  title you are looking at and its top cast is added, characters included.

  **One press is one request.** There is no preview step and no second fetch, no search, no
  crawl, and nothing calls this unless a person presses it. It takes a *link* rather than a
  title because a title search is how a cast lands on the wrong work — and a wrong cast
  reads as a correct one, since the quote form then offers you an actor from a different
  game. The server extracts the `tt…` id and builds its own URL; anything that is not a
  title id is refused **before** a request is built, so this cannot be pointed at a URL
  somebody else chose. The names you have typed or corrected are never overwritten — the
  row-level provenance rule from the cast work applies to IMDb unchanged, and a test pins
  it. IMDb's own terms prohibit bulk mining; their official datasets are the route for
  anything more than this.
- **The in-depth quiz controls and the Features card are buttons now, not columns of
  Yes/No.** Nine labelled rows, each with its own segmented switch and its own info dot,
  filled the quiz pop-up top to bottom — and the question they answered is a set ("which of
  these does the deck ask?"), which a lit chip states and a column of switches makes you read
  one line at a time. Same for the four Features rows. A locked one still refuses **in
  words** under the row, rather than only in a bubble you have to know to ask for, and the
  hand-rolled review-scope chips beside them now go through the same component — three copies
  of one widget, one of which had already shipped a bug.

- **Any quote can now say what it means, not just a standalone one.** A book highlight and a
  film or show line each carry a translation, the way a standalone quote has since 2.0.0. It
  is not the note: a note is what you thought about the line, a translation is what the line
  says, and until now the only place to put the second was the first — which meant the review
  deck prompted you with your own reaction, and a shared image printed it where the meaning
  should be.

  **It sits under the words and above your note**, on every card and in every language, in the
  quote's own type rather than the small capitals of the locator strip beside it.

  **You can search for it.** Type the English half of a Bengali highlight and the highlight
  comes back — the half you can actually type is the half you tend to remember. Translations
  share the quote's own results rather than arriving under a heading of their own, because the
  thing you want back is the quote.

  **It travels.** Exported into the Markdown file beside the quote, read back out of it on
  import, and carried through the staging queue in between, so the round trip keeps it. Files
  written by hand can name it `translation:`, `translated:` or `english:` on any kind of quote.

  Two things it deliberately does not do. A film records no language of its own anywhere, so a
  translated line says what it means without saying what it was said in — that is a field on
  the work, and it belongs with the rest of a film's metadata rather than bolted onto the quote
  form. And the quick capture surface still does not offer the box: it is the short form on
  purpose, and a translation is something you write once you have the line.

### Fixed

- **Hearting, recolouring or dragging a sticker on a highlight no longer erases who said the
  line.** Every save in Tippani sends the whole quote, and the character on a book highlight —
  added in 2.0.0 — was missing from what the card sent, so any of those small actions quietly
  dropped it. The same bug took an episode's title and a game line's act and quest off a screen
  line. Nothing reported it, because each of those saves succeeded and the field it dropped was
  one the card had no box for.

- **A standalone quote's translation now shows in search results too.** The search result card
  asked for a plain-text version of the quote's credit line, which never included it.

### Changed

- **The translation box is a text area on every kind of quote.** On a standalone quote it was a
  single line, which is a poor shape for a paragraph — and a translated passage is a passage.

## [2.2.0] - 2026-08-24

### Added

- **A quote now wears the face of the character who says it, not the actor who plays them.**
  A line is spoken by a character, so the picture beside it is the one in costume — Amanda
  Waller rather than Viola Davis. The actor is still named on the credit line a few words
  along, and their own page still shows their own face. Roles with no picture fall back to
  the actor's headshot, which is what TheTVDB's own site does, so a library with no
  character art looks exactly as it did.

  **Search shows whichever face you asked about.** Search an actor and the Actors section
  shows the actor; search a quote or a character and the face is the character's. Nothing
  guesses from what you typed — the results were already grouped by what matched.

  **Stats lists Characters beside Actors.** Neither list can be worked out from the other:
  one actor plays several characters, one character is played by several actors, and a book
  has characters and no actors at all — those rows were counted nowhere before.

- **A shared proverb now carries its translation.** A proverb is its own language plus what it
  says, so an image or a copied quote that held only the original was half the quote to anybody
  who cannot read that language. The translation now sits directly under the words, in the same
  type family, upright where the original is italic — and it is ticked by default, unlike the
  note. Untick it and you get the original alone, which is what you want when you are sharing
  to people who read it.

- **You can give a character your own picture, and it behaves exactly like a fetched one.**
  Paste a URL and it is stored on your instance and drawn wherever a character is drawn — the
  same column, the same fallback, nothing downstream able to tell the difference. It also
  survives every later metadata refetch, which the provider's own URL deliberately does not:
  a picture you chose is yours, and a re-verify has nothing truer to say about it. This is
  what makes a character on a game or in a book — where no provider has ever had art —
  work the same way as one on a film.

- **TheTVDB is now the first place a film or show is looked up, and it brings a picture of each
  character.** TheTVDB's records carry an image PER ROLE — Amanda Waller, not Viola Davis — and
  TMDB has nothing like it at any endpoint: a person there has one profile photo and a role has
  none. So the cast of a title fetched from TheTVDB now stores two pictures per credit, the actor
  and the character, kept apart rather than one overwriting the other. Putting the costume on the
  actor's identity would have shown them as somebody else on every other title they appear in.

  TMDB has not gone anywhere. Both sources are still searched, both sets of results are still
  offered, and every title you have already saved keeps the source it was pinned to — a pin is a
  decision, and a release is not entitled to overrule it. What changed is the order: TheTVDB's
  match is at the top of the picker now, so that is what a title newly added tends to be pinned
  to.

  **If you were already running Tippani, nothing about your library changes on upgrade.** The
  titles pinned to TMDB go on fetching from TMDB and will not have character art until you
  re-verify one. Settings → Metadata sources says how many are in that state, and stops saying it
  once you have worked through them. A brand-new install never sees that notice, because it has
  never had another default.

  Roles often have no image of their own even on TheTVDB, and there the actor's headshot is used
  instead — which is what TheTVDB's own site does.

- **Every book, film, show and game now owns a list of characters, and you can edit it.** Until
  now a film's cast was a blob of provider JSON with no edit surface anywhere in the app: a minor
  role the provider got wrong stayed wrong for ever, and a game had no cast at all — voice credits
  come from Wikidata, which has none for most games. So the quote form's "who says this" could
  never work on a game and could never be corrected on a film.

  Now the list is real. **A book's rows are characters with nobody beside them** — a novel has
  speakers, not a cast, and the server refuses an actor on one. **A game's second column is the
  voice actor**, the same column under a different word. Add a row, correct one, remove one.

  **A refetch never overwrites a row you have touched.** That is the rule the whole thing is built
  around and it is worth being plain about what it costs: a name you "fix" wrongly stays wrong,
  even if the provider later agrees with the truth — the way back is to delete the row and let the
  next lookup put it back. Deleting a row the provider supplied is remembered too, so the next
  lookup does not quietly hand it back to you. Anything you typed yourself is never touched at all.

  **The list fills itself in, and now it fills the quotes too.** Looking a title up seeds it from
  whichever provider you pinned it to, and every later lookup adds what the provider has started
  crediting without touching a word you wrote. The quote form's "who says this" reads the list, so
  naming a voice actor once names them on every line that character speaks — which on a game had
  simply never worked before, because there was nothing there to read. Films and shows behave as
  they always did, and an actor you typed yourself is still never overwritten. "Fill in the gaps"
  in the metadata console can seed a missing cast as well; it never could, silently. It leaves
  alone a list you have emptied on purpose, and no longer counts a cast it declined to write.

  **A photo now follows the name you corrected.** "Fetch the portrait" pins a person to a
  provider's own id taken from the cast of something they are in, rather than searching by name and
  risking the wrong same-name person. It read the old blob, so the two names it could not see were
  the ones you had fixed and every voice actor in every game — precisely the people it should have
  been most careful with. It reads your list now, with the id and the headshot from the row itself,
  and a game's Wikidata credit keeps its own identity instead of being swapped for a film actor who
  happens to share the name. A credit you deleted is not used as a source for anybody's photo.

  **Nothing you already had is lost and nothing is thrown away.** Every cast on disk is carried
  into the new list in the order it was billed, and the old blob is kept for one release — dropping
  a column is the one step nobody can undo by hand. Films and shows keep the actor stored on each
  quote exactly as before; it is still searchable, still faceted, still exported.

  **Merging a duplicate keeps the list, and so does an export.** Merging carries the characters of
  the copy you are discarding onto the one you keep — the voice actors you typed, the names you
  corrected, and the rows you deleted, so a lookup on the survivor cannot hand a deleted credit
  back. Where both titles name the same character the one you are keeping stays, and it inherits
  whatever protection the other had earned. The Markdown export writes the list into the file and
  a re-import puts it back with its provenance: a character you typed and have not quoted yet
  comes back, a correction comes back as a correction, and something you deleted stays deleted.
  Re-importing an older file never disturbs a list that is already there.

  **There is no screen for this yet, deliberately.** The work pages are being redesigned and the
  cast editor is part of that design. Until it lands the list is reachable over the API and
  through an import, and the words "actor" and "voice actor" ship in English and Bengali together
  with the screen that shows them, rather than sitting unused in the language files.

  **And the review deck's "who said this?" card reads it too, which it never did.** That card
  picks its wrong answers from the other people in the same title, and it took them from the
  provider's old cast blob — so a game was offered no voice actors at all, and a name you had
  corrected was invisible to it. It reads your list now. On a game that is the first time the card
  has had anything to work with; on a film it means the wrong answers follow your corrections
  instead of drifting out of date the first time you approve a lookup. A credit you deleted is not
  offered as a wrong answer, and neither is a character with nobody beside them — a name you
  cannot see is not a choice.

- **Settings → Stray marks: a list of what your quotes picked up on their way in.**
  A quote typed by hand is clean. One that arrived by selecting text in an ebook, a PDF or a
  browser brings the page's furniture with it — the footnote index that sat after the last
  word, the pronunciation gloss a dictionary printed beside a headword, the double space a
  justified line left behind, the soft hyphen that broke a word across two lines and is now
  inside it. None of it shows in a card, all of it is in the search index, and it is why a
  search for a phrase you can see sometimes finds nothing.

  Eight rules read every highlight, film line and standalone quote — the words, the note, and
  a standalone quote's translation — and each find is shown with the text around it and the
  find itself marked, because half of them have no appearance at all: a no-break space, a
  zero-width space and an ordinary space look identical otherwise. Filter by rule to work
  through one kind of decision at a time, and open a row to reach the work the quote lives in.

  **It reports and never fixes, and that is the design rather than a first step.** Every rule
  has a false positive that is somebody's real writing: a sentence may genuinely end in a
  numeral, a quote may genuinely contain a bracketed aside, and a character another language
  calls invisible may be load-bearing in yours — the zero-width joiner Bengali and Devanagari
  conjuncts need is deliberately not one of the characters flagged. A "fix all" button would
  edit your own words on the strength of a guess, silently, in a library whose whole point is
  that the words are yours. So names are never read either: a character, an actor or a speaker
  is short and usually picked from autofill, and "R2-D2" looks exactly like a footnote number
  to a rule.

  Like the bin, it is a page with one door — the tile in Settings — and no tab of its own.

- **A field per kind, reachable.** Every column listed below is now something the app will
  accept, store and give back, over every route that edits a quote: one at a time, in bulk over
  a selection, and through find-and-replace — so a misspelt character on four hundred highlights
  is one correction rather than four hundred.

  **None of it is on screen yet, and that is the whole of what is missing.** The add and edit
  forms are being redesigned; the selection bar's own list of offerable fields is unchanged, so
  it still offers the seven it always did and not the new ones; and find-and-replace has never
  had a screen at all. Until the redesign lands these fields are reachable through the API and
  through an import, and not by pointing at them.

  **A game's line is placed by its act and its quest**, which is what the help text now says
  and what the server now enforces: a game keeps no timestamp and no episode number, a film and
  a show keep no act or quest, and an episode's name belongs to a show. A line whose work you
  retarget is tidied on its next save rather than refused forever — the same forgiveness a show
  turned into a film has always had.

  **A book character is searchable**, in every place a film character already was: the search
  index, the `character:` filter, the counts beside it and the autocomplete that offers it — so
  a name that arrives on a highlight through an import is a name you can find.

  **And a board can be a board of letters or of essays**, alongside quotes, proverbs and
  speeches.

- **A field per kind, in the database.** Every type now has somewhere to put the fact it
  actually carries: a book quote has a **character** (a novel has speakers, not a cast — so
  there is no actor beside it), a game line has an **act** and a **quest**, an episode has a
  **name** as well as a number, a proverb has a **region**, a letter has a **recipient**, an
  essay has a **source title** and a **page**, an occasion can be marked **approximate**, and
  a book carries its **language** and its **original language** — which, oddly, it never has,
  while a standalone quote has since 1.14.

  **Every one of them survives the import queue too**, because a column that exists on the
  live table and not on the staged one is a field that survives the export, survives the parse
  and is dropped at the last step — the one place a loss is invisible, because the file is
  already gone.

  A book character and a letter's recipient and an essay's title are **searchable**; an act, a
  quest and a page are not, because they locate a quote rather than describe it and no locator
  in this app has ever been searchable. Region and language are offered as autocomplete
  instead, where a short list of your own words belongs.

  **The forms come next.** This release only makes the fields storable, so nothing new is on
  screen yet.

- **Text size, on a dial.** Appearance has a *Text size* control that sets every kind of
  text at once — 75%, 100%, 125%, 150%, 175% or 200% — and Type has one per kind, so quotes,
  interface, labels and notes can each be tuned on their own afterwards. Every size in the
  app answers them; there is nothing left that ignores the setting.

  **The global one renormalises rather than compounding.** Moving it to 150% means every kind
  is now at 150%, not that some other 150% is multiplied by it. Tune one kind afterwards and
  the global reads as an em dash, because there is no longer a single number that describes
  the four — it is worked out from them rather than stored beside them, so the two panels
  cannot disagree about what the size is.

  **Fixed before it shipped:** the dials wrote four preference fields the server did not
  have, so the setting applied instantly and was gone on the next load — a control that
  appears to work and quietly forgets, which is worse than one that fails.

  **Whole pixels at every step.** Nothing lands on a half, so there is no size at which the
  hinting goes soft on one screen and not another. The scale has ten steps and no 10px step,
  because 10 and 11 would both round to 8 at 75% and two sizes the design distinguishes would
  stop being distinguishable.

  Some sizes moved a pixel to sit on the scale — nine of the app's sizes were half-pixels —
  and ties went upward, so 14px is 15 and 10px is 11. Two things set at 7px and 8px are 9px
  now, which is the only reading size anything that small should have had.

  **The Type panel's specimens follow their own dial**, so turning Labels up grows the label
  specimen while the rest hold still.

- **The typeface picker is a dropdown you can type into.** It was a row of chips: three
  bundled faces per row, plus every font you have ever uploaded, wrapping onto three lines
  under a heading that already has a specimen above it — and no way to find a name in it but
  to read all of them. Type a few letters and the list narrows. Every option is still drawn
  in the face it names, which is the only question the list is asked.

  **Upload is its own button now**, beside the dropdown rather than inside it as a fourth
  chip among three typefaces. It is not a typeface; it is a way of getting one. And removing
  a font you uploaded is listed once, where the fonts are, instead of as a bin beside the
  same face in all six rows.

### Fixed

- **Editing one field across a selection of quotes.** The Quotes screen has offered to set a
  speaker, an occasion, a place or a medium over a whole selection since the selection bar
  arrived, and every one of those saves failed with *"speaker does not apply to this kind"* —
  the server and the screen had two different words for the same kind of quote. They now agree,
  and **clearing** one of those fields over a selection works too, which it never has.

- **A board of speeches can be created.** The *Speeches* starter on the Quotes page has been
  offering to make one since 1.15, and the database refused the kind it was sending — so
  pressing it failed with a server error. A board's kind is now checked by the app rather than
  frozen into the schema, which is also what lets **Letter** and **Essay** join it, and what
  will let the next kind arrive without a database change.

- **A game's shelf menu no longer offers to mark it as *watched*.** It said "Mark as watched"
  for any game that was not, at that exact moment, being played — so a game you had never
  started, or had paused, or had given up on, was offered the film's word. The wording is
  asked of the work now rather than guessed from the state it is leaving, which also fixes the
  mirror case: a film that still carried a game's status was being offered "Mark as played".

  The same wrong headline appeared on the date dialog that confirms finishing something, and
  it is right there too.

- **Three more places called a game something it is not.** The bulk shelf dropdown over a
  Catalogue selection offered games "Watching" — the right action under the wrong word, since
  the server was already filing each row by what it is. The blue in-progress badge on a game's
  artwork announced itself as "Currently watching" to a screen reader. And the dialog that
  stops you starting a fourth thing at once read "Already Watching 3 · the shelf holds 3 films
  at a time", with a button offering to mark a game as watched.

  **And one that was not about games at all.** The colour bar under every film and show
  announced itself as "Reading — 40%". The function that names a shelf state defaulted to the
  book wording and nothing was passing it a kind, so the two media that are watched rather
  than read have been describing themselves wrongly to a screen reader for as long as the bar
  has existed.

### Changed

- **Tooltips wait to be asked.** They appeared on the frame the pointer arrived, which reads
  as the app answering a question nobody put — crossing the top bar to reach ＋ passes over
  five controls and fired five labels on the way, each one a flash of text where you were
  about to look. A pointer now has to rest on a control for four tenths of a second. Leaving
  before that, or pressing the control, cancels it, so nothing arrives after you have gone.

  Tabbing to a control still answers immediately: there is no passing over something with a
  keyboard, so there is no intent left to test and a delay would only be a pause between the
  press and the answer. The long press on a phone is unchanged.

## [2.1.3] - 2026-08-22

### Added

- **The app now tells you where your translations go, by putting the folder there.**
  `data/Locales/` is created on start with `_TEMPLATE.txt` in it: every string in the app,
  empty, each with up to three comments — what the key is for, the English, and the Bengali.
  Copy it to `fr.txt` (or `ta.txt`, or `pt-br.txt`), fill in what you like, save it, and your
  language is in Settings → Language at whatever percentage you have reached. No rebuild, no
  restart, no container to replace.

  This existed as a script in the repository, which is no use at all to somebody running the
  image: the folder did not exist, nothing on any screen named it, and the file listing the
  keys was in a checkout they had never made. The template is rewritten whenever the app's
  own strings change, so it is never a stale list — copy it rather than translating in it,
  and the leading underscore is what stops the app reading it as a language.

  **One bug came out with it.** A language file over 512 KB was silently ignored, and the
  finished Bengali is 493 KB — so anyone overriding a built-in, or filling in this template,
  would have had their work skipped with nothing said. The ceiling is 4 MB now.

  **Two files claiming one language are handled rather than refused.** The language code is
  the file name, so `FR.txt` and `fr.txt` are the same language — one of them used to be
  dropped silently, which meant you could edit the wrong file forever and watch the app
  ignore every change. The exact lower-case name wins now and the log says which file was
  passed over (`TIP-LOCALE-001`); nothing is deleted or altered. And two languages that give
  themselves the same name — `fr` and `fr-ca` both "Français" — are told apart in the picker
  by their code instead of appearing as two identical rows.

### Changed

- **The rubber texture no longer has a seam in it.** Every accent-filled control on the film
  skin — primary buttons, the ＋ Add pill, the user chip, toggle thumbs, active filter chips —
  wears a rubber grain, and its tile did not quite meet itself: the joining edge was about
  twice as strong a step as any other, so a faint line repeated every 130 pixels across all of
  them. The replacement tile meets itself to within a rounding error. It is also flatter, so
  the grain reads more quietly than it did; that is the direction the whole texture set is
  moving in.

- **Language marks moved to Metadata sources.** It was a pop-up off Appearance; it is a
  pop-up off the Metadata card now, under the credit separators. Where a mark is *drawn* is
  a matter of appearance, which is what put it there — but what it *says* is a fact about the
  quote: a proverb has nobody to credit, so its card leads with its language instead of a
  face, and that is the same question the rest of that card answers. Nothing about the panel
  itself changed.

### Fixed

- **Back means back, everywhere, and the two Backs agree.** The back arrow at the top of a
  work's page — and on a quote board, an anthology, the Bin — went *forwards*: it added a
  history entry instead of consuming one, so the stack read shelf → book → shelf and your
  phone's back gesture returned you to the book you had just left. The arrow now hands the
  press to the browser, which means both run the same code and cannot drift apart again. If
  you arrived on a page directly — a shared link, a bookmark, a reload — the arrow rewrites
  the address in place instead, because there is nothing behind it and going back would leave
  the app.

  **And every overlay now closes on that gesture** rather than navigating the page behind it:
  the settings panels, every edit form, the Add surface, the filter sheets, the nav drawer,
  your account page. Full-screen cover view has done this since covers became openable; it
  was the only thing that did.

- **A book you skipped is skipped again.** Skipping a work has taken its quotes out of the
  Daily Quiz since 1.11.1, and 1.15.0 changed *how*: the deck stopped reading the book's flag
  and started reading each highlight's own, so skipping a book became a write across its
  highlights instead of a filter in a query. Every path that skips a work does that write
  correctly — and nothing ever went back and did it for the books that were **already**
  skipped when the change landed. Their highlights had never needed the flag.

  So they returned to the quiz, silently, on upgrade. The book kept its own mark, the edit
  form kept its state, and every screen went on agreeing the book was skipped; the deck was
  the only surface that disagreed, and the deck never explains why it chose a card. A restore
  of any backup taken before 1.15.0 lands in the same state on a current build.

  A migration writes it once, in one direction — a skipped work stamps its quotes, an
  unskipped one clears nothing, so a line you skipped by hand inside a book you did not skip
  stays skipped. **One thing it cannot preserve:** if you skipped a whole work and then put a
  single quote of it back in the deck, that quote is skipped again, because in the data it
  looks exactly like the rows this repairs. The control that put it back still works.

## [2.1.2] - 2026-08-22

### Added

- **Each anthology now decides what its passages show.** Six switches on the anthology
  itself — who said it, where it came from, the chapter/page/timestamp, the day you saved
  it, your commentary, and the colour bar. A collection of film lines can name its actors;
  a book of proverbs can carry nothing but the words. One global preference could not say
  both, which is most of the reason to want it.

  **What you see is what you export.** The same switches drive the reading view and the
  Markdown file, because an export that quietly differs from the screen is a surprise you
  only find in a file you already sent somebody. Two of the six — the locator and the date —
  were never shown anywhere before, so they are off by default, which means an anthology you
  have never configured exports exactly as it did before this existed.

- **An anthology can be practised as a deck.** The review engine has been able to run a
  round over one anthology since 2.0.0 and nothing could ask for it: the query parameter was
  dropped on the way out and no screen had the button. Both fixed — Practise sits on the
  anthology page, before Edit, and a mixed anthology of book highlights and film lines
  practises as one deck.

### Changed

- **A shuffled quote now looks like something worth having found.** It was the words, a
  colour bar and a small-caps caption — the plainest card in the app, on the one surface whose
  whole job is to make you glad you kept something. It now carries the cover or poster of
  where the line came from, the badge for its kind, the credited people as faces you can tap
  through to their panel, its tags, and the same copy · share row every other quote surface
  has. *On this day* draws the same card, so it gained all of this too.

  Two of those were wrong rather than merely missing. The caption printed the **actor**, so a
  line from Casablanca was credited to Humphrey Bogart and never to Rick Blaine — the name
  you are actually looking for. And there was no cover at all, so a library full of posters
  showed none of them here.

  Copy, share and ♥ work from the card and produce exactly what the same quote produces from
  its own screen — they fetch the full record first rather than sharing a summary of it, which
  is the difference between two payloads that match and two that match until one is edited.
  There is no edit form on it: this is a reading surface, and it knows where the quote lives.

### Fixed

- **A shuffled quote credited each actor twice.** The card drew a row of faces and
  then the same people again underneath with their names on, so a two-hander like
  *Roman Holiday* showed four portraits for two actors. One face each now, with the
  name beside it.

- **Three more places printed a key instead of the words.** The Metadata console's
  people rows showed `vocab.source.wikipedia.label` where a link chip should say
  *Wikipedia*, and the Catalogue's group-by menu listed five keys instead of *None ·
  Collection · Director · Decade · Genre*. Same cause as the three fixed above: a
  table holding keys, drawn without asking the resolver for the words — in one case
  by the desktop control while the phone control three lines away did it correctly.

- **The language menu offered a third thing that was not a language.** A translator's
  proofing mode — every string accented and bracketed, so untranslated text stands
  out — sat under the two real languages calling itself `⟦Pšëüðö··⟧`. It reads as a
  broken build. It is still there for whoever is checking a translation, reached by
  asking for it directly rather than by being offered to everyone; English and
  Bengali are what the app ships, and any further language arrives as a file you drop
  in.

- **The whole interface speaks Bengali now, not most of it.** Eight screens and nine
  Settings cards were still English at their call sites whatever language you chose —
  the Metadata console, the pending-import queue, the bin, Profile, the import wall,
  re-verify, the cover picker, the people panel, and Settings' updates, changelog,
  onboarding, devices, backup, restore, key fields and metadata cards. All of them are
  translated, 3,223 keys in each language, and Bengali is still complete rather than
  dropping to a percentage.

  **A test holds it now instead of a comment.** Every screen is mounted under the
  pseudo-locale — a mode that accents and brackets every string that came from a
  language file — and any plain English left on screen, including in a tooltip, a
  placeholder or a screen-reader label, fails the build. The three keys that used to
  print on screen as `nav.section.library.what` could not have been caught any other
  way: a key rendered raw is a real key, so every check that reads the source thought
  it was fine.

  **Bengali labels are drawn in the face you chose.** Small-caps labels — the bin's
  *keep for*, a diff's column heads, the shortcut sheet's headings — had no Bengali
  font in their stack, so they fell through to whatever the operating system reached
  for, in the middle of typography you had picked every other part of.

  Four smaller things fell out of the pass and are fixed: the People console said
  *"5 undefineds still need photos or links"* over a list of studios; an empty studio
  list drew an empty message with nothing in it; a single-quote title read *"1 quotes"*;
  and the re-verify summary ran two numbers together as *"9 up to date· 2 skipped"*.

- **Three places printed the key instead of the words.** The shortcut sheet's five
  headings, the three lines of microcopy under *Settings → Features*, and the three
  media chips in *Settings → Daily quiz & practice* all rendered a locale key on
  screen — `shell.shortcut.group.anywhere.label`, `nav.section.library.what` — in
  every language, English included. All three held the key in a table and drew it
  without asking the resolver for its words; in each case the very same table was
  being read correctly somewhere else in the same file, which is what made it
  survivable. The headings had been the key for as long as the sheet has existed.

  A test that scanned the whole of Settings rather than the one card the report
  named is what found the third of them, and the shortcut heading's own test had
  been passing for the wrong reason — it filtered on the English word *Go to* after
  that value had become a key, matched nothing, and asserted that an empty set had
  been removed.

- **Two dialogs had never opened.** *Settings → Daily quiz & practice → In depth* and
  *Search → Filters* both did nothing at all when pressed. The dialog primitive took an
  `open` prop with no default and rendered nothing without one, and these two call sites
  mount the dialog only while it is wanted rather than keeping a hidden instance around —
  so there was no `open` to pass and the answer was always nothing. React does not warn
  about this and the surrounding code reads correctly, which is why it lasted: the only
  symptom is a button that looks broken.

  Everything behind both doors was already right and had been all along. The in-depth
  panel's question toggles, its eight scheduling sliders, its refusal to accept a ladder
  that does not climb, and its *Back to defaults* all work, and the rules it enforces have
  been checked against the server's own copy by a test that was green the entire time —
  for a panel nobody could reach. Mounting a dialog now counts as opening it.

- **A Kindle's own clippings file could split one book into two.** The device writes a
  byte-order mark before each record's title — not once at the top of the file, but every
  time it appends — and the parser trimmed only the leading one. The rest stayed glued to
  the title, so *The Idiot* imported from the device and *The Idiot* imported from a JSON
  export were two different books whose titles differed by a character you cannot see.
  Every BOM is now dropped, wherever it appears.

  The same file also carries the case the device makes when you extend a highlight in
  place: it re-appends the whole record, leaving a truncated copy and a whole one at the
  same page. That collapse already worked — it is now pinned by a test, along with the
  invariant that no two quotes at one position may be prefixes of one another.

- **An IMDb quotes page for a video game imported as a film.** IMDb carries quotes for all
  three of the kinds the shelf knows, but the parser only asked whether the title was a
  series — a game is not, so it fell through to *movie* and landed on the film shelf. It
  now reads the title's type.

  Two other places had to learn the same word. A hand-written or round-tripped file saying
  `type: game` was ignored by the Markdown reader, and the import path folded every value
  but *show* back into *movie*, which cancelled whatever the parsers had worked out. Games
  have been a media type since 2.0.0; this is the rest of the sweep.

## [2.1.1] - 2026-08-19

### Added

- **Bengali — the whole interface, in one voice.** All 2,447 strings, written against a
  style sheet rather than translated key by key. Modern চলিত, not the literary register
  software Bengali drifts into; আপনি, with the pronoun dropped wherever Bengali would drop
  it; and one settled word per idea — a book highlight is a **দাগ**, a film line a **সংলাপ**,
  a standalone quote an **উক্তি**, with **উদ্ধৃতি** as the umbrella over all three. টিপ্পনী is
  reserved for the app's own name, because *টিপ্পনীতে ১২টি টিপ্পনী* is not a sentence anyone
  can read.

  Pick it in Settings → Language. Both languages are compiled into the binary, so neither is
  the other's fallback of last resort and no missing config directory can leave you with an
  interface in no language at all.

  58 strings carry a `# ??` or `# !!` note in `internal/i18n/bn.txt`, marking where the
  wording is a judgement call or is fighting the space it has to fit. They are comments, and
  they are there to be argued with — the file is yours to edit, and `data/Locales/bn.txt`
  overrides it per string without a rebuild.

### Fixed

- **The stats calendar stopped cutting month names in half.** Its x axis took the first
  three characters of the full month name — three letters in English, three UTF-16 code
  units everywhere else. In Bengali এপ্রিল came out as এপ্, a hasant left dangling with
  nothing to join, and অক্টোবর as অক্. Ten of the twelve months happened to survive the cut,
  which is why nothing looked wrong. The axis now uses the twelve written abbreviations the
  date picker was already using, so the two can no longer disagree — and where a word may be
  shortened is now a fact each language states for itself, which is the only place that fact
  can live.

- **The Shuffle button stopped jumping when you press it.** On Home it sat centred until you
  used it, then moved to the left edge — because the press itself was what switched the
  layout. On a phone that is the width of the screen away from where your thumb was, and it
  reads as having missed. The layout now depends only on what the page loaded with.

- **Every log line was printed twice.** In a container `docker logs` merges stdout and
  stderr, and the app was writing every line to both — so a NAS paid double the log volume
  and you read a doubled log. Now it splits the conventional way: everything goes to stdout
  except errors, which go to stderr. `2>/dev/null` gives you a clean operational log;
  `1>/dev/null` gives you nothing but failures.

  The old behaviour existed so that a deployment capturing only one stream still saw
  everything. The split costs that, and it is worth stating: if you capture **only** stdout
  you will no longer see errors. That is the bargain every other program on the box already
  makes, and the doubling could not be detected and disabled automatically — Docker hands
  the process two genuinely separate pipes and merges them downstream, so from inside they
  look like different destinations.

  Warnings stay on stdout, deliberately: a warning is something that happened, not something
  that failed, and putting it on stderr makes "show me only what went wrong" noisy with
  things that did not.

## [2.1.0] - 2026-08-19

### Added

- **Anthologies: an ordered set of quotes with your own writing between them.** An
  introduction, then each passage with a paragraph of your commentary before it — drawn from
  books, films and standalone quotes at once, and held in the order *you* chose rather than
  by date or title. Make one, read it, move entries up and down, and export it as Markdown
  that imports back with its order and every paragraph intact.

  **It starts switched off.** Settings → Features has the switch, and unlike the Library,
  the Catalogue and Quotes it defaults to off, because most libraries never hold one.
  Turning it off later takes away the tab and nothing else: the anthologies stay, the URL
  still opens, and turning it back on finds every one where you left it.

  Entries move with **Move up / Move down** rather than by dragging. A drag with no keyboard
  path is a control half of you cannot use.

- **Tippani speaks two languages, and will speak any language you write a file for.** A
  language picker in Settings and on the first-run screen, with English and Bengali in the
  box. Every string in the interface now lives in a plain text file — `key = value`, one per
  line — and both languages ship the same way. Neither is the "original"; neither is the
  other's fallback.

  **Adding a third takes no code.** Drop `data/Locales/fr.txt` into your data directory and
  French appears in the picker, labelled with whatever `_name` you gave it. A generated
  template lists every key with the English and Bengali beside it, so there is something to
  fill in rather than a blank page. Translate as much as you like: **the picker shows how
  complete each language is**, an unfinished one falls back rather than breaking, and a
  language can name which other language fills its gaps before the built-ins do.

  Files in your data directory override what ships — including the English — so any word in
  the app is yours to change without rebuilding anything. A mangled line costs you that one
  string and nothing else.

  Bengali is scaffolded but not yet written in this release, so it reads 0% in the picker,
  which is exactly what showing coverage is for.

### Changed

- **The `?` panel is something you can scan.** Every entry now opens with one sentence that
  answers the question, and the rest of it — the reasoning, the caveats, the exceptions — folds
  behind a **more** you press only if you want it. The visible copy went from 49,738 characters to
  19,732, longest entry from 1,911 to 200. **Nothing was deleted**: 28,831 characters moved behind
  the fold, and a test now caps what is on screen so it cannot creep back.

  **A rail down the side lists every screen**, so the panel is no longer a dead end — it opens on
  the screen you pressed `?` from and the rest is one click away, instead of behind a different
  screen's `?` button. On a phone the rail is a row of pills above the words.

  **Pictures where a picture is shorter than a sentence.** The colour-category entries show your
  own six swatches, live — your names, your colours, not a screenshot of somebody else's. Import
  shows the queue as a diagram, because the one thing worth knowing is that nothing reaches your
  library until you approve it. And the two gestures the app has — long press, and swiping the
  drawer closed — are drawn rather than described.

  The gesture clips are drawn abstractly on purpose: a fingertip, a trail, a ring for the wait. So
  they cannot go out of date when the interface changes, and they stop moving if you have asked
  your system for less motion — holding the pose rather than vanishing.

### Added

- **A chapter has a number and a name, and they are separate fields now.** Both optional and
  independent: a numbered novel fills the first, an essay collection or a book of scripture the
  second, and a book that gives its chapters both gets both. The number takes a decimal, because
  12.5 is where an interlude or an appendix goes.

  One field was holding two facts, and the interface had already admitted it — the capture form's
  placeholder said "e.g. 3" under a label reading **Chapter**, so it was asking for a number and
  filing it as a name. Sorting a table by chapter put 10 between 1 and 2, and each screen guessed
  differently whether to caption a row "CH. 3" or just "Envoi". Now the number sorts as a number,
  every screen captions it the same way, and an export writes one heading per chapter — `## 7 · The
  Fall` — that re-imports with both halves intact.

  **Nothing you already have was touched.** Every existing chapter stays exactly as you typed it,
  in the name, with the number left empty until you fill it in. Splitting "3. The Fall" into a 3 and
  a name would be right most of the time and wrong for a chapter called "1984" — and a wrong value
  written by an upgrade looks like something you did. The one exception is a re-import: a file whose
  chapter was simply "3" comes back as the number 3, because there the heading really is
  unambiguous.

### Changed

- **No keyboard shortcuts printed on a phone.** The drawer stopped repeating `G then L` beside
  every row, hover labels stopped spending half their width on a key ("Search · /" is "Search"
  again), the quiz buttons and multiple-choice options lost their key caps, and the `?` sheet —
  which is nothing but keys — no longer opens. A key cap is an instruction, and an instruction
  nobody can follow is clutter on the narrowest screen the app has.

  **Nothing was unbound.** A keyboard attached to a phone or a tablet still works exactly as it
  did; only the reminders go, which is the same shape as hiding a section in Settings → Features.
  It reads the one breakpoint the whole shell already swaps on, so a desktop window narrowed past
  it loses the reminders and keeps the keys.

  The keyboard entry in the `?` help also moved out of the Search screen, where it had somehow
  been living, into the list the app shows only to readers who have a pointer — so on a desktop it
  now answers from every screen, and on a phone from none.

- **The first colour category is called "Default" rather than "Uncategorised".** It is the colour
  a quote gets when nobody picks one, and where every import with no colour lands — so in most
  libraries it holds more quotes than the other five together. Naming it after what it lacks made
  all of them read as filing you had not got round to. Nothing is waiting: reaching for no
  highlighter is an answer, and the commonest one. Only the label changed — the stored colour, the
  exports and the imports are untouched.

### Fixed

- **A refused ISBN now says which mistake it was, and ten-digit ISBNs are named as welcome.**
  The answer to every bad ISBN was "invalid isbn", which is equally true of a 14-digit number, a
  stray letter, an ASIN pasted into the wrong box and a single mistyped digit — four mistakes with
  four different fixes, and the commonest of them (wrong number of digits) was the one the message
  hid completely. Each now gets its own sentence, in the Book details form and in a metadata
  look-up alike.

  Ten-digit ISBNs were always accepted and converted to the thirteen-digit form the app stores —
  but the field's own help called it "the 13-digit book identifier", so the number printed on any
  book published before 2007 read as unsupported. The help now says both lengths are fine, hyphens
  and all, and what happens to the shorter one.

- **Skipping a book in the quiz now holds when you import into it again.** Mark a reference
  manual "Skip in quiz", import your clippings a week later, and its new highlights were back in
  the deck — which is the one book where that is guaranteed to happen, because you excluded it
  *because* you keep adding to it.

  A work's opt-out reaches its quotes as a write rather than as a filter, deliberately: a
  highlight barred from the deck by a flag that was not on it made the control that clears its
  own flag report an outcome that never happened ("back in the quiz", on a card the deck still
  refused). The price of that is that every path which puts a quote under a work has to write the
  work's answer onto it. Capturing one by hand did. **Importing did not** — one column missing
  from one `INSERT`, for books and for films alike.

  **Merging carried the same hole**, found while checking the rest of them: re-pointing one
  edition's highlights into another quietly refilled the deck from a book you had taken out of
  it. It travels one way only — excluding propagates into an excluded target, and including never
  propagates out of an included one, because a quote you personally put back in the quiz inside a
  manual you otherwise skip is an answer a merge has no business erasing.

## [2.0.0] - 2026-08-18

### Added

- **Turn off the parts of the app you do not use.** Settings → Features has a switch each for the
  Library, the Catalogue and Quotes. Turn one off and its tab goes from the tab strip, the ☰ drawer
  and the phone's bottom bar, its count tile goes from Home, its chip goes from Search's scope row,
  ＋ stops offering that kind, and its row goes from the `?` shortcut sheet. Not everybody keeps
  films, and a tab for something you have never used is a permanent invitation to an empty screen.

  **Hiding takes away doors, not data.** Nothing is deleted, nothing is disabled, no search narrows
  and no quiz changes. The URL is untouched, which is what makes that checkable: `/catalogue` still
  opens, a bookmark from last year still works, `G` then `C` still goes there, and the review deck
  still asks you about film lines you saved. Turn it back on and everything is where you left it.

  **A link from a quote to its book is not a door.** With the Library hidden, a favourite on Home
  still opens the book it came from — what it loses is the tile whose only job was "go to the
  Library". Muting the thread from a thing to its source would strand four thousand highlights to
  spare somebody a tab.

  **One section has to stay.** An app with none has no list to stand in and no ＋ that offers
  anything, which is a broken screen rather than a preference — so the last switch left on is
  disabled, with the reason written beside it rather than hidden in a tooltip a phone cannot show.

- **Keyboard shortcuts, and every one of them written on the button that does the same thing.**
  `/` searches, `N` captures a quote, `?` opens the help sheet, and `G` then `L`, `C`, `Q` or `S`
  goes to the Library, Catalogue, Quotes or Stats. In a quiz, `1` and `2` grade and `Space` reveals
  a flip card.

  There was no shortcut registry at all before this — the biggest single desktop gap in a text
  app with a large library. There is one table now, and the tooltip reads from it: bind a key and
  the button that shares its job starts saying so; change the key and the button changes with it.
  A shortcut nobody can discover is a shortcut for the person who wrote it.

  Typing is never a shortcut. `N` is "capture a quote" and also the fourteenth letter of a note
  somebody is writing, so a key pressed inside any editable field — including a rich-text one — is
  just a letter. Two keys are never bound to one action, no single key is also the first key of a
  sequence, and `?` and `/` stay separate because one is Shift-ed and the other is not.

  **The keys are drawn as legends, not just described.** `?` opens a sheet listing every one
  of them, grouped, with a key cap beside each; the drawer prints `G then L` on the row that goes
  to the Library; and the quiz's own buttons carry `1`, `2` and `Space`. All of it is generated
  from the same table the handler reads — a legend maintained by hand is a legend that is wrong
  by the second release.

  **Go to** reaches Metadata (`G` then `M`), your profile (`G` then `P`) and Settings (`G` then
  `,` — S is Stats, and ⌘, is what everybody already reaches for).

  **A quiz card answers to the keys for the kind of question it is asking.** `1`–`4` pick an
  answer on a multiple choice; on a flip card `1` and `2` grade it and `Space` reveals it; on a
  fill-in-the-blank `Space` puts the caret in the blank. Binding `1` globally to "Forgot" would
  have meant pressing it on a four-option question graded the card instead of answering it — a
  keystroke that silently marks you wrong.

  **Practice asks for `Shift`.** The two decks show the same card with the same buttons and are
  not the same act: the daily deck *is* your schedule and its grades are permanent, while Practice
  is study. Running through Practice with the daily keys in your fingers should not be able to
  move a schedule by reflex, so the mode with lower stakes is the one that costs an extra finger.
  A key pressed with the wrong modifier does nothing rather than doing the right thing anyway.
  Every legend shows the form for the mode you are actually in.

  **Nothing is listed that does not work.** The first draft of the table also bound a command
  palette, `J`/`K` to move through a list, `F` to favourite, `E` to edit and `U` to undo — every
  one a key with no handler behind it. Since the sheet and the tooltips both read the table, an
  entry in it is a promise printed on a button, and five of them would have been promises the app
  does not keep. They come back when something is wired to them, and a test now fails if an
  unwired one is added.

  The review keys live with the card rather than in the global listener: a grade only means
  something to the card in front of you, and they are gated on exactly the conditions the buttons
  are, so a key and a button can never disagree about whether a card is answerable.

- **Find and replace across a selection, previewed before it runs.** Fix a typo, a doubled space
  or a stray running head across four hundred rows at once.

  **The preview is the feature, not a courtesy.** This is the most destructive bulk operation in
  the app and the only one whose damage is invisible afterwards: a wrong bulk tag is a tag you can
  see and remove, and a wrong replace has rewritten the words — which are the thing this app
  exists to keep. So it is two endpoints rather than one with a flag, and the preview shows the
  before and after of every row it would touch.

  **No regular expressions**, deliberately: `.*` is one keystroke from `.` and would empty every
  quote in the selection. Literal text with optional case-matching and whole-word covers the
  actual complaints and cannot express "delete everything". An empty search is refused outright —
  it matches at every position, so it would thread the replacement through every character of
  every quote, and it is the easiest thing to ask for by accident by leaving a box blank.

- **The access log says who.** Every request line already carried method, path, outcome, duration
  and a request id tying it to any error lines beneath it; it now names the account too. On a
  multi-user instance that is the difference between "a request failed" and "this account's
  request failed", which is the question an operator actually has.

- **Anthologies — the API and the file format, not yet a screen.** An anthology is an ordered set
  of quotes with your own writing between them: an introduction, and a paragraph of commentary
  before each passage. It can draw on books, films and standalone quotes at once, and it keeps the
  order you chose rather than a date or a title, which is the thing a tag shelf cannot do.

  **Nothing in this release looks different, and that is deliberate rather than an oversight.** The
  endpoints are live, a review deck can be themed on one anthology through the API, and
  `type: anthology` is a Markdown format the importer now understands — so an anthology exported
  from one instance re-imports into another with its order and every paragraph of its prose
  intact, and importing the same file twice rebuilds the same anthology rather than a second copy
  of it. What is missing is the screen: there is no button anywhere that opens one. That is next,
  and it arrives switched off — Settings → Features gets a fourth entry, because an ordered
  reading document is not something everybody wants a tab for.

  **What a round trip loses, said plainly rather than left to be discovered:** every entry comes
  back as a standalone quote. The file carries the attribution — the work, and who is answerable
  for the words — but no ISBN and no film record, because an anthology is a reading document and
  not a copy of your library. Re-importing one into the library it came from is not what it is for.

### Fixed

- **A game credits its studio and its publisher separately, and they are not the same company.**
  *Mass Effect Legendary Edition* read STUDIO Electronic Arts. EA published it; BioWare made it.

  A game had two company credits and one field to hold them, so both suppliers wrote the
  developer where the record named one and *fell back to the publisher* where it did not. That
  trade was reasonable while there was a single column — a blank studio is worse than a slightly
  wrong one — and it stopped being reasonable the moment the fact had somewhere else to go. A
  field labelled STUDIO naming a company that did not make the game is not the interface being
  vague, it is the interface stating something false in the present tense.

  So the publisher has its own column, the fallback is gone, and a game whose record names only a
  publisher now shows a publisher and an empty studio — which is what the source actually said.
  The studio keeps its portrait chip and its People page; the publisher is plain text after it, as
  `PUB.`, because it has no page to open and a clickable name would promise one. Both are
  editable by hand, in the Details panel, the Add form, and across a selection in the bulk
  editor, and both survive an export and come back on re-import.

  **The tie-break is where the reported bug actually lived.** IGDB lists involved companies as
  flag pairs in no meaningful order, and a label that owns the studio it published through is
  routinely entered as developer *and* publisher — which is how "the first company flagged
  developer" picked EA while BioWare sat further down the same list flagged developer alone. The
  company with the narrower claim wins now. It never turns an answer into a blank: a studio that
  publishes its own game is named in both fields, because both are true of it. Wikidata gets the
  same rule, and its studio logo is read off the company the name came from rather than the first
  developer statement — otherwise the icon and the credit beside it could describe two different
  companies.

  **Nothing was backfilled, deliberately.** Every game saved before this holds either its
  developer or its publisher in one column and nothing records which, so guessing would write the
  same wrong fact into a second field and give it the authority of having been migrated. Re-fetch
  a game under Fetch metadata and both fields come back split; a re-sync overwrites the publisher
  rather than preserving it, which is what makes the re-fetch a remedy. Publisher is not in the
  search index: a fourth column on the films FTS table means dropping and rebuilding the virtual
  table and all three of its triggers, which is the most dangerous shape in this schema, and
  nobody asked to search by publisher.

- **Changing a setting no longer moves your default board.** The shelf a standalone quote lands on
  when nothing names one is a preference pointing at a row — and every save on the Settings screen
  was deleting it. An accent swatch, a theme switch, the review sliders, anything: the key went, the
  app quietly fell back to your *first* board, and the next quote captured outside a board was filed
  there instead. Nothing failed and nothing said so; the only visible symptom was a quote turning up
  on a shelf you did not choose.

  The cause is how the preferences row is written. `PUT /auth/me/preferences` loads the stored set,
  overlays the fields the request actually carries, and marshals the whole preferences struct back
  over the row — so a key that is not a field on that struct is a key the read drops and the write
  never restores. The default board is written from *outside* that handler, both by the migration
  that introduced boards and by the code that repoints it when you delete one, and it was not a
  field. It is one now, carried through the save and still not settable by any client: it points at
  a row, so a value off the wire would be an unchecked reference to somebody else's board.

  **Not fixed by preserving unknown keys.** Merging the incoming set into the stored row instead of
  marshalling over it would have covered this key and every future one — but the deliberate
  behaviour of that struct is that retired keys are dropped on the next save, which is what keeps a
  years-old browser from resurrecting a setting this version no longer has. One field is the
  narrower fix and it leaves that alone.

## [1.16.0] - 2026-08-17

### Added

- **Search facets you can see.** The facet grammar shipped in 1.10.0 complete on every layer —
  parser, chips, vocabulary, SQL, URL round-trip — and the only thing on screen that said so was one
  placeholder string, gone the moment you typed a character. Using facets meant having read that
  line, remembered it, inferred that its trailing "…" meant more fields than the three named, and
  guessed which. On a phone it sat over a keyboard that had just covered half the screen.

  There is now a **Filters** button beside the scope chips, opening a panel with every field, every
  value your own library uses, and — printed on each group rather than left to be discovered —
  whether a second pick narrows or widens.

  It adds chips; it does not add a second grammar. Pressing a value calls the same code typing one
  does, so the two cannot disagree. That is the rule `facets.js` opens by stating, and a panel
  building its own query object would have broken it one file away instead of one process away.

- **Every facet value says how many hits it would give.** `Austen · 12`, under the search you are
  actually running — not a count of your whole library, which would print a number beside a value
  that yields nothing under the chip already up.

  Which narrowing applies while counting a field is decided by the same rule that decides what a
  second chip does. Two tags narrow, so the number beside a second tag is how many wear **both**.
  Two authors widen, so the number beside a second author is what allowing them **as well** would
  give. Count them the same way and one of the two is a lie: make it all-narrow and every unpicked
  colour reads 0 for ever, which looks broken exactly when it is working.

  A zero goes **grey and stays pressable** rather than disappearing. A value that vanishes when you
  narrow leaves you wondering whether you mis-remembered your own shelves; a grey one says "not
  under this question", which is the answer and points at the chip to take off.

  These were deliberately left out when the panel shipped, on the grounds that they were fifteen
  queries per value per field. That was a bad estimate of a design I had not worked out: it is one
  grouped count per field, on its own route, so the panel pays for them and typing does not.

- **`book:` and `movie:` are grammar now, and the dropdown pages.** Both fields were deliberately
  untypeable, on the reasoning that "there is no vocabulary of titles to offer". A library *is* a
  list of its own titles, the list is no longer than the author list already being sent, and `book:`
  is the most obvious thing in the box to reach for — it was the one field that answered by doing
  nothing. Typing `book:` now offers your books, `movie:` your films, shows and games.

  The chip reads the title and the wire carries the id, because two editions, a translation and the
  film of the book can all share one name. The menu shows five at a time with a **More** row: five
  is what fits above a phone keyboard, and a menu over hundreds of titles that you can fall down is
  not a menu.

  The cost, said plainly: `the book: of the new sun` now reads as a facet. That is the trade
  thirteen ordinary English words already made in 1.10.0, and it has the same way out — `book\:`
  searches for the words.

- **Speaker discovery — find the character, not just the line.** Searching a character's name lands
  in its own **Characters** section: the name, how many lines, and all of them. `character:` joins
  tag, author, actor and the rest as a facet, and the name on any dialogue card is now a button that
  narrows the search to everything that character says.

  Character search has worked since 0003 — `dialogues_fts` has always indexed the column. What was
  missing was anywhere for a match to *land*: it arrived as a bare line under the film it came from,
  so "everything Tyrion says" meant reading six posters and assembling the answer yourself. Actors
  have never behaved that way, and that asymmetry was never a decision — it was the absence of this
  section.

  **No portrait, and that is deliberate.** Every other credit section resolves to a person with a
  photograph. A character resolves to nobody, and showing the actor's face would answer a question
  nobody asked — wrongly, the moment a part is recast or shared. Games needed nothing: a game is a
  Catalogue row, so its lines were covered from the start. There is a test saying so anyway.

- **In-depth quiz controls, with a way back.** Which questions each deck asks is yours to set now,
  per deck, behind one button on the Daily quiz & practice card. Until this release the repertoire
  was a constant — the only thing you could say about the review loop was how many cards and which
  medium, which is a strange place to stop in the one part of this app with no equivalent elsewhere.

  The card keeps the two settings you change once: deck size, and what it covers. Everything else —
  the question types, adaptive intervals, whether Practice counts, the confirm step, the seeing
  multiplier — is behind **In-depth controls**, with **Back to defaults** at the bottom that resets
  all of it rather than most of it.

  **Three things it will not let you do**, because each fails silently: the daily deck cannot be
  made self-marking (1.15.3's decision, which handing over the repertoire would otherwise have
  handed back by accident); an unrecognised question type is dropped rather than rejected, so a
  backup from a newer build still restores; and no deck can be emptied. That last one is sharper
  than it sounds — "Who said this?" only applies to a line of dialogue, so a deck holding only that
  is not empty and is empty for every book you own. The switch that would do it is held, with the
  reason beside it, instead of being accepted and quietly undone.

- **Start a themed round from the work you are looking at.** "Quiz me on this book", on the
  book's own page, and the same for a film, show or game. The engine has taken a work id since
  themed practice shipped and it was wired from a person's panel and a colour tile on Stats —
  and from nowhere on the one screen that is entirely about a single work.

- **Edit a whole selection, field by field, and merge two titles into one.** Books gain
  translator, editor, year, description and favourite; the Catalogue gains type, year,
  description and favourite; quotes gain their note and their whole locator.

  Everything except the one thing that names the row. A work's title and a quote's own words
  are not editable over a selection: every other field can sensibly hold one value across five
  records, and a title cannot — setting it does not correct five, it destroys four and leaves
  five nothing can tell apart. The supplier ids are out for a harder reason: each is unique per
  row, so a bulk set is a constraint violation rather than a bad idea.

  Each field warns before it overwrites, and says how many rows and how many **different**
  values are about to become one. A field that is empty across the whole selection says nothing
  at all — filling a blank cannot lose anything, and a warning on every field is a warning on
  none.

  Films, shows and games can be merged too, which books have been able to do since duplicates
  became findable.

- **Every number behind the schedule is yours.** The multipliers a right and a wrong answer move
  a half-life by, the extra credit a typed answer earns over a multiple choice, the point at
  which a blank may hide more than one word, and the ladder's three rungs. All of them were
  constants, which made the review loop the one part of this app whose behaviour was an opinion
  you could not disagree with.

  They are bounded rather than free, and the bounds are the feature: a correct-answer multiplier
  below 1 shortens a card every time you get it right, so a quote you know perfectly gets asked
  more and more often, for ever. That does not look broken — it just is.

- **Exact phrases.** `"to be or not to be"` is one phrase now instead of six words in any order.
  A quotation mark you did not close is not an error: the words simply search loosely.

- **A date range, not just a day.** "What did I save in the first half of last year", as two
  chips.

- **Shuffle, and On this day.** One line at random, and what you saved on this date in other
  years — both on Home. Neither touches your schedule: landing on a quote by chance is not
  answering a card, and there is a test that shuffles eleven times and counts.

### Fixed

- **Games are not films.** Every game report in one place: the Details page said Type "Film" with
  no way to correct it, called its studio a Director, offered three film ids and not the one that
  works, fetched covers at 90×128 and stored them that way, said "Search TMDB & TheTVDB" on a
  game, looked studios up in Open Library, asked when Electronic Arts was *born*, and the
  Catalogue's back button still said "Movies".

  The cover one is worth singling out: the details fetch always asked for the full size, so only
  covers picked from the **search strip** were tiny — which is why it looked intermittent rather
  than broken.

- **Labels that go away.** A hover label closed when the pointer left and on nothing else, and
  the pointer leaving is not a promise — the control re-renders, a panel opens over it, a row
  reflows, and the label sits there for the rest of the session. Three seconds, wherever it was
  opened from. Info dots are unaffected: one you have clicked is meant to stay until you click
  it again.

- **Copy and share on a favourite, this time actually.** 1.15.3 said these moved onto the collapsed
  tile. The row was added and it drew nothing, for every favourite that came from a book.

  Home asked the action registry what could be done to a favourite and passed the favourite's own
  kind. A favourite of kind `book` is a highlight *out of* a book — but `book` is what the registry
  calls the book itself, and copy and share are gated on exactly that distinction, since a work has
  no words of its own to put on a clipboard. So the list came back empty, and an empty tools row
  renders as nothing at all, which looks precisely like a row nobody has added yet.

  Library and Catalogue never hit it: they name the kind literally. Home was the only screen
  deriving it, and the only one that could get it wrong.

### Changed

- **Five more shipped items left the roadmap**, on the same rule as 1.15.3's eight: the page opens
  by promising that nothing shipped is listed on it. §1 was still offering the manifest shortcuts
  and file handlers, the app-icon badge, and a rotating quote on the login screen — all three
  already in the tree, the first one described almost field for field. §3 was still listing **field
  operators** as future work fifteen releases after they shipped, and **highlighting the matched
  words**, which the search screen has always done.

  The field-operators entry is the one that matters. Somebody who could not find facets in the
  interface and went to the roadmap to check was told, twice, that they did not exist.

  Two entries that were **wrong rather than stale** were corrected instead of removed. "Saved views"
  claimed the filter state is "already serialised into the URL in full" — it is not; the path is all
  that is pushed, and every filter lives in local storage. So the real first half of that item is
  putting the filter state on the URL, and it is not a quick win. "Neighbouring highlights" cited
  `locSortVal` as though it were reusable; it runs in the browser over rows already fetched, and
  adjacency needs the whole book ordered on the server.

- **A character match no longer appears under the film it came from.** It appears under the
  character. Dialogues answers "these words matched"; Characters answers "this speaker matched". A
  search that hits both still gets both.

## [1.15.3] - 2026-08-17

### Fixed

- **The IGDB key can be entered now.** Games have needed a Twitch client id and secret since 1.15.1,
  and Settings → Metadata sources had no field for either — so a game lookup returned 503, the Add
  sheet said "no IGDB key configured", and the screen it sent you to had nothing on it to fill in.
  Two rows now, beside the TMDB and TheTVDB keys, each saving on its own.

  Everything behind them already shipped: the endpoint has accepted `igdb_client_id` and
  `igdb_secret` since that release and reports the two halves *separately* — its own comment says it
  does so "so the Settings card can point at the half that is missing". It was pointing at a card
  that did not exist. Games were the one feature in the app whose key could only be set by editing
  the database.

  **Half a pair now says so.** IGDB authenticates through Twitch, so one field alone fails at the
  token exchange with "invalid client" — which arrives as a lookup failure, telling you games are
  broken when the truth is that one box is blank. With *neither* set the card says nothing, on the
  rule that removed "Untested" in 1.15.2: an instance with no games in it is not misconfigured.

- **Copy and share are on a favourite without opening it.** They were inside the expanded tile, so
  the two things you most often do *with* a favourite cost a tap to unfold it first — on the one
  board in the app that exists to hold the lines you liked most. Every other quote surface puts them
  on the resting card; Home now does too, hidden until hover on a desktop and standing on a phone.
  The ♥ and the colour dots stay behind the expander, because un-hearting takes the tile off the
  board and a mis-tap there is destructive in a way copy is not.

- **A work's own page can start a search on a phone.** The top bar's Search has always landed scoped
  to whatever you were looking at, the open book or film included — but on a phone the detail bar
  replaces that top bar, which left the one screen where "find another line like this" is the
  obvious next thing with no way to ask it. It is in the ⋯ menu now. Desktop needs no entry: the
  bar is still up there.

### Changed

- **The roadmap stops listing what has shipped.** Its own opening paragraph says nothing shipped is
  listed there, "because a roadmap that doubles as a trophy cabinet stops answering the only
  question it is for" — and eight items were doing exactly that. Seven were carrying a "Shipped in
  1.15.0" line inside the backlog (cloze review, undo the last answer, themed review, editing from
  inside a card, leech handling, the flip card, "who said this?"), and *Trash & undo* was still
  described as "the piece the rest of the app is waiting on" two releases after the bin shipped.
  They are gone; the changelog is where they live.

  What stayed, and why, since the point is that this is a judgement per item and not a sweep:
  *merge two films or shows* is still open (`POST /books/merge` exists, the catalogue side does
  not), and *a source with no key should read as inactive* asks for a greyed-out entry in the
  lookup picker, which is more than the warning line 1.15.3 added.

### Added

- **Games fall back to Wikidata when IGDB cannot answer.** Games were the only medium in the app
  with no floor under them: books need no key, films run on a shared built-in TMDB key, and a game
  needed a Twitch application before it could be looked up at all — so the medium with the highest
  setup cost was the only one that answered 503 and told you to type it in yourself.

  It is a floor and not a second opinion: it runs when IGDB is unconfigured, refused or erroring, and
  is never consulted while IGDB is answering. It is also thinner, and says so — a Wikidata game
  usually arrives with no cover art, because game art is not freely licensed — so the candidate is
  tagged with its source and the picker shows which record came from where. It still finds the
  studio, the year, the genres and the franchise, and where the record carries an IGDB slug it can
  still fetch the voice cast.

### Changed

- **Language marks offer a script, not a country.** The tray used to lead with two dozen flags. The
  reasoning was that offering is not mapping — nothing in the code ever said which flag belonged to
  which language — and the reasoning held while the screen did the thing it was defending against: a
  grid of flags at the top of a language's tray is a recommendation whoever wrote it, and it made
  the picker a geography quiz whose right answer did not exist.

  Each language now offers **four letters of its own script**, and below them sits a bar of **your
  own marks for that language** — up to four, where a typed flag, symbol or emoji lands and stays,
  so choosing it again next month is a tap rather than a hunt through a character map. The whole row
  opens the tray, where it used to be a 22px disc beside a name you could not press. You can add a
  language the built-in ten never heard of, and rename any of them — call Bengali "বাংলা" if that is what
  you call it. The rename is a display name only: the language stored on every quote is untouched,
  so nothing is orphaned and an export still round-trips.

- **"Hide" now hides.** Button labels has three settings and the most explicit one was partly
  ignored: a handful of buttons opt out of the collapse — primary submits, destructive confirms —
  and they kept their words whatever you chose. Those opt-outs are the app's defaults about which
  words are worth the room, and they still stand under **Auto**, which is why Auto is the
  recommended setting. They no longer stand over a reader who has answered the question themselves.

- **The Daily Quiz no longer asks a question it cannot mark.** The flip card — read the quote, reveal
  the source, tell it whether you knew — is gone from the daily deck. Nothing checks that answer and
  it moved the same schedule as a graded one, which made the streak and the accuracy figure a mix of
  earned and self-awarded that could be read as neither.

  It stays in **Practice**, where it is the default and where being honest with yourself is the whole
  exercise; turn Practice scoring on and it drops out there too. Nothing is lost from the daily on a
  small library, because the card that fills the no-distractor hole is the **fill-in-the-blank**,
  which needs no distractors either — one quote from one book is a complete graded question.

- **A blank is one word until the card has earned a wider one.** A three-word hole in a quote you met
  yesterday is not a harder version of the same question; it is a worse one, with too little of the
  sentence left to reason from. The blank widens once a card's half-life reaches the 30-day rung —
  a quote you demonstrably know, where widening it is the only way left to ask more.

- **A harder question is worth more.** Picking the right book out of four is recognition with three
  quarters of the work done for you; typing the missing words back is recall with nothing to lean on,
  and both used to move the schedule by exactly the same amount. A fill-in-the-blank now pays 25%
  more when you get it right and costs 15% less when you do not — the second half being what makes
  it fair rather than generous, since failing the hardest question in the deck is weak evidence that
  you have forgotten the quote.

## [1.15.2] - 2026-08-17

A settings pass: one crash, one chip nobody could act on, and three screens that were showing their
working instead of doing their job. No schema change and no migration.

### Fixed

- **Changing a language's glyph no longer takes the screen down.** Opening the tray under any row of
  Settings → Language marks threw `Field is not defined` and blanked the page — the "or type one"
  box was rendered from a component the file never imported. Because the reference sits inside the
  branch that opens the tray, the module parsed, the bundle built and the page loaded; the error
  waited for the one click the card exists for.

  The check that was written for exactly this class of bug watched it go past. It reads every screen
  for a component used in JSX and absent from the imports, and it was scoped to glyphs — `Icon*` —
  on the grounds that glyphs are the ones passed as props and buried in branches. They are not the
  only ones. It reads every capitalised tag now, and it is fed the broken shape directly so a clean
  tree cannot pass it for the wrong reason.

- **"Untested" is gone from Metadata sources.** It appeared under the heading of every freshly
  started server, because the flag behind it is unset until the first book lookup of that process's
  life. It sounded like a warning, described no fault, named nothing to do, and cleared itself the
  moment anybody used the app. "Lookup failing" stays — that one is worth interrupting for.

### Changed

- **Type and Language marks are two buttons on the Appearance card, and a pop-up apiece.** Both were
  full cards standing open in the settings grid: six type roles with a specimen, a face picker and a
  row of style chips each, and a row per language with a tray of two dozen flags behind every one.
  That is a lot of screen, permanently unrolled, for choices most readers make once — and both are
  questions about how the app looks, which is what the card above them is for.

  The panels themselves are unchanged. They lose their card frame and their heading, which the
  dialog now carries, and each button wears a glyph: a serifed **T** for Type, and two letterforms
  from different scripts for Language marks. Deliberately not a globe or a flag for the second one —
  a flag is a country and a language is not, which is the decision that panel exists to make visible.

- **Settings → Onboarding no longer lists what the tour covers.** It offers **Replay the tour**,
  which now has a glyph, and **Refresh one section**, which opens a picker: choose a section and the
  tour opens on that screen and carries on from there.

  The card had tried twice to be a table of contents. It started as a dozen two-line rows, which
  pushed the start button off a phone screen; the blurbs went behind info dots, which left a dozen
  names each trailing a dot. Either way it was a list you could not press, sitting above the one
  button that did anything, answering "is this covered?" — and nobody opens Settings → Onboarding
  asking that. They open it having forgotten how one screen works. Same list, same source, but
  choosing a name now does the thing the name suggested.

- **The Review covers chips are named after the screens they draw from** — Library, Catalogue and
  Quotes, where they said Books and Films & shows. The nav strip two inches away has always called
  them that, and a setting that renames the reader's own screens makes them work out which is which.
  The second label had also gone quietly wrong in 1.15.1: the Catalogue holds games now, and a game's
  lines have always joined the deck through that chip. The stored values are untouched — they are a
  wire format the server parses, and renaming them would empty the deck of every account that had set
  one.

- **The Type panel no longer explains why there is no monospace switch.** Whether a face is
  monospaced is still how it was drawn, there is still no switch for it, and "Lining figures" is
  still the real thing behind the request — but the Labels row said so every time it was opened, to
  everybody, as an answer to a question they had not asked and could not see the subject of. The
  reasoning lives in `fonts.js`, beside the style table it is about.

- **The Metadata console's speaker remap is pinned on games.** It already worked on one: a game is a
  `movies` row, its lines are `dialogues` rows, and neither the remap nor the console's listing has a
  media-type filter anywhere in it — which is the payoff `0040` predicted rather than an accident.
  Nothing tested it, though, so the first `AND media_type <> 'game'` added to either query would have
  dropped games out of the picker in silence. Two tests now say otherwise, in the medium that had
  none.

## [1.15.1] - 2026-08-17

**This release carries a schema migration (`0040`).** It adds one column and a third media type;
nothing existing is rewritten and no data is touched, but the database is upgraded on first start and
an older binary will refuse to open it afterwards, which is the usual forward-only rule. Take the
backup you would take for a minor release.

### Added

- **Games, as a third kind of title in the Catalogue.** Films, shows and now games share one board
  and one type filter; the Games chip appears once you have a game, and a films-only catalogue looks
  exactly as it did. A game's credit is its **studio** where a film's is its director — the same slot
  on the page, with the studio's logo where a face would be — and a game is **played** rather than
  watched, so it reads *start playing* and *played*, with three in progress allowed against a film's
  two.

  There is no `games` table and no new nav tab. A game is a third `media_type` on the same table TV
  shows were folded into, which is why search, stats, the bin, backup, restore, export, the review
  deck and the import queue all understood it without being told.

- **Game lookup through IGDB, with the voice cast from Wikidata.** One Twitch client id and secret in
  Settings → Metadata sources gets you cover art, the studio and its logo, the year, genres and the
  franchise. Nothing else is required to keep a game — manual entry works with no key at all, as it
  does for films.

  **The cast is honest about being thin, and that is the feature.** IGDB has no person endpoint and
  no credit endpoint; MobyGames exposes none; Giant Bomb returns an unroled list; IMDb has the data
  and no API. Wikidata is the only free structured source there is, and of 24 well-known titles
  checked it had a usable cast for ten — Skyrim has 66 credits, Elden Ring 9, and The Witcher 3,
  Mass Effect 3, Persona 5, Disco Elysium and BioShock have none at all. So a game with no credits on
  file shows a **blank you can type into**, not a lookup that reports success and displays nothing.
  Voice-cast photos need no key, because they come from Wikidata too.

  The game is pinned by IGDB **slug** rather than matched by title, because a fuzzy title search
  picked *Hades II* for "Hades" while this was being measured, and a wrong cast on a right game is a
  defect that reads as correct.

### Fixed

- **Renaming a film director no longer risks rewriting a game studio.** Both live in the same column,
  told apart only by media type, and three separate queries read it unfiltered — the rename, the
  orphan sweep, and the Metadata console's director list, which would have offered every studio in
  the library for renaming as a director. This is the third appearance of a hazard the code already
  carried a twenty-line comment about; it is now an invariant over the SQL rather than a comment.

- **Two invariant tests were passing without testing anything.** The pair that assert every person
  kind has a reference query and a rename mapping both claimed to be "kept in step by construction"
  while carrying hand-written lists — one covered six of six kinds, the other four. Adding a seventh
  would have sailed past both. They enumerate the vocabulary itself now.

## [1.15.0] - 2026-08-15

### Added

- **The review loop asks five kinds of question instead of two.** A card is drawn from a per-kind
  table now rather than from a two-way toggle, and the table is the feature: *which work is this
  quote from?* and *which quote is from this work?* are joined by a **flip card** (read it, reveal
  the source, say honestly whether you had it), **fill in the blank**, and — on a film or show line
  — **who says this?**, where the options are the **actors** out of that film's own cast rather than
  the characters.

  One consequence is worth stating plainly rather than letting it arrive as a surprise: "which book
  is this quote from?" drops from half of a book's cards to a quarter, and "which film?" from half
  to a fifth. That is a real change to every existing account and it is a decision, not an emergent
  property of how long a list happens to be.

  The flip card also fixes a deck that served nothing. A question that could not be built used to
  drop its card while the badge went on counting it, so a library with one work in it showed cards
  due and served none — and the test covering that asserted the empty deck as correct. A flip card
  works for every quote, so there is now nothing to fail at.

- **Fill in the blank, graded on the server, word by word.** A phrase is masked out of the quote and
  you type it back. The answer never reaches the browser until your attempt is in — unlike an option
  index, which means nothing without the options, a cloze answer *is* the words being recalled.

  Grading forgives a typo in a long word and nothing at all in a short one: "vast" and "fast" are
  different words, not a slip. **Each word carries its own budget and the word count has to match**,
  because a budget banded on the whole answer is earned by the long words and spent on the short
  ones — before that was fixed, "want of a wife" accepted "want of a **life**" and said correct.

  Offered only where the text is predominantly Latin. The stopword list that decides what is worth
  blanking is English, and an English list matches *zero* Devanagari or Cyrillic tokens — so every
  token reads as a content word and the selector confidently masks a phrase out of a script it
  cannot read. That gate exists because the failure is silent, not because the span comes out badly.

- **A confirm step, instead of the undo the roadmap asked for.** Optional, off by default: a tap
  chooses an option and a button commits it, so a misplaced tap can be corrected instead of costing
  a rung. Undo needs the previous half-life stored, which is a column this section is built on not
  having; this prevents the misclick rather than reversing it. Not offered on flip or cloze cards —
  typing an answer and pressing Check is already a submit step, and a confirmation on top is asking
  twice.

- **A card forgotten five times offers a way out.** `lapse_count` has been stored since 0015 and read
  by nothing. The card now says so **once you have answered it** and offers *Set it aside* beside
  *Keep asking*. Nothing is suspended automatically: a card that vanished because a counter reached
  five would be the app making a decision nobody asked it to make. It arrives with the answer that
  earns it, because that same answer pushes the card a week out of the deck.

- **Quiz me on this book, tag, colour or person.** A themed round starts from the thing itself — a
  work tile's own menu, a person's panel, a tag card, and the colour rows in Stats — and opens over
  the screen you were on. There is no "pick a theme" screen: you are already looking at the book when
  you want to be asked about it.

  **The Daily Quiz is deliberately not themeable.** That deck *is* the schedule. Filtering it would
  leave the cards actually due unasked while the streak still counted the day as cleared, which
  quietly turns the one authoritative surface into a second practice mode.

- **Fix the typo, re-tag it, or ♥ it from inside the card** — and only after you have answered.
  That gate is the feature rather than a nicety: an edit form carries the quote, the title and the
  credit, which on a "which book?" card *is* the answer, and on a cloze card is the masked words in
  full. The panel reads the whole row and sends the whole row back, because every one of those saves
  is full-state and a field left out is a field an edit to the words silently blanks.

- **Choose the type.** Settings → **Type** lists the six faces the app uses, each shown doing its own
  job — the quote face setting a quote, the label face setting a locator, the Bengali face setting
  Bengali. A list that sets the same specimen sentence in every face answers no question anybody has.

  Each row offers the built-in and **two alternates**, plus **your own font**: uploaded to your own
  server, never parsed there, checked by magic bytes rather than by extension (a `.woff2` that is
  really a ZIP is exactly what an extension test misses). A check then measures whether the face
  actually draws that row's script — swap the Bengali face for one with no Bengali in it and every
  Bengali quote turns into boxes, silently. It is a **warning, not a refusal**: it can be fooled
  either way, and it is your font.

  **Bold, italic, small caps, all caps and lining figures** are per role. There is no "monospace"
  switch, and the screen says why: whether a face is monospaced is how it was drawn, and no CSS makes
  a proportional face monospaced — so a control by that name could only lie. Small caps and all caps
  are absent from the Bengali and Devanagari rows, which have no case at all.

  Everything is bundled with the app. This app makes no network request you did not ask for, and a
  type picker that phoned a font CDN would have been the first exception — on a screen about how your
  own words look. Eighteen families, all OFL-1.1.

- **A proverb wears its language where every other quote wears a face.** A proverb has nobody to
  credit, so its card used to begin with nothing while every other quote begins with somebody's
  portrait. It leads with a **language mark** now — a letter from that language's own script by
  default, and a flag or anything else you can type, set per language in Settings.

  **No language arrives wearing a flag.** The tray offers two dozen of them, first; what the app does
  not do is decide. A flag is a country and a language is not — Bengali is spoken either side of a
  border, Hindi has no flag of its own, and Spanish, Portuguese, Arabic and English have a dozen each
  — so picking one for you would be this app saying which country owns your mother tongue.

- **One quote by id** — `?id=` on `/annotations`, `/dialogues` and `/quotes`. What a client needs
  before it can edit a quote it only holds a review card for.

### Changed

- **The Bengali face changed, and Hindi's with it.** Tiro Bangla was chosen in an earlier release for
  a reason I still think is a fair one — a text face with real Bengali letterforms rather than a
  pan-script fallback — and the person who reads Bengali in this app called it horrible, which is the
  only evidence that counts about type you have to read every day. **Noto Serif Bengali** and **Noto
  Serif Devanagari** are the built-ins now. Both previous faces are still on the list: reversing a
  choice is not the same as deleting it.

- **Skipping the quiz is a fact about a quote.** It was two flags that both gated the deck, and the
  second one made the first one lie: a highlight excluded on its own account *and* by its book got
  an *Add to quiz* button that cleared its own column, toasted "back in the quiz", and changed
  nothing the deck could see. The deck reads the quote's flag and nothing else now; a work's toggle
  writes that flag onto every quote it holds, and a work wears the mark only when all of them are
  skipped.

- **Select all**, in the context menu on a phone and beside it on a desktop — the same helper behind
  the work tiles, the quote cards and the boards, instead of three copies drifting apart.

- **Move a quote between boards from the card menu and from the selection bar**, instead of opening
  the edit form and changing one select in it.

- **A board's own cover**: a mic and an audience for speeches, a script glyph for a proverb board's
  dominant language, the Tippani mark for everything else — over the colour you chose.

- **API revision 7.** `cloze` and `speaker` get their own feature strings rather than riding on
  `review-directions`, because a client has to be *built* for a cloze card — masked text, no options,
  an `attempt` to send, and a grade the server decides — where a flip card only needs a reveal button.

### Fixed

- **The daily deck's "seeded" options were never seeded.** The deck's whole contract is that today's
  cards are the same cards, in the same order, with the same choices, on every device — and the
  comment saying so had been there for releases. The pool underneath came from Go map iteration,
  which is deliberately randomised, and a SQL `RANDOM()`. The same card offered different wrong
  answers on a phone and a laptop, and nothing anywhere reported it.

- **Three answer leaks, two of them live in the shipped app.** The review card rendered the
  attribution side — the actor's face chip, the character's name — for every direction that was not
  `source`, so a "who says this?" card would have shown the right actor directly above its own four
  options. The option builder fell through to the quote branch for any unrecognised direction, so a
  card labelled `cloze` or `speaker` would have come back carrying quote options with the correct
  quote among them. And selecting a wrong option painted it red *before* Submit, which tells you the
  answer while you can still change it.

- **A cloze blank is graded word by word**, not as one string — see above. Found by a documentation
  pass comparing the plan against the code, not by a test.

- **`IconOpen is not defined`** when using the page-count filters on the Metadata screen. A guard
  test now scans every screen for an icon used and never imported; it found that one and nothing
  else.

- A film line on the Home screen wore the default yellow bar whatever colour it actually was.

<sub>Verification: `go vet ./...`, 807 Go test functions over real HTTP handlers and a real SQLite
database, 1,759 frontend tests. Every guard added in this release was checked by reverting it and
watching the test fail.</sub>

## [1.14.2] - 2026-08-15

### Added

- **The three boards can be asked for, and a board says what it HOLDS.** Reported as "I still
  cannot access the seeded boards" — and nothing was broken. 1.14.0 seeds boards from the quotes
  you already have, which is right: nobody should open the app to three empty shelves they never
  asked for. What nobody wrote down is the consequence. A reader with no standalone quotes gets no
  boards at all, and no way to ask for the three the rest of the app talks about.

  The offer sits on the **Add board** form, where you have already said you want a shelf, and it
  *fills the form in* rather than creating anything: the name stays yours to change before you
  press Create, which matters because a second board of the same name is a 409 and an editable
  field beats an error. They stay on offer rather than vanishing once "added", because the app
  cannot tell a Proverbs board you renamed to *Grandmother* from one you never made.

  And a board carries a **kind** — plain or proverb — set on a toggle rather than inferred from its
  name. Rename a proverb board to *Grandmother* and it is still one; call a plain board *Proverbs*
  and nothing changes about it. Both of those are the correct answer, and they are why this is a
  column rather than a name match. A proverb board asks for its languages at creation, which is
  what turns the quote form's Language box from free text somebody has to spell consistently into a
  short list, and what the optional per-language sections group by.

- **One save for a Details panel full of self-saving rows.** Changing six fields cost six presses.
  The per-row saves stay exactly as they are — for one line they are the right answer — and the
  header now offers a master ✓ beside them.

  **It sends one request, and that is correctness rather than thrift.** Every row PUTs the FULL
  record with its own field changed, so looping the rows means six full-state writes over the top
  of each other: run together the last reply wins, run in sequence each one still reads the item as
  it stood before the previous reply landed. Either way five of your six edits are gone, behind
  five green toasts saying they were saved. The rows register a patch, the panel merges them and
  writes once, and a test asserts the request COUNT — a loop passes any test that only checks the
  final field.

- **An IMDb id on a film and on a show.** The two supplier ids a title carries are the ones this app
  fetches *with*; IMDb is the one it cannot, because there is no public API. It is worth keeping
  anyway: it is the id you are most likely to have to hand, and it names one title exactly.

  TEXT and not INTEGER — `tt0111161` has leading zeros that are part of it, and a numeric column
  gives back a URL that 404s. No UNIQUE index either, where both other ids have one: theirs are
  dedupe keys for a fetch, and this fetches nothing, so the same constraint would only produce a
  save that fails while naming a row you cannot see. A TMDB fetch fills it from the `external_ids`
  appendix that rides along on the call the credits already needed — and for a *show* that appendix
  is not a convenience but the only place the id exists. Or paste the URL.

- **Favourite one quote from its own menu.** It was the single action the selection bar could do to
  forty quotes and one card could not. The ♥ is drawn on the card but revealed by hovering, so on a
  phone the most common thing anybody does to a quote was reachable in bulk and not one at a time.
  It goes in the registry, so all three quote kinds pick it up at once, and the label says what
  pressing it will DO — *Unfavourite* once the quote already is one.

- **A quote says when the quiz has stopped asking.** Excluding a work has excluded its quotes since
  the flag existed, and the card said nothing about it: skip a reference manual and its forty
  highlights looked exactly like the forty thousand the quiz is still asking about, with no way to
  tell but noticing they never came up.

  So: the struck flash card, on any row the deck will not draw — the same glyph the *Skip in quiz*
  button wears, beside the status dot, because the two answer one question between them. The dot
  says how the recall stands; the mark says nothing is going to ask. Its label names which decision
  put it there: *Not in the quiz* for the row itself, *Skipped with its book* when the work is out
  and the highlight is only along for the ride, because those two are undone by different controls.

  **And in search**, which is the half worth stating. All five hit shapes carry it now. Search was
  already the one place a quote arrived without its COLOUR, and a mark that showed on every board
  and not in results would have been that bug again with a different field — invisible on any one
  screen, because each screen is internally consistent.

- **A cover has its own menu**: Select, Fill gaps, the quiz toggle, Edit and Delete, on right-click
  or a long press. Everything there is something the selection bar could already do to exactly one
  thing you had picked — the bar and the cover read the same list now, and act through the same
  code. Delete asks once and does not make you type a phrase, and the dialog names how many quotes
  travel with the work, because a cover gives no hint that twelve are attached; the toast that
  follows has an Undo. Favourite is deliberately absent: a work's ♥ belongs to its own page, where
  the whole record is loaded, and setting it from a board would blank the fields the board never
  fetched.

- **Filter the catalogue by who is quoted in it.** The dropdown is the small half; which of two
  available answers it means is the whole of it. The fetched cast and the credits on the lines you
  saved are different sets, and they diverge for exactly the films a metadata fetch has touched and
  nobody has quoted. The filter is built on the LINES, and that is forced rather than preferred:
  `actor:` in search reads the same column, so a board built on the cast would filter to one set of
  films and seed a search that answered with another — a filter whose meaning changes on the way to
  the search box, silently, in the direction of *more* results, which reads as the search being
  broken. No filter here ships without deciding what it means to a search, because the board hands
  its filters to the search box as a seed.

### Fixed

- **An opened board is a detail page, so it looks like one on a phone.** It spent an entire row on a
  single back arrow, with the board's name, its count and its filters in the row beneath. A book's
  page has never done that — it puts all four in one bar — and the board page could not, because
  the shared scaffold had no back slot and `/quotes` drew its own button above it with a comment
  explaining why. That comment was the bug report. The slot is the fix rather than a stylesheet
  tweak, so a board and a book are now the same page shape. Nothing moves on a desktop.

- **The page holds still under a card menu, and the card says it is the one.** Two faults with one
  cause: the menu is placed at the point the press landed, anchored to a coordinate rather than to
  the card. So the page scrolled out from under it — leaving it hanging over some other card with
  its actions still belonging to one now off screen — and nothing on screen ever said which card it
  came from, which over a grid of near-identical covers means pressing Delete on faith. The page
  locks while a menu is open, and the card wears the same accent ring a selected card does, because
  the answer to "which one" is the card.

- **A selection of books offered to add tags to them, and could never have done it.** There is no
  book tag table and no `add_tags` on the works endpoint — only genres — so this was never an action
  a selection of works could perform. Three of the four quote-only bulk actions state that rule in
  the registry and this one did not; the only thing keeping the control off the bar was a callback
  the bar happened not to pass, which is a guard in the wrong file. Found by a new test asserting
  that anything the bar can do to a selection of one is on the card it came from — the check that
  was missing while the item and bulk halves of the registry drifted for three releases.

- **Every film line in the demo wore a colour nobody chose.** Not the search shim — the fixtures.
  The column is `NOT NULL DEFAULT 'yellow'` on the server, so "no colour" is not a state a real row
  can be in, and the demo's dialogues had none at all, so they fell through to slot 1: a real
  category somebody may have named, asserted on every line, in the one build strangers see. The
  search answers were missing the field on top of that. Nothing could have caught it — the shim
  answers 200 with a plausible object and the component reads a field that is not there, which is
  the same shape as the `created_at`/`created` drift the demo's own header warns about.

- **The test runner's cache had been following the repo around.** The ignore file covered
  `web/frontend/node_modules/` and not `node_modules/`, so running the suite from the repo root —
  a real invocation, and the one that found an earlier divergence — wrote its cache somewhere
  nothing ignored. One results file was committed and then reported itself modified after every
  test run from then on. A path-anchored ignore only covers the path somebody thought of.

## [1.14.1] - 2026-08-15

### Fixed

- **The starter proverbs and every imported quote were filed on no board at all.** 1.14.0 gave a
  quote a board and wired the two endpoints I was looking at — create and update — and missed the
  other two paths that write that table. Both left the board empty.

  Nothing failed and nothing warned, which is the whole trouble. The quotes arrive, they are
  visible under **All quotes**, they are counted in no board's total, and they are absent from the
  board you were standing on when you pressed *Add 10 Bengali proverbs*. That reads exactly like a
  button which silently did nothing — and it is how this was found, by being asked how to get the
  starter set.

  The seeder now files onto **the board that offered them**: the offer is made on an empty board,
  and an accepted offer should land where it was accepted, which is the rule capture inside a board
  already follows. The importer files on the default board. Naming a board *in the file* is still
  the deferred half, exactly as 1.14.0 said.

  The test is over the whole table rather than over the rows either endpoint writes, and it also
  asserts the per-board counts sum to the total — one quote, one board is the invariant a NULL
  breaks quietly. The next writer added to that table is the one it exists to catch.

- **A tooltip that outlived the thing it described.** On a desktop the hover bubble opened on
  pointerenter and closed on pointerleave and nothing else, which is right up until the moment the
  thing under the pointer stops being there. Press a colour swatch and the picker re-renders, a
  panel opens over the control, the row reflows — and the leave event that was going to close it
  never arrives. The label then sits over the screen indefinitely, obscuring the very control you
  pressed it to change, which is how it was reported.

  Two closes now, because neither is enough alone. **A click answers the question** — you hovered
  to learn what the control does and then pressed it, so the label is finished; and the click is the
  one moment we know for certain the pointer was there, which pointerleave may never say. And **a
  three-second backstop** for when neither event comes, long enough to read a five-word label
  several times over. It applies to hover only: a keyboard reader has not asked for their label to
  vanish mid-sentence, and that bubble is closed by blur, which unlike pointerleave always arrives.

- **Five InfoDots were over the length budget, the longest at 1113 characters against a cap of
  240** — metadata sources, backup, the bin and its duplicate in Settings, and colour categories.
  Every one of them passed the suite whose entire purpose is to cap them.

  The check only read `<InfoDot text="…" />`, and that is not how long copy gets written. A dot with
  a paragraph in it is hoisted to a module constant, or handed to a wrapper as `info=` and the
  wrapper renders the dot — so the tag being scanned for carried no literal at all. **A check that
  reads a narrower thing than the rule it enforces reports success about the part nobody was worried
  about**, which is the same shape as the search sweep that never reached quotes.

  So the copy is now taken from wherever it is written, and the guard is no longer a count: a count
  would not have caught this, because the miss was not "found nothing" but "found the short ones".
  Two payloads are asserted to be reached *by their opening words*, so the widening cannot rot back
  to a tag-only scan. It found a fifth dot the moment it worked. Each is trimmed to what the control
  does plus the one consequence you would regret not knowing; the rest of the reasoning already has
  a home in `docs/PLAN.md`, which can hold it at whatever length it needs.

### Added

- **Three captions at every timeline gap width, drawn without replacement.** The long-silence lines
  were twelve sorted by length, which looks like plenty until you notice how one gets chosen: by how
  much room the slot has. The depth that matters is per *width*, not overall — and the middle band
  held two, so a chart of similarly sized gaps printed the same sentence beside itself and read as
  though the app had one joke. Four bands of four now, with a test that the bands do not overlap,
  since an overlap would let "the widest band that fits" pick a band whose other members do not.

  And the draw is **without replacement** rather than random, because random is not the same rule:
  with four lines an independent draw repeats within three picks about half the time, which is
  precisely what a reader sees as repetition. One bag for the whole chart rather than one per gap —
  two gaps saying the same thing is the repeat anyone actually notices — and it is seeded, so a
  re-render redraws the same chart instead of reshuffling under the pointer.

- **Hide and Show in a board's menu have an icon**, the only item there that lacked one beside Edit
  and Delete. The eye came out of Settings, where it puts a colour category away, and is now shared:
  two callers is the moment a glyph becomes the app's word for an idea. It points the other way in
  each, on purpose. Settings' control is a **toggle** and shows where the category currently stands;
  a menu item is an **action** and its words say what pressing it will do — so Hide draws the crossed
  eye and Show the open one.

## [1.14.0] - 2026-08-15

### Added

- **The Quotes screen lists BOARDS now, the way the Library lists books.** You open one to
  read what is on it, and they are yours: name them, colour them, describe them, give them a
  picture, keep as many as you like. **Proverbs, Speeches and Others are simply the three you
  start with** — nothing in the app knows those names, so rename or delete them freely.

  **This replaces the segmented control 1.13.0 shipped, and the reason matters more than the
  feature.** I built the board as a FILTER. It is not one: a filter narrows what you see
  *within* a container, and the board decides which container you are in. Everything that
  went wrong followed from that single misclassification. The control was handed to the
  shared list scaffold's filter slot — which on a phone renders **inside the Filters sheet**,
  so the three boards were invisible on the device this app is designed for first — and that
  whole row is shown only when the *current* board is non-empty, so opening an empty Speeches
  board **removed the control that got you there**, with the choice remembered, so a reload
  did not rescue you. On a phone the screen looked exactly as it had in 1.12, which is what
  was reported.

  A control that belongs above the list had been put in the drawer that narrows the list. The
  fix was not to move it.

  **Deleting a board asks where its quotes go** and will not proceed until told; an empty one
  goes without a question. Nothing is deleted with the shelf — a board is where you *filed*
  something, and unfiling should not destroy it. That also means no board has to be permanent,
  which is what lets all three of the originals stay ordinary. The one thing it cannot do is
  delete your last board while quotes are on it, because there would be nowhere to move them.

  **Hiding is explicit and never inferred from emptiness.** A board you have just made is
  empty, and vanishing at that moment is the same trap this release is undoing. Hiding loses
  nothing either: a hidden board's quotes are still under **All quotes**, which is pinned
  above the shelves, is not a board, and cannot be renamed, hidden or deleted — a collection
  has to stay readable whole.

  Capturing a quote while a board is open files it on that board, the same way capture inside
  a book does. Which board you are on is now the **address** rather than a remembered filter,
  so `/quotes/proverbs` bookmarks, the back button steps between boards, and a reload lands
  where the URL says.

- **Search learned to be told which field you meant.** Type `tag:`, `author:`, `colour:` —
  or `speaker:`, `actor:`, `director:`, `genre:`, `series:`, `shelf:`, `year:`,
  `favourite:`, `note:`, `wishlist:` — and a dropdown offers the words your own library
  actually uses, narrowing as you type and forgiving a typo. Choosing one lifts it out of
  the box and into a removable chip beneath, so the box goes back to being free text.

  **The colon never reaches the server.** The client parses it and sends `&tag=stoicism`;
  the API has never heard of a syntax. A grammar both halves parse is a grammar that
  drifts, and the drift does not announce itself — it shows up as a query that RENDERS one
  way and MATCHES another, with both halves looking correct on their own. It also makes
  every chip a query parameter, so an unknown field is refused rather than quietly
  dropped: a dropped facet returns a WIDER result set, and a wider result set looks
  exactly like a correct answer.

  **Two tags intersect; two colours union**, and the rule is a property of the field
  because one rule cannot serve both. A quote has one colour, so `colour:doubt
  colour:joy` under an all-AND rule asks for something nothing is — that query returns
  nothing forever and reads as broken rather than as empty. Meanwhile narrowing by a
  second tag is a real question, and OR would widen it, which is the opposite of what
  pressing a second chip is for.

  Colours carry their names the whole way: the chip reads `colour:doubt` while the query
  sends `blue`, because the six slots are yours to name and showing the storage word would
  be showing you a word you deliberately renamed. Narrowing runs on the name too — typing
  `blu` finds nothing.

  A search made **only** of chips is a whole search. Picking a value empties the box, so
  that is the ordinary shape of a chip-built query.

  **A backslash escapes the colon**, because thirteen ordinary English words became
  operators the moment this shipped. `note:` and `series:` and `year:` are things a reader
  writes in a note, and "author: unknown" is a phrase somebody could well be searching
  their own library for — so `note\: to self` stays plain text, and the backslash comes
  back off before the words are searched. A grammar with no way out of itself makes those
  phrases unsearchable, and unsearchable *silently*: the box opens a dropdown and the words
  never reach the query.

- **A search started from a shelf searches the shelf.** The top bar's Search has landed
  scoped to where you were since 1.4.1; what it could never carry was the *filters*. The
  board knew it was showing you reading, Fantasy, Earthsea, and the search it opened knew
  none of it — you retyped the question you had just finished pointing at. It now arrives
  as chips, and from a book's or film's own page it arrives narrowed to that work. Every
  seeded chip is removable, so narrowing is free because widening is one click.

- **A globe for when you meant everything.** Right-click the search button and it stops
  caring where you are: every search becomes a search of everything, and the magnifier
  draws the world inside its lens to say so. It stays until you say otherwise.

  Right-click only, with no on-screen affordance, and that cost is accepted rather than
  overlooked — a visible switch would be a permanent control in the busiest row of the app
  answering a question most readers never ask. The globe is the feedback. The phone's bar
  follows the preference and cannot change it, since there is no right-click there and
  long-press is already the tooltip's.

### Changed

- **Every 34px icon button goes through one component.** `field-icon-btn` was a class string
  hand-written at 46 call sites across 13 files — the last primitive in the app that was never
  a component. The copy-paste had held remarkably well: all 46 carried a name and a tooltip,
  and exactly one had drifted (a button on Home was missing its press animation, so it did not
  press when you pushed it).

  The drift is not the reason. **A class string cannot make a decision.** 1.13.0 gave the 44px
  buttons an opt-in label so they could honour *Button labels*; the 34px family could not opt
  into anything, because there was nowhere to put the opting — 46 controls sat outside a
  preference that claims to govern the app, not by a decision but by never having been asked.

  Asked, the answer is that **this size is nameless**, and the component deliberately takes no
  label. 34px exists precisely because it sits in a row that has already spent its width — a
  text input with a ✓ and a ✕ after it, a card's action row that already wraps at six colour
  dots. So the app has two sizes and two rules, written once instead of remembered 46 times.
  A test asserts exactly one button in the app wears the class.

  Two things fell out of it. The drifted press animation is fixed by arriving. And the Add
  sheet's ✓ had been wearing the *other* family's colour class to go green, because this
  family had a danger tint and no affirmative one — one family reaching into another's
  stylesheet is how two families stop being distinguishable, so it has its own now.

- **The filter sheet and the search bar are two editors of one state.** The Library's nine
  filter states and the Catalogue's ten are one chip list each, in the same shape the
  search box's chips take. Nothing above changed — every control still gets the value and
  setter it always took — but `Reset` is now emptying a list rather than enumerating nine
  setters, and a filter cannot be added to a board without deciding what it means to a
  search, because there is nowhere else to put it.

  Three filters deliberately stop at that boundary. A board's *tagged* and *has notes* are
  properties of the WORK, derived from its children; `tag:` and `note:` are properties of
  the quote. Sending one as the other would empty the books section, so a search started
  from a filtered board would come back with nothing. Half a mapping that is right beats a
  whole one that is wrong.

- **`/search` no longer requires `q`** when a facet is present, and still refuses a request
  with neither: that is not a search, it is a request for the whole library.

### Fixed

- **The quotes screen looked identical to 1.12 on a phone**, and that is the board-as-filter
  defect above rather than a deploy problem. It is worth stating separately because the report
  was accurate and my first answer to it was not: I said the boards had shipped and were
  working, and on a phone they had never been visible at all.

Four defects in the above, all found by reviewing the facets *after* they landed green,
and all the same shape: no error, no empty screen, just a different answer to a different
question. Every one is recorded here rather than folded silently into the entry above,
because the reason they existed is more useful than the fact that they don't.

- **A credit facet could not match a name that was not English.** `author:Лев Толстой`
  returned nothing — for a name `GET /search/vocabulary` had just offered as a dropdown
  option. The value went through Go's `strings.ToLower`, a full Unicode fold, and was then
  compared against SQLite's `lower()`, which folds ASCII and nothing else: for "Marcus
  Aurelius" the two agree by accident, for "Лев Толстой" they cannot. Émile Zola,
  Тарковский, Ῥαβινδρανάθ — all silently unfindable, across all four credit columns. The
  rule was already written down three predicates above, on the series facet; the credits
  were the one place not following it.

- **A tag with nothing under it was still a result**, and that was not cosmetic. The genre
  and decade facets drop an empty group; the tag facet did not, and facets made the empty
  case routine — `tag:stoicism` matches a tag by name while `colour:doubt` excludes
  everything wearing it. It drew a Tags heading over an empty box, and because the hit
  total counts *groups*, it also made a search that found nothing look like a search that
  found something — skipping both recovery paths, the cross-column fallback and the
  zero-hit typo correction. A query spanning a quote and its note could vanish entirely
  because an unrelated row happened to carry a tag whose name matched.

- **A draft that could never become a chip ate the query.** Typing `movie:blade runner`
  searched for nothing: the screen said "type to search" over a box that visibly had text
  in it. The box opened its menu on "is there a draft with options"; the page stripped the
  draft out of the query on "is there a draft" — two answers to one question, agreeing for
  `tag:sto` and disagreeing wherever a field had nothing to offer, including while the
  vocabulary was still loading. There is one answer now, and `book:`/`movie:` have left the
  grammar entirely: they are seeded from a work's page and carry an id, never typed.

- **A field answered twice stacked instead of replacing.** `favourite:yes` and
  `favourite:no` both rendered as active chips while the server took only the last, so half
  the row asserted a narrowing that never happened.

### Internal

- **The fifteen queries behind `/search` are assembled rather than written out.** Results
  are sectioned by what matched, so a facet is a predicate that has to reach every section
  — and fifteen hand-edited `WHERE` clauses would be fifteen chances at a mistake that
  produces a wrong ANSWER rather than an error, since a predicate that failed to apply is
  indistinguishable from one that matched everything. A table names where each row kind
  comes from and one builder splices the facets in, so there is no second place to forget.

  An inapplicable facet **empties** its section rather than being ignored: `colour:blue`
  asks for blue things and a book is not one. The alternative puts the whole library under
  a heading claiming the results are blue.

  No facet value reaches an FTS `MATCH` — they are parameter-bound predicates on ordinary
  columns — which is pinned by feeding a facet a value full of FTS5 operators.

- **`Tooltip` gained a right-click opt-out**, needed by both this and the context-menu
  plan. It wraps every control in the app and swallows right-clicks whole, so the search
  icon could not have received one. The opt-out ADDS to the suppression rather than
  skipping it, since skipping would hand the Android long-press bug back to every caller
  that wanted a gesture.

  Writing its test corrected the comment it was written from: that line claimed to stop a
  card's menu opening on the card's own buttons, and it does not — `preventDefault`
  suppresses the default, not the propagation, and what turns the event away is
  `useCardMenu`'s own guard. Both mechanisms are real; believing they are one is how
  somebody eventually deletes the one doing the work.

- **`editDistance` moved out of `MetadataPage.jsx`** into a shared `text.js`, where it
  arrives with the test it never had. Its companion `foldText` is deliberately not
  `normName`: that one drops everything outside `[a-z0-9]`, which is right for grouping
  Latin names and fatal for a typeahead — a reader whose tags are in Bengali would be
  filtering a dropdown where every option folded to the empty string and therefore matched
  everything equally.

## [1.13.2] - 2026-08-15

### Fixed

- **The Quotes screen threw on sight, and had since 1.13.0.** "Can't access lexical
  declaration before initialisation", the whole page replaced by the error boundary,
  on every library — empty or full, on both servers. Not a data bug and not an edge
  case: every single render.

  The board that partitions quotes into Proverbs, Speeches and Others was written
  below the three lists that name it in their dependency arrays. A dependency array
  is not a closure — it is built the moment the line runs — so the board was read
  inside its own temporal dead zone. The code reads perfectly. It is fatal on the
  first render.

  **Ten tests covered that file and not one could have caught it**, for a reason
  worth stating plainly: every one of them imported a FUNCTION out of it. Pulling
  the grouping, the save shape, the meta line and the year parser out of the
  component so they could be tested without rendering a screen is the right
  instinct, and it is exactly what left the screen itself never once executed. A
  page can be wholly broken while every extracted piece of it is green — and the
  greener those pieces are, the more convincing the illusion.

  So the test that closes this is not a deeper test of Quotes. It is a shallow one
  over **all thirteen screens**, asserting only that each can be put on a page,
  driven by the app's own route labels so a new screen cannot go uncovered. It
  mounts them with every request refused, which needs no invented response shapes
  and exercises the state nobody tests by hand: the server said no. Login and the
  first-run screen are in it too — they are the two whose failure nobody can route
  around.

- **The timeline's year labels, which 1.13.0 said it had fixed.** 8 and 0 were still
  one shape, because that release changed the wrong labels: it moved the landmarks
  *inside* a folded gap off the mono face, wrote a long comment about why, and left
  the ticks under every column — the labels anyone actually reads — at mono 9px.

  Those were the worse case all along. The ticks are rotated, so a digit is read by
  its outline alone, which is what survives least at that size; and Plex Mono draws
  its own 0 with a slash. That slash is the typeface's zero rather than a setting,
  so no CSS property can lift it and changing the face is the only fix there is.

  **And that release made the gap markers worse.** It set `slashed-zero` on them as
  a free enhancement — inert if the font subset had dropped the feature, clearer if
  it kept it. It kept it, so a face chosen *because* its 0 and 8 differ by outline
  had a stroke put back through the 0. A typographic setting whose effect you cannot
  see is not free; it is an untested change carrying a comment about why it needs no
  test.

  The tick row also grew, which "480s BCE" had needed all along — eight glyphs never
  fitted the old height at any readable size, so the oldest label in a library was
  the one being clipped. The chart grew by the same amount, so the dots keep their
  full column.

- **A tick at Years scale said "1994s"** — a decade that does not exist, on the axis
  whose only job is to say when. One function was labelling all three scales.

### Added

- **A decade on the timeline opens that decade's works in Search**, and so does the
  "Most quoted decade" superlative, which named a decade and did nothing with it.
  Every other number on that page already opened the rows behind it; the chart
  answering "when is my library from" answered it and stopped.

  **Years and centuries deliberately do not.** A bare year cannot go through the
  query box at all — "1984" is a book people own, and teaching search to read four
  digits as a span would take that search away to pay for this click. A century is
  worse than unsupported: "1900s" *parses*, as the decade, so a column covering a
  hundred years would return ten of them and look like a complete answer. A control
  that returns a confident wrong answer is worse than one that is not there, because
  nothing on the wrong page tells you so.

  The same reasoning fixed a case nobody would have reported: "90s" means the 1990s
  to the search, rightly, for anyone typing it — which would have sent a column for
  the 50s CE, as a library holding a gospel really has, to a shelf of mid-century
  paperbacks. The chart asks with a zero-padded year, which cannot be a shorthand,
  and the results still name themselves "50s".

- **"380s BCE" is a search.** The timeline writes that label, and its ticks are doors
  now, so a form the app produces itself had to be a form it can read — otherwise
  the one column holding the oldest thing on a shelf is the one leading nowhere.

### Changed

- **Four of the timeline's numbers now agree by test rather than by comment.** The
  column pitch a folded gap is measured in, the room the dots need, the two tick
  heights that are one row, and the year labels' face and size. Every one of them
  fails silently today: a gap drawn at the wrong width still draws, and a clipped
  twelfth dot looks exactly like a column that only had eleven.

## [1.13.1] - 2026-08-14

### Fixed

- **A character named "V" was being swallowed by the rule that keeps "Martin Luther
  King, Jr." in one piece.** When a comma split leaves a lone token behind, that token
  re-attaches to the name before it — and the set of such tokens included the Roman
  numerals, for "Henry Ford II". So a dialogue line stored as "Evey, V" came back as
  one label that nobody could remap, while "V, Evey" split correctly, because the rule
  only ever looks backwards.

  **The generational marker is a number now** — "Henry Ford, 2", "Elizabeth, 2nd" —
  and the Roman numerals are gone from the set. A bare number cannot be a name, where
  a single letter plainly can. The consequence is worth stating: "Henry Ford, II" now
  splits into two components. That is the right way round, because a wrongly-split
  credit is visible and fixable in the People console while a wrongly-merged one hides
  a whole person and gives you no way to find them.

  Changed on **both** sides in the same release. The client and the server split the
  same strings, and a disagreement about what a component IS would show up as a rename
  that touches one and not the other.

- **The standalone-quote search index was never integrity-checked.** Every FTS index
  is verified at startup and rebuilt when it comes back corrupt — except that
  `utterances_fts` was missing from the list the sweep reads, from the migration that
  created it until now. Nothing failed and nothing was logged: the repair path existed
  and worked, it was simply never pointed at that index, so corruption there survived
  every restart while searching your quotes returned wrong or missing rows with no
  explanation. An unchecked index is indistinguishable from a healthy one right until
  it is not.

  A hand-maintained list beside a schema is the shape that rots, so the schema is the
  authority now: a test reads every `*_fts` table out of the database and fails if one
  of them is not swept. It also fails if the list names a table that no longer exists,
  which would log an error on every boot.

- **A hand-written import file lost any binding whose key was capitalised.** `- Speaker:
  Bose` parsed fine, matched no case in any of the three Markdown parsers, and was
  dropped — an import that reported success and quietly discarded the speaker. Keys are
  matched case-insensitively now, in one shared helper rather than at each of the eight
  switches, so the book, film and quote formats cannot drift apart about what a key is.
  Values keep their case exactly: a key is a keyword, a value is content, and folding a
  value would be a worse bug than the one being fixed.

### Changed

- **More of the app follows "Button labels".** 1.13.0 taught the primitives to carry a
  name and fixed the selection bar; this carries the remaining nameable controls over —
  the filter, capture, export, details and delete buttons on a book's and a film's own
  page, the metadata console's fetch, and the shared list header.

  Each gets a **short** word rather than its tooltip. The tooltip is a sentence ("Fetch
  missing covers and metadata") and putting that beside a glyph in a header row would be
  worse than no words at all — so the word is on screen and the sentence stays on hover.

  Every `✕` and every `⋯` is deliberately left alone. Those are the two affordances
  whose whole job is to have no name, and "More" beside three dots is the same thing
  said twice.

## [1.13.0] - 2026-08-14

### Added

- **A quote knows what kind it is, and the Quotes page is three boards instead of
  one.** Proverbs, Speeches, Others, switched by a segmented control at the top. 0026
  built one table for "a line from a speech, a letter, an interview, a song, a
  proverb, something a friend said", and one board to show them all in. That is right
  for one kind of thing and wrong for three: a proverb has no speaker, no occasion, no
  date and no place, so it fell into the residual bucket of every grouping the screen
  offered, and a shelf of proverbs sat mixed into a shelf of speeches with nothing to
  tell them apart.

  **One page, not three tabs.** Three top-level tabs was the first plan and it is
  wrong on a phone: the bottom bar holds four content screens, and splitting one into
  three puts six glyphs on a row a thumb has to hit, at about 52px each. Quotes keeps
  its tab and its URL, so every bookmark, the drawer, the plus button and the
  installed app's shortcut are untouched.

  **Nobody's shelf moves on upgrade.** The board opens on Others, which is what every
  quote already in a library IS — the migration set that default rather than guessing a
  category from `medium`, because promoting anything whose medium says "speech"
  reclassifies somebody's library silently, with no way to see what it moved.

- **Thirty proverbs in the box — ten Bengali, ten Hindi, ten English — and none of
  them arrive uninvited.** A Proverbs board on a library that has never filed one is an
  empty screen with a plus on it: a feature you have to go and think of ten proverbs
  for before you can see what it does. Speeches and Others fill up from the same
  capture flow as everything else; nobody sits down and types in proverbs.

  So the offer sits on an empty board, names the language, and does nothing until it is
  asked. **This is deliberately unlike every other seeder here.** The starter stickers
  have a boot hook, a backfill and a settings flag; this has none of the three, because
  a sticker is a TOOL and a proverb is CONTENT. Putting thirty lines somebody never
  chose into a collection they have kept for a year is not a friendly default, it is
  the app writing in their book — and the Bengali board would then open onto a shelf
  that is entirely mine and none of theirs. Asking for Bengali is not asking for Hindi.

  Asking twice adds nothing and says so. The consequence, stated rather than left to be
  discovered: a starter proverb you deleted comes back if you ask for that language
  again, which is the honest behaviour for a button that says "add the Bengali ten".

- **What a line says, for the ones not in a language you have.** An optional English
  translation, shown on the card in the reading face rather than in the mono strip
  beside the date — it is prose, the same words in another language, not another
  locator. It is searchable too, and lands in the same results section as the quote:
  somebody searching a shelf of Bengali proverbs types the English, because the English
  is the half they can type, and what they want back is the proverb, not a second
  heading holding the same card.

### Fixed

- **"Button labels: Show" did nothing to the selection bar, and Hide did nothing
  either.** Reported as three separate faults; it was one, and structural. The app's
  controls split into two families and membership was accidental: `Button`,
  `StickerButton` and `FilterChip` render their words in the span the stylesheet clips,
  while `IconButton`, `MoreMenu`, `CloseButton` and an unadorned `GhostButton` render
  no such span at all. Counted across the app, 31 of about 123 primitive uses honoured
  the preference and 78 could not. The selection bar was built entirely from the family
  that cannot — the row with the least room, where the setting matters most, was the one
  outside it.

  Both primitives take a label now and render the same two spans, so the existing
  collapse rule does all of it and no new CSS was needed. **The count became the
  control:** the number sits in a real button's glyph slot wearing the same round
  border as its neighbours, tapping it clears the picks, and its word collapses on a
  phone. That merged two items into one — a sentence saying how many and a worded button
  undoing it were one idea drawn twice — and separated the two that were adjacent,
  because "Deselect all" beside the close mark reads as the same control twice, and the
  one that ends the mode is the one you hit by accident.

- **The colour picker in that bar was close to invisible.** Two reasons, both real: it
  is drawn borderless, which is right on a card where it sits among dots and wrong in a
  row of bordered circles; and a selection of forty quotes has no one current colour,
  so it rendered an EMPTY dot at 65% opacity — a faint grey ring on a faint background.
  It wears the button frame now and shows the palette mark.

- **8 and 0 were the same shape on the stats timeline.** The year markers inside a long
  gap were mono at 9px in the faintest ink: Plex Mono draws 0 as a plain oval and 8 as
  a narrow-waisted figure of the same width, and at that size the waist and the counter
  both close up. These are years — a misread digit moves the landmark by eight
  centuries, which is worse than having no marker at all. The face was the fix, and
  mono was buying nothing: each marker is centred on its own year, so there is no
  column for tabular figures to line up with.

- **A very wide gap on that timeline had one small sentence adrift in it.** The gap
  keeps the true width of the columns it replaces — that is the whole reason it is not
  collapsed to a neat band — so two millennia is over a thousand pixels, and the longest
  line available is about 120 characters. It carries up to three now, each sized to its
  own share and none repeated.

- **The tooltips had grown into essays.** The five-word rule keeps every label short
  and it works: of 162 labels only five exceed it, each by one word. But it had an
  unbounded consequence — longer copy was told to go and live in an info dot, and
  nothing ever constrained an info dot. They reached 400, 700, nearly a thousand
  characters, and what filled them was reasoning rather than instruction; one spent 680
  characters on a switch whose behaviour takes 90. Seventeen are rewritten to what the
  control does plus at most one consequence worth knowing. The reasoning has a home
  already, and a popover read standing up while deciding whether to press something is
  not it.

- **The speaker remap offered ensembles.** A line spoken by two characters is stored as
  "V, Evey", and the screen asked you to map that whole string onto a single cast
  member. It could not have worked either: the server compared the entire stored label,
  so a mapping for "V" matched nothing and reported success having changed no rows.
  Individuals are listed now, counted by the lines they appear in, and an ensemble is
  rewritten in place so separators and co-credits survive exactly. The actor is spliced
  at the matching position, and left alone when the two lists do not line up — imported
  rows often carry a different number of actors than characters, and pairing the wrong
  one would be invisible and read as your own data.

### API

- `api_revision` 5. `category` (proverb, speech, other), `language` and `translation`
  on the quote shape, on the single read and **on the list row** — unlike the book
  credits added in 1.12.0, because the category IS the board and a client cannot draw
  the board without it. `?category=` and `?language=` filters, both carried through the
  Markdown round trip and the staging queue. New: `GET`/`POST /quotes/starters`.
  Features named: `quote-categories`, `proverb-starters`.

- Recategorising does not change a quote's dedupe hash, and must not: the occasion is
  part of what a quote IS, while the category is where you decided to file it, so a
  line moved from Others to Proverbs is one saved line under a different heading rather
  than a second row.

- An unknown category is refused **at staging**, where a mistake in a file is still
  cheap to fix, rather than becoming a failed write after the import has been approved.

## [1.12.1] - 2026-08-14

### Fixed

- **1.12.0 has no image. This release is the one that publishes, and the reason
  1.12.0 did not is the whole of it.**

  Publishing the image took two and a half minutes for seventy releases. On 1.12.0
  it passed twenty-five minutes with no output, on the `main` build and the tag
  build at once, and I cancelled both — so the tag and the GitHub Release for
  1.12.0 exist while the container for it never did. If you pin `1.12.0` you will
  find nothing there. `latest`, `1.12` and `1.12.1` all resolve to this release.

  The Docker frontend stage carried no platform pin, so Buildx built it once per
  published architecture and the `linux/arm64` pass ran Node under QEMU emulation
  on an x86 runner. That has been true since the first commit in this repository,
  and it survived on luck: the install layer was keyed on `package.json` alone,
  `package.json` had not changed in dozens of releases, so the emulated install was
  a cache hit every single time and never actually ran.

  1.12.0's own fix — installing from the lockfile with `npm ci`, so the image stops
  shipping a bundle nobody has run — added the lockfile to that layer's inputs. It
  was the right change and it did exactly what it should have. It also changed the
  layer's key, so the emulated install finally ran for real: 231 packages under
  emulation, several of them native binaries that have to be unpacked and checked
  — Tailwind's engine is Rust, esbuild is Go, Rollup ships bindings per platform.
  That is the workload emulation is worst at, and it is why a correct fix looked
  like a broken pipeline.

  **Emulating that stage was never worth doing, cached or not.** It emits
  JavaScript, CSS and HTML, and there is nothing architecture-specific in a bundle
  — the arm64 pass spent all that time producing bytes identical to the amd64 pass.
  Pinned to the build platform it runs once, natively, and both images copy the
  same output. So this is a correctness fix as much as a speed one: it is now
  *guaranteed* that the two architectures serve the same frontend, where before
  they were two independent builds that merely ought to agree. The Go stage has
  been pinned this way all along and says why in its own comment; the frontend
  stage was simply missed, and the cache hid it for seventy releases.

  The README said arm64 was safe to publish because the binary is pure Go and
  cross-compiles. That was half of it, and the other half is true now too — so
  what remains untested on arm64 is the binary, not the page.

### Internal

- **A publish that hangs now fails in thirty minutes instead of six hours.** The
  job had no timeout, so it inherited GitHub's 360-minute default. While 1.12.0 sat
  at "Build and push" emitting nothing, there was no way to tell a slow build from
  a hung one and five and a half hours of runner time left to spend on each of the
  two concurrent builds. Thirty minutes is about ten times what a native build
  costs, so anything that trips it is a fault and not a busy runner, and it fails
  while somebody is still watching.

- **The test counts in `AI.md` were recounted**, having drifted from 645 Go test
  functions, 1,293 frontend tests and 180 files to the actual 671, 1,380 and 187.
  That file's own instruction is to recount rather than trust the number, and it
  gave a command for the Go figure but none for the file count — the one that had
  drifted furthest. All four now sit together, each next to the number it produces.

## [1.12.0] - 2026-08-14

### Fixed

- **1.11.2's container came up healthy and served a dead page. This release is
  what fixes it, and everything else here is incidental to that.**

  The Docker frontend stage copied `package.json` alone and ran `npm install`, so
  every `^` range was resolved afresh at image-build time. Every dependency in
  this app is a caret range, and four of the six had already moved past the
  lockfile: React and React DOM from 19.2.7 to 19.2.8, Tailwind and its Vite
  plugin from 4.3.2 to 4.3.3, and Vite to whatever the newest 6.x happened to be.
  So the image shipped a bundle that no test, and nobody at all, had ever run.

  The Go binary was unaffected — its dependencies are locked by `go.sum` — which
  is exactly why the healthcheck passed while the page did not. A container
  reporting itself healthy and serving nothing is the worst shape this failure
  has.

  **CI could not have caught it, and that is the part that is actually fixed.**
  `ci.yml` and `pages.yml` both run `npm ci` against the lockfile, so the suite
  was green against one set of versions while the image was built from another.
  There was no build anywhere in the pipeline that used the versions the image
  used. Both paths now install the same way, so a dependency that breaks the
  build breaks it on a pull request instead of on somebody's NAS. `npm ci` also
  refuses to run when `package.json` and the lockfile disagree, which turns a
  hand-edited version into a failed build rather than a silent resolution. The
  frontend stage now also fails if the build emitted no `index.html`: a build that
  "succeeded" without producing a bundle must not become an image.

  This line dated from the initial commit and had held for seventy releases,
  which is how long it took an upstream patch release to land in the wrong place.

- **A missing asset is a 404 now, instead of the app with a 200 — which is why
  the above was invisible.** The SPA fallback answers unknown paths with
  `index.html`, and that is right for the client-side router: `/library` and
  `/quotes/12` are not files and never will be. It was applied to *everything*
  missing, so a request for a bundle that was not in the image came back as
  `index.html` with `Content-Type: text/html`, and the browser declined to
  execute HTML as a module and rendered nothing. No error in the log, no failing
  healthcheck, nothing in the status code.

  A path with an extension is a claim about a file; if the file is absent, say so.
  A broken build now shows up red in the network tab, which is where somebody
  looking at a blank page starts. There is also a test asserting the committed
  `web/dist` is self-consistent — every hashed asset `index.html` names is
  actually present and non-empty — because that is the artifact a non-Docker
  deploy serves and nothing had ever looked at it.

- **The test suite stopped depending on how busy the machine was.** A handful of
  DOM files render a whole screen — Settings alone mounts eight cards that each
  fetch on mount — and jsdom does that an order of magnitude slower than a
  browser. Alone they finish in well under a second; run as one of seventy files
  across every core, the slowest crossed the 5-second default and failed with
  "Test timed out". A different subset each run, and every one of them passing on
  its own. Twenty seconds for the DOM project: a genuine hang still fails, just
  later, and the margin between "this code is wrong" and "this laptop was busy"
  stops being red.

- **The favourites wall on Home holds still while you work.** Recolouring or
  sharing a favourite reloaded the list, and the list reshuffled on every load —
  so the four tiles on screen became four different tiles and the card you had
  just acted on was gone, which reads as the app losing your change rather than
  saving it. The wall still reorders, but once per **visit**. Un-hearting one tile
  now leaves every other one where it was, and the tile heights stopped
  re-rolling too.

### Added

- **The changelog is in the app.** Settings → Updates → **Changelog**: every
  release, newest first, with the build you are actually running marked — the one
  thing a link to GitHub cannot tell you. Only the newest is open; the rest fold.

  It comes out of the **binary**, not off the internet, so it works on a LAN-only
  box, behind a firewall, and with the network unplugged. That is not a
  limitation, it is the point: a changelog is a fact about the binary you are
  running. The releases link on the card stays, because "what is in a version I
  have *not* installed" is a different question and that link answers it.

- **A translator and an editor, beside the author.** The Garnett Dostoevsky and
  the Pevear Dostoevsky are different books to read, and until now they were the
  same book to this app. Both are **real people** — portrait, life, links, their
  own page, renameable across the whole library — and one human can be an author
  on one book and a translator on another without becoming two records with two
  bios.

  They appear on the **book's own page**, marked `tr.` and `ed.` so a second face
  is never mistaken for a second author, and deliberately nowhere else: not on the
  Library board, where a tile has room for one credit; not on a quote, which
  belongs to whoever wrote it; not as new categories in the stats. Nothing fetches
  them either — no provider reliably carries a translator, so what is there is
  what you typed.

- **An optional folder for the unopened shelf.** A library that keeps quotes
  accumulates books it has nothing from yet, and forty unopened covers scattered
  through a grid of books you have actually read is forty tiles of noise between
  the ones you are looking for. **Fold wishlist** in the filter row puts them all
  into one tile at the front of the board, wearing a collage of the first four
  covers.

  The folder holds nothing: opening it is the `wishlist` chip that already
  existed, so nothing moves, nothing is stored, and a book leaves by itself the
  moment you save a quote from it. Off until you turn it on, and then it stays on.

- **A long silence on the stats timeline says something.** A library holding
  *Meditations* and then a shelf of 2020 paperbacks drew about a hundred and
  eighty identical blank columns — which is not a silence you read, it is a
  stretch of nothing you scroll past, and it teaches you to stop reading the axis.
  A long empty run is now drawn once, carrying the years going past and a line
  about the fact that nothing in all of it is on your shelf.

  It keeps **exactly** the width those blank columns would have taken. Folding it
  to a neat little band would make two millennia and two centuries draw the same,
  which is the whole failure the empty columns exist to prevent.

### Changed

- **The bar a selection puts up is three glyphs and a `⋯`, instead of eleven
  words.** It shipped with four buttons and left 1.11.1 with eleven controls —
  colour dots, a tag field, a tag button, Seal, Favourite, a shelf dropdown, Fill
  gaps, Skip in quiz, Delete, Deselect all, ✕. Every one was added for a good
  reason and none of them is the one that broke it, because nothing broke: it
  became, on a phone where the bar is pinned under the header at a fixed height, a
  strip wider than the phone, one release at a time.

  Three stand in the row — for quotes the colour, the ♥ and the quiz toggle; for
  books and films fill-the-gaps, the shelf and the quiz toggle — and the rest fold
  away, Delete included. Which three is decided in the action registry rather than
  by the component that draws them, and a test asserts it is exactly three: a
  fourth fits on a desktop and pushes the count off the screen on a phone,
  silently.

  The three that fold have one thing in common — each needs something *more* from
  you before it can run. Tags need a keyboard, the seal needs a picture chosen,
  Delete needs a phrase typed. The tag field standing open in the row was the
  widest control in the strip and was open on every selection whether or not
  anybody meant to type into it; it asks in a dialog now.

  The quiz toggle's **picture** flips with its label, which stopped being optional
  the moment the words came off: "Skip in quiz" / "Add to quiz" was naming the
  action *and* reporting which way round the selection is, and a fixed glyph keeps
  the first and silently drops the second.

- **Edit joins the bar when exactly one thing is picked**, opening the same form
  the card's own `⋯` opens. Pick a second and it is gone rather than greyed,
  because a disabled item in a menu is a thing to wonder about. Over works, *Set
  fields* is its mirror — two upwards only — so a selection never shows two ways
  to change the same fields. The card's own `⋯` is untouched: multiselect is an
  added way in, not a replacement.

- The README carries the app's own mark above its name.

### API

- `api_revision` 4. `translator` and `editor` on the single-book shape (create,
  read, update) and in the Markdown frontmatter; both accepted wherever a person
  kind is, so they take portraits, bios, links, renames and the orphan sweep.
  Absent from the book LIST row on purpose. New: `GET /changelog`. Features named:
  `book-credits`, `changelog`.

- Migration `0034` adds `translator` and `editor` to `books` **and to
  `staged_works`** — the second is the one that mattered. No third-party importer
  carries a translator, so the staging queue looked irrelevant; but this app's own
  export is an importer's source and every import is staged, so without it the
  field survived the export, survived the parse, and was dropped on the way into
  the queue. Exporting a library and importing it back would have lost every
  translator in it, with a successful import and matching counts saying nothing
  had happened.

- Migration `0035` is groundwork, with no feature reading it yet: a standalone
  quote gains a `category` (proverb · speech · other), a `language`, and an
  optional `translation`, and `utterances_fts` is rebuilt to index the
  translation. Every existing row keeps meaning exactly what it meant — the
  default is `other`, rather than guessing from `medium` and reclassifying
  somebody's library on upgrade. None of the three folds into the dedupe hash: the
  occasion is part of what a quote *is*, while the category is where you have
  decided to file it. The three screens that read it come next.

## [1.11.2] - 2026-08-14

### Added

- **A book, film or show now says what it is holding, at the top of its own page.**
  How many quotes, and how many of those are favourites, carry a note, or are
  tagged. The board below has always printed a count in its toolbar, and that
  toolbar is the wrong place to learn it from: on a phone it is inside the filter
  sheet, and on a desktop it is past the description — so "how much have I got out
  of this book" was a scroll away on the page whose entire subject is the answer.

  The three breakdowns appear only when there is something in them, because "0
  favourites · 0 noted · 0 tagged" is a row of failures to report with nothing in it
  to act on. The total always shows, because a zero total *is* the wishlist state
  and saying "no quotes yet" out loud beats an empty gap where a number goes. And
  they count everything on the work rather than what a filter has left on screen: a
  colour filter must not be able to make a book look emptier than it is.

- **The bin is a page of its own** (`/bin`), reached from the tile in Settings and
  from nowhere else. It was a card in a three-column grid, and a card is a control
  panel — a label, a control, done. The bin is a list of unbounded length whose rows
  expand, and in a ~300px column it had to say what an entry was, when it went, what
  travelled with it, and when it is due to go for good, so it said three of those
  and dropped the fourth.

  The page carries all four. Each row names its kind with the app's own glyph for
  that thing, and once there is more than one kind in the bin, chips appear to show
  just one of them. **When something is due to go is a date, not a countdown** — the
  purge clock runs on server time and only while the server is up, so an instance
  switched off for a week has not spent a week of anybody's thirty days, and "gone
  in 3 days" would be a promise nothing here can keep.

  It is deliberately in no menu. Nothing about the bin is a place you go; it is a
  place you are sent, by that tile or by an Undo that expired before you noticed it.
  A permanent tab for things you have deleted would be a standing invitation to
  browse them. It is still a real page rather than a modal, so it bookmarks and
  survives a refresh.

- **The search scope chips carry glyphs**, and lose their words to the same
  Appearance → *Button labels* preference every other control in the app answers —
  which on a phone is the difference between six chips fitting above the search box
  and not. Books, films and quotes wear their own tabs' marks, so a scope looks like
  the screen it searches; the two quote kinds with no tab of their own get two new
  drawings. *All* keeps its word at every width: it is the default and the way back,
  and a glyph is a thing you have to have learned already.

### Changed

- **The selection bar holds until you dismiss it.** It used to render on "something
  is picked", so tapping the last card off tore the controls off the screen
  mid-task: deciding those were the wrong four books cost a fresh long press to
  start again. It now holds with nothing picked, reading *no books selected* with
  its actions greyed. **Deselect all** empties the selection and leaves it standing;
  the ✕ beside it — or Escape — ends the mode.

  One consequence worth stating rather than discovering: a plain click keeps picking
  cards after the last one is taken off, where it used to hand back to opening. It
  has to, because the board plainly says it is selecting, and a click that opened a
  book instead would be the surprise.

- **Making a backup no longer downloads it.** The archive is *kept* on the server —
  that is the point of the feature, and the restore reads it from there — but
  creating one also pushed a multi-megabyte file into your downloads, every time,
  unasked. On a phone it was worse than untidy: the navigation happened while the
  dialog was closing, so what came back was a download shelf over a Settings screen
  that had lost its place. The toast offers the copy instead, and the card has a
  proper **Download the last one** control where it used to have the word
  `download` in a corner as a footnote.

- **Every control on the author and actor metadata screens carries a glyph.** The
  People console and the person panel were the last screens whose buttons were words
  alone, while every card, table and bulk bar in the app had moved to
  glyph-plus-label. The per-row action takes **one** glyph across both its words:
  `fetch` and `refetch` are the same act, and the label flips only because the row
  already has something, so two drawings would claim the acts differ.

  `search images ↗` loses the arrow — a glyph's job done by a character, and the
  outbound chips two inches above it say the same thing with nothing at all.

- Every control on the Backup card and in both its prompts keeps its words at every
  width. That is not a style choice there: one of them writes a multi-megabyte file
  and another replaces every user, library and setting on the server and logs
  everyone out. Neither is a thing to find out by pressing a glyph you
  half-recognise.

### Fixed

- **A long press no longer highlights a word under your thumb.** The same 500ms hold
  means two things to two systems and both are right: to the app it is the gesture,
  to the browser it is the start of a text selection. So a press on a card's
  whitespace fired correctly *and* came up with a stray word shaded behind the menu.
  Nothing was broken, which is why it stayed — it only ever looked broken. Fixed in
  two places at once, because they fail on opposite hardware: the stylesheet stops
  the highlight being drawn on a touch screen, and the gesture drops any live
  selection the moment it fires, which is what covers a laptop with both a mouse and
  a touchscreen.

- **A selection dot no longer stays lit on the card you long-pressed.** A tap leaves
  focus on the card it landed on, and focus was one of the things that revealed the
  mark — so after deselecting everything, one card went on saying it was selected
  until the screen was reloaded. On a touch screen the running selection is now the
  only thing that stands a mark up, which makes the whole rule one sentence: the
  ticks are up while the bar is up.

- **The test suite no longer depends on which machine it runs on.** Several places
  format a date through `toLocaleDateString` with an undefined locale, which is
  right — a date should be written the way the *reader* writes dates — and which also
  means the rendered string follows the host. `vitest.config.js` had a comment
  claiming TZ *and* the locale were pinned, above a line that pinned only TZ, so four
  assertions in the bin's suite were passing on the author's machine (`1 Aug`) and
  went red on CI the day the runner's default moved to `Aug 1`. The locale is pinned
  now, in the environment the tests actually run in, because an env var cannot do it:
  ICU reads `LANG`/`LC_ALL` on Linux and ignores them on Windows, so pinning that way
  would fix CI and leave the authoring machine disagreeing instead. Both harness
  files assert the pin is in effect, so removing it fails with a sentence rather than
  as four cryptic date mismatches. `localeCompare` is pinned with it — every
  by-title and by-author sort in the app goes through it, and collation is
  host-dependent in exactly the same way for anything but plain ASCII.

- The glossary had been rendering a retired component. `person-link-row` is in
  neither the source nor the stylesheet — the redirect-menu view it belonged to was
  replaced by the details view — so that sample had been an unstyled `div`, and the
  person panel's entry described a screen the app has not had for releases. Both are
  rewritten against what the code actually renders.

## [1.11.1] - 2026-08-13

### Added

- **Books, films and shows can be selected too.** The Library and the Catalogue had
  no way to act on more than one thing at a time, which is odd on the two screens
  where you actually look at forty of them. Hold a cover on a phone, Ctrl/Cmd-click
  it on a desktop, or tick the mark in its corner, and the same bar the quote boards
  put up appears — offering what a *work* can do rather than what a quote can:

  - **Fill gaps** — fetch each one's metadata and write only the fields that are
    **empty**. A description you wrote, a year you corrected, a cover you chose:
    never touched. That is what makes it safe with no preview, and why it can be one
    button instead of a console. *Re-verify* is still the other half — it shows you
    every difference and waits for you to tick the ones you believe.
  - **Shelf** — move the lot to reading/watching, paused, abandoned or completed, or
    clear it. Something already finished is passed over rather than refusing the
    whole batch, and the read log comes along exactly as it does for one.
  - **Skip in quiz** — see below.
  - **Delete** — behind the same typed phrase, and the dialog says plainly that the
    quotes saved from them go too. One bin entry for the whole selection, one Undo.

- **Skip something in the quiz without deleting it.** Some things you keep are not
  things to be tested on: a shopping list saved as a quote, a line kept for its
  wording, a reference manual whose highlights are all page numbers. Select them and
  press **Skip in quiz**. Do it to a **book, film or show** and it covers every quote
  you save from it afterwards too — because "this manual is not for quizzing" is a
  fact about the manual, not about the forty highlights it happens to have today.
  The button reads **Add to quiz** when the selection is already skipped, so you can
  always tell which way round it is.

- **The quote boards on a book's or film's own page can select as well** — the one
  place you look at forty highlights from one book was the one place you could not
  act on forty of them. Their card views carry the bar; the table view does not,
  because a row is already a row of controls.

- **Two more things a selection of quotes can do:** set **one sticker across the
  whole lot** (or take every seal off), and the quiz toggle above.

### Changed

- **A long press now means three different things, and which one is decided by what
  is under your thumb.** On a **control** it still shows that control's label. On
  the **words of a quote** it now does nothing at all — which is the point, because
  that is how a phone selects text, and an app for keeping other people's sentences
  had no business spending that gesture on a menu. **Anywhere else** on a card,
  cover or poster — the empty space, the small print, the row the buttons sit in —
  it picks that card.

  This reverses a decision from 1.10.0, which said the press always meant the card's
  menu. Both halves of that were wrong and both are only visible with a thumb: it
  cost you text selection inside a quote, and it spent the gesture every photo grid
  and file manager already uses for multiselect on a menu that has a ⋯ button two
  inches away. Right-click and Shift+F10 keep the menu, so nothing was lost.

- **The corner checkbox is a tickmark**, and one drawing serves every board — a
  quote card, a book cover, a film poster. It stands on **every** card of a board
  with a selection running, not only the picked ones: the cards you have *not* picked
  are half the answer to what you are about to act on. It no longer sits permanently
  on every card on a phone, where there is now a gesture to reveal it with.

- The `go test` ceiling in CI rises from 10 to 20 minutes. The API suite alone runs
  twelve, because almost every test signs a user up and a signup is a real password
  hash; it had been sitting seconds under the old limit, where the next few tests
  anybody wrote would have tipped it into a timeout that reads as a hung test.

### Fixed

- **The favourites wall on Home holds still while you work.** Recolouring or sharing
  a favourite reloaded the list, and the list reshuffled on every load — so the four
  tiles on screen became four different tiles and the card you had just acted on was
  gone, which reads as the app losing your change rather than saving it. The wall
  still reorders, but once per **visit**: arrive on Home and it deals a new one,
  and nothing you do while standing on it deals another. Un-hearting one tile now
  leaves every other one where it was.

- The tile heights on that wall were re-rolled on every reload too, so a colour
  change made every quote on screen change height even when none of them moved.

### API

- `api_revision` 3. New: `POST /books|movies/bulk/delete` (one bin entry for the
  whole selection, quotes and all), `POST /books|movies/bulk/status`,
  `POST /metadata/fill`. `sticker_id` and `review` on the three quote bulk bodies;
  `review` on the two work bulk bodies. Every quote and work list row now carries
  `review_excluded`. Features named: `bulk-works`, `review-exclusion`,
  `metadata-fill`, `bulk-sticker`.

- Migration `0033` adds `review_excluded` to `books`, `movies`, `annotations`,
  `dialogues` and `utterances`. Five `ADD COLUMN`s, no table rebuilt.

## [1.11.0] - 2026-08-13

### Added

- **The next quote starts where the last one left off.** Six quotes off one page of
  one book used to be six full re-entries. A capture now remembers what it used: the
  same colour and the same tags with no expiry, and the same **work for half an
  hour** — long enough that you are still holding the book, short enough that
  tomorrow's quote cannot be filed under yesterday's. The picker shows the work it
  chose, so it is never silent about it, and the words themselves never carry over.

- **What the installed app gets from its own icon.** Long-press it for **Capture a
  quote**, **Daily quiz** or **Pending imports**. Tap a `.md`, a `My Clippings.txt`
  or a Bookcision `.json` in your file manager and it opens straight into import
  staging, in the window you already have. And the icon carries a badge of cards due
  plus imports waiting — set when the app loads, because nothing here wakes up on
  its own.

- **The login screen opens with a line.** A different one each visit. They are
  unattributed and written for the app on purpose: a login screen has no session to
  fetch your library with, and a bundled list of famous quotes is a bundled list of
  attributions from memory — which is the last thing an app about quoting people
  accurately should put on its front door.

- `GET /search/vocabulary` — the tags, genres, series, authors, directors, actors,
  speakers, shelf states and named colour categories a reader's own library uses.
  Groundwork for the search facets (`tag:`, `author:`, `colour:`): one call, meant
  to be held for the session and narrowed in the browser. Nothing on screen reads it
  yet.

## [1.10.0] - 2026-08-13

### Added

- **Select several quotes and act on all of them.** On the Quotes screen: tick the
  box in a card's corner, **Ctrl/Cmd-click** any card, or pick **Select** from the
  card's own menu — then a bar appears with what you can do to the lot. Recolour
  them, add tags, favourite them, or delete them. **Shift-click** extends the
  selection over the order they are in on screen.

  Once something is selected, a plain click on a card picks it instead of opening
  it. The mode is visible — the bar is up, the cards wear checkboxes and an accent
  ring — and clicking the last one off leaves it again, so there is no mode to get
  stuck in.

  **The count cannot lie.** Change a filter and the selection drops the quotes that
  left the screen, because a bar offering to act on twelve things has to be holding
  twelve things you could still look at.

- **Deleting a selection**, which is the one action here that asks first. It names
  the count and the kind and waits for you to type it — *delete 3 quotes* — and
  then the whole selection goes to the bin as **one entry with one Undo**, rather
  than forty entries and forty restores. It cannot be reached by a gesture: only by
  selecting, pressing Delete in the bar, and typing the phrase.

## [1.9.0] - 2026-08-13

### Added

- **Quote cards answer a right-click.** Anywhere on a card that is not one of its
  own buttons: right-click, or hold for half a second on a phone, or press
  **Shift+F10** / the Menu key — and the card's own menu opens where you pressed,
  with copy, share, edit and delete in it. Escape closes it and puts focus back.

  It offers the same list the buttons do, because there is now one list: a menu that
  quietly offered something the row did not would look completely normal on both.

  Two deliberate refusals. On the card's own buttons the gesture does nothing —
  holding the share glyph still shows you its label, which is what a hold means on a
  control. And if you have selected text inside the card, **the browser's own menu
  wins**: you wanted Copy, or Look Up, or Translate, and those are not ours to take
  away in an app about quoting things.

- **Standalone quotes can be bulk-edited**, and **any selection of quotes can be
  recoloured.** Annotations and dialogues had a bulk endpoint; standalone quotes did
  not, so a selection on the Quotes screen had nothing to act with. Colour became a
  named category in 1.7.1 and none of the bulk paths could set it — which was the
  most likely reason to select forty quotes in the first place.

  Nothing on screen uses the second half yet; the selection UI it is for comes next.

### Changed

- **The API handshake reports revision 2**, and names three new capabilities for
  native clients: `trash-bin` (so a client can offer its own Undo rather than
  treating every delete as final), `bulk-quotes` and `bulk-colour`.

## [1.8.0] - 2026-08-13

### Added

- **A thirty-day bin, so every delete can be taken back.** Nothing in this app has
  ever been recoverable. Deleting a book, a film or show, a highlight, a film line,
  a standalone quote — or a whole account — now writes it to a bin first, and it
  comes back exactly as it was.

  **Undo is in the toast**, right where the mistake happened. **Settings → The
  bin** is the slower way in: one row per deleted thing, with what it is, when it
  went, how many quotes travelled with it, and whether a picture is being kept.
  Open a row to read the quotes it is holding.

  A restore is not an approximation. The same ids, so a bookmarked URL still
  resolves; the same tags and colours; the same spaced-repetition history, so a
  restored quote is not suddenly a brand-new card; the cover or poster, which waits
  in a corner of the image store rather than being thrown away; and, for a book or
  a film, every quote under it. A book and its forty highlights are ONE entry —
  there is no way to end up with a quote whose book is missing.

  **Deleting a member is undoable too.** The account, the library, the vocabulary,
  the review history and the files go to the deleting admin's bin as one entry.
  Three things deliberately do not come back: browser sessions, paired devices and
  today's quiz — the first two are credentials, and re-arming a credential nobody
  chose to reissue is not a decision to make on somebody's behalf. Pairing a phone
  again is one scan.

  **Keep for 7, 30 or 90 days, or never**, per account, in the same card. "Empty
  now" is there because the real reason to want a shorter window is usually wanting
  something gone today — and it is the one act in this feature with no undo behind
  it, so it asks first.

  Two things worth knowing about how it works, because both are visible in how it
  behaves:

  It is a **snapshot**, not a "deleted" flag. The rows really are deleted, so no
  query, count, stat, export or search in the app has to remember to exclude them
  — which is the class of bug that shows a deleted quote in a quiz six months
  later. And the retention clock **only runs while the server does**: nothing
  expires on an instance that spends a fortnight switched off, and there is no
  timer or background job behind it — just a sweep on the first request of the day.

### Fixed

- **Ids are no longer reused, which also fixes something older.** SQLite hands out
  `max(id) + 1`, so deleting the newest quote and adding another gave the new one
  the old one's id. That is what would have made a restore collide, and it was
  already quietly wrong before the bin existed: the review schedule is keyed on
  that id with no foreign key behind it, so a reused id inherited the deleted
  quote's memory half-life, review count and lapse count. Every id is now allocated
  above a high-water mark that only climbs.

## [1.7.10] - 2026-08-12

### Changed

- **The share sheet opens on the picture.** The format row led with WhatsApp and
  kept Image at the far end of it. That was right while this dialog was the only
  way to get anything out of a quote, and wrong the moment copy became a glyph on
  the card: pasting text is now one tap that never opens this window. What the
  window is *for* is the picture — the one output that needs a skin, a portrait
  and a colour chosen before it is worth anything, and the only one you cannot
  get any other way. It is first in the row, and it is what you land on.

- **One way out of the share window, and a glyph to hand the picture over.** The
  footer's worded **Close** is gone: the window already has a × in its corner,
  and two doors out of one room is one too many. The picture's **Download PNG** /
  **Share / save PNG** button is gone too — its action is a share glyph in the
  header now, immediately left of that ×, because handing the picture over and
  leaving are the only two things anybody does here and they belong together.
  That also ends a button that named itself two different ways depending on the
  width of the window.

  Copying stays a worded button in both panels. Copying is not sharing: it goes
  nowhere, it needs somewhere to paste, and its ✓ is the whole feedback.

- **A favourite tile's buttons read like every other quote card.** The row under
  an expanded favourite went ♥ · colour · copy · share · ⋯ while every other
  quote card in the app goes ♥ · copy · share · colour · ⋯. Same row, same order,
  everywhere now.

  Its **Open book →** is a glyph too, and it is the glyph the navigation uses for
  wherever that quote lives — the Library for a highlight, the Catalogue for a
  film line, **Quotes** for one that belongs to neither. A standalone quote had
  no open button at all before, on the reasoning that it *is* the whole record;
  that was true about a parent record and false about a destination.

### Fixed

- **The credit in the corner of a shared picture sits on one line properly.**
  1.7.9 put the mark, "made with", the wordmark and the Bengali wordmark on one
  line and then aligned each of them slightly differently — the logo hung off the
  text baseline and floated a few pixels high, and the Bengali was lifted a pixel
  for no reason anybody could state. There is one baseline for all three words
  now, which is simply how mixed sizes are set, and the mark is centred on the
  cap-height band of those words, because a logo has no baseline to share.

## [1.7.9] - 2026-08-12

### Added

- **A copy button on every quote card, and share out of the ⋯ menu.** The row
  under a quote now reads ♥ · copy · share · colour on the left, with a single ⋯
  on the right holding edit and delete. Copy did not exist before, and share was
  a line inside that menu — which meant getting a line you had saved into a
  message was four acts: open the share sheet, pick a format, press copy, close.

  Copy writes the quote and its credit as plain text — no markdown, no
  asterisks, nothing to strip out at the other end — and it reads the same field
  choices the share sheet opens with, so it carries the author and holds back
  the page number and the save-date exactly as the sheet would. The two cannot
  drift; they are the same function.

  Edit and delete went the other way. They were three inline glyphs on a desktop
  and a ⋯ menu on a phone — the same control putting the same actions in two
  different places depending on the width of the window — and they are the two
  that change or destroy what you wrote down, so a sweep of the pointer should
  not reach either. One overflow now, at every width.

  The same row, in the same order, on a book annotation, a film dialogue and a
  Home favourite tile; the table views get the same four laid flat in their
  action cell.

- **Five stickers in the box.** A heart, a star and three faces — smile, wink,
  sad — arrive with the app, so pinning a seal to a quote no longer starts with
  going to find a transparent PNG somewhere. **Existing accounts get them too**,
  once, on the first start after this upgrade.

  They are ordinary stickers, not built-ins: rename them, or delete the ones you
  will never use and they stay deleted — including through the next restart,
  which is the half of this that needed the most care. They are copied into your
  own image store, so they leave with a deleted account and travel inside a
  backup archive like anything you uploaded yourself.

### Changed

- **A shared quote image signs itself.** The footer was the word "tippani" and
  nothing else, which names the app to somebody who already knows it and reads
  as a signature under words that belong to whoever said them. It now carries
  the Tippani mark, then "made with", then the wordmark — bottom-left, one line,
  in the same faint ink and the same corner as before, because branding on a
  picture you are about to post is branding you would crop.

  A picture of a quote is the one thing this app makes that leaves it, and by
  the third re-post nothing travels with it except what was painted in. The mark
  is *drawn* on the canvas rather than loaded from the app's icon file: an image
  file is a fetch, and the copy of the PNG that goes out is often the one
  exported half a second after the panel opened, before a fetch would have
  landed.

- **The "OK" chip under Metadata sources is gone.** It had three states and one
  of them said everything was fine. A badge that is only there when there is
  nothing to do about it teaches you to check a spot that is empty in every case
  that matters, and spends a row saying so. Silence is the healthy state now; a
  chip means a lookup failed, or that none has been tried since the server
  started, or that films are running on the shared built-in key or on no key at
  all. The heading's info dot says as much, and the row itself disappears when
  there is nothing to report.

## [1.7.8] - 2026-08-12

### Added

- **Names and titles capitalise as you type.** Every field that holds a name —
  Title, Author, Director/Creator, Series/Collection, Character, Actor, Speaker,
  the person rename box and your own display name — now upper-cases the first
  letter of each word while you type it. What the field shows is exactly what
  gets saved: the transform is on the input, not on the save path, so there is
  no second rule hiding behind the Save button that the form disagrees with.

  The rule **only promotes, and never lower-cases anything you typed**, which is
  the opposite of how genre chips are normalised and deliberately so. A genre is
  a word from a small vocabulary and can be re-cased end to end; a name cannot.
  "McDonald", "O'Brien", "Ian McEwan", "The KLF" and "DeLillo" are correct as
  typed, and a title-caser that lower-cases the rest of each word hands them back
  as "Mcdonald", "O'brien" and "Mcewan" — corrupted, and then saved, because what
  you see is what is stored. A word that already carries a capital anywhere is
  left alone entirely, which is also what keeps "eBay" and "iRobot" intact.

  Word boundaries are whitespace and nothing else. Promoting after a hyphen
  would fix "jean-luc" and break "e-mail"; after an apostrophe it would fix
  "o'brien" and turn "Schindler's List" into "Schindler'S List". Neither trade
  is worth making automatically.

  **And it yields.** The first time a change alters nothing but letter case —
  selecting the capital and typing it lower — the field decides the casing is
  yours and stops transforming for the rest of that edit. That is what makes
  "bell hooks", "danah boyd" and "k.d. lang" typeable at all. A capitaliser with
  no way to disagree with it would quietly rename the people whose names are the
  point.

  Description, quote, ISBN, ASIN, timestamp and the id fields are untouched —
  capitalisation is opt-in per field, not a property of every text input.

- **The TMDB and TheTVDB ids on a film or show can be typed, and steer the next
  search.** They were read-only, and the hint beside them said so: an id is what
  a re-sync pulls from, so it was written only by picking a match. That holds
  right up until the match is the problem. Search TMDB for *Persuasion* and you
  get four films with that name and no way to say which one you meant; the id
  is the one thing that distinguishes them, and it was the one field you could
  not touch.

  Both rows now edit like any other field, on the work page's **Details** panel
  and in the Metadata console's editor. With an id set, **Fetch metadata** and
  the poster search send it along with the title: the server fetches that exact
  record and lists it first, ahead of the title guesses, with the rest
  underneath and the pinned record shown once rather than twice. An id alone is
  enough — a title is no longer required to search.

  Two rules worth knowing. Emptying a field clears the id, and a save that never
  mentions the ids leaves them alone: everything else on that PUT is full-state,
  but a supplier id must not be wipeable by a client that has never heard of it.
  And typing an id another of your titles already holds is refused, naming the
  collision, rather than failing as the unique-index error it would otherwise be.

  Correcting an id changes nothing else on its own — the stored cast and cached
  payload still describe the old record until you re-sync, which is the point of
  fixing the id first.

- **`DEVELOPMENT.md` now maps the whole tree.** Its old `## The layout` was a
  nine-row table of the directories you were "most likely to touch", which left
  four packages — `auth`, `olog`, `updater`, `buildinfo` — with no mention at
  all, and answered none of the question a newcomer actually has. The new
  `## Where things live` names every package, every script, every workflow and
  every shared frontend module, with the rule stated in front of it: describe a
  directory, and name a file only where that file is the single place some rule
  is enforced. Ten interchangeable importers get their pattern and their
  registration point rather than ten rows that would be wrong on the eleventh.

  Around it, the sections a contributor needs before the map is useful: what I
  will and will not merge, above the fold, so nobody spends a weekend on a
  refusal; how the frontend and the backend actually meet, which the document
  never said; seven step-by-step recipes for the likeliest first tasks; and the
  four self-inflicted build failures with their fixes.

- **`scripts/doc-map-check.mjs`, and a CI step that runs it.** A map is worse
  than no map once it is wrong, because it sends someone confidently to the
  wrong place. The check asserts every path `DEVELOPMENT.md` names still exists,
  and that no package, script or workflow has appeared that it never mentions —
  which is the failure that matters, since a path that is *added* and never
  documented has nothing to trip over and so stays invisible.

### Changed

- **`docs/PLAN.md` is a decision log, not a design document.** It was the plan I
  wrote before building, kept roughly current afterwards, and it had quietly
  stopped being either. Parts described a system that was never built
  (precompressed assets, a single-writer connection); parts described one that
  had been rebuilt underneath them (the whole review-loop schema, the
  four-colour palette, `synchronous=NORMAL`); it listed four direct Go
  dependencies where there are three, pinned Go at 1.25 where `go.mod` says
  1.26, and cited its own §7, which never existed. A design document that is 80%
  true is worse than none, because from inside it there is no way to tell which
  80%.

  It is now 452 entries across seventeen sections, each with what was decided,
  the reasoning at the time, the alternative turned down, and — where it
  applies — a **Reversal** saying what I got wrong and what changed my mind.
  Every entry states that I approved it, and grades how firmly: "approved by
  silence" appears where a decision hardened by default rather than by argument,
  because that is the honest description of the per-user isolation assumption
  thirty migrations have now been built on top of.

  The structural point is that **a log is allowed to be wrong in public**. An
  entry recording a decision, and then recording that the decision was wrong,
  stays true forever — which is exactly the property the old document lacked.
  Nothing is deleted; the original is in git history, and several entries quote
  it against itself.

  Two conventions came out of the same problem. Evidence lines carry **paths and
  no line numbers**, because a line number is wrong within a release and a path
  is not; all 160 cited paths are checked to resolve. And roadmap sections are
  **named and linked, never cited by §number**, since a §number is a position
  and moves whenever the page is reordered.

  One section is new rather than mined: appearance as material — the two
  aesthetics, the six texture tiles, the `prefers-contrast` escape hatch, the
  self-hosted type, the curated category palette held clear of the accent range.
  A completeness pass found the most-argued family in the project had no home in
  any of the other sixteen, which is how a decision quietly becomes a taste.

- **The tree diagram is gone from `README.md`.** Two maps of the same repository
  disagree eventually, and these two already did. There is one now, in
  `DEVELOPMENT.md`, which README links to. The module-rename incantation moved
  with it, into the forking appendix where the rest of the fork instructions
  already lived.

- **The roadmap is only what is still ahead.** It had grown a "Next up" section
  that was really a release retrospective, and the backlog sections had absorbed
  the same habit — a shipped item kept in place with *Shipped in 1.7.0* beside it,
  a whole section kept "for the reasoning" after the feature landed. That reads as
  scorekeeping and it crowds out the question the page exists to answer. Both are
  gone: the retrospective, and every shipped item and section. The reasoning the
  shipped sections were being kept for belongs in `docs/PLAN.md`, which is the
  decision log, and it is not lost by being moved there.

- **The backlog is in priority order, in three bands** — Next, After that, Further
  out — instead of one flat list "in rough order". The order is the point of the
  page, so it is now stated rather than implied.

- **A section's § number is its position, and links to the issue that tracks it.**
  Those two facts belong together. The number moves whenever the order does, so it
  is worthless as a name and citing it in an issue title or a code comment is how
  documentation goes quietly wrong. The stable reference is the issue number
  beside it, and the position now links straight to it. The anchors follow the
  same rule: `#s8` became `#mobile-pwa`, so an inbound link survives a
  reprioritise. `docs/data/issue-map.json` is keyed on those slugs for the same
  reason — keyed on position, it would have repointed every section at the wrong
  issue the first time anything moved.

## [1.7.7] - 2026-08-11

### Added

- **A dialog commits from its header, everywhere.** Every edit dialog ended in a
  primary text button at the foot of its form. A dialog's two answers are yes and
  no; they belong together — so ✓ and ✕ sit as a pair in the top right, and the
  bottom button is gone.

  Splitting them was worse than untidy. The way OUT was pinned in the header and
  always visible; the way FORWARD was at the end of a form that scrolls, so on the
  longer ones the commit went off the screen and the cancel stayed. That is the
  wrong one to keep in view.

  It is arranged through a context rather than a prop, which is the part that
  matters: threading a form id and a validity flag through nine call sites would
  have been nine chances to forget one, and forgetting is invisible. A form inside
  a dialog finds its host, wears the id it is given, tells the host why it cannot
  be saved yet, and drops its own footer. Not one call site changed. The same
  forms rendered **inline** — the search modal's editor, the capture surface —
  find no host and keep their footer, because there is no header there to borrow.

  **The ✓ has to be earned.** Not every dialog holds a form: the work-details
  panel saves each field on its own. A ✓ there would look like it saves and do
  nothing, which is worse than no button, so it is absent until a form registers
  and goes away again when the form unmounts.

  It stays a real submit button bound by the HTML `form=` attribute — which is
  also what makes it the form's *default button*, and the default button is the
  only reason **Enter in a field still saves** now that these forms have no submit
  control of their own. Rewriting it as a click handler would kill Enter in every
  edit dialog at once, silently; there is a test that fails if a submit button
  reappears inside a form.

- **Quiz and Practice days report accuracy, not just volume.** The activity
  calendar shades a day by how many cards it holds. For Saves that is the whole
  fact. For the two review streams it answers half the question and paints the
  other half misleadingly: a day of twelve answers all wrong is the same shade as
  a day of twelve all right. Hovering a Quiz or Practice day now reads
  "8 answers · 75% correct".

  `quiz_sessions` has carried the right-answer count beside the tally since the
  review rework, so this is a second column on a row already being read rather
  than a second query.

  The half that had to be exact is the **absent** day. Rows exist only for days
  with answers on them, and a practice reset deletes those rows outright — so a
  reset history is nothing but absent days. Those read "no answers", never "0%
  correct", which would be a claim about a session that did not happen. An empty
  stream now says so as well; a reset used to leave a full grid of grey dots and
  no word about why, which reads as a chart that failed to load.

- **A category name is fifteen characters.** Twenty-four was a number nothing was
  built to hold — see the wrapping fix below. The cap is now what the Stats
  breakdown's label column can hold outright, and the column's ceiling is computed
  from the same constant, so the two cannot drift apart again. Every built-in name
  fits with room over.

  Lowering a cap is not retroactive, and pretending otherwise would have been the
  bug: a name stored under the old limit is still in the database and is still
  served. The client caps on the way in — once, where every reader picks the value
  up — so the pickers, the group headings, the Stats column and the Settings field
  all say the same thing, and the first save that field makes writes the capped
  value back. Counted in code points, because the server counts runes.

### Changed

- **The timeline is a dot plot.** It was one stacked bar per bucket, works at the
  foot and quotes on top, and the stacking is what made it hard to read. Only the
  bottom segment of a stack starts from a common baseline, so the quote counts —
  what anyone opens the chart for — each began at a different height and could not
  be compared across buckets by eye. And the two series were being **added**: a
  work and a quote are not two of the same thing, so the height the sum produced
  was a number about nothing in particular.

  Two columns of dots from one floor now, quotes in the accent and works in the
  muted ink, never summed. Both share **one scale**, because two scales in one
  frame is two charts wearing a disguise. Dots also make the unit explicit in a
  way a bar cannot: the count is something you can read off by counting, and the
  legend says what one dot is worth once a library is large enough that a dot has
  to stand for more than one. Anything at all draws at least one dot, so a decade
  holding a single book is never mistaken for the empty column that means a gap in
  time.

  A standalone quote raises the quote column and not the work one — it came from
  no book and no film, so there is nothing for it to count as.

- **Backup & restore was explaining the same consequence three times**, and
  metadata sources had a status word trailed by two dots about something else.

  The backup card carried two info dots; the second said restoring replaces
  everything and logs everyone out, which the restore dialog already says in red at
  the moment it applies. A card that explains the same thing three times is not
  being three times as careful — it is teaching you to skim. One dot now, and two
  lines of standing prose went with it: "the archive kept here" was the toggle's
  own "This server" said again one line below it. Nothing safety-critical was cut.

  Metadata sources read as a chip, a dot, sometimes a second chip, and a second
  dot — so with a custom TMDB key saved, what was left was the word "Untested"
  followed by two explanations of services the word was not about. Both blurbs are
  in the heading's dot now and the chips travel alone. The chips themselves stay:
  they are live state, not decoration.

### Fixed

- **A work's header on a phone had nowhere to put anything.** The reading status,
  the read counter, the progress track, the author and the year all arrived
  jumbled on a book, film or show detail.

  None of them was misplaced. The header floats the cover and lets everything wrap
  around it, which is exactly right in a 500px column — text reflows natively,
  stays selectable, needs no measuring. In a 320px column that same float leaves a
  ~150px gutter, and eight independent things wrap into it one after another, so
  identity and state come out interleaved.

  The phone stacks instead, in a stated order and the same order for every kind of
  work: **what it is** (cover, title, author, year) · **where you are** (shelf
  state, read count, then its own full-width track) · **what it is to you** (the
  heart and the tags) · **what it is about** (genres, description). The progress
  track moved to the end of the shelf row because its 168px minimum was breaking
  the row around itself, and the cover drops to 96px because here it identifies
  the work rather than being the subject of the screen.

- **The shell's accent controls were the only ones wearing flat colour.** Every
  accent-filled control wears the accent grain — leather on paper, rubber on film
  — except the ones on the shell, which had none: the ＋ Add pill, the search and
  help pills beside it, and the user chip, sitting next to a toggle thumb and an
  active filter chip that both carry it.

  **And the mobile selection ignored the theme entirely.** The bottom bar's active
  item and the drawer's active row were a flat 13% accent wash — the one selection
  state in the app that was the same rectangle whether the aesthetic was paper or
  film. They use the filter chip's material now, so a selected nav row and a
  selected filter chip are made of the same thing.

  Both new surfaces join the `prefers-contrast` / `prefers-reduced-transparency`
  block that drops every decorative layer, and there is now a test that reads the
  stylesheet and fails when a textured surface has no entry there — or when an
  accent-filled control has no grain at all.

- **The favourite heart sat outside the row that holds every other mark.** On a
  film or show dialogue it was rendered twice and never where a book annotation
  keeps it: once beside the quote, and again in the credits line but only when a
  sticker was attached, because the seal defaults to the same corner.

  That second copy is the tell. Moving a control depending on whether an unrelated
  feature is in use is a workaround for the control being in the wrong place. One
  heart now, leading the action row, same order as the book card — the stylesheet
  had already assumed exactly that.

- **The Quotes glyph was drawn smaller than the tabs beside it.** Not a different
  weight — a smaller footprint. A bare pair of quotation marks spanned 13×10 of
  the 24 grid, between an open book spanning 17×15 and a film reel spanning 17×17.
  Nothing looked broken; it looked small, which is a complaint nobody can act on
  until it is measured.

  The marks are inside a square speech bubble now, filling the box like their
  neighbours — and the bubble is not only packaging, since a line somebody said is
  what the three screens it fronts have in common. The icon test measures
  footprint as well as identity now.

- **A favourite you could not recolour, and a person named twice.** Recolouring a
  quote was possible everywhere except the screen that shows your favourites; the
  quick-pick is there now, in the same place and order as on every other card. A
  film line's colour had also never reached Home at all, so every dialogue tile
  wore the default yellow bar whatever colour it actually is.

  Expanded, the tile drew the credited people twice — once as faces and names in
  the meta line, once as the clickable chips below. The faces are collapsed-only
  now and the expanded line no longer names them.

- **A selection ring drawn around the only dot on screen.** The colour picker
  collapses to a single trigger inside a narrow card, and that trigger wore the
  selection ring — an accent outline distinguishing nothing from nothing, which
  reads as a focus state that will not go away. The dots inside the open list keep
  it, which is the case it was drawn for.

- **Colour category names wrapped in a column cut too narrow for them.** The Stats
  breakdown sized its label column at 7px per character; `.mono-label` is 11px IBM
  Plex Mono in caps with .14em tracking, which is about 8.4. The estimate was a
  fifth short, so any name past about eight letters wrapped — with the space to
  avoid it already there and simply not asked for.

- **The demo's Stats page had no timeline, and a reset that reset nothing.** The
  demo shim sent no `timeline` at all, so the published demo has shown the card's
  empty state since the chart shipped in 1.7.4 — with every book and film in the
  demo library carrying a year. And a practice reset zeroed the score while the
  calendar went on serving a full synthetic year of dots beside it.

- **The roadmap had stopped at 1.5.0**, and AI.md claimed a test count that had
  drifted by two thirds. The roadmap now covers what 1.6 and 1.7 actually were,
  including the six-colour release that its own §1 note had predicted would be
  free and was not. AI.md says how to recount rather than replacing one number
  that will rot with another.

## [1.7.6] - 2026-08-09

### Fixed

- **A dropdown that stays on the screen.** On a phone, opening a dropdown near
  the bottom of the screen put its options below the fold — so choosing one
  meant scrolling the page to go and find a menu that was supposed to be in
  front of you.

  Every popup in the app placed itself the same way, `position: absolute; top:
  calc(100% + N)`, which is correct exactly once: when there is room below the
  trigger. Nine call sites, five stylesheet rules, one assumption none of them
  ever stated.

  CSS cannot fix it, and not for want of a cleverer rule. To know it is off the
  screen a popup has to measure the **viewport**, and an absolutely-positioned
  element is placed against its offset parent, which knows nothing about where
  on the page it ended up. So placement moved into JS and the popups moved into
  portals — a card that sets a container or a transform is a containing block
  *and* a stacking context, and a popup inside one cannot escape it however it
  is positioned.

  Three behaviours now, in the order they matter on a phone. It **flips** to the
  other side when the preferred one cannot fit and the other is roomier —
  deliberately not "flip whenever it does not fit", which thrashes between sides
  when neither fits. It **clamps** both axes, so a menu opened from a corner
  slides along the edge instead of hanging off it. And it **caps** its height to
  the room actually available, so a long list scrolls itself; this is the half
  that matters most, because flipping alone still leaves a forty-option list
  taller than the window.

  Applies to every dropdown at once: the selects, the multi-selects, the tag and
  work suggestion lists, the ⋯ menus, the shelf chip, the calendar, the import
  format picker, and the colour picker — which had a bespoke version of this
  written for it earlier the same day, now deleted.

  One workaround disappeared with it. A rule existed to raise a whole card above
  its neighbours whenever a menu was open inside it — dragging its cover, its
  quote and its shadow up too — because an absolutely-positioned menu cannot
  escape its card. Nothing is inside anything now.

### Added

- **Something for a search engine to read.** Tippani did not come up in a search
  for its own name, and the reason was not subtle: there was nothing to return.

  The published site had one page at its canonical URL and that page was the
  demo — an empty div until JavaScript runs, titled `tippani`, with no
  description, no social preview, no sitemap and no robots.txt. A crawler found
  a single lowercase word competing with the Hindi and Bengali word the project
  is named after, and no text at all.

  So the site root is a real page now, and the demo moved one level down to
  **/demo/**. It had been the other way round, which put the least readable page
  in the repository at the most important URL. The new landing page says what
  the thing is in prose: what it is for, what it does, what it costs to run,
  what it looks like, and where it is going. The demo is still one click away
  and still rebuilds on every UI change — it is simply no longer the front
  door.

  With that in place: a real title and description, Open Graph and a Twitter
  card so a pasted link unfurls, structured data marking it as free self-hosted
  software, a sitemap and robots.txt generated by the same job that publishes
  the pages, a social image served from an origin that can actually be fetched,
  and a 404 that offers the way back.

  **The demo's install manifest had been broken since it was added.** Its
  start URL, scope and all three icon paths are root-absolute, which is right
  for the self-hosted app and wrong for a site served from a sub-path — they
  pointed at the domain root and 404'd. The build rewrites `index.html` and
  never a copied asset, so nothing caught it. The app's own copy is untouched,
  because for the app it was never wrong.

### Internal

- Every local link on the published site is now checked before the site
  deploys, and the deploy fails if one does not resolve. The site is assembled
  by copying rather than by a build that understands links, so every failure was
  silent: a copy step that stopped running, a screenshot renamed on one side of
  a move, a relative path written for the old layout. Moving the demo made the
  last one live. It also refuses to pass if it finds fewer than ten links,
  because a sweep whose extractor broke reports a clean site by looking at
  nothing.

- The placement arithmetic is a pure function tested on its own, because jsdom
  applies no layout and reports every rectangle as zeros — a test driving it
  through the DOM would be asserting that nothing fits inside nothing.

- The stylesheet invariant added a day earlier is inverted to match: it no
  longer checks that two composed rules avoid contradicting each other, it
  checks that no popup places itself at all. Writing one back fails three tests
  by name. It also caught a real fault while being written — a panel that only
  rendered correctly because an inline style was outranking a stylesheet that
  had been quietly wrong.

- 851 frontend tests.

## [1.7.5] - 2026-08-09

Two things 1.7.4 shipped broken, and the CI change that stops the next one
hiding.

### Fixed

- **The colour list opened as a three-pixel sliver.** 1.7.4 gave a quote card a
  collapsed colour picker for the case where six dots will not fit, and it has
  not been usable since it shipped — opening it produced a thin line where the
  named list should have been.

  The element carries two classes, and that was deliberate: `.token-menu` is the
  app's popover look, and reusing it is why the list had the right border,
  shadow and entrance animation for free. What was missed is that `.token-menu`
  also *places* itself, because it was written for a dropdown hanging under a
  text input — `top: calc(100% + 4px)`. The new rule set `bottom` to open
  upwards and never cleared the `top`.

  Nothing conflicts in the way CSS usually conflicts, which is why it survived
  review. Neither declaration loses. For a box with `height: auto`, `top` and
  `bottom` both set is not a tie to be broken — CSS solves for the height, and
  against a 44px anchor that came out near −60px. What reached the screen was
  the border, twice, with nothing between.

  It is a real popup now: portalled to the page, anchored by measurement,
  flipping downwards when there is no room above. That part is not tidiness. The
  collapsed form is chosen by a container query, and a container is a stacking
  context — so even at the correct height the list would have slid *under* the
  card beside it the moment it passed the card's edge. A menu is not part of the
  card it belongs to.

- **A searched quote arrived without its colour.** Colour stopped being
  decoration in 1.7.1, when the six slots became categories you name. Every
  surface carried it — the Library, a work's page, the export, the share card.
  Search did not, and on an odd seam: standalone quotes were built later and
  built right, so they carried their colour, while every book annotation and
  every film line came back with none. A library sorted into six named
  categories looked uncategorised the moment it was searched.

  The quieter half is worse. The share sheet opened from a result reads the
  colour off the row, so sharing a quote you found by *searching* dropped its
  category line while sharing the same quote from its book kept it — the same
  quote, two different exports, depending on how you got there.

  Result rows now wear the same left bar the card they stand for wears. A row
  whose colour is unrecognised falls back to the plain border rather than to
  slot 1, because slot 1 is a category somebody may have named and painting an
  unknown row with it would assert a choice nobody made.

### Internal

- **The race sweep had forty-three seconds of headroom.** The 1.7.4 run passed,
  so this is not a failure — it is the number underneath it: 29 minutes 17
  seconds against the 30-minute timeout raised for it one commit earlier.

  The cost is specific to this app. `-race` needs cgo, and the usual assumption
  — that the detector instruments your code and the C library underneath is
  opaque to it — is backwards here, because the SQLite driver is pure Go. The
  detector instruments the entire database engine, in a suite whose premise is
  that there are no mocks and every test drives a real database file.

  Raising the number again buys one release and makes every push wait half an
  hour, and a job that slow is a job people stop reading — which is how the
  previous breakage survived eight releases. So the five locking tests, which
  are the reason `-race` was turned on at all, run raced on **every push** in
  about two minutes, and the whole-suite sweep runs **nightly**. Plain tests run
  on every push as before.

  The job now asserts that each named test actually ran. A filter that matches
  nothing still exits 0, and `ok (0 tests)` reads exactly like `ok` — a false
  green that already cost an afternoon during 1.7.4.

- A stylesheet invariant, in the shape the scroll-containment sweep established:
  every composed popup class is checked for offsets that fight. jsdom applies no
  layout, so all six existing tests over that colour picker passed while it was
  broken — the elements were present, correct and accessible, in a box with no
  height. Both new checks were confirmed to go red against the real 1.7.4 rules.

- 828 frontend tests, and two Go tests asserting a searched quote's colour
  across all three kinds at once — the bug was that two of the three disagreed
  with the third.

## [1.7.4] - 2026-08-09

### Added

- **A book can be older than the year 1000.** The year field refused anything
  below it, which is not a rounding error: it refused the Meditations, the
  Analects and the Gita outright. An app for keeping quotes from things worth
  quoting could not record when its oldest books were written.

  The floor is now −4000 and a negative year is BCE. Almost nothing had to
  change for it — the columns have been INTEGER since the first migration and
  carry no constraint, so −380 already stored and already sorted correctly, and
  0 has always meant "no year recorded", which is exactly what the era needs
  since there is no year 0 between 1 BCE and 1 CE. Not one existing row changes
  meaning.

  On screen it is **written, not signed**: −380 reads as **380 BCE**, because a
  minus in front of a year reads as a countdown. CE stays unmarked — saying
  "1954 CE" about a novel is pedantry. The field reads back everything it
  writes, so **380 BC**, **-380**, **c. 380 BCE** and **circa 380 BCE** all
  arrive at the same year, and **c.** marks an estimate without ever moving the
  work on a shelf or a chart. A text written over a century does not have a
  publication date; it has a contested guess, and saying so is more honest than
  printing a year nobody can defend.

- **A timeline, readable by decade, century or year.** When the library's works
  are *from*, as opposed to when they were saved — the activity calendar already
  answered the second, and nothing answered the first, although every book and
  film has carried a year since the first migration. A quote sits at its work's
  year, so a line copied out of the Analects last week belongs at 479 BCE.

  The scale is selectable because a library spanning two and a half millennia
  and a shelf of films want different bucket sizes and neither is a sensible
  default for the other. The **empty** stretches are drawn deliberately: two
  bars side by side would read as two adjacent periods rather than two thousand
  years apart.

- **A reading history you can correct.** The read log could only ever be written
  as a side effect of a status change, which records what is happening now and
  is hopeless for what already happened — a book read three times over fifteen
  years had one row at best, and there was no way to say "I finished this in
  2019" about anything already on the shelf. 1.7.2 then made that log sort the
  Library, so a log you could not correct became a shelf order you could not
  correct.

  Add a past read, fix a date, delete a mistake. The read still **open** is the
  one exception — it is what keeps the status and the log agreeing with each
  other, and finishing or abandoning it is already one tap away in the chip
  above, so it says so rather than offering a second route to a state nothing
  can resolve.

- **Four more superlatives**: the person you quote most, the person you heart
  most, the decade you return to, and who you remember best against who keeps
  slipping away. The last two needed no new query at all — they have been
  computed and sent on every request since the recall work landed and nothing
  had ever drawn them.

### Changed

- **One book, assembled from every source that knows it.** An ISBN names one
  book, so two providers describing it were never two choices — they were two
  partial accounts of one object, and picking a row meant inheriting that row's
  gaps. Pick Google and you got the blurb, the large cover, and the year the
  paperback was printed. Pick Open Library and you got the year it was written
  and no description.

  A lookup by ISBN now returns **one merged record**, best-of per field: the
  earliest year (a work cannot have been written after an edition of it), the
  higher-resolution cover, the longer description, the fuller credit, the work's
  title rather than the edition's, and both providers' subject lists rather than
  one. On a modern paperback the year is a four-year quibble; on the Meditations
  it is eighteen centuries, and a shelf sorted by publication year was sorted by
  when the reprint went to press.

- **One person, however you credited them.** The breakdowns asked "who" four
  times — authors, directors, actors, speakers — and got four half-answers.
  Somebody with books here and films here was two rows in two sections, each
  carrying part of their work, and no section could answer "who do I actually
  quote". There is a **People** breakdown now, one row per person whatever the
  role, which is what the storage has said since it stopped keeping a person
  once per job.

  **Occasions is gone.** It was added in 1.7.2 because the server had been
  computing it and nothing rendered it — which was an argument about the gap,
  not about the value. An occasion is a locator, and a leaderboard of rallies
  answers nothing the speaker list does not answer better. The count survives as
  a speaker's works.

- **The Metadata sources settings stopped introducing themselves.** Three
  headings each announced a single field that already named itself; "Books"
  above "Google Books key" is the same word twice. The status chips — the one
  thing those headings genuinely carried, since a key field only knows whether
  it is filled and not whether lookups work — moved into one row, and the fields
  became a single tighter list.

### Fixed

- **Six colours would not fit on one line.** The stylesheet described this a
  release before it happened: the rule sizing the control on a quote card reads
  "♥ + FOUR blobs + ⋯ must fit a ~250px column", and 1.7.1 made the categories
  six. The dots pack closer now, and on a card too narrow for that the picker
  becomes the current colour with a chevron opening a **named** list — which is
  better than a cramped row would have been anyway, since the categories carry
  names you chose and six unlabelled blobs squeezed to fit are six things nobody
  can tell apart. The narrow layout shows more than the wide one.

- **A BCE year counted as no year.** The metadata completeness score asked
  whether the year was greater than zero, so the oldest books in a library would
  have been the ones it nagged about hardest.

### Internal

- **Both CI jobs had been failing on every push since 1.6.1**, and neither was a
  real defect. The Go job was hitting the default 10-minute per-package test
  timeout under `-race` and printing a goroutine dump that reads exactly like a
  deadlock; nothing was hanging.

  The frontend job was line endings, and the chain is worth recording because
  every link looks harmless. The committed `web/dist/index.html` held CRLF, CI
  builds LF, so the guard that proves the shipped UI matches its source failed on
  every line of a file whose content was correct. Normalisation should have
  prevented it — except the file contained a **lone carriage return**, from an
  autocrlf double conversion, and git's heuristic reads a lone CR as evidence of
  a binary file. So it classified the file as binary, which switched
  normalisation off, which meant the CRLF could never be cleaned up by the
  mechanism meant to clean it up. A `.gitattributes` now names the text types
  explicitly, because auto-detection is exactly what failed.

- A schema-equality test was comparing "every migration" against "every
  migration as of 0029", and would have gone on passing while comparing two
  different things. Two tests encoded the old year floor and were rewritten
  rather than deleted.

- 819 frontend tests.

## [1.7.3] - 2026-08-09

A recovery release. Nothing in the app itself changed. What changed is that a
downgrade can no longer happen silently, can no longer happen by accident, and
can no longer be mistaken for data loss.

### Fixed

- **An old build could open a database written by a newer one, and say nothing
  about it.** Migrations are forward-only, so the failure mode here is not an
  error — it is a *success*. The older binary looks for work, finds every one of
  its own migrations already applied, skips them all, returns cleanly, and serves
  an app in which every table added since its release does not exist. No warning,
  no log line, nothing to search for. What you see is a screen that used to have
  your quotes on it and now does not, which is indistinguishable from having lost
  them.

  It refuses to start now, naming both numbers: the schema version on disk and
  the newest one it carries. Stopping is the safe direction — the data is exactly
  as the newer build left it, and the remedy is to run that build again. Starting
  is the direction with no way back.

- **The image tag `latest` was claimed by whichever build finished last.** Which
  is only the newest release by coincidence: that ordering is build completion,
  not version. On 9 August an orphaned `v1.3.0` tag went up alongside `v1.7.2`,
  both fired the image workflow, `v1.3.0` built about two minutes slower on a
  colder cache — and `:latest` came to mean 1.3.0. Anyone tracking `:latest` was
  silently moved back four minor versions, onto a binary with no standalone
  quotes in it at all.

  `latest` and `X.Y` are pointers, and are now claimed by rank rather than by
  arrival: computed from the tag list, so an old tag rebuilt at any time can move
  nothing. `X.Y.Z` stays ungated and always publishes, because an immutable
  per-release tag is what recovery is done with — it is what was still correct
  while `latest` was wrong.

  The same accident had a second, unfired barrel: `X.Y` was ungated too, so a
  late `v1.7.1` build would have repointed `1.7` at the older image by exactly
  the same route. Both are gated.

- **The documented release command pushed every tag I had.** `git push origin
  main --tags` sends the whole local tag list, and `--follow-tags` sends every
  annotated tag reachable from the commit, which is all of them. Either will
  publish a tag made weeks ago and forgotten, firing its entire pipeline beside
  the one that was meant. That is how `v1.3.0` — created 4 August, never pushed —
  shipped on 9 August. The instruction now names the tag, and pushes one thing.

### Internal

- The guard was mutation-tested before it was kept: disabled, the test that says
  a future database is refused goes red. The tag ranking was replayed against the
  real tag list, including the pair that collided — `v1.3.0` scores `latest=false`
  and `1.3=false`, and would have moved nothing.

## [1.7.2] - 2026-08-09

### Added

- **A wide screen is used as one.** The page body capped at 1180px and so did the
  top bar, both as literals — 46% of a 2560px monitor, with the rest left as mat.
  One token now, read by both, because the moment they disagree the brand and the
  avatar stop lining up with the gutters of everything underneath them.

  Raising the cap alone would have made it worse: a board wants **more columns**
  on a wider screen, not wider cards, and a quote card 600px across is a worse
  card. So the cap steps and every step has a matching rung in a column ladder —
  a card stays roughly one card wide throughout. A 13" laptop is untouched;
  nothing below 1400px reflows.

- **Sort a shelf by when you last had it in your hands** — **Last read** in the
  Library, **Last watched** in the Catalogue. The read log has existed since 0024
  and nothing had ever sorted on it. The finish date if there is one, else the
  start: a book you are in the middle of has no finish date and is the one you
  touched most recently. Every outcome counts, not only *finished* — giving up on
  something in November is an answer to the question.

  Anything never logged sits at the end, alphabetically, which in a library built
  to hold quotes is usually most of it.

### Changed

- **The share picture no longer assumes your colour scheme.** A colour category
  is a note to yourself about what kind of thought a quote is; the person you send
  the picture to has no idea the scheme exists, so a blue stripe or a blue face
  reads as a design choice the card is making. The switch starts **off**.

  Changing that default meant retiring its storage key. The hook behind it writes
  on *mount*, so the old default had been stamped into local storage by the first
  render of the panel on every device that ever opened it — flipping the literal
  alone would have changed the default for nobody.

- **Each format's syntax reference moved behind an info dot.** It is reference
  material — read once, while deciding — and four lines of it standing permanently
  above the quote pushed the thing being shared below the fold on a phone. The dot
  is titled with the chosen format, so it announces as "More information:
  WhatsApp" and re-titles as you switch.

- **The Settings page stopped restating itself.** Six API keys each carried a
  permanent second line reading `•••••••••• saved` — a full row per key, restating one
  bit in a form that cannot be read, since a secret here is write-only and the
  server never sends it back. A floppy-with-a-tick beside the edit button carries
  the same bit in no space; the box for a new key appears only while you are
  typing one. A key that is *not* a secret keeps its value visible, because
  "saved" is the whole content of a stored secret and is not the whole content of
  `www.amazon.de`.

  The feature descriptions went with them — which services back a lookup is a fact
  about the app, not a setting — along with the chips that duplicated the row
  below them. What survives is the pair a key field cannot report: that lookups
  run on the shared built-in key although you have set nothing, and that they run
  on nothing and will 503.

  **Multi-author credits** is a section at the bottom of Metadata sources rather
  than a card beside it: a lookup hands back one credit string and that setting
  decides whether it names one person or two. **Colour categories** lost a line of
  microcopy that was the info dot's first sentence in shorter words, and sits
  directly under Metadata in every layout now — both cards answer "what is this
  thing labelled with", so one column reads as one subject.

- **Switching accounts looks like the log-out beside it.** Two ways out of an
  account, in one card, built to different plans: a heading over a full-width
  button here, a right-aligned button there. They are the same row now, and the
  form names the account you are leaving — the one fact it is about, and it was
  nowhere on it. Real labels instead of placeholders, and the reason the button is
  grey appears beside the button rather than only in a `title` attribute a touch
  screen has no way to show.

### Fixed

- **Words on a portrait backdrop could disappear into the photograph.** A
  photograph is not a background colour: it has its own lights and darks, and ink
  that reads cleanly on paper vanishes into a shoulder or an eye — not all of it,
  which would at least be obvious, but a word here and a word there, in the one
  artefact this app produces that somebody else reads.

  Every word on a backdrop card now carries a halo of the card's own surface
  colour, with **no offset**, so it is a glow around each letter rather than a drop
  shadow beneath it — the text is meant to be *on* the card, not floating above a
  picture. The colour comes from the skin being **drawn**, not the one on screen,
  because the picture's skin is chosen separately and frequently is not the app's.

- **Scrolling a popup also scrolled the page behind it.** Nine scroll containers,
  two of which declared `overscroll-behavior` — so reaching the end of a select
  panel, a tag menu, a mobile sheet or a share dialog carried the scroll into the
  page underneath, which was still moved when you closed the thing.

  The second half was worse than the report: CSS containment only governs a scroll
  that *started* inside the overlay, and eleven full-viewport overlays needed the
  page frozen behind them. Four did it. Widening the sweep from vertical scrollers
  to sideways ones then found one nobody had reported — the top navigation, where
  running off the end is the browser's back gesture, so a nav that navigates away.

- **Admin was a role you could take, not only give.** Any admin could revoke any
  other admin's rights: two admins, and whichever opened the page first was the
  only one left, with no seniority to appeal to and nothing to undo it with.
  Granting is something you do to others; revoking is something you do to
  yourself. Handing over is still one action each.

  The same rule applies to deleting an admin, or the first one is decorative —
  refusing to take somebody's rights while offering to delete the account they
  belong to is the same act, louder, and it takes their library with it. **An
  admin account can now only be removed after it steps down.**

- **The Stats page was about two of the three kinds of quote.** The server has
  counted standalone quotes since §24 — in the totals, the colours, the tags, the
  calendar, the recall states, and in two whole breakdown kinds of their own,
  *speakers* and *occasions*, computed and sent on every request and rendered by
  nothing. The header said "50 saved" when 57 were. And the counts row called book
  highlights "Quotes" while the nav has a Quotes tab meaning the standalone kind,
  so a tile borrowed a screen's name without counting it while the kind it was
  named after had no tile at all.

### Internal

- **Fifty-one mutations across the release, and three of them survived first** —
  which is the only reason they were worth running.

  Deleting a middle width step passed every assertion about the container cap,
  because they checked only that the staircase starts low and ends high; a missing
  tread is the same complaint at a screen size nobody named. The "last read"
  comparator's two explicit *unread goes last* guards turned out to be unreachable
  — `""` is a prefix of every string and the compare is inverted, so the direction
  was already doing their work, and an unreachable branch that looks like the rule
  is worse than no branch. And the server's *keep only real dates* filter could not
  be observed through the API at all, since a map miss and a stored empty string
  serialise to the same JSON.

- **A bug of omission needs a sweep, not a case.** The scroll fix is one CSS
  property, and the temptation is to add it to the popup that was reported. The
  defect was not a wrong value anywhere — it was that nobody had thought about
  chaining — so the test is an invariant over the stylesheet, with a named
  exemption list and a guard that it still matches something.

- `Settings.jsx` carried an unused second users list, with the same add and the
  same delete and none of the rules. Dead code that duplicates a live screen reads
  as the implementation.

- 785 frontend tests.

## [1.7.1] - 2026-08-09

### Added

- **Six colour categories, not four.** They arrive named — **Fact**, **Disagreed**,
  **Inspirational**, **Funny**, **Meta** — beside the first slot, which stays
  unnameable because it is the default an import writes when the source gave no
  colour. All of them are yours to rename, recolour and hide, and none of the
  names is stored until you change one.

  This is a **migration**, not a setting: `color` carries a `CHECK` on *five*
  live tables, SQLite cannot alter a CHECK, and four of those tables are
  foreign-key parents whose children cascade on delete. `tags` is the one
  migration 0018 explicitly refused to rebuild — it could not be left out here,
  because `tags.color` is validated by the same allowlist the quote colours use,
  so widening one and not the other would turn a green tag into a 500 on a valid
  request.

### Fixed

- **Standalone quotes never appeared in Home's favourites.** Home fetched two
  lists and merged two lists, and had done since before the third kind existed —
  the comment above the loader still said "both media". Nothing failed: hearting
  a standalone quote worked, the heart stayed on, the Quotes screen filtered by
  it, and the quote simply never showed up in the section that exists to
  resurface exactly that.

- **The share image's portrait control said "Off" when it meant "Chip".** The
  backdrop has always replaced the small credit chip rather than joining it — a
  thumbnail crop of the same photograph beside a full-height version of it reads
  as a mistake — so an Off/Backdrop switch was a Chip/Backdrop switch with one of
  its answers unnamed. Turning it "off" never removed the person from the card;
  it changed how they appeared. It says so now.

### Internal

- **Sixteen mutations against migration 0029, all killed** — the join-row parking
  removed, the restore removed, each FTS and review trigger dropped, an index
  dropped, a foreign key dropped, the CHECK dropped rather than widened, a column
  dropped from the copy, the ids not preserved, a scaffolding table left behind,
  and the `tags` CHECK left at four.

  One of them taught something by *surviving*. Removing the FTS index rebuild
  changed nothing: an external-content FTS5 index keeps its own entries, so
  dropping and recreating the content table does not clear them and pre-existing
  rows stay searchable either way. That is exactly the signal that a line is
  either unnecessary or untested — and it was the latter. What the rebuild
  actually repairs is an index that had *already* drifted, which is now what the
  test asserts.

- **Three existing tests used `green` as their example of an invalid colour.**
  They use one that will never be valid now: an invalid-input test whose input
  quietly becomes valid asserts nothing, and all three would have gone on passing.

- The Home favourites test reads the loader out of the source rather than
  rendering it, because the bug was an absent *fetch* — a render test asserts what
  a component does with the data it was given, and this one was never given it.

- 713 frontend tests.

## [1.7.0] - 2026-08-08

**The four colours have names.** And the daily quiz can finally be told which
kinds of quote to draw from — which it turns out it was already drawing from.

### Added

- **Colour categories.** A quote's colour is the top of the hierarchy: tags say
  what it is *about*, its colour says what *kind* of note it is. Name the four in
  Settings — *fact*, *disagreed*, *inspirational*, whatever you actually mean by
  them — give them colours from a curated palette, and put away the ones you do
  not use. Every picker, filter, group heading, toast and stats breakdown then
  speaks your words instead of "blue".

  **What is stored never changes.** The value in the database and in every
  Markdown export stays `yellow` / `blue` / `pink` / `orange`, so a rename cannot
  break a round trip — there is a test whose entire job is to prove an export is
  byte-identical before and after one, because a year of highlights that stopped
  importing would be discovered by the person re-importing them.

  **The first colour is deliberately not nameable.** It is the column default,
  and what an import writes when the source named no colour, so a yellow quote
  may be yellow because you chose it or because nobody chose anything — nothing
  can tell those apart, and naming it would silently label every unmarked quote
  you have ever imported. Its colour is presentation and stays yours.

  **Hiding a category never changes a quote.** It comes out of the pickers; a
  quote already wearing it keeps it, keeps its name and keeps its colour. The
  alternative is the app editing your library to match a preference you were not
  thinking about it with.

  The palette shares no colour with the app's own accents — not merely avoiding
  the four exact values but leaving that whole neighbourhood alone, so a category
  can never be mistaken for an accent.

### Fixed

- **The daily quiz could not be told to include standalone quotes.** It was
  already including them — the deck has drawn all three media since standalone
  quotes existed, and the server has accepted a `quotes` scope all along. What
  could not say so was the Settings control, which offered *Books*, *Films &
  shows*, and a third option labelled **"Both"** that silently meant all three.

  The word undercounted what it did, and because the three were exclusive,
  "books and quotes but not films" was unsayable: narrowing away one medium cost
  you another you had not mentioned, and anyone who once picked *Books* had no
  route back to including quotes except by also taking film dialogue. The three
  are independent now. The last one will not turn off — an empty scope is a deck
  with nothing in it, which looks exactly like a deck you have finished.

- **The Stats colour breakdown truncated its own labels.** The label column was a
  fixed 52px, which fits "Yellow" and nothing a reader would choose. It sizes to
  the longest name.

- **The staging screen's bulk-colour toast named the token**, not the category —
  "colour → blue" while every card on the screen said "Fact".

### Internal

- **Two deck tests that should have existed for three releases.** Every previous
  deck test seeded a single medium, so "the deck serves standalone quotes" had
  only ever been asserted for a library containing nothing else — which is not a
  library anyone has. A mixed one (thirty book highlights, eight film lines, six
  standalone quotes) now has to serve all three across twelve draws, and every
  scope value the server accepts has to draw exactly what it names.

- **`parseScope` on the client mirrors `scopeFlags` on the server**, including
  the rule that matters most: an unparseable scope means *everything*, never
  nothing.

- A third copy of the four default hexes had accumulated while building this
  (theme.js, ui.jsx, index.css). `ui.jsx` derives from `theme.js` now; the two
  that remain are the two that genuinely cannot be one — the stylesheet's
  custom properties, and the real value a canvas needs.

- **Eleven mutations against the category rules, all killed** — two of them only
  after a change. The "the first slot cannot be hidden" rule was enforced in two
  places, so breaking either left the other covering for it: a rule guarded twice
  is a rule where neither guard can be shown to work.

- `labels.test.jsx` stopped mocking `theme.js` by hand-listing its exports, which
  broke the moment the module grew new ones. It shares the module registry
  instead.

- 694 frontend tests.

## [1.6.1] - 2026-08-08

**The portrait backdrop, corrected.** Three changes to the share-image option
1.6.0 added, all of them things that only became obvious once there was a card
to look at.

### Changed

- **The small credit disc steps aside under a backdrop.** 1.6.0 drew both, on the
  reasoning that the backdrop is atmosphere and the disc beside the name is the
  identification. That does not survive contact with an actual card: a 34px crop
  of the same photograph beside a full-height version of the same photograph
  reads as a mistake rather than as a second piece of information. The layout
  reclaims the space as well — the attribution line stops indenting past a
  cluster that is no longer there.

- **The portrait wears the quote's colour.** A duotone rather than a wash: the
  blend keeps the photograph's luma and takes the highlight colour's hue, so the
  face stays a face.

- **The quote's colour is an option, on both kinds of image.** One switch, because
  it is one decision: on a plain card the colour is the stripe beside the words,
  on a backdrop card it is the hue of the portrait, and *do I want this quote's
  colour in the picture* is the same question either way. It is never both at
  once — a stripe next to a portrait already wearing the colour is the same thing
  said twice, the second time louder. Persisted per device, beside the skin
  picker and the backdrop switch. Turning it off changes nothing about the quote.

### Internal

- The tint is applied while the buffer is still opaque and the fade mask after
  it, so the colour fades out *with* the face instead of surviving as a coloured
  rectangle where the face used to be. Both facts are asserted rather than
  assumed, and a mutation that swaps the order fails the suite.

- The `color` blend is a CSS blend mode, not a Porter-Duff operator, and a canvas
  that does not implement it ignores the assignment **in silence** — leaving
  whatever was set before, which is `source-over`. Painting a quote colour
  source-over is a flat slab across somebody's face. The property is read back
  rather than trusted, and a `source-atop` wash stands in when it did not take.
  The test drops `color` from what its canvas accepts and asserts the fall-back
  happens, because "it works in my browser" is the exact shape of claim that
  guard exists to stop anyone making.

- 658 frontend tests.

## [1.6.0] - 2026-08-08

**One vocabulary, and surfaces made of something.** This release is about the
app agreeing with itself. Almost nothing in it was found by looking at a screen,
because every screen was internally fine — the problems were all *between*
screens, which is the one place a person never looks and a test can look every
time.

### Added

- **Quotes is the same screen as the Library and the Catalogue.** It renders on
  the shared scaffold now, so it has the same filter row, the same counts, the
  same empty and no-match states, the same export confirmation and the same
  full-screen filter sheet on a phone. It was built as a flat list on the
  reasoning that a standalone quote has no parent, so there is nothing to group
  by. That was wrong in the same way the review-deck prediction was wrong: what a
  book gives you is a *title*, and this kind has four things of that sort — who
  said it, through what medium, where, and when. **Group by** offers all four,
  and names what is missing in each residual bucket, because a proverb has none
  of them.

- **The speaker on a quote card is a doorway.** Their portrait sits beside the
  name and tapping it opens who they were, the way an author does on a book. A
  line credited to two people shows both faces and two doorways. The share
  *image* has drawn speaker faces since 1.5.0 — `speaker` became a people kind in
  that release — so until now a speaker you had enriched showed their portrait in
  the picture you exported and stayed inert text on the card you exported it
  from.

- **The person, behind their own words.** A share-image option that bleeds the
  credited person's photo in from the card's edge and fades it out before the
  words start. One name enters from the left; two or more, and the first two take
  a side each with the quote between them, which is the shape a conversation has.
  It rides the same Author / Actor / Speaker tick as the small portrait discs, so
  turning the credit off takes the backdrop with it, and the control hides itself
  when nobody credited has a saved photo. Device-local, beside the skin picker.

- **Button labels, as a setting.** A button that carries a glyph can show its
  words beside it or drop them for the glyph alone. Auto shows them on a desktop
  and hides them on a phone, where the row genuinely stops fitting; the override
  works in both directions. Like the two cover-size sliders it sits beside, it
  belongs to the screen rather than to the account — how much room a row has is a
  property of the monitor, not the reader. Hiding the words never hides them from
  a screen reader: they are clipped, not removed, so an icon-only row still reads
  as *Share, Edit, Delete*.

- **A way out of the textures.** If your system asks for **more contrast** or
  **less transparency**, every decorative layer drops to zero — the page grain,
  the scenic backdrop, the card tiles, the dither, the shell tiles and the accent
  grain. Borders, colours and layout do not move, so what is left is the same app
  with the noise taken off. There was no escape hatch at all before this, and
  `.grain-overlay` is a fixed layer at `z-index: 60`: it multiplies over every
  glyph, every quote and every input on the screen. The textures are the whole
  point of the design and they are not free. This is the roadmap's high-contrast
  item arriving early, because the alternative was shipping six more textured
  surfaces with no way to turn any of them off.

### Changed

- **One glyph per meaning, at one weight.** Four icons in the set were another
  icon. `IconShare` and `IconUpload` were both a tray with an arrow in it,
  differing by about a pixel and a half — and they appear in the same rows, since
  a quote card offers share and the tag manager offers upload. `IconExport` and
  `IconMetadata` were the same three strokes at coordinates half a unit apart,
  sitting two buttons apart on the Metadata console, one pulling data in from the
  sources and one pushing the library out to a file. Share is the node graph now
  and Metadata is an arrow landing *inside* a record card, which is what fetching
  metadata does.

  The nav had its own copy of the set, with its own stroke weight, so the app
  drew a magnifier, an open book and a tray-download twice each — once at 2.0 and
  once at 1.85 — and the **Library tab was the identical open book the "currently
  reading" cover badge wears**, on screens that show both at once. There is one
  set now, one weight, and Library is spines on a shelf.

- **A repeated action is a glyph; a one-off keeps its words.** An action that
  appears once per row or once per card is something you learn on the first hover
  and never read again. An action that appears once on a screen keeps its words,
  and primary submits and destructive confirms keep them at every width.

  `QuoteActions` drew icons on a phone and the words *share edit delete* on a
  desktop — the only place in the app where one control named its actions
  differently depending on the width of the window. The tables drew the same
  three actions again as *share edit **del***, and `del` is the tell: one action,
  two names, four files apart, because somebody once needed the column narrower.
  The Metadata console's rows read *Close · Close · Open* whenever both their
  panels were open, which names neither thing being closed; they are latched
  glyphs now, saying it where a toggle should.

- **One way to close a window** — two, precisely, and deliberately. There were
  five: a literal multiplication sign at font-size 24 in three modals, a
  hand-rolled cross at a different stroke weight in the lightbox, a *Close* ghost
  button in four dialog headers, a *Done* ghost button in the share dialog's
  footer doing the identical job as the *Close* in its own header, and a back
  arrow in the mobile sheet. Nothing was wrong with any one of them; what was
  wrong was that dismissing a window meant finding whichever one *this* window
  used. A window over the screen closes with a ×; a full-screen sheet, which *is*
  the screen, goes back with an arrow.

- **`Export all` did not export all.** All three list screens post the filtered
  view, and the confirmation dialog has always said "N in view". The button above
  it said *Export all* and the help said "the whole library" — the last survivors
  of the whole-collection export they replaced.

### Fixed

- **The Catalogue's cards were wearing nothing.** `.film-frame` was the only card
  primitive in the app with no material at all: no texture tile, no dither, and
  no answer to the aesthetic toggle. Its own CSS comment had promised the
  material for three releases. Film **posters** were not cards either — a bare
  bordered span with the card's shadow bolted on, while a book cover sat in a
  hand-card, on two boards built from the same component and one tap apart.

- **The bar the drawer slides out of.** The shell-texture rule named the drawer
  and the floating bottom bar and claimed in its comment that they "were the only
  bare surfaces left in the app". They were not: the top bar, the phone's top
  bar, the sticky page bar and a mobile sheet's header and footer had nothing. So
  on a phone the drawer was wood and the surface it emerged from was plastic. Six
  surfaces, one substance.

- **The sticker button ignored the aesthetic.** It wore leather grain, an ink
  border, uneven radii and a half-degree tilt under *both* skins, while the
  primary button it is meant to match has been aesthetic-aware for releases — so
  under film, Settings, Profile, the work-detail pages and the tour showed tilted
  leather stickers and every other screen showed level rubber, from one
  component.

- **One grain, one scale.** The same fabric was tiled at three different sizes on
  three controls that share a filter row and are meant to read as one family: 150
  px on a primary button, 130 px on a toggle thumb, 120 px on an active filter
  chip. Tile scales are named by role now.

- **Colours that were written down fifteen times.** The ink that rides on an
  accent fill appeared verbatim in fifteen rules — fifteen answers to one
  question, agreeing by coincidence. The four highlight colours existed in *four*
  places: the stylesheet, `ui.jsx`, the staging screen and the stats screen. Two
  remain, because a canvas cannot read a CSS custom property and the share image
  is drawn on one, and a test asserts they agree — drift there means the blue you
  see and the blue you *share* are different blues, and the shared one is the
  artefact that leaves the app. The modal scrim was written inline at ten call
  sites across nine files.

- **A promise with no implementation.** The stylesheet declared that "every
  filled surface gets a vertical gradient" and shipped three utilities for it, of
  which one had a single call site and two had none at all — while every raised
  surface in the app was flat. The `.account-modal` was the one dialog that was
  not a card.

- **Smaller texture lies.** The card dither was keyed to *prefers-reduced-motion*
  — for a layer that does not move. An active tab's radius was overridden later
  in the same layer and had never once been drawn. The paper primary's tilt was
  declared twice. The Settings preset previewed a card at a different grain
  strength than the card. Placeholders and progress bars had no aesthetic
  variant, making an unfetched cover the only rounded rectangle on a film board.
  And the scenic-background comment still described the CSS data-URI book-spines
  that the texture tiles replaced, pointing at a `textures/README` that is not
  there.

- **The Catalogue never documented its group-by**, which the Library has
  documented since the control existed.

### Internal

- **Three new invariant tests, and each found something on its first run.**
  `icons.test.jsx` compares every exported glyph with every other one — both
  exactly and with all coordinates stripped, so a near-miss cannot hide behind a
  rounding nudge — and asserts every tab in all four nav lists resolves to a
  glyph. `help.test.jsx` reads the *source* for control labels rather than the
  help file, because a doc test that only reads the docs agrees with itself
  forever. `palette.test.jsx` pins the two surviving copies of the highlight
  colours together. Plus `button-labels.test.jsx`, which caught a bug while being
  written: the class that squares a collapsed button to 44 px was set on any
  button with a glyph rather than on one whose words can disappear, so the first
  keep-your-words button to carry an icon would have been crushed to icon width
  with its text still inside. Eleven of them arrived in the same release.

- 651 frontend tests, up from 413.

## [1.5.2] - 2026-08-08

**Four things that were quietly not working.** None of them threw, none showed
up in a test, and two had been wrong for several releases while the gate that
should have caught one of them reported success.

### Fixed

- **The UI glossary had been rendering every sample unstyled.** That page exists
  to show real components styled by the same rules the app runs on. Its opening
  comment named the `<style>` tag in its own prose and never closed, so the first
  comment-close in the file was the one ending the *next* comment — and HTML
  comments do not nest. The entire inlined stylesheet was commented out.

  Two things hid it. `scripts/glossary-css.mjs` finds its block by searching for
  the tag, and the first match in the file was the mention inside the comment, so
  since 1.4.0 — the release added to stop this file rotting — the generator had
  been refreshing the stylesheet *inside a comment* on every run. And `--check`
  passed the whole time, because the bytes it compares are exactly the bytes it
  wrote. A gate that only ever reads its own output cannot fail.

  The generator now refuses to write into a comment rather than doing it
  silently. The comment's opening claim was also false: it said there was no
  build script, and there has been one since 1.4.0.

- **A quiz option you could not finish reading.** In the quote direction the
  Daily Quiz shows four passages and asks which is from the work on screen. The
  options were cut to 140 runes server-side with an ellipsis — about three lines
  on a phone — so on any quote longer than a sentence you were asked to choose
  between four passages whose endings you could not read, and no amount of
  tapping would show them.

  The whole quote is sent now; the client clamps it and offers its own expander,
  as a **separate button** beside each option. Choosing an option answers the
  question, there is one shot per card and the grade posts immediately, so an
  expand gesture sharing that hit area would eventually grade a card because
  someone wanted to finish reading it.

- **Settings cards moved while you were reading them.** The page used the
  height-packing masonry every board uses, which places cards tallest-first onto
  the shortest column. Two cards there change height after they load: Updates
  when a check finds a release, Backup when an archive exists.

  The worst case is the one that sounds safest — a phone, where there is one
  column and the columns therefore cannot change. The tallest-first *order*
  still can: you tap "check for updates", the answer arrives, the card grows, and
  it is re-sorted somewhere else on the page. The layout is written down now
  rather than measured, so a card that grows stays where it is.

- **The drawer's avatar did nothing, and Profile had two entries.** The comment
  beside the phone drawer's avatar said profile lived behind the chip. That is
  true of both top bars; in the drawer the same-looking chip was a decorative
  `aria-hidden` span, with a separate Profile row further up. So the phone had
  two account entries and the one that looked most like the account was inert.
  The footer renders the same `AccountChip` the bars use, and the duplicate row
  is gone.

### Notes

- **No schema change and no migration.** A 1.5.0 database is a 1.5.2 database.

## [1.5.1] - 2026-08-08

**Three things 1.5.0 built and then half-connected.** Standalone quotes shipped
as a whole feature, and each of these is a place where the last wire was left
off — a screen you could not reach, a person you could not click, a file no
search could see. None of them threw, which is why they shipped.

### Fixed

- **Quotes was missing from the phone's ☰ menu.** Four hand-maintained lists
  decide where a tab appears — the desktop strip's content and utility halves,
  the phone's bottom bar, and the drawer — and 1.5.0 updated three. So on a
  phone the tab existed, routed, held data and sat in the bottom bar, while the
  drawer, whose whole job is to list everything, did not mention it. Invisible
  on a desktop, which is where the screen was built.

  The four lists moved to `routes.js`, next to the routing table they are the
  other half of, and are now asserted against each other: every content tab
  reachable from the drawer and the bottom bar, no tab named twice, content and
  utility disjoint, every nav tab surviving `statePath → parsePath` so nothing
  is reachable but un-bookmarkable, and every collapsing row carrying a hover
  label of five words or fewer.

- **A quote's speaker was the one credit you could not click.** Every other
  credited person in the app is a link to their record — a book's author, a
  film's director, a dialogue's actor. A speaker was flat text, and the panel
  holding their portrait and bio was unreachable from the only screen that
  lists them.

  The share **image** had been drawing speaker portraits since 1.5.0, because
  `speaker` became a people kind in the same release. So a speaker you had
  enriched showed their photograph on the picture you exported and stayed inert
  text on the card you exported it from.

  Fixed on all three surfaces: portraits and links on the Quotes page, the
  speaker's face on a search hit (a face and not a link — the row is already a
  click target), and the search popup, which credited the speaker in its header
  *and* repeated the name below, now naming them once.

- **A source file that every search was skipping.** `CoverPicker.jsx` joined a
  composite map key with a literal NUL byte instead of the `\u0000` escape.
  ripgrep classified the file as binary and omitted it from every repo-wide
  search; git classified it as binary too, storing it with CRLF while every
  other text file in the repo is LF, and giving it "Binary files differ" instead
  of a line diff — so no blame, and no merge, only a choice between two whole
  copies. The built bundle is unchanged byte for byte.

### Notes

- **No schema change and no migration.** 1.5.1 is a patch: three fixes, no new
  surfaces. A 1.5.0 database is a 1.5.1 database.

## [1.5.0] - 2026-08-08

**Quotes that came from nowhere**, and the frontend gets a test suite.

Every quote in Tippani used to hang off a book or a film. This adds the third
kind: a line from a speech, a letter, an interview, a song, a proverb, something
a friend said. It has its own screen, its own capture mode, its own place in the
review deck, in search, in Stats, and in the Markdown round trip — and the person
who said it is a person like any other, with a portrait and a bio.

The other half of the release is that the frontend, which had no test runner at
all, now has one. That is not a footnote: writing it found six tests already in
the tree that asserted nothing, and it found a live bug in the quote-card image
that a passing suite had been ignoring.

### Added

- **Quotes with no book and no film.** A new `Quotes` screen, its own tab, and a
  `no book or film` mode on the capture surface. Instead of a chapter and a page a
  quote carries the **occasion** — who said it, on what occasion, when, where, and
  through what medium.

  The occasion is also the locator, and unlike every other locator in this app it
  **discriminates**: the same words said on two occasions are two quotes, not one.
  That is the same correction `DialogueDedupeHash` made for episodes, run the
  other way.

  A quote with no speaker and no occasion is a proverb. It is perfectly fine to
  keep, and it stays out of the review deck — there is nothing to recall but the
  words already in front of you.

- **The review deck learns a third kind.** The roadmap said the deck would "apply
  unchanged". It did not, and the reason is the most interesting thing in the
  feature: every card asks *where is this from?*, and the answer for the other two
  kinds is a title read off a parent row. A standalone quote has no parent, so its
  source is the occasion, falling back to the speaker. Two speeches by one person
  are each other's hardest wrong answer, the way two books by one author are.

- **A `Quotes` section in search, and a `Speakers` section beside Authors and
  Actors.** Searching a person's name is asking about the person. The occasion is
  indexed too, because it is the title this kind has and a title you cannot search
  for is the gap the whole feature would be judged on.

- **Standalone quotes in Stats**: the totals, the favourites, the busiest month,
  the activity calendar, the tag leaderboard, "collecting since", and two new
  breakdown kinds — **Speakers** and **Occasions**.

- **`POST /export/quotes`, and a third `type:` the importer understands.** A
  quotes file groups by occasion the way a book export groups by chapter, and the
  unattributed ones come first — the parser attributes a quote to the heading
  above it, so a proverb written after one would come back belonging to a speech
  it was never part of. Import stages and approves like everything else.

- **`speaker` is the fourth people kind.** Portrait, bio, links, rename, orphan
  sweep, the People console, and the face chip on a shared quote card.

- **A frontend test suite.** Vitest, dev-only — the three runtime npm packages are
  unchanged. Two projects: `node` for pure logic, `jsdom` for anything that
  renders. It covers routing, credit splitting, recall status, grouping, the four
  share formats, the quote-card wrap engine, the partial-date rules and the demo
  shim's response shapes. The two bespoke check scripts folded into it.

- **CI checks two things nothing was checking.** `git diff --exit-code -- web/dist`
  after the frontend build, because `web/dist` is a committed artifact embedded
  with `go:embed` and a forgotten `make frontend` left the binary serving the old
  UI with nothing to say so. And `go test -race`, which the repo had two tests
  written specifically to exercise and had never run.

### Changed

- **A person is one row, whatever they did** (migration `0027`). `people` was keyed
  `(user_id, kind, name)`, so a novelist who also acts was two rows with two bios
  and two portraits. Adding `speaker` to that key would have manufactured a
  duplicate for exactly the people most likely to be enriched, since the appeal of
  saving a line from a speech is usually that you have read the person too. Roles
  are a set beside the row now.

  It is the only migration here that deletes rows on purpose, so the survivor rule
  is written down rather than left to whatever SQLite returns first: prefer a
  portrait, then a bio, then the oldest row, ties broken by id.

- **The orphan sweep un-files a role rather than deleting a person**, and only
  deletes the row once no role is left. Under the new schema the old behaviour
  would have taken a portrait the speaker side was still using.

- **Renaming a person rewrites every role they play**, not just the console you
  started from — otherwise the row says one name, the library says another, and
  the next sweep eats the difference.

- **The phone's bottom bar drops Search and gains Quotes.** The mobile top bar has
  carried `＋ · Search · ? · chip` since 1.4.1, so the bar held three content
  screens and a duplicate while the fourth had nowhere to live.

- **The URL contract moved out of `App.jsx`** into `routes.js`, where it can be
  tested without rendering React.

### Fixed

- **A stray space made a second copy of the same line.** `DialogueDedupeHash` ran
  its whitespace collapse over the text with the episode suffix already appended,
  so a space beside the separator became a token boundary and `"Not today "` hashed
  differently from `"Not today"`. It never surfaced as an error — it surfaced as a
  recurring catchphrase staged twice, months apart, because one copy was pasted
  with a trailing space.

  The fix was deferred until now for a real reason: it moves the hash in the *less*
  discriminating direction for the first time, and the repair that runs on every
  `Migrate` answered a `UNIQUE` violation by returning an error — which means the
  application does not start. A failed row is logged and skipped now. Well-formed
  text hashes exactly as before, so no existing database is rewritten.

- **Search counted quotes it never showed you.** A tag worn only by standalone
  quotes rendered a chip reading `grief · 3` above an empty box, and a day when
  you saved only quotes rendered `Added on … · 0`.

- **Two thirds of the highlight colours were never counted.** The Stats card is
  headed "Highlight colours" and counts itself in quotes, and it only ever counted
  book annotations. Dialogues have worn a colour since `0021`.

- **The read log accepted the thirtieth of February.** `normalizePartialDate`
  promised "a stored date is always a real one" and checked only that the day was
  between 1 and 31, so 30 February, 31 April and 2023-02-29 all stored fine. A
  partial date is allowed to be vague; that is the point of the format. It is not
  allowed to be wrong.

- **The orphan sweep had a default that deletes people.** Its reference query
  started as the `books.author` one and a switch replaced it for two other kinds —
  correct for exactly three kinds, and only for that reason. A fourth would have
  silently inherited the books query, and every person of that kind whose name was
  not also one of your book authors would have been deleted and their portrait
  unlinked, by a best-effort sweep that logs at Warn and still answers 200.

- **Rename picked its table by defaulting, twice.** The scan and the update were
  two separate switches forty lines apart, so they could each inherit the books arm
  *and* disagree with each other — reading every book's author and stamping the
  rewritten strings onto dialogue rows by matching id. They come from one switch
  now.

- **A mistyped work URL opened an error screen.** `/books/abc` parsed to a detail
  view for work `NaN`, fetched `/books/NaN`, and rendered the error state the
  unknown-path fallback exists to prevent.

- **The quote-card image drew the wrong faces for a new credit kind.** It decided
  which line a credit's portraits hang beside by asking `facesFor !== 'actor'`, so
  anything new landed on the attribution line by falling through a negative test.
  Right for a speaker by luck, silently wrong for whatever came next.

- **A path-traversal advisory in the build toolchain** (`postcss`), which is a
  dev-time dependency and never in the binary.

### Notes

- **There is no breaking change and no data loss.** Migrations `0026`, `0027` and
  `0028` add the quotes table, rebuild `people`, and let the import queue hold a
  work-less quote. A 1.5.0 database is not readable by 1.4.2, as always.

- **Six tests in this repo were asserting nothing, and an audit found them.** The
  worst was a share-format test where swapping the character and the actor inside
  the payload left all twenty-one tests green — for a file whose entire subject is
  that a wrong attribution is a misquote. They were four `toContain` calls. Every
  claim in this release was checked the same way: break the code on purpose, watch
  the test go red, put it back. A passing test you have not seen fail is a
  decoration.

- **The roadmap now records a prediction it got wrong.** §24 said the review deck
  would apply unchanged. Correcting that quietly would have been the easy option; a
  roadmap that only keeps the predictions that came true is not worth reading.

## [1.4.2] - 2026-08-07

**Changing your password no longer orphans your backups**, and a batch of 1.4.1's
new shell controls behave the way they should have on the first try.

1.4.1 sealed backup archives with a key derived from the password that was current
when the archive was written. That is a file on a laptop whose key is a string you
have stopped using — and there is no getting it back. This release fixes it, and
the fix took three tries, because the first two were wrong in the same instructive
way. See *Added* for what shipped and *Notes* for what those two were.

### Added

- **An instance recovery key.** 32 random bytes in `<data>/.recovery-key`. Every
  archive's own random key now goes into its header **twice**: under the password
  you typed, which travels with the file, and under this key, which does not. So
  on the server that made an archive, **your current password opens it** —
  whichever password sealed it. Carried to another machine, an archive still needs
  the password it was sealed with, which is unavoidable: the only durable record of
  an old password is the archive itself, and a design that could open it without
  one would be a design with a back door.

  The key is never inside an archive (an archive carrying its own key is not an
  encrypted archive), never moved by a restore, never logged, and never returned by
  any endpoint. A factory reset deliberately leaves it, because "reset to clear a
  corrupt database, then restore last night's archive" is exactly what it is for.

- **Tooltips on the desktop tab strip.** The nav collapses to icons when the
  window is too narrow for the labels, and at that width the glyph was all there
  was. Driven from the Toggle itself rather than by wrapping each tab: the sliding
  thumb is positioned from each tab's `offsetLeft`, and a wrapper would have reset
  every offset and parked the thumb under the first tab forever.

- **A CI check for the archive header.** `secret.js` parses that binary header in
  the browser, by fixed byte offsets into a format defined in Go, and this app has
  no frontend test runner — so nothing would have noticed the day the two
  disagreed. `scripts/archive-header-check.mjs` builds headers from the shared
  constants and asserts the parser reads them back, and that it *refuses* a version
  it does not know rather than guessing. It failed on its first run, on a bug
  written minutes earlier: the read window covered a maximal account name but
  stopped short of the field after it, so an archive's recoverability read as absent
  for exactly the accounts with long names.

### Changed

- **The archive format is v2**, and the key is derived from the **password alone**.
  The account name is still in the header, as a label, so a restore can say whose
  password it wants. Two things go with that: the ambiguity is gone (v1's
  `"<username>#<password>"` meant `"a#b"`+`"cd"` and `"a"`+`"b#cd"` derived the
  *same* key, because a `#` in a username was always legal — the comment claiming
  otherwise was simply wrong), and each archive now has a random key of its own
  rather than using the derived key directly, which is what makes two ways in
  possible at all.

- **Wrong password and damaged archive are told apart.** In v1 a failure on the
  first block could only mean a wrong key, so it was reported that way. In v2 the
  credential is proven the moment a wrap opens, so anything failing afterwards means
  the body was altered or truncated — and reporting *that* as "wrong password"
  sends someone whose archive has been tampered with to go and doubt their memory.
  A refusal now also says which *kind* of secret it wants, and whether this box can
  recover the archive at all, because "does not open this backup" left an operator
  being asked for the wrong thing with no way to work that out.

- **Restoring asks for less.** One password field, no account field — the key is
  the password. The dialog says up front whether this server can open the archive
  with your current password or needs the one it was sealed with.

- **The genre filter is one dropdown.** It was a strip of chips sized by measuring
  each chip's text width against the row's leftover space, with the overflow in a
  "More…" dropdown. That row holds a dozen other controls whose widths change with
  the data, so the answer was right only until something else moved — and the
  failure was a chip clipped mid-word against "More…", which reads as a rendering
  bug. Every genre is now one tap away instead of some being one and the rest two,
  and it matches how series, sort, group and shelf already read beside it — and how
  genre itself has read in the mobile filter sheet since 1.4.0.

- **Info dots open on hover** on a pointer device, and close when you move away: an
  explanation should cost a glance, not a click and then a dismissal. A **click
  pins** one open until it is clicked again, so text you want to re-read or select
  does not evaporate when the mouse drifts, and reaching across the gap into the
  card keeps it open. On touch, a tap toggles.

- **Info dots carry no tooltip.** On a phone that was two mechanisms answering the
  same question: hold the dot to be told it explains the ISBN, tap it to be told
  what an ISBN is. The first is a label for a control whose whole content is a
  label.

- **The desktop Help button matches the Search button** beside it — same accent
  texture, same round pill. A bordered disc between Search and the avatar read as a
  control from a different set.

- **The desktop help panel stops describing controls that are not there.** It
  listed the ☰ drawer and the floating bottom bar, neither of which exists above
  the phone breakpoint; describing them to someone who cannot see one is worse than
  saying nothing, because they go looking. Each form factor now lists its own shell,
  and the pointer one describes the tab strip and hover labels instead.

### Fixed

- **An archive could be restored with no credential at all.** With a recovery key
  present, the durable path opened any local archive for anyone who could reach the
  endpoint — so a stolen session cookie could have overwritten the whole instance
  with an empty request body. The recovery path now requires the caller's own
  current password, verified server-side; the round-trip test caught this.

- **A correction to 1.4.1's release notes.** They said renaming an account orphaned
  its archives. It did not: the name was written into the header at seal time and
  the restore path defaults to it, so an archive made as "alice" still opened as
  "arani" with the era password. What a rename broke was the dialog's *label*, which
  called your own archive somebody else's. The password change was the real fault,
  and it was the whole case for v2 on its own.

### Notes

- **1.4.1 archives cannot be restored by 1.4.2.** That format lived for about an
  hour and no archive of it exists outside this repository's tests; reading it would
  have meant keeping the ambiguous `"<username>#<password>"` secret alive. If you
  have one, 1.4.1 is still tagged and its image still published. The refusal says
  so by name rather than failing as corruption. Archives from *before* 1.4.1 are
  plain `.tar.gz` and still restore, as they always have.

- **There is no database migration**, so a 1.4.2 database is still readable by
  1.4.1. Only the archive format blocks a downgrade.

- **What the two earlier designs got wrong**, since the reasoning is more useful
  than the result. The recovery key was first going to live in a column of the
  `users` table — the one table a restore replaces wholesale, so restoring any
  archive, resetting the instance, or deleting the account would have destroyed it
  silently, with the only surviving copy in a directory the next restore deletes.
  The second version wrapped it under each user's password, which needs both
  plaintexts to re-wrap: the HTTP password-change handler has them, and
  `tippani user passwd` — the only forgot-my-password route on a self-hosted box —
  does not. So the documented recovery path would have destroyed the recovery key,
  at exactly the moment it was needed. A file the restore is told to leave alone has
  neither failure, needs no migration, needs no re-wrapping, and lets *any* admin's
  password open *any* archive the box made.

- **The one way still left to lose an archive** is a passphrase you set and then
  forget. That is deliberate: a passphrase archive gets no recovery wrap, because
  choosing a passphrase is choosing not to tie the archive to this instance or any
  login. The dialog says so where you choose it.

## [1.4.1] - 2026-08-07

A phone-first pass, and one thing that should have been true from the start:
**backup archives are encrypted now**.

1.4.0 put a `?` on every screen and a `＋` on every list. Both were right about
what was needed and wrong about where it goes. A `?` drawn in eleven page headers
is a property of eleven pages instead of one thing in one place, and on a phone it
was competing for the single row a page title also needs. A `＋` in the Library
header sat inches from the top bar's own `＋`, and the book pages had a third add
form of their own. So there is one of each now, in the top bar, and they read the
screen you are on: **＋ Add · Search · ? · your avatar**, same four in the same
order on a phone and on a desktop.

The long-press label from 1.4.0 was worse than it looked. It was a pill pinned to
the top of the screen, centred with `left:50%` + `translateX(-50%)` — which cannot
be clamped, so a label wider than the viewport hung off both edges and **widened
the page's scrollable area**. That is why Library and Settings could be dragged
sideways into blank space on a phone. The old CSS hover bubble had the same fault
from the other end. Both are gone; one measured, clamped, anchored bubble now
serves hover, keyboard focus and long press alike.

And the archive. It holds every user, every library, every password hash and your
API keys, and it left the server as a plain `tar.gz` — fine in `<data>/backups`,
not fine the moment it is on a laptop or in a cloud drive, which is what a backup
is for.

### Added

- **Encrypted backups.** AES-256-GCM in framed chunks, keyed with Argon2id from
  **your own account name and password** — nothing new to remember, and the same
  credentials open the archive on any Tippani, which is what makes it portable.
  Prefer a key not tied to a login? Set a **passphrase** (10–20 characters) when
  you back up, and restoring asks for that instead. The key is never written to
  disk, never logged, and cannot be recovered.

  It is **authenticated**, not just encrypted: the header is bound into every
  frame, so re-ordering frames, splicing two archives, or swapping the recorded
  account name for one whose password you know all fail. **Truncation fails
  loudly** — a stream that ends without its final frame is refused rather than
  half-applied, because a backup silently missing its tail looks like a backup.

  Your password is checked before the archive is written. Not for authorization —
  the session already covers that — but because a typo would otherwise produce a
  perfectly valid archive that nothing can ever open, and you would find out on
  the day you needed it.

  What this deliberately is **not**: a fixed key compiled into the binary. This
  repository is MIT-licensed, so that constant would be public, and "encrypted
  with a published key" reads as protection while providing none. It is also not a
  signature — anyone holding the credentials can produce a valid archive. The
  format is documented in `internal/httpapi/backup_crypto.go` in enough detail to
  open one yourself.

- **Switch accounts from Profile.** Sign in as another user without going out
  through the login screen. It asks for that account's password every time; being
  an admin does not let you in without one, and the session you arrived with is
  retired server-side once the new one is issued.

- **The `＋ Add` surface knows where you are.** A book on Library, a film or show
  on the Catalogue, a quote against whichever work you have open — with that work
  already filled in, because you pressed `＋` on its page and asking again is
  asking a question you already answered. The drawer's Add is the deliberately
  context-free twin, and opens with nothing pre-filled.

- **Search lands scoped.** From Library or the Catalogue, the top bar's Search
  arrives filtered to that side; the drawer's Search clears the scope, so there is
  always a way out of one you did not choose.

### Changed

- **Help moved into the top bar** and became context-aware, resolved from the
  route. The eleven per-page `?` buttons are gone. Two exceptions remain, both
  because the shell bar is not on screen there: the work-detail screens keep it in
  their `⋯` menu, and the full-screen Profile page carries its own.

- **The long-press label is anchored to the control you held** — below it, flipped
  above when the bottom of the viewport is nearer, clamped inside the window on
  both axes, and wrapping rather than overflowing. A label detached from its
  control answers "what is this?" without saying *which* "this", and several 44px
  glyphs sit within a thumb's width of each other in these bars.

- **Hover uses the same bubble.** The pure-CSS hover tooltip is retired: an
  `opacity:0` bubble still has a border box, and one hanging off an info dot near
  the right edge widened the page the same way the pill did. One implementation,
  one set of clamping rules, on every input style.

- **Every label and confirmation is five words or fewer**, and they clear faster
  (1.2s for a label, 1.5s for a confirmation). A bubble that needs a paragraph is
  an info dot — which is what an info dot's own hover label says now, instead of
  putting its whole paragraph in a bubble.

- **Profile is one screen.** The avatar chip opened a dropdown — Profile, User
  management, Log out — and the drawer repeated the same three rows, so "my
  account" was a menu of screens rather than a screen. The chip opens Profile
  directly, and everything that menu offered is a section of it, including the
  admin user list.

- **One restore, not two.** Restoring the archive kept on the server and restoring
  a file off another server were two blocks with two warning paragraphs and two
  typed confirmations, for one operation whose only real variable is where the
  file is. It is one control with a source picker now, and it resolves what the
  chosen archive is keyed with *before* prompting — so a passphrase-sealed archive
  is never met with a password field.

- **The backup warnings are one line each**, in the dialog you are standing in
  when they apply, rather than three red paragraphs above the buttons on a screen
  that was already dense. The consequences have not been softened, only moved to
  where a warning is actually read.

- **The `＋ Add` surface is full-screen on a phone**, and its Close and Save are
  glyphs in the title bar. It is the app's densest form; a 90%-width card inside a
  scrolling scrim wasted both edges and put Save somewhere the thumb had to hunt
  for. Save is now pinned and reachable without scrolling past six fields.

- **Save stays greyed until it would work**, everywhere — the capture form, both
  manual-entry forms, both quote forms, the bulk-edit bar, the speaker remap, add
  user, change password, and the login screen. Each says which field is missing,
  because a greyed control that will not say why is worse than one that is not
  there.

- **Passwords are 8–20 characters of printable ASCII** (letters, digits,
  punctuation — no accents, no non-Latin script). That is narrower than it looks
  arbitrary: a password is also a backup key, so it has to survive being re-typed
  on another machine's keyboard months later, and a glyph that arrives as
  different bytes is an archive that will not open. Existing passwords keep
  working; the rule applies where one is set. The upper bound used to be bcrypt's
  own 72 bytes.

- **Archives are named `.tpbk`.** A sealed archive called `.tar.gz` would be a lie
  that costs someone an afternoon: `gunzip` refuses it and says nothing about why.

### Fixed

- **The page could be dragged sideways into blank space on a phone.** Both
  tooltip mechanisms could push a box past the viewport, and a fixed overlay on
  iOS gets dragged along with that pan. Nothing in the app is allowed to widen the
  page; both are now clamped in script.

- **A long-press label could exceed the screen and force a horizontal scroll.**
  Same cause. It also wraps now, and breaks a long unbroken token rather than
  growing past its ceiling.

- **Toasts overstayed.** 2.2s and 1.7s down to 1.5s and 1.2s, with every message
  trimmed to five words so the shorter window is enough to read.

- **The demo's Settings screen showed "Invalid Date"** for the last backup. The
  fetch shim answered `created_at` where the server answers `created` — a fake
  that was close but not identical, in the one file nothing tests.

- **Logging in over a live session left the old session in the database**, valid
  until it expired. It is retired now, after the password check, so a failed
  switch leaves the session you are still using alone.

- **Dead code from the 1.4.0 refactor**: the avatar-upload control the retired
  chip menu used, and the `.user-menu-panel` rules that positioned it.

## [1.4.0] - 2026-08-05

This one is about the phone, and about the app talking less.

Tippani explained itself in standing prose — Settings card copy, drawer
subtexts, microcopy under every control. It is good writing and there is a lot
of it, and on a 390px screen it meant scrolling past the explanation to reach
the single control each card exists for. So: a **label** (what this control is)
and **state** (what is true right now) stay on the page; an **explanation** (why
it exists, what the trade-off is) moves into an info dot. Every screen now
carries a **?** that lists its own controls.

Two things had to be built before that was honest on a phone at all. An info dot
was a hover bubble, and there is no hover on a phone — which quietly made "move
it into an info dot" a non-answer on the device this app is built for. And a
tooltip was pointer-only, so every glyph-only control was simply unexplained on
touch. Both are fixed, and the second one turned into a sweep: 69 controls that
had only an `aria-label` or a native `title=` now say what they are.

The other headline is the work pages. ISBN, ASIN, TMDB and TVDB ids came off the
book and film heroes, **Edit** became **Details**, and fetching metadata stopped
being an all-or-nothing overwrite.

### Added

- **A `?` on every screen**, opening that screen's own glossary: every control
  named, with what it does. The copy lives in **one registry keyed by screen**
  (`web/frontend/src/help.jsx`) rather than beside each component, so a control
  explained in one place cannot contradict itself in another — and every screen's
  list appends the shell's own controls (☰ · ＋ · Search · the bottom bar · the
  avatar chip), so the phone bars are explained wherever you happen to ask.

  It sits in the page header on most screens. On the two work-detail screens it
  is a **⋯ menu row** instead: that phone bar already carries a back arrow, a
  filter, a ＋ and a ⋯, and a fifth 44px control would have left a book title
  about eighty pixels to live in.

- **Tooltips on touch, by long press.** Hold any control for 500ms and its label
  appears as a toast at the **top** of the screen — the top, because the bottom
  is where the finger, the floating nav bar and the OS gesture strip already are,
  and a label that appears under the thumb that asked for it is not a label. It
  has its own slot rather than sharing the bottom action toast, since both can
  legitimately be on screen at once (hold a button, read its label, tap it, get
  its confirmation).

  A fired long-press **swallows the click behind it**, exactly as Material does:
  holding Delete to find out what it does must never delete anything.

  `IconButton` now renders its own tooltip from its `ariaLabel`, because
  threading a wrapper through forty call sites is how half of them end up
  without one.

- **A Details panel on every work**, replacing Edit. It shows every stored field
  and **saves each one on its own** — pencil to edit, ✓ to save that field —
  rather than making you re-save the whole record to change a year. Cover
  controls, an inline metadata lookup, and delete live in the same sheet.

- **Metadata merge: you choose, field by field.** Picking a lookup match no
  longer *applies* it, it **proposes** it — every field it would change, yours
  and theirs side by side, with a toggle you own. Fields you have nothing in are
  ticked for you, because filling a blank is never a loss; anything already
  filled starts unticked, because overwriting what you typed is. Rows that would
  change nothing are not shown. Films keep a **re-sync everything** option
  alongside, because a cast exists in no search result and field-picking alone
  can never produce one.

  This is the end of "it fetched metadata and clobbered my author".

- **A greeting that knows what day it is.** Home said
  `Good ${morning|afternoon|evening}` — three strings for 365 days. It now draws
  from a pool chosen by the device's clock, date and IANA time zone: six time
  buckets (because "Good evening" at 23:50 and at 17:05 are the same sentence
  for very different moments), weekend and Sunday variants, and **114 fixed-date
  national days across 58 regions**. Everything is local — no locale asked of the
  server, nothing sent anywhere, no network call — and it re-picks on reload.

  A date earns a place only if it falls on the **same Gregorian month and day
  every year**, or is computable from an exact rule (Easter's computus; "the
  fourth Thursday in November"). Nothing lunar or lunisolar: Diwali, Holi, Eid,
  Lunar New Year and Vesak move every year and several differ by country in the
  same year, so a table of them would be confidently wrong, and a wrong festival
  greeting is worse than none. There is deliberately no "add your own dates"
  escape hatch, because that is an invitation to break the rule later.

  A country's own day beats an international one on a shared date (25 December is
  Quaid-e-Azam Day in Pakistan), and commemorations say **"Marking …"**, never
  "Happy" — Remembrance Day, Anzac Day, Truth and Reconciliation, Shaheed Dibash.

- **`scripts/greetings-check.mjs`**, in CI: 129,210 greetings over every region,
  every day of a year and every hour bucket. Every way those tables break is
  silent — a greeting rendering `{name}` literally, a "Happy" on a day of
  mourning, a country resolving to its neighbour's time zone. None of it throws
  and none of it fails a build. Two assertions exist because the bug had already
  happened: `America/Bahia_Banderas` (Mexico) `startsWith` `America/Bahia`
  (Brazil), so an ordered prefix scan handed Mexican devices Brazilian national
  days; and `Africa/Addis_Ababa` is a tzdb *Link* to `Africa/Nairobi`, so
  Ethiopia has no identifier of its own and is **absent rather than mislabelled**.

- **`scripts/glossary-css.mjs`**, also in CI. `docs/ui-glossary.html` inlines the
  built stylesheet so its samples are styled by the rules the app really ships;
  every build renames `index-<hash>.css`, so that snapshot rotted silently and
  AI.md had been admitting it for two releases. It is generated now, and
  `--check` fails when it is stale.

### Changed

- **Info dots open a popover, not a sheet.** Anchored to the dot with a caret on
  a pointer device — several dots often sit within a few pixels of each other, so
  "which one was that" is a real question — and a compact **centred card** on a
  phone, where a 40px anchor on a 360px screen gives no useful direction and the
  finger is already covering it. A full-screen sheet is right for a screen's
  whole glossary and absurd for one sentence.

- **Explanations moved into info dots** across Settings (Devices, Metadata
  sources, Onboarding, Multi-author credits), the Metadata console (duplicates,
  speaker remap, the mobile actions), Profile's maintenance tools, the Practice
  card, and the tour's step copy — which keeps a short lead with its detail one
  tap away, because on a phone six of those steps were a scrolling paragraph and
  the paragraph was the part people skipped.

- **The metadata keys edit and save per field.** The card had one "Save keys"
  button that wrote whichever inputs happened to be visible, so it had to reason
  about which fields were shown lest revealing one wipe another. Each field owns
  its write now — the endpoint decodes every key as a pointer, so a PUT carrying
  one leaves the rest untouched — and the icons match the Details panel.

- **The ☰ drawer and the floating bottom bar wear the shell material** (wood on
  paper, brushed metal on film). They were the last bare surfaces in an app where
  every card, button, toggle thumb and select thumb already carries a tile, and
  they read as plastic beside them.

- **Word buttons became glyphs** where the glyph is unambiguous: export, the
  cover controls, lookup matches, the duplicate scan, the bulk bar's Clear, the
  filter sheet's Reset, the tour's Back. Buttons whose visible words *are* their
  label were deliberately left alone — a tooltip repeating a word is noise.

- **`docs/ui-glossary.html`** gains the 1.4.0 components and has the entries this
  release invalidated corrected.

### Fixed

- **The reading mark disappeared into its own glow on a phone.** The open-book /
  play-triangle badge on a work in progress carried a dark blur halo, on the
  theory that a halo lets a light icon survive pale artwork. It does, at desktop
  cover sizes. At the ~18px a phone gives it, the halo *is* the problem: it is a
  soft gradient, so it eats the thin strokes it exists to protect and the mark
  reads as a smudge on any cover that is not flat colour. It is an opaque disc
  now — shelf blue, white glyph, hard rim — because contrast from an edge does
  not scale away.

- **A failed field save no longer discards what you typed.** The inline editor
  closed before the request landed, so a failure snapped the row back to the old
  value with the new one gone.

- **`Enter` no longer closes the editor while you are adding genres.** In a token
  list Enter is how you add a token; committing on it closed the row on the first
  tag.

- **A poster taken from a metadata match is stored at full size.** It was saving
  the picker's `w342` thumbnail — a worse image than the cover search stores for
  the same title.

- **An unset year stopped reading as a filled one.** The numeric fields spell
  "nothing" as `0`, so a merge would refuse to pre-tick a blank year and could
  offer "0" as a change.

### Removed

- **Settings → Reference.** Its two link-outs were the UI glossary and the
  roadmap. The per-screen `?` does what the glossary link was for, and better:
  help beside the control, which cannot 404 and cannot lag the code by a release.
  The roadmap link survives in the Updates card, where "what version am I on" and
  "what is coming" are the same question asked twice. The glossary itself is
  still published and still linked from the README and the roadmap.

## [1.3.2] - 2026-08-04

The concurrent-write 500 is fixed, and it turned out not to be the bug I had written
down. The roadmap becomes something you can browse rather than scroll, and it stops being
a list I keep by hand: what is on it is now decided by labels on the issue tracker, in
public, and closing an issue is the only bookkeeping there is. There is also a
`DEVELOPMENT.md`, for anyone who would rather fork this than file against it.

Nothing in the running app changed except the database DSN, and that fix is the reason to
upgrade: if you have ever seen a 500 saving a quote, this is why.

### Fixed

- **Concurrent writes no longer fail with a 500.** Two writes arriving at once raced for
  SQLite's write lock and the loser was refused **immediately** — 17ms, against a
  `busy_timeout` of 5000. The recorded cause was the connection pool: PLAN §8 specified a
  single writer connection, `store.Open` allows four, so serialise them behind a mutex.
  That was wrong. The fault was the **lock order**. Almost every write here reads before
  it writes — the duplicate check, the ownership check — and under SQLite's default
  `DEFERRED` locking that makes `BEGIN` take a read lock which the first `INSERT` must
  upgrade. SQLite will not run the busy handler for that upgrade, because two
  transactions both holding read locks and both wanting to write would deadlock, so it
  fails the second one instantly. The timeout was never consulted.

  `store.openDB` now opens with `_txlock=immediate`, taking the write lock at `BEGIN`
  where there is nothing to upgrade, so a second writer waits its turn as the timeout
  always intended. One line, and it covers all thirty write transactions rather than the
  two a mutex would have been threaded through — and unlike a mutex it also holds
  against a second process, a `sqlite3` shell or a restore. **Readers are unaffected:**
  `_txlock` applies only to read-write transactions, the four-connection pool stands, and
  `TestReadersOverlapAWriter` fails if searches ever start queueing behind imports.
  `previewStagedTarget` — the one genuinely read-only transaction in the tree — was moved
  to `ReadOnly` so a preview does not take a write lock.

  `TestConcurrentDuplicatePostsAllConflict` tolerated the 500 and counted it; it now
  fails on it. `TestConcurrentReadThenWriteTransactions` reproduces the original defect
  directly and fails on any build that loses the DSN flag.

### Added

- **The roadmap is browsable.** All twenty-five backlog sections are cards that start
  collapsed and expand as needed, so the whole shape of the thing fits on one screen. A
  contents rail owns the full left edge — fixed, full height, its own scroll — listing
  every section, bug, Later / maybe entry and set-aside decision, with each group
  foldable. On a narrow screen it leaves the left edge, rejoins the flow under the header
  and becomes one foldable box. **Request a feature** and **Report a bug** sit in a bar
  that is always on screen. Every section header carries the number of the issue tracking
  it. Still one self-contained file with no script in it: the cards, the rail and its
  groups are `<details>` elements, the deep-link-into-a-collapsed-card behaviour is CSS,
  and the page icon — the Tippani mark with its margin strip read as a progress column,
  two squares filled and two amber for what is ahead — is an inlined data URI so the page
  still renders identically straight off disk.

  The rail was sticky-inside-a-grid first, and wrong: a sticky element is constrained by
  its containing block, engines take that to be the nearest block container rather than
  the grid area, and at the bottom of the page it slid down over the footer with the two
  drawing on top of each other. Fixed positioning takes it out of flow and the question
  cannot arise.
- **The roadmap is no longer a list I keep by hand.** Known bugs, accepted requests and
  Later / maybe are all generated from the issue tracker, and **labels decide what is on
  the page** — `bug` + `accepted` for a bug, `enhancement` + `accepted` for a request,
  `enhancement` + `considered` for something parked. There is no curated list left in the
  repo to drift out of step: I cannot add an entry without agreeing to it in public, and I
  cannot forget to remove one, because closing the issue removes it. Promotion out of
  Later / maybe is a label edit, on the same issue, keeping the same thread of argument.

  **Acceptance is a gate, and it is deliberate.** Applying a label needs Triage, so filing
  publishes nothing by itself. That matters because the roadmap is a public page: an
  ungated pipeline would put a stranger's title and body on it within a minute. Issue text
  is escaped, fenced blocks are dropped and only paragraphs, lists and `code` spans are
  emitted, so nothing can inject markup — but no amount of escaping makes a wrong report
  right, and that judgement is not something to automate.

  Two GitHub issue forms (`bug_report.yml`, `feature_request.yml`) replace free-form
  issues. `scripts/roadmap-data.mjs` renders six marked regions of the page,
  `scripts/roadmap-tracker.mjs` reads the tracker, and
  `.github/workflows/roadmap-bugs.yml` runs both on every issue event. Prose is still
  mine where it matters: per-issue `overrides` in `docs/data/bugs.json` and
  `docs/data/features.json` replace whatever the form produced, and automation cannot
  touch them. Every write keeps the previous page in `docs/roadmap.backup.html` and is
  refused outright if the render loses a marker, unbalances `<details>` or shrinks the
  page implausibly — so a bad run is a failed job, not a broken published page.
- **`DEVELOPMENT.md`** — building and running it, the two rules the code enforces that are
  easy to break, how migrations and the `_txlock=immediate` pragma constrain a new
  transaction, the pull-request conventions, and a list of every string that still says my
  name for anyone forking it into their own thing.
- **Every item already on the roadmap now has an issue number** — #2–#39, filed by
  `scripts/seed-issues.mjs`, so the page and the tracker describe the same world and
  anything here can be quoted, subscribed to and argued with. The script is resumable and
  dry-run by default. New labels `roadmap`, `considered` and `accepted` carry the triage
  vocabulary; `duplicate` and `wontfix` already existed and are reused.
- An issue form's `labels:` is applied with the **author's** permissions, and labelling
  needs Triage — so `labels: ["bug"]` did nothing for exactly the people the pipeline
  exists for, and an outside report would never have reached the page. The workflow now
  recovers the label from the form's own field headings, which is better evidence of which
  template was used than the title prefix (a prefill the reporter can edit away). It only
  ever adds, so a label removed on purpose stays removed.
- **The roadmap is linked where people are.** Prominently in the README (badge, header
  callout, opening paragraph), and in Settings → **Updates**, next to the version — "what
  am I on" and "what is coming" being the same question asked twice.

### Changed

- **Audio review** and **richer author portraits** move from Later / maybe to accepted
  (#12, #7). Both argued for themselves in their own entries: portraits is coverage on a
  disambiguation that already works, and audio is settled by the set-aside card that
  resolved server-side speech in favour of a client-side answer.
- `synchronous=FULL` and the four-connection pool are now recorded in PLAN §8 as
  deliberate departures from the original plan, with the reasoning, rather than leaving
  the plan and the code disagreeing in silence.
- `tracker.json` only re-stamps its timestamp when the tracker state actually moved.
  Before that, any issue event at all — a comment, a label edit — rewrote the file and the
  bot committed; two label edits produced three commits whose entire content was a new
  timestamp.

## [1.3.1] - 2026-08-04

1.3.0 taught a show's dialogue which episode it came from, and then would not let
you save the second occurrence of a recurring line — the episode was recorded but
took no part in deciding what counted as a duplicate. For a format built on
catchphrases that is the wrong way round, so the episode now helps identify a
line. Two demo bugs and a label format go with it, and the roadmap moves out of
Markdown into a page you can actually read.

### Fixed

- **A recurring line in two episodes is now two quotes.** 1.3.0 gave a show's
  dialogue a season and an episode but kept hashing the line's text alone, and
  `dialogues` is unique on `(movie_id, dedupe_hash)` with a whole series in one
  row — so the second occurrence of a catchphrase could not be stored. It was
  worse than a plain refusal: the importer's fill-empty enrichment ran instead, so
  importing "Bazinga" from S3E7 when S1E2's copy was on file **relabelled the S1E2
  row** as S3E7, and where a season was already recorded the line vanished
  counting as neither added nor enriched.

  Excluding the locator from the hash is right for a book — a book is one work and
  a passage in it is one passage, and it is what keeps re-importing a growing
  `My Clippings.txt` a no-op. It is wrong for a series, because a line is located
  *by episode*, so the episode is now part of what identifies it. Films and
  un-episoded lines hash **byte-identically to before**, which is load-bearing:
  nothing on disk needed rewriting for them and film dedupe is untouched. Rows
  that already carried an episode are re-hashed on the next start — SQLite has no
  `sha256`, so that repair lives in Go rather than in a migration, and it is
  unguarded and idempotent so it also heals the two restore paths.

  The same collision existed one step earlier, in `staged_quotes`, where it would
  have dropped the second occurrence before it ever reached the queue.

- **The demo's Settings page crashed.** `GET /auth/devices` and `/admin/backup`
  had no case in the demo's fetch shim and fell through to its catch-all `200 {}`,
  so the Devices card read a list field that wasn't there and threw, taking the
  whole page down with it. Both are answered properly now, and the catch-all warns
  on any path it doesn't know rather than failing silently the next time.

- **"all seriess"** in the books filter — a series is its own plural, and the label
  was appending an `s` regardless.

### Changed

- **A show's position reads `E06/10 · S02/03`.** Episode first, since that is the
  finer of the two and the thing you are actually on; both halves of a pair padded
  to the same width, two digits minimum, widening together past 99
  (`E006/456 · S011/123`). The derived percentage is no longer printed beside a
  unit label — the label is more precise, and the bar next to it is drawn from that
  percentage anyway.

- **The roadmap is now `docs/roadmap.html`**, self-contained static HTML published
  beside the demo and linked from its ribbon and from Settings → Reference, with the
  UI glossary. `ROADMAP.md` is gone; release history is not duplicated there, since
  the changelog and the releases page already hold it. The glossary gained the shelf
  and pending-import sections it had been missing since 1.2.0.

- `docs/MILESTONE-3.md` removed — a one-off build record, referenced from nowhere.
  `docs/PLAN.md` stays: it is cited from roughly 148 places in the code as the record
  of *why*, and deleting it would orphan all of them.

## [1.3.0] - 2026-08-04

The catalogue could say what you own and what you had marked up, but nothing
about where you stood with any of it. A book you were half through looked exactly
like one you had bought and never opened, and finishing something left no trace
at all — so a reread overwrote the read before it, and "how many times have I read
this" was unanswerable. This adds a shelf: a status per work, progress in the
units the thing is actually made of, and a log of every read.

A show's quotes had the same gap one level down: a dialogue could say *when* in a
runtime it was said, which is a complete answer for a film and no answer at all
for a series. So they now carry the episode too.

### Added
- **Shelf status on every work** — *reading* / *watching* · *paused* ·
  *abandoned* · *completed*, plus the ordinary untracked state. Drawn as a
  **colour bar directly under the cover**, Radarr-style: the artwork itself is
  never covered, which is the whole reason it is a bar and not another badge over
  the poster. Blue in flight (filled to your progress), amber held, red given up
  on, green finished. `--accent` is deliberately not used for *reading* — it sits
  a few degrees from `--error`, and a bar you have to squint at to tell "reading"
  from "abandoned" is no bar at all.

  Whatever you are on with right now **pins to the top of the default sort** and
  keeps an open-book (films: ▶) mark on its artwork. Pick any sort from the menu
  and it sorts as asked — the pin belongs to the default view, not to the data.

  Set from the detail's ⋯ overflow (and a standing button on desktop); the state
  chip beside the hearts opens the rest of the lifecycle. `completed` is settled:
  the only move out of it is starting again. Clearing back to untracked stays
  available everywhere, because a mis-tap should not be permanent.

- **Wishlist, derived from having nothing quoted yet** — no column, no
  bookkeeping, and it clears itself the moment you add a quote. The filter row
  gains an `all · wishlist · annotated` chip triplet (its own section in the
  phone's filter sheet) so you can browse just the unopened shelf, or hide it and
  see only what you have actually marked up.

- **Progress in pages, seasons and episodes — not just percentages.** A physical
  book takes *page 96 of 214*; a show takes *season 2 of 3, episode 6 of 10*, with
  whole earlier seasons counting in full so the bar advances through a run. A film
  keeps the plain percentage, having neither. The percentage is **derived** from
  the position server-side, so the bar, the export and every client read one
  number that cannot disagree with the other. A page number with no page total is
  refused rather than stored — it cannot become a percentage, and accepting it
  would leave a bar that never moves.

- **A read log, so a reread is history rather than an overwrite.** Finishing a
  work closes its read; starting again opens the next one. A `×3` chip on the
  detail opens the dates. Dates are **partial by design** — `2019`, `2021-02`, or
  a full day — because "I read it in 2019" is a real answer and padding it to
  January 1st invents a precision nobody has. An abandoned attempt keeps its stop
  date but does not count as a read.

- **A calendar picker for partial dates**, where every level is a legal stopping
  point: pick a year and you have a year, carry on for a month, carry on again for
  the day. Also applied to a person's **Born / Died**, which were 4-digit-year
  text boxes — they now take a full date when you know one, while the "1920 –
  2001" lifespan line still shows only the years.

- **A soft shelf cap** — 5 books, 2 films, 5 shows in progress at once. Going past
  it opens the shelf rather than refusing: settle one from the list, or carry on
  anyway. Enforced only in the client, deliberately: a second device must not be
  told "no" for a rule you can override on this one.

- **Shelf state is filterable** — a multi-select of the five states beside the
  genre and series controls, so "paused or abandoned" (the unfinished business you
  would actually go looking for) is one dropdown.

- **Season and episode on a show's dialogues** — *shows only; a film has one
  runtime, so its timestamp already locates the line completely.* A series does
  not: "01:12:40" means nothing without which of sixty episodes it is 01:12:40 of.
  Add-and-edit gains a Season / Episode pair beside the timestamp for a show, and
  the locator then reads as **S2E6** wherever a timestamp already showed — the
  frame's credit line, the table (its own sortable column), search results, the
  quiz card, and the share card. A season on its own is fine, because sometimes
  that is all anyone remembers; an episode without one is refused, since it cannot
  be placed against a numbered season.

  Lines now sort **through the run** — season, then episode, then the clock — so a
  show's quotes read in the order they were said rather than by whichever
  timestamp happened to be smallest. Un-episoded lines fall to the end.

  **Season 0 is a real season** — it is where a series keeps its specials and
  pilots — so the columns are nullable and *unset* is `null`, never `0`. A
  0-means-unset integer would have made "the specials strand" and "nobody recorded
  an episode" the same fact, and dropped `S0E1` on every export.

- All of it **round-trips through the Markdown export**: `status`, `progress`,
  `page: 96/214`, `season: 2/3`, `episode: 6/10`,
  `reads: 2019-03-04 — 2019-04-01; 2021 — 2021-02 (abandoned); 2026-07 —`, and
  per-line `- season:` / `- episode:` bindings on a show's dialogues (a
  hand-written `- episode: S2E5` or `2x05` is read back too, since that is how
  people actually write it). On the way back in it is fill-empty-only like every
  other import backfill, so re-importing an old export cannot un-mark what you are
  reading now or duplicate a history that is already there. The whole locator
  survives the staging queue, whose editor can fix a season or episode the same
  way it fixes a timestamp.

### Changed
- `PUT /books|movies/{id}/status` is a **new endpoint** and the only path that
  changes status, progress, position or the read log — they move together in one
  transaction. Deliberately *not* part of the full-state `PUT /{id}`: an ordinary
  Edit-form save must never be able to rewrite reading history.
- `POST` / `PUT /dialogues` accept `season` and `episode` (nullable integers) and
  every dialogue payload now carries them. A **film's** line is stored with
  neither: they are dropped rather than refused, so flipping a show to a film in
  the Edit form leaves its old lines editable instead of failing every later save
  from a form that no longer offers the fields.

## [1.2.0] - 2026-08-04

Bulk-imported quotes stop entering the library on arrival. Every import endpoint
used to parse and write in one shot, so by the time the results screen said what
had happened the quotes were already in `annotations` / `dialogues`, already
indexed for search, already in the review deck — and the only undo was
hand-deleting them. The 1.1.1 bug where a film's own export re-imported as a
*book* is exactly the class of mistake that should be caught before the write.
So imports now land in a holding area with a screen for working in it, and the
counters they used to report move to the moment they are approved. See *Known
bugs* in [the roadmap](docs/roadmap.html) for what this release deliberately does not
fix.

### Added
- **Import staging: a file parses into a pending queue and stays there until you
  okay it.** Indefinitely, across sessions, books and films mixed together. The
  queue is one list rather than a per-upload wizard — everything staged from
  every file, grouped by the work each quote will attach to, with the batch
  (source + filename) as a filter. Every group heading says where its quotes are
  going: an existing title they will join, or a new one that will be created.
  That preview is recomputed on every read rather than stored, because the
  library moves while quotes wait — a book added yesterday changes the answer for
  a batch staged last week.

  Reached from the ＋ Add surface, from an import's own results, and from a card
  on Home; a count on the ＋ Add pill says how much is waiting, so a
  half-finished import isn't forgotten. Its own URL, `/pending`, for a link or a
  bookmark. Import is still not a permanent tab.

  A work with no quotes at all is queued too, and approving it creates the book or
  film by itself — an export writes every work, quoted or not, so anything else
  would quietly drop your unquoted shelf on a whole-library round-trip.

- **Bulk edits over a selection, including two the live endpoints cannot do.**
  Checkbox multi-select over the rows, the same `BulkBar` strip Search and
  Metadata already share, and a per-row editor for one-offs. Colour, favourite,
  chapter, character, actor and timestamp behave as they do elsewhere. Beyond
  that:

  **Tags come off as well as on.** `POST /annotations/bulk` can only union, and
  the reason is structural: its one additive helper is all it has, and the
  full-state alternative would need every row's current tag set, which the
  request does not carry. A staged tag is denormalized text on the row, so a
  removal is a set operation on that string — and a tag that exists only inside
  an unapproved import never joins your tag vocabulary at all.

  **Retarget the work, book and film interchangeable.** A staged quote can move
  to a different work in the queue, or onto a work already in the library —
  including *across kinds*, because that is the repair for a misdetected file. A
  staged row carries both locator sets (chapter/location and
  character/actor/timestamp) and approval reads whichever the destination kind
  uses, so moving a batch of book highlights onto a show does not destroy the
  original values on the way, in case the move is itself the mistake.

- **Location formulae — add, subtract, multiply, divide, set, reset.** The reason
  editing locations in bulk needs more than a text box: a Kindle export numbers
  by *location* rather than page and the conversion is a division; a PDF's page
  numbers run a few ahead of the print edition's. Locations stay free text
  (`p.142`, `610-612`, `42%`, `1234`), so the transform rewrites the numeric runs
  in place and leaves everything around them alone — `p.142` minus 5 is `p.137`,
  and a range moves at both ends. A value carrying a clock pattern converts to
  seconds, shifts, and re-renders with the component count and zero-padding it
  arrived with, because `01:02:03` plus a minute is `01:03:03` and not
  `61:62:63`; a timestamp *range* moves at both ends too, and detection is by
  value rather than by field, so an audiobook "location" of `2:15:00` gets the
  same treatment. Results clamp at both ends, division rounds, leading zeros
  survive (`p.007` plus one is `p.008`), and a thousands-separated locator stays
  grouped (`1,234` plus one is `1,235`). A chapter:verse locator is left to the
  plain numeric path — `2:255` is not a clock, and half-matching it would be
  worse than not matching it at all.

  Formulae **chain** on the current value, so `−5` then `÷16.69` composes.
  `reset` is an absolute restore of the as-imported snapshot, not an inverse of
  the last operation — every row keeps the value it arrived with, so a formula
  applied by mistake is undone rather than lived with.

### Changed
- **The seven import endpoints stop reporting `added` / `skipped` / `enriched`
  and start reporting a batch id and a staged count.** The old counters come back
  from `POST /import/staged/approve` instead, which is where the writing now
  happens. A parser's own counters stay on the import reply — the Kindle
  clippings importer still says "1 bookmark skipped, no text to import" at the
  moment you upload the file, which is the only point at which that is
  actionable.

  New endpoints, `requireAuth` under `/api` like the rest: `GET /import/staged`,
  `POST /import/staged/bulk`, `POST /import/staged/approve` and
  `DELETE /import/staged`. All four share one selector — `{ids | work_ids |
  batch_id | all}` — so "approve everything" does not have to ship thousands of
  ids through a 64 KiB body. A foreign selection matches nothing and answers
  **404**, never 403.

- **Migration `0023` adds `import_batches`, `staged_works` and `staged_quotes`,
  deliberately outside the live tables.** A `pending` flag on `annotations` would
  have had to be threaded through every existing read as `WHERE pending = 0` —
  dozens of queries, each one a place to forget it and leak an unapproved quote
  into a list, a search hit or a quiz card. Separate tables make the default
  safe: no existing query can see staged rows because no existing query names
  these tables. Staged text carries no FTS triggers and no `item_reviews` rows,
  so it is invisible to search and cannot be pulled into a quiz; ownership is by
  parentage (`staged_quotes` → `staged_works` → `import_batches`, which holds the
  `user_id`), mirroring `annotations` → `books`.

- **Approval converts staged rows back into the importer's own intermediate
  shape** and runs the existing persist path, so dedupe, duplicate enrichment
  (fill-empty-only, colour upgrading off yellow, favourite only upward, tags
  union) and the ISBN → ASIN → title/author book resolution behave exactly as
  they did when the importers wrote straight through. That needed one refactor and
  no behaviour change: the target-resolving half of the old `importOneBook` /
  `importOneMovie` is now separate from the loop that writes the quotes, so the
  loop can also be handed a target the user picked. There is one implementation
  of those rules, not two.

- **The export → re-import round-trip tests go on asserting exactly what they
  asserted before**, through an import-then-approve helper — a library's own
  export re-imported and approved is still a dedupe no-op. Re-importing the same
  file twice now gives two batches rather than one silent no-op write; approving
  both adds the quotes once.

### Removed
- **The one-at-a-time post-import review panel.** It walked the rows missing a
  chapter or a location and asked you to fill them in, one quote at a time, after
  they were already in the library. The queue supersedes it and does the same job
  over a selection, before the write.

## [1.1.1] - 2026-08-03

An adversarial re-read of what 1.1.0 shipped, plus the import-routing bug that
prompted it. Three of the five fixes below are regressions or dead code from
1.1.0 itself; two predate it. One bug found in the same pass is recorded but
deliberately **not** fixed here — concurrent writes can still return a 500, which
needs the single-writer design PLAN §8 always specified rather than a patch. See
*Known bugs* in [the roadmap](docs/roadmap.html).

### Fixed
- **A duplicate quote could hang the request instead of answering 409.** The
  duplicate-create path added in 1.1.0 reads the existing row so a retried write
  is idempotent — but it read it through the connection pool while still holding
  its own INSERT transaction, which needs a *second* connection. The pool is
  capped at four, so once they were in use the handler blocked waiting for a
  connection only it could release: the request hung until the busy timeout
  turned it into a 500. Reachable over plain HTTP by the least exotic client
  behaviour there is — re-posting the same captures, which is what an offline
  queue does. The transaction is now released before the read, since the failed
  INSERT has nothing to commit.

  Also on that path: if the existing row was deleted concurrently between the
  failed insert and the read, the response was a 500. It is now a plain 409.

- **`books.updated_at` and `movies.updated_at` were never written.** 1.1.0 added
  both columns and backfilled them, on the reasoning that a client mirroring the
  library needs them and that adding a column later is more annoying. It did not
  write them: no INSERT set either, and none of the nineteen UPDATE sites across
  editing, metadata backfill, bulk edit and import bumped them. So every row
  created since 1.1.0 had NULL and no edit ever moved the value — a column that
  looked usable, which is worse than one that is absent, because the first
  delta-sync client to trust it would silently have missed every edit. All
  twenty-four write sites now maintain it, and rows created since 1.1.0 are
  backfilled.

  Attempted first with triggers, which seemed like the robust answer for tables
  written from a dozen places. It is not: `books` and `movies` carry FTS5
  external-content sync triggers, and a trigger that updates the row it was fired
  by drives those out of step with the content table — SQLite reports it as
  `database disk image is malformed` on the next insert. Worth knowing before
  anyone adds a convenience trigger to a table with an external-content index.

- **Filling in a page number after an import wiped an attached sticker.** The
  post-import review panel kept its own copy of the full-state PUT helper, and
  that copy omitted the three sticker fields the shared one carries for exactly
  this reason. Since PUT is full-state, saving a chapter or location sent nulls
  for the sticker and its seal position, destroying both. It now uses the shared
  helper. Predates 1.1.0.

- **One user minting pairing codes could evict another's.** The in-memory code
  table is capped, and eviction took the globally oldest entry — so an account
  holding down "Pair a device" could knock out everyone else's pending code.
  Eviction now falls on the minter's own codes first.

- **A film could re-import from its own export as a book.** `POST /import/markdown`
  takes one endpoint for both kinds and decides which by inspecting the file, and
  that decision rested entirely on *optional* content: `director:` / `creator:` /
  `collection:` in the frontmatter, or `character:` / `actor:` / `timestamp:` on a
  line. A film with none of them — no director recorded, no collection, its lines
  unattributed — carried nothing that said "film", so it fell through to the book
  importer and came back as a **book with annotations**, silently, with the
  dialogue fields dropped.

  The catalogue export now always writes `type: movie` or `type: show`; the book
  export never writes `type:` at all, so that one line is decisive and routing no
  longer depends on which optional fields happen to be filled in. The old
  heuristics still run, for hand-written files and for exports written before the
  line became unconditional.

  Two consequences worth knowing. **Catalogue exports gain a `type:` line** — six
  characters of frontmatter, and the thing that makes the file unambiguous.
  **Files already exported by 1.1.0 or earlier are not retroactively fixed**: a
  bare film export written before this release still has nothing identifying it,
  so re-export it (or add `type: movie` by hand) before importing it back. This is
  also why colour could not be pressed into service as a signal — migration 0021
  put it on both kinds, so it distinguishes nothing.

## [1.1.0] - 2026-08-03

Groundwork for a native Android app, and the one arbitrary hole in the data
model closed. Nothing here changes how the web UI is used; almost all of it is
the server learning to talk to a client it has never had — one that is installed
rather than served, updates on its own schedule, and is often offline.

### Added
- **Colour for film and show dialogue.** Dialogues could be favourited, tagged,
  stickered and reviewed exactly like book highlights, but not coloured — the
  0003 migration built them as a near-copy of annotations and left colour out.
  They now carry the same four colours, with the same quick-pick dots on the
  frame, the same picker in the add/edit form, the same filter, the same tint on
  the shareable image, and the same round-trip through Markdown export/import.
  Existing lines land on yellow, the default a new annotation gets, so nothing
  looks categorised that wasn't.
- **Device tokens and pairing**, for native clients. **Settings → Devices**
  mints a one-shot pairing code (five minutes, rate limited); the app exchanges
  it for a long-lived bearer token. A device stays paired until you unpair it —
  a password change signs out browsers but deliberately leaves phones alone,
  because silently unpairing every device on a routine password rotation is
  worse than the threat it would mitigate. Revoking is its own explicit act, per
  device or all at once.
- **`GET /api/capabilities`** — an unauthenticated version handshake reporting
  the running version, an integer API revision and a feature list. An installed
  app and the server update independently, so the app can say "this server is
  too old for me" instead of discovering it as a 404 mid-save.
- **`limit` / `offset` on the list endpoints** (books, movies, annotations,
  dialogues). `/books` and `/movies` previously had no limit at all and shipped
  the whole library on every call; `/annotations` and `/dialogues` capped at 500
  with no way to reach anything past it. Sending neither parameter still returns
  everything, so the web UI is unchanged.
- **Response compression.** Quote text compresses roughly eight to one, which is
  invisible on a LAN and decisive over Tailscale or cellular. `compress/gzip`
  from the standard library — no new dependency.
- **`noted_at` and `source` on quote create.** A capture made on Tuesday and
  flushed on Friday used to be dated Friday, with the real date unrecoverable.
  Both quote kinds now accept the date they were actually taken, and record what
  captured them (`manual` or `ocr`).

### Changed
- **Annotations and dialogues share one shape.** The two were written separately
  as near-copies and drifted: dialogues arrived without tags, then gained them;
  arrived without colour, and kept not having it. Both now embed a common
  `quoteReq`/`quoteRow` and differ in exactly one respect — how a quote points
  back at its source (a book highlight has chapter and location; a film line has
  character, actor and timestamp). A test pins that boundary, so the next field
  added to one kind cannot silently miss the other.
- **A duplicate-create 409 now carries the row that already holds the slot.** A
  bare 409 is enough for a browser, where a person can see what happened, but it
  strands an offline client: it cannot tell its own retried write from a genuine
  clash with a different quote, and dropping the capture and reporting a
  permanent failure are both wrong.

### Fixed
- **An in-process restore left new auth state pointing at the closed database.**
  Restore closes the live database and reopens a different file, rebinding the
  session store as it goes; anything else holding the old handle kept it. The
  rebinding is now in one place that covers every store, so a restored box
  doesn't answer a valid credential with an inexplicable 401.
- **A migration replayed by deleting its `schema_version` row silently stopped
  replaying** once any newer migration existed, because `Migrate()` resumes from
  the highest recorded version. The affected test now steps forward from an
  older schema instead, so it no longer depends on being the newest migration.

## [1.0.1] - 2026-07-31

### Added
- **Collections for films and shows.** Group the Catalogue by collection — Lord
  of the Rings, Mission Impossible — the way the Library groups books by series.
  A collection can hold a **film and a show together** (Twin Peaks and Fire Walk
  With Me; Firefly and Serenity), and titles still appear individually:
  grouping buckets the view, it never removes rows. TMDB's
  `belongs_to_collection` already fills it in on lookup. No migration — the
  column has existed since the 0006 migration, whose own comment calls it a
  "franchise / collection name", and `media_type` lives on the same row, so
  cross-type membership needed no schema change. What was missing was the
  affordance: the Catalogue had no group-by control, so you could filter to one
  collection but never see the structure.
- **Drag the dropdown's textured thumb.** The toggle's selected-option pill has
  always been grab-and-slide; the dropdown renders the identical thumb but only
  ever moved it by hover or arrow keys. It now drags too — same interaction,
  vertical. On a list long enough to scroll it stays mouse-only, because
  `touch-action` cannot serve both the thumb and the scroller.

### Fixed
- **Series and collections survive an export.** They didn't: the Markdown
  frontmatter carried title, author, year and genres but never the series, so a
  library rebuilt from its own export silently lost every series and collection
  it had. Both renderers now emit a `Name #1.5` value (books as `series:`, films
  and shows as `collection:`) and both importers parse it back, fill-empty-only
  so a value already on the row wins.
- **A film with no director was misrouted to the book importer.** Format
  auto-detection keys off `director:` / `creator:` and the
  character/actor/timestamp bindings; a title carrying none of them fell through
  to the book path. `collection:` is now decisive, since only the catalogue
  export writes it.

### Changed
- Films and shows say **collection** where books say **series** — filter, sort,
  group and both edit forms. "Series / franchise" read as a TV field on a page
  where *series* already means a show. Same column, same JSON key, same FTS
  index: renaming those would touch some sixty Go call sites and the tests that
  pin them, for nothing a reader would see.
- A show's poster badge reads **SHOW** rather than `SERIES`, matching the
  media-type filter and the capture picker.

## [1.0.0] - 2026-07-31

The first stable release. It is a bug-fix and polish pass rather than a rewrite —
the shape of the app is the one 0.9.x arrived at — but three of the fixes were
load-bearing enough that shipping 1.0 without them would have been dishonest.

### Added
- **Kindle `My Clippings.txt` import (experimental).** The device's own file,
  every book at once — the last stubbed importer, whose route had answered `501`
  since it was deferred. Amazon never documented the format and localises the
  whole metadata line, so the parser reads **structure, not English**: the
  `==========` separator, the leading `- `, the `|` field splits, digit runs, and
  whether the body is empty. Language keywords only ever promote a highlight to a
  note; they never rescue a block the structure rejected. Keyword matching is
  word-bounded and confined to the metadata line's first field, because `loc`
  otherwise matches "clock", `nota` matches "notary" and `page` matches
  "pageant" — a chapter titled *NOTES ON THE CLOCK TOWER* must stay a chapter.
  Records that cannot be read are **skipped and counted back to you**, never
  guessed at: bookmarks (no text), unreadable blocks, notes merged onto the
  highlight they annotate, and the near-duplicates Kindle leaves behind when a
  highlight is extended. Locales that could not be verified were left out rather
  than guessed; an unknown language costs a less precise field, never a lost
  quote. The card says *experimental* on its face.
- **Floating bottom nav on phones.** Four thumb-reachable icons — Search, Home,
  Library, Catalogue — hovering clear of the bottom edge so the Android gesture
  pill keeps its own strip. It slides away as you read down the page and returns
  on the way back up; reduced motion opts out of hiding entirely rather than
  snapping. An addition, not a replacement: the ☰ drawer still owns the utility
  tabs, ＋ Add and the account rows.
- **One-tap colour on a quote card.** The four colour blobs now sit in the card's
  action row — on a phone between the ♥ and the ⋯ overflow, on desktop in the
  same hover gate that reveals share · edit · delete. Recolouring a highlight no
  longer means opening the edit form. The swatches became a proper ARIA radio
  group along the way (one tab stop, arrows move focus, Enter picks).
- **Editions grouped in book search.** Printings of the same book — identical
  title *and* author — fold into one row, with the editions one tap behind a
  chevron. The match is strict on purpose: only case, diacritics and punctuation
  are folded, so *Dune* and *Dune: Book One* stay apart. Fusing distinct works is
  the unrecoverable direction.
- **`tagged` and `has notes` filters** beside `♥ favourites` on both list pages,
  as independent toggles. `GET /books` and `GET /movies` gain `tagged_count` and
  `noted_count` for them.

### Fixed
- **The Daily Quiz served the same few books, for weeks.** Two independent
  causes. The bounded fetch was a **rowid prefix, not a sample**: both ordering
  keys tied across huge blocks of rows (for an unseen card the overdue ratio is
  `NULL`, so every unseen card tied) and SQLite breaks ties in scan order — and
  the importer writes book by book, so annotation ids are contiguous per book and
  `LIMIT 40` returned forty rows from *one* book. Separately, unseen cards could
  not reach the deck at all while a backlog existed: one query ordered
  seen-before-unseen let the due bucket fill the whole fetch. Ordering now ends
  in a hash of the id, the two buckets are fetched separately, and a rotation
  over works means consecutive cards come from different books. **Practice goes
  through the same selector** and inherits both — a round no longer walks forty
  quotes from one book.
- **Never-reviewed quotes now get a guaranteed share of the deck.** Every third
  Daily slot is reserved for a card never answered — two a day at the default
  quota, where it was effectively zero behind any backlog. Either bucket yields
  its slots when empty, so a deck is never short. Practice deliberately does
  *not* inherit the reservation: with no schedule to honour it would have made an
  already-reviewed card several times *more* likely to come up than an
  unreviewed one.
- **The quiz could stall on a wrong answer with no way forward.** `json()` let a
  transport-level fetch rejection escape — an offline blip, a Wi-Fi-to-cellular
  handover, a server restart mid-request — so every line after the `await` was
  skipped, including the one that re-enables the control. It now resolves to the
  same `{ok:false}` shape the upload helper always documented, which unsticks
  in-flight flags across the whole app, not just the quiz. In the quiz a non-2xx
  additionally *removed* the Next button from the DOM rather than merely
  disabling it; the reveal is now kept, an inline error says the grade didn't
  count, and Next always advances.
- **Book and film detail pages showed Export / Edit / Delete twice on a phone** —
  once in the sticky bar's ⋯ overflow and again as a standing button row.
- **The Capture-quote picker never showed films or shows.** The list was built
  books-first and then sliced to the first eight matches, so any library with
  eight or more books hid every film behind them. Matches are now ranked within
  each kind and interleaved.
- **Book search results showed no covers**, though the payload has carried
  `cover_url` all along and the CDNs were already allow-listed. The row also
  spent roughly 145px of a ~256px phone row on a `GOOGLE BOOKS` text pill and a
  bordered *Add* button, truncating the title to nothing: the source is now a
  16px mark (its name on the tooltip and the accessible label) and *Add* a
  borderless `+`, with the freed width going to title and author.
- **The phone genre filter was a lone `All` chip above a `More…` dropdown holding
  every genre** — the chip strip measures the room left on its row, and in the
  filter sheet that measurement always collapses to zero. It is now one control
  with `All` as its first option, matching series, sort and group beside it.

### Changed
- `patch()` on annotations resolves a boolean so an optimistic caller can roll
  back; existing callers ignore it.
- `normName` moves into the shared UI module, documented about its Latin-only
  fold; the unused `sourceLabel` is retired.

## [0.9.5] - 2026-07-25

### Changed
- **Spaced repetition now climbs a fixed interval ladder.** A correct recall
  moves a card's memory half-life up one rung — **7 → 30 → 100 days** —
  and holds at 100 once there; a single *Forgot* drops it straight back to 7
  from any rung. A card's first-ever *correct* answer always starts the ladder
  at 7, even when an earlier wrong answer created its schedule row. This
  replaces the tunable rule (×grow on recall, ×shrink on a lapse, late-recall
  bonus, 365-day cap), so the *Recall grows half-life by* and *A lapse keeps*
  Settings sliders retire with it (stored values are ignored and dropped).
  Existing half-lives above 100 days are clamped down on upgrade; off-ladder
  values climb onto the nearest rung at their next answer.

## [0.9.4] - 2026-07-23

### Added
- **Native HTTPS (opt-in).** Point `TIPPANI_TLS_CERT` / `TIPPANI_TLS_KEY` at a
  PEM pair and Tippani serves TLS itself — no reverse-proxy container needed.
  The pair **hot-reloads** when the files change (renewals need no restart; a
  botched write keeps serving the previous pair and logs `TIP-HTTP-001`),
  session cookies turn `Secure` automatically, and the container healthcheck
  probes https. Certificates come from wherever you already get them (home CA,
  `tailscale cert`, external ACME tooling) — Tippani still doesn't speak ACME,
  phone home, or run renewal jobs.
- **One-click updates through a docker-socket-proxy.** Set
  `TIPPANI_DOCKER_HOST=tcp://dockerproxy:2375` and the in-app update talks to a
  [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)
  (`CONTAINERS=1 IMAGES=1 POST=1`) instead of a mounted socket — the one-shot
  Watchtower helper gets `DOCKER_HOST` and joins all of the container's networks
  (so whichever one carries the proxy is covered) rather than a socket bind. The
  raw-socket path is unchanged; the README documents
  both, including what the proxy genuinely does and doesn't harden. Engine
  failures during an update now log as `TIP-UPDATE-001`.

### Fixed
- **Phones no longer pan sideways on Settings, Metadata and User management.**
  A closed tooltip (the ⓘ info-dots') kept its invisible bubble in layout, and
  one sitting near the right screen edge widened the page's scrollable area —
  the page dragged sideways into blank space, and iOS pulled the fixed
  User-management overlay along with the pan. Closed bubbles now leave layout
  entirely (the fade-in/out survives on modern engines via `@starting-style` +
  `allow-discrete`), and the page root upgrades its horizontal-overflow
  backstop to `overflow-x: clip`.

## [0.9.3] - 2026-07-23

### Changed
- **Dialogue quotes drop the wrapping quote marks** on cards (favourite tiles,
  the Catalogue dialogue cards, the tour sample) — a multi-speaker line reads
  badly inside one pair of quotes. Book quotes keep theirs.
- **TMDB / TheTVDB ids are links** on the film/show detail header (open the
  source record), and that credit line is vertically centred so the portrait
  chips and the mono text (year · ids) line up instead of sitting on the
  baseline — the book detail credit line too.
- **Mobile drawer rework.** Search moves up directly below ＋ Add; every nav row
  carries a contextual subtext (tag count, metadata issue count, daily-quiz
  streak, version — alongside the library/catalogue counts); and **Profile** +
  **User management** get their own section at the bottom. Quote capture is no
  longer a drawer row (it's the ＋ Add surface's Capture tab), and the Add
  subtext ("Work · Quote · Import") can't wrap onto a second line.

### Fixed
- **Multi-speaker dialogue credits split on cards.** A dialogue crediting
  several actors ("Sinéad Cusack, Hugo Weaving") now shows each as an
  individual person with their portrait on the Home favourite tiles and the
  search dialogue hits, matching the rest of the app (previously one joined,
  portrait-less chip).
- **Quotes keep their line breaks.** Multi-line / multi-paragraph quotes (e.g.
  multi-speaker dialogue) no longer flatten to one run on the favourite tiles,
  the Daily-Quiz / Practice prompt, the search quote hits, or the shareable
  image — matching the book/film detail cards.

## [0.9.2] - 2026-07-23

### Added
- **Activity is Saves · Quiz · Practice.** The Stats activity calendar gained a
  switch: the same GitHub-style heatmap now also shows Daily-Quiz and Practice
  answers per day (new `daily_quiz` / `daily_practice` on `GET /stats`), and the
  Practice view carries a **reset practice** link. The calendar fills the card
  width on desktop (well over a year of history) and holds a year with
  horizontal scroll on a phone.
- **Practice resumes across a reload,** and a round can be ended early. The
  active deck, position and tally persist (per-user, so a shared browser never
  shows one account's deck to the next), so a refresh drops you back onto the
  same card instead of the start; an **End practice** link stops the round and
  shows the summary.

### Changed
- **Films and shows are tagged apart in search.** Movie search hits carry
  `media_type`, so a result card shows a **FILM** / **SHOW** tag by its title.
- **Multi-author credits split everywhere they show.** Search result cards, the
  search quote pop-up and the Home favourite tiles now render a joined credit
  ("Gaiman & Pratchett") as individual, clickable people with portraits — the
  same splitting the detail pages and group-by headings already used. The search
  pop-up previously showed no author/actor chips at all.
- **Quote capture is only in ＋ Add now.** The separate top-bar ❝ pill is gone
  from both bars (it duplicated the Add surface's Capture tab); the phone drawer
  keeps its Capture-quote row. The Add slider uses short labels
  (Add · Capture · Import) on a phone.
- **Stats breakdown rows line up.** Cover/portrait kinds reserve a fixed art
  column, so an entity without an image aligns its name and status bar with the
  ones that have art.

### Fixed
- **Activity x-axis shows every month.** The leading partial month now yields so
  the first full month (e.g. August) keeps its label instead of being crowded
  out, and the calendar's data window matches how many weeks it can draw.
- **Search table view no longer blanks on a facet-only query.** A date, author,
  tag, genre or decade query (with no plain title/quote hit) rendered an empty
  screen under the table view; the facet sections now render in every view.
  Annotation/Dialogue section headers count quote hits, matching the table.
- **Demo:** the ribbon notes the self-hosted app is more polished, and demo
  cover art carries an explicit size so the first catalogue tile can't drift out
  of line.

## [0.9.1] - 2026-07-23

### Added
- **Search results are sectioned by what matched.** `GET /search` now facets
  every hit: **Books / Movies** (title · series), **Annotations / Dialogues**
  (quote · character), **Authors / Directors / Actors** (the credit columns,
  each person heading their works or lines), **Notes** (margin-note matches),
  **Tags** (matching tag names with the quotes wearing them) and **Genres**
  (matching genre names with their works) — the Search page renders one
  section per facet, only when it has hits. Two structured facets join them:
  a **decade** query (`1990s`, `40s`) lists the works published/released
  then, and a **date** query (`2026-07-14`, `14 July 2026`) lists everything
  **added that day**. A query whose tokens span columns ("casab mich" —
  title + director) still finds its work via a cross-column fallback pass,
  and the zero-hit typo correction covers the new facets too. Dialogue
  search hits now carry the margin `note`.
- **Stats is clickable — and wears art.** Activity-calendar dots highlight
  on hover and click through to that day's additions on the Search page
  (the new date facet). Breakdown rows carry cover/poster thumbs (books ·
  films · shows) or People-console portraits (authors · directors · actors),
  and every breakdown name, top tag and superlative title clicks through to
  Search. `GET /stats` sends `cover_path` on breakdown rows and on the
  most-annotated / most-quoted superlatives.

### Changed
- **Capture quote is a tab of the ＋ Add surface — and left the Home screen.**
  Picking "Capture quote" now swaps the bottom of the Add pop-up in place,
  exactly like "Import files" — look up / add, capture and import rotate
  freely inside one surface (no more closing into a separate pop-up). The
  Home capture tile is gone; capture lives where adding lives: a **❝ pill
  beside ＋ Add in the top bar (desktop and phone)** opens the surface
  straight on the capture tab, and the phone drawer gained a **Capture
  quote** row.
- **The look-up card's manual path is push-button on failure.** "Add
  manually" has always been one link away (press it to skip the lookup
  entirely); now a failed or empty lookup also surfaces a real **"＋ Add
  manually instead"** button, so the hand-entry escape hatch steps forward
  exactly when the lookup lets you down.

## [0.9.0] - 2026-07-22

### Added
- **Onboarding & guided tour.** Settings grew an **Onboarding** card that
  lists every feature and starts a guided step-by-step tour of them all —
  a spotlight ring over the real control plus a walkthrough card. It runs
  once on each user's **first launch**; every step is skippable (Next), the
  whole tour can be skipped, or parked with **"finish later"** — a Resume
  button in Settings picks up at the saved step (new `tour` / `tourStep`
  preferences, partial-merge like the rest). The tour never asks for your
  files: a public-domain book quote (*Pride and Prejudice*) and film
  dialogue (*Casablanca*) are built in as sample content, and the admin
  steps show and ask for the **TMDB / TheTVDB / Google Books keys and the
  optional Amazon cookie** — with instructions on where each comes from —
  while the highlighted Metadata card stays usable so they can be pasted
  mid-tour.
- **People chips on Home.** Favourite tiles wear author/actor faces on the
  source line and, expanded, full clickable person chips (portrait + name →
  the people panel). The quiz wears them too: a *"which quote is from this
  work?"* prompt chips the book's author or the line's actor, and every
  work-title option carries its person — book → author, film/show → your
  dialogues' actor, falling back to the director (`option_meta` beside
  `options` on source cards; screen cards now also carry `actor`).

### Changed
- **Stats: ranked, scrollable breakdowns; superlatives as tiles.** Breakdown
  rows are ranked (#1 onward) and the list scrolls past ~10 visible rows —
  the server now sends up to 50 per kind (was 8). Top tags gets the same
  rank + scroll treatment past ~5 visible (cap 5 → 50). The Superlatives
  card shrank from half a column into one row of compact tiles, and
  Colours + Top tags stack beside the Breakdown instead.

## [0.8.7] - 2026-07-22

### Fixed
- **Adding annotations & dialogues on desktop.** 0.8.6 made every add a pop-up
  and removed the inline add tile, but the desktop detail toolbars never got
  the promised ＋ — annotations and dialogues could only be added from a
  phone's detail bar. The annotation/dialogue toolbar now carries an explicit
  **＋ Add annotation / ＋ Add dialogue** button, and the shell's ＋ Add surface
  gained a **Capture quote** segment that swaps to the quick-capture sheet
  (target any book, film or show) — so the top ＋ adds quotes too, on every
  device.

## [0.8.6] - 2026-07-22

### Added
- **GitHub-style activity calendar on Stats.** A year of saves as one dot per
  day, one column per week, only the months labelled on the x-axis — sequential
  accent shading by count, horizontal scroll (opened at today) on phones.
  `GET /stats` now returns `daily_activity` (per-day counts, last ~53 weeks)
  and drops `monthly_activity` with the old 12-month bars.
- **Memory card on Stats.** Where the whole library stands on the forgetting
  curve: a tile per recall status, how many quotes are in the review rotation,
  and their average half-life (`recall` in `GET /stats`).
- **Breakdown card on Stats.** The People card grew a full dimension dropdown —
  **Authors / Books / Series / Films / Shows / Directors / Actors**. Each kind
  shows its entity count and per-entity **works · quotes · recall statuses**
  (stacked status bar + spelled-out counts), headlined by the **best
  remembered** and **most forgotten** entity of that kind. Author/director/actor
  tallies run **after multi-author credit splitting** (§11), so "Gaiman &
  Pratchett" counts each author. Replaces the flat `authors`/`actors`/
  `directors` counts and `top_authors`/`top_actors`/`top_directors` in
  `GET /stats` (`breakdown`).

### Changed
- **Longer memory half-life + a grace week for new quotes.** The half-life
  floor (and unseen-card default) rises from 1 day to **7 days**, and due-ness
  applies the floor to stored stabilities. A quote is **"remembered" for its
  first week** after being saved — it doesn't enter the Daily Quiz until the
  week is up (a recorded lapse still wins over the grace week).
- **Adding annotations/dialogues is always a pop-up.** The add form opens in
  the standard form modal on every device — a full-screen sheet on phones —
  and the inline dashed tile is gone; the omnipresent ＋ buttons are the entry.
- **Search moved out of the nav tabs on desktop.** It sits as an icon-only
  button in the ＋ Add pill's accent texture, between ＋ Add and the user chip —
  the way the phone top bar already works.

### Fixed
- **Stats nav icon** reads as outlined rectangular bars so it carries the same
  visual mass as the neighbouring glyphs.
- **Search tiles pack like every other board.** Result cards deal onto the
  shortest column (shared masonry, relevance order kept) instead of CSS
  columns, which could leave the last hit stacked on the longer column.
- **New tags can be created from the add/edit forms reliably.** Tag text typed
  without pressing Enter now commits when focus leaves the field instead of
  silently vanishing on save. (Unknown tag names were already auto-created
  with the default colour and style — editable later on the Tags page — both
  from forms and from imports.)

## [0.8.5] - 2026-07-19

### Added
- **People on the Stats page.** The Stats page gains a **People** card with a
  dropdown that switches between **Authors / Actors / Directors** — each showing
  that kind's count and a top-N leaderboard (authors by book count, actors by
  lines quoted, directors by films). `GET /stats` now returns `actors` /
  `directors` counts and `top_actors` / `top_directors` alongside the existing
  authors data. This is the groundwork for the upcoming achievements feature.

### Removed
- **Ratings are fully retired.** An earlier pass removed the 1–5 star rating from
  the UI but left it in the API and database. It is now gone entirely: dropped
  from every request/response, the list filters (`min_rating`), the importers,
  the Markdown bindings, and the Stats page. Migration 0018 **drops the `rating`
  column** from `annotations` and `dialogues` (a table rebuild that preserves
  tags, the spaced-repetition schedule, and full-text search); the `rating`
  columns on `books`/`movies` are left as inert dead columns (those tables are
  FK parents, so rebuilding them to drop a hidden column would risk the library).
  **Favourites (the ♥ flag) are unchanged** — the one keep/love signal.

### Fixed
- **Stats nav icon is vertically centred.** The bar-chart glyph sat low because
  its baseline was at the bottom of the icon box; its mass is now centred.
- **Restore file-picker is a real button** (also shipped mid-0.8.4): the plain
  browser file input in the restore flow is a proper "Choose backup file…"
  button that shows the chosen filename, in Settings and the onboarding card.

## [0.8.4] - 2026-07-19

### Added
- **A dedicated Stats page.** Library statistics move out of the Settings card
  onto their own screen — a new utility tab (Tags · Metadata · **Stats** ·
  Settings), a `/stats` route, and a drawer entry — with a good deal more to
  see. `GET /stats` now also reports distinct **authors** and **genres in use**,
  a **highlight-colour breakdown**, **top authors** and **top tags**
  leaderboards, a **"collecting since"** date, and a **12-month** activity
  window (was 6). Everything stays in the app's visual system: hero stat tiles,
  single-hue accent bars for the activity and leaderboards, and the four real
  highlight colours for the
  colour breakdown (each labelled + counted, so identity never rides on colour
  alone). This is the groundwork for the upcoming achievements feature.

### Changed
- **Restore file-picker is a real button.** The plain browser file input in the
  restore flow (0.8.3) is replaced with a proper "Choose backup file…" button
  that shows the chosen filename — the same control the avatar upload uses — in
  both the Settings restore block and the first-run onboarding card.

## [0.8.3] - 2026-07-19

### Added
- **Restore from an uploaded backup file — including one from another server.**
  Restore previously only re-applied the single archive this server kept in
  `<data>/backups`, so a backup downloaded from a _different_ Tippani box could
  not be restored — not what "restore" should mean. You can now **upload a backup
  file** and restore it, through the same hardened pipeline the kept-archive
  restore uses (staged extract with path-traversal + decompression-bomb guards,
  SQLite `quick_check`, atomic in-process data-dir swap with one `.pre-restore`
  safety generation, migrate + FTS-heal on reopen). A backup from another server
  is accepted as long as its schema is not newer than this build's; older schemas
  migrate forward automatically. `POST /admin/restore/upload` (admin, Settings →
  Backup & restore; `multipart/form-data`, a `confirm=RESTORE` field plus the
  `file`, capped at 2 GiB with a progress bar) and `POST /auth/restore/upload` (the first-run
  onboarding screen, so moving to a new box needs no SSH — spin up a fresh
  instance and upload your archive). The admin upload takes a `confirm=RESTORE`
  field alongside the file. New error code `TIP-BACKUP-007`.

## [0.8.2] - 2026-07-19

### Fixed
- **Lookup 502s are no longer invisible.** When an on-demand lookup failed at the
  provider — `POST /people/lookup`, `/people/portrait`, `/books/lookup`,
  `/movies/lookup`, and the movie edit "look up" re-sync — the handler returned a
  generic 502 ("lookup failed — try again in a moment") and **logged nothing**, so
  the real cause (a rejected key, a quota, a bad HTTP status) never reached
  `docker logs`. Every such path now logs the underlying provider error with a
  lookup code (`TIP-META-014`, `TIP-PEOPLE-003`) before responding — errors are
  emitted at all log levels, not just debug. A TMDB-rejected-key (401) on a person
  lookup now says so ("re-check it in Settings → Metadata sources") instead of the
  misleading "try again in a moment", matching how the movie lookup already
  behaves — a bad key never fixes itself on retry.

### Changed
- **Extensive outbound tracing at `TIPPANI_LOG_LEVEL=debug`.** Every outbound
  metadata call now emits a `[trace]` line with its URL and result status — Google
  Books, Open Library, Wikidata/Wikipedia, TMDB, TheTVDB (login + search/details),
  the cover/poster/portrait image fetcher, and Amazon (whose errors were otherwise
  swallowed). Provider secrets (`api_key`/`key` query params) are redacted; bearer
  tokens never appear (they travel in the `Authorization` header). This makes
  "which provider, what status" visible while diagnosing a failing lookup. A no-op
  at normal log levels.

## [0.7.0] - 2026-07-18

### Added
- **Directors & creators in People.** The People console (Metadata tab) gains a
  third kind beside Authors and Actors — **Directors** — sourced from each film's
  director (a show's creator). A film's director name is now a link on the detail
  page, and in Search the "by director" group headings are too; both open the
  same metadata panel (bio · photo · reference pages) as authors and actors, with
  rename-across-the-library and duplicate-merge included. Photos and the TMDB
  identity resolve from the crew already cached in the film's stored TMDB payload,
  so films already in the library need no re-sync and cost no extra API call (a
  by-name TMDB search is the fallback); like actors, director photos and links
  need a TMDB key. The `/people` endpoints (`names`, `lookup`, `portrait`,
  `rename`, re-verify) now accept `kind=director`. See `docs/PLAN.md` §7.

## [0.6.9] - 2026-07-18

### Added
- **Typo-tolerant search.** When a search finds nothing, Tippani now retries with
  the query's words corrected to the nearest ones it has actually indexed —
  "shawshenk" finds *The Shawshank Redemption*, "casblanca" finds *Casablanca* —
  and shows an "no exact matches — showing results for …" note above the results.
  Correction is bounded edit-distance in Go over zero-storage `fts5vocab` views
  (migration `0016`); it runs only on a zero-hit query, keeps whole words that
  are already valid prefixes untouched (so typeahead is unchanged), stays scoped
  to your own library, and degrades silently to the plain empty result if the
  vocabulary can't be read (`TIP-SRCH-004`). No new dependencies, no new index
  data. See `docs/PLAN.md` §4.
- **Restore during first-run onboarding.** Moving to a new box no longer needs a
  throwaway admin account: drop the backup archive into `<data>/backups` and the
  onboarding screen shows an "or restore a backup" card (with the backup's date)
  beside "create admin". `GET /auth/status` surfaces the kept archive **only**
  while onboarding is open (never after a user exists), and the new public
  `POST /auth/restore` self-guards on the users table being empty — no session,
  no typed confirmation (nothing to lose yet), rate-limited. The users-empty
  invariant is enforced atomically at the swap: the restore re-checks it under
  `backupMu` just before the point of no return, and signup takes the same lock
  around its insert, so a signup can never land mid-restore and be overwritten.
- **Authors & actors have faces, bios, and birth years.** Clicking any author or
  actor name opens a panel that auto-fetches a portrait (authors via Open
  Library / Wikipedia; actors from the film's stored cast), a short bio, and the
  birth year, with reference links out to IMDb / TMDB / TheTVDB / Wikipedia /
  Open Library. The portrait is a passport-ratio photo the bio wraps around, and
  a click opens it full screen. Small face icons sit beside author names on the
  library grid and book detail, and on dialogue quote blocks.
- **Film-negative views for a film/show's dialogues.** List view is a film strip
  — sprocket rows, a "TIPPANI · SAFETY FILM" edge, and frame-code dividers —
  while tiles view is a book-style collage of film-frame cards.
- **One catalogue console for books, films, and shows.** The Metadata screen
  merges the three media into a single console.

### Changed
- **Settings help moved into info-dots.** The Metadata "Save keys" and the
  Backup & restore cards drop their standing help paragraphs for the same
  hover/focus info-dot used elsewhere, tightening both cards (removes the empty
  gap under "Save keys"). The last-backup line and the restore warning stay.
- **Quotes expand on click — the "show more / show less" buttons are gone.**
  Tiled quote boards (books, Home favourites, sticker quotes) and long
  descriptions/bios clamp to a seeded 3–5 lines with a small chevron; clicking
  the text expands it in place, one at a time. Book tiles lay out in source order
  (newest on top, freshly-added quotes pinned until the next refresh), so the
  clamp sizes vary the board without banding by height; Home favourites reshuffle
  on every page load.
- **Quote & dialogue edits open in a pop-up.** Editing opens a modal form (the
  house `FormModal`) instead of expanding the card in place.

### Fixed
- **Tiled quote boards no longer reshuffle.** The height-packed masonry measures
  real card heights and freezes its column layout the first time a quote is
  expanded, so expanding, collapsing, switching quotes, filtering, or crossing a
  responsive breakpoint never reshuffles the board under the reader.
- **Navbar labels no longer clip when the window narrows.** The desktop tab
  strip held its `.topbar-nav-group` at natural width (`flex: none`) so a tight
  window overflows the nav — which the icon-only collapse actually measures —
  instead of squeezing the toggles and shearing labels mid-glyph without ever
  tripping the collapse.
- **A long restore no longer strands the UI.** `restoreFromNewest` clears the
  60s write deadline (a large-library extract+swap+reopen could outlive it and
  drop the connection), and both restore buttons fall back to a reload if the
  connection drops, rather than freezing on "Restoring…".

## [0.6.8] - 2026-07-17

### Added
- **Backup & restore (Settings, admin).** `POST /admin/backup` builds a dated
  `tippani-backup-<ts>.tar.gz` of the whole data directory — a `VACUUM INTO`
  snapshot of the live database (consistent while people keep writing, no WAL
  sidecars) plus MediaCover and everything else — into `<data>/backups`, keeps
  exactly the newest archive server-side and starts the download. The restore
  block shows that backup's date and, on a typed `RESTORE`, replaces the whole
  data directory from it **in-process** — staged extraction with
  path-traversal/entry-type/decompression-bomb guards, database validation
  (header, `quick_check`, schema not newer than the binary), atomic rename
  swap, then the normal boot sequence (migrate → integrity → FTS self-heal).
  No Docker socket needed; the previous data dir survives as one
  `.pre-restore-<ts>` safety generation, a failed swap rolls back intact, and
  new `TIP-BACKUP-001..006` codes land in `docs/troubleshoot.md`.
- **Per-person work counts in the People console.** `GET /people/names` rows
  now carry `count` — books for authors, distinct titles for actors, tallied
  on the *split* credit components so a co-authored book counts once per
  author. The console shows it as a Books/Titles column; tapping the count
  jumps to Search seeded with that person's name.
- **Searchable import picker on phones.** The Import tab's six-card wall
  becomes a searchable format dropdown (Markdown preselected), the picked
  format's detail card with its how-to steps inline — the hover info-dot never
  worked on touch — and a single Import button into the same per-file batch
  pipeline. The desktop card wall is unchanged.
- **Scroll memory for the last two list pages.** Opening a detail (or hopping
  tabs) and coming back restores the list's scroll position; the memory holds
  the last TWO list pages (LRU) and everything else starts fresh at the top.

### Changed
- **The mobile top-bar ＋ now opens the Add surface** (book · film · import
  toggle) like the desktop pill, instead of quote capture — the Import toggle
  was otherwise unreachable outside the drawer. Quote capture lives on the
  Home capture tile.
- **Credit-separator chips show bare symbols** (`,` `;` `&` “and”) instead of
  spelling each symbol out next to itself.

### Fixed
- **Mobile image share inside WebView wrappers (random names, corrupt bytes).**
  Android WebView (Native Alpha and other PWA wrappers) never implements the
  Web Share API, so the 0.6.7 share-sheet fix silently fell back to the
  `blob:` anchor whose download bridge produces UUID filenames and mangled
  bytes. Phones without a usable share sheet now stage the rendered PNG via
  `POST /share/image` and download the returned **one-shot URL** — a real
  request the wrapper's DownloadManager handles, filename carried by
  `Content-Disposition`, single-use 128-bit token standing in for the cookie
  jar the wrapper doesn't forward.
- **Import-card and tooltip text rendered soft.** Whole import cards were
  tilted (±0.7°), rasterizing every glyph on a rotated layer, and the tooltip
  bubble was centered with `translateX(-50%)` onto half-pixels. The paste-on
  wobble now lives on a chrome-only underlay with the text stack unrotated,
  and tooltips center by flex layout so their glyphs stay pixel-snapped.
- **User chip mis-sized in the top bars.** The inline-flex chip sat on the
  text baseline of its block wrapper, adding ~6px of phantom descender space —
  it rode high next to the Add pill on desktop and spilled out of the 52px
  mobile bar. The wrapper now centers via flex and the desktop chip matches
  the Add pill's 38px exactly.
- **`npm run dev` API proxy.** The Vite dev proxy still listed the pre-`/api`
  route prefixes, so every API call from the dev server fell through to the
  SPA fallback.

## [0.6.7] - 2026-07-17

### Added
- **Force-fetch & re-verify metadata, review before apply (ROADMAP §2).** A
  deliberate "re-check everything" pass over a selection of books, films/shows
  and saved people: each item's lookup re-runs against the live sources —
  targeting its **pinned identity** (ISBN/ASIN/Google id, TMDB/TheTVDB id, the
  stored cast / Open Library key) so it re-checks the same entity instead of
  re-guessing by name — and every changed field (title, author/director,
  description, year, genres, series, cast, cover/poster/portrait, identity ids)
  is presented stored-vs-fresh for **field-by-field approval**. Nothing is
  written until confirmed; pure fills come pre-ticked, overwrites don't.
  Desktop: a *Re-verify…* action on the Books/Films selections and a *Re-verify
  saved* on the People console. Phones: one *Re-verify metadata* action over
  every pinned item, with the same review sheet. New
  `POST /metadata/reverify` (preview, writes nothing) and
  `POST /metadata/reverify/apply` (approved fields only, per-item isolation; a
  failed image download degrades to a note instead of blocking text fields).
- **Multi-author separation (ROADMAP §11).** A joined credit like
  "Gaiman & Pratchett" or "Smith, Jones, and Lee" now lists as **distinct
  people** — in Library/Search author group-bys, the book detail's author line
  (one clickable name each) and the People console — each resolving and
  pinning their own portrait and reference links. The stored credit string on
  the book itself stays verbatim. Guards: a single name containing "and"
  ("Daniels and Sons") never splits, suffixes ("King, Jr.") stay attached, and
  the Oxford comma is understood. **Settings → Multi-author credits** picks
  which separators apply (comma · semicolon · & · "and") — turn comma off if
  your library stores authors as "Last, First" — or turns splitting off
  entirely. *Rename everywhere* is now component-aware: renaming one author
  inside a joined credit splices just that name, byte-for-byte preserving
  co-authors, separators and "et al." markers.
- **Quick capture now captures dialogues too.** The ＋ capture sheet's book
  dropdown is replaced by a **search picker** across every book, film and show
  (type to filter, kind-tagged rows, keyboard navigation), with an inline
  **"add as a new book"** quick-create when the title isn't in the library
  yet. Capturing against a film/show saves a dialogue (character + timestamp
  fields; the actor auto-fills from the cast).
- **Home favourites carry the full quote toolkit.** An expanded favourite tile
  now has the same ♥ · share · edit · delete cluster as the detail-screen
  cards (hover-revealed on desktop, a ⋯ menu on phones), with the share sheet
  and the real inline edit form — plus the existing *Open book/film/show*.
- **"Where you stand" updates live.** Every Daily Quiz *and* Practice answer
  refreshes the remembered/forgetting/probably-forgotten/unseen counts
  immediately (`POST /review/answer` now returns the fresh counts).
- **Icon-only top nav at intermediate widths.** When a smaller desktop window
  would clip the labelled tabs behind the ＋ Add button, the nav collapses to
  icons (and expands back once there's room) — measured off the actual
  overflow, not a fixed breakpoint.

### Changed
- **Navbar simplification.** Tags and Metadata now always sit in the top bar's
  utility group — the Settings "Interface" toggle (and its `navUtilities`
  preference) is retired, and the mobile drawer moves Tags into the bottom
  utility group to match. The Settings "Metadata sources" card also drops its
  redundant single-shot *Re-fetch missing* button (the Metadata tab's chunked,
  progress-bar version is the real tool).
- **Settings layout.** Accent and the two cover-size sliders share one row on
  desktop.
- **Person popup.** The obsolete links-only "back to links" view is gone — the
  details view already carries the clickable reference chips — and *refetch
  links* moved into it. Long bios clamp to three lines with a *show more*.
- **People console names are clickable**, opening the same person popup used
  everywhere else; the mobile Metadata header gains an info-dot noting the
  full console lives in the desktop view.

### Fixed
- **Mobile PNG share produced a corrupt file with a hash filename.** The
  quote-card image now goes through the native share sheet on phones (a named
  `tippani-quote.png`, save to Photos or share onward); the desktop download
  is unchanged. Root causes fixed everywhere blobs are saved: the blob URL was
  revoked before the (asynchronous) mobile save finished — truncating the file
  — and iOS/PWA saves ignore the download filename on blob URLs.
- **Daily Quiz / Practice session tallies never incremented** during a session
  (the "N recalled · M to resurface" line and the practice round score were
  stuck at their opening values).
- **Mobile drawer:** the page behind it no longer scrolls while it's open, and
  a left swipe closes it (no swipe-to-open — the screen edge stays the
  system's back gesture).

### Security
- No new exposure: both re-verify endpoints are session-scoped to the caller's
  own rows with whitelisted, validated fields; provider calls remain on-demand
  only. CSP `img-src` additionally allows Wikimedia hosts so a fresh author
  portrait can be previewed before it's approved.

## [0.6.6] - 2026-07-16

### Fixed
- **Silent cover/poster/image fetch failures on edit.** Updating a book's cover,
  a movie's poster, or a person's image now logs the real cause
  (`TIP-BOOK-003`, `TIP-MOVIE-003`, `TIP-PEOPLE-002`) when the fetch is
  rejected, instead of only returning the generic "couldn't fetch that image"
  502 with nothing in the logs to diagnose it by.

## [0.6.5] - 2026-07-14

### Added
- **Structured, code-tagged error logging (ROADMAP §12).** Every handled failure
  now logs a stable code of the form `TIP-<SUBSYS>-NNN` (for example
  `TIP-SRCH-002`) to both stdout and stderr. Look any code up in the new
  [`docs/troubleshoot.md`](docs/troubleshoot.md) for its cause and fix. Each
  request also carries a short correlation id so all of its log lines line up.
- **`TIPPANI_LOG_LEVEL=debug`** turns on verbose `[trace]` per-operation logging
  for diagnosing an issue; it is off (quiet) by default, so normal deployments are
  unaffected.

### Fixed
- **A whole class of silent failures.** List endpoints that dropped a row on a
  scan error while still returning `200` — the same failure mode behind the
  disappearing homepage favourites — now log it with a code instead of quietly
  shortening the list. Also surfaced: genres that could silently fail to persist
  (a dropped transaction error), orphaned-people cleanup failures, and swallowed
  cover/poster fetch errors.

## [0.6.4] - 2026-07-14

### Fixed
- **Search no longer stays broken after a corrupt index — it self-heals on the
  spot.** When a live search hit a corrupt full-text index (`database disk image
  is malformed`), the old runtime recovery only ran a bare `rebuild`, which has to
  re-read the same damaged pages and so failed again — every search 500'd until the
  server was restarted. The search path now reconstructs the index the same way
  startup does (drop + recreate + rebuild, discarding the corrupt pages) and
  retries, so search recovers within the same request. No library data is affected
  (the search indexes are derived from your books, quotes, films and dialogues).
- **Homepage favourites could silently disappear entirely.** If any of the three
  requests behind the Favourites grid returned an unexpected non-JSON response
  (e.g. an HTML page from a reverse proxy, or an expired session), the whole
  section vanished instead of degrading gracefully. It's now guarded.

### Changed
- **Hardened the database against the corruption recurring.** The server now shuts
  down gracefully on `SIGTERM`/`docker stop` (and during a self-update): it drains
  in-flight requests, then folds the write-ahead log back into the main database
  file before exiting, so an unclean kill can't leave a torn WAL to corrupt the
  search index on the next boot. Writes also now use `synchronous=FULL` in WAL mode
  to close the torn-write window on volumes that don't guarantee fsync ordering.
- **List endpoints no longer silently drop rows.** A row that fails to scan (a sign
  of schema/query drift) is now logged loudly instead of being quietly skipped with
  a `200`, so "mysteriously empty list" bugs surface immediately.

## [0.6.3] - 2026-07-14

### Added
- **Version → changelog link + update badge (AudioBookshelf-style).** The running
  version is now a link to the GitHub releases/changelog — in **Settings → Updates**
  and at the bottom of the **mobile drawer** (shown to every user). When an admin has
  run *Check for updates* and a newer release exists, an **↑ update to vX** link to
  that release's notes appears in both places (cached for the session). The check
  stays strictly **on demand** — Tippani still never contacts GitHub on its own.
  `GET /auth/me` now returns `releases_url` for this link.

## [0.6.2] - 2026-07-14

### Added
- **Home favourites now cover films & shows too, as a tile grid.** The Favourites
  section merged only book highlights before; it now shows favourited **book quotes
  and film/show dialogues together**, newest first, as two-up tiles (about four,
  with the rest behind **View more**). Each tile is tagged BOOK / FILM / SHOW and
  opens its source. *(This also fixes favourites reading as empty when you'd only
  favourited dialogues, never a book quote.)*
- **"Seeing" reinforcement (opt-in).** A new **srSeen** knob (Settings → Daily quiz
  & practice) lets *seeing* a quote — practising it (not skipping), sharing it, or
  favouriting it — lengthen its memory half-life marginally, separate from Daily
  Quiz recall. Off by default (1.0×), and merely appearing in the Daily Quiz is not
  "seeing". New `POST /review/seen`.
- **Share-image theme picker.** The *Image* share format gains a four-way theme
  dropdown (Paper / Film × Light / Dark) that restyles only the exported image, not
  the app; the choice is remembered per device.

### Changed
- **The manual-update command** shown in Settings → Updates is now
  `docker compose up -d --pull always --force-recreate` — one step that always
  re-pulls the tag and recreates the container.

### Fixed
- **A wrong Daily Quiz answer no longer inflates "remembered".** Statuses read the
  recall probability `2^(-elapsed/half-life)`, but a just-answered card has ~0 days
  elapsed, so *any* fresh answer (right or wrong) read as fully remembered. A lapse
  now correctly reads as **probably forgotten** — on the "where you stand" tally and
  on every quote's status dot — until the next successful recall.
- **Copy buttons work on plain-HTTP self-hosted instances.** The share sheet's
  **Copy** and the update-command copy used the async Clipboard API, which is
  undefined outside a secure context (HTTPS/localhost), so on a LAN-IP HTTP instance
  they silently did nothing. They now fall back to a legacy copy that works over HTTP.

## [0.6.1] - 2026-07-14

### Changed
- **Daily Quiz & Practice are now multiple-choice**, replacing the self-graded
  "show answer" reveal from 0.5.0 (which was awkward, especially for the "which
  quote is from this work?" direction). Both directions are now real MCQs: *which
  work is this quote from?* (pick the title) and *which quote is from this work?*
  (pick the quote). A correct pick counts as **Got it**, a wrong one as **Forgot**;
  Practice still allows **Skip**. The schedule, scores and status dots are
  unchanged — only the interaction.
- **Distractors are chosen to be plausible, not random.** For books, wrong options
  are drawn from other works by the **same author** first, then those sharing the
  **most genres**; for films/shows, by **shared genre** first, then a **shared
  actor** (never the director). Same medium is always preferred over cross-medium.

### Fixed
- **Status dots now show on every quote.** The "not yet reviewed" dot used a border
  colour (`--line`) that was invisible against the card; unseen quotes now show a
  visible hollow grey dot, and reviewed ones their remembered/forgetting/probably-
  forgotten colour.
- **Flaky timezone test.** `TestDailyQuizTimezone` asserted a cross-midnight case
  off the wall clock and could fail depending on the hour CI ran (it broke 0.6.0's
  CI at 03:45 UTC though the code was fine); it now asserts the local-day shift
  deterministically.

### Settings
- The two long descriptor paragraphs in *Daily quiz & practice* collapse into the
  standard info-dot tooltips (the panel's controls already govern both modes: daily
  deck size, review scope, "Practice moves the schedule", and the half-life factors).

## [0.6.0] - 2026-07-14

### Added
- **In-app updates (Settings → Updates, admin).** The build version is now stamped
  into the binary (`buildinfo.Version`, via `-ldflags -X`; logged at startup and
  printed by `tippani version`) and surfaced in Settings. **Check for updates**
  queries the latest GitHub release **on demand** — Tippani never contacts GitHub on
  its own — and reports whether you're up to date.
- **One-click update via the Docker socket (opt-in).** When the Docker socket is
  mounted (a documented, deliberate security trade-off in `docker-compose.yml`), the
  card offers **Update & restart now** (admin, typed `UPDATE` confirm): it pulls the
  new image and recreates the container with a one-shot Watchtower — which copies the
  existing config so the data volume, ports and env survive — then the page waits for
  the app to come back and reloads. Works when you track a moving tag (`:latest`).
  Without the socket it shows the exact `docker compose pull && docker compose up -d`
  to run by hand. New `GET /admin/update/check`, `POST /admin/update/apply`.

## [0.5.0] - 2026-07-13

Spaced-repetition rework: two clear modes, films & shows as first-class review
material, and a status dot on every quote.

### Added
- **Daily Quiz & Practice.** The learning surface is now two modes sharing one
  retrieval flow — *present → attempt recall → reveal → grade*:
  - **Daily Quiz** — the scheduled session: every card due that day, **no skipping**,
    each grade folded into the schedule, with a **permanent daily score and streak**.
  - **Practice** — **unlimited, skippable** study across your whole library that by
    default **does not touch the schedule** (a Settings toggle, *Practice moves the
    schedule*, opts in), with a **separate, resettable score**.
- **Two question directions**, in both modes and over books **and** films/shows: *which
  work is this quote from?* and *recall a quote from this work*.
- **Status dots on every quote** in the Library and the Catalogue — 🟢 **remembered**,
  🟡 **forgetting**, 🔴 **probably forgotten** (a hollow dot until first reviewed) —
  derived live from recall probability $p = 2^{-t/h}$. Hovering a dot shows the card's
  memory half-life and when it next comes due, like the Settings info dots.
- **Films & shows are now first-class review items.** Dialogue lines enter the deck,
  grade, and carry a status dot exactly like book quotes; the review **scope**
  (books / films & shows / both) governs both modes.

### Changed
- **Repetition statuses renamed** from soon / later / someday to **remembered /
  forgetting / probably forgotten** — describing whether you can recall a quote *now*
  rather than the raw half-life bucket.
- **Review API** consolidated to `GET /review/daily`, `GET /review/practice`,
  `POST /review/answer` (mode-aware), `GET /review/scores`, and
  `DELETE /review/practice`, replacing the old `/annotations/daily-review`,
  `/annotations/{id}/review` and `/annotations/quiz*` routes.
- **Settings** now reads *Daily quiz cards / day*, *Review covers* (books / films &
  shows / both), *Practice moves the schedule*, and the half-life growth/lapse factors;
  the annotation & dialogue list responses gained `reviewed` / `stability` /
  `last_reviewed_at` for the status dots.

### Removed
- **The multiple-choice recall quiz.** Retrieval is now self-graded in both modes
  (honest recall is the point of spaced repetition), so the MCQ round, its distractor
  machinery and the `srQuizLen` / `srQuizScope` preferences are gone.

### Migration
- `0015_review_rework` replaces `annotation_reviews` with a polymorphic `item_reviews`
  (books + films/shows), **carrying every existing book half-life forward** — no
  schedule is lost. Parent-delete cleanup moves from `ON DELETE CASCADE` to triggers.
  The old `quiz_results` table is replaced by `quiz_sessions` (per-day, per-mode); the
  previous multiple-choice score history does not map onto the new model and is not
  carried over. The schedule itself is fully preserved.

## [0.4.7] - 2026-07-13

### Fixed
- **Search corruption now recovers even when `DROP TABLE` fails — with no data loss.**
  0.4.6's startup repair rebuilt a corrupt index by dropping and recreating it, but a
  badly-corrupt index makes even `DROP TABLE` raise `database disk image is malformed`
  (the repair logged "reconstruction FAILED" and gave up). The repair now escalates to
  a **data-preserving whole-database rebuild**: it copies every intact base table into
  a fresh database file and lets the sync triggers repopulate the search indexes,
  **never reading the corrupt pages**. It runs automatically at startup and on demand
  via Profile → *Rebuild search index* (which now falls back to this recovery too).
  The search indexes are derived data, so every book, quote, film, dialogue, tag,
  person, setting and preference is preserved. Verified against a reproduction of the
  exact failure — structural page corruption of the `annotations_fts` b-tree where both
  MATCH and DROP raise SQLITE_CORRUPT.

## [0.4.6] - 2026-07-13

### Added
- **Startup database health checks.** On boot Tippani now runs `PRAGMA quick_check`
  over the whole database and an FTS `integrity-check` on each search index, logging
  the outcome to **both stdout and stderr**. Real corruption is alerted loudly so it
  can't be missed in the container logs.
- **Self-healing search indexes.** A corrupt full-text index (SQLite
  `database disk image is malformed`) is rebuilt automatically at startup from the
  intact base tables — the search data is *derived*, so nothing is lost. An in-place
  `rebuild` can't fix page-level corruption (it re-reads the same bad pages), so the
  repair drops and recreates the index (schema-driven, DDL read from the live schema).
- **Profile → Maintenance (admin).** *Rebuild search index* runs that same
  non-destructive repair on demand (fixes "search failed / internal error" without a
  restart or any data loss). *Reset all data* is a guarded factory reset — it deletes
  the database **file** (row/table deletes are blocked by a corrupt index) and
  re-initialises an empty schema, returning the app to first-run admin-account
  creation. New endpoints `POST /admin/search/reindex` and `POST /admin/reset`
  (the reset requires `{"confirm":"RESET"}`).

### Fixed
- **Search "internal error" from a corrupt index** now recovers instead of 500ing
  indefinitely: the index self-heals on the next boot, or immediately via Profile →
  *Rebuild search index*. Settings (metadata keys) and preferences live in tables, so
  a full reset clears them too — the Reset warning says so.

## [0.4.5] - 2026-07-13

### Fixed
- **Bundled fonts no longer blocked by the CSP.** Vite inlines small `@fontsource`
  subset files (< 4 KB) as `data:` URIs, which the `default-src 'self'` policy
  rejected — so those glyphs silently fell back to a system face (and the browser
  console filled with CSP errors). The Content-Security-Policy now allows
  `font-src 'self' data:` (data: fonts are inert, same rationale as the existing
  `data:` image allowance). This also unblocks the fonts the quote-card image
  renderer relies on.

## [0.4.4] - 2026-07-13

### Changed
- **One look-up card for books, films and shows.** The Add surface is now two tabs
  — *Look up / add* and *Import files*. *Look up / add* is a single card with a
  **Book · Film · Show** toggle, one search box and an optional year, replacing the
  separate book / film sections that each carried their own look-up ↔ manual switch.
  Manual entry is no longer a sibling mode: a **"Can't find it? Add manually"** link
  opens a hand-entry popup for the chosen kind.
- **Import instructions are now tooltips.** Each import source card's step-by-step
  "how to save the page" instructions moved into the standard info-dot tooltip (the
  same one used across Settings), so the cards read at a glance; the one-line
  description stays visible.
- **Stripped-down mobile Metadata screen.** On phones the Metadata tab is now a
  maintenance screen — *fetch covers & metadata* (fill-empty only, never replacing
  stored art), *scan for duplicates*, *speaker remap*, and *people fetch-missing*
  (no browsable list) — with the coverage tiles collapsed into plain text lines. The
  at-scale filterable console stays desktop-only.

### Added
- **`missing_only` on cover refetch.** `POST /covers/refetch` accepts `missing_only`
  to fill empty covers/posters and details without upgrading stored low-res art — the
  "no replacement" mode the mobile Metadata screen's one-tap fetch uses.

### Fixed
- **Search no longer fails on a drifted FTS index.** A search that hit a runtime
  SQLite error — an external-content FTS5 index out of sync with its content table —
  returned a bare `search failed` 500 with nothing logged. The handler now logs the
  real cause and self-heals: it rebuilds the affected index once and retries, so
  search recovers on the first query after a deploy instead of staying broken.
- **The ⋯ More menu (Tags · Metadata) is no longer hidden.** On desktop the overflow
  menu rendered inside the horizontally-scrolling top-bar nav, whose overflow clipped
  the dropdown so it appeared behind the page. It now portals to `<body>` and
  positions against its button, so it always sits above the content.
- **The Add surface's import cards no longer overflow.** Embedded in the narrow Add
  modal, the four-column import wall crammed the cards and overflowed their buttons;
  the embedded grid is capped at two columns while the standalone page keeps its wide
  four-up layout.

## [0.4.3] - 2026-07-13

### Added
- **One "＋ Add".** A single Add surface — book · film · import in one modal —
  replaces the standalone Import tab. The top-bar **＋ Add** button, the drawer's
  lead row, and the Library/Catalogue "Add" buttons all open the same surface, so
  there's one obvious way to add anything (an old `/import` link opens it on
  the Import section).
- **Quote-card images.** The share sheet gains an **Image** format beside the text
  ones: a highlight rendered to a shareable PNG in your current paper/film skin,
  generated entirely in the browser (no server, no external calls), with the same
  field-picking as the text formats — download it or copy it to the clipboard.
- **Profile & account management behind the avatar chip.** The chip menu is now
  **Profile · User management · Log out** — a centred pop-up on desktop, a full
  page on phones. *Profile* edits your photo, **display name** (`PUT /auth/me`,
  new) and password in one place; *User management* (admin) adds/removes users and
  **grants/revokes admin** (`PATCH /admin/users/{id}`, new) — handing over the
  primary admin is grant-another-then-revoke-your-own, with the last admin
  protected. Avatar upload + password + user management move out of Settings.
- **Configurable spaced repetition** (Settings › *Daily review & quiz*): per-user
  review cards/day (2–10), quiz length (2–10), quiz scope (books/films/both), and
  the half-life growth (1.5–4×) and lapse-keep (0.1–0.6×) factors. `/auth/me/preferences`
  is now a partial merge, so each setting saves without disturbing the others.
- **Configurable desktop nav** (Settings › *Interface*): Tags + Metadata as navbar
  tabs or folded into a ⋯ More menu; the account chip stays separate.
- **Automated GitHub Releases** — `release.yml` cuts a Release from the matching
  CHANGELOG section on every `v*` tag (the docker workflow already publishes the
  image); runnable by hand to backfill.

### Changed
- **Progressive disclosure on quote cards.** A card shows only its favourite ♥ at
  rest; on desktop, hovering reveals *share · edit · delete* inline, and on a phone
  they fold behind a single ⋯ overflow — so a masonry of cards sheds its standing
  button rows (delete keeps its confirm).
- **Compact edit forms (books & films).** Cover controls collapse to icon buttons
  with tooltips (upload · fetch metadata · paste URL · search covers · remove), and
  **"Fetch metadata" now opens the edition/version picker** to choose the right
  match instead of silently applying a guess — folding in the old "Browse other
  matches" button.
- **Favourite-only.** The 1–5 star rating is gone from the UI everywhere — cards,
  detail headers, filters, sort, tables and the share sheet; the favourite ♥ is the
  single quick signal. Stored ratings stay in the DB but hidden (no destructive
  migration).
- Cover/image upload cap raised **5 MB → 10 MB** so hi-res covers upload.

### Fixed
- **Quiz answer colours** — a correct answer shows a distinct green (`--ok`), no
  longer the terracotta accent that read the same as the red for a wrong pick.
- **Metadata progress bars** — the covers/metadata refetch bar now paints even for
  a single-chunk run (an indeterminate mode); the People-console bar reads on the
  film-dark backdrop instead of looking like a floating line.
- **Book-save failures are logged** (method · path · cause) instead of being
  swallowed behind a bare "internal error".

## [0.4.2] - 2026-07-12

### Added
- **Merge duplicate authors / actors.** The Metadata → People console flags near-identical names —
  typos and transliterations like *Fyodor Dostoevsky* vs *Fyodor Dostoyevsky* — as **Possible
  duplicate** cards; choose the spelling to keep and one click rewrites the others across every book /
  film and folds their saved metadata in. The author/actor edit card gains a **"Rename everywhere"**
  action for the same, one person at a time. New `POST /people/rename`.

### Changed
- **Orphaned author/actor metadata is now swept automatically.** Opening the People console clears
  saved rows whose name no longer appears on any book or dialogue (they previously lingered until the
  next book edit triggered the sweep) — still no background job; it runs on load.

## [0.4.1] - 2026-07-12

### Changed
- **Only a correct quiz answer counts as a revision.** A wrong guess is now a no-op — it no longer
  shrinks (or otherwise moves) the spaced-repetition schedule. The daily review's *Got it / Forgot /
  Skip* semantics are unchanged.

### Fixed
- **Portraits resolve the right person everywhere, not only in the modal.** The Metadata → People
  console — both per-row and the "Fetch missing" bulk — now goes through the disambiguating portrait
  path (`/people/portrait`) instead of the old name + work-count lookup, so it no longer grabs the
  wrong same-name person (the more-published "David Reich") and now fetches **photos**, not just links.
  "Fetch missing" also covers people who have links but still no photo.
- **Author photos & links reach Wikidata even when the Open Library record is sparse** (no photo, no
  wikidata link): the author's Wikidata identity is resolved by anchoring on a book they wrote
  (work → author P50), yielding the correct Wikipedia link and a P18 photo where one exists. (Some
  authors — David Reich among them — have no freely-licensed photo anywhere, so the initial is kept;
  the identity and links are now correct regardless.)
- **Higher-resolution book covers.** Cover re-fetch now tries Amazon's keyless full-size cover CDN
  first (via the book's ISBN-10, which is Amazon's image key), upgrading covers that were previously
  only available as Google / Open Library thumbnails.

## [0.4.0] - 2026-07-12

### Added
- **Automatic author & actor portraits, with correct-person disambiguation.** Photos are now fetched
  on demand from the library's own catalogue instead of only pasted by hand: an **actor** from the
  film's stored cast — the supplier's person id + headshot are now captured in the credits call the
  movie fetch already makes, so resolving a portrait costs **no extra API call** — and an **author**
  via Open Library, disambiguated by the books they actually wrote so a same-name namesake is no longer
  fetched (e.g. the wrong "David Reich"), with a Wikidata P18 photo fallback. The resolved identity is
  pinned on the person (`people.source_id`) so it can't re-drift, an author's reference links come from
  that same identity, and the manual Photo URL field still overrides. New `POST /people/portrait`; hosts
  `commons.wikimedia.org` + `upload.wikimedia.org` added to the cover allowlist for P18 images.
- **Book lookup matches on title _and_ author.** `/books/lookup` now takes an optional author and queries
  Google Books (`intitle:… inauthor:…`) and Open Library (`title=&author=`) accordingly, then ranks the
  merged candidates by title+author similarity — so the edition you meant sorts above box-sets, study
  guides and foreign reprints a title-only search surfaced first. Author-scoping falls back to title-only
  if it over-constrains, and cover re-fetch passes the stored author too.
- **Recall quiz** (roadmap №2): a Home quiz card builds mastery-weighted MCQ rounds from your own
  library — match a quote to its book (genre-preferring distractors) or a line to its actor; each
  answer is folded into its review schedule the moment it's given (so an abandoned round still
  credits what you answered), and a running score can be cleared
  (`GET /annotations/quiz`, `POST /annotations/quiz/answer`, `POST /annotations/quiz/submit`,
  `/quiz/stats`, `DELETE /quiz/results`; migration 0014 `quiz_results`)
- **Revision-state readout** on the Daily Review card (unseen / soon / later / someday) with a
  "how these work" explainer linking the forgetting-curve and spaced-repetition research
- **Full-screen cover inspector**: tap a book cover / movie poster on its detail page to view it
  full-screen (× · Escape · backdrop · Android back gesture)
- **Home favourites**: the full favourites list (newest first), 5 shown with "Show more"; a card
  expands in place (note · tags · location) with an "Open book" button
- **Cover search shows resolution**: candidate covers display their pixel size, low-res ones are
  dimmed; Google Books renders larger (`fife=w1280-h1920`) and more options are offered; the
  book/movie look-up matches render as a compact card grid
- Metadata console: a **low-res** cover/poster count + filter; the cover re-fetch now reports
  `skipped` (kept — no higher-res source) so a partial run is explained
- **Home screen** with Daily Review, quick capture, stat tiles and favourites (desktop + mobile),
  now with a Home entry on the desktop navbar; Metadata + Settings moved onto the navbar too
- PWA: web app manifest + icons, `viewport-fit=cover` + safe-area insets, theme-color meta
- Author/actor edit: labelled reference links (Open Library etc.), a "one link per line" tip, a
  photo image-search shortcut, and a details-first view when a name is clicked
- **Spaced repetition — daily review** (roadmap №2): a Daily Review card on the new Home screen
  resurfaces your own highlights on a forgetting-curve schedule — per-annotation memory half-life,
  recall probability decaying in SQL at query time (no jobs, no cron), *Got it / Forgot / skip*
  answers, mastery (soon / later / someday), a timezone-aware daily deck capped at 8 cards, and a
  pending-review dot on the logo and drawer. `GET /annotations/daily-review` +
  `POST /annotations/{id}/review`; review state lives in its own table (migration 0013) so edits
  and heart-toggles never disturb the schedule
- **Home screen** — date + greeting, the Daily Review card, a quick-capture tile, book/film stat
  tiles, and the two most recent favourites; it is the landing view (`/`) on desktop and mobile,
  reached any time by tapping the logo
- **Quick capture** — a ＋ in the mobile top bar (and the Home tile everywhere) opens a
  capture sheet: book, quote, note, chapter/location, comma-separated tags, colour
- **PWA install** — web app manifest + generated icons (incl. maskable), `viewport-fit=cover`,
  safe-area insets on the shell bars and full-screen sheets, theme-colour meta
- Toast feedback primitive (ink-on-cream pill); wired on capture, review, and sign-in
- `GET /annotations` rows now carry `book_title` / `book_author` for cross-book lists
- **People link out** — clicking any author/actor name opens a redirect menu of their
  IMDb · TMDB · TheTVDB · Wikipedia · Open Library pages, auto-resolved on first open
  (`POST /people/lookup`, Wikipedia via Wikidata); a **People console** under Metadata
  lists everyone referenced in the library with link status, per-row and bulk fetch
  (`GET /people/names`)
- **Fetch-metadata progress bar** — `POST /covers/refetch` is chunked (cursor/limit →
  next_cursor/done/total/remaining); the Metadata page loops chunks and shows real progress
- Import promoted into the primary nav
- Mobile filter sheets: labeled full-width controls with a shared Reset · count · Done footer;
  Library gained its missing mobile add-book entry
- Tags page: New-tag and New-sticker add-cards lead the page (2 columns on desktop)

### Changed
- **Mobile shell** — primary navigation moved from the bottom tab bar to a hamburger **drawer**
  (nav + counts + account + log out); a slim sticky top bar carries ☰ · logo → Home · ＋ capture ·
  search · avatar, and detail screens swap it for their own back + title bar
- The **start-page setting is retired** (Home is the start page); stored `home` preference keys
  and older clients still sending one are ignored
- **Hi-res covers** — TMDB stored posters use `original` (thumbnails stay w342), Google Books
  covers upgraded via `fife` renders, Amazon size modifier dropped for full-size scans; cover
  fetch cap raised to 5 MB (upload envelope 6 MB)
- Library page header retitled "Books"; brand mark enlarged to match the nav icons
- Add-annotation/dialogue box moved above the list on detail pages
- The read-only demo now ships realistic fixtures (covers, stickers, people links) and honours
  detail-page filters, search scopes, and search group-by — and its daily-review deck is
  playable (session-only)

### Removed
- Bottom navigation bar and the Settings "Start page" toggle (superseded by the drawer + Home)

### Fixed
- **Blank-screen crashes** — an app-wide ErrorBoundary now shows the actual error instead of a
  white screen; fixed a `share.jsx` ES2018 regex lookbehind (older Android WebView / Safari
  couldn't construct it) and missing `coverImgURL` imports in `ui.jsx` and `SearchPage.jsx` that
  blanked book detail / search whenever a cover rendered
- Editing or removing an author/actor cleans up the old name's orphaned people metadata (was
  lingering in the DB and the Metadata console)
- Manual year fields (books, movies, author "born") accept only a 4-digit year
- OpenLibrary covers never stored (their `archive.org` redirect targets were rejected by the
  SSRF allowlist); TheTVDB posters never stored (`artworks.thetvdb.com` missing from the allowlist)
- Mobile annotation cards overflowing the viewport; sticky page bar floating below the top of
  the screen; five nav tabs now fit a 320 px viewport
- Settings → Users showed every user's initial instead of their uploaded profile photo
  (the admin user list never returned `avatar_path`)

## [0.3.1] - 2026-07-07

### Changed
- **Mobile UI overhaul** — comprehensive responsive redesign for PWA-first experience
  - Bottom navigation bar on small screens; tabs repositioned from top
  - Detail sheets for Library & Movies with improved touch interaction
  - Fixed horizontal scroll and viewport-aware column counts across views
  - Share dialog refinements and responsive cover grid defaults
  - User chip menu restored with Settings access and corrected click targets
  - Unified bottom bar styling and fixed mobile nav crashes
  - Overflow menus for detail panes on constrained viewports

### Fixed
- Navigation stability on mobile devices (eliminated crash scenarios)
- Dead click targets in user menu and detail overlays
- Unintended horizontal scrolling and layout overflow issues

## [0.3.0] - 2026-06-20

### Added
- Author & actor metadata — panel UI, group-by portraits, name-keyed store with CRUD
- Search group-by — filter by series, author, decade, or genre
- Quote sharing across 4 formats (Rich Markdown, WhatsApp, plain text, Reddit)
- Library group-by functionality for better organization
- Dithered hand-card gradients to eliminate 8-bit banding
- Readability improvements — bold people, italic works, clearer dates in share

### Changed
- TMDB API key is now UI-managed instead of env-var configured

### Fixed
- Various styling and rendering issues

## [0.2.1] - 2026-03-15

### Added
- Initial public release features
- Multi-user support with per-user isolated libraries
- Book & movie management with full metadata

## [0.2.0] - 2026-03-10

### Added
- Core functionality — books, movies, quotes, and imports

## [0.1.0] - 2026-01-01

### Added
- Project foundation
