# ADR-0609: Both CI jobs had been red on every push for eight releases

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.7.4

**Decided.** Two unrelated fixes: raise the per-package test timeout under `-race`, and add a `.gitattributes`.

**Why.** Neither was a real defect. The Go job was hitting the default ten-minute per-package timeout under `-race` and printing a goroutine dump that reads exactly like a deadlock; nothing was hanging. The frontend job was line endings, and the chain is worth recording because every link looks harmless: the committed `web/dist/index.html` held CRLF, CI builds LF, so the guard that proves the shipped UI matches its source failed on every line of a file whose content was correct. Normalisation should have prevented it — except the file contained a lone carriage return, from an autocrlf double conversion, and git reads a lone CR as evidence of a binary file. So it classified the file as binary, which switched normalisation off, which meant the CRLF could never be cleaned up by the mechanism meant to clean it up.

**Reversal.** The lesson is about the eight releases, not the two bugs: a job that is red for reasons nobody believes is a job nobody reads.

**Approved.** Mine, and I approved treating the survival time as the finding.

<sub>1.7.4 — `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
