# ADR-0798: The add surface's header is one line, and that is the third exception to a standing rule

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, over a screenshot of a phone where "The Armchair Economist" came down the header
three lines deep and pushed the form off the screen:

> the header names can get ellipsis. they do not need to have edgemask sidescroll or infinite
> wrap. one line is enough. / for second line get the author/director whatever in smaller font.

**IT OVERRULES "NEVER TRUNCATE A NAME", WHICH IS A RULE IN THIS REPO'S OWN CLAUDE.md** — so
it is recorded here rather than changed in a stylesheet, and the convention the crumb section
above states is followed: an exception is named in `typescale-baseline.json` with the ruling
that granted it, and held in `no-truncated-names.test.js`'s EXCEPTED beside the two before
it. That note said "exactly TWO deliberate clips"; there are four now — this is a PAIR, the
phone's `.mobile-sheet-title` and the desk's `.add-head-title`, because one component draws
one header twice and a clip on one with a wrap on the other is this repo's "two things that
look the same behave the same" broken down the middle of a single file.

**WHAT PAYS FOR THE CLIP IS THE SECOND HALF OF THE SAME INSTRUCTION.** The rule's argument is
that a shortened name and a short name look alike, so the ellipsis destroys the thing the line
exists to show. That argument holds when the line is all there is. It stops holding when the
line becomes two: the slot went from one ambiguous name that would not fit to a name AND the
person who made it, which is more identifying than the untruncated title was — two books
called *Home*, a film and the novel it came from. The trade is the same one the panel title
won on four days earlier, and it is the reason this is an exception rather than a reversal.
A name still never truncates anywhere a reader is READING it.

**`credit` IS A NEW FIELD RATHER THAN A REUSE OF `sub`**, and the distinction is not
bookkeeping. `sub` is what the work PICKER prints under a row and filters on, where a release
year is genuinely what tells two films apart; `credit` is who made the thing. On a book they
coincide, on a film they do not, and reusing `sub` would have put a year in a slot the owner
asked for a director in.

### And the header was empty on the commonest route, which the ruling exposed

A ＋ pressed on a book's own page opens this surface with `{type, id}` — enough to file the
quote against the right work and nothing with which to NAME it. So `target.title` was
undefined and the header drew an empty string, on what is probably the way most quotes are
captured. It was invisible because the form prints the work itself in its picker chip one row
below, so the screen read as fine and the header read as a gap rather than a defect.

The opening target is resolved against the library's own rows now. `useWorks` took an
`enabled` flag so the fetch MOVES rather than doubles: the surface asks only when it was
opened on a work, which is exactly the case where the chooser does not render and its own
call never happens.

### The kind menu went, and it was this surface's own earlier request

> the header will also have a back button as usual, but also a menu button to have a dropdown
> where users can change the add mode.

— and, three sentences later over the built thing, *"remove this menu from the add surface.
not needed since we have the back button already."* They are right, and the reason is
structural: the dropdown's five rows ARE the first screen, and Back is what returns to the
first screen. Two controls doing one thing in the scarcest row on a phone, and the one that
had to be discovered sat beside the one that did not. Both test cases were INVERTED rather
than deleted, and each now asserts the capability as well as the absence — "the menu is gone"
and "the menu is gone and so is the way to Files" are the same `queryByLabelText`.

### Import's how-to list is help, and the screen's own copy of it went

This reverses a departure this file never recorded. The one-drop-target plan says the list of
supported formats "moves into help, where a list belongs", and that the eight step-lists are a
help SECTION rather than the one row `capture.help.import` had been. What actually shipped kept
them on the screen, behind a `<details>`, under a comment in `ImportPage.jsx` asserting that
"the how-tos stay" — an argument made in a code comment and nowhere a reader of this file would
meet it.

The argument was not wrong about the question: *"where do I get a Goodreads file"* is real, and
answering it is worth a screen's space. It was wrong about the shape. Eight formats, each with a
description, an extension and three numbered steps, is reference material — and this repo's own
rule is that a row says a thing once. Keeping the list on the screen AND adding it to help would
have been two copies of one table; keeping it only on the screen left the "?" answering a
question about capturing a quote, because the add surface hardcoded `screen="capture"` on both
of its headers.

So the list is drawn once, by `HelpSources`, from `SOURCES` itself — which is the plan's
strongest line and the reason it survives contact: *the list cannot drift from the parser table,
because it IS the parser table.* The table moved to `src/importSources.js` so neither of its two
readers owns it; `ImportPage` still derives its `accept` filter and its "Read this as…" menu from
the same rows.

**And the "?" now picks its section off the mode.** `helpScreen` in `routes.js` cannot answer for
import — it derives from `(tab, detail)`, and import has been a MODE of the add surface rather
than a screen since the rebuild, so there is no tab to derive from. The surface decides instead,
in one `helpKey` both its headers read. Two headers each carrying their own literal is how one of
them goes on being right while the other quietly stops, which is the failure the repo's
"two things that look the same behave the same" directive names.

The one thing genuinely lost is a reader who never presses "?". That is the cost of the rule, and
it is paid down by where the section sits: `import` is directly under `capture` in `GUIDE_ORDER`,
so the guide's rail shows the two together the moment either is opened.

### A staged row's boxes come from the add surface's own table, after two wrong answers

The queue's per-row editor drew ONE box set on every row. A staged proverb was offered a
chapter, a season and a timestamp, and nothing with which to say who said it — so the repair
branched on "is this a standalone row", which fixed the proverb and left a BOOK row holding a
timestamp, a season, an act and a DLC. That is the owner's own example of a hard drop
("timestamp of a book"), reintroduced by the fix for the adjacent bug.

**The argument that produced it was false, and that is the part worth recording.** The
branching version reasoned in a comment that the queue could not ask `fieldsFor(door, {
mediaType })` the way the add surface does, because a staged film, show and game are one
`movie` kind until approval. They are not: `stagedWorkRow.Kind` is `importMediaType()`'s
output (`import_staging.go:336`, `import_movies.go:79-85`), so a staged show says `show` and a
staged game says `game`. A whole field list rested on a claim nobody checked against the line
that produces the value.

The same wrong belief had already shipped a live bug one layer up — the suggestions hook was
routed by `kind === 'movie'`, so every show and every game asked `/books/<a movie id>/cast`
and `/books/<id>/chapters`. A game's DLC box could never suggest a pack, and where a book
happened to hold that id the row offered another work's chapters, which the code's own comment
calls worse than offering none. **And the test that should have caught it could not**: its
fixture set `kind: 'movie'` plus a `media_type` field `stagedWorkRow` does not have, so the
suite was green over a shape the server never sends.

So the editor now asks `fieldKeys(door, { mediaType })` and intersects it with what the
endpoint can write. Four shapes, from one table: a book by its chapter and page, a film by its
runtime, a show by its season and episode name, a game by its act, quest and pack, and a
standalone row by its own 0053 kind.

**One field is the queue's and not the add form's**, and the exception is stated rather than
smuggled: no door lists `actor`, because a person capturing a line types the character and the
server fills the performer in from the cast. A FILE can state one outright, and `autofillActor`
(`dialogue_handlers.go:262`) returns a non-empty actor unchanged — so dropping the box would
lose a repair the queue is the only place to make.

**And the bulk panel is the same table.** It offered eight fields while the row editor offered
twenty-one; the field that fell out was `language`, which is the one most likely to be
uniformly wrong across a whole file and therefore the one the bulk editor exists for. Both
read `WRITABLE_FIELDS` now. The panel skips only the date, because a canonical date and a
circa flag travelling together cannot be expressed by a checkbox and a text box.

### The import plan's own step-8 guard is moot, and the proof is one line

`docs/plans/import-one-drop-target.md` lists, among the guards its last step owes, an
`import` entry in `web/frontend/test/screens.js`. It cannot have one, and the reason is
worth recording rather than leaving as a guard nobody closed.

`SCREENS` is a MOUNT table keyed by route, and `screens-mount.test.jsx:49` asserts
`screenLabelsInApp()` — read out of App.jsx's own `data-screen-label` attributes —
equals its keys exactly. Import has no such label, because the add-surface rebuild made
it a MODE of that surface rather than a screen with a route. Adding the key would
therefore fail the test that exists to keep the table honest, which is the table working.

What the guard was actually reaching for is covered elsewhere: `ImportPage` is mounted by
`test/dom/import-drop.test.jsx`, so the "does this component throw on mount" question the
mount table answers for every screen is answered for it too.

Two of that plan's items are genuinely still open — the shared file-upload primitive, and
`controls.mjs` never reaching the add surface or the import mode — so the file stays in
`docs/plans/` until they land. A third has retired itself: `infodot-copy.test.js` named
ImportPage among the files whose dots are still English literals, and `grep -c InfoDot`
on it is now 0. That list is seven files, not eight.

### A proverb's language is already on the first screen, and the plan still says it is not

The owner, asked about the open question `docs/plans/quote-card-types.md` raises: **"Proverb
language should be too screen."** That is the plan's option 1 — language out from behind
*Show all fields* on the proverb door — and it shipped on 10 September in `abf27b53`.
`addFields.js:253` reads `main: ['quote', 'board', 'translation', 'language', 'note',
'tags', 'color']`, and the edit form shows it too, because `Quotes.jsx:318` asks
`showsField`, which is main ∪ more.

**The plan's section "The consequence for `{language} proverb`, and it needs the owner's
eye" is therefore stale in a way that would have cost work.** It states that language sits
behind the disclosure, concludes that a proverb saved without opening it draws no
attribution at all, and recommends option 3 — defaulting the language from the proverb
board's own `languages` list (0037), falling back to option 1. The premise is false against
the code, so option 3 would have been a workaround for a problem that was fixed the day
before the plan was read.

Recorded here rather than edited into the plan file, because a planning agent owns that
directory. What the plan is still right about is the other half: **region survives as a
field and is not the attribution** — a Sylheti proverb is a Bengali proverb from somewhere
in particular, and the card has room for the general fact only.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
