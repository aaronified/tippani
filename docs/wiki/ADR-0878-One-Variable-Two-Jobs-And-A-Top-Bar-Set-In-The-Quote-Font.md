# ADR-0878: One variable, two jobs, and a top bar set in the quote font

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, on their own phone: *"Why is there still a quote font? This has to be through the
quote fonts section. And the interface font is atkinson hyperlegible next. Why is the top bar
using newsreader, which is set as the quote font."*

**THOSE ARE NOT TWO REPORTS.** `--font-display` was one custom property doing two jobs under
one of their names. It was read by the reader's quote text as its fallback, and by
twenty-nine chrome sites: the top bar title, every page header, the panel titles, the section
headings, the wordmark, the search box. The only control that wrote it was a row in **Interface
faces** labelled **Quotes**. So the screen offered no way to set a quote face without also
setting the app's title face, and no way to set the app's title face at all — and the row that
did both was filed under the group whose heading says it is about the interface.

**A READER WHO SETS THEIR QUOTES IN A SERIF IS NOT ASKING FOR A SERIF TOP BAR.** That is the
whole fault, and it is visible only to somebody who has set the two roles to different faces
and then looked at a heading. Every one of those sites rendered; the variable resolved; the
suites were green. There was no state any unit test was in from which it could be seen.

**THE SPLIT IS CHROME VERSUS CONTENT, AND IT IS NOT AN ARBITRARY LINE.** Chrome is what you
press — the top bar, headings, panel titles, the wordmark, the search field, the counts on
Home. It reads `--font-ui`, because that is the face the reader chose for pressing things.
Content is the reader's own words and the names of their works — quotes, translations, the
share card, a book's title in a list, a character's name, a binned record's label. It reads
`--font-quote-base`. A work's title is content: it belongs to the book, not to the app drawing
a list of them.

**THE VARIABLE WAS RENAMED, NOT ALIASED.** `--font-quote-base` says the job it does. There is
deliberately nothing left answering to the old name, because an alias is how two jobs get
merged again the first time somebody reaches for a title face and finds something that
resolves. `test/rules/chrome-is-not-a-quote.test.js` fails on the old name appearing in any
source — including in a comment, since a comment naming a dead variable is how the next reader
learns the wrong model — and on any new `--font-title`/`--font-heading` alias being defined.

**THE STORED PREFERENCE KEEPS ITS NAME.** The role's key is still `display` and the stored
field is still `fontDisplay`. Renaming it would silently reset the quote face of every reader
who has set one: a rename in the database to fix a rename in the stylesheet. The VARIABLE was
what lied, so the variable is what changed.

**AND THE ROW WENT WHERE ITS QUESTION IS ASKED** — the head of the per-language quote table,
as the answer every language falls back to, labelled "Every language". A per-language table
with no default could only answer "what is my German set in", never "what are my quotes set
in", and the answer to the second used to live two groups up under a heading about the
interface. It is drawn by `fontRow`, the same function every other face row uses, and handed
in from `FontSections` rather than looked up inside `QuoteFaces`: one preferences object, one
writer, and no second place a face is chosen.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
