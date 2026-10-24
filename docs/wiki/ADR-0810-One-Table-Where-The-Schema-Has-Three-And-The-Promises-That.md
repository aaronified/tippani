# ADR-0810: One table where the schema has three, and the promises that rested on it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The 6/10 rater pass on `3317422a..98f3dd5a` found it and a scratch probe confirmed it:
`/search/vocabulary`'s `languages` read `utterances` alone, while `0071` put `language`
on `annotations` and `dialogues` too — under the ask it quotes in its own header, *"why
is language hard dropped? it is needed everywhere"*.

**A missing suggestion would have been the small version of this.** Three shipped
promises rested on that list and all three were false for a library of book highlights:

| What said it | What it said | What happened |
|---|---|---|
| `suggest.jsx`'s `LanguageCombo` | "the library's own languages lead, and the order is load-bearing" | the box opened on English, Spanish, French |
| `boards.jsx`'s chip row | "the languages their library is already in" | no chips at all |
| `settings.languages.remove.in-use.tip` | it refuses while rows still use it | a live red ✕ beside a language the library is full of |

The third is the one that matters: #81's whole subject is that a language in use cannot
be removed, and it was enforced against a list that could not see two of the three
places a language is stored.

**`id` CANNOT SPAN THREE TABLES, which is what the fix had to solve.** The fold keeps
the first spelling written and `98f3dd5a` expressed "first" as `MIN(id)` — exact inside
one table and meaningless across three, whose sequences are independent. `created_at` is
comparable everywhere, so the order is `MIN(created_at), MIN(id)`: the second term
breaks a same-second tie, exactly within a table and arbitrarily-but-stably across them.
Which of two spellings entered in the same second wins is not a question with a right
answer, only one that must have the same answer every time.

**AND THE CHANGELOG HAD SHIPPED A CLAIM THE CODE DID NOT KEEP.** It said the language
box suggests on "a highlight, a film line, a standalone quote, the capture card, an
imported row **and a work**"; `WorkDetails.jsx` had no `LanguageCombo` at all, and the
commit's own body said so. The repair was to ship the work rows rather than to soften
the sentence — a changelog is the one document a reader checks a feature against, and
correcting it downwards teaches them to check something else. `bulkOps.jsx`'s language
field went with them, because a bulk edit is where a spelling matters most: forty rows
take whatever is typed, so one careless capital makes two languages in one press.

Two counts in comments went the same way and are now rules instead of numbers —
`boards.jsx` said "the other six language fields" when there were five. A count in a
comment cannot be checked from where it is written and goes stale on the next commit.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
