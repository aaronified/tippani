# ADR-0770: What a kept request line holds, and what it leaves out

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** The kept line is `METHOD /path?name=…&name=… STATUS DURATION BYTES REMOTE USER rid`: the query's names, every value that is not empty replaced by `…`, the share link's token in `/share/image/{token}` replaced by `…` however the path is spelled, and the single sign-on callback's code and state blanked with the other values. A successful GET or HEAD of a file — the SPA and its bundle, `/covers/{file}`, a reader's font — is kept at the `file` level (`asset` on the wire), which the System logs card hides until asked; a file that failed is kept as a request, because a missing cover is what somebody opens the log to find. The Jobs tab's own reads, `GET /jobs…` and `GET /admin/logs…`, are not kept at all. The terminal still gets the line it always did, full URI and all. `http.Server` takes 64 KB of headers at most.

**Why.** Thirty days of what readers searched for, and of live share links, exported to whoever the operator asks for help, would be a leak with a retention policy; the names alone still tell a search from a sort. Reading the log must not write the log, or a phone left open on the tab fills it with its own polls. And now that every request is kept, Go's default of a megabyte of headers is a megabyte a stranger could make the log hold, per request.

**Instead of.** The terminal's line kept as it is. An allowlist of query names safe to keep whole, which is one more list to maintain.

<sub>3.1.0 — `internal/httpapi/request_log.go` · `internal/httpapi/server.go` · `cmd/tippani/main.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
