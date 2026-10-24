# ADR-0814: The face that was asked for everywhere and won nowhere

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A 5/10 rater pass on 258361d9, and its first finding is the one that matters: the
per-language face was **inert on every surface it had been attached to**.

`applyFonts` emitted `.tp-lang-x { font-family: … }` as a normal author rule. Every
quote slot in this app carries an **inline** font-family — `QUOTE_STYLE`
(Library.jsx), `quoteStyle` (Movies.jsx, flow.jsx), the two Home tiles, the search
hit windows — and a style-attribute declaration beats a normal author rule whatever
its specificity. So the class was applied, the picker showed the reader's choice,
and the type never changed. The one slot that DID work was `TranslationLine`, which
draws through the stylesheet and has no inline face, plus the share image, which is
a canvas and never saw the class at all — so the owner's German would have taken
its serifs on a translation line and in a picture, and nowhere else.

**AND `.bengali` HAD THE SAME DEFECT SINCE IT WAS WRITTEN.** It only looked right
because the display stack already carries the Bengali face after the Latin one, so
the glyphs came out Bengali by FALLBACK rather than by that rule. A Latin-on-Latin
swap has nothing to fall back to, which is why the bug was invisible until German
needed a serif.

### The fix is an indirection, not a bigger hammer

`!important` would have worked and would have been the wrong answer: it makes the
class beat every inline style including ones that are supposed to win, and it
teaches the next reader that specificity in this app is a fight. A custom property
is read BY the inline declaration instead of competing with it:

- the generated rule sets `--font-quote`, and so do `.bengali` and `.devanagari`;
- every quote slot's inline `fontFamily` is `QUOTE_FACE` — `var(--font-quote,
  var(--font-display))` — written once in fonts.js so a new surface cannot invent
  a spelling that answers to nothing;
- `.bengali` KEEPS its own `font-family`, because the Bengali wordmark wears that
  class with no inline face and would lose its letters without it.

### Why 4,191 tests were green over it

Every case asserted the CLASS NAME. `expect(bodyScript).toBe('bengali')` is true of
a class that cannot win, and deleting `className={languageClass(…)}` from four of
the five surfaces the previous commit existed to fix left the whole suite green —
the rater proved that by doing it.

jsdom does not resolve `var()` inside `font-family`, so the honest assertion is a
pair: the element RESOLVES `--font-quote` to the chosen family (which proves the
class reaches it and the rule sets a variable), and nothing between the class and
the words names a face of its own. Both are now made per slot — ExpandableText,
FlowQuote, TranslationLine, MatchWindow, Home's tile and the quiz block — and
reverting the rule to `font-family` fails five of them.

**AND THAT SENTENCE NAMED A SIXTH THAT WAS NOT THERE.** The commit body and an
earlier draft of this paragraph both claimed Home's serendipity card was covered.
It was not: the case they pointed at rendered Home, and the serendipity card does
not draw in a plain Home mount — only the favourites wall does, so the assertion
could only ever reach the TILE. A rater caught the claim; the honest fix was to
export the component and draw it, which is what `QuoteBlock` and `MatchWindow`
already needed for the same reason. A claim about coverage is worth checking by
counting the nodes the case actually found, which is how this one was settled.

### Two more from the same pass

**THE PICKER SAVED UNDER THE WRONG KEY.** A language row carries both a `key` (the
fold of what the library stores) and a `canonical` (the English name iso639 knows
it by). Every other control in that row passes `key`; the face picker passed
`canonical`, so a library whose quotes say `বাংলা` saved `{"bengali": …}` — read
back as saved, showed the chosen face in the dropdown, and changed no card. The row
is HEADED "Bengali" and KEYED `বাংলা`, which is the whole trap.

**AND THE DECK DREW IN A FACE NOBODY CHOSE.** The quiz is the surface a reader meets
a quote on most often and it carried no language at all. `reviewCard.Language` now
travels — one column on each of the three deck queries, read by nothing on the
server, which is exactly why it needed a test of its own.

### And four surfaces the face still did not reach

A third pass, at 7/10, found the rest of them — every one the same shape as the
first: the class was in place and something upstream made it answer nothing.

**SEARCH HITS CARRIED NO LANGUAGE AT ALL.** `annotationHit` and `dialogueHit` had
no `Language` field; only `utteranceHit` did. So `languageClass(h.language)` on a
book or film result was permanently `''` — and the CHANGELOG said search was
covered. No frontend test could see it: a vitest case renders a hit it built
itself, so it proves the class is applied and can say nothing about whether the
server sends the field to put in it. Both structs, both SELECTs and both scans
now carry it, with a Go case that fails when either column is dropped.

**AND `MatchWindow` DROPPED IT ON THE BRANCH THAT ACTUALLY RUNS.** A quote over
the window length returns a different tree — the slice around the match — and that
return had no `className`. The face appeared on short results and vanished on long
ones, which is worse than never appearing: the reader sees it work and cannot tell
what turned it off. The new case forces the long branch by length.

**THE FILM TABLE AND THE ANTHOLOGY** were simply missed. `Movies.jsx`'s table cell
draws `d.quote` raw, so the same line read in two faces between the frame view and
the table view; `.anthology-quote` named `var(--font-display)` and the entry
payload carried no language. Both fixed — and the film table's OTHER difference
from the book table next door (it does not go through `quoteTexts`, so it ignores
text-order too) is left alone and recorded, because that is one of the two boards
#171 exists to fold together.

### A fourth pass, at 8/10, and the surfaces counting kept missing

Three findings were more of the same seam, and the fourth is about the prose.

**THE IMPORT QUEUE, THE QUIZ ANSWER AND THE CAPTURE BOX.** A staged row already
carried its language (`import_staging.go` selects it and the row's own form edits
it), so an imported German highlight read in one face in the queue and another the
moment it was approved. The cloze answer is quote text sitting directly under
`QuoteBlock`, which had the face — one screen, two faces, on the same words. And
the capture textarea is the one place the app's own form would have contradicted
the setting while the reader typed into it.

**AND THE CHANGELOG HAD CALLED THE PREVIOUS FOUR "THE LAST".** That is the third
entry in this feature to claim a surface was covered when it was not. Counting is
what keeps failing, so the entry now NAMES the surfaces instead of totalling them
— a list can be checked against the code one line at a time, and a number cannot.

**THE LINE NUMBERS IN `fonts.js` WERE WRONG WITHIN TWO COMMITS.** They were added
to settle an earlier ambiguity about "three components", and a later rater found
every one off by seven. A line number in a comment is a fact with no guard on it:
nothing recompiles when it rots. They are gone, and the class name (`tp-lang-*`)
is named instead, because `grep` is never stale.

**AND TWO OF THE THREE DECK QUERIES WERE UNGUARDED.** `TestAReviewCard…` walked
`kindUtterance` only, so `bookCandidates` and `screenCandidates` could each have
their new column replaced with `''` with the suite still green — which the rater
demonstrated. Three queries, three cases now.

**ONE THING THE FIX ITSELF NEARLY BROKE**, caught by a build warning rather than a
test: adding `className={languageClass(…)}` to the capture textarea as a second
attribute does not merge with the first — it REPLACES it, so `tp-input` was
silently dropped and the box lost its appearance. esbuild warns about a duplicate
JSX attribute; nothing else would have.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
