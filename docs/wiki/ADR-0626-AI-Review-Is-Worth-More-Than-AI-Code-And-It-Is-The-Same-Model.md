# ADR-0626: AI review is worth more than AI code, and it is the same model

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** 1.4.2's design went to three adversarial reviewers before a line was written — one asked to attack the cryptography, one disaster recovery, one the Go implementation.

**Why.** Between them they killed the design. The recovery key was to live in a column of the `users` table; a restore replaces that table wholesale, so restoring any archive, resetting the instance, or deleting the account would have destroyed the key silently, with the only surviving copy in a directory the next restore deletes. Two of the most ordinary operations there are, in order, no error at any point. The same reviews disproved a claim I had already published in the 1.4.1 release notes — that renaming an account orphaned its archives — by pointing at the two lines that make it false. The fix for both was to make the design smaller. What changed was not intelligence but *stance*: "find what is wrong with this" is a different question from "build this", and it is the one that was not being asked.

**Approved.** My call to run the reviews and my call to accept their verdict; I approved scrapping two designs before the third.

<sub>1.4.2 — `How-this-was-written.md` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
