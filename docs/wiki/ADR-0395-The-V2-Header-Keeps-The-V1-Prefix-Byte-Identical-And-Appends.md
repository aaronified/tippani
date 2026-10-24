# ADR-0395: The v2 header keeps the v1 prefix byte-identical and appends

Source of truth: this wiki page.

- **Area:** [§11 Backup, Restore and Recovery](ADR-Index.md#area-11)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** Bytes 0 through the ident — magic, version, mode, 16-byte salt, 12-byte nonce, ident length, ident — are byte-identical to v1 on purpose, because `web/frontend/src/secret.js` parses this header in the browser by fixed offset to decide which credential to ask for. Appending the new fields rather than inserting them keeps one parser correct for both versions, and the browser gates on the version byte besides. The parsed header keeps `Prefix` and `Raw` as the exact bytes read, because they are additional data for the wraps and the frames and must be byte-identical to what was sealed — re-serialising would risk a difference that is invisible here and fatal a year from now. My call, and the one-parser constraint is what shaped the layout rather than tidiness.

**Instead of.** A cleaner v2 layout with a second browser parser.

<sub>1.4.2 — `internal/httpapi/backup_crypto.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
