# ADR-0818: The 6/10 pass, and the finding that was the original bug

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Five findings, and the first two are the same shape: the credit was composed
correctly and then the old flat entries went on printing what it had already said.

**THE SHARE PRINTED THE KIND TWICE, ON THE SURFACE THE CHANGE WAS ABOUT.** The
`medium` entry carries `quoteKindMeta(row)` — the kind's own label — and nothing
gated it, so a letter shared as "Letter to Carl Seelig … Letter" and a proverb as
"Bengali proverb … Bengali … Proverb": one fact, three times, which is the exact
duplicate `attribution.js` exists to end. The card has never done this; it draws
`[kindLine, ...unspoken]` and no separate medium at all, and the reason is
structural — every branch of `phrase()` falls back to the kind's own WORD when its
shape has nothing, and its `default` arm returns `quoteKindMeta`. **A phrase
implies the kind by construction.** Both entries are gated on `line` now, and the
proverb legend is gated rather than deleted because a row with no `kind` has no
phrase and the legend is then the only thing it shares with.

**AND THE OCCASION WAS SILENTLY DROPPED.** The entry read `line || occasion`. For
every kind except a speech the phrase does not consume the occasion, so a reader
who had typed one watched it vanish from the share while the card went on showing
it. It is `[line, unspoken(occasion)].join(' · ')` now — which is what the card
prints. Joining a finished phrase to the facts it left unsaid is not the
concatenation the plan file warns about; that warning is against gluing the kind's
WORD to the recipient, "Letter · Carl Seelig" where the phrase says "Letter to
Carl Seelig".

**NO CASE COVERED IT**, and that is the part worth keeping: `share-attribution.js`
gave a letter a recipient and gave a speech an occasion, and never gave one row
both. The rater's line — "no case in share-attribution.test.js gives a row both a
recipient and an occasion" — is the whole diagnosis.

### Three smaller ones, and a claim that was false

**`askDiscard` WAS NOT THE ONLY PLACE THAT ASKED.** The BulkBar kept a verbatim
copy of the same four keys, while the commit body claimed the question was raised
"through one askDiscard … wherever it is raised". It goes through it now, and a
source case asserts `staging.discard.confirm.title` is built exactly once —
because the claim is about there being ONE of something, which a behaviour case
cannot show.

**A PAGE DEFAULTED ONE WAY ON A QUOTE AND THE OTHER ON A HIGHLIGHT.** `locator`
carries `share.field.location.label` — the same word a book highlight's `location`
uses — and `SHARE_OFF_BY_DEFAULT` lists only `location`, so the same fact was off
on one surface and on on the other. Both are in the set now.

**AND ONE REPAIR WENT UNDISCLOSED.** `f8ea94b1` also rewrote
`two-boards-one-bar.test.jsx`'s Auto case, which the previous commit had left
asserting the pre-rater behaviour — so that commit's baseline was red and its body
mentioned only the import work. Recorded here because a commit that quietly
repairs something else is a commit whose body cannot be trusted to list what it
touched.

**AND TWO SURFACES WERE STILL CONCATENATING — this paragraph said ONE, and a pass
later found the second.** The entry above says the share now composes its credit
the way the card does, which was true and not the whole claim a reader takes from
it: the SEARCH RESULTS LIST was never part of either. It drew
`[h.speaker, h.occasion].join(' · ')` — the literal shape `quote-card-types.md`
opens on — so a letter found by search read "Albert Einstein · after the prize"
while the same quote on its board read "Albert Einstein · Letter to Carl Seelig ·
after the prize · Zurich · p. 3". One quote, two pictures, on two screens a reader
moves between.

**HALF OF THAT FIX IS ON THE SERVER, and it is why the defect survived the pass
that should have caught it.** `utteranceHit` carried no `recipient`, `work_title`
or `locator`, so composing the row correctly was not enough — the hit had nothing
to compose from, and a fix written only in the client would have drawn the kind's
bare word and looked like the phrase working. `search_handler.go` sends the three
now. `region` is deliberately not among them: the owner's correction made a
proverb's attribution `{language} proverb`, so no shape in `CONSUMES` reads region
and shipping it would be a column with no reader.

**A RATER FOUND THIS BY MEASURING AND WAS WRONG ABOUT WHERE IT WAS.** The report
named `SearchPage.jsx:1176`'s `quoteShare` call as the site. That call is handed
`row`, fetched from `GET /quotes` — which carries all four 0047 columns
(`utterance_handlers.go`'s `utteranceCols`) — and `ShareDialog` is gated on
`row &&`, so a hit never reaches it. The share was correct. The measurement was
right, the line was next door, and the value of the finding was entirely in the
measurement: worth recording because a finding checked at its own line is what
separates the defect from the guess about it.

**THE SECOND SURFACE WAS HOME, AND THE FIX FOR THE FIRST CLAIMED THERE WAS NO
SECOND.** `quoteFav` (`Home.jsx`) built a favourite tile's line as
`[occasion, date, place, quoteKindMeta(u)]` — the same list-of-whatever-is-filled,
with the kind's own word appended as one more item, which is precisely the
duplicate `attributionParts` exists to remove. So a letter read three ways at
once: `after the prize · 11 Mar 1952 · Zurich · Letter` on the wall,
`Albert Einstein · after the prize` in search, and the right thing on its card —
while THIS PAGE'S OWN SHARE of the same quote was correct, because that call
passes the whole row.

**WHAT MAKES IT WORTH A PARAGRAPH IS THE COMMENT IT CARRIED**, which read "the
same rule utteranceMeta follows, spelled through the same helper". It was not
following that rule; it was spelling a different one beside it. **A rule CITED
rather than CALLED is a rule with two implementations**, and that is the third
time this session the same shape has been found: the film board citing the book
board's bar, `Frame` citing `AnnotationCard` for where the translation sits, and
this. A comment naming the canonical function is evidence the author knew about
it, not evidence the code uses it.

**AND THE FILM CARD WAS THE FOURTH, FOUND BY WRITING THE GUARD THE OTHER WAY UP.**
`Frame` drew the translation after the chips, the credit row AND the tag row, under
a comment reading "for the reason AnnotationCard gives" — a reason about the NOTE,
from a card that puts the translation directly under the words. The owner's card
shape is one order for every annotation card in the app, so this was the twin four
bands out of step.

**THE GUARD FOUND A SECOND DIVERGENCE THE EYE HAD MISSED.** `one-card-shape.test.js`
does not check either card against a written order; it reads both sources, ranks the
seven bands in each, and asserts the two rankings are equal. The first run failed
twice: the translation, which is what it was written for, AND the note and the tag
row, which `Frame` also had the wrong way round and which nobody had noticed in
three passes over that file. **A test that checked the film card alone would have
passed** — the card was internally consistent; what it was not was the same as its
twin. That is the argument for comparing two implementations rather than checking
one against prose: prose is what both of them already cited.

**AND THE GUARD WAS SCOPED TO THE SCREEN RATHER THAN TO THE RULE**, which is why
the first fix could ship a false claim. `search-hit-credit.test.js` covered the
search row alone while the commit told users that row was "the one place left" —
a guard over one surface cannot check a sentence about all of them. It is
`one-credit-everywhere.test.js` now, named for the rule, and it compares the
search row, the Home tile and the stored row against each other rather than
asserting any one is right. Its two fixtures are independent literals for the
same reason: the first version built the stored row by spreading the hit, so a
field missing from the hit was missing from both sides and the comparison agreed
by construction — a rater deleted `place` from it and every case still passed.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
