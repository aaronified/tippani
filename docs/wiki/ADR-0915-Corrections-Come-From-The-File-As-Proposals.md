# ADR-0915: Corrections come from the file, as proposals

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Where the file's own words differ from a saved quote, **Checks > Corrections** proposes the file's version. `GET /corrections`
lists, `POST /corrections/accept` and `POST /corrections/ignore` answer (`internal/httpapi/corrections*.go`). Nothing is written
until it is accepted.

**The app names the difference and the reader decides which side is right.** Every difference is shown, in a bucket named for
what happened: spacing, punctuation, capitalisation, accents, several marks, extend, trim, one word, few words, wording. A
bucket is one kind of thing, so a press on the whole bucket is an informed one; a row can also be taken alone. An earlier idea
was to hide a class the file seemed to have degraded (a quote with accents against a subtitle without). That decides for the
reader, and it hides the most useful row in the list, which is that their quote is better than the file. Nothing is hidden.

**The file's words are already stored.** The context row holds the file's own text for the span ([ADR-0906](ADR-0906-Context-Is-Read-Once-And-Stored.md)),
so a correction can be proposed after a prune, on an unplugged mount, and with no file at all.

**A dismissal is remembered across rescans**, so a library the reader has been through once does not ask again. A quote
**edited since it arrived** is skipped and counted, because the edit was deliberate and a correction to it is the likeliest false
positive; the count says how many were left alone.

**Not built.** Ambiguous matches get no proposal: a quote found in several places has no stored context, so there is nothing to
compare. No **undo** for an accepted correction (Cleanup has none either). No per-file "skip the mark buckets", and no note about
the file itself ("this subtitle has no accented letters at all").

**Rejected.** Fixing quotes automatically (Cleanup finds and never fixes); one "accept everything" press across buckets; hiding
a class of difference.

See [Source files and context](Source-Files-And-Context.md).

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
