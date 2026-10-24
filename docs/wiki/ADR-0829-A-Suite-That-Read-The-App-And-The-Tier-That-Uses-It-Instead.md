# ADR-0829: A suite that read the app, and the tier that uses it instead

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A feature shipped **100% dead**. The bulk season/episode control answered HTTP 400 on
every press and wrote nothing, and two tests stayed green through the whole of it: one
asserting the shape the client sends, one asserting the shape the server accepts, each
right about its own half, nothing comparing them, and neither ever pressing the button.

That is not a gap in coverage. It is a suite measuring the wrong thing, and the numbers
said so before anyone looked at a single test:

| | |
|---|---|
| vitest files reading SOURCE TEXT with regexes | **99 of 385** |
| jsdom tests mocking the network entirely | **128 of 235** |
| most-imported module in DOM tests | `ui.jsx`, in 56 files — components mounted by name |
| browser tests in CI | **0** |
| what `make test` ran | `go test ./...` — it did not run vitest at all |

**THE GO SIDE WAS LARGELY NOT THE PROBLEM,** which is worth saying because it shaped what
got rebuilt. About three-quarters of `internal/httpapi` already drives a real
`http.Handler` against a real SQLite file, and real journeys already lived there —
`TestQuotesRoundTripThroughMarkdown` goes create → export → upload → approve → verify;
`TestOwnershipIsolation` spans two users. Only about five Go tests regex over source. The
rot was in the frontend, so the frontend is where the new tier went.

**AND THE REPO ALREADY KNEW.** `Makefile:46`, of a source scanner: *"jsdom has no layout,
so the vitest suite cannot see this at all — `test/rules/screen-scroll-chain.test.js` guards
the stylesheet half, and this measures the result."* It kept both — the scanner that checks
the spelling and the probe that checks the result — and left the probe out of CI. The
diagnosis was written down years before the cure.

### The ruling

Tests act like human users. They do not know what the code is, except in justifiably
exceptional cases. A test may know the address it opens, what is on the screen, what a
person can do to it, and what the app shows or keeps afterwards; it may not know a
function's name, a module's path, a CSS class, a JSON field name, a Go type, or the text
of any source file. Exceptions are declared in the file's own header. *"It would be
slower"* is not a reason. The rule is in CLAUDE.md.

### Four tiers, and what each one is now for

`test/journeys/` is new and primary: a real browser, a real server, a real database, one
sentence a person would say. The Go API journeys stay exactly as they are — they were
already the good tier. `test/pure/` and `test/dom/` keep the cases where the function IS
the observable unit: a partial-date parser, an FTS escaper, a scheduler. And the source
scanners moved to `test/rules/`, out of `npm test` and into `npm run lint:rules` with its
own CI step — so a broken design rule still fails the build while a green test count stops
meaning "the app works".

**THE SCANNERS ARE NOT DELETED AND THE DISTINCTION MATTERS.** Never truncate a name,
spacing is a constant, no emoji glyphs, the typescale — every one of those is a real rule
this app is held to, and a ratchet that counts the remaining violations is the only thing
that has ever made those numbers fall. What they are not is evidence that the app works,
because the app can be entirely broken and every one of them still passes: none of them runs it.

### What the demotion actually found

The plan said "move the 99". Seventy-one moved in the first tranche; measuring the rest
turned up something the plan had not anticipated. Of the 29 files in `test/dom` that read
source text, **25 also render** — they are hybrids, not scanners, and of the four that do
not render, three still need a DOM for another reason (two read `getComputedStyle` after
`applyTheme`, one drives real history). So the dom tier has essentially no pure scanners
left to demote. `test/pure` had nine, of which seven moved; the two that stayed
(`quote-texts`, `archive-header`) are hybrids of the same kind — they exercise a real
parser AND scan a file, and the scanning half would have to be split out rather than moved.

**ONE OF THE SEVEN IS AN AWKWARD CASE AND IS RECORDED AS SUCH.**
`bulk-wire-shape.test.js` reads the Go struct's json tags and the client's field table and
fails when they disagree. It is a scanner by mechanism and a contract by job — and it is
the guard that would have caught the 400 this whole plan is named after. It moved, because
`lint:rules` runs in CI as its own step so nothing is lost by it, and because the behaviour
it stood in for now has a journey that presses the actual button. A contract lint and a
test of the feature are different things, and the app is better off with both.

### The acceptance test, and the commit the plan named wrongly

The plan committed in advance to one check: revert the wire fix in a scratch tree and the
bulk season/episode journey must go red. If it came back green, the plan had failed.

It was run, in a detached worktree outside the repo, with the SPA rebuilt after the
revert (confirmed: zero occurrences of `wire:"text"` in the rebuilt bundle):

```
fix in   -> 1 passed   (17.3s)
fix out  -> 1 failed   (38.7s)  see('S2') waited its timeout; the six lines unchanged
```

**THE PLAN NAMED THE WRONG COMMIT.** It says "revert `216c4865`'s wire fix". `216c4865`
is the SERVER-side `showPairProblem` validation that landed the same morning. The wire fix
is `eb90a28b` — `wire: 'text'` on chapter_no/season/episode plus `asText` in
`bulkFieldBody`. `git log -S"wire: 'text'" -- web/frontend/src/bulkOps.jsx` is what settles
it, and a plan that names a commit should be checked against the log before it is acted on.

**A 400 CAPTURED MID-DIAGNOSIS WAS NOT A LIVE DEFECT, AND THE THEORY IT LED TO WAS WRONG.**
`POST /api/dialogues/bulk -> 400 body={"ids":[…],"season":2}` was real output, from a build
that predated the rebuild. It sent this session chasing a hypothesis that the bundle held
two `key:"season"` specs and the panel was reading the wrong one. It does hold two — the
second is `workKinds.js`'s single-record form spec — but `bulkOps.jsx` never imports
`workKinds`, `bulkFieldsFor` reads `BULK_QUOTE_FIELDS`, and that table's season carries
`wire: 'text'` in the source and in the shipped bundle. Captured output is evidence about
the build it came from and nothing else.

### What the journeys caught about themselves

The tier's first day is the argument for mutation-verifying every file in it, because four
of its own journeys were vacuous or wrong and every one of them was green when written.

One passed with its `press('Library')` deleted — Moby-Dick was on Home too. One asserted a
search result that Home's own shuffle produced without the search. One agent-written file
was a debugging probe wearing a test's clothes: every press in a `try`, an `it('probe')`,
console.log throughout, incapable of failing. And one asserted the practice card's question
exactly as `en.txt` spells it — "Where is this from?" — and could not find it, because
`.mono-label` carries `text-transform: uppercase` and `innerText` reports text as RENDERED.
The screen was shouting WHERE IS THIS FROM? and the journey printed a screen dump with the
words plainly on it. That one was recorded in a commit as a possible accessibility defect —
"the field appears to carry no accessible name at all" — which was false, and is the
clearest case in this file of a conclusion drawn from a failure message instead of from the
screen.

So: `see`, `gone` and `pick` all fold case now, and every journey in the directory has been
mutation-verified by deleting its decisive action and watching it go red. The mutation is
named in the commit that added the journey.

### Two harness gaps the work exposed

**A MODAL TAKES THE SCREEN.** Pressing Export on a board opens a confirm dialog whose own
button is also called Export; both matched, `press` refused the ambiguity as it should, and
the only ways forward were to name a class or to guess. A reader has no such problem —
there is one Export in front of them. `press`, `type` and `upload` now see only inside the
topmost open `[role="dialog"][aria-modal="true"]`, which is ARIA's own rule about what a
modal removes from the tree, and is what a scrim means. `see` deliberately does not scope:
a scrim dims what is behind it, it does not delete it.

**AN EXPORT IS A FILE, AND A FILE IS THE ONLY HONEST THING TO ASSERT ON.** The app's
exports go out through a blob and a synthetic `<a download>`, so there is no navigation to
intercept and no response to read off the wire. The world now sets Chrome's download
directory over CDP and `app.downloaded(name)` waits for the file and hands back its text —
which caught, on its first run, that the export the reader receives is 257KB of real
Markdown rather than the empty shell a "your library was exported" toast would equally
happily announce.

### The sixteen, and what reviewing them found

The spine, one file each, all mutation-verified by deleting the decisive action and
watching the file go red:

| | the sentence it performs |
|---|---|
| `signing-in` | a reader who signs in is inside the app, not still at the door |
| `onboarding` | the founder of a brand-new instance ends up signed in, not back at the login form |
| `finding-a-book` | a reader opens their library and finds a book Home was not showing |
| `searching-and-finding` | a phrase from a highlight is searched for, and the result names the book |
| `capturing-a-highlight` | a line typed on a book is still there after a reload |
| `capturing-a-film-line` | a line AND its character, on a show, still there after a reload |
| `capturing-a-standalone-quote` | a quote that came from no book and no film is filed on its own |
| `editing-a-quote` | the new wording is there and the old wording is gone |
| `bulk-season-and-episode` | the season is set on six lines at once, and it survives a reload |
| `reviewing-a-card` | a practice card is revealed and graded, and the app says "recalled" |
| `importing-a-file` | a file is imported, and nothing reaches the library until it is approved |
| `importing-other-formats` | a Kindle's own clippings, a Bookcision export and a Readest export are each read |
| `exporting-a-library` | the file the reader is handed actually holds their books |
| `changing-a-setting` | the interface language changes, and survives a reload |
| `per-user-isolation` | a second account sees an empty notebook, and the first gets its own back |
| `working-with-no-internet` | a work added by hand saves and stays, with outbound calls off |
| `harness-vocabulary` | the vocabulary's own guarantees, which nothing else checks |

`npm run journeys`: 17 files, 23 tests, 53 seconds.

**AND THE REVIEW OF THEM FOUND THE WORST DEFECT IN THE SET, IN THE ONE FILE THAT
COULD LEAST AFFORD IT.** `bulk-season-and-episode` — the acceptance test of this
whole plan, written against a feature that shipped 100% dead because the server
wrote nothing — pressed Apply and then asserted `see('S2')` against the very render
the press had produced. Every sibling reloads to rule out exactly that; the one
journey whose entire stated purpose is to catch an optimistic-UI write that never
lands was the one that skipped the check. It reloads now, and the acceptance test
was re-run against the strengthened file: with `eb90a28b` reverted and the SPA
rebuilt it is red at the first `see('S2')`, and the reload assertion never runs at
all.

Three smaller findings from the same pass, all acted on. `harness-vocabulary` was
the only file with no `pageErrors()` check, so four blocks that drive the real app
could have passed over a screen that threw on mount. `per-user-isolation` read
`process.env.TIPPANI_JOURNEY_PASS` at the call site — the variable's name is the
harness's business, and a journey that spells it knows one thing too many about how
its world was built, so the account moved onto the world handle. And the list of
"stable names a journey may pin" was stated too narrowly: the four real
books keep their TITLE AND AUTHOR through the curator, so `Jacob Grimm` is
exactly as safe as `Grimm's Fairy Stories`; it is the 23 derived works whose
invented titles and invented people regenerate.

### Two defects the browser tier found in its first day

**BOTH ARE FIXED NOW, IN `be3f3717`, AND THIS PARAGRAPH USED TO SAY THEY WERE NOT.**
It said "neither is fixed here — both are outside this plan and both are recorded
with the evidence rather than quietly patched", which was true of the commit that
wrote it and false the moment the owner read the list and said to fix them. Leaving
it standing would have made this document assert, in the present tense, that a
shipped fix had not shipped. The original judgement still holds and is why the
defects are written up here at all: a browser tier's first job is to find things,
and a finding recorded with its evidence is worth more than a finding quietly
patched into an unrelated commit. What follows is each defect as the journeys found
it, then what the fix turned out to be.

**A character typed into the capture form and not committed with Enter is silently
lost on Save.** Verified by mutation: remove the one `pressKey('Enter')` and the
name never appears, on the screen or after a reload. `TokenInput`'s own `onBlur`
exists to prevent this and says so in a comment; it fires and the value still does
not arrive. The diagnosis that fits every fact — including why the quote survives
and the character does not — is that `saveState.save()` is a closure registered by
an effect that has not re-run in the microseconds between the blur-commit and the
click.

THE DIAGNOSIS WAS RIGHT AND THE REPAIR WAS ONE LINE OF IT. `AddSurface.jsx` kept a
`draftRef` that every render wrote, and `save()` read the draft out of that ref
rather than out of the closure it was registered with — the same shape `usePanelStack`
already uses for a handler registered once and called later. `whatIsMissing(d)` came
out of the same change: the validity message was computed from the closure's draft
too, so a form that had just gained its last required field could still refuse to
save. Mutation-verified by reverting the ref and rebuilding the SPA: the journey's
quick path goes red waiting for the character's name, while the careful path — which
presses Enter — stays green, which is exactly the asymmetry the defect predicts.

**THE REF IS OF THE VERB NOW, NOT OF THE DRAFT, because the effect around it cost a
letter.** The effect that handed `save` up to the title bar re-ran on every change to
the draft, with or without `draftRef`, so every letter typed was two renders: the
keystroke's, and the surface's own from the new save state, queued for a turn of
React's. React counts a render that ends with another still waiting as a nested
update, and past fifty it throws error #185, "Maximum update depth exceeded", out of
the next keystroke's own setState, losing that letter. On CI run 36442773656, 3.1.0's
main, the film line was saved as "put hal of them out" and the second case failed on
the thrown error: the lost letter is the 52nd, which is where that count runs out when
the browser hands the page fifty-one keystrokes in a row without giving React its turn.
`AddSurface.jsx` is unchanged since 3.0.4, and 3.0.4's shipped build loses the same
letters under the same typing. The effect now re-runs only when what the bar shows
changes — whether it can save, whether it is busy, why not, and the door — and the
bar holds one stable function that runs the latest render's `save` through a ref
written during render. That covers the blur-then-click order above without
`draftRef`, and `save()` reads its own render's draft. The quick path's mutation is
now to hand the bar the render's own `save`, re-published with every change to the
draft; `typing-a-line-faster-than-the-page-draws.journey.mjs` types a 150-letter
line without giving React a turn, and fails two letters short on the old effect.

**THE SAME SHAPE WAS ONE SCREEN OVER, in the sheet a work's Details open for its
description.** The sheet tells the panel around it how many things are unsaved, and
its effect re-ran on every letter: nought from the cleanup, then one again, which is
the same second update left waiting for React's turn. The same burst lost the same two
letters there with the capture form already fixed, and on 3.0.4's shipped build; the
effect is the same at 3.0.0. It now works out whether the text differs from what is stored
during the render and hands the panel only that, so the count changes on the first
letter and when the text is typed back, the way the identity form's count and every
inline row's registration already did. The burst journey's second case types into it.

**Two password boxes on the Profile screen compute to the same accessible name.**
"new password (8–20)" under CHANGE PASSWORD and "new password (8–20)" under Add
user, confirmed as two backendNodeIds with one name. A screen-reader user hears the
same label for "change my own password" and "set the password on an account I am
creating", one of which is destructive to their own login. It is also why
`per-user-isolation` carries the only use of the `app.page` escape hatch in the
whole directory: the journey could not name the field, so it names the unambiguous
one, presses Tab, and types into what then has focus. Fixing the name removes the
escape hatch with it.

FIXED BY GIVING THE ADD-USER BOX ITS OWN KEY rather than by renaming the profile one.
`account.users.add.password.placeholder` — "password for the new account ({min}–{max})"
— says whose password it sets, which is the fact a listener needed and the reason the
two were indistinguishable. Reusing `account.password.new.placeholder` across both was
the original defect and not a shortcut worth keeping: one string cannot answer two
questions.

### What the round trip proved, in both directions

The owner asked for import files built from the four kept books, and for
the export routes to be checked with them. Both halves are in, and the format was
established from the app rather than guessed: press Export on the Library, read the
bytes back through `app.downloaded`, and build the fixture to match what came out.

  the app's own 257KB export, re-imported   ->  629 quotes staged, every book
                                                matched to its existing counterpart
  a two-quote fixture in the same shape     ->  2 quotes staged, "joins your
                                                existing On the Shortness of Life"

`fixture/imports/seneca-two-more.md` is two lines filed under *On the Shortness of Life*,
deliberately two lines this fixture's copy of that book does NOT already hold — so "the
quote arrived" is a fact about the import rather than about what was already there.
They are invented prose written for the fixture; until 3.1.0 they were two lines of
Seneca of unrecorded source (see below).

**AND "ROUTES" IS PLURAL, WHICH THE FIRST PASS OF THIS WORK QUIETLY MADE SINGULAR.**
A rater caught it: one file, one format, against an app that reads eight. Three more
fixtures now sit beside it, each carrying one line from this fixture's own copy of one
of the four real books, and each shaped from the importer's own testdata rather than
from memory — a Kindle's `My Clippings.txt` (Grimm, with the CRLF line endings a real
device writes), a Bookcision export (Dostoyevsky), and a Readest annotation export
(Bhagat Singh). The Grimm and Dostoyevsky lines are real and checked against Project
Gutenberg; the Bhagat Singh line is the invented prose that stands in that highlight's
place since 3.1.0. All three are read correctly: the app names the book each belongs
to and shows the parsed line on the queue.

**WHAT THOSE THREE ASSERT, AND WHERE THE LINE IS DRAWN.** The whole of a route is
"the app read this file and understood it" — which book, and what the line says —
and both are on the staging screen before anything is approved. Approving is proven
end to end ONCE, in `importing-a-file`, because repeating it three times would be
three copies of one check rather than three routes. What is NOT covered, and is
said here rather than left to be discovered: the four HTML routes (Goodreads,
Hardcover, IMDb, the saved Kindle notebook) have Go parser tests and no journey.
They need a saved page of real markup to be honest about, which is a fixture
question rather than a test-writing one.

### The four real titles keep only the lines checked against a public-domain text (3.1.0)

**The ruling.** The curator kept four real books verbatim at the owner's call, and at
3.0.4 it came out that only one of them had been checked. The owner, asked what the
public repo should keep: *"Swap unverified lines for invented prose"*. So the four keep
their titles and authors, which is what the journeys name, and a line only where it has
been found word for word in a public-domain text.

**What was checked, and how.** Each highlight was looked for in a Project Gutenberg text,
with both sides lowercased and every run of anything but a letter or a digit folded to
one space, so a curly quote or a dash is no reason to miss and a changed word is.

| | highlights | found | in |
|---|---|---|---|
| The Idiot | 22 | 11 | Eva Martin's 1915 translation, #2638 — the count `a09f2527` recorded, checked again |
| Grimm's Fairy Stories | 1 | 1 | #11027, which carries the archive's spelling of the title ("Hansel and Grethel") |
| On the Shortness of Life | 5 | 0 | not Aubrey Stewart's 1889 translation (#64576); its translator is unknown |
| Why I Am An Atheist | 6 | — | nothing checked |

So 12 real lines stay and 22 are invented: 11 of The Idiot, 5 of Seneca, 6 of Bhagat
Singh. The Grimm line was not checked when the ruling was made, and is kept because it
has been now. The import sample's two Seneca lines are invented too, and the Readest
sample carries the fixture's new Bhagat Singh line in place of the old one, so it still
holds a line the fixture holds.

**Written, not generated.** Every other book's lines are `inventProse`'s word salad.
These four are the books the journeys open by name, so their lines are the ones on
screen: each unchecked one became a passage written for the fixture, of about its length
and its kind — dialogue with its curly quotes where the highlight was dialogue, a
lowercase start where it began mid-sentence, the stray PDF hyphen where it had one. None
is a quotation, and none paraphrases the line it replaces. Rejected: generated prose here
too, which works, and turns the books a journey photographs into rows of nouns with no
quote marks or dashes left in them. The curator finds each passage by a hash of the
original line, so the repo does not keep the line it replaces. A highlight with no
passage, one the owner adds or edits later, falls back to generated prose, and the
summary names it by hash and location.

**The refusal covers them now.** The curator's leak check skipped the four books
entirely, so an unchecked line could have survived a re-run with nothing to say so.
Every unchecked line of theirs over 20 characters is now on its must-be-gone list, and
so are the owner's notes on those books.

**The curator ran against the archive, and the fixture took only the lines.** The
archive has moved since the fixture was curated: 12 more standalone quotes on the boards,
17 more highlights and one more film line on invented works, edits to several others, one
of Bhagat Singh's highlights rewritten and given a chapter, and three of his recoloured.
A wholesale re-run would also drop the Solitude/Solitide tag pair the fixture carries on
purpose (see the tag vocabulary section). The curator's rule is that a person reads its
output before any of it is committed, and the new board quotes have had no such reading.
So the changed curator was run against the archive (the refusal passed, and no line fell
back to generated prose), and the committed fixture took from its output the 22 new lines
of the four real titles and its note, and nothing else. A wholesale regeneration is the
owner's call.

**One journey searched a line that is gone.** `searching-and-finding` typed "roubles",
from one of the eleven unchecked Idiot lines. It types "Epanchin" now, from a checked one.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
