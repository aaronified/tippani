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

**B3. Saying** — proverb. Structurally different from both: no speaker, and three registers
of the same sentence stacked rather than a quote plus a translation squeezed onto one line.

```
অতি সন্ন্যাসীতে গাজন নষ্ট
Ati sannyasite gajon nosto            ← transliteration (new field)
Too many ascetics ruin the festival   ← translation (exists)
                        Sylheti proverb
```

The reader's "similar to 'too many cooks spoil the broth'" goes in the **note**, per their
ruling — the note already renders under the quote on every card.

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
2. On a proverb, is the transliteration shown on the **card**, or only on the edit form and
   the recall card? Three lines is a tall card on a board of forty.
