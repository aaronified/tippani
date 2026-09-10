// addFields — WHICH BOXES EACH KIND OF THING ASKS FOR, and in what order.
//
// THE OWNER'S DIRECTIVE, and it is the whole reason this file exists: "each
// surface needs to only show their specific fields", then, asked how far that
// goes: "Hard drop anything that is not relevant (writer of a movie, timestamp of
// a book, speaker of a proverb, etc). soft drop (behind a show all fields button)
// all fields which are not frequently used."
//
// So every field on every add form is in one of three states, and the state is a
// fact about the KIND rather than about the screen:
//
//   main — on the first screen, always drawn
//   more — behind "Show all fields", drawn on request
//   (absent) — hard dropped: the field means nothing for this kind and the form
//              does not admit it exists
//
// A PURE TABLE, NOT A COMPONENT, because it is the answer to a question three
// different surfaces ask — the add form, its tests, and (when the edit forms are
// brought in line) those too. A per-kind field list living inside a render
// function is a list that can only be checked by rendering it, and the repo's own
// rule is that a control drawn by one component on two screens has one behaviour
// living in one function both call.
//
// IT IMPORTS NOTHING. Every value here is a machine key; the words are resolved
// where the form draws them, so this module loads in the vitest `pure` project and
// cannot be the far end of an import cycle. Same discipline as text.js.
//
// ── the globals, which are the owner's and are not per-kind decisions ─────────
//
//   "quote, note, tags, and colour always stays up (wherever character is
//    applicable, that stays in main screen as well). no need to ask for these
//    further. these fields will exist for everyone."
//   "sticker goes hidden in 'show all fields' for all instances."
//   "except for quotes, language & translation also stays hidden everywhere" —
//    and then, on language specifically: "it is needed everywhere (it is the thing
//    that ascertains whether a translation will get priority over a quote text or
//    not). it should be everywhere, behind show all."
//
// CHARACTER IS THE ONE THAT NEEDED READING TWICE. The owner wrote "character …
// goes to show all fields" for a book highlight and "wherever character is
// applicable, that stays in main screen" in the same message. Applicable is read
// here as "it is this medium's own locator": a film, show and game line is
// identified by who says it, and a book highlight's character is a novelist's
// speaker — a real field, rarely filled. So character is main on the three screen
// kinds and more on a book.
//
// ── the order ─────────────────────────────────────────────────────────────────
//
// quote first, always: it is the only required field and the design pack's own
// answer to what holds the fold ("the quote box, always"). Then, for a standalone
// quote, the two the owner pinned by name — "for quotes, board will always be just
// below quote and spoken by/written by" — then that kind's own boxes, then the
// three globals that close every form. A form reads top to bottom as: what was
// said, who said it, where it is filed, what it says, where it came from, what you
// thought, how it is tagged and coloured.

// The seven standalone quote kinds are 0053's own list, and the door a reader
// presses IS the value stored in `utterances.kind`. That is a departure from the
// design pack's field-model §1 ("The kind question is gone from the form … the
// board owns the kind") and it is a departure the schema forced: a board's kind is
// `plain` or `proverb` and nothing else — 0037 argues at length against a third,
// because "a speech quote uses the same fields every other quote uses … so a kind
// for it would be a label with no behaviour behind it". With only two board kinds,
// a board cannot answer "is this a letter or an essay" and 0053 gave the quote its
// own column precisely so something could. The prototype was written before that
// column existed.
//
// What survives of §1 is the part that was right: nobody is asked twice. A
// proverb board answers the question by standing in it (see doorForBoard), and the
// chooser asks only when nothing else can.
export const QUOTE_KIND_DOORS = ['speech', 'letter', 'essay', 'poem', 'song', 'proverb', 'other']

// The two quote doors that need a work behind them, named for the table they write
// to rather than for the word on the door — 'annotation' and 'dialogue' are what
// the API calls them, and a door key that matches the endpoint is one fewer
// mapping to keep in step.
export const WORK_QUOTE_DOORS = ['annotation', 'dialogue']

// What can be added that is not a quote. 'board' is here on the owner's ruling
// ("Board only for now. anthology is due for a revamp. we will tackle that
// later") — and it belongs with the works rather than with the quotes because it
// is a container you make before you file into it, not a thing you file.
export const WORK_DOORS = ['book', 'film', 'show', 'game', 'board']

export const ALL_DOORS = [...WORK_DOORS, ...WORK_QUOTE_DOORS, ...QUOTE_KIND_DOORS, 'import']

// FIELDS is the per-door table. `main` and `more` hold field keys in draw order;
// anything absent from both is hard dropped for that door.
//
// A KEY APPEARS IN AT MOST ONE OF THE TWO. The form walks `main`, then `more`
// behind the disclosure, so a key in both would draw twice — and the duplicate
// would be invisible until somebody opened the disclosure on the one kind that
// had it. `everyFieldIsPlacedOnce` in the test file is what holds that.
const SCREEN_SHARED_MORE = ['translation', 'language', 'sticker']

const FIELDS = {
  // ── a book highlight ───────────────────────────────────────────────────────
  //
  // Measured against a real library: the locator is filled on 99% of highlights,
  // the chapter name on 8%, its number on 3%, the character on 1%. So one locator
  // line leads and the rest goes behind the disclosure. The owner's shape for it:
  // "location and chapter no. will share one line" — a number and a page are both
  // short and both answer "where", so they are one row of two boxes.
  //
  // The whole of `main` is six rows, which for THIS door meets the owner's stated
  // target: "there is not that much, and if we redesign right, all can be fitted in
  // one screen without scroll on phone." It is met on four of the eleven doors and
  // missed on the rest — `add-fields.test.js` records the count for every one of
  // them and lets it fall and never rise. See docs/PLAN.md, "the phone-fit target,
  // met on four doors of eleven", for what a speech's eleven rows would cost to
  // reach and why nothing here pretends otherwise.
  annotation: {
    main: ['quote', 'chapter', 'chapter_no+location', 'note', 'tags', 'color'],
    more: ['character', 'translation', 'language', 'sticker'],
  },

  // ── a line off a screen ────────────────────────────────────────────────────
  //
  // The only door whose fields depend on something chosen AFTER it opens: a
  // dialogue's locator is the work's medium, and the work is picked in the form.
  // So this door's entry is a function of media type, resolved by fieldsFor.
  dialogue: {
    movie: {
      // A film's line is a stretch of its one runtime — the owner's "Film
      // timestamp: start and end" (0070). Both ends lead, because a film has no
      // other locator at all.
      main: ['quote', 'character', 'timestamp+timestamp_end', 'note', 'tags', 'color'],
      more: SCREEN_SHARED_MORE,
    },
    show: {
      // "Show will also show season, episode number, and episode name" — the
      // owner's, and the timestamp stays with them: inside an episode it is still
      // the only thing that says where.
      main: ['quote', 'character', 'season+episode', 'episode_name', 'timestamp+timestamp_end', 'note', 'tags', 'color'],
      more: SCREEN_SHARED_MORE,
    },
    game: {
      // No timestamp in either direction — the server clears both ends on a game
      // (normalizeLocator), so offering one would be offering a box whose value is
      // thrown away without a word. Act and quest place the line; the DLC names
      // which body of content they sit inside (0071).
      // Act and quest pair, on the same rule as a book's chapter number and page:
      // two short boxes answering "where in this game", so one row rather than two.
      main: ['quote', 'character', 'act+quest', 'dlc', 'note', 'tags', 'color'],
      more: SCREEN_SHARED_MORE,
    },
  },

  // ── the seven standalone kinds ─────────────────────────────────────────────

  // A speech is the kind every other standalone kind was modelled on: somebody
  // said something, somewhere, on some occasion. It also carries the pair the
  // owner asked for by name — "letter/speech needs a source article, and also a
  // source author/editor. e.g. socrates' speeches are known from plato's
  // paraphrasing" — because a speech reaches a reader through a text, and the
  // person who wrote that text is neither the speaker nor anyone else on the row.
  speech: {
    // THE SOURCE PAIR IS BEHIND THE DISCLOSURE, on the owner's ruling once the row
    // counts were measured — "finding 3: move source pair behind the 'show more
    // fields'". It is the same place a letter keeps it ("letter: source title ·
    // source author : behind show all"), so the two kinds that share the pair now
    // treat it alike, which is this repo's own rule about two things that look the
    // same. And it is what brings a speech from eleven first-screen rows to nine:
    // the pair could not be PAIRED — a source's title and the name of the person
    // the words reach us through are both long, and "never truncate a name"
    // outranks a row count — so the only way to spend those two rows was to move
    // them. The field is not demoted in importance: the owner promoted it into
    // existence ("i may not read plato, but i want to add his quotes"), and one
    // press is where a thing that matters on some speeches and not most belongs.
    main: ['quote', 'speaker', 'board', 'translation', 'occasion', 'when+place', 'note', 'tags', 'color'],
    more: ['work_title', 'source_author', 'language', 'sticker'],
    // No region — a speech is placed by its occasion, and `place` already says
    // where. No recipient: a speech is given to a room, not addressed to a person.
  },

  // A letter's whole point is that it is addressed to somebody, so the recipient
  // leads. Its dateline is a place and a date — "Berlin, 1952" — which is why the
  // owner promoted Place here. The source pair it shares with a speech goes behind
  // the disclosure on their instruction: "letter: source title · source author :
  // behind show all", which is right, because a letter is usually quoted from the
  // letter rather than from an edition of the letters.
  letter: {
    // The dateline is ONE row: "Berlin, 1952" is how a letter says both, and a date
    // and a place are two short boxes answering one question — the pairing rule the
    // owner set with "location and chapter no. will share one line".
    main: ['quote', 'speaker', 'board', 'translation', 'recipient', 'when+place', 'note', 'tags', 'color'],
    more: ['work_title', 'source_author', 'occasion', 'language', 'sticker'],
  },

  // An essay is cited rather than witnessed: a title, a page, a year. The owner
  // hard-dropped two of a speech's fields here in one sentence — "essay doesnt
  // need occasion" and "drop useless items: like to for essay" (the recipient) —
  // and promoted the date: "Essay shows When".
  //
  // NO source_author, and this is the one place that field would be a second name
  // for the first: an essay's source IS the essay, so its author is the person
  // already in `speaker`.
  essay: {
    // The page and the year pair: an essay's citation is "<title>", p. 42 and the
    // year completes it, and both are short. Same rule as the letter's dateline.
    main: ['quote', 'speaker', 'board', 'translation', 'work_title', 'locator+when', 'note', 'tags', 'color'],
    more: ['place', 'language', 'sticker'],
  },

  // ── verse ─────────────────────────────────────────────────────────────────
  //
  // Migration 0068's own words are the spec: "its line breaks are its text, it is
  // often in another language, and it has a title rather than an occasion." So the
  // title leads where a speech puts its occasion, the translation sits high, and
  // the quote box keeps its line breaks — a poem rendered as a paragraph has lost
  // the thing that makes it a poem.
  //
  // The occasion and the place are NOT dropped, on the owner's pick: a song
  // performed somewhere particular and a poem written for an occasion are both
  // real, just not the common case, so they sit behind the disclosure with the
  // stanza and the date.
  poem: {
    main: ['quote', 'speaker', 'board', 'translation', 'work_title', 'note', 'tags', 'color'],
    more: ['locator', 'when', 'occasion', 'place', 'language', 'sticker'],
  },

  // A song is a poem with a tune as far as the fields go. Kept as its own entry
  // rather than an alias, so that the day one of them needs something the other
  // does not — a composer, an album — it is an edit here rather than an unpicking.
  song: {
    main: ['quote', 'speaker', 'board', 'translation', 'work_title', 'note', 'tags', 'color'],
    more: ['locator', 'when', 'occasion', 'place', 'language', 'sticker'],
  },

  // ── a proverb ─────────────────────────────────────────────────────────────
  //
  // The kind that proves the whole exercise: NOBODY SAID IT. A proverb has no
  // speaker, no occasion, no date and no place, and a form offering four boxes
  // that can never be filled is a form that teaches the reader to skip boxes.
  // The owner's own example — অতি সন্ন্যাসীতে গাজন নষ্ট — has a language, a
  // translation and a region, and nothing else.
  //
  // Region behind the disclosure on their instruction ("proverb: region behind
  // show all"), which the measurement agrees with: none of the proverbs in a real
  // library has one, because the shipped starters arrive without.
  // THE LANGUAGE IS ON THE FIRST SCREEN, AND ONLY HERE. The global rule puts it
  // behind the disclosure everywhere ("language … it should be everywhere, behind
  // show all") and the owner made this kind the exception once the card's shape was
  // settled: "proverb language should be a first screen field."
  //
  // The reason is that the card now reads a proverb's attribution OFF THIS BOX —
  // "{language} proverb", their correction of a first proposal that used the region
  // — so a proverb saved without opening the disclosure would draw no attribution
  // at all. The one line the card prints cannot come from a field the reader has to
  // go looking for. It is also the field their own measurement showed filled on
  // every proverb in a real library, which is what makes promoting it cost nothing.
  proverb: {
    main: ['quote', 'board', 'translation', 'language', 'note', 'tags', 'color'],
    more: ['region', 'sticker'],
  },

  // ── other ─────────────────────────────────────────────────────────────────
  //
  // THE ONE DOOR THAT HARD-DROPS NOTHING, and that is not laziness: "other" means
  // the reader could not say what this is, so nothing about it can be predicted.
  // Every field the table knows sits here, the plausible few above the disclosure
  // and the rest below it.
  other: {
    main: ['quote', 'speaker', 'board', 'translation', 'note', 'tags', 'color'],
    more: ['occasion', 'when', 'place', 'region', 'recipient', 'work_title', 'locator', 'source_author', 'language', 'sticker'],
  },
}

// fieldsFor answers the question the form opens with. `mediaType` is only read for
// the dialogue door, where the work decides the locator — anything unrecognised is
// a film, which is what the server assumes too (workFromMovie narrows the same
// three values for the same reason).
//
// Returns frozen arrays: these are module-level tables, and a caller that sorted
// or spliced one in place would change every later form on the same page.
export function fieldsFor(door, { mediaType } = {}) {
  const spec = door === 'dialogue' ? FIELDS.dialogue[mediaType === 'show' ? 'show' : mediaType === 'game' ? 'game' : 'movie'] : FIELDS[door]
  if (!spec) return { main: [], more: [] }
  return { main: Object.freeze([...spec.main]), more: Object.freeze([...spec.more]) }
}

// showsField — whether a door draws a field at all, in either state. The form uses
// it to decide what to SEND: a hard-dropped field must not be posted, because on a
// full-state PUT an absent field is an empty one and a value the reader never saw
// would be cleared behind them.
// THROUGH fieldKeys, NOT THROUGH THE RAW LISTS, and the first cut of this did the
// latter. A paired row is stored under one key — `season+episode` — so asking the
// unsplit list whether it offers `season` answered no, on the one medium that has
// one. The payload builder reads this function to decide what to SEND, and a
// full-state PUT treats an absent field as an empty one: the bug would have
// cleared the season off every show line saved from this form. The test that
// caught it is `never asks a game for a runtime, and never asks a film for an act`.
export function showsField(door, field, ctx) {
  return fieldKeys(door, ctx).includes(field)
}

// PAIRS are the field keys that draw as one row of two boxes, spelled `a+b` in the
// tables above. The owner asked for one of them by name — "location and chapter
// no. will share one line" — and the rest follow the same rule: two short boxes
// answering one question ("where", "when", "which episode") read as one control
// and cost one row instead of two on a phone.
//
// Expressed in the key rather than in the renderer so that this table stays the
// single answer to "what does this form draw", and a test can read the layout
// without mounting anything.
export function splitPair(key) {
  return key.includes('+') ? key.split('+') : [key]
}

// fieldKeys flattens the pairs, for a caller that wants the plain column names —
// the payload builder, and the test that checks nothing is placed twice.
export function fieldKeys(door, ctx) {
  const { main, more } = fieldsFor(door, ctx)
  return [...main, ...more].flatMap(splitPair)
}

// doorForBoard — a board that can answer the kind question does, and no reader is
// asked twice.
//
// THIS IS THE HALF OF THE DESIGN PACK'S §1 THAT SURVIVED. Its rule was "the board
// owns the kind, so by the time a capture form opens, its shape is already
// decided", and with only `plain` and `proverb` in the column (0037) that is true
// of exactly one board kind. So pressing ＋ inside a proverb board opens the
// proverb form — no chooser, no Kind select, the question answered by where you
// were standing. Every other board returns null and the chooser asks, because a
// plain board genuinely does not know whether the next line is a letter or a song.
export function doorForBoard(board) {
  return board?.kind === 'proverb' ? 'proverb' : null
}
