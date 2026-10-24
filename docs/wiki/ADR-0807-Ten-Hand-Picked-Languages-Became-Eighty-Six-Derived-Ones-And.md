# ADR-0807: Ten hand-picked languages became eighty-six derived ones, and four rules changed shape underneath

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Item 6 of the queue starts here: `STARTER_LANGUAGES` — ten names, each with four glyphs
typed in by hand — is gone, and `web/frontend/src/iso639.js` answers in its place. It is a
leaf module with no imports and one importer, `languages.jsx`, which is what keeps one
answer to "what is this stored value". The list is **curated and not the whole registry**:
639-1 has 184 codes, and what the other ninety-eight would be here is autonyms transcribed
from memory. A language's own name for itself, spelled wrong, offered by the app as though
it knew, is worse than an absent row — so the honest form of a row nobody verified is no
row, and a language that is not listed goes on working exactly as it always has, because
every language column in this app is free text and stays that way.

**THE GLYPH IS DERIVED, AND THE OBJECTION TO DERIVING IT IS ANSWERED RATHER THAN
ACCEPTED.** The hand-picked rows existed for a reason worth keeping: four of the ten were
written in Latin, and a cover drawing the same letter on all four says nothing about which
board you are looking at. A naive first-rune rule reproduces exactly that — `English` and
`español` both start with an E. So a language's mark is **the first letter of its own
autonym that no EARLIER language of the same script has claimed**, computed once over the
fixed list. Two things follow, and both are deliberate:

- It is computed over the LIST, never over the reader's set. A mark that depended on which
  languages a reader had added would change a board's cover letter because an unrelated
  language was added somewhere else.
- Combining marks are excluded. Bengali `া` and Devanagari `ि` render as a dotted circle
  when they stand alone, so a tray offering them offers a placeholder glyph. This was
  caught by looking at the output rather than by a test, which is the argument for having
  printed it.

### Where the plan turned out to be wrong

There is no plan file for item 6 — it came out of the queue directly, and `Design-decisions.md` already
records why writing one here would be inventing the queue. What follows is where the *task
list's* one-line descriptions turned out to understate the work.

**"Drop STARTER_LANGUAGES" was four rules, not a deletion.** Removing the ten took four
things with it that nothing else was carrying, and each had to be replaced explicitly:

| What the ten silently provided | What replaced it |
|---|---|
| A populated Settings table for every account | The library's own languages, from `/search/vocabulary`'s `languages` |
| The canonical capitalisation ("Bengali" beside the key "bengali") | `iso639.js`'s English name; the caller's own spelling for a language it does not know |
| A row that survived a reload with no mark stored | The stored display name is always kept — the entry IS the row |
| A chip row on the board form with something in it | The same vocabulary, and eighty-six chips were refused |

**The keep-the-name rule reverses an earlier one, and the earlier one was right at the
time.** `languageMarksBlob` used to drop a "rename" that matched the language's own name,
on the reasoning that a row saying nothing is not a setting. That held while ten starters
were rows whether or not anything was stored for them. The moment they went it became
false: an entry that serialises to nothing is dropped whole, so a reader who added Bengali
and gave it no mark would have watched the row appear and be gone on the next reload —
"add a language" failing its own test. The name is kept now, and `renamed` became a
COMPARISON at display time rather than the presence of a field, so the row still knows it
was not renamed.

**`added` was deleted rather than updated.** Under the starters it meant "not a starter",
which was the same question as "may this be removed" only while the ten were unremovable.
Nothing reads it — there is no remove control on that panel yet — so leaving it with a
silently changed meaning would be a seam with no caller, the pattern this log already
names for `attributionOf`. The refusal-to-remove task brings back what it needs beside the
button that needs it.

**Eighty-six chips on the board form were refused, and the combobox was not half-built
to compensate.** The chip row could have offered every known language; the repo's own rule
is that a row too long to read scrolls under a fade with a button to the full set, and a
wrapped grid of eighty-six is neither. The obvious fix — swap the free-text box beside it
for `SuggestCombo`, which is how every other name field in this app offers the library's
own values — was tried and reverted. `SuggestCombo` commits on BLUR as well as on a pick,
and this box's commit ADDS A LANGUAGE: typing "Beng" and clicking away would file a
language called Beng. Wiring it properly is the combobox task's own work, on the quote and
work fields at the same time. So the chips are the library's own languages, the box is the
plain one it has always been, and the comment at that line says why rather than leaving
the next reader to rediscover the blur.

**One alias exists, and it is a fact about this app rather than about a language.** The
board form's picker was `STARTER_LANGUAGES.map((l) => l.name)` for a year, and one of those
ten names is not the standard's: the starter list said "Mandarin" where 639-1 `zh` is
"Chinese". Every board created from that picker holds the string "Mandarin", so without an
alias those boards lose their cover glyph the day the picker starts offering "Chinese". It
is a map beside the index and not a second `name` field — nothing outside those lines
should have to know that a name was once spelled differently here. It was written
expecting a one-time upgrade to fold free-text languages onto codes and read the same
map; that upgrade is not being built, for the reasons in the next section, so the alias
earns its place on the display path alone. `languageFor` resolves "mandarin" to the `zh`
row, which is what `displayName` and `markFor` each ask for, so a board created from the
old picker still shows 中文 and still wears its cover glyph — with the string "Mandarin"
left exactly where the reader put it.

**A test suite that opened on ten rows now opens on a fetch.** Four DOM files rendered the
language table or the board form against nothing and found ten rows there anyway. They
serve `/search/vocabulary` now, and one lookup had to be awaited: the vocabulary is cached
at module scope, so only the FIRST case in a file actually races and the rest pass on the
cache the first one filled — an order-dependent suite that would have looked like a flake.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
