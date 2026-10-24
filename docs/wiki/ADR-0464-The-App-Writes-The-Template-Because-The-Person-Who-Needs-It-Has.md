# ADR-0464: The app writes the template, because the person who needs it has no checkout

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 2.1.3

**Decided.** `EnsureTemplate` runs at boot: it creates `<DataDir>/Locales` and writes `_TEMPLATE.txt` into it — every key in either built-in, empty, each with up to three comments (its context, the English, the Bengali). Rewritten whenever the built-ins change, compared by content so an unchanged one is not touched, and never fatal.

**The report.** A screenshot of the data directory and one question: *"my config folder shows this. where will i put my translations?"* There was no answer. `scripts/locale-template.mjs` generated exactly these bytes and could only be run from a git checkout with Node on the path; the reader is running a container. The directory did not exist, no screen said its name, and the file listing the three thousand keys was in a repository they had never cloned.

**So the script is deleted rather than kept beside it.** Two generators for one format is how the two come to disagree, and the Go one is strictly better placed: it is in the binary that holds the strings, it needs nothing installed, and it is reachable by the people the feature is for rather than by contributors.

**This overrules a stated decision, and the reversal is only half of it.** `DirName`'s comment said "Nothing creates it: design §3 requires an absent one to be survivable, so an operator who never adds a language never has the directory." The survivability half still holds and is still tested. The conclusion did not follow: a directory nobody creates is not a mercy for the operator who does not want it, it is a locked door for the one who does.

**The bug this surfaced, which is the part worth keeping.** `maxBytes` was 512 KB, commented as "about twelve times the size of a complete language". True when written; false by the end of the migration. `bn.txt` is 493 KB — a complete language within 4% of a cap meant to be twelve times its size — and the template is 652 KB, over it outright. So the app would have written a file, told the reader to fill it in, and then silently skipped their copy for being too large: the most demoralising possible outcome for somebody who had just translated 3,222 strings. Now 4 MB, with the arithmetic in the comment and a test that fails if the template ever outgrows half the cap. What reaches the wire is the parsed table, so a megabyte of comments is read once and never served.

**`_TEMPLATE.txt`, and the underscore is load-bearing.** `Files()` reads the name before the extension as a language code, so `TEMPLATE.txt` would have appeared in the picker as a language called "template" at 0%. `NormalizeCode` rejects an underscore. It also matches the format's own convention: `_name`, `_fallback` and `_dir` are the entries that are metadata rather than strings.

**Approved.** The reader's, from the question.

<sub>2.1.3 — `internal/i18n/template.go` · `internal/i18n/i18n.go` · `cmd/tippani/main.go` · `internal/i18n/README.md` · deleted `scripts/locale-template.mjs`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
