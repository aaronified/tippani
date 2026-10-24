# ADR-0291: The built-in TMDB credential is injected at build time, and is a read token

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** `defaultTMDBKey` becomes a `var` filled by `-ldflags -X main.defaultTMDBKey=…` from a CI secret, empty in the source and empty in any locally built binary. The credential shipped is a **v4 read access token**, not a v3 API key. Resolution order is unchanged: a key saved in Settings > the built-in > none.

**Why a build-time injection rather than a committed constant.** The slot has existed since the beginning and has always been empty, because filling it means publishing the credential in a public repository — in every clone and in the history for ever, where rotating it does not remove it. An ldflags injection keeps it in one place that can be rotated, and leaves a fork's own build with the honest default of no built-in.

**What it does NOT buy, stated because the opposite is easy to assume.** A credential linked into a released binary is extractable from that binary; this keeps it out of the SOURCE, not out of the artefact. That is why the shipped form is a read token: TMDB's write operations take a per-user access token, so an extracted copy buys the quota and nothing else — and the quota is rate-limited per client IP, so a shared token does not pool. For the same reason it is a plain Docker `ARG` rather than a BuildKit secret mount: hiding it from `docker history` would protect nothing the image already carries.

**No client change was needed.** `metadata.TMDB` has detected the credential form since it was written — a JWT (`ey…`) goes in `Authorization: Bearer`, anything else on the query string — so the same slot takes either.

**THETVDB TAKES THE SAME SHAPE, with one difference.** `defaultTVDBKey` is the same build-time slot and the same resolution order (saved key > built-in > none), but it carries NO PIN: the credential that can be bundled is a project key, which authenticates on its own, while the free tier's PIN stands for a person's subscription and is not ours to ship. A reader on the free tier saves both halves in Settings, and their key wins.

**Approved.** The reader's: "if I want to bundle TMDB, can you do that via the API Read Access Token? i do not want to give away the API key in public", and then "ok, ci secret it is". TheTVDB and IGDB are to follow the same shape later.

<sub>v3.0.0 — `cmd/tippani/main.go` · `internal/httpapi/metadata_handlers.go` · `Makefile` · `Dockerfile` · `.github/workflows/docker-publish.yml` · `README.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
