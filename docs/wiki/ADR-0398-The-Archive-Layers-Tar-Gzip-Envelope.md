# ADR-0398: The archive layers tar → gzip → envelope

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.1

**Decided.** The archive compresses before it is encrypted. The other order would compress ciphertext, which does not compress — ciphertext is indistinguishable from random to a compressor, so you pay the CPU and get nothing back, on a NAS that has none to spare. It is a one-line ordering decision with a one-line reason, and I am recording it because the wrong order is easy to write and produces a working archive that is simply twice the size. My call.

**Instead of.** Encrypt-then-compress.

<sub>1.4.1 — `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
