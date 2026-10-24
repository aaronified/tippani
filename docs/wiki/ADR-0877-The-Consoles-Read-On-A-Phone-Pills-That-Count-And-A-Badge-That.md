# ADR-0877: The consoles read on a phone: pills that count, and a badge that means something

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner read the Characters console on their own phone and reported seven things at once.
Six of them are one fault seen from six angles — **the screen printed numbers nobody could
act on** — and the seventh is a rule.

**"189 CHARACTERS IS WRITTEN TWICE."** It was: a `189 SHOWN` label, and under it "189
characters, 0 in no work". The second line existed to carry the one extra fact, and it
carried it as prose, where the only thing a reader can do with it is read it again. Both
facts are pills now — `everything 189`, `in no work 0` — and pressing one is the act the
sentence could never offer.

**"THE 189 BADGE ON THE TOP BAR MEANS NOTHING."** It was the size of the library. A badge in
this app means "there is something here for you"; three of these four said "this exists",
which is the same number tomorrow and never falls when you work. Works, People and Characters
now badge the records with SOMETHING WRONG, computed from the same predicate tables the pills
behind each door are counted from — which is what stops the door and the row under it
disagreeing. Overview is the one that stays a count of findings, because its own rows ARE the
findings.

**"THERE SHOULD BE CHIPS AT THE TOP OF THE CARD TO FILTER THE CHARACTERS FROM THE TOP
ISSUES… in work, people, and character screens. These will be pills, in one row. Edgemasked
with sidescroll."** A dropdown holds its options behind a press, so finding out how many
people are missing a photograph meant opening it, choosing, reading the count above the list,
and opening it again for the next one. A pill carries its count, so the shape of the gap is
readable without any press at all — and the count is the number the reader came for. The row
is a `Scroller`, so the fade is measured: a row that fits wears none.

**A ZERO PILL STAYS AND IS DIMMED.** "None of my people are missing a photo" is the state the
whole screen works towards, and a pill that vanished at zero would take the news with it. It
stays pressable, because a press that lands on "nothing here" has answered the question.

**AND THE COUNTS ARE OVER WHAT THE OTHER FILTERS LEFT**, not over the library. A pill that
says 40 and lands on 3 is worse than a control that says nothing, because the number is the
reason it was pressed. Each console splits its filtering in two — `base` (type, role, search,
work) and then the issue — so a pill's number is by construction the size of the list pressing
it produces. Both journeys assert exactly that, and the mutation that breaks it is counting
over the wrong list.

**"THE CHARACTERS SHOW WORK, BUT NOT QUOTES."** A character IS the thing that says lines. The
server counts them through `speaker_cast_id` across dialogues and annotations, which is the
only link there is: a quote points at a CAST ROW, and the cast row points at the character.

**"THE RED 1 IN THE CHARACTER ROW SEEMS TO ONLY BE TAKING UP SPACE WITHOUT GIVING ANY ADDL
INFO."** Right on every count. It was `works - faced`; it could not be pressed; the sub-line
beside it already said "1 of 3 with a face chosen"; and it spent the app's danger colour on a
missing thumbnail. It is `no picture` in the filter row now — same fact, reachable.

**THE SUBTITLE, IN THE OWNER'S OWN NOTATION:** `x <work_icon>•y <quote_icon> - <work names
like pills, with edgemask and sidescroll>`. The icons carry the nouns so the numbers do not
have to: two counts and two words is four things to read on a line that is scanned, two counts
and two pictures is two. The names are pills because "never truncate a name" is the standing
rule and a list of titles is exactly where an ellipsis would land — six of them, and the count
beside the icon says when there are more.

**AND THE PERSON ROW GOT THE SAME SHAPE, WHICH IS THE DIRECTIVE AND NOT A FLOURISH.** Two
lists of records drawn by one function had been saying two different things under the name;
"similar things should act similarly" applies to what a row SAYS as hard as to what it does.
The works count kept its door — pressing it still searches the library for that person — and
the door's words are its tooltip rather than its accessible name, because a first draft welded
the two and the row announced itself as "12 Search the library for “Bulgakov”".

**"THE PRUNE DOESN'T SHOW WHOM I AM GOING TO PRUNE."** `GET /people/orphans` has always
returned the rows, and its own handler says why — "a confirm that says 'remove 23 records'
without naming one is a dialog a reader cannot answer". The button read `.length` off both
lists and threw the names away. Every name is listed now, people and characters apart, in a
box that scrolls rather than a "…and 18 more": the eighteen are precisely the ones the reader
has not checked.

**"THE PROSE EVERYWHERE IS TOO LLMEY, WITH INDIRECT PHRASING."** Nine keys went with the
surfaces that printed them. Of what is left, the tell was a second sentence restating the
first — "Nothing is missing. Every record this page can check is complete." — and the
passive-with-an-escape-hatch, "review before anything is applied", which names no reviewer.

**"WORK IMAGES ARE RECTANGLE, WHICH IS FINE, BUT PEOPLE AND CHARACTER IMAGES SHOULD BE
CIRCLES. CONSISTENCY IS KEY."** Now a rule in `CLAUDE.md` and a ratchet in
`test/rules/portrait-shape.test.js`. The shape is the fastest thing on a row to read —
legible before a pixel has loaded and at sizes where a face is not — so it has to mean WHICH
KIND OF THING this is. The character screens' five portraits were already round; the metadata
consoles' were not, which is how a 2:3 character came to sit in a column of circles.

**A CIRCLE NEEDS A SQUARE.** `border-radius: 999px` on the cast row's 34×42 box draws an EGG,
which reads as a broken picture rather than as a portrait — so the box was squared in the same
edit as the radius. And the placeholder is square too: a 7:9 gap that becomes a circle reflows
the text beside it the moment a photo arrives.

**THE RATCHET IS DERIVED, NOT LISTED.** A hand-written list of the eleven classes to check is
a list that goes stale the day a twelfth portrait is added under a new name — which is exactly
the case it exists for. It sweeps every rule whose selector follows the repo's own portrait
naming (`person-`, `char-`, `cast-`, `cred-` plus `face`/`portrait`/`photo`/`thumb`), so a new
one is covered by being named the way its neighbours are. `.tp-media-face`, `.board-tile-face`
and `.trash-face` are the front of a TILE rather than somebody's face, and none of them carries
one of those four prefixes — which is why the prefix is part of the rule and not just the word.
It found one thing on its first run: `.char-head-face`, a 2:3 portrait in a block of CSS no JSX
had referenced for some time. Dead code that violates a new rule is deleted, not exempted.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
