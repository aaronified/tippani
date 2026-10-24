# ADR-0597: A gate that only reads its own output cannot fail

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.5.2

**Decided.** `scripts/glossary-css.mjs` now refuses to write into an HTML comment rather than doing it silently.

**Why.** The UI glossary's opening comment named the `<style>` tag in its own prose and never closed, and HTML comments do not nest — so the first comment-close in the file was the one ending the *next* comment, and the entire inlined stylesheet was commented out. The generator finds its block by searching for the tag, and the first match was the mention inside the comment, so since 1.4.0 — the release added to stop this file rotting — it had been refreshing 140KB of stylesheet *inside a comment* on every run. `--check` passed the whole time, because the bytes it compares are exactly the bytes it wrote. Every sample rendered unstyled, which is the one thing the page exists not to do.

**Approved.** My call, and I approved the refusal over a smarter search — a generator that can write somewhere wrong should stop, not aim better.

<sub>1.5.2 — `CHANGELOG.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
