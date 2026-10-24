# ADR-0572: Separate body-size caps per surface

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** from 1.0.0

**Decided.** There is no global body cap, because the surfaces genuinely differ: `maxAuthBody` is 4 KiB, which is plenty for credentials; `maxCRUDBody` covers quote writes; `maxUploadBytes` is 12 MiB for a cover's multipart envelope, leaving headroom around a 10 MB image that `metadata.StoreImage` re-caps after decoding; `maxRestoreUpload` is 2 GiB with a 413 beyond, and `maxRestoreBytes` is an 8 GiB decompression-bomb guard on what the archive expands to. A single generous cap would mean the login endpoint accepts a gigabyte. The restore paths additionally move the upload's read deadline with each read and clear the write deadline (section 11, *Each read of a restore upload moves its deadline a minute ahead…*), which is the one place a cap and a timeout have to be reasoned about together. My call, and I would rather have six named constants than one.

**Instead of.** One global `MaxBytesReader` in middleware.

<sub>from 1.0.0 — `internal/httpapi/auth_handlers.go` · `internal/httpapi/covers_handler.go` · `internal/httpapi/backup_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
