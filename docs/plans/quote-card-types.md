# Types of quote card

> **Not queued.** This is a proposal written to the owner's request ("think and propose
> solutions for type of quote card"), and no part of it is built. It is in `docs/plans/`
> so it survives a session, not because it has been scheduled. The roadmap sweep should
> leave it alone until the owner picks a shape.

## The report

> Quote cards need better formatting (e.g. letter to carl seelig).

An Einstein letter, filled in the way the app asks for it, draws this today:

```
Albert Einstein · Letter to Carl Seelig · 11 March 1952 · Zurich · Letter · English
```

"Letter" twice — and the repo's own directive says **a row says a thing once**. But the
duplicate is the symptom, and the two faults under it are worse.

### Fault 1 — the strip is a concatenation, not a sentence

`utteranceMeta` builds one `·`-joined list of whatever happens to be non-empty:

```js
const rest = [u.occasion, formatPartialDate(u.occasion_date, u.occasion_circa),
              u.place, quoteKindMeta(u), u.language].filter(Boolean)
```

Nothing in it knows that "Letter" and "to Carl Seelig" are one fact and not two. So the
reader compensates by typing the whole phrase into *Occasion*, and the kind chip then says
it again on its own. The interface taught them to duplicate and then punished them for it.

### Fault 2 — four fields are captured and never shown

0047 gave a quote `region`, `recipient`, `work_title` and `locator` — a proverb's region, a
letter's recipient, an essay's source and page. The edit form asks for all four. The capture
card asks for all four. **The card draws none of them.** So the correct place to put "Carl
Seelig" is a box whose contents never appear anywhere, which is why the occasion box gets
used instead.

That is the whole of the report, and it is not a styling problem.

## The proposal, in two parts

### Part A — the kind is the verb of the attribution, not a chip beside it

One function, `attribution(u)`, composes the line per kind instead of concatenating. The
kind stops being an item in the list and becomes the shape of the phrase:

| Kind | Phrase | Reads |
|---|---|---|
| `letter` | `Letter to {recipient}` | Letter to Carl Seelig |
| `speech` | `{occasion}, {place}` — kind implied by the shape | Nobel banquet, Stockholm |
| `essay` | `{work_title}, {locator}` | *Why Socialism?*, p. 3 |
| `poem` | `from {work_title}` | from *Gitanjali* |
| `song` | `{work_title}` | Blowin' in the Wind |
| `proverb` | `{region} proverb` | Sylheti proverb |
| `other`, unset | today's strip, unchanged | — |

The kind's own word is printed **only when nothing else in the phrase implies it** — an
untitled letter with no recipient still says "Letter". That is the rule that removes the
duplicate without removing the information.

Einstein becomes:

```
Albert Einstein · Letter to Carl Seelig · Zurich · 11 March 1952
```

Part A is needed whichever body shape you pick below, and it is the smaller half.

### Part B — three card bodies, not one

Today every quote is one block of text with a line under it. Three kinds are not that shape.

**B1. Attributed** — speech, letter, essay, other, and every book highlight and film line.
Today's card, with Part A's line. No change beyond the line.

**B2. Verse** — poem and song. The text keeps its line breaks and stanza spacing instead of
reflowing as prose, and the source line sits under it like a citation. Today a poem entered
with line breaks is displayed as a paragraph, which destroys the one thing that makes it a
poem. *(This is also the "song and poem have not been optimised" note.)*

**B3. Saying** — proverb. Structurally different from both: **no speaker**, and the two
registers of the same sentence stacked rather than a quote and a translation squeezed onto
one line.

```
অতি সন্ন্যাসীতে গাজন নষ্ট
Too many ascetics ruin the festival   ← translation (exists)
                        Sylheti proverb
```

**IT WAS THREE REGISTERS WHEN THIS WAS WRITTEN.** The middle line was a romanisation, in a
`transliteration` column added by 0069 — and the owner has since withdrawn both the field
and the column (0072, and `PLAN.md` records why). A romanisation still has somewhere to go:
their own instruction is *"it can be in notes if user wants it"*, and the note already
renders under the quote on every card. So does the reader's "similar to 'too many cooks
spoil the broth'", per their earlier ruling — which means on a proverb the note is doing
two jobs, and that is the reader's call to make per quote rather than the card's to
enforce.

## What I recommend

**Part A plus B3, and B2 with it if poem/song are being touched anyway.**

Part A is not really a design choice — it is the fix for a directive violation and for four
invisible fields, and every option needs it. B3 is the one the report is actually about: a
proverb is the only kind with no speaker, and it is the kind this library holds most of. B2
is cheap once B3 has established that a card body varies by kind, and it closes the
poem/song gap in the same pass.

**The primary downside:** three body shapes means three things to keep in step, and the app
already has quote cards drawn on the Quotes board, in search hits, in the recall popup, in
the share image and on a work's page. Part B must therefore land as **one component the five
surfaces call**, not five copies — the repo's rule about two things that look the same, and
the reason `utteranceMeta` was centralised in the first place. If that discipline is not
held, B2 and B3 will drift and the share image will keep drawing a proverb as a speech.

## Open, and cheap to answer

1. Should the **share image** get the three shapes too, or stay one shape? (It draws a
   speaker face and has no room for a third register.)
2. ~~On a proverb, is the transliteration shown on the card?~~ **Answered by deletion.**
   The field is gone (0072), so a proverb's card is two registers and the tall-card worry
   with it. What remains of the question is whether the **note** — which is where a
   romanisation now lives — should draw above or below the translation on a saying.

---

# The owner's corrections, and the principle behind them

Given after the first draft, and they change the recommendation rather than refine it. The
governing sentence, which decides every case below:

> **"show as little is needed to convey the important stuff about the quote"**

That is not a style note. It settles the question this draft could not: whether a fuller
attribution is worth a new column. It is not — the card composes what it *has*, and a
shape that needs a column the reader would have to fill twice is a shape that does not
earn its place.

## The five attribution shapes, corrected

| Kind | Shape | Was |
| :-- | :-- | :-- |
| **Essay** | `"{work_title}", {locator}` | `{work_title}, {locator}` — the title now wears quotation marks, which is how an essay inside a collection is cited everywhere else |
| **Poem** | `{poem_name} from {work_title}` when both are known; `from {work_title}` or `{poem_name}` when only one is | one shape, `from {work_title}` |
| **Song** | the same three shapes as a poem | not distinguished from a poem |
| **Proverb** | `{language} proverb` | `{region} proverb` |
| Speech / Letter | unchanged — `{occasion}, {place}` and `Letter to {recipient}` | — |

## Where a poem's own name lives, and the decision that makes it work

**A poem quoted out of a book puts the poem's name in the chapter-name field.** The owner's,
and it is the decision that makes the three-shape rule reachable without a new column:

- Added as a **book highlight**: the book row is the collection and `chapter` is the poem.
  So the card has both halves and draws `{chapter} from {book title}` — shape one.
- Added as a **standalone poem or song**: there is one title box, and the card draws whichever
  shape the values support.

**This is worth stating because a reader will find it surprising.** "Chapter" over a box
holding *Sonar Tori* reads oddly for a moment — and it is right, because a poem in a
collection IS a chapter of it as far as the locator model is concerned: `annotations` already
splits a chapter into a number and a name (0044), and a numbered poem in a numbered
collection is exactly that pair. The alternative was a `piece_title` column duplicating
`chapter` for one kind of book, which the principle above rules out.

**A song's title box is labelled `Book / Movie / Album`** — the owner's exact words. A song
reaches a reader through any of the three, and one label naming all three is honest where
`Album` alone would be wrong for a film song and `Source` would be wrong for everything.

## Dates

- **Poem and song: the date is not important.** It stays reachable and sits behind *Show all
  fields* — which is where `addFields.js` already puts it, so no change is needed.
- **A proverb has no date at all.** Hard dropped, which `addFields.js` also already does:
  `showsField('proverb', 'when')` is false, alongside speaker, occasion, place and recipient.

Both are recorded here rather than left implicit, because the field table and the card
composition have to agree: a card that drew a date for a proverb would be drawing a field
the form refuses to collect.

## The consequence for `{language} proverb`, and it needs the owner's eye

The proverb card's attribution is now **the language**, and the owner has also ruled that on
the proverb form the language sits **behind *Show all fields*** (the global: "language … it
should be everywhere, behind show all").

Those two together mean **the one line the card prints about a proverb comes from a box the
reader has to open a disclosure to fill.** A proverb saved without opening it draws no
attribution at all. Three ways out, in order of how much they cost:

1. **Language comes out from behind the disclosure on the proverb door only** — one entry in
   the field table, and it is the kind the owner's own measurement showed at 100% filled.
2. Leave it, and let a proverb with no language draw no attribution line.
3. Default the language from the board's own `languages` list (0037 stores one per proverb
   board, exactly so the form can offer it), so the box is pre-filled rather than promoted.

**Recommendation: 3, falling back to 1.** A proverb board already knows its languages and
that is what 0037 stored them for — so the commonest case needs no box at all, and the
disclosure holds the exception. The primary downside: a board with several languages cannot
guess which, so the box is pre-filled only when the board names exactly one.

**Region survives as a field and stops being the attribution.** The owner moved it behind
the disclosure and the card no longer prints it, which leaves it as what it always was: a
narrowing on top of the language — a Sylheti proverb is a Bengali proverb from somewhere in
particular, and the card has room for the general fact only.
