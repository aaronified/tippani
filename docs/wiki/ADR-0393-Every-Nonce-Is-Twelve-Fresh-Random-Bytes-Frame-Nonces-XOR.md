# ADR-0393: Every nonce is twelve fresh random bytes; frame nonces XOR

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** Both wraps carry their own random nonce, and that is not decoration: `recWrap`'s key is the instance recovery key, reused across every archive the box ever writes — the first key in this format that is *not* per-archive. Two archives sealed under one key at one nonce leak their plaintexts' XOR and, worse, leak GHASH's authentication subkey, which makes the wrap forgeable; and since the whole header is the frames' AAD, a forgeable wrap is a chosen-archive-key attack on the body. So nothing may derive a wrap nonce from the frame nonce, or from a counter, or from nothing. Frame nonces *are* derived, and by XOR rather than by writing the counter into the low bytes, so all twelve bytes stay archive-specific — with the low eight overwritten, two archives would share the first four bytes of every nonce. I approved both rules and the comment that explains why they are different rules.

**Instead of.** A counter nonce everywhere, which is standard practice and wrong for the one key that is not per-archive.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
