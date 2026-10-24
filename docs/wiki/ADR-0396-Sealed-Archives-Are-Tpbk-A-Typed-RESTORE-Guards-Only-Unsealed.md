# ADR-0396: Sealed archives are .tpbk; a typed RESTORE guards only unsealed ones

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** Calling a sealed archive `.tar.gz` would be a lie that costs someone an afternoon: `gunzip` refuses it and the error says nothing about why. `.tpbk` says what it is. Pre-1.4.1 archives keep their name and keep restoring. The typed `RESTORE` confirmation is now required only for an unsealed archive — the one case that has no key to stand for intent. For a sealed one, supplying the credential its header names *is* the deliberate act, and stacking a typed word on top of it is ceremony that trains people to type the word without reading the sentence above it. I approved dropping the confirmation exactly where a credential replaced it, and nowhere else.

**Instead of.** Requiring the typed word on every restore.

**Reversal.** Yes, of 1.4.1's blanket confirmation.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
