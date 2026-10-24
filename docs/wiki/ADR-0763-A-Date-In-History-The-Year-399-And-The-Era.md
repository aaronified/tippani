# ADR-0763: A date in history: the year 399, and the era

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

**The report.** "i am unable to add 399BCE as a date now. this is weird. i cannot even add
just 399. this was fine before. i have Seneca's quotes from c. 40."

**NOT A REGRESSION, and establishing that was the first thing worth doing.** The word "now"
pointed at the circa work that had just landed on this field, and it was the wrong place to
look. `git log -S 'y < 1000 || y > 3000'` puts the bound in `e0fecf63` on 2026-08-04 —
the commit that built the shelf and the partial date with it — on both halves of the app at
once. The quote's date box has never taken a year below 1000 and has never had a spelling
for BCE. What the reader remembered working is a different field: a WORK's year, which took
`380 BCE` from `ancient_years_test.go`'s release and whose own test names the Analects and
Gilgamesh. So the app could record when the Meditations was WRITTEN and not when a line in
it was SAID, and one of those two boxes sits directly above the other on a work's screen.

**THREE THINGS WERE STOPPING IT and only one was the validator**, which is why reading the
field rather than the error message mattered. `isPartialDate` demanded `\d{4}` and a year
past 1000. The input carried `inputMode="numeric"`, so a phone offered a keypad with no
letters on it. And its `onChange` ran `raw.replace(/[^\d-]/g, '')`, so a letter that arrived
anyway was deleted as it landed. Fixing the validator alone would have produced a field that
accepted `399 BCE` and could not be typed into.

**THE WINDOW IS NOT AN OVERSIGHT, so it did not move.** It is deliberate for a date about
the READING — a book finished in the year 40 is a typo, and catching it is the whole purpose
of a bound — and it lifts only for the two facts that are about the world: when a line was
said, and when a person lived. So there are two validators over one body,
`normalizePartialDate` and `normalizeHistoricalDate`, and the test that matters asserts the
DIFFERENCE: the same string, taken by one and refused by the other. Two functions sharing a
body is exactly the shape that drifts into one behaviour by accident.

**THE COLUMN'S FORMAT WAS ALREADY DECIDED, twenty files away.** `timelineYears` reads
`substr(occasion_date, 1, 5)` and its comment explains why five and not four: "a BCE year
carries a leading '-' and '-380' needs five characters". The stats timeline had been able to
read a BCE occasion since it was written; nothing had ever been able to store one. So the
format is not invented here — a four-digit zero-padded year with a leading `-` — and the
padding is load-bearing rather than cosmetic: the column is compared as text in two places
and grouped as text in a third.

**THE BOX HOLDS THE PHRASE AND THE COLUMN HOLDS THE CANONICAL FORM,** the same split
`parseYearInput`/`yearInputValue` already draw one field over. The alternative — normalising
as the reader types — makes the era unspellable: you cannot type B, then C, then E into a
field that reformats after each keystroke. So a historical field does not strip at all, and
garbage takes the red edge that `YearField` already uses for the same reason.

**ONE ORDERING BUG THE PADDING CREATES, and it is not fixable by padding.** A minus sign
reverses the order it prefixes, so `-0040` sorts before `-0399` as text and 40 BCE reads as
earlier than 399 BCE. The Quotes screen's "said" sort compares the year as a NUMBER now and
falls back to text for the month and day, where the padding does do the work.

**MY OWN TEST FOUND A SECOND BUG, in code I had not touched.** `399BCE` written without a
space was rejected — and the reader's report spells it exactly that way. Both parsers matched
the era with `/\s*\b(b\.?\s*c\.?…)/`, and `\b` needs a word/non-word transition, which there
is none of between `9` and `B`. So `380BCE` in a book's year box had been silently read as
`380` since the era work shipped: wrong by 760 years, in the wrong direction, with nothing on
screen to show it.

**AND THE FLAG WAS WRITE-ONLY.** `occasion_circa` was stored, exported and imported for a
release and read by no screen at all — not the quote card, not a search hit, not a recall
card. A reader who ticked "the date is approximate" got no sign back that the app had heard
them. It rides with the date on all three payloads now, and `formatPartialDate` takes it as
an argument rather than reading it off the digits, because on a quote it is a separate column
and the reader's own judgement.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
